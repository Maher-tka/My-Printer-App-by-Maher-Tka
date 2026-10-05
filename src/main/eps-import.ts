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

export function createEpsImportScript(
  epsPath: string,
  pdfPath: string,
  dimensions: { widthPt: number; heightPt: number }
): string {
  return `(function(){
 var previous=app.userInteractionLevel,doc=null;
 try {
  app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
  var size=${JSON.stringify(dimensions)};
  doc=app.documents.add(DocumentColorSpace.CMYK,size.widthPt,size.heightPt);
  var artwork=doc.placedItems.add();artwork.file=new File(${JSON.stringify(epsPath)});
  if(Math.abs(artwork.width-size.widthPt)>1||Math.abs(artwork.height-size.heightPt)>1)
   throw new Error('The EPS artwork size does not match its bounding box. Export it as PDF from the original design.');
  artwork.position=[0,size.heightPt];artwork.embed();
  if(!doc.pageItems.length)throw new Error('The EPS contains no artwork.');
  for(var i=0;i<doc.placedItems.length;i++){
   if(!doc.placedItems[i].file.exists)throw new Error('The EPS has a missing linked image. Embed images before importing.');
  }
  var options=new PDFSaveOptions();options.preserveEditability=false;
  options.compatibility=PDFCompatibility.ACROBAT7;options.generateThumbnails=false;
  options.viewAfterSaving=false;options.artboardRange='1';
  doc.saveAs(new File(${JSON.stringify(pdfPath)}),options);
  return 'EPS converted';
 }finally{
  if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}finally{app.userInteractionLevel=previous;}}
  else app.userInteractionLevel=previous;
 }
})()`
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
    const dimensions = getEpsDimensions(request.bytes)
    await writeFile(scriptPath, createEpsImportScript(epsPath, pdfPath, dimensions), 'utf8')
    const literal = scriptPath.replace(/'/g, "''")
    const ps = `$ErrorActionPreference='Stop';$illustrator=New-Object -ComObject Illustrator.Application;$result=$illustrator.DoJavaScriptFile('${literal}');Write-Output $result`
    await execute(
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
    if (!pdf.getPageCount()) throw new Error('The converted EPS has no printable page.')
    const page = pdf.getPage(0)
    if (
      Math.abs(page.getWidth() - dimensions.widthPt) > 0.1 ||
      Math.abs(page.getHeight() - dimensions.heightPt) > 0.1
    )
      throw new Error(
        'EPS dimensions changed during conversion. Export it as PDF from the original design.'
      )
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
