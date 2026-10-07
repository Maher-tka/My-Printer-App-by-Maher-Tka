# v0.2.10 — Cutter artwork and cutline alignment

- Fixed a 1 mm artwork shift in Cutter Print + Cut PDFs and Illustrator/FineCut
  handoffs. Artwork now stays aligned with the clipping mask and CutContour.
- Replaced SVG symbol placement with explicit image transforms while keeping
  each source image embedded once, preserving compact exports for repeated stickers.
- Added regression coverage for rotated copies, scaled copies, and negative
  montage origins. Cutting geometry and registration marks retain their positions.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually. Re-export existing cutter files to
apply the alignment correction.

Validation includes the full release checks and native Illustrator save/reopen
verification of a 50-sticker PDF, with artwork placement error below 0.00005 mm.
Native import comparisons cover 0°, 90°, 180°, and 270° rotations. The saved PDF
retains its three production layers, 50 cut paths, and registration marks.
Physical printer/cutter verification on the workshop PC remains pending.
