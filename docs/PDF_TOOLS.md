# PDF Tools

The PDF Tools workspace is available from the sidebar, dashboard and tool search.
It contains exactly the twelve tools in Maher's reference image. Workflows were
reviewed against [iLovePDF](https://www.ilovepdf.com/); the interface uses the app's
shared design system, components and local processing.

| Tool              | Behavior                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merge PDF         | Reorder files with accessible up/down controls and combine their pages.                                                                                           |
| Split PDF         | One output for each comma-separated range, or one PDF per page. Multiple outputs are saved in a ZIP.                                                              |
| Compress PDF      | Lossless object-stream optimization, or flattened image output at balanced/small settings. Keeps the original bytes when recompression would increase size.       |
| PDF to Word       | Page images preserving appearance, or selectable text in an editable DOCX.                                                                                        |
| PDF to PowerPoint | Fitted page images or editable text in a PPTX. Mixed-size pages retain their proportions.                                                                         |
| PDF to Excel      | Selectable text grouped by page, row and horizontal position; one worksheet per page. Formula-like text remains text.                                             |
| Word to PDF       | Installed Microsoft Word or LibreOffice, using saved document layout.                                                                                             |
| PowerPoint to PDF | Installed PowerPoint or LibreOffice. An existing PowerPoint session is kept open.                                                                                 |
| Excel to PDF      | Installed Excel or LibreOffice, using workbook print settings.                                                                                                    |
| Edit PDF          | Add, select, move, resize, undo and delete text, images, shapes and highlights. Added elements become transparent image overlays; source PDF content is retained. |
| PDF to JPG        | Selected pages rendered at 72/150/300 DPI and saved in a ZIP.                                                                                                     |
| JPG to PDF        | JPG/PNG inputs; A4, Letter or image-sized pages; portrait/landscape; margins; fit/fill. Reuses existing JPEG EXIF/ICC handling.                                   |

Editable Office extraction does not perform OCR or reconstruct complex layouts.
These limits are stated beside the relevant settings. Encrypted PDFs need to be
unlocked first. Memory budgets adapt to installed RAM, available memory and the
JavaScript heap. With sufficient headroom the input allowance is 256 MiB on 4 GB,
512 MiB on 8 GB, and up to 1 GiB on 16 GB and larger PCs. Memory pressure lowers
these allowances. The 150 MB and 300-page restrictions have been removed.
Raster canvas budgets scale with the PC and low-end mode; accumulated conversion
output is bounded by the memory policy. These are working-set estimates, not a
guarantee that every PDF of a given size costs the same amount of RAM.

The Windows picker explicitly enables multiple selection for merge and images.
Selected file handles are scoped to their window and read one at a time. Dropping
more files onto an existing list works; readable members of a batch survive a
corrupt or unsupported member. Cancel stops import and keeps completed files.
Natural filename sorting supplements the manual order controls.

Memory detection is advisory. A renderer/preload that is newer than its running
main process keeps the browser/fallback memory policy when the native memory
handler is missing. A missing native picker uses the multi-select browser input.
A normal app restart loads the native endpoints; failed detection does not block
import while that restart is pending.

Merge, split, lossless optimization and overlay assembly use a dedicated worker.
Cancel terminates that worker. Large output PDFs use an on-demand, closable
preview to avoid allocating another document automatically. Source files are
never overwritten; saving uses the shared native export dialog.

The Office bridge checks installed capabilities, opens source documents read-only,
disables macros, uses private temporary paths and cleans its working directory.
It does not install software. Office-to-PDF validation is pending on a machine
with Microsoft Office or LibreOffice; neither is installed on this development PC.

Validation: `npm run test:pdf`, `node scripts/verify-pdf-tools.mjs --large`, typecheck,
build, Storybook build and affected access/export/project/JPEG/i18n/theme suites.
The hidden proof produces representative PDF, JPG, ZIP, DOCX, PPTX and XLSX files
and UI captures under `output/pdf-tools/`. It sends no hardware print jobs.
The large-file proof compressed a 167,794,778-byte scan PDF to 30,746,406 bytes
under a simulated 8 GB / 512 MiB policy while a renderer heartbeat continued.
It ran on the main PC with 32 GB installed; it is not an actual 8 GB hardware
benchmark. The proof also checks a 305-page document, multi-selection, partial
batch failure, ordering, drop-after-import, worker cancellation and input bytes.
