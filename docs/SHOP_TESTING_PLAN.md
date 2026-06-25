# Shop testing plan

Use disposable copies of customer-like files. Never make the first release-candidate test the only copy of real artwork.

## Booklet

1. **Small booklet:** import an 8-page PDF, test LTR and RTL, verify page pairs, save/reopen, and export PDF.
2. **Big mémoire:** import a 100+ page PDF, add required blanks, use Low-end PC mode, inspect progress, cancel once, retry, and compare page count and paper dimensions.

## Cutter

3. **Sticker with white background:** import PNG/JPG, verify artwork bounds and physical size.
4. **Circle mask + CutContour:** create an ellipse mask and vector cutline, export print+cut SVG/PDF, and inspect the `CutContour` group in the production application.
5. **Mixed cutter sizes:** place multiple dimensions, auto-arrange, deliberately create overlap/out-of-bounds errors, confirm export blocks, fix, and re-run preflight.
6. **100 stickers:** use Quality Lab and a real repeated-piece project; watch drag responsiveness and memory in Low-end PC mode.

## Hardcover

7. **A4 mémoire cover:** enter 210 × 297 mm, measured spine, wrap/hinge/bleed, title, student, and university. Confirm full dimensions and safe zones before PDF/SVG export.
8. **Batch three students:** import or enter three complete rows, export separate files and a combined PDF, and verify names/titles/file organization.

## Job, quote, files, and recovery

9. Create a customer job with deadline, status, notes, material/print/cutting/binding/design costs, discount, deposit, and remaining balance. Copy the WhatsApp quote and compare every number.
10. Save each tool project to a customer/job folder, export into its export folder, and verify Recent Jobs and Recent Exports reopen the correct local paths.
11. Make an unsaved change, wait for autosave, simulate a crash, restore, save as a normal project, and verify only the five newest autosaves remain.
12. Remove or rename one external source file and verify the workflow warns before production export where source references are used.

## Acceptance

Do not use the release candidate for irreplaceable production work until all critical errors are resolved, output dimensions are measured against a known-good print, CutContour output is verified in the real cutter workflow, recovery has been tested after a forced close, and the installer has passed on the target shop PC.
