import type { AppRoute } from './navigation'

export type ToolStatus = 'active' | 'mvp' | 'coming-soon'

export interface PrinterTool {
  id: string
  route: AppRoute
  title: string
  shortTitle: string
  description: string
  status: ToolStatus
  accent: 'blue' | 'violet' | 'green'
}
