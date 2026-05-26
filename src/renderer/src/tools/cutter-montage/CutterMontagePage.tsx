import { ComingSoonToolPage } from '@/tools/shared/ComingSoonToolPage'
import type { AppRoute } from '@/types/navigation'

interface CutterMontagePageProps {
  onNavigate: (route: AppRoute) => void
}

export function CutterMontagePage({
  onNavigate
}: CutterMontagePageProps): JSX.Element {
  return (
    <ComingSoonToolPage
      title="Cutter Layer + Big Sheet Montage"
      description="Prepare print layer and cutline sheets for plotter/cutter with precision and efficiency."
      onNavigate={onNavigate}
    />
  )
}
