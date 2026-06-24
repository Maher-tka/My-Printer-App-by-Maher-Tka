import type { CoverTemplate } from '../types'

export const DEFAULT_COVER_TEMPLATES: CoverTemplate[] = [
  template(
    'classic-blue',
    'Classic University Blue',
    '#123b69',
    '#3b82a0',
    '#f8fafc',
    '#dbeafe',
    'frame'
  ),
  template(
    'luxury-gold-black',
    'Luxury Gold Black',
    '#111111',
    '#b88a2b',
    '#f6e7b0',
    '#d6c58c',
    'foil'
  ),
  template('minimal-white', 'Minimal White', '#f8fafc', '#cbd5e1', '#172033', '#5b6475', 'minimal'),
  template(
    'burgundy-academic',
    'Burgundy Academic',
    '#671c2f',
    '#d2a85e',
    '#fff8ed',
    '#f4d9bd',
    'line'
  ),
  template(
    'dark-green-prestige',
    'Dark Green Prestige',
    '#123f36',
    '#c6a15b',
    '#f8faf3',
    '#d6e2d4',
    'frame'
  ),
  template(
    'tunisian-clean',
    'Tunisian University Clean',
    '#f7f7f4',
    '#c62432',
    '#222222',
    '#686868',
    'line'
  ),
  template(
    'leather-preview',
    'Leather Style Preview',
    '#4a2b1d',
    '#8d5a3b',
    '#f7e7c1',
    '#d8bc91',
    'leather'
  ),
  template(
    'gold-foil-preview',
    'Gold Foil Style Preview',
    '#172033',
    '#d4af37',
    '#f8ebbd',
    '#d7c78e',
    'foil'
  )
]

export function getCoverTemplate(templateId: string): CoverTemplate {
  return (
    DEFAULT_COVER_TEMPLATES.find((item) => item.id === templateId) ?? DEFAULT_COVER_TEMPLATES[0]
  )
}

export function duplicateCoverTemplate(source: CoverTemplate, name?: string): CoverTemplate {
  return {
    ...source,
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name?.trim() || `${source.name} Copy`,
    isCustom: true
  }
}

function template(
  id: string,
  name: string,
  background: string,
  accent: string,
  foreground: string,
  mutedForeground: string,
  decorativeStyle: CoverTemplate['decorativeStyle']
): CoverTemplate {
  return {
    id,
    name,
    description: `${name} local cover template`,
    background,
    backgroundAccent: accent,
    foreground,
    mutedForeground,
    fontFamily: 'Arial, sans-serif',
    titleFontFamily: 'Georgia, serif',
    decorativeStyle,
    logoPlacement: 'top',
    safeInsetMm: 8
  }
}
