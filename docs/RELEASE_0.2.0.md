# v0.2.0 — Printer workshop test

This prerelease is for testing real workshop workflows and collecting feedback.

## Included

- Refreshed dashboard and tool layouts, with persistent light/dark appearance.
- Fast Print Explorer integration, batch selection, and print settings improvements.
- Booklet Montage, Cutter Montage, Hardcover Cover, and Sequential Number tools.
- Sticker editing improvements, job tracking, quotes, export history, autosaves, and shop backups.
- Supabase sign-in, access requests, and owner approval controls.

## Download and start

Choose **My Printer App by Maher Tka Setup 0.2.0.exe** for the workshop PC. It installs the app and Fast Print integration. The **Portable 0.2.0.exe** supports a quick trial; use Setup to test installed Explorer integration.

This version requires internet access, a verified Supabase account, and owner-approved Pro/Shop access to print or export. Creating an account does not automatically grant access. Old local serial keys do not unlock this release. The development unlock is excluded from packaged builds.

The database is provisioned. Owner/tester accounts still need provisioning. For this controlled pilot, the owner can create verified test accounts in Supabase **Authentication → Users → Add user → Create new user**, then assign the owner membership as described in `FREE_ACCESS_SETUP.md`. The user should choose and enter each account password. Public email signup/recovery requires custom SMTP and code templates; Google sign-in requires Google OAuth credentials. These providers are not configured by this release.

## Workshop test

1. Back up existing shop data. In App Health, check that the version is **0.2.0**.
2. Sign in and request Shop access; have the owner approve the test account.
3. Import, save, reopen, and export a small booklet. Measure the printed paper size and check LTR/RTL order.
4. Export a sticker sheet and check dimensions, registration marks, and CutContour in the actual cutter software.
5. Export a hardcover layout and verify spine, bleed, wrap, and text placement.
6. Export sequential numbering and check first/last number, duplicates, and sheet order.
7. Try Fast Print with one file and a multi-file selection; check printer, copies, paper, orientation, and duplex.
8. Create a job and quote, reopen exported files, and test autosave recovery and backup/restore.
9. Repeat a large job in Low-end PC mode and check both light and dark themes.

See [the full shop testing plan](SHOP_TESTING_PLAN.md) for detailed cases.

## Feedback

Submit [workshop feedback on GitHub](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/issues/new?template=workshop-feedback.yml).
Include the tool, exact steps, expected/actual output, Windows version, printer/cutter model and driver, paper size, and whether Setup or Portable was used. Attach App Health diagnostics and a small anonymized sample where possible.

Real printer/cutter results and target-PC installation remain part of workshop acceptance. This prerelease is excluded from the stable automatic-update channel. Portable builds are updated manually.
