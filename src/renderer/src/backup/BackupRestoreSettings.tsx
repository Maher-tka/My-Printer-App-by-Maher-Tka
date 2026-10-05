import { useLanguage } from '@/i18n/useLanguage'
import { ArchiveRestore, Download, FolderOpen, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { applyRestoredShopData, getShopBackupRendererData } from './shopBackup'

export function BackupRestoreSettings(): JSX.Element {
  const { t } = useLanguage()

  const [message, setMessage] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const isAvailable = Boolean(window.printerApp?.runtime.createShopBackup)
  const openBackupFolder = async (): Promise<void> => {
    try {
      const error = await window.printerApp?.runtime.openBackupFolder()
      if (error) setMessage(error)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the backup folder.')
    }
  }

  const createBackup = async (): Promise<void> => {
    if (!window.printerApp?.runtime.createShopBackup) return
    setMessage(null)
    setIsBusy(true)
    try {
      const result = await window.printerApp.runtime.createShopBackup(getShopBackupRendererData())
      if (result.ok) {
        setMessage(
          `Backup saved with ${result.projectCount ?? 0} linked project(s): ${result.filePath}`
        )
      } else if (!result.canceled) {
        setMessage(result.error ?? 'The backup could not be created.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The backup could not be created.')
    } finally {
      setIsBusy(false)
    }
  }

  const restoreBackup = async (): Promise<void> => {
    if (!window.printerApp?.runtime.restoreShopBackup) return
    const confirmed = window.confirm(
      'Restore a shop backup? Current job and customer lists will be replaced. Existing project files will not be overwritten.'
    )
    if (!confirmed) return
    setMessage(null)
    setIsBusy(true)
    try {
      const result = await window.printerApp.runtime.restoreShopBackup()
      if (result.ok) {
        const applied = applyRestoredShopData(result)
        setMessage(
          applied.ok
            ? `Restored ${applied.jobsCount} jobs, ${applied.customersCount} customers, and ${result.projectCount ?? 0} project(s).`
            : `${applied.error ?? 'Shop lists could not be restored.'} ${result.projectCount ?? 0} project file(s) were restored successfully.`
        )
      } else if (!result.canceled) {
        setMessage(result.error ?? 'The backup could not be restored.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The backup could not be restored.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="border-b p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <ArchiveRestore className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t('Backup & restore')}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {isAvailable
              ? 'Daily local backups save jobs, customers, export history, and up to 20 linked projects. Keep a separate copy on another drive for extra protection.'
              : 'Open the desktop app to back up or restore your shop data.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy || !isAvailable}
            onClick={() => void createBackup()}
          >
            {isBusy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download />}
            {t('Back up now')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy || !isAvailable}
            onClick={() => void restoreBackup()}
          >
            <ArchiveRestore />
            {t('Restore')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isBusy || !isAvailable}
            onClick={() => void openBackupFolder()}
          >
            <FolderOpen />
            {t('Backup folder')}
          </Button>
        </div>
      </div>
      {message ? (
        <p
          className="mt-3 break-all rounded-md bg-muted p-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
