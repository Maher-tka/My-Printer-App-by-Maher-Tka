import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

const root = resolve(import.meta.dirname, '..')
process.chdir(root)
const output = resolve('output/card-print-default')
await mkdir(output, { recursive: true })
if (!process.versions.electron) {
  await mkdir(resolve('tmp'), { recursive: true })
  await writeFile(
    resolve('tmp/card-print-default.html'),
    '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/tmp/card-print-default.tsx"></script></body></html>'
  )
  await writeFile(
    resolve('tmp/card-print-default.tsx'),
    `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{CardMontagePage}from'/src/renderer/src/tools/card-montage/CardMontagePage';
import{DEFAULT_CARD_SETTINGS}from'/src/renderer/src/tools/card-montage/types';
import{setLanguage,translate}from'/src/renderer/src/i18n/language';
import{setThemePreference}from'/src/renderer/src/appearance/theme';
import{setPerformancePreset}from'/src/renderer/src/performance/performanceSettings';
import{preferredPrinter,preferredProfile,emptyPrinterPreferences}from'/src/shared/printer-preferences';
import'/src/renderer/src/styles.css';
const key='card-preset-proof',id='a'.repeat(32),a3='b'.repeat(32);
const preset={id,name:'Thick business cards / bypass tray',printer:'Card printer',paper:'A4',color:true,landscape:false,tray:'Bypass',duplex:'Simplex',paperWidthMm:210,paperHeightMm:297,copies:1,savedAt:'',usable:true};
const initial={preferences:{...emptyPrinterPreferences(),defaultPrinter:'Office printer',profiles:{'Office printer':{'fast:A4:mono:1':'c'.repeat(32)}}},devices:[{name:'Office printer',papers:['A4'],color:true,isDefault:true},{name:'Card printer',papers:['A4','A3'],color:true}],presets:[preset,{...preset,id:a3,paper:'A3',name:'A3 poster stock'}]};
const read=()=>JSON.parse(localStorage.getItem(key)||JSON.stringify(initial));const write=s=>localStorage.setItem(key,JSON.stringify(s));
const proof={id,a3,initial,read,write,setLanguage,setThemePreference,setPerformancePreset,translate,prints:[],failLoad:false,failSave:false};
Object.assign(window,{cardProof:proof,printerApp:{printers:{get:async()=>{if(proof.failLoad)throw Error('load failed');return read()},save:async preferences=>{await new Promise(r=>setTimeout(r,80));if(proof.failSave)throw Error('Could not save printer preset. Choose it again to retry.');const next={...read(),preferences};write(next);return next}},printPdf:async request=>{const snapshot=read(),printer=preferredPrinter(snapshot.preferences,'tool:card-montage'),profile=printer&&preferredProfile(snapshot.preferences,printer,'tool:card-montage');proof.prints.push({printer,profile,copies:request.copies,bytes:request.bytes.length});return{ok:true,printerName:printer}}}});
const canvas=document.createElement('canvas');canvas.width=160;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#335c99';ctx.fillRect(0,0,160,100);ctx.fillStyle='white';ctx.font='22px sans-serif';ctx.fillText('CARD',35,55);const image=canvas.toDataURL('image/png');
const artwork={name:'test-card.png',kind:'png',bytesBase64:image.split(',')[1],previewDataUrl:image,widthMm:85,heightMm:55,pageNumber:1,pageCount:1};
function App(){const[draft,setDraft]=useState({artwork,back:artwork,settings:DEFAULT_CARD_SETTINGS});return <div className="h-screen overflow-auto bg-background p-4 text-foreground"><CardMontagePage draft={draft} onDraftChange={setDraft} onNavigate={()=>{}}/></div>}
createRoot(document.getElementById('root')).render(<App/>);`
  )
  const { createServer } = await import('vite'),
    { default: react } = await import('@vitejs/plugin-react'),
    { spawn } = await import('node:child_process')
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: resolve('node_modules/.vite-card-print-default'),
    plugins: [react()],
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    optimizeDeps: { entries: ['tmp/card-print-default.html'] },
    server: {
      host: '127.0.0.1',
      port: 5196,
      strictPort: true,
      watch: { ignored: ['**/output/**', '**/out/**'] }
    }
  })
  await server.listen()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(
    createRequire(import.meta.url)('electron'),
    [resolve('scripts/verify-card-print-default.mjs')],
    { cwd: root, env, windowsHide: true, stdio: 'inherit' }
  )
  child.once('exit', async (code) => {
    await server.close()
    process.exitCode = code ?? 1
  })
} else {
  const { app, BrowserWindow } = await import('electron')
  app.disableHardwareAcceleration()
  app.setPath('userData', resolve(app.getPath('temp'), 'maher-card-default-proof'))
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 768,
      webPreferences: { sandbox: true, offscreen: true, backgroundThrottling: false }
    })
    const run = (fn, ...args) =>
      win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`)
    const wait = async (fn, ...args) => {
      for (let index = 0; index < 400; index++) {
        if (await run(fn, ...args)) return
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      throw Error('Timed out: ' + fn)
    }
    const check = (value, message) => {
      if (!value) throw Error(message)
    }
    const open = async () => {
      await run(() =>
        [...document.querySelectorAll('[data-tool-header] button')]
          .find((button) => button.textContent.trim() === cardProof.translate('Print'))
          .click()
      )
      await wait(() => !!document.querySelector('[role=alertdialog] select:not(:disabled)'))
    }
    const select = async (id) => {
      await run((id) => {
        const field = document.querySelector('[role=alertdialog] select')
        field.value = id
        field.dispatchEvent(new Event('change', { bubbles: true }))
      }, id)
      await wait(
        (id) =>
          document.querySelector('[role=alertdialog] select')?.value === id &&
          !document.querySelector('[role=alertdialog] select')?.disabled,
        id
      )
    }
    const cancel = async () => {
      await run(() =>
        [...document.querySelectorAll('[role=alertdialog] button')]
          .find((button) => button.textContent.trim() === cardProof.translate('Cancel'))
          .click()
      )
      await wait(() => !document.querySelector('[role=alertdialog]'))
    }
    try {
      await win.loadURL('http://127.0.0.1:5196/tmp/card-print-default.html')
      await wait(() => !!window.cardProof && !!document.querySelector('[data-tool-header]'))
      await run(() => {
        cardProof.write(cardProof.initial)
        cardProof.setLanguage('en')
      })
      await open()
      check(
        await run(
          () =>
            document.querySelector(`[role=alertdialog] option[value="${cardProof.a3}"]`).disabled
        ),
        'A3 preset should not be offered for A4 cards'
      )
      await run(() => {
        const next = cardProof.read()
        next.preferences.optionPrinters['tool:booklet-montage'] = 'Office printer'
        cardProof.write(next)
      })
      await select('a'.repeat(32))
      await cancel()
      await win.reload()
      await wait(() => !!window.cardProof && !!document.querySelector('[data-tool-header]'))
      await open()
      check(
        await run(
          () =>
            document.querySelector('[role=alertdialog] select').value === cardProof.id &&
            cardProof.read().preferences.optionPrinters['tool:booklet-montage'] === 'Office printer'
        ),
        'Default did not survive close/reload or overwrote another tool'
      )
      const reports = []
      for (const [width, height, language, theme, preset] of [
        [1366, 768, 'en', 'light', 'balanced'],
        [1920, 1080, 'fr', 'dark', 'balanced'],
        [1366, 768, 'ar', 'dark', 'low-end'],
        [1920, 1080, 'ar', 'light', 'low-end']
      ]) {
        win.setContentSize(width, height)
        await run(
          (language, theme, preset) => {
            cardProof.setLanguage(language)
            cardProof.setThemePreference(theme)
            cardProof.setPerformancePreset(preset)
          },
          language,
          theme,
          preset
        )
        await new Promise((resolve) => setTimeout(resolve, 120))
        const layout = await run(() => {
          const dialog = document.querySelector('[role=alertdialog]'),
            rect = dialog.getBoundingClientRect()
          return {
            width: innerWidth,
            height: innerHeight,
            rtl: document.documentElement.dir === 'rtl',
            overflow:
              dialog.scrollWidth > dialog.clientWidth ||
              rect.left < 0 ||
              rect.right > innerWidth ||
              rect.top < 0 ||
              rect.bottom > innerHeight
          }
        })
        check(
          !layout.overflow && layout.rtl === (language === 'ar'),
          'Dialog overflow/RTL: ' + JSON.stringify(layout)
        )
        await writeFile(
          resolve(output, `${width}-${height}-${language}-${theme}.png`),
          (await win.webContents.capturePage()).toPNG()
        )
        reports.push({ ...layout, language, theme, preset })
      }
      win.webContents.debugger.attach('1.3')
      await run(() => document.querySelector('[role=alertdialog] select').focus())
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
      check(
        await run(
          () => document.activeElement === document.querySelectorAll('[role=alertdialog] select')[1]
        ),
        'Tab did not reach Side'
      )
      await run(() =>
        [...document.querySelectorAll('[role=alertdialog] button')]
          .find((button) => button.textContent.trim() === cardProof.translate('Print'))
          .click()
      )
      await wait(() => cardProof.prints.length === 1)
      check(
        await run(
          () =>
            cardProof.prints[0].printer === 'Card printer' &&
            cardProof.prints[0].profile === cardProof.id &&
            cardProof.prints[0].bytes > 1000
        ),
        'Card print did not route to its default preset'
      )
      await run(() => {
        const next = cardProof.read()
        next.presets = next.presets.filter((preset) => preset.id !== cardProof.id)
        cardProof.write(next)
      })
      await open()
      check(
        await run(
          () =>
            !!document.querySelector('[role=alertdialog] [role=alert]') &&
            [...document.querySelectorAll('[role=alertdialog] button')].at(-1).disabled
        ),
        'Missing preset did not block printing'
      )
      await select('inherit')
      await cancel()
      await run(() => {
        const next = cardProof.read()
        next.presets = cardProof.initial.presets
        cardProof.write(next)
        cardProof.failSave = true
      })
      await open()
      await run(() => {
        const field = document.querySelector('[role=alertdialog] select')
        field.value = cardProof.id
        field.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await wait(
        () =>
          !!document.querySelector('[role=alertdialog] [role=alert]') &&
          !document.querySelector('[role=alertdialog] select').disabled
      )
      check(
        await run(
          () =>
            [...document.querySelectorAll('[role=alertdialog] button')].at(-1).disabled &&
            !cardProof.read().preferences.optionPrinters['tool:card-montage']
        ),
        'Save failure permitted printing or changed the default'
      )
      await writeFile(
        resolve(output, 'results.json'),
        JSON.stringify(
          {
            headless: !win.isVisible(),
            hardwareJobs: 0,
            restartRestored: true,
            printRouted: true,
            otherToolPreserved: true,
            invalidPresetBlocked: true,
            saveFailureBlocked: true,
            keyboardPassed: true,
            reports
          },
          null,
          2
        )
      )
      console.log(
        'Card default preset: persistence, print routing, missing-preset/save-failure guards, RTL/themes/sizes/low-end and keyboard checks passed.'
      )
      win.destroy()
      app.exit(0)
    } catch (error) {
      console.error(error)
      win.destroy()
      app.exit(1)
    }
  })
}
