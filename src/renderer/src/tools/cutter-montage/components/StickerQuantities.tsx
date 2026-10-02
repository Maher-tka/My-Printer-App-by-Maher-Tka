import type { PiecePreset } from '../types'
export function StickerQuantities({
  pieces,
  onQuantity,
  onEdit,
  onContinue
}: {
  pieces: PiecePreset[]
  onQuantity: (id: string, value: number) => void
  onEdit: (id: string) => void
  onContinue: () => void
}): JSX.Element {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border bg-card/80">
      <div className="shrink-0 border-b p-4">
        <h2 className="font-semibold">How many of each sticker?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Set a quantity for each design, then arrange your print sheets.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Sticker</th>
              <th className="p-3">Cut line</th>
              <th className="p-3">Copies</th>
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
                        {piece.widthCm.toFixed(1)} x {piece.heightCm.toFixed(1)} cm
                      </small>
                    </span>
                  </button>
                </td>
                <td className="p-3 text-xs">
                  {piece.cutlineObjectId ? 'Ready' : 'Needs cut line'}
                </td>
                <td className="p-3">
                  <input
                    aria-label={`Copies of ${piece.displayName}`}
                    type="number"
                    min={1}
                    max={100000}
                    step={1}
                    key={`${piece.id}-${piece.quantity}`}
                    defaultValue={piece.quantity}
                    className="h-9 w-24 rounded border bg-background px-2"
                    onBlur={(e) => {
                      const value = Number(e.target.value)
                      if (Number.isSafeInteger(value) && value >= 1 && value <= 100000)
                        onQuantity(piece.id, value)
                      else e.target.value = String(piece.quantity)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pieces.length && (
          <p className="p-6 text-sm text-muted-foreground">
            Import a sticker from the library first.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between border-t p-3">
        <span className="text-sm">
          {pieces.reduce((sum, piece) => sum + piece.quantity, 0)} total copies
        </span>
      </div>
    </section>
  )
}
