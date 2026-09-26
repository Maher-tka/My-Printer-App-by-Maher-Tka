import { getNormalizedShapePath } from './shapeGeometry'
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  PDFString
} from 'pdf-lib'
import { svgPathToOperators } from 'pdf-lib/cjs/api/svgPath'
import type { EditorObject } from '../types'
import type { CutlineRect } from './cutlineGenerator'
import { cmToPoints } from './units'

export function createProductionLayers(pdf: PDFDocument, preview: boolean) {
  const make = (name: string, visible: boolean, printable: boolean) =>
    pdf.context.register(
      pdf.context.obj({
        Type: 'OCG',
        Name: PDFString.of(name),
        Intent: ['View', 'Design'],
        Usage: {
          View: { ViewState: visible ? 'ON' : 'OFF' },
          Print: { PrintState: printable ? 'ON' : 'OFF' }
        }
      })
    )
  const artwork = make('Artwork', true, true)
  const cut = make(preview ? 'Preview contours' : 'CutContour', preview, preview)
  const registration = make('FC RegisterMark Layer1', true, true)
  const refs = [artwork, cut, registration]
  pdf.catalog.set(
    PDFName.of('OCProperties'),
    pdf.context.obj({
      OCGs: refs,
      D: {
        Name: PDFString.of('Print artwork and registration marks'),
        BaseState: 'ON',
        Order: refs,
        ON: preview ? refs : [artwork, registration],
        OFF: preview ? [] : [cut],
        AS: [{ Event: 'Print', Category: ['Print'], OCGs: refs }]
      }
    })
  )
  return { artwork, cut, registration }
}

export function beginPdfLayer(
  page: ReturnType<PDFDocument['addPage']>,
  ref: ReturnType<PDFDocument['context']['register']>
) {
  const resources = page.node.Resources()!
  const key = PDFName.of(`Layer${ref.objectNumber}`)
  const properties =
    resources.lookupMaybe(PDFName.of('Properties'), PDFDict) ?? page.doc.context.obj({})
  properties.set(key, ref)
  resources.set(PDFName.of('Properties'), properties)
  page.pushOperators(
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), key])
  )
}
export function endPdfLayer(page: ReturnType<PDFDocument['addPage']>) {
  page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent))
}

export function installCutSpot(pdf: PDFDocument, page: ReturnType<PDFDocument['addPage']>) {
  const tint = pdf.context.register(
    pdf.context.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [0, 1, 0, 0], N: 1 })
  )
  page.node.set(PDFName.of('Resources'), page.node.Resources() ?? pdf.context.obj({}))
  const resources = page.node.Resources()!
  const blackTint = pdf.context.register(
    pdf.context.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [0, 0, 0, 1], N: 1 })
  )
  resources.set(
    PDFName.of('ColorSpace'),
    pdf.context.obj({
      CutContour: ['Separation', 'CutContour', 'DeviceCMYK', tint],
      MimakiFCRM: ['Separation', 'MimakiFCRM', 'DeviceCMYK', blackTint],
      MimakiFCRMDir: ['Separation', 'MimakiFCRMDir', 'DeviceCMYK', blackTint]
    })
  )
}
export function cutSpotOperators() {
  return [
    PDFOperator.of(PDFOperatorNames.StrokingColorspace, [PDFName.of('CutContour')]),
    PDFOperator.of(PDFOperatorNames.StrokingColorN, [PDFNumber.of(1)])
  ]
}

export function objectPath(
  object: Pick<EditorObject, 'shapeType' | 'pathData'>,
  rect: CutlineRect,
  sheetHeightCm: number
): PDFOperator[] {
  const angle = (rect.rotation * Math.PI) / 180
  const c = Math.cos(angle),
    s = Math.sin(angle)
  const w = cmToPoints(rect.widthCm),
    h = cmToPoints(rect.heightCm)
  const cx = cmToPoints(rect.xCm) + w / 2
  const cy = cmToPoints(sheetHeightCm - rect.yCm) - h / 2
  const path = getNormalizedShapePath(object, rect.widthCm, rect.heightCm)
  // Bake coordinates into the path: stroke widths stay in points, including
  // anisotropically scaled shapes, and clips do not rotate the artwork itself.
  return svgPathToOperators(path).map((operator) => {
    const tokens = operator.toString().trim().split(/\s+/)
    const name = tokens.pop() as PDFOperatorNames
    const args: PDFNumber[] = []
    for (let i = 0; i < tokens.length; i += 2) {
      const x = Number(tokens[i]) - 0.5
      const y = Number(tokens[i + 1]) - 0.5
      args.push(PDFNumber.of(cx + c * w * x - s * h * y), PDFNumber.of(cy - s * w * x - c * h * y))
    }
    return PDFOperator.of(name, args)
  })
}

export function registrationSpotOperators(direction = false) {
  return direction
    ? [
        PDFOperator.of(PDFOperatorNames.NonStrokingColorspace, [PDFName.of('MimakiFCRMDir')]),
        PDFOperator.of(PDFOperatorNames.NonStrokingColorN, [PDFNumber.of(1)])
      ]
    : [
        PDFOperator.of(PDFOperatorNames.StrokingColorspace, [PDFName.of('MimakiFCRM')]),
        PDFOperator.of(PDFOperatorNames.StrokingColorN, [PDFNumber.of(1)])
      ]
}
