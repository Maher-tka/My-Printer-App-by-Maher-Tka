import type { PrinterProjectFile } from '@/types/projects'
import { CURRENT_PROJECT_VERSION } from './projectVersioning'

type ProjectMigration = (project: Record<string, unknown>) => Record<string, unknown>

const migrations = new Map<number, ProjectMigration>()

export function registerProjectMigration(fromVersion: number, migration: ProjectMigration): void {
  migrations.set(fromVersion, migration)
}

export function migrateProjectFile(project: unknown): PrinterProjectFile {
  if (!project || typeof project !== 'object') throw new Error('Project data is not an object.')
  let current = structuredClone(project) as Record<string, unknown>
  let version = Number(current.version)
  if (!Number.isInteger(version) || version < 1)
    throw new Error('Project version is missing or invalid.')
  if (version > CURRENT_PROJECT_VERSION)
    throw new Error('This project was created by a newer app version.')
  while (version < CURRENT_PROJECT_VERSION) {
    const migrate = migrations.get(version)
    if (!migrate) throw new Error(`No migration is available for project version ${version}.`)
    current = migrate(current)
    version += 1
    current.version = version
  }
  return current as unknown as PrinterProjectFile
}
