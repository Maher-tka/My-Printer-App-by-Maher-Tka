# v0.2.19-rc.1 - AI sticker separation and vector exports

Prerelease for workshop verification before the stable subscriber update.

- Import AI files as individual native sticker groups with Adobe Illustrator.
  Preserve their vector artwork, include objects outside printable artboards,
  and skip hidden or locked backgrounds. Originals remain unchanged.
- Separate stickers from PDF pages and flattened PNG, JPG, or WebP sheets.
  Detect plain backgrounds or transparency, join nearby artwork parts, and use
  a grid for regular sheets. Skip blank grid cells and review individual crops.
- Export each sticker separately as PNG or PDF, and native AI artwork as SVG.
  Keep available vectors in PDF exports; image crops retain their source pixels.
  Export the selected sticker or all stickers into a new output subfolder.
- Set each sticker's size and copy quantity, then send it to Cutter Montage.
  Preserve native vector masters in multi-sticker PDF output and saved projects.
- Add French and Arabic controls, safe filenames, bounded imports, and cleanup
  when processing stops or fails.

Native AI import requires the desktop app on Windows with Adobe Illustrator
already running. Pixel mask edits and AI background removal create edited raster
artwork. Reprocess from the original to restore an unmodified vector master.

This prerelease does not replace the stable automatic-update channel. Native
Illustrator integration and packaged workshop verification are being checked.
