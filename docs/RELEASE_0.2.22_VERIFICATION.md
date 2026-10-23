# v0.2.22 publication verification

Published on 2026-10-23 at 2026-10-23T12:55:47Z as the latest stable subscriber release:
[v0.2.22](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.22).

- Tag `v0.2.22` points to `a453e8ef9a514c8163c58869c994eb843969ffd8`.
  [Windows workflow 39956063702](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/39956063702)
  passed release checks, native compilation, packaging, checksums and publication.
  Package and lockfile versions match 0.2.22.
- GitHub confirms the release is published and not a prerelease, and selects it
  at the latest-release endpoint. Setup, Portable, Setup blockmap, `latest.yml`
  and `SHA256SUMS-0.2.22.txt` are present with nonzero sizes.
- Downloaded the 224,387,217-byte Setup installer, blockmap, update metadata and
  checksum manifest. Installer FileVersion and ProductVersion both equal 0.2.22.
  Installer SHA512 matches both update metadata references; its size matches too.
  Installer SHA256 is
  `9a2dd9f1a7501ec5cf3cdf7883c07d4d58af443c6cb26c2cbe847dae8705e986`.
- Downloaded Setup/blockmap/metadata SHA256 values match the checksum manifest
  and GitHub asset digests. Portable is 224,174,468 bytes; its API SHA256 digest
  matches the manifest. Portable was not downloaded a second time.
- Local full release checks and native Explorer/helper compilation passed in an
  isolated checkout containing only the Fast Print changes. Earlier production
  proofs cover selected-page order, combined/separate sheets, A4/A3, copy counts,
  duplex boundaries, preset selection/return, EN/FR/Arabic RTL and low-end mode.
  All eight ID photos passed original and off-center +/-45-degree crop and print
  proofs with unchanged originals, 90 mm widths and matching front/back centers.
- Unrelated sticker work remains in the primary checkout and was excluded from
  the release. Pre-existing working files were retained byte-for-byte except the
  intended package version update; local package and lockfile versions now match
  the release. No interactive main-PC control or hardware print jobs were used.
  Actual Epson WF driver, workshop tray/stock, live DPI and keyboard checks remain
  pending.

Evidence: `output/release-0.2.22-preflight/` and
`output/release-0.2.22-published/verification.json`, `installer-version.json`,
workflow logs, release API metadata and downloaded installer/update files.
