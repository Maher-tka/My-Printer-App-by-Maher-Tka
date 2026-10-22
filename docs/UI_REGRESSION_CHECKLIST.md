# UI regression checklist

## 2026-10-22 — v0.2.20 published and verified

- Stable/latest v0.2.20 is published at release commit `931ed02`; Windows workflow
  `39768582582` completed successfully. Setup, Portable, blockmap, `latest.yml`
  and the checksum manifest are present.
- Downloaded Setup is 224,352,927 bytes and reports version 0.2.20. Its SHA512
  matches both automatic-update references and declared size. Downloaded assets
  match SHA256 checksums and GitHub digests; Portable presence/API digest also
  matches its manifest entry. See `RELEASE_0.2.20_VERIFICATION.md`.
- Unrelated sticker-review work was preserved and excluded. Primary development
  output is restored. Physical Epson/press output and workshop installation
  remain pending; no hardware jobs were sent.

## 2026-10-22 — v0.2.20 release validation

- Prepared in an isolated checkout based on stable v0.2.19, containing the
  completed Fast Print changes only. Uncommitted sticker-review work remains in
  the primary checkout. Package and both lockfile versions match 0.2.20.
- Full `npm run release:check` succeeded: formatting, both TypeScript projects,
  automated suites, Storybook and production Electron build. The optional
  local hardcover source fixture was absent in this checkout and reported its
  existing skip; no hardcover behavior changed.
- Native Explorer extensions/dialog built. Driver/profile and physical A3
  bounds checks passed. Final production-build source and counts workflows
  passed in English/French/Arabic, including mixed page orientations, A4/A3,
  last-printer restoration, all n-up counts, copies and changed/missing PDFs.
- ID review survived printer changes and both native settings round trips in
  English dark, French light and Arabic RTL dark/low-end. Final grayscale A3
  proofs contained six IDs per side and five sheet copies. Both Polaroid modes
  passed every num216p original, reviewed/print equality and blank final slots;
  signed-out production printing stayed blocked. Original hashes were unchanged.
- No hardware print jobs or main-PC desktop input were sent. Physical Epson and
  press output, trays/finishing and live high-DPI checks remain pending.

Artifacts in the primary workspace: `output/release-0.2.20-{check,native,driver,page-size,source,counts,id-workflow,polaroid}.log`,
`output/release-0.2.20-id-workflow`, `output/release-0.2.20-polaroid`.

## 2026-10-22 — Last printer, original orientation and full A3 output

- Successful printer selection now atomically records the last device even when
  the dialog is canceled. A launch hint cannot override an installed remembered
  queue, and a snapshot from another queue is not applied. A fresh hidden native
  window restored the last selected alternate printer in all three language runs.
- General full-page jobs default to Original orientation with Fit to frame off.
  Per-page sizes carry image EXIF/PDF rotation through native preview, compositor
  and QueryPageSettings. Explicit portrait/landscape and manual rotations remain;
  n-up templates, Polaroid orientation and horizontal ID output stay separate.
- Read-only workshop diagnostics on EPSON WF-C879R confirmed that A3 survives
  DEVMODE normalization (2970×4200 tenths of a millimeter), but PrintableArea
  remains portrait-shaped for landscape A3. The old second fit intersected that
  narrow area with landscape bounds. All composed rasters now draw at the chosen
  physical page size with hardware-origin compensation, using the layout margins
  already in the artwork. Physical paper dimensions are validated before printing.
  Epson defaults remained byte-identical; no hardware jobs were sent.
- Hidden source tests passed in English dark, French light and Arabic RTL dark:
  landscape/portrait images, EXIF-rotated JPEG and a four-page PDF with intrinsic
  rotations all matched native/worker placement on A4 and A3. Seven source pages
  produced seven output pages and 14 sheets at two copies. Counts checks also
  passed all eight n-up templates, mixed document boundaries, copy changes and
  changed/missing inputs. Native captures at 1366×768, 1920×1080, 1600×900 and
  820×640 reuse the existing controls, shared theme and single Print action;
  inspected representative captures with the new Original choice and totals.
- A virtual Microsoft Print to PDF proof (no hardware) produced all seven pages
  at 297×420 mm with the expected per-page orientation. Rendered every page with
  Poppler and inspected the contact sheet. Separate GDI bitmap proofs verified
  full A3 portrait/landscape coverage and hard-margin compensation.
- All eight ID TEST originals and 88 rotated/off-center cases passed, with
  unchanged hashes and 90 mm widths/paired centers. Both Polaroid modes passed
  all 15 num216p photos, matching preview/print artwork, pagination and blank
  slots with unchanged originals. Typecheck, Fast Print unit checks, native and
  production builds passed. Physical Epson output, duplex/trays and live high-DPI,
  keyboard/low-end-PC interaction remain pending. Changes are local/unpublished.

Artifacts: `output/fast-print-source`, `output/source-verification.log`,
`output/source-spool.log`, `output/source-counts.log`, `output/source-id-real`,
`output/source-polaroid`, `output/source-unit.log`,
`output/fast-print-2026-10-22-types.log`, `output/source-production-build.log`.

## 2026-10-21 — Fast Print document page totals

- Added each file's source-page count before its filename and a dedicated job
  summary above Print. It distinguishes total source pages from output pages,
  sheets per copy and sheets across copies. Ordinary n-up estimates preserve PDF
  boundaries, group adjacent images and include inter-document duplex blanks.
  Polaroid uses its continuous 8/9-page grouping; native ID mode shows input
  totals while its output remains configured in ID verification.
- Counts use cached PDF metadata/prepared Word PDFs, not a render of every page.
  Startup stays asynchronous. Loading/unavailable states replace stale totals;
  changed and missing inputs clear cached filename captions. Closing stops the
  count scan before it starts another document. Existing status errors, shared
  native controls/tokens, keyboard navigation and the single Print remain.
- Hidden counts checks passed in English dark, French light and Arabic RTL dark
  at 1366×768, 1920×1080, 1600×900 and 820×640. Inspected representative captures;
  the summary's measured text fits. Verified all 1/2/4/6/8/9/12/16-up layouts,
  one/three copies, duplex arithmetic, preserved file selection, page labels,
  a PDF changing from five to seven pages and an unavailable/missing PDF.
- Mixed five-/three-/one-page PDFs plus images correctly totaled 12 source
  pages. Actual renderer/driver ValidateOnly output matched the six output pages
  shown for four-up, with three copies (18 total sheets). Typecheck, Fast Print
  unit checks and native compilation passed. No hardware jobs or desktop input
  were sent. Physical duplex, live keyboard/high-DPI and low-end-PC interaction
  remain pending; no Electron renderer appearance or motion changed.
- Local update only; subscriber publication has not been requested for this change.

Artifacts: `output/fast-print-counts`, `output/fast-print-counts.log`,
`output/counts-types.log`, `output/counts-unit.log`.

## 2026-10-21 — Color capability and Konica Polaroid availability

- Reproduced the .NET Framework color-capability bug locally: three color PDF
  queues reported `SupportsColor=false` in Windows PowerShell 5.1, while native
  `DC_COLORDEVICE` returned 1. The same queues reported true under PowerShell 7.
  Native dialog discovery, the printer list and final print validation now share
  the driver's dedicated color-capability query. Monochrome (0) stays false;
  query failure falls back to the legacy flag. No model-name override or dmColor
  inference is used.
- Workshop read-only inspection confirmed installed version 0.2.18.0 and queues
  `KONICA MINOLTA C4080Series PS` / `KONICA MINOLTA`, both using the C4080Series PS
  driver. Both reported native color capability 1 and Color in PrintCapabilities.
  A follow-up in Windows PowerShell 5.1 / CLR 4.0 / x64 / STA reproduced
  `SupportsColor=false` both before and after applying the current DEVMODE on
  disposable documents. Native queries with both null and real ports returned 1
  for both presses and Epson controls. The SHARP control exposed the opposite
  Framework error (true), while native capability correctly returned 0 with both
  port arguments. No workshop source,
  defaults, saved settings or print jobs were changed; patched-build installation
  and physical press output remain pending.
- Local driver/profile tests passed for Microsoft PDF and Wondershare PDF,
  including color-policy edge cases and unchanged printer defaults. Production
  Polaroid proofs used the formerly misclassified Wondershare queue: all 15
  num216p photos in 8 PIC and 9 PIC, plus exact eight/nine selections, passed.
  Color, A4, simplex, orientation, all-photo coverage, blank final slots and
  byte-identical reviewed/print artwork passed. Original hashes stayed unchanged.
  Signed-out production print denial remained intact. An initial attempt against
  development output did not exercise that production gate; the complete final
  run used a production build and passed.
- Inspected native Color / 8 PIC / 9 PIC captures at 1366×768 and 1920×1080 in
  English dark, French light and Arabic RTL light, plus the four full-sheet
  proof contact images. Additional captures cover 1600×900 and 820×640.
  Existing UI geometry, command placement and styles are unchanged. ID printer
  round trips passed in English/French/Arabic, including low-end mode and keyboard
  crop edits, with the corrected device list. Typecheck, Fast Print/printing unit
  checks, native compilation and production/development builds passed. Restored
  development output and updated the local native helper. No hardware jobs were
  sent. Live keyboard/high-DPI checks and physical finishing remain pending.
- Local fix only; not yet published to subscribers or installed on the workshop PC.

Artifacts: `output/color-detection.json`, `output/color-workshop-verification.json`, `output/color-id-workflow`,
`output/color-polaroid-final`, `output/color-{types,unit,print}.log`,
`output/color-{production,development}-build.log`.

## 2026-10-21 — Switch and remember printers in ID verification

- Added a labeled Printer selector using existing control tokens. Changing it
  retains source choices, crop corners, horizontal flips, shared card size,
  repeat count, margins and spacing. Color/duplex controls follow the selected
  device. The header and actual print manifest use that same printer.
- Hidden workflows passed in English dark, French light and Arabic RTL
  dark/low-end. Switched between installed Microsoft PDF and a PDF driver then
  reported as monochrome, checked independent driver snapshots, preserved native sheet copies,
  returned twice through printer settings and restored the choice in a fresh
  native window. Unknown-printer rejection retained the selected device and
  missing-profile validation retained ID edits. Final ValidateOnly output used
  the changed printer, A3, six IDs per side, five sheet copies and grayscale.
- Captured 1366×768, 1920×1080 and 1600×900 without horizontal overflow; inspected
  representative English/French/Arabic captures. Keyboard crop changes survived.
  One primary Print, shared header/actions, existing labels and control styles
  remain in place; no additional subtitles or duplicate commands were added.
- All eight ID TEST originals and their rotations/off-center variants passed
  88 cases with unchanged original hashes. Inspected the print-proof contact
  sheet and final A3 sheet; 90 mm widths and matching front/back centers passed.
  Typecheck, Fast Print unit checks, development build and native compile passed.
- Last-printer data is saved atomically, separately from explicit app settings
  and Windows defaults. Restart persistence and invalid-data fallback were
  checked locally. The development helper was updated without desktop control.
  No hardware jobs were sent. Physical printer switching, duplex/finishing and
  live high-DPI checks remain pending. Changes are local and unpublished.

Artifacts: `output/id-printer-workflow`, `output/id-printer-real`,
`output/id-printer-{types,unit,build,workflow,real}.log` and the final English
round-trip check in `output/id-printer-final` / `output/id-printer-final.log`.

## 2026-10-21 — ID defaults: Compact, 10 mm margins and gap

- New reviews now select Compact with 10 mm margins and a 10 mm cutting gap.
  Existing reviews retain saved settings. The editor workflow asserts the actual
  default controls before exercising saved overrides and printer-setting returns.
- Typecheck, Fast Print unit checks and the development build passed. All eight
  ID TEST originals and their rotated/off-center variants passed 88 real-photo
  cases, including 90 mm width and matching front/back centers. Inspected the
  full-sheet proof and the contact sheet of all 88 color outputs; originals were
  unchanged and no hardware print jobs were sent.
- English dark, French light and Arabic RTL dark/low-end workflows passed,
  including keyboard corner adjustment and saved settings. Captured 1366×768,
  1600×900 and 1920×1080 layouts; inspected representative English/French/Arabic
  captures. Shared components, action placement and UI structure are unchanged.
  Physical workshop output and live high-DPI interaction remain pending.
- Local change only; not included in the already published v0.2.18 release.

Artifacts: `output/id-defaults-real`, `output/id-defaults-workflow` and
`output/id-defaults-{types,unit,build,real,workflow}.log`.

## 2026-10-21 — v0.2.18 published and verified

- Stable tag `v0.2.18` points to release commit `d4bfa07`. The tagged
  [Windows release workflow](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/39555430966)
  completed successfully, including release checks, native builds, packaging,
  upload, checksum publication and final release publication.
- [v0.2.18](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/releases/tag/v0.2.18)
  is public, not a draft or prerelease, and is the repository's latest stable
  release. Setup, Portable, Setup blockmap, `latest.yml` and the SHA-256 checksum
  manifest are present with nonzero sizes.
- Downloaded the 224,322,244-byte Setup installer, updater metadata, blockmap and
  checksum manifest. Windows reports installer ProductVersion/FileVersion
  `0.2.18`. Its computed SHA-512 matches both updater entries and the declared
  byte size. Downloaded files match the SHA-256 manifest; all four package/update
  assets, including Portable, also match GitHub's published SHA-256 digests.
  Portable presence/digest was checked through the API rather than downloading
  a second complete executable.
- Local development output was restored after production release checks. No
  saved artwork, projects, printer settings or user desktop windows were changed.
  Physical workshop installation/output and vendor finishing remain pending.

Artifacts: `output/release-0.2.18-published/verification.json`,
`installer-version.json`, downloaded updater files and installer;
`output/release-0.2.18-check.log` and `output/release-0.2.18-polaroid/results.json`.

## 2026-10-21 — v0.2.18 release validation

- Version 0.2.18 is the stable release candidate for the completed Fast Print,
  ID-review and Polaroid reliability changes documented below.
- Full `npm run release:check` passed: repository formatting, both TypeScript
  projects, all automated test suites, Storybook production build and Electron
  production build. The final native helper compiled successfully to a separate
  verification executable without closing the user's open Fast Print windows.
- The final production-build Polaroid check used every one of the fifteen
  num216p originals in both modes. Preview and print artwork matched exactly,
  print reused reviewed sheets, preparation did not capture vendor settings,
  signed-out production printing remained blocked and original hashes stayed
  unchanged. Earlier 37-photo, exact-eight/exact-nine and single-core checks are
  retained in the corresponding reliability artifacts.
- General A4/A3 preview-to-print proofs, printer-state audits, the ID real-photo
  corpus and horizontal matched-size round trips passed before versioning.
  No hardware print jobs or interactive desktop control were used.
- Physical workshop output and vendor finishing, live high-DPI/high-contrast
  interaction and installer operation on the workshop PC remain pending.
  Subscriber publication is verified separately after the tagged workflow.

Artifacts: `output/release-0.2.18-check.log`,
`output/release-0.2.18-polaroid/results.json` and the proof paths recorded below.

## 2026-10-20 — General Fast Print presets (unreleased)

- Scope corrected to the general 1/2/4/6/8/9/12/16-up layouts. Every slot in a
  preset has the same dimensions, including incomplete final sheets. A 5 mm
  default outer margin and 3 mm gap replace printing to the edge. Options offers
  5/7/10/15/20 mm margins and 3/5/8/10 mm gaps. Partial sheets/rows are centered
  while retaining the preset's slot size.
- Rotate selected applies a quarter turn to the selected file; PDF/Word use the
  same turn for all pages of that file. Options > Rotate all applies one rotation
  to the entire batch and retains it through preset changes. Source indices,
  camera orientation and PDF page rotation are handled consistently in the native
  preview and renderer. Status shows slot dimensions and the selected rotation.
- Photo-only selections start with Fit to frame enabled for equal filled frames.
  Whole-image/page fitting remains available. PDF/Word and mixed selections start
  with full-page fit; cropping happens only when that checkbox is enabled.
  Original files are unchanged; Windows printer defaults are not overwritten.
- Shared validation checks integer margins/gaps and bounded quarter-turn arrays.
  Geometry tests cover all counts, A4/A3, every partial-sheet count, centered
  groups, minimum margins/gaps and matching cell dimensions. Native and renderer
  use equivalent cell positioning, with the same image/PDF rotations and clips.
- Hidden integration verified all eight layouts on both A4/A3 using seventeen
  alternating portrait/landscape images and a five-page mixed-orientation PDF.
  Sixteen actual driver ValidateOnly jobs matched native previews for first/final
  image and PDF sheets: 64 raster comparisons, with no ink outside their planned
  slots, margins or gaps. PDF document boundaries and final blank areas passed.
  Native checks repeated in English/dark, French/light and Arabic RTL/dark,
  including individual rotation. The final helper additionally verifies global
  rotation survives preset changes. No hardware print jobs were sent.
- Inspected native snapshots at 1366x768, 1920x1080, 1600x900 and the 820x640
  minimum, using existing native controls and shared tokens. Rotate selected fits
  with Copies, Fit to frame and Options; Print remains the primary action.
  Standard native keyboard behavior and existing shared controls are retained.
  The headless system caption is not proof of live DWM title-bar appearance.
- The existing English/French/Arabic audit passed printer races, changed-source
  invalidation, preset guards, navigation, scrolled tiles, copy preservation,
  grayscale output and unchanged defaults. Fast Print unit, print API/preferences,
  typecheck, native compilation and development renderer builds passed.
- ID work is otherwise stopped. Its horizontal-only rule is enforced with a
  180-degree flip; prior optional quarter-turn sheet settings cannot make an ID
  portrait. All eight real ID sources and their rotated/off-center/background
  variants passed again, plus a hidden settings round trip and matched-size A3
  driver validation. This supersedes the previous ID-only 90-degree entry below.
- Pending: physical workshop output, actual vendor tray/duplex finishing,
  high-DPI/high-contrast and live OS focus/menu checks, low-memory workshop
  measurements and subscriber publishing. No interactive main-PC control was used.

Artifacts: `output/fast-print-general-presets`,
`output/fast-print-general-presets-final`, `output/fast-print-audit`,
`output/fast-print-id-horizontal-policy`, and `output/general-presets-*.log`.

## 2026-10-20 — Matched ID sizes, sheet presets and rotation (unreleased)

- The user clarified “same side” as **same size**. Both sides now share one
  explicit 90 x 55/56/60 mm card preset, defaulting to 90 x 56 mm. Projective
  correction maps the selected corners into that rectangle, retaining the whole
  selected card. This supersedes the earlier proportional-height behavior.
  Source corners now determine straightening, replacing the manual-angle field.
- Each sheet preview has one Rotate 90-degree command for that side. It changes
  sheet orientation independently of the source crop and the other side. This
  supersedes the earlier 180-only command according to the latest request.
  The selected physical size is retained; a deliberate quarter turn swaps its
  displayed dimensions. A shared maximum slot width/height preserves duplex
  centers even when only one side is turned.
- Sheet presets expose common 1/2/4/6/8 counts and Fill sheet; other supported
  counts remain available in the same selector. Fill adapts to paper, size,
  margins and rotations. Even spacing uses the page symmetrically to the selected
  margins; Compact centers a group. Margins have a 5 mm minimum and cutting gaps
  a 3 mm minimum. Fixed overfull counts block output without changing card size.
- Layout checks cover all size presets, A4/A3 portrait/landscape, every paired
  quarter-turn combination, capacity, incomplete rows, safe gaps/margins and
  mirrored duplex centers. Projective corner mapping and bilinear pixel sampling
  have independent geometry/gradient checks. Draft tests preserve size, spacing,
  margins, fill mode and independent turns and reject invalid values.
- All eight ID TEST originals and rotated/off-center plus/minus 45-degree,
  textured/pale-background and legacy-review variants passed: 88 cases and 200
  raster proofs. Additional original-photo proofs include all three size presets,
  90/180/270-degree rotations, back mirroring and the real eight-up Fill sheet
  layout. Together the two runs contain 248 300 dpi proofs and 1,024 card
  placements, with independently measured width AND height, centers, color/mono
  and zero ink outside planned slots. Original source hashes are unchanged.
- Inspected the complete rectified-card proof grid and all eight full eight-up
  sheets. Native/main/editor checks passed two printer-settings round trips,
  source imports, keyboard corners, independent 90-degree rotation, saved presets,
  Fill responding to margins, invalid-preset recovery and overfull-count blocking.
  Final A3 grayscale output has matching 90 x 60 mm fronts/backs, six IDs per side
  and five sheet copies through ValidateOnly, without hardware printing.
- Captured and inspected English/dark, French/light and Arabic RTL/low-end layouts
  at 1366x768, 1920x1080 and 1600x900. Shared buttons/tokens/header remain in use;
  sheet rotation has one home per preview and Print remains the primary action.
  RTL dimension text stays left-to-right. Hidden capture checks compare multiple
  source pixels after image/font decoding to reject stale compositor frames.
- Typecheck, development build, Fast Print/draft/geometry and i18n checks passed.
  No interactive main-PC control was used. Physical workshop duplex/feed, high
  DPI/high contrast and live OS focus/dropdown/Tab checks remain pending. These
  changes are local and have not been published to subscribers.

Artifacts: `output/fast-print-id-copies-4`,
`output/fast-print-id-presets-originals`, `output/fast-print-id-workflow`,
`output/id-detection-audit/matched-size-all-proofs.png`,
`output/id-detection-audit/matched-fill8-grid.png`, and `output/id-presets-*.log`.

## 2026-10-20 — Keep both ID sides horizontal (unreleased)

- Corrects the quarter-turn behavior visible in the earlier validation pictures.
  Rotate is now **Rotate 180°**, using the shared button and translated labels.
  A flip preserves physical dimensions. Front and back share landscape card
  placement at 90 mm width, independent of A4/A3 paper orientation. Height remains
  proportional; repeat capacity, previews and final output use the same rule.
- Older portrait/quarter-turn review states keep their card outline while being
  mapped to horizontal. Only migrated reviews recheck upright direction with
  the local header/text reader; existing horizontal reviews retain their exact
  angles and corners without reanalysis. Manual angles cannot produce portrait
  output. Unit checks cover legacy quarter turns, 180-degree flips, A4/A3 in both
  orientations and exact preservation of existing manual edits.
- All eight original ID TEST photos, off-center plus/minus 45-degree placements,
  camera rotations and textured/pale backgrounds passed the 72-case single-card
  proof run. Four-up regression also includes clockwise and counterclockwise
  quarter-turn saved reviews for every photo, checking upright orientation,
  horizontal 90 mm cards, crop coverage, physical centers and unchanged originals.
- Hidden native/editor checks passed English/dark, French/light and Arabic
  RTL/low-end at 1366x768, 1920x1080 and 1600x900. Two flips retain both preview
  dimensions; a six-ID A3 job validates horizontal front and back, matching
  centers and five sheet copies. Captured previews were inspected with both
  sides horizontal. A final built-renderer round trip also passed after the
  legacy-orientation migration was added.
- Typecheck, development build, Fast Print geometry/drafts and i18n checks passed.
  Shared controls, primary Print action and keyboard corner editing are retained.
  No desktop input or hardware printing was used. Workshop hardware, physical
  duplex/feed, high DPI/high contrast and live OS dropdown/focus checks remain
  pending. Changes are local and unpublished.

Artifacts: `output/fast-print-id`, `output/fast-print-id-copies-4`,
`output/fast-print-id-workflow`, `output/fast-print-id-workflow-horizontal-final`,
`output/id-horizontal-*.log`.

## 2026-10-20 — Polaroid preparation responsiveness (unreleased)

- Found two source-level problems that could explain a long wait on workshop
  hardware: composing a preview captured vendor printer settings synchronously,
  and Print repeated the entire face-analysis/composition pass. The reported
  AccurioPress failure has not been reproduced on its actual driver/hardware.
- Polaroid previews now compose without a vendor driver snapshot. The existing
  loading surface and status show per-photo progress; Print stays disabled until
  the complete batch is ready. Closing prevents queued preparation workers from
  starting. A4, color, simplex, orientation and driver validation still apply to
  the actual print handoff.
- Print reuses the reviewed full-resolution sheets. The handoff validates source
  identity/size/modification time, mode, complete pagination, safe sequential sheet
  names and the 300 DPI A4 dimensions. Header checks read only 24 bytes per sheet.
  Account authorization still gates printing; signed-out preview remains allowed.
- Both modes passed with every original in num937p (37 photos, five sheets each)
  and num216p (15 photos, two sheets each), plus 8/9-photo boundary cases. Checked
  all original/photo proof contact sheets, rotations and protected face framing,
  intentional sideways groups, final blank slots, unchanged original hashes and
  byte-for-byte equality between reviewed and print-validation artwork.
- A separate num937p run restricted the native preparation process and its child
  worker to one CPU core: both modes passed, with 74 progress events per mode and
  zero preview driver snapshots. This is a local constrained-CPU check, not a
  measurement of workshop memory pressure or its AccurioPress driver.
- Inspected loading/ready native snapshots at 1366×768 and 1920×1080, English dark,
  French light and Arabic RTL. Additional snapshots cover 1600×900 and 820×640.
  Hidden native paint checks passed in all three languages and both themes,
  including retained busy previews and no GDI growth. Existing native controls,
  design tokens, action placement and primary Print action are reused; no new
  heading subtitles, duplicate actions or button styles were added.
- Typecheck, production/native builds, formatting for changed supported files,
  Fast Print/cache/print-preference regressions, i18n and appearance checks passed.
  The native audit also passed in English, French and Arabic, covering edited
  sources, printer-selection races, invalid profiles, navigation and copy handoff.
  No hardware jobs or desktop input were sent. Local newly opened Fast Print
  windows use the rebuilt helper; already-open windows were preserved.
- Pending: interactive keyboard/focus check, actual low-memory workshop behavior,
  AccurioPress driver/tray/physical-output validation and subscriber publication.

Artifacts: `output/polaroid-num937p-reliability/`,
`output/polaroid-num216p-reliability/`,
`output/polaroid-num937p-single-core/results.json`, and
`output/fast-print-paint/results.json`.

## 2026-10-20 — ID boundaries and upside-down detection (unreleased)

- Tested every one of the eight pictures currently in `C:\Users\Maher\Downloads\ID TEST`.
  Each has its original, 90/180/270-degree camera rotations, off-center plus/minus
  45-degree placements, busy fabric, pale handwritten paper and vertical-phone
  variants: 72 cases. Independent marked edges are in decoded/EXIF coordinates;
  source hashes confirm all originals stayed unchanged.
- Complete color-edge/card proposals and header anchors avoid portrait-only and
  text-only selections. Opposite-direction scanning protects faint outer edges
  from rotation-dependent peak ties. Uniform backgrounds retain the existing
  fast path. Median geometry detection was about 128 ms on this PC in the local
  geometry run; this excludes decoding, OCR and printing.
- Header evidence corrects 180-degree flips quickly. A lazy bundled Arabic/English
  worker handles header-free cards, with a bounded faded-text retry. Only letter
  confidence determines text orientation; numbers cannot vote. Ambiguous evidence
  shows a translated Rotate reminder. Original artwork is never contrast-filtered.
  Saved drafts preserve orientation status and manual edits without reanalysis.
- All 72 cases passed automatic orientation, independent crop coverage and
  color/grayscale 300 dpi proofs for both one and four IDs per sheet: 288 sheets
  and 720 individual printed card placements. All cards retain 90 mm layout
  width, proportional height, expected centers and zero ink outside planned slots.
  Inspected the complete upright proof grid and all eight four-up original proofs.
- The actual hidden native/main/editor workflow passed two settings round trips,
  added artwork, keyboard corner edits, invalid-preset recovery and overfull-sheet
  blocking, followed by A3 grayscale validation with six IDs per side and five
  sheet copies. The bundled file renderer also verified automatic orientation of
  the header-free barcode photo with its offline recognition assets and CSP.
- English/dark, French/light and Arabic RTL/low-end layouts checked at 1366x768,
  1920x1080 and 1600x900. The editor now explicitly uses the shared foreground
  token, fixing unreadable inherited dark text. Capture checks wait for decoded
  images/fonts and completed animation frames so resized hidden windows cannot
  reuse a stale compositor frame; the final capture also checks a source pixel
  against its displayed position. Shared controls and a single Print action stay
  in place; no explanatory headings or duplicate source commands were added.
- Typecheck, development build, Fast Print/draft/geometry, print/preferences and
  i18n checks passed. No desktop input or hardware print jobs were sent. Physical
  duplex/feed verification, high DPI/high contrast, live OS focus/dropdown/Tab
  checks and the offline workshop's additional pictures remain pending. This is
  a local development update, not a subscriber release.

Artifacts: `output/fast-print-id`, `output/fast-print-id-copies-4`,
`output/fast-print-id-workflow`, `output/fast-print-id-workflow-ocr`,
`output/id-detection-audit/final-proof-grid.png` and
`output/id-detection-audit/four-per-sheet-grid.png`.

## 2026-10-20 — Multiple IDs on one sheet (unreleased)

- Added **IDs per sheet** to the existing ID editor settings. Counts run from 1
  to 24, with unavailable choices disabled according to actual A4/A3, orientation
  and crop dimensions. Cards stay 90 mm wide, with proportional height and 5 mm
  gaps. A paper/crop change that makes the chosen count invalid reports an error
  and disables Print; it does not scale the cards down.
- Front and back share the taller side's cell height and matching physical
  centers. Back positions mirror for the existing long-edge duplex workflow
  ([Windows DEVMODE duplex definitions](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-devmodew)).
  Incomplete rows are centered; unused areas remain white. Counts persist in the
  validated ID review draft. Native sheet copies remain a separate setting.
- Geometry checks cover every fitting count in A4/A3 portrait/landscape, margins,
  non-overlap, cutting gaps, back alignment and rejection of overfull sheets.
  Draft checks include count preservation and invalid-count rejection.
- Real-photo proofs passed for four and five IDs per side using all twelve local
  original, off-center/rotated, patterned and pale-paper cases in color and
  grayscale. All 216 individual card copies in those 48 sheets retained the
  expected physical width/center, with no ink outside their planned slots.
  Single-card output also passed again; original source hashes were unchanged.
- The hidden native/editor workflow preserves two IDs per sheet through the
  first return and six through the second, then validates an A3/five-sheet-copy
  grayscale job with six correctly placed IDs on each side. An overfull choice
  disables Print and recovers when changed back to six. English/dark,
  French/light and Arabic RTL/low-end layouts are checked at 1366×768,
  1920×1080 and 1600×900. No desktop input or hardware print jobs were sent.
- Typecheck, development build, Fast Print/draft geometry, print and i18n checks
  passed. Physical duplex/feed alignment and the unavailable workshop screenshots
  remain pending. This change has not been published.

Artifacts: `output/fast-print-id-copies-4`, `output/fast-print-id-copies-5`,
`output/fast-print-id-workflow`, and `output/id-copies-*` check logs.

## 2026-10-20 — Workshop ID report corrections (unreleased)

- Read the workshop chat **Fix ID card processing issues** and its inspection
  report. The installed workshop app was v0.2.17. Screenshots showed whole-photo
  fallback crops, sideways cards and excessive retained background. Missing printer
  selection and lost work on the editor's Back arrow matched the implementation.
- The editor now returns through **Printer settings** to the native dialog,
  preserving both sides, corner edits, quarter turns, manual angles, active side
  and imported artwork. Native printer/paper/copies changes apply on re-entry.
  A saved review also survives rejected printer validation. The native parent owns
  the session until closed; the child worker no longer deletes it on ID errors.
- Review metadata is validated and written atomically after its PNG sources.
  Identical artwork is cached once across repeated reviews. Invalid side/source
  references, crossed corners, oversized images, escaped cache paths and changed
  original inputs are rejected without replacing a prior valid review.
- Sideways card setup rotates the source before editing. Crop detection first
  preserves the proven uniform-background path, then tries multiple color
  contrasts with narrow-pattern removal. Uncertain detection retains the full
  image with an actionable corner prompt. The stage height adapts to the viewport.
  Existing shared ToolHeader, PrintButton, buttons, tokens and translations remain
  in use, with one printer-settings command and one primary Print action.
- Local ID proof checks passed for both originals plus off-center ±45°, busy
  fabric, pale handwritten-paper and vertical-phone variants: twelve cases and
  twenty-four color/grayscale proofs. Every source hash was unchanged; 90 mm
  width, proportional height, card coverage and matching physical centers passed.
- The real main/native workflow passed in English/dark, French/light and Arabic
  RTL/low-end modes. Each case made two settings round trips with keyboard corner
  edits and an added image, rejected a missing preset while retaining work, then
  generated two A3 grayscale sheets with five copies through ValidateOnly. No
  hardware jobs were sent. Draft persistence/validation, Fast Print, print,
  appearance, i18n, formatting, typecheck, native compilation and development
  build checks passed.
- Inspected hidden renderer layouts at 1366×768, 1920×1080 and 1600×900 in both
  themes and Arabic RTL; corner keyboard edits and absence of horizontal overflow
  were exercised. Vertical page scrolling is retained at shorter heights. Live
  Windows focus/dropdown/Tab interaction, high DPI/high contrast and physical
  workshop printing remain pending.
- The workshop disconnected before its ten additional ID photos and two
  screenshots could be copied. The user chose to continue with local tests.
  Those exact workshop images remain unvalidated; no source was developed on the
  workshop PC, no originals/settings were changed and no subscriber release was
  published for this correction. Reopen the main PC's Fast Print to load it.

Artifacts: `output/fast-print-id/results.json`, crop/proof PNGs;
`output/fast-print-id-workflow/results.json`, hidden layouts, saved review state,
missing-preset logs and A3 print proofs. `output/id-workshop-*` contains check logs.

## 2026-10-20 — Fast Print audit for v0.2.17

- Printer settings are generation-checked, with dependent controls and Print
  disabled until the active queue is ready. Controlled asynchronous response
  tests cover late successes/errors and rapid printer changes. Explicit copies
  survive queue changes; incompatible Polaroid driver properties retain A4/color.
- PDF previews use temporary snapshots rather than locking originals. Source
  metadata invalidates PDF/image conversions and previews. Edited PDF/BMP/PNG
  fixtures refresh correctly; Print detects changed inputs and requires review.
  Missing/empty inputs and invalid profiles cannot re-enable Print on failure.
- File selection follows sheet navigation, including document pages within
  Polaroid batches. Converted inputs keep their original names; literal ampersands
  remain visible. Active-layout selection can refresh edited inputs. Layout tile
  navigation accounts for scrolling without changing the selected print settings.
- Microsoft Print to PDF/XPS grayscale fallback preserves requested output color
  intent when their driver reports color. Hardware queues still require matching
  driver color settings. Native/worker grayscale proofs match the same luminance
  conversion; all generated grayscale pixels and updated-source pixels passed.
- The hidden audit passed in English/dark, French/light and Arabic RTL/light:
  three-sheet/seven-copy requests, source edits, printer races and validation.
  Hidden DOCX/image proofs retained both Word pages and matched prepared/printed
  Polaroid artwork in both modes. All originals were unchanged.
- Repaint regression passed 960 frames across both themes and three languages:
  no legacy corner pixels, outstanding invalid regions, GDI growth or blank
  preview replacements. ID real-photo checks passed all six original and
  off-center/rotated cases, with 90 mm width, proportional height and aligned
  front/back centers in color and grayscale. No hardware jobs were submitted.
- Full `release:check` passed (format, typecheck, all behavior suites, Storybook
  and production build), followed by native shell/dialog compilation and Windows
  packaging. The production Polaroid regression passed all six real-photo cases,
  including signed-out Print denial and previews without an account override.
  The packaged v0.2.17 executable/helper also prepared both fifteen-photo modes
  headlessly, matching production sheet artwork byte-for-byte without an access
  override. Inspected the generated photo/ID proofs and themed/RTL native renders.
- Published stable v0.2.17 from commit `6da402d`; release workflow
  [39381315432](https://github.com/Maher-tka/My-Printer-App-by-Maher-Tka/actions/runs/39381315432)
  succeeded. GitHub's latest stable release includes Setup, Portable, blockmap,
  `latest.yml` and SHA256 checksums. The downloaded 224,265,101-byte Setup matches
  the update manifest's SHA512 and size; Setup, blockmap and metadata SHA256 values
  match the published checksums. The local Explorer worker was restored to the
  configured development build and passed both fifteen-photo mode proofs again.
- Live desktop input was not used. Live dropdown/focus/keyboard interaction,
  desktop flicker video, high DPI/high contrast, actual scrolled keyboard behavior,
  low-memory workshop performance and physical output remain pending. Offscreen
  layouts are checked at 1366×768, 1920×1080, 1600×900 and 820×640; a headless check
  cannot establish every interactive or hardware acceptance criterion.

Artifacts: `output/fast-print-audit`, `output/fast-print-docx-audit`,
`output/fast-print-paint`, `output/fast-print-id` and the production-build Polaroid
regression under `output/fast-print-polaroid-native`. Release/package logs and
packaged preview checks are under `output/release-0.2.17`.

## 2026-10-20 — Native Fast Print flicker and legacy-edge correction

- Removed the double-paint path that drew the standard combo face/frame and then
  overlaid a rounded skin. Combo faces now own their full client area and render
  once into a buffer using paired BeginPaint/EndPaint. Background erase and native
  non-client painting no longer expose a second rectangular layer.
- Buttons and layout tiles use the same complete-frame rendering for normal paint
  and offscreen rendering. Opaque backgrounds are filled without antialiasing
  before drawing rounded edges; this fixes the leftover edge pixels caught by the
  new corner checks. Tiles draw their content once and invalidate only the old/new
  selection. Options-menu rendering uses the shared palette and buffered surface.
- Table/flow containers are buffered. Preview painting no longer changes BackColor
  while painting. An in-progress Polaroid replacement retains the existing sheet
  behind a static loading overlay; stale errors cannot overwrite a newer request.
- `test:fast-print:paint` passed against the installed local helper: 960 explicit
  repaint cycles across English/French/Arabic and light/dark themes, zero remaining
  invalid regions, zero GDI-resource growth, zero legacy corner pixels in enabled
  and disabled controls, two tile invalidations per selection and no blank preview
  replacements. Inspected hidden-form renders at 1366×768, 1920×1080, 1600×900 and
  820×640; sharp underlay edges are absent and fields/footer remain readable.
- Repeated both Polaroid modes through the actual local Explorer worker arguments
  with all fifteen real photos and no account-mode override. Each produced two
  sheets, with preview/print artwork matching byte-for-byte and zero blank-sheet
  replacements. Existing source artwork/framing/output geometry is unchanged.
- Native compilation, typecheck, Fast Print, print/preferences, appearance, i18n
  and changed-file formatting passed. The tested helper replaced FastPrint.exe
  without closing the user's windows; reopen Fast Print to load it. The main worker
  retains the configured non-packaged development build, preserving the preceding
  access correction. No release was published.
- No desktop input or hardware print jobs were sent. Live desktop flicker, actual
  dropdown/focus interaction, high DPI/high contrast and low-memory workshop checks
  remain pending; the checked images are offscreen renders, not captured desktop
  video. Physical shop printer validation remains pending.

Artifacts: `output/fast-print-paint/results.json`, themed/RTL dialog and control
renders; `output/fast-print-local-worker/checks.json`, matching Polaroid proofs
and `result.json` (`blankPreviewReplacements: 0`).

## 2026-10-20 — Polaroid preview access-gate regression

- The user's follow-up screenshot exposed a missed environment: preview preparation
  returned `[fast-print] Request access`. The earlier checks used `local-test`,
  masking production access checks in both command startup and renderer submit.
- Preview-only sheet composition now skips both print authorization checks and
  retains its early return before the Windows print script. Actual Print still
  checks access at startup and immediately before submission. No accounts, grants,
  saved sessions or subscriber permissions were changed.
- The headless Polaroid regression now launches native preview workers without an
  account-mode override. A separate isolated signed-out production worker must
  reject Print before a job is created. Explicit offline mode is limited to the
  generated artwork/driver proofs. This distinguishes preview behavior from actual
  print authorization instead of claiming test-mode success covers both.
- Production-build checks passed for both modes with all fifteen originals and
  exact eight/nine-photo selections. Preview and generated print artwork matched;
  the isolated signed-out Print was denied before a job was created. Original
  hashes, rotations, face-safe crops, pagination and white final slots passed.
- The local worker was then built with the project's configured development mode,
  preserving `.env.development`'s non-packaged unlock preference. Its actual
  Explorer executable/argument path passed both fifteen-photo native previews and
  ValidateOnly print proofs without `PRINTER_ACCOUNT_MODE` overrides. Both produced
  two matching sheets. Subscriber builds retain the existing packaged-access guard.
- Typecheck, production/development builds, Fast Print, print/preferences, access
  enforcement checks and changed-file formatting passed. Detailed results:
  `output/fast-print-polaroid-native/results.json` and
  `output/fast-print-local-worker/checks.json`.
- No desktop/browser control or hardware printing was used. Physical printer
  output remains pending; no new layout or framing algorithm was introduced.

## 2026-10-20 — Polaroid native preview correction

- Fixed the gap identified in the user's screenshot: 8 PIC/9 PIC now compose the
  entire selection into actual Polaroid sheets instead of previewing one source
  photo. Eight/nine photos fit one A4 sheet; overflow continues onto further sheets.
  Next/Previous navigates sheets; file selection locates its containing sheet.
- A hidden preparation worker uses the production compositor, including smart
  rotations, protected faces, frames and cut lines. This preview path returns
  before the Windows print script; only explicit Print can submit a print job.
  A4/color and single-sided output stay automatic. Busy preparation disables Print;
  errors remain visible, and stale results cannot replace another selected mode.
- Prepared output is cached by mode and source metadata. Four bounded sheet
  thumbnails support navigation without reopening full-resolution artwork.
  Source changes invalidate previews. Closing the dialog cleans its owned cache.
- The new headless regression used all fifteen num216p originals and selections
  of exactly eight and nine photos in both modes. All six combinations passed:
  one-sheet output where appropriate, two-sheet overflow, every photo in order,
  expected rotations/crops, protected detected faces and white final slots.
- Preview preparation PNGs matched the actual production print artwork
  byte-for-byte. Native displayed previews matched downsampled print proofs.
  A4/color/landscape-or-portrait/simplex driver settings passed ValidateOnly.
  The original source hashes were unchanged; no hardware jobs were submitted.
- Inspected generated proofs and hidden-form renders at 1366×768, 1920×1080,
  1600×900 and 820×640, with English/dark, French/light and Arabic RTL/light cases.
  The sheet preview and pagination show the composed batch. These are offscreen
  self-test renders, not a new desktop automation session. Actual interactive
  focus/keyboard, high DPI/high contrast and low-memory workshop checks are pending.
- Typecheck/build, native compilation, Fast Print, print/preferences, i18n,
  appearance and driver-profile checks passed. Mixed PDF/image batch rendering
  and unsupported-input rejection passed headlessly. ID originals and ±45° cases
  again passed 90 mm/proportional/centered color/mono proof checks.
- No desktop/browser control was used. The user's requirement to ask before
  necessary interactive main-PC control is recorded in AGENTS.md. Existing open
  windows are left alone; reopen Fast Print to load the replaced native helper.
  Physical shop printer validation and a subscriber release remain pending.

Artifacts: `output/fast-print-polaroid-native/results.json`, per-case
`sheet-*.png`, `preview-*.png`, `worker/driver-settings.json`, `proof-check.json`
and hidden-form layout renders. Repeat with
`npm run test:fast-print:polaroid-native`. Changes are local and unpublished.

## 2026-10-20 — Fast Print performance, layouts and native appearance

- The new native dialog remains separate from the app. Its buttons, layout tiles,
  fields and preview surfaces consume the shared app tokens, with light/dark/system
  appearance and a Windows 10/11 manifest. Native controls retain accessible names;
  layout tiles expose radio/checked semantics and arrow-key selection. Polaroid
  stays directly below the printer. One primary Print/Review ID action remains.
- Added shared A4/A3 grids for 1/2/4/6/8/9/12/16-up; native preview and print worker
  consume the same layout definitions. Consecutive photos fill sheets together;
  PDF/Word boundaries remain separate. Existing per-option driver assignments
  include the expanded counts, without changing Windows printer defaults.
- Initial source decoding runs alongside printer discovery. Driver capabilities
  and bounded page images are cached; stale preview requests are discarded. The
  six-million-pixel page cache caps retained artwork at approximately 24 MB.
- Main-PC PDF runs measured 0.25–0.49 s to first paint, 0.54–0.79 s to source
  preview and 57–90 ms for warm preview changes. Driver-ready full layout previews
  took 2.36–2.79 s; the two-page DOCX conversion took 9.75 s. These are local
  measurements, not Windows-dialog parity or workshop performance guarantees.
- Inspected generated light/dark, French and Arabic RTL snapshots at 1366×768,
  1920×1080, 1600×900 and the 820×640 minimum. The layout panel scrolls at smaller
  sizes; footer actions, fields, long French labels and artwork stay visible.
  Native rendering has no animated web effects or app low-end-mode dependency.
- Real Explorer test selected PDF, PNG and DOCX together and invoked Show more
  options > Fast Print. One native window opened with all three files, not the old
  nested printer list. Process inspection confirmed Explorer directly launched
  FastPrint.exe through the batch manifest; no Print action was invoked.
- All sixteen A4/A3 worker cases passed using a nineteen-page mixed-orientation
  PDF, with matching native first-sheet previews, expected landscape orientation,
  pagination and copies. Independent pixel checks confirmed first/final sheet
  order and white trailing cells. Thirteen uniquely colored photos retained order
  across four four-up sheets; image/PDF/image groups produced six sheets.
- Two-page DOCX conversion through the local LibreOffice runtime passed formatting,
  pagination, source hashes and three-copy driver handoff. Native request/parser,
  saved-profile precedence, unchanged defaults and session cleanup checks passed.
- Repeated all original ID TEST photos plus off-center ±45° cases: 90 mm width,
  proportional height and centered color/mono proofs passed. Both Polaroid modes
  again included all fifteen num216p photos on two sheets, with intentional group
  rotations, protected faces and white final slots. Inspected proofs; originals
  and saved settings are unchanged. No hardware jobs were submitted.
- Typecheck, production build, native compilation, Fast Print, print/preferences,
  i18n, native shell selection (122 files), driver-profile tests and changed-file
  formatting passed. Final native executable was replaced without closing the
  user's already-open preview; reopen Fast Print to load the newest styling.
- User stopped Computer Use with Escape. No further desktop input was issued.
  The last non-client combo-border and RTL tile-order polish compiled, but its
  final on-screen recheck and interactive arrow/dropdown/focus checks remain
  pending. Also pending: OS high contrast/high DPI, low-memory workshop timing,
  actual Konica/Epson finishing and hardware output, Microsoft Word COM, and
  packaged installer/subscriber release. Changes remain local and unpublished.

Artifacts: `output/fast-print-native-verification/results.json`,
`grid-proof-check.json`, `grid-final-sheets.png`, per-case layout/UI/worker proofs,
`output/fast-print-modern/`, `output/fast-print-id/` and
`output/fast-print-num216p-menu/`.

## Stable 0.2.16 release preparation — 2026-10-19

- Full `npm run release:check` passed: repository formatting, TypeScript, all
  automated suites, Storybook production build, and app production build.
- Native Fast Print DLL compilation and Windows driver-profile regression tests
  passed, including encrypted full-buffer settings, printer/driver mismatch,
  atomic updates, unchanged printer defaults, and paper/copy preservation.
- Repeated the ID real-photo verifier with both originals, original placement,
  and off-center ±45° cases: six cases and twelve color/grayscale page proofs.
  Verified 90 mm target width, proportional height, matching sheet centers,
  crop coverage, grayscale output, and unchanged source hashes. Inspected the
  current crop/page proof review grid.
- Rebuilt an isolated development verification worker from the release source
  and repeated both actual Polaroid menu choices with all 15 original num216p
  photos. Each produced two A4/color sheets; all photos matched, detected faces
  stayed inside protected crops, final unused slots were white, and source
  hashes were unchanged. Inspected all four generated sheets against originals.
- Proofs and review grids are local under `output/fast-print-id/`,
  `output/fast-print-num216p-menu/`, and `output/release-verification/0.2.16/`.
  No hardware print jobs were sent. Physical Konica/Epson finishing, duplex/tray
  alignment, and workshop low-memory performance remain pending. The earlier
  browser matrix and its stated limits still apply.

## App reliability audit — 2026-10-18

See [the audit report](APP_AUDIT_2026-10-18.md) for the scoped fixes and evidence.
All 12 routes received browser smoke checks at 1366×768 and 1920×1080 across
light/dark, French, and Arabic RTL configurations, including low-end mode.
Representative import/clear/cancel/focus checks passed for all five production
tools across three configurations. Job save/edit/delete and simulated Hardcover
recovery failure/retry checks passed. Native IPC, real printer drivers, workshop
hardware, and physical low-end performance remain pending for this audit.
These checks do not mark unrelated historical entries complete or establish full
design-system compliance.

Future UI changes must follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), including its button hierarchy, action grouping, subtitle policy, and acceptance checklist. Record verification for each change; the historical entries below remain pending until actually checked.

This is a verification ledger. Pending means not yet verified; it is not a claim of success. Production logic is not being rewritten. Baseline is the existing working feature and existing automated coverage, not a newly invented feature.

| Module           | Existing features protected                                                                                                                                        | Before                                                        | After / validation                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------- |
| Shell            | Hash routes, paid tool access, Ctrl+K, import handoff, account menu, unsaved session checks                                                                        | Existing implementation inspected                             | Pending visual/keyboard QA                   |
| Dashboard        | Local recent projects, PDF/artwork import, jobs, real export history                                                                                               | Existing handlers inspected                                   | Pending QA                                   |
| Booklet          | PDF/images, reorder/blank/delete pages, sheet modes, custom paper/orientation, RTL/scale/creep, front/back, 3D preview, project save, preflight, PDF/JPG/PNG/print | Hook and UI boundaries inspected; existing test:booklet suite | Pending regression/visual QA                 |
| Hardcover        | Source import, dimensions/spine, design/text, batch, cover preview/mockup, quotes, preflight and export                                                            | Existing implementation and test:hardcover suite              | Pending regression/visual QA                 |
| QR               | Hardcover back-cover text/URL control                                                                                                                              | Present in BackCoverEditor; no standalone route               | Pending visual QA; no fake standalone module |
| Sticker/Cutter   | Library/import, artwork editor, print/cutline/marks visibility/locks, contours/background removal, transformations/duplicate                                       | Existing implementation and test:cutter/test:sticker suites   | Pending regression/visual QA                 |
| Big Sheet/Mimaki | Bounded large-sheet canvas, nesting/alignment, dimensions, registration/crop marks, layers, EPS/PDF/FineCut output                                                 | Existing cutter workflow and geometry/export tests            | Pending regression/visual QA                 |
| Sequential       | Design, ranges/prefix/suffix, number position, quantity, cut-stack and backs, save/print/PDF                                                                       | Existing implementation and test:sequential suite             | Pending regression/visual QA                 |
| Jobs             | Board/list/calendar, customer data, quotes/deposit, search, unsaved job switch prompt                                                                              | Existing test:jobs coverage                                   | Pending tests and QA                         |
| Settings         | Performance preset, backups/restoration, updates, license, diagnostics                                                                                             | Existing handlers inspected                                   | Pending visual QA                            |
| Dialogs          | Keyboard, focus, confirmation, preflight, import/export progress/cancel                                                                                            | Existing Radix/custom dialogs                                 | Pending QA                                   |

## Required desktop visual passes

| Pass                                      | Shell/Home | Booklet | Cutter/Mimaki | Hardcover/Sequential/Settings |
| ----------------------------------------- | ---------- | ------- | ------------- | ----------------------------- |
| 1: structure and surface hierarchy        | Pending    | Pending | Pending       | Pending                       |
| 2: density, contrast, alignment, overflow | Pending    | Pending | Pending       | Pending                       |
| 3: keyboard/focus and final sizes         | Pending    | Pending | Pending       | Pending                       |

Desktop targets: 1920×1080 and 1366×768. Also consider 1600×900. Inspect real scroll containers, enabled actions, print canvas visibility, readable labels, and output preview accuracy.

## Checks

- TypeScript and production build: pending.
- Automated production suites: pending.
- Formatting and diff whitespace: pending.
- Native printer hardware execution: requires connected printer; do not send an unsolicited print job.
- Performance: inspect computed no-blur/no-animation low-end styling; preserve render queues and memory bounds. No claim of hardware benchmarking without measurements.
- Figma editable system: in progress.
- Lovable: installed but connection returns USER_NOT_LOGGED_IN; no remote prototype replaces the app.

## Card Montage cutting rectangle — 2026-10-04

Scoped change: one optional 0.25 px rectangle checkbox in auto-mode Setup, an
independent color picker with black default/non-white fallback, and shared settings
tabs following the app's LTR/RTL direction. No duplicate outline control in Advanced.

- Checked empty state and a representative white-card PDF at 1366×768.
- Checked white-card controls at 1366×768 (English/light and Arabic/dark),
  1920×1080 (French/dark), and 1600×900 (Arabic/light).
- Arabic passes used low-end mode. Labels, color control, scrolling, paper preview,
  and page width were inspected; no horizontal page overflow was found.
- Keyboard Space toggles the checkbox; Tab reaches the enabled color picker.
  Pure white selections resolve to black; preview and export use matching color.
- New strings have French/Arabic translations. Hex values and artwork remain LTR.
- Reused existing Setup/Advanced tabs and shared tokens; checkbox has one home,
  introduces no primary command or explanatory subtitle, and exposes disabled state.
- Added `SettingsDirections` Storybook example for shared tabs with enabled and
  disabled controls in LTR/RTL.
- Card layout/PDF tests, TypeScript, production build, and Storybook build passed.
  Full-screen RTL visual checks for other shared-tab consumers (Booklet, Cutter,
  Hardcover, Sequential Number) remain pending; the Card screen and generic shared
  tab direction examples were verified.
- Native hardware printing and
  physical low-end PC performance benchmarks remain pending; no print job was sent.

Screenshots: `output/playwright/card-montage/outline-final-*.png` and
`outline-1366-empty.png`. This entry does not mark unrelated historical checks complete.

## Shared PDF/artboard selector — 2026-10-04

- Card Montage and Hardcover now use one shared selector: thumbnails, selected
  indication, Previous/Next, number jump, and incremental thumbnail loading.
- Verified independent front artboard 3/back artboard 4 selection on a four-artboard
  PDF-compatible AI fixture at 1366×768/light. Browser export contained exactly two
  A4 pages with designs 3 and 4, ten impressions per selected side.
- Verified Previous/Next and invalid number reset; preserved card dimensions and
  embedded font programs in regression tests.
- Verified ten-page PDF in Arabic/RTL, 1600×900/light, low-end mode: three initial
  thumbnails, direct jump to page 9, batch loading to seven thumbnails shared with
  back source, front selection 9/back selection 2 unchanged.
- Verified French/dark at 1920×1080 with keyboard Enter selecting thumbnail 3.
  No accidental horizontal page overflow in the inspected Card layouts.
- Verified Hardcover front selector chooses page 3 from four-page source in the
  browser; Hardcover import, calculations, source, export, and drop tests passed.
- Added enabled/progressive and disabled shared-selector Storybook examples.
  Production and Storybook builds passed.
- Full-screen Arabic/low-end Hardcover visual pass and physical hardware printing
  remain pending. Existing unrelated ledger entries retain their previous status.

Screenshots: `artboard-selector-1366-selected.png`, `selector-1920-dark-fr.png`,
`selector-1600-rtl-low-end.png`, and `hardcover-shared-selector.png` under
`output/playwright/card-montage/`.

## Hardcover workflow prompts removed — 2026-10-05

- Removed the requested “No PDF yet” badge, drag/drop explanation, and initial
  upload warning from the Source PDF panel.
- Retained the shared Import PDF and optional Import back PDF buttons, their
  existing hierarchy, drop handlers, loaded-source information, and import errors.
  No new controls, subtitles, styling, or production behavior were introduced.
- TypeScript, component formatting, and component diff whitespace checks passed.
- Browser checks passed across all four steps at 1366×768 (English/light),
  1920×1080 (French/dark), and 1600×900 (Arabic/light, low-end mode). Inspected
  screenshots and checked page width; no horizontal page overflow was found.
  Keyboard Enter switches steps with visible focus. The preview, import controls,
  and production validation remain available; footer hint cards are absent.
- Removed the footer hint cards and “Next” buttons from every workflow step:
  Source PDF, Book measurements, Spine text, and Export. All steps remain
  accessible through the existing workflow navigation.
  TypeScript, page formatting, and diff whitespace checks passed. Full release
  checks for 0.2.6 passed: formatting, TypeScript, all tests, Storybook, and production
  build. No hardware print job was sent; physical printer/cutter acceptance remains
  pending. Other historical pending checks retain their existing status.

Screenshots: `output/playwright/release-0.2.6/`.

## Cutter masking canvas wheel zoom — 2026-10-05

- Ctrl + scroll zooms the shared Prepare artwork / Cut lines canvas within the
  existing 45–250% limits. Zoom anchors to the cursor where scrolling permits;
  unmodified wheel events retain normal scrolling. The native non-passive wheel
  listener prevents browser zoom locally and is removed on unmount.
- In-progress pointer drawing, dragging, and panning retain their original scale.
  Zoom changes only editor view state; it creates no artwork undo entry.
  Existing zoom controls remain in their shared toolbar; the existing translated
  shortcut is listed inside Keyboard shortcuts. No new command or subtitle added.
- Browser checks passed for zoom in/out, both limits, cursor anchoring, normal
  scrolling, Fit, keyboard zoom, expanded canvas, and both editing steps. Drew and
  applied a rectangle mask after zooming; checked that Ctrl + scroll during the
  drawing did not change its scale.
- Inspected 1366×768 English/light, 1920×1080 French/dark, and 1366×768 Arabic/light
  with low-end mode. No horizontal page overflow was found.
- TypeScript, changed-file formatting, diff whitespace, and the full cutter
  regression suite passed. Hardware printing/cutting remains pending; no job sent.

Screenshots: `output/playwright/cutter-wheel/`.

## Hardcover space cleanup — 2026-10-05

- Removed the customer mockup panel, including its low-end placeholder and Load
  mockup button, the Auto Fit explanatory box, and the Spine placement card.
  The main cover canvas, Auto Fit checkbox, spine fields, validation, project
  controls, and output actions retain their existing behavior and shared patterns.
  No replacement cards, subtitles, or commands were added.
- Inspected Source PDF and Spine text at 1366×768 English/light, 1920×1080
  French/dark, and 1600×900 Arabic/light with low-end mode. No horizontal page
  overflow was found. Keyboard Enter switches steps; Space toggles Auto Fit and
  reveals/hides the manual font size field correctly.
- TypeScript, changed-file formatting, diff whitespace, and the full Hardcover
  regression suite passed. Hardware printing/cutting remains pending; no job sent.

Screenshots: `output/playwright/hardcover-declutter/`.

- Follow-up: removed the PDF pages / Preflight / Checklist summary strip below
  the cover preview and its unused component. Source controls and export preflight
  checks remain available in their existing contexts. Repeated the Source PDF and
  Spine text layout/keyboard checks at the same three sizes, themes, and languages;
  TypeScript, formatting, and diff whitespace checks passed.

## Booklet empty import hint removed — 2026-10-05

- Removed the initial “Start by importing a PDF or images” arrow hint. Import
  buttons, busy/progress status, blank-page guidance, and loaded-document behavior
  retain their existing controls and shared styles. No replacement prose added.
- Inspected the empty state at 1366×768 English/light, 1920×1080 French/dark, and
  1600×900 Arabic/light with low-end mode. The hint is absent, both import buttons
  accept keyboard focus, and no horizontal page overflow was found.
- TypeScript, changed-file formatting, and diff whitespace checks passed.

Screenshots: `output/playwright/booklet-cleanup/`.

## Booklet blank-page warning — 2026-10-05

- Removed the duplicate “Add N blank pages” arrow hint. The existing page-count
  warning now uses the shared destructive border, background, and text colors,
  medium-weight text, and alert semantics. No extra command or message was added.
- Inspected a two-page booklet at 1366×768 English/light, 1920×1080 French/dark,
  and 1600×900 Arabic/light with low-end mode. The warning is red, the duplicate
  hint is absent, and there is no horizontal page overflow. Keyboard Enter on
  Auto add blank pages produces four pages and removes the warning.
- TypeScript, changed-file formatting, diff whitespace, and the booklet regression
  suite passed. No hardware print job was sent.

Screenshots: `output/playwright/booklet-warning/`.

## Universal Clear — 2026-10-05

- Replaced Booklet's imported-file deletion panel with one shared Clear button
  in the tool header. Booklet, Card Montage, Cutter, Hardcover, and Sequential
  Number use the same icon, label, size, outline trigger, and confirmation dialog.
  Clear appears after Save as in project file actions; Card uses its existing
  header action area. Expanded the shared file-action width so long French labels
  fit on one row when space allows.
- Clear removes current sources, pages, designs, placements, and content while
  keeping settings and saved project paths. It releases import resources and
  resets selections. Existing New project behavior is preserved. Cancel and Escape
  retain current work. Empty/busy tools disable Clear; default cover text and number
  positions count as content. Confirmation uses the shared destructive button.
- Actual browser checks passed for all five tools: cancel, Escape, clear, empty
  disabling, and settings preservation (A3 paper, 7 cm cards, quantity 25, 5 cm
  Cutter margin, and 3 cm spine). Card and Sequential reimport checks passed.
- Inspected populated tools and confirmation dialogs at 1366×768 English/light,
  1920×1080 French/dark, and 1366×768 Arabic/light with low-end mode. No horizontal
  page overflow was found. Dialogs return focus to an enabled header control,
  including when Clear becomes disabled after confirmation.
- Added enabled, empty/busy, and interactive confirmation Storybook examples;
  documented the shared pattern in DESIGN_SYSTEM.md. New dialog copy has French
  and Arabic translations.
- TypeScript, formatting, diff whitespace, Booklet/Cutter/Hardcover/Card/Sequential
  regression suites, i18n tests, and the Storybook build passed. Native desktop
  save/reopen after Clear and hardware print/cut acceptance remain pending;
  browser checks do not claim native verification. No print/cut job was sent.

Screenshots: `output/playwright/universal-clear/`.

## Booklet deferred thumbnail notice removed — 2026-10-05

- ProgressLine omits the routine deferred-thumbnail notice, including notices
  already held in import state. Other import warnings retain their messages;
  thumbnail limits, page import, and on-demand preview behavior are unchanged.
- Imported a 34-page PDF at 1366×768 English/light, 1920×1080 French/dark, and
  1600×900 Arabic/light with low-end mode. All pages remain available, the notice
  is absent, the real page-count warning remains visible, and there is no page
  width overflow. Keyboard Enter opens page 34 inspection and renders its preview.
- TypeScript, formatting, diff whitespace, and booklet regression tests passed.

Screenshots: `output/playwright/deferred-notice/`.

## Booklet carousel and expanded pages — 2026-10-07

- Replaced the left page column with a carousel under the canvas in Sheet,
  Montage, and 3D Book modes. Removed repeated filenames and type captions from
  thumbnails. Whole-page images use contain sizing and a small inset so page
  edges remain visible. Expand pages shows all page cards in a grid; Collapse
  pages and Escape return to the strip. Deferred thumbnails load on visibility.
- Preserved selection, Previous/Next, number jumps, wheel scrolling, arrow/Home/End
  navigation, pointer and keyboard reordering, reset order, deletion, blank colors,
  and double-click/modified Enter inspection. Auto blanks has one home in this
  area. Menus and deletion retain usable keyboard focus.
- The canvas loads selected/deferred pages at preview quality. Shared source PDF
  loading is independent of a single page's cancellation; clearing the cache
  invalidates and destroys stale requests without erasing newer ones. Added
  regression coverage for shared loads, stale cleanup, clear, and failed-load retry.
- Browser checks passed with a 34-page PDF at 1366×768 English/light,
  1920×1080 French/dark, and 1600×900 Arabic/light with low-end mode. Checked the
  compact strip and expanded grid, deferred thumbnails, full-page fit, pointer
  reordering in the grid, keyboard navigation, collapse, and rapid page changes.
  No horizontal page overflow was found.
- Verified blank color updates reach the canvas, Auto blanks completes 34 pages
  to 36, and inspection opens the selected page. Added interactive, empty, and
  importing Storybook examples. New copy uses French and Arabic translations.
- Full local 0.2.9 release checks passed: formatting, TypeScript, all production
  test suites, Storybook, and the production build. Full release checks and Windows
  packaging validation are recorded with the published 0.2.9 release. Native
  save/reopen after these changes and physical printer/cutter acceptance remain
  pending; no hardware print/cut job was sent.

Screenshots: `output/playwright/carousel/`.

## Card Montage EPS import — 2026-10-05

- Existing front/back file pickers and drop areas now accept EPS alongside AI,
  PDF, PNG and JPG. Reused existing shared controls, busy state and error area;
  no new primary action, duplicate command, heading subtitle or styling system.
- Windows imports use installed Adobe Illustrator to embed EPS on a page sized
  from its BoundingBox/HiResBoundingBox. The stored project contains converted
  PDF bytes with the original EPS filename; reopening/exporting needs no further
  Illustrator conversion. Fonts must be installed or outlined and images embedded.
- Actual Illustrator conversion of representative front/back EPS files and a
  two-page montage export passed, including original page-dimension verification.
  Automated tests cover text/binary headers, invalid/oversized input, bounding
  boxes, converter errors, Illustrator cleanup, project roundtrip and vector export.
- Browser file selection, back-side drag/drop, keyboard Tab access and the
  browser-only import error were checked. Browser success checks used the real
  converted PDFs through a stubbed desktop bridge; full desktop IPC and installed
  release checks remain pending.
- Inspected the empty state at 1366×768 and loaded artwork at 1366×768
  English/light, 1920×1080 French/dark, 1366×768 Arabic/dark and 1920×1080
  Arabic/light. Arabic passes used low-end mode. No horizontal page overflow;
  new format, EPS status, help and error text has French/Arabic translations.
- TypeScript, production build, Card regression tests, translation tests,
  changed-file formatting and diff whitespace passed. No hardware print job sent;
  physical printing and workshop released-build acceptance remain pending.

Screenshots and native conversion fixtures: `output/playwright/card-eps-*`.

## Card Montage zero-spacing cutting lines — 2026-10-05

- Zero spacing uses continuous vertical/horizontal guides through every card
  boundary and outer trim edge, extending across the full A4 page. Shared
  boundaries are drawn once. Preview, PDF and printing share the same geometry,
  existing 0.25 px stroke, color setting and enable/disable control.
- Spaced-mode corner crosses and auto-mode optional outlines retain their behavior.
  Reused existing Advanced controls; updated their zero-mode labels in English,
  French and Arabic. No additional command, subtitle or styling system added.
- Regression tests verify full-sheet endpoints, all boundaries, fractional card
  dimensions, single-card layouts, both A4 orientations and disabled guides.
  PDF stream checks verify exact line placement and thickness on front/back pages.
- Inspected empty and loaded previews, 1366×768 English/light, 1920×1080
  French/dark and 1366×768 Arabic/dark with low-end mode. No horizontal page
  overflow; the long French label wraps within its panel. Keyboard Space toggles
  guides; Tab reaches the color input and disabling guides disables that input.
- TypeScript, Card regression tests, translation tests, changed-file formatting
  and diff whitespace passed. Physical printing/cutting remains pending; no
  hardware job was sent.

Screenshots: `output/playwright/card-lines-*`.

## Card Montage front-only cutting lines and Clear — 2026-10-05

- Zero-spacing sheet cutting lines appear on the front only in previews,
  exported PDFs and front/back/both print preparation. Back-only printing also
  omits them. Artwork placement, sheet dimensions, spaced-mode crop crosses and
  auto-mode optional rectangles retain their behavior.
- Renamed the existing file-clearing command from New project to Clear, using
  the shared ActionButton reset icon, ghost variant and existing translations.
  Clear removes loaded front/back artwork, resets preview/print selection and
  messages, and preserves montage settings. It is disabled while busy or empty.
  No new command duplication, primary action, heading subtitle or styling system.
- Inspected loaded sources, Clear focus, Advanced controls and both previews at
  1366×768 English/light, 1920×1080 French/dark and 1366×768 Arabic/dark with
  low-end mode. No horizontal page overflow; labels wrap without clipping.
  Keyboard Tab shows the shared focus ring and Enter clears both sources;
  empty-state, disabled Clear, preview zoom reset and retained mode were checked.
- TypeScript, Card regression tests, translation tests, changed-file formatting
  and diff whitespace passed. Tests check front/back PDF strokes and all three
  print-side selections in both sheet orientations. Physical printing/cutting
  and packaged desktop checks remain pending; no hardware job was sent.

Screenshots: `output/playwright/card-front-only-*.png` and
`output/playwright/card-clear-empty-1366.png`.

## Startup updates before workspace — 2026-10-05

- Installed Setup builds hold workspace mounting during the launch update check,
  download and installation. Available stable updates install silently and
  relaunch before work begins. Browser, development and portable builds bypass
  the automatic startup update. Existing background checks retain project-save
  protection and do not take over an open workspace.
- Startup checks have a 15-second deadline; downloads have a 10-minute deadline.
  Offline/check/download/installer failures release the workspace. A download
  completing after the deadline cannot automatically restart current work.
  State subscriptions ignore stale initial snapshots after receiving an event.
- Reused shared surface/color/radius tokens, translated status text and accessible
  progress semantics. No commands, heading subtitles, animation or new primary
  action were introduced. Storybook covers checking, downloading and installing.
- Browser checks with a simulated desktop update bridge exercised all three
  startup states, workspace release on error and background update behavior at
  1366×768 English/light, 1920×1080 French/dark and 1600×900 Arabic/dark with
  low-end mode. Screenshots inspected; no horizontal overflow or clipping.
  Progress exposes its actual percentage; no keyboard-only action is required.
- Updater regression tests and TypeScript passed. Tests exercise startup silent
  install/relaunch, deadlines, canceled/failed installation, late downloads,
  recurring checks, retries, duplicate installation and unsaved-work protection.
  A real subscriber-to-newer-version startup installation remains pending until
  a subsequent stable release exists. No hardware print/cut job was sent.

Screenshots: `output/playwright/startup-update-*.png`.

Local v0.2.7 release checks passed: repository formatting, TypeScript, all automated
suites, Storybook and the production build. Windows packaging and publication are
verified separately by the tag-triggered release workflow.

## EPS native artboard preservation — 2026-10-05

- EPS conversion now opens the temporary copy in Illustrator instead of placing
  the entire EPS onto one new canvas. All native artboards are saved as individual
  PDF pages; page count, ordering and each artboard's dimensions are validated.
  Existing front/back assignment and page selection controls are reused unchanged.
- Generated a native two-artboard Illustrator EPS with red front and blue back.
  Its combined BoundingBox is 510×150 pt; actual conversion produces two separate
  240×150 pt pages, retains vector artwork and exports a two-page card montage.
  Actual single-artboard PostScript EPS conversion also passed at 240×150 pt.
- Browser checks use the actual Illustrator-converted PDF through a simulated
  desktop bridge. Artboard 1 is selected for front and artboard 2 for back;
  pixel samples verify red front and blue back. Inspected 1366×768 English/light,
  1920×1080 French/dark and 1366×768 Arabic/dark with low-end mode. No horizontal
  overflow or new controls/styles/subtitles; existing panels scroll normally.
- Card regression tests, TypeScript and changed-file formatting passed. Regression
  coverage checks multi-artboard saving, differing page dimensions, missing/lost
  artboards, invalid geometry, conversion failures and Illustrator state cleanup.
  The user's original EPS was unavailable, so verification with that exact file
  remains pending. Full installed-app IPC and physical printing remain pending.
- Existing imported combined pages require Clear and reimporting the original EPS.

Fixtures/screenshots: `output/playwright/card-two-artboards*` and
`output/playwright/eps-artboards-*.png`.

Local v0.2.8 release checks passed: repository formatting, TypeScript, all automated
suites, Storybook and the production build.

## Cutter finished sticker sizing — 2026-10-07

- Width/Height measure the active clipping mask, or the cutting line when no mask
  is active. Uncut artwork keeps its source-frame sizing. Resizing scales the
  artwork crop, mask, contours and helpers together, including locked objects.
  Physical size limits apply to the sticker; hidden source artwork can extend
  beyond those limits without reducing the requested sticker size.
- Cutter and sticker regression suites, TypeScript, changed-file formatting and
  diff whitespace checks passed. Tests cover an 18×12 cm photo with a 5×5 cm round
  cut, masked and contour-only resizing, aspect ratio, rotation, minimum/maximum
  sizes, repeated resizing, invalid input and missing mask references.
- Checked the real editor through a simulated project-storage bridge at
  1366×768 English/light, 1920×1080 French/dark, and 1366×768 Arabic/dark with
  low-end mode, using loaded artwork and an empty workspace. Keyboard editing,
  Undo/Redo and the existing primary/supporting actions work. Existing controls,
  tokens, layout and labels are reused without new controls or subtitles.
  The 5×5 cm mask becomes 40×40 cm, matches the contour, preserves the crop and
  transfers to the arranged copy even though its source frame becomes 144×96 cm.
  No horizontal page overflow; inspected screenshots confirm the size fields
  and canvas remain visible. The existing Arabic AI Sticker Maker rail button
  has a long clipped label; that unrelated layout issue remains pending.
- Verification with the customer's original artwork/project and an installed
  release remains pending. Physical print/cut checks remain pending.

Screenshots and browser checks: `output/playwright/cutter-size-*`.

## Cutter focused cut view and precision workspace — 2026-10-07

- Step 2 fits and centers the finished sticker instead of the complete source
  frame. The view includes the mask and cutting margin; contour-only artwork is
  clipped for this preview. Returning to step 2 resets zoom and scroll. Fit view
  clears panning. Source dimensions, object coordinates and export geometry are
  retained; pointer drawing still uses the original source coordinates. The
  camera stays steady during edits, and hidden source-frame overflow is removed.
- Cut edge precision now has one visible home beneath the main preview in
  step 2. Its larger close-up offers top/right/bottom/left views and 6/12/24 mm
  spans, with actual physical dimensions displayed. Offset, trim, matching and
  directional controls are below it. Shared buttons, spacing, surfaces and theme
  tokens are reused; controls wrap and the workspace scrolls on smaller screens.
  Duplicate cutline creation actions were removed from the step 2 inspector.
  No explanatory heading subtitles were added. The inspector success state now
  uses semantic tokens for readable light/dark contrast.
- Browser checks used a simulated project-storage bridge with a 5×5 cm sticker
  on an 18×12 cm source: 1366×768 English/light, 1600×900 French/dark,
  1920×1080 English/dark, and 1366×768 Arabic/dark in low-end mode. The sticker is
  centered with no canvas or page overflow at Fit. Empty states, keyboard focus,
  drawing coordinates, Undo, trim, nudge and exact mask matching were exercised.
  Precision edits change the contour alone and preserve mask/artwork geometry.
  Pan/Fit and returning from the precision section to step 2 reset correctly.
  Locked contours disable editing while retaining close-up inspection; missing
  contours show creation actions, and creating one reveals the precision section.
  Contour-only previews leave the saved clipping-mask setting unchanged.
  New precision controls and feedback are translated into French and Arabic;
  directional nudge buttons preserve physical artwork directions in RTL.
- Cutter regressions, focused view geometry tests, TypeScript, translation checks
  and changed-file formatting passed. Added Storybook examples for the workspace,
  compact sidebar, locked contour and custom-path warning states. Storybook built
  successfully; existing dependency directive/chunk-size warnings remain.
- The existing Arabic AI Sticker Maker rail label clipping remains outside this
  change. The customer's original project, installed-release behavior and
  physical print/cut verification remain pending.

Screenshots and browser checks: `output/playwright/cutter-focus-*`.

Local v0.2.11 release checks passed: repository formatting, TypeScript, all
automated suites, Storybook, and the production build. Release review inspected
the recorded 1366×768 English/light and Arabic/dark screenshots, 1600×900
French/dark, and 1920×1080 English/dark. The changed precision workspace reuses
shared buttons and tokens, keeps controls in one location, preserves production
geometry, and introduces no heading subtitles. The existing navigation label
clipping and installed/hardware checks remain pending as recorded above.
Windows packaging and publication are verified by the tag-triggered workflow.

## Card Montage CMYK JPEG colors - 2026-10-08

- Fixed the confirmed image-import color conversion: JPEG bytes, original
  channels and ICC profiles now remain intact. The preview opts into PDF.js ICC
  processing using the existing bundled WASM assets; default PDF loading remains
  unchanged. No interface controls, tokens, layout or heading copy changed.
- Inspected anonymous SWOP CMYK artwork at 1366x768 English/light, 1920x1080
  French/dark, and 1366x768 Arabic/dark with low-end mode. Reimporting in each
  configuration retained the dark-blue patch at RGB (5, 24, 49), with no artwork
  filters or reduced opacity. No horizontal page overflow; existing panels scroll.
  Export PDF receives visible keyboard focus. Screenshots inspected:
  `output/playwright/card-jpeg-*`.
- Actual browser import checks passed for RGB with an Adobe RGB profile,
  grayscale, CMYK with SWOP, and all eight EXIF rotation/mirroring orientations.
  A 6496x4098 anonymous CMYK fixture imported in about 2.5 seconds locally with
  a 1200x758 preview and unchanged source bytes. The ordinary UI Export PDF action
  saved a PDF whose embedded JPEG bytes match the original and whose ICCBased
  image retains four CMYK channels; no soft mask or fading overlay was introduced.
- The built Electron renderer loaded local-file worker/WASM assets and rendered
  the same corrected colors. Poppler rendering of the exported PDF also retained
  the dark-blue patch; the rendered A4 sheet was visually inspected.
- Card and Booklet tests, TypeScript, formatting and production build passed.
  The customer's actual files were inspected on the workshop PC. Retesting that
  original JPG with a newly installed stable correction and physical printing
  remain pending; no hardware print job was sent. Reimport the original JPG after
  updating, because older RGB exports no longer contain its CMYK data.

## Cutter CS6 editing compatibility - 2026-10-08

- Native single-sheet, separate-sheet batch and Illustrator/FineCut files now
  save version-16 editing data through the CS6 Illustrator serializer. The
  exported file remains a real one-page PDF 1.5 with three PDF layers. Native
  reopening checks all three Illustrator layers, hidden/non-printing CutContour,
  cut count/position, registration marks, direction arrow and sheet dimensions;
  binary validation rejects modern editing data and missing PDF layers.
- Tested the actual Illustrator 30.8.2 export on a retained 40-sticker layout at
  925×115 mm. The saved file contains the CS6 editing header and reopens with
  three native layers, 40 cutting paths, four corner marks and one arrow. The
  printed page rendered with PDF.js at 1312×163 pixels is identical to the prior
  export (zero changed channels); the PNG was inspected. New temporary PDF/AI
  staging files were removed after successful verification.
- Cutter suites, typecheck and changed-file formatting passed. New regressions
  cover the save sequence, embedded legacy format, three layer names, hidden
  contour, failed publishing, single-page output and temporary-file cleanup.
- No new controls, button variants or heading subtitles were introduced. The
  prior export failure banner was checked at 1366×768 English/light,
  1920×1080 French/dark and 1366×768 Arabic/dark with low-end mode. Readable
  translated messages, keyboard retry and cleared busy state passed with no
  banner/page overflow. Existing project and production measurements are retained.
- Actual opening in Illustrator CS6 on the user's other PC, verification of the
  original 145-copy workshop sheet and physical print/cut checks remain pending.
  The user resolved the intermittent export by retrying and requested moving on
  to CS6 compatibility; further workshop export-stall investigation was stopped.

Artifacts: `output/playwright/cs6-compatible-print.png`,
`output/playwright/export-error-*`, and `output/pdf/cutter-cs6-three-layer-test.pdf`.

Local v0.2.12 release checks passed: repository formatting, TypeScript, all
automated suites, Storybook and the production build. Actual Illustrator CS6
opening and physical printer/cutter validation remain pending as noted above.

## Compact multi-sticker distribution - 2026-10-17

- Replaced full-row height reservations with free-area packing. Short lanes now
  continue beside tall rotated copies, and later designs reuse holes on earlier
  sheets. Artwork, mask and CutContour bounds, safe margins, grid snapping,
  configured spacing, rotation restrictions and retained positions are respected.
  Material-length capacity uses the same placement rules.
- The 35 × 20 cm, nine-copy regression needs two sheets with the previous
  algorithm and one sheet with this correction. Tests cover mixed designs,
  overflow, preserved/locked copies, offset contours and height-limited rotation.
  The existing shorter-sheet regression now fits 31 rather than 24 copies per
  full sheet by using a rotated final row.
- TypeScript, complete cutter and sticker suites, changed-file formatting and
  diff whitespace checks passed. A 5,000-copy workshop-fixture order completed
  in 25 ms on the main PC; this is not a workshop-PC performance measurement.
- Inspected the live nine-copy preview at 1366×768 English/light, 1920×1080
  French/dark and 1366×768 Arabic/light with low-end mode. Each retained one
  production sheet and nine artwork copies, without page overflow. Keyboard
  activation of Arrange Copies retained focus. The settled RTL canvas preserves
  the production reading direction and the compact lanes. No controls, headings,
  shared styles or output actions changed.
- Physical print/cut checks and verification in a released workshop build remain
  pending. No release or hardware print job was requested.

Artifacts: `output/playwright/sticker-lanes-1366-en-light.png`,
`output/playwright/sticker-lanes-1920-fr-dark.png`, and
`output/playwright/sticker-lanes-1366-ar-light-settled.png`.

## Export reliability - 2026-10-17

- Booklet PDF exports parse each used source once and share embedded fonts and
  images across its pages. Imported blank pages, CropBox offsets, PDF rotations
  and transparency groups are retained. Missing artwork fails before producing
  a PDF. Preparation yields between batches, and canceled output is checked
  before it can reach saving or printing.
- Shared native saves stage and sync complete files before replacing their
  destinations. Folder exports validate the full requested list before writing;
  each file is replaced atomically. A filesystem failure partway through a batch
  can leave earlier completed files. Save history failures cannot turn a
  completed file save into a reported export failure. Unchanged project snapshots
  share one autosave across streamed image sheets.
- `test:exports`, booklet, card, sequential-number, hardcover and cutter suites,
  typecheck and the production build passed. Export regressions cover one parse
  per source, shared resources, imported blanks, cropped/rotated pages,
  cancellation, streamed image ordering, memory checks before canvas allocation,
  cleanup, failed-save retries and destination validation.
- The retained 183-page, 48,270,507-byte production PDF exported with one added
  blank to 92 booklet sides and a 47,927,960-byte output. The local verification
  script completed export, disk save and output parsing in about 5.1 seconds;
  this is a main-PC measurement. Rendered cover and center spreads were inspected,
  along with both sheets of a synthetic four-rotation/CropBox sample.
- No workspace layout, button styling, action placement or headings changed.
  The native save dialog now uses the shared label “Save exported file”. Live
  export-state and save-dialog checks at 1366×768 and 1920×1080, light/dark,
  French/Arabic RTL, keyboard operation and low-end mode remain pending.
  Workshop/released-build and physical printing checks remain pending.

Artifacts: `tmp/pdfs/export-reliability/production-booklet.pdf`,
`tmp/pdfs/export-reliability/production-sheet-01.png`,
`tmp/pdfs/export-reliability/production-sheet-92.png`, and
`tmp/pdfs/export-reliability/rotated-sheet-*.png`.

## Repeat a ticket number - 2026-10-17

- In Sequential Number, the existing number action is now labeled Add same
  number when a sequence position exists. It copies the selected number's
  formatting (or the first number when fixed text is selected), offsets the
  copy inside the ticket and selects it for independent positioning. With no
  numbers, Add number creates the first sequence position. Both editing actions
  share one wrapping row of shared outline buttons; no heading subtitle is added.
- All number positions retain the same per-ticket sequence value in the editor,
  sheet preview and exported PDF. Project serialization remains compatible.
  Regression coverage includes matching ticket/stub numbers with prefixes,
  suffixes, padding and custom increments in sheet and cut-and-stack orders,
  duplex output, formatting reuse, fixed-text selection and placement near the
  bottom edge.
- Typecheck, sequential-number and i18n suites, changed-file formatting and diff
  whitespace checks passed. Inspected the empty-design editor at 1366×768
  English/light and representative ticket/stub artwork at 1920×1080 French/dark
  and 1366×768 Arabic in light/dark with low-end mode. Also inspected 1600×900
  Arabic/light. Controls wrap without horizontal page overflow; the canvas and
  page can scroll to reach the second number. Keyboard movement updates only
  the selected second position. Sheet preview shows two matching values for
  every occupied ticket. French/Arabic action and position labels are translated.
- Native project save/reopen, released workshop-build verification and physical
  printing remain pending. No release or hardware print job was requested.

Artifacts: `output/playwright/sequential-repeat-1366-en-light.png`,
`output/playwright/sequential-repeat-1920-fr-dark.png`,
`output/playwright/sequential-repeat-1366-ar-dark-low-end.png`,
`output/playwright/sequential-repeat-1366-ar-light-low-end.png`, and
`output/playwright/sequential-repeat-1600-ar-light-low-end.png`.

## Stable release v0.2.13 - 2026-10-17

- Full local `npm run release:check` passed: repository formatting, TypeScript,
  every automated test suite, Storybook and the production build. This includes
  the new shared file-save, output autosave and booklet export regressions.
- The acceptance review retains the compact-sticker and repeated-number visual
  results recorded above. Shared controls and action placement are retained;
  no further UI changes were made during release preparation.
- Live export-state/native save-dialog checks at 1366×768 and 1920×1080,
  light/dark, French/Arabic RTL, keyboard access and low-end mode remain pending.
  Released workshop-build and physical printer/cutter verification remain pending.

Release check log: `.codex-release-0.2.13-check.log` (local, ignored by Git).

## Cutter expanded canvas stability - 2026-10-17

- Reproduced the resize feedback loop with a 96 × 100 cm sheet, a
  550.6 × 572 px viewport and a small element extending beyond the sheet to
  represent overflowing labels or selection controls. Scrollbars alternated
  the canvas between 501 px and 493 px wide on every sampled frame (89 changes
  over 90 settled frames).
- The montage preview now observes the viewport border box, floors fractional
  dimensions and reserves padding, borders and scrollbar space when fitting.
  Scrollbar changes cannot trigger another fit. Unchanged measurements reuse
  state, and scroll anchoring is disabled while resizing the preview. The same
  reproduction now settles at 492 px wide with zero frame-to-frame changes.
- Typecheck, the complete cutter suite, changed-file formatting and diff
  whitespace checks passed. Browser checks covered 1366×768 English/light,
  1920×1080 French/dark, 1600×900 Arabic/light and 1366×768 Arabic/dark; both
  Arabic passes used low-end mode. Empty and 100-copy layouts stayed stable
  when expanded, at the scrollbar threshold and after restoring the workspace.
  Enter opens fullscreen, Escape and Restore workspace return focus to the
  button, and manual zoom/Fit view work. No horizontal page overflow or change
  to the 100 artwork copies occurred. Screenshots of expanded and restored
  layouts were inspected.
- Acceptance review: existing shared controls, labels, action placement and
  heading structure are retained. Production geometry and export code are
  unchanged. Native Electron/released workshop-build verification and physical
  output remain pending; no release or hardware job was requested.

Artifacts: `output/playwright/cutter-expand-1366-en-light.png`,
`output/playwright/cutter-expand-1920-fr-dark.png`,
`output/playwright/cutter-expand-1600-ar-light.png`,
`output/playwright/cutter-expand-1366-ar-dark.png`, and corresponding
`output/playwright/cutter-restored-*.png` screenshots.

## Move stickers before export - 2026-10-17

- In Layout & export, dropping a sticker onto other copies relocates overlapping
  neighbors into nearby free regions on the same physical sheet. Artwork,
  clipping geometry, CutContour, size, rotation, IDs and copy counts travel
  together. Unaffected copies and other sheets retain their positions. Locked
  obstacles or insufficient free space reject the entire move and restore the
  drag preview. Safe margins and configured production spacing are respected.
- Selected groups move together; Ctrl/Shift-click toggles selection once.
  Keyboard arrows use the same placement rules. Undo Arrange and Ctrl+Z on the
  canvas restore the previous placement snapshot. Manual positions are retained
  through the existing Preserve manual positions setting. Rejection errors are
  also visible within the expanded canvas, translated into French and Arabic.
- Added the manual-layout regression suite to `test:cutter`: mixed sizes,
  nearby relocation, group movement, locked copies, other sheets, insufficient
  space, cut margins, rotation and independent copy dimensions. It verifies
  production spacing, unchanged input snapshots, project serialization/reopen
  and matching moved artwork/CutContour coordinates in exported SVG.
- Browser checks passed with sixteen mixed-size stickers and visible cut lines
  at 1366×768 English/light, 1920×1080 French/dark, 1600×900 Arabic/light and
  1366×768 Arabic/dark; both Arabic passes used low-end mode. Each exercised
  drop/rearrange, cutline retention, locked-move rejection, Ctrl+Z and serialized
  project snapshots. Expanded screenshots were inspected. Group dragging and
  undo also passed, along with keyboard nudging/undo in the normal layout.
  No horizontal page overflow occurred.
- Acceptance review: existing shared buttons, action locations, heading
  structure, themes and production reading direction are retained. No new
  toolbar or styling system was introduced. Native save/open dialogs, released
  workshop-build verification and physical print/cut output remain pending.

Artifacts: `output/playwright/cutter-drag-1366-en-light.png`,
`output/playwright/cutter-drag-1920-fr-dark.png`,
`output/playwright/cutter-drag-1600-ar-light.png`,
`output/playwright/cutter-drag-1366-ar-dark.png`, and
`output/playwright/cutter-drag-normal-1366-ar-dark.png`.

## Clean sticker layout preview - 2026-10-17

- Removed the automatic floating overview beneath the montage sheet and the
  duplicate per-sticker command popover. Duplicate, Rotate, Lock and Delete
  retain their existing shared buttons in the fixed canvas toolbar. Sticker
  names remain available as native tooltips instead of labels covering artwork.
- Selection and pointer targets now use the actual production footprint,
  including clipping masks, rotation and cut margins. The source scene is
  offset within that target, preserving artwork and cut-line coordinates.
  Selected copies render above neighbors and the actively dragged copy renders
  above other selections. Low-end drag previews use the same tight footprint.
- Added rendered-component regressions to `test:cutter` for cropped masks at
  all four quarter-turn rotations, selection dimensions/origin, toolbar
  ownership and unchanged production data. Typecheck, the complete cutter
  suite, changed-file formatting and diff whitespace checks passed.
- Inspected a representative 50 cm sheet with twelve masked stickers from
  larger source pages, selected near the bottom edge at 100% zoom. Browser
  checks passed at 1366×768 English/light, 1920×1080 French/dark, 1600×900
  Arabic/light and 1366×768 Arabic/dark; both Arabic passes used low-end mode.
  A 5×3 cm sticker has a 50×30 px selection at this zoom, with no source-page
  box extending below the paper, floating overview or duplicate controls.
  Drag layering, undo, single toolbar actions and expanded/restored views
  passed. Screenshots were inspected in these configurations. Empty and
  100-copy expansion/Fit view checks also passed, including the prior scrollbar
  threshold reproduction with no repeated resizing or page overflow.
- Acceptance review: shared controls and task grouping are retained; no new
  UI strings, subtitles or styling system were introduced. Print/export
  geometry is unchanged. Verification on a released workshop build and
  physical print/cut output remain pending.

Artifacts: `output/playwright/cutter-clean-1366-en-light.png`,
`output/playwright/cutter-clean-1920-fr-dark.png`,
`output/playwright/cutter-clean-1600-ar-light.png`,
`output/playwright/cutter-clean-1366-ar-dark.png`, and corresponding
`output/playwright/cutter-clean-expanded-*.png` screenshots.

## Stable release v0.2.14 - 2026-10-17

- Full local `npm run release:check` passed: repository formatting, TypeScript,
  every automated test suite, Storybook and the production build. The cutter
  suites include manual rearrangement and rendered cropped-sticker selection
  regressions, along with existing project/export/production checks.
- Acceptance review retains the expansion-stability, manual-layout and clean
  preview visual results above, including required desktop sizes, themes,
  French/Arabic RTL, keyboard interaction and low-end mode. No additional UI
  changes were made during release preparation.
- Released workshop-build and physical printer/cutter verification remain
  pending.

Release check log: `.codex-release-0.2.14-check.log` (local, ignored by Git).

## Measure AI stickers from the cut contour - 2026-10-17

- Finished width/height in the cutter library, quantities, editor heading and
  piece properties use the actual cut contour, including its configured cut
  margin. Custom paths are measured from drawn geometry instead of the larger
  normalized SVG frame; polygon, subpath and curve extrema are supported.
  Resizing uses that measurement and keeps artwork, masks and cut lines aligned.
- Cut-view fitting also follows the drawn contour, so the surrounding PNG
  canvas no longer makes the finished sticker appear unnecessarily small.
- Sticker Maker transfers retain original PNG data and add a non-destructive
  contour clipping mask. White artwork inside the contour is preserved, while
  unused source padding no longer enlarges layout footprints. Existing AI
  stickers gain this clip when their finished width is changed. Production
  footprint calculations use actual path bounds for nesting and selection.
- Typecheck, cutter, sticker, project and i18n suites passed. Regressions cover
  source padding, exact 100 mm contour resizing, height/aspect changes, unlocked
  dimensions, mask-versus-contour priority, legacy AI copies, quarter turns,
  relative paths, multiple subpaths, curve extrema and project/PDF round trips.
- Browser checks exercised Add images → Process all → Send to Cutter using a
  transparent 400×800 px source with a 200×180 px foreground containing white
  artwork. At an 80 mm source width, the finished cut width correctly reads
  40 mm. Changing it to 100 mm produces a 10×9 cm production footprint rather
  than the padded 20×40 cm artwork frame. The result was inspected at 1366×768
  English/light, 1920×1080 French/dark, 1600×900 Arabic/light and 1366×768
  Arabic/dark; both Arabic checks used low-end mode. No horizontal page overflow
  occurred. Arabic editor properties also passed keyboard width/height edits,
  changing 10×9 cm to 6.67×6 cm and then 12×10.8 cm.
- Acceptance review: existing shared controls and action locations are retained;
  no headings or duplicate actions were added. Measurement help is translated
  into French and Arabic. Live AI model inference on the photographed original,
  native dialogs, released workshop-build and physical print/cut verification
  remain pending. The fix is currently local and is not in v0.2.14.

Artifacts: `output/playwright/contour-size-1366-en-light.png`,
`output/playwright/contour-size-1920-fr-dark.png`,
`output/playwright/contour-size-1600-ar-light.png`,
`output/playwright/contour-size-1366-ar-dark.png`, and
`output/playwright/contour-properties-1366-ar-dark.png`.

## Default sticker spacing 3.5 mm - 2026-10-17

- New cutter layouts default to a 3.5 mm minimum gap between production
  footprints. The contour measurements above exclude unused image margins.
  Existing saved projects retain their chosen spacing. Grid snapping and
  irregular contour geometry may leave larger gaps.
- Typecheck, cutter and sticker suites passed, including the existing
  production-bounds spacing checks. The shared Copy spacing field displays
  3.5 mm at 1366×768 English/light, 1920×1080 French/dark and 1600×900
  Arabic/light with low-end mode. No controls or layout styles changed.
- Released workshop-build and physical output verification remain pending.
  This default is local and has not been published yet.

Artifacts: `output/playwright/spacing-35-1366-en-light.png`,
`output/playwright/spacing-35-1920-fr-dark.png`, and
`output/playwright/spacing-35-1600-ar-light.png`.

## Stable release v0.2.15 - 2026-10-17

- Full local `npm run release:check` passed: repository formatting, TypeScript,
  every automated test suite, Storybook and the production build. This includes
  drawn-path bounds, exact contour sizing, AI transfer clipping and production
  spacing regressions.
- Acceptance review retains the contour-sizing and 3.5 mm spacing results
  above, including required desktop sizes, light/dark themes, French/Arabic
  RTL, keyboard edits and low-end mode. No additional UI changes were made
  during release preparation.
- Live AI inference on the photographed original, released workshop-build and
  physical printer/cutter verification remain pending.

Release check log: `.codex-release-0.2.15-check.log` (local, ignored by Git).

## Fast Print Polaroid and bypass defaults - 2026-10-17

- A4 Color menus start with 8 PIC, then 9 PIC. Geometry follows the measured red
  rectangles in the supplied landscape 8-photo and portrait 9-photo PDFs,
  including their borders, as confirmed by the user. No extra page margin or
  printable-area fitting is applied. Internal cutting strokes are 0.25 CSS px
  (0.1875 pt). Photos use a centered crop without stretching; overflow continues
  onto the next sheet, with empty slots white. Polaroid output is single-sided.
- A native checkbox in the existing driver preset window marks a captured
  bypass/face-up configuration as the default for its printer and paper. Generic
  menu and direct-token jobs resolve that default; explicit saved stocks retain
  their own settings. Driver-owned finishing is preserved in the complete saved
  buffer. The checkbox requires the operator to capture actual bypass/face-up
  options in the vendor dialog; it does not verify private driver settings.
- Typecheck, Fast Print suites (including menu/default selection and Polaroid
  dimensions/crop/stroke tests), driver buffer/profile tests, formatting checks
  and the development build passed. Real Electron worker checks rendered ten
  PDF photos through both presets, including a cross-file 9 PIC batch, to two
  sheets each. Raster and Microsoft Print to PDF proofs were visually inspected;
  remaining slots on the second sheets were checked as white. PDF output uses
  the correct A4 orientation and measured placement without shrinking. No
  hardware print jobs were submitted.
- Acceptance review: existing menus, file actions, output location and native
  setup controls are retained. One standard native checkbox was added; no new
  action family or duplicate print/import command was introduced. The native
  setup heading subtitle was removed. Its 950x710 preview shows no overlap.
- Pending: live native menu/setup checks at 1366x768 and 1920x1080, keyboard
  navigation, dark theme, French/Arabic RTL and low-end mode. The existing native
  setup remains English and does not yet share renderer theme/i18n controls.
  Workshop driver capture, face-up/bypass verification, physical edge clipping
  and subscriber-release verification are pending. These changes are local.

Artifacts: `tmp/pdfs/default-bypass-settings.png`,
`tmp/fast-print-polaroid-proof/polaroid-8/00001.png`,
`tmp/fast-print-polaroid-proof/polaroid-9/00001.png`,
`output/pdf/polaroid-8-pic-proof.pdf`, `output/pdf/polaroid-9-pic-proof.pdf`.

## Polaroid multi-sheet batch assessment - 2026-10-17

- Verified 25 separate 6000x4000 JPEG/PNG files: 8 PIC produced four sheets in
  6.6 seconds; 9 PIC produced three sheets in 5.6 seconds. A 100-file batch
  produced 13 sheets with 8 PIC in 13.3 seconds. These runs used Windows driver
  validation without sending hardware print jobs. The worker build was copied
  into a temporary local verification directory to avoid concurrent builds
  changing code during a run.
- Sampled the complete worker process tree approximately every 300 ms plus
  process-enumeration time. Peak working set was about 706-730 MiB; private
  memory was about 706-1162 MiB. Larger batches did not multiply the active
  working set, but these synthetic fixtures and main-PC measurements do not
  establish workshop or low-memory-PC performance. The image resize change
  did not demonstrate a reduction in overall peak process memory versus the
  initial run; browser decoding can still allocate full-resolution buffers.
- Image decoding now requests the photo-slot resolution using existing JPEG
  metadata parsing (including EXIF rotation) or PNG dimensions. No decode
  upscaling is requested, the bitmap long edge is capped at 2200 px, and unknown
  or unsupported headers fall back to the browser decoder. Completed sheets
  continue to be written sequentially to disk and the sheet canvas is reused.
- Fast Print suites, image decode/rotation/fallback tests, typecheck and changed
  file formatting passed. The development build passed; a representative
  high-resolution batch proof was visually inspected. No interface layout,
  heading, action placement or styling changed in this follow-up. Previously
  pending native UI matrix and workshop-driver checks remain pending.

Artifacts: `tmp/polaroid-benchmark/optimized-polaroid-8-25/benchmark.json`,
`tmp/polaroid-benchmark/optimized-polaroid-8-100/benchmark.json`,
`tmp/polaroid-benchmark/optimized-polaroid-9-25/benchmark.json` and matching PNGs.

## Polaroid real-photo folder test - 2026-10-17

- Used all 15 JPG files in the user-provided `Downloads/Compressed/num216p`
  folder (about 1.8 MiB total, 640-1600 px dimensions, mixed portrait and
  landscape). Source SHA-256 hashes matched before and after verification.
- 8 PIC produced two landscape A4 sheets in 4.5 seconds, with seven photos and
  one blank slot on the second sheet. 9 PIC produced two portrait A4 sheets in
  4.7 seconds, with six photos and three blank slots on the second sheet. Sampled
  worker-tree working-set peaks were 782.6 and 847.9 MiB respectively; private
  memory peaks were 880.5 and 730.2 MiB. These are main-PC development results.
- Compared every placed photo against its source using independently resized
  centered-crop thumbnails. Mean RGB differences were below 2.4 out of 255 for
  all 30 placements. Verified final empty slots as white, sheet count,
  orientation, color and simplex settings. Inspected all four rendered sheets.
  Generated and rendered two-page proofs through Microsoft Print to PDF. No
  hardware printer was used.
- Observations: some originals contain sideways artwork with no EXIF rotation
  instruction; the output preserves that source orientation. Center-cover crop
  trims the edges of wide group images, sometimes removing part of a person.
  Automatic pagination works, but an in-app preview with per-photo rotation and
  crop adjustment would improve production review for these particular sources.
  No automatic rotation or source-file edits were performed.
- Only verification artifacts and this record were added in this follow-up.
  Existing native UI matrix and physical workshop-printer checks remain pending.

Artifacts: `output/fast-print-num216p/results.json`, source hash manifest and
four sheet PNGs; `output/pdf/num216p-8-pic.pdf` and
`output/pdf/num216p-9-pic.pdf`.

## Fast Print ID card preset - 2026-10-17

- Added the ID card — 9 cm preset under printer/paper/color menus, including
  saved stocks. Its standalone crop window supports up to eight images or PDF
  pages, separate front/back selections, reuse of a combined photo, independent
  corner masks, clockwise rotation, conservative rough auto crop and Reset crop.
  Low-end mode uses smaller source/preview canvases; output stays at 300 DPI.
- Both sides are 90 mm wide with proportional heights, centered independently
  on the same A4/A3 sheet coordinates. They form one two-page job without a
  batch separator. The driver draws the full physical page rather than shrinking
  to printable margins. Color and grayscale are available in the crop window.
  Automatic long-edge duplex is selected on capable printers; physical simplex
  printers pause for reinsertion before the back. PDF/XPS keeps both pages in one
  document. Canceling the reinsertion prompt reports the unprinted back, then
  closes the worker. Busy output prevents duplicate printing and cancellation.
- Visually inspected representative artwork at CSS viewports 1366x768
  English/light, 1920x1080 French/dark, 1600x900 Arabic/light and 1366x768
  Arabic/dark. Arabic checks used low-end mode. No horizontal overflow occurred;
  filenames and dimensions remain readable, output pages retain their white
  paper, and source/preview controls remain separate. Keyboard arrows and pointer
  dragging moved crop corners. Four rotations preserve a usable crop. Removing
  the back disables Print; selecting the same source for both sides enables it.
  A mocked canceled-back response retained disabled submission controls and
  finished cleanly after exactly two prepared pages.
- Real Electron worker/IPC checks loaded two PNGs for A4 color and a two-page
  PDF for A3 grayscale, then ran Windows driver validation without hardware
  printing. Both produced exactly two pages with the correct paper, orientation
  and color settings. Raster scans found zero chromatic pixels in grayscale
  output and matching front/back centers within half a pixel. A real Microsoft
  Print to PDF proof exercised physical-page drawing: both cards measured about
  90.09 mm including raster antialiasing, with center offsets below 0.05 mm.
- Fast Print geometry/crop/menu/batch tests, print API, language, appearance and
  Windows driver profile suites passed. Storybook, the production build,
  typecheck and changed-file formatting passed. Final checks were repeated after
  concurrent changes in the shared checkout settled.
- Acceptance review: ToolHeader, shared Button/ActionButton/PrintButton, tokens
  and translations are reused. Print is the only primary action. Import, mask
  editing and output each have one location. No explanatory heading subtitles
  or duplicate PDF import action were introduced. Native reinsertion prompts
  receive the renderer's English/French/Arabic copy and Arabic reading direction.
- Pending: physical automatic duplex alignment, manual reinsertion/cancel flow,
  vendor saved-stock/finishing behavior, customer-photo detection quality,
  released workshop build and subscriber publishing. These changes are local.

Artifacts: `output/playwright/fast-id-1366-en-light.png`,
`output/playwright/fast-id-1920-fr-dark.png`,
`output/playwright/fast-id-1600-ar-light.png`,
`output/playwright/fast-id-1366-ar-dark.png`,
`output/playwright/fast-id-native-a4.png`,
`output/playwright/fast-id-proof/native-A4-color/`,
`output/playwright/fast-id-proof/native-A3-mono/`, and
`output/playwright/fast-id-proof/actual-size-proof.pdf`.

## Smart Polaroid orientation and face framing - 2026-10-17

- Added local YuNet face/landmark detection at 640x640 in four quarter-turn
  orientations. The original orientation wins ambiguous cases. Clear upright
  face evidence can rotate 90, 180 or 270 degrees. Crop placement protects all
  detected face boxes with hair/forehead padding. Groups too wide for a cover
  crop use full-photo fitting with white space inside the unchanged placeholder.
  With no usable detections or an analysis failure, the complete source is kept.
  Detection cannot guarantee finding every small or obscured face.
- Model, matching ONNX Runtime WASM and loader are bundled; no photo uploads or
  runtime model downloads are required. One inference thread and one session
  per batch keep analysis bounded. Session, tensors and temporary canvases are
  released. Model provenance/hash/license are documented next to the model;
  its MIT license is included in packaged resources.
- Retested all 15 original JPGs from `Downloads/Compressed/num216p` after the
  implementation. Both presets produced two sheets. The same two sideways
  photos rotated correctly: image 3 by 270 degrees and image 7 by 90 degrees.
  The other 13 kept their orientation. Five photos used full-photo fitting;
  ten used face-protected cover crops. All detected faces were retained, all
  15 placements matched independent rotated/framed source thumbnails, and
  unused final slots remained white. All original SHA-256 hashes are unchanged.
- Final sampled main-PC runs: 8 PIC took 6.8 seconds (763.5 MiB peak working set,
  948.8 MiB private memory); 9 PIC took 6.4 seconds (812.4 MiB working set,
  664.1 MiB private memory). These include the worker process tree and Windows
  driver validation, not physical printing or workshop performance.
- Fault injection removed only the model from the isolated test build. Both
  presets still produced two valid sheets with all 15 complete photos, no
  speculative rotations and white unused slots. The model was restored before
  the final successful smart-framing runs.
- Geometry/rotation-confidence, protected-headroom, wide-group, no-face and
  decode regressions, Fast Print tests, typecheck, formatting and isolated
  development builds passed. All four smart sheet PNGs were visually inspected.
  Generated and rendered two-page Microsoft Print to PDF proofs. No hardware
  print jobs were sent and no original photo was edited.
- No interface layout, action grouping or styling was changed. Previous native
  UI matrix, packaged/offline installer, workshop driver and physical output
  checks remain pending. Changes are local and have not been published.
- AGENTS.md now preserves the user's standing instruction to use this same
  folder for future Polaroid acceptance checks.

Artifacts: `output/fast-print-num216p-smart/results.json`, per-mode framing
metadata and four PNG sheets; `output/fast-print-num216p-smart-fallback/`;
`output/pdf/num216p-smart-8-pic.pdf` and
`output/pdf/num216p-smart-9-pic.pdf`.

## Sidebar tool file drops - 2026-10-17

- Production-tool navigation icons accept compatible artwork in collapsed and
  expanded navigation. A token-based inset ring and translated tooltip identify
  the drop target and accepted formats. Existing import buttons remain the
  keyboard-accessible alternative; no headings or duplicate buttons were added.
- Card accepts one AI/EPS/PDF/PNG/JPG front design; Sequential accepts one
  PDF/PNG/JPG front design. Back artwork retains its existing import action.
  Booklet accepts PDF/PNG/JPG batches (including mixed batches); Cutter accepts
  AI/PDF/SVG/PNG/JPG. Hardcover retains its existing PDF and named front/back
  pair routing. Existing importers retain size/content checks and error handling.
- Browser checks passed for all five tools with empty, hover and loaded states:
  1366x768 English/light, 1920x1080 French/dark, 1366x768 Arabic/dark/low-end,
  and 1600x900 Arabic/light/low-end. Checked expanded and collapsed navigation,
  tooltip and target bounds, no page overflow, keyboard focus and real fixture
  imports. Representative screenshots were visually inspected; the expanded
  hover ring was moved inside the target to avoid clipping.
- Behavior checks passed for mixed Booklet imports, same-tool append, immediate
  duplicate drops, busy-drop blocking, canceling an unsaved-work prompt, normal
  keyboard navigation, incompatible-file rejection without navigation, locked
  subscription tools, and dropping an image onto Card from the Hardcover page
  without its global PDF handler intercepting the drop.
- Shared drop validation is included in test:projects. Typecheck, changed-file
  Prettier checks, project, Card, Booklet, Hardcover, Cutter, Sequential and i18n
  suites passed. Storybook builds with interactive enabled/error and busy drop
  examples. Existing Fast Print work was preserved.
- Acceptance: shared tokens/components and semantic navigation retained; one
  primary action and existing source/back import placement retained; no heading
  subtitles added; translated hints and errors, focus, busy state and validation
  checked. Existing production imports/measurements/export regressions passed.
- Pending: native Windows Explorer-to-Electron drag-and-drop verification. Browser
  QA used a local development renderer with a test account/license bridge and
  actual PNG/PDF fixtures dispatched through DataTransfer. No subscriber release,
  workshop-PC changes or hardware printing were performed.

Artifacts: `output/playwright/sidebar-drop-matrix.log`,
`output/playwright/sidebar-drop-edges.log`, `sidebar-matrix-*.png`,
`sidebar-drop-*-hover.png`, `sidebar-drop-*-loaded.png`,
`sidebar-drop-cutter-tests.log` and `sidebar-drop-storybook.log` in that directory.

## Polaroid group-photo rotation for frame coverage - 2026-10-17

- User preference: a wide group can print sideways when a 90-degree turn fills
  the Polaroid photo area better. After upright-face analysis, compare protected
  framing in that orientation against an additional clockwise quarter turn.
  Select the turn only when photo-area coverage improves by over ten percentage
  points. Both face boxes and forehead/hair padding rotate together. Existing
  no-face/error fallback and single-subject orientation remain unchanged.
- Retested all 15 originals in `Downloads/Compressed/num216p` with both presets.
  Five group photos gained the additional quarter turn. Three now fill the
  photo area completely; two very wide groups retain full-photo fitting with
  less white space. All detected face boxes remain inside the crop. The other
  ten placements retained their previous framing. Both presets still produce
  two sheets with correct final white slots, and source hashes are unchanged.
- 8 PIC took 7.1 seconds; 9 PIC took 6.8 seconds on the main PC. All placements
  matched independently rotated/framed source thumbnails (mean RGB differences
  below 1.8/255). Working-set peaks were approximately 751 and 843 MiB. No
  hardware printing was performed.
- Added regressions for improved-area quarter turns, fully covered rotated
  groups, groups requiring full-photo fitting, unchanged portraits/single
  subjects/no-face fallback, and rotated forehead protection. Fast Print suites,
  typecheck and the isolated development build passed. Inspected both presets'
  output and generated Microsoft Print to PDF proofs. No application controls,
  styles or layout were changed; existing pending native/workshop checks remain.

Artifacts: `output/fast-print-num216p-rotated/`;
`output/pdf/num216p-rotated-8-pic.pdf` and
`output/pdf/num216p-rotated-9-pic.pdf`.

Follow-up: Chromium CDP file-drag events using real filesystem PNG/PDF paths
were dropped at the center of each sidebar SVG icon while Dashboard was open.
All five tools navigated and loaded their artwork automatically. This validates
icon hit-testing and browser-native file delivery; the Windows Explorer-to-Electron
OS gesture remains pending. Artifact: `output/playwright/sidebar-icon-native-drop.log`.

## Card Montage two-file sidebar drop fix - 2026-10-17

- Removed the Card-only single-file restriction. One file retains its existing
  import behavior; two files load as front then back in dropped-file order.
  More than two files are rejected with translated guidance. Sequential retains
  its existing one-file restriction. The Card icon tooltip now explains pairs.
- Both designs finish loading before the draft is replaced. A successful pair
  enables back output and selects both previews. A corrupt second file preserves
  the previous front, back and settings. No import buttons or headings were added.
- Chromium native file-drag events dropped a distinct PNG/JPG pair onto the Card
  SVG icon from Dashboard at 1366x768 English/light, 1920x1080 French/dark,
  1366x768 Arabic/dark/low-end and 1600x900 Arabic/light/low-end. Verified both
  previews, different artwork, back-output selection, two-page PDF export and
  preservation of both sides after a corrupt back import. Screenshots were
  visually inspected; no page overflow occurred. Single-PDF page-2 assignment
  also passed. A development hot reload interrupted one repeated QA run; the
  complete rerun after the reload finished passed.
- Typecheck, project/drop-validation, Card and i18n suites, changed-file formatting
  and Storybook build passed. The shared enabled/busy drop stories include a
  two-file front/back fixture. Existing shared components, tokens, actions and
  keyboard access remain in use; no production dimensions or artwork files were
  changed. Native Windows Explorer-to-Electron gesture verification remains
  pending, as recorded above. No hardware printing or release was performed.

Artifacts: `output/playwright/card-pair-drop/results.log`, `storybook.log`,
PNG/JPG QA fixtures and four layout screenshots in the same directory.

## Direct printer > Polaroid menu - 2026-10-17

- Moved the two Polaroid commands to a single submenu directly under each
  A4/color-capable printer: Fast Print > printer > Polaroid > 8 PIC / 9 PIC.
  They use A4 and color automatically and inherit the marked default A4
  bypass/face-up profile. Removed the duplicate commands from paper/color and
  saved-stock branches. Unsupported monochrome/A3-only printers do not offer
  these color A4 presets. Updated both live Electron choices and the registry
  menu generator, saved-stock verification expectations and usage instructions.
- Menu regressions passed for path/order, unique command placement, A4/color
  defaults, unsupported devices and saved default-profile inheritance.
  Typecheck, formatting, PowerShell parsing and the isolated development build
  passed. The native worker's menu-verification mode confirmed the actual path
  for Microsoft Print to PDF. This reads menu data without hardware printing.
- Selected the two presets from that actual generated menu and retested all 15
  unchanged photos in `Downloads/Compressed/num216p`. Both produced two sheets,
  five group-area quarter turns, correct white final slots and protected face
  crops. Independent thumbnail comparisons and original hashes passed; sample
  output sheets were visually inspected. Runtime was 6.8 seconds for 8 PIC and
  6.6 seconds for 9 PIC on the main PC.
- Full `npm run test:fast-print` currently stops at an unrelated ID-card geometry
  assertion in `src/shared/fast-print-id.test.ts:22`; its width/height behavior
  is outside this menu change. Preset, menu and batch tests before that point
  passed. Direct Polaroid geometry/decode tests also passed separately.
- Acceptance: one visible home for each Polaroid command, existing native menu
  semantics and action labels retained, no added buttons or explanatory
  subtitles. Actual native-menu checks at 1366x768/1920x1080, keyboard navigation,
  theme/RTL and low-end behavior remain pending along with workshop/release
  checks. Changes remain local and unpublished.

Artifacts: `output/fast-print-num216p-menu/menu.json`, `results.json` and
per-mode sheet/framing results.

## ID photo position, straightening and real-picture checks - 2026-10-18

- ID detection now searches the complete photo for an oriented card outline.
  Selected edges determine the straightening angle before the card is measured
  and centered at 90 mm wide. The angle field supports -180° to 180°, including
  keyboard adjustment, with an independent override per side and Auto straighten
  to restore the edge-based angle. Camera perspective and missing corners remain
  approximate. The existing Rotate, crop handles and Reset crop remain available.
- The standard real-picture folder is recorded in AGENTS.md as
  `C:\Users\Maher\Downloads\ID TEST`. Both current originals are used: one GIF
  and one JPEG. Added GIF acceptance to the ID picker, validated Explorer
  selection, registration filters and native compatibility handler; GIF decoding
  uses the first frame. Source files remain unchanged.
- `npm run test:fast-print:id-real` runs an isolated local Electron canvas
  verifier against every picture in that folder. It saves local proofs and
  SHA-256 hashes, with approximate visible-edge annotations for the two initial
  pictures. Original, off-center +45° and off-center -45° cases yield six cases
  and twelve color/grayscale proofs. The annotated card coverage is at least
  99.9%, with 92-96% mask precision (some surrounding background is retained).
  Measured ink bounds are 89.75-90.09 mm wide; offsets from sheet center are
  at most 0.09 mm. Grayscale proofs contain zero chromatic pixels. Every crop,
  color and grayscale result was visually inspected in two review grids.
- Original-photo angles were about +2.7° and -1.0°. The augmented ±45° cases
  were detected at approximately ±44.96° and rendered straight. Pure geometry
  regressions additionally cover off-center placements from -70° to +89°,
  different sheet sizes, manual angles, and a card clipped at the photo edge.
- Real-data UI checks passed at 1366x768 English/light, 1920x1080 French/dark,
  1600x900 Arabic/light/low-end and 1366x768 Arabic/dark/low-end. No horizontal
  overflow occurred. Verified GIF import through the file input; changing 42.5°
  to 42.6° with ArrowUp, independent side angles, and Auto straighten restoring
  the detected angle. Shared inputs/buttons, selected semantics, translated
  field help and the single primary Print action remain in use.
- Fast Print, print API and i18n suites, the real-picture verifier, native
  Explorer DLL compilation, whole-app typecheck, production build and changed-file
  formatting passed. Build log: `.codex-id-real-build.log` (local, ignored).
- Pending: workshop hardware duplex registration and reinsertion checks,
  unusual/nonuniform backgrounds beyond this folder, and subscriber publishing.
  No hardware print jobs were sent. These changes remain local.

Artifacts: `output/fast-print-id/results.json`, the matching crop/color/mono
PNGs and `review-1.png` / `review-2.png`; real-data UI screenshots
`output/playwright/fast-id-real-1366-en-light.png`,
`output/playwright/fast-id-real-1920-fr-dark.png`,
`output/playwright/fast-id-real-1600-ar-light.png`, and
`output/playwright/fast-id-real-1366-ar-dark.png`.

## In-app printer and driver preferences - 2026-10-18

- Added Settings > Printing settings using shared Button/Input/Select/Field and
  AlertDialog patterns. It manages the app default printer, reusable per-printer
  driver presets, 24 print-option assignments, and per-app-tool preferred
  printers. Native capture opens the manufacturer's own driver settings dialog;
  profiles retain the full encrypted DEVMODE, paper dimensions, color, duplex,
  tray, copies and vendor-private settings. The app never sets Windows printer
  defaults. Deletion confirms and clears the preset's assignments.
- Preferences persist atomically with backup in the shared local Fast Print
  folder. Fast Print resolves separate settings for 8 PIC, 9 PIC, ID/color/paper
  and n-up choices, while explicit saved-stock selections retain precedence.
  Preferred printers sort first. Invalid cross-printer/paper assignments are
  rejected, and changed drivers require recapture. Existing profiles remain
  compatible; app profiles can also use driver-supported non-A4/A3 media.
- Assigned app-tool driver presets are applied through the prepared-sheet print
  worker rather than the Chromium dialog, preserving private driver options per
  job. PDF pages retain actual physical dimensions and mixed orientations;
  mismatched PDF/profile paper fails before submission. Explicit copies override
  the saved driver count. The raster path is up to 300 DPI with a 6000 px edge
  cap; exported PDFs remain untouched. With no assigned preset the existing
  dialog continues, preselecting the preferred device.
- Unit checks passed for validation, independent per-printer/option assignments,
  explicit-stock precedence, disk persistence/restart loading, backup and corrupt
  files. Existing native tests passed for full-buffer encryption/restore,
  driver/printer mismatch and unchanged Windows defaults; additional A5/copy
  metadata checks passed. Typecheck, print/Fast Print/i18n suites, production
  build and Storybook production build passed.
- Isolated Electron integration used the real preload/IPC API and Microsoft Print
  to PDF: enumerated captured profiles without exposing encrypted bytes, saved
  and reloaded assignments, rejected wrong-paper selection, deleted a preset
  without dangling links, applied a saved driver profile to a three-page mixed
  portrait/landscape A4 document, and validated an explicit three-copy override.
  Driver proof PDFs retained three pages at the correct physical A4 orientation.
  All test preferences, profiles and user data were isolated from user settings.
- Playwright checks passed at 1366x768 English/light, 1920x1080 French/dark,
  1600x900 Arabic/light and 1366x768 Arabic/dark with low-end appearance rules.
  Inspected captured layouts, no horizontal overflow. Exercised independent
  printer/8-versus-9 assignments, per-tool printer switching, paper filtering,
  delete-cancel focus restoration, keyboard Select/Escape, and empty/loading/error
  states. The production Storybook artifact was used for the final matrix.
  A Windows dev-watch EBUSY issue occurred on transient test files; generated
  artifacts were checked with a read-only static server instead. No workaround
  or unrelated watcher configuration change is included.
- Retested all 15 original photos in num216p through both actual generated menu
  choices. Each produced two sheets with five group-area rotations, protected
  faces and correct white final slots. Independent thumbnail comparisons and
  source hashes passed; final runtime was about 6.8 / 8.5 seconds on the main PC.
  A separate native ValidateOnly check also confirmed a saved Fast Print copy
  preference of two copies is retained when no explicit copy override is supplied.
- Acceptance: one primary capture action; defaults/assignments save on selection.
  Shared controls, translated labels, concise headings and semantic status/errors
  are retained. The Settings header subtitle was removed. The native driver
  dialog is intentionally vendor-owned. No duplicate Polaroid command or file
  import/export/print action was added.
- Pending: authenticated native Settings view (the isolated app's UI remained on
  sign-in, although preload/IPC integration passed), actual Konica/Epson capture
  dialog/finishing, physical duplex and tray output, low-memory workshop runtime,
  packaged installer and subscriber release. No hardware jobs were submitted;
  existing projects, artwork, source photos and user printer preferences were
  preserved. Changes are local and unpublished.

Artifacts: `output/playwright/printer-settings-*.png`,
`output/printer-settings/backend-result.json`, `app-print/driver-settings.json`,
`output/pdf/printer-settings-mixed-a4.pdf`,
`output/fast-print-num216p-menu/results.json` and matching photo sheets.

## 2026-10-19 — Native Explorer Fast Print dialog

- Supersedes the earlier Electron selector, which the user rejected. Explorer now
  launches a roughly 80 KB .NET/Windows Forms helper directly, with Windows.Data.Pdf
  previews and native printer controls. No Electron process/browser/dashboard is
  required before Print. The user's Windows Print Pictures reference takes
  precedence over the app-shell styling requirement; native system controls and
  system colors are used instead of another web styling system.
- Printer, A4/A3 paper, driver quality, color, saved profiles, orientation, copies,
  fill/fit, native vendor options, preset management and paginated source/layout
  previews are available. Polaroid 8/9 is directly below the printer and locks
  A4/color. ID retains the dedicated front/back review before printing. One output
  action, no duplicate commands or explanatory heading subtitles.
- Native UI snapshots inspected in English/French/Arabic RTL at 900×699, 1366×768,
  1920×1080, 1600×900 and 780×580. Labels, scrolling layout list, preview, controls
  and footer remain usable. Production artwork remains in its own coordinates.
  Native controls have accessible names and standard keyboard/tab/Enter/Escape
  behavior; no web animation or browser effects are used in low-end mode.
- Native integration verifies five-page/mixed-orientation PDF preview, image/PDF
  batches, final blank cells, fill-frame rendering, automatic bypass stock,
  independent option assignment and explicit-profile precedence, 3-copy encrypted
  driver handoff, source hashes and unchanged printer defaults. Actual Print to
  PDF driver checks run ValidateOnly; no hardware jobs are submitted.
- Window first-paint measurements on the main PC were approximately 0.14–0.21 s;
  initial PDF previews about 2.1–2.5 s. Cold driver/converter startup is measured
  separately. Memory for the five-page preview was around 110 MB in these runs;
  these measurements are local, not guarantees for workshop hardware.
- DOCX conversion tested with an official, checksum/signature-verified LibreOffice
  runtime extracted locally, without changing file associations. A two-page Word
  document retained its table, formatting, explicit page break and original hash;
  its temporary PDF produced the expected one four-up sheet with three copies.
  The private converter is available locally; the app installer does not bundle it.
  Microsoft Word COM conversion is implemented but unavailable for local testing.
- Main-PC Explorer registration was updated to the native executable. Actual
  Shell inspection confirms one Fast Print entry for PDF and DOCX; duplicate
  wildcard/ProgID registration was removed. Saved app settings are preserved.
- Native shell selection checks passed for 122 files, order, Unicode, ampersands
  and the 1,000-file limit. Shared request validation rejects unsafe cleanup paths,
  invalid copies, unconverted DOCX and invalid/missing driver snapshots.
- Typecheck, production build, native builds, Fast Print, print/preferences, i18n,
  appearance and driver-profile checks passed. Encrypted full-buffer round trips,
  fingerprint/printer mismatch handling and unchanged Windows defaults passed.
- All original ID TEST images and off-center ±45° variants passed 90 mm width,
  proportional height, centered color/mono proof and source-hash checks. Inspected
  crop overlays and generated proofs. Both Polaroid modes again included all 15
  num216p photos on two sheets each, with protected faces, intentional sideways
  group placements, correct blank final slots and unchanged source hashes.
- Pending: native OS dark/high-contrast appearance, physical printer output,
  vendor-specific options on workshop hardware, Word COM conversion, packaged
  installer/subscriber release and low-memory workshop startup measurements.
  The current native UI uses the OS system-color scheme rather than the app theme.

Artifacts: `output/fast-print-native-verification/results.json`, per-case native
screenshots/layout proofs/driver validation; `output/fast-print-id/` and
`output/fast-print-num216p-menu/`. Changes remain local and unpublished.

## AI sticker separation and vector export — 2026-10-21

- [x] Shared Button/ActionButton controls; file, processing and output actions are
      grouped separately, with a primary action appropriate to queue state.
- [x] One import and one export command; separation settings, output scope/format,
      queue status and errors remain beside their tasks. No new heading subtitles.
- [x] Hidden component proofs at 1366×768, 1600×900 and 1920×1080, light/dark,
      French, Arabic RTL and low-end mode. Inspected captured images after forcing a
      fresh offscreen paint; no horizontal page overflow. The settings panel scrolls.
- [x] Keyboard focus stays on visible native controls in the hidden test window.
- [x] Four representative stickers separated, exported as independent PNGs,
      processed without a model download, and transferred to Cutter with contours.
- [x] All ten stickers detected in a compact JPEG copy of the workshop screenshot;
      inspected the ten cropped PNG proofs and contact sheet. Source files unchanged.
- [x] Vector PDF crops rendered against original page crops at 0°, 90°, 180° and
      270°, including a nonzero CropBox; downsampled proof mean pixel error was zero.
- [x] Native Illustrator script exercised against a document API fixture matching
      ten complete groups and a locked background; tested source protection, copied
      coordinate bounds, outlined SVG font options, editable PDFs and failure cleanup.
- [x] Mock native import through the component retained SVG path content.
      Multi-sticker PDF regression contains vector Form objects and no raster image
      streams for the vector fixture; vector masters survive project save/open.
- [x] Detection tests cover plain gray/transparency, white artwork, thin outer
      frames, nearby lettering, blank grid cells, limits and export filenames.
- [x] Typecheck, build, sticker, Cutter, project, export and i18n checks passed.
- [x] Published v0.2.19-rc.1, verified installer SHA512 against update metadata and
      SHA256 against release checksums, and installed it on the workshop PC with
      exit code 0. The installed executable reports FileVersion 0.2.19-rc.1. The
      original `Mintech Stickers1.ai` SHA256 remained
      `cca96b4cede12578bc6d7e99e216266869900a89f3da53c53d05550a3477bc36`.
- [ ] Actual new app-to-Illustrator import, standalone exports and copy-layout
      verification remain pending: workshop coordinate input was unavailable and
      window capture timed out. Automatic approval review rejected a debugging-port
      fallback; it was not retried. Independent Illustrator exports confirmed ten
      native groups but do not count as new app integration proof.
- [ ] Full application-shell visual verification remains pending. Component proofs
      used isolated hidden windows. No hardware print jobs were submitted.

Artifacts: `output/sticker-feature-proof/report.json`, size/theme screenshots,
`workshop-contact.png` and ten `workshop-sticker-*.png` crop proofs.

Stable v0.2.19 was published and verified on 2026-10-21. Windows workflow
`39617208921` succeeded. Downloaded installer SHA512 matches `latest.yml`, and
installer/blockmap/metadata SHA256 checks passed. See
`RELEASE_0.2.19_VERIFICATION.md` for publication evidence and the remaining native
integration and antivirus-review limitations.

## Fast Print direction, named printer stocks and combined PDFs — 2026-10-22

- [x] Full page restores Original orientation. All 2/4/6/8/9/12/16-up layouts
      accept Portrait/Landscape and independent 90-degree file rotations. Same
      direction aligns to the slot before applying the manual override; photo-only
      multi-up starts with equal filled frames. PDF/Word and Full page start with fit.
- [x] Hidden native direction checks: 30 cases each in English dark, French light
      and Arabic RTL dark. English cases compare native sheets to production output
      and validate the Windows driver handoff, including portrait 2/6/8-up.
- [x] Combine files on sheets is optional and defaults off. A mixed selection of
      5-page/3-page/1-page PDFs and three photos covers 12 ordered source pages.
      All seven multi-up counts on A4/A3 were checked both combined and separate
      (28 cases per language), including copy totals and duplex boundary padding.
      English production output matches native previews; each occupied slot's
      center color independently verifies page identity/order across PDF boundaries.
- [x] Saved preset shows all stocks for the selected printer. A4/A3 stock selection
      restores paper/color and full DPAPI-protected vendor DEVMODE. Save printer
      preset uses the existing native themed buttons and real Printer properties;
      names alone do not set tray/weight. No Windows defaults are changed.
- [x] Preset-saving dialog and stock switching checked with isolated test profiles
      in EN/FR/AR, restricted to one CPU core. Hidden native captures reviewed at
      1366×768, 1920×1080, 1600×900 and 820×640. At the minimum width, the editing
      row scrolls horizontally while totals and Print remain available. One primary
      Print, one preset-management entry, no heading subtitles or duplicate actions.
- [x] The general mixed-image/PDF regression passed all 16 A4/A3 layouts, including
      one-up orientation, margins/gaps, rotation, incomplete sheets and boundaries.
      Typecheck, Fast Print behavior tests, native compile and targeted formatting
      passed. No hardware print jobs or interactive main-PC control were used.
- [ ] Live desktop DPI/keyboard traversal and vendor property-dialog appearance
      remain unverified. Actual magazine, bypass stock/weight and output-bin
      operation require verification on the workshop printers after release.
      Release 0.2.21 includes these changes. ID and Polaroid composition rules
      were not changed.

Artifacts: `output/fast-print-direction/results.json`,
`output/fast-print-combined/results.json`, `proof-order.json`,
`output/fast-print-stocks-ui/results.json`, and
`output/presets-final-proof.log`. Repeat with `test:fast-print:direction`,
`test:fast-print:combined` and `test:fast-print:presets`.
