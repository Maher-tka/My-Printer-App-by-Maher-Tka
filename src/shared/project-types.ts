export type UnsavedChangesAction =
  | 'open-project'
  | 'new-project'
  | 'import-pdf'
  | 'navigate'
  | 'close-window'

export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel'

export interface UnsavedChangesRequest {
  action: UnsavedChangesAction
  projectName: string
}

export interface UnsavedChangesResult {
  choice: UnsavedChangesChoice
}
