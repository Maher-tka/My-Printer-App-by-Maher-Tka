import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const PDF_JS_DECODER_ASSET_NAMES = new Set([
  'openjpeg.wasm',
  'openjpeg_nowasm_fallback.js',
  'jbig2.wasm',
  'qcms_bg.wasm'
])

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const accountKey = env.PRINTER_SUPABASE_PUBLISHABLE_KEY ?? ''
  if (accountKey && !accountKey.startsWith('sb_publishable_')) {
    let isLegacyAnon = false
    try {
      isLegacyAnon =
        JSON.parse(Buffer.from(accountKey.split('.')[1], 'base64url').toString()).role === 'anon'
    } catch {
      /* Only public keys may be embedded in a desktop build. */
    }
    if (!isLegacyAnon)
      throw new Error(
        'PRINTER_SUPABASE_PUBLISHABLE_KEY must be a publishable/anon key. Refusing to bundle a secret key.'
      )
  }
  return {
    main: {
      define: {
        __PRINTER_SUPABASE_URL__: JSON.stringify(env.PRINTER_SUPABASE_URL ?? ''),
        __PRINTER_SUPABASE_KEY__: JSON.stringify(env.PRINTER_SUPABASE_PUBLISHABLE_KEY ?? ''),
        __PRINTER_DEV_UNLOCK__: JSON.stringify(
          mode === 'development' && env.VITE_DEV_UNLOCK_ALL === 'true'
        )
      },
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
  }
})
