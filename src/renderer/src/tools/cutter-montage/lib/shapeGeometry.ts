import type { EditorObject } from '../types'

export function getNormalizedShapePath(
  object: Pick<EditorObject, 'shapeType' | 'pathData'>,
  widthCm: number,
  heightCm: number
): string {
  return object.shapeType === 'path' && object.pathData
    ? object.pathData
    : object.shapeType === 'ellipse'
      ? 'M 1 .5 C 1 .7761423749 .7761423749 1 .5 1 C .2238576251 1 0 .7761423749 0 .5 C 0 .2238576251 .2238576251 0 .5 0 C .7761423749 0 1 .2238576251 1 .5 Z'
      : object.shapeType === 'rounded-rectangle'
        ? roundedPath(widthCm, heightCm)
        : 'M 0 0 L 1 0 L 1 1 L 0 1 Z'
}
function roundedPath(w: number, h: number): string {
  const r = Math.min(w, h) * 0.08,
    x = r / w,
    y = r / h
  return `M ${x} 0 H ${1 - x} A ${x} ${y} 0 0 1 1 ${y} V ${1 - y} A ${x} ${y} 0 0 1 ${1 - x} 1 H ${x} A ${x} ${y} 0 0 1 0 ${1 - y} V ${y} A ${x} ${y} 0 0 1 ${x} 0 Z`
}
