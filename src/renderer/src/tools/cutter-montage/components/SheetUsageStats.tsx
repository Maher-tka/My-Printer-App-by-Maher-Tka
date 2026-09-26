import { Ruler } from 'lucide-react'
import type { CutterProject } from '../types'
import { getSheetUsageStats } from '../lib/sheetUsage'

export function SheetUsageStats({ project }: { project: CutterProject }): JSX.Element {
  const stats = getSheetUsageStats(project)
  const topDuplicates = stats.duplicateCountByDesign.slice(0, 3)

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Sheet Usage</h3>
        <Ruler className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {stats.sheetCount === 0
          ? 'No production sheets yet.'
          : `${stats.sheetCount} sheet${stats.sheetCount === 1 ? '' : 's'} · clean width max 96 cm · ${project.sheet.heightCm} cm packing length · ${stats.usedHeightCm.toFixed(1)} cm material used · ${stats.placedCount} copies`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
        <span className="rounded bg-muted p-2">
          <b className="block text-base">{stats.usedAreaPercent.toFixed(1)}%</b>sheet area used
        </span>
        <span className="rounded bg-muted p-2">
          <b className="block text-base">{stats.estimatedMaterialUsedMeters.toFixed(2)}</b>m used
        </span>
        <span className="rounded bg-muted p-2">
          <b className="block text-base">{stats.requestedCount}</b>requested
        </span>
        <span className="rounded bg-muted p-2">
          <b className="block text-base">{stats.unplacedCount}</b>unplaced
        </span>
      </div>
      {topDuplicates.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {topDuplicates.map((item) => (
            <div key={item.displayName} className="truncate">
              {item.displayName}: {item.count}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
