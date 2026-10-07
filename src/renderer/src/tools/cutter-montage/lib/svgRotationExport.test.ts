import type { CutterProject, EditorObject, PieceSourceFile } from '../types'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'
import { createPiecePresetFromSource, createPlacedPieceFromPreset } from './piecePresets'
import { exportCutterSvg } from './svgExport'

const NORMALIZED_PATH = 'M 0 0 L 1 0 L 1 1 Z'

async function run(): Promise<void> {
  const source: PieceSourceFile = {
    id: 'rotation-source',
    sourceKind: 'image',
    fileName: 'rotation-source.png',
    displayName: 'rotation-source',
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71]),
    previewUrl: 'data:image/png;base64,iVBORw0KGgo=',
    naturalWidthPx: 400,
    naturalHeightPx: 200
  }
  const basePiece = createPiecePresetFromSource(source, [])
  const artwork = basePiece.objects.find((object) => object.role === 'artwork')
  assert(artwork, 'fixture artwork object exists')

  const artworkTransform = { xCm: 0, yCm: 0, widthCm: 4, heightCm: 2, rotation: 0 }
  const maskTransform = { xCm: 0.5, yCm: 0.25, widthCm: 2, heightCm: 1, rotation: 30 }
  const cutlineTransform = { xCm: 1, yCm: 0.5, widthCm: 2, heightCm: 1, rotation: -15 }
  const mask: EditorObject = {
    id: 'mask-path',
    type: 'mask',
    shapeType: 'path',
    role: 'clipping-mask',
    name: 'Custom path mask',
    visible: true,
    locked: true,
    transform: maskTransform,
    pathData: NORMALIZED_PATH,
    exportEnabled: true
  }
  const cutline: EditorObject = {
    id: 'cutline-path',
    type: 'cutline',
    shapeType: 'path',
    role: 'cutline',
    name: 'Custom CutContour',
    visible: true,
    locked: false,
    transform: cutlineTransform,
    pathData: NORMALIZED_PATH,
    offsetMm: 0,
    strokeColor: '#ff00ff',
    strokeName: 'CutContour',
    strokeWidthPt: 0.25,
    exportEnabled: true
  }
  const piece = {
    ...basePiece,
    widthCm: 4,
    heightCm: 2,
    artwork: { ...basePiece.artwork, transform: artworkTransform },
    mask: {
      ...basePiece.mask,
      enabled: true,
      shape: 'custom-polygon' as const,
      transform: maskTransform
    },
    cutline: {
      ...basePiece.cutline,
      shape: 'custom-path' as const,
      transform: { ...cutlineTransform, offsetMm: 0 },
      customPathData: NORMALIZED_PATH
    },
    objects: [{ ...artwork, transform: artworkTransform }, mask, cutline],
    maskObjectId: mask.id,
    cutlineObjectId: cutline.id,
    clippingMaskEnabled: true
  }
  const placed90 = {
    ...createPlacedPieceFromPreset(piece, 10, 20, 90),
    id: 'placed-90'
  }
  const placed270 = {
    ...createPlacedPieceFromPreset(piece, 30, 40, 270),
    id: 'placed-270'
  }
  const project: CutterProject = {
    sheet: { ...DEFAULT_CUTTER_SHEET, widthCm: 50, heightCm: 50 },
    sources: [source],
    pieces: [piece],
    placedPieces: [placed90, placed270],
    layers: { artwork: true, cutlines: true },
    exportSettings: {
      strokeName: 'CutContour',
      includeArtwork: true,
      includeCutlines: true,
      mode: 'print-cut',
      preset: 'illustrator-print-cut-svg'
    }
  }

  const svg = await (await exportCutterSvg(project)).blob.text()

  assertIncludes(
    svg,
    `<clipPath id="clip-piece-placed-90" clipPathUnits="userSpaceOnUse"><path d="${NORMALIZED_PATH}" transform="rotate(120 112.5 215) translate(102.5 210) scale(20 10)" /></clipPath>`,
    '90-degree placement combines its rotation with the internal mask rotation around the placed mask center'
  )
  assertIncludes(
    svg,
    `<clipPath id="clip-piece-placed-270" clipPathUnits="userSpaceOnUse"><path d="${NORMALIZED_PATH}" transform="rotate(300 307.5 425) translate(297.5 420) scale(20 10)" /></clipPath>`,
    '270-degree placement combines its rotation with the internal mask rotation around the placed mask center'
  )

  const cutline90 = getPathElementById(svg, 'CutContour-placed-90-cutline-path')
  assertIncludes(
    cutline90,
    `d="${NORMALIZED_PATH}" transform="rotate(75 110 220) translate(100 215) scale(20 10)"`,
    '90-degree CutContour path rotates after normalized translation and scaling'
  )
  const cutline270 = getPathElementById(svg, 'CutContour-placed-270-cutline-path')
  assertIncludes(
    cutline270,
    `d="${NORMALIZED_PATH}" transform="rotate(255 310 420) translate(300 415) scale(20 10)"`,
    '270-degree CutContour path rotates after normalized translation and scaling'
  )

  const referencedSvg = await (await exportCutterSvg(project, true)).blob.text()
  assert(!referencedSvg.includes('<symbol'), 'Illustrator export avoids symbol viewport offsets')
  assert(
    (referencedSvg.match(/data:image\/png;base64/g) ?? []).length === 1,
    'repeated artwork is embedded once'
  )
  for (const transform of [
    'rotate(90 110 220) translate(90 210) scale(40 20)',
    'rotate(270 310 420) translate(290 410) scale(40 20)'
  ]) {
    assertIncludes(
      referencedSvg,
      `<use xlink:href="#source-rotation-source" transform="${transform}" />`,
      'reused artwork rotates around the same sheet center as directly embedded artwork'
    )
  }
  for (const placed of [placed90, placed270]) {
    assert(
      getPathElementById(referencedSvg, `CutContour-${placed.id}-cutline-path`) ===
        getPathElementById(svg, `CutContour-${placed.id}-cutline-path`),
      'artwork reuse preserves the exact cutting geometry'
    )
  }

  const variedPlacements = [
    createPlacedPieceFromPreset(piece, -1, -0.5),
    createPlacedPieceFromPreset(piece, 5, 2, 180),
    { ...createPlacedPieceFromPreset(piece, 10, 5, 90), widthCm: 4, heightCm: 8 }
  ]
  const variedSvg = await (
    await exportCutterSvg({ ...project, placedPieces: variedPlacements }, true)
  ).blob.text()
  for (const transform of [
    'translate(-10 -5) scale(40 20)',
    'rotate(180 70 30) translate(50 20) scale(40 20)',
    'rotate(90 120 90) translate(80 70) scale(80 40)'
  ]) {
    assertIncludes(
      variedSvg,
      `<use xlink:href="#source-rotation-source" transform="${transform}" />`,
      'negative montage origins, half turns and scaled copies keep their intended coordinates'
    )
  }

  console.log('SVG rotation export tests passed.')
}

function getPathElementById(svg: string, id: string): string {
  const idIndex = svg.indexOf(`id="${id}"`)
  assert(idIndex >= 0, `SVG path ${id} exists`)
  const start = svg.lastIndexOf('<path', idIndex)
  const end = svg.indexOf('/>', idIndex)
  assert(start >= 0 && end >= 0, `SVG path ${id} is complete`)
  return svg.slice(start, end + 2)
}

function assertIncludes(value: string, expected: string, label: string): void {
  assert(value.includes(expected), `${label}: expected ${JSON.stringify(expected)}`)
}

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label)
}

void run()
