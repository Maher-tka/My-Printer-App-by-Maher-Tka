import type { Meta, StoryObj } from '@storybook/react-vite'
import { CutterMontagePage } from '@/tools/cutter-montage/CutterMontagePage'
import { BookletMontagePage } from '@/tools/booklet-montage/BookletMontagePage'
import { HardcoverCoverPage } from '@/tools/hardcover-cover/HardcoverCoverPage'

const meta = {
  title: 'Workflows/Guided actions',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const projectActions = {
  onNavigate: () => {},
  onOpenProject: async () => ({ ok: false, canceled: true }),
  onProjectSessionChange: () => {},
  onConfirmUnsavedChanges: async () => true
}

export const Cutter: Story = {
  render: () => <CutterMontagePage {...projectActions} />
}

export const Booklet: Story = {
  render: () => <BookletMontagePage {...projectActions} onInitialPdfImportConsumed={() => {}} />
}

export const Hardcover: Story = {
  render: () => <HardcoverCoverPage {...projectActions} />
}
