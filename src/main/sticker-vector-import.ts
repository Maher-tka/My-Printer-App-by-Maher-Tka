import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  assertStickerVectorImportRequest,
  type StickerVectorImportResult
} from '../shared/sticker-vector-import.js'
import {
  runIllustratorPdfScript,
  getIllustratorExportErrorMessage,
  isIllustratorExportTimeout,
  isIllustratorJobUnfinished
} from './illustrator-export-runner.js'

let pending = false
let unfinishedFolder: string | undefined

/** Open only a private input copy. Native groups include artwork outside printable artboards. */
export function createStickerVectorImportScript(inputPath: string, outputFolder: string): string {
  return `(function(){
 var previous=app.userInteractionLevel,previousDoc=app.documents.length?app.activeDocument:null,source=null,output=null,complete=false;
 function children(container){var result=[];for(var i=0;i<container.pageItems.length;i++){var item=container.pageItems[i];if(item.parent===container)result.push(item);}return result;}
 function boundsOf(item){if(item.typename==='GroupItem'&&item.clipped){var direct=children(item);for(var i=0;i<direct.length;i++){var p=direct[i];if(p.clipping)return p.geometricBounds;if(p.typename==='CompoundPathItem'&&p.pathItems.length&&p.pathItems[0].clipping)return p.geometricBounds;}}return item.visibleBounds;}
 function visible(item){if(item.hidden||item.locked||item.guides)return false;var p=item.parent;while(p&&p.typename==='Layer'){if(!p.visible||p.locked)return false;p=p.parent;}return true;}
 var candidates=[];
 function collect(item){if(visible(item))candidates.push(item);}
 try{app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
 source=app.open(new File(${JSON.stringify(inputPath)}));
 for(var i=0;i<source.pageItems.length;i++){var item=source.pageItems[i];if(item.parent.typename==='Layer')collect(item);}
 if(!candidates.length||candidates.length>500)throw new Error('No complete sticker groups found, or more than 500 objects. Group each sticker in Illustrator before importing.');
 var records=[];
 for(var i=0;i<candidates.length;i++){
  var original=candidates[i];source.activate();var box=boundsOf(original);
  var w=box[2]-box[0],h=box[1]-box[3];if(!isFinite(w)||!isFinite(h)||w<=0||h<=0)continue;
  output=app.documents.add(source.documentColorSpace,w,h);
  var copy=original.duplicate(output.layers[0],ElementPlacement.PLACEATEND);copy.locked=false;copy.hidden=false;
  var copiedBox=boundsOf(copy);
  output.artboards[0].artboardRect=[copiedBox[0],copiedBox[1],copiedBox[2],copiedBox[3]];
  var stem=${JSON.stringify(outputFolder.replace(/\\/g, '/'))}+'/sticker-'+i;
  var svg=new ExportOptionsSVG();svg.embedRasterImages=true;svg.fontType=SVGFontType.OUTLINEFONT;svg.coordinatePrecision=5;svg.documentEncoding=SVGDocumentEncoding.UTF8;svg.cssProperties=SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;svg.saveMultipleArtboards=false;
  output.exportFile(new File(stem),ExportType.SVG,svg);
  var pdf=new PDFSaveOptions();pdf.preserveEditability=true;pdf.compatibility=PDFCompatibility.ACROBAT7;pdf.artboardRange='1';pdf.viewAfterSaving=false;
  output.saveAs(new File(stem+'.pdf'),pdf);
  records.push(i);output.close(SaveOptions.DONOTSAVECHANGES);output=null;
 }
 complete=true;return records.join(',');
 }finally{if(output)try{output.close(SaveOptions.DONOTSAVECHANGES);}catch(ignore){}if(source)try{source.close(SaveOptions.DONOTSAVECHANGES);}catch(ignore){}if(previousDoc)try{previousDoc.activate();}catch(ignore){}app.userInteractionLevel=previous;try{var status=new File(${JSON.stringify(join(outputFolder, 'status.txt'))});status.encoding='UTF-8';if(status.open('w')){status.write(complete?'complete':'error');status.close();}}catch(ignore){}}
})()`
}

export async function importStickerVectors(
  request: unknown,
  tempRoot: string
): Promise<StickerVectorImportResult> {
  let folder: string | undefined
  let owns = false,
    timedOut = false
  try {
    assertStickerVectorImportRequest(request)
    if (process.platform !== 'win32')
      throw new Error('Native AI sticker import requires Windows and Adobe Illustrator.')
    if (unfinishedFolder) {
      if (
        await isIllustratorJobUnfinished(
          join(unfinishedFolder, 'status.txt'),
          join(unfinishedFolder, 'run.ps1.process')
        )
      )
        throw new Error(
          'Illustrator is still finishing the previous sticker import. Wait for it to finish before retrying.'
        )
      await rm(unfinishedFolder, { recursive: true, force: true }).catch(() => {})
      unfinishedFolder = undefined
    }
    if (pending)
      throw new Error('An AI sticker import is already running. Wait for Illustrator to finish.')
    pending = true
    owns = true
    folder = await mkdtemp(join(tempRoot, 'my-printer-vector-stickers-'))
    const input = join(folder, 'source.ai'),
      script = join(folder, 'extract.jsx')
    await writeFile(input, request.bytes)
    await writeFile(script, createStickerVectorImportScript(input, folder), 'utf8')
    await writeFile(join(folder, 'status.txt'), 'queued', 'utf8')
    const output = await runIllustratorPdfScript(script, join(folder, 'run.ps1'))
    const indices = output.split(',').map(Number)
    if (
      !output ||
      !indices.length ||
      indices.length > 500 ||
      indices.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 500)
    )
      throw new Error('Illustrator did not return any complete sticker groups.')
    const names = new Set(await readdir(folder))
    const stickers = []
    let totalBytes = 0
    for (const index of indices) {
      if (!names.has(`sticker-${index}.svg`) || !names.has(`sticker-${index}.pdf`))
        throw new Error('Illustrator did not save both vector formats for each sticker.')
      const svg = await readFile(join(folder, `sticker-${index}.svg`)),
        pdf = await readFile(join(folder, `sticker-${index}.pdf`))
      totalBytes += svg.length + pdf.length
      if (totalBytes > 200 * 1024 * 1024)
        throw new Error(
          'The separated vector artwork exceeds 200 MB. Import fewer groups at a time.'
        )
      const document = await PDFDocument.load(pdf)
      if (document.getPageCount() !== 1)
        throw new Error('Each vector sticker must have one PDF page.')
      const page = document.getPage(0)
      stickers.push({
        name: `${request.fileName.replace(/\.[^.]+$/, '')} - sticker ${String(index + 1).padStart(3, '0')}`,
        widthMm: (page.getWidth() * 25.4) / 72,
        heightMm: (page.getHeight() * 25.4) / 72,
        svgBase64: svg.toString('base64'),
        pdfBase64: pdf.toString('base64')
      })
    }
    return { ok: true, stickers }
  } catch (error) {
    timedOut = isIllustratorExportTimeout(error)
    if (timedOut) unfinishedFolder = folder
    return {
      ok: false,
      error:
        error instanceof Error && !('stderr' in error) && !timedOut
          ? error.message
          : getIllustratorExportErrorMessage(error)
    }
  } finally {
    // Do not remove a working file while a timed-out COM call can still be using it.
    if (folder && !timedOut) await rm(folder, { recursive: true, force: true }).catch(() => {})
    if (owns) pending = false
  }
}
