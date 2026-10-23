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
  if ($profile.version -ne 1 -or $profile.id -ne $Id -or !$profile.name -or !$profile.printer -or $profile.paper -isnot [string] -or !$profile.paper -or $profile.color -isnot [bool] -or $profile.landscape -isnot [bool]) {
    throw 'This saved printer preset is invalid. Capture it again in Manage printer presets.'
  }
  return $profile
}
function Get-FastPrintProfiles([string]$Directory = (Get-FastPrintProfileDirectory)) {
  if (!(Test-Path -LiteralPath $Directory)) { return }
  $orders=$null
  $orderFile=Join-Path (Split-Path -Parent $Directory) 'preset-order.json'
  if (Test-Path -LiteralPath $orderFile) {
    try {
      if ((Get-Item -LiteralPath $orderFile).Length -gt 4MB) { throw 'Invalid saved preset order.' }
      $data=Get-Content -LiteralPath $orderFile -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($data.version -ne 1 -or $data.printers -isnot [pscustomobject] -or @($data.printers.PSObject.Properties).Count -gt 200) { throw 'Invalid saved preset order.' }
      foreach ($property in $data.printers.PSObject.Properties) {
        $ids=@($property.Value)
        if ([string]::IsNullOrWhiteSpace($property.Name) -or $property.Name.Length -gt 512 -or $property.Name -match '[\x00-\x1f\x7f-\x9f]' -or $property.Value -isnot [Array] -or $ids.Count -gt 1000 -or @($ids | Where-Object { $_ -isnot [string] -or $_ -cnotmatch '^[a-f0-9]{32}$' }).Count -gt 0 -or @($ids | Select-Object -Unique).Count -ne $ids.Count) { throw 'Invalid saved preset order.' }
      }
      $orders=$data.printers
    } catch { [Console]::Error.WriteLine('Saved preset order could not be read; using names.'); $orders=$null }
  }
  $profiles=@(
  foreach ($file in Get-ChildItem -LiteralPath $Directory -Filter '*.json' -File) {
    try {
      $profile=Read-FastPrintProfile $file.BaseName $Directory
      $rank=[int]::MaxValue
      if ($orders) {
        $property=$orders.PSObject.Properties | Where-Object { $_.Name -ceq $profile.printer } | Select-Object -First 1
        if ($property) {
          $ids=@($property.Value)
          $index=[Array]::IndexOf($ids,$profile.id)
          if ($index -ge 0) { $rank=$index }
        }
      }
      $profile | Add-Member -NotePropertyName sortOrder -NotePropertyValue $rank -Force
      $profile
    }
    catch { [Console]::Error.WriteLine("Skipped unreadable Fast Print profile: $($file.Name)") }
  }
  )
  $profiles | Sort-Object printer,sortOrder,name,id
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
    if ($page.PaperSize.Width -le 0 -or $page.PaperSize.Height -le 0) { throw 'The driver did not return a valid paper size.' }
    return [PSCustomObject]@{ paper=$paper; color=$page.Color; landscape=$page.Landscape; tray=$page.PaperSource.SourceName; trayId=$page.PaperSource.RawKind; duplex=$document.PrinterSettings.Duplex.ToString(); paperWidthMm=($page.PaperSize.Width*0.254); paperHeightMm=($page.PaperSize.Height*0.254); copies=$document.PrinterSettings.Copies }
  } finally { $document.Dispose() }
}
function Save-FastPrintProfile([string]$Name, [string]$Printer, [byte[]]$Bytes, [string]$Id = '', [string]$Notes = '', [string]$Directory = (Get-FastPrintProfileDirectory), [switch]$DefaultBypassFaceUp) {
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
    paperWidthMm=$summary.paperWidthMm; paperHeightMm=$summary.paperHeightMm; copies=$summary.copies
    defaultBypassFaceUp=[bool]$DefaultBypassFaceUp
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
