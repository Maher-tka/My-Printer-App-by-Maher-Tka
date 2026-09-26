$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
$document=[Drawing.Printing.PrintDocument]::new()
$profile=$null
$metadata=$null
$electron=$null
try {
  $printer='Microsoft Print to PDF'
  $document.PrinterSettings.PrinterName=$printer
  [FastPrintDriver]::Apply($document,[FastPrintDriver]::Capture($printer,[IntPtr]::Zero,$null,$false))
  $document.DefaultPageSettings.PaperSize=($document.PrinterSettings.PaperSizes | Where-Object Kind -eq A4 | Select-Object -First 1)
  $document.DefaultPageSettings.Landscape=$true
  $document.DefaultPageSettings.Color=$true
  $profile=Save-FastPrintProfile -Name '__Temporary driver verification__' -Printer $printer -Bytes ([FastPrintDriver]::FromDocument($document))
  $root=Split-Path $PSScriptRoot -Parent
  $electron=Join-Path $root 'node_modules\electron\dist\electron.exe'
  & (Join-Path $PSScriptRoot 'fast-print-menu.ps1') -Action Install -Executable $electron -AppPath $root
  $menuEntries=@(Get-ChildItem 'HKCU:\Software\Classes\MaherTka.FastPrint' -Recurse | Where-Object { $_.PSChildName -eq 'command' -and $_.Name.Contains($profile.id) })
  if ($menuEntries.Count -ne 6) { throw 'Expected six saved-stock menu commands.' }
  foreach ($entry in $menuEntries) {
    if ($entry.GetValue('') -notmatch '--fast-print ([A-Za-z0-9+/=]+) -- "%1"$') { throw 'Invalid saved preset command.' }
    $settings=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Matches[1])) | ConvertFrom-Json
    if ($settings.profileId -ne $profile.id) { throw 'Menu lost the saved driver preset ID.' }
  }
  $metadata=Join-Path $root 'tmp\fast-print-profile-verification.json'
  [IO.File]::WriteAllText($metadata,($profile | Select-Object id,printer,paper,tray,duplex | ConvertTo-Json),[Text.UTF8Encoding]::new($false))
  & node (Join-Path $PSScriptRoot 'verify-fast-print-profile-worker.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Saved preset worker verification failed.' }
} finally {
  $document.Dispose()
  if ($profile) {
    [IO.File]::Delete((Get-FastPrintProfilePath $profile.id))
    if ($electron) { & (Join-Path $PSScriptRoot 'fast-print-menu.ps1') -Action Install -Executable $electron -AppPath $root }
  }
  if ($metadata -and [IO.File]::Exists($metadata)) { [IO.File]::Delete($metadata) }
}
