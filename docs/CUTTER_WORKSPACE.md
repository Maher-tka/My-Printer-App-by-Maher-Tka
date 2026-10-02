# Cutter step workflow

Use **Expand canvas** in artwork editing or Production Layout to work with the canvas and its tools across the screen. Press **Escape** or click **Restore workspace** to return to the settings and artwork library at their usual sizes. Expansion changes only the view; it preserves artwork dimensions and the production layout.

The workflow starts with four tabs:

1. Prepare artwork: select a sticker, draw a rectangle/oval/path to mask unwanted parts, and apply/release clipping. Switch the preparation subpanel to Background to remove a selected solid edge-connected color or add a solid color behind transparency. The canvas uses a checkerboard for transparency. Background editing is local, supports images up to 16 megapixels subject to the app memory budget, and is not AI subject segmentation. PDF/SVG previews become PNG at preview resolution when edited; this is disclosed in the panel.
2. Cut lines: create a contour around the mask/artwork, or draw and use a custom shape. Layers, properties and alignment remain available for editing.
3. Quantities: enter copies for every sticker. Enter or leaving a quantity field commits it. Counts are independent.
4. Layout & export: review the arranged sheets and export with the existing print/cut options.

The artwork/sticker library stays visible on the left in all four steps of the normal workspace. Clicking a sticker selects it without changing the current step. Each design retains its own artwork, mask, contours and quantity. Background edits create a separate PNG source for the edited piece, so another sticker sharing its former source is unchanged; old sources remain available for editor undo.

Verification: cutter suite, background algorithm tests, independent artwork-source/geometry tests, TypeScript checks, and a 1366 x 768 browser walkthrough using two artworks, separate cut contours and quantities 7 and 3.
