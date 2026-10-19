import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import type { AppRoute } from '@/types/navigation'
import { validateToolFileDrop } from '@/tools/shared/toolFileDrop'

const meta = {
  title: 'Layout/App shell',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ProductionWorkspace: Story = {
  render: () => <ShellPreview />
}

export const SidebarFileDrops: Story = {
  render: () => <ShellPreview fileDrops />
}

export const SidebarFileDropsBusy: Story = {
  render: () => <ShellPreview fileDrops busy />
}

function ShellPreview({
  fileDrops = false,
  busy = false
}: {
  fileDrops?: boolean
  busy?: boolean
}): JSX.Element {
  const [route, setRoute] = useState<AppRoute>('dashboard')
  const [dropStatus, setDropStatus] = useState('')

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        activeRoute={route}
        onNavigate={setRoute}
        fileDropBusy={busy}
        onDropToolFiles={
          fileDrops
            ? (target, files) => {
                const error = validateToolFileDrop(target, files)
                setDropStatus(error ?? `${target}: ${files.map((file) => file.name).join(', ')}`)
                if (!error) setRoute(target)
              }
            : undefined
        }
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          pageMeta={{ title: 'Production Dashboard', subtitle: 'Printer shop automation hub' }}
          isDeveloperMode
          onSignOut={() => undefined}
          onOpenCommandCenter={() => undefined}
          onOpenImageFile={() => undefined}
        />
        <main className="app-canvas flex-1 overflow-auto p-7">
          {fileDrops && (
            <div className="mb-4 space-y-4">
              <p role="status">
                {busy
                  ? 'Import in progress — sidebar drops are unavailable.'
                  : dropStatus ||
                    'Drag a file onto a tool icon. Expand navigation to check the same targets.'}
              </p>
              <div className="flex gap-4">
                {['artwork.pdf', 'front.png + back.jpg', 'unsupported.txt'].map((name) => (
                  <div
                    key={name}
                    draggable
                    className="rounded-lg border bg-card p-4"
                    onDragStart={(event) => {
                      for (const fileName of name.split(' + ')) {
                        event.dataTransfer.items.add(
                          new File(['Storybook file fixture'], fileName, {
                            type: fileName.endsWith('.pdf')
                              ? 'application/pdf'
                              : fileName.endsWith('.png')
                                ? 'image/png'
                                : fileName.endsWith('.jpg')
                                  ? 'image/jpeg'
                                  : 'text/plain'
                          })
                        )
                      }
                      event.dataTransfer.effectAllowed = 'copy'
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
            {['Booklet Montage', 'Hardcover Cover', 'Cutter Montage'].map((title) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Production workspace preview
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
