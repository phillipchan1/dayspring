#!/usr/bin/env python3
"""Strip the alpha channel from the generated iOS app icons.

`tauri icon` writes every PNG as RGBA, even when the source image is fully
opaque. Apple rejects an App Store icon that merely *has* an alpha channel —
the 1024x1024 marketing icon (AppIcon-512@2x.png) fails validation on upload
with "Invalid Image Path ... can't be transparent nor contain an alpha
channel", and the smaller slots draw a black box behind the icon on device.

So this has to run after every `npx tauri icon` run. See docs/IOS.md.

Deliberately scoped to iOS only:
  • Android adaptive icons (ic_launcher_foreground) REQUIRE transparency —
    flattening them would put a cream square behind every launcher icon.
  • macOS ships as a signed DMG, not through the Mac App Store, and .icns
    wants alpha for its rounded corners.

Usage:  python3 scripts/flatten-ios-icons.py
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  python3 -m pip install Pillow")

# Brand background — must match the fill in src-tauri/icon-appstore.svg, or a
# semi-transparent edge pixel would composite against the wrong colour and
# leave a faint halo around the mark.
BACKGROUND = (250, 245, 234)  # #faf5ea

ICON_DIR = (
    Path(__file__).resolve().parent.parent
    / "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset"
)


def main() -> int:
    if not ICON_DIR.is_dir():
        sys.exit(f"No iOS icon set at {ICON_DIR} — run `npx tauri ios init` first.")

    icons = sorted(ICON_DIR.glob("*.png"))
    if not icons:
        sys.exit(f"No PNGs in {ICON_DIR}")

    flattened = 0
    for path in icons:
        with Image.open(path) as im:
            if im.mode == "RGB" and "transparency" not in im.info:
                continue
            rgba = im.convert("RGBA")
            flat = Image.new("RGB", rgba.size, BACKGROUND)
            flat.paste(rgba, mask=rgba.split()[3])
        flat.save(path, "PNG")
        flattened += 1
        print(f"  flattened {path.name}")

    print(f"{flattened} flattened, {len(icons) - flattened} already opaque")

    # Fail loudly if anything is still transparent — a silent pass here means a
    # rejected upload 20 minutes later.
    still = [
        p.name
        for p in icons
        if Image.open(p).mode in ("RGBA", "LA", "P")
        or "transparency" in Image.open(p).info
    ]
    if still:
        sys.exit(f"Still transparent: {', '.join(still)}")
    print("All iOS icons are opaque.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
