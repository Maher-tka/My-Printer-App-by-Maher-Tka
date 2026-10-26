import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')
process.chdir(root)
const source = process.env.STICKER_TEST_FOLDER || 'C:/Users/Maher/Documents/stickers test'
const output = resolve('output/sticker-real-files')
const reviewOnly = process.argv.includes('--review-only')
await mkdir(output, { recursive: true })
const names = (await readdir(source))
  .filter((name) => /\.(ai|pdf|png|jpe?g|webp)$/i.test(name))
  .sort((a, b) => a.localeCompare(b))
if (!names.length) throw Error('No sticker test files found in ' + source)
const hashes = async () =>
  Promise.all(
    names.map(async (name) => ({
      name,
      sha256: createHash('sha256')
        .update(await readFile(resolve(source, name)))
        .digest('hex')
    }))
  )

async function proofContacts() {
  const { default: sharp } = await import('sharp')
  const report = JSON.parse(await readFile(resolve(output, 'real-file-report.json'), 'utf8'))
  for (const kind of ['crop', 'isolated']) {
    const all = []
    for (const [index, item] of report.entries())
      for (const page of item.pages) {
        const layers = []
        for (let i = 0; i < page.suggestions; i++) {
          const name = `real-${index + 1}-${page.number}-${kind}-${i + 1}.png`
          const input = await sharp(resolve(output, name))
            .resize(180, 180, { fit: 'contain', background: '#e6e6e6' })
            .flatten({ background: '#e6e6e6' })
            .png()
            .toBuffer()
          const label = Buffer.from(
            `<svg width="200" height="24"><text x="5" y="18" font-size="12">${index + 1}-${page.number} / ${i + 1}</text></svg>`
          )
          const tile = await sharp({
            create: { width: 200, height: 210, channels: 3, background: '#e6e6e6' }
          })
            .composite([
              { input, left: 10, top: 0 },
              { input: label, left: 0, top: 182 }
            ])
            .png()
            .toBuffer()
          layers.push({ input: tile, left: (i % 5) * 200, top: Math.floor(i / 5) * 210 })
          all.push(tile)
        }
        await sharp({
          create: {
            width: 1000,
            height: Math.ceil(page.suggestions / 5) * 210,
            channels: 3,
            background: '#e6e6e6'
          }
        })
          .composite(layers)
          .png()
          .toFile(resolve(output, `contact-${index + 1}-${page.number}-${kind}.png`))
      }
    await sharp({
      create: {
        width: 1600,
        height: Math.ceil(all.length / 8) * 210,
        channels: 3,
        background: '#e6e6e6'
      }
    })
      .composite(
        all.map((input, i) => ({ input, left: (i % 8) * 200, top: Math.floor(i / 8) * 210 }))
      )
      .png()
      .toFile(
        resolve(output, kind === 'crop' ? 'all-crops-contact.png' : 'all-isolated-contact.png')
      )
  }
}

if (process.argv.includes('--contacts-only')) {
  await proofContacts()
} else if (!process.versions.electron) {
  const before = await hashes()
  await mkdir(resolve('tmp'), { recursive: true })
  await writeFile(
    resolve('tmp/sticker-files.html'),
    '<html><body><div id="root"></div><script type="module" src="/tmp/sticker-files.tsx"></script></body></html>'
  )
  await writeFile(
    resolve('tmp/sticker-files.tsx'),
    `import React from 'react';import {createRoot} from 'react-dom/client';import {AIStickerMaker} from '/src/renderer/src/tools/cutter-montage/components/AIStickerMaker';import * as sheet from '/src/renderer/src/tools/cutter-montage/lib/stickerSheet';import * as maker from '/src/renderer/src/tools/cutter-montage/lib/stickerMaker';import '/src/renderer/src/styles.css';import {setLanguage} from '/src/renderer/src/i18n/language';setLanguage('en');window.sheet=sheet;window.stickerMaker=maker;createRoot(document.getElementById('root')).render(<div className="flex h-screen flex-col bg-background p-4 text-foreground"><AIStickerMaker onClose={()=>{}} onSend={()=>{}}/></div>);`
  )
  const { createServer } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const { spawn } = await import('node:child_process')
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: resolve('node_modules/.vite-sticker-files-proof'),
    optimizeDeps: { entries: ['tmp/sticker-files.html'] },
    plugins: [
      react(),
      {
        name: 'sticker-proof-files',
        configureServer(server) {
          server.middlewares.use(middleware)
        }
      }
    ],
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    server: {
      host: '127.0.0.1',
      port: 5199,
      strictPort: true,
      watch: { ignored: ['**/output/**', '**/out/**'] }
    }
  })
  async function middleware(req, res, next) {
    const match = req.url?.match(/^\/source\/(\d+)$/)
    if (match && names[Number(match[1])]) {
      const path = resolve(source, names[Number(match[1])])
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Length', (await stat(path)).size)
      createReadStream(path).pipe(res)
      return
    }
    const proof = req.url?.match(/^\/proof\/([a-z0-9-]+\.png)$/)
    if (proof && req.method === 'POST') {
      try {
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > 10 * 1024 * 1024) throw Error('Proof too large')
          chunks.push(chunk)
        }
        await writeFile(resolve(output, proof[1]), Buffer.concat(chunks))
        res.end('ok')
      } catch (e) {
        res.statusCode = 500
        res.end(String(e))
      }
      return
    }
    next()
  }
  await server.listen()
  const probe = await fetch('http://127.0.0.1:5199/source/0')
  console.log('Source endpoint', probe.status, (await probe.arrayBuffer()).byteLength)
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(
    createRequire(import.meta.url)('electron'),
    [resolve('scripts/verify-sticker-files.mjs'), ...(reviewOnly ? ['--review-only'] : [])],
    { env, windowsHide: true, stdio: 'inherit' }
  )
  child.once('exit', async (code) => {
    await server.close()
    const after = await hashes()
    await writeFile(
      resolve(output, 'original-integrity.json'),
      JSON.stringify(
        { unchanged: JSON.stringify(before) === JSON.stringify(after), before, after },
        null,
        2
      )
    )
    if (code === 0 && !reviewOnly) await proofContacts()
    process.exitCode = code ?? 1
  })
} else {
  const { app, BrowserWindow } = await import('electron')
  app.disableHardwareAcceleration()
  app.setPath('userData', resolve(app.getPath('temp'), 'my-printer-real-sticker-proof'))
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: false, offscreen: true, backgroundThrottling: false }
    })
    const reports = reviewOnly
      ? JSON.parse(await readFile(resolve(output, 'real-file-report.json'), 'utf8'))
      : []
    try {
      await win.loadURL('http://127.0.0.1:5199/tmp/sticker-files.html')
      const wait = async (code) => {
        for (let i = 0; i < 400; i++) {
          if (await win.webContents.executeJavaScript(code)) return
          await new Promise((r) => setTimeout(r, 50))
        }
        throw Error('Timed out: ' + code)
      }
      await wait('!!window.sheet')
      for (const [index, name] of (reviewOnly ? [] : names).entries()) {
        console.log('Testing ' + name)
        const report = await win.webContents.executeJavaScript(
          `(${(async (index, name) => {
            const sheet = window.sheet
            const file = new File(
              [await (await fetch('/source/' + index)).blob()],
              name.replace(/\.ai$/i, '.pdf'),
              { type: 'application/pdf' }
            )
            const pages = []
            if (!file.size || !(await file.slice(0, 1024).text()).includes('%PDF-'))
              throw Error(
                'Unexpected source response: ' +
                  name +
                  ' ' +
                  file.size +
                  ' ' +
                  (await file.slice(0, 150).text())
              )
            await sheet.importStickerSheetPages(
              file,
              async (page) => {
                const number = pages.length + 1,
                  prefix = 'real-' + (index + 1) + '-' + number
                const detected = await sheet.detectStickerSheetRegions(
                  page.file,
                  sheet.DEFAULT_STICKER_SHEET_SETTINGS
                )
                const crops = await sheet.separateStickerSheet(
                  page.file,
                  sheet.DEFAULT_STICKER_SHEET_SETTINGS,
                  detected.bounds.map((b) => ({ ...b, removeBackground: false }))
                )
                const isolated = await sheet.separateStickerSheet(
                  page.file,
                  sheet.DEFAULT_STICKER_SHEET_SETTINGS,
                  detected.bounds.map((b) => ({
                    ...b,
                    removeBackground: true,
                    isolateArtwork: true
                  }))
                )
                const bitmap = await createImageBitmap(page.file)
                const original = document.createElement('canvas'),
                  part = document.createElement('canvas'),
                  thumb = document.createElement('canvas')
                const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
                original.width = Math.round(bitmap.width * scale)
                original.height = Math.round(bitmap.height * scale)
                const context = original.getContext('2d')
                context.drawImage(bitmap, 0, 0, original.width, original.height)
                context.strokeStyle = 'red'
                context.lineWidth = 2
                context.font = '20px sans-serif'
                context.fillStyle = 'red'
                const checks = []
                for (const [i, crop] of crops.entries()) {
                  const b = crop.bounds,
                    decoded = await createImageBitmap(crop.originalFile)
                  part.width = decoded.width
                  part.height = decoded.height
                  const pc = part.getContext('2d', { willReadFrequently: true })
                  pc.drawImage(decoded, 0, 0)
                  const actual = pc.getImageData(0, 0, part.width, part.height).data
                  pc.clearRect(0, 0, part.width, part.height)
                  pc.drawImage(
                    bitmap,
                    Math.round(b.x * bitmap.width),
                    Math.round(b.y * bitmap.height),
                    part.width,
                    part.height,
                    0,
                    0,
                    part.width,
                    part.height
                  )
                  const expected = pc.getImageData(0, 0, part.width, part.height).data
                  if (actual.some((v, j) => v !== expected[j]))
                    throw Error('Crop pixels changed ' + prefix + '/' + i)
                  if (crop.file !== crop.originalFile)
                    throw Error('Background removal should be off')
                  const prepared = await createImageBitmap(isolated[i].file)
                  pc.clearRect(0, 0, part.width, part.height)
                  pc.drawImage(prepared, 0, 0)
                  const cleaned = pc.getImageData(0, 0, part.width, part.height).data
                  let removed = 0,
                    kept = 0
                  for (let j = 0; j < cleaned.length; j += 4) {
                    if (!cleaned[j + 3]) {
                      removed++
                      continue
                    }
                    kept++
                    for (let k = 0; k < 4; k++)
                      if (cleaned[j + k] !== actual[j + k])
                        throw Error('Isolation recolored artwork ' + prefix + '/' + i)
                  }
                  if (!kept) throw Error('Isolation removed all artwork ' + prefix + '/' + i)
                  const result = await window.stickerMaker.processSticker(
                    isolated[i].file,
                    { widthMm: 90, offsetMm: 1, threshold: 128, smoothing: 1 },
                    () => {},
                    'keep'
                  )
                  if (!result.pathData)
                    throw Error(
                      'No isolated contour ' + prefix + '/' + i + ' ' + result.warnings.join('; ')
                    )
                  checks.push({
                    width: part.width,
                    height: part.height,
                    originalPixelsEqual: true,
                    isolatedVisiblePixelsEqual: true,
                    removedPixels: removed,
                    keptPixels: kept,
                    contours: (result.pathData.match(/M /g) || []).length,
                    warnings: result.warnings
                  })
                  const ratio = Math.min(1, 240 / Math.max(part.width, part.height))
                  thumb.width = Math.max(1, Math.round(part.width * ratio))
                  thumb.height = Math.max(1, Math.round(part.height * ratio))
                  thumb.getContext('2d').drawImage(decoded, 0, 0, thumb.width, thumb.height)
                  await fetch('/proof/' + prefix + '-crop-' + (i + 1) + '.png', {
                    method: 'POST',
                    body: await new Promise((r) => thumb.toBlob(r, 'image/png'))
                  })
                  thumb.getContext('2d').clearRect(0, 0, thumb.width, thumb.height)
                  thumb.getContext('2d').drawImage(prepared, 0, 0, thumb.width, thumb.height)
                  await fetch('/proof/' + prefix + '-isolated-' + (i + 1) + '.png', {
                    method: 'POST',
                    body: await new Promise((r) => thumb.toBlob(r, 'image/png'))
                  })
                  prepared.close()
                  context.strokeRect(
                    b.x * original.width,
                    b.y * original.height,
                    b.width * original.width,
                    b.height * original.height
                  )
                  context.fillText(
                    String(i + 1),
                    b.x * original.width + 3,
                    b.y * original.height + 21
                  )
                  decoded.close()
                }
                await fetch('/proof/' + prefix + '-bounds.png', {
                  method: 'POST',
                  body: await new Promise((r) => original.toBlob(r, 'image/png'))
                })
                pages.push({
                  number,
                  width: bitmap.width,
                  height: bitmap.height,
                  review: page.pdfSheet ? 'vector PDF' : 'image crop review',
                  suggestions: detected.bounds.length,
                  checks
                })
                bitmap.close()
                original.width =
                  original.height =
                  part.width =
                  part.height =
                  thumb.width =
                  thumb.height =
                    0
              },
              () => false
            )
            return { name, bytes: file.size, aiPdfPreview: /\.ai$/i.test(name), pages }
          }).toString()})(${index},${JSON.stringify(name)})`
        )
        reports.push(report)
        await writeFile(resolve(output, 'real-file-report.json'), JSON.stringify(reports, null, 2))
        console.log(
          JSON.stringify({
            name,
            pages: report.pages.map((p) => ({
              page: p.number,
              review: p.review,
              suggestions: p.suggestions,
              pixelChecks: p.checks.length
            }))
          })
        )
      }
      console.log(
        reviewOnly
          ? 'Checking the review UI against the existing real-file report.'
          : 'All source pages imported; every crop retained its exact original pixels. AI checked as PDF preview only.'
      )
      const rasterSource = reports.findIndex(
        (r) => r.pages.length === 1 && r.pages[0].review === 'image crop review'
      )
      if (rasterSource >= 0) {
        await wait('!!document.querySelector("input[type=file][multiple]")')
        await win.webContents.executeJavaScript(
          `(async()=>{const data=new DataTransfer();data.items.add(new File([await(await fetch('/source/${rasterSource}')).blob()],${JSON.stringify(names[rasterSource])},{type:'application/pdf'}));const input=document.querySelector('input[type=file][multiple]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`
        )
        await wait("!!document.querySelector('[data-review-stickers]:not(:disabled)')")
        await win.webContents.executeJavaScript(
          "document.querySelector('[data-review-stickers]').click()"
        )
        await wait(
          `document.querySelectorAll('[role=tab]').length===${reports[rasterSource].pages[0].suggestions}&&!document.querySelector('section[aria-busy=true]')`
        )
        const ui = {
          source: names[rasterSource],
          tabs: await win.webContents.executeJavaScript(
            "document.querySelectorAll('[role=tab]').length"
          ),
          backgroundRemovalOff: await win.webContents.executeJavaScript(
            "![...document.querySelectorAll('label')].find(l=>l.textContent.includes('Remove background for this sticker')).querySelector('input').checked"
          ),
          layouts: []
        }
        await win.webContents.executeJavaScript(
          "[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Remove background for this sticker')).querySelector('input').click()"
        )
        await wait('!!document.querySelector(\'img[alt="Prepared sticker preview"]\')')
        const priorPreview = await win.webContents.executeJavaScript(
          'document.querySelector(\'img[alt="Prepared sticker preview"]\').src'
        )
        await win.webContents.executeJavaScript(
          "[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Exclude neighboring artwork')).querySelector('input').click()"
        )
        await wait(
          `!!document.querySelector('img[alt="Prepared sticker preview"]')&&document.querySelector('img[alt="Prepared sticker preview"]').src!==${JSON.stringify(priorPreview)}`
        )
        ui.exclusionPreview = true
        for (const [width, height] of [
          [1366, 768],
          [1920, 1080]
        ]) {
          win.setContentSize(width, height)
          await new Promise((r) => setTimeout(r, 150))
          const overflow = await win.webContents.executeJavaScript(
            'document.documentElement.scrollWidth>innerWidth'
          )
          if (overflow) throw Error('Real PDF review overflow')
          await writeFile(
            resolve(output, `real-pdf-review-${width}.png`),
            (await win.webContents.capturePage()).toPNG()
          )
          ui.layouts.push({ width, height, overflow })
        }
        if (!ui.backgroundRemovalOff) throw Error('Real PDF removal unexpectedly enabled')
        await writeFile(resolve(output, 'real-pdf-review.json'), JSON.stringify(ui, null, 2))
        console.log(JSON.stringify(ui))
      }
    } catch (error) {
      console.error(error)
      process.exitCode = 1
    } finally {
      win.destroy()
      app.exit(process.exitCode || 0)
    }
  })
}
