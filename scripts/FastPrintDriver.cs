using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing.Printing;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

// Preserve the entire driver-owned DEVMODE, including dmDriverExtra. Never SetPrinter:
// saved profiles apply to a job and do not overwrite the user's printer defaults.
public static class FastPrintDriver {
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool OpenPrinter(string name, out IntPtr printer, IntPtr defaults);
  [DllImport("winspool.drv")] static extern bool ClosePrinter(IntPtr printer);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode)]
  static extern int DocumentProperties(IntPtr owner, IntPtr printer, string name, IntPtr output, IntPtr input, int mode);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool GetPrinterDriver(IntPtr printer, string environment, uint level, IntPtr buffer, uint size, out uint needed);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GlobalAlloc(uint flags, UIntPtr bytes);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GlobalLock(IntPtr handle);
  [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr handle);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalFree(IntPtr handle);
  [DllImport("kernel32.dll")] static extern UIntPtr GlobalSize(IntPtr handle);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct DriverInfo {
    public uint Version;
    [MarshalAs(UnmanagedType.LPWStr)] public string Name;
    [MarshalAs(UnmanagedType.LPWStr)] public string Environment;
    [MarshalAs(UnmanagedType.LPWStr)] public string DriverPath;
    [MarshalAs(UnmanagedType.LPWStr)] public string DataFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string ConfigFile;
  }
  static IntPtr Open(string name) {
    IntPtr printer;
    if (!OpenPrinter(name, out printer, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
    return printer;
  }
  public static void Validate(byte[] bytes) {
    if (bytes == null || bytes.Length < 102 || bytes.Length > 16 * 1024 * 1024) throw new ArgumentException("Invalid driver settings buffer.");
    int header = BitConverter.ToUInt16(bytes, 68), extra = BitConverter.ToUInt16(bytes, 70);
    if (header < 102 || header + extra != bytes.Length) throw new ArgumentException("The saved driver settings are incomplete. Capture this preset again.");
  }
  static byte[] ReadBuffer(IntPtr pointer, int capacity) {
    int length = (ushort)Marshal.ReadInt16(pointer, 68) + (ushort)Marshal.ReadInt16(pointer, 70);
    if (length < 102 || length > capacity) throw new InvalidOperationException("The printer returned invalid settings.");
    var bytes = new byte[length]; Marshal.Copy(pointer, bytes, 0, length); Validate(bytes); return bytes;
  }
  public static byte[] Capture(string printerName, IntPtr owner, byte[] previous, bool prompt) {
    IntPtr printer = Open(printerName), buffer = IntPtr.Zero, input = IntPtr.Zero;
    try {
      int size = DocumentProperties(owner, printer, printerName, IntPtr.Zero, IntPtr.Zero, 0);
      if (size < 102 || size > 16 * 1024 * 1024) throw new InvalidOperationException("The driver cannot provide a reusable settings profile.");
      buffer = Marshal.AllocHGlobal(size);
      if (previous != null) {
        Validate(previous);
        input = Marshal.AllocHGlobal(Math.Max(size, previous.Length));
        Marshal.Copy(previous, 0, input, previous.Length);
      }
      int flags = 2 | (previous == null ? 0 : 8) | (prompt ? 4 : 0);
      int result = DocumentProperties(owner, printer, printerName, buffer, input, flags);
      if (result == 2 && prompt) return null;
      if (result != 1) throw new InvalidOperationException("The printer driver rejected these settings. Open its settings and capture the preset again.");
      return ReadBuffer(buffer, size);
    } finally {
      if (input != IntPtr.Zero) Marshal.FreeHGlobal(input);
      if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer);
      ClosePrinter(printer);
    }
  }
  public static string Fingerprint(string printerName) {
    IntPtr printer = Open(printerName), buffer = IntPtr.Zero;
    try {
      uint size;
      GetPrinterDriver(printer, null, 2, IntPtr.Zero, 0, out size);
      if (size == 0 || size > 1024 * 1024) throw new InvalidOperationException("Cannot identify this printer driver.");
      buffer = Marshal.AllocHGlobal((int)size);
      if (!GetPrinterDriver(printer, null, 2, buffer, size, out size)) throw new Win32Exception(Marshal.GetLastWin32Error());
      var driver = (DriverInfo)Marshal.PtrToStructure(buffer, typeof(DriverInfo));
      string identity = driver.Name + "|" + driver.Environment + "|" + driver.Version;
      foreach (string path in new[] { driver.DriverPath, driver.DataFile, driver.ConfigFile }) {
        var file = new FileInfo(path);
        identity += "|" + path + "|" + file.Length + "|" + file.LastWriteTimeUtc.Ticks + "|" + FileVersionInfo.GetVersionInfo(path).FileVersion;
      }
      using (var hash = SHA256.Create()) return Convert.ToBase64String(hash.ComputeHash(Encoding.UTF8.GetBytes(identity)));
    } finally { if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer); ClosePrinter(printer); }
  }
  public static void Apply(PrintDocument document, byte[] bytes) {
    Validate(bytes);
    IntPtr handle = GlobalAlloc(2, new UIntPtr((uint)bytes.Length));
    if (handle == IntPtr.Zero) throw new OutOfMemoryException();
    try {
      IntPtr pointer = GlobalLock(handle);
      if (pointer == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      try { Marshal.Copy(bytes, 0, pointer, bytes.Length); } finally { GlobalUnlock(handle); }
      document.PrinterSettings.SetHdevmode(handle);
      document.DefaultPageSettings.SetHdevmode(handle);
    } finally { GlobalFree(handle); }
  }
  public static byte[] FromDocument(PrintDocument document) {
    IntPtr handle = document.PrinterSettings.GetHdevmode(document.DefaultPageSettings);
    try {
      IntPtr pointer = GlobalLock(handle);
      if (pointer == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      try { return ReadBuffer(pointer, checked((int)GlobalSize(handle).ToUInt64())); } finally { GlobalUnlock(handle); }
    } finally { GlobalFree(handle); }
  }
}
