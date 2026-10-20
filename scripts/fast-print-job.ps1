param([Parameter(Mandatory=$true)][string]$Manifest, [switch]$ValidateOnly, [string]$ProofPath, [string]$ProfileDirectory)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
$job = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$document = [System.Drawing.Printing.PrintDocument]::new()
$isDocument = $job.preset.mode -eq 'document'
try {
  $document.PrinterSettings.PrinterName = $job.preset.printer
  if (!$document.PrinterSettings.IsValid) { throw 'This printer is no longer available. Refresh the Fast Print printer list.' }
  $profile = $null
  if ($job.preset.profileId) {
    . (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
    $profile = if ($ProfileDirectory) { Read-FastPrintProfile $job.preset.profileId $ProfileDirectory } else { Read-FastPrintProfile $job.preset.profileId }
    $bytes = Get-FastPrintProfileBytes $profile $job.preset.printer
    if (!$isDocument -and $profile.paper -ne $job.preset.paper) { throw 'The paper preset has changed. Refresh the printer list.' }
    $normalized = [FastPrintDriver]::Capture($job.preset.printer, [IntPtr]::Zero, $bytes, $false)
    [FastPrintDriver]::Apply($document, $normalized)
  }
  $paper = if ($isDocument -and $profile) { $document.DefaultPageSettings.PaperSize } else { $document.PrinterSettings.PaperSizes | Where-Object { $_.Kind.ToString() -eq $job.preset.paper } | Select-Object -First 1 }
  if (!$paper) { throw "The printer does not support $($job.preset.paper). Choose another paper size." }
  if ($job.preset.color -and !$document.PrinterSettings.SupportsColor) { throw 'This printer does not support color.' }
  if (@($job.sheets).Count -eq 0) { throw 'The document has no printable sheets.' }
  foreach ($sheet in $job.sheets) {
    if (!(Test-Path -LiteralPath $sheet -PathType Leaf)) { throw 'A prepared print sheet is missing.' }
  }
  $document.DocumentName = $job.name
  if ($job.copies) { if ($job.copies -lt 1 -or $job.copies -gt 999) { throw 'Invalid copy count.' }; $document.PrinterSettings.Copies = [int]$job.copies }
  elseif (!$profile) { $document.PrinterSettings.Copies = 1 }
  $document.PrinterSettings.Collate = $true
  if (!$profile -and $document.PrinterSettings.CanDuplex) { $document.PrinterSettings.Duplex = [System.Drawing.Printing.Duplex]::Simplex }
  $isId = $job.preset.mode -eq 'id-card'
  $isPolaroid = $job.preset.mode -in @('polaroid-8','polaroid-9')
  # PDF/XPS drivers can normalize dmColor back to color; the compositor already
  # rendered these non-document-mode sheets as grayscale. Hardware queues must
  # still honor their captured color mode.
  $virtualGrayscale = !$isDocument -and !$job.preset.color -and $job.preset.printer -in @('Microsoft Print to PDF','Microsoft XPS Document Writer')
  if ($isPolaroid -and $document.PrinterSettings.CanDuplex) { $document.PrinterSettings.Duplex = [Drawing.Printing.Duplex]::Simplex }
  if ($isId) {
    if (@($job.sheets).Count -ne 2 -or $job.preset.pagesPerSheet -ne 1) { throw 'An ID job must contain exactly two sides.' }
    if ($job.preset.duplex -and !$document.PrinterSettings.CanDuplex) { throw 'This printer does not support automatic duplex. Choose manual duplex.' }
    if ($document.PrinterSettings.CanDuplex) {
      $document.PrinterSettings.Duplex = if ($job.preset.duplex) { [Drawing.Printing.Duplex]::Vertical } else { [Drawing.Printing.Duplex]::Simplex }
    }
  }
  $document.DefaultPageSettings.PaperSize = $paper
  $document.DefaultPageSettings.Color = [bool]$job.preset.color
  $landscape = ($job.preset.pagesPerSheet -in @(2,6,8) -or [bool]$job.preset.landscape -or ($profile -and $profile.landscape))
  if ($isPolaroid) { $landscape = $job.preset.mode -eq 'polaroid-8' }
  if ($isDocument) {
    if (!$profile -or @($job.sheetSizes).Count -ne @($job.sheets).Count) { throw 'A saved driver preset and physical page sizes are required.' }
    foreach ($size in $job.sheetSizes) {
      $actual=@([double]$size.widthMm,[double]$size.heightMm) | Sort-Object
      $expected=@(($paper.Width*0.254),($paper.Height*0.254)) | Sort-Object
      if ([Math]::Abs($actual[0]-$expected[0]) -gt 1 -or [Math]::Abs($actual[1]-$expected[1]) -gt 1) { throw 'The PDF page size does not match the saved driver preset.' }
    }
    $landscape = (($job.sheetSizes[0].widthMm -gt $job.sheetSizes[0].heightMm) -ne ($paper.Width -gt $paper.Height))
  }
  $document.DefaultPageSettings.Landscape = $landscape
  $document.DefaultPageSettings.Margins = [System.Drawing.Printing.Margins]::new(20,20,20,20)
  if ($profile) {
    # Ask the owning driver to merge the per-job color/orientation changes into
    # its private settings, while retaining the captured stock, tray, and finishing.
    $updated = [FastPrintDriver]::Capture($job.preset.printer, [IntPtr]::Zero, [FastPrintDriver]::FromDocument($document), $false)
    [FastPrintDriver]::Apply($document, $updated)
    if ((!$isDocument -and $document.DefaultPageSettings.PaperSize.Kind.ToString() -ne $job.preset.paper) -or
        ($document.DefaultPageSettings.Color -ne [bool]$job.preset.color -and !$virtualGrayscale) -or
        $document.DefaultPageSettings.Landscape -ne $landscape -or
        $document.DefaultPageSettings.PaperSource.RawKind -ne $profile.trayId) {
      throw 'The driver could not keep the selected paper, color, orientation, or tray. Reconfigure this preset before printing.'
    }
  }
  if ($isId -and $document.PrinterSettings.CanDuplex -and
      $document.PrinterSettings.Duplex -ne $(if ($job.preset.duplex) { [Drawing.Printing.Duplex]::Vertical } else { [Drawing.Printing.Duplex]::Simplex })) {
    throw 'The driver could not keep the selected duplex mode. Reconfigure this preset before printing.'
  }
  if ($isPolaroid -and $document.PrinterSettings.CanDuplex -and $document.PrinterSettings.Duplex -ne [Drawing.Printing.Duplex]::Simplex) {
    throw 'The driver could not keep single-sided Polaroid output. Reconfigure this preset before printing.'
  }
  $document.PrintController = [System.Drawing.Printing.StandardPrintController]::new()
  if ($ValidateOnly) {
    @{ printer=$document.PrinterSettings.PrinterName; paper=$document.DefaultPageSettings.PaperSize.Kind.ToString(); color=$document.DefaultPageSettings.Color; outputColor=[bool]$job.preset.color; rasterGrayscale=(!$isDocument -and !$job.preset.color); landscape=$document.DefaultPageSettings.Landscape; sheets=@($job.sheets).Count; profileId=$job.preset.profileId; tray=$document.DefaultPageSettings.PaperSource.SourceName; duplex=$document.PrinterSettings.Duplex.ToString(); copies=$document.PrinterSettings.Copies; sheetSizes=$job.sheetSizes } | ConvertTo-Json -Depth 5 -Compress
    exit 0
  }
  $script:sheetIndex = 0
  if ($isDocument) {
    $document.add_QueryPageSettings({ param($sender,$eventArgs)
      $size=$job.sheetSizes[$script:sheetIndex]
      $eventArgs.PageSettings.Landscape=(($size.widthMm -gt $size.heightMm) -ne ($paper.Width -gt $paper.Height))
    })
  }
  # Virtual document printers keep both pages together. Physical simplex devices
  # pause between the two sides so the operator can reinsert the same sheet.
  $manualIdDuplex = $isId -and !$job.preset.duplex -and !$ProofPath -and
    $job.preset.printer -notmatch 'PDF|XPS'
  $document.add_PrintPage({
    param($sender, $eventArgs)
    $image = [System.Drawing.Image]::FromFile($job.sheets[$script:sheetIndex])
    try {
      if ($isDocument) {
        $size=$job.sheetSizes[$script:sheetIndex]
        $eventArgs.Graphics.DrawImage($image,[single](-$eventArgs.PageSettings.HardMarginX),[single](-$eventArgs.PageSettings.HardMarginY),[single]($size.widthMm*100/25.4),[single]($size.heightMm*100/25.4))
      } elseif ($isId -or $isPolaroid) {
        # ID and Polaroid rasters already include full-page physical placement.
        # Fitting to margins would shrink the measured artwork.
        $paperWidthMm = if ($job.preset.paper -eq 'A3') { 297 } else { 210 }
        $paperHeightMm = if ($job.preset.paper -eq 'A3') { 420 } else { 297 }
        if ($eventArgs.PageSettings.Landscape) { $swap = $paperWidthMm; $paperWidthMm = $paperHeightMm; $paperHeightMm = $swap }
        $eventArgs.Graphics.DrawImage($image, [single](-$eventArgs.PageSettings.HardMarginX), [single](-$eventArgs.PageSettings.HardMarginY), [single]($paperWidthMm*100/25.4), [single]($paperHeightMm*100/25.4))
      } else {
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
      }
    } finally { $image.Dispose() }
    $script:sheetIndex++
    $eventArgs.HasMorePages = !$manualIdDuplex -and $script:sheetIndex -lt @($job.sheets).Count
  })
  if ($ProofPath) {
    if ($job.preset.printer -ne 'Microsoft Print to PDF') { throw 'Proof output is only supported by Microsoft Print to PDF.' }
    if (![IO.Path]::IsPathRooted($ProofPath) -or [IO.File]::Exists($ProofPath)) { throw 'Choose a new absolute proof output path.' }
    $document.PrinterSettings.PrintToFile = $true
    $document.PrinterSettings.PrintFileName = $ProofPath
  }
  $document.Print()
  if ($manualIdDuplex) {
    Add-Type -AssemblyName System.Windows.Forms
    $promptMessage = 'Wait for the front side to finish printing. Reinsert the same sheet using your printer''s manual-duplex feed direction, then click OK to print the back. Cancel leaves the back unprinted.'
    $promptTitle = 'Fast Print - print the back'
    $promptOptions = [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly
    if ($job.manualDuplexPrompt) {
      $promptMessage = [string]$job.manualDuplexPrompt.message
      $promptTitle = [string]$job.manualDuplexPrompt.title
      if ($job.manualDuplexPrompt.rtl) { $promptOptions = $promptOptions -bor [System.Windows.Forms.MessageBoxOptions]::RtlReading -bor [System.Windows.Forms.MessageBoxOptions]::RightAlign }
    }
    $answer = [System.Windows.Forms.MessageBox]::Show(
      $promptMessage,
      $promptTitle,
      [System.Windows.Forms.MessageBoxButtons]::OKCancel,
      [System.Windows.Forms.MessageBoxIcon]::Information,
      [System.Windows.Forms.MessageBoxDefaultButton]::Button1,
      [System.Windows.Forms.MessageBoxOptions]$promptOptions)
    if ($answer -ne [System.Windows.Forms.DialogResult]::OK) {
      Write-Output 'Front submitted; back canceled.'
      exit 0
    }
    $document.Print()
  }
  Write-Output 'Job submitted to the Windows print queue.'
} finally { $document.Dispose() }
