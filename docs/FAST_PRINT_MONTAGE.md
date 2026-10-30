# Fast Print montage

Choose the number of pages per sheet, then enable **Compact layout** and
**Preserve actual size** below the layout picker. Enable **Combine files on
sheets** to put pages from several files on the same sheet.

- Compact layout brings artwork together in centered rows, preserving source
  order and the selected pages-per-sheet limit. Enabling it sets the cutting
  gap to 0 mm. Change the gap under **Options → Cutting gap** (0–10 mm).
- Preserve actual size uses PDF page dimensions or the image's stored DPI,
  including EXIF orientation. Images without physical resolution metadata use
  96 DPI. It disables Fit to frame and preserves dimensions on A4 and A3.
- **Separation lines · 0.25 px** adds cutting outlines to occupied items.
  **Line color…** opens the color picker. A 0.25 px stroke means 1/384 inch
  (about 0.066 mm), independent of preview or output DPI. Shared edges are drawn
  once. Black-and-white output converts the selected color to grayscale.
- Items that cannot fit at their actual size raise an error. Reduce the count,
  change orientation, or use larger paper. Final sheets stay centered, with no
  outlines around unused slots.

These settings apply to ordinary PDF and image layouts. ID and Polaroid retain
their own sizing and cutting behavior.

After building the application, run `npm run test:fast-print:montage` for hidden
native UI proofs and comparisons with the real print renderer. This uses
isolated printer settings and ValidateOnly; it sends no hardware print jobs.
Evidence is saved under `output/fast-print-montage/<run-id>/`.
