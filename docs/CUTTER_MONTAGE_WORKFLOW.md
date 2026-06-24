# Cutter Montage workflow

1. Import PNG, JPG, or SVG artwork into the Piece Library.
2. Rename the preset, set its final physical size and quantity, then open Piece Editor.
3. Draw a helper ellipse/rectangle, select it with the artwork, and make the clipping mask.
4. Create or duplicate the mask as a CutContour. Keep the spot name `CutContour`.
5. Save the preset. Duplicate it when the same design needs another finished size.
6. Add the required quantities to the sheet or use Auto Arrange. Largest-first is the reliable mixed-size default.
7. Lock manually placed pieces before arranging; locked pieces stay fixed. Undo Arrange restores the previous layout.
8. Review the Preflight Check. Red outlines are outside the sheet; orange outlines overlap another piece.
9. Select Print + Cut, Print only, or Cut only and export SVG first.
10. Open the SVG in Illustrator/Inkscape, verify physical dimensions and groups, then test the same file through FineCut/RasterLink.

Projects save as shared `.mpjob` files through native desktop dialogs. Source bytes are embedded for reliable reopen; transient object URLs are rebuilt on load.
