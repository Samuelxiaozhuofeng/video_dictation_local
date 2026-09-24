// Alibaba Cloud Bailian (DashScope) Qwen3-ASR file transcription. It only reads
// audio from a URL, so each piece goes: Bailian's free temporary storage (kept
// 48h) → an async task on that oss:// URL → poll → download the result JSON.
// Mainland (Beijing) endpoint; keys from the international site do not work here.
use std::time::Duration;

use serde_json::Value;
use tauri_plugin_http::reqwest;

use crate::cloud_asr::{form_body, RawWord, Resp, Seg};

const BASE: &str = "https://dashscope.aliyuncs.com/api/v1";
const MODEL: &str = "qwen3-asr-flash-filetrans";
const POLL: Duration = Duration::from_secs(2);
// An hour of audio came back in under 10s when tested; a queue can be slower.
const GIVE_UP: Duration = Duration::from_secs(30 * 60);

pub(crate) async fn send(
  client: &reqwest::Client,
  api_key: &str,
  lang: &str,
  (audio, name, mime): (Vec<u8>, &str, &str),
) -> Result<Resp, String> {
  let url = upload(client, api_key, &audio, name, mime).await?;

  let mut parameters = serde_json::json!({ "enable_words": true });
  if lang != "auto" {
    parameters["language"] = lang.into();
  }
  let task = json(
    client
      .post(format!("{BASE}/services/audio/asr/transcription"))
      .bearer_auth(api_key)
      .header("X-DashScope-Async", "enable")
      .header("X-DashScope-OssResourceResolve", "enable")
      .header("Content-Type", "application/json")
      .body(serde_json::json!({ "model": MODEL, "input": { "file_url": url }, "parameters": parameters }).to_string()),
  )
  .await?;
  let id = task.pointer("/output/task_id").and_then(Value::as_str).ok_or("cloud:no task id")?.to_string();

  let started = std::time::Instant::now();
  let mut hiccups = 0;
  let done = loop {
    tokio::time::sleep(POLL).await;
    // The task is already running (and paid for): one dropped poll on a shaky
    // connection is not a reason to throw it away.
    let t = match json(client.get(format!("{BASE}/tasks/{id}")).bearer_auth(api_key)).await {
      Err(e) if e.starts_with("cloud:network:") && hiccups < 3 => {
        hiccups += 1;
        continue;
      }
      r => r?,
    };
    hiccups = 0;
    match t.pointer("/output/task_status").and_then(Value::as_str) {
      Some("SUCCEEDED") => break t,
      Some("PENDING" | "RUNNING") if started.elapsed() < GIVE_UP => continue,
      Some("PENDING" | "RUNNING") => return Err("cloud:network:timed out waiting for Bailian".into()),
      _ => return Err(task_error(&t)),
    }
  };
  let result_url = done
    .pointer("/output/result/transcription_url")
    .and_then(Value::as_str)
    .ok_or("cloud:no result url")?
    .replacen("http://", "https://", 1);
  let result = json(client.get(result_url)).await?;
  Ok(to_resp(&result))
}

// Bailian's temporary storage: ask for an upload policy, then post the file
// straight to its OSS bucket. The policy is bound to the model it is used with.
async fn upload(client: &reqwest::Client, api_key: &str, audio: &[u8], name: &str, mime: &str) -> Result<String, String> {
  let policy = json(
    client
      .get(format!("{BASE}/uploads"))
      .query(&[("action", "getPolicy"), ("model", MODEL)])
      .bearer_auth(api_key),
  )
  .await?;
  let d = |k: &str| policy.pointer(&format!("/data/{k}")).and_then(Value::as_str).unwrap_or("").to_string();
  let key = format!("{}/{name}", d("upload_dir"));
  let boundary = format!("lc{}", uuid::Uuid::new_v4().simple());
  let (id, sig, pol, acl, fo) = (d("oss_access_key_id"), d("signature"), d("policy"), d("x_oss_object_acl"), d("x_oss_forbid_overwrite"));
  let fields = [
    ("OSSAccessKeyId", id.as_str()),
    ("Signature", sig.as_str()),
    ("policy", pol.as_str()),
    ("x-oss-object-acl", acl.as_str()),
    ("x-oss-forbid-overwrite", fo.as_str()),
    ("key", key.as_str()),
    ("success_action_status", "200"),
  ];
  let res = client
    .post(d("upload_host"))
    .header("Content-Type", format!("multipart/form-data; boundary={boundary}"))
    .body(form_body(&boundary, &fields, (audio, name, mime)))
    .send()
    .await
    .map_err(|e| format!("cloud:network:{e}"))?;
  let status = res.status().as_u16();
  if status != 200 {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("cloud:upload HTTP {status} {}", body.chars().take(200).collect::<String>()));
  }
  Ok(format!("oss://{key}"))
}

async fn json(req: reqwest::RequestBuilder) -> Result<Value, String> {
  let res = req.send().await.map_err(|e| format!("cloud:network:{e}"))?;
  let status = res.status().as_u16();
  let text = res.text().await.map_err(|e| format!("cloud:network:{e}"))?;
  let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
  if status != 200 {
    return Err(http_error(status, &v, &text));
  }
  Ok(v)
}

// Raw codes; utils/importJob.ts formatImportError turns them into sentences.
fn http_error(status: u16, v: &Value, body: &str) -> String {
  let code = v.get("code").and_then(Value::as_str).unwrap_or("");
  let msg = v
    .get("message")
    .and_then(Value::as_str)
    .map(str::to_string)
    .unwrap_or_else(|| body.chars().take(200).collect());
  match (status, code) {
    (401, _) | (_, "InvalidApiKey") => "cloud:key".into(),
    // No money left on the account, or free quota used up.
    (_, "Arrearage") | (429, _) => format!("cloud:quota:{msg}"),
    (403, _) => format!("cloud:denied:{msg}"),
    _ => format!("cloud:HTTP {status} {code} {msg}"),
  }
}

fn task_error(t: &Value) -> String {
  let s = |p: &str| t.pointer(p).and_then(Value::as_str).unwrap_or("").to_string();
  let (code, msg) = (s("/output/code"), s("/output/message"));
  if code == "Arrearage" {
    return format!("cloud:quota:{msg}");
  }
  format!("cloud:{} {code} {msg}", s("/output/task_status"))
}

// Result JSON: transcripts[0].sentences[] with begin/end in ms, text, and
// words[] (text with its spaces, punctuation apart). punctuate() rebuilds the
// words from the sentence text, same as for Groq.
fn to_resp(result: &Value) -> Resp {
  let ms = |v: &Value, k: &str| v.get(k).and_then(Value::as_f64).unwrap_or(0.0) / 1000.0;
  let text = |v: &Value| v.get("text").and_then(Value::as_str).unwrap_or("").to_string();
  let sentences = result.pointer("/transcripts/0/sentences").and_then(Value::as_array).cloned().unwrap_or_default();
  let mut resp = Resp::default();
  for s in &sentences {
    resp.segments.push(Seg { start: ms(s, "begin_time"), end: ms(s, "end_time"), text: text(s) });
    for w in s.get("words").and_then(Value::as_array).into_iter().flatten() {
      resp.words.push(RawWord { word: text(w).trim().to_string(), start: ms(w, "begin_time"), end: ms(w, "end_time") });
    }
  }
  resp
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn result_json_maps_to_lines_and_words() {
    let v = serde_json::json!({ "transcripts": [{ "sentences": [
      { "begin_time": 0, "end_time": 1200, "text": "¿Cómo te llamas?", "words": [
        { "begin_time": 0, "end_time": 400, "text": "Cómo ", "punctuation": "¿" },
        { "begin_time": 400, "end_time": 600, "text": "te ", "punctuation": "" },
        { "begin_time": 600, "end_time": 1200, "text": "llamas", "punctuation": "?" } ] } ] }] });
    let r = to_resp(&v);
    assert_eq!(r.segments.len(), 1);
    assert_eq!((r.segments[0].start, r.segments[0].end), (0.0, 1.2));
    assert_eq!(r.words.iter().map(|w| w.word.as_str()).collect::<Vec<_>>(), ["Cómo", "te", "llamas"]);
    assert_eq!(r.words[2].start, 0.6);
  }

  #[test]
  fn errors_map_to_codes() {
    let e = |s, body: &str| http_error(s, &serde_json::from_str(body).unwrap_or(Value::Null), body);
    assert_eq!(e(401, r#"{"code":"InvalidApiKey","message":"Invalid API-key provided."}"#), "cloud:key");
    assert!(e(400, r#"{"code":"Arrearage","message":"Access denied, please make sure your account is in good standing."}"#).starts_with("cloud:quota:"));
    assert!(e(500, "oops").starts_with("cloud:HTTP 500"));
  }
}
