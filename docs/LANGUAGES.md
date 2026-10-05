# Application languages

The language selector beside the theme button offers English (default), French, and Arabic.
The choice is stored locally as `my-printer-app.language.v1`, works offline, and synchronizes
between renderer windows. Arabic sets the application document to right-to-left. Production
canvases keep their own coordinate system and book direction; switching UI language does not
change artwork, saved project values, or exported files.

Use `useLanguage()` in React components and call `t()` only for application-owned display
copy. The English source string is the catalog key in `src/renderer/src/i18n/messages.ts`.
Add both `fr` and `ar` values when adding new copy. Translate data labels at render time;
keep route IDs, option values, filenames, customer input, and project state unchanged.
Copy without a catalog entry falls back to English, including technical messages received
from the desktop process. This avoids hiding errors while translation coverage grows.

Use logical CSS properties (`start`, `end`, `ps`, `pe`) for UI alignment. Give a scrollable
production viewport `dir="ltr"` when its pointer/scroll calculations use physical coordinates.
Do not change a document's print direction based on the application language.

Run `npm run test:i18n` to check persistence, storage fallback, RTL/LTR transitions,
cross-window updates, and catalog completeness. `npm run build` checks the renderer types
and bundles the local catalog.
