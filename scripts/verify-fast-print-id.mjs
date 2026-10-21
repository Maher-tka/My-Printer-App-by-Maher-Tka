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
const copiesArgument = process.argv.indexOf('--copies')
const idsPerSheet = Number(
  copiesArgument < 0 ? process.env.ID_COPIES_PER_SHEET || 1 : process.argv[copiesArgument + 1]
)
assert.ok(Number.isInteger(idsPerSheet) && idsPerSheet >= 1 && idsPerSheet <= 24)
const geometryOnly = process.env.ID_GEOMETRY_ONLY === '1'
const output = process.env.ID_PROOF_OUTPUT
  ? resolve(root, process.env.ID_PROOF_OUTPUT)
  : resolve(
      root,
      'output',
      (idsPerSheet === 1 ? 'fast-print-id' : `fast-print-id-copies-${idsPerSheet}`) +
        (geometryOnly ? '-geometry' : '')
    )

if (typeof electron === 'string') {
  const env = { ...process.env, ID_COPIES_PER_SHEET: String(idsPerSheet) }
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
        .filter(
          (name) =>
            !process.env.ID_TEST_NAMES || JSON.parse(process.env.ID_TEST_NAMES).includes(name)
        )
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
                  `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' ws:; img-src 'self' data: blob:; worker-src 'self' blob:"><title>ID verification</title></head><body></body></html>`
                )
              })
            }
          }
        ],
        server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }
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
      // Independently marked visible edges in decoded/EXIF-corrected coordinates.
      // Geometry only; no identity content is committed to the repository.
      const annotations = JSON.parse(
        await readFile(join(root, 'scripts/id-photo-annotations.json'), 'utf8')
      )
      const run = async (
        sources,
        annotations,
        rootPath,
        idsPerSheet,
        geometryOnly,
        variantsFilter
      ) => {
        const { loadIdArtwork, autoIdCrop, drawIdSheet, IdAutoAnalyzer, orientIdArtwork } =
          await import('/src/fast-print/idArtwork.ts')
        const {
          idCardPlacement,
          idCopiesLayout,
          rotateIdSide,
          horizontalIdSide,
          DEFAULT_ID_SHEET_SETTINGS,
          idPrintedSize,
          idCopyCenters
        } = await import('/@fs/' + rootPath + '/src/shared/fast-print-id.ts')
        const { measureIdProof } = await import(
          '/@fs/' + rootPath + '/scripts/id-proof-metrics.mjs'
        )
        const analyzer = new IdAutoAnalyzer()
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
          const variants = [
            { name: 'original', canvas: art.canvas, expected: marked },
            ...[1, 3].map((turns) => ({
              name: `legacy-review-${turns * 90}`,
              canvas: art.canvas,
              expected: marked,
              legacyTurns: turns
            }))
          ]
          for (const turns of [1, 2, 3]) {
            const canvas = orientIdArtwork(art, turns)
            const expected = marked?.map((p) =>
              turns === 1
                ? { x: art.canvas.height - p.y, y: p.x }
                : turns === 2
                  ? { x: art.canvas.width - p.x, y: art.canvas.height - p.y }
                  : { x: p.y, y: art.canvas.width - p.x }
            )
            variants.push({ name: `camera-${turns * 90}`, canvas, expected })
          }
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
            for (const [name, background, angle] of [
              ['busy-fabric', '#47617b', 0],
              ['pale-paper', '#ddd7ce', 0],
              ['vertical-phone', '#ddd7ce', 90]
            ]) {
              const radians = (angle * Math.PI) / 180 - baseline,
                cos = Math.cos(radians),
                sin = Math.sin(radians)
              const canvas = document.createElement('canvas')
              canvas.width = angle ? 900 : 1200
              canvas.height = angle ? 1200 : 1000
              const context = canvas.getContext('2d')
              context.fillStyle = background
              context.fillRect(0, 0, canvas.width, canvas.height)
              if (name === 'busy-fabric') {
                for (let offset = -1000; offset < 2000; offset += 32) {
                  context.strokeStyle = offset % 64 ? '#7699b0' : '#263d64'
                  context.lineWidth = 7
                  context.beginPath()
                  context.moveTo(offset, 0)
                  context.lineTo(offset + 500, canvas.height)
                  context.stroke()
                  context.strokeStyle = '#c1cbd0'
                  context.lineWidth = 3
                  context.beginPath()
                  context.moveTo(0, offset)
                  context.lineTo(canvas.width, offset + 100)
                  context.stroke()
                }
              } else {
                context.strokeStyle = '#c6c0b8'
                context.lineWidth = 1
                for (let row = 100; row < canvas.height; row += 70) {
                  context.beginPath()
                  context.moveTo(30, row)
                  for (let x = 40; x < canvas.width - 30; x += 12)
                    context.lineTo(x, row + Math.sin(x * 0.09) * 2)
                  context.stroke()
                }
              }
              const cardScale = 1100 / Math.hypot(dx, dy),
                targetX = canvas.width * 0.52,
                targetY = canvas.height * 0.57
              context.save()
              context.translate(targetX, targetY)
              context.rotate(radians)
              context.scale(cardScale, cardScale)
              context.translate(-cx, -cy)
              context.beginPath()
              marked.forEach((point, i) =>
                i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)
              )
              context.closePath()
              context.clip()
              context.drawImage(art.canvas, 0, 0)
              context.restore()
              const expected = marked.map((point) => ({
                x: targetX + ((point.x - cx) * cos - (point.y - cy) * sin) * cardScale,
                y: targetY + ((point.x - cx) * sin + (point.y - cy) * cos) * cardScale
              }))
              variants.push({ name, canvas, expected })
            }
          }
          for (const variant of variants.filter(
            (variant) => !variantsFilter || variantsFilter.includes(variant.name)
          )) {
            const { canvas, expected } = variant
            const before = performance.now(),
              crop = autoIdCrop(canvas),
              detectionMs = performance.now() - before
            let side = geometryOnly
              ? { turns: 0, crop, orientationVerified: true }
              : await analyzer.analyze({
                  id: crypto.randomUUID(),
                  name: source.name,
                  canvas
                })
            if (variant.legacyTurns && !geometryOnly)
              side = await analyzer.orient(
                { id: crypto.randomUUID(), name: source.name, canvas },
                horizontalIdSide(
                  canvas.width,
                  canvas.height,
                  rotateIdSide(side, variant.legacyTurns)
                )
              )
            const oriented = orientIdArtwork({ id: 'proof', name: source.name, canvas }, side.turns)
            const outputPlacement = idCardPlacement(
              oriented.width,
              oriented.height,
              side.crop,
              'A4'
            )
            const dx = expected ? expected[1].x - expected[0].x + expected[2].x - expected[3].x : 1
            const dy = expected ? expected[1].y - expected[0].y + expected[2].y - expected[3].y : 0
            const orientationAngle =
              ((Math.atan2(dy, dx) * 180) / Math.PI +
                side.turns * 90 -
                outputPlacement.angleDegrees +
                720) %
              360
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
              heightMm: 56,
              detectedHeightMm: placement.heightMm,
              crop,
              detectionMs,
              orientationVerified: side.orientationVerified,
              orientationError: Math.min(orientationAngle, 360 - orientationAngle),
              autoTurns: side.turns,
              coverage: expected ? intersection / expectedCount : null,
              precision: expected ? intersection / selectedCount : null,
              overlay: overlay.toDataURL('image/png'),
              proofs: []
            }
            const profiles = [
              {
                name: 'color',
                color: true,
                heightMm: 56,
                turns: 0,
                spacing: 'even',
                marginMm: 5,
                gapMm: 5
              },
              {
                name: 'mono',
                color: false,
                heightMm: 56,
                turns: 0,
                spacing: 'even',
                marginMm: 5,
                gapMm: 5
              }
            ]
            if (variant.name === 'original')
              profiles.push(
                {
                  name: '55-horizontal',
                  color: true,
                  heightMm: 55,
                  turns: 1,
                  spacing: 'even',
                  marginMm: 7,
                  gapMm: 3
                },
                {
                  name: '60-flip180',
                  color: true,
                  heightMm: 60,
                  turns: 2,
                  spacing: 'compact',
                  marginMm: 5,
                  gapMm: 5
                },
                {
                  name: '60-horizontal-back',
                  color: false,
                  heightMm: 60,
                  turns: 3,
                  spacing: 'even',
                  marginMm: 10,
                  gapMm: 8,
                  back: true
                }
              )
            if (variant.name === 'original')
              profiles.push({
                name: 'fill8',
                color: true,
                heightMm: 56,
                turns: 0,
                spacing: 'even',
                marginMm: 5,
                gapMm: 5,
                count: 8
              })
            for (const profile of geometryOnly ? [] : profiles) {
              const { color, turns } = profile,
                settings = { ...DEFAULT_ID_SHEET_SETTINGS, ...profile },
                size = idPrintedSize(settings.heightMm, turns)
              const profileCount = profile.count ?? idsPerSheet
              const layout = idCopiesLayout(
                'A4',
                false,
                [Math.max(settings.heightMm, size.heightMm)],
                profileCount,
                {
                  cellWidthMm: Math.max(90, size.widthMm),
                  marginMm: settings.marginMm,
                  gapMm: settings.gapMm,
                  spacing: settings.spacing
                }
              )
              const sheet = drawIdSheet(
                oriented,
                side.crop,
                { printer: 'Verification only', paper: 'A4', pagesPerSheet: 1, color },
                300,
                undefined,
                {
                  count: profileCount,
                  cellHeightMm: layout.cellHeightMm,
                  layout,
                  settings,
                  sheetTurns: turns,
                  back: profile.back
                }
              )
              const pixels = sheet
                .getContext('2d')
                .getImageData(0, 0, sheet.width, sheet.height).data
              record.proofs.push({
                color,
                name: profile.name,
                expectedCount: profileCount,
                expectedWidthMm: size.widthMm,
                expectedHeightMm: size.heightMm,
                ...measureIdProof(
                  pixels,
                  sheet.width,
                  sheet.height,
                  idCopyCenters(layout, profile.back),
                  size.heightMm,
                  300,
                  4,
                  size.widthMm
                ),
                png: sheet.toDataURL('image/png')
              })
              sheet.width = 0
              sheet.height = 0
            }
            results.push(record)
          }
        }
        analyzer.dispose()
        return results
      }
      const results = []
      for (const source of sources) {
        const script = `(${run.toString()})(${JSON.stringify([source])},${JSON.stringify(annotations)},${JSON.stringify(root.replaceAll('\\', '/'))},${idsPerSheet},${geometryOnly},${process.env.ID_TEST_VARIANTS || 'null'})`
        console.log('Checking ' + source.name)
        let deadline
        let batch
        try {
          batch = await Promise.race([
            window.webContents.executeJavaScript(script),
            new Promise((_, reject) => {
              deadline = setTimeout(
                () => reject(new Error('ID proof renderer timed out: ' + source.name)),
                180_000
              )
            })
          ])
        } finally {
          clearTimeout(deadline)
        }
        for (const item of batch) {
          const prefix = String(results.length + 1).padStart(2, '0') + '-' + item.variant
          await writeFile(
            join(output, prefix + '-crop.png'),
            Buffer.from(item.overlay.split(',')[1], 'base64')
          )
          delete item.overlay
          for (const proof of item.proofs) {
            await writeFile(
              join(output, prefix + '-' + proof.name + '.png'),
              Buffer.from(proof.png.split(',')[1], 'base64')
            )
            delete proof.png
          }
          results.push(item)
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
          {
            sourceFolder,
            idsPerSheet,
            sources: sources.map(({ base64, ...source }) => source),
            results
          },
          null,
          2
        )
      )
      for (const item of results) {
        assert.equal(item.widthMm, 90)
        assert.ok(
          item.heightMm < item.widthMm,
          `${item.source} ${item.variant}: ID must be horizontal`
        )
        if (!geometryOnly)
          assert.ok(
            item.orientationVerified,
            `${item.source} ${item.variant}: orientation is uncertain`
          )
        if (!geometryOnly)
          assert.ok(
            item.orientationError < 8,
            `${item.source} ${item.variant}: card is upside down (${item.orientationError})`
          )
        if (item.coverage !== null) {
          assert.ok(item.coverage > 0.94, `${item.source} ${item.variant}: crop clips the card`)
          assert.ok(item.precision > 0.8, `${item.source} ${item.variant}: too much background`)
        }
        if (item.variant.includes('plus45')) assert.ok(Math.abs(item.angle - 45) < 3)
        if (item.variant.includes('minus45')) assert.ok(Math.abs(item.angle + 45) < 3)
        for (const proof of item.proofs) {
          assert.equal(proof.cells.length, proof.expectedCount)
          assert.equal(proof.outsideInkPixels, 0, 'Ink appeared outside the planned card slots')
          for (const cell of proof.cells) {
            assert.ok(
              cell.inkWidthMm > proof.expectedWidthMm - 3 &&
                cell.inkWidthMm < proof.expectedWidthMm + 0.3,
              'Unexpected printed card width'
            )
            assert.ok(
              cell.inkHeightMm > proof.expectedHeightMm - 3 &&
                cell.inkHeightMm < proof.expectedHeightMm + 0.3,
              'Unexpected printed card height'
            )
            assert.ok(
              Math.abs(cell.centerOffsetMm.x) < 1 && Math.abs(cell.centerOffsetMm.y) < 1,
              'Printed card is not centered'
            )
          }
          if (!proof.color) assert.equal(proof.chromaticPixels, 0, 'Grayscale proof contains color')
        }
        console.log(
          `${item.source} / ${item.variant}: ${item.angle.toFixed(1)} degrees, 90 x ${item.heightMm.toFixed(1)} mm, coverage ${item.coverage?.toFixed(3) ?? 'needs review'}`
        )
      }
      console.log(
        `ID real-photo ${geometryOnly ? 'geometry' : 'print-proof and orientation'} verification passed. Original hashes unchanged. Artifacts: ${output}`
      )
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
