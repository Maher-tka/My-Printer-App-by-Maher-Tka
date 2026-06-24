# Cutter Montage manual QA

Use Developer Test Mode or import a real PNG/JPG/SVG logo.

1. Import an image with a white background.
2. Open Piece Editor and draw an ellipse around the logo.
3. Select artwork plus ellipse and choose Make Clipping Mask.
4. Press Ctrl+C, then Ctrl+F. Confirm the pasted shape has identical x/y/w/h/rotation.
5. Convert the duplicate to CutContour and set it as the key object.
6. Align artwork and mask to the key CutContour; the key object must not move.
7. Save the piece, set quantity to 20, and add it to the sheet.
8. Run Auto Arrange and verify overlap/out-of-bounds preflight.
9. Export SVG Print + Cut and SVG Cut Only.
10. Open each SVG in Illustrator or Inkscape.
11. Confirm Artwork and CutContour groups, vector cutlines, no cutline rasterization, and physical sheet size.

The dev-only **Create Test Cutter Project** button creates 20 prepared copies on the 95 × 120 cm sheet. **Create Test Montage (100)** is the low-end performance stress sample.
