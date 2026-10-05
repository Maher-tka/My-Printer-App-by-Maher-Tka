import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { PDFDocument } from 'pdf-lib'
import {
  assertEpsImportRequest,
  getEpsDimensions,
  EPS_CONVERSION_ERROR,
  MAX_EPS_BYTES,
  type EpsImportResult
} from '../shared/eps-import.js'

const execute = promisify(execFile)
let pending = false

export function createEpsImportScript(epsPath: string, pdfPath: string): string {
  return `(function(){
 var previous=app.userInteractionLevel,doc=null;
 try {
  app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
  doc=app.open(new File(${JSON.stringify(epsPath)}));
  if(!doc.pageItems.length)throw new Error('The EPS contains no artwork.');
  if(!doc.artboards.length||doc.artboards.length>200)throw new Error('Import up to 200 EPS artboards at a time.');
  var sizes=[];
  for(var i=0;i<doc.artboards.length;i++){
   var box=doc.artboards[i].artboardRect,w=box[2]-box[0],h=box[1]-box[3];
   if(!isFinite(w)||!isFinite(h)||w<=0||h<=0)throw new Error('The EPS has invalid artboard dimensions.');
   sizes.push('['+w+','+h+']');
  }
  for(var i=0;i<doc.placedItems.length;i++){
   if(!doc.placedItems[i].file.exists)throw new Error('The EPS has a missing linked image. Embed images before importing.');
  }
  var options=new PDFSaveOptions();options.preserveEditability=false;
  options.compatibility=PDFCompatibility.ACROBAT7;options.generateThumbnails=false;
  options.viewAfterSaving=false;options.artboardRange='';
  doc.saveAs(new File(${JSON.stringify(pdfPath)}),options);
  return '['+sizes.join(',')+']';
 }finally{
  if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}finally{app.userInteractionLevel=previous;}}
  else app.userInteractionLevel=previous;
 }
})()`
}

export function validateConvertedEpsPdf(pdf: PDFDocument, artboards: unknown): void {
  if (
    !Array.isArray(artboards) ||
    !artboards.length ||
    artboards.length > 200 ||
    artboards.some(
      (size) =>
        !Array.isArray(size) ||
        size.length !== 2 ||
        size.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    )
  )
    throw new Error('The EPS conversion returned invalid artboard dimensions.')
  if (pdf.getPageCount() !== artboards.length)
    throw new Error('EPS artboards were lost during conversion. Export all artboards as PDF.')
  pdf.getPages().forEach((page, index) => {
    const [width, height] = artboards[index] as number[]
    if (Math.abs(page.getWidth() - width) > 0.1 || Math.abs(page.getHeight() - height) > 0.1)
      throw new Error(
        'EPS artboard dimensions changed during conversion. Export it as PDF from the original design.'
      )
  })
}

export async function importEpsArtwork(
  request: unknown,
  tempRoot: string
): Promise<EpsImportResult> {
  let folder: string | undefined
  let ownsOperation = false
  try {
    assertEpsImportRequest(request)
    if (process.platform !== 'win32')
      throw new Error(
        'EPS import requires Windows and Adobe Illustrator. Export the EPS as PDF to import it on this computer.'
      )
    if (pending) throw new Error('An EPS import is already running. Wait for it to finish.')
    pending = true
    ownsOperation = true
    folder = await mkdtemp(join(tempRoot, 'my-printer-eps-'))
    const epsPath = join(folder, 'artwork.eps')
    const pdfPath = join(folder, 'artwork.pdf')
    const scriptPath = join(folder, 'convert.jsx')
    await writeFile(epsPath, request.bytes)
    getEpsDimensions(request.bytes)
    await writeFile(scriptPath, createEpsImportScript(epsPath, pdfPath), 'utf8')
    const literal = scriptPath.replace(/'/g, "''")
    const ps = `$ErrorActionPreference='Stop';$illustrator=New-Object -ComObject Illustrator.Application;$result=$illustrator.DoJavaScriptFile('${literal}');Write-Output $result`
    const { stdout } = await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(ps, 'utf16le').toString('base64')
      ],
      { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 }
    )
    const size = (await stat(pdfPath)).size
    if (!size || size > MAX_EPS_BYTES)
      throw new Error('The converted EPS is empty or larger than 30 MB.')
    const bytes = await readFile(pdfPath)
    const pdf = await PDFDocument.load(bytes)
    // Each native artboard must become its own PDF page, in the original order.
    // The EPS BoundingBox describes the combined artwork, not an individual side.
    validateConvertedEpsPdf(pdf, JSON.parse(stdout.trim()))
    return { ok: true, bytesBase64: bytes.toString('base64') }
  } catch (error) {
    console.error('[eps-import]', error)
    return {
      ok: false,
      error: EPS_CONVERSION_ERROR
    }
  } finally {
    if (folder) await rm(folder, { recursive: true, force: true }).catch(() => undefined)
    if (ownsOperation) pending = false
  }
}
