# Dark appearance

Implemented 2026-10-01 for the existing application.

## Controls

- Header moon/sun button switches directly between dark and light.
- The same toggle is available on the sign-in screen before opening a workspace.
- Settings → Appearance → Color theme offers Light, Dark and System.
- The choice is stored under `my-printer-app.appearance.v1`. System follows the Windows application color-scheme preference.
- Theme initialization runs before React mounts. Cross-window storage events and system changes update the interface without resetting project state.

## Presentation

Dark glass uses navy/slate surfaces, pale blue accents, light text, restrained edge highlights and the existing frosted panels. Shared cards, fields, native controls, menus, dialogs, navigation and account access use semantic tokens. Dedicated overrides cover the dashboard's previously fixed light backgrounds.

CSS does not invert or filter artwork, print-page images, production SVGs or cutlines. Physical paper remains white in previews. No imposition, dimensions, contour geometry, preflight or export calculation is changed.

Low-end mode uses opaque dark surfaces with no blur or panel shadows. Unsupported backdrop filters also receive opaque dark surfaces.

## Verification

- Appearance regression test covers startup from a saved choice, idempotent initialization, persistence, system changes, explicit-theme precedence, cross-window changes, unrelated storage events, invalid preferences, unavailable storage, and unsubscribe cleanup.
- Production build and TypeScript checks passed.
- Browser checks verified dark preference after reload, all three settings options, dark command-menu colors, and the opaque dark low-end fallback; the temporary performance mode was restored to Balanced.
- Live dashboard inspected at 1920×1080 and 1366×768, with no horizontal main-content overflow. Dark balanced mode retains the frosted glass effect.
- An actual eight-page test PDF loaded in Booklet Montage; export was enabled. Switching light/dark preserved all eight pages and the 320×454 px preview geometry, with no image filter applied. The paper stayed white.
- Preview: `C:/Users/Maher/.codex/visualizations/2026/09/29/01a0ee52-6e9b-7723-b8bf-1e7bd8f0a72b/qa/dashboard-dark-1920.jpg`.

The Windows font remains Segoe UI. The appearance preference is per app origin, like the existing local performance setting.
