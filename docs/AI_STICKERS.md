# AI Sticker Maker

Open AI Sticker Maker from Cutter Montage. Import several AI, PDF, PNG, JPG, or
WebP files together.

## PNG white contour

Choose **PNG white contour** from the Cutter artwork library or AI Sticker Maker.
Opening it from AI Sticker Maker automatically carries the current sticker queue,
including edited masks/prepared crops, individual artwork widths and copies.
Unprocessed images are included too. The AI queue remains intact; reopening reuses
the transferred entries and updates changed artwork or quantities without adding
duplicates. Separate any sticker sheets into individual stickers first.

Import or drop up to 100 transparent PNG images together. Each image receives
white border artwork and a separate vector cut contour automatically, using its
existing transparency without downloading or running AI.

The default white border is **3 mm**. The cut line sits **1 mm inside the outer
white edge**, leaving a 2 mm white margin around the artwork and 1 mm of printed
white bleed beyond the cut. Adjust **White border** and **Cut safety inset** to
match the job. At least 0.2 mm is retained on both sides of the cut. These margins
reduce alignment errors; physical cutter calibration still matters.

**Artwork width** sets the original PNG canvas width before adding its border.
Changing size or margins requires **Update contours** before sending. Set copies
per image, review the pink cut lines, then **Send to Cutter**. Failed images must
be corrected or removed before sending the batch. Disconnected designs may have
multiple exterior contours; internal holes are not cut.

The Cutter keeps the white bleed outside the cut path during layout, resizing,
project save/open and PDF output. Printed artwork and CutContour stay separate.
Back navigation retains this queue for the current Cutter session; the shared
Clear action clears the visible PNG queue. Send designs to Cutter before saving
them in a project. Original PNG files remain unchanged. Opaque PNGs need their
background removed first in AI Sticker Maker. Limits: 65 MB per source, 24
megapixels after bordering and 200 MB of prepared PNG artwork per session.

## Import artwork

- **AI:** Open Adobe Illustrator first. Each visible, unlocked top-level object
  or group becomes a separate sticker, including artwork outside artboards.
  Group each complete sticker in Illustrator; keep background objects locked or
  hidden. Native SVG and PDF artwork is retained. The app opens a private copy,
  restores the previous Illustrator document, and leaves the original unchanged.
- **PDF:** Each page enters the queue as a sheet. Pages containing only images
  use the editable image crop review. Pages with paths or text retain the original
  PDF content in each crop. Rotated pages and CropBox offsets are supported.
  Existing vectors remain vectors; scanned artwork stays raster.
- **Images:** Choose Import sticker sheet, or select an existing image and choose
  Review image stickers. Each suggested sticker has its own review tab. Drag the
  selection/corner handles or enter pixel bounds, add missed selections, and use
  the selection checkboxes with Merge selected parts to keep disconnected artwork
  together. Split vertically or Split horizontally divides a merged selection into
  two editable crops. Undo/Redo covers splits and selection edits. Background
  removal is opt-in per sticker. Exclude neighboring artwork keeps only the
  detected component(s), including explicitly merged parts and enclosed dark
  details. It is available for detected selections; manual/split crops can use the
  mask brushes after opening. The processed preview shows optional cleanup before
  Open stickers creates independent editable items with their contours.

Image review keeps the original sheet and untouched crops in the current AI
Sticker Maker session. Adjust sticker crop can recover artwork outside an earlier
selection. In Mask view, Restore paints back original pixels even when they match
the removed background; Restore original artwork recovers the whole crop. Each
sticker retains separate mask Undo/Redo, size, copies and cut settings. Image-sheet
results default to Selected sticker for cut settings; All unsent stickers remains
available. Sending to Cutter retains each sticker's own cut offset. Changing a
crop replaces that sticker's mask edits, as indicated in the review screen.

Choose All stickers or Selected sticker, then PNG, PDF, or SVG and Export stickers.
SVG requires native AI vector artwork. Each export uses a new subfolder. Export
does not require background-removal processing. PNG uses rendered artwork; PDF
keeps available vector content at the selected width. Copies controls production
quantity rather than duplicating identical standalone export files.

Image review generates the initial cut contours when opening the stickers. Other
artwork uses Process all. Set each design's width and copies, then Send to Cutter.
Native vector masters survive project save/open
and remain vector in multi-sticker PDF output. Pixel mask edits or AI background
removal produce edited raster artwork; reprocessing from the original restores
the native source when background removal is not requested.

Imports are limited to 256 MB per PDF, 65 MB per image/native AI input, 500 queue
entries, and 200 MB of separated artwork. PDF pages render one at a time at up to
300 DPI, 5000 pixels on the long edge and 12 megapixels. Detection recognizes dark
flattened checkerboards and starts without joining neighboring regions. Enclosed
details stay with their outlines; tiny contained fragments retain their source
points within the surrounding selection. Dense or touching
designs can still need manual crop/merge/mask corrections; suggestions are not a
guarantee of one selection per sticker. Original files are preserved. A stopped operation finishes its
current work before stopping. A timed-out Illustrator job retains its temporary
files and prevents a competing retry until the native operation has ended.

Core export features are available in v0.2.19. The image-review improvements and
PNG white contour workflow are included in v0.2.25. Validation is recorded in
`docs/UI_REGRESSION_CHECKLIST.md`.
