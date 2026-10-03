# v0.2.4 — Metre orders and easier production PDF export

Sticker orders can now use **Copies** or **By metre** in the Quantities step and the layout artwork library. Metre orders calculate the copies that fit across the usable roll width, reserve cutter margins and spacing, and keep the requested vertical production length fixed. Supported section lengths are 0.5–1.4 m. Invalid values or designs that cannot fit leave the previous order intact.

**Export PDF** is directly available in the Layout & export toolbar and the export panel. It saves the arranged layouts together at their physical sheet sizes using the selected output preset. Print at **100% / Actual size**.

Print-only PDF export no longer requires a CutContour. Print-and-cut and cut-only outputs still require valid visible cut lines, and artwork outside the production sheet remains blocked.

Hardcover print/export proceeds directly when preflight allows output. Blocking preflight failures still require resolution.

This is a stable subscriber release. Installed Setup builds receive it through the automatic-update feed. Save your work before using **Settings → Restart to update**, or close the app after the download is ready. Portable builds are updated manually.

Release checks include formatting, TypeScript, production export/preflight regressions, the full test suite, Storybook, and the production build. Physical printer and cutter compatibility remains part of workshop testing.
