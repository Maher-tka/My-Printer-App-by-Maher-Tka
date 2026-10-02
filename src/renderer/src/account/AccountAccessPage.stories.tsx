import type { Meta, StoryObj } from '@storybook/react-vite'
import { AccountAccessPage } from './AccountAccessPage'
import type { AccountSnapshot } from '../../../shared/account-types'
import type { LicenseSnapshot } from '../../../shared/licensing-types'

const accountState: AccountSnapshot = {
  status: 'signed-out',
  accountExists: true,
  storageMode: 'electron-user-data'
}
const licenseState: LicenseSnapshot = {
  installationId: 'storybook-installation',
  machineCode: 'STORYBOOK',
  mode: 'trial',
  plan: 'trial',
  planLabel: '14-day trial',
  statusLabel: 'Trial ready',
  features: ['paid-tools'],
  canUsePaidTools: true,
  trial: {
    startedAt: '2026-09-29T08:00:00.000Z',
    endsAt: '2026-10-13T08:00:00.000Z',
    remainingMs: 14 * 24 * 60 * 60 * 1000,
    isExpired: false
  },
  checkedAt: '2026-09-29T08:00:00.000Z',
  storageMode: 'electron-user-data'
}

const meta = {
  title: 'Account/Workspace access',
  component: AccountAccessPage,
  parameters: { layout: 'fullscreen' },
  args: {
    accountState,
    accountIsSubmitting: false,
    accountError: null,
    licenseState,
    licenseIsLoading: false,
    licenseIsActivating: false,
    licenseError: null,
    onCreateAccount: async () => ({
      ok: false,
      state: accountState,
      error: 'This is a design preview. Create your account in the desktop app.'
    }),
    onSignIn: async () => ({
      ok: false,
      state: accountState,
      error: 'This is a design preview. Sign in through the desktop app.'
    }),
    onActivateSerial: async () => ({
      ok: false,
      state: licenseState,
      error: 'This is a design preview. Activate your key in the desktop app.'
    })
  }
} satisfies Meta<typeof AccountAccessPage>

export default meta
type Story = StoryObj<typeof meta>

export const SignIn: Story = {}
export const CreateAccount: Story = {
  args: { accountState: { ...accountState, accountExists: false } }
}
export const InvalidCredentials: Story = {
  args: { accountError: 'That email or password was not recognized. Please try again.' }
}
export const SigningIn: Story = { args: { accountIsSubmitting: true } }
