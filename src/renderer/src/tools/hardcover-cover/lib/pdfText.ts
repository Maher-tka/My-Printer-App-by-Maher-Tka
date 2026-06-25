import reshaper from 'arabic-persian-reshaper'
import bidiFactory from 'bidi-js'

const RTL_TEXT_PATTERN = /[\u0590-\u08ff]/
const bidi = bidiFactory()

export function preparePdfDisplayText(value: string): string {
  const normalized = value.normalize('NFC')
  if (!RTL_TEXT_PATTERN.test(normalized)) return normalized

  const shaped = reshaper.ArabicShaper.convertArabic(normalized)
  const characters = shaped.split('')
  const embeddingLevels = bidi.getEmbeddingLevels(shaped)
  const mirroredCharacters = bidi.getMirroredCharactersMap(shaped, embeddingLevels)

  for (const [index, character] of mirroredCharacters) {
    characters[index] = character
  }

  for (const [start, end] of bidi.getReorderSegments(shaped, embeddingLevels)) {
    const reversed = characters.slice(start, end + 1).reverse()
    characters.splice(start, reversed.length, ...reversed)
  }

  return characters.join('')
}
