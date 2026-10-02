# UI audit — My Printer App by Maher Tka

Audit date: 2026-09-30. Source: the existing repository, not a replacement prototype.

## Frontend stack and architecture

- Electron 39 with an isolated preload bridge; React 18 and TypeScript.
- electron-vite/Vite builds main, preload, and renderer; npm is the package manager.
- Tailwind CSS, semantic CSS variables, Radix Select/Tabs/Tooltip/AlertDialog, and Lucide outline icons.
- `App.tsx` owns lazy-loaded hash navigation, license/account access, active project sessions, recovery, and import handoff. `AppLayout` supplies Sidebar, TopBar, a scrollable main region, and the Ctrl+K Command Center.
- Module hooks own production state. Job/customer stores persist locally and broadcast storage events. Project files, autosaves, backups, and native dialogs cross the preload bridge.
- PDF.js decodes/renders imports; pdf-lib/fontkit produces output. SVG/HTML canvases and raster previews visualize production. dnd-kit supports page/piece interactions; react-pageflip supplies the booklet mockup. Cutter nesting, geometry, contours, and EPS/PDF export are separate libraries.

## Modules actually found

1. Dashboard: tools, recent local project files, jobs, exports, import shortcuts.
2. Booklet Montage: PDF/image import, source page order, blank pages, sheet montage, front/back imposition, RTL, size/scale, creep, 3D flip preview, project save/open, preflight, PDF/image export and printing.
3. Hardcover Cover: source documents, dimensions and spine, title/design/layout stages, batch customer/student output, cover previews/mockup, QR text or URL in BackCoverEditor, exports/quotes.
4. Cutter Montage: sticker library, individual artwork editor, large-sheet montage, print/cut/registration layers, arrangement, transformations, resize, cutlines, marks, preflight, output, FineCut/Mimaki handoff.
5. Sequential Number: artwork/design editing, numbering range, position, sheet/cut-stack order, aligned backs, project persistence and PDF/print output.
6. Shop Jobs, customer database, quote/deposit tracking, production board/list/calendar.
7. Export Center, Settings, license/account, App Health, backups, updates, and development Quality Lab.

Big Sheet/Mimaki is a cutter workflow rather than a separate route. QR has a dormant stored hardcover input, but no active generator or export renderer. Navigation will represent actual functionality rather than introduce fake destinations. EPS is supported for cutter output, not source import; Illustrator input must be PDF-compatible.

## Reusable UI

`components/ui` includes Button, Input, Textarea, Select, Tabs, Tooltip, Card, Badge, Field, Empty, Avatar, Table, Separator, Label, and AlertDialog. `ProjectFileActions`, `PrintButton`, preflight dialogs, file pickers, and shared import/export progress components already connect to real operations. Extend these rather than duplicate their behavior.

## Inconsistencies and layout problems

- The in-progress atelier shell uses a forest sidebar and renamed module labels, while tools retain blue/violet/green panels. The supplied reference requires a light, icon-first rail and original module names.
- Dashboard contains a large gradient hero and duplicated launcher/action sections. Recent work should receive greater prominence.
- Shared controls default to 40 px, and module-specific native inputs duplicate padding/radii.
- Booklet controls form a broad stacked toolbar above source/preview modes, reducing canvas height. Property groups should be separate from primary actions.
- Hardcover has a large introductory region and a long left workflow rail; the actual cover preview needs more available space.
- Cutter already has a bounded workspace, but overlays and multiple strips compete with its canvas. Production layers need explicit print/cutline/marks labels.
- Heavy shadow/blur styles and numerous nested borders create visual noise. Several metadata labels are uppercase and too bold.
- New login source contains replacement characters in busy labels and dash normalization; repair before release.

## Performance risks

PDF rasterization, thumbnails, 3D mockups, contour geometry, background removal models, and large cutter sheets are expensive. Preserve existing memory cleanup, render queues, import cancellation, decoder asset configuration, and low-end PC preset. Do not add animated backgrounds, large backdrop filters, font network requests, or animation libraries. Keep canvas artwork colors and production marks independent of UI theme colors.

## Safe modernization boundaries

Safe: shared tokens/controls, layout containers, presentation classes, accessible labels/tooltips, panel grouping, toolbar ordering, scrolling, error/busy states, and dashboard organization.

Protected: `src/main`, `src/preload`, production hooks and `lib` calculations, PDF units/coordinates, imposition/RTL/page order, spine formulas, cutline color/separation and registration geometry, nesting/arrangement, project migration/persistence, license checks, preflight gates, and print/export handlers. Existing sticker-maker edits are user work and must be preserved.

## Keyboard behavior to retain

Ctrl/Cmd+K global search. Ctrl/Cmd+S in Sequential Number. Artwork editor undo/redo, zoom, duplicate, selection and delete shortcuts. Montage arrow nudging/Ctrl+D, page keyboard drag/drop, Escape in dialogs, and Enter/Space on actionable preview items. UI restructuring must preserve handler attachment, focus, and disabled states.

## Migration

Create reference analysis and centralized tokens; use the connected Figma design system; migrate shell and primitives; reorganize home; modernize each module's UI without replacing calculations; check dialogs/settings/QR; compare 1920×1080 and 1366×768 screenshots across three refinement passes; run build/typechecks and relevant regression suites. Record actual validation and limitations in UI_REGRESSION_CHECKLIST.md.
