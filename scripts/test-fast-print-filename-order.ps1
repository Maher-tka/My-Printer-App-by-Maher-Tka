$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$exe = Join-Path $root 'out\native\FastPrint-filename-order.exe'
& (Join-Path $PSScriptRoot 'build-fast-print-native.ps1') -OutputName 'FastPrint-filename-order.exe'
$type = [System.Reflection.Assembly]::LoadFrom($exe).GetType('Options', $true)
$flags = [System.Reflection.BindingFlags]'Instance,NonPublic'
$constructor = $type.GetConstructor($flags, $null, [type[]]@([string[]]), $null)
$filesField = $type.GetField('Files', $flags)
$tempDir = Join-Path ([IO.Path]::GetTempPath()) ('fast-print-order-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir | Out-Null
try {
  $names = @('Page 10.pdf', 'zebra.png', 'Page 2.pdf', 'Alpha.pdf', 'Page 1.pdf')
  $paths = @($names | ForEach-Object {
    $file = Join-Path $tempDir $_
    [IO.File]::WriteAllText($file, 'fixture')
    $file
  })
  $expected = @('Alpha.pdf', 'Page 1.pdf', 'Page 2.pdf', 'Page 10.pdf', 'zebra.png')
  $manifest = Join-Path $tempDir 'selection.json'
  [IO.File]::WriteAllText($manifest, (@{ version = 1; files = $paths } | ConvertTo-Json -Compress))
  foreach ($arguments in @(@('--batch', $manifest), (@('--') + $paths))) {
    $options = $constructor.Invoke(@(,[string[]]$arguments))
    $actual = @($filesField.GetValue($options) | ForEach-Object { [IO.Path]::GetFileName($_) })
    if (($actual -join '|') -ne ($expected -join '|')) { throw "Unexpected filename order: $($actual -join ', ')" }
  }
  $preset = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"sourceRotations":[1,0,0,0,0]}'))
  $options = $constructor.Invoke(@(,[string[]](@('--preset', $preset, '--batch', $manifest))))
  $actual = @($filesField.GetValue($options) | ForEach-Object { [IO.Path]::GetFileName($_) })
  if (($actual -join '|') -ne ($names -join '|')) { throw 'Indexed settings no longer match the original file order.' }
  Write-Host 'Fast Print filename ordering tests passed.'
} finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force
}
