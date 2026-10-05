import { useLanguage } from '@/i18n/useLanguage'
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
import type { AlignmentCommand, PiecePreset } from '../types'

interface AlignmentToolbarProps {
  piece: PiecePreset
  onSelectIds: (ids: string[]) => void
  onSetKeyObject: (objectId?: string) => void
  onAlign: (command: AlignmentCommand) => void
  onCenterArtworkToMask: () => void
  onCenterArtworkToCutline: () => void
  onCenterCutlineToMask: () => void
  onMatchCutlineToMask: () => void
  onMatchMaskToCutline: () => void
}

export function AlignmentToolbar(props: AlignmentToolbarProps): JSX.Element {
  const { t } = useLanguage()

  const selected = new Set(props.piece.selectedObjectIds)
  const artwork = props.piece.objects.find((object) => object.id === props.piece.artworkObjectId)
  const mask = props.piece.objects.find((object) => object.id === props.piece.maskObjectId)
  const cutline = props.piece.objects.find((object) => object.id === props.piece.cutlineObjectId)
  const activeMaskPairLocked = props.piece.clippingMaskEnabled
  const primaryIds = [artwork?.id, mask?.id, cutline?.id].filter((id): id is string => Boolean(id))
  const protectedPairSelected =
    activeMaskPairLocked &&
    [artwork?.id, mask?.id].some((objectId) => Boolean(objectId && selected.has(objectId)))
  const canAlign =
    props.piece.selectedObjectIds.length >= 2 &&
    Boolean(props.piece.keyObjectId && selected.has(props.piece.keyObjectId)) &&
    !protectedPairSelected

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-3">
        <h4 className="text-sm font-semibold">{t('Selection')}</h4>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SelectButton
            label={t('Artwork')}
            objectId={artwork?.id}
            piece={props.piece}
            onSelectIds={props.onSelectIds}
          />
          <SelectButton
            label={t('Mask')}
            objectId={mask?.id}
            piece={props.piece}
            onSelectIds={props.onSelectIds}
          />
          <SelectButton
            label={t('Cutline')}
            objectId={cutline?.id}
            piece={props.piece}
            onSelectIds={props.onSelectIds}
          />
          <Button
            type="button"
            size="sm"
            variant={primaryIds.every((id) => selected.has(id)) ? 'default' : 'outline'}
            onClick={() => props.onSelectIds(primaryIds)}
          >
            {t('Main objects')}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">{t('Key-object alignment')}</h4>
          <span className="text-[11px] text-muted-foreground">
            {props.piece.keyObjectId ? 'Key stays fixed' : 'Choose a key in Objects'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <IconButton
            label={t('Align left')}
            icon={AlignStartVertical}
            disabled={!canAlign}
            onClick={() => props.onAlign('left')}
          />
          <IconButton
            label={t('Align center horizontal')}
            icon={AlignCenter}
            disabled={!canAlign}
            onClick={() => props.onAlign('center-horizontal')}
          />
          <IconButton
            label={t('Align right')}
            icon={AlignEndVertical}
            disabled={!canAlign}
            onClick={() => props.onAlign('right')}
          />
          <IconButton
            label={t('Align top')}
            icon={AlignStartHorizontal}
            disabled={!canAlign}
            onClick={() => props.onAlign('top')}
          />
          <IconButton
            label={t('Align center vertical')}
            icon={AlignHorizontalJustifyCenter}
            disabled={!canAlign}
            onClick={() => props.onAlign('center-vertical')}
          />
          <IconButton
            label={t('Align bottom')}
            icon={AlignEndHorizontal}
            disabled={!canAlign}
            onClick={() => props.onAlign('bottom')}
          />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!artwork || !mask || activeMaskPairLocked}
            onClick={props.onCenterArtworkToMask}
          >
            <Crosshair data-icon="inline-start" />
            {t('Center artwork inside mask')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!artwork || !cutline || activeMaskPairLocked}
            onClick={props.onCenterArtworkToCutline}
          >
            <Crosshair data-icon="inline-start" />
            {t('Center artwork inside cutline')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!cutline || !mask}
            onClick={props.onCenterCutlineToMask}
          >
            <Crosshair data-icon="inline-start" />
            {t('Center cutline around mask')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!cutline || !mask}
            onClick={props.onMatchCutlineToMask}
          >
            {t('Match cutline to mask')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!cutline || !mask || activeMaskPairLocked}
            onClick={props.onMatchMaskToCutline}
          >
            {t('Match mask to cutline')}
          </Button>
        </div>
      </section>
    </div>
  )
}

function SelectButton({
  label,
  objectId,
  piece,
  onSelectIds
}: {
  label: string
  objectId?: string
  piece: PiecePreset
  onSelectIds: (ids: string[]) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      size="sm"
      disabled={!objectId}
      variant={
        objectId && piece.selectedObjectIds.length === 1 && piece.selectedObjectIds[0] === objectId
          ? 'default'
          : 'outline'
      }
      onClick={() => objectId && onSelectIds([objectId])}
    >
      {t(label)}
    </Button>
  )
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled
}: {
  label: string
  icon: typeof AlignCenter
  onClick: () => void
  disabled: boolean
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      aria-label={t(label)}
    >
      <Icon />
    </Button>
  )
}
