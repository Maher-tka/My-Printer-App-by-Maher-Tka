$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
function Assert([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }
function Assert-Fails([scriptblock]$Action, [string]$Pattern) {
  $failed=$false
  try { & $Action | Out-Null } catch { $failed=$_.Exception.Message -match $Pattern }
  Assert $failed "Expected failure matching: $Pattern"
}
$printer='Microsoft Print to PDF'
$folder=Join-Path (Split-Path $PSScriptRoot -Parent) ('tmp\fast-print-profile-test-' + [Guid]::NewGuid().ToString('N'))
$document=[Drawing.Printing.PrintDocument]::new()
try {
  $original=[FastPrintDriver]::Capture($printer,[IntPtr]::Zero,$null,$false)
  $document.PrinterSettings.PrinterName=$printer
  [FastPrintDriver]::Apply($document,$original)
  $document.DefaultPageSettings.PaperSize=($document.PrinterSettings.PaperSizes | Where-Object Kind -eq A4 | Select-Object -First 1)
  $document.DefaultPageSettings.Color=$true
  $document.DefaultPageSettings.Landscape=$true
  $captured=[FastPrintDriver]::Capture($printer,[IntPtr]::Zero,[FastPrintDriver]::FromDocument($document),$false)
  $profile=Save-FastPrintProfile -Name 'Test A4 stock & tray' -Printer $printer -Bytes $captured -Directory $folder -DefaultBypassFaceUp
  Assert ($profile.paper -eq 'A4' -and $profile.landscape -eq $true) 'Captured paper/orientation lost.'
  $loaded=Read-FastPrintProfile $profile.id $folder
  Assert ($loaded.defaultBypassFaceUp -eq $true) 'Default bypass profile flag lost.'
  $restored=Get-FastPrintProfileBytes $loaded $printer
  Assert ([Convert]::ToBase64String($restored) -ceq [Convert]::ToBase64String($captured)) 'Full private driver buffer did not survive encrypted storage.'
  Assert ($profile.driverSettings -cne [Convert]::ToBase64String($captured)) 'Driver settings were stored unprotected.'
  Assert (@(Get-FastPrintProfiles $folder).Count -eq 1) 'Saved profile not listed.'
  $updated=Save-FastPrintProfile -Name 'Renamed stock' -Printer $printer -Bytes $captured -Id $profile.id -Directory $folder
  Assert ((Read-FastPrintProfile $profile.id $folder).name -eq 'Renamed stock') 'Atomic profile update failed.'
  Assert-Fails { Get-FastPrintProfilePath '..\outside' $folder } 'Invalid'
  Assert-Fails { Get-FastPrintProfileBytes $loaded 'Another printer' } 'different printer'
  $loaded.driverFingerprint='outdated-driver'
  Assert-Fails { Get-FastPrintProfileBytes $loaded $printer } 'driver has changed'
  $loaded=Read-FastPrintProfile $profile.id $folder
  $loaded.driverSettings='not-a-driver-snapshot'
  Assert-Fails { Get-FastPrintProfileBytes $loaded $printer } 'cannot be read'
  Assert-Fails { [FastPrintDriver]::Validate([byte[]]@(1,2,3)) } 'Invalid'
  $current=[FastPrintDriver]::Capture($printer,[IntPtr]::Zero,$null,$false)
  # Compare public default fields (some vendor private data can include timestamps).
  Assert ([Convert]::ToBase64String($original[76..101]) -ceq [Convert]::ToBase64String($current[76..101])) 'Printer defaults were changed by profile capture.'
  $a5=$document.PrinterSettings.PaperSizes | Where-Object Kind -eq A5 | Select-Object -First 1
  if ($a5) {
    $document.DefaultPageSettings.PaperSize=$a5
    $document.PrinterSettings.Copies=2
    $other=Save-FastPrintProfile -Name 'App A5 paper' -Printer $printer -Bytes ([FastPrintDriver]::FromDocument($document)) -Directory $folder
    Assert ($other.paper -eq 'A5' -and $other.paperWidthMm -gt 0 -and $other.paperHeightMm -gt 0 -and $other.copies -eq 2) 'App-only paper size or driver copies were not retained.'
  }
  Write-Output "Driver profile tests passed: full-buffer round trip, encrypted storage, atomic update, driver mismatch, printer mismatch, corrupt data, defaults unchanged, app paper sizes/copies."
} finally {
  $document.Dispose()
  # Remove only files created by this test; no recursive directory deletion.
  if (Test-Path -LiteralPath $folder) {
    foreach ($file in Get-ChildItem -LiteralPath $folder -File) { [IO.File]::Delete($file.FullName) }
    [IO.Directory]::Delete($folder)
  }
}
