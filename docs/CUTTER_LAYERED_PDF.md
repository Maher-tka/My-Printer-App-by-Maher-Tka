# Cutter layered PDF workflow

Select **Layered Print + Cut PDF** in Production Export, then Export Layered PDF.
Job folders also contain `06_Layered_PrintCut_Layout_...pdf` for each unique layout.

The PDF has three optional-content layers: Artwork, CutContour, and FC RegisterMark Layer1.
Artwork and marks are visible and printable. CutContour is hidden by default and has PDF print usage OFF, including when made visible for inspection. The print-only preset still omits all cut paths.

Creating a clipping mask preserves the artwork transform. New contours duplicated from helper/mask shapes use a 0.25 pt stroke and zero offset; explicit contour offsets remain editable. Grid snapping starts off. Hidden contours remain in production bounds and in PDF/SVG/EPS exports; use the object export flag to exclude a contour. EPS now preserves multiple contours and custom/rounded paths without scaling the stroke width. The editor, montage and PDF share ellipse, rounded rectangle and custom path geometry.

## Compatibility limits

This is a standards-based layered PDF, not a native Illustrator document with proprietary Illustrator editing data. Illustrator may flatten or omit PDF optional-content structure when opening it. Native Illustrator layer preservation and FineCut register-mark recognition have NOT been verified. Keep the matching cut-only SVG/EPS files as a handoff option and validate on the activated work-PC installation before production. Imported PDF/SVG artwork still uses the existing raster artwork export pipeline; cut paths and clipping paths are vectors.

Direct cutter output is currently a simulation/scaffold. No official SDK adapter or hardware connection was implemented. Mimaki's public MDL SDK portal requires registration/login and describes printer control; its CG-130AR coverage cannot be inferred from the site's navigation. FineCut separately refers to a Mimaki Register marks SDK. Obtain the official register-mark/cutter-control SDK and documentation covering CG-130AR before implementing transport.

Official references checked 2026-09-19:
- https://mimaki.com/download/sdk/
- https://mimaki.com/product/software/cutting/fine-cut9-ai/software.html?software=444530
- https://helpx.adobe.com/illustrator/using/pdf-options.html

## Verification

`npm run test:cutter` includes layeredPdf.test.ts: three layers, hidden/nonprinting cut layer, retained hidden editor contours, CutContour separation, 0.25 pt stroke, physical rotated-path coordinates, and print-only omission. `npm run build` passes. The print and visible-cut PNG proofs in tmp/pdfs/layered-cutter were rendered with Poppler and visually inspected, including rotated artwork clipping.
