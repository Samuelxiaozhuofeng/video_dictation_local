// Japanese word-splitting dictionary (kuromoji 0.1.2's ipadic, 12 gzipped
// files): downloaded on first use instead of shipped, so the app stays small
// for people who never practise Japanese. The frontend reads the files itself
// (utils/japanese.ts); this side only fetches, reports and removes them.
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter};

use crate::whisper_setup::{fetch, parts_dir, Asset};

macro_rules! dict_file {
  ($name:literal, $size:expr, $sha:literal) => {
    Asset {
      name: $name,
      size: $size,
      sha256: $sha,
      // Tried in order. The jsdelivr subdomains are the ones that tend to get
      // through from mainland China.
      // ponytail: no China-only mirror (npmmirror refuses single files); add one if users there report failures.
      urls: &[
        concat!("https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/", $name),
        concat!("https://fastly.jsdelivr.net/npm/kuromoji@0.1.2/dict/", $name),
        concat!("https://gcore.jsdelivr.net/npm/kuromoji@0.1.2/dict/", $name),
        concat!("https://unpkg.com/kuromoji@0.1.2/dict/", $name),
      ],
    }
  };
}

const FILES: [Asset; 12] = [
  dict_file!("base.dat.gz", 3_956_825, "0803327762e1c93ca731e4319ab8343340f2806bb84941207782cde9d2d5a8eb"),
  dict_file!("check.dat.gz", 3_111_633, "193ae0035fff6fe812b58d9ee730e7a7d7ee601d918481ce51075c58114f6cc9"),
  dict_file!("tid.dat.gz", 1_605_820, "d43d831cb6fb0f0a411739cd287a6d5e998e121a8daca614df14a81a0dcac586"),
  dict_file!("tid_pos.dat.gz", 5_916_009, "60dbfc99a6ab993f30c5dab648bec6ad7f9aaefa5c14e1843837d95e509f8895"),
  dict_file!("tid_map.dat.gz", 1_485_576, "33efd5ffd87a70f669add093fa39dee44341d58f940844ef107c8fd98bb795b2"),
  dict_file!("cc.dat.gz", 1_692_067, "02b7631be0d4de3a1a75cd9f9cc51536e4f94c9e6b389b813e06ba0f6e7de765"),
  dict_file!("unk.dat.gz", 10_512, "f7f991cdeb9bfd3e9c0e4577cc50ee0815a11c508cccd444a9d3ab3c81521100"),
  dict_file!("unk_pos.dat.gz", 10_540, "5b183a29f281acc7e0542beca47b83f7985047c0a2d27e78a66f32276be5ad11"),
  dict_file!("unk_map.dat.gz", 1_190, "6df12460e5477230bb6fd9641def918b699fc0a8868016b6c9f794488630509b"),
  dict_file!("unk_char.dat.gz", 306, "9a8e86fd9aff32d323fbb59f5a7006f05927a11f8173c90712cc56293aeb3225"),
  dict_file!("unk_compat.dat.gz", 338, "50f60aa29bc2e86c2903ab8c825bb6fa604d2b294d96941c1d3924259791899d"),
  dict_file!("unk_invoke.dat.gz", 1_140, "6b210889548457c3006913afd12c8b525562255f2709e404604be9614a25e94c"),
];

const EVENT: &str = "ja-dict-progress";

// Two download buttons (settings, practice page) must not write the same files,
// and removing must wait for a download to finish.
static BUSY: Mutex<()> = Mutex::new(());

fn dict_dir() -> PathBuf {
  parts_dir().with_file_name("ja-dict")
}

// Size only: the checksum was verified when the file landed.
fn installed_file(asset: &Asset) -> bool {
  std::fs::metadata(dict_dir().join(asset.name)).is_ok_and(|m| m.len() == asset.size)
}

#[derive(serde::Serialize)]
pub struct JaDict {
  installed: bool,
  dir: String,
  bytes: u64,
}

#[tauri::command]
pub fn ja_dict_status() -> JaDict {
  JaDict {
    installed: FILES.iter().all(installed_file),
    dir: dict_dir().to_string_lossy().into_owned(),
    bytes: FILES.iter().map(|a| a.size).sum(),
  }
}

// Emits ja-dict-progress with the overall percent while it downloads.
#[tauri::command]
pub async fn install_ja_dict(app: AppHandle) -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(move || {
    let _guard = BUSY.lock().unwrap_or_else(|e| e.into_inner());
    let todo: Vec<&Asset> = FILES.iter().filter(|a| !installed_file(a)).collect();
    if todo.is_empty() {
      return Ok(());
    }
    let dir = dict_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("setup:{e}"))?;
    let total: u64 = todo.iter().map(|a| a.size).sum();
    let mut before = 0u64;
    let mut last = None;
    for asset in todo {
      tauri::async_runtime::block_on(fetch(asset, &dir, |got| {
        let pct = ((before + got) * 100 / total.max(1)).min(99) as u32;
        if last != Some(pct) {
          last = Some(pct);
          let _ = app.emit(EVENT, pct);
        }
      }))?;
      before += asset.size;
    }
    Ok(())
  })
  .await
  .map_err(|e| format!("setup:{e}"))?
}

#[tauri::command]
pub fn remove_ja_dict() -> Result<(), String> {
  let _guard = BUSY.try_lock().map_err(|_| "busy".to_string())?;
  let dir = dict_dir();
  if dir.is_dir() {
    std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn dict_sits_beside_the_whisper_parts() {
    assert_eq!(dict_dir().parent(), parts_dir().parent());
    assert!(dict_dir().ends_with("com.linguaclip.app/ja-dict"));
  }

  #[test]
  fn file_names_are_plain() {
    for a in &FILES {
      assert!(!a.name.contains('/') && a.name.ends_with(".dat.gz"));
      assert_eq!(a.sha256.len(), 64);
    }
  }

  // Live: fetches the small files from the first URL that answers and checks them.
  #[test]
  #[ignore]
  fn downloads_and_verifies_the_small_files() {
    let dir = std::env::temp_dir().join(format!("ja-dict-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    for a in FILES.iter().filter(|a| a.size < 20_000) {
      tauri::async_runtime::block_on(fetch(a, &dir, |_| {})).unwrap();
      assert_eq!(std::fs::metadata(dir.join(a.name)).unwrap().len(), a.size);
    }
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
