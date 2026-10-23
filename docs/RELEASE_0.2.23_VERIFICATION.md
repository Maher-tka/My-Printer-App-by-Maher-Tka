# v0.2.23 publication verification

Published on 2026-10-23 at 2026-10-23T14:17:21Z as the latest stable subscriber release:
[v0.2.23](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.23).

- Tag `v0.2.23` points to `5b3d40ab7f344d9dfe70f317802cf7535f443702`.
  [Windows workflow 39967350829](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/39967350829)
  passed release checks, native compilation, packaging, checksums and publication.
  Package and lockfile versions match 0.2.23.
- GitHub confirms a published, non-prerelease release and selects it at the
  latest-release endpoint. Setup, Portable, Setup blockmap, `latest.yml` and
  `SHA256SUMS-0.2.23.txt` are present with nonzero sizes.
- Downloaded the 224,400,206-byte Setup installer, blockmap, update metadata and
  checksum manifest. Installer FileVersion and ProductVersion both equal 0.2.23.
  Installer SHA512 matches both updater references; its size matches as well.
  Installer SHA256 is
  `d4086c8b2428d92a5f1a91cc766e8f51b2752415db3591be747b941232ace756`.
- Downloaded Setup/blockmap/metadata SHA256 values match the checksum manifest
  and GitHub asset digests. Portable is 224,187,432 bytes; its API SHA256 digest
  matches the manifest. Portable was not downloaded a second time.
- Local full release checks, native compilation, hidden preset-order checks and
  the preset editing UI checks passed from an isolated checkout with independent
  dependencies. Tests cover EN/FR/Arabic RTL, light/dark, low-end mode, existing ID
  and assignment retention, cancel/failure, independent printer ordering, fresh
  windows, unchanged driver/preference files and required layout sizes.
- Only preset editing/ordering changes were released. Unrelated sticker work
  remains in the primary checkout. Existing working files were preserved
  byte-for-byte except the intended package version update. No interactive
  main-PC control or hardware print jobs were used. Live vendor-dialog,
  high-DPI, keyboard traversal and workshop-device checks remain pending.

Evidence: `output/release-0.2.23-preflight/` and
`output/release-0.2.23-published/verification.json`, `installer-version.json`,
workflow logs, release API metadata and downloaded installer/update files.
