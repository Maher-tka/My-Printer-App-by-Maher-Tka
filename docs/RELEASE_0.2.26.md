# v0.2.26 - Image copies and automatic ID duplex

- Use **Image copies** in Fast Print to repeat only the selected image. For
  example, choose 9 per sheet and set Image copies to 9 to preview nine copies
  on one sheet. Repeated images use their own sheets, while other files keep
  their own quantities. Larger quantities continue onto additional sheets.
  The existing **Copies** control still repeats the complete print job.
- ID printing now defaults to automatic long-edge duplex on supported printers,
  including when the selected saved stock preset was captured as single-sided.
  The preset still supplies its printer, paper, tray and driver settings. You can
  select manual duplex in the ID review when needed.
- The preview, output totals and prepared pages account for each image's quantity.
  Quantities stay with the current Fast Print selection and reset for a new session.
  Saved printer presets and the original artwork remain unchanged.

Validation includes the full release checks and hidden Fast Print preview/output,
mixed-file, page-selection and ID workflow checks. ID photo proofs include all
eight supplied photos and rotated/off-center placements. Layout checks cover
English, French and Arabic, light/dark appearances and low-end mode. No hardware
print jobs were sent. Physical Epson duplex registration and live high-DPI and
screen-reader checks remain pending. ID output uses the chosen fixed height of
55, 56 or 60 mm; a crop with different proportions can be stretched to that size.

Installed Setup builds receive this stable release through automatic updates.
Portable users replace their executable manually.
