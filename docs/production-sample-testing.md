# Production sample testing guide

This guide uses the client-provided library at `C:\Users\Maher\Documents\test vinnyl` as a read-only reference set. The files are examples of real Illustrator, vinyl-montage, and book jobs. They are test fixtures only: client files must never be copied into the repository, committed to Git, or rewritten by the inspector.

## Inspector commands

Run from the project root:

```powershell
npx tsx scripts/inspect-production-samples.ts "C:\Users\Maher\Documents\test vinnyl"
npx tsx scripts/inspect-production-samples.ts "C:\Users\Maher\Documents\test vinnyl" --json
```

The inspector also accepts the named environment variable:

```powershell
$env:PRINTER_PRODUCTION_SAMPLES_DIR = 'C:\Users\Maher\Documents\test vinnyl'
npx tsx scripts/inspect-production-samples.ts --json
```

The script recursively reads `.pdf` files and PDF-compatible `.ai` files. It reports file size, page count, physical dimensions, Media/Crop/Trim/Bleed/Art boxes, encryption status, creator/producer, optional-content layers and default visibility, and Separation/DeviceN colorant names. It never saves a PDF, edits metadata, creates previews, or writes inside the sample folder. If JSON needs to be retained, redirect it to a dedicated test-output directory outside the client folder, for example `tmp/production-sample-inspector/`; do not commit that report.

If parsing dependencies are unavailable, the script stops with guidance to run `npm install`. It uses only the existing `pdfjs-dist` and `pdf-lib` dependencies.

## Golden vinyl fixtures

Use these files for Cutter Montage smoke tests and visual comparison with Illustrator:

- `1 m brillant  - 4.pdf`
- `impression et decoupe planche 1 .pdf`
- `vinyle\1m vinyle  fel zan9a  - 5.pdf`
- `vinyle\nada  - 4.pdf`
- `vinyle\sahbi 1 e.pdf`
- `vinyle\sahbi 2 e.pdf`
- `vinyle\transparent sahbi - 3.pdf`
- `Nouveau dossier\montage algerienne  - 1.pdf`
- `Nouveau dossier\O 10 NOIR  - 5.pdf`
- `VISACARD.ai` (PDF-compatible Illustrator input)

The strongest fixtures contain the Illustrator optional-content layers `Calque 1`, hidden `Calque 2`, and `FC RegisterMark Layer1`, plus the spot separations `MimakiFCRM` and `MimakiFCRMDir`. The expected inspector result is:

- `Calque 2` is detected with `defaultOn: false`.
- `FC RegisterMark Layer1` is reported as a separate layer.
- `MimakiFCRM` and `MimakiFCRMDir` are reported as `Separation` colorants when present.
- Mimaki colorants are explicitly reported as FineCut registration-mark signals, never as `CutContour`.
- The sheet size is preserved from the source PDF boxes; a montage must not be resized merely because it is being previewed.
- The default print preview shows artwork. Hidden production content and registration marks must not become ordinary artwork or a visible customer cutline.

The inspector can report a fixture as `already-imposed` when its name, sheet size, and production signals indicate a prepared montage. That classification means “the source is already arranged on a sheet”; it does not mean that every hidden layer is a CutContour. A true editable cut path must be supplied or identified explicitly by the Cutter workflow.

## Negative and ambiguous controls

- `vinyle - 10.pdf` is an artwork-only control: it has Illustrator artwork but no confirmed hidden production layer or Mimaki registration-mark separations.
- `montagecartes copy.pdf` is useful for testing `DeviceN` discovery and conservative classification. Do not assume every DeviceN colorant is a cut path.
- `VISACARD.ai` verifies PDF-compatible `.ai` detection. A non-PDF `.ai` file is listed as skipped with a reason.

For every golden and negative control, check that the inspector preserves the original file size and that the sample file’s modified time remains unchanged. The inspector does not calculate or store hashes because the test is intended to be read-only and non-invasive.

## Vinyl Montage app test

1. Run the inspector and record the MediaBox physical size for `impression et decoupe planche 1 .pdf` and `1 m brillant  - 4.pdf`.
2. Import one of those pages into Cutter Montage.
3. Confirm the app’s page size agrees with the inspector within 0.1 mm.
4. Confirm the normal preview shows the artwork at the correct sheet position and scale.
5. Confirm hidden Illustrator production layers do not appear as artwork. Registration marks are production signals, not customer artwork.
6. If a CutContour is created in the app, verify it is a separate vector cut object and is not inferred from `MimakiFCRM` or `MimakiFCRMDir`.
7. Open the clean montage preview before printing. It should show only the prepared masked artwork, without layer names, helper shapes, or a customer-facing cutline.
8. Export the print-only output and confirm the visible artwork is present without a visible cutting line.
9. Export the FineCut/cut handoff and confirm the cut geometry is vector and separately named as the app’s CutContour output.
10. Open the outputs in Illustrator or FineCut at high zoom. Check full sticker edges, sheet dimensions, registration-mark placement, and quarter-turn rotations before using production material.

The Illustrator references are for learning the expected production separation: artwork, optional-content production layers, registration marks, and cut geometry have different jobs. The app must keep those jobs distinct. A hidden layer named `Calque 2` is evidence to inspect, not permission to expose it as the customer preview.

## Hardcover and book fixtures

Use the paired cover PDFs for a hardcover setup test:

- Front cover: `24-06-2026\6 LIVRE 50740380\PAGE DE GARDE.pdf`
- Back cover: `24-06-2026\6 LIVRE 50740380\arriere.pdf`

Expected behavior:

- The front and back sources can be assigned independently.
- Page boxes and physical size are reported before placement.
- Fit/Fill behavior is explicit and does not silently crop the cover.
- The cover preview respects bleed, trim, wrap, and spine measurements.
- French and Arabic text remains present in first, middle, and last-page previews.

Recommended interior/book smoke fixtures:

- `24-06-2026\2 livre 21284883\ETUDE ET CONCEPTION SFE2026.pdf` — 64 pages.
- `24-06-2026\6 LIVRE 50740380\RAPPORT FINALE DE MEMOIRE_compressed.pdf` — 183 pages.
- `Rapport PFE2026 (AMIR BENABDALLAH).pdf` — 86 pages.
- `06-06\2 livre chart 23947032\chart 3.pdf` — 42-page square-book fixture.

For each book smoke fixture, inspect page 1, a middle page, and the final page. Verify no blank thumbnail, clipping, rotation error, missing text, or stale object URL appears after switching files or reopening the project. Use `Menu Koujihhhhna (2)-adjust-booklet.pdf` only as a booklet/imposition control; it is already imposed and should not be treated as a normal hardcover source.

## Stress fixtures and limits

Run large files only as opt-in tests on a machine with enough free memory:

- `RAPPORT FINALE DE MEMOIRE_compressed.pdf` — 183 pages.
- `06-06\2 livre chart 23947032\chart 3.pdf` — approximately 193 MB.
- `30 ps  ps  - 1.pdf` — approximately 419 MB.
- `planche de presentation.pdf` — approximately 354 MB.
- `24-06-2026\1 charte 53880146\charte sensation [Récupéré].pdf` — approximately 359 MB.

Test lazy loading, cancellation, reopening, and cleanup. A canceled import must release the PDF document, page previews, and object URLs. Stress tests must not write derived files into `C:\Users\Maher\Documents\test vinnyl`; any optional report or rendered output belongs in a dedicated ignored test-output folder.

## Acceptance checklist

- The inspector runs in text and JSON modes and accepts both a CLI folder and `PRINTER_PRODUCTION_SAMPLES_DIR`.
- PDF-compatible `.ai` is inspected; non-PDF `.ai` is skipped with a clear reason.
- Golden vinyl files report hidden `Calque 2`, optional-content visibility, and Mimaki registration separations where present.
- Mimaki registration separations are never labeled `CutContour`.
- Artwork-only, book-interior, already-imposed, likely-print-and-cut, and ambiguous outcomes are conservative and accompanied by reasons.
- Original client files remain byte-for-byte untouched by the inspector; no client file is committed.
- Vinyl sheet dimensions and page boxes remain within 0.1 mm of the source.
- Print-only output has artwork without a visible cutline; FineCut output carries separate vector cut geometry.
- Hardcover front/back sources and representative book pages render correctly.
- `npm run typecheck`, the focused cutter/hardcover tests, the full test suite, and `npm run build` pass.
- Before customer production, open one output in Illustrator/FineCut and perform one inexpensive scrap-material print/cut test.
