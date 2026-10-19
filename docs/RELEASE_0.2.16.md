# v0.2.16 - Printer preferences and safer production workflows

- Manage the app's default printer and saved manufacturer driver presets in
  Settings > Printing settings. Assign independent presets to production tools,
  Fast Print layouts, ID cards, and Polaroid modes. Presets retain paper, tray,
  stock, duplex, copies, and driver-owned settings without changing Windows
  printer defaults. Invalid printer, paper, or driver assignments report an error.
- Print ID cards through Fast Print with independent front/back corner masks,
  automatic rough cropping and straightening, rotation adjustment, color or
  grayscale, and automatic or manual duplex. Cards print 90 mm wide with
  proportional height and matching front/back centers.
- Choose Polaroid > 8 PIC or 9 PIC directly under the selected Fast Print printer.
  Both use A4/color automatically, paginate complete photo batches, and leave
  unused final slots blank. Local face detection improves orientation and
  framing; group photos may intentionally rotate sideways for better coverage.
- Drop supported artwork onto a production tool in the sidebar to open it and
  import the files. File batches are validated before import, with format and
  front/back limits appropriate to each tool.
- Keep Hardcover work open if its recovery save fails during a tool switch.
  Scheduled recovery saves now also report disk-write failures returned by the
  desktop service. A successful Hardcover retry clears the warning.
- Make job and customer deletion use the latest saved records before updating
  the interface. Lists now match persisted records at the storage limit, and
  shared validation prevents malformed optional job fields from reaching the
  interface or backup restoration.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually. Saved projects, original artwork,
and Windows printer defaults are preserved.

Validation covers the full release checks, project and recovery regressions,
job/customer persistence, print preferences, ID/Polaroid geometry, and the
recorded browser workflow checks at desktop sizes, in light/dark themes, French,
Arabic RTL, and low-end mode. Photo proofs do not submit hardware print jobs.
Vendor-specific Konica/Epson finishing, physical duplex/tray alignment, and
low-memory workshop performance still require hardware verification. See
UI_REGRESSION_CHECKLIST.md and APP_AUDIT_2026-10-18.md for the detailed scope.
