# v0.2.11 — Cutter sticker sizing and cut edge precision

- Cutter Width/Height now measure the finished sticker using its clipping mask
  or cutting line. Resizing preserves the artwork crop and scales all related
  objects together, including locked objects and large source images.
- Step 2 centers and fits the finished sticker and cutting margin. Fit view and
  returning to this step reset panning and zoom while preserving source coordinates
  and production geometry.
- Moved Cut edge precision beneath the main preview with a larger close-up,
  top/right/bottom/left edge views, and 6/12/24 mm inspection spans. Offset, trim,
  directional adjustments, and mask matching remain together in one workspace.
- Improved light/dark feedback and French/Arabic translations. Locked contours
  remain available for inspection while editing controls are disabled.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually.

Validation covers sticker sizing and focused-view regressions, recorded layout
checks at 1366×768, 1600×900, and 1920×1080, light/dark themes, Arabic RTL,
low-end mode, and keyboard interaction. The full release checks run before
publication. Verification with the customer's original project, installed-build
behavior, and physical print/cut hardware remains pending. The existing long
Arabic AI Sticker Maker navigation label remains outside this change.
