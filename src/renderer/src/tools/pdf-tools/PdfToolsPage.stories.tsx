import type { Meta, StoryObj } from '@storybook/react-vite'
import { PdfToolsPage } from './PdfToolsPage'
import { ToolHeader } from '../shared/ToolHeader'
import { ActionButton } from '@/components/ui/action-button'

const meta = {
  title: 'Workflows/PDF Tools',
  component: PdfToolsPage,
  parameters: { layout: 'fullscreen' },
  args: { onNavigate: () => {} },
  decorators: [
    (Story) => (
      <div className="bg-background p-6 text-foreground">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof PdfToolsPage>
export default meta
type Story = StoryObj<typeof meta>
export const ToolLibrary: Story = {}
export const ConversionHeader: Story = {
  render: () => (
    <ToolHeader
      title="PDF to Word"
      onBack={() => {}}
      backLabel="PDF Tools"
      output={
        <ActionButton action="export" variant="default">
          Convert to Word
        </ActionButton>
      }
    />
  )
}
export const BusyHeader: Story = {
  render: () => (
    <ToolHeader
      title="Merge PDF"
      onBack={() => {}}
      backDisabled
      output={<ActionButton action="export" variant="default" isBusy busyLabel="Processing…" />}
    />
  )
}
export const EmptyHeader: Story = {
  render: () => (
    <ToolHeader
      title="Split PDF"
      onBack={() => {}}
      output={
        <ActionButton action="export" variant="default" disabled>
          Split PDF
        </ActionButton>
      }
    />
  )
}
