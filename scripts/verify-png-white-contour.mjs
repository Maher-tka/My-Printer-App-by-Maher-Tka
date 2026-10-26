import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

// Isolated, invisible Electron window: no desktop interaction or print jobs.
const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'output/png-white-contour-proof')
process.chdir(root)
await mkdir(output, { recursive: true })
if (!process.versions.electron) {
  await mkdir(resolve(root, 'tmp'), { recursive: true })
  await writeFile(
    resolve(root, 'tmp/png-contour-proof.html'),
    '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/tmp/png-contour-proof.tsx"></script></body></html>'
  )
  await writeFile(
    resolve(root, 'tmp/png-contour-proof.tsx'),
    `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {CutterMontagePage} from '/src/renderer/src/tools/cutter-montage/CutterMontagePage';
import * as contour from '/src/renderer/src/tools/cutter-montage/lib/pngWhiteContour';
import {deserializeCutterProjectPayload} from '/src/renderer/src/projects/projectFiles';
import {exportCutterPdf} from '/src/renderer/src/tools/cutter-montage/lib/pdfCutExport';
import {getPathBounds} from '/src/renderer/src/tools/cutter-montage/lib/pathBounds';
import {setLanguage} from '/src/renderer/src/i18n/language';
import {setThemePreference} from '/src/renderer/src/appearance/theme';
import {setPerformancePreset} from '/src/renderer/src/performance/performanceSettings';
import * as pdfjs from 'pdfjs-dist'; import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '/src/renderer/src/styles.css'; pdfjs.GlobalWorkerOptions.workerSrc=worker;
const state={...contour,deserializeCutterProjectPayload,exportCutterPdf,getPathBounds,setLanguage,setThemePreference,setPerformancePreset,pdfjs};
Object.assign(window,{contourProof:state,printerApp:{runtime:{},saveProject:async request=>{state.saved=request.project;return{ok:true,filePath:'proof.printerproject'}}}});
createRoot(document.getElementById('root')).render(<div className="h-screen flex flex-col bg-background text-foreground"><CutterMontagePage onNavigate={()=>{}} onOpenProject={async()=>({ok:false,canceled:true})} onProjectSessionChange={()=>{}} onConfirmUnsavedChanges={async()=>true}/></div>);`
  )
  const { createServer } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const { spawn } = await import('node:child_process')
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: resolve('node_modules/.vite-png-contour-proof'),
    optimizeDeps: { entries: ['tmp/png-contour-proof.html'] },
    plugins: [react()],
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    server: {
      host: '127.0.0.1',
      port: 5199,
      strictPort: true,
      watch: { ignored: ['**/output/**', '**/out/**'] }
    }
  })
  await server.listen()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(createRequire(import.meta.url)('electron'), [resolve(import.meta.filename)], {
    env,
    windowsHide: true,
    stdio: 'inherit'
  })
  child.once('exit', async (code) => {
    await server.close()
    process.exitCode = code ?? 1
  })
} else {
  const { app, BrowserWindow } = await import('electron')
  app.disableHardwareAcceleration()
  app.setPath('userData', resolve(app.getPath('temp'), 'my-printer-png-contour-proof'))
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 768,
      webPreferences: { sandbox: false, offscreen: true, backgroundThrottling: false }
    })
    const run = (fn, ...args) =>
      win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`)
    const wait = async (fn, ...args) => {
      for (let i = 0; i < 300; i++) {
        if (await run(fn, ...args)) return
        await new Promise((r) => setTimeout(r, 50))
      }
      throw Error('Timed out: ' + fn)
    }
    const click = async (text) => {
      await run((text) => {
        const b = [...document.querySelectorAll('button')].find(
          (b) =>
            b.getClientRects().length &&
            (b.textContent.trim() === text || b.textContent.trim().startsWith(text + ' ('))
        )
        if (!b || b.disabled) throw Error('Missing enabled button: ' + text)
        b.click()
      }, text)
      await new Promise((r) => setTimeout(r, 100))
    }
    const capture = async (name) => {
      win.webContents.invalidate()
      await new Promise((r) => setTimeout(r, 350))
      await writeFile(resolve(output, name + '.png'), (await win.webContents.capturePage()).toPNG())
    }
    try {
      await win.loadURL('http://127.0.0.1:5199/tmp/png-contour-proof.html')
      await wait(() => !!window.contourProof && !!document.querySelector('aside button'))
      await click('PNG white contour')
      await wait(() => document.activeElement?.textContent.includes('Import PNG images'))
      await capture('empty-1366-en-light')
      const numeric = await run(async () => {
        const p = window.contourProof
        const files = []
        for (const shape of ['rectangle', 'circle', 'edge', 'opaque']) {
          const c = document.createElement('canvas')
          c.width = 240
          c.height = 180
          const ctx = c.getContext('2d')
          ctx.fillStyle = '#1565c0'
          if (shape === 'circle') {
            ctx.beginPath()
            ctx.arc(120, 90, 65, 0, Math.PI * 2)
            ctx.fill()
          } else if (shape === 'edge') {
            ctx.fillStyle = '#d43b2e'
            ctx.fillRect(0, 40, 190, 100)
            ctx.fillRect(185, 10, 35, 140)
          } else ctx.fillRect(...(shape === 'opaque' ? [0, 0, 240, 180] : [40, 30, 160, 120]))
          const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
          files.push(new File([blob], shape + '.png', { type: 'image/png' }))
        }
        p.files = files
        const result = await p.createPngWhiteContour(files[0], p.DEFAULT_PNG_WHITE_CONTOUR)
        const bitmap = await createImageBitmap(new Blob([result.png], { type: 'image/png' }))
        const c = document.createElement('canvas')
        c.width = bitmap.width
        c.height = bitmap.height
        const ctx = c.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()
        const padding = (result.widthPx - 240) / 2
        const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data]
        // Original source starts at x=padding; rectangle at source x=40. 3 px/mm.
        const outerWhite = pixel(padding + 40 - 8, padding + 90)
        const insideWhite = pixel(padding + 40 - 4, padding + 90)
        const blue = pixel(padding + 60, padding + 60)
        const outside = pixel(padding + 40 - 11, padding + 90)
        if (
          outerWhite.join() !== '255,255,255,255' ||
          insideWhite.join() !== '255,255,255,255' ||
          blue.join() !== '21,101,192,255' ||
          outside[3] !== 0
        )
          throw Error('Wrong white bleed or source pixels')
        const cut = p.getPathBounds(result.pathData)
        const cutLeft = cut.x * result.widthMm
        const artworkLeft = (padding + 40) / 3
        if (Math.abs(artworkLeft - cutLeft - 2) > 0.02) throw Error('Cut distance is wrong')
        for (const [file, expected] of [
          [files[3], 'transparent background'],
          [new File(['invalid'], 'fake.png'), 'valid PNG']
        ]) {
          try {
            await p.createPngWhiteContour(file, p.DEFAULT_PNG_WHITE_CONTOUR)
            throw Error('Accepted invalid PNG')
          } catch (error) {
            if (!error.message.includes(expected)) throw error
          }
        }
        const data = new DataTransfer()
        files.forEach((file) => data.items.add(file))
        const input = document.querySelector('input[aria-label="Import PNG images"]')
        input.files = data.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return {
          outerWhite,
          insideWhite,
          blue,
          outside,
          cutClearanceMm: artworkLeft - cutLeft,
          sourcePreserved: true
        }
      })
      await wait(
        () =>
          document.querySelectorAll('article svg[role="img"]').length === 3 &&
          document.querySelectorAll('article [role="alert"]').length === 1 &&
          !document.querySelector('section[aria-busy="true"]')
      )
      await capture('batch-with-error')
      await run(() => document.querySelectorAll('article')[3].querySelector('button').click())
      const layouts = []
      for (const [w, h, language, theme, performance] of [
        [1366, 768, 'en', 'light', 'balanced'],
        [1920, 1080, 'fr', 'dark', 'balanced'],
        [1366, 768, 'ar', 'dark', 'low-end'],
        [1600, 900, 'fr', 'light', 'balanced']
      ]) {
        win.setContentSize(w, h)
        await run(
          (language, theme, performance) => {
            const p = window.contourProof
            p.setLanguage(language)
            p.setThemePreference(theme)
            p.setPerformancePreset(performance)
          },
          language,
          theme,
          performance
        )
        await capture(`batch-${w}-${language}-${theme}`)
        const layout = await run(() => {
          const section = document.querySelector('section[aria-busy]')
          const buttons = [...section.querySelectorAll('button')].filter(
            (b) => b.getClientRects().length
          )
          const outside = buttons.filter((b) => {
            const r = b.getBoundingClientRect()
            return r.left < 0 || r.right > innerWidth + 1
          })
          return {
            dir: document.documentElement.dir,
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            clippedButtons: outside.map((b) => b.textContent),
            cards: document.querySelectorAll('article svg[role="img"]').length
          }
        })
        if (layout.horizontalOverflow || layout.clippedButtons.length || layout.cards !== 3)
          throw Error('Layout overflow: ' + JSON.stringify(layout))
        layouts.push({ w, h, language, theme, performance, ...layout })
      }
      await run(() => window.contourProof.setLanguage('en'))
      // Native keyboard Tab reaches shared inputs and buttons; no mouse takeover.
      await run(() =>
        document.querySelector('input[aria-label="Import PNG images"]').nextElementSibling.focus()
      )
      win.webContents.debugger.attach('1.3')
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9
      })
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9
      })
      await new Promise((r) => setTimeout(r, 100))
      const tabFocus = await run(() => document.activeElement?.textContent.trim())
      if (!tabFocus.startsWith('Send to Cutter'))
        throw Error('Unexpected keyboard focus: ' + tabFocus)
      // Modify border: invalidates all unsent output and requires regeneration.
      await run(() => {
        const input = [...document.querySelectorAll('label')]
          .find((l) => l.textContent.includes('White border (mm)'))
          .querySelector('input')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '4')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await wait(() => document.querySelectorAll('article svg[role="img"]').length === 0)
      await click('Update contours')
      await wait(
        () =>
          document.querySelectorAll('article svg[role="img"]').length === 3 &&
          !document.querySelector('section[aria-busy="true"]')
      )
      await run(() => {
        const input = document.querySelector('article label input')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await click('Send to Cutter')
      await click('Cutter Montage')
      await click('Save')
      await wait(() => !!window.contourProof.saved)
      const production = await run(async () => {
        const p = window.contourProof,
          project = {
            ...p.deserializeCutterProjectPayload(p.saved.payload),
            exportSettings: p.saved.payload.exportSettings
          }
        if (
          project.pieces.length !== 3 ||
          project.placedPieces.length !== 4 ||
          project.pieces.some((piece) => piece.clippingMaskEnabled)
        )
          throw Error('Production lost batch/copies/bleed')
        p.project = project
        const result = await p.exportCutterPdf(project)
        const bytes = new Uint8Array(await result.blob.arrayBuffer())
        p.pdf = bytes
        const pdf = await p.pdfjs.getDocument({ data: bytes.slice() }).promise,
          page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 1 })
        const c = document.createElement('canvas')
        c.width = viewport.width
        c.height = viewport.height
        await page.render({ canvasContext: c.getContext('2d'), viewport }).promise
        const png = c.toDataURL().split(',')[1]
        const content = await pdf.getOptionalContentConfig()
        const cutGroup = [...content].find(([, group]) => group.name === 'CutContour')?.[0]
        if (!cutGroup) throw Error('Missing independent CutContour PDF layer')
        content.setVisibility(cutGroup, true)
        await page.render({
          canvasContext: c.getContext('2d'),
          viewport,
          optionalContentConfigPromise: Promise.resolve(content)
        }).promise
        const cutPng = c.toDataURL().split(',')[1]
        await pdf.destroy()
        return {
          pieces: project.pieces.length,
          copies: project.placedPieces.length,
          bleedPreserved: true,
          separateCutContourLayer: true,
          pdf: Array.from(bytes),
          png,
          cutPng
        }
      })
      await writeFile(resolve(output, 'production.pdf'), new Uint8Array(production.pdf))
      await writeFile(resolve(output, 'production.png'), Buffer.from(production.png, 'base64'))
      await writeFile(
        resolve(output, 'production-cut-proof.png'),
        Buffer.from(production.cutPng, 'base64')
      )
      delete production.pdf
      delete production.png
      delete production.cutPng
      // Carry both an edited result and an unprocessed PNG from AI Sticker Maker.
      await click('AI Sticker Maker')
      await run(() => {
        const data = new DataTransfer()
        window.contourProof.files.slice(0, 2).forEach((file) => data.items.add(file))
        const input = document.querySelector(
          'section[aria-label="AI Sticker Maker"] input[accept=".ai,.pdf,.png,.jpg,.jpeg,.webp"]'
        )
        input.files = data.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await wait(
        () =>
          document.querySelectorAll('[data-sticker-id]').length === 2 &&
          !document.querySelector('section[aria-busy="true"]')
      )
      const changeAiField = async (name, value) => {
        await run(
          (name, value) => {
            const label = [
              ...document.querySelectorAll('section[aria-label="AI Sticker Maker"] label')
            ].find((label) => label.textContent.trim().startsWith(name))
            const input = label.querySelector('input')
            input.value = String(value)
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
          },
          name,
          value
        )
        await new Promise((resolve) => setTimeout(resolve, 60))
      }
      await changeAiField('Artwork width (mm)', 45)
      await changeAiField('Copies', 3)
      await run(() => document.querySelectorAll('[data-sticker-id]')[1].click())
      await changeAiField('Artwork width (mm)', 65)
      await changeAiField('Copies', 2)
      await run(() => document.querySelector('[data-sticker-id]').click())
      await click('Process selected')
      await wait(
        () =>
          document.querySelector('[data-sticker-id]').textContent.includes('Ready') &&
          !document.querySelector('section[aria-busy="true"]')
      )
      await click('Mask')
      const point = await run(() => {
        const box = document
          .querySelector('canvas[aria-label="Editable alpha mask"]')
          .getBoundingClientRect()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      })
      for (const type of ['mousePressed', 'mouseReleased'])
        await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
          type,
          x: point.x,
          y: point.y,
          button: 'left',
          buttons: type === 'mousePressed' ? 1 : 0,
          clickCount: 1
        })
      await wait(
        () =>
          document
            .querySelector('section[aria-label="AI Sticker Maker"]')
            .textContent.includes('Mask and vector cutline updated') &&
          !document.querySelector('section[aria-busy="true"]')
      )
      await capture('ai-before-handoff')
      await click('PNG white contour')
      await wait(
        () =>
          document.querySelectorAll('article svg[role="img"]').length === 5 &&
          !document.querySelector('section[aria-busy="true"]')
      )
      const handoff = await run(async () => {
        const cards = [...document.querySelectorAll('article')].slice(3)
        const copies = cards.map((card) => Number(card.querySelector('label input').value))
        if (copies.join() !== '3,2') throw Error('Handoff lost copies: ' + copies)
        for (const [index, width] of [45, 65].entries()) {
          const padding = Math.ceil((4 * 240) / width) + 1
          const expected = (((240 + padding * 2) * width) / 240).toFixed(1)
          if (!cards[index].textContent.includes(expected + ' ×'))
            throw Error('Handoff lost source width')
        }
        const previews = cards.map((card) => card.querySelector('image').getAttribute('href'))
        window.contourProof.handoffPreviews = previews
        const bitmap = await createImageBitmap(await (await fetch(previews[0])).blob())
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()
        const editedPixel = [...ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data]
        if (editedPixel.join() !== '255,255,255,255')
          throw Error('Handoff restored original blue pixels over the edited mask')
        return { copies, widthsMm: [45, 65], editedPixel, unprocessedStickerIncluded: true }
      })
      await capture('from-ai-maker')
      for (const [w, h, language, theme, performance] of [
        [1366, 768, 'en', 'light', 'balanced'],
        [1920, 1080, 'fr', 'dark', 'balanced'],
        [1366, 768, 'ar', 'dark', 'low-end']
      ]) {
        win.setContentSize(w, h)
        await run(
          (language, theme, performance) => {
            const p = window.contourProof
            p.setLanguage(language)
            p.setThemePreference(theme)
            p.setPerformancePreset(performance)
            document.querySelector('article:last-child').scrollIntoView({ block: 'end' })
          },
          language,
          theme,
          performance
        )
        await capture(`ai-handoff-${w}-${language}-${theme}`)
        if (await run(() => document.documentElement.scrollWidth > innerWidth + 1))
          throw Error('Handoff layout overflow')
      }
      await run(() => {
        const p = window.contourProof
        p.setLanguage('en')
        p.setThemePreference('light')
        p.setPerformancePreset('balanced')
      })
      await click('AI Sticker Maker')
      await wait(() => document.activeElement?.hasAttribute('data-open-png-contours'))
      if (await run(() => document.querySelectorAll('[data-sticker-id]').length !== 2))
        throw Error('Handoff modified the AI source queue')
      await click('PNG white contour')
      await wait(
        () =>
          document.querySelectorAll('article svg[role="img"]').length === 5 &&
          !document.querySelector('section[aria-busy="true"]')
      )
      if (
        await run(() =>
          [...document.querySelectorAll('article image')]
            .slice(3)
            .some(
              (image, index) =>
                image.getAttribute('href') !== window.contourProof.handoffPreviews[index]
            )
        )
      )
        throw Error('Reopening regenerated unchanged stickers')
      await click('AI Sticker Maker')
      await changeAiField('Copies', 4)
      await click('PNG white contour')
      await wait(
        () =>
          document.querySelectorAll('article svg[role="img"]').length === 5 &&
          !document.querySelector('section[aria-busy="true"]')
      )
      if (await run(() => Number(document.querySelectorAll('article label input')[3].value) !== 4))
        throw Error('Updated AI sticker was not synchronized')
      await click('Send to Cutter')
      await click('AI Sticker Maker')
      await click('Cutter Montage')
      await click('Save')
      await wait(() => window.contourProof.saved.payload.pieces.length === 5)
      handoff.finalCopies = await run(() => window.contourProof.saved.payload.placedPieces.length)
      if (handoff.finalCopies !== 10) throw Error('Transferred copies lost in production')
      await click('AI Sticker Maker')
      await click('PNG white contour')
      await wait(() => document.querySelectorAll('article svg[role="img"]').length === 5)
      // Shared Clear confirmation: Cancel preserves queue, then Clear removes only this subtool's items.
      await click('Clear')
      await click('Cancel')
      await wait(() => document.querySelectorAll('article svg[role="img"]').length === 5)
      await click('Clear')
      await run(() => document.querySelector('[role="alertdialog"] button:last-child').click())
      await wait(() => document.querySelectorAll('article').length === 0)
      const report = {
        numeric,
        layouts,
        production,
        handoff,
        keyboardTab: true,
        settingsRegeneration: true,
        bothEntryPoints: true,
        clearCancelAndConfirm: true,
        hardwarePrintJobs: 0
      }
      await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
      console.log(JSON.stringify(report))
      win.destroy()
      app.quit()
    } catch (error) {
      console.error(error)
      console.error(await run(() => document.body.innerText))
      await capture('failure')
      win.destroy()
      app.exit(1)
    }
  })
}
