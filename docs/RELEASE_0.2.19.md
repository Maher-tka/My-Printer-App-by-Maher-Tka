# v0.2.19 - Individual sticker exports and preserved vectors

- Import Illustrator AI designs as separate native sticker groups. Keep complete
  sticker artwork, include groups outside printable artboards, and skip hidden
  or locked backgrounds. The original Illustrator file remains unchanged.
- Separate stickers from PDF pages and flattened PNG, JPG, or WebP sheets using
  automatic plain-background detection or a regular grid. Group nearby parts,
  adjust crop padding, skip blank grid cells, and review each crop.
- Export one selected sticker or all stickers as individual PNG/PDF files.
  Native AI artwork also supports SVG export. PDF exports preserve available
  vectors; flattened images retain their source pixels.
- Set each design's width and copy quantity, then send the stickers to Cutter
  Montage. Keep native vector masters in multi-sticker PDF output and saved
  projects, including after reopening a project.
- Add translated French and Arabic controls, separate import/processing/output
  actions, safe output filenames, bounded imports, and cleanup after failures.

Native AI import requires Windows with Adobe Illustrator already running. Group
each complete sticker before import and lock or hide background objects. Pixel
mask edits and AI background removal produce edited raster artwork; reprocess
from the original to restore an unmodified vector source.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually. Original artwork, saved projects and
printer settings are preserved. Detailed validation is recorded in
UI_REGRESSION_CHECKLIST.md; proof checks do not send hardware print jobs.

The prerelease installer passed checksum verification and workshop installation.
Automated native-script and vector-output checks passed. Live app-to-Illustrator
import/export and full application-shell interaction remain pending because
workshop desktop automation was unavailable; they are not reported as passed.
