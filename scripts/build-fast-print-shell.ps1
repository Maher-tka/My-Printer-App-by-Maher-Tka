$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$locator = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (!(Test-Path -LiteralPath $locator)) { throw 'Install Visual Studio C++ Build Tools to build the Explorer extension.' }
$vs = & $locator -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$vs) { throw 'Visual Studio C++ x64 tools are required.' }
$toolset = Get-ChildItem -LiteralPath (Join-Path $vs 'VC\Tools\MSVC') -Directory | Sort-Object Name -Descending | Select-Object -First 1
$sdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
$sdk = Get-ChildItem -LiteralPath (Join-Path $sdkRoot 'Lib') -Directory | Sort-Object Name -Descending | Select-Object -First 1
$output = Join-Path $root 'out\native'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$includePaths = @((Join-Path $toolset.FullName 'include'), (Join-Path $sdkRoot "Include\$($sdk.Name)\ucrt"), (Join-Path $sdkRoot "Include\$($sdk.Name)\shared"), (Join-Path $sdkRoot "Include\$($sdk.Name)\um"))
$libraryPaths = @((Join-Path $toolset.FullName 'lib\x64'), (Join-Path $sdk.FullName 'ucrt\x64'), (Join-Path $sdk.FullName 'um\x64'))
$compiler = Join-Path $toolset.FullName 'bin\Hostx64\x64\cl.exe'
$arguments = @('/nologo','/LD','/MT','/O2','/EHsc','/std:c++17','/DUNICODE','/D_UNICODE')
$arguments += $includePaths | ForEach-Object { '/I' + $_ }
$arguments += @((Join-Path $root 'src\native\fast-print-shell.cpp'), ('/Fo' + (Join-Path $output 'fast-print-shell.obj')), '/link', ('/IMPLIB:' + (Join-Path $output 'fast-print-shell.lib')))
$arguments += $libraryPaths | ForEach-Object { '/LIBPATH:' + $_ }
$arguments += @('/EXPORT:DllGetClassObject,PRIVATE','/EXPORT:DllCanUnloadNow,PRIVATE','user32.lib','ole32.lib','shell32.lib','shlwapi.lib','advapi32.lib','uuid.lib',('/OUT:' + (Join-Path $output 'fast-print-shell.dll')))
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'Native Explorer handler build failed.' }
