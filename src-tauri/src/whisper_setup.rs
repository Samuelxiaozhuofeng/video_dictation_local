// Transcription parts (whisper-cli + two models): where to find them, and
// downloading whatever is missing into our own folder on first use. Nothing is
// bundled in the app; a Mac that already has Homebrew's whisper-cli or the full
// model in ~/.cache/whisper.cpp keeps using those.
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use sha2::{Digest, Sha256};
use tauri_plugin_http::reqwest;

pub struct Parts {
  pub whisper: PathBuf,
  pub model: PathBuf,
  pub vad: PathBuf,
}

struct Asset {
  name: &'static str,
  size: u64,
  sha256: &'static str,
  // Tried in order; a partial file carries over to the next one. From mainland
  // China huggingface.co usually fails, hf-mirror.com usually works.
  urls: &'static [&'static str],
}

// Built by scripts/build-whisper-cli.sh; links only system frameworks.
const WHISPER_CLI: Asset = Asset {
  name: "whisper-cli",
  size: 3_055_240,
  sha256: "09d672178dcc7daba8f5b36a2a0bab86a5de9cd8f0bcf699f2fc7f785274a80f",
  // ponytail: GitHub only; add a mirror if users in China report this step failing.
  urls: &["https://github.com/Samuelxiaozhuofeng/video_dictation_local/releases/download/whisper-cli-1.8.4/whisper-cli"],
};
// q5_0 is a third of the full model's size with near-identical output, and the
// DTW preset "large.v3.turbo" still gives word timings with it.
const MODEL: Asset = Asset {
  name: "ggml-large-v3-turbo-q5_0.bin",
  size: 574_041_195,
  sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
  urls: &[
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin",
    "https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin",
  ],
};
const VAD: Asset = Asset {
  name: "ggml-silero-v5.1.2.bin",
  size: 885_098,
  sha256: "29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf",
  urls: &[
    "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin",
    "https://hf-mirror.com/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin",
  ],
};
const FULL_MODEL: &str = "ggml-large-v3-turbo.bin";

const STALL: Duration = Duration::from_secs(30);

// Two imports that both find the parts missing must not write the same file.
static INSTALLING: Mutex<()> = Mutex::new(());

fn home() -> PathBuf {
  std::env::var_os("HOME").map(PathBuf::from).unwrap_or_default()
}

pub fn parts_dir() -> PathBuf {
  home().join("Library/Application Support/com.linguaclip.app/whisper")
}

fn first_file(candidates: Vec<PathBuf>) -> Option<PathBuf> {
  candidates.into_iter().find(|p| p.is_file())
}

fn find_whisper() -> Option<PathBuf> {
  first_file(vec![parts_dir().join(WHISPER_CLI.name)])
    .or_else(|| crate::import::find_bin("whisper-cli").ok())
}

fn find_model() -> Option<PathBuf> {
  let cache = home().join(".cache/whisper.cpp");
  first_file(vec![parts_dir().join(MODEL.name), cache.join(FULL_MODEL), cache.join(MODEL.name)])
}

fn find_vad() -> Option<PathBuf> {
  first_file(vec![parts_dir().join(VAD.name), home().join(".cache/whisper.cpp").join(VAD.name)])
}

pub fn find() -> Option<Parts> {
  Some(Parts { whisper: find_whisper()?, model: find_model()?, vad: find_vad()? })
}

fn missing() -> Vec<&'static Asset> {
  let mut out = Vec::new();
  if find_whisper().is_none() {
    out.push(&WHISPER_CLI);
  }
  if find_model().is_none() {
    out.push(&MODEL);
  }
  if find_vad().is_none() {
    out.push(&VAD);
  }
  out
}

// Returns the parts, downloading any that are missing first. `on_pct` gets the
// overall percent across everything still to fetch; it is not called at all
// when nothing is missing.
pub fn ensure(mut on_pct: impl FnMut(u32)) -> Result<Parts, String> {
  let _guard = INSTALLING.lock().unwrap_or_else(|e| e.into_inner());
  let todo = missing();
  if !todo.is_empty() {
    let dir = parts_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("setup:{e}"))?;
    let total: u64 = todo.iter().map(|a| a.size).sum();
    let mut before = 0u64;
    let mut last = None;
    for asset in todo {
      tauri::async_runtime::block_on(fetch(asset, &dir, |got| {
        let pct = ((before + got) * 100 / total.max(1)).min(99) as u32;
        if last != Some(pct) {
          last = Some(pct);
          on_pct(pct);
        }
      }))?;
      before += asset.size;
    }
  }
  find().ok_or_else(|| "setup:parts still missing after download".into())
}

async fn fetch(asset: &Asset, dir: &Path, mut on_bytes: impl FnMut(u64)) -> Result<(), String> {
  let part = dir.join(format!("{}.part", asset.name));
  let client = reqwest::Client::builder()
    .connect_timeout(Duration::from_secs(15))
    .build()
    .map_err(|e| format!("setup:{e}"))?;
  let mut last_err = String::new();
  for url in asset.urls {
    match fetch_from(&client, url, &part, asset.size, &mut on_bytes).await {
      Ok(()) if verified(&part, asset) => {
        last_err.clear();
        break;
      }
      Ok(()) => {
        // A corrupt file would never resume into a good one: drop it and let
        // the next URL start from zero.
        let _ = std::fs::remove_file(&part);
        last_err = format!("{} checksum mismatch", asset.name);
      }
      Err(e) => last_err = e,
    }
  }
  if !last_err.is_empty() {
    return Err(format!("setup:{last_err}"));
  }
  if asset.name == WHISPER_CLI.name {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&part, std::fs::Permissions::from_mode(0o755))
      .map_err(|e| format!("setup:{e}"))?;
  }
  std::fs::rename(&part, dir.join(asset.name)).map_err(|e| format!("setup:{e}"))
}

fn verified(path: &Path, asset: &Asset) -> bool {
  let Ok(mut file) = std::fs::File::open(path) else { return false };
  let mut hasher = Sha256::new();
  let Ok(len) = std::io::copy(&mut file, &mut hasher) else { return false };
  let digest: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
  len == asset.size && digest == asset.sha256
}

// Resumes from whatever `part` already holds. A stalled connection (no answer or
// no bytes for 30s) counts as a failure so the next URL gets its turn.
async fn fetch_from(
  client: &reqwest::Client,
  url: &str,
  part: &Path,
  size: u64,
  on_bytes: &mut impl FnMut(u64),
) -> Result<(), String> {
  let mut have = std::fs::metadata(part).map(|m| m.len()).unwrap_or(0);
  if have > size {
    let _ = std::fs::remove_file(part);
    have = 0;
  }
  if have == size {
    return Ok(());
  }
  let mut req = client.get(url);
  if have > 0 {
    req = req.header("Range", format!("bytes={have}-"));
  }
  let mut res = tokio::time::timeout(STALL, req.send())
    .await
    .map_err(|_| "no response".to_string())?
    .map_err(|e| e.to_string())?;
  let status = res.status().as_u16();
  let append = match status {
    206 => true,
    200 => false,
    _ => return Err(format!("HTTP {status}")),
  };
  if !append {
    have = 0;
  }
  let mut file = std::fs::OpenOptions::new()
    .create(true)
    .write(true)
    .append(append)
    .truncate(!append)
    .open(part)
    .map_err(|e| e.to_string())?;
  on_bytes(have);
  loop {
    let chunk = tokio::time::timeout(STALL, res.chunk())
      .await
      .map_err(|_| "download stalled".to_string())?
      .map_err(|e| e.to_string())?;
    let Some(chunk) = chunk else { break };
    file.write_all(&chunk).map_err(|e| e.to_string())?;
    have += chunk.len() as u64;
    on_bytes(have);
  }
  if have != size {
    return Err(format!("incomplete: {have}/{size} bytes"));
  }
  Ok(())
}

#[derive(serde::Serialize)]
pub struct ImportTools {
  whisper: bool,
  youtube: bool,
}

// What the add-video dialog needs to know before the user starts: whether the
// first import will download the transcription parts, and whether this Mac has
// the (hand-installed) YouTube downloader at all.
#[tauri::command]
pub fn import_tools() -> ImportTools {
  ImportTools { whisper: find().is_some(), youtube: crate::import::find_bin("yt-dlp").is_ok() }
}

#[cfg(test)]
mod tests {
  use super::*;

  // Real network, real HOME-independent folder: fetches the 1MB VAD model from
  // the first URL that works, resumes a partial file, and checks its sha256.
  // Run with: cargo test --manifest-path src-tauri/Cargo.toml -- --ignored fetch_vad
  #[test]
  #[ignore]
  fn fetch_vad_resumes_and_verifies() {
    let dir = std::env::temp_dir().join(format!("lc-setup-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    // A partial download left from an earlier attempt: the first 100KB, correct.
    let rt = tokio::runtime::Runtime::new().unwrap();
    let head = rt.block_on(async {
      let res = reqwest::Client::new().get(VAD.urls[0]).header("Range", "bytes=0-99999").send().await.unwrap();
      res.bytes().await.unwrap()
    });
    assert_eq!(head.len(), 100_000);
    std::fs::write(dir.join(format!("{}.part", VAD.name)), &head).unwrap();
    let mut first = None;
    rt.block_on(fetch(&VAD, &dir, |got| {
      first.get_or_insert(got);
    }))
    .unwrap();
    assert_eq!(first, Some(100_000), "should resume, not restart");
    assert_eq!(std::fs::metadata(dir.join(VAD.name)).unwrap().len(), VAD.size);
    assert!(!dir.join(format!("{}.part", VAD.name)).exists());
    std::fs::remove_dir_all(&dir).unwrap();
  }

  // Needs the Release asset to be published: downloads our whisper-cli, checks
  // its sha256, and runs it with a bare PATH like a Mac without Homebrew.
  // Run with: cargo test --manifest-path src-tauri/Cargo.toml -- --ignored fetch_whisper
  #[test]
  #[ignore]
  fn fetch_whisper_cli_runs_standalone() {
    let dir = std::env::temp_dir().join(format!("lc-setup-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(fetch(&WHISPER_CLI, &dir, |_| {})).unwrap();
    let out = std::process::Command::new(dir.join(WHISPER_CLI.name))
      .env_clear()
      .env("PATH", "/usr/bin:/bin")
      .arg("--help")
      .output()
      .unwrap();
    assert!(String::from_utf8_lossy(&out.stderr).contains("usage") || String::from_utf8_lossy(&out.stdout).contains("usage"));
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
