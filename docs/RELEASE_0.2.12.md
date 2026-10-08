# v0.2.12 - CS6-compatible Cutter PDFs and accurate JPEG colors

- Native Cutter Print + Cut PDFs now retain Illustrator CS6-format editing data
  with separate Artwork, CutContour and registration layers. The cut layer stays
  hidden and non-printing; artwork and registration marks stay visible and printable.
  Single-sheet, separate-sheet batch and Illustrator/FineCut exports use the same
  compatibility approach. Re-export existing PDFs to obtain the legacy editing data.
- Exports verify the CS6 editing header, three PDF layers, one page, native cut
  paths, registration marks and sheet dimensions before reporting success.
- Illustrator export detects open startup/FineCut dialogs before entering a
  blocking automation call, reports readable instructions, preserves diagnostics
  and prevents overlapping retries after a timeout. Open Illustrator and dismiss
  its startup dialogs before exporting.
- Card Montage preserves original JPEG pixels, color channels and ICC profiles,
  including CMYK artwork, grayscale, RGB and EXIF orientation/mirroring. Previews
  use the bundled color-management decoder, and PDF exports retain the original
  JPEG bytes and profile instead of converting them through a browser canvas.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually.

The CS6-targeted sample contains three editable layers and the printed page is
pixel-identical to the previous export. Native reopening was verified in
Illustrator 30.8.2. Actual opening in Illustrator CS6 on the user's other PC and
physical printer/cutter checks remain pending. CMYK JPEG verification covers
original embedded data, color-managed previews, export rendering and orientation.
The full release checks run before publication.
