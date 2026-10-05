/** Pure, bounded cover parsing shared by PDF text and OCR. Coordinates are page pixels. */
export interface CoverTextBlock {
  text: string
  x: number
  y: number
  width: number
  height: number
  confidence?: number
}

export interface CoverTextPage {
  width: number
  height: number
  blocks: CoverTextBlock[]
}

export interface DetectedSpineText {
  studentName?: string
  shortTitle?: string
  year?: string
}

export const SPINE_TEXT_FIELDS = ['studentName', 'shortTitle', 'year'] as const
export type SpineTextField = (typeof SPINE_TEXT_FIELDS)[number]

type Role = 'author' | 'staff' | 'title' | 'year' | 'date' | 'other'
// Match complete label phrases, longest before shortest. Never classify a person by honorific.
const LABELS: Array<[Role, RegExp]> = [
  ['staff', /^encad\s*r\s*e(?:e)?s?(?:\s+par)?\b/],
  [
    'staff',
    /^(?:(?:prepare|redige|realise)\s+)?(?:sous (?:la direction|l'encadrement|la supervision) de|dirige(?:e)?(?:s)? (?:et encadre(?:e)?(?:s)? )?par|co[ -]?encadre(?:e)?(?:s)? par|encadre(?:e)?(?:s)? par|encadr(?:ant|ante|eur|euse)(?:s)?(?:\s+(?:pedagogique|universitaire|academique|professionnel))?|direct(?:eur|rice) (?:de these|du memoire|de memoire)|tuteur|maitre de stage|jury(?: compose de)?|membres du jury|president(?:e)?(?: du jury)?|examinateur|examinatrice|rapporteur|rapporteuse)\b/
  ],
  [
    'staff',
    /^(?:under (?:the )?(?:supervision|guidance) of|supervised by|co[ -]?supervisor|(?:main |assistant |academic |industrial |project |thesis )?(?:supervisor|advisor|adviser)(?:s)?|certified by|accepted by|approved by|examiner|committee(?: chair)?|examining committee|dean|head of department)\b/
  ],
  [
    'staff',
    /^(?:(?:تحت|ب)\s*)?(?:اشرا\s*ف|تاطير)(?:\s+(?:الاستاذ(?:ة)?|الدكتور(?:ة)?|البروفيسور))?|^(?:المشرف(?:ة)?(?: الرئيسي| المساعد)?|لجنة (?:المناقشة|الحكم والمناقشة)|اعضاء لجنة المناقشة|رئيس(?:ا)?(?: اللجنة)?|مشرفا(?: ومقررا| مقررا)?|مناقشا|ممتحنا|عضوا مناقشا)(?=\s|:|$)/
  ],
  [
    'author',
    /^(?:(?:memoire|projet|rapport)\s+)?(?:presente|prepare|realise|elabore|redige)(?:e)?s?(?:\s+et\s+(?:presente|prepare|realise|elabore|redige|soutenu)(?:e)?s?)?\s+par(?:\s+(?:les etudiant(?:e)?s|l'etudiant(?:\(e\)|e)?))?\b/
  ],
  [
    'author',
    /^(?:submitted by(?: the (?:student|candidate))?|prepared by(?: the student)?|written by|presented by|authored by|student name|author name|name of (?:the )?student|authors?|students?|candidate|researcher)\b|^(?:by|par)(?=\s*:|\s*$)/
  ],
  [
    'author',
    /^(?:(?:من\s+)?اعداد(?:\s+وتقديم|\s+وانجاز)?|انجاز|تقديم)(?:\s+(?:الطالب(?:\(ة\)|ة|ين|تين|ان|تان|ات)?|الطلبة|الطلاب|الباحث(?:ة|ين)?))?(?=\s|:|$)|^الطالب(?:\(ة\)|ة|ين|تين|ان|تان|ات)?(?=\s|:|$)/
  ],
  [
    'title',
    /^(?:titre(?: du (?:memoire|projet|pfe))?|intitule(?: du projet)?|theme(?: du pfe)?|sujet(?: du memoire)?|(?:thesis |dissertation |project |research )?title|topic)(?=\s|:|$)/
  ],
  [
    'title',
    /^(?:تحت عنوان|بعنوان|العنوان|عنوان(?: البحث| المذكرة| الرسالة| الاطروحة)?|موضوع(?: البحث| المذكرة)?)(?=\s|:|$)/
  ],
  [
    'year',
    /^(?:annees? (?:universitaire|academique|scolaire|de formation|d'etudes)|academic (?:year|session)|school year|year of submission|(?:السنة|العام) (?:الجامعية|الجامعي|الدراسية|الدراسي|الاكاديمية|الاكاديمي)|الموسم الجامعي)(?=\s|:|$)/
  ],
  [
    'date',
    /^(?:soutenu(?:e)?(?: publiquement)? le|date (?:de soutenance|de presentation)|submitted on|date of (?:submission|defen[cs]e)|تاريخ المناقشة|نوقشت واجيزت علنا يوم)(?=\s|:|$)/
  ]
]

const NON_TITLE =
  /^(?:republique|royaume|ministere|universit[e y]|facult[e y]|institut|ecole|depart(?:ement|ment)|college|school of|brevet\b|technicien(?:en)?\b|master(?:e|s| of)?\b|licence\b|bachelor\b|diplome\b|ingenieur\b|memoire\b|these\b|dissertation\b|a (?:thesis|dissertation)\b|thesis\b|(?:p?rojet)(?:\s+de fin|\s*$)|de fin de (?:formation|etudes)|rapport de|en vue de|pour l'obtention|in partial|submitted to|الجمهورية|المملكة|وزارة|جامعة|كلية|قسم|المعهد|مذكرة|اطروحة|رسالة مقدمة|الاجازة|تخصص|التخصص|شعبة|الشعبة|الفرع|option\b|specialite\b|session\b|promotion\b|class of\b|cohort\b|دفعة|الفوج|registration|student id|matricule|رقم التسجيل)/
const PLACEHOLDER =
  /^(?:student name|name(?: and surname)?|nom(?: et prenom)?|prenom nom|titre|title|عنوان|اسم(?: الطالب)?|اسم ولقب|x{3,}|\.{3,}|[-_\s.]+)$/i

export function foldCoverText(value: string): string {
  return value
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0)))
}

function label(block: CoverTextBlock): { role: Role; remainder: string } | undefined {
  const raw = block.text.trim().replace(/^[-•●|“”"‘’\s]+/, '')
  const normalized = foldCoverText(raw)
  for (const [role, pattern] of LABELS) {
    const match = normalized.match(pattern)
    if (!match) continue
    // Preserve original accents and name spelling while removing the matched label.
    let end = 0
    while (end < raw.length && foldCoverText(raw.slice(0, end)).length < match[0].length) end++
    return {
      role,
      remainder: raw
        .slice(end)
        .replace(/^[\s:：.\-–]+/, '')
        .trim()
    }
  }
  return undefined
}

function clean(value: string): string {
  return value
    .trim()
    .replace(/^[-•●\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function usable(value: string): boolean {
  return (
    /\p{L}/u.test(value) &&
    !PLACEHOLDER.test(foldCoverText(value)) &&
    !/[\u0000-\u001f\ufffd]/u.test(value)
  )
}

function name(value: string): string | undefined {
  const text = clean(value).replace(/^(?:mr\.?|m\.|mme|mlle|monsieur|madame)\s*:?\s+/i, '')
  if (!usable(text) || NON_TITLE.test(foldCoverText(text)) || /[\d٠-٩۰-۹]/.test(text)) return
  if (/[|<>{}=]/.test(text)) return
  const words = text.split(/\s+/)
  if (text.length < 3 || text.length > 160 || words.length < 2 || words.length > 18) return
  return text
}

function normalizedYear(text: string): string | undefined {
  const value = foldCoverText(text)
  // Prefer the printed Gregorian range. Never infer it from a defense date.
  const ranges = [
    ...value.matchAll(/\b((?:18|19|20|21)\d{2})\s*[-/–—]\s*((?:18|19|20|21)\d{2})\b/g)
  ]
    .filter((match) => {
      const span = Math.abs(Number(match[1]) - Number(match[2]))
      return span >= 1 && span <= 6
    })
    .map((match) => [match[1], match[2]].sort().join('-'))
  const unique = [...new Set(ranges)]
  if (unique.length === 1) return unique[0]
  if (unique.length > 1) return
  const years = [...new Set(value.match(/\b(?:18|19|20|21)\d{2}\b/g) ?? [])]
  return years.length === 1 ? years[0] : undefined
}

function sameColumn(a: CoverTextBlock, b: CoverTextBlock): boolean {
  const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  return (
    overlap > Math.min(a.width, b.width) * 0.2 ||
    Math.abs(a.x - b.x) < Math.max(a.height, b.height) * 2
  )
}

/** Join fragmented words within a line without flattening neighboring name columns. */
export function groupCoverTextLines(page: CoverTextPage): CoverTextPage {
  const rows: CoverTextBlock[][] = []
  for (const block of page.blocks
    .filter((b) => b.text.trim())
    .slice(0, 1500)
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find(
      (items) =>
        Math.abs(items[0].y - block.y) < Math.min(items[0].height, block.height) * 0.45 ||
        Math.abs(items[0].y + items[0].height - block.y - block.height) <
          Math.min(items[0].height, block.height) * 0.35
    )
    if (row) row.push(block)
    else rows.push([block])
  }
  const blocks: CoverTextBlock[] = []
  for (const row of rows) {
    let previous: CoverTextBlock | undefined
    let previousEndedWithSpace = false
    for (const part of row.sort((a, b) => a.x - b.x)) {
      const gap = previous ? part.x - (previous.x + previous.width) : Infinity
      const nextLabel = label(part)
      const previousLabel = previous && label(previous)
      const labelContinuation =
        previous &&
        /^(?:par|by)\s*:?\s*$/.test(foldCoverText(part.text.trim())) &&
        /(?:realise|presente|elabore|redige|prepare|encadre|submitted|supervised|written|authored|prepared)\s*$/.test(
          foldCoverText(previous.text)
        )
      const fieldBoundary = Boolean(nextLabel && !labelContinuation)
      const authorDate = previousLabel?.role === 'author' && /[\d٠-٩۰-۹]/.test(part.text)
      if (
        previous &&
        !fieldBoundary &&
        !authorDate &&
        gap < Math.max(16, Math.min(previous.height, part.height) * 1.8) &&
        gap > -Math.min(previous.width, part.width) * 0.5
      ) {
        // Arabic pieces sort geometrically right-to-left; whole shaped runs stay intact.
        const nextText = clean(part.text)
        const separator =
          previous.confidence === undefined &&
          part.confidence === undefined &&
          !previousEndedWithSpace &&
          !/^\s/.test(part.text) &&
          gap < Math.min(previous.height, part.height) * 0.12
            ? ''
            : ' '
        previous.text = /[\u0600-\u06ff]/.test(nextText + previous.text)
          ? `${nextText}${separator}${previous.text}`
          : `${previous.text}${separator}${nextText}`
        if (previous.confidence !== undefined && part.confidence !== undefined)
          previous.confidence =
            (previous.confidence * previous.width + part.confidence * part.width) /
            Math.max(1, previous.width + part.width)
        previous.width = Math.max(previous.x + previous.width, part.x + part.width) - previous.x
        previous.height = Math.max(previous.height, part.height)
      } else {
        previous = { ...part, text: clean(part.text) }
        blocks.push(previous)
      }
      previousEndedWithSpace = /\s$/.test(part.text)
    }
  }
  return { ...page, blocks: blocks.sort((a, b) => a.y - b.y || a.x - b.x) }
}

export function detectSpineText(input: CoverTextPage): DetectedSpineText {
  const page = groupCoverTextLines(input)
  const blocks = page.blocks.filter(
    (block) => block.confidence === undefined || block.confidence >= 45
  )
  const labels = blocks
    .map((block) => ({ block, info: label(block) }))
    .filter((item) => item.info !== undefined)
  // A separated "par/by" following supervision still belongs to that label.
  // Do not reinterpret a fragmented supervisor heading as a fresh author.
  for (const item of labels) {
    if (
      item.info?.role === 'author' &&
      /^(?:par|by)\s*:?\s*$/.test(foldCoverText(item.block.text)) &&
      labels.some(
        (other) =>
          other.info?.role === 'staff' &&
          other.block.y <= item.block.y &&
          item.block.y - other.block.y < other.block.height * 3 &&
          sameColumn(other.block, item.block)
      )
    )
      item.info.role = 'staff'
  }
  const authors = labels.filter((item) => item.info?.role === 'author')
  const interiorHeading = blocks.some(
    (block) =>
      block.y < page.height * 0.35 &&
      /^(?:dedicaces?|remerciements?|dedication|acknowledg(?:e)?ments|sommaire|table des matieres|table of contents|introduction generale|اهداء|شكر و(?:عرفان|تقدير)|فهرس المحتويات)\s*[:.]?$/.test(
        foldCoverText(block.text)
      )
  )
  if (interiorHeading && !authors.length) return {}
  const result: DetectedSpineText = {}
  const names: string[] = []
  for (const author of authors) {
    const inline = name(author.info!.remainder)
    if (inline) names.push(inline)
    for (const block of blocks) {
      if (
        label(block) ||
        block.y <= author.block.y + author.block.height * 0.4 ||
        block.y - author.block.y > page.height * 0.24 ||
        !sameColumn(author.block, block)
      )
        continue
      const between = labels.some(
        (other) =>
          other !== author &&
          other.block.y > author.block.y + author.block.height * 0.4 &&
          other.block.y <= block.y &&
          (sameColumn(other.block, block) || other.info?.role === 'year')
      )
      if (between) continue
      // Choose the closest aligned role heading; a neighboring supervisor owns its own column.
      const owners = labels
        .filter(
          (other) =>
            ['author', 'staff'].includes(other.info!.role) &&
            other.block.y <= block.y &&
            sameColumn(other.block, block)
        )
        .sort(
          (a, b) =>
            block.y -
            a.block.y +
            Math.abs(block.x - a.block.x) * 0.5 -
            (block.y - b.block.y + Math.abs(block.x - b.block.x) * 0.5)
        )
      if (owners[0] !== author) continue
      const candidate = name(block.text)
      if (candidate) names.push(candidate)
    }
  }
  const uniqueNames = names.filter(
    (value, index) =>
      names.findIndex((other) => foldCoverText(other) === foldCoverText(value)) === index
  )
  const expectsTwo = authors.some((item) =>
    /الطالب(?:ين|تين|ان|تان)/.test(foldCoverText(item.block.text))
  )
  const multipleInline = uniqueNames.some((value) => /\s(?:\/|و|et|and)\s/.test(value))
  if (
    uniqueNames.length &&
    uniqueNames.length <= 6 &&
    (!expectsTwo || uniqueNames.length >= 2 || multipleInline)
  )
    result.studentName = uniqueNames.join(' / ')

  const years = labels.filter((item) => item.info?.role === 'year')
  const yearValues = years
    .map((item) => {
      const inline = normalizedYear(item.info!.remainder)
      if (inline) return inline
      const nearby = blocks
        .filter(
          (b) =>
            b.y > item.block.y &&
            b.y - item.block.y < item.block.height * 4 &&
            sameColumn(item.block, b) &&
            !label(b)
        )
        .sort((a, b) => a.y - b.y)
        .map((b) => normalizedYear(b.text))
        .find(Boolean)
      return nearby
    })
    .filter((value): value is string => Boolean(value))
  const uniqueYears = [...new Set(yearValues)]
  if (uniqueYears.length === 1) result.year = uniqueYears[0]
  if (!years.length) {
    const dates = blocks.filter(
      (block) =>
        label(block)?.role === 'date' ||
        (block.y > page.height * 0.75 && !label(block) && block.text.length < 45)
    )
    const candidates = [
      ...new Set(
        dates.map((block) => normalizedYear(block.text)).filter((v): v is string => Boolean(v))
      )
    ]
    if (candidates.length === 1) result.year = candidates[0]
  }

  const titleLabels = labels.filter((item) => item.info?.role === 'title')
  const titles: string[] = []
  for (const item of titleLabels) {
    const parts: string[] = []
    if (usable(item.info!.remainder)) parts.push(clean(item.info!.remainder))
    let bottom = item.block.y + item.block.height
    for (const block of blocks) {
      if (block.y < bottom - item.block.height * 0.2 || !sameColumn(item.block, block)) continue
      if (
        block.y - bottom > Math.max(70, block.height * 3) ||
        label(block) ||
        NON_TITLE.test(foldCoverText(block.text))
      )
        break
      if (usable(block.text)) parts.push(clean(block.text))
      bottom = block.y + block.height
      if (parts.length >= 8) break
    }
    if (parts.length) titles.push(parts.join('\n'))
  }
  if (titles.length === 1 && titles[0].length <= 500) result.shortTitle = titles[0]
  const coverEvidence =
    authors.length ||
    years.length ||
    blocks.some((block) =>
      /^(?:memoire\b|these\b|thesis\b|a (?:thesis|dissertation)\b|projet de fin|مذكرة|اطروحة)/.test(
        foldCoverText(block.text)
      )
    )
  if (!titleLabels.length && coverEvidence) {
    const authorTop = authors.length
      ? Math.min(...authors.map((item) => item.block.y))
      : page.height * 0.8
    const candidates = blocks.filter(
      (block) =>
        block.y >= -block.height * 0.25 &&
        block.y < authorTop &&
        !label(block) &&
        usable(block.text) &&
        !NON_TITLE.test(foldCoverText(block.text)) &&
        block.text.length >= 4
    )
    const groups: CoverTextBlock[][] = []
    for (const block of candidates) {
      const group = groups[groups.length - 1]
      const previous = group?.[group.length - 1]
      if (
        previous &&
        block.y - previous.y - previous.height < Math.max(12, previous.height * 1.5) &&
        sameColumn(previous, block) &&
        block.height >= Math.max(...group.map((line) => line.height)) * 0.28 &&
        Math.min(block.width, previous.width) >= Math.max(block.width, previous.width) * 0.15
      )
        group.push(block)
      else groups.push([block])
    }
    const ranked = groups
      .map((group) => ({
        text: group.map((block) => block.text).join('\n'),
        score:
          Math.max(...group.map((b) => b.height)) *
          (group.some((b) => Math.abs(b.x + b.width / 2 - page.width / 2) < page.width * 0.22)
            ? 1.2
            : 1)
      }))
      .filter((item) => item.text.length <= 500)
      .sort((a, b) => b.score - a.score)
    // Ambiguous same-size headings require manual entry instead of a guess.
    if (ranked[0] && (!ranked[1] || ranked[0].score > ranked[1].score * 1.15))
      result.shortTitle = ranked[0].text
  }
  return result
}

/** A small, isolated author-column retry avoids a second whole-page OCR pass. */
export function getSpineAuthorCrops(
  page: CoverTextPage
): Array<{ left: number; top: number; width: number; height: number }> {
  const headings = page.blocks
    .map((block) => ({ block, info: label(block) }))
    .filter((item) => item.info)
  return headings
    .filter((item) => item.info!.role === 'author' && !item.info!.remainder)
    .slice(0, 2)
    .map((author) => {
      const center = author.block.x + author.block.width / 2
      const neighbors = headings.filter(
        (item) =>
          item.info!.role === 'staff' &&
          Math.abs(item.block.y - author.block.y) < author.block.height * 2
      )
      let left = 0
      let right = page.width
      for (const neighbor of neighbors) {
        const otherCenter = neighbor.block.x + neighbor.block.width / 2
        if (otherCenter < center) left = Math.max(left, (otherCenter + center) / 2)
        else right = Math.min(right, (otherCenter + center) / 2)
      }
      const top = author.block.y + author.block.height + 3
      const nextHeading = headings
        .filter(
          (item) =>
            item.block.y > top &&
            (item.info!.role === 'year' || sameColumn(author.block, item.block))
        )
        .map((item) => item.block.y)
      const bottom = Math.min(page.height, top + page.height * 0.2, ...nextHeading)
      return {
        left: Math.floor(left),
        top: Math.ceil(top),
        width: Math.floor(right - left),
        height: Math.floor(bottom - top)
      }
    })
    .filter((crop) => crop.width > 40 && crop.height > 25)
}

/** Automatic results own only untouched placeholders/previous detections, never manual text. */
export function applyDetectedSpineText<T extends Record<SpineTextField, string>>(
  current: T,
  baseline: T,
  detected: DetectedSpineText,
  previous: DetectedSpineText,
  defaults: Record<SpineTextField, string>,
  protectedFields: ReadonlySet<SpineTextField>,
  overwriteKnown = false
): T {
  const next = { ...current }
  for (const field of SPINE_TEXT_FIELDS) {
    if (protectedFields.has(field) || current[field] !== baseline[field]) continue
    const automatic =
      !current[field].trim() ||
      current[field] === defaults[field] ||
      current[field] === previous[field]
    if (automatic || (overwriteKnown && detected[field])) next[field] = detected[field] ?? ''
  }
  return next
}
