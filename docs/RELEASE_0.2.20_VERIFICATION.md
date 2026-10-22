# v0.2.20 publication verification

Published on 2026-10-22 at 11:16:41 UTC as the latest stable subscriber release:
[v0.2.20](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.20).

- Tag `v0.2.20` points to `931ed02555ffab181013d2d41c096c4fb470462e`.
  [Windows workflow 39768582582](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/39768582582)
  succeeded through release checks, native compilation, packaging, checksums and
  stable publication. Package and lockfile versions match 0.2.20.
- GitHub reports a published, non-prerelease release, and its latest-release
  endpoint selects v0.2.20. Setup, Portable, Setup blockmap, `latest.yml` and
  `SHA256SUMS-0.2.20.txt` are present with nonzero sizes.
- Downloaded the 224,352,927-byte Setup installer, blockmap, updater metadata and
  checksum manifest. Installer FileVersion and ProductVersion are both 0.2.20.
  Computed installer SHA512 matches both updater references and its declared
  size. Installer SHA256 is
  `b755a316073337f7cfcbf11eb8fbba93900cfb59e2600553e16586d956818eca`.
- Downloaded Setup/blockmap/metadata SHA256 values match the checksum manifest
  and GitHub asset digests. Portable is 224,140,111 bytes; its API SHA256 digest
  matches the manifest. Portable was not downloaded a second time.
- The isolated release includes the completed Fast Print updates. Uncommitted
  sticker-review work and scripts were excluded and preserved in the primary
  checkout. That checkout was advanced without replacing user source files;
  its development output was restored. No main-PC desktop control or hardware
  print jobs were used. Physical Epson/press output and workshop installation of
  this release remain pending.

Local evidence: `output/release-0.2.20-published/verification.json`,
`installer-version.json`, downloaded packages/update files, the release logs and
proof artifacts listed in `UI_REGRESSION_CHECKLIST.md`.
