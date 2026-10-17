# v0.2.14 - Move stickers and keep the cutter preview steady

- Fixes shaking when expanding the cutter canvas or fitting the sheet near a
  scrollbar threshold. The preview now fits to stable viewport dimensions.
- In Layout & export, drag stickers before exporting. Artwork and cut lines
  move together, and overlapping neighbors move into nearby free space on the
  same physical sheet. Selected groups move together. Locked copies stay fixed;
  moves that cannot fit safely leave the original layout intact.
- Manual moves respect production margins and spacing, retain custom positions
  in projects and exported output, and support Undo Arrange or Ctrl+Z from the
  canvas. Arrow keys use the same placement rules. Move results and errors are
  translated into French and Arabic.
- Cleans up the cutter layout preview by removing the floating overview beneath
  the sheet and duplicate command popovers over stickers. Editing commands stay
  in the canvas toolbar. Selection boxes follow the actual cropped sticker and
  cut-line bounds; dragged stickers stay above neighboring copies.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually.

Validation covers the full release checks, cutter movement and preview
regressions, project round trips, and matching artwork/CutContour coordinates in
exported SVG. Layouts were inspected at 1366×768, 1600×900 and 1920×1080,
including light/dark themes, French, Arabic RTL, keyboard access and low-end
mode. Released workshop-build and physical print/cut verification remain pending;
see UI_REGRESSION_CHECKLIST.md for the recorded checks.
