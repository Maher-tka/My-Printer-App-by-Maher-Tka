import assert from 'node:assert/strict'
import { ImportOperationGuard } from './importOperation'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { useCutterProject } from '../hooks/useCutterProject'

async function run(): Promise<void> {
  const guard = new ImportOperationGuard()
  let publish: (() => void) | undefined
  let published = false
  const canceled = guard.begin()
  const delayed = new Promise<void>((resolve) => {
    publish = () => {
      if (guard.isCurrent(canceled)) published = true
      resolve()
    }
  })
  guard.cancel()
  publish!()
  await delayed
  assert.equal(
    published,
    false,
    'late PDF work must not reopen dialogs or add pieces after cancellation'
  )
  assert.equal(canceled.signal.aborted, true)
  const previous = guard.begin()
  const replacement = guard.begin()
  assert.equal(previous.signal.aborted, true)
  assert.equal(
    guard.finish(previous),
    false,
    'stale cleanup must not clear the replacement busy state'
  )
  assert.equal(guard.isCurrent(replacement), true)
  assert.equal(guard.finish(replacement), true)
  assert.equal(guard.isCurrent(replacement), false, 'completed work cannot publish again')
  guard.cancel()
  guard.cancel()
  assert.equal(
    guard.isCurrent(guard.begin()),
    true,
    'imports can restart after repeated cancellation'
  )
  // Server rendering initializes the real hook without a DOM or PDF worker.
  // Its callbacks retain the same operation refs used by the mounted UI.
  for (const action of ['cancelPdfImport', 'clearProject'] as const) {
    let project!: ReturnType<typeof useCutterProject>
    function Harness(): null {
      project = useCutterProject()
      return null
    }
    renderToString(createElement(Harness))
    let finishSignature!: (bytes: ArrayBuffer) => void
    const signature = new Promise<ArrayBuffer>((resolve) => {
      finishSignature = resolve
    })
    let documentReads = 0
    const file = {
      name: 'delayed.pdf',
      type: 'application/pdf',
      slice: () => ({ arrayBuffer: () => signature }),
      arrayBuffer: async () => {
        documentReads += 1
        return new ArrayBuffer(0)
      }
    } as unknown as File
    const importing = project.importDesignFiles([file])
    project[action]()
    finishSignature(new TextEncoder().encode('%PDF-1.7').buffer)
    await importing
    assert.equal(
      documentReads,
      0,
      `${action} must prevent pending signature work from starting a PDF session`
    )
  }
  console.log('Cutter import cancellation checks passed.')
}
await run()
