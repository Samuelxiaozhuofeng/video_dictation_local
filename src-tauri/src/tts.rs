use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::{SinkExt, StreamExt};
use reqwest_websocket::{Message, RequestBuilderExt};
use sha2::{Digest, Sha256};
use tauri_plugin_http::reqwest;

// Microsoft Edge's "Read aloud" voices: no key, no account. Not a public API —
// it only answers a client that looks like Edge (User-Agent + Sec-MS-GEC), so
// these constants may need bumping when Microsoft tightens the check (403).
// Goes through reqwest so the macOS system proxy applies: from mainland China a
// direct connection is reset most of the time.
const TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const GEC_VERSION: &str = "1-143.0.3650.75";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.3650.75";
const ENDPOINT: &str = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const TIMEOUT: Duration = Duration::from_secs(12);
const MAX_TEXT: usize = 300;

// SHA-256 of (Windows file-time ticks, rounded down to 5 minutes) + token.
// A clock that is off by more than a few minutes gets a 403.
fn sec_ms_gec(unix_secs: u64) -> String {
  let mut t = unix_secs + 11_644_473_600;
  t -= t % 300;
  let digest = Sha256::digest(format!("{}{}", t as u128 * 10_000_000, TOKEN));
  digest.iter().map(|b| format!("{b:02X}")).collect()
}

fn xml_escape(s: &str) -> String {
  s.replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('\'', "&apos;")
    .replace('"', "&quot;")
}

fn valid_voice(v: &str) -> bool {
  !v.is_empty() && v.len() <= 64 && v.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn hex_id() -> String {
  uuid::Uuid::new_v4().simple().to_string()
}

// A binary frame is: 2-byte big-endian header length, header text, payload.
fn audio_payload(frame: &[u8]) -> Option<&[u8]> {
  if frame.len() < 2 {
    return None;
  }
  let n = u16::from_be_bytes([frame[0], frame[1]]) as usize;
  let head = frame.get(2..2 + n)?;
  if !String::from_utf8_lossy(head).contains("Path:audio") {
    return None;
  }
  Some(&frame[2 + n..])
}

async fn synthesize(text: &str, voice: &str) -> Result<Vec<u8>, String> {
  let now = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs();
  let url = format!(
    "{ENDPOINT}?TrustedClientToken={TOKEN}&ConnectionId={}&Sec-MS-GEC={}&Sec-MS-GEC-Version={GEC_VERSION}",
    hex_id(),
    sec_ms_gec(now)
  );
  let client = reqwest::Client::builder()
    .http1_only()
    .user_agent(USER_AGENT)
    .build()
    .map_err(|e| e.to_string())?;
  let res = client
    .get(url)
    .header("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
    .header("Pragma", "no-cache")
    .header("Cache-Control", "no-cache")
    .header("Cookie", format!("muid={};", hex_id().to_uppercase()))
    .upgrade()
    .send()
    .await
    .map_err(|e| format!("connect: {e}"))?;
  let mut ws = res.into_websocket().await.map_err(|e| format!("handshake: {e}"))?;

  let ts = chrono::Utc::now().format("%a %b %d %Y %H:%M:%S GMT+0000 (Coordinated Universal Time)").to_string();
  ws.send(Message::Text(format!(
    "X-Timestamp:{ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n\
     {{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":{{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"}},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}}}}}\r\n"
  )))
  .await
  .map_err(|e| e.to_string())?;
  ws.send(Message::Text(format!(
    "X-RequestId:{}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{ts}Z\r\nPath:ssml\r\n\r\n\
     <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\
     <voice name='{}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>{}</prosody></voice></speak>",
    hex_id(),
    xml_escape(voice),
    xml_escape(text)
  )))
  .await
  .map_err(|e| e.to_string())?;

  let mut mp3 = Vec::new();
  while let Some(msg) = ws.next().await {
    match msg.map_err(|e| e.to_string())? {
      Message::Binary(b) => {
        if let Some(audio) = audio_payload(&b) {
          mp3.extend_from_slice(audio);
        }
      }
      Message::Text(t) if t.contains("Path:turn.end") => break,
      Message::Close { .. } => break,
      _ => {}
    }
  }
  // A misspelt voice is not an error on their side, just silence.
  if mp3.is_empty() {
    return Err("no audio".into());
  }
  Ok(mp3)
}

// Returns raw MP3 bytes (an ArrayBuffer on the JS side).
#[tauri::command]
pub async fn tts(text: String, voice: String) -> Result<tauri::ipc::Response, String> {
  let text = text.trim();
  if text.is_empty() || text.chars().count() > MAX_TEXT {
    return Err("invalid text".into());
  }
  if !valid_voice(&voice) {
    return Err("invalid voice".into());
  }
  let mp3 = tokio::time::timeout(TIMEOUT, synthesize(text, &voice))
    .await
    .map_err(|_| "timeout".to_string())??;
  Ok(tauri::ipc::Response::new(mp3))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn gec_rounds_to_five_minutes() {
    // Same 5-minute window → same signature; next window → different.
    let base = 1_790_000_000 - (1_790_000_000 + 11_644_473_600) % 300;
    assert_eq!(sec_ms_gec(base), sec_ms_gec(base + 299));
    assert_ne!(sec_ms_gec(base), sec_ms_gec(base + 300));
    assert_eq!(sec_ms_gec(base).len(), 64);
  }

  #[test]
  fn escapes_ssml_and_checks_voice() {
    assert_eq!(xml_escape("a<b>&'\""), "a&lt;b&gt;&amp;&apos;&quot;");
    assert!(valid_voice("en-US-JennyNeural"));
    assert!(!valid_voice("x'/><evil"));
    assert!(!valid_voice(""));
  }

  #[test]
  fn keeps_only_audio_payloads() {
    let head = b"Path:audio\r\nContent-Type:audio/mpeg\r\n";
    let mut frame = (head.len() as u16).to_be_bytes().to_vec();
    frame.extend_from_slice(head);
    frame.extend_from_slice(&[1, 2, 3]);
    assert_eq!(audio_payload(&frame), Some(&[1u8, 2, 3][..]));
    let meta = b"Path:turn.start\r\n";
    let mut other = (meta.len() as u16).to_be_bytes().to_vec();
    other.extend_from_slice(meta);
    assert_eq!(audio_payload(&other), None);
    assert_eq!(audio_payload(&[0]), None);
    assert_eq!(audio_payload(&[0, 50, 1]), None);
  }

  // Hits Microsoft over the network: cargo test -- --ignored live_edge_tts
  #[tokio::test]
  #[ignore]
  async fn live_edge_tts() {
    for (text, voice) in [("was looking for", "en-US-JennyNeural"), ("tengo que ir", "es-ES-ElviraNeural")] {
      let mp3 = synthesize(text, voice).await.expect(voice);
      assert!(mp3.len() > 2000, "{voice}: {} bytes", mp3.len());
      std::fs::write(std::env::temp_dir().join(format!("{voice}.mp3")), &mp3).unwrap();
    }
    assert!(synthesize("hello", "xx-XX-NobodyNeural").await.is_err());
  }
}
