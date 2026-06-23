import {
  AlignCenter,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  Crosshair
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AlignmentCommand, EditorObjectType, KeyObjectState } from '../types'

interface AlignmentToolbarProps {
  selectedObjects: EditorObjectType[]
  keyObject: KeyObjectState
  onSelectedObjectsChange: (objects: EditorObjectType[]) => void
  onSetKeyObject: (object: EditorObjectType | null) => void
  onAlign: (command: AlignmentCommand) => void
  onCenterArtworkToCutline: () => void
  onCenterCutlineToArtwork: () => void
  onMatchCutlineToMask: () => void
  onMatchMaskToCutline: () => void
}

export function AlignmentToolbar({
  selectedObjects,
  keyObject,
  onSelectedObjectsChange,
  onSetKeyObject,
  onAlign,
  onCenterArtworkToCutline,
  onCenterCutlineToArtwork,
  onMatchCutlineToMask,
  onMatchMaskToCutline
}: AlignmentToolbarProps): JSX.Element {
  const artworkSelected = selectedObjects.includes('artwork')
  const maskSelected = selectedObjects.includes('mask')
  const cutlineSelected = selectedObjects.includes('cutline')

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-3">
        <h4 className="text-sm font-semibold">Selection</h4>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" size="sm" variant={artworkSelected && selectedObjects.length === 1 ? 'default' : 'outline'} onClick={() => onSelectedObjectsChange(['artwork'])}>
            Artwork
          </Button>
          <Button type="button" size="sm" variant={maskSelected && selectedObjects.length === 1 ? 'default' : 'outline'} onClick={() => onSelectedObjectsChange(['mask'])}>
            Mask
          </Button>
          <Button type="button" size="sm" variant={cutlineSelected && selectedObjects.length === 1 ? 'default' : 'outline'} onClick={() => onSelectedObjectsChange(['cutline'])}>
            Cutline
          </Button>
          <Button type="button" size="sm" variant={selectedObjects.length === 3 ? 'default' : 'outline'} onClick={() => onSelectedObjectsChange(['artwork', 'mask', 'cutline'])}>
            All
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button type="button" size="sm" variant={keyObject.object === 'artwork' ? 'default' : 'outline'} onClick={() => onSetKeyObject('artwork')}>
            Key Art
          </Button>
          <Button type="button" size="sm" variant={keyObject.object === 'mask' ? 'default' : 'outline'} onClick={() => onSetKeyObject('mask')}>
            Key Mask
          </Button>
          <Button type="button" size="sm" variant={keyObject.object === 'cutline' ? 'default' : 'outline'} onClick={() => onSetKeyObject('cutline')}>
            Key Cut
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-3">
        <h4 className="text-sm font-semibold">Alignment</h4>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <IconButton label="Align left" icon={AlignStartVertical} onClick={() => onAlign('left')} />
          <IconButton label="Align center horizontal" icon={AlignCenter} onClick={() => onAlign('center-horizontal')} />
          <IconButton label="Align right" icon={AlignEndVertical} onClick={() => onAlign('right')} />
          <IconButton label="Align top" icon={AlignStartHorizontal} onClick={() => onAlign('top')} />
          <IconButton label="Align center vertical" icon={AlignHorizontalJustifyCenter} onClick={() => onAlign('center-vertical')} />
          <IconButton label="Align bottom" icon={AlignEndHorizontal} onClick={() => onAlign('bottom')} />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCenterArtworkToCutline}>
            <Crosshair data-icon="inline-start" />
            Center artwork inside cutline
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCenterCutlineToArtwork}>
            <Crosshair data-icon="inline-start" />
            Center cutline around artwork
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onMatchCutlineToMask}>
            Match cutline size to mask
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onMatchMaskToCutline}>
            Match mask size to cutline
          </Button>
        </div>
      </section>
    </div>
  )
}

function IconButton({
  label,
  icon: Icon,
  onClick
}: {
  label: string
  icon: typeof AlignCenter
  onClick: () => void
}): JSX.Element {
  return (
    <Button type="button" size="icon" variant="outline" onClick={onClick} aria-label={label}>
      <Icon />
    </Button>
  )
}
