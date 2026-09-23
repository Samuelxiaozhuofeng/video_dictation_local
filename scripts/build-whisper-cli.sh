#!/bin/bash
# Builds the whisper-cli that the app downloads on first use (Release asset
# "whisper-cli-1.8.4"). Static: it links only macOS system frameworks, so it
# runs on a Mac with no Homebrew. After uploading a new build, put its sha256
# and size into WHISPER_CLI in src-tauri/src/whisper_setup.rs.
set -euo pipefail

VERSION=v1.8.4
WORK=src-tauri/target/whisper-cli-build
OUT=src-tauri/target/whisper-cli

command -v cmake >/dev/null || { echo "需要 cmake：brew install cmake" >&2; exit 1; }
[ -d "$WORK" ] || git clone -q --depth 1 --branch "$VERSION" https://github.com/ggml-org/whisper.cpp "$WORK"
cmake -S "$WORK" -B "$WORK/build" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
  -DGGML_METAL_EMBED_LIBRARY=ON -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0
cmake --build "$WORK/build" -j --target whisper-cli
cp "$WORK/build/bin/whisper-cli" "$OUT"
otool -L "$OUT"
shasum -a 256 "$OUT"
stat -f "%z bytes" "$OUT"
