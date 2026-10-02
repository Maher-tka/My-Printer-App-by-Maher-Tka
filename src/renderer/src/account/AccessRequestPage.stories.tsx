import { useEffect, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AccessRequestPage } from './AccessRequestPage'
import type { AccountSnapshot, AccessAdminSnapshot } from '../../../shared/account-types'

const account: AccountSnapshot = {
  status: 'signed-in',
  accountExists: true,
  storageMode: 'electron-user-data',
  profile: {
    id: 'customer-preview',
    displayName: 'Print Shop',
    email: 'shop@example.com',
    createdAt: '2026-10-01T10:00:00Z',
    lastSignedInAt: '2026-10-02T10:00:00Z'
  },
  cloud: {
    configured: true,
    isAdmin: false,
    status: 'none',
    checkedAt: new Date().toISOString(),
    serverNow: new Date().toISOString()
  }
}
const inbox: AccessAdminSnapshot = {
  customers: [
    {
      id: 'customer-preview',
      email: 'shop@example.com',
      display_name: 'Print Shop',
      created_at: '2026-10-01T10:00:00Z'
    },
    {
      id: 'trial-preview',
      email: 'trial@example.com',
      display_name: 'Trial Customer',
      created_at: '2026-09-28T10:00:00Z'
    }
  ],
  requests: [
    {
      id: 'request-preview',
      user_id: 'customer-preview',
      shop_name: 'Atelier Print',
      message: 'I would like to test Booklet Montage and batch exports for 14 days.',
      requested_plan: 'shop',
      status: 'pending',
      created_at: '2026-10-02T10:00:00Z',
      decision_reason: null
    }
  ],
  grants: [
    {
      user_id: 'trial-preview',
      plan: 'shop',
      status: 'trial',
      starts_at: '2026-10-01T10:00:00Z',
      ends_at: '2026-10-15T10:00:00Z',
      reason: '14-day trial'
    }
  ],
  audit: [],
  hasMore: false
}

function PreviewBridge({ children }: { children: ReactNode }): JSX.Element {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const previous = window.printerApp
    // Isolated Storybook data. No request or owner decision can reach a live account.
    window.printerApp = {
      ...previous,
      account: {
        ...previous?.account,
        adminList: async () => inbox,
        adminAction: async () => ({
          ok: false,
          state: account,
          error: 'Design preview only. Save decisions in the desktop app.'
        }),
        requestAccess: async () => ({
          ok: true,
          state: account,
          message: 'Design preview only. No request was sent.'
        })
      }
    } as Window['printerApp']
    setReady(true)
    return () => {
      window.printerApp = previous
    }
  }, [])
  return ready ? <>{children}</> : <p>Loading preview…</p>
}
const meta = {
  title: 'Account/Online access',
  component: AccessRequestPage,
  decorators: [
    (Story) => (
      <PreviewBridge>
        <Story />
      </PreviewBridge>
    )
  ],
  args: { state: account, onRefresh: async () => {}, onSignOut: () => {}, fullPage: true },
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof AccessRequestPage>
export default meta
type Story = StoryObj<typeof meta>
export const RequestAccess: Story = {}
export const Pending: Story = {
  args: {
    state: {
      ...account,
      cloud: { ...account.cloud!, status: 'pending', request: inbox.requests[0] }
    }
  }
}
export const Revoked: Story = {
  args: {
    state: {
      ...account,
      cloud: {
        ...account.cloud!,
        status: 'revoked',
        grant: {
          ...inbox.grants[0],
          status: 'revoked',
          reason: 'Contact Maher to discuss restoring access.'
        }
      }
    }
  }
}
export const Owner: Story = {
  args: { state: { ...account, cloud: { ...account.cloud!, isAdmin: true } } }
}
export const BackendUnavailable: Story = {
  args: {
    state: {
      ...account,
      cloud: {
        ...account.cloud!,
        status: 'unavailable',
        error: 'Cannot reach the account service. Check your internet connection and retry.'
      }
    }
  }
}
export const SetupRequired: Story = {
  args: { state: { ...account, cloud: { ...account.cloud!, configured: false } } }
}
