import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeJsonAtomically } from './atomic-json.js'
import {
  validIdCrop,
  validateIdSheetSettings,
  MAX_IDS_PER_SHEET,
  type IdPrintDraft,
  type IdSide
} from '../shared/fast-print-id.js'

const pngPrefix = 'data:image/png;base64,'

export function validateIdDraft(value: unknown): IdPrintDraft {
  const draft = value as IdPrintDraft | undefined
  if (
    !draft ||
    draft.version !== 1 ||
    !Array.isArray(draft.sources) ||
    draft.sources.length < 1 ||
    draft.sources.length > 8 ||
    !Array.isArray(draft.sides) ||
    draft.sides.length !== 2 ||
    ![0, 1].includes(draft.active) ||
    typeof draft.color !== 'boolean' ||
    typeof draft.duplex !== 'boolean' ||
    (draft.idsPerSheet !== undefined &&
      (!Number.isInteger(draft.idsPerSheet) ||
        draft.idsPerSheet < 1 ||
        draft.idsPerSheet > MAX_IDS_PER_SHEET))
  )
    throw new Error('Invalid ID review state.')
  const sheetSettings =
    draft.sheetSettings === undefined ? undefined : validateIdSheetSettings(draft.sheetSettings)
  const ids = new Set<string>()
  let totalBytes = 0
  const sources = draft.sources.map((source) => {
    if (
      !source ||
      typeof source.id !== 'string' ||
      !/^[a-f0-9-]{32,36}$/i.test(source.id) ||
      ids.has(source.id) ||
      typeof source.name !== 'string' ||
      source.name.length > 1024 ||
      typeof source.png !== 'string' ||
      !source.png.startsWith(pngPrefix) ||
      source.png.length > 32 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(source.png.slice(pngPrefix.length))
    )
      throw new Error('Invalid ID review image.')
    const png = Buffer.from(source.png.slice(pngPrefix.length), 'base64')
    totalBytes += png.length
    if (
      totalBytes > 128 * 1024 * 1024 ||
      png.length < 33 ||
      png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      png.toString('ascii', 12, 16) !== 'IHDR' ||
      png.readUInt32BE(16) < 1 ||
      png.readUInt32BE(20) < 1 ||
      png.readUInt32BE(16) > 2400 ||
      png.readUInt32BE(20) > 2400
    )
      throw new Error('Invalid ID review image.')
    ids.add(source.id)
    return { id: source.id, name: source.name, png: source.png }
  })
  const sides = draft.sides.map((side) => {
    if (side === null) return null
    if (
      !side ||
      !ids.has(side.sourceId) ||
      !Number.isInteger(side.turns) ||
      side.turns < 0 ||
      side.turns > 3 ||
      !Array.isArray(side.crop) ||
      side.crop.length !== 4 ||
      side.crop.some((point) => !point || typeof point !== 'object') ||
      !validIdCrop(side.crop) ||
      (side.angleDegrees !== undefined &&
        (!Number.isFinite(side.angleDegrees) || Math.abs(side.angleDegrees) > 180)) ||
      (side.orientationVerified !== undefined && typeof side.orientationVerified !== 'boolean') ||
      (side.sheetTurns !== undefined &&
        (!Number.isInteger(side.sheetTurns) || side.sheetTurns < 0 || side.sheetTurns > 3))
    )
      throw new Error('Invalid ID review crop.')
    return {
      ...(side.sheetTurns === undefined ? {} : { sheetTurns: side.sheetTurns }),
      sourceId: side.sourceId,
      turns: side.turns,
      crop: side.crop.map(({ x, y }) => ({ x, y })),
      ...(side.angleDegrees !== undefined ? { angleDegrees: side.angleDegrees } : {}),
      ...(side.orientationVerified !== undefined
        ? { orientationVerified: side.orientationVerified }
        : {})
    } as IdSide
  }) as IdPrintDraft['sides']
  return {
    version: 1,
    sources,
    sides,
    active: draft.active,
    color: draft.color,
    duplex: draft.duplex,
    ...(draft.idsPerSheet !== undefined ? { idsPerSheet: draft.idsPerSheet } : {}),
    ...(sheetSettings ? { sheetSettings } : {})
  }
}

async function inputStamp(files: string[]) {
  return Promise.all(
    files.map(async (path) => {
      const info = await stat(path)
      return { path, bytes: info.size, modified: info.mtimeMs }
    })
  )
}

/** Publish complete metadata last; unchanged source images are stored only once. */
export async function saveIdDraft(
  directory: string,
  files: string[],
  value: unknown
): Promise<void> {
  const draft = validateIdDraft(value)
  const sources = []
  for (const { id, name, png } of draft.sources) {
    const bytes = Buffer.from(png.slice(pngPrefix.length), 'base64')
    const digest = createHash('sha256').update(bytes).digest('hex')
    const folder = join(directory, 'id-drafts', digest.slice(0, 32)),
      file = `id-drafts/${digest.slice(0, 32)}/0.png`
    await mkdir(folder, { recursive: true })
    try {
      await writeFile(join(directory, file), bytes, { flag: 'wx' })
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
      if (
        createHash('sha256')
          .update(await readFile(join(directory, file)))
          .digest('hex') !== digest
      )
        throw new Error('The saved ID review image changed. Keep this window open and retry.')
    }
    sources.push({ id, name, file })
  }
  await writeJsonAtomically(join(directory, 'id-draft.json'), {
    ...draft,
    sources,
    inputs: await inputStamp(files)
  })
}

export async function loadIdDraft(
  directory: string,
  files: string[]
): Promise<IdPrintDraft | undefined> {
  let text: string
  try {
    text = await readFile(join(directory, 'id-draft.json'), 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  }
  if (text.length > 64 * 1024) throw new Error('Invalid ID review state.')
  const stored = JSON.parse(text)
  if (JSON.stringify(stored.inputs) !== JSON.stringify(await inputStamp(files)))
    throw new Error('The original files changed. Close Fast Print and start a new ID review.')
  if (!Array.isArray(stored.sources) || stored.sources.length > 8)
    throw new Error('Invalid ID review state.')
  const sources = await Promise.all(
    stored.sources.map(async (source: { id: string; name: string; file: string }) => {
      if (
        !source ||
        typeof source.file !== 'string' ||
        !/^id-drafts\/[a-f0-9]{32}\/[0-7]\.png$/.test(source.file)
      )
        throw new Error('Invalid ID review image.')
      const path = join(directory, source.file)
      if ((await stat(path)).size > 24 * 1024 * 1024) throw new Error('Invalid ID review image.')
      return {
        id: source.id,
        name: source.name,
        png: pngPrefix + (await readFile(path)).toString('base64')
      }
    })
  )
  return validateIdDraft({ ...stored, sources })
}
