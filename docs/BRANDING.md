# Brand assets

GrokRelay uses one original monochrome mark: two open links connected on a diagonal, inside a near-black rounded square. The compact geometry stays recognizable at tray-icon sizes. It does not use either vendor's logo.

The single geometry source is `scripts/generate-icons.py`. It writes:

- `panel/logo.svg` for the interface, browser favicon and README;
- `assets/icon.png` for the native app and tray;
- `assets/icon.ico` for Windows executable resources and shortcuts (16–256 pixels).

To regenerate, install Pillow in your development environment and run `python scripts/generate-icons.py`. The generated assets are committed; normal builds require neither Python nor Pillow. `scripts/build-desktop.ps1` embeds the ICO into the executable using Windows resource APIs. Do not replace individual surfaces with emoji, font glyphs or unrelated icons.

These original assets are distributed under the repository's MIT license.
