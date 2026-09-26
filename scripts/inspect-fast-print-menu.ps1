param([Parameter(Mandatory=$true)][string]$FilePath, [switch]$VerifyInvoke)
$ErrorActionPreference = 'Stop'
# Query the shell's menu model without displaying a window or invoking any verb.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class FastPrintMenuProbe {
  [StructLayout(LayoutKind.Sequential)]
  struct InvokeInfo { public uint size, mask; public IntPtr hwnd, verb, parameters, directory; public int show; public uint hotKey; public IntPtr icon; }
  static uint selectedId = 0;
  [DllImport("user32.dll")] static extern uint GetMenuItemID(IntPtr menu, int position);
  [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IContextMenu menu);
  }
  [ComImport, Guid("000214e4-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IContextMenu {
    [PreserveSig] int QueryContextMenu(IntPtr menu, uint position, uint first, uint last, uint flags);
    void InvokeCommand(ref InvokeInfo info);
  }
  [ComImport, Guid("bcfce0a0-ec17-11d0-8d10-00a0c90f2719"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IContextMenu3 {
    [PreserveSig] int QueryContextMenu(IntPtr menu, uint position, uint first, uint last, uint flags);
    void InvokeCommand(IntPtr command);
    void GetCommandString(UIntPtr command, uint type, IntPtr reserved, IntPtr text, uint max);
    void HandleMenuMsg(uint message, IntPtr wparam, IntPtr lparam);
    void HandleMenuMsg2(uint message, IntPtr wparam, IntPtr lparam, out IntPtr result);
  }
  static IContextMenu3 active;
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, PreserveSig=false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr context, ref Guid iid, out IShellItem item);
  [DllImport("user32.dll")] static extern IntPtr CreatePopupMenu();
  [DllImport("user32.dll")] static extern bool DestroyMenu(IntPtr menu);
  [DllImport("user32.dll")] static extern int GetMenuItemCount(IntPtr menu);
  [DllImport("user32.dll")] static extern IntPtr GetSubMenu(IntPtr menu, int index);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetMenuString(IntPtr menu, uint index, StringBuilder text, int max, uint flags);
  static void Read(IntPtr menu, string prefix, List<string> rows, int depth, string ancestry = "") {
    if (depth > 6) return; if (active != null) { try { active.HandleMenuMsg(0x117, menu, IntPtr.Zero); } catch {} }
    for (int i=0; i<GetMenuItemCount(menu); i++) {
      var label = new StringBuilder(1024);
      GetMenuString(menu, (uint)i, label, label.Capacity, 0x400);
      if (label.Length == 0) continue;
      rows.Add(prefix + label);
      string branch = ancestry + "/" + label;
      if (branch.Contains("/Fast Print/") && branch.Contains("/Microsoft Print to PDF") && branch.Contains("/A4 -") && branch.Contains("/Color/") && label.ToString() == "Print - 4 pages per sheet") selectedId = GetMenuItemID(menu, i);
      var sub = GetSubMenu(menu, i);
      if (sub != IntPtr.Zero) Read(sub, prefix + "  ", rows, depth+1, branch);
    }
  }
  public static string[] Inspect(string path, bool invoke) {
    var itemId = typeof(IShellItem).GUID;
    IShellItem item;
    SHCreateItemFromParsingName(path, IntPtr.Zero, ref itemId, out item);
    IContextMenu contextMenu = null;
    var popup = CreatePopupMenu();
    try {
      var handler = new Guid("3981e225-f559-11d3-8e3a-00c04f6837d5");
      var menuId = typeof(IContextMenu).GUID;
      item.BindToHandler(IntPtr.Zero, ref handler, ref menuId, out contextMenu);
      Marshal.ThrowExceptionForHR(contextMenu.QueryContextMenu(popup, 0, 1, 32767, 0));
      active = contextMenu as IContextMenu3; var rows = new List<string>();
      Read(popup, "", rows, 0);
      if (invoke) {
        if (selectedId == 0 || selectedId == 0xFFFFFFFF) throw new Exception("Test preset not found in the real Shell menu.");
        var info = new InvokeInfo(); info.size = (uint)Marshal.SizeOf(typeof(InvokeInfo)); info.verb = new IntPtr(selectedId - 1); info.show = 1;
        contextMenu.InvokeCommand(ref info);
        rows.Add("Invoked Microsoft Print to PDF / A4 / Color / 4-up in verification mode.");
      }
      return rows.ToArray();
    } finally {
      DestroyMenu(popup);
      if (contextMenu != null) Marshal.ReleaseComObject(contextMenu);
      Marshal.ReleaseComObject(item);
    }
  }
}
'@
if ($VerifyInvoke -and (!$env:FAST_PRINT_VERIFY_DIR -or $env:FAST_PRINT_NONINTERACTIVE -ne '1')) { throw 'Verification output directory and noninteractive mode are required.' }
[FastPrintMenuProbe]::Inspect((Resolve-Path -LiteralPath $FilePath).Path, $VerifyInvoke.IsPresent)
