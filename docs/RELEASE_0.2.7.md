# v0.2.7 — Updates before work and cleaner card cutting

- Installed apps check for a stable update at every launch, before opening the
  workspace. Available updates download, install and restart automatically.
  An offline or failed update check opens the workspace; checks have a 15-second
  deadline and startup downloads have a 10-minute deadline. Updates found after
  startup retain the existing save-before-restart protection.
- Card Montage zero-spacing cutting lines appear on the front only in preview,
  PDF export and printing, leaving the back clean. Clear removes both loaded
  designs while keeping card size and montage settings.
- Card Montage imports EPS through installed Adobe Illustrator and stores the
  converted PDF in the project, preserving vector artwork and embedded fonts.
- Ctrl + scroll zooms the cutter artwork and cut-line canvas around the cursor.

Installed Setup builds receive this stable release through automatic updates.
The new update-before-work behavior applies after installing v0.2.7. Portable
builds are updated manually. Saved projects and settings are retained.

Release validation runs formatting, TypeScript, all automated suites, Storybook
and the production build. The Windows workflow publishes the installer, portable
app, automatic-update metadata, blockmap and checksums. Physical printer/cutter
checks remain pending in `docs/UI_REGRESSION_CHECKLIST.md`.
