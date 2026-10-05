import type { Meta, StoryObj } from '@storybook/react-vite'
import { StartupUpdateScreen } from './StartupUpdateGate'

const meta = {
  title: 'Workflows/Startup updates',
  component: StartupUpdateScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    state: {
      enabled: true,
      startupPending: true,
      status: 'checking',
      currentVersion: '0.2.7',
      message: 'Checking for updates…'
    }
  }
} satisfies Meta<typeof StartupUpdateScreen>
export default meta
type Story = StoryObj<typeof meta>
export const Checking: Story = {}
export const Downloading: Story = {
  args: {
    state: {
      ...meta.args.state,
      status: 'downloading',
      availableVersion: '0.2.8',
      downloadPercent: 42
    }
  }
}
export const Installing: Story = {
  args: { state: { ...meta.args.state, status: 'installing', availableVersion: '0.2.8' } }
}
