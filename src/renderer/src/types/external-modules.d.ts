declare module 'arabic-persian-reshaper' {
  interface TextShaper {
    convertArabic(value: string): string
  }

  const reshaper: {
    ArabicShaper: TextShaper
    PersianShaper: TextShaper
  }

  export const ArabicShaper: TextShaper
  export const PersianShaper: TextShaper
  export default reshaper
}

declare module 'bidi-js' {
  export interface BidiEmbeddingLevels {
    levels: Uint8Array
    paragraphs: Array<{ start: number; end: number; level: number }>
  }

  export interface BidiProcessor {
    getEmbeddingLevels(
      text: string,
      explicitDirection?: 'ltr' | 'rtl'
    ): BidiEmbeddingLevels
    getReorderSegments(
      text: string,
      embeddingLevels: BidiEmbeddingLevels,
      start?: number,
      end?: number
    ): Array<[number, number]>
    getMirroredCharactersMap(
      text: string,
      embeddingLevels: BidiEmbeddingLevels,
      start?: number,
      end?: number
    ): Map<number, string>
  }

  export default function bidiFactory(): BidiProcessor
}
