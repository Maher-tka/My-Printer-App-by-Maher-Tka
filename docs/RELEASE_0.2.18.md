# v0.2.18 - Better Fast Print presets and reliable ID printing

- Improve the general 2/4/6/8/9/12/16-per-sheet presets on A4 and A3 with equal
  frame sizes, safe outside margins and adjustable cutting gaps. Incomplete final
  sheets and rows are centered without changing the remaining items' size.
- Rotate every selected file together, or rotate one selected file inside its
  frame. Native previews and prepared print sheets now use matching positions,
  margins, gaps and rotations. Photo-only selections use Fit to frame; full-image
  and full-page fitting remain available.
- Keep both ID sides horizontal with a shared 90 x 55/56/60 mm size preset and
  a 180-degree flip. Improve full-card detection, perspective correction and
  sideways/upside-down checks using local recognition. Add multiple IDs per sheet,
  even or compact spacing, cutting gaps and margin settings with aligned duplex
  centers.
- Return from ID review to printer settings without losing the selected images,
  card corners, rotations or layout settings. Preserve the review when printer
  validation fails, and reject changed inputs rather than applying stale edits.
- Show Polaroid preparation progress without opening vendor printer settings.
  Printing reuses the reviewed high-resolution sheets instead of repeating photo
  analysis, while detecting changed source files and retaining print-access checks.
- Preserve original artwork, saved projects, printer preferences and Windows
  printer defaults. Update English, French and Arabic controls and validation.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually. DOCX still requires installed Word or
LibreOffice; a converter is not bundled.

Validation includes release checks, A4/A3 native-preview versus print-sheet proofs,
printer-state and source-change regressions, the real ID-photo corpus, and both
Polaroid modes with the local photo corpus. Proof checks do not submit hardware
print jobs. Physical workshop output, vendor finishing and live high-DPI/high-
contrast interaction remain pending; detailed results are recorded in
UI_REGRESSION_CHECKLIST.md.
