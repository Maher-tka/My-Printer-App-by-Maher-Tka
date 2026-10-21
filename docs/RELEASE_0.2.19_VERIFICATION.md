# v0.2.19 publication verification

Published on 2026-10-21 at 14:35:18 UTC as the latest stable release:
https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.19

- Release tag: `v0.2.19`, commit `c6980787f11e04ea40595b240bed25118e566a86`.
- Windows release workflow `39617208921` completed successfully, including release
  checks, native builds, packaging, checksum upload and stable publication.
- `package.json`, package-lock root version and package-lock package version all
  match `0.2.19`.
- Verified the public release is published, stable and selected by GitHub's
  latest-release endpoint.
- Setup installer: 224,337,655 bytes. Portable build: 224,124,877 bytes.
- Installer blockmap, `latest.yml` and `SHA256SUMS-0.2.19.txt` are present.
- Downloaded the public Setup installer, blockmap and update metadata. Installer
  SHA512 matches both update-manifest references and its advertised byte size.
  Downloaded files also match the published SHA256 checksums. Portable asset and
  its checksum entry are present.
- Full local release checks passed in an isolated checkout containing the AI
  Sticker changes. Separate uncommitted Fast Print changes were preserved and
  excluded from this release.

The published prerelease installer was checksum-verified and installed on the
workshop PC with exit code 0. Original artwork remained unchanged. Actual new
app-to-Illustrator import/export and copy-layout verification remain pending:
workshop desktop coordinate input and capture were unavailable. Automatic
approval review rejected a debugging-port fallback with the exact reason
`rejected: blocked by policy`; no further reason was provided, and it was not
retried. Independent Illustrator exports do not count as app-integration proof.

During prerelease testing, Avast logged sandboxing of the installer. No matching
new quarantine entry or named malware detection was found in the inspected logs.
The installer is unsigned. A main-PC Defender scan of the prerelease installer
completed without a detection. No antivirus settings, exclusions or quarantined
files were changed by the release process; the user was advised to re-enable
protection. These findings are not recorded as an Avast safety verdict.

Local artifacts: `output/release-verification/0.2.19/published/verification.json`,
downloaded installer/metadata/checksums, `antivirus-review.json`, and the sticker
proofs recorded in `UI_REGRESSION_CHECKLIST.md`. No hardware print jobs were sent.
