# v0.2.25 publication verification

Published on 2026-10-26 at 06:31:17 UTC as the latest stable subscriber release:
[v0.2.25](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.25).

- Tag `v0.2.25` points to `b8d0e77af4307ea60d44c5f0ec48fe4430e186e6`.
  [Windows workflow 40279880824](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/40279880824)
  passed release checks, native compilation, packaging, checksum upload and
  publication. Package and lockfile versions both equal 0.2.25.
- GitHub confirms a published, non-prerelease release selected by the latest
  release endpoint. Setup, Portable, Setup blockmap, `latest.yml` and
  `SHA256SUMS-0.2.25.txt` are present with nonzero sizes.
- Downloaded the 224,468,382-byte Setup installer, blockmap, updater metadata and
  checksum manifest. Installer FileVersion and ProductVersion both equal 0.2.25.
  Its SHA512 matches both updater references; the metadata size matches the
  downloaded installer. An anonymous download from the public latest-release
  update URL matches the verified `latest.yml` byte-for-byte.
  Installer SHA256 is
  `99b13cc978f55e57bda7eacd32a2df5e3c93c5b0c8a7a46dc212d8a6e5983772`.
- Downloaded Setup/blockmap/metadata SHA256 values match the checksum manifest
  and GitHub asset digests. Portable is 224,255,640 bytes; its API SHA256 digest
  matches the manifest. Portable was not downloaded separately.
- Local `npm run release:check` passed formatting, typecheck, all regression
  suites, Storybook and production builds. Native Explorer/helper compilation
  passed. The final documentation formatting check also passed.
- Hidden sticker review, PNG white contour and Card Montage printer-preset
  checks passed. Screenshots were inspected at 1366×768 and 1920×1080, including
  light/dark themes, French, Arabic RTL and low-end mode. Sticker/contour proofs
  also include 1600×900. Keyboard, validation, project round trips, separate PDF
  cut layers, white bleed and edited-queue handoff checks passed. Existing shared
  controls, command placement and tokens were reviewed against the design standard.
- All five currently available sticker corpus files / nine pages passed 184
  exact-pixel crop comparisons. Original file hashes were unchanged. Inspected
  the generated crop contact sheets. The AI file was tested through its compatible
  PDF preview; native Illustrator integration was not repeated.
- Native last-settings checks passed in English/French/Arabic, including 5,208
  private driver bytes and stale/corrupt record guards. The existing real-photo ID
  workflow passed in all three languages using its two original fixtures: two
  review round trips, saved presets, six 90 mm IDs per side on A3, five copies and
  grayscale proofs. Original hashes were unchanged. ID detection/crop algorithms
  and Polaroid framing were not changed by this release.
- No interactive main-PC control or hardware print/cut jobs were used. Physical
  cutter alignment, physical printer handling, native Illustrator integration,
  live high-DPI, screen-reader and workshop released-build checks remain pending.

Evidence: `output/release-0.2.25-preflight/` and
`output/release-0.2.25-published/verification.json`, `installer-version.json`,
public updater verification, workflow logs, release API metadata and downloaded
installer/update files. Earlier performance measurements and their limits remain
documented in [the performance audit](PERFORMANCE_AUDIT_2026-10-24.md).
