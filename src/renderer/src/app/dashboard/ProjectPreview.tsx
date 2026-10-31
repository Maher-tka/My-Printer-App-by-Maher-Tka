import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { useLanguage } from '@/i18n/useLanguage'

export function ProjectPreview({
  thumbnail,
  title
}: {
  thumbnail?: string
  title: string
}): JSX.Element {
  const { t } = useLanguage()
  const [failed, setFailed] = useState(false)
  const localImage =
    typeof thumbnail === 'string' && /^(data:image\/|blob:)/i.test(thumbnail) ? thumbnail : null
  useEffect(() => setFailed(false), [thumbnail])
  return (
    <div className="dashboard-project-preview">
      {localImage && !failed ? (
        <img src={localImage} alt={title} onError={() => setFailed(true)} />
      ) : (
        <div className="dashboard-preview-empty">
          <FileText aria-hidden="true" />
          <span>{t('Preview unavailable')}</span>
        </div>
      )}
    </div>
  )
}
