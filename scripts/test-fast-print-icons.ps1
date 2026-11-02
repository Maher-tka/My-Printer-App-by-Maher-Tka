param([Parameter(Mandatory=$true)][string]$Root, [Parameter(Mandatory=$true)][string]$Source, [switch]$VerifyNative)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'fast-print-icons.ps1')
function Get-TestHash([string]$Path) {
  $hash=[Security.Cryptography.SHA256]::Create(); $stream=[IO.File]::OpenRead($Path)
  try { return [BitConverter]::ToString($hash.ComputeHash($stream)) } finally { $stream.Dispose(); $hash.Dispose() }
}
[IO.Directory]::CreateDirectory($Root) | Out-Null
if ($VerifyNative) {
  foreach ($entry in @(@('Printer','Interop Native'),@('Preset',('c'*32)))) {
    $path=Get-FastPrintIconPath -Kind $entry[0] -Key $entry[1] -Root $Root
    $image=[Drawing.Image]::FromFile($path)
    try { if ($image.Width -ne 64 -or $image.Height -ne 64) { throw 'Native icon dimensions are invalid.' } } finally { $image.Dispose() }
    Remove-FastPrintIcon -Kind $entry[0] -Key $entry[1] -Root $Root
  }
  Write-Output 'PowerShell read and reset native-created icons.'
  return
}
$before=Get-TestHash $Source
$printer='Interop Printer'; $other='Other printer'; $id=('d'*32); $otherId=('e'*32)
Set-FastPrintIcon -Kind Printer -Key $printer -Source $Source -Root $Root
Set-FastPrintIcon -Kind Printer -Key $other -Source $Source -Root $Root
Set-FastPrintIcon -Kind Preset -Key $id -Source $Source -Root $Root
Set-FastPrintIcon -Kind Preset -Key $otherId -Source $Source -Root $Root
$printerPath=Get-FastPrintIconPath -Kind Printer -Key $printer -Root $Root
$presetPath=Get-FastPrintIconPath -Kind Preset -Key $id -Root $Root
if ($printerPath -cne (Get-FastPrintIconPath -Kind Printer -Key $printer.ToUpperInvariant() -Root $Root)) { throw 'Printer icon keys are case-sensitive.' }
foreach ($file in @($printerPath,$presetPath)) {
  $image=[Drawing.Image]::FromFile($file)
  try { if ($image.Width -ne 64 -or $image.Height -ne 64) { throw 'Incorrect icon dimensions.' } } finally { $image.Dispose() }
}
Set-FastPrintIcon -Kind Preset -Key $id -Source $Source -Root $Root
$hash=Get-TestHash $presetPath
$invalid=Join-Path $Root 'invalid-image.txt'; [IO.File]::WriteAllText($invalid,'not an image')
$rejected=$false
try { Set-FastPrintIcon -Kind Preset -Key $id -Source $invalid -Root $Root } catch { $rejected=$true }
if (!$rejected -or (Get-TestHash $presetPath) -ne $hash) { throw 'Invalid image replaced a saved icon.' }
$rejected=$false
try { Get-FastPrintIconPath -Kind Preset -Key '../bad' -Root $Root | Out-Null } catch { $rejected=$true }
if (!$rejected) { throw 'Invalid preset identifier accepted.' }
Remove-FastPrintIcon -Kind Printer -Key $other -Root $Root
Remove-FastPrintIcon -Kind Preset -Key $otherId -Root $Root
if (!(Test-Path -LiteralPath $printerPath) -or !(Test-Path -LiteralPath $presetPath)) { throw 'Reset changed another icon.' }
if ((Get-TestHash $Source) -ne $before) { throw 'The original image changed.' }
Write-Output 'Icon save, replace, validation, independent reset and original preservation passed.'
