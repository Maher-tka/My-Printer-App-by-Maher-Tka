param([string[]]$Printer)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
# Read capabilities only. No vendor UI, default changes or hardware print jobs.
$names=if($Printer){$Printer}else{[Drawing.Printing.PrinterSettings]::InstalledPrinters}
$report=@(foreach($name in $names){
  $settings=[Drawing.Printing.PrinterSettings]::new()
  $settings.PrinterName=$name
  if(!$settings.IsValid){[PSCustomObject]@{printer=$name;valid=$false};continue}
  $legacy=$settings.SupportsColor
  $corrected=[FastPrintDriver]::SupportsColor($settings)
  $papers=@($settings.PaperSizes | Where-Object {$_.Kind.ToString() -in @('A4','A3')} | ForEach-Object {$_.Kind.ToString()} | Sort-Object -Unique)
  [PSCustomObject]@{printer=$name;valid=$true;legacySupportsColor=$legacy;supportsColor=$corrected;papers=$papers;polaroidAvailable=($corrected -and $papers -contains 'A4')}
})
ConvertTo-Json -InputObject $report -Depth 4
