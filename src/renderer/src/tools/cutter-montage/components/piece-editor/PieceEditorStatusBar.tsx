import type { PiecePreset } from '../../types'

export function PieceEditorStatusBar({ piece }: { piece: PiecePreset }): JSX.Element {
  const mask = piece.clippingMaskEnabled
  const cutline = Boolean(piece.cutlineObjectId && piece.objects.some((object) => object.id === piece.cutlineObjectId && object.visible))
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs">
      <Status active={mask} label={mask ? 'Mask active' : 'Mask inactive'} tone="sky" />
      <Status active={cutline} label={cutline ? 'CutContour active' : 'CutContour hidden'} tone="pink" />
      <Status active={piece.groupLinked} label={piece.groupLinked ? 'Linked / grouped' : 'Independent objects'} tone="violet" />
      {piece.keyObjectId ? <Status active label={`Key: ${piece.objects.find((object) => object.id === piece.keyObjectId)?.name ?? 'Object'}`} tone="amber" /> : null}
    </div>
  )
}

function Status({ active, label, tone }: { active: boolean; label: string; tone: 'sky' | 'pink' | 'violet' | 'amber' }): JSX.Element {
  const classes = active ? { sky: 'bg-sky-100 text-sky-800', pink: 'bg-pink-100 text-pink-800', violet: 'bg-violet-100 text-violet-800', amber: 'bg-amber-100 text-amber-800' }[tone] : 'bg-muted text-muted-foreground'
  return <span className={`rounded px-2 py-1 font-medium ${classes}`}>{label}</span>
}
