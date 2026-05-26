export type AppRoute =
  | 'dashboard'
  | 'booklet-montage'
  | 'hardcover-cover'
  | 'cutter-montage'
  | 'license'
  | 'settings'

export interface PageMeta {
  title: string
  subtitle: string
}
