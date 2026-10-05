import { useLanguage } from '@/i18n/useLanguage'
import { Keyboard } from 'lucide-react'
import type { EditorTool } from '../../types'

export function PieceEditorShortcuts({ tool }: { tool: EditorTool }): JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="min-w-0 text-[11px] text-muted-foreground">
      {tool === 'ellipse' ? (
        <p className="mb-1">Ellipse: Shift circle · Alt/Option center · Space reposition</p>
      ) : null}
      <details>
        <summary className="flex w-fit cursor-pointer items-center gap-1 font-medium text-foreground">
          <Keyboard className="size-3.5" />
          {t('Shortcuts')}
        </summary>
        <p className="mt-1 max-w-2xl">
          S Select · V Move / pan · P Draw path · R Rectangle · Shift+R Rounded rectangle · O
          Ellipse · Delete/Backspace remove · Arrow keys nudge · Shift/Ctrl-click add selection ·
          Esc cancel · Ctrl/Cmd+C/V copy/paste · Ctrl/Cmd+D duplicate · Ctrl/Cmd+G group ·
          Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z redo
        </p>
      </details>
    </div>
  )
}
