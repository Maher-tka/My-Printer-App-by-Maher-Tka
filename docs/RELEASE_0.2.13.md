# v0.2.13 - Compact sticker layouts and reliable exports

- Cutter and Sticker Maker place mixed designs more compactly, filling available
  space beside taller pieces and reusing gaps on earlier sheets. Placement keeps
  artwork and cut contours within the configured margins, spacing and rotation
  rules, while respecting locked copies and retained positions.
- Booklet PDF exports reuse source documents, fonts and images for large jobs.
  Imported blank pages, cropped and rotated pages, and transparency are preserved.
  Export preparation reports progress and responds to cancellation before saving
  or printing. Image exports check memory limits before allocating each canvas.
- File exports write and sync a complete temporary file before replacing the
  destination. Folder exports validate the requested filenames and data before
  writing, and saved exports remain successful if export-history recording fails.
  Completed files from an interrupted multi-file export remain available.
- Sequential Number adds an **Add same number** action for matching ticket and
  stub numbers. Copies retain the selected number's formatting and can be moved
  independently; every number position uses the same sequence value per ticket.
  French and Arabic labels are included.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually.

Automated release checks cover formatting, TypeScript, all regression suites,
Storybook and the production build. Sticker and repeated-number layouts were
inspected at the required desktop sizes, including French, Arabic RTL, dark mode
and low-end mode. Live export-state/native save-dialog checks, released workshop
build verification and physical printer/cutter checks remain pending; see
UI_REGRESSION_CHECKLIST.md for the recorded validation.
