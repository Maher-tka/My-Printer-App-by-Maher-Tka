# Production audit and staged plan

This is a working audit of the existing Electron, React, and TypeScript app. The
repository already has booklet, cutter/sticker, hardcover, sequential numbering,
jobs, licensing, and Fast Print modules. It also has PDF/SVG/EPS export paths,
autosave recovery, preflight checks, and automated regression tests. Existing
uncommitted work was left intact.

## Findings

| Priority | Finding | Status |
| --- | --- | --- |
| Critical | Project save wrote directly over the only job file. A partial write could damage the project. | Fixed: temporary write, flush, replacement, and previous-version backup. |
| High | Concurrent saves to the same path could finish out of order. | Fixed: writes to each path now run in request order. |
| High | Autosave and recent-project metadata also used direct JSON writes. | Fixed: both now use atomic replacement. |
| High | Project serialization embeds source bytes as base64 in JSON in the renderer, then copies the full project through Electron IPC and stringifies it in the main process. Large jobs may cause memory spikes and pauses. | Open; measure with large production fixtures before changing the file format. |
| High | Custom cutter paths with a nonzero offset are exported through an enlarged transform rectangle. That scales the path and is not a true geometric offset. The sticker maker has a separate polygon-offset implementation. | Open; unify path geometry across SVG, PDF, EPS, preview, and preflight. |
| Medium | Unit conversions are implemented separately in booklet, cutter, hardcover, and sequential modules. | Open; consolidate only after cross-module physical-size fixtures exist. |
| Medium | Project envelope validation checks much of each payload only by broad shape. Malformed nested data may reach a tool before detection. | Open; add versioned schema validation and partial recovery. |

## Implementation order

1. Finish Phase 1 by exercising save/recovery and large-file import/export with representative customer-sized fixtures. Preserve old project compatibility.
2. Make physical dimensions, transforms, and cut-path offsets consistent in every production export. Compare print/cut files from one origin and add round-trip fixtures.
3. Reduce large-project memory use without changing the visible workflow. Move heavy serialization away from the UI thread and avoid duplicate in-memory source copies.
4. Improve shared document/layer behavior, then refine canvas controls and module integration.
5. Run the full regression, production build, packaged Windows launch, and real device output checks before declaring a release ready.

The automated baseline passed and the development app launched. Real printer and
cutter output, older customer projects, large PDFs, and a clean-machine package
still need hands-on verification.
