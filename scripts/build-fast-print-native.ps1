param([string]$OutputName = 'FastPrint.exe')
$ErrorActionPreference = 'Stop'
if ($OutputName -ne [IO.Path]::GetFileName($OutputName) -or [IO.Path]::GetExtension($OutputName) -ne '.exe') {
  throw 'Choose an executable filename inside out/native.'
}
$root = Split-Path $PSScriptRoot -Parent
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$referenceRoot = Join-Path ${env:ProgramFiles(x86)} 'Reference Assemblies\Microsoft\Framework\.NETFramework\v4.8'
$metadata = Get-ChildItem -LiteralPath (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\UnionMetadata') -Directory |
  Where-Object { $_.Name -match '^10\.' } | Sort-Object Name -Descending | Select-Object -First 1
if (!$metadata) { throw 'Install the Windows 10/11 SDK to build the native PDF print dialog.' }
$output = Join-Path $root 'out\native'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$arguments = @('/nologo','/target:winexe','/platform:x64','/optimize+','/warn:4','/nowarn:1701',
  ('/win32manifest:' + (Join-Path $root 'src\native\FastPrint.manifest')),
  ('/resource:' + (Join-Path $root 'src\shared\fast-print-layouts.json') + ',FastPrint.Layouts'),
  ('/resource:' + (Join-Path $root 'src\renderer\src\design-system\tokens.css') + ',FastPrint.Tokens'),
  ('/out:' + (Join-Path $output $OutputName)), '/r:System.Drawing.dll','/r:System.Windows.Forms.dll',
  '/r:System.Web.Extensions.dll','/r:System.Security.dll','/r:Microsoft.CSharp.dll',
  ('/r:' + (Join-Path $metadata.FullName 'Windows.winmd')),
  ('/r:' + (Join-Path $framework 'System.Runtime.WindowsRuntime.dll')),
  ('/r:' + (Join-Path $referenceRoot 'Facades\System.Runtime.dll')),
  ('/r:' + (Join-Path $referenceRoot 'Facades\System.Threading.Tasks.dll')),
  ('/r:' + (Join-Path $referenceRoot 'Facades\System.Runtime.InteropServices.WindowsRuntime.dll')),
  (Join-Path $root 'src\native\FastPrint.cs'), (Join-Path $root 'src\native\FastPrintUi.cs'), (Join-Path $PSScriptRoot 'FastPrintDriver.cs'))
& (Join-Path $framework 'csc.exe') @arguments
if ($LASTEXITCODE -ne 0) { throw 'Native Fast Print build failed.' }
