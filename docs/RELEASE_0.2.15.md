# v0.2.15 - Size stickers from the cut contour

- Finished sticker width and height now come from the actual cut contour,
  including its cut margin. Empty space around AI Sticker Maker artwork no
  longer inflates the measurement. Setting a finished width of 100 mm measures
  100 mm across the cut contour, with artwork and masks resized alongside it.
- Custom paths are measured from drawn geometry, including polygon subpaths
  and curve extrema. Cut-view fitting follows the contour instead of the
  surrounding source-image frame.
- AI Sticker Maker transfers retain the original PNG and clip it to the cut
  boundary. White artwork inside the contour is preserved, while unused source
  padding no longer enlarges layout footprints. Previously imported AI stickers
  gain this contour clip when their finished width is changed.
- New cutter layouts default to a 3.5 mm minimum gap between production
  footprints. Saved projects retain their chosen spacing; use Sheet setup →
  Copy spacing to change an existing layout. Grid snapping and irregular
  contours can leave larger gaps.
- Contour-based measurements are used consistently in the cutter library,
  quantities, editor heading and piece properties, with French and Arabic
  measurement help.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually.

Validation includes the full release checks, contour bounds and resizing
regressions, production spacing, legacy AI transfers, project round trips and
PDF output. The Sticker Maker → Cutter workflow was inspected at 1366×768,
1600×900 and 1920×1080 with light/dark themes, French, Arabic RTL, keyboard
editing and low-end mode. Live AI inference on the photographed original,
released workshop-build and physical print/cut verification remain pending;
see UI_REGRESSION_CHECKLIST.md for the recorded checks.
