import { useEffect, useState } from 'react'

export function ProjectPreview({
  thumbnail,
  title
}: {
  thumbnail?: string
  title: string
}): JSX.Element {
  const [failed, setFailed] = useState(false)
  const localImage =
    typeof thumbnail === 'string' && /^(data:image\/|blob:)/i.test(thumbnail) ? thumbnail : null
  useEffect(() => setFailed(false), [thumbnail])
  return (
    <div className="dashboard-project-preview">
      {localImage && !failed ? (
        <img
          src={localImage}
          alt={`Artwork preview for ${title}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="dashboard-document-illustration"
          aria-label="Document illustration; project thumbnail unavailable"
          role="img"
        >
          <span className="dashboard-paper-back" />
          <span className="dashboard-paper-middle" />
          <div className="dashboard-paper-front">
            <span className="dashboard-paper-caption">PRINT</span>
            <span className="dashboard-paper-line" />
            <span className="dashboard-paper-line" />
            <span className="dashboard-paper-line short" />
            <span className="dashboard-paper-layout">
              <i />
              <i />
            </span>
            <span className="dashboard-paper-corner" />
          </div>
        </div>
      )}
    </div>
  )
}
