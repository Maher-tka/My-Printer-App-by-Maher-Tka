# Design system rules

Status: project standard for future UI changes. Applies to every tool, the dashboard, navigation, jobs, settings, dialogs, and shared components.

This document defines the intended design. Historical screenshots and audit documents describe earlier work; they do not override these rules. Existing screens may need gradual migration. Do not claim compliance without checking the affected screen.

## Principles

1. **Make the work clear.** Show the current tool, its inputs, the working preview, and the next action in a predictable order.
2. **One action, one place.** Give each command one visible home in its context. Combine duplicate buttons when they accomplish the same task.
3. **Keep headings concise.** Tool names and section headings stand on their own. Do not add explanatory subtitles beneath them or beneath tool cards and search results.
4. **Use shared foundations.** Reuse tokens and components. A feature must not introduce its own button family, color palette, spacing scale, or typography system.
5. **Organize by task.** Keep file actions, editing controls, and output actions in separate groups. Show less common controls under Advanced or a clearly named menu.
6. **Make status truthful.** Busy, empty, error, selected, and disabled states reflect actual application state. Preserve production checks, project information, and unsaved-work indicators.
7. **Protect the workspace.** Controls support the preview and artwork. They must remain usable on smaller desktop windows without clipping or covering the canvas.

## Sources of truth

| Concern                                                        | Shared source                                                                                                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color, spacing, radius, control height, font, motion, layering | [tokens.css](../src/renderer/src/design-system/tokens.css)                                                                                                      |
| Global layout and shared styles                                | [styles.css](../src/renderer/src/styles.css)                                                                                                                    |
| Dark appearance                                                | [dark-surfaces.css](../src/renderer/src/appearance/dark-surfaces.css)                                                                                           |
| Button appearance and sizes                                    | [Button](../src/renderer/src/components/ui/button.tsx)                                                                                                          |
| Common command labels, icons, busy states                      | [ActionButton and ActionIcon](../src/renderer/src/components/ui/action-button.tsx)                                                                              |
| Workspace heading and output placement                         | [ToolHeader](../src/renderer/src/tools/shared/ToolHeader.tsx)                                                                                                   |
| Project file actions and save status                           | [ProjectFileActions](../src/renderer/src/projects/ProjectFileActions.tsx)                                                                                       |
| Printing availability and progress                             | [PrintButton](../src/renderer/src/print/PrintButton.tsx)                                                                                                        |
| Setup and advanced settings                                    | [ToolSettingsTabs](../src/renderer/src/tools/shared/ToolSettingsTabs.tsx)                                                                                       |
| Visual examples                                                | [Design system stories](../src/renderer/src/components/ui/DesignSystem.stories.tsx), [workflow stories](../src/renderer/src/components/ui/Workflow.stories.tsx) |

If a pattern is missing, extend a shared component and demonstrate it in Storybook before repeating it in multiple screens. Use existing components for ordinary changes; a new design system or framework is unnecessary.

## Layout and hierarchy

- Use the existing application shell. Tool workspaces use `ToolHeader`; do not build another custom header for each feature.
- Keep the title and back navigation together. Keep output actions at the header's output edge using the shared layout. Project actions form a separate row or group.
- Organize a tool as source/input, setup, preview/editing, and output. Some tools may use tabs or workflow steps, but common commands keep the same names and locations.
- Keep local editing actions beside their editor. Keep preview controls beside the preview. Place validation issues beside the relevant fields or in the existing preflight area.
- Align fields, section edges, and action rows to a consistent grid. Give each group one heading and avoid repeated boxes around individual controls.
- Allow settings panels and the page to scroll when space is limited. Avoid accidental horizontal page scrolling. Intentional canvas panning and table scrolling belong in their own bounded containers.
- Wrap action groups as groups at narrow widths. Preserve their order and labels; do not solve overflow by shrinking text or hiding the main action.
- Treat the dashboard's existing glass surfaces and circular navigation as established shell patterns. Tool settings use the shared neutral surfaces and button shapes.

## Button hierarchy

Choose the variant by meaning. Do not override the shared button colors, radius, font, or height with page-specific classes.

| Role                        | Variant       | Examples and rules                                                                                                                                                  |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main next action            | `default`     | Print in a production workspace; Start production on the dashboard; Import PDF before a source is loaded. At most one filled primary action in a visible task area. |
| Supporting command          | `outline`     | Export PDF, Open, Save, Save as, replacing a source, importing an optional back.                                                                                    |
| Neutral supporting choice   | `secondary`   | Use only when an established shared pattern needs a tonal action. Do not alternate it randomly with `outline`.                                                      |
| Persistent active choice    | `selected`    | Current mode or active toggle. Selection must also have appropriate `aria-pressed`, radio, or tab semantics.                                                        |
| Quiet navigation or utility | `ghost`       | Back, Cancel, New project when secondary to current work.                                                                                                           |
| Dense editor command        | `toolbar`     | Local editing tools inside a toolbar; retain keyboard focus and active-state semantics.                                                                             |
| Destructive action          | `destructive` | Delete in a removal context. Separate it from ordinary editing and output actions.                                                                                  |

The main action can change with workflow state. For example, Import PDF is primary in an empty source area and becomes outline after loading. Several unrelated controls must not compete as filled primary buttons within the same group.

### Size, icons, and labels

- Standard buttons: `size="default"`, 36 px. Compact toolbars and file rows: `size="sm"`, 32 px. Prominent standalone actions: `size="lg"`, 40 px.
- Icon controls: `size="icon"`, 36 px, or `size="icon-sm"`, 32 px in dense editor toolbars. Buttons in one row use the same height.
- Use the existing Lucide icons. Shared command icons come from `ActionIcon`; shared commands use `ActionButton`. A file-type icon identifies content, while an action icon identifies a command.
- Use verb-first labels: Import PDF, Export PDF, Save, Delete. Include the object when it distinguishes an action. Do not give one operation several different labels across tools.
- Prefer visible text for import, save, export, print, and destructive actions. Icon-only controls are for established compact patterns such as zoom; provide a translated accessible name and tooltip.
- Keep icon placement consistent. Do not add decorative icons that repeat the same information or mix icon libraries.
- Use `type="button"` for commands outside form submission. Form submission uses `type="submit"` deliberately.

### Action group placement

| Group            | Order and placement                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace output | Export PDF, then Print at the output edge, using `ToolHeader`. Print is primary; Export PDF is outline.                                           |
| Project files    | New project when supported, Open, Save, Save as, using `ProjectFileActions`. Keep save status with this group.                                    |
| Source import    | One main Import PDF action; optional Import back PDF only when it supplies a separate back. Do not restore the duplicate Import front PDF button. |
| Editor tools     | Group related commands together; keep Undo and editing utilities apart from Delete.                                                               |
| Dialog footer    | Cancel followed by the confirming action. Use a destructive confirming action only for a destructive operation.                                   |

Do not duplicate an export, import, or print command inside a panel if the same command is already visible in that workspace. A genuinely different operation must have a distinct label, scope, and placement. Use the shared RTL behavior instead of independently reversing each row.

### Interaction states

- Busy actions show progress through the shared spinner and a short label such as “Creating PDF…”. Disable repeat submissions and set `aria-busy`.
- Disable actions when prerequisites are unmet. Put an actionable reason in the relevant validation area or accessible help; do not leave the user guessing.
- Maintain hover and visible keyboard focus. A selected state differs from hover and does not depend on color alone.
- Keep state changes from shifting neighboring controls where practical. Never introduce fake progress or success before the operation completes.

## Visual foundations

| Foundation | Rule                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spacing    | Use the existing 4 px scale: 4, 8, 12, 16, 20, 24, 32, 40, 48 px. Use 8 px within action groups, 16 px for ordinary panel padding, and 16–24 px between sections. Matching Tailwind spacing utilities are acceptable.               |
| Radius     | Buttons use `--ui-radius-md` (14 px); ordinary panels use `--ui-radius-lg` (18 px). Other established shared surfaces use their named radius tokens.                                                                                |
| Typography | Segoe UI/system font from `--ui-font`. Body and buttons follow the existing 13 px baseline; supporting data is generally 12 px. Workspace titles use the shared header. Do not invent another font or reduce essential text to fit. |
| Color      | Use semantic foreground, background, primary, border, warning, success, and destructive tokens. Do not hardcode new UI colors in a tool component.                                                                                  |
| Surfaces   | Use the existing surface tokens and restrained borders. Reserve shadows for established panels and overlays; avoid nested shadows and decorative gradients in settings.                                                             |
| Motion     | Use `--ui-transition` (160 ms) and shared transitions. Honor reduced-motion and low-end performance modes.                                                                                                                          |
| Layering   | Reuse the toolbar, sidebar, overlay, and command-center layer tokens. Do not add arbitrary large z-index values to overcome layout problems.                                                                                        |

Artwork, PDF page colors, cutline colors, and customer design data are production content, not UI palette tokens. Keep their exact color and dimensional requirements. Do not apply interface theme rules to exported artwork.

New tokens belong in the shared token file with light and dark definitions where needed. A local exception must have a clear functional reason; promote repeated exceptions into a shared pattern instead of adding more overrides.

## Copy and accessibility

- Keep explanatory subtitles out of tool headers, cards, section headings, and tool search results. Do not reintroduce them during future redesigns.
- Preserve meaningful information: filenames, page counts, dimensions, project/save status, validation, import errors, and actionable empty states. Provide necessary help beside the relevant field, in a tooltip, or in Advanced rather than adding prose beneath every heading.
- Translate new interface strings through the existing i18n system. Verify long French labels and Arabic text/RTL behavior without clipping, incorrect alignment, or changed production reading direction.
- Use semantic buttons, labels, tabs, and dialogs. Keyboard order follows the visible workflow; dialogs retain focus management and Escape behavior.
- Provide visible focus, sufficient contrast, and accessible names. Error and status messages must be readable in both themes and must not rely solely on color.

## Review for every future UI change

1. Read this document and inspect the shared component closest to the proposed change. Decide where the action belongs and which existing pattern implements it.
2. Reuse the tokens and components. Add a Storybook example when introducing or materially changing a shared interaction; show the relevant enabled, disabled, busy, and selected/error states.
3. Inspect affected screens at 1366×768 and 1920×1080; include 1600×900 when changing workspace layout. Check headings, grouping, canvas visibility, scrolling, long labels, and keyboard access.
4. Check light/dark themes, Arabic RTL, and low-end mode when the change affects appearance, layout, or motion. Use real or representative data and an empty state; exercise the changed action without sending unsolicited hardware print jobs.
5. Run `npm run typecheck`. Run formatting checks on changed files. Use affected regression suites for behavior changes and the existing release checks when publishing a release.
6. Report what was actually checked. Record unavailable visual checks as pending in [UI_REGRESSION_CHECKLIST.md](UI_REGRESSION_CHECKLIST.md); passing TypeScript does not prove the layout looks correct.

### Acceptance checklist

- [ ] One clear main action per task area; supporting actions use the correct variants.
- [ ] Buttons have consistent sizes, icons, names, ordering, and spacing.
- [ ] Each command has one visible home; no duplicate front/source import action.
- [ ] Tool names and headings have no explanatory subtitles.
- [ ] Shared components/tokens are reused; exceptions have a functional reason.
- [ ] Focus, labels, busy/disabled states, and validation remain understandable.
- [ ] Required window sizes, themes, translations, and performance modes have been checked or explicitly recorded as pending.
- [ ] Project handling, production measurements, artwork, and print/export behavior remain correct.

Maintain these rules with the shared components when an intentional design change is made. Do not use an older screen's inconsistency as the pattern for a new feature.
