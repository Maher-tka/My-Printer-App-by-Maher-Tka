param([ValidateSet('Manage','Resolve','List')][string]$Action = 'Manage', [string]$ProfileId, [string]$PreviewPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')

if ($Action -eq 'List') {
  $profiles=@(Get-FastPrintProfiles | Select-Object id,name,printer,paper)
  ConvertTo-Json -InputObject $profiles -Compress
  exit 0
}
if ($Action -eq 'Resolve') {
  $profile = Read-FastPrintProfile $ProfileId
  $null = Get-FastPrintProfileBytes $profile $profile.printer
  $profile | Select-Object id,name,printer,paper,color,landscape,tray,duplex | ConvertTo-Json -Compress
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
[Windows.Forms.Application]::EnableVisualStyles()
$script:fpState = @{ id=''; bytes=$null; fingerprint=''; loading=$false; changed=$false }
$form = [Windows.Forms.Form]::new()
$form.Text = 'Fast Print - Printer presets'
$form.Size = [Drawing.Size]::new(950,710)
$form.MinimumSize = $form.Size
$form.StartPosition = 'CenterScreen'
$form.Font = [Drawing.Font]::new('Segoe UI',10)
$form.BackColor = [Drawing.Color]::FromArgb(245,247,251)

function Add-Label([string]$Text,[int]$X,[int]$Y,[int]$Width,[int]$Height=26) {
  $label = [Windows.Forms.Label]::new()
  $label.Text=$Text; $label.Location=[Drawing.Point]::new($X,$Y); $label.Size=[Drawing.Size]::new($Width,$Height)
  $form.Controls.Add($label); return $label
}
function Add-Button([string]$Text,[int]$X,[int]$Y,[int]$Width) {
  $button=[Windows.Forms.Button]::new(); $button.Text=$Text
  $button.Location=[Drawing.Point]::new($X,$Y); $button.Size=[Drawing.Size]::new($Width,38)
  $button.FlatStyle='Flat'; $button.BackColor=[Drawing.Color]::White
  $form.Controls.Add($button); return $button
}
function Show-FastPrintError($Failure) {
  [Windows.Forms.MessageBox]::Show($form, $Failure.Exception.Message, 'Fast Print', 'OK', 'Error') | Out-Null
}

$title=Add-Label 'Printer presets' 24 20 700 36
$title.Font=[Drawing.Font]::new('Segoe UI',21,[Drawing.FontStyle]::Bold)
$null=Add-Label 'Set up your stock once. Apply its printer settings from the Explorer menu.' 24 66 880
$null=Add-Label 'SAVED PRESETS' 24 116 270
$list=[Windows.Forms.ListBox]::new(); $list.Location=[Drawing.Point]::new(24,146); $list.Size=[Drawing.Size]::new(280,404)
$list.DisplayMember='display'; $form.Controls.Add($list)
$new=Add-Button 'New preset' 24 564 134
$delete=Add-Button 'Delete' 170 564 134
$refresh=Add-Button 'Refresh printer list' 24 614 280

$null=Add-Label '1. Printer' 332 116 560
$printerBox=[Windows.Forms.ComboBox]::new(); $printerBox.DropDownStyle='DropDownList'
$printerBox.Location=[Drawing.Point]::new(332,146); $printerBox.Size=[Drawing.Size]::new(560,30); $form.Controls.Add($printerBox)
$null=Add-Label '2. Preset name (shown in the right-click menu)' 332 194 560
$nameBox=[Windows.Forms.TextBox]::new(); $nameBox.Location=[Drawing.Point]::new(332,224); $nameBox.Size=[Drawing.Size]::new(560,30); $nameBox.MaxLength=100; $form.Controls.Add($nameBox)
$null=Add-Label 'Example: A4 - 80 gsm - Tray 1, or A3 - 350 gsm - Bypass - Face up' 332 259 570 36
$null=Add-Label 'Stock / operator notes (optional)' 332 301 550
$notes=[Windows.Forms.TextBox]::new(); $notes.Location=[Drawing.Point]::new(332,331); $notes.Size=[Drawing.Size]::new(560,50)
$notes.Multiline=$true; $notes.MaxLength=1000; $form.Controls.Add($notes)
$capture=Add-Button '3. Configure and capture driver settings...' 332 398 560
$null=Add-Label 'In the driver: refresh tray data if needed; set paper, tray, weight, face up, and finishing. Use 1 page per sheet / normal layout here.' 332 446 560 48
$summary=[Windows.Forms.TextBox]::new(); $summary.Location=[Drawing.Point]::new(332,501); $summary.Size=[Drawing.Size]::new(560,63)
$summary.Multiline=$true; $summary.ReadOnly=$true; $summary.BorderStyle='None'; $summary.BackColor=$form.BackColor
$summary.Text='No settings captured. Configure the driver before saving.'; $form.Controls.Add($summary)
$save=Add-Button 'Save preset' 332 576 174; $save.Enabled=$false
$save.BackColor=[Drawing.Color]::FromArgb(37,99,235); $save.ForeColor=[Drawing.Color]::White
$guide=Add-Button 'Konica / Epson setup guide' 520 576 372
$close=Add-Button 'Done' 730 614 162
$status=Add-Label 'Saved settings stay on this Windows account. Printer defaults are unchanged.' 332 626 390 32
$status.Font=[Drawing.Font]::new('Segoe UI',9)

function Refresh-FastPrintList {
  $script:fpState.loading=$true
  try {
    $list.Items.Clear()
    foreach ($profile in @(Get-FastPrintProfiles | Sort-Object printer,name)) {
      $list.Items.Add([PSCustomObject]@{ display=($profile.name + '  |  ' + $profile.printer); profile=$profile }) | Out-Null
    }
  } finally { $script:fpState.loading=$false }
}
function Refresh-FastPrintPrinters {
  $selected=[string]$printerBox.SelectedItem
  $script:fpState.loading=$true
  try {
    $printerBox.Items.Clear()
    foreach ($printerName in ([Drawing.Printing.PrinterSettings]::InstalledPrinters | Sort-Object)) { $printerBox.Items.Add($printerName) | Out-Null }
    if ($printerBox.Items.Contains($selected)) { $printerBox.SelectedItem=$selected }
    elseif ($printerBox.Items.Count -gt 0) { $printerBox.SelectedIndex=0 }
  } finally { $script:fpState.loading=$false }
  $script:fpState.bytes=$null; $save.Enabled=$false
}
function Show-CapturedSummary {
  $info = Get-FastPrintProfileSummary ([string]$printerBox.SelectedItem) $script:fpState.bytes
  $mode=if ($info.color) { 'Color' } else { 'Black & white' }
  $orientation=if ($info.landscape) { 'Landscape' } else { 'Portrait' }
  $summary.Text="Captured: $($info.paper) | $mode | $orientation`r`nTray: $($info.tray) | Duplex: $($info.duplex) | Vendor settings included"
  $save.Enabled=$true
}

$new.add_Click({
  $list.ClearSelected(); $script:fpState.id=''; $script:fpState.bytes=$null; $script:fpState.fingerprint=''
  $nameBox.Clear(); $notes.Clear(); $save.Enabled=$false
  $summary.Text='No settings captured. Configure the driver before saving.'; $nameBox.Focus()
})
$printerBox.add_SelectedIndexChanged({
  if ($script:fpState.loading) { return }
  $script:fpState.id=''; $script:fpState.bytes=$null; $script:fpState.fingerprint=''; $save.Enabled=$false
  $summary.Text='Printer changed. Capture its settings before saving.'
})
$list.add_SelectedIndexChanged({
  if ($script:fpState.loading -or !$list.SelectedItem) { return }
  try {
    $profile=$list.SelectedItem.profile
    $script:fpState.loading=$true
    $script:fpState.id=$profile.id; $script:fpState.bytes=$null; $script:fpState.fingerprint=''; $save.Enabled=$false
    $nameBox.Text=$profile.name; $notes.Text=$profile.notes
    if (!$printerBox.Items.Contains($profile.printer)) { $printerBox.Items.Add($profile.printer) | Out-Null }
    $printerBox.SelectedItem=$profile.printer
    try {
      $script:fpState.bytes=Get-FastPrintProfileBytes $profile $profile.printer
      $script:fpState.fingerprint=$profile.driverFingerprint
      Show-CapturedSummary
    } catch { $summary.Text=$_.Exception.Message }
  } catch { Show-FastPrintError $_ }
  finally { $script:fpState.loading=$false }
})
$capture.add_Click({
  try {
    $printerName=[string]$printerBox.SelectedItem
    if (!$printerName) { throw 'Choose an installed printer first.' }
    $fingerprint=[FastPrintDriver]::Fingerprint($printerName)
    $previous=$script:fpState.bytes
    if ($script:fpState.fingerprint -and $script:fpState.fingerprint -cne $fingerprint) { $previous=$null }
    $captured=[FastPrintDriver]::Capture($printerName,$form.Handle,$previous,$true)
    if ($null -eq $captured) { return }
    $script:fpState.bytes=$captured; $script:fpState.fingerprint=$fingerprint
    Show-CapturedSummary
  } catch { $save.Enabled=$false; Show-FastPrintError $_ }
})
$save.add_Click({
  try {
    if (!$script:fpState.bytes) { throw 'Capture the driver settings first.' }
    if ($script:fpState.fingerprint -cne [FastPrintDriver]::Fingerprint([string]$printerBox.SelectedItem)) { throw 'The driver changed. Capture this preset again.' }
    $profile=Save-FastPrintProfile -Name $nameBox.Text -Printer ([string]$printerBox.SelectedItem) -Bytes $script:fpState.bytes -Id $script:fpState.id -Notes $notes.Text
    $script:fpState.id=$profile.id; $script:fpState.changed=$true
    Refresh-FastPrintList
    $status.Text='Saved. Click Done to update the Explorer menu.'
  } catch { Show-FastPrintError $_ }
})
$delete.add_Click({
  if (!$list.SelectedItem) { return }
  $profile=$list.SelectedItem.profile
  if ([Windows.Forms.MessageBox]::Show($form,"Delete preset '$($profile.name)'?",'Delete preset','YesNo','Question') -ne 'Yes') { return }
  try {
    [IO.File]::Delete((Get-FastPrintProfilePath $profile.id))
    $script:fpState.id=''; $script:fpState.bytes=$null; $script:fpState.changed=$true; $save.Enabled=$false
    Refresh-FastPrintList; $nameBox.Clear(); $notes.Clear(); $summary.Text='Preset deleted.'
  } catch { Show-FastPrintError $_ }
})
$refresh.add_Click({ try { Refresh-FastPrintPrinters; Refresh-FastPrintList; $summary.Text='Printer list refreshed. This does not query live tray contents.' } catch { Show-FastPrintError $_ } })
$guide.add_Click({
  $text=@"
KONICA C4065 - your work setup
Save separate presets for:
- A4 / 80 gsm / Tray 1
- A3 / 80 gsm / Tray 2
- A4 / 350 gsm / bypass / face up
- A3 / 350 gsm / bypass / face up
In the Konica driver, acquire/refresh tray information if needed, then set the actual tray, paper weight and face-up option before capture.

EPSON WorkForce Pro WF-C878RDWF
Select its own installed Epson printer queue. In the Epson driver, choose Document Size, Paper Source, Paper Type and any 2-Sided Printing options for the stock actually loaded. Save separate A4/A3 presets for each source you use.
Epson specifies up to 300 gsm for supported feed paths; the cassette and duplex limits differ. Keep the Konica's 350 gsm presets on the Konica.

FOR BOTH PRINTERS
Set driver Multi-Page to normal / 1 page per sheet. Fast Print arranges 2-up and 4-up itself.
Click Configure and capture, finish the driver dialog with OK, then Save preset and Done. The Explorer menu will refresh.
Live tray-data refresh is driver-specific; it is available during setup, not automatically repeated by Fast Print.
"@
  [Windows.Forms.MessageBox]::Show($form,$text,'Work printer setup','OK','Information') | Out-Null
})
$close.add_Click({ $form.Close() })
Refresh-FastPrintPrinters
Refresh-FastPrintList
try {
  if ($PreviewPath) {
    $form.Show(); [Windows.Forms.Application]::DoEvents()
    $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
    try { $form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height)); $bitmap.Save($PreviewPath,[Drawing.Imaging.ImageFormat]::Png) }
    finally { $bitmap.Dispose(); $form.Close() }
  } else { $form.ShowDialog() | Out-Null }
}
finally { $form.Dispose() }
Write-Output 'Printer preset setup closed.'
