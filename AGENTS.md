# Project launch preference

When the user asks to start or restart this app, use development/test mode with `npm run dev` from the project root unless the user explicitly requests another mode. Do not default to the built Electron app, preview mode, or the packaged release.

The existing `.env.development` enables `VITE_DEV_UNLOCK_ALL=true` for the non-packaged development build. Clear an inherited `ELECTRON_RUN_AS_NODE` environment variable before launching Electron.

# Subscriber update preference

When the user says to push an update, they mean publish a new stable app release for all subscribers, not only push Git commits. Bump the version in `package.json` and `package-lock.json`, add release notes, run the release checks, and push the matching version tag to trigger `.github/workflows/release.yml`. Verify the workflow succeeds and the published release includes the installer and automatic-update metadata before reporting completion.

# Workshop PC preference

Keep all application source code and development work on the main PC. Use the connected workshop PC only to inspect, install/update, and verify released builds. Do not clone or develop the application source on the workshop PC.

The workshop PC is in a testing phase. Until the user says otherwise, unsaved in-app test work there is disposable: updates and restarts may close the app and discard that work without a save prerequisite or another confirmation. This preference applies only to unsaved work on the workshop PC; preserve saved projects, source files, and settings.

# Design system for future updates

Before changing any UI, read and follow [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). It is the project design standard; historical screenshots and audit notes do not override it. The user's current instructions take precedence.

Reuse the shared tokens, Button, ActionButton, ToolHeader, ProjectFileActions, PrintButton, and ToolSettingsTabs. Extend shared patterns when necessary instead of creating separate styling systems for individual tools.

Keep one clear primary action per task area. Group file, editing, and output actions separately; use consistent button variants, sizes, icons, labels, order, and spacing. Each command has one visible home in its context. Keep the single Import PDF action and optional Import back PDF; do not restore the duplicate Import front PDF button.

Do not add explanatory subtitles beneath tool names, cards, section headings, or tool search results. Preserve useful project information, validation, errors, and actionable empty states.

For UI updates, verify affected layouts at 1366×768 and 1920×1080 and check relevant themes, RTL, keyboard access, and low-end mode. Run typecheck and appropriate behavior checks. Report actual validation; record unavailable visual checks as pending instead of claiming they passed. Apply the acceptance checklist in the design standard before reporting completion.
