import { ComingSoonToolPage } from '@/tools/shared/ComingSoonToolPage'
import type { AppRoute } from '@/types/navigation'

interface HardcoverCoverPageProps {
  onNavigate: (route: AppRoute) => void
}

export function HardcoverCoverPage({
  onNavigate
}: HardcoverCoverPageProps): JSX.Element {
  return (
    <ComingSoonToolPage
      title="Hardcover Binding Cover Sheet"
      description="Generate graduation or mémoire cover sheets with spine and layout guides."
      onNavigate={onNavigate}
    />
  )
}
