# v0.2.21 publication verification

Published on 2026-10-22 at 2026-10-22T18:48:15Z as the latest stable subscriber release:
[v0.2.21](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.21).

- Tag `v0.2.21` points to `d79bf8a492b8805ba5abb57f39fdebe30da79f86`.
  [Windows workflow 39833632320](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/39833632320)
  passed release checks, native compilation, packaging, checksums and stable publication.
  Package and lockfile versions match 0.2.21.
- GitHub confirms a published, non-prerelease release and selects v0.2.21 at its
  latest-release endpoint. Setup, Portable, Setup blockmap, `latest.yml` and
  `SHA256SUMS-0.2.21.txt` are present with nonzero sizes.
- Downloaded the 224,367,933-byte Setup installer, blockmap, updater
  metadata and checksum manifest. Installer FileVersion and ProductVersion are
  both 0.2.21. Computed installer SHA512 matches both updater references and size.
  Installer SHA256 is `a8f8b0d03eae414b2977ed8d42cce3e9ec495cf111ea9c2e8755af3799919f55`.
- Downloaded Setup/blockmap/metadata SHA256 values match the checksum manifest
  and GitHub asset digests. Portable is 224,155,126 bytes; its API SHA256 digest
  matches the manifest. Portable was not downloaded a second time.
- Local full release checks, native Explorer/helper compilation, driver snapshot
  tests and production source-orientation checks passed. The latter covers all
  seven EXIF/PDF source pages, A4/A3, explicit rotation, remembered printer and
  copy totals in English, French and Arabic. Earlier direction, combined-PDF,
  stock-preset and mixed-image/PDF proofs are recorded in the UI checklist.
- Only the completed Fast Print changes were released. Unrelated sticker work
  remains in the primary checkout. No interactive main-PC control or hardware
  print jobs were used. Actual workshop tray/stock/output-bin operation, live DPI,
  keyboard traversal and vendor-dialog appearance remain pending.

Evidence: `output/release-0.2.21-preflight/` and
`output/release-0.2.21-published/verification.json`, `installer-version.json`,
workflow logs, release API metadata and downloaded installer/update files.
