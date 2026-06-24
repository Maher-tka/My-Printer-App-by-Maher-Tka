import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty } from '@/components/ui/empty'
import type { AppRoute } from '@/types/navigation'

interface ComingSoonToolPageProps {
  title: string
  description: string
  onNavigate: (route: AppRoute) => void
}

export function ComingSoonToolPage({
  title,
  description,
  onNavigate
}: ComingSoonToolPageProps): JSX.Element {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => onNavigate('dashboard')}
        type="button"
      >
        <ArrowLeft data-icon="inline-start" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty
            icon={LockKeyhole}
            title="Coming Soon"
            description="This printer-shop module is reserved in the app shell. No PDF processing, payment, or online membership logic is connected yet."
          />
        </CardContent>
      </Card>
    </div>
  )
}
