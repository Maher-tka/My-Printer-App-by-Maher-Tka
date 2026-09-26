# AI Sticker Maker

Open **Cutter Montage → AI Sticker Maker**. Add JPG, PNG, or WebP images, select each design to set its own artwork width and copy count, choose the cut offset, and select **Process all**. Each item is processed independently. Review Original, Result, Mask, and Cut preview. In Mask view, use Erase or Restore to correct the alpha mask; Undo, Redo, and Reset AI are available before sending. Select **Send to Cutter** to arrange the requested copies on the production sheet. In Cutter Montage's Layout view, select a sticker on the left to change its copy count or finished width.

## Architecture

- `components/AIStickerMaker.tsx` owns the processing queue and preview.
- `lib/stickerMaker.ts` runs the MIT-licensed [BiRefNet Lite 512 model](https://huggingface.co/studioludens/birefnet-lite-512) using Transformers.js and ONNX Runtime Web on the local machine. The first run downloads about 192 MB. Transformers.js uses the browser model cache on later runs. Input images are not uploaded.
- The model returns RGBA artwork. Its alpha is applied to the original image at full resolution to produce a transparent PNG. A bounded mask is used for manual correction and vector tracing. Brush edits rebuild the full-resolution PNG from the untouched source without rerunning AI. `clipper-lib` applies a geometric round-join offset. The output is a closed normalized SVG path.
- `useCutterProject.addStickerResults` inserts the PNG and vector path as grouped Artwork and CutContour objects in the existing project model. They share piece placement, rotation, duplication, save/reload, and the existing PDF/SVG/EPS export paths.
- The existing layered PDF export creates **Artwork**, hidden **CutContour**, and **FC RegisterMark Layer1**. This matches the production roles in the Illustrator references.
- Artwork width set in AI Sticker Maker regenerates the cut path from the cached mask and preserves the chosen physical offset. Cutter Montage's **Finished width** control scales the already finished artwork and vector cutline together, including its cut margin, then rearranges copies.

## Current limits

- This first pass uses the browser model cache. Packaged offline persistence and a model integrity/download manager still need verification on the target Windows installation.
- Mask brush history and the processing queue stay available when switching between AI Sticker Maker and Cutter Montage within the same project session. They are not yet serialized into the saved Cutter project; already sent stickers are saved normally.
- Several disconnected foreground regions produce separate external cut paths and a review warning. Internal holes are excluded.
