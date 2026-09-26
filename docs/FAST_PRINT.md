# Explorer Fast Print

Right-click one PDF, PNG, or JPEG in Windows Explorer. On Windows 11, choose
**Show more options > Fast Print**. Click Fast Print once; a native menu opens at
the pointer. Hover through **printer > A4/A3 or saved stock > color > 1/2/4 pages
per sheet**, then click the final Print item. The main app does not open.

This is deliberately a standard Explorer file command rather than an in-process
shell DLL. The earlier DLL implementation passed standalone shell tests but did
not appear in the user's Explorer, so it is no longer registered. The extra click
opens the full cascading menu in the app's own process, avoiding both DLL-loading
failures and Windows' static submenu command limit.

The menu queries installed printers each time it opens. Saved stocks are separate
for each printer. Manage printer presets opens the standalone setup window; after
closing it, the menu reloads. Cancel or click outside to dismiss without printing.

## Installation and removal

The NSIS installer registers Fast Print for the current Windows account using the
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

Registration uses `HKCU\Software\Classes\*\shell\MaherTka.FastPrint` with an
AppliesTo file-extension filter and a fully quoted command. The app also validates
the selected file. Installation removes the previous app-owned shell-extension
registrations, CLSIDs, and approval/cache entries. Other applications' entries and
Windows security policies are unchanged.

## Supported input and output

- One PDF, PNG, JPG or JPEG file at a time. Export other documents to PDF first.
- Up to 512 MB per file and 2,000 PDF pages. Password-protected PDFs are unsupported.
- One copy per job. Generic presets use simplex; saved driver presets retain duplex.
- Two-up uses landscape; four-up reads left to right, top to bottom. Images count
  as one source page and are not duplicated to fill empty cells.
- Pages render at 200 DPI and fit inside the printer's printable margins.
- Closing the progress window during preparation cancels. Once submission starts,
  manage cancellation in the Windows print queue. Submission is not proof of
  physical completion. PDF printers may ask for an output filename.

## Verification

```powershell
npm run typecheck
npm run test:fast-print
npm run test:fast-print:driver
node scripts/verify-fast-print.mjs
powershell -NoProfile -STA -File scripts/inspect-fast-print-menu.ps1 -FilePath "C:\path\sample.pdf"
```

The shell probe verifies command discovery in a fresh process, not visibility in
an already-running Explorer. Do not use its historical `-VerifyInvoke` option for
the standard command. In development, FAST_PRINT_MENU_VERIFY can point to a JSON
output file when launching `--fast-print-menu -- "file.pdf"`; this checks the
actual device/profile choices without opening the menu or printing.

## Saved stock and driver presets

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
one copy, and fitted page placement are merged through the owning driver. Two-up
uses landscape; one-up/four-up keep the captured orientation. Generic presets keep
the original simplex behavior. Fast Print cannot verify that the physical stock in
a tray matches a preset name.

### Konica C4065 at work

Create these four profiles using the actual Konica driver on the work computer:

| Preset name | Source and stock to configure in the driver |
| --- | --- |
| A4 - 80 gsm - Tray 1 | Magazine / tray 1, A4, 80 gsm |
| A3 - 80 gsm - Tray 2 | Magazine / tray 2, A3, 80 gsm |
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

The latter briefly registers a uniquely identified test preset, verifies six menu
choices and a saved-profile render, then removes the test preset and refreshes the
menu. It never submits a physical print job.
