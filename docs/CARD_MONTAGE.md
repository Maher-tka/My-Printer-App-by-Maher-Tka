# Card Montage

Open **Card Montage** from the dashboard, sidebar, or quick search. Import a PDF,
PDF-compatible Illustrator (`.ai`), PNG, or JPEG business card (up to 30 MB) by browsing or dropping the file.

The tool repeats one design on a centered A4 sheet:

- **Zero spacing:** card edges touch. Card width and height are editable in cm.
- **With spacing:** set horizontal and vertical gaps separately in mm.
- **Auto 8.8 × 5.6 cm:** fixed 88 × 56 mm cards, adjustable horizontal gap (1 cm by default) and 1 mm
  vertical gap. With the default 5 mm minimum margin, portrait A4 holds 10 cards
  in 2 columns and 5 rows.
  Change **Space between columns (cm)** to adjust the gap between the left and right columns.
  Preview and export update together. Wider gaps may reduce the number of columns that fit on A4.

The import panel shows **Original file size** separately from **Printed card size**.
Modes 1 and 2 keep a normal-sized original and offer **8.5 × 5.5 cm**, **8 × 5 cm**,
**Use original size**, and editable dimensions. Sources over 20% larger than
8.5 × 5.5 cm start at whichever of the two standard sizes has the closest aspect
ratio. Original measurements remain visible, and you can override the suggestion.

Front and back have separate import panels, thumbnails, page/artboard selectors,
and original-size indicators. Multi-page PDFs and PDF-compatible AI files use the
same visual selector as Hardcover: thumbnail strip, Previous/Next controls, and
a page/artboard number jump. Front and back can select any two pages independently.
Larger files load thumbnails in small batches with **Load more pages**; jumping
directly to a later page also makes that selected page available in the strip.
Only the selected front/back designs are exported unless all-pages export is chosen.
Changing selections keeps the print dimensions and preserves original PDF/AI bytes
and embedded fonts. Importing a two-page PDF or AI into the front panel
automatically places page 2 in the back panel. You can replace the back with a
separate file or select another page. An independently imported back is preserved
when replacing the front file. **Include back in export and printing** produces
front then back on separate A4 pages in one PDF. Turn it off for front-only output.
Use **Front side** or **Back side** to preview one sheet, or **Both sides** to
show the front and back A4 sheets next to each other. An empty side shows a
placeholder until its design is imported.

Use **Zoom in**, **Zoom out**, or **Ctrl + mouse wheel** over the sheet preview
to zoom from 25% to 400%. **Fit** resets to 100% and fits the visible sheet(s).
Scroll within the preview to inspect enlarged artwork. Both sides share the same
zoom level. Preview zoom does not change card dimensions or exported PDFs.

PDFs use the selected page's visible size and rotation. Changing PDF pages preserves the chosen card dimensions. Images assume
300 dpi for the initial dimensions; adjust dimensions in the first two modes.

Auto mode always resizes the artwork itself to exactly **8.8 × 5.6 cm**, regardless
of its original dimensions or a sizing choice previously used in modes 1 and 2.
For modes 1 and 2, **Resize to exact card size** fills each card, changing
proportions when needed. **Keep proportions** fits the artwork inside the card
and may leave white borders.
The preview and PDF use the same dimensions and placement. In zero-spacing and
spaced modes, **Crop crosses (0.25 px)** places a cross exactly at each card corner;
shared corners are drawn once. Switch crosses on/off and set **Crop cross color**
under Advanced settings.

Auto 8.8 × 5.6 cm mode has no crosses. Its separate **Cutting rectangle (0.25 px)**
checkbox is visible in Setup. It draws a rectangle on each card boundary, with
**Outline color** independent of the artwork and its own on/off setting. Black is
the default; pure white selections fall back to black to keep cutting guides visible
on white stock. Choose a contrasting color for your design. Outlines are off by default. Both marking styles match between
preview, export, and printing on front and back sheets. The physical line width is
0.25 CSS px at 96 dpi (0.1875 PDF pt, about 0.066 mm).

**Clear** removes the loaded front and back designs, messages, and preview zoom,
while keeping montage dimensions, spacing, and crop preferences for the next card.

**Print A4** first opens a popup for **Front only**, **Back only**, or **Both sides**
and **Copies** (1–999). **Printer settings** prepares the selected sheet(s) and
opens the native printer dialog with that copy count. The copy count applies to
the A4 sheets; both-side jobs are collated as front/back sets. Cancel closes the
popup without starting a print request.

Export an A4 PDF or use the desktop printer dialog. Print at **100% / actual size**
on A4. PDF input remains vector artwork in the export; images are embedded from
their full imported resolution. The current card and settings remain available
when navigating to another tool during the same app session. Card Montage does
not currently save `.mpjob` projects.

## Illustrator and font preservation

PDF-compatible AI is read directly from its saved PDF representation; Illustrator
is not opened. The export copies original page content, vector paths, embedded
images, and embedded font programs. Text does not need to be outlined when its
font data is embedded. The font status panel identifies embedded fonts on the
selected side or all sides when exporting the whole file.

Native-only AI without a PDF representation is rejected with an explanation.
PDF/AI font resources without embedded font programs stop export and printing
instead of silently substituting a font. Type 3 glyph programs are also supported.
The app cannot reconstruct a missing font that the source file does not contain.

To validate a real sample folder and produce A4 PDFs for both sides, run:

```powershell
npx tsx scripts/test-card-production-samples.ts "C:\path\to\samples"
```

The sample check verifies that embedded font programs are byte-for-byte unchanged
and that both sides retain their source font resources. Outputs and the inspection
summary are saved under `output/pdf/card-source-test/`.

Run `npm run test:card` to check the three layouts, sheet bounds, cutting marks,
physical PDF sizes, page selection, crop boxes, PDF rotation, and image placement.
