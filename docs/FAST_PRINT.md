# Explorer Fast Print

Select one or more PDF, PNG, JPEG, or GIF files in Windows Explorer and right-click. On Windows 11, choose
**Show more options > Fast Print**. Click Fast Print once; a native menu opens at
the pointer. Hover through **printer > A4/A3 or saved stock > color > 1/2/4 pages
per sheet**, then click the final Print item. The main app does not open.

For Polaroid output, choose **printer > Polaroid > 8 PIC or 9 PIC** directly.
These choices use A4 and color automatically, with the saved default A4
bypass/face-up stock when configured. They appear once, directly under printers
that support both A4 and color.

This is deliberately a standard Explorer file command rather than an in-process
shell DLL. The earlier DLL implementation passed standalone shell tests but did
not appear in the user's Explorer, so it is no longer registered. The extra click
opens the full cascading menu in the app's own process, avoiding both DLL-loading
failures and Windows' static submenu command limit.

The menu queries installed printers each time it opens. Saved stocks are separate
for each printer. Manage printer presets opens the standalone setup window; after
closing it, the menu reloads. Cancel or click outside to dismiss without printing.

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
   1/2/4-up option, ID cards, and the five app production tools have separate
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
first in the live menu, labeled preferred. Per-option profiles take precedence
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
- Two-up uses landscape; four-up reads left to right, top to bottom. Images count
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

Open **Fast Print > Manage printer presets...** from the Explorer menu, or run
`npm run fast-print:settings` in this development checkout. This opens a separate
setup window; the main app is not required.

1. Choose the installed printer queue and enter a recognizable stock name.
2. Click **Configure and capture driver settings...**. In the manufacturer's
   driver, choose the real paper size, input tray, paper type/weight, face-up/output
   options, duplex, and finishing settings. Acquire/refresh tray information here
   if the driver requires it. Use normal layout / one page per sheet in the driver.
3. Finish the driver dialog with OK, save the preset, then click Done.
4. Right-click a document and choose **Fast Print > printer > Saved paper & tray
   presets > stock name > color mode > pages per sheet**.

Fast Print captures the full Windows DEVMODE, including the private driver block,
using DocumentProperties. Saved settings are encrypted for the current Windows user
and stored under `%LOCALAPPDATA%\MaherTka\FastPrint\profiles`. Presets are bound to
one printer queue and driver fingerprint; another printer, a driver update, damaged
settings, or a deleted profile produces an error instead of silently using defaults.
Recapture a preset after changing drivers. Live acquisition of the printer's tray
contents is vendor-specific and is not automatically invoked on every print job.

Saved presets retain duplex and vendor options; per-job color, paper orientation,
explicit copy requests, and fitted page placement are merged through the owning driver. Two-up
uses landscape; one-up/four-up keep the captured orientation. Generic presets keep
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
Every document starts on a new sheet. When a captured preset is double-sided,
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
