import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ClearButton } from './clear-button'

const meta = {
  title: 'Design system/Clear workspace',
  component: ClearButton,
  parameters: { layout: 'centered' },
  args: { onClear: () => {} }
} satisfies Meta<typeof ClearButton>

export default meta
type Story = StoryObj<typeof meta>

export const Enabled: Story = {}
export const EmptyOrBusy: Story = { args: { disabled: true } }
export const ConfirmAndClear: Story = {
  render: () => {
    const [items, setItems] = useState(4)
    return (
      <div className="space-y-4">
        <p role="status">{items} pages</p>
        <ClearButton onClear={() => setItems(0)} disabled={items === 0} />
      </div>
    )
  }
}
