# Cutter PDF export

Select **Illustrator Print + Cut PDF** and click **Export Illustrator PDF**. The export saves the displayed vinyl-sheet layout as one PDF page and one Illustrator artboard. Switch layouts to export another sheet. Repeated sheets use the repeat count shown in the workspace; the PDF still contains one page.

Use **Export all sheet PDFs separately** to save one PDF per unique layout in a new folder. Identical sheets are folded into one file. The filename is the operator's print indicator: `sheet_01_x6.pdf` means print six copies; `sheet_02_x3.pdf` means print three. Every PDF remains one page / one artboard. A small operator note in the export panel and `PRINT_INSTRUCTIONS.txt` in the folder explain the counts and 100% / Actual size printing. Batch export closes each verified document before preparing the next to avoid accumulating open Illustrator documents.

The native file contains three top-level layers:

- Artwork: visible and printable, with the sticker clipping masks.
- CutContour: vector cutting paths, hidden and non-printing. Enable its eye in Illustrator to inspect or select them.
- FC RegisterMark Layer1: exactly four corner registration marks and one direction arrow, visible and printable.

Windows and an installed, activated Adobe Illustrator are required. Native exports target Illustrator CS6 (version 16) editing data. The exporter first prepares Acrobat layers and printing options, then saves a PDF-compatible CS6 Illustrator document and copies that real PDF container to the selected PDF filename. Resaving the legacy document with ordinary PDF save options would regenerate modern editing data, so the final copy is not resaved. Temporary staging files are removed after successful verification.

Before reporting success it reopens the PDF and verifies one artboard, all three layers, cut-path count and location, exactly four corner marks, one arrow, and physical sheet dimensions. It also checks the PDF's three optional-content layers, hidden CutContour and embedded CS6 editing-format header. The newer Illustrator application's producer version is allowed to remain in the metadata; that field is not the editing-format version. Artwork is embedded once per source in the SVG using plain reference groups to avoid symbol viewport shifts. Oversized exports are rejected before encoding. A destination already open in Illustrator is protected from overwriting.

Print-only and customer-preview exports also save only the displayed sheet. Print-only intentionally excludes cutting paths. The ordinary Acrobat layered PDFs in the Mimaki job folder are viewer layers; use Export Illustrator PDF or the separate selected-layout Illustrator/FineCut preparation action for native Illustrator layers. Each PDF in the job folder is a single-page sheet.

Native exports do not issue cutting commands. FineCut activation, mark detection and physical printer/cutter compatibility require the workshop test. Standalone device transport remains a scaffold.

## Verification

`npm run test:cutter` checks registration geometry, PDF optional-content layers, source/cut geometry, sheet grouping, selected-sheet page indexing, Illustrator job validation, four corners plus one arrow, repeat metadata and export size limits. Native PDF reopening was also tested in installed Illustrator 30.8.2 with the user's saved mixed-sticker project. Poppler page renders were inspected for positions and clipping.

The CS6 save sequence was tested with a retained 40-sticker sheet: the resulting PDF has the version-16 editing header, three layers, hidden/non-printing CutContour, one 925×115 mm page, 40 cutting paths, four corner marks and one direction arrow. PDF.js rendering at 1312×163 pixels matches the prior printable page exactly. Direct opening in actual Illustrator CS6 remains pending on the user's other PC. Existing exports with modern editing data need to be re-exported to gain this compatibility; changing their filenames alone does not convert that data.

[Adobe PDF options](https://helpx.adobe.com/illustrator/using/pdf-options.html) explains Preserve Illustrator Editing Capabilities and Acrobat layers.
[Adobe's scripting reference](https://community.adobe.com/havfw69955/attachments/havfw69955/illustrator/426671/1/Illustrator%20JavaScript%20Scripting%20Reference.pdf) documents the separate Illustrator and PDF save options.
