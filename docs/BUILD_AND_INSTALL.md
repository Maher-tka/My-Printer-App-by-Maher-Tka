# Build and install

## Prepare and verify

Use Node.js 20 or newer on Windows, then run:

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

- `My Printer App by Maher Tka Setup 0.1.0.exe` — NSIS installer.
- `My Printer App by Maher Tka Portable 0.1.0.exe` — portable test build.
- `win-unpacked/` — unpacked build created by `npm run dist:dir`.

The release candidate uses Electron's placeholder application icon until a final `.ico` asset is approved.

## Install on a shop PC

1. Copy the Setup EXE to the Windows shop PC.
2. Scan the file with the PC's antivirus.
3. Run the installer, choose the installation folder, and allow desktop/Start Menu shortcuts.
4. Start the app and open **App Health**. Confirm the version, App Data path, and performance preset.
5. Select **Low-end PC** on older computers.
6. Open **License**, paste a generated key, and select **Activate Locally**.
7. Run the cases in `SHOP_TESTING_PLAN.md` before production work.

For a no-install trial, run the Portable EXE. Portable program files are standalone, but app data still uses the Windows user profile.

## Uninstall and reset

Use **Windows Settings → Apps → Installed apps → My Printer App by Maher Tka → Uninstall**.

Uninstalling intentionally leaves local jobs, autosaves, settings, and the license record. To reset local data, open **App Health**, note the exact App Data path, close the app, back up any needed project files, then remove that folder. This starts a new local trial record; do this only on a controlled test machine. The development build also exposes **Reset Local Trial / License**.

## Generate a test license

```powershell
npm run license:generate -- --plan shop --expiry lifetime --seat SHOP01
```

The generator is seller-side and local. Do not distribute the repository or signing source with customer builds.

## Development mode

`npm run dev` continues to use `electron.vite.config.ts`. `VITE_DEV_UNLOCK_ALL=true` is honored only in a non-packaged development build.
