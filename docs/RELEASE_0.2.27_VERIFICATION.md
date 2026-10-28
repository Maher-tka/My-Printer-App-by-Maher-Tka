# v0.2.27 publication verification

Published on 2026-10-28 at 08:43:49 UTC as the latest stable subscriber release:
[v0.2.27](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.27).

- Tag `v0.2.27` points to `6651963031aca99cb182a0c308e44238888603aa`.
  [Windows workflow 40658133856](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/40658133856)
  passed release checks, native compilation, packaging, checksum upload and
  publication. Package and lockfile versions match 0.2.27.
- GitHub confirms the release is published, stable and selected as latest. Setup,
  Portable, the Setup blockmap, `latest.yml` and `SHA256SUMS-0.2.27.txt` are present.
- Downloaded the 224,492,033-byte Setup installer, blockmap, updater metadata and
  checksum manifest. Setup FileVersion and ProductVersion both equal 0.2.27.
  Installer SHA512 and size match the updater metadata, and the public latest-update
  URL returns the same metadata. Installer SHA256 is
  `2ca82a265eb8e9b267e08991a07fe680bad276bdf8f8c40672dbb230430007ee`.
  Downloaded file hashes match the manifest and GitHub asset digests; the Portable
  asset digest matches the manifest. Portable was not downloaded separately.
- Local `npm run release:check` passed formatting, typecheck, regression tests,
  Storybook and the production build. Native compilation succeeded. The release
  workflow repeated the release checks before publication.
- Hidden native checks verified the adaptive window in English, French and Arabic
  and the 5- and 7-per-sheet layouts, ordering, rotation and pagination. Earlier
  Fast Print UI, copy-reset, ID and Polaroid proof checks are recorded in
  `docs/UI_REGRESSION_CHECKLIST.md` and `docs/FAST_PRINT.md`.
- No hardware print jobs were sent. Live high-DPI, mixed-DPI multi-monitor,
  screen-reader and workshop released-build checks remain pending. ID output uses
  the selected fixed height of 55, 56 or 60 mm, so source proportions can change.

Evidence: `output/release-0.2.27-check.log` and
`output/release-0.2.27-published/verification.json`, the public updater metadata,
workflow logs, release assets and the Fast Print proof directories.
