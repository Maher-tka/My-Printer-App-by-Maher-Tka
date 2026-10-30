import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/printer-settings-proof')
await mkdir(output, { recursive: true })
if (!process.versions.electron) {
  const fixture = join(root, 'tmp/printer-settings-proof')
  await mkdir(fixture, { recursive: true })
  await writeFile(
    join(fixture, 'index.html'),
    '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/tmp/printer-settings-proof/main.tsx"></script></body></html>'
  )
  await writeFile(
    join(fixture, 'main.tsx'),
    `
import React from 'react';import{createRoot}from'react-dom/client';
import{PrinterSettings}from'/src/renderer/src/settings/PrinterSettings';
import{printerSettingsFixture}from'/src/renderer/src/settings/PrinterSettings.stories';
import{setLanguage}from'/src/renderer/src/i18n/language';
import{setThemePreference}from'/src/renderer/src/appearance/theme';
import{setPerformancePreset}from'/src/renderer/src/performance/performanceSettings';
import'/src/renderer/src/styles.css';
const container=createRoot(document.getElementById('root'));
const proof={calls:[],behavior:'save',release:null,api:null,key:0,setLanguage,setThemePreference,setPerformancePreset,mount(scenario='populated'){
 const base=printerSettingsFixture(scenario==='empty');proof.calls=[];proof.behavior='save';
 const api={...base,get:async()=>{const next=await base.get();if(scenario==='orphan')next.devices=next.devices.filter(p=>!p.name.startsWith('EPSON'));if(scenario==='attention')next.presets[2]={...next.presets[2],usable:false,error:'The assigned driver preset needs attention. Recapture it or choose another preset.'};return next;},capture:async request=>{proof.calls.push(structuredClone(request));const mode=proof.behavior;if(mode==='pause')await new Promise(resolve=>proof.release=resolve);if(mode==='cancel')return{canceled:true};if(mode==='error')throw Error('Printing settings could not be saved.');return base.capture(request);}};
 proof.api=api;container.render(<main className="mx-auto max-w-[1040px] p-6 text-foreground"><div className="rounded-[var(--ui-radius-lg)] border bg-card p-6"><PrinterSettings key={++proof.key} api={api}/></div></main>);
}};Object.assign(window,{settingsProof:proof});setLanguage('en');setThemePreference('light');setPerformancePreset('balanced');proof.mount();`
  )
  const { createServer } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const server = await createServer({
    configFile: false,
    root,
    plugins: [react()],
    cacheDir: join(root, 'node_modules/.vite-printer-settings-proof'),
    resolve: { alias: { '@': join(root, 'src/renderer/src') } },
    server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/output/**', '**/out/**'] } }
  })
  await server.listen()
  const env = {
    ...process.env,
    PRINTER_SETTINGS_PROOF_URL: `http://127.0.0.1:${server.httpServer.address().port}/tmp/printer-settings-proof/index.html`
  }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(createRequire(import.meta.url)('electron'), [resolve(import.meta.filename)], {
    cwd: root,
    env,
    windowsHide: true,
    stdio: 'inherit'
  })
  child.once('error', async (error) => {
    await server.close()
    console.error(error)
    process.exitCode = 1
  })
  child.once('exit', async (code) => {
    await server.close()
    process.exitCode = code ?? 1
  })
} else {
  const { app, BrowserWindow } = await import('electron')
  app.disableHardwareAcceleration()
  app.setPath('userData', join(output, 'user-data'))
  void app.whenReady().then(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 768,
      webPreferences: { sandbox: true, offscreen: true, backgroundThrottling: false }
    })
    const evaluate = (fn, ...args) =>
      win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`)
    const pause = () => new Promise((resolve) => setTimeout(resolve, 100))
    const wait = async (fn, ...args) => {
      for (let i = 0; i < 200; i++) {
        if (await evaluate(fn, ...args)) return
        await pause()
      }
      throw Error('Timed out: ' + fn)
    }
    const ready = () =>
      wait(
        () =>
          document.querySelector('[data-printer-settings]')?.getAttribute('aria-busy') ===
            'false' && !!document.querySelector('#printer-preset-editor')
      )
    const select = async (id) => {
      await evaluate(
        (id) => document.querySelector('[data-driver-preset="' + id + '"] button').click(),
        id
      )
      await pause()
    }
    const name = async (value) => {
      await evaluate((value) => {
        const input = document.querySelector('#printer-preset-editor input')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }, value)
      await pause()
    }
    const update = async () => {
      await evaluate(() =>
        document.querySelector('#printer-preset-editor button[aria-busy]').click()
      )
      await pause()
    }
    const c = 'c'.repeat(32),
      reports = []
    try {
      await win.loadURL(process.env.PRINTER_SETTINGS_PROOF_URL)
      await ready()
      assert.equal(
        await evaluate(() => document.querySelectorAll('[data-driver-preset]').length),
        3
      )
      assert.deepEqual(
        await evaluate(() =>
          [...document.querySelectorAll('[data-printer-group]')].map((group) => ({
            printer: group.dataset.printerGroup,
            count: group.querySelectorAll('[data-driver-preset]').length
          }))
        ),
        [
          { printer: 'EPSON WorkForce Pro WF-C878RDWF', count: 1 },
          { printer: 'Konica C4065', count: 2 }
        ]
      )
      await evaluate(() => document.querySelector('[data-printer-group] summary').click())
      assert.equal(await evaluate(() => document.querySelector('[data-printer-group]').open), false)
      await evaluate(() => document.querySelector('[data-printer-group] summary').click())
      await select(c)
      assert.ok(
        await evaluate(() =>
          document
            .querySelector('[aria-label="Printer for preset assignment"]')
            .textContent.includes('Konica')
        )
      )
      const editor = await evaluate(() => ({
        name: document.querySelector('#printer-preset-editor input').value,
        focus: document.activeElement === document.querySelector('#printer-preset-editor input'),
        printer: document.querySelector('#printer-preset-editor [role=combobox]').textContent,
        printerLocked: document.querySelector('#printer-preset-editor [role=combobox]').disabled,
        selected: document
          .querySelector('[aria-controls=printer-preset-editor][aria-pressed=true]')
          ?.closest('li')
          .getAttribute('data-driver-preset')
      }))
      assert.ok(editor.name.includes('Both sides'))
      assert.ok(editor.printer.startsWith('EPSON'))
      assert.equal(editor.printerLocked, true)
      assert.equal(editor.focus, true)
      assert.equal(editor.selected, c)
      const press = async (key) => {
        await evaluate(
          (key) =>
            document.activeElement.dispatchEvent(
              new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
            ),
          key
        )
        await pause()
      }
      await evaluate(() =>
        document.querySelector('[aria-label="Printer for preset assignment"]').focus()
      )
      await press(' ')
      await pause()
      await press('End')
      await press('Enter')
      await pause()
      assert.ok(
        await evaluate(() =>
          document
            .querySelector('[aria-label="Printer for preset assignment"]')
            .textContent.includes('EPSON')
        )
      )
      await evaluate(() =>
        document.querySelector('[aria-label="Driver preset for selected printer"]').focus()
      )
      await press(' ')
      await pause()
      await press('End')
      await press('Enter')
      await ready()
      assert.equal(
        await evaluate(
          async () =>
            (await window.settingsProof.api.get()).preferences.profiles[
              'EPSON WorkForce Pro WF-C878RDWF'
            ]['polaroid-8']
        ),
        c
      )
      await name('Epson ID — two sides — renamed')
      await update()
      await ready()
      const saved = await evaluate(async () => ({
        snapshot: await window.settingsProof.api.get(),
        calls: window.settingsProof.calls,
        name: document.querySelector('#printer-preset-editor input').value
      }))
      assert.equal(saved.calls[0].id, c)
      assert.equal(saved.calls[0].printer, 'EPSON WorkForce Pro WF-C878RDWF')
      assert.equal(saved.snapshot.presets.length, 3)
      const preset = saved.snapshot.presets.find((p) => p.id === c)
      assert.equal(preset.name, 'Epson ID — two sides — renamed')
      assert.equal(preset.color, false)
      assert.equal(preset.duplex, 'Vertical')
      assert.equal(preset.tray, 'Rear tray')
      assert.equal(saved.snapshot.preferences.profiles[preset.printer]['id:A4:mono'], c)
      assert.equal(
        await evaluate(
          (id) =>
            document
              .querySelector('[data-driver-preset="' + id + '"]')
              .textContent.includes('renamed'),
          c
        ),
        true
      )
      await evaluate(() => {
        window.settingsProof.behavior = 'cancel'
      })
      await name('Canceled name')
      await update()
      await ready()
      assert.equal(
        await evaluate(
          async (id) =>
            (await window.settingsProof.api.get()).presets.find((p) => p.id === id).name,
          c
        ),
        preset.name
      )
      await evaluate(() => {
        window.settingsProof.behavior = 'error'
      })
      await update()
      await ready()
      assert.ok(await evaluate(() => !!document.querySelector('[role=alert]')))
      assert.equal(
        await evaluate(
          (id) =>
            document
              .querySelector('[data-driver-preset="' + id + '"] button')
              .getAttribute('aria-pressed'),
          c
        ),
        'true'
      )
      await evaluate(() => {
        window.settingsProof.behavior = 'pause'
      })
      await update()
      assert.equal(
        await evaluate(() =>
          [...document.querySelectorAll('[data-driver-preset] button')].every(
            (button) => button.disabled
          )
        ),
        true
      )
      assert.equal(
        await evaluate(() => document.querySelector('#printer-preset-editor input').disabled),
        true
      )
      await evaluate(() => {
        window.settingsProof.release()
        window.settingsProof.behavior = 'save'
      })
      await ready()
      await evaluate(() =>
        [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim() === 'New preset')
          .click()
      )
      await pause()
      assert.equal(
        await evaluate(() => document.querySelector('#printer-preset-editor input').value),
        ''
      )
      assert.equal(
        await evaluate(
          () => document.querySelector('#printer-preset-editor [role=combobox]').disabled
        ),
        false
      )
      await name('A separate new preset')
      await update()
      await ready()
      assert.equal(
        await evaluate(() => document.querySelectorAll('[data-driver-preset]').length),
        4
      )
      const calls = await evaluate(() => window.settingsProof.calls)
      assert.equal(calls.at(-1).id, undefined)
      for (const scenario of ['orphan', 'attention', 'empty']) {
        await evaluate((scenario) => window.settingsProof.mount(scenario), scenario)
        await pause()
        await ready()
        if (scenario !== 'empty') await select(c)
        if (scenario === 'orphan')
          assert.equal(
            await evaluate(
              () => document.querySelector('#printer-preset-editor button[aria-busy]').disabled
            ),
            true
          )
        if (scenario === 'attention')
          assert.equal(
            await evaluate(() => document.querySelectorAll('[data-driver-preset]').length),
            3
          )
        if (scenario === 'empty')
          assert.ok(
            await evaluate(() => document.body.textContent.includes('No saved driver presets.'))
          )
        await win.webContents
          .capturePage(undefined, { stayHidden: true })
          .then((image) => writeFile(join(output, scenario + '.png'), image.toPNG()))
      }
      for (const [language, theme, performance] of [
        ['en', 'light', 'balanced'],
        ['en', 'dark', 'balanced'],
        ['fr', 'light', 'balanced'],
        ['ar', 'dark', 'low-end']
      ]) {
        await evaluate(
          (language, theme, performance) => {
            window.settingsProof.setLanguage(language)
            window.settingsProof.setThemePreference(theme)
            window.settingsProof.setPerformancePreset(performance)
            window.settingsProof.mount()
          },
          language,
          theme,
          performance
        )
        await pause()
        await ready()
        for (const [width, height] of [
          [1366, 768],
          [1920, 1080],
          [1600, 900]
        ]) {
          win.setContentSize(width, height)
          await pause()
          await select(c)
          await evaluate(() => window.scrollTo(0, 0))
          await pause()
          const metrics = await evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth,
            dir: document.documentElement.dir,
            selected: document.querySelectorAll(
              '[aria-controls=printer-preset-editor][aria-pressed=true]'
            ).length,
            buttons: [...document.querySelectorAll('button')].filter(
              (button) => button.textContent.trim() === 'New preset'
            ).length,
            rows: document.querySelectorAll('[data-driver-preset]').length
          }))
          assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1)
          assert.equal(metrics.selected, 1)
          assert.equal(metrics.rows, 3)
          const image = await win.webContents.capturePage(undefined, {
            stayHidden: true,
            stayAwake: true
          })
          await writeFile(
            join(output, `${language}-${theme}-${width}x${height}.png`),
            image.toPNG()
          )
          reports.push({ language, theme, performance, width, height, ...metrics })
        }
      }
      await writeFile(
        join(output, 'results.json'),
        JSON.stringify(
          {
            headless: true,
            hardwareJobs: 0,
            presetCount: 3,
            existingIdPreserved: true,
            cancelPreserved: true,
            failurePreserved: true,
            busyGuarded: true,
            newPreset: true,
            reports
          },
          null,
          2
        )
      )
      console.log(
        'Printer settings: all-printer list, edit/update identity, mono/duplex/tray retention, cancel/failure, busy guards, new presets, missing drivers, themes, RTL and layouts passed.'
      )
      win.destroy()
      app.exit(0)
    } catch (error) {
      await writeFile(join(output, 'error.txt'), error.stack || String(error))
      console.error(error)
      win.destroy()
      app.exit(1)
    }
  })
}
