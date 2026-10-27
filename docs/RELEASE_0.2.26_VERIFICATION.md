# v0.2.26 publication verification

Published on 2026-10-27 at 06:23:04 UTC as the latest stable subscriber release:
[v0.2.26](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.26).

- Tag `v0.2.26` points to `aa410774f779ac8763672a5ec6e0822e14525e17`.
  [Windows workflow 40460163147](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/40460163147)
  passed release checks, native compilation, packaging, checksum upload and
  publication. Package and lockfile versions match 0.2.26.
- GitHub confirms a published, non-prerelease release selected by the latest
  release endpoint. Setup, Portable, Setup blockmap, `latest.yml` and
  `SHA256SUMS-0.2.26.txt` are present with nonzero sizes.
- Downloaded the 224,479,515-byte Setup installer, blockmap, updater metadata and
  checksum manifest. Installer FileVersion and ProductVersion both equal 0.2.26.
  Its SHA512 and size match the updater metadata. An anonymous download from the
  public latest-release update URL matches the verified `latest.yml` byte-for-byte.
  Installer SHA256 is
  `50768e276003c5c2cb3923308d5007b1603a22bddafa0e7af333d9b14b68654a`.
- Downloaded Setup/blockmap/metadata SHA256 values match the checksum manifest
  and GitHub asset digests. Portable is 224,266,706 bytes; its API SHA256 digest
  matches the manifest. Portable was not downloaded separately.
- Local `npm run release:check` passed formatting, typecheck, all regression
  suites, Storybook and the production build. Native Explorer/helper compilation
  passed. The Windows release workflow repeated these checks before publication.
- Hidden Fast Print checks passed in English, French and Arabic, including nine
  selected-image copies on one nine-up sheet, multi-sheet quantities, partial
  final sheets, mixed image/PDF batches, independent rotations, job-copy counts
  and the quantity limit. Prepared output matched the native preview. Existing
  image-selection, page-range and combined-file regressions also passed. Layouts
  were reviewed at 1366×768, 1600×900 and 1920×1080 in both themes, with Arabic
  RTL and low-end mode; smaller-window captures were also checked.
- ID proofs covered all eight supplied pictures in original and off-center
  approximately 45-degree placements, with 90 mm output widths and unchanged
  original hashes. Front/back centers matched in the multi-ID workflow. Epson
  preset/automatic-duplex submission was simulated; the real-photo round trips
  used virtual printers in English, French and Arabic. Existing output rectifies
  to the selected fixed 55/56/60 mm height, so source proportions can change.
- No interactive main-PC control or hardware print jobs were used. Physical Epson
  driver acceptance and front/back registration, live high-DPI, screen-reader and
  workshop released-build verification remain pending.

Evidence: `output/release-0.2.26-preflight/`,
`output/release-0.2.26-published/verification.json`, `installer-version.json`,
public updater verification, workflow logs, release metadata and downloaded
installer/update files. Detailed proofs remain in `output/id-auto-duplex/` and
`output/fast-print-image-copies/`.
