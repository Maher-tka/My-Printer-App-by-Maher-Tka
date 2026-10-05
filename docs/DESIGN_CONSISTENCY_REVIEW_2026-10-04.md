# Design consistency review — 4 October 2026

The app already has a suitable visual foundation: a restrained blue accent, Segoe UI, Lucide outline icons, pale surfaces, and shared spacing/radius tokens. The weak point was inconsistent use of that foundation across production tools. Fixing repeated controls makes the app feel more professional without adding features or redesigning the production workflows.

## Findings and changes

| Finding                                                                                                        | Why it felt out of place                                                    | Applied improvement                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Export PDF used Download in some tools and FileDown in others.                                                 | Users had to recognize the same command again after switching tools.        | A shared header renders the same Export PDF action and FileDown icon in all five tools.                                     |
| New used a reset arrow in Booklet, plain text in other tools, and appeared at the bottom of Sequential Number. | Reset, starting a new project, and deleting content looked interchangeable. | New project uses FilePlus2 and sits with Open, Save, and Save as in the header. Reset keeps RotateCcw; Delete keeps Trash2. |
| Cutter had its own text-only project buttons.                                                                  | The project controls looked unrelated to the other tools.                   | Cutter now uses the same ProjectFileActions component, labels, icons, status and compact sizes.                             |
| Import was represented by a file glyph, image glyph, plus sign, or upload arrow.                               | Content identification and commands were mixed together.                    | Import commands consistently use Upload. File/image icons continue to identify content.                                     |
| Fit and fullscreen both used expansion arrows; zoom ordering and button sizes varied.                          | The same icon could mean two different things.                              | Shared preview controls use minus, percentage, plus, and Fit view. Fit uses Scan; fullscreen keeps Maximize2/Minimize2.     |
| Selected view controls used solid primary buttons, plain outlines, and tinted tabs.                            | Switching tools changed the visual meaning of selection.                    | Selected buttons now use a restrained primary tint and border; solid primary remains available for main actions.            |
| Hardcover repeated its title, instructions, performance badge and status boxes in a large introductory panel.  | It consumed canvas space without helping the next action.                   | A compact source/preflight/year row replaces the extra introductory panel.                                                  |
| Hardcover's guide switches wrapped onto another toolbar row.                                                   | Less-used options made the preview toolbar feel busy.                       | Guides, safe zones and snapping are grouped under View options.                                                             |
| AI Sticker Maker sat between Cutter project-file controls.                                                     | Creating artwork and managing a project were mixed together.                | The maker sits beside Import artwork in the artwork library.                                                                |
| Main panels mixed hardcoded borders, radii and surfaces; warning styling used standalone amber colors.         | Tools appeared to belong to different themes, especially in dark mode.      | Main workspace panels and common fields use the existing UI tokens; project warnings use semantic warning colors.           |

## Shared rules

- Use the action-button icon registry for common commands. A new caller should choose an action rather than choose another icon for an existing command.
- Print remains the rightmost output action. Export PDF appears immediately beside it.
- Project actions keep the order New project, Open, Save, Save as.
- Controls use the existing 32/36 px sizes and 16 px command icons; avoid extra icon margins on buttons that already supply a gap.
- Use tinted selection for modes and view choices. Keep destructive colors for destructive or discard actions.
- Give specialized editors their own controls while retaining the shared frame, action language, surfaces and preview controls.

## Verification

- All five tools checked at 1366 × 768 and 1100 × 720, in light and dark mode.
- Browser checks found one Print action per tool, at the same 17 px top/right inset inside the header, with identical Export PDF and New project icons.
- Card zoom changed to 125%; Fit view restored 100%. Cutter actual-size and Fit actions worked and had distinct icons from fullscreen.
- Hardcover guide options toggled correctly. AI Sticker Maker opened from the artwork library and returned to Cutter through the shared header.
- Sequential Number preserved a temporary draft when New project was canceled, and reset it only after discard was selected.
- Type checking, the production build, project-file round trips, and atomic-save regression checks passed.

Review screenshots are in `output/playwright/design-*.png`. Browser fixtures were temporary; no physical print job was sent.
