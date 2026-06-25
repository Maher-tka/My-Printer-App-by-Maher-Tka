# Release candidate checklist

Record the date, Windows version, tester, app version, and result for every item.

- [ ] `npm install`
- [ ] `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`
- [ ] Generate a lifetime Shop test license with `npm run license:generate`.
- [ ] Run `npm run dev`; confirm main, preload, renderer, dashboard, settings, license, and App Health load.
- [ ] Booklet: import, reorder, add blanks, preview, preflight, save, reopen, and export PDF/images.
- [ ] Cutter: import artwork, create CutContour, place/arrange pieces, preflight, save, reopen, and export SVG/PDF/EPS.
- [ ] Hardcover: configure A4 cover/spine/wrap, save, reopen, preflight, and export PDF/SVG/JPG.
- [ ] Confirm `.myprinter-booklet.json`, `.myprinter-cutter.json`, and `.myprinter-hardcover.json` files reopen. Confirm legacy `.mpjob` files remain accepted.
- [ ] Change an unsaved project, wait 60 seconds, force-close the development process, restart, and test Restore/Discard/Open Autosave Folder.
- [ ] Confirm critical preflight errors block export and warnings offer **Export Anyway**.
- [ ] Confirm Export Center records success, cancellation/failure, path, tool, timestamp, warnings, and preflight status.
- [ ] Create/search/filter jobs, calculate a quote, copy WhatsApp text, and verify remaining balance.
- [ ] Confirm an expired trial leaves Dashboard, Settings, License, App Health, Jobs, and Export Center accessible while tools show the lock overlay.
- [ ] Switch among Low-end PC, Balanced, and High Quality; repeat the largest test in Low-end PC.
- [ ] Export a diagnostic report and verify it contains no artwork bytes or source files.
- [ ] Run `npm run dist:dir`; launch `release/win-unpacked/My Printer App by Maher Tka.exe`.
- [ ] Run `npm run dist:win`; verify the Setup and Portable filenames and install/uninstall behavior.
- [ ] Install on a separate shop PC, activate locally, save a project, restart Windows, reopen the project, and export to a writable production folder.
