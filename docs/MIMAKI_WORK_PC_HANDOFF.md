# Mimaki work-PC handoff

## Implemented

In Layout & export, open Export and use **Prepare in Illustrator / FineCut** for the selected layout. This Windows-only handoff exports an SVG at physical size and calls Illustrator through its registered COM scripting interface. It prepares three native layers, named Artwork, CutContour, and FC RegisterMark Layer1, and saves native AI plus PDF with Illustrator editing data. CutContour is hidden and nonprinting when saved, then shown and selected in the open document for the operator. It never calls a cutter transport, print method, or FineCut Plot automatically.

The source SVG, preparation JSX, AI/PDF (when successful), and failure diagnostics are stored in the app-data cutting-jobs folder. Illustrator must be installed and activated. Use the generated print PDF at 100% scale; on the USB-connected work PC, use FineCut Plot and Detect Mark, and check the detected geometry before sending the job. Native preparation and physical recognition are separate checks.

## Reference comparison

Inspected the six PDFs in the user's test vinnyl/vinyle folder. Five contain FC RegisterMark Layer1, hidden Calque 2 knife paths, and black CMYK Separation colorants MimakiFCRM / MimakiFCRMDir. The 1m vinyle - 5.pdf sample only has one visible artwork layer.

The app PDF now uses those registration spot names with CMYK black tint, connected Type 1 L paths with a 1 mm stroke, butt caps, miter joins, and the bottom direction triangle. Sample sahbi 1 e.pdf uses a 2.835 pt registration stroke and 0.25 pt contour stroke. The app uses exact mm-to-point conversion (2.834645669 pt for 1 mm). These numerical agreements do not establish successful physical registration.

## Validation and remaining limits

TypeScript, cutter export tests, PDF spot/operator assertions, and script tests with a mock Illustrator document verify layer/spot setup, hidden/nonprinting saved contours, dimension guard, and restoration of interaction settings. Poppler-rendered PDF marks were visually inspected.

Local Illustrator COM responded to a version query (30.3.0), but native preparation did not complete: an initial remote-procedure failure was followed by an import/preparation call that remained pending. No native AI/PDF output was produced by that local end-to-end test. The generated JSX now suppresses document alerts and SVG uses the SVG 1.1 xlink image namespace; these changes still require an end-to-end Illustrator check on the activated work PC.

Standalone USB cutting is NOT implemented. No official CG-130AR transport/register-mark SDK has been supplied and no cutter is connected to this PC. Do not represent the existing simulation or handoff as device output. FineCut's vendor release notes state that third-party register-mark recognition is supported for marks created using Mimaki Register marks SDK. Matching names and geometry alone is not proof of that metadata compatibility.

Official sources:
- https://mimaki.com/product/software/cutting/fine-cut9-ai/software.html?software=444530
- https://mimaki.com/manual/cg-ar-series/operation_manual/en-US/1014576907.html
- https://mimaki.com/download/sdk/ (registration/login required; MDL printer SDK coverage is not automatically CG-130AR coverage)
