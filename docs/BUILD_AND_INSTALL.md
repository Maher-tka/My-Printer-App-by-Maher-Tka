# Build and install

## Prepare and verify

Use Node.js 24 LTS or newer on Windows, then run:

```powershell
npm install
npm run typecheck
npm run test
npm run build
```

`npm run release:check` runs formatting, type checks, tests, and the production build in one command.

## Create Windows packages

```powershell
npm run dist:dir
npm run dist:win
```

Output is written to `release/`:

- `My Printer App by Maher Tka Setup 0.2.1.exe` — NSIS installer.
- `My Printer App by Maher Tka Portable 0.2.1.exe` — portable test build.
- `win-unpacked/` — unpacked build created by `npm run dist:dir`.

The release candidate uses Electron's placeholder application icon until a final `.ico` asset is approved.

## Publish version 0.2.1

Version 0.2.1 is delivered through the normal GitHub Releases update feed with Setup and Portable packages. Existing v0.2.0 Setup installations can discover this update. The tag workflow in `.github/workflows/release.yml` verifies, builds, and publishes the installer together with the `latest.yml` and blockmap files required by automatic updates.

Before publishing, set the repository variables `PRINTER_SUPABASE_URL` and `PRINTER_SUPABASE_PUBLISHABLE_KEY`. Follow `FREE_ACCESS_SETUP.md` for database and account setup. The tag workflow publishes tags such as `v0.2.1` on the normal update feed. Tags with suffixes such as `v0.3.0-beta.1` publish prereleases, which normal installed builds skip.

For signed releases, configure these GitHub repository secrets:

- `WIN_CSC_LINK` — the Windows code-signing certificate (`.pfx`) as a base64 value or secure download URL supported by electron-builder.
- `WIN_CSC_KEY_PASSWORD` — the certificate password.

Code signing is strongly recommended before distributing the installer to customers. It establishes the publisher identity and reduces Windows security warnings.

To publish 0.2.1 after the release changes are committed on `main`:

```powershell
git tag v0.2.1
git push origin v0.2.1
```

The tag must exactly match the `version` in `package.json`. The workflow creates a GitHub Release containing the Setup EXE, `latest.yml`, and blockmap. Do not delete or rename those generated update files.

Give new customers the **Setup EXE** from the GitHub Release. The Portable EXE is useful for testing but is not the automatic-update delivery channel.

## Publish later updates

For every release, first update both `package.json` and `package-lock.json`. For example, to prepare version 0.2.2 without creating a tag automatically:

```powershell
npm version 0.2.2 --no-git-tag-version
npm run release:check
git add package.json package-lock.json
git commit -m "Release 0.2.2"
git push origin main
git tag v0.2.2
git push origin v0.2.2
```

Installed Setup builds check immediately on every main-app launch and every six hours. Checking and downloading do not require account sign-in and do not block opening the workspace. A newer version downloads in the background, then the app shows a Windows notification and a **Restart to update** button in **Settings**. That button asks the user to save any open project first. If the user simply closes the app, the downloaded update installs during the normal quit, after the existing unsaved-project prompt is resolved.

Only publish a newer semantic version; replacing files on an old GitHub Release will not reliably trigger an update.

## Install on a shop PC

1. Copy the Setup EXE to the Windows shop PC.
2. Scan the file with the PC's antivirus.
3. Run the installer, choose the installation folder, and allow desktop/Start Menu shortcuts.
4. Start the app, sign in with a verified Supabase account, and request access. The owner grants Pro/Shop access or a trial; signup alone does not unlock printing/exporting.
5. Returning users sign in with their Supabase account. Internet access is required for printing and exporting.
6. Open **App Health**. Confirm the version, App Data path, and performance preset.
7. Select **Low-end PC** on older computers.
8. Run the cases in `SHOP_TESTING_PLAN.md` before production work.

For a no-install trial, run the Portable EXE. Portable program files are standalone, but app data still uses the Windows user profile. Portable builds must be replaced manually when a new version is released.

## Uninstall and reset

Use **Windows Settings → Apps → Installed apps → My Printer App by Maher Tka → Uninstall**.

Uninstalling intentionally leaves local jobs, autosaves, settings, and the license record. To reset local data, open **App Health**, note the exact App Data path, close the app, back up any needed project files, then remove that folder. This starts a new local trial record; do this only on a controlled test machine. The development build also exposes **Reset Local Trial / License**.

## Legacy offline test license

```powershell
npm run license:generate -- --plan shop --expiry lifetime --seat SHOP01
```

This generator applies only to legacy local-test development mode; it does not unlock v0.2.1 packaged Supabase builds. The generator is seller-side and local. Do not distribute the repository or signing source with customer builds.

## Development mode

`npm run dev` continues to use `electron.vite.config.ts`. `VITE_DEV_UNLOCK_ALL=true` is honored only in a non-packaged development build.
