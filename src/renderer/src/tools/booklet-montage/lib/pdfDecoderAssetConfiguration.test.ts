import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(testDirectory, '../../../../../..')
const workerSourcePath = resolve(testDirectory, 'pdfWorker.ts')
const pdfJsWasmDirectory = resolve(projectRoot, 'node_modules/pdfjs-dist/wasm')
const workerSource = readFileSync(workerSourcePath, 'utf8')

const decoderAssets = ['openjpeg.wasm', 'openjpeg_nowasm_fallback.js', 'jbig2.wasm', 'qcms_bg.wasm']

for (const asset of decoderAssets) {
  assert.equal(
    existsSync(resolve(pdfJsWasmDirectory, asset)),
    true,
    `pdfjs-dist must provide its ${asset} decoder asset`
  )
  assert.equal(
    workerSource.includes(`pdfjs-dist/wasm/${asset}?url`),
    true,
    `Vite must emit ${asset} from an explicit ?url import`
  )
}

assert.match(workerSource, /WasmFactory:\s*PdfJsWasmFactory/)
assert.match(workerSource, /wasmUrl:\s*PDF_JS_WASM_BASE_URL/)
assert.match(workerSource, /colorManaged\s*=\s*false/)
assert.match(workerSource, /useWorkerFetch:\s*colorManaged/)
assert.match(workerSource, /useWasm:\s*true/)
assert.doesNotMatch(workerSource, /node_modules[\\/].*pdfjs-dist[\\/]wasm/)

console.log('PDF.js decoder asset configuration tests passed.')
