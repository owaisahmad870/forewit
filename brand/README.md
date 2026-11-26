# Forewit brand

The wordmark is "Forewit" with the dot of the i drawn as three rising steps: a track record that climbs. Letters are outlined from Familjen Grotesk 600 (SIL Open Font License), so the SVGs need no font.

* Colors: lime #BCF053 on #04090C (dark), olive #385805 on #F4F7F9 or white (light), text #F2F4F5 or #0B1220.
* Wordmark: forewit_wordmark_dark.svg (for dark backgrounds), forewit_wordmark_light.svg, and the _on_ versions with their own background.
* Icon: forewit_icon_dark.svg and forewit_icon_light.svg (the climbing i alone).
* PNG: png/x_avatar_400.png and x_avatar_800.png (X profile picture), png/x_header_1500x500.png (X header), png/icon_*_512.png, png/wordmark_*.png (2400 wide, transparent), and @2x renders.
* Site: web/public/favicon.svg, favicon-32.png, apple-touch-icon.png, og.png, logo.svg and web/src/brandMark.ts come from the same build.

Rebuild: `.venv/Scripts/python.exe scripts/brand/build.py`, then `node scripts/brand/png.mjs`, then `.venv/Scripts/python.exe scripts/brand/resize.py`.
