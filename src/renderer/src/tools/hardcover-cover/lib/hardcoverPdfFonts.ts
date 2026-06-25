import fontkit from '@pdf-lib/fontkit'
import type { PDFDocument, PDFFont } from 'pdf-lib'

const AMIRI_REGULAR_URL = new URL('../assets/fonts/Amiri-Regular.ttf', import.meta.url)
const AMIRI_BOLD_URL = new URL('../assets/fonts/Amiri-Bold.ttf', import.meta.url)

type NodeFileModule = {
  readFile: (path: URL) => Promise<Uint8Array>
}

export interface HardcoverPdfFonts {
  regular: PDFFont
  bold: PDFFont
}

let cachedFontBytes: Promise<Uint8Array> | undefined
let cachedBoldFontBytes: Promise<Uint8Array> | undefined

export async function embedHardcoverPdfFonts(
  document: PDFDocument
): Promise<HardcoverPdfFonts> {
  document.registerFontkit(fontkit)
  const [regularFontBytes, boldFontBytes] = await Promise.all([
    loadRegularHardcoverFontBytes(),
    loadBoldHardcoverFontBytes()
  ])
  const regular = await document.embedFont(regularFontBytes, {
    customName: 'Amiri',
    features: { clig: false, liga: false }
  })
  const bold = await document.embedFont(boldFontBytes, {
    customName: 'AmiriBold',
    features: { clig: false, liga: false }
  })

  return { regular, bold }
}

function loadRegularHardcoverFontBytes(): Promise<Uint8Array> {
  cachedFontBytes ??= readFontAsset(AMIRI_REGULAR_URL)
  return cachedFontBytes
}

function loadBoldHardcoverFontBytes(): Promise<Uint8Array> {
  cachedBoldFontBytes ??= readFontAsset(AMIRI_BOLD_URL)
  return cachedBoldFontBytes
}

async function readFontAsset(url: URL): Promise<Uint8Array> {
  if (isNodeRuntime()) {
    const nodeImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<NodeFileModule>
    const { readFile } = await nodeImport('node:fs/promises')
    return readFile(url)
  }

  const response = await fetch(url)
  if (!response.ok) throw new Error('Hardcover PDF font asset could not be loaded.')
  return new Uint8Array(await response.arrayBuffer())
}

function isNodeRuntime(): boolean {
  return Boolean(
    (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node
  )
}
