# Reference analysis

Primary: supplied Payno dashboard image. Secondary: Crextio reference. Both are aesthetic references, not sources of banking/HR features or sample data.

## Geometry and hierarchy

The Payno composition uses a narrow icon-first rail, a compact header, and three related content columns. The largest useful task receives the strongest panel. Small actions are circles/pills, not separate large cards. Broad 22–28 px panel corners contrast with 10–14 px control corners. Estimated desktop rail width is 72–88 px; content gutters 24–32 px; panel padding 20–24 px; column gaps 16–24 px. The implementation uses 80 px rail, 24 px desktop gutters and 20 px gaps, with a 192 px optional expanded navigation.

## Color and surfaces

Use background #F2F6F8; primary surface rgba(255,255,255,.78); secondary rgba(248,250,252,.82); strong white for print preview and menus. Accent #405F8A, hover #365479. Text #172239 and secondary #6F7D90. Muted #9AA5B3 is restricted to nonessential decorative metadata, never required labels. Borders rgba(100,120,145,.12), dividers .08. Hover rgba(210,222,233,.36), selection rgba(64,95,138,.10). Success/warning/error are muted functional colors. These values are supplied by the user and used in Figma and code.

The perceived glass comes from pale layered surfaces and white edge highlights. Do not reproduce the large blurred blue backdrop in the artwork as a live effect. No backdrop filter is required. Soft opaque colors are appropriate in performance mode.

## Typography and controls

Segoe UI/system sans requires no additional network font. Page titles 24–28 px/600, sections 16–18 px/600, card titles 14–16 px/500–600, UI 13–14 px/400–500, metadata 11–12 px. No oversized editorial serif headings. Lucide is the single icon family with regular outline stroke, 16–20 px for controls. Standard controls are 36 px, compact 32 px, main actions 40 px.

## Rhythm and depth

Spacing tokens: 4, 8, 12, 16, 20, 24, 32, 40, 48 px. Radius tokens: 8, 10, 14, 18, 22, 28 px. Shadows: 0 6px 24px rgba(35,55,75,.04), 0 12px 40px rgba(35,55,75,.055). Surface separation and alignment lead; shadows are secondary. Motion is limited to 160 ms hover/focus and menu feedback; reduced motion and low-end preset remain supported.

## Translation to print production

Home foregrounds recent project files, truthful job counts, import/new shortcuts and original module names. The left rail remains light and provides accessible tooltips. Workspaces prioritize the print sheet/canvas, with compact primary commands, document/assets on the left and properties on the right where the existing architecture supports it. Output colors, cutlines, marks and artwork must retain their production semantics.

The second reference supports orderly region grouping and a restrained navy selected state. Its portraits, fake progress charts and HR navigation are not included. No invented numbers, customers, charts or productivity statistics are displayed.
