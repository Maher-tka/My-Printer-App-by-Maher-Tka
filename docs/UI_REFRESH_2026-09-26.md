# Production UI refresh — 26 September 2026

Base inspected: `552c8bb` (`main`). The review mapped the 393 tracked repository files, read the application entry points, shared UI, production page compositions, persistence contracts, and workflow documentation. It is an architecture and UI review, not a claim that every device or production path has been tested.

## App map

| Area               | Responsibilities                                                                                                                                                         | Main source locations                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Desktop host       | Electron window, native file selection, exports, operating-system integration                                                                                            | `src/main/index.ts`, `src/preload/index.ts`                                                                        |
| App orchestration  | Lazy-loaded routes, account/license access, unsaved-work confirmation, project sessions, recovery and import handoff                                                     | `src/renderer/src/app/App.tsx`                                                                                     |
| Booklet Montage    | PDF/image import, source ordering, blanks, LTR/Arabic RTL imposition, physical print sheets, creep compensation, 3D preview, PDF/image output                            | `src/renderer/src/tools/booklet-montage/`                                                                          |
| Hardcover Cover    | PDF cover pages, physical book measurements, wrap/spine guides, spine fitting, Arabic-capable text/export helpers, batch and quote metadata                              | `src/renderer/src/tools/hardcover-cover/`                                                                          |
| Cutter Montage     | Artwork library, masks/backgrounds, object editing, cut contours, independent quantities, nesting, registration marks, preflight, PDF/SVG/EPS export and FineCut handoff | `src/renderer/src/tools/cutter-montage/`, `src/main/finecut-handoff.ts`                                            |
| AI Sticker Maker   | Local model inference, mask review/correction, alpha tracing, geometric cut offset, transfer into the cutter project                                                     | `components/AIStickerMaker.tsx`, `lib/stickerMaker.ts`, `lib/stickerCutterAdapter.ts` within Cutter Montage        |
| Sequential Number  | Front/back artwork, multiple number/fixed-text positions, padding, cut-and-stack ordering, duplex output, gutter marks                                                   | `src/renderer/src/tools/sequential-number/`                                                                        |
| Shop operations    | Job list/board/calendar, customers, quotes, deadlines, print/export history                                                                                              | `src/renderer/src/jobs/`, `customers/`, `exports/`                                                                 |
| Project safety     | Versioned files with embedded sources, migrations, recent projects, atomic replacement/previous-version backup, autosave and shop backup                                 | `src/renderer/src/projects/`, `backup/`, `src/main/project-persistence.ts`, `atomic-json.ts`, `release-runtime.ts` |
| Access and updates | Local accounts, offline signed subscription keys, trial state, update checks                                                                                             | `src/main/account.ts`, `licensing.ts`, `license-serial.ts`, `app-updater.ts`                                       |
| Performance        | Preview concurrency, render quality, memory budgets, simplified drag and on-demand expensive previews                                                                    | `src/renderer/src/performance/`                                                                                    |
| Windows Fast Print | Explorer context-menu integration, saved driver/stock presets, native shell extension and print helper scripts                                                           | `src/main/fast-print.ts`, `src/native/fast-print-shell.cpp`, `scripts/fast-print*`                                 |

The renderer owns production state and previews. Native file operations and desktop services cross the typed preload bridge. Shared contracts live under `src/shared`. Production tools use existing project sessions and preflight checks before output.

## UI changes

- Shared teal accent, neutral work surfaces, smaller corner radii and lighter shadows. No new dependency, remote font, image request or continuous animation.
- Sidebar reduced from 252 px to 224 px on expanded desktop layouts; a 64 px compact mode can be toggled and is remembered locally. Navigation labels, tooltips, selected states and keyboard focus remain available.
- Top bar reduced from 76 px to 64 px, with compact search, artwork import and account controls.
- Dashboard opens directly onto the production tools. Four local SVG illustrations show the kind of output each tool creates. Entire tool cards are keyboard-operable buttons and preserve loading, locked-access and beta states.
- Smaller job summaries and a recent-project/quick-action split use desktop space more efficiently. All job counts and recent-file data still come from existing stores.
- A shared `WorkspaceHeader` aligns booklet, hardcover and numbering project actions. The hardcover status strip replaces its oversized introduction.
- Booklet controls are grouped into source import, output, print settings, preview mode and sheet actions. Mode names become **Source pages**, **Print sheets** and **3D preview**; active mode is exposed with `aria-pressed`. Millimeter units are explicit for custom sheet size.
- Cutter workflow steps receive clearer active styling and numbered markers. The sticker library has an explanatory empty state, and AI Sticker Maker exposes its toggle state.
- Sequential Number keeps setup and preview alongside each other from the desktop breakpoint, with a narrower setup column.
- Low-end mode also suppresses elevated/sidebar shadows. Reduced-motion preferences remain supported.

Production algorithms, file formats, licensing rules, export dimensions, source bytes, undo history and IPC contracts are unchanged by this UI patch.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed, including main, preload and renderer bundles.
- All **41 existing regression suites** from the package's `test` script passed: license, print contracts, booklet, project persistence, cutter geometry/layers/exports, AI sticker integration, hardcover, preflight, jobs, backup, sequential output and Fast Print.
- The `tsx` CLI cannot create its IPC pipe in this runner. The same test files were run with `node --import tsx`, preserving each script's `tsconfig.web.json` selection via `TSX_TSCONFIG_PATH`.
- Changed files checked with Prettier and `git diff --check`.

### Validation boundaries

Native runtime setup hit an ONNX binary-download network restriction, so dependencies were installed with lifecycle scripts disabled for compilation and regression checks. The normal development launch was attempted; the Electron runtime is not available here. The Cloud Browser cannot access the local renderer, and its URL policy also rejects local files. No interactive browser walkthrough, screenshot review, Windows installer test, physical print/cutter test or model inference run is claimed.

Before merging, run `npm run dev` on the shop PC and review at 1440 × 920 and 1100 × 720: expanded/collapsed sidebar, all four modules, booklet mode switching and custom paper controls, cutter step switching, and project open/save. Clear inherited `ELECTRON_RUN_AS_NODE` as documented in `AGENTS.md`.

The existing production audit still records separate risks around large-project serialization, custom cutter offsets and deep project validation. This patch does not change those systems or claim to resolve them.
