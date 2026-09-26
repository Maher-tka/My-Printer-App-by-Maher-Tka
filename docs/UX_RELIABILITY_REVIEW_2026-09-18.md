# App usability and reliability review — 18 September 2026

This pass builds on the existing working tree. It is a broad review with targeted improvements, not a claim that every hardware/device combination or feature path has been exhaustively tested.

## Improvements delivered

| Area                     | Changes                                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                | Shorter production-focused introduction; explicit New booklet action; active-job totals exclude delivered/canceled records; local dates and an inclusive next-seven-days count; clear recent-project loading and failure feedback.                 |
| Navigation               | Named compact sidebar controls, skip-to-workspace link, page titles, scroll reset, visible focus, reduced-motion support, account-menu Escape/outside dismissal.                                                                                   |
| Command search           | Multiword matching, labeled combobox and options, active-result semantics, keyboard focus containment/restoration, empty-result safety, selected-row scrolling.                                                                                    |
| Work preservation        | Unsaved-work confirmation before sign-out and autosave restoration; failed sign-out keeps the project session; recovery failures are surfaced and busy state is always released.                                                                   |
| Booklet                  | Export-specific progress guidance, accessible progress state and bounded percentages.                                                                                                                                                              |
| Cutter                   | Accessible, scrollable native PDF selection dialog; Enter-to-apply page ranges; canceled/superseded imports cannot publish late results; canceled artwork preparation releases previews; Auto Arrange undo rejects obsolete piece/sheet snapshots. |
| Hardcover                | Missing source PDF bytes block export and explain the problem; toggle states and zoom boundaries are clearer.                                                                                                                                      |
| Shop jobs                | Quote normalization and currency rounding, editable existing cost fields, clear price explanation, status synchronization, filter reset, project-opening feedback, accessible board controls.                                                      |
| Calendar                 | Expandable daily job lists instead of inaccessible overflow jobs; named month controls; horizontal scrolling on compact windows.                                                                                                                   |
| Customers                | Native email validation, Enter-to-save, autocomplete, named edit/delete controls, consistent confirmation dialog, empty-state guidance.                                                                                                            |
| Export Center            | Search/status filters, loading/error messages, open/copy feedback, duplicate-print protection, clearer tool navigation.                                                                                                                            |
| Backup and restore       | Restored jobs point to relocated project files; export-history metadata merges; metadata rollback reports failures honestly; job-linked projects are prioritized; backups continue checking through long sessions and avoid concurrent runs.       |
| Save, print, diagnostics | Save feedback remains visible while dirty; print preparation state; desktop-only availability guidance; App Health catches failures and prevents overlapping actions.                                                                              |

## Verification

- Production build and TypeScript passed after integration.
- Full npm test passed: license, print contracts, booklet, project round trips, cutter, hardcover, preflight, jobs, and backup.
- Cutter suites and TypeScript rerun after the final cancellation/undo changes, including the new actual-hook delayed-import regression cases.
- Formatting checked for edited files.
- Browser checks: multiword command search, no-result arrow navigation, Tab containment, Enter route navigation, invalid customer email rejection, Enter-to-save, customer deletion cancellation, calendar next month/return to today, export filter controls and empty state.
- At 800 x 700, calendar page and main content had no horizontal overflow. Desktop dashboard screenshot was visually reviewed at 1440 x 1000.
- Browser console check reported zero errors and zero warnings during the tested workflows.

## Remaining validation boundaries

- Physical printer and cutter output have not been tested. The native print viewer still uses a fixed readiness delay; it needs real-device verification with large PDFs.
- Backup archives contain export history metadata, not copies of exported PDFs. The existing project inclusion cap is 20 and is explained in settings.
- Browser preview cannot exercise real Electron file dialogs, installed subscription activation, operating-system printing, or actual desktop backup folders. These require desktop smoke testing.
- Licensing was regression-tested; no activation rules were relaxed. No release was published and no installer was rebuilt.

Preview evidence: output/playwright/dashboard-ux.png. Existing user edits were preserved.
