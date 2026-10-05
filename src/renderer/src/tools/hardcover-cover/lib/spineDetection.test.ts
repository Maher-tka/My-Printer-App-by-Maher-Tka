import assert from 'node:assert/strict'
import { getSpineDetectionSource } from './spineDetectionSource'
import type { HardcoverPdfSource } from '../types'
import {
  applyDetectedSpineText,
  detectSpineText,
  getSpineAuthorCrops,
  foldCoverText,
  type CoverTextBlock
} from './spineDetection'

const block = (text: string, x: number, y: number, width = 220, height = 18): CoverTextBlock => ({
  text,
  x,
  y,
  width,
  height
})
const parse = (blocks: CoverTextBlock[]) => detectSpineText({ width: 600, height: 850, blocks })

const french = parse([
  block('Université de Monastir', 120, 100, 340, 22),
  block('PROJET DE FIN D’ETUDES', 100, 210, 380, 26),
  block('Titre :', 200, 310),
  block('Conception d’un système', 120, 350, 350, 24),
  block('de gestion des stocks', 130, 383, 330, 24),
  block('Réalisé par :', 45, 520, 150),
  block('Sous la direction de :', 340, 520, 210),
  block('Amira Ben Salah', 45, 552, 230),
  block('Sami Mansour', 340, 552, 190),
  block('Nour El Houda', 45, 584, 230),
  block('Année universitaire : 2023-2024', 120, 720, 350),
  block('Soutenu le : 10/01/2025', 140, 765, 300)
])
assert.deepEqual(french, {
  studentName: 'Amira Ben Salah / Nour El Houda',
  year: '2023-2024',
  shortTitle: 'Conception d’un système\nde gestion des stocks'
})

const arabic = parse([
  block('جامعة المنستير', 170, 100, 280),
  block('العنوان:', 190, 285),
  block('تطوير منصة لإدارة الوثائق', 100, 340, 400, 25),
  block('إنجاز:', 390, 530, 130),
  block('تحت إشراف الأستاذة:', 45, 530, 240),
  block('أحمد بن علي', 380, 570, 170),
  block('مريم عبد الله', 380, 610, 170),
  block('سلمى منصور', 45, 570, 200),
  block('السنة الجامعية: ٢٠٢٥/٢٠٢٤', 130, 740, 350)
])
assert.deepEqual(arabic, {
  studentName: 'أحمد بن علي / مريم عبد الله',
  year: '2024-2025',
  shortTitle: 'تطوير منصة لإدارة الوثائق'
})

const english = parse([
  block('Department of Computer Science', 70, 90, 420),
  block('A THESIS', 220, 150, 180, 25),
  block('Document routing and archiving', 70, 300, 420, 28),
  block('Submitted by: Lina Ben Ali', 100, 510, 370),
  block('Certified by: Professor Adam Smith', 90, 565, 420),
  block('Accepted by: Dean Nora Jones', 90, 605, 420),
  block('May 2026', 240, 770, 140)
])
assert.deepEqual(english, {
  studentName: 'Lina Ben Ali',
  year: '2026',
  shortTitle: 'Document routing and archiving'
})

const subtitleCover = parse([
  block('MEMOIRE D’ARCHITECTURE', 100, 110, 380, 22),
  block('LA RECONQUÊTE PORTUAIRE :', 60, 250, 480, 34),
  block('Un nouveau souffle pour le centre-ville de Sousse', 40, 300, 520, 26),
  block('Élaboré par : Amira Ben Salah', 40, 700, 240),
  block('Encadré par : Sami Mansour', 330, 700, 230)
])
assert.equal(
  subtitleCover.shortTitle,
  'LA RECONQUÊTE PORTUAIRE :\nUn nouveau souffle pour le centre-ville de Sousse',
  'the printed subtitle stays on its own line after the colon'
)
assert.equal(
  parse([
    block('Titre : HTTP: request routing', 40, 300, 500),
    block('Présenté par : Lina Ben Ali', 40, 600, 500)
  ]).shortTitle,
  'HTTP: request routing',
  'an inline colon does not invent a line break absent from the cover'
)
assert.equal(
  parse([
    block('Titre : Partie principale ;', 40, 300, 500),
    block('Un sous-titre complémentaire', 40, 335, 500),
    block('Présenté par : Lina Ben Ali', 40, 600, 500)
  ]).shortTitle,
  'Partie principale ;\nUn sous-titre complémentaire',
  'printed line breaks are preserved with other punctuation too'
)

for (const studentLabel of [
  'Préparé par',
  'Présenté et soutenu par',
  'Élaboré par',
  'Rédigé par',
  'إعداد الطلبة',
  'Prepared by the Student',
  'Authored by'
]) {
  const detected = parse([
    block(`${studentLabel}: Amira Ben Salah`, 50, 520, 480),
    block('Encadré par: Dr. Sami Mansour', 50, 580, 480)
  ])
  assert.equal(detected.studentName, 'Amira Ben Salah', studentLabel)
}
assert.equal(
  parse([block('Préparé sous la direction de: Sami Mansour', 50, 520, 480)]).studentName,
  undefined
)
assert.equal(
  parse([block('إعداد الطالبين:', 380, 530, 170), block('أحمد بن علي', 380, 570, 170)]).studentName,
  undefined,
  'do not silently omit the second student named by a dual author label'
)
const damagedSupervisor = parse([
  block('جامعة المنستير', 200, 100),
  block('تطوير منصة لإدارة الوثائق', 150, 330, 350, 33),
  block('إشرا ف الدكتورة', 40, 600, 230, 35),
  block('إعداد الطالبين:', 380, 600, 170),
  block('أحمد بن علي', 380, 660, 170),
  block('مريم عبد الله', 380, 700, 170),
  block('سلمى منصور', 40, 660, 200)
])
assert.equal(
  damagedSupervisor.shortTitle,
  'تطوير منصة لإدارة الوثائق',
  'split OCR supervision label never becomes the title'
)
assert.equal(damagedSupervisor.studentName, 'أحمد بن علي / مريم عبد الله')
const crops = getSpineAuthorCrops({
  width: 600,
  height: 850,
  blocks: [
    block('إعداد الطالبين:', 380, 600, 170),
    block('تحت إشراف الأستاذة:', 40, 600, 240),
    block('السنة الجامعية:', 150, 810, 300)
  ]
})
assert.equal(crops.length, 1)
assert.ok(
  crops[0].left > 280 && crops[0].left < 380,
  'the author retry excludes the neighboring supervisor column'
)

// Real-shop layouts, anonymized: large headings, two-year training periods,
// noisy OCR borders, split supervision labels, and pages without cover metadata.
const training = parse([
  block('PROJET', 60, 190, 380, 45),
  block('DE FIN DE FORMATION', 60, 242, 480, 30),
  block('Brevet de Technicien Professionnel', 65, 315, 470, 24),
  block('Spécialité', 65, 365),
  block('TECHNICIEN EN INFOGRAPHIE ET PAO', 65, 395, 470, 24),
  block('Réalisé et Présenté par : Lina Ben Ali', 85, 520, 420, 22),
  block('Encadré par : Mme Sami Mansour', 100, 585, 400, 22),
  block('Mr Adam Smith', 200, 628, 250),
  block('Années de Formation', 180, 710, 290, 22),
  block('2024/2026', 220, 746, 180, 22)
])
assert.deepEqual(
  training,
  { studentName: 'Lina Ben Ali', year: '2024-2026' },
  'degree headings are not fabricated research titles'
)
const graphicTitle = parse([
  block('CHARTE', 30, 12, 310, 91),
  block('GRAPHIQUE', 30, 115, 313, 63),
  block('de la marque NOVA', 37, 189, 260, 31),
  block('Encadré par:', 113, 478, 60, 12),
  block('Mr Sami Mansour', 113, 493, 85, 12),
  block('Elaboré par:', 113, 509, 57, 12),
  block('Lina Ben Ali', 114, 521, 62, 12)
])
assert.deepEqual(graphicTitle, {
  studentName: 'Lina Ben Ali',
  shortTitle: 'CHARTE\nGRAPHIQUE\nde la marque NOVA'
})
const splitStaff = parse([
  block('“ ÉLABORÉ PAR:', 35, 690, 160, 20),
  block('AMIRA BEN SALEM', 60, 725, 200),
  block('ENCADRÉ', 390, 690, 110, 27),
  block('PAR:', 508, 701, 60, 16),
  block('MR SAMI MANSOUR', 380, 730, 180, 18),
  block('“ANNÉE UNIVERSITAIRE', 180, 600, 300, 24),
  block('2025-2026', 230, 638, 170),
  block('JUILLET 2026', 220, 690, 180)
])
assert.deepEqual(
  splitStaff,
  { studentName: 'AMIRA BEN SALEM', year: '2025-2026' },
  'aligned word baselines reconstruct supervision rather than selecting the supervisor'
)
assert.equal(
  parse([
    block('Encadré', 350, 530, 180),
    block('par:', 350, 558, 100),
    block('Sami Mansour', 350, 590, 220)
  ]).studentName,
  undefined,
  'a separate par line still belongs to supervision'
)
assert.deepEqual(
  parse([
    block('Dédicaces', 210, 100, 230, 30),
    block('À mes très chers parents et à ma famille', 90, 200, 450, 20)
  ]),
  {}
)
assert.deepEqual(
  parse([
    block('Là où la ville rencontre la mer', 100, 430, 420, 25),
    block('un espace de transition et de mémoire', 110, 470, 400, 25)
  ]),
  {},
  'back-cover quotation is not a research title'
)
assert.equal(
  parse([
    block('Présenté par:', 30, 450),
    block('ADEL ZOUA', 30, 490, 180, 21),
    block('J', 210.04, 490, 10.5, 21)
  ]).studentName,
  'ADEL ZOUAJ',
  'near-touching PDF glyph runs do not insert a space inside a surname'
)
assert.equal(
  parse([
    block('Présenté par:', 30, 450),
    block('ADEL ZOUA', 30, 490, 180, 21),
    block('J', 218, 490, 10.5, 21)
  ]).studentName,
  'ADEL ZOUA J',
  'a genuine printed space before an initial is retained'
)
assert.ok(
  crops[0].top > 618 && crops[0].top + crops[0].height <= 810,
  'the crop excludes role labels and academic-year footer'
)
assert.equal(
  parse([block('Submitted by: Dr. Amira Ben Salah', 50, 520, 480)]).studentName,
  'Dr. Amira Ben Salah'
)
assert.equal(
  parse([block('Supervised by: Dr. Amira Ben Salah', 50, 520, 480)]).studentName,
  undefined
)
assert.equal(parse([block('Student Name: Lina Ben Ali', 50, 520, 480)]).studentName, 'Lina Ben Ali')
assert.equal(
  parse([block('by', 250, 510, 40), block('Lina Ben Ali', 180, 550, 230)]).studentName,
  'Lina Ben Ali'
)
assert.equal(
  parse([block('By design and simulation', 50, 330, 480)]).studentName,
  undefined,
  'a title beginning with By is not an author label'
)
assert.equal(
  parse([
    block('إعداد الطالبتان:', 380, 530, 170),
    block('مريم بن علي', 380, 570, 170),
    block('آمنة عبد الله', 380, 610, 170)
  ]).studentName,
  'مريم بن علي / آمنة عبد الله'
)

const jury = parse([
  block('Présenté par:', 70, 490),
  block('Lina Ben Ali', 70, 525),
  block('Jury', 70, 570),
  block('Sami Mansour', 70, 610),
  block('Président', 380, 610, 160),
  block('Année universitaire: 2025-2026', 70, 750, 450)
])
assert.equal(jury.studentName, 'Lina Ben Ali')
assert.equal(
  parse([
    block('Students:', 50, 490),
    block('Student Name', 50, 530),
    block('Title:', 200, 300),
    block('........', 180, 350)
  ]).studentName,
  undefined
)
assert.equal(parse([block('Academic year: 2024-2025 / 2025-2026', 50, 750, 500)]).year, undefined)
assert.equal(
  parse([block('السنة الجامعية: ١٤٤٥-١٤٤٦ هـ / ٢٠٢٤-٢٠٢٥ م', 40, 750, 520)]).year,
  '2024-2025'
)
assert.equal(
  parse([block('Année universitaire:', 140, 700, 300), block('2024 / 2025', 200, 740, 200)]).year,
  '2024-2025'
)
assert.equal(foldCoverText('إعـداد الطَّالب ۲۰۲۵'), 'اعداد الطالب 2025')

// Text-layer words fragmented into separate PDF runs keep the label/value together.
assert.equal(
  parse([
    block('Réalisé', 40, 520, 62),
    block('par:', 108, 520, 30),
    block('Amira Ben Salah', 145, 520, 180)
  ]).studentName,
  'Amira Ben Salah'
)

// Unknown fields do not replace user edits; late results and formatting changes are independent.
const defaults = {
  studentName: 'Student Name',
  shortTitle: 'Graduation Project Title',
  year: '2025-2026'
}
const detected = {
  studentName: 'Amira Ben Salah',
  shortTitle: 'Gestion des documents',
  year: '2024-2025'
}
assert.deepEqual(
  applyDetectedSpineText(defaults, defaults, detected, {}, defaults, new Set()),
  detected
)
const manual = { ...defaults, shortTitle: 'My chosen short title' }
assert.equal(
  applyDetectedSpineText(manual, defaults, detected, {}, defaults, new Set()).shortTitle,
  manual.shortTitle
)
assert.equal(
  applyDetectedSpineText(defaults, defaults, detected, {}, defaults, new Set(['year'])).year,
  defaults.year
)
assert.equal(
  applyDetectedSpineText(
    detected,
    detected,
    { studentName: 'Lina Ben Ali' },
    detected,
    defaults,
    new Set()
  ).studentName,
  'Lina Ben Ali'
)
assert.deepEqual(
  applyDetectedSpineText(defaults, defaults, {}, {}, defaults, new Set()),
  { studentName: '', shortTitle: '', year: '' },
  'uncertain covers never keep invented default information'
)
assert.equal(
  applyDetectedSpineText(manual, manual, {}, {}, defaults, new Set(), true).shortTitle,
  manual.shortTitle,
  'retry does not erase manual text when the title is unresolved'
)
console.log('Multilingual spine detection and manual-edit protection tests passed.')

const source: HardcoverPdfSource = {
  fileName: 'cover.pdf',
  pageCount: 2,
  frontPageNumber: 1,
  backCoverEnabled: false,
  fitMode: 'fit',
  bytes: new Uint8Array([1, 2, 3])
}
const key = getSpineDetectionSource(source)!.key
assert.equal(
  getSpineDetectionSource({ ...source, fitMode: 'fill', thumbnailDataUrl: 'preview' })!.key,
  key,
  'placement and thumbnail updates do not restart detection'
)
assert.notEqual(
  getSpineDetectionSource({ ...source, frontPageNumber: 2 })!.key,
  key,
  'a different front page invalidates an in-flight result'
)
assert.notEqual(
  getSpineDetectionSource({ ...source, bytes: source.bytes!.slice() })!.key,
  key,
  'same filename is not the same runtime source'
)
assert.equal(
  getSpineDetectionSource({ ...source, bytes: undefined }),
  undefined,
  'saved PDF descriptors cannot pretend source bytes are still loaded'
)
