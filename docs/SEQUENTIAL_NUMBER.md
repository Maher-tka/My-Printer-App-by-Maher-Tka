# Sequential Number

Prepare sequentially numbered tickets, invoices, vouchers, or forms from one PDF page, PNG, or JPEG design.

## Workflow

1. Open **Sequential Number** from Production in the sidebar.
2. Upload the front design. For a multipage PDF, choose the page to repeat.
3. Choose single-sided, a blank reverse page, or a back design. A back design can use another page from the same uploaded PDF. Match the selected long-edge/short-edge setting in the printer dialog.
4. Choose A4, A3, or custom sheet dimensions. Confirm finished item width/height, margin, and gap. Image dimensions initially assume 300 DPI; PDF dimensions come from the selected visible page. Artwork fits proportionally inside the item.
5. Set start number, quantity, increment, minimum digits, and optional prefix/suffix.
6. Choose **Across each sheet** or **Cut & stack** using the illustrated choices.
7. Add number positions for the main ticket and detachable stubs. Every position repeats the same number. Select a position and click the design, or edit its X/Y coordinates, font size, color, and alignment.
8. Inspect the front/back sheet preview and export the PDF. Save an editable project to reuse the artwork and settings later.

## Cut & stack example

With four positions per sheet and ten items, there are three physical sheets:

| Front sheet | Top left | Top right | Bottom left | Bottom right |
| ----------- | -------- | --------- | ----------- | ------------ |
| 1           | 1        | 4         | 7           | 10           |
| 2           | 2        | 5         | 8           | blank        |
| 3           | 3        | 6         | 9           | blank        |

Keep physical sheets in ascending order with sheet 1 on top. Cut them together, then collect the top-left pile, top-right pile, bottom-left pile, and bottom-right pile. Ignore unprinted slots. The combined tickets run from 1 through 10.

Back pages never consume a number. With duplex output, PDF pages 1/2 are physical sheet 1 front/back, pages 3/4 are sheet 2 front/back, and pages 5/6 are sheet 3 front/back. Therefore ticket 2 is on PDF page 3. Back positions are paired for the chosen flip edge. A blank-back setting writes a genuinely blank reverse page.

## Printing and limits

Print at actual size (100%) using the matching duplex setting. Printer feed order and alignment vary; check one sheet before printing the full quantity. Keep the physical stack in the order described above.

PDF artwork stays vector where possible; imported JPEG orientation is normalized to match preview. Cutting marks stay in margins/gutters. Unsupported number characters and numbers outside the item produce an export error. Prefixes/suffixes support printable Latin characters. Up to 20 number positions, 100,000 items, and 5,000 PDF pages are supported, subject to the total number-impression limit. Split larger runs into separate jobs with the appropriate next starting number.

Editable projects use `.myprinter-sequential.json` and participate in recent projects, autosave, and backup. The tool uses the existing subscription rules and is available in Developer Test Mode.

## Verified

- Layout tests: sheet order, stack order, partially filled sheets, custom/A4/A3 dimensions, starting values, increments, padding, and portrait/landscape duplex placement.
- PDF tests: page counts, blank backs, repeated labels, cropped/rotated vector artwork, image reuse, cancellation, and invalid output rejection.
- Project tests: memory/disk round trips and invalid payload rejection.
- Browser: real two-page PDF import, back page selection, multiple positions, physical sheet navigation, successful PDF download, and compact-window overflow check.
- Browser-exported 23-item duplex sample: six pages; ticket 0001 appears on page 1 and ticket 0002 on page 3, both repeated on the stub.
- Production build and full regression suite pass. Physical printer testing remains user-dependent.


## Moving numbers and fixed text

Drag a number or fixed label in the design editor. Hold Shift to constrain movement to one axis. Arrow keys nudge by 0.1 mm; Shift+arrow nudges by 1 mm. X/Y fields provide exact coordinates. Snapping to a 1 mm grid is optional and off by default; zoom goes up to 300%. Escape cancels a drag. Ctrl+Z undoes placement changes and Ctrl+Shift+Z redoes them while the design editor is focused.

Use **Add fixed text** for an independent label repeated unchanged on each ticket. It has its own position, font size, color and alignment and is saved with the project. The current PDF font supports the fixed-text input's documented printable English characters. Text before/after the sequence can also be entered using the fixed prefix and suffix fields. On backs, these labels follow the existing back-numbering switch.

Enter **0000133** in Start number, or set Start to **133** and Digits to **7**, to produce 0000133, 0000134, etc. Padding is a minimum width; longer numbers are never truncated.


## Gutter cutting lines

Enable **Cutting lines on first page only (0.25 pt)** in sheet setup and choose **Cutting-line color**. Lines run down/across the centers of the gaps between occupied ticket rows/columns, on the first PDF page only, with the matching first-front-sheet preview. Later fronts and all backs have no gutter cutting lines. A gap of at least 0.1 mm is required to keep the entire stroke off the tickets. Corner crop marks remain a separate option. Blank back pages stay blank. A single ticket has no between-ticket lines.
