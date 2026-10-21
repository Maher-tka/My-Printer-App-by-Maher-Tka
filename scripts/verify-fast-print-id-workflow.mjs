import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { idCopiesLayout, idCopyCenters, idPrintedSize } from '../src/shared/fast-print-id.ts'
import { measureIdProof } from './id-proof-metrics.mjs'

const root = resolve(import.meta.dirname, '..'),
  output = process.env.ID_WORKFLOW_OUTPUT || join(root, 'output/fast-print-id-workflow')
const electron = createRequire(import.meta.url)('electron')
const executable = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
const files = (
  process.env.ID_WORKFLOW_FILES
    ? JSON.parse(process.env.ID_WORKFLOW_FILES)
    : ['carte-identite-tunisie-1.gif', 'images (2).jpg']
).map((name) => join('C:/Users/Maher/Downloads/ID TEST', name))
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
const originals = await Promise.all(files.map(hash))
const run = (exe, args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let logs = ''
    child.stdout.on('data', (chunk) => (logs += chunk))
    child.stderr.on('data', (chunk) => (logs += chunk))
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('ID workflow timed out. ' + logs))
    }, 180000)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      code === 0 ? resolve(logs) : reject(new Error('Exit ' + code + ': ' + logs))
    })
  })

// Executes only in a hidden Electron test renderer; never sends desktop input.
async function exerciseEditor(stage, expected, labels) {
  const wait = async (condition, message) => {
    for (let attempt = 0; attempt < 600; attempt++) {
      if (condition()) return
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error(message)
  }
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  await wait(
    () =>
      document.querySelector('h1') &&
      document.querySelector('section select') &&
      !document.querySelector('section select')?.disabled,
    'ID editor did not load'
  )
  const expectedColor = document.createElement('span')
  expectedColor.style.color = 'hsl(var(--foreground))'
  document.body.append(expectedColor)
  check(
    getComputedStyle(document.querySelector('main')).color ===
      getComputedStyle(expectedColor).color,
    'Editor text does not follow the selected theme'
  )
  expectedColor.remove()
  const batch = await window.fastPrint.source()
  check(batch.canReturnToSettings, 'Native printer settings are unavailable')
  const cropSection = document.querySelector('section')
  const button = (text) =>
    [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === text)
  const pause = () => new Promise((resolve) => setTimeout(resolve, 80))
  if (stage > 1) {
    check(batch.idDraft?.active === expected.active, 'Active ID side was lost')
    check(
      JSON.stringify(batch.idDraft.sides) === JSON.stringify(expected.sides),
      'Saved card edits were lost'
    )
    check(batch.idDraft.sources.length === expected.sources.length, 'Added artwork was lost')
    check(
      batch.idDraft.idsPerSheet === expected.idsPerSheet &&
        Number(document.getElementById('id-copies-per-sheet').value) === expected.idsPerSheet,
      'IDs per sheet was lost on return'
    )
    check(
      batch.preset.paper === 'A3' && batch.preset.color === false,
      'New native printer settings did not reach the editor'
    )
  }
  if (stage === 1) {
    button(labels.back).click()
    await pause()
    const copies = document.getElementById('id-copies-per-sheet')
    copies.value = '2'
    copies.dispatchEvent(new Event('change', { bubbles: true }))
    await pause()
    const change = (id, value) => {
      const select = document.getElementById(id)
      select.value = String(value)
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const previewLabels = () =>
      [...document.querySelectorAll('section p')]
        .map((node) => node.textContent)
        .filter((text) => text.includes('× ('))
    check(
      previewLabels().length === 2 && previewLabels().every((text) => text.includes('90 × 56')),
      'Both sides must start at the same size'
    )
    change('id-copies-per-sheet', 'fill')
    await pause()
    check(
      previewLabels().every((text) => text.startsWith('8 ×')),
      'Fill sheet must use the A4 capacity'
    )
    change('id-sheet-margin', 20)
    await pause()
    check(
      previewLabels().every((text) => text.startsWith('4 ×')),
      'Fill sheet must respond to margins'
    )
    change('id-sheet-margin', 7)
    change('id-copies-per-sheet', 2)
    await pause()
    const outline = cropSection.querySelector('polygon').getAttribute('points')
    document.querySelector('[data-id-sheet-rotate="1"]').click()
    await pause()
    check(
      previewLabels()[0].includes('90 × 56') && previewLabels()[1].includes('90 × 56'),
      'ID flips must preserve matching horizontal dimensions'
    )
    check(
      cropSection.querySelector('polygon').getAttribute('points') === outline,
      'Sheet rotation must not change source corners'
    )
    const handle = cropSection.querySelector('button[title]')
    handle.focus()
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await pause()
  } else if (stage === 2) {
    check(batch.idDraft.sides[1].sheetTurns === 2, 'Independent sheet rotation was lost')
    for (let turn = 0; turn < 3; turn++) {
      document.querySelector('[data-id-sheet-rotate="1"]').click()
      await pause()
    }
    for (const [id, value] of [
      ['id-card-size', 60],
      ['id-sheet-spacing', 'compact'],
      ['id-sheet-margin', 10],
      ['id-sheet-gap', 8]
    ]) {
      const select = document.getElementById(id)
      select.value = String(value)
      select.dispatchEvent(new Event('change', { bubbles: true }))
      await pause()
    }
    const source = await window.fastPrint.file(0),
      transfer = new DataTransfer()
    transfer.items.add(new File([source.bytes], 'added-front.gif', { type: 'image/gif' }))
    const input = document.querySelector('input[type=file]')
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await wait(
      () => cropSection.querySelector('select').options.length === 4,
      'Added artwork did not appear'
    )
    button(labels.front).click()
    await pause()
    const copies = document.getElementById('id-copies-per-sheet')
    copies.value = '6'
    copies.dispatchEvent(new Event('change', { bubbles: true }))
    await pause()
    copies.value = '24'
    copies.dispatchEvent(new Event('change', { bubbles: true }))
    await pause()
    check(
      document.querySelector('[data-tool-header] button[aria-describedby]').disabled,
      'An overfull ID sheet must block Print instead of shrinking cards'
    )
    copies.value = '6'
    copies.dispatchEvent(new Event('change', { bubbles: true }))
    await pause()
    const selected = cropSection.querySelector('select')
    selected.value = selected.options[3].value
    selected.dispatchEvent(new Event('change', { bubbles: true }))
    await pause()
    await wait(() => !selected.disabled, 'Source analysis did not finish')
    const handle = cropSection.querySelector('button[title]')
    handle.focus()
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await pause()
  }
  const snapshot = {
    sourceId: cropSection.querySelector('select').value,
    crop: cropSection
      .querySelector('polygon')
      .getAttribute('points')
      .split(' ')
      .map((value) => {
        const [x, y] = value.split(',').map(Number)
        return { x, y }
      })
  }
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'ID editor overflows horizontally')
  check(
    !document.querySelector('[data-tool-header] button[aria-describedby]').disabled,
    'Print remains unavailable after valid card edits'
  )
  return {
    batch,
    snapshot,
    theme: document.documentElement.dataset.theme,
    language: document.documentElement.lang,
    performance: document.documentElement.dataset.performancePreset
  }
}

// A hidden Chromium surface may return its previous compositor frame on resize.
async function screenshotMatchesSource(png) {
  const source = document.querySelector('section img'),
    rect = source.getBoundingClientRect()
  const points = document
    .querySelector('section polygon')
    .getAttribute('points')
    .split(' ')
    .map((value) => value.split(',').map(Number))
  const expected = document.createElement('canvas')
  expected.width = Math.round(rect.width)
  expected.height = Math.round(rect.height)
  expected.getContext('2d').drawImage(source, 0, 0, expected.width, expected.height)
  const image = new Image()
  image.src = png
  await image.decode()
  const actual = document.createElement('canvas')
  actual.width = image.width
  actual.height = image.height
  actual.getContext('2d').drawImage(image, 0, 0)
  const sample = (canvas, x, y) => {
    const pixels = canvas
      .getContext('2d')
      .getImageData(
        Math.max(0, Math.min(canvas.width - 3, Math.round(x) - 1)),
        Math.max(0, Math.min(canvas.height - 3, Math.round(y) - 1)),
        3,
        3
      ).data
    const rgb = [0, 0, 0]
    for (let i = 0; i < pixels.length; i += 4)
      for (let c = 0; c < 3; c++) rgb[c] += pixels[i + c] / 9
    return rgb
  }
  let matches = 0
  for (const [u, v] of [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75]
  ]) {
    const x =
        (1 - v) * (points[0][0] * (1 - u) + points[1][0] * u) +
        v * (points[3][0] * (1 - u) + points[2][0] * u),
      y =
        (1 - v) * (points[0][1] * (1 - u) + points[1][1] * u) +
        v * (points[3][1] * (1 - u) + points[2][1] * u)
    const a = sample(expected, x * expected.width, y * expected.height),
      b = sample(
        actual,
        ((rect.left + x * rect.width) * image.width) / innerWidth,
        ((rect.top + y * rect.height) * image.height) / innerHeight
      )
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 55) matches++
  }
  return matches >= 4
}

const reports = []
for (const [language, theme, performance, labels] of [
  ['en', 'dark', 'balanced', { front: 'Front', back: 'Back', rotate: 'Rotate 180°' }],
  ['fr', 'light', 'balanced', { front: 'Recto', back: 'Verso', rotate: 'Tourner à 180°' }],
  ['ar', 'dark', 'low-end', { front: 'الأمام', back: 'الخلف', rotate: 'تدوير 180°' }]
]) {
  if (
    process.env.ID_WORKFLOW_LANGUAGES &&
    !JSON.parse(process.env.ID_WORKFLOW_LANGUAGES).includes(language)
  )
    continue
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  for (const file of [
    'error.txt',
    'ui-error.txt',
    'result.json',
    'restored.json',
    'expected-1.json',
    'expected-2.json',
    'ui-state-1.json',
    'ui-state-2.json'
  ])
    await rm(join(folder, file), { force: true })
  const selection = join(folder, 'selection.json')
  await writeFile(selection, JSON.stringify({ version: 1, files }))
  const bootstrap = join(folder, 'worker.cjs')
  const code = `const { app, BrowserWindow }=require('electron');const fs=require('node:fs/promises');const path=require('node:path');
const root=${JSON.stringify(root)},folder=${JSON.stringify(folder)};
app.setPath('userData',path.join(folder,'user-data'));
app.setAppPath(root);
app.whenReady().then(async()=>{
const seed=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
await seed.loadFile(path.join(root,'out/renderer/fast-print.html'));
await seed.webContents.executeJavaScript(${JSON.stringify(`localStorage.setItem('my-printer-app.language.v1',${JSON.stringify(language)});localStorage.setItem('my-printer-app.appearance.v1',${JSON.stringify(theme)});localStorage.setItem('my-printer-app.performance-preset',${JSON.stringify(performance)})`)});
app.on('browser-window-created',(_,window)=>{window.webContents.setBackgroundThrottling(false);window.webContents.once('did-finish-load',async()=>{
try{
if(!seed.isDestroyed())seed.destroy();
const stage=Number(await fs.readFile(path.join(folder,'stage.txt'),'utf8'));
const expected=stage>1?JSON.parse(await fs.readFile(path.join(folder,'expected-'+(stage-1)+'.json'),'utf8')):null;
const report=await window.webContents.executeJavaScript('('+${JSON.stringify(exerciseEditor.toString())}+')('+stage+','+JSON.stringify(expected)+','+${JSON.stringify(JSON.stringify(labels))}+')');
if(stage<3){
for(const [width,height] of [[1366,768],[1920,1080],[1600,900]]){window.setContentSize(width,height);await window.webContents.executeJavaScript("(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})()");if(!await window.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth+1'))throw new Error('Horizontal overflow at '+width+'x'+height);let image,matched=false;for(let attempt=0;attempt<8;attempt++){image=await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});matched=await window.webContents.executeJavaScript('('+${JSON.stringify(screenshotMatchesSource.toString())}+')('+JSON.stringify(image.toDataURL())+')');if(matched)break;await new Promise(resolve=>setTimeout(resolve,150));}if(!matched)throw new Error('Screenshot retained a stale source frame');await fs.writeFile(path.join(folder,'stage-'+stage+'-'+width+'x'+height+'.png'),image.toPNG());const metrics=await window.webContents.executeJavaScript('({width:innerWidth,height:innerHeight,stage:document.querySelector("section img").getBoundingClientRect().toJSON()})');await fs.writeFile(path.join(folder,'stage-'+stage+'-'+width+'x'+height+'.json'),JSON.stringify(metrics));}
await fs.writeFile(path.join(folder,'ui-state-'+stage+'.json'),JSON.stringify(report.snapshot));
await window.webContents.executeJavaScript("document.querySelector('[data-tool-header] button').click()");
}else{
await fs.writeFile(path.join(folder,'restored.json'),JSON.stringify({active:report.batch.idDraft.active,sources:report.batch.idDraft.sources.length,idsPerSheet:report.batch.idDraft.idsPerSheet,paper:report.batch.preset.paper,color:report.batch.preset.color,theme:report.theme,language:report.language,performance:report.performance}));
await window.webContents.executeJavaScript("document.querySelector('[data-tool-header] button[aria-describedby]').click()");
}
}catch(error){await fs.writeFile(path.join(folder,'ui-error.txt'),error.stack||error.message);app.exit(1);}
});});
await import(${JSON.stringify(pathToFileURL(join(root, 'out/main/index.js')).href)});
}).catch(error=>{console.error(error);app.exit(1)});`
  await writeFile(bootstrap, code)
  const env = {
    ...process.env,
    PRINTER_ACCOUNT_MODE: 'local-test',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings'),
    FAST_PRINT_VERIFY_DIR: join(folder, 'proof')
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  const logs = await run(
    executable,
    [
      '--app',
      electron,
      '--app-path',
      bootstrap,
      '--verify-id',
      folder,
      '--language',
      language,
      '--appearance',
      theme,
      '--preset',
      Buffer.from(
        JSON.stringify({
          printer: 'Microsoft Print to PDF',
          paper: 'A4',
          color: true,
          pagesPerSheet: 1,
          mode: 'id-card'
        })
      ).toString('base64'),
      '--batch',
      selection
    ],
    env
  )
  await writeFile(join(folder, 'worker.log'), logs)
  let error
  try {
    error = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  let uiError
  try {
    uiError = await readFile(join(folder, 'ui-error.txt'), 'utf8')
  } catch {}
  assert.ok(!error && !uiError, error || uiError)
  const native = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  const restored = JSON.parse(await readFile(join(folder, 'restored.json'), 'utf8'))
  assert.equal(native.headless, true)
  assert.equal(native.roundTrips, 2)
  assert.equal(native.failedPrinterPreservedReview, true)
  for (const stage of [1, 2]) {
    const saved = JSON.parse(await readFile(join(folder, 'expected-' + stage + '.json'), 'utf8'))
    const visible = JSON.parse(await readFile(join(folder, 'ui-state-' + stage + '.json'), 'utf8'))
    assert.ok(
      saved.sides[0].orientationVerified,
      'Automatic orientation failed in the bundled file renderer'
    )
    assert.equal(saved.active, stage === 1 ? 1 : 0)
    assert.equal(saved.sources.length, stage === 1 ? 2 : 3)
    assert.equal(saved.idsPerSheet, stage === 1 ? 2 : 6)
    assert.equal(saved.sheetSettings.heightMm, stage === 1 ? 56 : 60)
    assert.equal(saved.sheetSettings.marginMm, stage === 1 ? 7 : 10)
    assert.equal(saved.sheetSettings.spacing, stage === 1 ? 'even' : 'compact')
    assert.equal(saved.sides[1].sheetTurns, stage === 1 ? 2 : 0)
    assert.deepEqual(
      saved.sides[saved.active].crop,
      visible.crop,
      'Keyboard crop edits must match the actual saved review'
    )
    assert.equal(saved.sides[saved.active].sourceId, visible.sourceId)
  }
  assert.equal(restored.sources, 3)
  assert.equal(restored.active, 0)
  assert.equal(restored.idsPerSheet, 6)
  assert.equal(restored.language, language)
  assert.equal(restored.theme, theme)
  assert.equal(restored.performance, performance)
  const driver = JSON.parse(await readFile(join(folder, 'proof/driver-settings.json'), 'utf8'))
  assert.equal(driver.sheets, 2)
  assert.equal(driver.paper, 'A3')
  assert.equal(driver.copies, 5)
  assert.equal(driver.outputColor, false)
  const job = JSON.parse(await readFile(join(folder, 'proof/job.json'), 'utf8'))
  assert.equal(job.idsPerSheet, 6)
  const draft = JSON.parse(await readFile(join(folder, 'expected-2.json'), 'utf8'))
  const settings = draft.sheetSettings
  const dimensions = draft.sides.map((side) => idPrintedSize(settings.heightMm, side.sheetTurns)),
    heights = dimensions.map((size) => size.heightMm)
  assert.ok(
    dimensions.every((size) => size.widthMm === 90 && size.heightMm === 60),
    'Both sides must have matching card sizes'
  )
  const layout = idCopiesLayout('A3', false, heights, 6, {
    cellWidthMm: Math.max(...dimensions.map((size) => size.widthMm)),
    marginMm: settings.marginMm,
    gapMm: settings.gapMm,
    spacing: settings.spacing
  })
  const sizes = []
  for (const [side, name] of ['00001.png', '00002.png'].entries()) {
    const { data, info } = await sharp(join(folder, 'proof', name))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    assert.ok(
      Math.abs((info.width / 300) * 25.4 - 297) < 0.1 &&
        Math.abs((info.height / 300) * 25.4 - 420) < 0.1
    )
    const proof = measureIdProof(
      data,
      info.width,
      info.height,
      idCopyCenters(layout, side === 1),
      heights[side],
      300,
      info.channels
    )
    assert.equal(proof.cells.length, 6)
    for (const cell of proof.cells)
      assert.ok(
        cell.inkHeightMm > 57 && cell.inkHeightMm < 60.3,
        'Card height must match the shared preset'
      )
    assert.equal(proof.chromaticPixels, 0)
    assert.equal(proof.outsideInkPixels, 0)
    for (const cell of proof.cells) {
      assert.ok(cell.inkWidthMm > 86 && cell.inkWidthMm < 90.3)
      assert.ok(Math.abs(cell.centerOffsetMm.x) < 2 && Math.abs(cell.centerOffsetMm.y) < 2)
    }
    sizes.push(proof.cells)
  }
  const owned = resolve(native.cleanupDirectory)
  assert.equal(
    dirname(owned).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(basename(owned), /^[a-f0-9]{32}$/)
  await rm(owned, { recursive: true, force: true })
  reports.push({
    language,
    theme,
    performance,
    roundTrips: 2,
    addedArtworkPreserved: true,
    keyboardCropPreserved: true,
    paper: 'A3',
    copies: 5,
    idsPerSheet: 6,
    monochrome: true,
    sizes
  })
  console.log(
    language +
      ': ID edits and repeat counts survived settings changes; six 9 cm IDs per side on A3, five sheet copies, grayscale proof passed.'
  )
}
assert.deepEqual(await Promise.all(files.map(hash)), originals)
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ headless: true, hardwareJobs: 0, originalsUnchanged: true, reports }, null, 2)
)
