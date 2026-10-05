# v0.2.8 — Preserve separate EPS card artboards

- Fixed Card Montage EPS import combining front and back artboards into one wide
  design. The converter now opens the native EPS in Adobe Illustrator and saves
  every artboard as a separate PDF page, preserving its order and dimensions.
- Importing a two-artboard EPS automatically loads artboard 1 as the front and
  artboard 2 as the back. Existing page selectors support choosing other artboards.
- Conversion validates the PDF page count and each artboard's size. Single-artboard
  EPS import and vector montage export remain supported.

For EPS designs imported before this fix, use Clear and reimport the original
EPS. Previously saved converted artwork retains its old combined page until it
is replaced. Adobe Illustrator is required for EPS conversion.

Installed Setup builds receive this stable update automatically at launch.
Portable builds are updated manually. Saved files and settings are retained.

Verified native Illustrator conversion with one- and two-artboard EPS fixtures,
front/back previews and montage export. The reported original EPS was unavailable
for verification. Physical printing remains pending.
