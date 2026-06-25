import { CheckCircle2, Clock, FolderOpen, FlaskConical, Play } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { runBookletPreflight } from '@/preflight/bookletPreflight'
import { runSharedCutterPreflight } from '@/preflight/cutterPreflight'
import { runHardcoverPreflight } from '@/preflight/hardcoverPreflight'
import { PreflightSummary } from '@/preflight/preflightUI'
import type { PreflightReport } from '@/preflight/preflightTypes'

const TESTS = [
  'Create 8-page booklet test',
  'Create 32-page booklet test',
  'Create cutter test montage 100 stickers',
  'Create hardcover A4 mémoire test'
]

export default function QualityLabPage(): JSX.Element {
  const [results, setResults] = useState<
    Array<{ label: string; durationMs: number; report?: PreflightReport; path?: string }>
  >([])
  const [folder, setFolder] = useState<string | null>(null)
  const runFixture = async (label: string): Promise<void> => {
    const started = performance.now()
    const fixture = await window.printerApp?.runtime.createQualityFixtures(label)
    if (fixture?.folderPath) setFolder(fixture.folderPath)
    setResults((current) => [
      { label, durationMs: Math.round(performance.now() - started), path: fixture?.files?.[0] },
      ...current
    ])
  }
  const runAllPreflight = (): void => {
    const started = performance.now()
    const reports = [
      runBookletPreflight({
        pageCount: 32,
        blankPageCount: 0,
        paperWidthMm: 210,
        paperHeightMm: 297,
        readingDirection: 'ltr'
      }),
      runSharedCutterPreflight({
        sheetWidth: 100,
        sheetHeight: 70,
        placedCount: 100,
        outOfBoundsCount: 0,
        overlapCount: 0,
        missingArtworkCount: 0,
        missingCutlineCount: 0,
        hiddenCutlineCount: 0,
        missingSourceCount: 0,
        exportMode: 'print-cut'
      }),
      runHardcoverPreflight({
        bookWidthMm: 210,
        bookHeightMm: 297,
        spineWidthMm: 18,
        wrapMarginsMm: [15, 15, 15, 15],
        fullWidthMm: 468,
        fullHeightMm: 327,
        title: 'Mémoire',
        studentName: 'Test Student',
        studentNameRequired: true,
        spineTextFits: true,
        textInsideSafeZones: true,
        exportMode: 'print-final'
      })
    ]
    setResults((current) => [
      ...reports.map((report) => ({
        label: `${report.tool} preflight`,
        durationMs: Math.round(performance.now() - started),
        report
      })),
      ...current
    ])
  }
  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="text-primary" />
            Quality Lab
          </CardTitle>
          <CardDescription>
            Development-only synthetic checks. No customer files are used.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {TESTS.map((test) => (
            <Button
              key={test}
              type="button"
              variant="outline"
              onClick={() => void runFixture(test)}
            >
              <Play data-icon="inline-start" />
              {test}
            </Button>
          ))}
          <Button type="button" onClick={runAllPreflight}>
            <CheckCircle2 data-icon="inline-start" />
            Run preflight all tools
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void runFixture('export-test-files')}
          >
            <FolderOpen data-icon="inline-start" />
            Export test files to temp folder
          </Button>
          {folder && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void window.printerApp?.runtime.openPath(folder)}
            >
              <FolderOpen data-icon="inline-start" />
              Open temp folder
            </Button>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {results.map((result, index) => (
          <div key={`${result.label}-${index}`}>
            {result.report ? (
              <PreflightSummary report={result.report} />
            ) : (
              <Card>
                <CardContent className="p-4">
                  <p className="font-semibold">{result.label}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4" />
                    {result.durationMs} ms · {result.path ?? 'fixture complete'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
