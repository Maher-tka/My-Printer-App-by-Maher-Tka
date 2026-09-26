# Project launch preference

When the user asks to start or restart this app, use development/test mode with `npm run dev` from the project root unless the user explicitly requests another mode. Do not default to the built Electron app, preview mode, or the packaged release.

The existing `.env.development` enables `VITE_DEV_UNLOCK_ALL=true` for the non-packaged development build. Clear an inherited `ELECTRON_RUN_AS_NODE` environment variable before launching Electron.
