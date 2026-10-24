# v0.2.24 publication verification

Published on 2026-10-24 at 2026-10-24T08:17:57Z as the latest stable subscriber release:
[v0.2.24](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.24).

- Tag `v0.2.24` points to `85cfdaaef156971456bd892e57495e44739a0992`.
  [Windows workflow 40077088682](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/40077088682)
  passed release checks, native compilation, packaging, checksum upload and
  publication. Package and lockfile versions match 0.2.24.
- GitHub confirms a published, non-prerelease release selected by its latest
  release endpoint. Setup, Portable, Setup blockmap, `latest.yml` and
  `SHA256SUMS-0.2.24.txt` are present with nonzero sizes.
- Downloaded the 224,432,159-byte Setup installer, blockmap, updater metadata and
  checksum manifest. Installer FileVersion and ProductVersion both equal 0.2.24.
  Installer SHA512 matches both updater references and the recorded size matches.
  An anonymous download from the public latest-release update URL matches the
  verified `latest.yml` byte-for-byte.
  Installer SHA256 is
  `7a87bcb3abd3d4e4145a76f86ccdafe4786c429949b7b0523017100c66b53725`.
- Downloaded Setup/blockmap/metadata SHA256 values match the checksum manifest
  and GitHub asset digests. Portable is 224,219,396 bytes; its API SHA256 digest
  matches the manifest. Portable was not downloaded a second time.
- Local full release checks, native Explorer/helper compilation, hidden UI and
  preset-picker checks, and native/production page-rotation proofs passed in an
  isolated checkout with independent dependencies. Proofs cover six mixed-file
  A4/A3, portrait/landscape, combined/separate and original-orientation cases in
  EN/FR/Arabic RTL. UI checks cover 1366×768, 1600×900, 1920×1080 and 820×640 in
  both themes on one CPU core. An unrelated Hardcover corpus test reported its
  fixture missing in the isolated checkout; this was not counted as a real-file
  validation pass.
- Only Fast Print changes were released. Unrelated sticker work remains in the
  main checkout. Pre/post hashes confirm its working files were preserved;
  package versions were intentionally updated. No interactive main-PC control
  or hardware print jobs were used. Live high-DPI, screen-reader and continuous
  input latency checks remain pending.

Workshop verification completed on the published build:

- The downloaded Setup SHA256 matched the published manifest. Silent installation
  exited 0. Installed app FileVersion is 0.2.24 / ProductVersion 0.2.24.0.
- The updated FastPrint helper is 400,384 bytes with SHA256
  `8f174cc9130f6e53259839131c11e7a0483c405a05c6d11c003ac6a7af9b77e5`.
- A synthetic-image UI check showed all six saved presets while Microsoft Print
  to PDF was selected. Choosing A3 Noir selected EPSON WF-C879R Series, A3 and
  black and white, without printing.
- All six profile files, preferences.json and last-printer.json match their
  pre-update hashes. The selection check temporarily changed last-printer; its
  exact backup was restored after closing the test session. The order file remains
  absent, as before the update. The main app was restarted. No original artwork,
  source development or hardware jobs were involved.

Evidence: `output/release-0.2.24-preflight/` and
`output/release-0.2.24-published/verification.json`, `installer-version.json`,
workflow logs, release API metadata, downloaded installer/update files and
workshop inspection reports.
