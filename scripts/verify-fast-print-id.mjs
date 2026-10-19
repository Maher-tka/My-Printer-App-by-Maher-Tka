import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Local-only regression proof. Reads every picture in the user's standard ID
// folder, renders real card artwork through the production canvas code, and
// never calls a printer. Keep customer artwork out of committed fixtures.
const require = createRequire(import.meta.url)
const electron = require('electron')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFolder = process.env.ID_TEST_FOLDER || 'C:\\Users\\Maher\\Downloads\\ID TEST'
const output = resolve(root, 'output', 'fast-print-id')

if (typeof electron === 'string') {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(electron, [fileURLToPath(import.meta.url)], {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true
  })
  child.on('error', (error) => {
    console.error(error)
    process.exitCode = 1
  })
  child.on('exit', (code) => {
    process.exitCode = code ?? 1
  })
} else {
  void (async () => {
    const { app, BrowserWindow } = electron
    app.setPath('userData', join(output, '.verification-session'))
    let server,
      window,
      exitCode = 0
    try {
      const names = (await readdir(sourceFolder))
        .filter((name) => /\.(png|jpe?g|gif)$/i.test(name))
        .sort()
      assert.ok(names.length, 'The ID test folder has no supported pictures.')
      await mkdir(output, { recursive: true })
      const sources = []
      for (const name of names) {
        const bytes = await readFile(join(sourceFolder, name))
        sources.push({
          name,
          extension: extname(name).toLowerCase(),
          base64: bytes.toString('base64'),
          sha256: createHash('sha256').update(bytes).digest('hex')
        })
      }
      const { createServer } = await import('vite')
      server = await createServer({
        configFile: false,
        cacheDir: join(root, 'node_modules', '.vite-id-verification'),
        root: join(root, 'src', 'renderer'),
        resolve: { alias: { '@': join(root, 'src', 'renderer', 'src') } },
        plugins: [
          {
            name: 'id-verification-page',
            configureServer(instance) {
              instance.middlewares.use((request, response, next) => {
                if (!request.url?.startsWith('/id-proof.html')) return next()
                response.setHeader('Content-Type', 'text/html')
                response.end(
                  `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; connect-src 'self' ws:; img-src 'self' data: blob:; worker-src 'self' blob:"><title>ID verification</title></head><body></body></html>`
                )
              })
            }
          }
        ],
        server: { host: '127.0.0.1', port: 0 }
      })
      console.log('Preparing ID proof renderer...')
      await server.listen()
      await app.whenReady()
      console.log('Loading local ID renderer...')
      window = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
      })
      await window.loadURL(`http://127.0.0.1:${server.httpServer.address().port}/id-proof.html`)
      console.log('Rendering original and rotated ID pictures...')
      // Approximate visible card edges, independently marked after inspecting the
      // two current originals. These are geometry only; no ID content is stored.
      const annotations = {
        'carte-identite-tunisie-1.gif': [
          [34, 9],
          [670, 44],
          [646, 394],
          [11, 364]
        ],
        'images (2).jpg': [
          [28, 71],
          [588, 62],
          [602, 407],
          [33, 440]
        ]
      }
      const run = async (sources, annotations, rootPath) => {
        const { loadIdArtwork, autoIdCrop, drawIdSheet } =
          await import('/src/fast-print/idArtwork.ts')
        const { idCardPlacement } = await import(
          '/@fs/' + rootPath + '/src/shared/fast-print-id.ts'
        )
        const results = []
        const inside = (x, y, polygon) =>
          polygon.every((a, i) => {
            const b = polygon[(i + 1) % polygon.length]
            return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= -0.00001
          })
        for (const source of sources) {
          const binary = atob(source.base64)
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
          const [art] = await loadIdArtwork(source.name, source.extension, bytes)
          const marked = annotations[source.name]?.map(([x, y]) => ({ x, y }))
          const variants = [{ name: 'original', canvas: art.canvas, expected: marked }]
          if (marked) {
            const cx = marked.reduce((s, p) => s + p.x, 0) / 4,
              cy = marked.reduce((s, p) => s + p.y, 0) / 4
            const dx = marked[1].x - marked[0].x + marked[2].x - marked[3].x
            const dy = marked[1].y - marked[0].y + marked[2].y - marked[3].y
            const baseline = Math.atan2(dy, dx),
              scale = 1000 / Math.hypot(dx, dy)
            for (const [angle, targetX, targetY] of [
              [45, 350, 650],
              [-45, 900, 300]
            ]) {
              const radians = (angle * Math.PI) / 180 - baseline,
                cos = Math.cos(radians),
                sin = Math.sin(radians)
              const canvas = document.createElement('canvas')
              canvas.width = 1200
              canvas.height = 1000
              const context = canvas.getContext('2d')
              context.fillStyle = '#33302d'
              context.fillRect(0, 0, canvas.width, canvas.height)
              context.save()
              context.translate(targetX, targetY)
              context.rotate(radians)
              context.scale(scale, scale)
              context.translate(-cx, -cy)
              context.beginPath()
              marked.forEach((p, i) => (i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)))
              context.closePath()
              context.clip()
              context.drawImage(art.canvas, 0, 0)
              context.restore()
              const expected = marked.map((p) => ({
                x: targetX + ((p.x - cx) * cos - (p.y - cy) * sin) * scale,
                y: targetY + ((p.x - cx) * sin + (p.y - cy) * cos) * scale
              }))
              variants.push({
                name: angle > 0 ? 'off-center-plus45' : 'off-center-minus45',
                canvas,
                expected
              })
            }
          }
          for (const variant of variants) {
            const { canvas, expected } = variant,
              crop = autoIdCrop(canvas)
            const placement = idCardPlacement(canvas.width, canvas.height, crop, 'A4')
            const selected = crop.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height }))
            let expectedCount = 0,
              selectedCount = 0,
              intersection = 0
            if (expected) {
              for (let row = 0; row < 200; row++)
                for (let col = 0; col < 200; col++) {
                  const x = ((col + 0.5) * canvas.width) / 200,
                    y = ((row + 0.5) * canvas.height) / 200
                  const a = inside(x, y, expected),
                    b = inside(x, y, selected)
                  expectedCount += Number(a)
                  selectedCount += Number(b)
                  intersection += Number(a && b)
                }
            }
            const overlay = document.createElement('canvas')
            overlay.width = canvas.width
            overlay.height = canvas.height
            const overlayContext = overlay.getContext('2d')
            overlayContext.drawImage(canvas, 0, 0)
            overlayContext.strokeStyle = '#00d98b'
            overlayContext.lineWidth = 3
            overlayContext.beginPath()
            selected.forEach((p, i) =>
              i ? overlayContext.lineTo(p.x, p.y) : overlayContext.moveTo(p.x, p.y)
            )
            overlayContext.closePath()
            overlayContext.stroke()
            const record = {
              source: source.name,
              variant: variant.name,
              angle: placement.angleDegrees,
              widthMm: placement.widthMm,
              heightMm: placement.heightMm,
              crop,
              coverage: expected ? intersection / expectedCount : null,
              precision: expected ? intersection / selectedCount : null,
              overlay: overlay.toDataURL('image/png'),
              proofs: []
            }
            for (const color of [true, false]) {
              const sheet = drawIdSheet(canvas, crop, {
                printer: 'Verification only',
                paper: 'A4',
                pagesPerSheet: 1,
                color
              })
              const pixels = sheet
                .getContext('2d')
                .getImageData(0, 0, sheet.width, sheet.height).data
              let left = sheet.width,
                top = sheet.height,
                right = 0,
                bottom = 0,
                chromaticPixels = 0
              for (let y = 0; y < sheet.height; y++)
                for (let x = 0; x < sheet.width; x++) {
                  const i = (y * sheet.width + x) * 4,
                    r = pixels[i],
                    g = pixels[i + 1],
                    b = pixels[i + 2]
                  if (Math.max(r, g, b) - Math.min(r, g, b) > 1) chromaticPixels++
                  if (Math.min(r, g, b) < 240) {
                    left = Math.min(left, x)
                    right = Math.max(right, x)
                    top = Math.min(top, y)
                    bottom = Math.max(bottom, y)
                  }
                }
              record.proofs.push({
                color,
                inkWidthMm: ((right - left + 1) * 25.4) / 300,
                centerOffsetMm: {
                  x: (((left + right + 1) / 2 - sheet.width / 2) * 25.4) / 300,
                  y: (((top + bottom + 1) / 2 - sheet.height / 2) * 25.4) / 300
                },
                chromaticPixels,
                png: sheet.toDataURL('image/png')
              })
              sheet.width = 0
              sheet.height = 0
            }
            results.push(record)
          }
        }
        return results
      }
      const script = `(${run.toString()})(${JSON.stringify(sources)},${JSON.stringify(annotations)},${JSON.stringify(root.replaceAll('\\', '/'))})`
      const results = await window.webContents.executeJavaScript(script)
      for (let i = 0; i < results.length; i++) {
        const item = results[i],
          prefix = String(i + 1).padStart(2, '0') + '-' + item.variant
        await writeFile(
          join(output, prefix + '-crop.png'),
          Buffer.from(item.overlay.split(',')[1], 'base64')
        )
        delete item.overlay
        for (const proof of item.proofs) {
          await writeFile(
            join(output, prefix + (proof.color ? '-color.png' : '-mono.png')),
            Buffer.from(proof.png.split(',')[1], 'base64')
          )
          delete proof.png
        }
      }
      for (const source of sources) {
        const after = createHash('sha256')
          .update(await readFile(join(sourceFolder, source.name)))
          .digest('hex')
        assert.equal(after, source.sha256, 'An original ID picture changed.')
      }
      await writeFile(
        join(output, 'results.json'),
        JSON.stringify(
          { sourceFolder, sources: sources.map(({ base64, ...source }) => source), results },
          null,
          2
        )
      )
      for (const item of results) {
        assert.equal(item.widthMm, 90)
        if (item.coverage !== null) {
          assert.ok(item.coverage > 0.94, `${item.source} ${item.variant}: crop clips the card`)
          assert.ok(item.precision > 0.8, `${item.source} ${item.variant}: too much background`)
        }
        if (item.variant.includes('plus45')) assert.ok(Math.abs(item.angle - 45) < 3)
        if (item.variant.includes('minus45')) assert.ok(Math.abs(item.angle + 45) < 3)
        for (const proof of item.proofs) {
          assert.ok(
            proof.inkWidthMm > 87 && proof.inkWidthMm < 90.3,
            'Unexpected printed card width'
          )
          assert.ok(
            Math.abs(proof.centerOffsetMm.x) < 1 && Math.abs(proof.centerOffsetMm.y) < 1,
            'Printed card is not centered'
          )
          if (!proof.color) assert.equal(proof.chromaticPixels, 0, 'Grayscale proof contains color')
        }
        console.log(
          `${item.source} / ${item.variant}: ${item.angle.toFixed(1)} degrees, 90 x ${item.heightMm.toFixed(1)} mm, coverage ${item.coverage?.toFixed(3) ?? 'needs review'}`
        )
      }
      console.log(`ID real-photo verification passed. Original hashes unchanged. Proofs: ${output}`)
    } catch (error) {
      console.error(error)
      exitCode = 1
    } finally {
      if (window && !window.isDestroyed()) window.destroy()
      await server?.close()
      app.exit(exitCode)
    }
  })()
}
