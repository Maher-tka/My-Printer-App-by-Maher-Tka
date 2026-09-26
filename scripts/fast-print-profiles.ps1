# Shared by setup, menu generation, and printing. Dot-source; no UI on import.
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Security
if (!('FastPrintDriver' -as [type])) {
  Add-Type -Path (Join-Path $PSScriptRoot 'FastPrintDriver.cs') -ReferencedAssemblies System.Drawing,System.Security
}

function Get-FastPrintProfileDirectory {
  return Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MaherTka\FastPrint\profiles'
}
function Get-FastPrintProfilePath([string]$Id, [string]$Directory = (Get-FastPrintProfileDirectory)) {
  if ($Id -notmatch '^[a-f0-9]{32}$') { throw 'Invalid printer preset ID.' }
  return Join-Path $Directory ($Id + '.json')
}
function Read-FastPrintProfile([string]$Id, [string]$Directory = (Get-FastPrintProfileDirectory)) {
  $path = Get-FastPrintProfilePath $Id $Directory
  if (!(Test-Path -LiteralPath $path)) { throw 'This saved preset was removed. Refresh the printer list.' }
  $profile = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($profile.version -ne 1 -or $profile.id -ne $Id -or !$profile.name -or !$profile.printer -or $profile.paper -notin @('A4','A3') -or $profile.color -isnot [bool] -or $profile.landscape -isnot [bool]) {
    throw 'This saved printer preset is invalid. Capture it again in Manage printer presets.'
  }
  return $profile
}
function Get-FastPrintProfiles([string]$Directory = (Get-FastPrintProfileDirectory)) {
  if (!(Test-Path -LiteralPath $Directory)) { return }
  foreach ($file in Get-ChildItem -LiteralPath $Directory -Filter '*.json' -File) {
    try { Read-FastPrintProfile $file.BaseName $Directory }
    catch { [Console]::Error.WriteLine("Skipped unreadable Fast Print profile: $($file.Name)") }
  }
}
function Get-FastPrintProfileBytes($Profile, [string]$Printer) {
  if ($Profile.printer -cne $Printer) { throw 'This preset belongs to a different printer. Capture one for the selected printer.' }
  if ($Profile.driverFingerprint -cne [FastPrintDriver]::Fingerprint($Printer)) {
    throw 'This printer driver has changed. Open Manage printer presets and capture this preset again before printing.'
  }
  try {
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($Profile.driverSettings), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [FastPrintDriver]::Validate($bytes)
    return ,$bytes
  } catch { throw 'The saved driver settings cannot be read by this Windows account. Capture the preset again.' }
}
function Get-FastPrintProfileSummary([string]$Printer, [byte[]]$Bytes) {
  $document = [System.Drawing.Printing.PrintDocument]::new()
  try {
    $document.PrinterSettings.PrinterName = $Printer
    [FastPrintDriver]::Apply($document, $Bytes)
    $page = $document.DefaultPageSettings
    $paper = $page.PaperSize.Kind.ToString()
    if ($paper -notin @('A4','A3')) { throw 'Choose standard A4 or A3 in the driver before saving this Fast Print preset.' }
    return [PSCustomObject]@{ paper=$paper; color=$page.Color; landscape=$page.Landscape; tray=$page.PaperSource.SourceName; trayId=$page.PaperSource.RawKind; duplex=$document.PrinterSettings.Duplex.ToString() }
  } finally { $document.Dispose() }
}
function Save-FastPrintProfile([string]$Name, [string]$Printer, [byte[]]$Bytes, [string]$Id = '', [string]$Notes = '', [string]$Directory = (Get-FastPrintProfileDirectory)) {
  $Name = $Name.Trim()
  if (!$Name -or $Name.Length -gt 100) { throw 'Give this preset a name of 1 to 100 characters.' }
  if ($Notes.Length -gt 1000) { throw 'Keep the stock notes under 1,000 characters.' }
  if (!$Id) { $Id = [Guid]::NewGuid().ToString('N') }
  $path = Get-FastPrintProfilePath $Id $Directory
  $summary = Get-FastPrintProfileSummary $Printer $Bytes
  $protected = [Security.Cryptography.ProtectedData]::Protect($Bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $profile = [ordered]@{
    version=1; id=$Id; name=$Name; printer=$Printer; notes=$Notes
    paper=$summary.paper; color=$summary.color; landscape=$summary.landscape
    tray=$summary.tray; trayId=$summary.trayId; duplex=$summary.duplex
    driverFingerprint=[FastPrintDriver]::Fingerprint($Printer)
    driverSettings=[Convert]::ToBase64String($protected)
    savedAt=[DateTime]::UtcNow.ToString('o')
  }
  New-Item -ItemType Directory -Path $Directory -Force | Out-Null
  $temporary = $path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
  try {
    [IO.File]::WriteAllText($temporary, ($profile | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath $path) { [IO.File]::Replace($temporary, $path, [NullString]::Value) }
    else { [IO.File]::Move($temporary, $path) }
  } finally { if (Test-Path -LiteralPath $temporary) { [IO.File]::Delete($temporary) } }
  return [PSCustomObject]$profile
}
