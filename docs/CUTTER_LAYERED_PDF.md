# Cutter PDF export

Select **Illustrator Print + Cut PDF** and click **Export Illustrator PDF**. The export saves the displayed vinyl-sheet layout as one PDF page and one Illustrator artboard. Switch layouts to export another sheet. Repeated sheets use the repeat count shown in the workspace; the PDF still contains one page.

Use **Export all sheet PDFs separately** to save one PDF per unique layout in a new folder. Identical sheets are folded into one file. The filename is the operator's print indicator: `sheet_01_x6.pdf` means print six copies; `sheet_02_x3.pdf` means print three. Every PDF remains one page / one artboard. A small operator note in the export panel and `PRINT_INSTRUCTIONS.txt` in the folder explain the counts and 100% / Actual size printing. Batch export closes each verified document before preparing the next to avoid accumulating open Illustrator documents.

The native file contains three top-level layers:

- Artwork: visible and printable, with the sticker clipping masks.
- CutContour: vector cutting paths, hidden and non-printing. Enable its eye in Illustrator to inspect or select them.
- FC RegisterMark Layer1: exactly four corner registration marks and one direction arrow, visible and printable.

Windows and an installed, activated Adobe Illustrator are required. The save uses Preserve Illustrator Editing Capabilities and Acrobat layers. Before reporting success it reopens the PDF and verifies one artboard, all three layers, cut-path count and location, exactly four corner marks, one arrow, and physical sheet dimensions. Artwork sources are embedded once using symbols to keep files small. Oversized exports are rejected before encoding. A destination already open in Illustrator is protected from overwriting.

Print-only and customer-preview exports also save only the displayed sheet. Print-only intentionally excludes cutting paths. The ordinary Acrobat layered PDFs in the Mimaki job folder are viewer layers; use Export Illustrator PDF or the separate selected-layout Illustrator/FineCut preparation action for native Illustrator layers. Each PDF in the job folder is a single-page sheet.

Native exports do not issue cutting commands. FineCut activation, mark detection and physical printer/cutter compatibility require the workshop test. Standalone device transport remains a scaffold.

## Verification

`npm run test:cutter` checks registration geometry, PDF optional-content layers, source/cut geometry, sheet grouping, selected-sheet page indexing, Illustrator job validation, four corners plus one arrow, repeat metadata and export size limits. Native PDF reopening was also tested in installed Illustrator 30.8.2 with the user's saved mixed-sticker project. Poppler page renders were inspected for positions and clipping.

[Adobe PDF options](https://helpx.adobe.com/illustrator/using/pdf-options.html) explains Preserve Illustrator Editing Capabilities and Acrobat layers.
