# Cutter export notes

SVG is the recommended first verification format. Its root width/height and viewBox use millimeters, Artwork and CutContour are separate groups, active masks become clip paths, and CutContour geometry stays as vector rect/ellipse/path elements with `fill="none"` and `data-spot-name="CutContour"`.

In Illustrator or Inkscape, verify:

- document size matches the montage sheet;
- Artwork and CutContour groups are present for Print + Cut;
- Print only has no CutContour group;
- Cut only has no Artwork group;
- cut paths are editable vectors, not images;
- one physical sticker measures the intended width/height.

In FineCut/RasterLink, verify that the plugin recognizes `CutContour`, preserves the spot name, and uses the intended units and origin.

PDF keeps physical page dimensions and vector cutlines where the PDF model supports them. EPS is a compatibility test: layer preservation and transparency vary by software, so SVG should be approved before relying on EPS.
