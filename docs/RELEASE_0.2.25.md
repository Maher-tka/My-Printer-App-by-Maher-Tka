# v0.2.25 - Sticker review, PNG contours and remembered printer settings

- Review image sticker sheets before separating them. Adjust crops, merge
  disconnected parts, split selections, undo edits and recover original artwork.
  Keep individual widths, copies, masks and cut offsets when sending to Cutter.
- Create white borders and separate vector cut contours for batches of transparent
  PNGs. Defaults use a 3 mm white border with the cut 1 mm inside its outer edge.
  Transfer the current AI Sticker Maker queue with its edited artwork, widths and
  copies; reopening updates existing entries without duplicates. White bleed stays
  outside the cut through nesting, resizing, project save/open and PDF export.
- Set a default saved A4 printer preset specifically for Card Montage. The choice
  survives reopening and app restarts. Missing or invalid assignments block printing
  until corrected; other tools keep their own printing preferences.
- Fast Print remembers each printer's driver options, selected preset, paper,
  color, orientation, quality and copies. New selections reset file-specific
  rotations and page ranges. Driver records are encrypted for the Windows user.
- Reduce the initial application bundle, partition large Cutter jobs more
  efficiently, share image/font resources in multi-page card PDF exports and avoid
  redundant PDF page requests during ordinary Fast Print preview navigation.

Validation covers the full release checks plus hidden sticker, contour, card
preset and native printer-settings checks. Layout proofs cover 1366×768 and
1920×1080, light/dark themes, English/French/Arabic RTL and low-end mode. No
hardware print jobs are sent. Physical cutter alignment, physical printer handling,
live high-DPI and screen-reader checks remain pending.

Installed Setup builds receive this stable release through automatic updates.
Portable users replace their executable manually. Saved projects, original
artwork, printer presets and Windows printer defaults are preserved.
