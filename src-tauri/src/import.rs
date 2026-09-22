use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use tauri::{AppHandle, Emitter};

const EVENT: &str = "import-progress";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportProgress {
  id: String,
  stage: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  percent: Option<u32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  error: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  video_path: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  subtitle_text: Option<String>,
}

impl ImportProgress {
  fn stage(id: &str, stage: &str, percent: Option<u32>) -> Self {
    Self {
      id: id.to_string(),
      stage: stage.to_string(),
      percent,
      error: None,
      video_path: None,
      subtitle_text: None,
    }
  }
}

fn emit(app: &AppHandle, payload: ImportProgress) {
  if let Err(e) = app.emit(EVENT, payload) {
    log::error!("emit {EVENT}: {e}");
  }
}

fn tail_chars(s: &str, max: usize) -> String {
  let count = s.chars().count();
  if count <= max {
    return s.to_string();
  }
  s.chars().skip(count - max).collect()
}

fn home_dir() -> Result<PathBuf, String> {
  std::env::var("HOME")
    .map(PathBuf::from)
    .map_err(|_| "missing:HOME".to_string())
}

fn movies_dir() -> Result<PathBuf, String> {
  Ok(home_dir()?.join("Movies").join("LinguaClip"))
}

// Finder-launched apps get a bare PATH; yt-dlp needs node (YouTube's n-challenge)
// and ffmpeg from these dirs, so every child process gets the same augmented PATH.
fn tool_dirs() -> Vec<PathBuf> {
  let home = home_dir().unwrap_or_default();
  let mut dirs: Vec<PathBuf> = vec![
    PathBuf::from("/opt/homebrew/bin"),
    home.join(".local/bin"),
    PathBuf::from("/usr/local/bin"),
  ];
  if let Some(path) = std::env::var_os("PATH") {
    dirs.extend(std::env::split_paths(&path));
  }
  dirs
}

fn augmented_path() -> std::ffi::OsString {
  std::env::join_paths(tool_dirs()).unwrap_or_default()
}

fn find_bin(name: &str) -> Result<PathBuf, String> {
  for dir in tool_dirs() {
    let candidate = dir.join(name);
    if candidate.is_file() {
      return Ok(candidate);
    }
  }
  Err(format!("missing:{name}"))
}

fn is_url(source: &str) -> bool {
  let t = source.trim();
  t.starts_with("https://") || t.starts_with("http://")
}

fn is_youtube_url(source: &str) -> bool {
  let t = source.trim();
  let rest = if let Some(r) = t.strip_prefix("https://") {
    r
  } else if let Some(r) = t.strip_prefix("http://") {
    r
  } else {
    return false;
  };
  let host = rest
    .split('/')
    .next()
    .unwrap_or("")
    .split(':')
    .next()
    .unwrap_or("")
    .trim_start_matches("www.")
    .to_ascii_lowercase();
  host == "youtube.com" || host.ends_with(".youtube.com") || host == "youtu.be"
}

fn parse_download_pct(line: &str) -> Option<u32> {
  let idx = line.rfind("[download]")?;
  let after = &line[idx..];
  let pct_idx = after.find('%')?;
  let before = after[..pct_idx].trim_end();
  let num = before.split_whitespace().last()?;
  let v: f32 = num.parse().ok()?;
  Some(v.clamp(0.0, 100.0).round() as u32)
}

fn parse_whisper_pct(line: &str) -> Option<u32> {
  let marker = "progress = ";
  let pos = line.rfind(marker)?;
  let rest = &line[pos + marker.len()..];
  let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
  let v: u32 = digits.parse().ok()?;
  Some(v.min(100))
}

fn looks_like_video_path(line: &str) -> bool {
  let t = line.trim();
  let lower = t.to_ascii_lowercase();
  let ok_ext = lower.ends_with(".mp4") || lower.ends_with(".mov") || lower.ends_with(".m4v");
  ok_ext && t.starts_with('/')
}

fn run_streaming(mut cmd: Command, mut on_line: impl FnMut(&str)) -> Result<(i32, String), String> {
  cmd.stdout(Stdio::piped());
  cmd.stderr(Stdio::piped());
  let mut child = cmd.spawn().map_err(|e| e.to_string())?;
  let stdout = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
  let stderr = child.stderr.take().ok_or_else(|| "no stderr".to_string())?;
  let (tx, rx) = mpsc::channel::<(bool, String)>();
  let tx_out = tx.clone();
  thread::spawn(move || {
    for line in BufReader::new(stdout).lines().flatten() {
      let _ = tx_out.send((false, line));
    }
  });
  thread::spawn(move || {
    for line in BufReader::new(stderr).lines().flatten() {
      let _ = tx.send((true, line));
    }
  });
  let mut err_acc = String::new();
  for (is_err, line) in rx {
    on_line(&line);
    if is_err {
      err_acc.push_str(&line);
      err_acc.push('\n');
    }
  }
  let status = child.wait().map_err(|e| e.to_string())?;
  let code = status.code().unwrap_or(-1);
  // yt-dlp puts the useful part at the start of its last "ERROR:" line, so keep
  // the head of that line; other tools get the plain tail.
  let summary = match err_acc.rfind("ERROR:") {
    Some(i) => err_acc[i..].lines().next().unwrap_or("").chars().take(300).collect(),
    None => tail_chars(&err_acc, 300),
  };
  Ok((code, summary))
}

fn download_video(
  app: &AppHandle,
  id: &str,
  url: &str,
  yt_dlp: &Path,
  dir: &Path,
) -> Result<PathBuf, String> {
  let template = dir.join("%(title).80s [%(id)s].%(ext)s");
  let cookies = dir.join("cookies.txt");
  let mut args: Vec<String> = Vec::new();
  if cookies.is_file() {
    args.push("--cookies".into());
    args.push(cookies.to_string_lossy().into_owned());
  }
  args.push("-S".into());
  args.push("vcodec:h264,res:1080,acodec:m4a".into());
  args.push("--merge-output-format".into());
  args.push("mp4".into());
  args.push("-o".into());
  args.push(template.to_string_lossy().into_owned());
  args.push("--print".into());
  args.push("after_move:filepath".into());
  args.push("--no-simulate".into());
  args.push("--newline".into());
  args.push(url.trim().into());

  let mut cmd = Command::new(yt_dlp);
  cmd.args(&args);
  cmd.current_dir(dir);
  cmd.env("PATH", augmented_path());

  let mut last_path: Option<String> = None;
  let mut last_pct: Option<u32> = None;
  let (code, err_tail) = run_streaming(cmd, |line| {
    if looks_like_video_path(line) {
      last_path = Some(line.trim().to_string());
    }
    if let Some(pct) = parse_download_pct(line) {
      if last_pct != Some(pct) {
        last_pct = Some(pct);
        emit(app, ImportProgress::stage(id, "download", Some(pct)));
      }
    }
  })
  .map_err(|e| format!("download:{e}"))?;

  if code != 0 {
    return Err(format!("download:{err_tail}"));
  }
  let path = last_path.ok_or_else(|| format!("download:{err_tail}"))?;
  let pb = PathBuf::from(&path);
  let ext = pb
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("")
    .to_ascii_lowercase();
  if ext != "mp4" || !pb.is_file() {
    return Err(format!("download:{err_tail}"));
  }
  Ok(pb)
}

fn extract_wav(ffmpeg: &Path, video: &Path, wav: &Path) -> Result<(), String> {
  let video_s = video.to_str().ok_or_else(|| "extract:bad path".to_string())?;
  let wav_s = wav.to_str().ok_or_else(|| "extract:bad path".to_string())?;
  let output = Command::new(ffmpeg)
    .env("PATH", augmented_path())
    .args([
      "-y",
      "-loglevel",
      "error",
      "-i",
      video_s,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      wav_s,
    ])
    .output()
    .map_err(|e| format!("extract:{e}"))?;
  if !output.status.success() {
    let err = String::from_utf8_lossy(&output.stderr);
    return Err(format!("extract:{}", tail_chars(&err, 300)));
  }
  if !wav.is_file() {
    return Err("extract:wav not created".into());
  }
  Ok(())
}

fn transcribe(
  app: &AppHandle,
  id: &str,
  whisper: &Path,
  model: &Path,
  vad: &Path,
  lang: &str,
  wav: &Path,
  stem: &Path,
) -> Result<(), String> {
  let model_s = model.to_str().ok_or_else(|| "transcribe:bad path".to_string())?;
  let vad_s = vad.to_str().ok_or_else(|| "transcribe:bad path".to_string())?;
  let wav_s = wav.to_str().ok_or_else(|| "transcribe:bad path".to_string())?;
  let stem_s = stem.to_str().ok_or_else(|| "transcribe:bad path".to_string())?;
  let mut cmd = Command::new(whisper);
  cmd.env("PATH", augmented_path());
  cmd.args([
    "-m",
    model_s,
    "-l",
    lang,
    "--vad",
    "--vad-model",
    vad_s,
    "-pp",
    "-f",
    wav_s,
    "-osrt",
    "-of",
    stem_s,
  ]);
  let mut last_pct: Option<u32> = None;
  let (code, err_tail) = run_streaming(cmd, |line| {
    if let Some(pct) = parse_whisper_pct(line) {
      if last_pct != Some(pct) {
        last_pct = Some(pct);
        emit(app, ImportProgress::stage(id, "transcribe", Some(pct)));
      }
    }
  })
  .map_err(|e| format!("transcribe:{e}"))?;
  if code != 0 {
    return Err(format!("transcribe:{err_tail}"));
  }
  Ok(())
}

fn run_import(app: &AppHandle, id: &str, source: &str, lang: &str) -> Result<(), String> {
  let dir = movies_dir()?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

  let video = if is_url(source) {
    if !is_youtube_url(source) {
      return Err("download:not a YouTube URL".into());
    }
    let yt = find_bin("yt-dlp")?;
    emit(app, ImportProgress::stage(id, "download", Some(0)));
    download_video(app, id, source, &yt, &dir)?
  } else {
    let p = PathBuf::from(source.trim());
    if !p.is_file() {
      return Err("extract:video not found".into());
    }
    p
  };

  let ffmpeg = find_bin("ffmpeg")?;
  let whisper = find_bin("whisper-cli")?;
  let home = home_dir()?;
  let model = home.join(".cache/whisper.cpp/ggml-large-v3-turbo.bin");
  let vad = home.join(".cache/whisper.cpp/ggml-silero-v5.1.2.bin");
  if !model.is_file() {
    return Err("missing-model:ggml-large-v3-turbo.bin".into());
  }
  if !vad.is_file() {
    return Err("missing-model:ggml-silero-v5.1.2.bin".into());
  }

  // Work files always land in our own folder, never beside a user-picked video
  // (it may already have a hand-made lesson.srt next to it).
  let file_stem = video
    .file_stem()
    .ok_or_else(|| "extract:bad path".to_string())?;
  let stem = dir.join(file_stem);
  let wav = stem.with_extension("wav");
  let srt = stem.with_extension("srt");

  emit(app, ImportProgress::stage(id, "extract", None));
  extract_wav(&ffmpeg, &video, &wav)?;

  emit(app, ImportProgress::stage(id, "transcribe", Some(0)));
  let result = transcribe(app, id, &whisper, &model, &vad, lang, &wav, &stem);
  let _ = std::fs::remove_file(&wav);
  result?;

  let subtitle_text = std::fs::read_to_string(&srt).map_err(|e| format!("transcribe:{e}"))?;
  let video_path = video.to_string_lossy().into_owned();
  emit(
    app,
    ImportProgress {
      id: id.to_string(),
      stage: "done".into(),
      percent: Some(100),
      error: None,
      video_path: Some(video_path),
      subtitle_text: Some(subtitle_text),
    },
  );
  Ok(())
}

#[tauri::command]
pub fn start_import(app: AppHandle, id: String, source: String, lang: String) -> Result<(), String> {
  if id.trim().is_empty() || source.trim().is_empty() {
    return Err("missing id or source".into());
  }
  let lang = lang.trim().to_string();
  if !matches!(lang.as_str(), "en" | "es" | "ja" | "zh" | "auto") {
    return Err("bad-lang".into());
  }
  thread::spawn(move || {
    if let Err(e) = run_import(&app, &id, &source, &lang) {
      emit(
        &app,
        ImportProgress {
          id: id.clone(),
          stage: "error".into(),
          percent: None,
          error: Some(e),
          video_path: None,
          subtitle_text: None,
        },
      );
    }
  });
  Ok(())
}
