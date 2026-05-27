import type { RecentJob } from '@/types/jobs'
import type { PrinterTool } from '@/types/tools'

export const printerTools: PrinterTool[] = [
  {
    id: 'booklet-montage',
    route: 'booklet-montage',
    title: 'Booklet Montage',
    shortTitle: 'Booklet Montage',
    description: 'Create booklet imposition from PDF or images',
    status: 'active',
    accent: 'blue'
  },
  {
    id: 'hardcover-cover',
    route: 'hardcover-cover',
    title: 'Hardcover Binding Cover Sheet',
    shortTitle: 'Hardcover Cover Sheet',
    description:
      'Generate graduation or mémoire cover sheets with spine and layout guides',
    status: 'coming-soon',
    accent: 'violet'
  },
  {
    id: 'cutter-montage',
    route: 'cutter-montage',
    title: 'Cutter Layer + Big Sheet Montage',
    shortTitle: 'Cutter Montage',
    description:
      'Prepare print layer and cutline sheets for plotter/cutter with precision and efficiency',
    status: 'mvp',
    accent: 'green'
  }
]

export const recentJobs: RecentJob[] = [
  {
    id: 'job-001',
    jobName: 'Memoire_2025_Volume1.pdf',
    tool: 'Booklet Montage',
    date: 'May 17, 2026',
    status: 'Completed'
  },
  {
    id: 'job-002',
    jobName: 'Graduation_Covers_Batch_03.pdf',
    tool: 'Hardcover Cover Sheet',
    date: 'May 16, 2026',
    status: 'Completed'
  },
  {
    id: 'job-003',
    jobName: 'Catalog_Layout_001.pdf',
    tool: 'Cutter Montage',
    date: 'May 15, 2026',
    status: 'Completed'
  },
  {
    id: 'job-004',
    jobName: 'Thesis_FINAL.pdf',
    tool: 'Booklet Montage',
    date: 'May 14, 2026',
    status: 'In Progress'
  },
  {
    id: 'job-005',
    jobName: 'Business_Cards_Sheet.ai',
    tool: 'Cutter Montage',
    date: 'May 13, 2026',
    status: 'Failed'
  }
]
