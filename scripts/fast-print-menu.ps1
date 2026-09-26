param(
  [ValidateSet('Install', 'Remove', 'List')][string]$Action = 'List',
  [string]$Executable,
  [string]$AppPath = ''
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
$extensions = @('.pdf', '.png', '.jpg', '.jpeg')
$menuRoot = 'Software\Classes\MaherTka.FastPrint'
$classes = [Microsoft.Win32.Registry]::CurrentUser
$handlerId = '{D8335FE6-ED4F-4386-8E87-69527F75B4EF}'

function Set-MenuValue([string]$Path, [string]$Name, [string]$Value) {
  $key = $classes.CreateSubKey($Path)
  try { $key.SetValue($Name, $Value, [Microsoft.Win32.RegistryValueKind]::String) }
  finally { $key.Dispose() }
}
function Add-Cascade([string]$Path, [string]$Label, [string]$Target) {
  Set-MenuValue $Path 'MUIVerb' $Label
  Set-MenuValue $Path 'SubCommands' ''
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
  [PSCustomObject]@{ name = $name; color = $settings.SupportsColor; papers = $papers; isDefault = $settings.IsDefaultPrinter }
})
if ($Action -eq 'List') { ConvertTo-Json -InputObject $printers -Depth 5 -Compress; exit 0 }
if (!(Test-Path -LiteralPath $Executable -PathType Leaf)) { throw 'Fast Print executable is missing. Build the app first.' }
if ($AppPath -and !(Test-Path -LiteralPath $AppPath)) { throw 'Fast Print app path is missing.' }
$commandPrefix = Quote-Argument $Executable
if ($AppPath) { $commandPrefix += ' ' + (Quote-Argument $AppPath) }

# Validate everything before replacing only this application's keys.
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
$profiles = @(Get-FastPrintProfiles)
Remove-Menu
$index = 0
foreach ($printer in ($printers | Sort-Object @{Expression='isDefault';Descending=$true}, name)) {
  if ($printer.papers.Count -eq 0) { continue }
  $id = 'p{0:D3}' -f $index
  $index++
  $printerTarget = "MaherTka.FastPrint\shell\$id"
  $label = $printer.name.Replace('&', '&&')
  if ($printer.isDefault) { $label += ' (default)' }
  Add-Cascade "$menuRoot\shell\$id" $label $printerTarget
  $printerProfiles = @($profiles | Where-Object { $_.printer -ceq $printer.name } | Sort-Object name)
  if ($printerProfiles.Count -gt 0) {
    $savedRoot = "Software\Classes\$printerTarget\shell\00-saved"
    Add-Cascade $savedRoot 'Saved paper && tray presets' ''
    foreach ($profile in $printerProfiles) {
      $profileRoot = "$savedRoot\shell\$($profile.id)"
      Add-Cascade $profileRoot ($profile.name.Replace('&','&&')) ''
      foreach ($mode in @('01-mono','02-color')) {
        $color = $mode -eq '02-color'
        if ($color -and !$printer.color) { continue }
        $modeRoot = "$profileRoot\shell\$mode"
        $modeLabel = if ($color) { 'Color' } else { 'Black && white' }
        Add-Cascade $modeRoot $modeLabel ''
        foreach ($count in @(1,2,4)) {
          $preset = @{ printer=$printer.name; paper=$profile.paper; color=$color; pagesPerSheet=$count; profileId=$profile.id } | ConvertTo-Json -Compress
          $token = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($preset))
          $leaf = "$modeRoot\shell\$count"
          $label = if ($count -eq 1) { 'Print - 1 page per sheet' } else { "Print - $count pages per sheet" }
          Set-MenuValue $leaf 'MUIVerb' $label
          Set-MenuValue "$leaf\command" '' ($commandPrefix + ' --fast-print ' + $token + ' -- "%1"')
        }
      }
    }
  }
  foreach ($paper in @('A4', 'A3')) {
    if ($paper -notin $printer.papers) { continue }
    $paperTarget = "$printerTarget\shell\$paper"
    $paperLabel = if ($paper -eq 'A4') { 'A4 - 210 x 297 mm' } else { 'A3 - 297 x 420 mm' }
    Add-Cascade "Software\Classes\$printerTarget\shell\$paper" $paperLabel $paperTarget
    foreach ($mode in @('01-mono', '02-color')) {
      $color = $mode -eq '02-color'
      if ($color -and !$printer.color) { continue }
      $modeTarget = "$paperTarget\shell\$mode"
      $modeLabel = if ($color) { 'Color' } else { 'Black && white' }
      Add-Cascade "Software\Classes\$paperTarget\shell\$mode" $modeLabel $modeTarget
      foreach ($count in @(1, 2, 4)) {
        $preset = @{ printer = $printer.name; paper = $paper; color = $color; pagesPerSheet = $count } | ConvertTo-Json -Compress
        $token = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($preset))
        $leaf = "Software\Classes\$modeTarget\shell\$count"
        $leafLabel = if ($count -eq 1) { 'Print - 1 page per sheet' } else { "Print - $count pages per sheet" }
        Set-MenuValue $leaf 'MUIVerb' $leafLabel
        Set-MenuValue $leaf 'MultiSelectModel' 'Single'
        Set-MenuValue "$leaf\command" '' ($commandPrefix + ' --fast-print ' + $token + ' -- "%1"')
      }
    }
  }
}
Set-MenuValue "$menuRoot\shell\zy-settings" 'MUIVerb' 'Manage printer presets...'
Set-MenuValue "$menuRoot\shell\zy-settings\command" '' ($commandPrefix + ' --manage-fast-print')
Set-MenuValue "$menuRoot\shell\zz-refresh" 'MUIVerb' 'Refresh printer list'
Set-MenuValue "$menuRoot\shell\zz-refresh\command" '' ($commandPrefix + ' --install-fast-print')
# A standard file verb launches the cascading menu in our own process.
# Explorer no longer needs to load a third-party DLL to display Fast Print.
$path='Software\Classes\*\shell\MaherTka.FastPrint'
Set-MenuValue $path 'MUIVerb' 'Fast Print'
Set-MenuValue $path 'Icon' ($Executable + ',0')
Set-MenuValue $path 'Position' 'Top'
Set-MenuValue $path 'MultiSelectModel' 'Single'
Set-MenuValue $path 'AppliesTo' 'System.FileExtension:=.pdf OR System.FileExtension:=.png OR System.FileExtension:=.jpg OR System.FileExtension:=.jpeg'
Set-MenuValue "$path\command" '' ($commandPrefix + ' --fast-print-menu -- "%1"')
# Also register our verb with the user's active file classes, alongside Open/Print.
$directClasses=@(foreach ($extension in $extensions) {
  $choice=$classes.OpenSubKey("Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$extension\UserChoice")
  if ($choice) { try { $choice.GetValue('ProgId') } finally { $choice.Dispose() } }
}) | Where-Object { $_ -match '^[A-Za-z0-9_.-]+$' } | Select-Object -Unique
foreach ($class in $directClasses) {
  $directPath="Software\Classes\$class\shell\MaherTka.FastPrint"
  Set-MenuValue $directPath '' 'Fast Print'
  Set-MenuValue $directPath 'MUIVerb' 'Fast Print'
  Set-MenuValue $directPath 'Position' 'Top'
  Set-MenuValue $directPath 'MultiSelectModel' 'Single'
  Set-MenuValue $directPath 'Icon' ($Executable + ',0')
  Set-MenuValue "$directPath\command" '' ($commandPrefix + ' --fast-print-menu -- "%1"')
}
$settingsKey=$classes.CreateSubKey($menuRoot)
try { $settingsKey.SetValue('DirectAssociationClasses',[string[]]$directClasses,[Microsoft.Win32.RegistryValueKind]::MultiString) }
finally { $settingsKey.Dispose() }
# Tell Explorer to invalidate its association cache without restarting it.
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class FastPrintShell { [DllImport("shell32.dll")] public static extern void SHChangeNotify(uint e, uint f, IntPtr a, IntPtr b); }'
[FastPrintShell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output "Fast Print installed for $index printers."
