import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { PageManager } from './PageManager'
import { createBlankPage, blanksNeededForBooklet } from '../lib/bookletImposition'
import { reorderPagesByDrag, resetToOriginalOrder } from '../lib/pageOrdering'
import type { BookletPage } from '../types'

const meta = {
  title: 'Workflows/Booklet page carousel',
  parameters: { layout: 'padded' }
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function Example({ empty = false, busy = false }: { empty?: boolean; busy?: boolean }) {
  const [pages, setPages] = useState<BookletPage[]>(() =>
    empty
      ? []
      : Array.from({ length: 34 }, (_, index) => ({
          ...createBlankPage(index + 1),
          id: 'page-' + index,
          kind: 'pdf',
          sourceType: 'pdf',
          displayName: 'example.pdf - Page ' + (index + 1),
          sourceFileName: 'example.pdf',
          originalPageNumber: index + 1,
          thumbnailUrl:
            'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112"><rect width="80" height="112" fill="white"/><rect x="8" y="8" width="64" height="24" fill="' +
                (index % 2 ? '#bae6fd' : '#fecaca') +
                '"/><text x="40" y="65" text-anchor="middle" font-size="20">' +
                (index + 1) +
                '</text></svg>'
            )
        }))
  )
  const [selected, setSelected] = useState<string | null>(pages[0]?.id ?? null)
  const addBlank = () =>
    setPages((current) => [
      ...current,
      { ...createBlankPage(current.length + 1), id: 'blank-' + crypto.randomUUID() }
    ])
  return (
    <div className="max-w-5xl">
      <PageManager
        pages={pages}
        sources={[]}
        scaleMode="fit"
        selectedPageId={selected}
        blanksNeeded={blanksNeededForBooklet(pages.length)}
        pageCountIsValid={pages.length > 0 && pages.length % 4 === 0}
        recentColors={[]}
        isBusy={busy}
        onSelectPage={setSelected}
        onAddBlankPage={addBlank}
        onAutoAddBlankPages={() => {
          for (let index = 0; index < blanksNeededForBooklet(pages.length); index++) addBlank()
        }}
        onReorderPages={(active, over) =>
          setPages((current) => reorderPagesByDrag(current, active, over))
        }
        onResetOrder={(mode) => setPages((current) => resetToOriginalOrder(current, mode))}
        onDeletePage={(id) => setPages((current) => current.filter((page) => page.id !== id))}
        onBlankPageColorChange={(id, colorHex) =>
          setPages((current) =>
            current.map((page) => (page.id === id ? { ...page, colorHex } : page))
          )
        }
      />
    </div>
  )
}
export const Interactive: Story = { render: () => <Example /> }
export const Empty: Story = { render: () => <Example empty /> }
export const Importing: Story = { render: () => <Example busy /> }
