$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')
$output=Join-Path (Split-Path $PSScriptRoot -Parent) 'output\fast-print-source'
[IO.Directory]::CreateDirectory($output) | Out-Null
foreach($landscape in @($false,$true)){
  $widthMm=if($landscape){420}else{297};$heightMm=if($landscape){297}else{420}
  $bounds=[FastPrintDriver]::RasterPageBounds($widthMm,$heightMm,12,18)
  if([Math]::Abs($bounds.Width*0.254-$widthMm) -gt 0.01 -or [Math]::Abs($bounds.Height*0.254-$heightMm) -gt 0.01){throw 'A3 physical bounds were scaled down.'}
  $width=[int][Math]::Round($widthMm/0.254);$height=[int][Math]::Round($heightMm/0.254)
  $source=[Drawing.Bitmap]::new($width,$height);$page=[Drawing.Bitmap]::new($width,$height)
  $sourceGraphics=[Drawing.Graphics]::FromImage($source);$graphics=[Drawing.Graphics]::FromImage($page)
  try{
    $sourceGraphics.Clear([Drawing.Color]::White);$sourceGraphics.FillRectangle([Drawing.Brushes]::Blue,20,20,$width-40,$height-40)
    $graphics.Clear([Drawing.Color]::White);$graphics.TranslateTransform(12,18)
    $graphics.DrawImage($source,$bounds)
    if($page.GetPixel($width-35,$height-35).B -lt 200 -or $page.GetPixel($width-35,$height-35).R -gt 50){throw 'The A3 raster shrank to an A4 region or moved to one side.'}
    $name=if($landscape){'physical-A3-landscape.png'}else{'physical-A3-portrait.png'}
    $page.Save((Join-Path $output $name),[Drawing.Imaging.ImageFormat]::Png)
  }finally{$sourceGraphics.Dispose();$graphics.Dispose();$source.Dispose();$page.Dispose()}
}
Write-Output 'Full A3 portrait/landscape bounds and hard-margin compensation passed without a print controller or hardware jobs.'
