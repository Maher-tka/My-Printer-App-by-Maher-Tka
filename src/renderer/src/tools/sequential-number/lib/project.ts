import {
  PRINTER_PROJECT_SCHEMA,
  PRINTER_PROJECT_VERSION,
  type PrinterProjectFile,
  type ProjectMetadata
} from '@/types/projects'
import { isSequentialProject } from '../../../../../shared/sequential-validation'
import type { SequentialProject } from '../types'

export function validateSequentialProject(value: unknown): value is SequentialProject {
  return isSequentialProject(value)
}

export function createSequentialProjectFile(
  project: SequentialProject,
  metadata?: ProjectMetadata | null
): PrinterProjectFile<SequentialProject> {
  const now = new Date().toISOString()
  return {
    schema: PRINTER_PROJECT_SCHEMA,
    version: PRINTER_PROJECT_VERSION,
    metadata: {
      id: metadata?.id ?? crypto.randomUUID(),
      createdAt: metadata?.createdAt ?? now,
      updatedAt: now,
      jobName: project.name.trim() || 'Sequential Number',
      tool: 'sequential-number',
      toolLabel: 'Sequential Number',
      sourceCount: Number(Boolean(project.front)) + Number(Boolean(project.back)),
      itemCount: project.settings.quantity,
      summary: `${project.settings.quantity} numbered items · ${project.settings.order === 'stack' ? 'Cut & stack' : 'Across sheet'} · ${project.settings.backMode === 'none' ? 'Front only' : 'Front and back'}`
    },
    payload: project
  }
}
