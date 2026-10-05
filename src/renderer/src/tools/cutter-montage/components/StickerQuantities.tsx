import { useLanguage } from '@/i18n/useLanguage'
import type { PiecePreset } from '../types'
import { PieceOrderControls } from './PieceOrderControls'
import { getPieceSize } from '../lib/pieceSize'
export function StickerQuantities({
  pieces,
  onQuantity,
  onTargetLength,
  onEdit
}: {
  pieces: PiecePreset[]
  onQuantity: (id: string, value: number) => void
  onTargetLength: (id: string, lengthCm: number) => boolean
  onEdit: (id: string) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border bg-card/80">
      <div className="shrink-0 border-b p-4">
        <h2 className="font-semibold">{t('Order by copies or metres')}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">{t('Sticker')}</th>
              <th className="p-3">{t('Cut line')}</th>
              <th className="p-3">{t('Quantity / metres')}</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((piece) => (
              <tr key={piece.id} className="border-b">
                <td className="p-3">
                  <button
                    onClick={() => onEdit(piece.id)}
                    className="flex items-center gap-3 text-left"
                  >
                    <img
                      src={piece.artwork.previewUrl || piece.previewUrl}
                      alt=""
                      className="size-12 rounded border bg-white object-contain"
                    />
                    <span>
                      {piece.displayName}
                      <small className="block text-muted-foreground">
                        {getPieceSize(piece).widthCm.toFixed(1)} x{' '}
                        {getPieceSize(piece).heightCm.toFixed(1)} cm
                      </small>
                    </span>
                  </button>
                </td>
                <td className="p-3 text-xs">
                  {piece.cutlineObjectId ? t('Ready') : 'Needs cut line'}
                </td>
                <td className="p-3">
                  <PieceOrderControls
                    piece={piece}
                    onQuantity={onQuantity}
                    onTargetLength={onTargetLength}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pieces.length && (
          <p className="p-6 text-sm text-muted-foreground">
            {t('Import a sticker from the library first.')}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between border-t p-3">
        <span className="text-sm">
          {pieces.reduce((sum, piece) => sum + piece.quantity, 0)} total copies
          {pieces.some((piece) => piece.orderMode === 'target-length') && (
            <> · Includes copies calculated from metre orders</>
          )}
        </span>
      </div>
    </section>
  )
}
