# Explorer Fast Print

Select PDFs, images, or Word documents in Explorer and choose **Show more options >
Fast Print**. Explorer launches the small native Windows **FastPrint.exe** directly.
The app dashboard, Electron, and a browser are not needed to open the dialog or
show ordinary PDF/image previews. A legacy Electron command delegates to the same native helper.

The compact Windows dialog has printer, A4/A3 paper, driver quality, color,
saved preset, orientation, file selection, preview navigation, copies and Fit to
frame controls. Choose 1, 2, 4, 6, 8, 9, 12 or 16 pages per sheet on A4 or A3,
or ID in the scrolling layout tiles. Two-, six- and eight-up start with landscape
sheets; Portrait/Landscape can be selected for every ordinary layout.
The native controls use the app's shared color, spacing and radius tokens, with
rounded buttons, layout thumbnails and light/dark appearance. **Options…** can
select light, dark or the Windows app appearance without changing OS settings.
There is one Print action, with native Enter/Escape behavior and arrow-key layout selection.
The language follows the Windows UI culture (English, French and Arabic labels).

Fast Print remembers the last selected printer, including a selection followed by
Cancel, and selects it on the next launch while it remains installed. A stale
printer hint from the Explorer command does not replace that choice. Printer
snapshots are used only for the device that owns them; Windows defaults are not
changed.

Full page defaults to **Original orientation** and **Fit to frame off**.
For Full page, each image or PDF page retains its visible portrait/landscape
orientation, including EXIF and PDF rotation metadata. Mixed-orientation PDFs
carry a physical size for each prepared page through print submission. Explicit
Portrait/Landscape and rotation commands remain available. Multi-up uses **Preset
direction** and **Same direction** by default: each source is aligned to its slot
before the independent manual rotation. Portrait/Landscape transposes the grid.
Turning Same direction off preserves individual source directions. ID cards remain
horizontal; Polaroid retains its dedicated composition rules.

Prepared A4/A3 pages are drawn once at their selected physical dimensions,
compensating for the hardware origin. They are not fitted a second time into
`PrintableArea`: the Epson WF-C879R driver can return portrait-shaped printable
bounds for landscape A3, which previously restricted the artwork to an A4-like
area on the side of the sheet. Existing layout margins remain in the artwork.
The driver handoff rejects a mismatched physical paper size.

The file selector shows each document's page count before its filename. The
**Pages in this file** controls select All pages, Odd pages, Even pages, or a
Page range such as `1-5, 8, 12`. Selections belong to each file and are kept when
switching files, printers, or layouts. Ranges use original one-based page numbers;
overlaps are printed once in document order. Arabic digits, Arabic commas and
en/em dashes are accepted. Invalid, reversed or out-of-bounds ranges disable Print
and identify the file to fix. An even-page selection on a one-page file skips it;
the job must retain at least one page. These controls apply to ordinary document
printing; ID and Polaroid keep their dedicated workflows.

Preview navigation, the selected-page total, n-up grouping, duplex sheet estimates
and production output all use the filtered source pages. Combining files packs
only selected pages. Skipped files do not add sheets or trailing blank backs.
Hidden verification: build the helper with
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-fast-print-native.ps1 -OutputName FastPrint-page-selection.exe`,
then run `npm run test:fast-print:page-selection`. It creates synthetic PDF/image
proofs and never submits a hardware job.

The summary above Print shows the number of selected files and **total source pages**,
plus output pages/sheets for the current layout and the sheet total across
copies. PDFs keep separate final sheets by default; consecutive images share n-up
sheets. Enable **Combine files on sheets** to put pages from several PDFs (and
selected photos or prepared Word documents) into the same ordered stream, filling
the remaining slots before starting another sheet. The original files stay separate.
Preview navigation and output/copy totals follow the combined stream. Duplex
estimates add document-boundary blank backs only when combining is off. ID mode shows source
totals here; its output is configured in ID verification.

Page counts use PDF metadata (or the prepared Word PDF), without rendering every
page. While loading, the summary says **Counting pages…**; a missing or unreadable
document reports unavailable totals. Changed files invalidate cached counts when
the preview refreshes. This is the selected job's estimate, not print-queue or
historical usage accounting. Hidden local checks: `npm run test:fast-print:counts`.

Color availability uses Windows' `DC_COLORDEVICE` capability query in the native
dialog, printer list and final print validation. The older .NET Framework
`SupportsColor` result can incorrectly hide Color and disable 8 PIC / 9 PIC for
a color driver. A genuine monochrome result stays monochrome; a query failure
falls back to the legacy capability. The selected job's current black-and-white
setting is not used to decide whether the device can print color. See Microsoft's
[color-capability guidance](https://learn.microsoft.com/en-us/windows-hardware/drivers/print/identifying-a-printer-s-color-capability).

For a read-only Windows PowerShell diagnostic (no UI or print jobs), run
`powershell -NoProfile -STA -File scripts/diagnose-fast-print-color.ps1`.

General 1/2/4/6/8/9/12/16-up presets use equal-size slots, 5 mm outside margins
and 3 mm cutting gaps. **Options… > Margins** offers 5/7/10/15/20 mm;
**Cutting gap** offers 3/5/8/10 mm. Incomplete final sheets and rows are centered
without enlarging the remaining items, so their slot size stays consistent.

Multi-up aligns each source to the slot direction before applying manual rotation. **Rotate selected** turns the
selected file by 90 degrees inside its slot; for PDF/Word, that applies to all
pages in the file. **Options… > Rotate all** sets 0/90/180/270 degrees for the
whole batch and keeps that rotation when changing presets. The status reports
the current slot dimensions and selected file's rotation. Native preview and
print preparation use matching margins, gaps, positions and rotations.

**Fit to frame** fills equal-size photo slots by cropping to their edges. It
starts on for photo-only multi-up selections to give equal filled frames, and off
for Full page or PDF/Word selections so the complete source remains visible. An
explicit choice is kept while changing layouts. Turning it on for documents crops
their pages too.

The **Saved preset** list shows all saved A4/A3 stocks for the selected printer,
including their paper and tray. Selecting one restores its paper size, color,
tray, duplex and complete vendor driver settings. Paper-size filtering no longer
hides an A3 stock while A4 is selected. **Save printer preset…** in this same list
opens a named preset dialog; **Printer properties…** there configures the actual
tray/magazine, paper weight, bypass size and output bin/finishing before saving.
For example, save `A4 - 80 gsm - Magazine 1`, `A3 - 80 gsm - Magazine 2`, and a
separate bypass preset for each paper size/stock. A name alone does not configure
the printer. Presets are private to the Windows account and driver version;
Windows printer defaults remain unchanged. **Manage saved presets…** retains
rename/delete and the existing operator notes/default-stock controls.

**8 PIC** and **9 PIC** sit directly below the printer selector. They require an
A4/color-capable printer and lock those settings automatically. Polaroid previews
show the complete composed sheets from every selected photo, with the exact
production rotation, face protection, framing, borders and cut lines. Eight or nine
photos fill one sheet; larger selections continue onto additional sheets, leaving
unused final slots white. Previous/Next moves between sheets, and choosing a file
shows the sheet containing it. ID retains a source preview and **Review ID…** to
open the dedicated front/back editor before its separate print confirmation.

Polaroid preparation reports the current photo count in the native loading
surface and status. Preview composition does not capture or validate vendor driver
settings. Print reuses the reviewed 300 DPI sheets instead of repeating face
analysis, checks that the source files are unchanged, and validates the selected
printer/driver settings before handoff. On a slower PC, wait for the preview and
enabled Print button; Cancel closes preparation without submitting a print job.

Real-photo validation can use another folder without changing the originals:

```powershell
$env:POLAROID_TEST_SOURCE = 'C:/Users/Maher/Downloads/Compressed/num937p'
$env:POLAROID_TEST_OUTPUT = 'output/polaroid-num937p-reliability'
npm run test:fast-print:polaroid-native
```

The default folder remains `num216p`. The verification helper stays hidden and
uses driver validation only. `FAST_PRINT_TEST_SINGLE_CORE=1` restricts only the
verification process and its children to one available CPU core; it does not
change Windows or app performance preferences.

In the ID editor, **Printer settings** returns to the native dialog and keeps
the front/back card corners, sheet rotations, size/layout presets, added artwork and selected side. Change
the printer, paper, preset or copies, then choose **Review ID…** to resume. Edits
are also saved before print preparation, so a rejected driver preset does not
erase the last review. Source images are stored once per session; repeat returns
write only small edit metadata. Closing Fast Print clears this temporary session,
while originals and saved projects stay unchanged. Changed original files are
reported rather than silently applying an old review to new artwork.

Both ID sides use the **same selected card size**: 90 × 55, 90 × 56 (default),
or 90 × 60 mm. The four selected corners define a perspective correction into
that rectangle, so differently angled photographs do not create different front
and back dimensions. Corner adjustment handles straightening; it replaces the
separate manual-angle control. Source files remain unchanged.

Both ID sides stay horizontal. Each ID preview has a **Rotate 180°** flip, which
keeps the shared physical size and matching duplex centers. Older quarter-turn
sheet settings are normalized to horizontal. The general Fast Print 90-degree
rotation controls do not apply to ID output. Other completed ID settings remain
available; the current preset improvements focus on general Fast Print.

ID setup respects camera rotation metadata and corrects sideways and upside-down
cards before editing. Complete outer edges, coherent color changes and recognized
header markers help distinguish the card from its portrait or text blocks. The
uniform-background path remains fast; opposite-direction edge checks protect
faint edges when camera rotation changes scan order.

Orientation first uses a recognized header. When that is inconclusive, the editor
lazily loads the bundled Arabic/English text reader and compares upright/inverted
letter evidence. This runs offline in a session worker; it does not store or log
recognized identity text. A bounded contrast retry helps faded text, without
changing the print artwork. Weak evidence leaves an orientation-review prompt
and the Rotate control available. Automatic analysis is cached per source;
returning from printer settings restores saved edits without reanalyzing them.

When no reliable card is found, the full photo remains available with a
corner-adjustment prompt. The crop stage adapts to the window height; corner
handles remain keyboard-adjustable.

The ID verification window includes a **Printer** selector. Switching keeps the
selected sources, crop corners, flips, card size, copy count, margins and spacing.
Color and automatic-duplex choices follow the selected printer's capabilities;
unsupported color falls back to black and white, and unsupported duplex to manual.
For a newly selected printer, paper stays the same when supported; otherwise
A4/A3 is selected and previewed.
Each printer retains its own session snapshot; a newly selected printer uses its
driver defaults. **Printer settings** still returns to the native options window
with the selected printer and saved ID edits for tray/finishing changes.

The ID review also includes **Saved driver preset**, using the same presets as
**Settings > Driver presets** and the native Fast Print **Saved preset** list.
Choose a preset for the selected printer to apply its paper, color, automatic
duplex and captured tray/vendor settings. For example, select an Epson WF preset
saved for black-and-white, two-sided IDs. Card crops, front/back assignments,
card size, spacing and sheet copy quantity stay with the current job.
Returning to **Printer settings** carries the selected driver snapshot back too.
Missing, incompatible or outdated presets cannot silently use another printer's
settings; update or recapture them in Settings. No saved presets shows a disabled
selection for that printer.

ID verification shares Fast Print's remembered printer, stored separately from
app preferences and Windows defaults. An unavailable remembered printer falls
back to the launch hint or app/Windows default.

**Sheet preset** offers common 1/2/4/6/8 counts, additional counts up to 24,
and **Fill sheet**. Fill sheet uses the maximum fitting count and updates after
paper, size, margin, gap or sheet-rotation changes. Fixed counts never shrink the
cards; an overfull selection reports the issue and disables Print.

New ID reviews default to **Compact**, **10 mm margins** and a **10 mm cutting
gap**. Restoring an existing review keeps its saved choices.

**Even spacing** distributes cards symmetrically across the usable page, with
at least the selected margins and cutting gap. **Compact** keeps the group close
together and centered. Margins start at 5 mm and can be increased to 7/10/15/20 mm;
cutting gaps offer 3/5/8/10 mm. An incomplete row stays symmetric. Front and back
use the same slots, mirrored for long-edge duplex alignment; rotating one side
reserves enough room on both pages to keep those centers matched. The native
**Copies** control separately sets the number of physical sheets.

Selecting 8 PIC or 9 PIC starts a hidden preparation worker; it never opens the
dashboard or calls the Windows print script. Composing a preview does not require
print access or a signed-in account. The actual Print action still checks access
before starting output and again before submission. Print stays disabled while preparing.
Prepared sheets are cached per mode/selection, with four bounded thumbnails for
quick navigation. Switching back reuses them; changing a source invalidates the
cache. While a new mode prepares, the existing sheet stays behind a loading overlay
instead of flashing blank. Confirming Print uses the same production compositor and real driver
settings. Closing the native dialog removes its temporary prepared sheets.

**Options… > Printer properties…** opens the real vendor driver dialog for tray,
stock, duplex, quality and finishing. Changes apply only to this print session.
**Saved preset > Manage saved presets…** opens preset management and refreshes the
printer list afterwards. Automatic selection uses the existing per-option and
bypass defaults; explicit preset selections take precedence. Copies initially
use the captured driver count and can be changed from 1 to 999. An explicit copy
count survives printer changes. Print remains unavailable until the current
printer's settings have loaded; late responses cannot replace newer selections.

Supported inputs are PDF, PNG, JPEG, GIF, BMP, single-frame TIFF and DOCX. PDFs use
Windows.Data.Pdf for native previews of temporary snapshots, so an open preview
does not lock the original PDF. BMP/TIFF are converted into temporary PNGs.
Multi-page TIFF is rejected with a PDF-conversion message to avoid losing pages.
DOCX is converted read-only to a temporary PDF through installed Microsoft Word
or LibreOffice. Macros/link updates are disabled in the dedicated Word instance;
LibreOffice uses an isolated profile. DOCX conversion has its own progress state
and can take longer than opening the native dialog. No converter means an explicit
error with Print disabled. A private extracted LibreOffice runtime may also be
placed in `%LOCALAPPDATA%\MaherTka\FastPrint\docx-converter`; it is separate from
saved projects/settings and is not bundled in the application installer.

Only confirming Print allows the licensed worker to submit a print job. An encrypted,
short-lived driver snapshot carries the complete native selections to the worker;
Windows printer defaults and persistent saved presets are never overwritten.
Prepared files/snapshots live in a GUID session under the Windows temporary folder
and are cleaned after output/cancellation. Consecutive photos fill the available
slots together; each PDF or converted Word document starts a new sheet group.
Normal layouts optionally crop to fill the frame; PDF cover rendering
uses a bounded cell canvas. Originals are never modified. Subscription checks,
existing output validation and the ID/Polaroid renderers remain in the worker.

The first source preview decodes concurrently with printer discovery. Printer
capabilities are cached per queue, and preview page images share a bounded six
million-pixel cache (about 24 MB). Rapid changes discard stale renders. This
improves reopening layouts without retaining print-resolution sheet images.
DOCX still needs conversion before its first page can be previewed.
Selecting the active layout again refreshes edited files. Changes detected when
Print is pressed refresh the preview and require another review/confirmation;
missing, empty or invalid inputs keep Print disabled. Snapshot/conversion names
retain the original filename, including literal ampersands.

Black-and-white output through Microsoft Print to PDF/XPS uses grayscale artwork
when those built-in drivers normalize their color setting back to color. Hardware
queues retain strict driver-color validation; this fallback does not weaken it.

Native verification (build the app and native helper first):

```powershell
npm run test:fast-print:native
```

This opens native test windows, records startup/preview timings and screenshots,
then exercises all eight layouts on A4/A3, photo grouping/document boundaries,
encrypted settings/copies and matching preview/output through the real worker in
ValidateOnly mode. DOCX runs when Word/LibreOffice is available; no hardware jobs
are submitted. The matrix uses a 19-page mixed-orientation document to exercise
pagination and trailing empty slots, plus thirteen ordered photo fixtures.

The Polaroid regression runs without visible windows or desktop input:

```powershell
npm run build
npm run test:fast-print:polaroid-native
```

It uses all fifteen `num216p` originals plus exact eight/nine-photo selections,
compares prepared preview sheets byte-for-byte with generated print artwork,
checks each source photo, face-safe crops, overflow and white final slots, and
validates A4/color/simplex driver settings without submitting hardware jobs.
Its preview workers run without `PRINTER_ACCOUNT_MODE=local-test`. An isolated,
signed-out production worker must still reject Print; only artwork/driver proof
generation uses the explicit offline test mode. Run the production build above
first so the development access override cannot hide an access-gate regression.

The paint regression needs the native helper, but no visible windows or printers:

```powershell
npm run test:fast-print:paint
```

It verifies complete buffered control frames, rounded corners in enabled/disabled
states, cleared repaint regions, bounded GDI resources, retained loading previews
and localized layout renders. Buttons, combo faces and their containers buffer
their rendering instead of drawing a native skin underneath the rounded surface.

The hidden audit regression also checks printer-response races, copy preservation,
editable PDF/BMP/PNG inputs, changed-source review, missing/empty input rejection,
file/sheet navigation, and color/grayscale proofs in English, French and Arabic:

```powershell
npm run test:fast-print:audit
```

It edits disposable fixtures only and runs driver validation without hardware jobs.

ID geometry and full editor/native-dialog round trips can be checked headlessly:

```powershell
npm run test:fast-print:id-real
npm run test:fast-print:id-workflow
```

The first reads all local ID TEST originals and makes color/grayscale proofs,
including independently marked off-center, rotated, patterned-background and
pale-paper placements. The workflow check needs the built main/native helper;
it uses hidden windows, two returns to settings, added artwork, keyboard crop
edits, a deliberately missing preset and an A3/five-copy grayscale ValidateOnly
job. English/dark, French/light and Arabic/low-end cases never submit hardware
jobs or take desktop input. Workshop photo validation is separate from these
local fixtures; its connection must be available before claiming it passed.

Generate four-copy real-photo proofs without hardware printing:

```powershell
node scripts/verify-fast-print-id.mjs --copies 4
```

## Printing preferences inside the app

Open **Settings > Printing settings** to manage printers and saved driver options.

1. Choose the app's **Default printer**, or keep the Windows default. This does
   not change the Windows default printer used by other applications.
2. Under **Driver presets**, choose the printer, enter a preset name, and select
   **Capture and save driver settings**. The manufacturer's actual driver dialog
   opens. Configure paper, tray, stock/weight, duplex, copies and finishing there,
   then confirm. Reopen a saved preset to recapture it or delete it with confirmation.
3. Under **Print options**, choose the printing option and assign a saved preset
   for the selected printer. Polaroid 8 PIC and 9 PIC, every A4/A3 color/mono
   1/2/4/6/8/9/12/16-up option, ID cards, and the five app production tools have separate
   assignments. App tools also have their own preferred-printer override.

Changes save immediately and persist across restarts. Each printer has its own
assignments; an Epson preset cannot be assigned to a Konica. Full driver-owned
DEVMODE buffers are retained and encrypted for the current Windows account.
Changing drivers requires recapturing affected presets. Deleted presets clear
their assignments, while stale external entries remain visible for correction.
Preference JSON is written atomically with a previous-file backup under
`%LOCALAPPDATA%\MaherTka\FastPrint\preferences.json`. Existing saved driver
profiles remain in the sibling `profiles` directory.

Explorer's selected printer takes precedence. The app's default printer appears
first in the printer selector. Per-option profiles take precedence
over the older paper/bypass default; explicitly selected saved stocks keep their
own profile. Polaroid still uses A4/color and its required layout orientation.
The saved profile supplies paper source, stock and finishing. ID setup starts
with the profile's duplex preference and permits an explicit change before printing.

App PDF printing uses the configured preferred printer and assigned tool preset,
falling back to **Other app printing** for a printer-wide app-print assignment.
With no assignment, the existing printer dialog remains available. An assigned
driver profile is applied per job without changing Windows driver defaults.
Prepared PDFs use actual physical page size, rendering up to 300 DPI with a
6000 px maximum long edge. This path rasterizes PDF pages; exported PDF files
remain unchanged. Page size must match the captured driver paper within 1 mm;
portrait/landscape pages on the same paper are supported. A mismatch fails
before submission instead of shrinking the artwork. Explicit copy counts override
the saved driver count; otherwise that driver's count is retained.

## Installation and removal

The NSIS installer installs for all users and registers Fast Print under HKLM using the
installed executable path. Installation errors return a failing exit code and are
reported by the setup hook. Uninstall removes this application's menu entries.

For a development checkout:

```powershell
npm run fast-print:install
npm run fast-print:settings
npm run fast-print:remove
```

For normal main-app development use `npm run dev`. Explorer integration uses a
built worker because it must run without the Vite development server.

Installed registration uses `HKLM\Software\Classes\*\shell\MaherTka.FastPrint` with an
AppliesTo file-extension filter and a fully quoted command. The app also validates
the selected file. Installation removes the previous app-owned shell-extension
registrations, CLSIDs, and approval/cache entries. Other applications' entries and
Windows security policies are unchanged.

## Supported input and output

- PDF, PNG, JPG, JPEG and GIF files. GIFs use their first frame. Export other documents to PDF first.
- Up to 512 MB per file and 2,000 PDF pages. Password-protected PDFs are unsupported.
- Jobs without a driver preset use one copy and simplex. Saved presets retain
  their preferred copy count and duplex settings, subject to layout constraints.
- Two-up starts in landscape; sheet orientation remains editable. Four-up reads left to right, top to bottom. Images count
  as one source page and are not duplicated to fill empty cells.
- Pages render at 200 DPI and fit inside the printer's printable margins.
- Closing the progress window during preparation cancels. Once submission starts,
  manage cancellation in the Windows print queue. Submission is not proof of
  physical completion. PDF printers may ask for an output filename.

## ID card preset

Choose **printer > paper or saved stock > Color / Black & white > ID card — 9 cm…**.
The crop window opens before anything prints. It accepts up to eight images or PDF
pages for choosing the front and back. The first two pages/images are assigned in
selection order; with only one image, choose a back explicitly. The same photo can
be selected for both sides when it contains both card faces.

Each side has an independent four-corner mask, rotation, automatic rough cropping,
and Reset crop. Auto crop searches the whole photo for an oriented card outline,
including off-center and approximately 45-degree cards. It is conservative on
uniform backgrounds and keeps the whole photo when it cannot find a confident
card region. Drag handles or use arrow keys on a focused corner (Shift moves
farther). The selected edges set automatic straightening; Card angle allows a
manual adjustment from -180° to 180°, and Auto straighten restores the detected
angle. These settings are independent for each side. Camera perspective and
partly missing corners remain approximate.

Output is two pages at 300 DPI, each card **90 mm wide with proportional height**,
measured after straightening and centered on the same physical sheet coordinates. Unlike normal document presets,
the ID output is printed at physical page size without fitting to printer margins.
Paper and saved tray/stock settings remain available. Select Color or Black & white
in the crop window; mono-only printers disable Color.

Automatic long-edge duplex is the default when the printer supports it. Manual
duplex prints the front first, pauses with a reinsertion prompt, then prints the
back on confirmation. Canceling that prompt leaves the back unprinted. PDF/XPS
printers save the two pages together. Submission controls prevent cancellation or
duplicate printing while the driver is running. Physical feed direction and duplex
registration still need verification with the workshop printer.

## Verification commands

```powershell
npm run typecheck
npm run test:fast-print
npm run test:fast-print:driver
npm run test:fast-print:id-real
node scripts/verify-fast-print.mjs
powershell -NoProfile -STA -File scripts/inspect-fast-print-menu.ps1 -FilePath "C:\path\sample.pdf"
```

The ID real-photo check always reads all supported pictures from
`C:\Users\Maher\Downloads\ID TEST` (or `ID_TEST_FOLDER` when explicitly testing a
different folder). It preserves the originals and checks their SHA-256 hashes,
then renders original and off-center ±45° cases in color and grayscale. Proofs and
measurements are saved under `output/fast-print-id/`; no printer is called. The
two initial files have approximate visible-edge annotations for crop-coverage
regressions. Newly added pictures still need visual crop review until annotated.

The shell probe verifies command discovery in a fresh process, not visibility in
an already-running Explorer. Do not use its historical `-VerifyInvoke` option for
the standard command. In development, FAST_PRINT_MENU_VERIFY can point to a JSON
output file when launching `--fast-print-menu -- "file.pdf"`; this checks the
actual device/profile choices without opening the menu or printing.

## Saved stock and driver presets

Color appears first for standard layouts on color-capable printers. The direct
**Polaroid** submenu starts with **8 PIC**, then **9 PIC**, without paper or
color submenus. These Polaroid layouts use the red photo areas measured from
`Polaroid 8p temp 2023.pdf` and `Polaroid 2R-1.pdf`: landscape A4, four columns
by two rows; portrait A4, three columns by three rows. Photos use automatic local
orientation and face-aware framing, preserving aspect ratio and the reference borders. Selected
images and PDF pages fill slots in selection/page order across file boundaries;
extra photos continue onto another sheet. Empty slots remain white. The red
template artwork is never printed. Internal cutting lines are 0.25 CSS px
(0.1875 pt), with no additional page margin or fit-to-page shrinking. Hardware
non-printable edges can still clip content. Polaroid jobs always use simplex.

The bundled YuNet detector checks four quarter-turn orientations on a 640x640
analysis canvas using one CPU/WASM thread. Upright orientation is detected first.
Group photos then receive an additional 90-degree clockwise print rotation when
it improves the filled photo area by more than ten percentage points while
preserving the protected faces. Groups can therefore print sideways to make
better use of the Polaroid frame, as requested by the user. A crop shifts to
keep all detected faces and padding for hair/foreheads inside the photo area.
The face boxes and their forehead padding rotate along with the photo.
When a group cannot fit without losing faces, the complete photo is fitted
inside the original placeholder, leaving white space as necessary. Images with
no usable detections, and jobs where analysis fails, use full-photo fitting in
the original orientation rather than an arbitrary crop. Face detection can miss
small, obscured or unusual faces; it cannot guarantee every subject is found.
No identity recognition or photo uploads are used. Model, WASM and loader assets
are bundled for offline operation; the model license is included in resources.

After changing Polaroid output, use all photos in
`C:\Users\Maher\Downloads\Compressed\num216p` to check both 8 PIC and 9 PIC,
including rotation, faces near edges, wide groups, overflow and blank slots.
Preserve originals and create local proof PDFs rather than unsolicited hardware
prints. The project's AGENTS.md records this fixture preference.

Batching is automatic: 25 photos produce four 8 PIC sheets or three 9 PIC
sheets. One sheet canvas is reused, source files/pages are processed sequentially,
and completed sheets are written to temporary disk files instead of accumulating
full-resolution sheets in renderer memory. Recognized JPEG/PNG headers allow
decoding a bitmap at the resolution needed for its photo slot, capped at a 2200 px
long edge; smaller originals are not enlarged during decoding. Browser decoders
can still allocate larger temporary buffers, especially for PNG files.

Earlier verification, before face analysis was added, used synthetic 6000x4000
JPEG/PNG files on the development PC:
25 photos took 6.6 seconds for 8 PIC (four sheets) and 5.6 seconds for 9 PIC
(three sheets); 100 photos took 13.3 seconds for 8 PIC (13 sheets). The worker
process tree peaked at approximately 706-730 MiB working set and 706-1162 MiB
private memory across these runs. These are sampled development measurements,
including renderer/GPU/helper processes and driver validation, not timings for a
physical printer or guarantees for the workshop PC. A separate in-app workspace
is useful for preview/reordering/crop controls, but is not needed for pagination
and does not inherently reduce decoder memory.

To make bypass/manual-feed and face-up output the default, capture those options
in the manufacturer's driver and check **Default bypass / face-up preset for this
paper** before saving. Capture one profile per paper size and printer. Ordinary
A4/A3 menu choices then automatically use that complete driver profile, including
its private output settings. If multiple profiles are marked, the most recently
saved one wins. Explicitly choosing another saved stock still uses that stock.
The checkbox records the operator's driver setup; it does not change or verify
private face-up options by itself. Without a marked profile, existing printer
settings remain in use. Windows printer defaults are unchanged.

Verify Polaroid rendering without submitting a print job:

```powershell
npx electron-vite build --mode development
node scripts/verify-fast-print-polaroid.mjs
```

Open **Fast Print > Saved preset > Manage saved presets…**, or run
`npm run fast-print:settings` in this development checkout. This opens a separate
setup window; the main app is not required.

1. Choose the installed printer queue and enter a recognizable stock name.
2. Click **Configure and capture driver settings...**. In the manufacturer's
   driver, choose the real paper size, input tray, paper type/weight, face-up/output
   options, duplex, and finishing settings. Acquire/refresh tray information here
   if the driver requires it. Use normal layout / one page per sheet in the driver.
3. Finish the driver dialog with OK, save the preset, then click Done.
4. Right-click a document and choose **Fast Print**. Select the printer, saved
   paper & tray preset, color mode, and layout, then click **Print**.

Fast Print captures the full Windows DEVMODE, including the private driver block,
using DocumentProperties. Saved settings are encrypted for the current Windows user
and stored under `%LOCALAPPDATA%\MaherTka\FastPrint\profiles`. Presets are bound to
one printer queue and driver fingerprint; another printer, a driver update, damaged
settings, or a deleted profile produces an error instead of silently using defaults.
Recapture a preset after changing drivers. Live acquisition of the printer's tray
contents is vendor-specific and is not automatically invoked on every print job.

Saved presets retain duplex and vendor options; per-job color, paper orientation,
explicit copy requests and physical page placement are merged through the owning driver. Two-, six-
and eight-up start in landscape, with manual Portrait/Landscape available. Full page defaults to source orientation; other grids
use the selected sheet orientation. Generic presets keep
the original simplex behavior. Fast Print cannot verify that the physical stock in
a tray matches a preset name.

### Konica C4065 at work

Create these four profiles using the actual Konica driver on the work computer:

| Preset name                     | Source and stock to configure in the driver                    |
| ------------------------------- | -------------------------------------------------------------- |
| A4 - 80 gsm - Tray 1            | Magazine / tray 1, A4, 80 gsm                                  |
| A3 - 80 gsm - Tray 2            | Magazine / tray 2, A3, 80 gsm                                  |
| A4 - 350 gsm - Bypass - Face up | Actual bypass source, A4, correct heavy-stock setting, face up |
| A3 - 350 gsm - Bypass - Face up | Actual bypass source, A3, correct heavy-stock setting, face up |

These are the user's requested setup names, not preconfigured device codes. Tray,
weight and face-up values must be captured from the installed driver and verified
with a physical test sheet. A named preset alone does not configure those options.

### EPSON WorkForce Pro WF-C878RDWF

Select the Epson queue separately and capture its own settings. In its driver, use
Document Size, Paper Source, Paper Type and 2-Sided Printing as appropriate. Create
A4 and A3 profiles for the actual Epson sources and stock; its tray assignments have
not yet been specified. Epson's published feed specifications reach 300 gsm on
supported feeds, with lower cassette and duplex limits. The Konica's 350 gsm setup
must not be treated as an Epson-compatible stock profile.
See [Epson's model specifications](https://www.epson.eu/en_EU/products/printers/inkjet/business-inkjet/workforce-pro-wf-c878rdwf/p/28788)
and [the Epson driver guide](https://download4.epson.biz/sec_pubs/wf-c878r_series/useg/en/manual.pdf).

Neither work printer is installed on the current development computer. Local tests
cover complete driver-buffer capture/restore, encryption, mismatched drivers and
printers, unchanged defaults, all saved-preset menu commands, and the print worker
using Microsoft Print to PDF. Konica/Epson-specific finishing still requires tests
on the work computer.

```powershell
npm run test:fast-print:driver
powershell -NoProfile -STA -File scripts/verify-fast-print-profile.ps1
```

The latter briefly registers a uniquely identified test preset, verifies six saved-stock menu
choices and a saved-profile render, then removes the test preset and refreshes the
menu. It never submits a physical print job.

## Verified Windows registration repair

On this computer, a plain HKCU command was absent from the real Explorer menu even
though a fresh shell probe enumerated it. The equivalent HKLM command appeared
immediately. The installed NSIS build now uses per-machine installation and the
`--install-fast-print-machine` / `--remove-fast-print-machine` commands, so setup
and removal run with administrator rights and register/remove the correct hive.
The worker still uses each interactive user's printers and encrypted presets.
The earlier MachineTest registration and per-user registrations are migrated out
so there is one Fast Print entry. No Windows security policy is modified.

The popup owner uses the active monitor's work area, and Menu.popup uses the
pointer's default location. Passing absolute cursor coordinates to a popup already
anchored at that cursor placed it near the screen edge; that positioning bug is fixed.
Final installed verification: the all-users installer completed successfully,
registration points to `C:\Program Files\My Printer App by Maher Tka\My Printer App by Maher Tka.exe`,
the temporary machine entry and previous HKCU entry are absent, and Fast Print was
observed in the actual Explorer classic menu. Printer, paper and color submenus
were opened through the installed app. The current renderer verification passed
1-up A4 color, 2-up A4 color, and 4-up A3 grayscale. The installed Windows print
script produced `tmp/fast-print-proof/Fast Print fixed A4 2-up proof.pdf`, verified
as three real A4 landscape sheets from the five-page fixture.

## Batch printing from Explorer

Select multiple PDFs, PNGs or JPEGs in Explorer, then right-click any selected
item and choose **Show more options > Fast Print**. Choose the printer and preset
once. The popup shows the document count. All documents are prepared sequentially
and submitted together as one printer job; a PDF printer asks for one output file.

The order provided by Explorer is preserved, and duplicate paths are removed.
In the native dialog, consecutive photos share n-up sheets while PDFs and Word
documents retain their document boundaries. Legacy direct commands keep the older
per-file boundaries unless `combineImages` is enabled. When a captured preset is double-sided,
a blank back is added between documents where necessary to preserve that boundary.
A failed or unsupported document stops preparation before any part of the batch is
submitted. Closing the progress window during preparation cancels the whole batch.
Windows .bat/.cmd scripts are unsupported input and are never executed.

The installed entry uses `MultiSelectModel=Player` and an IDropTarget selection
bridge registered in HKLM. This delivers one complete selection through a UTF-8
manifest instead of invoking a command per file or relying on shell placeholders.
Selection manifests created by the bridge are removed after reading. The DLL is
registered using a content-hash filename so updates need not overwrite a library
currently loaded by Explorer. Uninstall removes the app-owned DropTarget CLSID.

Limits: 1,000 selected files, 2,000 input pages per job, 512 MB per source file, and
2 GB of prepared sheet images. Documents are read one at a time to bound memory.

```powershell
powershell -NoProfile -STA -File scripts/test-fast-print-selection.ps1
node scripts/verify-fast-print-batch.mjs
```

The native test verifies a 122-file selection, exact order, Unicode, ampersands,
and the selection limit. The renderer/driver test checks a mixed PDF/image batch,
fresh sheet boundaries, one job, and rejection of unsupported inputs before printing.

## Preview performance

Native photo decoding and printer-document preparation run off the UI thread.
Unchanged printer snapshots are reused until the device, saved profile or current
options change; print preparation still captures and validates the full driver
configuration. Repeated refreshes reuse the displayed sheet only when source
versions, layout, paper, orientation, rotations, fit, color, spacing and preview
size match. Page-total refreshes are coalesced while controls are changing.

This does not lower preview dimensions, final raster DPI, artwork quality or
printer quality. The ordinary print renderer and Windows raster-placement code
are unchanged. Polaroid retains its separate 300 DPI reviewed-sheet cache.

A local one-CPU-core comparison with six 24-megapixel JPEGs (including EXIF
rotation) measured startup at 3.179 s before / 1.491 s after, and the longest UI
pause at 1.673 s / 0.098 s. All 19 A4/A3, rotation, fit and grayscale previews were
pixel-identical. Eight unchanged refreshes across 16 layouts performed 128 fewer
sheet compositions. These are local stress measurements, not workshop timings.

Evidence: `output/fast-print-performance/results.json` and the before/after PNGs.
`node scripts/verify-fast-print-performance.mjs` compares the preserved
instrumented `FastPrint-Performance-Before.exe` and candidate
`FastPrint-Performance-After.exe` in `out/native/`. The baseline was compiled from
the pre-optimization implementation with the same measurement harness.
