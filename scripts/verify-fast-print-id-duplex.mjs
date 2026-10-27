import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Hidden renderer with mocked printer IPC: no printer or spooler is called.
const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'output/id-auto-duplex/renderer')
process.chdir(root)
await mkdir(output, { recursive: true })

if (!process.versions.electron) {
  await mkdir(resolve(root, 'tmp'), { recursive: true })
  await writeFile(
    resolve(root, 'tmp/id-auto-duplex.html'),
    '<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/tmp/id-auto-duplex.ts"></script></body></html>'
  )
  await writeFile(
    resolve(root, 'tmp/id-auto-duplex.ts'),
    `
import {openIdPrint} from '/src/renderer/src/fast-print/IdPrint';
import {idReviewDuplex,selectIdDriverPreset} from '/src/shared/fast-print-id-preset';
import {setLanguage} from '/src/renderer/src/i18n/language';
import {setThemePreference} from '/src/renderer/src/appearance/theme';
import {setPerformancePreset} from '/src/renderer/src/performance/performanceSettings';
const params=new URLSearchParams(location.search);
setLanguage(params.get('language')||'en');setThemePreference(params.get('theme')||'light');setPerformancePreset(params.get('performance')||'balanced');
const device={name:'EPSON WF-C879R Series',papers:['A4','A3'],color:true,duplex:true};
const profiles=[{id:'a'.repeat(32),name:'A4 tray — single-sided',printer:device.name,paper:'A4',color:true,landscape:false,duplex:'Simplex',usable:true},{id:'b'.repeat(32),name:'A3 tray — single-sided',printer:device.name,paper:'A3',color:false,landscape:false,duplex:'Simplex',usable:true}];
const canvas=document.createElement('canvas');canvas.width=450;canvas.height=280;const ctx=canvas.getContext('2d');ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,450,280);ctx.fillStyle='#143c7a';ctx.fillRect(5,5,440,270);ctx.fillStyle='white';ctx.font='40px sans-serif';ctx.fillText('SAMPLE ID',80,140);
const png=canvas.toDataURL('image/png'),crop=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
const side=id=>({sourceId:id,turns:0,crop,orientationVerified:true});
let preset={printer:device.name,paper:'A4',color:true,pagesPerSheet:1,mode:'id-card',profileId:profiles[0].id,profileName:profiles[0].name,duplex:idReviewDuplex(device.duplex)};
const state={sheets:[],submissions:[],presets:profiles,draft:null};
window.idDuplexProof=state;
window.fastPrint={
  selectIdPreset:async(id,draft)=>{state.draft=draft;const chosen=profiles.find(p=>p.id===id);const result=selectIdDriverPreset({...preset,duplex:draft.duplex},chosen,device);preset=result.preset;return result},
  saveIdDraft:async(draft)=>{state.draft=draft},
  sheet:async(png)=>{state.sheets.push({pngLength:png.length})},
  submit:async(options)=>{state.submissions.push({options,preset:{...preset},sheets:state.sheets.length});return{verified:true}},
  finish:async()=>{},back:async()=>{}
};
openIdPrint({name:'ID test',files:[],preset,printers:[device],driverPresets:profiles,canReturnToSettings:true,canDuplex:true,canColor:true,idDraft:{version:1,sources:[{id:'front',name:'front.png',png},{id:'back',name:'back.png',png}],sides:[side('front'),side('back')],active:0,color:true,duplex:true,idsPerSheet:2}});
`
  )
  const { createServer } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const { spawn } = await import('node:child_process')
  const server = await createServer({
    configFile: false,
    root,
    plugins: [react()],
    resolve: { alias: { '@': resolve(root, 'src/renderer/src') } },
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }
  })
  await server.listen()
  const env = {
    ...process.env,
    ID_DUPLEX_TEST_URL: `http://127.0.0.1:${server.httpServer.address().port}`
  }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(createRequire(import.meta.url)('electron'), [import.meta.filename], {
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
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 768,
      webPreferences: { sandbox: false, offscreen: true, backgroundThrottling: false }
    })
    const run = (fn, ...args) =>
      win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`)
    const wait = async (fn) => {
      for (let i = 0; i < 400; i++) {
        if (await run(fn)) return
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      throw Error('Timed out waiting for the ID editor')
    }
    try {
      const cases = [
        [1366, 768, 'en', 'light', 'balanced'],
        [1920, 1080, 'fr', 'dark', 'balanced'],
        [1366, 768, 'ar', 'dark', 'low-end']
      ]
      const results = []
      for (const [width, height, language, theme, performance] of cases) {
        win.setContentSize(width, height)
        await win.loadURL(
          `${process.env.ID_DUPLEX_TEST_URL}/tmp/id-auto-duplex.html?language=${language}&theme=${theme}&performance=${performance}`
        )
        await wait(() => {
          const print = document.querySelector('[data-tool-header] button[aria-describedby]')
          return Boolean(print && !print.disabled && document.getElementById('id-driver-preset'))
        })
        const result = await run(async () => {
          const change = (select, value) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
            setter.call(select, value)
            select.dispatchEvent(new Event('change', { bubbles: true }))
          }
          const pause = () => new Promise((resolve) => setTimeout(resolve, 150))
          const preset = document.getElementById('id-driver-preset')
          const duplex = [...document.querySelectorAll('select')].find((select) =>
            [...select.options].some((option) => option.value === 'auto')
          )
          if (!duplex || duplex.value !== 'auto') throw Error('Automatic duplex is not selected')
          change(preset, 'b'.repeat(32))
          await pause()
          if (duplex.value !== 'auto')
            throw Error('A simplex stock preset disabled automatic duplex')
          change(duplex, 'manual')
          await pause()
          change(preset, 'a'.repeat(32))
          await pause()
          if (duplex.value !== 'manual')
            throw Error('A preset discarded the explicit manual choice')
          change(duplex, 'auto')
          await pause()
          change(preset, 'b'.repeat(32))
          await pause()
          if (duplex.value !== 'auto') throw Error('Automatic duplex was not retained')
          return {
            printer: document.getElementById('id-printer').value,
            preset: preset.value,
            duplex: duplex.value,
            rtl: document.documentElement.dir === 'rtl',
            overflow: document.documentElement.scrollWidth > innerWidth
          }
        })
        assert.equal(result.printer, 'EPSON WF-C879R Series')
        assert.equal(result.duplex, 'auto')
        assert.equal(result.preset, 'b'.repeat(32))
        assert.equal(result.rtl, language === 'ar')
        assert.equal(result.overflow, false)
        await writeFile(
          resolve(output, `${width}-${language}-${theme}.png`),
          (await win.webContents.capturePage()).toPNG()
        )
        await run(() =>
          document.querySelector('[data-tool-header] button[aria-describedby]').click()
        )
        await wait(() => window.idDuplexProof.submissions.length === 1)
        const submission = await run(() => window.idDuplexProof.submissions[0])
        assert.equal(submission.options.duplex, true)
        assert.equal(submission.preset.profileId, 'b'.repeat(32))
        assert.equal(submission.preset.paper, 'A3')
        assert.equal(submission.sheets, 2)
        results.push({ width, height, language, theme, performance, ...result, submission })
      }
      await writeFile(
        resolve(output, 'results.json'),
        JSON.stringify({ simulatedPrinter: true, hardwareJobs: 0, results }, null, 2)
      )
      console.log(
        'ID preset and automatic-duplex renderer checks passed; all submissions were mocked.'
      )
      win.destroy()
      app.quit()
    } catch (error) {
      console.error(error)
      await writeFile(resolve(output, 'failure.png'), (await win.webContents.capturePage()).toPNG())
      win.destroy()
      app.exit(1)
    }
  })
}
