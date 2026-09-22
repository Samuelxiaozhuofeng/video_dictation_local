#!/bin/bash
# Puts the app that was just built into /Applications, replacing the old copy.
# Run through `npm run release`, which calls it for you after a successful build.
set -euo pipefail

APP="LinguaClip.app"
DEST="/Applications/$APP"

# A universal build lands under target/<triple>/, a plain one directly under target/.
SRC=$(ls -td \
  "src-tauri/target/release/bundle/macos/$APP" \
  src-tauri/target/*/release/bundle/macos/"$APP" \
  2>/dev/null | head -1 || true)

if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "没找到刚打好的 $APP，装不了。先确认打包这步成功了。" >&2
  exit 1
fi

# Replacing a bundle while it runs leaves the running copy half-gone, so the old
# version has to be out of the way first.
if pgrep -x LinguaClip >/dev/null 2>&1; then
  echo "旧版本正开着，先让它退出…"
  osascript -e 'quit app "LinguaClip"' >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    pgrep -x LinguaClip >/dev/null 2>&1 || break
    sleep 0.5
  done
  if pgrep -x LinguaClip >/dev/null 2>&1; then
    echo "旧版本没有退出。请手动关掉 LinguaClip 再跑一次。" >&2
    exit 1
  fi
fi

# Copy beside the target and swap, so a failure part-way never leaves
# /Applications holding half an app.
STAGE="/Applications/.$APP.incoming"
rm -rf "$STAGE"
cp -R "$SRC" "$STAGE"
rm -rf "$DEST"
mv "$STAGE" "$DEST"

echo "已装到：$DEST"
echo "来源：$SRC"
