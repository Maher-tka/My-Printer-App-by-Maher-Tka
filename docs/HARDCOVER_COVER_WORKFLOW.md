# Hardcover Cover workflow

1. Measure the finished glued book block: board width, board height, and spine thickness.
2. Enter the measurements and four wrap margins. The live sheet size is `left wrap + back + spine + front + right wrap` by `top wrap + book height + bottom wrap` (plus optional bleed).
3. Choose one of the eight local templates or duplicate and recolor a custom template.
4. Enter front-cover student/title/university fields, spine short title/year, and optional back-cover summary/contact details.
5. Check the spine fit badge. Auto-fit reduces the type size and warns when the physical spine is too narrow.
6. Use Layout View for fold/safe guides, Clean Preview for approval, and Print Preview for the selected export mode.
7. Export a Production Guide PDF for internal checking, then Print Final PDF/SVG for production. PDF page dimensions are generated from millimeters.
8. Export the JPG customer preview for WhatsApp approval.
9. For graduation batches, import CSV columns `studentName,title,year,department,supervisor,spineTitle`. Export runs one cover at a time to protect low-end PCs, or produces one combined PDF.
10. Print the approved final cover and wrap the hardcover.

For the standard example (21 × 29.7 cm book, 2 cm spine, 2 cm wraps), the sheet is exactly 48 × 33.7 cm.

Arabic and French text remain Unicode in SVG and browser previews. The current PDF exporter uses built-in fonts; non-Latin PDF glyph embedding still needs a bundled Arabic-capable font before Arabic PDF output can be considered production-approved.
