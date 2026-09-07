#!/usr/bin/env bash
# Restores the committed iOS project state after `tauri ios init`. Safe to re-run.
# Called from CI (.github/workflows/ios-release.yml); run it locally too if you
# ever re-init the Xcode project by hand.
#
# Unlike most Tauri projects, src-tauri/gen/apple/ is COMMITTED here — the app
# icons, the Info.plist keys and project.yml are all tracked. `tauri ios init`
# regenerates that tree from scratch (Tauri's placeholder icon catalog, and a
# plist merged from Info.ios.plist that has historically dropped keys), so this
# script puts the committed truth back on top of whatever init produced.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="${ROOT}/src-tauri/gen/apple"
PLIST="${GEN}/app_iOS/Info.plist"
ICON_DIR="${GEN}/Assets.xcassets/AppIcon.appiconset"

if [ ! -f "$PLIST" ]; then
  echo "ios-postinit: Info.plist not found at $PLIST — run 'npm run tauri ios init -- --ci' first" >&2
  exit 1
fi

# 1 · Icons. `tauri ios init` writes Tauri's default placeholder catalog over
# the committed Dayspring sunrise (src-tauri/icon-1024.png → tauri icon →
# scripts/flatten-ios-icons.py → committed here). Restore the tracked files.
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" checkout -- src-tauri/gen/apple/Assets.xcassets
  echo "ios-postinit: restored the committed app icon catalog"
else
  echo "ios-postinit: not a git work tree — leaving the icon catalog as generated" >&2
fi

# 2 · Info.plist. Every key below is also in src-tauri/Info.ios.plist, which
# Tauri is supposed to merge — but the merge has been unreliable across CLI
# versions and a missing key is invisible until App Store Connect rejects the
# upload (or the OAuth deep link silently dies on device). Re-assert them.
plist_set_bool() {
  /usr/libexec/PlistBuddy -c "Add :$1 bool $2" "$PLIST" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Set :$1 $2" "$PLIST"
}
plist_set_string() {
  /usr/libexec/PlistBuddy -c "Add :$1 string $2" "$PLIST" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Set :$1 $2" "$PLIST"
}

# Export compliance — Dayspring speaks HTTPS to Supabase/Vercel and ships no
# custom crypto. Without this, every build sits in "Missing Compliance".
plist_set_bool ITSAppUsesNonExemptEncryption false

# Permission prompts. iOS kills the app on first use of a capability whose
# usage string is absent, so a dropped key reads as a crash, not a warning.
plist_set_string NSMicrophoneUsageDescription "Dayspring uses the microphone to transcribe voice journal entries."
plist_set_string NSCameraUsageDescription "Dayspring uses the camera to scan handwritten journal pages."
plist_set_string NSPhotoLibraryUsageDescription "Dayspring lets you attach photos from your library to journal entries."

# dayspring:// — how Google OAuth returns from Safari into the app.
/usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLName string com.phillipchan.dayspring" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string dayspring" "$PLIST"

# iPhone is portrait-only: landscape is 874pt wide, over useIsMobile()'s 767px
# breakpoint, so the desktop rail-plus-two-panes layout would render on a
# 874x402 phone screen. iPad is wide enough for that layout by design.
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$PLIST"
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations~ipad" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad:0 string UIInterfaceOrientationPortrait" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad:1 string UIInterfaceOrientationPortraitUpsideDown" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad:2 string UIInterfaceOrientationLandscapeLeft" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad:3 string UIInterfaceOrientationLandscapeRight" "$PLIST"

# 3 · Alpha channel. App Store Connect rejects ANY iOS app icon that carries one
# (error 90717), and the failure lands at upload — 20 minutes after the mistake.
# scripts/flatten-ios-icons.py strips it; this guards against a catalog that was
# regenerated with `tauri icon` and recommitted without that second step.
python3 - "$ICON_DIR" <<'PY'
import glob
import sys

icon_dir = sys.argv[1]
# PNG colour type lives at byte 25 of the IHDR chunk; 4 = grey+alpha, 6 = RGBA.
bad = []
for path in sorted(glob.glob(f"{icon_dir}/*.png")):
    with open(path, "rb") as f:
        header = f.read(26)
    if len(header) >= 26 and header[25] in (4, 6):
        bad.append(path)

if bad:
    print("ios-postinit: these icons carry an alpha channel (App Store will reject them):")
    for path in bad:
        print(f"  {path}")
    print("ios-postinit: run 'npx tauri icon src-tauri/icon-1024.png' then "
          "'python3 scripts/flatten-ios-icons.py' and recommit src-tauri/gen/apple/Assets.xcassets/")
    sys.exit(1)
PY

echo "ios-postinit: patched $PLIST"
