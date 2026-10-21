# AI Sticker Maker

Open AI Sticker Maker from Cutter Montage. Import several AI, PDF, PNG, JPG, or
WebP files together.

- **AI:** Open Adobe Illustrator first. Each visible, unlocked top-level object
  or group becomes a separate sticker, including artwork outside artboards.
  Group each complete sticker in Illustrator; keep background objects locked or
  hidden. Native SVG and PDF artwork is retained. The app opens a private copy,
  restores the previous Illustrator document, and leaves the original unchanged.
- **PDF:** Each page enters the queue as a sheet. Separate all sheets to locate
  stickers visually while retaining the original PDF content in each crop.
  Rotated pages and CropBox offsets are supported. Existing vectors remain vectors;
  scanned artwork keeps its raster content.
- **Images:** Select Sticker sheets before import, or select an individual image
  and choose Separate selected. Automatic detection works with transparency and
  plain backgrounds. Increase Join nearby parts if lettering separates; use Grid
  for regular cells or difficult layouts. Empty grid cells are skipped. Review
  every crop before production. Image crops retain source pixels.

Choose All stickers or Selected sticker, then PNG, PDF, or SVG and Export stickers.
SVG requires native AI vector artwork. Each export uses a new subfolder. Export
does not require background-removal processing. PNG uses rendered artwork; PDF
keeps available vector content at the selected width. Copies controls production
quantity rather than duplicating identical standalone export files.

Process the separated artwork to generate cut contours, set each design's width
and copies, then Send to Cutter. Native vector masters survive project save/open
and remain vector in multi-sticker PDF output. Pixel mask edits or AI background
removal produce edited raster artwork; reprocessing from the original restores
the native source when background removal is not requested.

Imports are limited to 65 MB per input, 500 queue entries, and 200 MB of separated
vector artwork. Original files are preserved. A stopped operation finishes its
current work before stopping. A timed-out Illustrator job retains its temporary
files and prevents a competing retry until the native operation has ended.

Validation is recorded in `docs/UI_REGRESSION_CHECKLIST.md`. These changes are
local until included in a subscriber release.
