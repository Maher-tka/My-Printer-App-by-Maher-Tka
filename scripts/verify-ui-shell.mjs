// Hidden Electron proof for the shared shell. No real files or print jobs are opened.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/ui-shell-proof')
const origin = 'http://127.0.0.1:5228'
process.chdir(root)

if (!process.versions.electron) {
  await mkdir(join(root, 'tmp'), { recursive: true })
  await mkdir(output, { recursive: true })
  await writeFile(
    join(root, 'tmp/ui-shell-proof.html'),
    '<html><body><div id="root"></div><script type="module" src="/tmp/ui-shell-proof.tsx"></script></body></html>'
  )
  await writeFile(
    join(root, 'tmp/ui-shell-proof.tsx'),
    `import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppLayout} from '/src/renderer/src/components/layout/AppLayout';
import {ToolHeader} from '/src/renderer/src/tools/shared/ToolHeader';
import {ToolSettingsTabs} from '/src/renderer/src/tools/shared/ToolSettingsTabs';
import {Button} from '/src/renderer/src/components/ui/button';
import {setLanguage} from '/src/renderer/src/i18n/language';
import {setThemePreference} from '/src/renderer/src/appearance/theme';
import {setPerformancePreset} from '/src/renderer/src/performance/performanceSettings';
import '/src/renderer/src/styles.css';
const noop=()=>{};
window.printerApp={printPdf:async()=>{throw Error('Unexpected print job')}};
window.uiProof={setLanguage,setThemePreference,setPerformancePreset:(preset)=>{setPerformancePreset(preset);document.documentElement.dataset.performancePreset=preset}};
function Proof(){const [route,setRoute]=useState('booklet-montage');return <AppLayout activeRoute={route} pageMeta={{title:'Booklet Montage',subtitle:''}} onNavigate={setRoute} onSignOut={noop} onOpenProject={noop} onOpenImageFile={noop} onOpenJob={noop} isDeveloperMode><ToolHeader title="Booklet Montage" projectName="A long project name that must remain readable across the workspace header" onBack={()=>setRoute('dashboard')} exportPdf={{onExport:noop}} print={{onPrint:noop}} actions={<><Button variant="outline">Open</Button><Button variant="outline">Save as</Button></>}/><div className="mt-4 max-w-[500px]"><ToolSettingsTabs label="Tool settings" advanced={<p>Advanced settings</p>}><p>Setup settings</p></ToolSettingsTabs></div></AppLayout>};
createRoot(document.getElementById('root')).render(<Proof/>);`
  )
  const { createServer } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const server = await createServer({
    configFile: false,
    root,
    plugins: [react()],
    resolve: { alias: { '@': join(root, 'src/renderer/src') } },
    server: { host: '127.0.0.1', port: 5228, strictPort: true }
  })
  await server.listen()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  try {
    await new Promise((resolvePromise, reject) => {
      const child = spawn(createRequire(import.meta.url)('electron'), [import.meta.filename], {
        env,
        windowsHide: true,
        stdio: 'inherit'
      })
      child.once('error', reject)
      child.once('exit', (code) =>
        code === 0 ? resolvePromise() : reject(Error(`UI shell proof exited ${code}`))
      )
    })
  } finally {
    await server.close()
  }
} else {
  const { app, BrowserWindow } = await import('electron')
  app.disableHardwareAcceleration()
  app.setPath('userData', join(app.getPath('temp'), 'my-printer-ui-shell-proof'))
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      show: false,
      useContentSize: true,
      width: 1366,
      height: 768,
      webPreferences: { offscreen: true, sandbox: false, backgroundThrottling: false }
    })
    win.webContents.on('console-message', (_event, _level, message) => {
      if (/error|uncaught/i.test(message)) console.error('Renderer:', message)
    })
    const js = (code) => win.webContents.executeJavaScript(code, true)
    let failed = false
    try {
      await win.loadURL(origin + '/tmp/ui-shell-proof.html')
      await js(
        `new Promise((resolve,reject)=>{const deadline=Date.now()+15000;const poll=()=>window.uiProof&&document.querySelector('[data-tool-header]')?resolve():Date.now()>deadline?reject(Error('Shell did not render')):setTimeout(poll,50);poll()})`
      )
      for (const [width, height] of [
        [1366, 768],
        [1600, 900],
        [1920, 1080]
      ]) {
        win.setContentSize(width, height)
        for (const [language, theme, preset] of [
          ['en', 'light', 'balanced'],
          ['en', 'light', 'low-end'],
          ['en', 'dark', 'balanced'],
          ['fr', 'light', 'balanced'],
          ['ar', 'dark', 'low-end']
        ]) {
          await js(
            `uiProof.setLanguage('${language}');uiProof.setThemePreference('${theme}');uiProof.setPerformancePreset('${preset}')`
          )
          await js(
            `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`
          )
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
          const state = await js(
            `(()=>{const header=document.querySelector('[data-tool-header]'); const title=header.querySelector('h1'); const group=header.querySelector('[role=group]'); const r=header.getBoundingClientRect(), t=title.getBoundingClientRect(), g=group.getBoundingClientRect(), style=getComputedStyle(header); return {overflow:document.documentElement.scrollWidth>innerWidth+1, titleVisible:t.width>0&&t.left>=r.left-1&&t.right<=r.right+1, actionsVisible:g.width>0&&g.left>=r.left-1&&g.right<=r.right+1, direction:document.documentElement.dir, selected:document.querySelector('[role=tab][aria-selected=true]')?.textContent, background:style.backgroundColor, blur:style.backdropFilter}})()`
          )
          assert.equal(state.overflow, false, `${width} ${language}: horizontal overflow`)
          assert.ok(
            state.titleVisible && state.actionsVisible,
            `${width} ${language}: header clipped`
          )
          assert.equal(state.direction, language === 'ar' ? 'rtl' : 'ltr')
          assert.ok(state.selected, 'No selected setup tab')
          assert.match(state.background, /^rgba\(/, `${width} ${language}: surface is opaque`)
          if (preset === 'low-end') assert.equal(state.blur, 'none', 'Low-end blur is still active')
          await writeFile(
            join(output, `${width}-${language}-${theme}-${preset}.png`),
            (await win.webContents.capturePage()).toPNG()
          )
        }
      }
      await js(`uiProof.setLanguage('en');uiProof.setThemePreference('light')`)
      for (const label of [
        'Dashboard',
        'Card Montage',
        'Booklet Montage',
        'Hardcover Cover',
        'Cutter Montage',
        'Sequential Number',
        'PDF Tools'
      ]) {
        await js(
          `document.querySelector('aside button[aria-label=${JSON.stringify(label)}]').click()`
        )
        await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
        const geometry = await js(
          `(()=>{const b=document.querySelector('aside button[aria-current=page]');const n=b.closest('nav').getBoundingClientRect(),r=b.getBoundingClientRect(),i=b.querySelector('svg').getBoundingClientRect();return {width:r.width,height:r.height,iconWidth:i.width,iconHeight:i.height,visible:r.left>=n.left-1&&r.right<=n.right+1&&i.left>=r.left&&i.right<=r.right}})()`
        )
        assert.equal(geometry.width, 44, `${label}: selected width changed`)
        assert.equal(geometry.height, 44, `${label}: selected height changed`)
        assert.equal(geometry.iconWidth, 20, `${label}: icon width changed`)
        assert.equal(geometry.iconHeight, 20, `${label}: icon height changed`)
        assert.ok(geometry.visible, `${label}: selected icon or background clipped`)
      }
      await js(`document.querySelector('[aria-label="Expand navigation"]').click()`)
      await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
      const expanded = await js(
        `(()=>{const nav=document.querySelector('aside');const settings=[...nav.querySelectorAll('button')].filter(b=>b.getAttribute('aria-label')==='Settings');const clipped=[...nav.querySelectorAll('button span')].some(s=>s.scrollWidth>s.clientWidth+1);return {settings:settings.length,clipped}})()`
      )
      assert.equal(expanded.settings, 0, 'Settings should be in the top bar')
      assert.equal(expanded.clipped, false, 'Expanded navigation label clipped')
      await js(`document.querySelector('[aria-label="Settings"]').click()`)
      await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
      assert.equal(
        await js(`document.querySelector('[aria-label="Settings"]').getAttribute('aria-current')`),
        'page'
      )
      win.webContents.debugger.attach('1.3')
      await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {
        enabled: true
      })
      win.webContents.focus()
      await js(`document.querySelector('[role=tab]').focus()`)
      for (const type of ['keyDown', 'keyUp']) {
        await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
          type,
          key: 'ArrowRight',
          code: 'ArrowRight',
          windowsVirtualKeyCode: 39
        })
      }
      await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
      assert.equal(
        await js(`document.querySelector('[role=tab][aria-selected=true]').textContent`),
        'Advanced'
      )
      console.log(
        'Shared shell: sizes, themes, RTL, low-end mode, navigation and keyboard tabs passed.'
      )
    } catch (error) {
      console.error(error)
      failed = true
    } finally {
      if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach()
      win.destroy()
      app.exit(failed ? 1 : 0)
    }
  })
}
