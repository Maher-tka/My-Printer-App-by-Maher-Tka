param([ValidateSet('List','Capture','Delete')][string]$Action='List',[string]$RequestPath,[string]$ProfileDirectory)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
function Get-SafeProfile($profile) {
  $usable=$true; $failure=$null
  try { $null=Get-FastPrintProfileBytes $profile $profile.printer } catch { $usable=$false; $failure=$_.Exception.Message }
  $profile | Select-Object id,name,printer,paper,color,landscape,tray,duplex,paperWidthMm,paperHeightMm,copies,savedAt,@{Name='usable';Expression={$usable}},@{Name='error';Expression={$failure}}
}
if ($Action -eq 'List') {
  $profiles=@($(if ($ProfileDirectory) { Get-FastPrintProfiles -Directory $ProfileDirectory } else { Get-FastPrintProfiles }) | ForEach-Object { Get-SafeProfile $_ })
  ConvertTo-Json -InputObject $profiles -Depth 5 -Compress
  exit 0
}
$request=Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Action -eq 'Delete') {
  $path=Get-FastPrintProfilePath $request.id
  if (Test-Path -LiteralPath $path) { [IO.File]::Delete($path) }
  Write-Output '{}'; exit 0
}
if (!$request.printer -or !$request.name -or $request.name.Trim().Length -gt 100) { throw 'Choose a printer and give the preset a name.' }
$previous=$null
if ($request.id) {
  $old=Read-FastPrintProfile $request.id
  if ($old.printer -cne $request.printer) { throw 'This preset belongs to another printer.' }
  try { $previous=Get-FastPrintProfileBytes $old $request.printer } catch { $previous=$null }
}
$owner=if ($request.owner) { [IntPtr]::new([long]$request.owner) } else { [IntPtr]::Zero }
$bytes=[FastPrintDriver]::Capture($request.printer,$owner,$previous,!($request.validateOnly -eq $true))
if ($null -eq $bytes) { Write-Output '{"canceled":true}'; exit 0 }
$profile=Save-FastPrintProfile -Name $request.name -Printer $request.printer -Bytes $bytes -Id $request.id -Notes $(if($old){$old.notes}else{''}) -DefaultBypassFaceUp:($old -and $old.defaultBypassFaceUp -eq $true)
@{canceled=$false;profile=(Get-SafeProfile $profile)} | ConvertTo-Json -Depth 5 -Compress
