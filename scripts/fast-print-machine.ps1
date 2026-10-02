param(
  [ValidateSet('Install','Remove')][string]$Action='Install',
  [string]$Executable,
  [string]$AppPath=''
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=[Security.Principal.WindowsPrincipal]::new($identity)
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Machine-wide Fast Print registration requires administrator rights. Run the Windows installer and approve its UAC prompt.'
}
$registry=[Microsoft.Win32.Registry]::LocalMachine
$path='Software\Classes\*\shell\MaherTka.FastPrint'
$selectionId='{629B66DE-9172-48DF-A7DD-348225B0693F}'
function Set-Value([string]$Path,[string]$Name,[string]$Value) {
  $key=$registry.CreateSubKey($Path)
  try { $key.SetValue($Name,$Value,[Microsoft.Win32.RegistryValueKind]::String) }
  finally { $key.Dispose() }
}
if ($Action -eq 'Install') {
  if (!(Test-Path -LiteralPath $Executable -PathType Leaf)) { throw 'The installed Fast Print executable is missing.' }
  if ($Executable.Contains('"') -or $AppPath.Contains('"')) { throw 'Invalid executable path.' }
  $command='"'+$Executable+'"'
  if ($AppPath) {
    if (!(Test-Path -LiteralPath $AppPath)) { throw 'The development app path is missing.' }
    $command+=' "'+$AppPath+'"'
  }
  $selectionLibrary=Join-Path $PSScriptRoot 'fast-print-selection.dll'
  if (!(Test-Path -LiteralPath $selectionLibrary)) { $selectionLibrary=Join-Path (Split-Path $PSScriptRoot -Parent) 'out\native\fast-print-selection.dll' }
  if (!(Test-Path -LiteralPath $selectionLibrary)) { throw 'The batch selection bridge is missing. Build or repair the Fast Print installation.' }
  # A versioned DLL path avoids overwriting a library currently loaded by Explorer.
  $hash=(Get-FileHash -LiteralPath $selectionLibrary -Algorithm SHA256).Hash.Substring(0,16)
  $registeredLibrary=Join-Path (Split-Path $selectionLibrary -Parent) ('fast-print-selection-'+$hash+'.dll')
  if (!(Test-Path -LiteralPath $registeredLibrary)) { Copy-Item -LiteralPath $selectionLibrary -Destination $registeredLibrary }
  Set-Value $path '' 'Fast Print'
  Set-Value $path 'MUIVerb' 'Fast Print'
  Set-Value $path 'Icon' ($Executable+',0')
  Set-Value $path 'Position' 'Top'
  Set-Value $path 'MultiSelectModel' 'Player'
  Set-Value $path 'AppliesTo' 'System.FileExtension:=.pdf OR System.FileExtension:=.png OR System.FileExtension:=.jpg OR System.FileExtension:=.jpeg'
  Set-Value "$path\command" '' ($command+' --fast-print-menu -- "%1"')
  Set-Value $path 'BatchCommand' ($command+' --fast-print-batch')
  Set-Value "$path\DropTarget" 'CLSID' $selectionId
  Set-Value "Software\Classes\CLSID\$selectionId\InprocServer32" '' $registeredLibrary
  Set-Value "Software\Classes\CLSID\$selectionId\InprocServer32" 'ThreadingModel' 'Apartment'
} else {
  $registry.DeleteSubKeyTree($path,$false)
  $registry.DeleteSubKeyTree("Software\Classes\CLSID\$selectionId",$false)
}
# Migrate the diagnostic entry used to prove that machine registration works.
$registry.DeleteSubKeyTree('Software\Classes\*\shell\MaherTka.FastPrint.MachineTest',$false)
Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class FastPrintMachineNotify{[DllImport("shell32.dll")]public static extern void SHChangeNotify(uint e,uint f,IntPtr a,IntPtr b);}'
[FastPrintMachineNotify]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)
Write-Output "Machine-wide Fast Print $($Action.ToLower()) complete."
