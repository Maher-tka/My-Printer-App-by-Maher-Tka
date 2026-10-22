param(
  [ValidateSet('Install', 'Remove', 'List')][string]$Action = 'List',
  [string]$Executable,
  [string]$AppPath = ''
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
$extensions = @('.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.docx')
$menuRoot = 'Software\Classes\MaherTka.FastPrint'
$classes = [Microsoft.Win32.Registry]::CurrentUser
$handlerId = '{D8335FE6-ED4F-4386-8E87-69527F75B4EF}'

function Set-MenuValue([string]$Path, [string]$Name, [string]$Value) {
  $key = $classes.CreateSubKey($Path)
  try { $key.SetValue($Name, $Value, [Microsoft.Win32.RegistryValueKind]::String) }
  finally { $key.Dispose() }
}
function Quote-Argument([string]$Value) {
  if ($Value.Contains('"') -or $Value.Contains("`r") -or $Value.Contains("`n")) { throw 'Invalid command path.' }
  return '"' + $Value + '"'
}
function Remove-Menu {
  $previous=$classes.OpenSubKey($menuRoot)
  if ($previous) {
    try { $previousClasses=@($previous.GetValue('DirectAssociationClasses')) }
    finally { $previous.Dispose() }
    foreach ($class in $previousClasses) {
      if ($class -match '^[A-Za-z0-9_.-]+$') { $classes.DeleteSubKeyTree("Software\Classes\$class\shell\MaherTka.FastPrint",$false) }
    }
  }
  $classes.DeleteSubKeyTree('Software\Classes\*\shell\MaherTka.FastPrint',$false)
  $classes.DeleteSubKeyTree('Software\Classes\*\shell\MaherTka.FastPrint.Native',$false)
  $classes.DeleteSubKeyTree('Software\Classes\*\shellex\ContextMenuHandlers\MaherTka.FastPrint',$false)
  $oldId='{8E20C856-7F3B-4A98-A55D-9E600C3D481B}'
  $cache=$classes.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Cached',$true)
  if ($cache) {
    try {
      foreach ($name in $cache.GetValueNames()) {
        if ($name.StartsWith($handlerId,[StringComparison]::OrdinalIgnoreCase) -or $name.StartsWith($oldId,[StringComparison]::OrdinalIgnoreCase)) { $cache.DeleteValue($name,$false) }
      }
    } finally { $cache.Dispose() }
  }
  $classes.DeleteSubKeyTree("Software\Classes\CLSID\$oldId",$false)
  $approved=$classes.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved',$true)
  if ($approved) {
    try { $approved.DeleteValue($handlerId,$false); $approved.DeleteValue($oldId,$false) }
    finally { $approved.Dispose() }
  }
  foreach ($ext in $extensions) {
    $classes.DeleteSubKeyTree("Software\Classes\SystemFileAssociations\$ext\shell\MaherTka.FastPrint", $false)
    $classes.DeleteSubKeyTree("Software\Classes\SystemFileAssociations\$ext\shellex\ContextMenuHandlers\MaherTka.FastPrint", $false)
  }
  $classes.DeleteSubKeyTree('Software\Classes\CLSID\{629B66DE-9172-48DF-A7DD-348225B0693F}', $false)
  $classes.DeleteSubKeyTree('Software\Classes\CLSID\{C7CD21F2-188D-4609-B8E2-3B5831C0F98E}', $false)
  $classes.DeleteSubKeyTree($menuRoot, $false)
  $classes.DeleteSubKeyTree("Software\Classes\CLSID\$handlerId", $false)
}

if ($Action -eq 'Remove') { Remove-Menu; Write-Output 'Fast Print removed.'; exit 0 }

$printers = @(foreach ($name in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters) {
  $settings = [System.Drawing.Printing.PrinterSettings]::new()
  $settings.PrinterName = $name
  if (!$settings.IsValid) { continue }
  $papers = @($settings.PaperSizes | Where-Object { $_.Kind.ToString() -in @('A4','A3') } |
    ForEach-Object { $_.Kind.ToString() } | Sort-Object -Unique)
  [PSCustomObject]@{ name = $name; color = [FastPrintDriver]::SupportsColor($settings); papers = $papers; isDefault = $settings.IsDefaultPrinter; duplex = $settings.CanDuplex }
})
if ($Action -eq 'List') { ConvertTo-Json -InputObject $printers -Depth 5 -Compress; exit 0 }
if (!(Test-Path -LiteralPath $Executable -PathType Leaf)) { throw 'Fast Print executable is missing. Build the app first.' }
if ($AppPath -and !(Test-Path -LiteralPath $AppPath)) { throw 'Fast Print app path is missing.' }
# A per-user install must not report success while Explorer continues invoking
# the older all-users registration. That installation needs the elevated path.
$machineLegacy=[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('Software\Classes\*\shell\MaherTka.FastPrint')
$machineNative=[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('Software\Classes\*\shell\MaherTka.FastPrint.Native')
try {
  if ($machineLegacy -and !$machineNative) {
    throw 'An older Fast Print command is installed for all users. Update its machine-wide registration with administrator approval before installing the native dialog.'
  }
} finally {
  if ($machineLegacy) { $machineLegacy.Dispose() }
  if ($machineNative) { $machineNative.Dispose() }
}
# The native dialog opens directly; Electron starts only after Print is confirmed.
$nativeDialog=Join-Path $PSScriptRoot 'FastPrint.exe'
if (!(Test-Path -LiteralPath $nativeDialog)) { $nativeDialog=Join-Path (Split-Path $PSScriptRoot -Parent) 'out\native\FastPrint.exe' }
if (!(Test-Path -LiteralPath $nativeDialog)) { throw 'Build the native Fast Print dialog before installing Explorer integration.' }
$dialogCommand=(Quote-Argument $nativeDialog)+' --app '+(Quote-Argument $Executable)
if ($AppPath) { $dialogCommand+=' --app-path '+(Quote-Argument $AppPath) }
$selectionLibrary=Join-Path $PSScriptRoot 'fast-print-selection.dll'
if (!(Test-Path -LiteralPath $selectionLibrary)) { $selectionLibrary=Join-Path (Split-Path $PSScriptRoot -Parent) 'out\native\fast-print-selection.dll' }
if (!(Test-Path -LiteralPath $selectionLibrary)) { throw 'The batch selection bridge is missing.' }
$selectionId='{C7CD21F2-188D-4609-B8E2-3B5831C0F98E}'
$hash=(Get-FileHash -LiteralPath $selectionLibrary -Algorithm SHA256).Hash.Substring(0,16)
$registeredLibrary=Join-Path (Split-Path $selectionLibrary -Parent) ('fast-print-selection-'+$hash+'.dll')
if (!(Test-Path -LiteralPath $registeredLibrary)) { Copy-Item -LiteralPath $selectionLibrary -Destination $registeredLibrary }
Remove-Menu
$index=@($printers | Where-Object { $_.papers.Count -gt 0 }).Count
$path='Software\Classes\*\shell\MaherTka.FastPrint.Native'
# Explorer can cache the installed release's original verb and class factory.
# A distinct native verb avoids that cached command. Hide the older machine
# entry for this user without modifying the installed release or its settings.
Set-MenuValue 'Software\Classes\*\shell\MaherTka.FastPrint' 'LegacyDisable' ''
Set-MenuValue 'Software\Classes\*\shell\MaherTka.FastPrint' 'ProgrammaticAccessOnly' ''
Set-MenuValue $path 'MUIVerb' 'Fast Print'
Set-MenuValue $path 'Icon' ($Executable + ',0')
Set-MenuValue $path 'Position' 'Top'
Set-MenuValue $path 'MultiSelectModel' 'Player'
Set-MenuValue $path 'AppliesTo' 'System.FileExtension:=.pdf OR System.FileExtension:=.png OR System.FileExtension:=.jpg OR System.FileExtension:=.jpeg OR System.FileExtension:=.gif OR System.FileExtension:=.bmp OR System.FileExtension:=.tif OR System.FileExtension:=.tiff OR System.FileExtension:=.docx'
Set-MenuValue "$path\command" '' ($dialogCommand+' -- "%1"')
Set-MenuValue $path 'BatchCommand' ($dialogCommand+' --batch')
Set-MenuValue "$path\DropTarget" 'CLSID' $selectionId
Set-MenuValue "Software\Classes\CLSID\$selectionId\InprocServer32" '' $registeredLibrary
Set-MenuValue "Software\Classes\CLSID\$selectionId\InprocServer32" 'ThreadingModel' 'Apartment'
# One wildcard verb avoids duplicate entries from simultaneous ProgID registration.
$settingsKey=$classes.CreateSubKey($menuRoot)
try { $settingsKey.SetValue('DirectAssociationClasses',[string[]]@(),[Microsoft.Win32.RegistryValueKind]::MultiString) }
finally { $settingsKey.Dispose() }
# Tell Explorer to invalidate its association cache without restarting it.
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class FastPrintShell { [DllImport("shell32.dll")] public static extern void SHChangeNotify(uint e, uint f, IntPtr a, IntPtr b); }'
[FastPrintShell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output "Fast Print installed for $index printers."
