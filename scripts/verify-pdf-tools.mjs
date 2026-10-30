// Hidden Electron proof: never opens a desktop window or sends a print job.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(import.meta.dirname, '..'),
  output = join(root, 'output/pdf-tools')
const port = 5217,
  origin = `http://127.0.0.1:${port}`
process.chdir(root)

if (!process.versions.electron) {
  await mkdir(output, { recursive: true })
  await mkdir(join(root, 'tmp'), { recursive: true })
  const { build } = await import('esbuild')
  await build({
    entryPoints: [join(root, 'src/main/pdf-files.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    outfile: join(root, 'tmp/pdf-native-proof.cjs')
  })
  await writeFile(
    join(root, 'tmp/pdf-native-proof-preload.cjs'),
    `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('pdfBridgeProof',{memory:()=>ipcRenderer.invoke('pdf:machine-memory'),select:kind=>ipcRenderer.invoke('pdf:select-files',kind),read:id=>ipcRenderer.invoke('pdf:read-selected-file',id)});`
  )
  const { PDFDocument, rgb, degrees } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  for (let index = 0; index < 4; index++) {
    const page = pdf.addPage([595, 842])
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.96, 0.97, 0.99) })
    page.drawText(`PDF WORKSPACE / PAGE ${index + 1}`, { x: 48, y: 760, size: 24 })
    for (const [row, text] of [
      'Product',
      'Business cards',
      '=1+1',
      'Print-ready artwork'
    ].entries()) {
      page.drawText(text, { x: 48, y: 680 - row * 32, size: 12 })
      page.drawText(String((row + 1) * 12), { x: 320, y: 680 - row * 32, size: 12 })
    }
    page.drawRectangle({ x: 48, y: 120, width: 180, height: 180, color: rgb(0.2, 0.4, 0.7) })
    if (index) page.setRotation(degrees(index * 90))
    if (index === 3) page.setCropBox(20, 20, 550, 800)
  }
  const pdfBytes = await pdf.save()
  await writeFile(join(output, 'sample.pdf'), pdfBytes)
  const { default: sharp } = await import('sharp')
  await sharp({ create: { width: 720, height: 480, channels: 3, background: '#456f9d' } })
    .composite([
      {
        input: Buffer.from(
          '<svg width="720" height="480"><rect x="24" y="24" width="672" height="432" fill="none" stroke="white" stroke-width="12"/><text x="80" y="250" fill="white" font-size="48">PRINT / PHOTO 01</text></svg>'
        )
      }
    ])
    .jpeg()
    .toFile(join(output, 'photo.jpg'))
  await sharp(join(output, 'photo.jpg'))
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toFile(join(output, 'phone.jpg'))
  const noise = Buffer.alloc(1600 * 2200 * 3)
  let seed = 31
  for (let i = 0; i < noise.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    noise[i] = seed >>> 24
  }
  const scanImage = await sharp(noise, { raw: { width: 1600, height: 2200, channels: 3 } })
    .jpeg({ quality: 100 })
    .toBuffer()
  const scanned = await PDFDocument.create(),
    scanPage = scanned.addPage([595.276, 841.89]),
    embeddedScan = await scanned.embedJpg(scanImage)
  scanPage.drawImage(embeddedScan, { x: 0, y: 0, width: 595.276, height: 841.89 })
  await writeFile(join(output, 'scan.pdf'), await scanned.save())
  const manyPages = await PDFDocument.create()
  for (let i = 0; i < 305; i++) manyPages.addPage([12, 12]).drawText('x', { x: 1, y: 1, size: 5 })
  await writeFile(join(output, 'many-pages.pdf'), await manyPages.save())
  if (process.argv.includes('--large')) {
    const large = await PDFDocument.create()
    for (let i = 0; i < 34; i++) {
      const image = await large.embedJpg(scanImage)
      large
        .addPage([595.276, 841.89])
        .drawImage(image, { x: 0, y: 0, width: 595.276, height: 841.89 })
    }
    await writeFile(join(output, 'large-scan.pdf'), await large.save())
  }
  await writeFile(
    join(root, 'tmp/pdf-proof.html'),
    '<html><body><div id="root"></div><script type="module" src="/tmp/pdf-proof.tsx"></script></body></html>'
  )
  await writeFile(
    join(root, 'tmp/pdf-proof.tsx'),
    `
import React from 'react';import {createRoot} from 'react-dom/client';
import {PdfToolsPage} from '/src/renderer/src/tools/pdf-tools/PdfToolsPage';
import {AppLayout} from '/src/renderer/src/components/layout/AppLayout';
import * as conversions from '/src/renderer/src/tools/pdf-tools/conversions';
import * as operations from '/src/renderer/src/tools/pdf-tools/pdfOperations';
import * as model from '/src/renderer/src/tools/pdf-tools/model';
import * as memory from '/src/renderer/src/tools/pdf-tools/memoryPolicy';
import {setLanguage} from '/src/renderer/src/i18n/language';import {setThemePreference} from '/src/renderer/src/appearance/theme';import {setPerformancePreset} from '/src/renderer/src/performance/performanceSettings';
import '/src/renderer/src/styles.css';
const noop=()=>{};setLanguage('en');setThemePreference('light');setPerformancePreset('low-end');
window.printerApp={pdf:{machineMemory:async()=>({totalBytes:8*2**30,availableBytes:4*2**30,heapLimitBytes:4*2**30}),officeCapabilities:async()=>({word:false,powerpoint:false,excel:false,libreOffice:false})},saveFile:async r=>{await fetch('/proof/ui-'+r.suggestedName,{method:'POST',body:r.bytes});return {ok:true}},printPdf:async()=>{throw Error('Hardware printing is forbidden in this proof')}};
window.pdfProof={...conversions,...operations,...model,...memory,setLanguage,setThemePreference,setPerformancePreset};
createRoot(document.getElementById('root')).render(<AppLayout activeRoute="pdf-tools" pageMeta={{title:'PDF Tools',subtitle:''}} onNavigate={noop} onSignOut={noop} onOpenProject={noop} onOpenImageFile={noop} onOpenJob={noop}><PdfToolsPage onNavigate={noop}/></AppLayout>);
`
  )
  const { createServer } = await import('vite'),
    { default: react } = await import('@vitejs/plugin-react')
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: join(root, 'node_modules/.vite-pdf-proof'),
    plugins: [
      react(),
      {
        name: 'pdf-proof',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const match = req.url?.match(/^\/proof\/([\w.-]+)$/)
            if (!match) return next()
            try {
              const file = join(output, match[1])
              if (req.method === 'POST') {
                const chunks = []
                for await (const chunk of req) chunks.push(chunk)
                await writeFile(file, Buffer.concat(chunks))
                res.end('ok')
              } else {
                res.setHeader('Content-Type', 'application/octet-stream')
                res.end(await readFile(file))
              }
            } catch (error) {
              res.statusCode = 500
              res.end(String(error))
            }
          })
        }
      }
    ],
    resolve: { alias: { '@': join(root, 'src/renderer/src') } },
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      watch: { ignored: ['**/output/**', '**/out/**', '**/storybook-static/**'] }
    }
  })
  await server.listen()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        createRequire(import.meta.url)('electron'),
        [import.meta.filename, ...process.argv.slice(2)],
        {
          env,
          windowsHide: true,
          stdio: 'inherit'
        }
      )
      child.once('error', reject)
      child.once('exit', (code) =>
        code === 0 ? resolve() : reject(Error(`PDF proof exited ${code}`))
      )
    })
  } finally {
    await server.close()
  }
  const { unzipSync, strFromU8 } = await import('fflate')
  assert.equal(
    (await PDFDocument.load(await readFile(join(output, 'merge-default.pdf')))).getPageCount(),
    8
  )
  const split = unzipSync(await readFile(join(output, 'split-default.zip')))
  assert.equal(Object.keys(split).length, 2)
  assert.equal(
    (await PDFDocument.load(Object.values(split)[0])).getPage(0).getRotation().angle,
    270
  )
  assert.equal((await PDFDocument.load(Object.values(split)[1])).getPageCount(), 2)
  assert.equal(Object.keys(unzipSync(await readFile(join(output, 'split-every.zip')))).length, 4)
  assert.equal(
    Object.keys(unzipSync(await readFile(join(output, 'pdf-jpg-default.zip')))).length,
    2
  )
  for (const mode of ['text', 'appearance']) {
    const word = unzipSync(await readFile(join(output, `pdf-word-${mode}.docx`)))
    assert.equal((strFromU8(word['word/document.xml']).match(/<w:sectPr>/g) || []).length, 4)
    assert.equal(
      Object.keys(word).filter((name) => /^word\/media\/.+\.jpg$/.test(name)).length,
      mode === 'appearance' ? 4 : 0
    )
    const powerpoint = unzipSync(await readFile(join(output, `pdf-powerpoint-${mode}.pptx`)))
    assert.equal(
      Object.keys(powerpoint).filter((name) => /^ppt\/slides\/slide\d+.xml$/.test(name)).length,
      4
    )
  }
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(join(output, 'pdf-excel-default.xlsx'))
  assert.equal(workbook.worksheets.length, 4)
  assert.equal(
    workbook.worksheets[0].getCell('A4').value,
    '=1+1',
    'Formula-like customer text must remain text'
  )
  assert.equal(workbook.worksheets[0].getCell('A4').type, ExcelJS.ValueType.String)
  for (let page = 0; page < 4; page++) {
    const { data } = await sharp(join(output, `rotation-${page}.jpg`))
      .extract({ left: 2, top: 2, width: 8, height: 8 })
      .raw()
      .toBuffer({ resolveWithObject: true })
    assert.ok(
      data[0] > 230 && data[1] < 25 && data[2] < 25,
      'Overlay must stay in the visible top-left corner for every rotation'
    )
  }
  const imagePdf = await PDFDocument.load(await readFile(join(output, 'jpg-pdf-default.pdf')))
  assert.equal(imagePdf.getPageCount(), 2)
  assert.equal(
    (await PDFDocument.load(await readFile(join(output, 'ui-file2-merged.pdf')))).getPageCount(),
    16
  )
  assert.equal(
    (await PDFDocument.load(await readFile(join(output, 'many-compressed.pdf')))).getPageCount(),
    305
  )
  assert.ok(Math.abs((imagePdf.getPage(0).getWidth() * 25.4) / 72 - 210) < 0.01)
  assert.ok(Math.abs((imagePdf.getPage(0).getHeight() * 25.4) / 72 - 297) < 0.01)
  const phonePdf = await PDFDocument.load(await readFile(join(output, 'phone-fit.pdf')))
  assert.ok(
    phonePdf.getPage(0).getHeight() > phonePdf.getPage(0).getWidth(),
    'Phone EXIF orientation is preserved'
  )
  assert.ok(
    (await readFile(join(output, 'scan-compressed.pdf'))).length <
      (await readFile(join(output, 'scan.pdf'))).length * 0.6,
    'Image-heavy scans become materially smaller'
  )
  console.log(
    'Output PDF, ZIP, DOCX, PPTX and XLSX structures, A4 sizing, formula safety, and rotation pixels passed.'
  )
} else {
  const { app, BrowserWindow, dialog } = await import('electron')
  app.disableHardwareAcceleration()
  app.setPath('userData', join(app.getPath('temp'), 'my-printer-pdf-proof'))
  app.whenReady().then(async () => {
    createRequire(import.meta.url)(join(root, 'tmp/pdf-native-proof.cjs')).registerPdfFileHandlers()
    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 768,
      webPreferences: {
        offscreen: true,
        sandbox: false,
        backgroundThrottling: false,
        preload: join(root, 'tmp/pdf-native-proof-preload.cjs')
      }
    })
    const errors = []
    win.webContents.on('console-message', (_event, _level, message) => {
      if (/Uncaught|Error:/.test(message)) errors.push(message)
    })
    const js = (script) => win.webContents.executeJavaScript(script, true)
    const waitFor = async (script, timeout = 30000) => {
      const until = Date.now() + timeout
      while (Date.now() < until) {
        if (await js(script)) return
        await new Promise((r) => setTimeout(r, 100))
      }
      throw Error(`Timed out: ${script}`)
    }
    const click = (text) =>
      js(
        `(()=>{const buttons=[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length);const b=buttons.find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button '+${JSON.stringify(text)});if(b.disabled)throw Error('Disabled button '+${JSON.stringify(text)});b.click()})()`
      )
    const screenshot = async (name) => {
      await new Promise((r) => setTimeout(r, 150))
      const image = await win.webContents.capturePage()
      await writeFile(join(output, name + '.png'), image.toPNG())
    }
    const importPdf = async () => {
      await js(
        `(async()=>{const bytes=await (await fetch('/proof/sample.pdf')).arrayBuffer();const input=document.querySelector('input[type=file]');const data=new DataTransfer();data.items.add(new File([bytes],'sample.pdf',{type:'application/pdf'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`
      )
      await waitFor(
        `document.querySelectorAll('.pdf-file-row').length===1 && !document.querySelector('[aria-busy=true]')`
      )
    }
    const inputValue = (selector, value) =>
      js(
        `(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})()`
      )
    try {
      await win.loadURL(origin + '/tmp/pdf-proof.html')
      await waitFor('window.pdfProof && document.querySelectorAll(".pdf-tool-card").length===12')
      const originalPicker = dialog.showOpenDialog
      let nativePickerOptions
      dialog.showOpenDialog = async (...args) => {
        nativePickerOptions = args.at(-1)
        return {
          canceled: false,
          filePaths: [join(output, 'sample.pdf'), join(output, 'scan.pdf')]
        }
      }
      try {
        const bridge = await js(
          `(async()=>{const memory=await pdfBridgeProof.memory(),selection=await pdfBridgeProof.select('merge');if(!selection.ok)throw Error(selection.error);const file=await pdfBridgeProof.read(selection.files[0].id),replay=await pdfBridgeProof.read(selection.files[0].id);return {ram:memory.totalBytes,files:selection.files.length,readBytes:file.bytes?.byteLength,replayAllowed:replay.ok}})()`
        )
        assert.ok(bridge.ram > 0 && bridge.readBytes > 0)
        assert.equal(bridge.files, 2)
        assert.equal(bridge.replayAllowed, false)
        assert.ok(nativePickerOptions.properties.includes('multiSelections'))
        console.log(
          'Fresh native PDF IPC memory, multi-selection, file reading and one-use handles passed.'
        )
      } finally {
        dialog.showOpenDialog = originalPicker
      }
      const layouts = []
      for (const [width, height] of [
        [1366, 768],
        [1600, 900],
        [1920, 1080]
      ]) {
        win.setSize(width, height)
        for (const [language, theme] of [
          ['en', 'light'],
          ['fr', 'dark'],
          ['ar', 'dark']
        ]) {
          await js(`pdfProof.setLanguage('${language}');pdfProof.setThemePreference('${theme}')`)
          await screenshot(`gallery-${width}-${language}-${theme}`)
          const layout = await js(
            `(()=>{const page=document.querySelector('main');return {overflow:page.scrollWidth>page.clientWidth+1,cards:document.querySelectorAll('.pdf-tool-card').length,rtl:document.documentElement.dir==='rtl'}})()`
          )
          assert.equal(layout.overflow, false)
          assert.equal(layout.cards, 12)
          layouts.push({ width, height, language, theme, ...layout })
        }
      }
      win.setSize(1366, 768)
      await js(`pdfProof.setLanguage('en');pdfProof.setThemePreference('light')`)
      await inputValue('input[placeholder="Search PDF tools"]', 'Excel')
      await waitFor(`document.querySelectorAll('.pdf-tool-card').length===2`)
      await inputValue('input[placeholder="Search PDF tools"]', '')
      await waitFor(`document.querySelectorAll('.pdf-tool-card').length===12`)
      await js(`document.querySelector('.pdf-tool-card').click()`)
      await screenshot('merge-empty-1366')
      await importPdf()
      await screenshot('merge-loaded-1366')
      assert.ok(
        await js(`document.querySelector('[data-tool-header] [aria-busy=false][disabled]')!==null`)
      )
      assert.equal(await js(`document.querySelector('input[type=file]').multiple`), true)
      await js(
        `window.printerApp.pdf.machineMemory=async()=>{throw Error("Error invoking remote method 'pdf:machine-memory': Error: No handler registered for 'pdf:machine-memory'")};void 0`
      )
      await js(
        `window.pickerKinds=[];window.pickerReads=[];window.printerApp.pdf.selectFiles=async(kind)=>{window.pickerKinds.push(kind);const size=(await(await fetch('/proof/sample.pdf')).arrayBuffer()).byteLength;return {ok:true,files:[{id:'a',name:'file20.pdf',size,lastModified:1},{id:'b',name:'file2.pdf',size,lastModified:1}]}};window.printerApp.pdf.readSelectedFile=async(id)=>{window.pickerReads.push(id);return {ok:true,bytes:new Uint8Array(await(await fetch('/proof/sample.pdf')).arrayBuffer())}};void 0`
      )
      await click('Add files')
      await waitFor(
        `document.querySelectorAll('.pdf-file-row').length===3 && !document.querySelector('[aria-busy=true]')`
      )
      assert.deepEqual(await js(`window.pickerKinds`), ['merge'])
      assert.deepEqual(await js(`window.pickerReads`), ['a', 'b'])
      await click('Sort by name')
      assert.deepEqual(
        await js(
          `[...document.querySelectorAll('.pdf-file-row p.font-medium')].map(el=>el.textContent)`
        ),
        ['file2.pdf', 'file20.pdf', 'sample.pdf']
      )
      await js(
        `(async()=>{const data=new DataTransfer();data.items.add(new File([await(await fetch('/proof/sample.pdf')).arrayBuffer()],'dropped.pdf',{type:'application/pdf'}));data.items.add(new File(['not a pdf'],'bad.pdf',{type:'application/pdf'}));document.querySelector('.pdf-workspace-grid section').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:data,cancelable:true}))})()`
      )
      await waitFor(
        `document.querySelectorAll('.pdf-file-row').length===4 && !document.querySelector('[aria-busy=true]')`
      )
      assert.ok(
        await js(
          `document.body.textContent.includes('Some files could not be imported') && document.body.textContent.includes('bad.pdf')`
        )
      )
      await screenshot('merge-batch-1366')
      await click('Merge PDF')
      await waitFor(
        `document.body.textContent.includes('file2-merged.pdf') && !document.querySelector('[aria-busy=true]')`
      )
      await click('Save file')
      await waitFor(`document.body.textContent.includes('File saved.')`)
      await js(
        `delete window.printerApp.pdf.selectFiles;delete window.printerApp.pdf.readSelectedFile`
      )
      await js(
        `window.browserPickerFallback=0;window.proofInputClick=document.querySelector('input[type=file]').click;document.querySelector('input[type=file]').click=()=>{window.browserPickerFallback++};window.printerApp.pdf.selectFiles=async()=>{throw Error("No handler registered for 'pdf:select-files'")};void 0`
      )
      await click('Add files')
      await waitFor('window.browserPickerFallback===1')
      assert.equal(await js(`!!document.querySelector('[role=alert]')`), false)
      await js(
        `document.querySelector('input[type=file]').click=window.proofInputClick;delete window.printerApp.pdf.selectFiles;void 0`
      )
      await click('Clear')
      await click('Cancel')
      assert.equal(await js(`document.querySelectorAll('.pdf-file-row').length`), 4)
      await waitFor(`document.activeElement.textContent.trim()==='Clear'`)
      await click('Clear')
      await js(`document.querySelector('[role=alertdialog] button:last-child').click()`)
      await waitFor(`document.querySelectorAll('.pdf-file-row').length===0`)
      await click('PDF Tools')
      await js(`document.querySelectorAll('.pdf-tool-card')[9].click()`)
      await importPdf()
      await waitFor(`document.querySelector('canvas')?.width>0`)
      await click('Add text')
      await inputValue(
        '.pdf-tools label input:not([type=number]):not([type=color])',
        'Maher · اختبار PDF'
      )
      await click('Add to page')
      await screenshot('editor-1366')
      await js(`pdfProof.setLanguage('ar');pdfProof.setThemePreference('dark')`)
      await screenshot('editor-ar-dark-1366')
      for (const [width, height, language, theme] of [
        [1600, 900, 'en', 'light'],
        [1920, 1080, 'fr', 'dark']
      ]) {
        win.setSize(width, height)
        await js(`pdfProof.setLanguage('${language}');pdfProof.setThemePreference('${theme}')`)
        await screenshot(`editor-${width}-${language}-${theme}`)
        const overflow = await js(
          `document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+1`
        )
        assert.equal(overflow, false)
        layouts.push({ context: 'editor', width, height, language, theme, overflow })
      }
      win.setSize(1366, 768)
      await js(`pdfProof.setLanguage('en');pdfProof.setThemePreference('light')`)
      await click('Export PDF')
      await waitFor(
        `document.body.textContent.includes('sample-edited.pdf') && !document.querySelector('[aria-busy=true]')`
      )
      await click('Save file')
      await waitFor(`document.body.textContent.includes('File saved.')`)
      await screenshot('editor-result-1366')
      await click('PDF Tools')
      await waitFor(`document.querySelectorAll('.pdf-tool-card').length===12`)
      await js(`document.querySelectorAll('.pdf-tool-card')[0].focus()`)
      win.webContents.debugger.attach('1.3')
      await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {
        enabled: true
      })
      win.webContents.focus()
      await js(`document.querySelectorAll('.pdf-tool-card')[0].focus()`)
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        text: '\r',
        unmodifiedText: '\r',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13
      })
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13
      })
      await waitFor(`document.querySelector('[role=alertdialog]')!==null`, 5000)
      await click('Cancel')
      await waitFor(`document.activeElement.classList.contains('pdf-tool-card')`)
      const results = await js(`(async()=>{
      const p=pdfProof;const bytes=new Uint8Array(await (await fetch('/proof/sample.pdf')).arrayBuffer());
      const input={id:'one',name:'sample.pdf',bytes,pages:4};const photo={id:'photo',name:'photo.jpg',bytes:new Uint8Array(await (await fetch('/proof/photo.jpg')).arrayBuffer())};
      const results=[];
      const many={id:'many',name:'many-pages.pdf',bytes:new Uint8Array(await(await fetch('/proof/many-pages.pdf')).arrayBuffer())};
      const manyOutput=await p.runPdfTool('compress',[many],{...p.DEFAULT_PDF_OPTIONS,compression:'small'},()=>{});await fetch('/proof/many-compressed.pdf',{method:'POST',body:manyOutput.bytes});
      const cancel=new AbortController();let canceled=false;try{await p.runPdfTool('merge',[input,input,input],p.DEFAULT_PDF_OPTIONS,()=>cancel.abort(),cancel.signal)}catch(error){canceled=error.name==='AbortError'}if(!canceled)throw Error('Worker cancellation did not stop merging');
      const phone={id:'phone',name:'phone.jpg',bytes:new Uint8Array(await (await fetch('/proof/phone.jpg')).arrayBuffer())};
      const phoneOutput=await p.runPdfTool('jpg-pdf',[phone],{...p.DEFAULT_PDF_OPTIONS,paper:'Fit'},()=>{});await fetch('/proof/phone-fit.pdf',{method:'POST',body:phoneOutput.bytes});
      const scan={id:'scan',name:'scan.pdf',bytes:new Uint8Array(await (await fetch('/proof/scan.pdf')).arrayBuffer())};
      const scanOutput=await p.runPdfTool('compress',[scan],{...p.DEFAULT_PDF_OPTIONS,compression:'balanced'},()=>{});await fetch('/proof/scan-compressed.pdf',{method:'POST',body:scanOutput.bytes});
      results.push({id:'jpg-pdf',label:'phone-exif',name:'phone-fit.pdf',size:phoneOutput.bytes.length},{id:'compress',label:'scanned-page',name:'scan-compressed.pdf',size:scanOutput.bytes.length});
      let rejectedScan=false;try{await p.runPdfTool('pdf-excel',[scan],p.DEFAULT_PDF_OPTIONS,()=>{})}catch(error){rejectedScan=/No selectable text/.test(error.message)}if(!rejectedScan)throw Error('Scanned PDF must not silently produce an empty workbook');
      for(const [id,extra] of [['merge',{}],['split',{ranges:'4,1-2'}],['split',{splitMode:'every'}],['compress',{}],['compress',{compression:'balanced'}],['compress',{compression:'small'}],['pdf-jpg',{ranges:'1,3',dpi:150}],['pdf-word',{officeMode:'text'}],['pdf-word',{officeMode:'appearance'}],['pdf-powerpoint',{officeMode:'text'}],['pdf-powerpoint',{officeMode:'appearance'}],['pdf-excel',{}],['jpg-pdf',{}],['jpg-pdf',{imageFit:'cover',orientation:'landscape'}]]){
        const result=await p.runPdfTool(id,id==='merge'?[input,input]:id==='jpg-pdf'?[photo,photo]:[input],{...p.DEFAULT_PDF_OPTIONS,...extra},()=>{});
        const label=id+'-'+(extra.officeMode||extra.compression||extra.imageFit||extra.splitMode||'default');const name=label+'.'+result.name.split('.').pop();
        await fetch('/proof/'+name,{method:'POST',body:result.bytes});
        results.push({id,label,name,size:result.bytes.length});
      }
      // Visual checks of overlay placement for all right-angle rotations and a crop box.
      const overlays=[];for(let i=0;i<4;i++){const canvas=document.createElement('canvas');canvas.width=i%2?842:595;canvas.height=i%2?595:842;const c=canvas.getContext('2d');c.fillStyle='#ff0000';c.fillRect(0,0,canvas.width*.12,canvas.height*.1);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));overlays.push({page:i,png:new Uint8Array(await blob.arrayBuffer())})}
      const edited=await p.overlayPdf(bytes,overlays);await fetch('/proof/rotation-overlay.pdf',{method:'POST',body:edited});
      await p.withPdf(edited,async pdf=>{for(let i=0;i<4;i++){const r=await p.renderPdfPage(pdf,i,72);await fetch('/proof/rotation-'+i+'.jpg',{method:'POST',body:r.bytes})}});
      return results;
    })()`)
      if (process.argv.includes('--large')) {
        console.log('Checking a PDF above 150 MB under the 8 GB memory policy…')
        const largeResult = await js(
          `(async()=>{const p=pdfProof,bytes=new Uint8Array(await(await fetch('/proof/large-scan.pdf')).arrayBuffer());p.validatePdfFiles(p.PDF_TOOLS.find(t=>t.id==='compress'),[{name:'large.pdf',size:bytes.length}]);let ticks=0;const timer=setInterval(()=>ticks++,20),start=performance.now();try{const result=await p.runPdfTool('compress',[{id:'large',name:'large.pdf',bytes}],{...p.DEFAULT_PDF_OPTIONS,compression:'balanced'},()=>{});await fetch('/proof/large-compressed.pdf',{method:'POST',body:result.bytes});return {inputBytes:bytes.length,outputBytes:result.bytes.length,ramGB:p.getPdfMemoryPolicy().ramGB,limit:p.getPdfMemoryPolicy().maxInputBytes,ticks,elapsedMs:performance.now()-start}}finally{clearInterval(timer)}})()`
        )
        assert.ok(largeResult.inputBytes > 150 * 1024 * 1024)
        assert.ok(largeResult.outputBytes < largeResult.inputBytes * 0.6)
        assert.ok(largeResult.ticks > 10)
        await writeFile(
          join(output, 'large-memory-report.json'),
          JSON.stringify(largeResult, null, 2)
        )
        console.log('Large-file memory proof passed:', largeResult)
      }
      await writeFile(
        join(output, 'proof-report.json'),
        JSON.stringify(
          {
            layouts,
            results,
            errors,
            hardwarePrintJobs: 0,
            officeConversions: 'Pending: Microsoft Office and LibreOffice are not installed.'
          },
          null,
          2
        )
      )
      assert.equal(errors.length, 0, errors.join('\n'))
      console.log(
        'Hidden PDF UI proofs and conversion outputs passed:',
        results.length,
        'conversions;',
        layouts.length,
        'layouts.'
      )
      win.destroy()
      app.quit()
    } catch (error) {
      console.error(error)
      console.error(errors)
      win.destroy()
      app.exit(1)
    }
  })
}
