using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

// Per-user, per-printer job options. Never updates Windows printer defaults.
internal static class NativeLastSettings {
  internal static string PathFor(string printer) {
    using(var hash=SHA256.Create())return Path.Combine(NativePrint.LocalRoot,"last-settings",BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(printer.ToUpperInvariant()))).Replace("-","").ToLowerInvariant()+".json");
  }
  internal static string ProfileStamp(Dictionary<string,object> profile) {
    using(var hash=SHA256.Create())return Convert.ToBase64String(hash.ComputeHash(Encoding.UTF8.GetBytes(NativePrint.Json.Serialize(profile))));
  }
  internal static Dictionary<string,object> Read(string printer,string fingerprint,out byte[] bytes) {
    bytes=null;
    try {
      string file=PathFor(printer);if(!File.Exists(file)||new FileInfo(file).Length>2*1024*1024)return null;
      var data=NativePrint.Read(file);int copies;
      string profile=NativePrint.Text(data,"profileId");
      if(NativePrint.Text(data,"version")!="1"||!string.Equals(NativePrint.Text(data,"printer"),printer,StringComparison.OrdinalIgnoreCase)||NativePrint.Text(data,"driverFingerprint")!=fingerprint||
        !new[]{"A4","A3"}.Contains(NativePrint.Text(data,"paper"))||!new[]{"auto","portrait","landscape"}.Contains(NativePrint.Text(data,"orientation"))||
        !int.TryParse(NativePrint.Text(data,"copies"),NumberStyles.None,CultureInfo.InvariantCulture,out copies)||copies<1||copies>999||
        !data.ContainsKey("color")||!(data["color"] is bool)||NativePrint.Text(data,"quality").Length>160||
        (profile!="current"&&!Regex.IsMatch(profile,@"^[a-f0-9]{32}$")))return null;
      var decoded=ProtectedData.Unprotect(Convert.FromBase64String(NativePrint.Text(data,"driverSettings")),null,DataProtectionScope.CurrentUser);
      FastPrintDriver.Validate(decoded);bytes=decoded;return data;
    } catch {return null;}
  }
  internal static void Save(Dictionary<string,object> data,byte[] bytes) {
    FastPrintDriver.Validate(bytes);
    var stored=new Dictionary<string,object>(data);stored["version"]=1;
    stored["driverSettings"]=Convert.ToBase64String(ProtectedData.Protect(bytes,null,DataProtectionScope.CurrentUser));
    string text=NativePrint.Json.Serialize(stored);if(Encoding.UTF8.GetByteCount(text)>2*1024*1024)throw new InvalidOperationException("Printer options are too large to remember.");
    string file=PathFor(NativePrint.Text(stored,"printer")),directory=Path.GetDirectoryName(file);Directory.CreateDirectory(directory);
    string temporary=file+"."+Guid.NewGuid().ToString("N")+".tmp";
    try{File.WriteAllText(temporary,text,new UTF8Encoding(false));if(File.Exists(file))File.Replace(temporary,file,null);else File.Move(temporary,file);}
    finally{if(File.Exists(temporary))File.Delete(temporary);}
  }
}
