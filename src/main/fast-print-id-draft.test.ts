import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadIdDraft, saveIdDraft, validateIdDraft } from './fast-print-id-draft.js'
import { LastFastPrintPrinter } from './fast-print-last-printer.js'
import {
  fullIdCrop,
  DEFAULT_ID_SHEET_SETTINGS,
  type IdPrintDraft
} from '../shared/fast-print-id.js'

const folder = await mkdtemp(join(tmpdir(), 'id-draft-test-'))
try {
  const remembered = new LastFastPrintPrinter(join(folder, 'settings', 'last-printer.json'))
  assert.equal(await remembered.read(), undefined)
  await remembered.save('Workshop printer')
  assert.equal(await new LastFastPrintPrinter(remembered.path).read(), 'Workshop printer')
  await assert.rejects(remembered.save('bad\nprinter'), /Invalid printer/)
  assert.equal(await remembered.read(), 'Workshop printer')
  await remembered.save('Second printer')
  assert.equal(await new LastFastPrintPrinter(remembered.path).read(), 'Second printer')
  await writeFile(remembered.path, 'incomplete optional preference')
  assert.equal(
    await remembered.read(),
    undefined,
    'Corrupt recent-printer data must allow fallback'
  )
  const original = join(folder, 'original.jpg')
  await writeFile(original, 'original artwork remains unchanged')
  const draft: IdPrintDraft = {
    version: 1,
    sources: [
      {
        id: 'a'.repeat(32),
        name: 'front & back.png',
        png: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRo8AAAAASUVORK5CYII='
      }
    ],
    sides: [
      {
        sourceId: 'a'.repeat(32),
        turns: 3,
        crop: fullIdCrop(),
        angleDegrees: 1.7,
        orientationVerified: false,
        sheetTurns: 3
      },
      null
    ],
    active: 1,
    color: false,
    duplex: true,
    idsPerSheet: 4,
    sheetSettings: { ...DEFAULT_ID_SHEET_SETTINGS, heightMm: 60, marginMm: 10, fillSheet: true }
  }
  assert.equal(await loadIdDraft(folder, [original]), undefined)
  await saveIdDraft(folder, [original], draft)
  assert.deepEqual(
    await loadIdDraft(folder, [original]),
    draft,
    'Back/reopen must retain artwork, crop, rotation, angle and active side'
  )
  const changed = {
    ...draft,
    sides: [null, { ...draft.sides[0]!, turns: 1, orientationVerified: true }],
    active: 0
  } as IdPrintDraft
  await saveIdDraft(folder, [original], changed)
  assert.deepEqual(
    await loadIdDraft(folder, [original]),
    changed,
    'Repeated reviews must use the latest edits'
  )
  assert.equal(
    (await readdir(join(folder, 'id-drafts'))).length,
    1,
    'Changing crops must reuse the existing artwork instead of duplicating full images'
  )
  const previous = await readFile(join(folder, 'id-draft.json'), 'utf8')
  await assert.rejects(
    saveIdDraft(folder, [original], {
      ...draft,
      sides: [{ ...draft.sides[0], sourceId: 'missing' }, null]
    }),
    /crop/
  )
  assert.equal(
    await readFile(join(folder, 'id-draft.json'), 'utf8'),
    previous,
    'Failed saves must retain the existing review'
  )
  for (const invalid of [
    { ...draft, sources: [draft.sources[0], draft.sources[0]] },
    { ...draft, idsPerSheet: 25 },
    { ...draft, sheetSettings: { ...DEFAULT_ID_SHEET_SETTINGS, marginMm: 0 } },
    { ...draft, sides: [{ ...draft.sides[0], sheetTurns: 4 }, null] },
    { ...draft, idsPerSheet: 1.5 },
    { ...draft, sources: [{ ...draft.sources[0], png: 'data:text/html;base64,AA==' }] },
    { ...draft, sides: [{ ...draft.sides[0], turns: 4 }, null] },
    { ...draft, sides: [{ ...draft.sides[0], orientationVerified: 'yes' }, null] },
    {
      ...draft,
      sides: [
        { ...draft.sides[0], crop: [{ x: 0, y: 0 }, null, { x: 1, y: 1 }, { x: 0, y: 1 }] },
        null
      ]
    },
    { ...draft, sides: [{ ...draft.sides[0], angleDegrees: NaN }, null] }
  ])
    assert.throws(() => validateIdDraft(invalid), /Invalid ID/)
  const stored = JSON.parse(previous)
  stored.sources[0].file = '../original.jpg'
  await writeFile(join(folder, 'id-draft.json'), JSON.stringify(stored))
  await assert.rejects(
    loadIdDraft(folder, [original]),
    /image/,
    'Stored image paths must stay inside owned draft folders'
  )
  await writeFile(join(folder, 'id-draft.json'), previous)
  assert.equal(await readFile(original, 'utf8'), 'original artwork remains unchanged')
  await writeFile(original, 'source changed after review')
  await assert.rejects(
    loadIdDraft(folder, [original]),
    /original files changed/,
    'Never restore edits onto a changed source selection'
  )
  console.log(
    'ID review round trips, repeated saves, failed-save preservation, source changes and owned-image validation passed.'
  )
} finally {
  await rm(folder, { recursive: true, force: true })
}
