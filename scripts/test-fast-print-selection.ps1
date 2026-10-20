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
  [UnmanagedFunctionPointer(CallingConvention.StdCall)]
  delegate int GetClassObject(ref Guid clsid,ref Guid iid,out IntPtr factory);
  public static void VerifyNativeClass(string libraryPath) {
    IntPtr library=LoadLibrary(libraryPath);
    if(library==IntPtr.Zero)throw new Exception("Cannot load the native selection bridge.");
    try{
      var function=(GetClassObject)Marshal.GetDelegateForFunctionPointer(GetProcAddress(library,"DllGetClassObject"),typeof(GetClassObject));
      var nativeId=new Guid("C7CD21F2-188D-4609-B8E2-3B5831C0F98E");
      var iid=new Guid("00000001-0000-0000-C000-000000000046");IntPtr factory;
      Marshal.ThrowExceptionForHR(function(ref nativeId,ref iid,out factory));
      if(factory==IntPtr.Zero)throw new Exception("Native dialog class factory missing.");
      Marshal.Release(factory);
      var oldId=new Guid("629B66DE-9172-48DF-A7DD-348225B0693F");
      if(function(ref oldId,ref iid,out factory)>=0){if(factory!=IntPtr.Zero)Marshal.Release(factory);throw new Exception("The old release's cached class identity must be distinct.");}
    }finally{FreeLibrary(library);}
  }
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
[FastPrintSelectionProbe]::VerifyNativeClass($library)
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
