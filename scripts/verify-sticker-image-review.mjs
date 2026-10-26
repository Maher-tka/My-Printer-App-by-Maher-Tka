import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
const root = resolve(import.meta.dirname, '..'),
  output = resolve(root, 'output/sticker-image-review-proof')
process.chdir(root)
await mkdir(output, { recursive: true })
if (!process.versions.electron) {
  await mkdir(resolve(root, 'tmp'), { recursive: true })
  await writeFile(
    resolve(root, 'tmp/sticker-image-review-ui.html'),
    '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/tmp/sticker-image-review-ui.tsx"></script></body></html>'
  )
  await writeFile(
    resolve(root, 'tmp/sticker-image-review-ui.tsx'),
    `import React from 'react';import {createRoot} from 'react-dom/client';import {AIStickerMaker} from '/src/renderer/src/tools/cutter-montage/components/AIStickerMaker';import * as sheet from '/src/renderer/src/tools/cutter-montage/lib/stickerSheet';import * as maker from '/src/renderer/src/tools/cutter-montage/lib/stickerMaker';import {setLanguage} from '/src/renderer/src/i18n/language';import {setPerformancePreset} from '/src/renderer/src/performance/performanceSettings';import '/src/renderer/src/styles.css';const state={...sheet,...maker,setLanguage,setPerformancePreset,sent:[],written:[]};Object.assign(window,{stickerProof:state,printerApp:{selectOutputFolder:async()=>({ok:true,folderPath:'proof-output'}),writeFilesToFolder:async(folder,files)=>{state.written.push({folder,files});return{ok:true}},runtime:{importStickerVectors:async()=>({ok:true,stickers:[]})}}});createRoot(document.getElementById('root')).render(<div className="flex h-screen flex-col bg-background p-4 text-foreground"><AIStickerMaker onClose={()=>{}} onSend={orders=>state.sent.push(...orders)}/></div>);`
  )
  const { createServer } = await import('vite'),
    { default: react } = await import('@vitejs/plugin-react'),
    { spawn } = await import('node:child_process')
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: resolve('node_modules/.vite-sticker-image-review-proof'),
    optimizeDeps: { entries: ['tmp/sticker-image-review-ui.html'] },
    plugins: [react()],
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    server: {
      host: '127.0.0.1',
      port: 5198,
      strictPort: true,
      watch: { ignored: ['**/output/**', '**/out/**'] }
    }
  })
  await server.listen()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(
    createRequire(import.meta.url)('electron'),
    [resolve('scripts/verify-sticker-image-review.mjs')],
    { env, windowsHide: true, stdio: 'inherit' }
  )
  child.once('exit', async (code) => {
    await server.close()
    process.exitCode = code ?? 1
  })
} else {
  const { app, BrowserWindow } = await import('electron')
  app.disableHardwareAcceleration()
  app.setPath('userData', resolve(app.getPath('temp'), 'my-printer-image-review-proof'))
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 768,
      webPreferences: { sandbox: false, offscreen: true, backgroundThrottling: false }
    })
    try {
      await win.loadURL('http://127.0.0.1:5198/tmp/sticker-image-review-ui.html')
      win.webContents.debugger.attach('1.3')
      const mouse = async (type, x, y, held = false) =>
        win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
          type,
          x,
          y,
          button: type === 'mouseMoved' ? 'none' : 'left',
          buttons: held ? 1 : 0,
          clickCount: type === 'mouseMoved' ? 0 : 1
        })
      const run = (fn, ...args) =>
        win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`)
      const wait = async (fn, ...args) => {
        for (let i = 0; i < 400; i++) {
          if (await run(fn, ...args)) return
          await new Promise((r) => setTimeout(r, 50))
        }
        throw Error('Timed out: ' + fn)
      }
      const click = async (text) => {
        await wait(
          (text) =>
            [...document.querySelectorAll('button')].some(
              (b) =>
                !b.disabled &&
                (b.textContent.trim() === text || b.textContent.trim().startsWith(text + ' '))
            ),
          text
        )
        await run((text) => {
          const button = [...document.querySelectorAll('button')].find(
            (b) => b.textContent.trim() === text || b.textContent.trim().startsWith(text + ' ')
          )
          if (!button) throw Error('Missing button ' + text)
          button.click()
        }, text)
        await new Promise((r) => setTimeout(r, 50))
      }
      const capture = async (name) => {
        await new Promise((r) => {
          win.webContents.once('paint', r)
          win.webContents.invalidate()
          setTimeout(r, 300)
        })
        await writeFile(resolve(output, name), (await win.webContents.capturePage()).toPNG())
      }
      const reports = []
      await wait(
        () =>
          !!window.stickerProof &&
          !!document.querySelector('input[aria-label="Import sticker sheet"]')
      )
      await run(async () => {
        window.stickerProof.setLanguage('en')
        const c = document.createElement('canvas')
        c.width = 600
        c.height = 400
        const x = c.getContext('2d')
        x.fillStyle = 'rgb(240,240,240)'
        x.fillRect(0, 0, 600, 400)
        x.fillStyle = 'red'
        x.fillRect(40, 40, 140, 120)
        x.fillStyle = 'rgb(240,240,240)'
        x.fillRect(40, 75, 45, 20)
        x.fillStyle = 'blue'
        x.fillRect(300, 40, 140, 120)
        x.fillRect(455, 55, 10, 10)
        x.fillStyle = 'green'
        x.fillRect(40, 260, 140, 100)
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
        window.stickerProof.inputFile = new File([blob], 'review-sheet.png', { type: 'image/png' })
        const data = new DataTransfer()
        data.items.add(window.stickerProof.inputFile)
        const input = document.querySelector('input[aria-label="Import sticker sheet"]')
        input.files = data.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await wait(
        () =>
          document.querySelectorAll('[role=tab]').length === 4 &&
          !document.querySelector('section[aria-busy=true]')
      )
      await run(() =>
        document
          .querySelector('[role=tab]')
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      )
      await wait(
        () => document.querySelectorAll('[role=tab]')[1].getAttribute('aria-selected') === 'true'
      )
      await run(() => document.querySelector('[role=tab]').click())
      if (
        await run(
          () =>
            [...document.querySelectorAll('label')]
              .find((l) => l.textContent.includes('Remove background for this sticker'))
              .querySelector('input').checked
        )
      )
        throw Error('Background removal must be opt-in')
      for (const [w, h, lang, dark, preset] of [
        [1366, 768, 'en', false, 'balanced'],
        [1920, 1080, 'fr', true, 'balanced'],
        [1366, 768, 'ar', true, 'low-end'],
        [1600, 900, 'fr', false, 'balanced']
      ]) {
        win.setContentSize(w, h)
        await run(
          (lang, dark, preset) => {
            window.stickerProof.setLanguage(lang)
            window.stickerProof.setPerformancePreset(preset)
            document.documentElement.classList.toggle('dark', dark)
          },
          lang,
          dark,
          preset
        )
        await new Promise((r) => setTimeout(r, 150))
        const layout = await run(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          rtl: document.documentElement.dir === 'rtl',
          tabs: document.querySelectorAll('[role=tab]').length
        }))
        if (layout.overflow) throw Error('Review horizontal overflow ' + lang)
        await capture(`${w}-${lang}-${dark ? 'dark' : 'light'}-review.png`)
        reports.push({ w, h, lang, preset, ...layout })
      }
      await run(() => {
        window.stickerProof.setLanguage('en')
        document.documentElement.classList.remove('dark')
      })
      await click('Split vertically')
      await wait(() => document.querySelectorAll('[role=tab]').length === 5)
      await click('Undo')
      await wait(() => document.querySelectorAll('[role=tab]').length === 4)
      await click('Redo')
      await wait(() => document.querySelectorAll('[role=tab]').length === 5)
      await click('Undo')
      await wait(() => document.querySelectorAll('[role=tab]').length === 4)
      await click('Split horizontally')
      await wait(() => document.querySelectorAll('[role=tab]').length === 5)
      await click('Undo')
      await wait(() => document.querySelectorAll('[role=tab]').length === 4)
      await run(() => {
        document.querySelector('input[aria-label="Select for merge 2"]').click()
        document.querySelector('input[aria-label="Select for merge 3"]').click()
      })
      await click('Merge selected parts')
      await wait(() => document.querySelectorAll('[role=tab]').length === 3)
      await click('Undo')
      await wait(() => document.querySelectorAll('[role=tab]').length === 4)
      await click('Redo')
      await wait(() => document.querySelectorAll('[role=tab]').length === 3)
      await click('Add sticker selection')
      await wait(() => document.querySelectorAll('[role=tab]').length === 4)
      await click('Delete selection')
      await wait(() => document.querySelectorAll('[role=tab]').length === 3)
      await run(() => document.querySelector('[role=tab]').click())
      await run(() => {
        const i = [...document.querySelectorAll('label')]
          .find((l) => l.textContent.startsWith('Width (px)'))
          .querySelector('input')
        i.value = '170'
        i.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      })
      await new Promise((r) => setTimeout(r, 50))
      if (
        (await run(() =>
          Number(
            [...document.querySelectorAll('label')]
              .find((l) => l.textContent.startsWith('Width (px)'))
              .querySelector('input').value
          )
        )) !== 170
      )
        throw Error('Crop width control failed')
      await click('Undo')
      console.log(
        'Before pointer',
        await run(() => ({
          tabs: document.querySelectorAll('[role=tab]').length,
          width: [...document.querySelectorAll('label')]
            .find((l) => l.textContent.startsWith('Width (px)'))
            .querySelector('input').value
        }))
      )
      const handle = await run(() => {
        const b = document.querySelector('rect[style*="se-resize"]').getBoundingClientRect()
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
      })
      await mouse('mouseMoved', handle.x, handle.y)
      await mouse('mousePressed', handle.x, handle.y, true)
      await mouse('mouseMoved', handle.x + 25, handle.y + 20, true)
      await mouse('mouseReleased', handle.x + 25, handle.y + 20)
      await new Promise((r) => setTimeout(r, 100))
      console.log(
        'After pointer',
        await run(() => ({
          tabs: document.querySelectorAll('[role=tab]').length,
          width: [...document.querySelectorAll('label')]
            .find((l) => l.textContent.startsWith('Width (px)'))
            .querySelector('input').value
        }))
      )
      if (
        (await run(() =>
          Number(
            [...document.querySelectorAll('label')]
              .find((l) => l.textContent.startsWith('Width (px)'))
              .querySelector('input').value
          )
        )) <= 142
      )
        throw Error('Pointer resize failed')
      await click('Undo')
      console.log(
        'After pointer undo',
        await run(() => ({
          tabs: document.querySelectorAll('[role=tab]').length,
          width: [...document.querySelectorAll('label')]
            .find((l) => l.textContent.startsWith('Width (px)'))
            .querySelector('input').value
        }))
      )
      await run(() =>
        [...document.querySelectorAll('label')]
          .find((l) => l.textContent.includes('Remove background for this sticker'))
          .querySelector('input')
          .click()
      )
      await click('Open stickers')
      await wait(
        () =>
          document.querySelectorAll('[data-sticker-id]').length === 3 &&
          !document.querySelector('section[aria-busy=true]')
      )
      const secondHash = await run(async () => {
        const bytes = await (
          await fetch(document.querySelectorAll('[data-sticker-id] img')[1].src)
        ).arrayBuffer()
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).join(',')
      })
      await click('Adjust sticker crop')
      await wait(
        () =>
          document.querySelectorAll('[role=tab]').length === 1 &&
          !document.querySelector('section[aria-busy=true]')
      )
      await run(() => {
        const i = [...document.querySelectorAll('label')]
          .find((l) => l.textContent.startsWith('Left (px)'))
          .querySelector('input')
        i.value = String(Number(i.value) - 5)
        i.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      })
      await new Promise((r) => setTimeout(r, 50))
      const origin = await run(() => ({
        x: Number(
          [...document.querySelectorAll('label')]
            .find((l) => l.textContent.startsWith('Left (px)'))
            .querySelector('input').value
        ),
        y: Number(
          [...document.querySelectorAll('label')]
            .find((l) => l.textContent.startsWith('Top (px)'))
            .querySelector('input').value
        )
      }))
      await click('Open stickers')
      await wait(
        () =>
          document.querySelectorAll('[data-sticker-id]').length === 3 &&
          !document.querySelector('section[aria-busy=true]')
      )
      const px = { x: 60 - origin.x, y: 85 - origin.y }
      const pixel = async () =>
        run(async (point) => {
          const image = await createImageBitmap(
            await (await fetch(document.querySelector('[data-sticker-id] img').src)).blob()
          )
          const c = document.createElement('canvas')
          c.width = image.width
          c.height = image.height
          const x = c.getContext('2d')
          x.drawImage(image, 0, 0)
          const result = Array.from(x.getImageData(point.x, point.y, 1, 1).data)
          image.close()
          return result
        }, px)
      const removed = await pixel()
      if (removed[3] !== 0)
        throw Error('Background-colored edge pixel should be removed in this fixture: ' + removed)
      await click('Mask')
      await click('Restore')
      const paint = await run((point) => {
        const c = document.querySelector('canvas[aria-label="Editable alpha mask"]'),
          b = c.getBoundingClientRect()
        return { x: b.x + (point.x / c.width) * b.width, y: b.y + (point.y / c.height) * b.height }
      }, px)
      await mouse('mouseMoved', paint.x, paint.y)
      await mouse('mousePressed', paint.x, paint.y, true)
      await mouse('mouseReleased', paint.x, paint.y)
      await wait(() =>
        document
          .querySelector('[role=status]')
          .textContent.includes('Mask and vector cutline updated')
      )
      const restored = await pixel()
      if (restored[3] !== 255 || restored[0] !== 240)
        throw Error('Restore lost original pixels: ' + restored)
      await click('Undo')
      await wait(() => !document.querySelector('section[aria-busy=true]'))
      if ((await pixel())[3] !== 0) throw Error('Mask undo failed')
      await click('Redo')
      await wait(() => !document.querySelector('section[aria-busy=true]'))
      if ((await pixel())[3] !== 255) throw Error('Mask redo failed')
      const secondAfter = await run(async () => {
        const bytes = await (
          await fetch(document.querySelectorAll('[data-sticker-id] img')[1].src)
        ).arrayBuffer()
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).join(',')
      })
      if (secondHash !== secondAfter) throw Error('Editing one sticker changed another sticker')
      await click('Restore original artwork')
      await wait(() => !document.querySelector('section[aria-busy=true]'))
      await click('Undo')
      await wait(() => !document.querySelector('section[aria-busy=true]'))
      await run(() => {
        const i = [...document.querySelectorAll('label')]
          .find((l) => l.textContent.trim().startsWith('Cut offset (mm)'))
          .querySelector('input')
        i.value = '1'
        i.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      })
      await new Promise((r) => setTimeout(r, 80))
      await run(() => document.querySelectorAll('[data-sticker-id]')[1].click())
      await new Promise((r) => setTimeout(r, 50))
      if (
        (await run(() =>
          Number(
            [...document.querySelectorAll('label')]
              .find((l) => l.textContent.trim().startsWith('Cut offset (mm)'))
              .querySelector('input').value
          )
        )) !== 2
      )
        throw Error('Changing one contour modified another offset')
      await run(() => document.querySelector('[data-sticker-id]').click())
      await new Promise((r) => setTimeout(r, 50))
      await capture('restored-sticker-mask.png')
      await run(() => {
        const i = [...document.querySelectorAll('label')]
          .find((l) => l.textContent.trim().startsWith('Copies'))
          .querySelector('input')
        i.value = '3'
        i.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      })
      await click('Export stickers')
      await wait(() =>
        document.querySelector('[role=status]').textContent.includes('Stickers exported: 3')
      )
      const exported = await run(() =>
        window.stickerProof.written
          .at(-1)
          .files.map((f) => ({ name: f.fileName, bytes: Array.from(f.bytes) }))
      )
      for (const [i, f] of exported.entries())
        await writeFile(resolve(output, `sticker-${i + 1}.png`), new Uint8Array(f.bytes))
      await run(() =>
        [...document.querySelectorAll('button')]
          .find((b) => b.textContent.includes('to Cutter'))
          .click()
      )
      const sent = await run(() =>
        window.stickerProof.sent.map((s) => ({
          quantity: s.quantity,
          path: !!s.result.pathData,
          offsetMm: s.offsetMm
        }))
      )
      if (
        sent.length !== 3 ||
        sent[0].quantity !== 3 ||
        sent.some((s) => !s.path) ||
        sent[0].offsetMm !== 1 ||
        sent[1].offsetMm !== 2
      )
        throw Error('Independent copy/contour layout failed ' + JSON.stringify(sent))
      const sample = await readFile('output/workshop-sticker-input/sticker-sheet.jpg').catch(
        (error) => {
          if (error.code === 'ENOENT') return null
          throw error
        }
      )
      const real = sample
        ? await run(async (b64) => {
            const file = new File(
              [Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))],
              'workshop.jpg',
              { type: 'image/jpeg' }
            )
            const p = window.stickerProof
            const d = await p.detectStickerSheetRegions(file, p.DEFAULT_STICKER_SHEET_SETTINGS)
            const crops = await p.separateStickerSheet(
              file,
              p.DEFAULT_STICKER_SHEET_SETTINGS,
              d.bounds.map((b) => ({ ...b, removeBackground: false }))
            )
            return {
              count: crops.length,
              originalsRetained: crops.every((c) => c.originalFile === c.file)
            }
          }, sample.toString('base64'))
        : { pending: 'Workshop sample unavailable' }
      if (sample && (real.count !== 10 || !real.originalsRetained))
        throw Error('Workshop separation/original retention failed')
      await run(async () => {
        const c = document.createElement('canvas')
        c.width = 64
        c.height = 64
        const x = c.getContext('2d')
        x.fillStyle = 'white'
        x.fillRect(0, 0, 64, 64)
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
        const data = new DataTransfer()
        data.items.add(new File([blob], 'manual-white.png', { type: 'image/png' }))
        const input = document.querySelector('input[aria-label="Import sticker sheet"]')
        input.files = data.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await wait(
        () =>
          !!document.querySelector('[aria-label="Review image stickers"]') &&
          !document.querySelector('section[aria-busy=true]')
      )
      if ((await run(() => document.querySelectorAll('[role=tab]').length)) !== 0)
        throw Error('Empty source should allow manual fallback')
      await click('Add sticker selection')
      await wait(() => document.querySelectorAll('[role=tab]').length === 1)
      await click('Cancel')
      await wait(() => document.querySelectorAll('[data-sticker-id]').length === 4)
      await click('Review image stickers')
      await wait(
        () =>
          !!document.querySelector('[aria-label="Review image stickers"]') &&
          !document.querySelector('section[aria-busy=true]')
      )
      await click('Add sticker selection')
      await click('Open stickers')
      await wait(
        () =>
          document.querySelectorAll('[data-sticker-id]').length === 4 &&
          !document.querySelector('section[aria-busy=true]')
      )
      const isolation = await run(async () => {
        const p = window.stickerProof,
          c = document.createElement('canvas')
        c.width = 200
        c.height = 160
        const x = c.getContext('2d')
        x.fillStyle = 'rgb(40,40,40)'
        x.fillRect(0, 0, 200, 160)
        for (let y = 0; y < 160; y += 20)
          for (let a = 0; a < 200; a += 20)
            if ((a / 20 + y / 20) % 2 === 0) {
              x.fillStyle = 'black'
              x.fillRect(a, y, 20, 20)
            }
        x.fillStyle = 'white'
        x.fillRect(10, 10, 65, 100)
        x.fillRect(110, 10, 65, 100)
        x.fillStyle = 'black'
        x.fillRect(20, 20, 45, 80)
        x.fillRect(120, 20, 45, 80)
        x.fillStyle = 'red'
        x.fillRect(30, 35, 25, 15)
        const file = new File(
          [await new Promise((r) => c.toBlob(r, 'image/png'))],
          'isolation.png',
          { type: 'image/png' }
        )
        const detected = await p.detectStickerSheetRegions(file, p.DEFAULT_STICKER_SHEET_SETTINGS)
        const region = {
          ...detected.bounds[0],
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          removeBackground: true,
          isolateArtwork: true
        }
        const [crop] = await p.separateStickerSheet(file, p.DEFAULT_STICKER_SHEET_SETTINGS, [
          region
        ])
        const sample = async (f) => {
          const b = await createImageBitmap(f)
          c.width = b.width
          c.height = b.height
          x.drawImage(b, 0, 0)
          b.close()
          return x.getImageData(0, 0, c.width, c.height).data
        }
        const prepared = await sample(crop.file),
          original = await sample(crop.originalFile)
        if (
          prepared[(30 * 200 + 30) * 4 + 3] !== 255 ||
          prepared[(30 * 200 + 130) * 4 + 3] !== 0 ||
          original[(30 * 200 + 130) * 4 + 3] !== 255
        )
          throw Error('Isolation lost enclosed artwork or retained neighbor')
        const both = await p.separateStickerSheet(file, p.DEFAULT_STICKER_SHEET_SETTINGS, [
          { ...region, seeds: detected.bounds.flatMap((b) => b.seeds) }
        ])
        const combined = await sample(both[0].file)
        if (combined[(30 * 200 + 130) * 4 + 3] !== 255) throw Error('Merged seeds lost a part')
        window.stickerProof.isolationFile = file
        const data = new DataTransfer()
        data.items.add(file)
        const input = document.querySelector('input[aria-label="Import sticker sheet"]')
        input.files = data.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return {
          neighborExcluded: true,
          enclosedBlackPreserved: true,
          mergedPartsPreserved: true,
          originalRetained: true
        }
      })
      await wait(
        () =>
          document.querySelectorAll('[role=tab]').length === 2 &&
          !document.querySelector('section[aria-busy=true]')
      )
      await run(async () => {
        for (const [label, value] of [
          ['Left (px)', 0],
          ['Top (px)', 0],
          ['Width (px)', 200],
          ['Height (px)', 160]
        ]) {
          const input = [...document.querySelectorAll('label')]
            .find((l) => l.textContent.trim().startsWith(label))
            .querySelector('input')
          input.value = String(value)
          input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
          await new Promise((r) => setTimeout(r, 50))
        }
      })
      await run(() =>
        [...document.querySelectorAll('label')]
          .find((l) => l.textContent.includes('Exclude neighboring artwork'))
          .querySelector('input')
          .click()
      )
      await wait(
        () =>
          !!document.querySelector('img[alt="Prepared sticker preview"]') &&
          !document.querySelector('[role=status]')?.textContent.includes('Preparing preview')
      )
      await capture('isolated-sticker-preview.png')
      await click('Open stickers')
      await wait(
        () =>
          document.querySelectorAll('[data-sticker-id]').length === 6 &&
          !document.querySelector('section[aria-busy=true]')
      )
      const neighborAlpha = () =>
        run(async () => {
          const file = await (
            await fetch(document.querySelector('[data-sticker-id][aria-pressed=true] img').src)
          ).blob()
          const bitmap = await createImageBitmap(file),
            c = document.createElement('canvas')
          c.width = bitmap.width
          c.height = bitmap.height
          const x = c.getContext('2d')
          x.drawImage(bitmap, 0, 0)
          bitmap.close()
          return x.getImageData(130, 30, 1, 1).data[3]
        })
      if ((await neighborAlpha()) !== 0) throw Error('Prepared queue item retained its neighbor')
      await click('Adjust sticker crop')
      await wait(
        () =>
          document.querySelectorAll('[role=tab]').length === 1 &&
          !document.querySelector('section[aria-busy=true]')
      )
      if (
        !(await run(
          () =>
            [...document.querySelectorAll('label')]
              .find((l) => l.textContent.includes('Exclude neighboring artwork'))
              .querySelector('input').checked
        ))
      )
        throw Error('Recrop lost isolation metadata')
      await click('Cancel')
      await click('Mask')
      await click('Restore original artwork')
      await wait(() => !document.querySelector('section[aria-busy=true]'))
      if ((await neighborAlpha()) !== 255)
        throw Error('Original excluded pixels could not be restored')
      await click('Undo')
      await wait(() => !document.querySelector('section[aria-busy=true]'))
      if ((await neighborAlpha()) !== 0) throw Error('Undo failed after restoring excluded artwork')
      isolation.recropRetainsIsolation = true
      isolation.restoreAndUndo = true
      reports.push({
        separated: 3,
        keyboardTabs: true,
        manualFallbackAndCancel: true,
        pointerResize: true,
        restoreOriginal: true,
        mergeUndoRedo: true,
        manualCrop: true,
        recropOnlySelected: true,
        removedPixel: removed,
        restoredPixel: restored,
        maskUndoRedo: true,
        secondStickerUnchanged: true,
        exported: exported.length,
        sent,
        workshopSample: real,
        splitUndo: true,
        isolation
      })
      await writeFile(resolve(output, 'report.json'), JSON.stringify(reports, null, 2))
      console.log(JSON.stringify(reports))
      win.destroy()
      app.quit()
    } catch (error) {
      console.error(error)
      console.error(await win.webContents.executeJavaScript('document.body.innerText'))
      await writeFile(resolve(output, 'failure.png'), (await win.webContents.capturePage()).toPNG())
      win.destroy()
      app.exit(1)
    }
  })
}
