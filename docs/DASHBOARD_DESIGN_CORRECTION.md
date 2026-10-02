# Dashboard composition correction

Date: 2026-10-01. Scope: production dashboard and supporting application shell. Existing production-module work from earlier turns remains in place; this correction does not edit print/export algorithms or redesign those modules.

## Rejected composition and changes

| Discrepancy in the supplied current-app screenshot  | Correction                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Window-filling admin shell and edge-to-edge header  | Floating 32 px application frame, practical 12 px exterior at compact desktop sizes and 24×32 px at large desktop sizes; integrated brand header |
| Rectangular edge rail with a strong divider         | Circular navigation on a transparent 68 px dashboard rail, existing route names and tooltips preserved                                           |
| Four identical zero-status cells spanning the page  | Two compact truthful summaries in the center column; overdue information remains available                                                       |
| Three equally weighted large cards                  | Asymmetric current-project/recent-files, production/activity, and action/toolkit columns                                                         |
| Generic document icon in a large blank panel        | Real stored job thumbnail when available, otherwise a layered document illustration with clear fallback semantics                                |
| Repeated separators and nested rectangular controls | Soft tonal surfaces, restrained borders, circular quick actions, radio selection of a real production action                                     |
| No strong primary action                            | Tall Start production panel with four real actions and a full-width contextual action button                                                     |
| Repetitive module list surface                      | Distinct navy toolkit card preserving all four production destinations                                                                           |
| Extra history card pushed content below the fold    | Queue and real export history share an accessible tabbed activity panel                                                                          |

## Design source

Editable Figma target: https://www.figma.com/design/ihRoAlMdn4t1KXJ6fzZruA?node-id=12-180

The target uses existing local variables and button instances. Retrieved frame: 1920×1080; application surface 1856×1032, radius 32; column widths 532/620/536 with 20 px gaps. Production code adapts those proportions to a fluid grid. Segoe UI is the native Windows font; the Figma environment supports Inter as the documented design fallback.

Figma Starter MCP quota was reached after the target and atmosphere update were created. Later local refinements (activity tabs and tighter action spacing) could not be synchronized back into Figma. The Figma screenshot is a design reference only; no flattened design image is used as the app UI.

## Visual passes

1. Structure: compared the live 1920×1080 renderer with Payno/Crextio. Floating silhouette, hierarchy, unequal card heights, circular rail and navy emphasis are materially different from the rejected screenshot.
2. Density: reduced document preview height and action spacing; consolidated history into tabs. Checked the actual Electron window using existing saved project metadata, draft job, and export history.
3. Desktop/interaction: 1366×768 check; keyboard radio selection, picker handoff, command search, activity tabs and navigation. Main content scrolls vertically when necessary; controls and cards retain usable widths.

## Data and behavior boundaries

- Jobs continue to come from `useJobStore`; deadline status uses existing helpers. Stage visualization is shown only for real jobs across multiple stages.
- Recent projects use the existing native list/open APIs. Matching stored job previews are used if they contain a local image URL; unavailable or broken thumbnails show the document fallback.
- Import PDF uses the existing file picker and Booklet Montage handoff. Artwork import and new-workspace actions retain their original callbacks.
- Export history uses the existing component and native runtime API. No new analytics, sample customer records, or fake chart series are saved.
- No backend, printing calculation, preflight gate, file format or export logic is changed in this correction.

## Verification evidence

- Production build and TypeScript checks passed.
- Focused job/workflow/search regression tests passed.
- Native Electron inspection showed the existing recent project, one draft job, and actual saved export history.
- 1920×1080 live renderer screenshot captured, plus native Electron screenshot with real local data.
- 1366×768 layout measurements found no horizontal document or main-content overflow.
- PDF picker and real eight-page test-file handoff were exercised through the new production action.

The import check initially exposed a development StrictMode mount cancellation. The initial handoff now waits for the stable mount before consuming the request; all eight pages loaded and the export action became enabled on recheck. Booklet regression tests passed afterward. No production calculation or export algorithm changed.

The user stopped Windows Computer Use with Escape during the final native capture. Native real-data inspection and the earlier native screenshot had succeeded; the final capture was not continued. Remaining screenshots/verification should be performed only when the user resumes computer control.

No unsolicited print job was sent to hardware. Earlier broader module QA remains tracked separately in `UI_REGRESSION_CHECKLIST.md`; this document describes the corrected dashboard scope.

## Glass refinement

User follow-up requested a stronger glass effect. Dashboard surfaces now use lower background opacity, a 12 px frosted backdrop filter with restrained saturation, brighter edge highlights, and a translucent floating frame. Blur is applied only to top-level dashboard panels, not every nested control. No full-window blur, animation library, or production logic change was introduced.

Verified in the background live renderer at 1920×1080 and 1366×768: balanced mode resolves `blur(12px) saturate(1.08)`, text remains #172239, and main-content horizontal overflow is zero. Low-end mode resolves no blur, no shadows, and opaque #F7FAFF surfaces. The temporary preview performance preference was restored to Balanced. Production build and formatting checks passed.

Preview artifact: `C:/Users/Maher/.codex/visualizations/2026/09/29/01a0ee52-6e9b-7723-b8bf-1e7bd8f0a72b/qa/dashboard-glass-1920.jpg`.
