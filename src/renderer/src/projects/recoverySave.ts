import type { AutosaveWriteRequest } from '../../../shared/release-types'

type RecoveryWriter = (request: AutosaveWriteRequest) => Promise<{ ok: boolean; error?: string }>

/** IPC can resolve successfully while the disk write itself has failed. */
export async function writeProjectRecovery(
  request: AutosaveWriteRequest,
  writeAutosave: RecoveryWriter
): Promise<void> {
  const result = await writeAutosave(request)
  if (!result.ok) throw new Error(result.error || 'Automatic recovery could not be saved.')
}
