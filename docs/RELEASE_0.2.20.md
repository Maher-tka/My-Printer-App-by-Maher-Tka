# v0.2.20 - Fast Print printer, orientation and A3 fixes

- Remember the last selected printer, including when closing Fast Print without
  printing. Reopen on that printer while it remains available.
- Default full-page printing to the source's original portrait/landscape
  orientation. Preserve image EXIF and PDF page rotations, including mixed-page
  documents. Fit to frame starts off; manual orientation and rotation remain.
- Correct A3 sizing and centering, including Epson WF drivers that report
  portrait printable bounds for landscape A3. Draw each prepared page at the
  selected physical size instead of shrinking it a second time.
- Show each file's page count, the combined total for PDFs and images, and output
  sheets across layouts, copies and duplex document boundaries.
- Correct color-capability detection for Konica press and other affected
  drivers, restoring Color and the A4/color 8 PIC and 9 PIC choices.
- Switch printers directly inside ID verification without losing crop, rotation,
  card-size or sheet adjustments. New ID reviews default to Compact with 10 mm
  margins and spacing; existing reviews keep their saved settings.

Automated source-orientation, page-count, driver and print-proof checks passed
locally, including mixed PDF/image jobs, A4/A3 and original-photo regressions.
Workshop diagnostics confirmed the Konica capability mismatch and Epson printable
bounds issue without changing printer defaults or sending hardware jobs.
Physical Epson/press output, trays and finishing still need workshop validation.

Installed Setup builds receive this stable release through automatic updates.
Portable users replace their executable manually. Original artwork, saved
projects and Windows printer defaults are preserved.
