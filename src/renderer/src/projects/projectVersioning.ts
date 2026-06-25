import type { ProjectToolId } from '@/types/projects'

export const CURRENT_PROJECT_VERSION = 1

export interface ProjectMigrationContext {
  tool: ProjectToolId
  fromVersion: number
  toVersion: number
}

export function requiresProjectMigration(version: number): boolean {
  return version < CURRENT_PROJECT_VERSION
}
