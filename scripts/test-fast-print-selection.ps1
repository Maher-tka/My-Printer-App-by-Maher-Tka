$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Windows.Forms;
public static class FastPrintSelectionProbe {
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr LoadLibrary(string file);
  [DllImport("kernel32.dll",CharSet=CharSet.Ansi)]static extern IntPtr GetProcAddress(IntPtr library,string name);
  [DllImport("kernel32.dll")]static extern bool FreeLibrary(IntPtr library);
  [UnmanagedFunctionPointer(CallingConvention.StdCall)]
  delegate int WriteManifest([MarshalAs(UnmanagedType.Interface)] System.Runtime.InteropServices.ComTypes.IDataObject data,out IntPtr path);
  public static string Generate(string libraryPath,string[] files) {
    IntPtr library=LoadLibrary(libraryPath);
    if(library==IntPtr.Zero)throw new Exception("Cannot load the native selection bridge: "+Marshal.GetLastWin32Error());
    try {
      IntPtr entry=GetProcAddress(library,"FastPrintWriteSelectionManifest");
      if(entry==IntPtr.Zero)throw new Exception("Manifest export missing.");
      var function=(WriteManifest)Marshal.GetDelegateForFunctionPointer(entry,typeof(WriteManifest));
      var data=new DataObject();var list=new System.Collections.Specialized.StringCollection();list.AddRange(files);data.SetFileDropList(list);
      IntPtr output;int result=function((System.Runtime.InteropServices.ComTypes.IDataObject)data,out output);
      Marshal.ThrowExceptionForHR(result);
      try{return Marshal.PtrToStringUni(output);}finally{Marshal.FreeCoTaskMem(output);}
    }finally{FreeLibrary(library);}
  }
}
'@ -ReferencedAssemblies System.Windows.Forms
$root=Split-Path $PSScriptRoot -Parent
$library=Join-Path $root 'out\native\fast-print-selection.dll'
$folder=Join-Path $root ('tmp\native-selection-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $folder | Out-Null
try {
  $files=@(Join-Path $folder ('b & '+[char]0x0627+'.pdf')); $files+=Join-Path $folder 'a.png'
  for($i=0;$i -lt 120;$i++){ $files+=Join-Path $folder ("document-$i.pdf") }
  foreach($file in $files){[IO.File]::WriteAllText($file,'fixture')}
  $manifest=[FastPrintSelectionProbe]::Generate($library,[string[]]$files)
  try {
    $data=Get-Content -LiteralPath $manifest -Raw -Encoding UTF8 | ConvertFrom-Json
    if($data.version -ne 1 -or $data.files.Count -ne $files.Count){throw 'Selection count/protocol mismatch.'}
    for($i=0;$i -lt $files.Count;$i++){if($data.files[$i] -cne $files[$i]){throw "Selection order/Unicode mismatch at $i"}}
  }finally{[IO.File]::Delete($manifest)}
  $rejected=$false
  try{[FastPrintSelectionProbe]::Generate($library,[string[]](@($files[0])*1001)) | Out-Null}catch{$rejected=$true}
  if(!$rejected){throw 'Oversized native selection was not rejected.'}
  Write-Output 'Native Explorer selection tests passed: 122 files, order, ampersands, Unicode, JSON delivery, and size limit.'
}finally{
  foreach($file in Get-ChildItem -LiteralPath $folder -File){[IO.File]::Delete($file.FullName)}
  [IO.Directory]::Delete($folder)
}
