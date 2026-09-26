param([Parameter(Mandatory=$true)][string]$Manifest, [switch]$ValidateOnly, [string]$ProofPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
$job = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$document = [System.Drawing.Printing.PrintDocument]::new()
try {
  $document.PrinterSettings.PrinterName = $job.preset.printer
  if (!$document.PrinterSettings.IsValid) { throw 'This printer is no longer available. Refresh the Fast Print printer list.' }
  $profile = $null
  if ($job.preset.profileId) {
    . (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
    $profile = Read-FastPrintProfile $job.preset.profileId
    $bytes = Get-FastPrintProfileBytes $profile $job.preset.printer
    if ($profile.paper -ne $job.preset.paper) { throw 'The paper preset has changed. Refresh the printer list.' }
    $normalized = [FastPrintDriver]::Capture($job.preset.printer, [IntPtr]::Zero, $bytes, $false)
    [FastPrintDriver]::Apply($document, $normalized)
  }
  $paper = $document.PrinterSettings.PaperSizes | Where-Object { $_.Kind.ToString() -eq $job.preset.paper } | Select-Object -First 1
  if (!$paper) { throw "The printer does not support $($job.preset.paper). Choose another paper size." }
  if ($job.preset.color -and !$document.PrinterSettings.SupportsColor) { throw 'This printer does not support color.' }
  if (@($job.sheets).Count -eq 0) { throw 'The document has no printable sheets.' }
  foreach ($sheet in $job.sheets) {
    if (!(Test-Path -LiteralPath $sheet -PathType Leaf)) { throw 'A prepared print sheet is missing.' }
  }
  $document.DocumentName = $job.name
  $document.PrinterSettings.Copies = 1
  $document.PrinterSettings.Collate = $true
  if (!$profile -and $document.PrinterSettings.CanDuplex) { $document.PrinterSettings.Duplex = [System.Drawing.Printing.Duplex]::Simplex }
  $document.DefaultPageSettings.PaperSize = $paper
  $document.DefaultPageSettings.Color = [bool]$job.preset.color
  $document.DefaultPageSettings.Landscape = ($job.preset.pagesPerSheet -eq 2 -or ($profile -and $profile.landscape))
  $document.DefaultPageSettings.Margins = [System.Drawing.Printing.Margins]::new(20,20,20,20)
  if ($profile) {
    # Ask the owning driver to merge the per-job color/orientation changes into
    # its private settings, while retaining the captured stock, tray, and finishing.
    $updated = [FastPrintDriver]::Capture($job.preset.printer, [IntPtr]::Zero, [FastPrintDriver]::FromDocument($document), $false)
    [FastPrintDriver]::Apply($document, $updated)
    if ($document.DefaultPageSettings.PaperSize.Kind.ToString() -ne $job.preset.paper -or
        $document.DefaultPageSettings.Color -ne [bool]$job.preset.color -or
        $document.DefaultPageSettings.Landscape -ne ($job.preset.pagesPerSheet -eq 2 -or $profile.landscape) -or
        $document.DefaultPageSettings.PaperSource.RawKind -ne $profile.trayId) {
      throw 'The driver could not keep the selected paper, color, orientation, or tray. Reconfigure this preset before printing.'
    }
  }
  $document.PrintController = [System.Drawing.Printing.StandardPrintController]::new()
  if ($ValidateOnly) {
    @{ printer=$document.PrinterSettings.PrinterName; paper=$document.DefaultPageSettings.PaperSize.Kind.ToString(); color=$document.DefaultPageSettings.Color; landscape=$document.DefaultPageSettings.Landscape; sheets=@($job.sheets).Count; profileId=$job.preset.profileId; tray=$document.DefaultPageSettings.PaperSource.SourceName; duplex=$document.PrinterSettings.Duplex.ToString() } | ConvertTo-Json -Compress
    exit 0
  }
  $script:sheetIndex = 0
  $document.add_PrintPage({
    param($sender, $eventArgs)
    $image = [System.Drawing.Image]::FromFile($job.sheets[$script:sheetIndex])
    try {
      # Fit inside both the requested margins and the driver's printable region.
      $printable = $eventArgs.PageSettings.PrintableArea
      $left = [Math]::Max($eventArgs.MarginBounds.Left, $printable.Left)
      $top = [Math]::Max($eventArgs.MarginBounds.Top, $printable.Top)
      $right = [Math]::Min($eventArgs.MarginBounds.Right, $printable.Right)
      $bottom = [Math]::Min($eventArgs.MarginBounds.Bottom, $printable.Bottom)
      $scale = [Math]::Min(($right-$left)/$image.Width, ($bottom-$top)/$image.Height)
      if ($scale -le 0) { throw 'The printer reported an invalid printable area.' }
      $width = $image.Width*$scale
      $height = $image.Height*$scale
      $x = $left + (($right-$left)-$width)/2 - $eventArgs.PageSettings.HardMarginX
      $y = $top + (($bottom-$top)-$height)/2 - $eventArgs.PageSettings.HardMarginY
      $eventArgs.Graphics.DrawImage($image, [single]$x, [single]$y, [single]$width, [single]$height)
    } finally { $image.Dispose() }
    $script:sheetIndex++
    $eventArgs.HasMorePages = $script:sheetIndex -lt @($job.sheets).Count
  })
  if ($ProofPath) {
    if ($job.preset.printer -ne 'Microsoft Print to PDF') { throw 'Proof output is only supported by Microsoft Print to PDF.' }
    if (![IO.Path]::IsPathRooted($ProofPath) -or [IO.File]::Exists($ProofPath)) { throw 'Choose a new absolute proof output path.' }
    $document.PrinterSettings.PrintToFile = $true
    $document.PrinterSettings.PrintFileName = $ProofPath
  }
  $document.Print()
  Write-Output 'Job submitted to the Windows print queue.'
} finally { $document.Dispose() }
