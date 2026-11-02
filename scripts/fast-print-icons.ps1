# The icon files are separate from printer profiles and original image files.
Add-Type -AssemblyName System.Drawing

function Get-FastPrintIconPath {
  param([ValidateSet('Printer','Preset')][string]$Kind, [string]$Key, [string]$Root)
  if ([string]::IsNullOrWhiteSpace($Root)) { throw 'Invalid icon storage location.' }
  if ($Kind -eq 'Preset') {
    if ($Key -cnotmatch '^[a-f0-9]{32}$') { throw 'Choose a saved preset first.' }
    return Join-Path (Join-Path $Root 'preset-icons') ($Key + '.png')
  }
  if ([string]::IsNullOrWhiteSpace($Key)) { throw 'Choose a printer first.' }
  $hash=[Security.Cryptography.SHA256]::Create()
  try { $name=[BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($Key.ToUpperInvariant()))).Replace('-','').ToLowerInvariant() }
  finally { $hash.Dispose() }
  return Join-Path (Join-Path $Root 'printer-icons') ($name + '.png')
}

function Set-FastPrintIcon {
  param([ValidateSet('Printer','Preset')][string]$Kind, [string]$Key, [string]$Source, [string]$Root)
  $path=Get-FastPrintIconPath -Kind $Kind -Key $Key -Root $Root
  $file=Get-Item -LiteralPath $Source -ErrorAction Stop
  if ($file.PSIsContainer -or $file.Length -lt 1 -or $file.Length -gt 16MB) { throw 'Choose an image smaller than 16 MB.' }
  $folder=Split-Path -Parent $path
  [IO.Directory]::CreateDirectory($folder) | Out-Null
  $temporary=$path+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
  $backup=$path+'.'+[Guid]::NewGuid().ToString('N')+'.bak'
  $completed=$false
  try {
    $stream=[IO.File]::OpenRead($file.FullName)
    try {
      $image=[Drawing.Image]::FromStream($stream,$true,$true)
      try {
        if ($image.Width -lt 1 -or $image.Height -lt 1 -or [long]$image.Width*$image.Height -gt 16000000) { throw 'Choose an image up to 16 megapixels.' }
        $bitmap=[Drawing.Bitmap]::new(64,64,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
          $graphics=[Drawing.Graphics]::FromImage($bitmap)
          try {
            $graphics.Clear([Drawing.Color]::Transparent)
            $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $scale=[Math]::Min(64.0/$image.Width,64.0/$image.Height)
            $width=[single]($image.Width*$scale); $height=[single]($image.Height*$scale)
            $graphics.DrawImage($image,[Drawing.RectangleF]::new((64-$width)/2,(64-$height)/2,$width,$height))
          } finally { $graphics.Dispose() }
          $bitmap.Save($temporary,[Drawing.Imaging.ImageFormat]::Png)
        } finally { $bitmap.Dispose() }
      } finally { $image.Dispose() }
    } finally { $stream.Dispose() }
    if ([IO.File]::Exists($path)) { [IO.File]::Replace($temporary,$path,$backup) } else { [IO.File]::Move($temporary,$path) }
    $completed=$true
  } finally {
    if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    if ($completed -and [IO.File]::Exists($backup)) { [IO.File]::Delete($backup) }
  }
}

function Remove-FastPrintIcon {
  param([ValidateSet('Printer','Preset')][string]$Kind, [string]$Key, [string]$Root)
  $path=Get-FastPrintIconPath -Kind $Kind -Key $Key -Root $Root
  if ([IO.File]::Exists($path)) { [IO.File]::Delete($path) }
}
