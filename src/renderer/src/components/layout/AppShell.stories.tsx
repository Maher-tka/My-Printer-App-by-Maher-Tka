import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import type { AppRoute } from '@/types/navigation'

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

function ShellPreview(): JSX.Element {
  const [route, setRoute] = useState<AppRoute>('dashboard')

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar activeRoute={route} onNavigate={setRoute} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          pageMeta={{ title: 'Production Dashboard', subtitle: 'Printer shop automation hub' }}
          isDeveloperMode
          onSignOut={() => undefined}
          onOpenCommandCenter={() => undefined}
          onOpenImageFile={() => undefined}
        />
        <main className="app-canvas flex-1 overflow-auto p-7">
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
