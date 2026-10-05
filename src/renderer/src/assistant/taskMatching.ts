import type { AppRoute } from '@/types/navigation'
import type { PrinterJob } from '@/jobs/jobTypes'

export interface TaskSuggestion {
  route: AppRoute
  title: string
  description: string
  keywords: string
  steps: string[]
}

export const productionTasks: TaskSuggestion[] = [
  {
    route: 'card-montage',
    title: 'Montage business cards',
    description: 'Repeat a PDF or image card design on A4 with the spacing you need.',
    keywords: 'business card cards carte cartes visite montage a4 بطاقة بطاقات زيارة',
    steps: [
      'Import the business card PDF or image.',
      'Choose zero spacing, custom spacing, or auto 8.8 × 5.6 cm with adjustable horizontal and 1 mm vertical spacing.',
      'Review the A4 sheet and export or print at actual size.'
    ]
  },
  {
    route: 'booklet-montage',
    title: 'Make a booklet',
    description: 'Arrange PDF pages into sheets for folding and binding.',
    keywords:
      'booklet booklets brochure brochures magazine catalog catalogue livret livrets imposition saddle stitch كتيب كتيبات',
    steps: [
      'Import your PDF or page images.',
      'Choose paper size, binding, and duplex settings.',
      'Check the sheet preview and preflight before exporting.'
    ]
  },
  {
    route: 'cutter-montage',
    title: 'Print and cut artwork',
    description: 'Lay out stickers, labels, and artwork with cutter outlines.',
    keywords:
      'sticker stickers label labels decal decals cut cutter cutting plotter nesting artwork autocollant autocollants etiquette etiquettes decoupe ملصق ملصقات قص',
    steps: [
      'Import artwork or create a sticker.',
      'Set finished size, cutlines, and sheet layout.',
      'Review production bounds, then export print and cut files.'
    ]
  },
  {
    route: 'hardcover-cover',
    title: 'Build a hardcover',
    description: 'Size a binding cover with spine, hinges, and wrap guides.',
    keywords:
      'hardcover cover covers spine thesis graduation memoir memoire couverture reliure dos غلاف تجليد',
    steps: [
      'Enter the book dimensions and spine width.',
      'Add front, back, and spine artwork.',
      'Check wrap guides and export the cover sheet.'
    ]
  },
  {
    route: 'sequential-number',
    title: 'Number tickets or invoices',
    description: 'Generate sequential numbers with cut-and-stack ordering.',
    keywords:
      'ticket tickets invoice invoices numbering numbered sequential serial raffle coupon coupons receipt receipts facture factures numerotation billet billets ترقيم تذاكر فواتير',
    steps: [
      'Import the ticket or form design.',
      'Set the number range and position.',
      'Check cut-stack order and backs before exporting.'
    ]
  },
  {
    route: 'jobs',
    title: 'Manage a customer job',
    description: 'Track quotes, deposits, approval, and delivery dates.',
    keywords:
      'job jobs customer customers client clients quote quotes deposit payment balance deadline overdue approval devis acompte commande commandes paiement عميل طلبات عرض سعر',
    steps: [
      'Add the customer and job details.',
      'Set costs, quantity, deposit, and deadline.',
      'Update the status as production progresses.'
    ]
  },
  {
    route: 'exports',
    title: 'Find an export to reprint',
    description: 'Locate previously exported production files.',
    keywords:
      'reprint reprints exported exports history previous output reimprimer historique اعادة طباعة',
    steps: [
      'Find the job in Export Center.',
      'Check the saved output and print history.',
      'Open or reprint the selected production file.'
    ]
  }
]

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const fillerWords = new Set(
  'i a an the to for of my me with and want need please how can do make create prepare print printing some des de du le la les un une je veux faire imprimer pour et mon mes'.split(
    ' '
  )
)

export function searchWords(query: string): string[] {
  return [
    ...new Set(
      normalizeSearch(query)
        .split(' ')
        .filter((word) => word && !fillerWords.has(word))
    )
  ]
}

// One inserted, deleted, or substituted character. Short words never fuzzy-match.
function nearWord(left: string, right: string): boolean {
  if (left.length < 5 || Math.abs(left.length - right.length) > 1) return false
  let i = 0
  let j = 0
  let errors = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i++
      j++
      continue
    }
    if (++errors > 1) return false
    if (left.length >= right.length) i++
    if (right.length >= left.length) j++
  }
  return errors + (left.length - i) + (right.length - j) <= 1
}

export function searchScore(query: string, title: string, keywords: string): number {
  const words = searchWords(query)
  if (!words.length) return 0
  const titleWords = normalizeSearch(title).split(' ')
  const otherWords = normalizeSearch(keywords).split(' ')
  return words.reduce((score, word) => {
    if (titleWords.includes(word)) return score + 12
    if (otherWords.includes(word)) return score + 8
    if (
      word.length >= 3 &&
      [...titleWords, ...otherWords].some((candidate) => candidate.startsWith(word))
    )
      return score + 4
    if ([...titleWords, ...otherWords].some((candidate) => nearWord(word, candidate)))
      return score + 2
    return score
  }, 0)
}

export function findProductionTasks(query: string): TaskSuggestion[] {
  return productionTasks
    .map((task) => ({ task, score: searchScore(query, task.title, task.keywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ task }) => task)
    .slice(0, 3)
}

export function findCustomerJobs(jobs: PrinterJob[], query: string): PrinterJob[] {
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  if (!words.length) return []
  const phoneQuery = /^[+\d\s().-]+$/.test(query.trim()) ? query.replace(/\D/g, '') : ''
  return jobs
    .filter((job) => {
      if (phoneQuery.length >= 3 && job.phoneNumber.replace(/\D/g, '').includes(phoneQuery))
        return true
      const searchable = normalizeSearch(`${job.jobTitle} ${job.customerName} ${job.phoneNumber}`)
      return words.every((word) => searchable.includes(word))
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
}
