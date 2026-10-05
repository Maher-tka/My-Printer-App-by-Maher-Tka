export type AppRoute =
  | 'dashboard'
  | 'booklet-montage'
  | 'hardcover-cover'
  | 'cutter-montage'
  | 'card-montage'
  | 'sequential-number'
  | 'jobs'
  | 'exports'
  | 'app-health'
  | 'quality-lab'
  | 'license'
  | 'settings'

export interface PageMeta {
  title: string
  subtitle: string
}
