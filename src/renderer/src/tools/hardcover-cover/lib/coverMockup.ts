import type { CoverMockupMode } from '../types'

export function getMockupTransform(mode: CoverMockupMode): string {
  switch (mode) {
    case 'folded':
      return 'perspective(900px) rotateX(4deg) rotateY(-8deg)'
    case 'spine':
      return 'perspective(900px) rotateY(-72deg)'
    case 'front':
      return 'perspective(900px) rotateY(-4deg)'
    default:
      return 'none'
  }
}
