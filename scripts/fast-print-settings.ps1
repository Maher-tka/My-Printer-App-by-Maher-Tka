param([ValidateSet('Manage','Resolve','List')][string]$Action = 'Manage', [string]$ProfileId, [string]$PreviewPath, [string]$ProfileDirectory, [ValidateSet('en','fr','ar')][string]$Language = 'en')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
. (Join-Path $PSScriptRoot 'fast-print-profiles.ps1')

if ($Action -eq 'List') {
  $profiles=@(Get-FastPrintProfiles | Select-Object id,name,printer,paper,defaultBypassFaceUp,savedAt,sortOrder)
  ConvertTo-Json -InputObject $profiles -Compress
  exit 0
}
if ($Action -eq 'Resolve') {
  $profile = if ($ProfileDirectory) { Read-FastPrintProfile $ProfileId $ProfileDirectory } else { Read-FastPrintProfile $ProfileId }
  $bytes = Get-FastPrintProfileBytes $profile $profile.printer
  $summary = Get-FastPrintProfileSummary $profile.printer $bytes
  if ($summary.paper -ne $profile.paper) { throw 'The saved paper setting is inconsistent. Capture this preset again.' }
  $profile | Select-Object id,name,printer,paper,color,landscape,tray,duplex,@{Name='paperWidthMm';Expression={$summary.paperWidthMm}},@{Name='paperHeightMm';Expression={$summary.paperHeightMm}},@{Name='copies';Expression={$summary.copies}} | ConvertTo-Json -Compress
  exit 0
}

. (Join-Path $PSScriptRoot 'fast-print-icons.ps1')
Add-Type -AssemblyName System.Windows.Forms
[Windows.Forms.Application]::EnableVisualStyles()
$script:fpState = @{ id=''; bytes=$null; fingerprint=''; loading=$false; changed=$false }
$script:fpIconMenus = @{}
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
$iconText = switch ($Language) {
  'fr' { @{ Printer="Icône de l’imprimante…"; Preset="Icône du préréglage…"; Choose="Choisir une image…"; Reset="Rétablir l’icône"; Saved="Icône mise à jour."; Removed="Icône rétablie." } }
  'ar' { @{ Printer='رمز الطابعة…'; Preset='رمز الإعداد…'; Choose='اختيار صورة…'; Reset='إعادة الرمز'; Saved='تم تحديث الرمز.'; Removed='تمت إعادة الرمز.' } }
  default { @{ Printer='Printer icon…'; Preset='Preset icon…'; Choose='Choose image…'; Reset='Reset icon'; Saved='Icon updated.'; Removed='Icon reset.' } }
}
$iconRoot=Split-Path -Parent (Get-FastPrintProfileDirectory)
if ($env:FAST_PRINT_SETTINGS_HIDDEN_PROOF -eq '1' -and $PreviewPath) { $iconRoot=Join-Path (Split-Path -Parent $PreviewPath) ('settings-proof-'+$Language) }
$printerIcon=Add-Button $iconText.Printer 332 68 260
$presetIcon=Add-Button $iconText.Preset 606 68 286
$printerIcon.AccessibleName=$iconText.Printer; $presetIcon.AccessibleName=$iconText.Preset
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
$notes=[Windows.Forms.TextBox]::new(); $notes.Location=[Drawing.Point]::new(332,331); $notes.Size=[Drawing.Size]::new(560,30)
$notes.Multiline=$true; $notes.MaxLength=1000; $form.Controls.Add($notes)
$defaultBypass=[Windows.Forms.CheckBox]::new()
$defaultBypass.Text='Default bypass / face-up preset for this paper'
$defaultBypass.Location=[Drawing.Point]::new(332,365); $defaultBypass.Size=[Drawing.Size]::new(560,28)
$form.Controls.Add($defaultBypass)
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

function Update-FastPrintIconButtons {
  $printerIcon.Enabled=![string]::IsNullOrWhiteSpace([string]$printerBox.SelectedItem)
  $presetIcon.Enabled=$null -ne $list.SelectedItem
}
function Select-FastPrintIconFile([string]$Title) {
  if ($env:FAST_PRINT_SETTINGS_HIDDEN_PROOF -eq '1' -and $PreviewPath) { return $script:iconProofSource }
  $dialog=[Windows.Forms.OpenFileDialog]::new()
  try {
    $dialog.Title=$Title; $dialog.Filter='Images (*.png;*.jpg;*.jpeg;*.bmp;*.gif)|*.png;*.jpg;*.jpeg;*.bmp;*.gif'; $dialog.CheckFileExists=$true
    if ($dialog.ShowDialog($form) -eq [Windows.Forms.DialogResult]::OK) { return $dialog.FileName }
    return $null
  } finally { $dialog.Dispose() }
}
function New-FastPrintIconMenu([string]$Kind, [Windows.Forms.Button]$Button) {
  $key=if ($Kind -eq 'Printer') { [string]$printerBox.SelectedItem } elseif ($list.SelectedItem) { [string]$list.SelectedItem.profile.id } else { '' }
  try { $path=Get-FastPrintIconPath -Kind $Kind -Key $key -Root $iconRoot }
  catch { Show-FastPrintError $_; return $null }
  $menu=[Windows.Forms.ContextMenuStrip]::new()
  $targetState=@{ Key=$key }
  $menu.Tag=$targetState
  $choose=[Windows.Forms.ToolStripMenuItem]::new($iconText.Choose)
  $reset=[Windows.Forms.ToolStripMenuItem]::new($iconText.Reset)
  $reset.Enabled=[IO.File]::Exists($path)
  $choose.add_Click({
    try {
      $source=Select-FastPrintIconFile $Button.Text
      if ($source) { Set-FastPrintIcon -Kind $Kind -Key $targetState.Key -Source $source -Root $iconRoot; $status.Text=$iconText.Saved }
    } catch { Show-FastPrintError $_ }
  }.GetNewClosure())
  $reset.add_Click({ try { Remove-FastPrintIcon -Kind $Kind -Key $targetState.Key -Root $iconRoot; $status.Text=$iconText.Removed } catch { Show-FastPrintError $_ } }.GetNewClosure())
  $menu.Items.Add($choose) | Out-Null; $menu.Items.Add($reset) | Out-Null
  return ,$menu
}
function Prepare-FastPrintIconMenu([string]$Kind, [Windows.Forms.Button]$Button) {
  $menu=$script:fpIconMenus[$Kind]
  if (!$menu -or $menu.IsDisposed) { $menu=New-FastPrintIconMenu $Kind $Button; if ($menu) { $script:fpIconMenus[$Kind]=$menu } }
  if ($menu) {
    $key=if ($Kind -eq 'Printer') { [string]$printerBox.SelectedItem } elseif ($list.SelectedItem) { [string]$list.SelectedItem.profile.id } else { '' }
    try { $path=Get-FastPrintIconPath -Kind $Kind -Key $key -Root $iconRoot }
    catch { Show-FastPrintError $_; return $null }
    $menu.Tag.Key=$key; $menu.Items[1].Enabled=[IO.File]::Exists($path)
  }
  return ,$menu
}
function Show-FastPrintIconMenu([string]$Kind, [Windows.Forms.Button]$Button) {
  $menu=Prepare-FastPrintIconMenu $Kind $Button
  if (!$menu) { return }
  # WinForms may still access a closed menu while a modal file dialog opens.
  # Reuse it and keep it alive until the form closes.
  $menu.Show($Button,[Drawing.Point]::new(0,$Button.Height))
}
$printerIcon.add_Click({ Show-FastPrintIconMenu 'Printer' $printerIcon })
$presetIcon.add_Click({ Show-FastPrintIconMenu 'Preset' $presetIcon })

function Refresh-FastPrintList {
  $script:fpState.loading=$true
  try {
    $list.Items.Clear()
    foreach ($profile in @(Get-FastPrintProfiles)) {
      $list.Items.Add([PSCustomObject]@{ display=($profile.name + '  |  ' + $profile.printer); profile=$profile }) | Out-Null
    }
  } finally { $script:fpState.loading=$false }
  Update-FastPrintIconButtons
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
  Update-FastPrintIconButtons
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
  $defaultBypass.Checked=$false
  $summary.Text='No settings captured. Configure the driver before saving.'; $nameBox.Focus()
  Update-FastPrintIconButtons
})
$printerBox.add_SelectedIndexChanged({
  if ($script:fpState.loading) { return }
  $defaultBypass.Checked=$false
  $script:fpState.id=''; $script:fpState.bytes=$null; $script:fpState.fingerprint=''; $save.Enabled=$false
  $summary.Text='Printer changed. Capture its settings before saving.'
  Update-FastPrintIconButtons
})
$list.add_SelectedIndexChanged({
  if ($script:fpState.loading -or !$list.SelectedItem) { return }
  try {
    $profile=$list.SelectedItem.profile
    $script:fpState.loading=$true
    $script:fpState.id=$profile.id; $script:fpState.bytes=$null; $script:fpState.fingerprint=''; $save.Enabled=$false
    $nameBox.Text=$profile.name; $notes.Text=$profile.notes
    $defaultBypass.Checked=$profile.defaultBypassFaceUp -eq $true
    if (!$printerBox.Items.Contains($profile.printer)) { $printerBox.Items.Add($profile.printer) | Out-Null }
    $printerBox.SelectedItem=$profile.printer
    try {
      $script:fpState.bytes=Get-FastPrintProfileBytes $profile $profile.printer
      $script:fpState.fingerprint=$profile.driverFingerprint
      Show-CapturedSummary
    } catch { $summary.Text=$_.Exception.Message }
  } catch { Show-FastPrintError $_ }
  finally { $script:fpState.loading=$false; Update-FastPrintIconButtons }
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
    $profile=Save-FastPrintProfile -Name $nameBox.Text -Printer ([string]$printerBox.SelectedItem) -Bytes $script:fpState.bytes -Id $script:fpState.id -Notes $notes.Text -DefaultBypassFaceUp:$defaultBypass.Checked
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
if ($env:FAST_PRINT_SETTINGS_HIDDEN_PROOF -eq '1' -and $PreviewPath) {
  $fakePrinter=if ($printerBox.Items.Count -gt 0) { [string]$printerBox.Items[0] } else { 'Proof printer' }
  $list.Items.Add([PSCustomObject]@{ display='Proof preset | Proof printer'; profile=[PSCustomObject]@{ id=('d'*32); name='Proof preset'; printer=$fakePrinter; notes=''; defaultBypassFaceUp=$false; driverFingerprint='' } }) | Out-Null
  $list.SelectedIndex=0
} else { Refresh-FastPrintList }
try {
  if ($PreviewPath) {
    if ($env:FAST_PRINT_SETTINGS_HIDDEN_PROOF -eq '1') {
      $null=$form.Handle; foreach ($control in $form.Controls) { $null=$control.Handle }
      if (!$printerIcon.Enabled -or !$presetIcon.Enabled -or $printerIcon.Right -gt $presetIcon.Left -or $presetIcon.Right -gt $form.ClientSize.Width) { throw 'Icon management controls are unavailable or clipped.' }
      $list.ClearSelected(); Update-FastPrintIconButtons
      if ($presetIcon.Enabled) { throw 'Preset icon command must be disabled without a saved preset.' }
      $list.SelectedIndex=0; Update-FastPrintIconButtons
      if (!$presetIcon.Enabled) { throw 'Preset icon command did not enable for a saved preset.' }
      [IO.Directory]::CreateDirectory($iconRoot) | Out-Null
      $source=Join-Path $iconRoot 'source.png'; $sample=[Drawing.Bitmap]::new(16,16)
      try { $sample.Save($source,[Drawing.Imaging.ImageFormat]::Png) } finally { $sample.Dispose() }
      $script:iconProofSource=$source
      $onClosed=[Windows.Forms.ToolStripDropDown].GetMethod('OnClosed',[Reflection.BindingFlags]'Instance,NonPublic')
      $closed=[Windows.Forms.ToolStripDropDownClosedEventArgs]::new([Windows.Forms.ToolStripDropDownCloseReason]::ItemClicked)
      foreach ($test in @(@('Printer',$printerIcon,[string]$printerBox.SelectedItem),@('Preset',$presetIcon,[string]$list.SelectedItem.profile.id))) {
        $testMenu=Prepare-FastPrintIconMenu $test[0] $test[1]
        $onClosed.Invoke($testMenu,@($closed)) | Out-Null
        if ($testMenu.IsDisposed) { throw 'Closing the icon menu disposed it before its owner finished.' }
        $null=$testMenu.Handle; $testMenu.Items[0].PerformClick(); $null=$testMenu.Handle
        if (![IO.File]::Exists((Get-FastPrintIconPath -Kind $test[0] -Key $test[2] -Root $iconRoot))) { throw 'Icon selection did not save the chosen icon.' }
        $storedPath=Get-FastPrintIconPath -Kind $test[0] -Key $test[2] -Root $iconRoot
        $beforeCancel=[Convert]::ToBase64String([IO.File]::ReadAllBytes($storedPath)); $script:iconProofSource=$null
        $testMenu.Items[0].PerformClick(); $null=$testMenu.Handle; $script:iconProofSource=$source
        if ([Convert]::ToBase64String([IO.File]::ReadAllBytes($storedPath)) -cne $beforeCancel) { throw 'Cancelling icon selection changed the saved icon.' }
        $previous=$testMenu; $testMenu=Prepare-FastPrintIconMenu $test[0] $test[1]
        if (![object]::ReferenceEquals($previous,$testMenu) -or $previous.IsDisposed -or !$testMenu.Items[1].Enabled) { throw 'The icon menu was not safely reused or reset is unavailable.' }
        $onClosed.Invoke($testMenu,@($closed)) | Out-Null
        if ($testMenu.IsDisposed) { throw 'The reset menu was disposed while still in use.' }
        $null=$testMenu.Handle; $testMenu.Items[1].PerformClick(); $null=$testMenu.Handle
        if ([IO.File]::Exists((Get-FastPrintIconPath -Kind $test[0] -Key $test[2] -Root $iconRoot))) { throw 'Icon reset did not remove the selected icon.' }
      }
      $otherPrinter='Other proof printer'; if (!$printerBox.Items.Contains($otherPrinter)) { $printerBox.Items.Add($otherPrinter) | Out-Null }; $printerBox.SelectedItem=$otherPrinter
      $menu=Prepare-FastPrintIconMenu 'Printer' $printerIcon; $menu.Items[0].PerformClick()
      $otherPath=Get-FastPrintIconPath -Kind Printer -Key $otherPrinter -Root $iconRoot
      if (![IO.File]::Exists($otherPath)) { throw 'Reused printer menu retained the previous printer.' }
      $menu=Prepare-FastPrintIconMenu 'Printer' $printerIcon; $menu.Items[1].PerformClick()
      $list.Items.Add([PSCustomObject]@{ display='Other preset'; profile=[PSCustomObject]@{ id=('e'*32); name='Other preset'; printer=$fakePrinter; notes=''; defaultBypassFaceUp=$false; driverFingerprint='' } }) | Out-Null
      $list.SelectedIndex=1; $menu=Prepare-FastPrintIconMenu 'Preset' $presetIcon; $menu.Items[0].PerformClick()
      $otherPath=Get-FastPrintIconPath -Kind Preset -Key ('e'*32) -Root $iconRoot
      if (![IO.File]::Exists($otherPath)) { throw 'Reused preset menu retained the previous preset.' }
      $menu=Prepare-FastPrintIconMenu 'Preset' $presetIcon; $menu.Items[1].PerformClick(); $list.SelectedIndex=0
    } else { $form.Show(); [Windows.Forms.Application]::DoEvents() }
    $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
    try { $form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height)); $bitmap.Save($PreviewPath,[Drawing.Imaging.ImageFormat]::Png) }
    finally { $bitmap.Dispose(); $form.Close() }
  } else { $form.ShowDialog() | Out-Null }
}
finally { foreach ($menu in $script:fpIconMenus.Values) { if ($menu -and !$menu.IsDisposed) { $menu.Dispose() } }; $form.Dispose() }
Write-Output 'Printer preset setup closed.'
