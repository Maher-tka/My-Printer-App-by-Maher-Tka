import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const PDF_JS_DECODER_ASSET_NAMES = new Set([
  'openjpeg.wasm',
  'openjpeg_nowasm_fallback.js',
  'jbig2.wasm',
  'qcms_bg.wasm'
])

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          'fast-print': resolve('src/preload/fast-print.ts')
        },
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          'fast-print': resolve('src/renderer/fast-print.html')
        },
        output: {
          assetFileNames: (assetInfo) => {
            const assetName = assetInfo.name?.split('/').pop() ?? ''
            return PDF_JS_DECODER_ASSET_NAMES.has(assetName)
              ? 'assets/[name][extname]'
              : 'assets/[name]-[hash][extname]'
          }
        }
      }
    }
  }
})
