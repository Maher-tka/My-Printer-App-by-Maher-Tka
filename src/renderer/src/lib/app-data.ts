import type { PrinterTool } from '@/types/tools'

export const printerTools: PrinterTool[] = [
  {
    id: 'booklet-montage',
    route: 'booklet-montage',
    title: 'Booklet Montage',
    shortTitle: 'Booklet Montage',
    description: 'Create booklet imposition from PDF or images',
    status: 'active',
    accent: 'blue',
    requiredFeature: 'paid-tools'
  },
  {
    id: 'hardcover-cover',
    route: 'hardcover-cover',
    title: 'Hardcover Binding Cover Sheet',
    shortTitle: 'Hardcover Cover Sheet',
    description: 'Generate graduation or mémoire cover sheets with spine and layout guides',
    status: 'active',
    accent: 'violet',
    requiredFeature: 'paid-tools'
  },
  {
    id: 'cutter-montage',
    route: 'cutter-montage',
    title: 'Cutter Layer + Big Sheet Montage',
    shortTitle: 'Cutter Montage',
    description:
      'Prepare print layer and cutline sheets for plotter/cutter with precision and efficiency',
    status: 'mvp',
    accent: 'green',
    requiredFeature: 'paid-tools'
  }
]
