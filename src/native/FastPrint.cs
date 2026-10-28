using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Windows.Data.Pdf;
using Windows.Storage;
using Windows.Storage.Streams;

// Explorer starts this executable directly. No Electron, dashboard, or printing on open.
internal static class NativePrint {
  internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 32 * 1024 * 1024 };
  internal static readonly Stopwatch Clock = Stopwatch.StartNew();
  internal static string VerificationSettingsRoot;
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr window,int index);
  internal static bool ControlVisible(Control control){return (GetWindowLong(control.Handle,-16)&0x10000000)!=0;}
  internal static Rectangle LaunchWorkingArea(){var foreground=GetForegroundWindow();return (foreground==IntPtr.Zero?Screen.FromPoint(Cursor.Position):Screen.FromHandle(foreground)).WorkingArea;}
  internal static Rectangle InitialWindowBounds(Rectangle work,Size preferred,Size minimum){
    if(work.Width<=0||work.Height<=0)throw new ArgumentException("Invalid monitor work area.");
    int minWidth=Math.Min(work.Width,Math.Max(1,minimum.Width)),minHeight=Math.Min(work.Height,Math.Max(1,minimum.Height));
    int marginWidth=Math.Min(32,Math.Max(0,work.Width-minWidth)),marginHeight=Math.Min(32,Math.Max(0,work.Height-minHeight));
    int width=Math.Min(work.Width-marginWidth,Math.Max(minWidth,preferred.Width));
    int height=Math.Min(work.Height-marginHeight,Math.Max(minHeight,Math.Max(preferred.Height,(int)Math.Round(work.Height*.92))));
    return new Rectangle(work.Left+(work.Width-width)/2,work.Top+(work.Height-height)/2,width,height);
  }
  internal static void Capture(Form form,string path){
    if(!form.Visible){CaptureHandles(form);CaptureLayout(form);}
    form.PerformLayout();form.Refresh();
    using(var image=new Bitmap(form.Width,form.Height)){
      form.DrawToBitmap(image,new Rectangle(0,0,form.Width,form.Height));
      if(!form.Visible)using(var graphics=Graphics.FromImage(image)){
        int edge=(form.Width-form.ClientSize.Width)/2;graphics.TranslateTransform(edge,form.Height-form.ClientSize.Height-edge);
        CaptureChildren(form,graphics);
      }
      image.Save(path,ImageFormat.Png);
    }
  }
  internal static void CaptureContent(Control control,string path){
    CaptureHandles(control);CaptureLayout(control);control.Refresh();
    using(var bitmap=new Bitmap(control.Width,control.Height)){
      control.DrawToBitmap(bitmap,new Rectangle(Point.Empty,control.Size));
      using(var graphics=Graphics.FromImage(bitmap))CaptureChildren(control,graphics);
      bitmap.Save(path,ImageFormat.Png);
    }
  }
  static void CaptureHandles(Control parent){var handle=parent.Handle;foreach(Control child in parent.Controls)CaptureHandles(child);}
  internal static void CaptureLayout(Control parent){parent.PerformLayout();foreach(Control child in parent.Controls)CaptureLayout(child);parent.PerformLayout();}
  static void CaptureChildren(Control parent,Graphics graphics){
    foreach(Control child in parent.Controls.Cast<Control>().Reverse()){
      if(child.Width<1||child.Height<1||(GetWindowLong(child.Handle,-16)&0x10000000)==0)continue;
      using(var bitmap=new Bitmap(child.Width,child.Height)){
        var handle=child.Handle;child.DrawToBitmap(bitmap,new Rectangle(Point.Empty,child.Size));
        int inset=parent is ScrollableControl&&parent.RightToLeft==RightToLeft.Yes?Math.Max(0,parent.Width-parent.ClientSize.Width):0;
        var state=graphics.Save();graphics.TranslateTransform(child.Left+inset,child.Top);graphics.SetClip(new Rectangle(Point.Empty,child.Size),CombineMode.Intersect);
        graphics.DrawImageUnscaled(bitmap,Point.Empty);CaptureChildren(child,graphics);graphics.Restore(state);
      }
    }
  }
  [STAThread] static int Main(string[] args) {
    try {
      Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
      if (args.Length == 3 && args[0] == "--convert-docx") { ConvertWord(args[1], args[2]); return 0; }
      var options=new Options(args);
      PrintTheme.Initialize(options.Appearance=="dark"?(bool?)true:options.Appearance=="light"?(bool?)false:null);
      if(options.Verify!=null){
        VerificationSettingsRoot=Environment.GetEnvironmentVariable("FAST_PRINT_TEST_SETTINGS");
        if(Environment.GetEnvironmentVariable("FAST_PRINT_TEST_SINGLE_CORE")=="1")using(var current=Process.GetCurrentProcess()){long mask=current.ProcessorAffinity.ToInt64();current.ProcessorAffinity=new IntPtr(mask&-mask);}
      }
      using (var form = new PrintWindow(options)) {
        if(options.VerifyPolaroid||options.VerifyPaint||options.VerifyAudit||options.VerifyId||options.VerifyCounts){
          using(var context=new ApplicationContext()){
            form.FormClosed+=delegate{context.ExitThread();};
            var handle=form.Handle;
            if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_LAST_SETTINGS")=="1")form.BeginInvoke(new Action(async delegate{await form.VerifyLastSettings();}));
            else
            form.BeginInvoke(new Action(async delegate{if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_PICKER")=="1")await form.VerifyPresetPicker();else if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_ORDER")=="1")await form.VerifyPresetOrder();else if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_SELECTION")=="1")await form.VerifyPageSelection();else if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_PERFORMANCE")=="1")await form.VerifyPerformance();else if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_COMBINED")=="1")await form.VerifyCombined();else if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_DIRECTION")=="1")await form.VerifyDirection();else if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_SOURCE")=="1")await form.VerifySource();else if(options.VerifyCounts)await form.VerifyPageCounts();else if(options.VerifyId)await form.VerifyId();else if(options.VerifyAudit&&Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_PRESETS")=="1")await form.VerifyPresets();else if(options.VerifyAudit)await form.VerifyAudit();else if(options.VerifyPaint)await form.VerifyPaint();else await form.VerifyPolaroid();}));
            Application.Run(context);
          }
        }else Application.Run(form);
      }
      return 0;
    } catch (Exception error) {
      int verify=Array.IndexOf(args,"--verify-polaroid");if(verify<0)verify=Array.IndexOf(args,"--verify-paint");if(verify<0)verify=Array.IndexOf(args,"--verify-audit");if(verify<0)verify=Array.IndexOf(args,"--verify-id");if(verify<0)verify=Array.IndexOf(args,"--verify-counts");if(verify>=0&&verify+1<args.Length){Directory.CreateDirectory(args[verify+1]);File.WriteAllText(Path.Combine(args[verify+1],"error.txt"),error.ToString());return 1;}
      if(args.Length>0 && args[0]=="--convert-docx")Console.Error.WriteLine(error.Message);
      else MessageBox.Show(error.Message, "Fast Print", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1;
    }
  }
  internal static string Quote(string value) {
    var text = new StringBuilder("\""); int slashes = 0;
    foreach (char c in value) {
      if (c == '\\') { slashes++; continue; }
      if (c == '"') { text.Append('\\', slashes * 2 + 1).Append(c); slashes = 0; continue; }
      text.Append('\\', slashes).Append(c); slashes = 0;
    }
    return text.Append('\\', slashes * 2).Append('"').ToString();
  }
  internal static Process Start(string exe, IEnumerable<string> args,bool redirect=false) {
    var info = new ProcessStartInfo(exe, string.Join(" ", args.Select(Quote))) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetDirectoryName(exe),RedirectStandardOutput=redirect,RedirectStandardError=redirect };
    info.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE"); info.EnvironmentVariables.Remove("ELECTRON_RENDERER_URL");
    return Process.Start(info);
  }
  internal static Dictionary<string, object> Read(string file) { return Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(file)); }
  internal static string Text(Dictionary<string, object> data, string key, string fallback = "") { object value; return data.TryGetValue(key, out value) && value != null ? Convert.ToString(value, CultureInfo.InvariantCulture) : fallback; }
  internal static bool Flag(Dictionary<string, object> data, string key) { object value; return data.TryGetValue(key, out value) && value is bool && (bool)value; }
  internal static Dictionary<string, object> Map(Dictionary<string, object> data, string key) { object value; return data.TryGetValue(key, out value) ? value as Dictionary<string, object> : null; }
  internal static string LocalRoot { get { return VerificationSettingsRoot??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MaherTka", "FastPrint"); } }
  internal static void RememberPrinter(string name){
    Directory.CreateDirectory(LocalRoot);string file=Path.Combine(LocalRoot,"last-printer.json"),temporary=file+"."+Guid.NewGuid().ToString("N")+".tmp";
    try{File.WriteAllText(temporary,Json.Serialize(new{version=1,printer=name}),new UTF8Encoding(false));if(File.Exists(file))File.Replace(temporary,file,null);else File.Move(temporary,file);}
    finally{if(File.Exists(temporary))File.Delete(temporary);}
  }
  internal static string FindOffice() {
    string custom = Environment.GetEnvironmentVariable("FAST_PRINT_SOFFICE");
    if (!string.IsNullOrEmpty(custom) && File.Exists(custom)) return custom;
    string local = Path.Combine(LocalRoot, "docx-converter", "program", "soffice.exe");
    if (File.Exists(local)) return local;
    foreach (string basePath in new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) }) {
      string file = Path.Combine(basePath, "LibreOffice", "program", "soffice.exe"); if (File.Exists(file)) return file;
    }
    return null;
  }
  internal static bool HasWord { get { return Type.GetTypeFromProgID("Word.Application") != null; } }
  // Separate process: conversion cannot block the native dialog's UI thread.
  static void ConvertWord(string source, string destination) {
    Type type = Type.GetTypeFromProgID("Word.Application");
    if (type == null) throw new InvalidOperationException("DOCX preview requires Microsoft Word or LibreOffice.");
    dynamic word = null, document = null;
    try {
      word = Activator.CreateInstance(type); word.Visible = false; word.DisplayAlerts = 0;
      word.AutomationSecurity = 3; word.Options.UpdateLinksAtOpen = false;
      document = word.Documents.Open(FileName: source, ConfirmConversions: false, ReadOnly: true, AddToRecentFiles: false, Visible: false, OpenAndRepair: false, NoEncodingDialog: true);
      document.ExportAsFixedFormat(OutputFileName: destination, ExportFormat: 17, OpenAfterExport: false);
    } finally {
      if (document != null) { try { document.Close(SaveChanges: 0); } finally { Marshal.FinalReleaseComObject(document); } }
      if (word != null) { try { word.Quit(SaveChanges: 0); } finally { Marshal.FinalReleaseComObject(word); } }
    }
  }
}
internal sealed class Options {
  internal string App, AppPath, Verify, Appearance, Language = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
  internal bool VerifyPolaroid,VerifyPaint,VerifyAudit,VerifyId,VerifyCounts;
  internal List<string> Files = new List<string>();
  internal Dictionary<string, object> Initial;
  internal Options(string[] args) {
    for (int i = 0; i < args.Length; i++) {
      string key = args[i];
      if (key == "--") { Files.AddRange(args.Skip(i + 1)); break; }
      if (i + 1 >= args.Length) throw new ArgumentException("Missing Fast Print argument.");
      string value = args[++i];
      if (key == "--app") App = value;
      else if (key == "--app-path") AppPath = value;
      else if (key == "--verify") Verify = value;
      else if (key == "--verify-polaroid") {Verify=value;VerifyPolaroid=true;}
      else if (key == "--verify-paint") {Verify=value;VerifyPaint=true;}
      else if (key == "--verify-audit") {Verify=value;VerifyAudit=true;}
      else if (key == "--verify-id") {Verify=value;VerifyId=true;}
      else if (key == "--verify-counts") {Verify=value;VerifyCounts=true;}
      else if (key == "--language") Language = value;
      else if (key == "--appearance" && new[]{"light","dark","system"}.Contains(value)) Appearance = value;
      else if (key == "--preset") Initial = NativePrint.Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(Convert.FromBase64String(value)));
      else if (key == "--batch") {
        if (new FileInfo(value).Length > 4 * 1024 * 1024) throw new ArgumentException("The file selection is too large.");
        var selection = NativePrint.Read(value);
        if (NativePrint.Text(selection, "version") != "1") throw new ArgumentException("Unsupported file selection.");
        object selectedFiles;
        if(!selection.TryGetValue("files",out selectedFiles) || selectedFiles is string || !(selectedFiles is System.Collections.IEnumerable))
          throw new ArgumentException("The selected file list is invalid.");
        // JavaScriptSerializer's typed dictionary produces ArrayList, whereas
        // DeserializeObject can produce object[]. Accept either enumerable.
        foreach(object selectedFile in (System.Collections.IEnumerable)selectedFiles){
          if(!(selectedFile is string))throw new ArgumentException("The selected file list is invalid.");
          Files.Add((string)selectedFile);
        }
        string parent = Path.Combine(Path.GetTempPath(), "maher-fast-print-selection"); Guid id;
        if (string.Equals(Path.GetDirectoryName(Path.GetFullPath(value)), parent.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase) && Guid.TryParse(Path.GetFileNameWithoutExtension(value), out id)) File.Delete(value);
      } else throw new ArgumentException("Unknown Fast Print argument.");
    }
    if (Files.Count < 1 || Files.Count > 1000) throw new ArgumentException("Choose between 1 and 1,000 files.");
    Files = Files.Select(Path.GetFullPath).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    foreach (string file in Files) {
      if (!new[] { ".pdf", ".docx", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff" }.Contains(Path.GetExtension(file).ToLowerInvariant())) throw new ArgumentException("Unsupported document: " + Path.GetFileName(file));
      var info = new FileInfo(file); if (!info.Exists || info.Length == 0 || info.Length > 512L * 1024 * 1024) throw new ArgumentException("Choose a non-empty document smaller than 512 MB: " + info.Name);
    }
  }
}
internal sealed class Entry {
  internal string Id, Label; internal object Value;
  internal Entry(string id, string label, object value = null) { Id = id; Label = label; Value = value; }
  public override string ToString() { return Label; }
}
internal sealed class PreviewSurface : Control {
  internal sealed class Item { internal RectangleF Bounds;internal int Source,Page,Turns;internal string Name; }
  internal Item[] Items=new Item[0];internal int SelectedItem=-1;internal bool Interactive;
  internal event Action<int> ItemSelected;internal event Action RotateRequested;
  internal Bitmap Sheet;
  string busyText;
  internal int BlankReplacements;
  internal PreviewSurface() { SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw|ControlStyles.Selectable,true); BackColor = PrintTheme.Stage; AccessibleName = "Print preview";TabStop=true; }
  internal RectangleF SheetBounds(){if(Sheet==null)return RectangleF.Empty;float scale=Math.Min((ClientSize.Width-32f)/Sheet.Width,(ClientSize.Height-32f)/Sheet.Height);return scale<=0?RectangleF.Empty:new RectangleF((ClientSize.Width-Sheet.Width*scale)/2,(ClientSize.Height-Sheet.Height*scale)/2,Sheet.Width*scale,Sheet.Height*scale);}
  internal int HitItem(Point point){var sheet=SheetBounds();if(!Interactive||!string.IsNullOrEmpty(busyText)||sheet.IsEmpty||!sheet.Contains(point))return -1;var p=new PointF((point.X-sheet.X)*Sheet.Width/sheet.Width,(point.Y-sheet.Y)*Sheet.Height/sheet.Height);return Array.FindIndex(Items,item=>item.Bounds.Contains(p));}
  internal void SelectItem(int index){if(!Interactive||index<0||index>=Items.Length)return;SelectedItem=index;Invalidate();if(ItemSelected!=null)ItemSelected(index);}
  protected override void OnMouseDown(MouseEventArgs e){base.OnMouseDown(e);if(e.Button==MouseButtons.Left){int index=HitItem(e.Location);if(index>=0){Focus();SelectItem(index);}}}
  protected override void OnMouseMove(MouseEventArgs e){base.OnMouseMove(e);Cursor=HitItem(e.Location)>=0?Cursors.Hand:Cursors.Default;}
  protected override bool IsInputKey(Keys keyData){Keys key=keyData&Keys.KeyCode;return key==Keys.Left||key==Keys.Right||key==Keys.Up||key==Keys.Down||key==Keys.Enter||key==Keys.Space||base.IsInputKey(keyData);}
  protected override void OnKeyDown(KeyEventArgs e){if(Interactive&&Items.Length>0&&(e.KeyCode==Keys.Left||e.KeyCode==Keys.Up||e.KeyCode==Keys.Right||e.KeyCode==Keys.Down)){SelectItem((Math.Max(0,SelectedItem)+(e.KeyCode==Keys.Left||e.KeyCode==Keys.Up?Items.Length-1:1))%Items.Length);e.Handled=e.SuppressKeyPress=true;}else if(Interactive&&SelectedItem>=0&&(e.KeyCode==Keys.Enter||e.KeyCode==Keys.Space||e.KeyCode==Keys.R)){if(RotateRequested!=null)RotateRequested();e.Handled=e.SuppressKeyPress=true;}base.OnKeyDown(e);}
  protected override void OnGotFocus(EventArgs e){base.OnGotFocus(e);Invalidate();}
  protected override void OnLostFocus(EventArgs e){base.OnLostFocus(e);Invalidate();}
  internal void Busy(string text){if(busyText==text)return;busyText=text;Invalidate();}
  protected override void OnPaintBackground(PaintEventArgs e){}
  protected override void OnPaint(PaintEventArgs e) {
    e.Graphics.SmoothingMode=SmoothingMode.None;
    using(var background=new SolidBrush(Parent==null?PrintTheme.Background:Parent.BackColor))e.Graphics.FillRectangle(background,ClientRectangle);
    if(Width<=3||Height<=3)return;
    e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;
    using(var shape=PrintTheme.Round(new RectangleF(1,1,Math.Max(0,Width-3),Math.Max(0,Height-3)),PrintTheme.PanelRadius)){
      using(var stage=new SolidBrush(PrintTheme.Stage))e.Graphics.FillPath(stage,shape);
      var state=e.Graphics.Save();e.Graphics.SetClip(shape);
      if(Sheet!=null)DrawSheet(e.Graphics);
      if(!string.IsNullOrEmpty(busyText)){
        using(var veil=new SolidBrush(Color.FromArgb(210,PrintTheme.Stage)))e.Graphics.FillRectangle(veil,ClientRectangle);
        TextRenderer.DrawText(e.Graphics,busyText,Font,new Rectangle(16,16,Math.Max(1,Width-32),Math.Max(1,Height-32)),PrintTheme.Text,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.WordBreak|TextFormatFlags.NoPrefix);
      }
      e.Graphics.Restore(state);
    }
    base.OnPaint(e);
  }
  void DrawSheet(Graphics graphics){
    float scale = Math.Min((ClientSize.Width - 32f) / Sheet.Width, (ClientSize.Height - 32f) / Sheet.Height); if (scale <= 0) return;
    var rect = new RectangleF((ClientSize.Width - Sheet.Width * scale) / 2, (ClientSize.Height - Sheet.Height * scale) / 2, Sheet.Width * scale, Sheet.Height * scale);
    graphics.SmoothingMode=SmoothingMode.AntiAlias;
    using(var shadow=new SolidBrush(PrintTheme.Blend(PrintTheme.Text,PrintTheme.Stage,.10f)))graphics.FillRectangle(shadow,rect.X+3,rect.Y+4,rect.Width,rect.Height);
    graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;graphics.DrawImage(Sheet,rect);
    using(var border=new Pen(PrintTheme.Border))graphics.DrawRectangle(border,rect.X,rect.Y,rect.Width,rect.Height);
    if(Interactive&&SelectedItem>=0&&SelectedItem<Items.Length){var cell=Items[SelectedItem].Bounds;var selected=new RectangleF(rect.X+cell.X*scale,rect.Y+cell.Y*scale,cell.Width*scale,cell.Height*scale);selected.Inflate(-2,-2);using(var outline=new Pen(PrintTheme.Accent,3)){graphics.DrawRectangle(outline,selected.X,selected.Y,selected.Width,selected.Height);}if(Focused)ControlPaint.DrawFocusRectangle(graphics,Rectangle.Round(selected),PrintTheme.Text,Color.White);}
  }
  internal void Replace(Bitmap next) { if(next==null&&Sheet!=null)BlankReplacements++;var old = Sheet; Sheet = next;busyText=null; if (old != null) old.Dispose(); Invalidate(); }
  protected override void Dispose(bool disposing) { if (disposing && Sheet != null) { Sheet.Dispose(); Sheet = null; } base.Dispose(disposing); }
}
internal sealed class PrintWindow : Form {
  readonly Options args;
  readonly ComboBox printer = new PrintComboBox(), paper = new PrintComboBox(), quality = new PrintComboBox(), color = new PrintComboBox(), profiles = new PrintComboBox(), orientation = new PrintComboBox(), fileList = new PrintComboBox();
  readonly LayoutPicker layouts = new LayoutPicker();
  readonly PreviewSurface preview = new PreviewSurface();
  readonly NumericUpDown copies = new NumericUpDown();
  readonly NumericUpDown imageCopies = new NumericUpDown();
  readonly PrintFlowLayoutPanel imageCopiesGroup = new PrintFlowLayoutPanel();
  readonly ComboBox pageFilter = new PrintComboBox();
  readonly TextBox pageRange = new TextBox { MaxLength=4096 };
  readonly Label pageRangeLabel = new Label();
  readonly string[] pageFilters, pageRanges;
  readonly CheckBox fill = new CheckBox(), sameDirection = new CheckBox{Checked=true};
  readonly CheckBox combineFiles = new CheckBox();
  readonly CheckBox compact = new CheckBox(), actualSize = new CheckBox(), separatorLines = new CheckBox();
  readonly Button separatorColorButton = new PrintButtonControl();
  Color separatorColor=Color.Black;
  readonly Button rotateSelected = new PrintButtonControl();
  readonly int[] sourceRotations;
  readonly int[] sourceCopies;
  readonly Dictionary<Tuple<int,int>,int> pageRotations=new Dictionary<Tuple<int,int>,int>();
  int marginMm=5,gapMm=3;
  bool generalFill;
  bool fillEdited;int orientationLayout;
  bool originalLandscape;
  readonly Button print = new PrintButtonControl(), previous = new PrintButtonControl(), next = new PrintButtonControl(), polaroid8 = new PrintButtonControl(), polaroid9 = new PrintButtonControl();
  readonly Label status = new Label(), count = new Label(), jobSummary = new Label();
  readonly ToolTip tips = new ToolTip();
  readonly Dictionary<string, string> converted = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
  readonly Dictionary<string, Task<string>> preparing = new Dictionary<string, Task<string>>(StringComparer.OrdinalIgnoreCase);
  readonly Dictionary<string,Task<string>> pdfSnapshots=new Dictionary<string,Task<string>>(StringComparer.OrdinalIgnoreCase);
  readonly Dictionary<string,Task<PdfDocument>> pdfDocuments=new Dictionary<string,Task<PdfDocument>>(StringComparer.OrdinalIgnoreCase);
  readonly LinkedList<string> pdfDocumentOrder=new LinkedList<string>();int pdfDocumentLoads,selectionReuses;
  readonly List<Dictionary<string, object>> saved = new List<Dictionary<string, object>>();
  readonly Dictionary<string, byte[]> driverCache = new Dictionary<string, byte[]>();
  readonly Dictionary<string,string> fingerprints=new Dictionary<string,string>();
  readonly Dictionary<string,Bitmap> pageCache=new Dictionary<string,Bitmap>();
  readonly Dictionary<string,int> pageWidths=new Dictionary<string,int>(),documentPages=new Dictionary<string,int>();
  readonly LinkedList<string> pageRecency=new LinkedList<string>();
  long cachedPixels;
  readonly Dictionary<string,SizeF> physicalSizes=new Dictionary<string,SizeF>();
  readonly SemaphoreSlim previewGate=new SemaphoreSlim(1,1);
  readonly SemaphoreSlim polaroidGate=new SemaphoreSlim(1,1);
  sealed class PolaroidSheets {internal string[] Files;internal int[] FileSheets,FileLastSheets;internal string Key;internal int Photos;}
  readonly Dictionary<string,Task<PolaroidSheets>> polaroidPreviews=new Dictionary<string,Task<PolaroidSheets>>();
  readonly List<string> previewSessions=new List<string>();
  readonly List<Process> previewWorkers=new List<Process>();
  readonly Dictionary<string,Bitmap> polaroidThumbnails=new Dictionary<string,Bitmap>();
  readonly LinkedList<string> polaroidThumbnailOrder=new LinkedList<string>();
  PolaroidSheets activePolaroid;
  int polaroidPreparations,polaroidProgressEvents,driverSnapshotRequests;
  long cacheHits,cacheMisses,lastRenderMs,pageRequests;
  readonly int uiThread=Thread.CurrentThread.ManagedThreadId;int photoDecodeThread,previewCompositions,previewReuses;string retainedPreviewKey,retainedPreviewStatus;int summaryRequest;
  bool canColor,canDuplex;
  readonly List<long> warmRenderTimes=new List<long>();
  readonly string session = Path.Combine(Path.GetTempPath(), "maher-fast-print-native", Guid.NewGuid().ToString("N"));
  Dictionary<string, object> preferences = new Dictionary<string, object>();
  PrintDocument settings;byte[] appliedDriverBytes;string appliedSavedSnapshot;
  PdfDocument pdf;
  string loadedFile, mode = "", explicitProfile, appliedProfile, profileError,visibleSourceVersion;
  int printerGeneration,printerRefreshGeneration;
  bool settingsReady;
  bool updating, closing, submitting, initialApplied;
  int sheetIndex, pageCount = 1, rendering, copyChangeGeneration;
  sealed class PageInventory {internal string Key;internal int[] Counts;}
  sealed class OutputTotals {public long Pages,Sheets,TotalSheets;public int Copies;}
  readonly Dictionary<string,Task<int>> sourcePageCounts=new Dictionary<string,Task<int>>();
  Task<PageInventory> inventoryTask;string inventoryKey,fileLabelKey;int summaryGeneration;
  long firstPaint, printerReady, previewReady,sourcePreviewReady;
  readonly Dictionary<string, string[]> translations = new Dictionary<string, string[]> {
    {"Fast Print", new[]{"Impression rapide","الطباعة السريعة"}}, {"Printer",new[]{"Imprimante","الطابعة"}}, {"Paper size",new[]{"Format du papier","مقاس الورق"}},
    {"Quality",new[]{"Qualité","الجودة"}}, {"Color",new[]{"Couleur","ألوان"}}, {"Black & white",new[]{"Noir et blanc","أبيض وأسود"}}, {"Saved preset",new[]{"Préréglage enregistré","الإعداد المحفوظ"}},
    {"Automatic",new[]{"Automatique","تلقائي"}}, {"Portrait",new[]{"Portrait","عمودي"}}, {"Landscape",new[]{"Paysage","أفقي"}}, {"Orientation",new[]{"Orientation","الاتجاه"}},
    {"Full page",new[]{"Pleine page","صفحة كاملة"}}, {"2 pages per sheet",new[]{"2 pages par feuille","صفحتان لكل ورقة"}}, {"4 pages per sheet",new[]{"4 pages par feuille","4 صفحات لكل ورقة"}},
    {"ID card — 9 cm",new[]{"Carte d’identité — 9 cm","بطاقة هوية — 9 سم"}}, {"Copies",new[]{"Copies","النسخ"}}, {"Image copies",new[]{"Copies de l’image","نسخ الصورة"}}, {"Fit to frame",new[]{"Remplir le cadre","ملء الإطار"}},
    {"Print",new[]{"Imprimer","طباعة"}}, {"Cancel",new[]{"Annuler","إلغاء"}}, {"Options…",new[]{"Options…","خيارات…"}}, {"Refresh printers",new[]{"Actualiser les imprimantes","تحديث الطابعات"}},
    {"Source preview",new[]{"Aperçu du fichier","معاينة الملف"}}, {"Loading preview…",new[]{"Chargement de l’aperçu…","جارٍ تحميل المعاينة…"}},
    {"Loading printers…",new[]{"Chargement des imprimantes…","جارٍ تحميل الطابعات…"}}, {"No compatible printers found",new[]{"Aucune imprimante compatible","لم يتم العثور على طابعة متوافقة"}},
    {"Previous sheet",new[]{"Feuille précédente","الورقة السابقة"}}, {"Next sheet",new[]{"Feuille suivante","الورقة التالية"}}, {"Selected files",new[]{"Fichiers sélectionnés","الملفات المحددة"}},
    {"Polaroid",new[]{"Polaroid","بولارويد"}}, {"Review ID…",new[]{"Vérifier la carte…","مراجعة الهوية…"}},
    {"Choose a back image in the ID editor before printing.",new[]{"Choisissez le verso dans l’éditeur avant d’imprimer.","اختر صورة الظهر في محرر الهوية قبل الطباعة."}},
    {"Source preview. Photo rotation and framing are applied during preparation.",new[]{"Aperçu du fichier. Rotation et cadrage appliqués à la préparation.","معاينة الملف. يُطبق التدوير والإطار عند التحضير."}},
    {"Preparing Word document…",new[]{"Préparation du document Word…","جارٍ تحضير مستند Word…"}}
    ,{"Printer properties…",new[]{"Propriétés de l’imprimante…","خصائص الطابعة…"}}
    ,{"Manage saved presets…",new[]{"Gérer les préréglages…","إدارة الإعدادات المحفوظة…"}}
    ,{"Current printer options",new[]{"Options actuelles de l’imprimante","خيارات الطابعة الحالية"}}
    ,{"per sheet",new[]{"par feuille","في الورقة"}}
    ,{"Layout",new[]{"Mise en page","التخطيط"}}
    ,{"Pages per sheet",new[]{"Pages par feuille","الصفحات في الورقة"}}
    ,{"Rotate selected",new[]{"Tourner la sélection","تدوير المحدد"}}
    ,{"Select an image, then rotate it. Use arrow keys to select and R to rotate.",new[]{"Sélectionnez une image, puis tournez-la. Utilisez les flèches pour sélectionner et R pour tourner.","حدد صورة ثم دوّرها. استخدم الأسهم للتحديد وR للتدوير."}}
    ,{"Rotate only the selected page or image.",new[]{"Tourne uniquement la page ou l’image sélectionnée.","تدوير الصفحة أو الصورة المحددة فقط."}}
    ,{"Repeat the selected image on its own sheets.",new[]{"Répéter l’image sélectionnée sur ses propres feuilles.","كرّر الصورة المحددة في أوراق منفصلة."}}
    ,{"Rotate all",new[]{"Tout tourner","تدوير الكل"}}
    ,{"Margins",new[]{"Marges","الهوامش"}}
    ,{"Cutting gap",new[]{"Espace de coupe","مسافة القص"}}
    ,{"Slot size",new[]{"Format des cases","حجم الخانة"}}
    ,{"Rotation",new[]{"Rotation","التدوير"}}
    ,{"Light appearance",new[]{"Apparence claire","مظهر فاتح"}}
    ,{"Dark appearance",new[]{"Apparence sombre","مظهر داكن"}}
    ,{"System appearance",new[]{"Apparence du système","مظهر النظام"}}
    ,{"Preparing Polaroid sheets…",new[]{"Préparation des feuilles Polaroid…","جارٍ تحضير أوراق البولارويد…"}}
    ,{"photos",new[]{"photos","صور"}}
    ,{"sheets",new[]{"feuilles","أوراق"}}
    ,{"files",new[]{"fichiers","ملفات"}}
    ,{"file",new[]{"fichier","ملف"}}
    ,{"page",new[]{"page","صفحة"}}
    ,{"sheet",new[]{"feuille","ورقة"}}
    ,{"pages",new[]{"pages","صفحات"}}
    ,{"source pages",new[]{"pages source","صفحات المصدر"}}
    ,{"source page",new[]{"page source","صفحة مصدر"}}
    ,{"Combine files on sheets",new[]{"Combiner les fichiers sur les feuilles","دمج الملفات في الأوراق"}}
    ,{"Save printer preset…",new[]{"Enregistrer un préréglage…","حفظ إعداد الطابعة…"}}
    ,{"Preset name",new[]{"Nom du préréglage","اسم الإعداد"}}
    ,{"Save",new[]{"Enregistrer","حفظ"}}
    ,{"Give this preset a name.",new[]{"Donnez un nom à ce préréglage.","أدخل اسماً لهذا الإعداد."}}
    ,{"This printer does not support the preset paper.",new[]{"Cette imprimante ne prend pas en charge ce papier.","الطابعة لا تدعم ورق هذا الإعداد."}}
    ,{"Set paper size, tray, weight and output in Printer properties before saving.",new[]{"Réglez le format, le magasin, le grammage et la sortie dans les propriétés avant d’enregistrer.","اضبط حجم الورق والدرج والوزن والإخراج في خصائص الطابعة قبل الحفظ."}}
    ,{"Output",new[]{"Sortie","الإخراج"}}
    ,{"Output per copy",new[]{"Sortie par copie","الإخراج لكل نسخة"}}
    ,{"copies",new[]{"copies","نسخ"}}
    ,{"total sheets",new[]{"feuilles au total","إجمالي الأوراق"}}
    ,{"Counting pages…",new[]{"Comptage des pages…","جارٍ حساب الصفحات…"}}
    ,{"Page totals unavailable",new[]{"Total des pages indisponible","إجمالي الصفحات غير متاح"}}
    ,{"Page totals",new[]{"Total des pages","إجمالي الصفحات"}}
    ,{"Original orientation",new[]{"Orientation du fichier","اتجاه الملف الأصلي"}}
    ,{"Preset direction",new[]{"Sens du préréglage","اتجاه الإعداد"}}
    ,{"Same direction",new[]{"Même sens","نفس الاتجاه"}}
    ,{"Files changed. Review the updated preview before printing.",new[]{"Fichiers modifiés. Vérifiez le nouvel aperçu avant d’imprimer.","تغيرت الملفات. راجع المعاينة المحدثة قبل الطباعة."}}
    ,{"Files changed while preparing. Refresh the preview.",new[]{"Fichiers modifiés pendant la préparation. Actualisez l’aperçu.","تغيرت الملفات أثناء التحضير. حدّث المعاينة."}}
    ,{"Polaroid requires A4 and color. Keep these settings in printer properties.",new[]{"Polaroid nécessite A4 et couleur. Conservez ces réglages dans les propriétés.","يتطلب البولارويد ورق A4 والطباعة بالألوان. حافظ على هذين الإعدادين في خصائص الطابعة."}}
    ,{"Choose a non-empty file smaller than 512 MB.",new[]{"Choisissez un fichier non vide de moins de 512 Mo.","اختر ملفًا غير فارغ أصغر من 512 ميغابايت."}}
    ,{"The selected file is missing.",new[]{"Le fichier sélectionné est introuvable.","الملف المحدد غير موجود."}}
    ,{"ID edits saved. Choose printer settings, then Review ID.",new[]{"Modifications enregistrées. Choisissez les réglages, puis Vérifier la carte.","تم حفظ تعديلات البطاقة. اختر إعدادات الطابعة ثم راجع البطاقة."}}
    ,{"Pages in this file",new[]{"Pages de ce fichier","صفحات هذا الملف"}}
    ,{"All pages",new[]{"Toutes les pages","كل الصفحات"}}
    ,{"Odd pages",new[]{"Pages impaires","الصفحات الفردية"}}
    ,{"Even pages",new[]{"Pages paires","الصفحات الزوجية"}}
    ,{"Page range",new[]{"Plage de pages","نطاق الصفحات"}}
    ,{"Range (1-5, 8, 12)",new[]{"Plage (1-5, 8, 12)","النطاق (1-5, 8, 12)"}}
    ,{"Enter pages such as 1-5, 8, 12.",new[]{"Saisissez des pages comme 1-5, 8, 12.","أدخل الصفحات مثل 1-5, 8, 12."}}
    ,{"The page range exceeds this file's page count.",new[]{"La plage dépasse le nombre de pages du fichier.","النطاق يتجاوز عدد صفحات هذا الملف."}}
    ,{"Select at least one page to print.",new[]{"Sélectionnez au moins une page à imprimer.","حدد صفحة واحدة على الأقل للطباعة."}}
    ,{"No selected pages in this file.",new[]{"Aucune page sélectionnée dans ce fichier.","لا توجد صفحات محددة في هذا الملف."}}
    ,{"selected pages",new[]{"pages sélectionnées","صفحات محددة"}}
    ,{"selected page",new[]{"page sélectionnée","صفحة محددة"}}
    ,{"Page selection changed. Review the preview before printing.",new[]{"La sélection de pages a changé. Vérifiez l’aperçu avant d’imprimer.","تغير تحديد الصفحات. راجع المعاينة قبل الطباعة."}}
    ,{"Fast Print supports up to 2000 selected pages.",new[]{"L’impression rapide accepte jusqu’à 2000 pages sélectionnées.","تدعم الطباعة السريعة حتى 2000 صفحة محددة."}}
    ,{"Arrange presets…",new[]{"Organiser les préréglages…","ترتيب الإعدادات…"}}
    ,{"Move up",new[]{"Monter","نقل للأعلى"}}
    ,{"Move down",new[]{"Descendre","نقل للأسفل"}}
    ,{"Saved preset order could not be read.",new[]{"Impossible de lire l’ordre des préréglages enregistrés.","تعذرت قراءة ترتيب الإعدادات المحفوظة."}}
    ,{"Invalid preset order.",new[]{"Ordre de préréglages invalide.","ترتيب الإعدادات غير صالح."}}
    ,{"No saved printer presets",new[]{"Aucun préréglage enregistré","لا توجد إعدادات طابعة محفوظة"}}
    ,{"The saved preset changed. Choose a preset again.",new[]{"Le préréglage a changé. Choisissez à nouveau un préréglage.","تغير الإعداد المحفوظ. اختر إعدادًا مرة أخرى."}}
    ,{"This preset's printer is unavailable. Install it, then refresh printers.",new[]{"L’imprimante de ce préréglage est indisponible. Installez-la, puis actualisez les imprimantes.","طابعة هذا الإعداد غير متاحة. ثبّتها ثم حدّث قائمة الطابعات."}}
    ,{"Compact layout",new[]{"Disposition compacte","تخطيط مضغوط"}}
    ,{"Preserve actual size",new[]{"Conserver la taille réelle","الحفاظ على الحجم الحقيقي"}}
    ,{"Separation lines · 0.25 px",new[]{"Traits de séparation · 0,25 px","خطوط الفصل · 0.25 px"}}
    ,{"Line color…",new[]{"Couleur des traits…","لون الخط…"}}
    ,{"Uses PDF page size or image DPI (96 DPI when missing).",new[]{"Utilise le format PDF ou la résolution de l’image (96 ppp si absente).","يستخدم حجم صفحة PDF أو دقة الصورة (96 DPI عند غيابها)."}}
    ,{NativeLayout.SizeError,new[]{"Les éléments en taille réelle ne tiennent pas. Réduisez le nombre par feuille, agrandissez le papier ou changez l’orientation.","العناصر بحجمها الحقيقي لا تتسع. قلّل العدد في الورقة أو اختر ورقًا أكبر أو غيّر الاتجاه."}}
  };
  string L(string key) { string[] values; return (args.Language == "ar" || args.Language == "fr") && translations.TryGetValue(key, out values) ? values[args.Language == "ar" ? 1 : 0] : key; }
  string Quantity(long value,string singular,string plural){return value+" "+L(value==1?singular:plural);}
  string Selected(ComboBox box) { var item = box.SelectedItem as Entry; return item == null ? "" : item.Id; }
  string SelectedLayout { get { var item = layouts.SelectedItem as Entry; return item == null ? "1" : item.Id; } }
  int PerSheet { get { int count; return int.TryParse(SelectedLayout, out count) ? count : 1; } }
  bool Special { get { return mode != ""; } }
  bool IsPolaroid { get { return mode.StartsWith("polaroid-"); } }
  bool SourceOrientation { get { return !Special&&PerSheet==1&&Selected(orientation)=="auto"; } }
  bool Landscape { get { return mode == "polaroid-8" || (!IsPolaroid && (Selected(orientation)=="auto"?(SourceOrientation?originalLandscape:!Special&&NativeLayout.Find(PerSheet).landscape):Selected(orientation)=="landscape")); } }
  void SetOrientation(bool landscape){orientation.SelectedIndex=orientation.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==(landscape?"landscape":"portrait"));}
  internal PrintWindow(Options options) {
    args = options; Directory.CreateDirectory(session);
    sourceRotations=new int[args.Files.Count];sourceCopies=Enumerable.Repeat(1,args.Files.Count).ToArray();generalFill=false;
    pageFilters=Enumerable.Repeat("all",args.Files.Count).ToArray();pageRanges=new string[args.Files.Count];
    if(args.Initial!=null){
      int value;
      if(args.Initial.ContainsKey("marginMm")){if(!int.TryParse(NativePrint.Text(args.Initial,"marginMm"),out value)||value<5||value>20)throw new InvalidOperationException("Invalid Fast Print margins.");marginMm=value;}
      if(args.Initial.ContainsKey("gapMm")){if(!int.TryParse(NativePrint.Text(args.Initial,"gapMm"),out value)||value<0||value>10)throw new InvalidOperationException("Invalid Fast Print cutting gap.");gapMm=value;}
      compact.Checked=NativePrint.Flag(args.Initial,"compact");actualSize.Checked=NativePrint.Flag(args.Initial,"preserveActualSize");separatorLines.Checked=NativePrint.Flag(args.Initial,"separatorLines");
      if(compact.Checked&&!args.Initial.ContainsKey("gapMm"))gapMm=0;
      string lineColor=NativePrint.Text(args.Initial,"separatorColor","#000000");
      if(!System.Text.RegularExpressions.Regex.IsMatch(lineColor,"^#[0-9a-fA-F]{6}$"))throw new InvalidOperationException("Invalid separation line color.");
      separatorColor=ColorTranslator.FromHtml(lineColor);
      if(args.Initial.ContainsKey("fitToFrame")){generalFill=NativePrint.Flag(args.Initial,"fitToFrame");fillEdited=true;}
      if(args.Initial.ContainsKey("combineFiles"))combineFiles.Checked=NativePrint.Flag(args.Initial,"combineFiles");
      if(args.Initial.ContainsKey("matchLayoutOrientation"))sameDirection.Checked=NativePrint.Flag(args.Initial,"matchLayoutOrientation");
      object rotations;if(args.Initial.TryGetValue("sourceRotations",out rotations)){var values=rotations as System.Collections.IEnumerable;if(values==null)throw new InvalidOperationException("Invalid Fast Print rotations.");int i=0;foreach(object item in values){if(i>=sourceRotations.Length||!int.TryParse(Convert.ToString(item,CultureInfo.InvariantCulture),out value)||value<0||value>3)throw new InvalidOperationException("Invalid Fast Print rotations.");sourceRotations[i++]=value;}}
      object quantities;if(args.Initial.TryGetValue("sourceCopies",out quantities)){var values=quantities as System.Collections.IEnumerable;if(values==null)throw new InvalidOperationException("Invalid image quantities.");int i=0;foreach(object item in values){if(i>=sourceCopies.Length||!int.TryParse(Convert.ToString(item,CultureInfo.InvariantCulture),out value)||value<1||value>999||value>1&&!IsImage(args.Files[i]))throw new InvalidOperationException("Invalid image quantities.");sourceCopies[i++]=value;}if(i!=sourceCopies.Length)throw new InvalidOperationException("Invalid image quantities.");}
      object pageTurns;if(args.Initial.TryGetValue("pageRotations",out pageTurns)){var values=pageTurns as System.Collections.IEnumerable;if(values==null)throw new InvalidOperationException("Invalid Fast Print page rotations.");foreach(object entry in values){var item=entry as Dictionary<string,object>;int file,page,turns;if(item==null||!int.TryParse(NativePrint.Text(item,"file"),out file)||file<0||file>=args.Files.Count||!int.TryParse(NativePrint.Text(item,"page"),out page)||page<0||page==int.MaxValue||!int.TryParse(NativePrint.Text(item,"turns"),out turns)||turns<0||turns>3||pageRotations.Count>=2000||pageRotations.ContainsKey(Tuple.Create(file,page)))throw new InvalidOperationException("Invalid Fast Print page rotations.");pageRotations.Add(Tuple.Create(file,page),turns);}}
    }
    fill.Checked=generalFill;
    Text = L("Fast Print"); Font = new Font("Segoe UI", 9.75f); StartPosition = FormStartPosition.Manual;
    ClientSize = new Size(1100, 704); MinimumSize = new Size(820, 640); AutoScaleMode = AutoScaleMode.Dpi;
    DoubleBuffered=true;
    if (args.Language == "ar") { RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; }
    var root = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4, Padding = new Padding(12) };
    root.RowStyles.Add(new RowStyle(SizeType.Absolute,44));root.RowStyles.Add(new RowStyle(SizeType.Absolute,224));root.RowStyles.Add(new RowStyle(SizeType.Percent,100));root.RowStyles.Add(new RowStyle(SizeType.Absolute,116));
    Controls.Add(root);
    var header=new PrintTableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=3,RowCount=1,TabIndex=9};header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));header.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));header.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
    header.Controls.Add(new Label { Text = L("Fast Print"), Font = new Font(Font.FontFamily, 16f,FontStyle.Bold), Dock = DockStyle.Fill, AutoEllipsis = true },0,0);root.Controls.Add(header,0,0);
    var setup=new PrintGlassPanel{Dock=DockStyle.Fill,ColumnCount=1,RowCount=3,Padding=new Padding(8),Margin=new Padding(0,0,0,8)};setup.RowStyles.Add(new RowStyle(SizeType.Absolute,60));setup.RowStyles.Add(new RowStyle(SizeType.Absolute,60));setup.RowStyles.Add(new RowStyle(SizeType.Percent,100));root.Controls.Add(setup,0,1);
    var top = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1,TabIndex=0,Margin=Padding.Empty };
    ((PrintComboBox)profiles).CompactSelection=true;
    top.RowStyles.Add(new RowStyle(SizeType.Percent,100));
    top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,40));top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,60));
    top.Controls.Add(Field("Printer", printer), 0, 0); top.Controls.Add(Field("Saved preset", profiles), 1, 0); setup.Controls.Add(top, 0, 0);
    var middle = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1,TabIndex=1,Margin=Padding.Empty };
    middle.RowStyles.Add(new RowStyle(SizeType.Percent,100));
    middle.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,40));middle.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,60));
    var photos = new PrintFlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, AutoScroll = true }; photos.Controls.Add(new Label { Text = L("Polaroid"), AutoSize = true, Margin = new Padding(0, 8, 8, 0) });
    SetButton(polaroid8, "8 PIC", delegate { ChoosePolaroid(8); }); SetButton(polaroid9, "9 PIC", delegate { ChoosePolaroid(9); }); photos.Controls.Add(polaroid8); photos.Controls.Add(polaroid9);
    var sheetSettings=new PrintTableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=4,RowCount=1,Margin=Padding.Empty};sheetSettings.RowStyles.Add(new RowStyle(SizeType.Percent,100));foreach(int width in new[]{22,20,32,26})sheetSettings.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,width));
    sheetSettings.Controls.Add(Field("Paper size",paper),0,0);sheetSettings.Controls.Add(Field("Color",color),1,0);sheetSettings.Controls.Add(Field("Orientation",orientation),2,0);sheetSettings.Controls.Add(Field("Quality",quality),3,0);
    middle.Controls.Add(photos, 0, 0);middle.Controls.Add(sheetSettings,1,0);setup.Controls.Add(middle,0,1);
    fileList.Dock = DockStyle.Fill; fileList.DropDownStyle = ComboBoxStyle.DropDownList; fileList.AccessibleName = L("Selected files");
    for (int i = 0; i < args.Files.Count; i++) fileList.Items.Add(new Entry(i.ToString(), (i + 1) + " / " + args.Files.Count + " · " + Path.GetFileName(args.Files[i])));
    fileList.SelectedIndex = 0;
    var sources = new PrintTableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=1,RowCount=2,TabIndex=2,Margin=Padding.Empty };
    sources.RowStyles.Add(new RowStyle(SizeType.Absolute,40));sources.RowStyles.Add(new RowStyle(SizeType.Percent,100));
    var sourceRow=new PrintTableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,Margin=Padding.Empty};sourceRow.RowStyles.Add(new RowStyle(SizeType.Percent,100));sourceRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));sourceRow.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));sourceRow.Controls.Add(fileList,0,0);
    combineFiles.Text=L("Combine files on sheets");combineFiles.AutoSize=true;combineFiles.Visible=false;combineFiles.Margin=new Padding(12,8,0,0);sourceRow.Controls.Add(combineFiles,1,0);sources.Controls.Add(sourceRow,0,0);
    var pageControls = new PrintTableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=4,RowCount=1,Margin=Padding.Empty };
    pageControls.RowStyles.Add(new RowStyle(SizeType.Percent,100));
    pageControls.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));pageControls.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,35));pageControls.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));pageControls.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,65));
    pageControls.Controls.Add(new Label { Text=L("Pages in this file"),AutoSize=true,Margin=new Padding(0,8,8,0) },0,0);
    pageFilter.DropDownStyle=ComboBoxStyle.DropDownList;pageFilter.Dock=DockStyle.Fill;pageFilter.AccessibleName=L("Pages in this file");
    pageFilter.Items.AddRange(new object[]{new Entry("all",L("All pages")),new Entry("odd",L("Odd pages")),new Entry("even",L("Even pages")),new Entry("range",L("Page range"))});pageFilter.SelectedIndex=0;pageControls.Controls.Add(pageFilter,1,0);
    pageRangeLabel.Text=L("Range (1-5, 8, 12)");pageRangeLabel.AutoSize=true;pageRangeLabel.Visible=false;pageRangeLabel.Margin=new Padding(12,8,8,0);pageControls.Controls.Add(pageRangeLabel,2,0);
    pageRange.Dock=DockStyle.Fill;pageRange.Margin=new Padding(0,6,0,0);pageRange.RightToLeft=RightToLeft.No;pageRange.AccessibleName=L("Range (1-5, 8, 12)");pageRange.Enabled=false;pageRange.Visible=false;pageControls.Controls.Add(pageRange,3,0);tips.SetToolTip(pageRange,L("Enter pages such as 1-5, 8, 12."));
    sources.Controls.Add(pageControls,0,1);setup.Controls.Add(sources,0,2);
    var work = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2,TabIndex=3 };
    work.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); work.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 300)); work.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); work.RowStyles.Add(new RowStyle(SizeType.AutoSize));
    preview.Dock = DockStyle.Fill; work.Controls.Add(preview, 0, 0);
    preview.AccessibleName=L("Source preview");preview.AccessibleDescription=L("Select an image, then rotate it. Use arrow keys to select and R to rotate.");tips.SetToolTip(preview,preview.AccessibleDescription);
    preview.ItemSelected+=SelectPreviewItem;preview.RotateRequested+=delegate{if(rotateSelected.Enabled)RotateSelectedSource(rotateSelected,EventArgs.Empty);};
    layouts.Dock = DockStyle.Fill;
    layouts.Items.AddRange(NativeLayout.All.Select(item=>new Entry(item.count.ToString(),item.count==1?L("Full page"):item.count+" "+L("per sheet"))));
    layouts.Items.Add(new Entry("id-card",L("ID card — 9 cm")));layouts.Reload();layouts.SelectedIndex = 0;
    var layoutPanel=new PrintGlassPanel{Dock=DockStyle.Top,Height=208,ColumnCount=1,RowCount=2,Padding=new Padding(8),Margin=new Padding(8,0,0,0)};layoutPanel.RowStyles.Add(new RowStyle(SizeType.Absolute,26));layoutPanel.RowStyles.Add(new RowStyle(SizeType.Percent,100));layoutPanel.Controls.Add(new Label{Text=L("Pages per sheet"),Font=new Font(Font,FontStyle.Bold),Dock=DockStyle.Fill,AutoEllipsis=true},0,0);
    layouts.AccessibleName = L("Layout");layouts.Margin=Padding.Empty;layoutPanel.Controls.Add(layouts,0,1);
    var montagePanel=new PrintFlowLayoutPanel{Dock=DockStyle.Top,Height=152,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new Padding(12,8,8,8)};
    foreach(var item in new[]{compact,actualSize,separatorLines}){item.AutoSize=true;item.Margin=new Padding(0,4,0,4);montagePanel.Controls.Add(item);}
    compact.Text=L("Compact layout");compact.AccessibleName=compact.Text;actualSize.Text=L("Preserve actual size");actualSize.AccessibleName=actualSize.Text;separatorLines.Text=L("Separation lines · 0.25 px");separatorLines.AccessibleName=separatorLines.Text;
    tips.SetToolTip(actualSize,L("Uses PDF page size or image DPI (96 DPI when missing)."));
    SetButton(separatorColorButton,L("Line color…"),delegate{using(var dialog=new ColorDialog{Color=separatorColor,FullOpen=true})if(dialog.ShowDialog(this)==DialogResult.OK){separatorColor=dialog.Color;Changed();}});separatorColorButton.AccessibleName=L("Line color…");montagePanel.Controls.Add(separatorColorButton);
    var layoutScroll=new Panel{Dock=DockStyle.Fill,AutoScroll=true,Margin=Padding.Empty};layoutScroll.Controls.Add(montagePanel);layoutScroll.Controls.Add(layoutPanel);work.Controls.Add(layoutScroll,1,0);work.SetRowSpan(layoutScroll,2);
    var navigation = new PrintFlowLayoutPanel { Dock=DockStyle.Fill,WrapContents=true,AutoSize=true,AutoSizeMode=AutoSizeMode.GrowAndShrink,Margin=new Padding(0,8,0,0) };
    SetButton(previous, "◀", delegate { if (sheetIndex > 0) { sheetIndex--; QueuePreview(); } }); SetButton(next, "▶", delegate { if ((sheetIndex + 1) * (Special ? 1 : PerSheet) < pageCount) { sheetIndex++; QueuePreview(); } }); previous.AccessibleName = L("Previous sheet"); next.AccessibleName = L("Next sheet"); previous.MinimumSize = next.MinimumSize = new Size(40, 28); previous.Width = next.Width = 40;
    count.AutoSize = true; count.Margin = new Padding(8); navigation.Controls.Add(count); navigation.Controls.Add(previous); navigation.Controls.Add(next); work.Controls.Add(navigation, 0, 1); root.Controls.Add(work, 0, 2);
    var bottom = new PrintGlassPanel { Dock=DockStyle.Fill,ColumnCount=1,RowCount=2,TabIndex=4,Padding=new Padding(8),Margin=new Padding(0,8,0,0) };bottom.RowStyles.Add(new RowStyle(SizeType.Absolute,48));bottom.RowStyles.Add(new RowStyle(SizeType.Percent,100));
    var totalsRow=new PrintTableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=1};totalsRow.RowStyles.Add(new RowStyle(SizeType.Percent,100));totalsRow.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));totalsRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
    var copiesGroup=new PrintFlowLayoutPanel{Dock=DockStyle.Fill,AutoSize=true,WrapContents=false,Margin=new Padding(0,8,24,0)};copiesGroup.Controls.Add(new Label{Text=L("Copies"),AutoSize=true,Margin=new Padding(0,6,8,0)});copies.Minimum=1;copies.Maximum=999;copies.Value=1;copies.Width=64;copies.AccessibleName=L("Copies");copiesGroup.Controls.Add(copies);totalsRow.Controls.Add(copiesGroup,0,0);
    SetButton(rotateSelected,L("Rotate selected"),RotateSelectedSource);navigation.Controls.Add(rotateSelected);tips.SetToolTip(rotateSelected,L("Rotate only the selected page or image."));
    imageCopiesGroup.AutoSize=true;imageCopiesGroup.WrapContents=false;imageCopiesGroup.Margin=new Padding(8,0,8,0);imageCopiesGroup.Controls.Add(new Label{Text=L("Image copies"),AutoSize=true,Margin=new Padding(0,8,6,0)});imageCopies.Minimum=1;imageCopies.Maximum=999;imageCopies.Value=1;imageCopies.Width=64;imageCopies.RightToLeft=RightToLeft.No;imageCopies.AccessibleName=L("Image copies");imageCopies.AccessibleDescription=L("Repeat the selected image on its own sheets.");tips.SetToolTip(imageCopies,imageCopies.AccessibleDescription);imageCopiesGroup.Controls.Add(imageCopies);navigation.Controls.Add(imageCopiesGroup);
    fill.Text=L("Fit to frame");fill.AutoSize=true;fill.Margin=new Padding(8,8,8,0);navigation.Controls.Add(fill);
    sameDirection.Text=L("Same direction");sameDirection.AutoSize=true;sameDirection.Visible=false;sameDirection.Margin=new Padding(8,8,8,0);navigation.Controls.Add(sameDirection);
    var driver = new PrintButtonControl();
    var menu = new PrintContextMenu();
    menu.Items.Add(L("Printer properties…"), null, DriverOptions);
    var rotateAll=new ToolStripMenuItem(L("Rotate all"));menu.Items.Add(rotateAll);
    foreach(int turn in new[]{0,1,2,3}){int selectedTurn=turn;var item=new ToolStripMenuItem((turn*90)+"°");item.Click+=delegate{RotateAllSources(selectedTurn);};rotateAll.DropDownItems.Add(item);}
    var margins=new ToolStripMenuItem(L("Margins"));menu.Items.Add(margins);
    foreach(int size in new[]{5,7,10,15,20}){int selectedSize=size;var item=new ToolStripMenuItem(size+" mm");item.Click+=delegate{marginMm=selectedSize;Changed();};margins.DropDownItems.Add(item);}
    var gaps=new ToolStripMenuItem(L("Cutting gap"));menu.Items.Add(gaps);
    foreach(int size in new[]{0,1,2,3,5,8,10}){int selectedSize=size;var item=new ToolStripMenuItem(size+" mm");item.Click+=delegate{gapMm=selectedSize;Changed();};gaps.DropDownItems.Add(item);}
    menu.Opening+=delegate{rotateAll.Enabled=margins.Enabled=gaps.Enabled=settingsReady&&!Special;foreach(ToolStripMenuItem item in rotateAll.DropDownItems)item.Checked=sourceRotations.All(turn=>item.Text==(turn*90)+"°")&&pageRotations.Values.All(turn=>item.Text==(turn*90)+"°");foreach(ToolStripMenuItem item in margins.DropDownItems)item.Checked=item.Text==marginMm+" mm";foreach(ToolStripMenuItem item in gaps.DropDownItems)item.Checked=item.Text==gapMm+" mm";};
    menu.Items.Add(L("Light appearance"),null,delegate{PrintTheme.Initialize(false);PrintTheme.Apply(this);});
    menu.Items.Add(L("Dark appearance"),null,delegate{PrintTheme.Initialize(true);PrintTheme.Apply(this);});
    menu.Items.Add(L("System appearance"),null,delegate{PrintTheme.Initialize();PrintTheme.Apply(this);});
    SetButton(driver, L("Options…"), delegate { menu.Show(driver, new Point(0,driver.Height)); });header.Controls.Add(driver,1,0);
    var refresh = new PrintButtonControl{Quiet=true}; SetButton(refresh, L("Refresh printers"), async delegate { await LoadPrinters(true); });header.Controls.Add(refresh,2,0);
    jobSummary.Dock=DockStyle.Fill;jobSummary.UseMnemonic=false;jobSummary.AccessibleRole=AccessibleRole.StaticText;jobSummary.AccessibleName=L("Page totals");jobSummary.Text=L("Counting pages…");jobSummary.Margin=new Padding(0,4,0,0);totalsRow.Controls.Add(jobSummary,1,0);bottom.Controls.Add(totalsRow,0,0);
    var footer = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1,Margin=Padding.Empty }; footer.RowStyles.Add(new RowStyle(SizeType.Percent,100));footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); footer.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); footer.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
    status.Dock = DockStyle.Fill; status.AutoEllipsis = true;status.UseMnemonic=false; status.AccessibleRole = AccessibleRole.StaticText; footer.Controls.Add(status, 0, 0);
    SetButton(print, L("Print"), async delegate { await Submit(); });((PrintButtonControl)print).Primary=true; print.Enabled = false; var cancel = new PrintButtonControl{Quiet=true}; SetButton(cancel, L("Cancel"), delegate { Close(); }); cancel.DialogResult = DialogResult.Cancel;
    footer.Controls.Add(cancel, 1, 0); footer.Controls.Add(print, 2, 0); bottom.Controls.Add(footer, 0, 1); root.Controls.Add(bottom, 0, 3);
    AcceptButton = print; CancelButton = cancel;
    count.RightToLeft=RightToLeft.No;copies.RightToLeft=RightToLeft.No;polaroid8.RightToLeft=polaroid9.RightToLeft=RightToLeft.No;
    copies.ValueChanged += delegate { if (!updating) QueuePageSummary(); };
    imageCopies.ValueChanged += async delegate { if(!updating&&!Special&&fileList.SelectedIndex>=0&&IsImage(args.Files[fileList.SelectedIndex])){int file=fileList.SelectedIndex,change=++copyChangeGeneration;sourceCopies[file]=(int)imageCopies.Value;print.Enabled=false;preview.Interactive=false;QueuePageSummary();try{var map=ExpandedPageMap(await Inventory());if(closing||change!=copyChangeGeneration||file!=fileList.SelectedIndex)return;int start,end;ImageRange(file,out start,out end);sheetIndex=map.Skip(start).Take(file-start).Sum(pages=>pages.Length)/PerSheet;QueuePreview();}catch(Exception error){if(!closing&&change==copyChangeGeneration){status.Text=error.Message;preview.Busy(error.Message);print.Enabled=false;}}} };
    color.Items.AddRange(new object[] { new Entry("color", L("Color")), new Entry("mono", L("Black & white")) }); color.SelectedIndex = 0;
    orientation.Items.AddRange(new object[] {new Entry("auto",L("Original orientation")), new Entry("portrait", L("Portrait")), new Entry("landscape", L("Landscape")) }); orientation.SelectedIndex = 0;
    printer.SelectedIndexChanged += async delegate { if (!updating) await SelectPrinter(); };
    paper.SelectedIndexChanged += delegate { if (!updating) { explicitProfile = null; UpdateProfiles(); ApplyAutomaticProfile(); Changed(); } };
    profiles.SelectedIndexChanged += async delegate { if (!updating) { string id=Selected(profiles);if(id=="manage"){UpdateProfiles();await ManagePresets();return;}if(id=="arrange"){UpdateProfiles();ArrangePresets();return;}if(id=="save"){UpdateProfiles();SavePrinterPreset();return;}await ChooseSavedProfile(id); } };
    profiles.DropDown+=delegate{if(settingsReady&&!updating)RefreshSavedPresetChoices();};
    color.SelectedIndexChanged += delegate { if (!updating) { ApplyAutomaticProfile(); Changed(); } };
    orientation.SelectedIndexChanged += delegate { if (!updating) Changed(); }; fill.CheckedChanged += delegate { if (!updating) {if(!Special){generalFill=fill.Checked;fillEdited=true;}Changed();} };
    combineFiles.CheckedChanged+=delegate{if(!updating){sheetIndex=0;Changed();}};
    sameDirection.CheckedChanged+=delegate{if(!updating)Changed();};
    compact.CheckedChanged+=delegate{if(!updating){if(compact.Checked)gapMm=0;Changed();}};
    actualSize.CheckedChanged+=delegate{if(!updating){updating=true;fill.Checked=actualSize.Checked?false:generalFill;updating=false;Changed();}};
    separatorLines.CheckedChanged+=delegate{if(!updating)Changed();};
    pageFilter.SelectedIndexChanged+=delegate{if(!updating){pageFilters[fileList.SelectedIndex]=Selected(pageFilter);SyncPageControls();sheetIndex=0;QueuePreview();}};
    pageRange.TextChanged+=delegate{if(!updating){pageRanges[fileList.SelectedIndex]=pageRange.Text;sheetIndex=0;QueuePreview();}};
    layouts.SelectedIndexChanged += delegate { if (!updating) {mode = SelectedLayout == "id-card" ? "id-card" : ""; if(!Special){updating=true;fill.Checked=generalFill;orientation.SelectedIndex=0;updating=false;}sheetIndex = 0; ApplyAutomaticProfile(); Changed(); } };
    layouts.RefreshRequested += delegate { if(!updating)QueuePreview(); };
    fileList.SelectedIndexChanged += async delegate { if (!updating) {
      SyncPageControls();int selected=fileList.SelectedIndex;
      if(!Special){try{var map=ExpandedPageMap(await Inventory());if(closing||selected!=fileList.SelectedIndex)return;int start,end;ImageRange(selected,out start,out end);sheetIndex=map.Skip(start).Take(selected-start).Sum(pages=>pages.Length)/PerSheet;QueuePreview();}catch(Exception error){if(!closing){status.Text=error.Message;print.Enabled=false;}}return;}
      sheetIndex=IsPolaroid&&activePolaroid!=null&&activePolaroid.Key==PolaroidKey()?activePolaroid.FileSheets[selected]:0;QueuePreview();
    } };
    Shown += async delegate { firstPaint = NativePrint.Clock.ElapsedMilliseconds;QueuePageSummary();var prime=PrimePreview();await LoadPrinters();if(args.Verify!=null&&!closing){await prime;await Verify();} };
    HandleCreated+=delegate{PrintTheme.Apply(this);};PrintTheme.Apply(this);
    FormClosing += delegate(object sender, FormClosingEventArgs e) { if (submitting) e.Cancel = true; else { RememberPrinterSettings();closing = true; } };
  }
  internal void PlaceInitialWindow(Rectangle work){
    var preferred=Size;var minimum=MinimumSize;
    // An exceptionally small work area takes priority over the usual minimum.
    if(work.Width<minimum.Width||work.Height<minimum.Height)MinimumSize=new Size(Math.Min(minimum.Width,work.Width),Math.Min(minimum.Height,work.Height));
    Bounds=NativePrint.InitialWindowBounds(work,preferred,minimum);
  }
  protected override void OnLoad(EventArgs e){PlaceInitialWindow(NativePrint.LaunchWorkingArea());base.OnLoad(e);}
  Control Field(string name, ComboBox combo) {
    var field = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, Margin = new Padding(0, 0, 12, 0) };
    field.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
    field.RowStyles.Add(new RowStyle(SizeType.Absolute, 22)); field.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
    field.Controls.Add(new Label { Text = L(name), Dock = DockStyle.Fill, AutoEllipsis = true }, 0, 0);
    combo.Dock = DockStyle.Top; combo.DropDownStyle = ComboBoxStyle.DropDownList; combo.AccessibleName = L(name); combo.DropDownWidth = 340; combo.Margin=new Padding(0,4,0,0);field.Controls.Add(combo, 0, 1); return field;
  }
  void SetButton(Button button, string label, EventHandler handler) { button.Text = label; button.AutoSize = true; button.MinimumSize = new Size(80,36);button.Margin=new Padding(0,0,8,0); button.Click += handler; }
  sealed class PrinterCapture {
    internal byte[] Bytes;internal PrintDocument Prepared;internal PaperSize[] Papers;internal PrinterResolution[] Resolutions;internal bool Color,Duplex;
  }
  readonly Dictionary<string,PrinterCapture> captures=new Dictionary<string,PrinterCapture>();
  async Task LoadPrinters(bool refresh=false) {
    RememberPrinterSettings();
    int refreshGeneration=++printerRefreshGeneration;++printerGeneration;++rendering;settingsReady=false;SetPrinterControlsEnabled(false);
    QueuePageSummary();
    print.Enabled = false; status.Text = L("Loading printers…");
    try {
      if(refresh){captures.Clear();driverCache.Clear();fingerprints.Clear();}
      string wanted = Selected(printer); var names = await Task.Run(() => PrinterSettings.InstalledPrinters.Cast<string>().ToList()); if (closing||refreshGeneration!=printerRefreshGeneration) return;
      try { preferences = File.Exists(Path.Combine(NativePrint.LocalRoot, "preferences.json")) ? NativePrint.Read(Path.Combine(NativePrint.LocalRoot, "preferences.json")) : new Dictionary<string, object>(); }
      catch { preferences = new Dictionary<string, object>(); }
      ReloadSavedProfiles();
      string preferred = NativePrint.Text(preferences, "defaultPrinter");
      string last="";try{var remembered=NativePrint.Read(Path.Combine(NativePrint.LocalRoot,"last-printer.json"));if(NativePrint.Text(remembered,"version")=="1")last=NativePrint.Text(remembered,"printer");}catch{}
      updating = true; printer.Items.Clear(); foreach (string name in names.OrderBy(n => n == preferred ? 0 : 1).ThenBy(n => n)) printer.Items.Add(new Entry(name, name));
      string initial = args.Initial == null ? "" : NativePrint.Text(args.Initial, "printer");
      int index=-1;foreach(string candidate in new[]{wanted,last,initial,preferred}){if(candidate=="")continue;index=printer.Items.Cast<Entry>().ToList().FindIndex(e=>e.Id==candidate);if(index>=0)break;}
      if (index < 0) { string system = new PrinterSettings().PrinterName; index = printer.Items.Cast<Entry>().ToList().FindIndex(e => e.Id == system); }
      printer.SelectedIndex = printer.Items.Count == 0 ? -1 : Math.Max(0, index); updating = false;
      if (printer.Items.Count == 0) { status.Text = L("No compatible printers found"); return; }
      await SelectPrinter(); printerReady = NativePrint.Clock.ElapsedMilliseconds;
    } catch (Exception error) { if(!closing&&refreshGeneration==printerRefreshGeneration){updating = false; status.Text = error.Message;} }
  }
  async Task SelectPrinter(Func<Task<PrinterCapture>> captureOverride=null) {
    RememberPrinterSettings();
    int selection=++printerGeneration;++rendering;settingsReady=false;SetPrinterControlsEnabled(false);
    QueuePageSummary();
    print.Enabled = false;
    string name = Selected(printer);
    try {
      PrinterCapture capture;
      if(!captures.TryGetValue(name,out capture)||captureOverride!=null){
        capture=captureOverride!=null?await captureOverride():await Task.Run(()=>{
          var bytes=FastPrintDriver.Capture(name,IntPtr.Zero,null,false);
          var document=new PrintDocument();try{
            document.PrinterSettings.PrinterName=name;FastPrintDriver.Apply(document,bytes);
            return new PrinterCapture{Bytes=bytes,Prepared=document,Papers=document.PrinterSettings.PaperSizes.Cast<PaperSize>().Where(item=>item.Kind==PaperKind.A4||item.Kind==PaperKind.A3).ToArray(),Resolutions=document.PrinterSettings.PrinterResolutions.Cast<PrinterResolution>().ToArray(),Color=FastPrintDriver.SupportsColor(document.PrinterSettings),Duplex=document.PrinterSettings.CanDuplex};
          }catch{document.Dispose();throw;}
        });
      }
      if (closing || selection!=printerGeneration || name != Selected(printer)){if(capture.Prepared!=null){capture.Prepared.Dispose();capture.Prepared=null;}return;}
      if(!captures.ContainsKey(name)){captures[name]=capture;driverCache[name]=capture.Bytes;}
      canColor=capture.Color;canDuplex=capture.Duplex;
      var nextDocument=capture.Prepared;capture.Prepared=null;var selectedBytes=driverCache[name];
      if(nextDocument==null)nextDocument=await Task.Run(()=>{var document=new PrintDocument();try{document.PrinterSettings.PrinterName=name;FastPrintDriver.Apply(document,selectedBytes);return document;}catch{document.Dispose();throw;}});
      if(closing||selection!=printerGeneration||name!=Selected(printer)){nextDocument.Dispose();return;}
      if (settings != null) settings.Dispose();settings=nextDocument;appliedDriverBytes=selectedBytes;appliedSavedSnapshot=null;
      updating = true; paper.Items.Clear(); foreach (PaperSize size in capture.Papers) paper.Items.Add(new Entry(size.Kind.ToString(), size.Kind.ToString(), size));
      int a4 = paper.Items.Cast<Entry>().ToList().FindIndex(item => item.Id == "A4");
      paper.SelectedIndex = paper.Items.Count == 0 ? -1 : Math.Max(0, a4);
      quality.Items.Clear(); quality.Items.Add(new Entry("default", L("Automatic")));
      foreach (PrinterResolution resolution in capture.Resolutions) quality.Items.Add(new Entry(resolution.Kind + ":" + resolution.X + ":" + resolution.Y, resolution.Kind == PrinterResolutionKind.Custom ? resolution.X + " × " + resolution.Y + " dpi" : resolution.Kind.ToString(), resolution)); quality.SelectedIndex = 0;
      color.Items.Clear(); if (canColor) color.Items.Add(new Entry("color", L("Color"))); color.Items.Add(new Entry("mono", L("Black & white"))); color.SelectedIndex = 0;
      mode = ""; layouts.SelectedIndex = 0; orientation.SelectedIndex = 0;orientationLayout=0;
      explicitProfile = null; updating = false; UpdateProfiles(); ApplyAutomaticProfile();
      RestorePrinterSettings(name);
      if (!initialApplied && args.Initial != null) {
        initialApplied = true; updating = true;
        string initialPaper = NativePrint.Text(args.Initial, "paper", "A4");
        for(int i=0;i<paper.Items.Count;i++)if(((Entry)paper.Items[i]).Id==initialPaper)paper.SelectedIndex=i;
        color.SelectedIndex = NativePrint.Flag(args.Initial,"color") && canColor ? 0 : color.Items.Count-1;
        mode = NativePrint.Text(args.Initial,"mode"); string layout=mode=="id-card"?"id-card":NativePrint.Text(args.Initial,"pagesPerSheet","1");
        layouts.SelectedIndex=layouts.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==layout);
        explicitProfile=NativePrint.Text(args.Initial,"printer")==Selected(printer)?NativePrint.Text(args.Initial,"profileId"):null;if(explicitProfile=="")explicitProfile=null;
        if(!Special){if(NativePrint.Flag(args.Initial,"autoOrientation"))orientation.SelectedIndex=0;else if(args.Initial.ContainsKey("landscape"))SetOrientation(NativePrint.Flag(args.Initial,"landscape"));}
        updating=false;UpdateProfiles();ApplyAutomaticProfile();
      }
      settingsReady=true;SetPrinterControlsEnabled(true);NativePrint.RememberPrinter(name);Changed();
      if(paper.SelectedIndex<0)status.Text=L("No compatible printers found");
    } catch (Exception error) { if(!closing&&selection==printerGeneration){settingsReady=false;updating = false;status.Text = error.Message;preview.Busy(error.Message);print.Enabled=false;} }
  }
  string DriverFingerprint(string name){string fingerprint;if(!fingerprints.TryGetValue(name,out fingerprint)){fingerprint=FastPrintDriver.Fingerprint(name);fingerprints[name]=fingerprint;}return fingerprint;}
  void RememberPrinterSettings(){
    if(!settingsReady||settings==null||appliedProfile=="invalid"||paper.SelectedItem==null)return;
    try{
      string name=settings.PrinterSettings.PrinterName;
      var profile=saved.FirstOrDefault(item=>NativePrint.Text(item,"id")==appliedProfile&&NativePrint.Text(item,"printer")==name);
      using(var document=new PrintDocument()){
        document.PrinterSettings.PrinterName=name;FastPrintDriver.Apply(document,FastPrintDriver.FromDocument(settings));
        document.DefaultPageSettings.PaperSize=(PaperSize)((Entry)paper.SelectedItem).Value;
        document.DefaultPageSettings.Color=Selected(color)=="color";document.DefaultPageSettings.Landscape=Landscape;
        var resolution=quality.SelectedItem as Entry;if(resolution!=null&&resolution.Value!=null)document.DefaultPageSettings.PrinterResolution=(PrinterResolution)resolution.Value;
        // A print quantity belongs to the current job, not the remembered driver setup.
        document.PrinterSettings.Copies=1;if(IsPolaroid&&canDuplex)document.PrinterSettings.Duplex=Duplex.Simplex;
        NativeLastSettings.Save(new Dictionary<string,object>{{"printer",name},{"driverFingerprint",DriverFingerprint(name)},{"paper",Selected(paper)},{"color",Selected(color)=="color"},{"orientation",Selected(orientation)},{"quality",Selected(quality)},{"copies",1},{"profileId",profile==null?"current":NativePrint.Text(profile,"id")},{"profileStamp",profile==null?"":NativeLastSettings.ProfileStamp(profile)}},FastPrintDriver.FromDocument(document));
      }
    }catch(Exception error){Trace.WriteLine("Fast Print could not remember printer options: "+error.Message);}
  }
  bool RestorePrinterSettings(string name){
    try{
      byte[] bytes;var data=NativeLastSettings.Read(name,DriverFingerprint(name),out bytes);if(data==null)return false;
      string profileId=NativePrint.Text(data,"profileId");var profile=saved.FirstOrDefault(item=>NativePrint.Text(item,"id")==profileId&&NativePrint.Text(item,"printer")==name);
      if(profileId!="current"&&(profile==null||NativeLastSettings.ProfileStamp(profile)!=NativePrint.Text(data,"profileStamp")))return false;
      int stock=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==NativePrint.Text(data,"paper"));
      if(stock<0||NativePrint.Flag(data,"color")&&!canColor)return false;
      // Validate before touching the live job or its cached device defaults.
      using(var document=new PrintDocument()){document.PrinterSettings.PrinterName=name;FastPrintDriver.Apply(document,bytes);if(document.DefaultPageSettings.PaperSize.Kind.ToString()!=NativePrint.Text(data,"paper"))return false;}
      FastPrintDriver.Apply(settings,bytes);settings.PrinterSettings.Copies=(short)copies.Value;var currentBytes=FastPrintDriver.FromDocument(settings);driverCache[name]=currentBytes;appliedDriverBytes=currentBytes;appliedSavedSnapshot=profile==null?null:NativePrint.Text(profile,"driverSettings");
      updating=true;paper.SelectedIndex=stock;color.SelectedIndex=NativePrint.Flag(data,"color")&&canColor?0:color.Items.Count-1;
      int resolution=quality.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==NativePrint.Text(data,"quality"));quality.SelectedIndex=Math.Max(0,resolution);
      orientation.SelectedIndex=orientation.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==NativePrint.Text(data,"orientation"));
      explicitProfile=profileId;appliedProfile=profile==null?null:profileId;profileError=null;updating=false;UpdateProfiles();return true;
    }catch{updating=false;return false;}
  }
  void SetPrinterControlsEnabled(bool enabled){paper.Enabled=quality.Enabled=color.Enabled=profiles.Enabled=orientation.Enabled=fill.Enabled=rotateSelected.Enabled=sameDirection.Enabled=combineFiles.Enabled=imageCopies.Enabled=enabled;layouts.Enabled=enabled;polaroid8.Enabled=polaroid9.Enabled=enabled;}
  void ReloadSavedProfiles(){
    var loaded=new List<Dictionary<string,object>>();string directory=Path.Combine(NativePrint.LocalRoot,"profiles");
    if(Directory.Exists(directory))foreach(string file in Directory.GetFiles(directory,"*.json"))try{
      var value=NativePrint.Read(file);string id=NativePrint.Text(value,"id");
      if(NativePrint.Text(value,"version")=="1"&&System.Text.RegularExpressions.Regex.IsMatch(id,@"^[a-f0-9]{32}$")&&Path.GetFileNameWithoutExtension(file)==id&&NativePrint.Text(value,"name")!=""&&NativePrint.Text(value,"printer")!="")loaded.Add(value);
    }catch{}
    saved.Clear();saved.AddRange(loaded);
  }
  void RefreshSavedPresetChoices(){
    var active=saved.FirstOrDefault(item=>NativePrint.Text(item,"id")==explicitProfile);string previous=active==null?null:NativePrint.Json.Serialize(active);
    ReloadSavedProfiles();UpdateProfiles();
    if(previous!=null){
      var next=saved.FirstOrDefault(item=>NativePrint.Text(item,"id")==explicitProfile);
      if(next==null||NativePrint.Text(next,"printer")!=Selected(printer)){
        explicitProfile="current";appliedProfile="invalid";profileError=L("The saved preset changed. Choose a preset again.");print.Enabled=false;status.Text=profileError;UpdateProfiles();
      }else if(previous!=NativePrint.Json.Serialize(next))SelectSavedProfile(explicitProfile);
    }
  }
  void UpdateProfiles() {
    updating = true; profiles.Items.Clear(); profiles.Items.Add(new Entry("auto", saved.Count==0?L("Automatic")+" — "+L("No saved printer presets"):L("Automatic")));
    if(explicitProfile=="current")profiles.Items.Add(new Entry("current",L("Current printer options")));
    var positions=NativePresetOrder.AllPositions();
    Func<Dictionary<string,object>,int> rank=profile=>{Dictionary<string,int> order;int index;return positions.TryGetValue(NativePrint.Text(profile,"printer"),out order)&&order.TryGetValue(NativePrint.Text(profile,"id"),out index)?index:int.MaxValue;};
    foreach (var profile in saved.Where(p => !IsPolaroid || NativePrint.Text(p,"paper")=="A4"&&NativePrint.Flag(p,"color")).OrderBy(p=>NativePrint.Text(p,"printer")==Selected(printer)?0:1).ThenBy(p=>NativePrint.Text(p,"printer")).ThenBy(rank).ThenBy(p=>NativePrint.Text(p,"name")).ThenBy(p=>NativePrint.Text(p,"id"),StringComparer.Ordinal)) profiles.Items.Add(new Entry(NativePrint.Text(profile, "id"), NativePrint.Text(profile, "name")+" · "+NativePrint.Text(profile,"printer")+" · "+NativePrint.Text(profile,"paper")+" · "+NativePrint.Text(profile,"tray"),NativePrint.Text(profile,"name")));
    profiles.DropDownWidth=Math.Max(520,profiles.Width);
    profiles.Items.Add(new Entry("save",L("Save printer preset…")));profiles.Items.Add(new Entry("arrange",L("Arrange presets…")));profiles.Items.Add(new Entry("manage",L("Manage saved presets…")));
    profiles.SelectedIndex = 0; if (explicitProfile != null) for (int i = 1; i < profiles.Items.Count; i++) if (((Entry)profiles.Items[i]).Id == explicitProfile) profiles.SelectedIndex = i;
    tips.SetToolTip(profiles,profiles.SelectedItem==null?"":profiles.SelectedItem.ToString());
    updating = false;
  }
  async Task ChooseSavedProfile(string id){
    try{
      var profile=saved.FirstOrDefault(item=>NativePrint.Text(item,"id")==id);
      if(profile!=null&&NativePrint.Text(profile,"printer")!=Selected(printer)){
        string owner=NativePrint.Text(profile,"printer");int target=printer.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==owner);
        if(target<0)throw new InvalidOperationException(L("This preset's printer is unavailable. Install it, then refresh printers."));
        string keptMode=mode,keptOrientation=Selected(orientation);int keptLayout=layouts.SelectedIndex;decimal keptCopies=copies.Value;
        bool keptFill=fill.Checked,keptGeneralFill=generalFill,keptFillEdited=fillEdited;int keptDirection=orientationLayout;
        updating=true;printer.SelectedIndex=target;updating=false;int generation=printerGeneration+1;await SelectPrinter();
        if(closing||generation!=printerGeneration||Selected(printer)!=owner||!settingsReady)return;
        updating=true;mode=keptMode;layouts.SelectedIndex=keptLayout;orientation.SelectedIndex=orientation.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==keptOrientation);copies.Value=keptCopies;fill.Checked=keptFill;generalFill=keptGeneralFill;fillEdited=keptFillEdited;orientationLayout=keptDirection;updating=false;
        if(IsPolaroid&&!canColor)throw new InvalidOperationException(L("Polaroid requires A4 and color. Keep these settings in printer properties."));
      }
      SelectSavedProfile(id);UpdateProfiles();
    }catch(Exception error){updating=false;explicitProfile=id;appliedProfile="invalid";profileError=error.Message;print.Enabled=false;status.Text=error.Message;retainedPreviewKey=null;UpdateProfiles();}
  }
  void ArrangePresets(){
    try{
      NativePresetOrder.Positions(Selected(printer),true);
      var positions=NativePresetOrder.Positions(Selected(printer));
      var entries=saved.Where(item=>NativePrint.Text(item,"printer")==Selected(printer)).OrderBy(item=>positions.ContainsKey(NativePrint.Text(item,"id"))?positions[NativePrint.Text(item,"id")]:int.MaxValue).ThenBy(item=>NativePrint.Text(item,"name")).Select(item=>new Entry(NativePrint.Text(item,"id"),NativePrint.Text(item,"name")+" · "+NativePrint.Text(item,"paper")+" · "+NativePrint.Text(item,"tray"))).ToArray();
      using(var dialog=new PresetOrderDialog(Selected(printer),entries,L,Font,args.Language=="ar",explicitProfile)){if(dialog.ShowDialog(this)==DialogResult.OK)UpdateProfiles();}
    }catch(Exception error){MessageBox.Show(this,L(error.Message),L("Fast Print"),MessageBoxButtons.OK,MessageBoxIcon.Error);}
  }
  void SelectSavedProfile(string id){
    var profile=saved.FirstOrDefault(item=>NativePrint.Text(item,"id")==id);
    if(profile!=null){
      string stock=NativePrint.Text(profile,"paper");int index=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);
      if(index<0){status.Text=L("This printer does not support the preset paper.");UpdateProfiles();return;}
      updating=true;paper.SelectedIndex=index;quality.SelectedIndex=0;color.SelectedIndex=NativePrint.Flag(profile,"color")&&canColor?0:color.Items.Count-1;updating=false;
    }
    appliedDriverBytes=null;appliedSavedSnapshot=null;explicitProfile=id=="auto"?null:id;ApplyAutomaticProfile();tips.SetToolTip(profiles,profile==null?L("Automatic"):NativePrint.Text(profile,"name")+" · "+NativePrint.Text(profile,"paper")+" · "+NativePrint.Text(profile,"tray"));Changed();
  }
  Dictionary<string,object> StorePrinterPreset(string name,byte[] bytes){
    name=name.Trim();if(name.Length==0||name.Length>100)throw new InvalidOperationException(L("Give this preset a name."));
    string id=Guid.NewGuid().ToString("N");
    using(var document=new PrintDocument()){
      document.PrinterSettings.PrinterName=Selected(printer);FastPrintDriver.Apply(document,bytes);var page=document.DefaultPageSettings;
      string error=DriverSelectionError(page.PaperSize.Kind,page.Color);if(error!=null)throw new InvalidOperationException(error);
      var profile=new Dictionary<string,object>{{"version",1},{"id",id},{"name",name},{"printer",Selected(printer)},{"paper",page.PaperSize.Kind.ToString()},{"color",page.Color},{"landscape",page.Landscape},{"tray",page.PaperSource.SourceName},{"trayId",page.PaperSource.RawKind},{"duplex",document.PrinterSettings.Duplex.ToString()},{"paperWidthMm",page.PaperSize.Width*.254},{"paperHeightMm",page.PaperSize.Height*.254},{"copies",document.PrinterSettings.Copies},{"defaultBypassFaceUp",false},{"notes",""},{"savedAt",DateTime.UtcNow.ToString("o")},{"driverFingerprint",FastPrintDriver.Fingerprint(Selected(printer))},{"driverSettings",Convert.ToBase64String(ProtectedData.Protect(bytes,null,DataProtectionScope.CurrentUser))}};
      string directory=Path.Combine(NativePrint.LocalRoot,"profiles");Directory.CreateDirectory(directory);string temporary=Path.Combine(directory,id+".tmp");
      File.WriteAllText(temporary,NativePrint.Json.Serialize(profile),new UTF8Encoding(false));File.Move(temporary,Path.Combine(directory,id+".json"));saved.Add(profile);return profile;
    }
  }
  void SavePrinterPreset(string proof=null){
    if(!settingsReady)return;
    using(var dialog=new Form{Text=L("Save printer preset…"),Size=new Size(620,290),MinimumSize=new Size(620,290),StartPosition=FormStartPosition.CenterParent,Font=Font,RightToLeft=RightToLeft,RightToLeftLayout=RightToLeftLayout}){
      var root=new PrintTableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(16),ColumnCount=1,RowCount=4};root.RowStyles.Add(new RowStyle(SizeType.Absolute,64));root.RowStyles.Add(new RowStyle(SizeType.Percent,100));root.RowStyles.Add(new RowStyle(SizeType.Absolute,40));root.RowStyles.Add(new RowStyle(SizeType.Absolute,40));dialog.Controls.Add(root);
      var name=new TextBox{Dock=DockStyle.Fill,MaxLength=100,AccessibleName=L("Preset name")};name.Text=Selected(paper)+" - "+settings.DefaultPageSettings.PaperSource.SourceName;
      var field=new PrintTableLayoutPanel{Dock=DockStyle.Fill,RowCount=2};field.Controls.Add(new Label{Text=L("Preset name"),AutoSize=true},0,0);field.Controls.Add(name,0,1);root.Controls.Add(field,0,0);
      var info=new Label{Dock=DockStyle.Fill,Text=L("Set paper size, tray, weight and output in Printer properties before saving."),AutoEllipsis=true};root.Controls.Add(info,0,1);
      var configure=new PrintButtonControl();SetButton(configure,L("Printer properties…"),DriverOptions);root.Controls.Add(configure,0,2);
      var actions=new PrintFlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.RightToLeft};var save=new PrintButtonControl{Primary=true};var cancel=new PrintButtonControl{Quiet=true,DialogResult=DialogResult.Cancel};
      SetButton(save,L("Save"),delegate{try{ApplyControls();var bytes=FastPrintDriver.Capture(Selected(printer),IntPtr.Zero,FastPrintDriver.FromDocument(settings),false);var profile=StorePrinterPreset(name.Text,bytes);explicitProfile=NativePrint.Text(profile,"id");UpdateProfiles();SelectSavedProfile(explicitProfile);dialog.DialogResult=DialogResult.OK;}catch(Exception error){MessageBox.Show(dialog,error.Message,L("Fast Print"),MessageBoxButtons.OK,MessageBoxIcon.Error);}});
      SetButton(cancel,L("Cancel"),delegate{dialog.Close();});actions.Controls.Add(save);actions.Controls.Add(cancel);root.Controls.Add(actions,0,3);dialog.AcceptButton=save;dialog.CancelButton=cancel;PrintTheme.Apply(dialog);if(proof!=null){NativePrint.Capture(dialog,proof);return;}dialog.ShowDialog(this);
    }
  }
  void ApplyAutomaticProfile() {
    if (settings == null) return;
    string option = IsPolaroid ? mode : mode == "id-card" ? "id:" + Selected(paper) + ":" + (Selected(color) == "color" ? "color" : "mono") : "fast:" + Selected(paper) + ":" + (Selected(color) == "color" ? "color" : "mono") + ":" + PerSheet;
    string id = explicitProfile; var all = NativePrint.Map(preferences, "profiles"); var assignments = all == null ? null : NativePrint.Map(all, Selected(printer));
    if (id == null && assignments != null) { string assigned = NativePrint.Text(assignments, option); if (assigned != "") id = assigned; }
    var profile = id == null ? saved.Where(p => NativePrint.Text(p, "printer") == Selected(printer) && NativePrint.Text(p, "paper") == Selected(paper) && NativePrint.Flag(p, "defaultBypassFaceUp")).OrderByDescending(p => NativePrint.Text(p, "savedAt")).FirstOrDefault() : saved.FirstOrDefault(p => NativePrint.Text(p, "id") == id);
    try {
      if (profile != null) {
        if (NativePrint.Text(profile, "printer") != Selected(printer) || NativePrint.Text(profile, "paper") != Selected(paper)) throw new InvalidOperationException("This saved preset does not match the printer and paper.");
        string fingerprint;if(!fingerprints.TryGetValue(Selected(printer),out fingerprint)){fingerprint=FastPrintDriver.Fingerprint(Selected(printer));fingerprints[Selected(printer)]=fingerprint;}
        if (NativePrint.Text(profile, "driverFingerprint") != fingerprint) throw new InvalidOperationException("This printer driver has changed. Capture the saved preset again.");
        string snapshot=NativePrint.Text(profile,"driverSettings");if(appliedSavedSnapshot!=snapshot){var bytes=ProtectedData.Unprotect(Convert.FromBase64String(snapshot),null,DataProtectionScope.CurrentUser);FastPrintDriver.Apply(settings,bytes);appliedSavedSnapshot=snapshot;appliedDriverBytes=null;}
      } else { if (id != null && id!="current") throw new InvalidOperationException("This saved preset was removed. Refresh printers."); var bytes=driverCache[Selected(printer)];if(!object.ReferenceEquals(appliedDriverBytes,bytes)||appliedSavedSnapshot!=null){FastPrintDriver.Apply(settings,bytes);appliedDriverBytes=bytes;appliedSavedSnapshot=null;} }
      appliedProfile = profile == null ? null : NativePrint.Text(profile, "id");profileError=null;
      updating = true; if(Special)SetOrientation(settings.DefaultPageSettings.Landscape); updating = false;
    } catch (Exception error) { appliedDriverBytes=null;appliedSavedSnapshot=null;updating = false; status.Text = error.Message;profileError=error.Message; appliedProfile = "invalid"; }
  }
  void ChoosePolaroid(int count) {
    if (!settingsReady || settings == null || !canColor) return;
    updating = true; mode = "polaroid-" + count; layouts.ClearSelected();fileList.SelectedIndex=0;
    for (int i = 0; i < paper.Items.Count; i++) if (((Entry)paper.Items[i]).Id == "A4") paper.SelectedIndex = i;
    color.SelectedIndex = 0; fill.Checked = false; updating = false; explicitProfile = null; UpdateProfiles(); ApplyAutomaticProfile(); sheetIndex = 0; Changed();
  }
  int PageTurns(int source,int page){int turns;return pageRotations.TryGetValue(Tuple.Create(source,page),out turns)?turns:sourceRotations[source];}
  string RotationKey(){return string.Join(",",sourceRotations)+"|"+string.Join(";",pageRotations.OrderBy(item=>item.Key.Item1).ThenBy(item=>item.Key.Item2).Select(item=>item.Key.Item1+":"+item.Key.Item2+":"+item.Value));}
  void RotateAllSources(int turns){pageRotations.Clear();for(int i=0;i<sourceRotations.Length;i++)sourceRotations[i]=turns;Changed();}
  void RotateSelectedSource(object sender,EventArgs e){
    if(Special)return;int index=fileList.SelectedIndex;
    if(IsImage(args.Files[index])){if(pageRotations.ContainsKey(Tuple.Create(index,0)))pageRotations[Tuple.Create(index,0)]=(PageTurns(index,0)+1)%4;else sourceRotations[index]=(sourceRotations[index]+1)%4;}
    else{if(!preview.Interactive||preview.SelectedItem<0||preview.SelectedItem>=preview.Items.Length)return;var selected=preview.Items[preview.SelectedItem];if(selected.Source!=index)return;pageRotations[Tuple.Create(index,selected.Page)]=(PageTurns(index,selected.Page)+1)%4;}
    Changed();
  }
  void SelectPreviewItem(int item){
    if(Special||!settingsReady||!preview.Interactive||item<0||item>=preview.Items.Length)return;
    try{if(visibleSourceVersion!=SourceVersion()){QueuePreview();return;}}catch(Exception error){preview.Interactive=false;print.Enabled=false;status.Text=error.Message;return;}
    int source=preview.Items[item].Source;
    updating=true;fileList.SelectedIndex=source;updating=false;SyncPageControls();
    preview.AccessibleName=L("Source preview")+" · "+preview.Items[item].Name;
    UpdateSelectionStatus();retainedPreviewKey=PreviewKey(visibleSourceVersion);retainedPreviewStatus=status.Text;selectionReuses++;preview.Invalidate();
  }
  void UpdateSelectionStatus(){
    if(Special||preview.Sheet==null||preview.SelectedItem<0||preview.SelectedItem>=preview.Items.Length)return;
    var item=preview.Items[preview.SelectedItem];status.Text=appliedProfile=="invalid"?profileError:Path.GetFileName(args.Files[item.Source]);
    if(appliedProfile!="invalid"){
      if(!IsImage(args.Files[item.Source]))status.Text+=" · "+L("page")+" "+(item.Page+1);
      float physicalWidth=Selected(paper)=="A3"?(Landscape?420:297):(Landscape?297:210);
      float physicalHeight=Selected(paper)=="A3"?(Landscape?297:420):(Landscape?210:297);
      status.Text+=" · "+L("Slot size")+": "+(item.Bounds.Width*physicalWidth/preview.Sheet.Width).ToString("0.0",CultureInfo.InvariantCulture)+" × "+(item.Bounds.Height*physicalHeight/preview.Sheet.Height).ToString("0.0",CultureInfo.InvariantCulture)+" mm · "+L("Rotation")+": "+(item.Turns*90)+"°";
    }
    tips.SetToolTip(status,status.Text);
  }
  void Changed() {
    SyncPageControls();
    if(!Special&&orientationLayout!=PerSheet){
      updating=true;int selected=orientation.SelectedIndex;orientation.Items[0]=new Entry("auto",L(PerSheet==1?"Original orientation":"Preset direction"));orientation.SelectedIndex=selected;
      if(!fillEdited){generalFill=PerSheet>1&&args.Files.All(IsImage);fill.Checked=generalFill;}
      orientationLayout=PerSheet;updating=false;
    }else if(Special)orientationLayout=0;
    if(!Special&&actualSize.Checked&&fill.Checked){updating=true;fill.Checked=false;updating=false;}
    bool compatible = settingsReady && settings != null && canColor && paper.Items.Cast<Entry>().Any(e => e.Id == "A4");
    compact.Enabled=actualSize.Enabled=separatorLines.Enabled=settingsReady&&!Special;
    separatorColorButton.Enabled=settingsReady&&!Special&&separatorLines.Checked;
    separatorColorButton.Text=L("Line color…")+" "+ColorTranslator.ToHtml(separatorColor);
    polaroid8.Enabled = polaroid9.Enabled = compatible; paper.Enabled = color.Enabled = settingsReady&&!IsPolaroid; orientation.Enabled = settingsReady&&!Special; fill.Enabled = rotateSelected.Enabled = sameDirection.Enabled = settingsReady&&!Special;sameDirection.Visible=!Special&&PerSheet>1;combineFiles.Visible=!Special&&args.Files.Count>1;combineFiles.Enabled=settingsReady&&!Special;
    ((PrintButtonControl)polaroid8).Selected=mode=="polaroid-8";((PrintButtonControl)polaroid9).Selected=mode=="polaroid-9";
    fill.Enabled=settingsReady&&!Special&&!actualSize.Checked;
    if(IsPolaroid){updating=true;SetOrientation(mode=="polaroid-8");updating=false;}
    print.Text = mode == "id-card" ? L("Review ID…") : L("Print"); QueuePreview();
  }
  async void QueuePreview() { int request=rendering+1;try { await RenderPreview(); } catch (Exception error) { if (!closing&&request==rendering) { status.Text = L(error.Message);preview.Busy(status.Text);print.Enabled = false; } } }
  Task<string> PreparedFile(string path) {
    string version=SourceVersion(path);
    Task<string> existing;
    if(preparing.TryGetValue(version,out existing) && !existing.IsFaulted && !existing.IsCanceled && (!existing.IsCompleted || File.Exists(existing.Result)))return existing;
    var task=PrepareFileCore(path,version);preparing[version]=task;return task;
  }
  async Task<string> PrepareFileCore(string path,string version) {
    string result; if (converted.TryGetValue(version, out result) && File.Exists(result)) return result;
    string ext = Path.GetExtension(path).ToLowerInvariant();
    if (ext == ".docx") {
      status.Text = L("Preparing Word document…"); string directory = Path.Combine(session, "word", Guid.NewGuid().ToString("N")); Directory.CreateDirectory(directory); result = Path.Combine(directory, Path.GetFileNameWithoutExtension(path) + ".pdf");
      string office = NativePrint.FindOffice(); Process process;
      if (office != null) process = NativePrint.Start(File.Exists(Path.ChangeExtension(office,".com"))?Path.ChangeExtension(office,".com"):office, new[] { "-env:UserInstallation=" + new Uri(Path.Combine(directory, "office-profile")).AbsoluteUri, "--headless", "--convert-to", "pdf", "--outdir", directory, path });
      else if (NativePrint.HasWord) process = NativePrint.Start(Application.ExecutablePath, new[] { "--convert-docx", path, result });
      else throw new InvalidOperationException("DOCX preview requires Microsoft Word or LibreOffice. Install either application, then try again.");
      using (process) {
        bool exited = await Task.Run(() => process.WaitForExit(90000));
        if (!exited) { process.Kill(); throw new InvalidOperationException("Word conversion timed out. The original document was not changed."); }
        if (process.ExitCode != 0 || !File.Exists(result)) throw new InvalidOperationException("The Word document could not be converted to PDF.");
      }
    } else if(ext==".pdf")result=await PdfSnapshot(path);
    else if (ext == ".tif" || ext == ".tiff" || ext == ".bmp") {
      string directory=Path.Combine(session,"images",Guid.NewGuid().ToString("N"));Directory.CreateDirectory(directory);
      result = Path.Combine(directory,Path.GetFileNameWithoutExtension(path)+".png");
      using (var image = Image.FromFile(path)) {
        if (image.FrameDimensionsList.Length > 0 && image.GetFrameCount(new FrameDimension(image.FrameDimensionsList[0])) > 1) throw new InvalidOperationException("Convert this multi-page TIFF to PDF before printing so every page is retained.");
        image.Save(result, ImageFormat.Png);
      }
    } else result = path;
    if(SourceVersion(path)!=version)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
    converted[version] = result; return result;
  }
  Task<string> PdfSnapshot(string path){
    string folder=Path.Combine(session,"pdf");
    if(Path.GetFullPath(path).StartsWith(folder+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))return Task.FromResult(path);
    string version=SourceVersion(path);Task<string> existing;
    if(pdfSnapshots.TryGetValue(version,out existing)&&!existing.IsFaulted&&!existing.IsCanceled&&(!existing.IsCompleted||File.Exists(existing.Result)))return existing;
    string directory=Path.Combine(folder,Guid.NewGuid().ToString("N")),snapshot=Path.Combine(directory,Path.GetFileName(path));
    var task=Task.Run(()=>{Directory.CreateDirectory(directory);File.Copy(path,snapshot);if(SourceVersion(path)!=version)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));return snapshot;});
    pdfSnapshots[version]=task;return task;
  }
  async Task<PdfDocument> OpenPdfDocument(string path){pdfDocumentLoads++;return await PdfDocument.LoadFromFileAsync(await StorageFile.GetFileFromPathAsync(await PdfSnapshot(path)));}
  Task<PdfDocument> CachedPdfDocument(string path){
    string key=SourceVersion(path);Task<PdfDocument> document;
    if(!pdfDocuments.TryGetValue(key,out document)||document.IsFaulted||document.IsCanceled){document=OpenPdfDocument(path);pdfDocuments[key]=document;}
    pdfDocumentOrder.Remove(key);pdfDocumentOrder.AddLast(key);
    while(pdfDocumentOrder.Count>4){string oldest=pdfDocumentOrder.First.Value;pdfDocumentOrder.RemoveFirst();pdfDocuments.Remove(oldest);}
    return document;
  }
  async Task<int> PdfPages(string path){return (int)(await CachedPdfDocument(path)).PageCount;}
  async Task<int> CountSourcePages(string file,string version){
    if(closing)throw new OperationCanceledException();
    string extension=Path.GetExtension(file).ToLowerInvariant();if(extension==".tif"||extension==".tiff")await PreparedFile(file);
    int pages=IsImage(file)?1:await PdfPages(await PreparedFile(file));
    if(SourceVersion(file)!=version)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
    return pages;
  }
  async Task<PageInventory> CountPages(string key){
    var counts=new int[args.Files.Count];
    for(int i=0;i<counts.Length;i++){
      if(closing)throw new OperationCanceledException();
      string file=args.Files[i],version=SourceVersion(file);Task<int> task;
      if(!sourcePageCounts.TryGetValue(version,out task)||task.IsFaulted||task.IsCanceled){task=CountSourcePages(file,version);sourcePageCounts[version]=task;}
      counts[i]=await task;
    }
    if(SourceVersion()!=key)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
    return new PageInventory{Key=key,Counts=counts};
  }
  Task<PageInventory> Inventory(string knownVersion=null){
    string key=knownVersion??SourceVersion();
    if(inventoryTask==null||inventoryKey!=key||inventoryTask.IsFaulted||inventoryTask.IsCanceled){inventoryKey=key;inventoryTask=CountPages(key);}
    return inventoryTask;
  }
  void SyncPageControls(){
    bool wasUpdating=updating;updating=true;
    try{int file=fileList.SelectedIndex;pageFilter.SelectedIndex=pageFilter.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==pageFilters[file]);pageRange.Text=pageRanges[file]??"";pageFilter.Enabled=!Special;pageRangeLabel.Visible=pageRange.Visible=pageRangeLabel.Enabled=pageRange.Enabled=!Special&&pageFilters[file]=="range";imageCopiesGroup.Visible=!Special&&IsImage(args.Files[file]);imageCopies.Enabled=settingsReady&&!Special&&IsImage(args.Files[file]);imageCopies.Value=sourceCopies[file];}
    finally{updating=wasUpdating;}
  }
  string PageSelectionKey(){return string.Join(";",pageFilters.Zip(pageRanges,(filter,range)=>filter+":"+range))+"|"+string.Join(",",sourceCopies);}
  int[] SelectedPages(int file,int total){
    string filter=Special?"all":pageFilters[file];
    if(filter=="range"){
      string text=(pageRanges[file]??"").Replace('–','-').Replace('—','-').Replace('،',',');
      var normalized=new StringBuilder();foreach(char c in text){double digit=char.GetNumericValue(c);normalized.Append(char.IsDigit(c)&&digit>=0&&digit<=9?(char)('0'+(int)digit):c);}text=normalized.ToString();
      if(string.IsNullOrWhiteSpace(text))throw new InvalidOperationException(L("Enter pages such as 1-5, 8, 12."));
      var pages=new SortedSet<int>();
      foreach(string part in text.Split(',')){
        var match=System.Text.RegularExpressions.Regex.Match(part,@"^\s*([0-9]+)\s*(?:-\s*([0-9]+)\s*)?$");int first,last;
        if(!match.Success||!int.TryParse(match.Groups[1].Value,out first)||first<1||!int.TryParse(match.Groups[2].Success?match.Groups[2].Value:match.Groups[1].Value,out last)||last<first)throw new InvalidOperationException(L("Enter pages such as 1-5, 8, 12."));
        if(last>total)throw new InvalidOperationException(L("The page range exceeds this file's page count."));
        if((long)last-first+1>2000)throw new InvalidOperationException(L("Fast Print supports up to 2000 selected pages."));
        for(int page=first-1;page<last;page++){pages.Add(page);if(pages.Count>2000)throw new InvalidOperationException(L("Fast Print supports up to 2000 selected pages."));}
      }
      return pages.ToArray();
    }
    int selected=filter=="odd"?(total+1)/2:filter=="even"?total/2:total;
    if(selected>2000)throw new InvalidOperationException(L("Fast Print supports up to 2000 selected pages."));
    return Enumerable.Range(0,selected).Select(index=>filter=="odd"?index*2:filter=="even"?index*2+1:index).ToArray();
  }
  int[][] SelectedPageMap(PageInventory inventory){
    var result=new int[inventory.Counts.Length][];
    for(int file=0;file<result.Length;file++)try{result[file]=SelectedPages(file,inventory.Counts[file]);}catch(Exception error){throw new InvalidOperationException(Path.GetFileName(args.Files[file])+": "+error.Message);}
    if(result.Sum(pages=>(long)pages.Length)>2000)throw new InvalidOperationException(L("Fast Print supports up to 2000 selected pages."));
    return result;
  }
  int[][] ExpandedPageMap(PageInventory inventory){
    var selected=SelectedPageMap(inventory);
    if(selected.Select((pages,index)=>(long)pages.Length*(IsImage(args.Files[index])?sourceCopies[index]:1)).Sum()>2000)throw new InvalidOperationException(L("Fast Print supports up to 2000 selected pages."));
    return selected.Select((pages,index)=>IsImage(args.Files[index])&&sourceCopies[index]>1?Enumerable.Range(0,sourceCopies[index]).SelectMany(copy=>pages).ToArray():pages).ToArray();
  }
  OutputTotals CountOutput(PageInventory inventory,bool duplex){
    long pages=0;
    int[] counts=Special?inventory.Counts:ExpandedPageMap(inventory).Select(selected=>selected.Length).ToArray();
    if(IsPolaroid){int per=mode=="polaroid-8"?8:9;pages=(inventory.Counts.Sum(value=>(long)value)+per-1)/per;duplex=false;}
    else for(int index=0;index<counts.Length;index++){
      int start,end;ImageRange(index,out start,out end);long groupPages=0;for(int file=index;file<=end;file++)groupPages+=counts[file];index=end;
      long sides=(groupPages+PerSheet-1)/PerSheet;pages+=sides;
      if(duplex&&counts.Skip(index+1).Any(value=>value>0)&&sides%2==1)pages++;
    }
    long sheets=duplex?(pages+1)/2:pages;int quantity=(int)copies.Value;
    return new OutputTotals{Pages=pages,Sheets=sheets,Copies=quantity,TotalSheets=sheets*quantity};
  }
  void FilePageLabels(PageInventory inventory){
    bool wasUpdating=updating;updating=true;int selected=fileList.SelectedIndex;fileList.BeginUpdate();
    try{for(int i=0;i<args.Files.Count;i++)fileList.Items[i]=new Entry(i.ToString(),(i+1)+" / "+args.Files.Count+(inventory==null?"":" · "+Quantity(inventory.Counts[i],"page","pages"))+" · "+Path.GetFileName(args.Files[i]));fileList.SelectedIndex=selected;}
    finally{fileList.EndUpdate();updating=wasUpdating;}
    fileLabelKey=inventory==null?null:inventory.Key;fileList.Refresh();
  }
  async void QueuePageSummary(){int request=++summaryRequest;await Task.Delay(60);if(!closing&&request==summaryRequest)await RefreshPageSummary();}
  async Task RefreshPageSummary(){
    ++summaryRequest;
    int generation=++summaryGeneration;
    try{
      string key=SourceVersion();if(fileLabelKey!=null&&fileLabelKey!=key)FilePageLabels(null);
      var pending=Inventory(key);if(!pending.IsCompleted)jobSummary.Text=L("Counting pages…");
      var inventory=await pending;
      if(closing||generation!=summaryGeneration)return;
      if(SourceVersion()!=inventory.Key)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
      if(fileLabelKey!=inventory.Key)FilePageLabels(inventory);
      string text=Quantity(args.Files.Count,"file","files")+" · "+Quantity(inventory.Counts.Sum(value=>(long)value),"source page","source pages");
      if(!Special)text+=" · "+Quantity(SelectedPageMap(inventory).Sum(pages=>(long)pages.Length),"selected page","selected pages");
      if(settingsReady&&settings!=null&&mode!="id-card"){
        bool duplex=canDuplex&&(settings.PrinterSettings.Duplex==Duplex.Vertical||settings.PrinterSettings.Duplex==Duplex.Horizontal);
        var totals=CountOutput(inventory,duplex);
        text+="\n"+L(totals.Copies>1?"Output per copy":"Output")+": "+Quantity(totals.Pages,"page","pages")+" · "+Quantity(totals.Sheets,"sheet","sheets");
        if(totals.Copies>1)text+=" × "+totals.Copies+" "+L("copies")+" = "+totals.TotalSheets+" "+L("total sheets");
      }
      jobSummary.Text=text;tips.SetToolTip(jobSummary,text);
    }catch(Exception error){if(!closing&&generation==summaryGeneration){FilePageLabels(null);jobSummary.Text=L("Page totals unavailable")+": "+error.Message;tips.SetToolTip(jobSummary,jobSummary.Text);}}
  }
  async Task PrimePreview(){
    await previewGate.WaitAsync();
    try{string path=await PreparedFile(args.Files[0]);if(!closing)using(var page=await Page(path,0,640)){if(!closing){preview.Replace(new Bitmap(page));count.Text=L("Source preview");sourcePreviewReady=NativePrint.Clock.ElapsedMilliseconds;}}}
    catch(Exception){/* The visible preview reports actionable errors. */}
    finally{previewGate.Release();}
  }
  async Task<Bitmap> Page(string path,int index,int width){
    pageRequests++;
    string version=SourceVersion(path),key=version+"|"+index;Bitmap cached;int renderedWidth;
    if(pageCache.TryGetValue(key,out cached)&&pageWidths.TryGetValue(key,out renderedWidth)&&renderedWidth>=width){
      cacheHits++;pageRecency.Remove(key);pageRecency.AddLast(key);pageCount=documentPages[version];return new Bitmap(cached);
    }
    cacheMisses++;var decoded=await DecodePage(path,index,width);
    if(closing){decoded.Dispose();throw new OperationCanceledException();}
    try{if(SourceVersion(path)!=version)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));}catch{decoded.Dispose();throw;}
    documentPages[version]=pageCount;
    if(pageCache.TryGetValue(key,out cached)){cachedPixels-=(long)cached.Width*cached.Height;cached.Dispose();pageRecency.Remove(key);}
    pageCache[key]=decoded;pageWidths[key]=width;cachedPixels+=(long)decoded.Width*decoded.Height;pageRecency.AddLast(key);
    var result=new Bitmap(decoded);
    while(cachedPixels>6000000 && pageRecency.Count>1){string oldest=pageRecency.First.Value;pageRecency.RemoveFirst();var image=pageCache[oldest];cachedPixels-=(long)image.Width*image.Height;image.Dispose();pageCache.Remove(oldest);pageWidths.Remove(oldest);}
    return result;
  }
  async Task<Bitmap> DecodePage(string path, int index, int width) {
    if (Path.GetExtension(path).Equals(".pdf", StringComparison.OrdinalIgnoreCase)) {
      string version=SourceVersion(path);
      if (loadedFile != version) { pdf = await CachedPdfDocument(path); loadedFile = version; }
      pageCount = (int)pdf.PageCount;
      using (var page = pdf.GetPage((uint)index)) using (var stream = new InMemoryRandomAccessStream()) {
        await page.RenderToStreamAsync(stream, new PdfPageRenderOptions { DestinationWidth = (uint)width });
        using (var input = stream.AsStreamForRead()) using (var image = Image.FromStream(input)) return new Bitmap(image);
      }
    }
    loadedFile = null; pdf = null; pageCount = 1;
    return await Task.Run(()=>DecodePhoto(path,width));
  }
  Bitmap DecodePhoto(string path,int width){
    photoDecodeThread=Thread.CurrentThread.ManagedThreadId;
    using (var image = Image.FromFile(path)) {
      if (image.PropertyIdList.Contains(0x112)) {
        int rotation = image.GetPropertyItem(0x112).Value[0]; var turns = new Dictionary<int, RotateFlipType> { {2,RotateFlipType.RotateNoneFlipX},{3,RotateFlipType.Rotate180FlipNone},{4,RotateFlipType.Rotate180FlipX},{5,RotateFlipType.Rotate90FlipX},{6,RotateFlipType.Rotate90FlipNone},{7,RotateFlipType.Rotate270FlipX},{8,RotateFlipType.Rotate270FlipNone} }; if (turns.ContainsKey(rotation)) image.RotateFlip(turns[rotation]);
      }
      return new Bitmap(image, Math.Max(1, Math.Min(width, image.Width)), Math.Max(1, (int)(image.Height * Math.Min(1.0, (double)width / image.Width))));
    }
  }
  bool IsImage(string path){string extension=Path.GetExtension(path).ToLowerInvariant();return extension!=".pdf"&&extension!=".docx";}
  async Task<SizeF> PhysicalSize(int file,int page){
    string path=args.Files[file],key=SourceVersion(path)+":"+page;SizeF size;
    if(physicalSizes.TryGetValue(key,out size))return size;
    if(IsImage(path))size=await Task.Run(()=>{
      using(var image=Image.FromFile(path)){
        bool storedDpi=(image.Flags&(int)ImageFlags.HasRealDpi)!=0;
        float dx=storedDpi?image.HorizontalResolution:96,dy=storedDpi?image.VerticalResolution:96;if(float.IsNaN(dx)||float.IsInfinity(dx)||dx<=0)dx=96;if(float.IsNaN(dy)||float.IsInfinity(dy)||dy<=0)dy=96;
        float w=image.Width*25.4f/dx,h=image.Height*25.4f/dy;
        int orientation=image.PropertyIdList.Contains(0x112)?image.GetPropertyItem(0x112).Value[0]:1;
        return orientation>=5&&orientation<=8?new SizeF(h,w):new SizeF(w,h);
      }
    });
    else{var document=await CachedPdfDocument(await PreparedFile(path));using(var sourcePage=document.GetPage((uint)page))size=new SizeF((float)(sourcePage.Size.Width*25.4/96),(float)(sourcePage.Size.Height*25.4/96));}
    physicalSizes[key]=size;return size;
  }
  string SeparatorHex {get{return "#"+separatorColor.R.ToString("X2")+separatorColor.G.ToString("X2")+separatorColor.B.ToString("X2");}}
  void ImageRange(int index,out int start,out int end){start=end=index;if(Special||sourceCopies[index]>1)return;if(!combineFiles.Checked&&!IsImage(args.Files[index]))return;while(start>0&&sourceCopies[start-1]==1&&(combineFiles.Checked||IsImage(args.Files[start-1])))start--;while(end+1<args.Files.Count&&sourceCopies[end+1]==1&&(combineFiles.Checked||IsImage(args.Files[end+1])))end++;}
  string SourceVersion(string path){var file=new FileInfo(path);if(!file.Exists)throw new FileNotFoundException(L("The selected file is missing.")+" "+file.Name,path);if(file.Length==0||file.Length>512L*1024*1024)throw new InvalidOperationException(L("Choose a non-empty file smaller than 512 MB.")+" "+file.Name);return file.FullName+":"+file.Length+":"+file.LastWriteTimeUtc.Ticks;}
  string SourceVersion(){return string.Join("|",args.Files.Select(SourceVersion));}
  string PolaroidKey(){return mode+"|"+SourceVersion();}
  Task<PolaroidSheets> PolaroidPreview(){
    string key=PolaroidKey();Task<PolaroidSheets> task;
    if(polaroidPreviews.TryGetValue(key,out task)&&!task.IsFaulted&&!task.IsCanceled)return task;
    task=PreparePolaroid(key,mode);polaroidPreviews[key]=task;return task;
  }
  async Task<PolaroidSheets> PreparePolaroid(string key,string selectedMode){
    if(string.IsNullOrEmpty(args.App)||!File.Exists(args.App))throw new InvalidOperationException("Fast Print worker is missing. Repair the app installation.");
    string directory=Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N"));previewSessions.Add(directory);
    string request=await Request(directory,false,true);polaroidPreparations++;
    var fileSheets=new int[args.Files.Count];var fileLastSheets=new int[args.Files.Count];int pages=0,per=selectedMode=="polaroid-8"?8:9;
    for(int index=0;index<args.Files.Count;index++){
      fileSheets[index]=pages/per;string path=await PreparedFile(args.Files[index]);
      if(Path.GetExtension(path).Equals(".pdf",StringComparison.OrdinalIgnoreCase))pages+=await PdfPages(path);
      else pages++;
      fileLastSheets[index]=(pages-1)/per;
    }
    var arguments=new List<string>();if(!string.IsNullOrEmpty(args.AppPath))arguments.Add(args.AppPath);
    arguments.Add("--fast-print-preview");arguments.Add(request);arguments.Add("--fast-print-quiet");
    var info=new ProcessStartInfo(args.App,string.Join(" ",arguments.Select(NativePrint.Quote))){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Path.GetDirectoryName(args.App),RedirectStandardError=true,RedirectStandardOutput=true};
    info.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");info.EnvironmentVariables.Remove("ELECTRON_RENDERER_URL");
    await polaroidGate.WaitAsync();
    try{if(closing)throw new OperationCanceledException();using(var process=Process.Start(info)){
      previewWorkers.Add(process);var errors=process.StandardError.ReadToEndAsync();var output=ReadPolaroidProgress(process.StandardOutput,key);
      try{
        bool exited=await Task.Run(()=>process.WaitForExit(10*60*1000));
        if(!exited){process.Kill();throw new InvalidOperationException("Polaroid preparation timed out. Try fewer photos.");}
        string error=await errors;string log=await output;File.WriteAllText(Path.Combine(directory,"preview.log"),log);if(closing)throw new OperationCanceledException();
        if(process.ExitCode!=0){string errorFile=Path.Combine(directory,"preview-error.txt");throw new InvalidOperationException(File.Exists(errorFile)?File.ReadAllText(errorFile):string.IsNullOrWhiteSpace(error)?"Polaroid preparation failed. Try again.":error.Trim());}
      }finally{previewWorkers.Remove(process);}
    }}finally{polaroidGate.Release();}
    string folder=Path.Combine(directory,"preview");var manifest=NativePrint.Read(Path.Combine(folder,"sheets.json"));
    if(NativePrint.Text(manifest,"version")!="1"||NativePrint.Text(manifest,"mode")!=selectedMode)throw new InvalidOperationException("Invalid Polaroid preview.");
    var sheets=new List<string>();foreach(object item in (System.Collections.IEnumerable)manifest["sheets"]){string name=item as string;if(name==null||name!=Path.GetFileName(name)||!System.Text.RegularExpressions.Regex.IsMatch(name,@"^\d{5}\.png$"))throw new InvalidOperationException("Invalid Polaroid sheet.");string file=Path.Combine(folder,name);if(!File.Exists(file))throw new InvalidOperationException("A Polaroid sheet is missing.");sheets.Add(file);}
    if(sheets.Count!=Math.Ceiling((double)pages/per))throw new InvalidOperationException("The Polaroid preview did not include every selected photo.");
    if(key!=selectedMode+"|"+SourceVersion())throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
    return new PolaroidSheets{Files=sheets.ToArray(),FileSheets=fileSheets,FileLastSheets=fileLastSheets,Key=key,Photos=pages};
  }
  async Task<string> ReadPolaroidProgress(StreamReader reader,string key){
    var log=new StringBuilder();string line;
    while((line=await reader.ReadLineAsync())!=null){
      if(log.Length<4*1024*1024)log.AppendLine(line);
      const string prefix="[polaroid-progress] ";
      if(!closing&&IsPolaroid&&key==PolaroidKey()&&line.StartsWith(prefix)){
        string progress=line.Substring(prefix.Length).Trim();
        if(System.Text.RegularExpressions.Regex.IsMatch(progress,@"^\d+/\d+$")){
          polaroidProgressEvents++;status.Text=L("Preparing Polaroid sheets…")+" "+progress;preview.Busy(status.Text);
        }
      }
    }
    return log.ToString();
  }
  void ShowPolaroid(PolaroidSheets prepared){
    activePolaroid=prepared;pageCount=prepared.Files.Length;sheetIndex=Math.Max(0,Math.Min(sheetIndex,pageCount-1));
    if(sheetIndex<prepared.FileSheets[fileList.SelectedIndex]||sheetIndex>prepared.FileLastSheets[fileList.SelectedIndex]){updating=true;fileList.SelectedIndex=Array.FindIndex(prepared.FileLastSheets,last=>last>=sheetIndex);updating=false;}
    string file=prepared.Files[sheetIndex];Bitmap thumbnail;
    if(!polaroidThumbnails.TryGetValue(file,out thumbnail)){
      using(var image=Image.FromFile(file)){
        double scale=Math.Min(1.0,1000.0/Math.Max(image.Width,image.Height));thumbnail=new Bitmap(image,Math.Max(1,(int)Math.Round(image.Width*scale)),Math.Max(1,(int)Math.Round(image.Height*scale)));
      }
      polaroidThumbnails[file]=thumbnail;
    }
    polaroidThumbnailOrder.Remove(file);polaroidThumbnailOrder.AddLast(file);
    while(polaroidThumbnailOrder.Count>4){string oldest=polaroidThumbnailOrder.First.Value;polaroidThumbnailOrder.RemoveFirst();polaroidThumbnails[oldest].Dispose();polaroidThumbnails.Remove(oldest);}
    preview.Replace(new Bitmap(thumbnail));
    count.Text=(sheetIndex+1)+" / "+pageCount;previous.Enabled=sheetIndex>0;next.Enabled=sheetIndex+1<pageCount;
    status.Text=appliedProfile=="invalid"?profileError:prepared.Photos+" "+L("photos")+" · "+pageCount+" "+L("sheets");
    print.Enabled=appliedProfile!="invalid";if(previewReady==0)previewReady=NativePrint.Clock.ElapsedMilliseconds;
  }
  string PreviewKey(string sources){
    int selectedPage=preview.SelectedItem>=0&&preview.SelectedItem<preview.Items.Length?preview.Items[preview.SelectedItem].Page:-1;
    return PageSelectionKey()+"|"+sources+"|"+Selected(printer)+"|"+Selected(paper)+"|"+Selected(color)+"|"+Selected(orientation)+"|"+PerSheet+"|"+fileList.SelectedIndex+"|"+selectedPage+"|"+sheetIndex+"|"+preview.ClientSize+"|"+fill.Checked+"|"+sameDirection.Checked+"|"+combineFiles.Checked+"|"+marginMm+"|"+gapMm+"|"+compact.Checked+"|"+actualSize.Checked+"|"+separatorLines.Checked+"|"+SeparatorHex+"|"+RotationKey()+"|"+appliedProfile+"|"+profileError;
  }
  async Task RenderPreview() {
    int generation=++rendering;print.Enabled=false;preview.Interactive=false;preview.Invalidate();
    var renderClock=Stopwatch.StartNew();
    if(generation!=rendering||!settingsReady||settings==null||Selected(paper)==""||closing)return;
    string sources=SourceVersion();
    if(Special)retainedPreviewKey=null;
    if(!Special&&preview.Sheet!=null&&retainedPreviewKey==PreviewKey(sources)){previewReuses++;preview.Interactive=true;preview.Invalidate();preview.Busy(null);status.Text=retainedPreviewStatus;tips.SetToolTip(status,status.Text);print.Enabled=appliedProfile!="invalid";lastRenderMs=renderClock.ElapsedMilliseconds;return;}
    QueuePageSummary();await Task.Delay(35);if(generation!=rendering||!settingsReady||closing)return;sources=SourceVersion();
    if(IsPolaroid){
      try{
        var pending=PolaroidPreview();if(!pending.IsCompleted){status.Text=L("Preparing Polaroid sheets…");preview.Busy(status.Text);}
        var prepared=await pending;if(generation!=rendering||!settingsReady||closing)return;
        if(SourceVersion()!=sources)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
        ShowPolaroid(prepared);visibleSourceVersion=sources;lastRenderMs=renderClock.ElapsedMilliseconds;
      }catch{if(generation==rendering&&!closing)throw;}
      return;
    }
    await previewGate.WaitAsync();
    try{
    if(generation!=rendering||!settingsReady||settings==null||Selected(paper)==""||closing)return;
    status.Text = L("Loading preview…"); string source=args.Files[fileList.SelectedIndex];int groupStart,groupEnd;ImageRange(fileList.SelectedIndex,out groupStart,out groupEnd);
    bool merged=!Special&&combineFiles.Checked;bool imageGroup=!merged&&!Special&&groupEnd>groupStart;
    var refs=new List<Tuple<int,int>>();int[][] selectedMap=null;
    if(!Special){
      var map=selectedMap=ExpandedPageMap(await Inventory());
      if(generation!=rendering||closing)return;
      if(!map.Any(pages=>pages.Length>0))throw new InvalidOperationException(L("Select at least one page to print."));
      for(int file=groupStart;file<=groupEnd;file++)foreach(int page in map[file])refs.Add(Tuple.Create(file,page));
      if(refs.Count==0){preview.Replace(null);pageCount=0;sheetIndex=0;count.Text="0 / 0";previous.Enabled=next.Enabled=false;status.Text=L("No selected pages in this file.");preview.Busy(status.Text);visibleSourceVersion=sources;print.Enabled=appliedProfile!="invalid";return;}
    }
    // Ordinary jobs already have page totals. Decode only the visible sheet;
    // loading its first source page again wastes work on every later sheet.
    string path=Special?await PreparedFile(source):null;
    if (generation != rendering || closing) return;
    int decodeWidth=Math.Max(180,(int)(640/Math.Sqrt(Special?1:PerSheet)));
    using (var first = Special?await Page(path,0,decodeWidth):null) {
      if (generation != rendering || closing) return;
      int per = Special ? 1 : PerSheet; int pages = Special?pageCount:refs.Count; sheetIndex = Math.Min(sheetIndex, Math.Max(0, (pages - 1) / per));
      if(SourceOrientation){
        int index=refs[sheetIndex].Item1;
        using(var current=await Page(await PreparedFile(args.Files[index]),refs[sheetIndex].Item2,decodeWidth)){
          originalLandscape=PageTurns(index,refs[sheetIndex].Item2)%2==0?current.Width>current.Height:current.Height>current.Width;
        }
      }
      double paperRatio=Selected(paper)=="A3"?420.0/297:297.0/210;
      int h=Math.Min(1000,Math.Max(480,(int)(preview.ClientSize.Height*1.35)));int w=(int)Math.Round(h/paperRatio);if(Landscape){int swap=w;w=h;h=swap;}
      var canvas = new Bitmap(w, h);previewCompositions++;
      var previewItems=new List<PreviewSurface.Item>();
      try{
      using (var g = Graphics.FromImage(canvas)) {
        g.Clear(Color.White); g.InterpolationMode = InterpolationMode.HighQualityBicubic; var grid=NativeLayout.ForSheet(per,Landscape);int cols=grid.columns,rows=grid.rows;
        float physicalWidth=Selected(paper)=="A3"?(Landscape?420:297):(Landscape?297:210);
        float gap=Special?0:w*(float)gapMm/physicalWidth,margin=Special?0:w*(float)marginMm/physicalWidth;
        int occupied=Math.Min(per,pages-sheetIndex*per);
        RectangleF[] montageCells=null;int[] montageTurns=null;
        if(!Special&&(compact.Checked||actualSize.Checked)){
          var sizes=new SizeF[occupied];montageTurns=new int[occupied];
          for(int slot=0;slot<occupied;slot++){
            var reference=refs[sheetIndex*per+slot];var regular=grid.Cell(slot,occupied,w,h,margin,gap);
            using(var image=await Page(await PreparedFile(args.Files[reference.Item1]),reference.Item2,decodeWidth)){
              int turns=NativeLayout.ContentTurns(per,sameDirection.Checked,image.Width,image.Height,regular.Width,regular.Height,PageTurns(reference.Item1,reference.Item2));montageTurns[slot]=turns;
              var size=actualSize.Checked?await PhysicalSize(reference.Item1,reference.Item2):new SizeF(image.Width,image.Height);
              if(turns%2==1)size=new SizeF(size.Height,size.Width);
              if(actualSize.Checked){float physicalHeight=Selected(paper)=="A3"?(Landscape?297:420):(Landscape?210:297);size=new SizeF(size.Width*w/physicalWidth,size.Height*h/physicalHeight);}
              sizes[slot]=size;
            }
            if(generation!=rendering||closing)return;
          }
          montageCells=grid.MontageCells(sizes,w,h,margin,gap,compact.Checked,actualSize.Checked,fill.Checked);
        }
        for (int slot = 0; slot < per && sheetIndex * per + slot < pages; slot++) {
          int number = sheetIndex * per + slot;
          int sourceIndex=Special?fileList.SelectedIndex:refs[number].Item1;
          using (var image = Special?(number==0?new Bitmap(first):await Page(path,number,decodeWidth)):await Page(await PreparedFile(args.Files[sourceIndex]),refs[number].Item2,decodeWidth)) {
            if (generation != rendering || closing) return;
            var cell=montageCells==null?grid.Cell(slot,occupied,w,h,margin,gap):montageCells[slot];float cw=cell.Width,ch=cell.Height;
            int turns=Special?0:montageTurns!=null?montageTurns[slot]:NativeLayout.ContentTurns(per,sameDirection.Checked,image.Width,image.Height,cw,ch,PageTurns(sourceIndex,refs[number].Item2));
            if(!Special)previewItems.Add(new PreviewSurface.Item{Bounds=cell,Source=sourceIndex,Page=refs[number].Item2,Turns=turns,Name=Path.GetFileName(args.Files[sourceIndex])+" · "+(refs[number].Item2+1)});
            if(turns!=0)image.RotateFlip(turns==1?RotateFlipType.Rotate90FlipNone:turns==2?RotateFlipType.Rotate180FlipNone:RotateFlipType.Rotate270FlipNone);
            float scale = fill.Checked && !Special ? Math.Max(cw / image.Width, ch / image.Height) : Math.Min(cw / image.Width, ch / image.Height);
            var state = g.Save(); g.SetClip(cell);
            var target = new RectangleF(cell.X + (cw - image.Width * scale) / 2, cell.Y + (ch - image.Height * scale) / 2, image.Width * scale, image.Height * scale);
            if(!Special&&actualSize.Checked)target=cell;
            using (var attributes = new ImageAttributes()) {
              if (Selected(color) == "mono") attributes.SetColorMatrix(new ColorMatrix(new float[][] { new[]{.2126f,.2126f,.2126f,0,0},new[]{.7152f,.7152f,.7152f,0,0},new[]{.0722f,.0722f,.0722f,0,0},new[]{0f,0,0,1,0},new[]{0f,0,0,0,1} }));
              g.DrawImage(image, Rectangle.Round(target), 0, 0, image.Width, image.Height, GraphicsUnit.Pixel, attributes);
            }
            g.Restore(state);
          }
        }
        if(!Special&&separatorLines.Checked){
          var lineColor=separatorColor;if(Selected(color)=="mono"){int gray=(int)Math.Round(.2126*lineColor.R+.7152*lineColor.G+.0722*lineColor.B);lineColor=Color.FromArgb(gray,gray,gray);}
          NativeLayout.DrawSeparators(g,montageCells??Enumerable.Range(0,occupied).Select(slot=>grid.Cell(slot,occupied,w,h,margin,gap)).ToArray(),lineColor,.25f*25.4f/96*w/physicalWidth);
        }
      }
      if(SourceVersion()!=sources)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
      if(!Special&&(merged||imageGroup)&&selectedMap[fileList.SelectedIndex].Length>0){int firstFile=refs[sheetIndex*per].Item1,lastFile=refs[Math.Min(pages-1,(sheetIndex+1)*per-1)].Item1;if(fileList.SelectedIndex<firstFile||fileList.SelectedIndex>lastFile){updating=true;fileList.SelectedIndex=firstFile;updating=false;SyncPageControls();}}
      pageCount=pages;preview.Replace(canvas);canvas=null;visibleSourceVersion=sources; count.Text = (Special ? L("Source preview") + " · " : "") + (sheetIndex + 1) + " / " + Math.Ceiling((double)pages / per);
      int previousItem=preview.SelectedItem;var previousItems=preview.Items;
      preview.Items=previewItems.ToArray();preview.SelectedItem=Array.FindIndex(preview.Items,item=>item.Source==fileList.SelectedIndex);
      if(previousItem>=0&&previousItem<previousItems.Length&&previousItems[previousItem].Source==fileList.SelectedIndex){var previousSelection=previousItems[previousItem];int retained=Array.FindIndex(preview.Items,item=>item.Source==previousSelection.Source&&item.Page==previousSelection.Page);if(retained>=0)preview.SelectedItem=retained;}
      preview.Interactive=!Special;preview.AccessibleName=L("Source preview")+(preview.SelectedItem>=0?" · "+preview.Items[preview.SelectedItem].Name:"");preview.Invalidate();
      previous.Enabled = sheetIndex > 0; next.Enabled = (sheetIndex + 1) * per < pages;
      status.Text = appliedProfile=="invalid"?profileError:mode == "id-card" ? L("Choose a back image in the ID editor before printing.") : Path.GetFileName(args.Files[fileList.SelectedIndex]);
      if(!Special)UpdateSelectionStatus();
      tips.SetToolTip(status, status.Text); print.Enabled = appliedProfile != "invalid"; if(previewReady==0)previewReady = NativePrint.Clock.ElapsedMilliseconds;
      if(!Special){retainedPreviewKey=PreviewKey(sources);retainedPreviewStatus=status.Text;}
      lastRenderMs=renderClock.ElapsedMilliseconds;
      }finally{if(canvas!=null)canvas.Dispose();}
    }
    }finally{previewGate.Release();}
  }
  void DriverOptions(object sender, EventArgs e) {
    if (!settingsReady || settings == null) return;
    try {
      ApplyControls();var previousSettings=FastPrintDriver.FromDocument(settings);
      var bytes = FastPrintDriver.Capture(Selected(printer), Handle, previousSettings, true); if (bytes == null) return;
      ApplyDriverOptions(bytes,previousSettings);
      driverCache[Selected(printer)] = bytes;appliedDriverBytes=bytes;appliedSavedSnapshot=null; explicitProfile = "current"; appliedProfile = null;
      UpdateProfiles();
      updating = true; quality.SelectedIndex=0; SetOrientation(settings.DefaultPageSettings.Landscape); copies.Value = Math.Max(1, Math.Min(999, (int)settings.PrinterSettings.Copies));
      for (int i = 0; i < paper.Items.Count; i++) if (((Entry)paper.Items[i]).Id == settings.DefaultPageSettings.PaperSize.Kind.ToString()) paper.SelectedIndex = i;
      color.SelectedIndex = settings.DefaultPageSettings.Color && canColor ? 0 : color.Items.Count - 1; updating = false; Changed();
    } catch (Exception error) { updating = false; MessageBox.Show(this, error.Message, L("Fast Print"), MessageBoxButtons.OK, MessageBoxIcon.Error); }
  }
  void ApplyDriverOptions(byte[] bytes,byte[] previousSettings){
    try{FastPrintDriver.Apply(settings,bytes);string error=DriverSelectionError(settings.DefaultPageSettings.PaperSize.Kind,settings.DefaultPageSettings.Color);if(error!=null)throw new InvalidOperationException(error);}
    catch{FastPrintDriver.Apply(settings,previousSettings);throw;}
  }
  string DriverSelectionError(PaperKind paperKind,bool colorOutput){return IsPolaroid&&(paperKind!=PaperKind.A4||!colorOutput)?L("Polaroid requires A4 and color. Keep these settings in printer properties."):paperKind!=PaperKind.A4&&paperKind!=PaperKind.A3?"Fast Print layouts use A4 or A3. Choose either size in the printer properties.":null;}
  async Task ManagePresets() {
    try{
      string script=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"fast-print-settings.ps1");
      if(!File.Exists(script))script=Path.Combine(args.AppPath??Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"..","..")),"scripts","fast-print-settings.ps1");
      string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","WindowsPowerShell","v1.0","powershell.exe");
      using(var process=NativePrint.Start(powershell,new[]{"-NoProfile","-STA","-ExecutionPolicy","Bypass","-File",script,"-Action","Manage"}))await Task.Run(()=>process.WaitForExit());
      if(!closing)await LoadPrinters(true);
    }catch(Exception error){status.Text=error.Message;}
  }
  void ApplyControls() {
    appliedDriverBytes=null;appliedSavedSnapshot=null;
    if (!settingsReady||settings==null||paper.SelectedItem == null) throw new InvalidOperationException(L("No compatible printers found"));
    if(IsPolaroid&&(Selected(paper)!="A4"||Selected(color)!="color"))throw new InvalidOperationException(L("Polaroid requires A4 and color. Keep these settings in printer properties."));
    settings.DefaultPageSettings.PaperSize = (PaperSize)((Entry)paper.SelectedItem).Value; settings.DefaultPageSettings.Landscape = Landscape; settings.DefaultPageSettings.Color = Selected(color) == "color";
    var resolution = quality.SelectedItem as Entry; if (resolution != null && resolution.Value != null) settings.DefaultPageSettings.PrinterResolution = (PrinterResolution)resolution.Value;
    settings.PrinterSettings.Copies = (short)copies.Value;
    if (IsPolaroid && canDuplex) settings.PrinterSettings.Duplex = Duplex.Simplex;
  }
  async Task<string> Request(string directory=null,bool requireReviewed=false,bool previewOnly=false) {
    string selectedPagesKey=PageSelectionKey();
    directory=directory??session;Directory.CreateDirectory(directory);
    if(previewOnly){
      // Composition does not depend on vendor driver snapshots or properties.
      string selectedMode=mode;
      var previewFiles=new List<string>();foreach(string path in args.Files)previewFiles.Add(await PreparedFile(path));
      var previewPreset=new{printer=Selected(printer),paper="A4",color=true,pagesPerSheet=1,mode=selectedMode,profileId=Guid.NewGuid().ToString("N")};
      string previewRequest=Path.Combine(directory,"request.json");
      File.WriteAllText(previewRequest,NativePrint.Json.Serialize(new{version=1,files=previewFiles,preset=previewPreset,copies=1}),new UTF8Encoding(false));
      return previewRequest;
    }
    bool outputColor=Selected(color)=="color";
    driverSnapshotRequests++;ApplyControls(); var bytes = FastPrintDriver.Capture(Selected(printer), IntPtr.Zero, FastPrintDriver.FromDocument(settings), false); FastPrintDriver.Apply(settings, bytes);
    bool virtualGrayscale=!outputColor&&(string.Equals(Selected(printer),"Microsoft Print to PDF",StringComparison.OrdinalIgnoreCase)||string.Equals(Selected(printer),"Microsoft XPS Document Writer",StringComparison.OrdinalIgnoreCase));
    if (settings.DefaultPageSettings.PaperSize.Kind.ToString() != Selected(paper) || settings.DefaultPageSettings.Landscape != Landscape || settings.DefaultPageSettings.Color!=outputColor&&!virtualGrayscale) throw new InvalidOperationException("The printer driver could not keep the selected paper, orientation and color.");
    string id = Guid.NewGuid().ToString("N"); var page = settings.DefaultPageSettings;
    var profile = new Dictionary<string, object> { {"version",1},{"id",id},{"name",saved.Where(item=>NativePrint.Text(item,"id")==appliedProfile).Select(item=>NativePrint.Text(item,"name")).FirstOrDefault()??"Fast Print session"},{"printer",Selected(printer)},{"paper",Selected(paper)},{"color",page.Color},{"landscape",page.Landscape},{"duplex",settings.PrinterSettings.Duplex.ToString()},{"tray",page.PaperSource.SourceName},{"trayId",page.PaperSource.RawKind},{"driverFingerprint",FastPrintDriver.Fingerprint(Selected(printer))},{"driverSettings",Convert.ToBase64String(ProtectedData.Protect(bytes,null,DataProtectionScope.CurrentUser))} };
    var originalProfile=saved.FirstOrDefault(item=>NativePrint.Text(item,"id")==appliedProfile);if(originalProfile!=null){profile["savedProfileId"]=appliedProfile;profile["savedProfileStamp"]=NativeLastSettings.ProfileStamp(originalProfile);}
    File.WriteAllText(Path.Combine(directory,id+".json"),NativePrint.Json.Serialize(profile),new UTF8Encoding(false));
    // Grayscale is rendered into the artwork even when a color-only driver resets dmColor.
    var preset = new Dictionary<string, object> { {"printer",Selected(printer)},{"paper",Selected(paper)},{"color",outputColor},{"pagesPerSheet",Special?1:PerSheet},{"profileId",id},{"landscape",Landscape},{"duplex",canDuplex && (settings.PrinterSettings.Duplex == Duplex.Vertical || settings.PrinterSettings.Duplex == Duplex.Horizontal)},{"fitToFrame",fill.Checked && !Special},{"combineImages",!Special} }; if (Special) preset["mode"]=mode; else {preset["combineFiles"]=combineFiles.Checked;preset["marginMm"]=marginMm;preset["gapMm"]=gapMm;preset["sourceRotations"]=sourceRotations;preset["autoOrientation"]=SourceOrientation;preset["matchLayoutOrientation"]=sameDirection.Checked&&PerSheet>1;}
    if(!Special){
      preset["compact"]=compact.Checked;preset["preserveActualSize"]=actualSize.Checked;preset["separatorLines"]=separatorLines.Checked;preset["separatorColor"]=SeparatorHex;
      if(actualSize.Checked){
        var imageSizes=new object[args.Files.Count];
        for(int file=0;file<args.Files.Count;file++)if(IsImage(args.Files[file])){var size=await PhysicalSize(file,0);imageSizes[file]=new{widthMm=size.Width,heightMm=size.Height};}
        preset["imageSizesMm"]=imageSizes;
        preset["fitToFrame"]=false;
      }
      preset["pageRotations"]=pageRotations.OrderBy(item=>item.Key.Item1).ThenBy(item=>item.Key.Item2).Select(item=>new{file=item.Key.Item1,page=item.Key.Item2,turns=item.Value}).ToArray();
      var selected=SelectedPageMap(await Inventory());if(!selected.Any(pages=>pages.Length>0))throw new InvalidOperationException(L("Select at least one page to print."));preset["sourcePages"]=selected;
      ExpandedPageMap(await Inventory());preset["sourceCopies"]=sourceCopies.ToArray();
    }
    int selectedCopies=(int)copies.Value;
    var files = new List<string>(); foreach (string path in args.Files) files.Add(await PreparedFile(path));
    if(requireReviewed&&visibleSourceVersion!=SourceVersion())throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
    if(requireReviewed&&!Special&&selectedPagesKey!=PageSelectionKey())throw new InvalidOperationException(L("Page selection changed. Review the preview before printing."));
    bool reviewed=IsPolaroid&&activePolaroid!=null&&activePolaroid.Key==PolaroidKey();
    if(reviewed){
      var prepared=activePolaroid;string key=PolaroidKey();
      await Task.Run(()=>{
        string folder=Path.Combine(directory,"reviewed-polaroid");Directory.CreateDirectory(folder);
        var sources=files.Select(path=>{var info=new FileInfo(path);return new{path=path,length=info.Length,modifiedMs=(info.LastWriteTimeUtc-new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalMilliseconds};}).ToArray();
        var names=new List<string>();
        for(int index=0;index<prepared.Files.Length;index++){string name=(index+1).ToString("D5")+".png";File.Copy(prepared.Files[index],Path.Combine(folder,name),true);names.Add(name);}
        File.WriteAllText(Path.Combine(folder,"sheets.json"),NativePrint.Json.Serialize(new{version=1,mode=preset["mode"],photos=prepared.Photos,sheets=names,sources=sources}),new UTF8Encoding(false));
      });
      if(key!=PolaroidKey())throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
    }
    var payload=new Dictionary<string,object>{{"version",1},{"files",files},{"preset",preset},{"copies",selectedCopies}};if(reviewed)payload["preparedPolaroid"]=true;
    string request = Path.Combine(directory,"request.json"); File.WriteAllText(request,NativePrint.Json.Serialize(payload),new UTF8Encoding(false)); return request;
  }
  async Task Submit() {
    if (submitting || !print.Enabled) return; submitting=true; print.Enabled=false;
    bool restorePrint=true;
    try {
      if(visibleSourceVersion!=SourceVersion()||IsPolaroid&&(activePolaroid==null||activePolaroid.Key!=PolaroidKey())){restorePrint=false;await RenderPreview();if(print.Enabled)status.Text=L("Files changed. Review the updated preview before printing.");return;}
      string request = await Request(null,true);
      RememberPrinterSettings();
      if (args.Verify != null) { File.WriteAllText(Path.Combine(args.Verify,"request-path.txt"),request); return; }
      if (string.IsNullOrEmpty(args.App) || !File.Exists(args.App)) throw new InvalidOperationException("Fast Print worker is missing. Repair the app installation.");
      var arguments = new List<string>(); if (!string.IsNullOrEmpty(args.AppPath)) arguments.Add(args.AppPath); arguments.Add("--fast-print-request"); arguments.Add(request);
      pdf=null;loadedFile=null;pdfDocuments.Clear();pdfDocumentOrder.Clear();GC.Collect();GC.WaitForPendingFinalizers();
      using (var process = NativePrint.Start(args.App,arguments)) { Hide(); await Task.Run(()=>process.WaitForExit()); if(process.ExitCode!=0) { Show(); status.Text="Print preparation failed. Check the print queue before retrying."; return; } }
      if(await RestoreIdReview())return;
      try{await RestoreIdReview(true);}catch(Exception error){Trace.WriteLine("Fast Print could not remember ID printer options: "+error.Message);}
      submitting=false; Close();
    } catch(Exception error) { restorePrint=false;updating=false;if(!Visible&&args.Verify==null)Show();status.Text=error.Message;preview.Busy(error.Message);if(args.Verify!=null)throw;MessageBox.Show(this,error.Message,L("Fast Print"),MessageBoxButtons.OK,MessageBoxIcon.Error); }
    finally { submitting=false; if(!closing&&restorePrint)print.Enabled=settingsReady&&appliedProfile!="invalid"; }
  }
  async Task<bool> RestoreIdReview(bool completed=false){
    string marker=Path.Combine(session,completed?"id-last-settings.json":"id-returned.json");
    if(mode!="id-card"||!File.Exists(marker))return false;
    var returned=NativePrint.Read(marker);File.Delete(marker);
    var draft=completed?returned:NativePrint.Read(Path.Combine(session,"id-draft.json"));
    decimal keptCopies=copies.Value;
    string target=NativePrint.Text(returned,"printer");
    if(target!=""&&target!=Selected(printer)){
      int index=printer.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==target);
      if(index<0)throw new InvalidOperationException("The selected printer is no longer available.");
      updating=true;printer.SelectedIndex=index;updating=false;await SelectPrinter();
      if(!settingsReady)throw new InvalidOperationException(status.Text);
    }
    updating=true;mode="id-card";layouts.SelectedIndex=layouts.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="id-card");
    string returnedProfile=NativePrint.Text(returned,"profileId");
    Dictionary<string,object> rememberedProfile=null;
    if(returnedProfile!=""){
      if(!System.Text.RegularExpressions.Regex.IsMatch(returnedProfile,@"^[a-f0-9]{32}$"))throw new InvalidOperationException("Invalid returned printer preset.");
      var profile=NativePrint.Read(Path.Combine(session,returnedProfile+".json"));
      if(NativePrint.Text(profile,"printer")!=Selected(printer)||NativePrint.Text(profile,"driverFingerprint")!=FastPrintDriver.Fingerprint(Selected(printer)))throw new InvalidOperationException("The selected printer preset has changed. Choose it again.");
      var bytes=ProtectedData.Unprotect(Convert.FromBase64String(NativePrint.Text(profile,"driverSettings")),null,DataProtectionScope.CurrentUser);FastPrintDriver.Apply(settings,bytes);
      string savedId=NativePrint.Text(profile,"savedProfileId",returnedProfile),stamp=NativePrint.Text(profile,"savedProfileStamp",NativeLastSettings.ProfileStamp(profile));
      rememberedProfile=saved.FirstOrDefault(item=>NativePrint.Text(item,"id")==savedId&&NativePrint.Text(item,"printer")==Selected(printer)&&NativeLastSettings.ProfileStamp(item)==stamp);
    }
    else if(completed)FastPrintDriver.Apply(settings,captures[Selected(printer)].Bytes);
    string targetPaper=NativePrint.Text(returned,"paper");
    if(targetPaper!="")paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==targetPaper);
    if(returned.ContainsKey("landscape"))SetOrientation(NativePrint.Flag(returned,"landscape"));
    copies.Value=keptCopies;
    updating=true;color.SelectedIndex=NativePrint.Flag(draft,"color")&&canColor?0:color.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="mono");
    if(canDuplex)settings.PrinterSettings.Duplex=NativePrint.Flag(draft,"duplex")?(settings.PrinterSettings.Duplex==Duplex.Horizontal?Duplex.Horizontal:Duplex.Vertical):Duplex.Simplex;
    if(completed)quality.SelectedIndex=0;
    ApplyControls();driverCache[Selected(printer)]=FastPrintDriver.FromDocument(settings);explicitProfile=rememberedProfile==null?"current":NativePrint.Text(rememberedProfile,"id");appliedProfile=rememberedProfile==null?null:explicitProfile;appliedSavedSnapshot=rememberedProfile==null?null:NativePrint.Text(rememberedProfile,"driverSettings");profileError=null;UpdateProfiles();updating=false;
    RememberPrinterSettings();if(completed)return false;
    if(args.Verify==null){Show();Activate();}await RenderPreview();status.Text=L("ID edits saved. Choose printer settings, then Review ID.");return true;
  }
  internal async Task VerifyId(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();updating=true;mode="id-card";copies.Value=3;updating=false;Changed();await RenderPreview();
      for(int stage=1;stage<=3;stage++){
        if(stage==2){updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="A3");color.SelectedIndex=color.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="mono");updating=false;Changed();await RenderPreview();}
        if(stage==3){copies.Value=5;await RenderPreview();}
        if(stage<3){
          ApplyControls();var profile=StorePrinterPreset("Saved ID black and white — "+Selected(printer),FastPrintDriver.FromDocument(settings));
          // Virtual PDF drivers can keep a color DEVMODE; grayscale is rendered into the artwork.
          profile["color"]=false;File.WriteAllText(Path.Combine(NativePrint.LocalRoot,"profiles",NativePrint.Text(profile,"id")+".json"),NativePrint.Json.Serialize(profile),new UTF8Encoding(false));
        }
        AuditCheck(settingsReady&&print.Enabled,status.Text);
        File.WriteAllText(Path.Combine(args.Verify,"stage.txt"),stage.ToString());
        string request=await Request();
        var arguments=new List<string>();if(!string.IsNullOrEmpty(args.AppPath))arguments.Add(args.AppPath);arguments.Add("--fast-print-request");arguments.Add(request);arguments.Add("--fast-print-quiet");
        using(var process=NativePrint.Start(args.App,arguments,true)){var stdout=process.StandardOutput.ReadToEndAsync();var stderr=process.StandardError.ReadToEndAsync();await Task.Run(()=>process.WaitForExit());File.WriteAllText(Path.Combine(args.Verify,"stage-"+stage+".log"),(await stdout)+(await stderr));AuditCheck(process.ExitCode==0,"ID worker failed at stage "+stage);}
        if(stage<3){AuditCheck(await RestoreIdReview(),"Back did not restore native printer settings.");AuditCheck(Selected(printer)==NativePrint.Text(NativePrint.Read(Path.Combine(NativePrint.LocalRoot,"last-printer.json")),"printer"),"The ID-selected printer was lost on Back.");AuditCheck(File.Exists(Path.Combine(session,"id-draft.json")),"The ID worker removed saved edits.");File.Copy(Path.Combine(session,"id-draft.json"),Path.Combine(args.Verify,"expected-"+stage+".json"),true);}
        else AuditCheck(!await RestoreIdReview(),"Printing unexpectedly returned to printer settings.");
        if(stage==1){
          AuditCheck(copies.Value==3,"Changing the ID printer lost the sheet copy count.");
          string rememberedChoice=NativePrint.Text(NativePrint.Read(Path.Combine(NativePrint.LocalRoot,"last-printer.json")),"printer");
          using(var reopened=new PrintWindow(new Options(new[]{"--"}.Concat(args.Files).ToArray()))){var handle=reopened.Handle;await reopened.LoadPrinters();AuditCheck(Selected(reopened.printer)==rememberedChoice,"A fresh window lost the ID printer choice.");reopened.Close();}
          var invalid=NativePrint.Read(request);NativePrint.Map(invalid,"preset")["profileId"]=new string('0',32);File.WriteAllText(request,NativePrint.Json.Serialize(invalid));
          using(var process=NativePrint.Start(args.App,arguments,true)){var stdout=process.StandardOutput.ReadToEndAsync();var stderr=process.StandardError.ReadToEndAsync();await Task.Run(()=>process.WaitForExit());File.WriteAllText(Path.Combine(args.Verify,"invalid-profile.log"),(await stdout)+(await stderr));AuditCheck(process.ExitCode!=0,"An invalid profile was accepted.");}
          AuditCheck(File.Exists(Path.Combine(session,"id-draft.json")),"Failed printer validation deleted ID edits.");
        }
      }
      AuditCheck(!Visible,"ID verification became visible.");
      string remembered=NativePrint.Text(NativePrint.Read(Path.Combine(NativePrint.LocalRoot,"last-printer.json")),"printer");
      using(var fresh=new PrintWindow(new Options(new[]{"--"}.Concat(args.Files).ToArray()))){var handle=fresh.Handle;await fresh.LoadPrinters();AuditCheck(Selected(fresh.printer)==remembered,"A fresh Fast Print window did not remember the last printer.");fresh.Close();}
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=true,roundTrips=2,failedPrinterPreservedReview=true,lastPrinterRestored=true,paper=Selected(paper),copies=copies.Value,color=Selected(color),cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}
    finally{Close();}
  }
  async Task PresetReady(){await Task.Delay(70);for(int i=0;i<400&&!print.Enabled;i++)await Task.Delay(25);if(!print.Enabled)throw new InvalidOperationException(status.Text);}
  async Task<object> DirectionProof(string name){
    string folder=Path.Combine(args.Verify,name);Directory.CreateDirectory(folder);int selected=fileList.SelectedIndex;
    fileList.SelectedIndex=0;sheetIndex=0;await RenderPreview();await PresetReady();int sheets=(pageCount+PerSheet-1)/PerSheet;
    for(int index=0;index<sheets;index++){sheetIndex=index;await RenderPreview();await PresetReady();preview.Sheet.Save(Path.Combine(folder,"sheet-"+index+".png"),ImageFormat.Png);}
    string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));
    return new{name=name,paper=Selected(paper),per=PerSheet,landscape=Landscape,request=request,sheets=sheets,rotations=(int[])sourceRotations.Clone(),align=sameDirection.Checked,fill=fill.Checked};
  }
  internal async Task VerifyLastSettings(){
    Directory.CreateDirectory(args.Verify);
    try{
      AuditCheck(Path.GetFullPath(NativePrint.LocalRoot)==Path.GetFullPath(Path.Combine(args.Verify,"settings")),"Last settings checks require isolated settings.");
      Func<string,Task<PrintWindow>> open=async stage=>{
        string folder=Path.Combine(args.Verify,stage);Directory.CreateDirectory(folder);
        var window=new PrintWindow(new Options(new[]{"--verify-audit",folder,"--language",args.Language,"--appearance",args.Appearance??"light","--"}.Concat(args.Files.AsEnumerable().Reverse()).ToArray()));
        var handle=window.Handle;await window.LoadPrinters();await window.RenderPreview();AuditCheck(window.settingsReady&&window.print.Enabled,window.status.Text);return window;
      };
      string owner,other,id;byte[] expected,legacyBytes;Duplex expectedDuplex;int expectedTray;string expectedQuality;int privateBytes;
      using(var first=await open("first")){
        var target=first.printer.Items.Cast<Entry>().FirstOrDefault(item=>item.Id.IndexOf("EPSON",StringComparison.OrdinalIgnoreCase)>=0);
        if(target!=null){first.updating=true;first.printer.SelectedItem=target;first.updating=false;await first.SelectPrinter();}
        owner=first.Selected(first.printer);other=first.printer.Items.Cast<Entry>().Where(item=>item.Id!=owner).Select(item=>item.Id).FirstOrDefault();
        first.updating=true;first.paper.SelectedIndex=first.paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="A3");AuditCheck(first.paper.SelectedIndex>=0,"A3 driver is required for last settings checks.");
        first.color.SelectedIndex=first.color.Items.Count-1;first.SetOrientation(true);first.quality.SelectedIndex=first.quality.Items.Count>1?1:0;first.updating=false;first.copies.Value=3;
        if(first.canDuplex)first.settings.PrinterSettings.Duplex=Duplex.Vertical;
        var tray=first.settings.PrinterSettings.PaperSources.Cast<PaperSource>().LastOrDefault();if(tray!=null)first.settings.DefaultPageSettings.PaperSource=tray;
        first.driverCache[owner]=FastPrintDriver.FromDocument(first.settings);first.explicitProfile="current";first.appliedProfile=null;first.UpdateProfiles();first.ApplyAutomaticProfile();first.ApplyControls();
        legacyBytes=FastPrintDriver.FromDocument(first.settings);using(var normalized=new PrintDocument()){normalized.PrinterSettings.PrinterName=owner;FastPrintDriver.Apply(normalized,legacyBytes);normalized.PrinterSettings.Copies=1;expected=FastPrintDriver.FromDocument(normalized);}expectedDuplex=first.settings.PrinterSettings.Duplex;expectedTray=first.settings.DefaultPageSettings.PaperSource.RawKind;expectedQuality=first.Selected(first.quality);privateBytes=BitConverter.ToUInt16(expected,70);
        first.sourceRotations[0]=1;first.sourceCopies[0]=9;first.pageFilters[0]="range";first.pageRanges[0]="1";
        first.Close();
      }
      // Simulate a record written by an older release, including its old copy count.
      string legacyPath=NativeLastSettings.PathFor(owner);var legacy=NativePrint.Read(legacyPath);legacy["copies"]=3;legacy["driverSettings"]=Convert.ToBase64String(ProtectedData.Protect(legacyBytes,null,DataProtectionScope.CurrentUser));File.WriteAllText(legacyPath,NativePrint.Json.Serialize(legacy));
      using(var fresh=await open("after-cancel")){
        AuditCheck(fresh.Selected(fresh.printer)==owner&&fresh.Selected(fresh.paper)=="A3"&&fresh.Selected(fresh.color)=="mono"&&fresh.Selected(fresh.orientation)=="landscape"&&fresh.copies.Value==1&&fresh.Selected(fresh.quality)==expectedQuality,"Closing forgot printer controls or retained the previous copy count.");
        AuditCheck(fresh.settings.PrinterSettings.Duplex==expectedDuplex&&fresh.settings.DefaultPageSettings.PaperSource.RawKind==expectedTray,"Closing forgot duplex or tray.");
        AuditCheck(fresh.driverCache[owner].SequenceEqual(expected),"The full DEVMODE including private driver options changed.");
        AuditCheck(fresh.sourceRotations.All(turns=>turns==0)&&fresh.sourceCopies.All(count=>count==1)&&fresh.pageRotations.Count==0&&fresh.pageFilters.All(filter=>filter=="all"),"File-specific choices leaked into a new selection.");
        fresh.copies.Value=6;fresh.ApplyControls();var profile=fresh.StorePrinterPreset("Last settings — "+args.Language,FastPrintDriver.FromDocument(fresh.settings));id=NativePrint.Text(profile,"id");fresh.SelectSavedProfile(id);fresh.UpdateProfiles();await fresh.RenderPreview();AuditCheck(fresh.copies.Value==6,"Choosing a preset changed the current job's copies.");fresh.Close();
      }
      using(var named=await open("named-preset")){
        AuditCheck(named.Selected(named.profiles)==id&&named.appliedProfile==id&&named.Selected(named.paper)=="A3"&&named.copies.Value==1,"The saved preset was not restored with one job copy.");
        foreach(var size in new[]{new Size(1366,768),new Size(1920,1080)}){named.Size=size;await named.RenderPreview();NativePrint.Capture(named,Path.Combine(args.Verify,"remembered-"+size.Width+"x"+size.Height+".png"));}
        named.copies.Value=4;await named.Submit();AuditCheck(File.Exists(Path.Combine(named.args.Verify,"request-path.txt")),"The verification print request was not prepared.");
        var submitted=NativePrint.Read(File.ReadAllText(Path.Combine(named.args.Verify,"request-path.txt")));AuditCheck(NativePrint.Text(submitted,"copies")=="4","The selected job quantity was not submitted.");
        byte[] bytes;var remembered=NativeLastSettings.Read(owner,named.DriverFingerprint(owner),out bytes);AuditCheck(remembered!=null&&NativePrint.Text(remembered,"copies")=="1","The previous job quantity was saved.");using(var savedDocument=new PrintDocument()){savedDocument.PrinterSettings.PrinterName=owner;FastPrintDriver.Apply(savedDocument,bytes);AuditCheck(savedDocument.PrinterSettings.Copies==1,"The remembered driver snapshot retained job copies.");}
        named.Close();
      }
      using(var printed=await open("after-submit")){
        AuditCheck(printed.Selected(printed.profiles)==id&&printed.copies.Value==1,"The next job forgot the preset or retained old copies.");
        if(other!=null){printed.copies.Value=4;printed.updating=true;printed.printer.SelectedIndex=printed.printer.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==other);printed.updating=false;await printed.SelectPrinter();AuditCheck(printed.copies.Value==4,"Changing printer lost the current job copies.");printed.updating=true;printed.paper.SelectedIndex=printed.paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="A4");printed.SetOrientation(false);printed.updating=false;printed.copies.Value=2;printed.Close();}
        else printed.Close();
      }
      if(other!=null)using(var alternate=await open("other-printer")){
        AuditCheck(alternate.Selected(alternate.printer)==other&&alternate.Selected(alternate.paper)=="A4"&&alternate.copies.Value==1,"The second printer did not retain its own options or reset its copies.");alternate.copies.Value=5;
        alternate.updating=true;alternate.printer.SelectedIndex=alternate.printer.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==owner);alternate.updating=false;await alternate.SelectPrinter();
        AuditCheck(alternate.Selected(alternate.profiles)==id&&alternate.Selected(alternate.paper)=="A3"&&alternate.copies.Value==5,"Switching printers mixed their settings or reset current job copies.");
        await alternate.LoadPrinters(true);AuditCheck(alternate.Selected(alternate.paper)=="A3"&&alternate.copies.Value==5,"Refresh reset current job options.");alternate.Close();
      }
      using(var idDone=await open("id-completed")){
        idDone.updating=true;idDone.mode="id-card";idDone.layouts.SelectedIndex=idDone.layouts.Items.FindIndex(item=>item.Id=="id-card");idDone.updating=false;
        string request=await idDone.Request();var preset=NativePrint.Map(NativePrint.Read(request),"preset");
        File.WriteAllText(Path.Combine(idDone.session,"id-last-settings.json"),NativePrint.Json.Serialize(new{version=1,printer=owner,paper="A3",landscape=true,profileId=NativePrint.Text(preset,"profileId"),color=idDone.canColor,duplex=idDone.canDuplex}));
        await idDone.RestoreIdReview(true);AuditCheck(idDone.explicitProfile==id,"ID completion lost the originating named preset.");idDone.Close();
      }
      using(var afterId=await open("after-id")){AuditCheck(afterId.Selected(afterId.paper)=="A3"&&afterId.Selected(afterId.color)==(afterId.canColor?"color":"mono")&&afterId.Selected(afterId.profiles)==id,"ID completion forgot the final paper, color or preset.");afterId.Close();}
      string file=NativeLastSettings.PathFor(owner),original=File.ReadAllText(file);var stored=NativePrint.Read(file);byte[] decoded;
      AuditCheck(NativePrint.Text(stored,"driverSettings")!=Convert.ToBase64String(expected),"Driver data was stored without user encryption.");
      stored["driverFingerprint"]="changed-driver";File.WriteAllText(file,NativePrint.Json.Serialize(stored));AuditCheck(NativeLastSettings.Read(owner,FastPrintDriver.Fingerprint(owner),out decoded)==null,"Changed drivers reused stale settings.");
      File.WriteAllText(file,"{invalid");AuditCheck(NativeLastSettings.Read(owner,FastPrintDriver.Fingerprint(owner),out decoded)==null,"Corrupt preferences were accepted.");
      File.WriteAllText(file,original);stored=NativePrint.Read(file);stored["printer"]="another queue";File.WriteAllText(file,NativePrint.Json.Serialize(stored));AuditCheck(NativeLastSettings.Read(owner,FastPrintDriver.Fingerprint(owner),out decoded)==null,"Driver options leaked across printers.");
      File.WriteAllText(file,original);string profilePath=Path.Combine(NativePrint.LocalRoot,"profiles",id+".json"),profileText=File.ReadAllText(profilePath);File.Delete(profilePath);
      using(var removed=await open("removed-preset")){AuditCheck(removed.explicitProfile!=id&&removed.appliedProfile!=id&&removed.print.Enabled,"A removed preset was replayed or prevented printing.");removed.settingsReady=false;removed.Close();}
      File.WriteAllText(profilePath,profileText);File.WriteAllText(file,original);var edited=NativePrint.Read(profilePath);edited["notes"]="edited outside the dialog";File.WriteAllText(profilePath,NativePrint.Json.Serialize(edited));
      using(var changed=await open("changed-preset")){AuditCheck(changed.explicitProfile!=id&&changed.print.Enabled,"An edited preset replayed its old driver snapshot.");changed.settingsReady=false;changed.Close();}
      File.WriteAllText(profilePath,profileText);File.WriteAllText(file,original);
      AuditCheck(!Directory.GetFiles(Path.GetDirectoryName(file),"*.tmp").Any(),"A temporary preference write was left behind.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,printer=owner,otherPrinter=other,privateDriverBytes=privateBytes,cancelRestored=true,submitRestored=true,namedPresetRestored=true,perPrinterRestored=other!=null,fullDriverBytesPreserved=true,newFilesReset=true,idCompletionRestored=true,changedDriverRejected=true,removedPresetRejected=true,editedPresetRejected=true,corruptDataRejected=true,newJobCopiesReset=true,currentJobCopiesPreserved=true,legacyCopiesIgnored=true}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}
    finally{Close();}
  }
  internal async Task VerifyPerformance(){
    Directory.CreateDirectory(args.Verify);
    var heartbeat=Stopwatch.StartNew();long lastBeat=0,maxPause=0;int beats=0;
    using(var timer=new System.Windows.Forms.Timer{Interval=15}){
      timer.Tick+=delegate{long now=heartbeat.ElapsedMilliseconds;maxPause=Math.Max(maxPause,now-lastBeat);lastBeat=now;beats++;};timer.Start();
      try{
        var cold=Stopwatch.StartNew();await LoadPrinters();await PresetReady();cold.Stop();await Task.Delay(70);long startupPause=maxPause;maxPause=0;lastBeat=heartbeat.ElapsedMilliseconds;
        for(int file=1;file<args.Files.Count;file++){fileList.SelectedIndex=file;await PresetReady();await Task.Delay(30);}
        var states=new List<object>();
        foreach(string stock in new[]{"A4","A3"})foreach(int per in new[]{1,2,4,6,8,9,12,16}){
          updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==per.ToString());orientation.SelectedIndex=0;fileList.SelectedIndex=0;sheetIndex=0;updating=false;Changed();await PresetReady();
          string name=stock+"-"+per;preview.Sheet.Save(Path.Combine(args.Verify,name+".png"),ImageFormat.Png);
          int before=previewCompositions;var cpu=Process.GetCurrentProcess().TotalProcessorTime;var warm=Stopwatch.StartNew();
          for(int repeat=0;repeat<8;repeat++)await RenderPreview();warm.Stop();
          states.Add(new{name=name,compositions=previewCompositions-before,warmMs=warm.ElapsedMilliseconds,cpuMs=(Process.GetCurrentProcess().TotalProcessorTime-cpu).TotalMilliseconds});
        }
        // Changes that affect artwork must bypass any retained-preview fast path.
        layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");await PresetReady();RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();preview.Sheet.Save(Path.Combine(args.Verify,"rotated.png"),ImageFormat.Png);
        fill.Checked=!fill.Checked;await PresetReady();preview.Sheet.Save(Path.Combine(args.Verify,"fit.png"),ImageFormat.Png);
        if(color.Items.Count>1){color.SelectedIndex=color.Items.Count-1;await PresetReady();preview.Sheet.Save(Path.Combine(args.Verify,"mono.png"),ImageFormat.Png);}
        int selectionCompositions=previewCompositions;var selectedSheet=preview.Sheet;bool selectionReady=true;var selectionClock=Stopwatch.StartNew();
        for(int i=0;i<200;i++){preview.SelectItem(i%preview.Items.Length);selectionReady&=print.Enabled&&preview.Interactive;}
        selectionClock.Stop();selectionCompositions=previewCompositions-selectionCompositions;
        AuditCheck(selectionCompositions==0&&object.ReferenceEquals(selectedSheet,preview.Sheet)&&selectionReady,"Selecting a visible image recomposed the sheet or disabled Print.");
        updating=true;layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="1");orientation.SelectedIndex=0;fileList.SelectedIndex=0;sheetIndex=0;combineFiles.Checked=false;updating=false;Changed();await PresetReady();
        int navigationSheets=Math.Min(12,(await Inventory()).Counts[0]);long navigationRequests=pageRequests,navigationMisses=cacheMisses;var navigationClock=Stopwatch.StartNew();
        for(int index=0;index<navigationSheets;index++){sheetIndex=index;await RenderPreview();await PresetReady();preview.Sheet.Save(Path.Combine(args.Verify,"navigation-"+index+".png"),ImageFormat.Png);}
        navigationClock.Stop();navigationRequests=pageRequests-navigationRequests;navigationMisses=cacheMisses-navigationMisses;
        await Task.Delay(80);timer.Stop();
        File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,coldMs=cold.ElapsedMilliseconds,workingMiB=Process.GetCurrentProcess().WorkingSet64/1048576.0,maxUiPauseMs=Math.Max(maxPause,startupPause),startupPauseMs=startupPause,interactionPauseMs=maxPause,uiTicks=beats,photoDecodeOffUi=photoDecodeThread!=uiThread,compositions=previewCompositions,reuses=previewReuses,selectionReuses=selectionReuses,selectionCompositions=selectionCompositions,selectionMs=selectionClock.ElapsedMilliseconds,selectionReady=selectionReady,pdfDocumentLoads=pdfDocumentLoads,pdfDocumentsRetained=pdfDocuments.Count,navigationSheets=navigationSheets,navigationRequests=navigationRequests,navigationMisses=navigationMisses,navigationMs=navigationClock.ElapsedMilliseconds,states=states,cleanupDirectory=session}),new UTF8Encoding(false));
      }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
    }
  }
  internal async Task VerifyPresetPicker(){
    Directory.CreateDirectory(args.Verify);
    try{
      AuditCheck(Path.GetFullPath(NativePrint.LocalRoot)==Path.GetFullPath(Path.Combine(args.Verify,"settings")),"Preset picker checks require an isolated settings folder.");
      await LoadPrinters();await PresetReady();
      var pdfPrinter=printer.Items.Cast<Entry>().First(item=>item.Id=="Microsoft Print to PDF");
      updating=true;printer.SelectedItem=pdfPrinter;updating=false;await SelectPrinter();await PresetReady();
      AuditCheck(profiles.Items.Cast<Entry>().First().Label.Contains(L("No saved printer presets")),"Empty preset list has no explanation.");
      var alternate=printer.Items.Cast<Entry>().First(item=>item.Id!="Microsoft Print to PDF");
      updating=true;printer.SelectedItem=alternate;updating=false;await SelectPrinter();await PresetReady();
      color.SelectedIndex=color.Items.Count-1;await PresetReady();ApplyControls();var profile=StorePrinterPreset("A4 Noir blanc R-V — fixture",FastPrintDriver.FromDocument(settings));string id=NativePrint.Text(profile,"id");
      string profilePath=Path.Combine(NativePrint.LocalRoot,"profiles",id+".json"),original=File.ReadAllText(profilePath);
      updating=true;printer.SelectedItem=pdfPrinter;updating=false;await SelectPrinter();await PresetReady();
      saved.Clear();RefreshSavedPresetChoices();
      var choice=profiles.Items.Cast<Entry>().Single(item=>item.Id==id);AuditCheck(choice.Label.Contains(alternate.Id)&&Selected(printer)==pdfPrinter.Id,"Another printer's saved preset is hidden or silently switches the queue.");
      updating=true;layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");SetOrientation(true);fill.Checked=true;generalFill=true;fillEdited=true;copies.Value=5;sourceRotations[0]=1;updating=false;Changed();await PresetReady();
      await ChooseSavedProfile(id);await PresetReady();
      AuditCheck(Selected(printer)==alternate.Id&&Selected(profiles)==id&&appliedProfile==id,"Choosing the preset did not select its owning printer and driver snapshot.");
      AuditCheck(((PrintComboBox)profiles).FaceText()==NativePrint.Text(profile,"name")&&profiles.SelectedItem.ToString().Contains(alternate.Id),"Preset name was not concise or its owning printer was lost from the list.");
      AuditCheck(PerSheet==4&&Landscape&&fill.Checked&&copies.Value==5&&sourceRotations[0]==1,"Preset queue switching lost job layout, orientation, fill, copies or manual rotation.");
      AuditCheck(Selected(color)==(NativePrint.Flag(profile,"color")?"color":"mono")&&Selected(paper)==NativePrint.Text(profile,"paper"),"Saved paper or color was lost.");
      AuditCheck(File.ReadAllText(profilePath)==original&&settings.PrinterSettings.Duplex.ToString()==NativePrint.Text(profile,"duplex")&&settings.DefaultPageSettings.PaperSource.SourceName==NativePrint.Text(profile,"tray"),"Preset selection rewrote saved data or lost tray/duplex settings.");
      updating=true;printer.SelectedItem=pdfPrinter;updating=false;await SelectPrinter();await PresetReady();layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="id-card");await PresetReady();await ChooseSavedProfile(id);await PresetReady();AuditCheck(mode=="id-card"&&SelectedLayout=="id-card"&&print.Text==L("Review ID…"),"Choosing a preset for another printer left the ID workflow.");layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");await PresetReady();
      string missingId=new string('f',32);var missing=new Dictionary<string,object>(profile);missing["id"]=missingId;missing["printer"]="Unavailable preset printer";missing["name"]="Unavailable fixture";saved.Add(missing);UpdateProfiles();await ChooseSavedProfile(missingId);AuditCheck(!print.Enabled&&Selected(printer)==alternate.Id,"An unavailable preset printer enabled Print or changed the queue.");
      await ChooseSavedProfile(id);await PresetReady();
      ApplyControls();var added=StorePrinterPreset("New preset saved while Fast Print is open",FastPrintDriver.FromDocument(settings));string addedId=NativePrint.Text(added,"id");saved.Remove(added);RefreshSavedPresetChoices();AuditCheck(profiles.Items.Cast<Entry>().Any(item=>item.Id==addedId),"A newly saved preset requires restarting Fast Print.");
      profile["name"]="Updated saved preset name";File.WriteAllText(profilePath,NativePrint.Json.Serialize(profile));RefreshSavedPresetChoices();await PresetReady();AuditCheck(Selected(profiles)==id&&profiles.SelectedItem.ToString().Contains("Updated saved preset name"),"Refreshing an edited preset lost its identity.");
      var surface=Controls[0];surface.Dock=DockStyle.None;surface.Location=Point.Empty;var captures=new List<object>();
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var size in new[]{new Size(1366,768),new Size(1920,1080)}){surface.Size=size;surface.PerformLayout();await RenderPreview();await PresetReady();NativePrint.CaptureContent(surface,Path.Combine(args.Verify,(dark?"dark":"light")+"-"+size.Width+"x"+size.Height+".png"));captures.Add(new{dark=dark,width=surface.Width,height=surface.Height,requestedWidth=size.Width,requestedHeight=size.Height,contentSurface=true});}}
      var choices=profiles.Items.Cast<Entry>().Where(item=>System.Text.RegularExpressions.Regex.IsMatch(item.Id,@"^[a-f0-9]{32}$")).Select(item=>new{id=item.Id,label=item.Label}).ToArray();
      File.Delete(profilePath);RefreshSavedPresetChoices();AuditCheck(!print.Enabled,"Deleting the active preset left Print enabled with stale settings.");await ChooseSavedProfile("auto");await PresetReady();
      AuditCheck(driverSnapshotRequests==0,"Preset selection submitted a print request.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,initialPrinter=pdfPrinter.Id,presetPrinter=alternate.Id,crossPrinterSelection=true,liveReload=true,jobSettingsPreserved=true,missingPrinterGuarded=true,deletedPresetGuarded=true,captures=captures,choices=choices,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyPresetOrder(){
    Directory.CreateDirectory(args.Verify);
    try{
      AuditCheck(Path.GetFullPath(NativePrint.LocalRoot)==Path.GetFullPath(Path.Combine(args.Verify,"settings")),"Preset order verification requires an isolated settings folder.");
      Directory.CreateDirectory(NativePrint.LocalRoot);string orderFile=Path.Combine(NativePrint.LocalRoot,"preset-order.json");if(File.Exists(orderFile))File.Delete(orderFile);
      string owner="EPSON WF — verification",other="Other printer";var ids=new[]{new string('a',32),new string('b',32),new string('c',32),new string('d',32)};
      var names=new[]{"ID — two sides — black and white","A4 — photo paper — rear tray","A3 — 80 gsm — cassette","Other preset"};
      string profileDirectory=Path.Combine(NativePrint.LocalRoot,"profiles");Directory.CreateDirectory(profileDirectory);var originals=new Dictionary<string,string>();
      for(int index=0;index<ids.Length;index++){
        var profile=new Dictionary<string,object>{{"version",1},{"id",ids[index]},{"name",names[index]},{"printer",index==3?other:owner},{"paper","A4"},{"color",true},{"landscape",false},{"tray","Rear tray"},{"driverSettings","unchanged-private-driver-snapshot"}};
        string path=Path.Combine(profileDirectory,ids[index]+".json");File.WriteAllText(path,NativePrint.Json.Serialize(profile),new UTF8Encoding(false));originals[path]=File.ReadAllText(path);saved.Add(profile);
      }
      string preferencesFile=Path.Combine(NativePrint.LocalRoot,"preferences.json"),preferenceText="{\"version\":1,\"defaultPrinter\":\"Keep my choice\",\"profiles\":{},\"optionPrinters\":{}}";File.WriteAllText(preferencesFile,preferenceText);
      NativePresetOrder.Save(other,new[]{ids[3]});var expected=new[]{ids[0],ids[2],ids[1]};
      updating=true;printer.Items.Add(new Entry(owner,owner));printer.SelectedIndex=0;explicitProfile=ids[0];updating=false;UpdateProfiles();
      Func<Entry[]> entries=()=>profiles.Items.Cast<Entry>().Where(item=>saved.Any(profile=>NativePrint.Text(profile,"id")==item.Id&&NativePrint.Text(profile,"printer")==owner)).ToArray();
      AuditCheck(entries().Select(item=>item.Id).SequenceEqual(new[]{ids[2],ids[1],ids[0]}),"Unordered presets must use their names.");
      using(var dialog=new PresetOrderDialog(owner,entries(),L,Font,args.Language=="ar",ids[0])){
        AuditCheck(!dialog.Down.Enabled&&!dialog.SaveButton.Enabled,"Order buttons ignored list boundaries or unchanged state.");dialog.MoveSelected(-1);dialog.MoveSelected(-1);AuditCheck(!dialog.Up.Enabled&&dialog.SaveButton.Enabled,"Move up did not reach the first position.");dialog.SaveOrder();
      }
      UpdateProfiles();AuditCheck(entries().Select(item=>item.Id).SequenceEqual(expected),"Native preset list ignored the saved order.");AuditCheck(Selected(profiles)==ids[0],"Reordering replaced the selected preset.");
      string savedOrder=File.ReadAllText(orderFile);
      using(var canceled=new PresetOrderDialog(owner,entries(),L,Font,args.Language=="ar",ids[0])){canceled.MoveSelected(1);canceled.Close();}
      AuditCheck(File.ReadAllText(orderFile)==savedOrder,"Cancel saved an unfinished order.");
      bool rejected=false;try{NativePresetOrder.Save(owner,new[]{ids[0],ids[0]});}catch{rejected=true;}AuditCheck(rejected&&File.ReadAllText(orderFile)==savedOrder,"An invalid order changed saved data.");
      using(var reopened=new PrintWindow(new Options(new[]{"--"}.Concat(args.Files).ToArray()))){reopened.updating=true;reopened.printer.Items.Add(new Entry(owner,owner));reopened.printer.SelectedIndex=0;reopened.saved.AddRange(saved);reopened.explicitProfile=ids[0];reopened.updating=false;reopened.UpdateProfiles();AuditCheck(reopened.profiles.Items.Cast<Entry>().Where(item=>saved.Any(profile=>NativePrint.Text(profile,"id")==item.Id&&NativePrint.Text(profile,"printer")==owner)).Select(item=>item.Id).SequenceEqual(expected),"A fresh window lost the saved order.");reopened.Close();}
      saved[0]["name"]="Renamed preset";UpdateProfiles();AuditCheck(entries()[0].Id==ids[0],"Renaming changed the saved order.");
      string addedId=new string('e',32);var added=new Dictionary<string,object>(saved[0]);added["id"]=addedId;added["name"]="AAA new preset";saved.Add(added);File.WriteAllText(Path.Combine(profileDirectory,addedId+".json"),NativePrint.Json.Serialize(added));UpdateProfiles();AuditCheck(entries().Last().Id==addedId,"A new preset displaced the arranged presets.");
      var captures=new List<object>();
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var size in new[]{new Size(1366,768),new Size(1920,1080)}){Size=size;using(var dialog=new PresetOrderDialog(owner,entries(),L,Font,args.Language=="ar",ids[1])){dialog.MoveSelected(1);await Task.Delay(20);NativePrint.Capture(dialog,Path.Combine(args.Verify,(dark?"dark":"light")+"-"+size.Width+"x"+size.Height+".png"));AuditCheck(dialog.Width<size.Width&&dialog.Height<size.Height,"Arrange dialog exceeds the screen.");AuditCheck(dialog.SaveButton.Right<=dialog.SaveButton.Parent.ClientSize.Width,"Save action is clipped.");captures.Add(new{dark=dark,screenWidth=size.Width,screenHeight=size.Height,width=dialog.Width,height=dialog.Height});}}}
      AuditCheck(NativePresetOrder.Positions(other,true)[ids[3]]==0,"Reordering changed another printer's order.");
      AuditCheck(File.ReadAllText(preferencesFile)==preferenceText&&originals.All(item=>File.ReadAllText(item.Key)==item.Value),"Reordering modified driver snapshots or printing preferences.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,printer=owner,ids=expected.Concat(new[]{addedId}).ToArray(),captures=captures,cancelPreserved=true,selectionPreserved=true,settingsUnchanged=true,restartPreserved=true,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyPageSelection(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();var inventory=await Inventory();
      AuditCheck(inventory.Counts.SequenceEqual(new[]{5,3,1}),"Unexpected page-selection fixtures.");
      var reports=new List<object>();
      pageFilter.SelectedIndex=3;pageRange.Text="5, 1–2, 2";await RenderPreview();await PresetReady();
      AuditCheck(SelectedPages(0,5).SequenceEqual(new[]{0,1,4}),"Ranges did not normalize or remove duplicates.");
      fileList.SelectedIndex=1;await PresetReady();pageFilter.SelectedIndex=2;await PresetReady();
      fileList.SelectedIndex=2;await PresetReady();pageFilter.SelectedIndex=2;await RenderPreview();
      AuditCheck(SelectedPages(2,1).Length==0&&print.Enabled,"An empty even-page image must be skipped while other pages remain.");
      fileList.SelectedIndex=0;await PresetReady();AuditCheck(Selected(pageFilter)=="range"&&pageRange.Text=="5, 1–2, 2","Switching files lost its selection.");
      foreach(string invalid in new[]{"0","3-1","1,","6","1-9999999999999999999","one",""}){
        pageRange.Text=invalid;try{await RenderPreview();}catch{}await Task.Delay(80);AuditCheck(!print.Enabled,"Invalid range enabled Print: "+invalid);
      }
      pageRange.Text="١–٢، ٥";await RenderPreview();await PresetReady();AuditCheck(SelectedPages(0,5).SequenceEqual(new[]{0,1,4}),"Arabic range digits/separators failed.");
      pageFilter.SelectedIndex=1;await RenderPreview();await PresetReady();AuditCheck(SelectedPages(0,5).SequenceEqual(new[]{0,2,4}),"Odd page selection failed.");
      pageFilter.SelectedIndex=0;await RenderPreview();await PresetReady();AuditCheck(SelectedPages(0,5).SequenceEqual(new[]{0,1,2,3,4}),"All pages did not restore the full document.");
      pageFilter.SelectedIndex=3;await RenderPreview();await PresetReady();
      foreach(string stock in new[]{"A4","A3"})foreach(int per in new[]{1,2,4})foreach(bool merge in new[]{false,true}){
        updating=true;fileList.SelectedIndex=0;sheetIndex=0;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==per.ToString());combineFiles.Checked=merge;orientation.SelectedIndex=0;copies.Value=2;updating=false;Changed();await PresetReady();
        string name=stock+"-"+per+"-"+(merge?"merged":"separate"),folder=Path.Combine(args.Verify,name);Directory.CreateDirectory(folder);var sheets=new List<string>();
        foreach(int file in merge?new[]{0}:new[]{0,1}){
          updating=true;fileList.SelectedIndex=file;sheetIndex=0;updating=false;SyncPageControls();await RenderPreview();await PresetReady();int total=(pageCount+per-1)/per;
          for(int sheet=0;sheet<total;sheet++){sheetIndex=sheet;await RenderPreview();await PresetReady();string path=Path.Combine(folder,"sheet-"+sheets.Count+".png");preview.Sheet.Save(path,ImageFormat.Png);sheets.Add(path);}
        }
        string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));
        reports.Add(new{name=name,per=per,merge=merge,request=request,sheets=sheets,simplex=CountOutput(inventory,false),duplex=CountOutput(inventory,true)});
      }
      updating=true;fileList.SelectedIndex=0;sheetIndex=0;updating=false;SyncPageControls();
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}){Size=size;await RenderPreview();NativePrint.Capture(this,Path.Combine(args.Verify,(dark?"dark":"light")+"-"+Width+"x"+Height+".png"));AuditCheck(pageRange.ClientSize.Width>=100&&pageFilter.ClientSize.Width>=100,"Page controls are clipped.");}}
      layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="id-card");await PresetReady();AuditCheck(!pageFilter.Enabled&&!pageRange.Enabled,"Document page controls must not change ID output.");
      layouts.SelectedIndex=0;await PresetReady();AuditCheck(pageRange.Enabled&&pageRange.Text=="١–٢، ٥","Returning from ID lost the range.");
      for(int file=0;file<args.Files.Count;file++){pageFilters[file]="range";pageRanges[file]="0";}
      try{await RenderPreview();}catch{}AuditCheck(!print.Enabled,"An invalid job enabled Print.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,selection=new[]{new[]{0,1,4},new[]{1},new int[0]},reports=reports,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyCombined(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();var inventory=await Inventory();var reports=new List<object>();
      if(Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_STOCK_UI")!="1")foreach(string stock in new[]{"A4","A3"})foreach(int per in new[]{2,4,6,8,9,12,16})foreach(bool merge in new[]{false,true}){
        updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==per.ToString());orientation.SelectedIndex=0;combineFiles.Checked=merge;fill.Checked=false;fillEdited=true;copies.Value=2;updating=false;Changed();await PresetReady();
        string name=stock+"-"+per+"-"+(merge?"merged":"separate"),folder=Path.Combine(args.Verify,name);Directory.CreateDirectory(folder);
        var sheets=new List<string>();
        if(merge){fileList.SelectedIndex=0;sheetIndex=0;await RenderPreview();await PresetReady();int count=(inventory.Counts.Sum()+per-1)/per;for(int page=0;page<count;page++){sheetIndex=page;await RenderPreview();await PresetReady();string file=Path.Combine(folder,"sheet-"+page+".png");preview.Sheet.Save(file,ImageFormat.Png);sheets.Add(file);}}
        string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));
        reports.Add(new{name=name,per=per,paper=stock,merge=merge,request=request,simplex=CountOutput(inventory,false),duplex=CountOutput(inventory,true),sheets=sheets.ToArray()});
      }
      // Save and reselect two paper/tray snapshots without changing Windows defaults.
      var presets=new List<object>();
      foreach(string stock in new[]{"A4","A3"}){
        updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);updating=false;ApplyControls();var bytes=FastPrintDriver.Capture(Selected(printer),IntPtr.Zero,FastPrintDriver.FromDocument(settings),false);var profile=StorePrinterPreset(stock+" - 80 gsm - test tray",bytes);
        updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id!=(stock));updating=false;UpdateProfiles();string id=NativePrint.Text(profile,"id");int index=profiles.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==id);AuditCheck(index>=0,"Saved stock was hidden by the current paper size.");profiles.SelectedIndex=index;await PresetReady();AuditCheck(Selected(paper)==stock&&appliedProfile==id,"Named preset did not restore paper and captured driver settings.");
        var restored=ProtectedData.Unprotect(Convert.FromBase64String(NativePrint.Text(profile,"driverSettings")),null,DataProtectionScope.CurrentUser);AuditCheck(bytes.SequenceEqual(restored),"Vendor DEVMODE bytes were not preserved.");presets.Add(new{paper=stock,tray=settings.DefaultPageSettings.PaperSource.SourceName,fullDriverBytes=true});
      }
      SavePrinterPreset(Path.Combine(args.Verify,"save-printer-preset.png"));
      combineFiles.Checked=true;
      foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}){Size=size;fileList.SelectedIndex=0;sheetIndex=0;await RenderPreview();NativePrint.Capture(this,Path.Combine(args.Verify,"native-"+Width+"x"+Height+".png"));}
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,counts=inventory.Counts,reports=reports,presets=presets,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyDirection(){
    if(Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_MONTAGE")=="1"){await VerifyMontage();return;}
    if(Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_UI")=="1"){await VerifyFastPrintUi();return;}
    if(Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_WINDOW_SIZE")=="1"){await VerifyInitialWindowSize();return;}
    if(Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_PAGE_ROTATION")=="1"){await VerifyPageRotation();return;}
    if(Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_SHEET_IMAGES")=="1"){await VerifySheetImageSelection();return;}
    if(Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_IMAGE_COPIES")=="1"){await VerifyImageCopies();return;}
    if(Environment.GetEnvironmentVariable("FAST_PRINT_VERIFY_FIVE_SEVEN")=="1"){await VerifyFiveSeven();return;}
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();AuditCheck(SourceOrientation&&!fill.Checked,"One-up must keep original orientation by default.");
      var reports=new List<object>();
      foreach(string stock in new[]{"A4","A3"})foreach(int per in new[]{2,4,6,8,9,12,16})foreach(bool landscape in new[]{false,true}){
        updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==per.ToString());SetOrientation(landscape);fileList.SelectedIndex=0;sheetIndex=0;for(int i=0;i<sourceRotations.Length;i++)sourceRotations[i]=0;updating=false;Changed();await PresetReady();
        AuditCheck(orientation.Enabled&&rotateSelected.Enabled,"A multi-photo preset locked manual orientation or rotation.");
        AuditCheck(!SourceOrientation&&orientation.Items[0].ToString()==L("Preset direction"),"N-up must not present Original orientation as its default.");
        AuditCheck(Landscape==landscape&&sameDirection.Checked&&fill.Checked,"N-up defaults did not align/fill the photo slots.");
        reports.Add(await DirectionProof(stock+"-"+per+"-"+(landscape?"landscape":"portrait")));
      }
      paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="A4");layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="2");SetOrientation(false);fileList.SelectedIndex=0;sheetIndex=0;await PresetReady();
      RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();AuditCheck(sourceRotations[0]==1&&sourceRotations.Skip(1).All(turn=>turn==0),"Manual rotation changed another photo.");reports.Add(await DirectionProof("manual-selected"));
      fileList.SelectedIndex=0;for(int i=0;i<3;i++){fileList.SelectedIndex=0;RotateSelectedSource(rotateSelected,EventArgs.Empty);}await PresetReady();
      sameDirection.Checked=false;await PresetReady();reports.Add(await DirectionProof("direction-off"));sameDirection.Checked=true;await PresetReady();
      foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}){Size=size;sheetIndex=0;fileList.SelectedIndex=0;await RenderPreview();NativePrint.Capture(this,Path.Combine(args.Verify,"native-"+Width+"x"+Height+".png"));}
      layouts.SelectedIndex=0;await PresetReady();AuditCheck(SourceOrientation&&!fill.Checked,"Returning to one-up must restore original direction and complete-photo fit.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,reports=reports,manualRotationEnabled=true,oneUpOriginalRestored=true,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyMontage(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();
      var surface=Controls[0];surface.Dock=DockStyle.None;surface.Location=Point.Empty;surface.Size=new Size(1366,768);
      var reports=new List<object>();var captures=new List<object>();
      updating=true;layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="9");SetOrientation(false);combineFiles.Checked=true;sameDirection.Checked=false;compact.Checked=true;actualSize.Checked=true;separatorLines.Checked=true;separatorColor=Color.FromArgb(224,32,128);gapMm=0;fill.Checked=true;fillEdited=true;updating=false;Changed();await PresetReady();
      AuditCheck(!fill.Enabled,"Actual size must disable cropping.");
      foreach(string stock in new[]{"A4","A3"})foreach(bool mono in new[]{false,true}){
        updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);color.SelectedIndex=mono?color.Items.Count-1:0;sheetIndex=0;fileList.SelectedIndex=0;updating=false;Changed();await PresetReady();
        string name=stock+(mono?"-mono":"-color"),folder=Path.Combine(args.Verify,name);Directory.CreateDirectory(folder);var sheets=new List<string>();var bounds=new List<object>();
        int total=(pageCount+PerSheet-1)/PerSheet;
        for(int sheet=0;sheet<total;sheet++){
          sheetIndex=sheet;await RenderPreview();await PresetReady();string file=Path.Combine(folder,"sheet-"+sheet+".png");preview.Sheet.Save(file,ImageFormat.Png);sheets.Add(file);
          foreach(var item in preview.Items){var size=await PhysicalSize(item.Source,item.Page);float expectedWidth=item.Turns%2==0?size.Width:size.Height,expectedHeight=item.Turns%2==0?size.Height:size.Width;float width=item.Bounds.Width*(stock=="A4"?210:297)/preview.Sheet.Width,height=item.Bounds.Height*(stock=="A4"?297:420)/preview.Sheet.Height;AuditCheck(Math.Abs(width-expectedWidth)<.01&&Math.Abs(height-expectedHeight)<.01,"Actual dimensions changed in preview.");bounds.Add(new{file=item.Source,page=item.Page,widthMm=width,heightMm=height,turns=item.Turns});}
        }
        string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));
        reports.Add(new{name=name,request=request,sheets=sheets,bounds=bounds});
      }
      updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="A4");color.SelectedIndex=0;sheetIndex=0;fileList.SelectedIndex=0;pageRotations[Tuple.Create(0,0)]=1;updating=false;Changed();await PresetReady();
      var rotationFolder=Path.Combine(args.Verify,"rotation");Directory.CreateDirectory(rotationFolder);preview.Sheet.Save(Path.Combine(rotationFolder,"sheet-0.png"),ImageFormat.Png);string rotatedRequest=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));
      AuditCheck(preview.Items[0].Turns==1,"Manual rotation was lost.");
      // Fixed grid cells cannot contain a rotated 85 mm badge. Compact packing can.
      updating=true;compact.Checked=false;updating=false;bool rejected=false;try{await RenderPreview();}catch(InvalidOperationException error){rejected=error.Message==NativeLayout.SizeError;}
      AuditCheck(rejected&&!print.Enabled,"An oversized actual-size layout enabled Print.");
      updating=true;compact.Checked=true;pageRotations.Clear();updating=false;Changed();await PresetReady();
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var size in new[]{new Size(1366,768),new Size(1600,900),new Size(1920,1080),new Size(820,640)}){
        surface.Size=size;NativePrint.CaptureLayout(surface);await RenderPreview();await PresetReady();
        foreach(var control in new Control[]{compact,actualSize,separatorLines,separatorColorButton}){AuditCheck(control.TabStop&&control.AccessibleName.Length>0,"Montage option is not keyboard accessible.");AuditCheck(control.Parent.ClientRectangle.Contains(control.Bounds),"Montage option is clipped.");}
        var scroll=compact.Parent.Parent as ScrollableControl;AuditCheck(scroll!=null&&scroll.AutoScroll,"Montage options do not scroll in small windows.");
        string name=(dark?"dark":"light")+"-"+size.Width+"x"+size.Height;NativePrint.CaptureContent(surface,Path.Combine(args.Verify,name+".png"));captures.Add(new{dark=dark,width=size.Width,height=size.Height});
      }}
      updating=true;actualSize.Checked=false;fill.Checked=false;generalFill=false;sheetIndex=0;fileList.SelectedIndex=0;updating=false;Changed();await PresetReady();
      var fittedFolder=Path.Combine(args.Verify,"compact-fit");Directory.CreateDirectory(fittedFolder);preview.Sheet.Save(Path.Combine(fittedFolder,"sheet-0.png"),ImageFormat.Png);string fittedRequest=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));
      AuditCheck(fill.Enabled,"Leaving actual size did not restore Fit to frame.");
      layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="id-card");await PresetReady();AuditCheck(!compact.Enabled&&!actualSize.Enabled&&!separatorLines.Enabled,"Montage settings leaked into ID mode.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,reports=reports,captures=captures,rotatedRequest=rotatedRequest,fittedRequest=fittedRequest,rejectedOversize=true,actualSizeDisablesCrop=true,specialModesIsolated=true,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyInitialWindowSize(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();var preferred=Size;var minimum=MinimumSize;int borderWidth=Width-ClientSize.Width,borderHeight=Height-ClientSize.Height;
      var compactWork=new Rectangle(0,0,1366,728);var desktopWork=new Rectangle(0,0,1920,1032);var secondaryWork=new Rectangle(-1600,80,1600,900);var tinyWork=new Rectangle(0,0,800,600);
      var compact=NativePrint.InitialWindowBounds(compactWork,preferred,minimum);var desktop=NativePrint.InitialWindowBounds(desktopWork,preferred,minimum);var secondary=NativePrint.InitialWindowBounds(secondaryWork,preferred,minimum);var tiny=NativePrint.InitialWindowBounds(tinyWork,preferred,minimum);
      foreach(var item in new[]{new{work=compactWork,bounds=compact},new{work=desktopWork,bounds=desktop},new{work=secondaryWork,bounds=secondary},new{work=tinyWork,bounds=tiny}}){
        AuditCheck(item.work.Contains(item.bounds),"The initial window extends beyond the monitor work area.");
        AuditCheck(Math.Abs((item.bounds.Left-item.work.Left)-(item.work.Right-item.bounds.Right))<=1&&Math.Abs((item.bounds.Top-item.work.Top)-(item.work.Bottom-item.bounds.Bottom))<=1,"The initial window is not centered in the work area.");
      }
      AuditCheck(desktop.Height>compact.Height+100&&desktop.Height<desktopWork.Height-16,"The larger screen did not provide more height or left no breathing room.");
      AuditCheck(desktop.Width==preferred.Width&&secondary.Left<0,"The default width changed or secondary-monitor placement failed.");
      using(var trial=new PrintWindow(new Options(new[]{"--"}.Concat(args.Files).ToArray()))){var handle=trial.Handle;var expected=NativePrint.InitialWindowBounds(desktopWork,trial.Size,trial.MinimumSize);trial.PlaceInitialWindow(desktopWork);AuditCheck(trial.Bounds==expected&&trial.StartPosition==FormStartPosition.Manual,"The calculated bounds were not applied to the window.");trial.Close();}
      using(var trial=new PrintWindow(new Options(new[]{"--"}.Concat(args.Files).ToArray()))){var handle=trial.Handle;var expected=NativePrint.InitialWindowBounds(tinyWork,trial.Size,trial.MinimumSize);trial.PlaceInitialWindow(tinyWork);AuditCheck(trial.Bounds==expected&&tinyWork.Contains(trial.Bounds),"An exceptionally small work area left the window off-screen.");trial.Close();}
      var surface=Controls[0];surface.Dock=DockStyle.None;surface.Location=Point.Empty;var captures=new List<object>();int compactPreview=0,desktopPreview=0;
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var item in new[]{new{name="compact",bounds=compact},new{name="desktop",bounds=desktop}}){
        surface.Size=new Size(item.bounds.Width-borderWidth,item.bounds.Height-borderHeight);NativePrint.CaptureLayout(surface);await RenderPreview();await PresetReady();NativePrint.CaptureLayout(surface);
        foreach(var control in new Control[]{printer,profiles,paper,color,orientation,quality,fileList,pageFilter,rotateSelected,imageCopies,fill,sameDirection,copies,print,previous,next})for(Control current=control;current!=surface&&current.Parent!=null;current=current.Parent)AuditCheck(current.Parent.ClientRectangle.Contains(current.Bounds),"Control clipped in the initial "+item.name+" window: "+control.AccessibleName);
        AuditCheck(preview.Width>=300&&preview.Height>=140&&layouts.Controls.Cast<Control>().All(tile=>layouts.ClientRectangle.Contains(tile.Bounds)),"The initial window hid preview or layout choices.");
        if(!dark){if(item.name=="compact")compactPreview=preview.Height;else desktopPreview=preview.Height;}
        string name=(dark?"dark":"light")+"-"+item.name;NativePrint.CaptureContent(surface,Path.Combine(args.Verify,name+".png"));captures.Add(new{name=item.name,dark=dark,width=surface.Width,height=surface.Height,previewWidth=preview.Width,previewHeight=preview.Height});
      }}
      AuditCheck(desktopPreview>compactPreview+100,"The taller window did not increase the preview area.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,preferred=preferred,compact=compact,desktop=desktop,secondary=secondary,tiny=tiny,compactWork=compactWork,desktopWork=desktopWork,secondaryWork=secondaryWork,tinyWork=tinyWork,compactPreview=compactPreview,desktopPreview=desktopPreview,placementApplied=true,captures=captures,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyFastPrintUi(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");await PresetReady();
      ApplyControls();var profile=StorePrinterPreset("A4 — Noir et blanc — محفوظ — My saved printer preset",FastPrintDriver.FromDocument(settings));UpdateProfiles();await ChooseSavedProfile(NativePrint.Text(profile,"id"));await PresetReady();
      var surface=Controls[0];surface.Dock=DockStyle.None;surface.Location=Point.Empty;var captures=new List<object>();
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var size in new[]{new Size(1366,768),new Size(1600,900),new Size(1920,1080),new Size(820,640)}){
        surface.Size=size;NativePrint.CaptureLayout(surface);await RenderPreview();await PresetReady();NativePrint.CaptureLayout(surface);
        foreach(var control in new Control[]{printer,profiles,paper,color,orientation,quality,fileList,pageFilter,rotateSelected,fill,sameDirection,combineFiles,copies,print,previous,next}){
          for(Control current=control;current!=surface&&current.Parent!=null;current=current.Parent)AuditCheck(current.Parent.ClientRectangle.Contains(current.Bounds),"Control clipped: "+control.AccessibleName+" / "+control.Text+" at "+size+" bounds "+current.Bounds+" parent "+current.Parent.ClientRectangle);
        }
        AuditCheck(preview.Width>=300&&preview.Height>=140,"Preview lost its working area at "+size+": "+preview.Size);
        AuditCheck(layouts.Controls.Cast<Control>().All(tile=>layouts.ClientRectangle.Contains(tile.Bounds)),"A quick layout needs scrolling or is clipped at "+size);
        AuditCheck(profiles.Parent.Top==printer.Parent.Top&&profiles.Parent.Parent==printer.Parent.Parent,"Printer and saved preset are not grouped together.");
        AuditCheck(rotateSelected.Parent==previous.Parent&&fill.Parent==rotateSelected.Parent,"Preview editing commands are not grouped together.");
        AuditCheck(!NativePrint.ControlVisible(pageRange),"The unused range entry should be hidden.");
        var before=preview.Sheet;int compositions=previewCompositions;bool ready=print.Enabled;preview.SelectItem(1);AuditCheck(previewCompositions==compositions&&object.ReferenceEquals(before,preview.Sheet)&&print.Enabled==ready,"Selection recomposed the preview or changed print readiness.");
        string name=(dark?"dark":"light")+"-"+size.Width+"x"+size.Height;NativePrint.CaptureContent(surface,Path.Combine(args.Verify,name+".png"));captures.Add(new{dark=dark,width=size.Width,height=size.Height,previewWidth=preview.Width,previewHeight=preview.Height});
      }}
      pageFilter.SelectedIndex=3;pageRange.Text="1";await PresetReady();AuditCheck(NativePrint.ControlVisible(pageRange)&&pageRange.Enabled,"Choosing Page range did not reveal its editor.");pageFilter.SelectedIndex=0;await PresetReady();
      var counts=new[]{"1","2","4","5","6","7","8","9","12","16","id-card"};AuditCheck(layouts.Items.Select(item=>item.Id).SequenceEqual(counts),"Quick layouts lost or reordered an option.");
      for(int i=0;i<counts.Length;i++){var tile=layouts.Controls[i];AuditCheck(tile.AccessibleName==layouts.Items[i].Label&&tile.AccessibilityObject.Role==AccessibleRole.RadioButton,"A layout option lost its accessible name or role.");}
      layouts.SelectedIndex=3;await PresetReady();var key=new KeyEventArgs(Keys.Right);typeof(Control).GetMethod("OnKeyDown",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(layouts.Controls[3],new object[]{key});int target=args.Language=="ar"?2:4;AuditCheck(key.Handled&&layouts.SelectedIndex==target&&(layouts.Controls[target].AccessibilityObject.State&AccessibleStates.Checked)!=0,"Keyboard navigation or the selected layout state failed.");
      layouts.SelectedIndex=1;await PresetReady();key=new KeyEventArgs(Keys.Down);typeof(Control).GetMethod("OnKeyDown",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(layouts.Controls[1],new object[]{key});AuditCheck(key.Handled&&layouts.SelectedIndex==6,"Down arrow did not move to the next layout row.");
      layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="id-card");await PresetReady();AuditCheck(SelectedLayout=="id-card"&&mode=="id-card","The ID layout is unavailable.");layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");await PresetReady();
      // The native cache holds at most four documents and keeps a warm document
      // across an intervening photo decode, without retaining original files.
      string sample=args.Files.FirstOrDefault(file=>Path.GetExtension(file).Equals(".pdf",StringComparison.OrdinalIgnoreCase));
      if(sample!=null){string last=null;for(int i=0;i<6;i++){last=Path.Combine(args.Verify,"cache-"+i+".pdf");File.Copy(sample,last,true);await CachedPdfDocument(last);AuditCheck(pdfDocuments.Count<=4,"PDF document cache exceeded its bound.");}int loads=pdfDocumentLoads;await CachedPdfDocument(last);AuditCheck(pdfDocumentLoads==loads,"Warm PDF was reopened.");}
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,captures=captures,selectionReuses=selectionReuses,pdfCacheBounded=true,pdfDocumentLoads=pdfDocumentLoads,quickLayoutsAccessible=true,keyboardLayoutNavigation=true,idLayoutAvailable=true,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyPageRotation(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();var reports=new List<object>();
      Action<int> click=slot=>{var sheet=preview.SheetBounds();var cell=preview.Items[slot].Bounds;var point=new Point((int)(sheet.X+(cell.X+cell.Width/2)*sheet.Width/preview.Sheet.Width),(int)(sheet.Y+(cell.Y+cell.Height/2)*sheet.Height/preview.Sheet.Height));AuditCheck(preview.HitItem(point)==slot,"Page hit testing failed.");typeof(PreviewSurface).GetMethod("OnMouseDown",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(preview,new object[]{new MouseEventArgs(MouseButtons.Left,1,point.X,point.Y,0)});};
      foreach(string test in new[]{"A4-4-portrait-combined","A4-4-landscape-combined","A3-4-portrait-combined","A3-8-landscape-combined","A4-4-portrait-separate","A4-1-auto-combined"}){
        var parts=test.Split('-');int per=int.Parse(parts[1]);bool merged=parts[3]=="combined";
        updating=true;pageRotations.Clear();Array.Clear(sourceRotations,0,sourceRotations.Length);paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==parts[0]);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==per.ToString());orientation.SelectedIndex=parts[2]=="auto"?0:orientation.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==parts[2]);fileList.SelectedIndex=0;sheetIndex=per==1?1:0;combineFiles.Checked=merged;fill.Checked=generalFill=false;sameDirection.Checked=false;updating=false;await RenderPreview();await PresetReady();
        int slot=Array.FindIndex(preview.Items,item=>item.Source==0&&item.Page==1);AuditCheck(slot>=0,"Second page missing from preview.");click(slot);await PresetReady();RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();
        AuditCheck(PageTurns(0,1)==1&&PageTurns(0,0)==0&&sourceRotations.All(turn=>turn==0)&&pageRotations.Count==1,"Rotating the second page changed its sibling or another file.");AuditCheck(preview.Items[preview.SelectedItem].Page==1,"Rotation moved selection to the document's first page.");
        var active=preview.Items[preview.SelectedItem];AuditCheck(active.Turns==1,"Preview did not apply the selected page's rotation.");
        if(per>1){click(Array.FindIndex(preview.Items,item=>item.Source==0&&item.Page==0));await PresetReady();AuditCheck(status.Text.Contains(L("page")+" 1")&&status.Text.Contains(L("Rotation")+": 0°"),"Selecting another page kept the previous page's status.");RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();AuditCheck(PageTurns(0,0)==2&&PageTurns(0,1)==1,"Selecting the first page overwrote the second page's rotation.");
          updating=true;pageFilters[0]="even";sheetIndex=0;updating=false;await RenderPreview();await PresetReady();AuditCheck(preview.Items[0].Source==0&&preview.Items[0].Page==1&&preview.Items[0].Turns==1,"Filtering renumbered page rotations.");
          updating=true;pageFilters[0]="all";sheetIndex=0;updating=false;await RenderPreview();await PresetReady();
        }
        string folder=Path.Combine(args.Verify,test);Directory.CreateDirectory(folder);var sheets=new List<string>();
        for(int file=0;file<(merged?1:args.Files.Count);file++){
          updating=true;fileList.SelectedIndex=file;sheetIndex=0;updating=false;SyncPageControls();await RenderPreview();await PresetReady();int total=(pageCount+per-1)/per;
          for(int page=0;page<total;page++){sheetIndex=page;await RenderPreview();await PresetReady();string name=Path.Combine(folder,"sheet-"+sheets.Count+".png");preview.Sheet.Save(name,ImageFormat.Png);sheets.Add(name);}
        }
        if(merged){var final=preview.Items.Last();click(preview.Items.Length-1);await PresetReady();int before=PageTurns(final.Source,final.Page);RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();AuditCheck(PageTurns(final.Source,final.Page)==(before+1)%4&&PageTurns(0,1)==1,"Last-sheet rotation changed the two-page PDF.");RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();}
        string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));reports.Add(new{name=test,request=request,sheets=sheets.ToArray(),per=per,merged=merged});
      }
      // Global rotation deliberately resets every page, including prior overrides.
      RotateAllSources(3);await PresetReady();AuditCheck(pageRotations.Count==0&&PageTurns(0,0)==3&&PageTurns(0,1)==3,"Rotate all did not reset page overrides.");RotateAllSources(0);await PresetReady();
      updating=true;layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");SetOrientation(false);combineFiles.Checked=true;fileList.SelectedIndex=0;sheetIndex=0;updating=false;await RenderPreview();await PresetReady();click(1);await PresetReady();RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();
      var surface=Controls[0];surface.Dock=DockStyle.None;surface.Location=Point.Empty;
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var size in new[]{new Size(1366,768),new Size(1920,1080)}){surface.Size=size;surface.PerformLayout();await RenderPreview();await PresetReady();AuditCheck(preview.Items[preview.SelectedItem].Page==1,"Resize lost page selection.");NativePrint.CaptureContent(surface,Path.Combine(args.Verify,(dark?"dark":"light")+"-"+size.Width+"x"+size.Height+".png"));}}
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,pageRotationIsolated=true,selectionRetained=true,filtersUseOriginalPages=true,globalRotationResetsOverrides=true,reports=reports,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyFiveSeven(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();AuditCheck(args.Files.Count==10&&args.Files.Take(9).All(IsImage)&&!IsImage(args.Files[9]),"Expected nine images and one PDF.");
      var inventory=await Inventory();AuditCheck(inventory.Counts.Take(9).All(count=>count==1)&&inventory.Counts[9]==2,"Fixture page counts are incorrect.");
      var expected=Enumerable.Range(0,9).Select(file=>Tuple.Create(file,0)).Concat(new[]{Tuple.Create(9,0),Tuple.Create(9,1)}).ToArray();var reports=new List<object>();
      foreach(string stock in new[]{"A4","A3"})foreach(int per in new[]{5,7})foreach(bool landscape in new[]{false,true}){
        updating=true;Array.Clear(sourceRotations,0,sourceRotations.Length);pageRotations.Clear();for(int i=0;i<sourceCopies.Length;i++)sourceCopies[i]=1;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==per.ToString());SetOrientation(landscape);combineFiles.Checked=true;fileList.SelectedIndex=0;sheetIndex=0;fill.Checked=false;sameDirection.Checked=true;copies.Value=2;updating=false;Changed();await PresetReady();
        AuditCheck(preview.Items.Length==per&&preview.Items.Select(item=>item.Source).SequenceEqual(Enumerable.Range(0,per)),"The first sheet has missing or reordered images.");
        preview.SelectItem(1);RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();AuditCheck(sourceRotations[1]==1&&sourceRotations.Where((turn,index)=>index!=1).All(turn=>turn==0),"Rotation affected another source.");
        string name=stock+"-"+per+"-"+(landscape?"landscape":"portrait"),folder=Path.Combine(args.Verify,name);Directory.CreateDirectory(folder);var sheets=new List<string>();int total=(expected.Length+per-1)/per;
        for(int sheet=0;sheet<total;sheet++){
          sheetIndex=sheet;await RenderPreview();await PresetReady();var expectedSheet=expected.Skip(sheet*per).Take(per).ToArray();
          AuditCheck(preview.Items.Length==expectedSheet.Length&&preview.Items.Select(item=>Tuple.Create(item.Source,item.Page)).SequenceEqual(expectedSheet),"Sheet contents are missing, duplicated or reordered.");
          string path=Path.Combine(folder,"sheet-"+sheet+".png");preview.Sheet.Save(path,ImageFormat.Png);sheets.Add(path);
        }
        var totals=CountOutput(inventory,false);AuditCheck(totals.Pages==total&&totals.TotalSheets==total*2,"Sheet totals do not match the layout and job copies.");
        string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));reports.Add(new{name=name,paper=stock,per=per,landscape=landscape,request=request,sheets=sheets.ToArray(),totals=totals});
      }
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,reports=reports,rotationIsolated=true,sourceOrderChecked=true,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifyImageCopies(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();AuditCheck(args.Files.Count==4&&args.Files.Take(3).All(IsImage)&&!IsImage(args.Files[3]),"Image duplication needs three photos and one PDF.");
      var inventory=await Inventory();var reports=new List<object>();
      foreach(var setting in new[]{new{stock="A4",per=9,copies=9,merge=false,rotate=false,name="nine"},new{stock="A3",per=4,copies=9,merge=true,rotate=true,name="four-up"},new{stock="A4",per=9,copies=13,merge=true,rotate=false,name="thirteen"},new{stock="A4",per=5,copies=5,merge=false,rotate=false,name="five"},new{stock="A3",per=7,copies=7,merge=true,rotate=true,name="seven"},new{stock="A4",per=5,copies=8,merge=true,rotate=false,name="five-overflow"},new{stock="A3",per=7,copies=10,merge=false,rotate=false,name="seven-overflow"}}){
        updating=true;for(int i=0;i<sourceCopies.Length;i++)sourceCopies[i]=1;Array.Clear(sourceRotations,0,sourceRotations.Length);paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==setting.stock);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==setting.per.ToString());SetOrientation(false);combineFiles.Checked=setting.merge;copies.Value=2;fileList.SelectedIndex=0;sheetIndex=0;updating=false;Changed();await PresetReady();
        AuditCheck(preview.Items.Length>=3,"Initial images were not grouped.");preview.SelectItem(1);AuditCheck(fileList.SelectedIndex==1&&imageCopies.Value==1,"Selecting an image did not update its quantity control.");imageCopies.Value=setting.copies;await PresetReady();
        AuditCheck(sourceCopies.SequenceEqual(new[]{1,setting.copies,1,1}),"Changing image quantity affected other files.");AuditCheck(preview.Items.Length==Math.Min(setting.per,setting.copies)&&preview.Items.All(item=>item.Source==1),"Repeated image was mixed with other sources.");
        if(setting.rotate){RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();AuditCheck(preview.Items.All(item=>item.Source==1)&&sourceRotations[1]==1&&sourceRotations[0]==0&&sourceRotations[2]==0,"Rotation changed another image.");}
        if(setting.copies>setting.per){sheetIndex=(setting.copies-1)/setting.per;await RenderPreview();await PresetReady();AuditCheck(preview.Items.Length==setting.copies-sheetIndex*setting.per&&preview.Items.All(item=>item.Source==1),"Last repeated sheet is incorrect.");}
        var totals=CountOutput(inventory,false);var duplexTotals=CountOutput(inventory,true);var folder=Path.Combine(args.Verify,setting.name);Directory.CreateDirectory(folder);var sheets=new List<string>();var selected=ExpandedPageMap(inventory);
        for(int file=0;file<args.Files.Count;){int start,end;ImageRange(file,out start,out end);int count=selected.Skip(file).Take(end-file+1).Sum(pages=>pages.Length),total=(count+setting.per-1)/setting.per;for(int sheet=0;sheet<total;sheet++){updating=true;fileList.SelectedIndex=file;sheetIndex=sheet;updating=false;SyncPageControls();await RenderPreview();await PresetReady();string path=Path.Combine(folder,"sheet-"+sheets.Count+".png");preview.Sheet.Save(path,ImageFormat.Png);sheets.Add(path);}file=end+1;}
        AuditCheck(sheets.Count==totals.Pages&&totals.TotalSheets==totals.Sheets*2,"Image duplication totals or job copies are wrong.");
        string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));reports.Add(new{setting.name,setting.stock,setting.per,setting.copies,setting.merge,setting.rotate,request=request,sheets=sheets.ToArray(),totals=totals,duplex=duplexTotals});
      }
      updating=true;for(int i=0;i<sourceCopies.Length;i++)sourceCopies[i]=1;layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="9");combineFiles.Checked=false;fileList.SelectedIndex=0;sheetIndex=0;updating=false;Changed();await PresetReady();AuditCheck(preview.Items.Count(item=>item.Source<3)==3,"Resetting the quantity did not restore the other images.");
      preview.SelectItem(1);imageCopies.Value=9;await PresetReady();var surface=Controls[0];surface.Dock=DockStyle.None;surface.Location=Point.Empty;var captures=new List<object>();
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var size in new[]{new Size(1366,768),new Size(1600,900),new Size(1920,1080),new Size(820,640)}){surface.Size=size;surface.PerformLayout();await RenderPreview();await PresetReady();AuditCheck(imageCopies.Parent.ClientRectangle.Contains(imageCopies.Bounds)&&imageCopiesGroup.Parent.ClientRectangle.Contains(imageCopiesGroup.Bounds),"Image quantity control is clipped at "+size);AuditCheck(imageCopies.AccessibleName==L("Image copies")&&imageCopies.TabStop,"Image quantity is not keyboard accessible.");string name=(dark?"dark":"light")+"-"+size.Width+"x"+size.Height;NativePrint.CaptureContent(surface,Path.Combine(args.Verify,name+".png"));captures.Add(new{dark=dark,width=size.Width,height=size.Height});}}
      updating=true;sourceCopies[0]=sourceCopies[1]=sourceCopies[2]=999;updating=false;QueuePreview();await Task.Delay(400);AuditCheck(!print.Enabled&&status.Text.Contains("2000"),"Oversized image quantities did not block printing.");
      updating=true;for(int i=0;i<sourceCopies.Length;i++)sourceCopies[i]=1;updating=false;Changed();await PresetReady();
      updating=true;fileList.SelectedIndex=3;updating=false;SyncPageControls();AuditCheck(!imageCopiesGroup.Visible,"Image quantity should not be offered for PDFs.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,reports=reports,captures=captures,isolatedSelection=true,keyboardAccessible=true,resetChecked=true,limitChecked=true,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifySheetImageSelection(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();var reports=new List<object>();
      Action<int> click=slot=>{var bounds=preview.SheetBounds();var cell=preview.Items[slot].Bounds;var point=new Point((int)(bounds.X+(cell.X+cell.Width/2)*bounds.Width/preview.Sheet.Width),(int)(bounds.Y+(cell.Y+cell.Height/2)*bounds.Height/preview.Sheet.Height));AuditCheck(preview.HitItem(point)==slot,"Hit testing chose a different sheet slot.");typeof(PreviewSurface).GetMethod("OnMouseDown",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(preview,new object[]{new MouseEventArgs(MouseButtons.Left,1,point.X,point.Y,0)});};
      Action<Keys> key=code=>{var e=new KeyEventArgs(code);typeof(PreviewSurface).GetMethod("OnKeyDown",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(preview,new object[]{e});AuditCheck(e.Handled&&e.SuppressKeyPress,"Preview keys could reach the default Print button.");};
      foreach(string stock in new[]{"A4","A3"})foreach(int per in new[]{4,8,9,16})foreach(bool landscape in new[]{false,true}){
        updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==per.ToString());SetOrientation(landscape);fileList.SelectedIndex=0;sheetIndex=0;Array.Clear(sourceRotations,0,sourceRotations.Length);updating=false;Changed();await PresetReady();
        AuditCheck(preview.Items.Length==Math.Min(per,args.Files.Count),"Preview targets include empty slots or omit images.");
        AuditCheck(preview.HitItem(Point.Empty)==-1,"The area outside the sheet selected an image.");
        byte[] original;using(var stream=new MemoryStream()){preview.Sheet.Save(stream,ImageFormat.Png);original=stream.ToArray();}
        click(1);await PresetReady();AuditCheck(fileList.SelectedIndex==1&&sheetIndex==0&&preview.SelectedItem==1,"Clicking an image changed the sheet or selected the wrong source.");
        using(var stream=new MemoryStream()){preview.Sheet.Save(stream,ImageFormat.Png);AuditCheck(original.SequenceEqual(stream.ToArray()),"The selection outline changed printable artwork.");}
        RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();AuditCheck(sourceRotations[1]==1&&sourceRotations.Where((turn,index)=>index!=1).All(turn=>turn==0),"Rotate selected changed another image.");
        key(Keys.Right);await PresetReady();AuditCheck(fileList.SelectedIndex==2&&preview.SelectedItem==2,"Arrow key did not select the next visible image.");
        key(Keys.R);await PresetReady();AuditCheck(sourceRotations[2]==1&&sourceRotations[1]==1,"Keyboard rotation did not preserve the other image.");
        if(stock=="A4"&&per==4&&!landscape){int snapshots=driverSnapshotRequests;key(Keys.Enter);await PresetReady();key(Keys.Space);await PresetReady();key(Keys.R);await PresetReady();key(Keys.R);await PresetReady();AuditCheck(sourceRotations[2]==1&&driverSnapshotRequests==snapshots,"Preview Enter/Space submitted a print request or rotated the wrong source.");}
        reports.Add(await DirectionProof(stock+"-"+per+"-"+(landscape?"landscape":"portrait")));
      }
      updating=true;layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");fileList.SelectedIndex=0;sheetIndex=1;updating=false;await RenderPreview();await PresetReady();
      AuditCheck(preview.Items.Length==2,"Final sheet should have two selectable photos.");click(1);await PresetReady();AuditCheck(fileList.SelectedIndex==5&&sheetIndex==1,"Selection on the final sheet jumped to another sheet.");
      var sheet=preview.SheetBounds();var blankPoint=new Point((int)(sheet.X+sheet.Width/2),(int)(sheet.Y+sheet.Height*.05f));AuditCheck(sheet.Contains(blankPoint)&&preview.HitItem(blankPoint)==-1,"An empty area inside the final sheet selected an image.");
      preview.Interactive=false;AuditCheck(preview.HitItem(new Point((int)sheet.X+20,(int)sheet.Y+20))==-1,"A stale preview accepted selection.");await RenderPreview();await PresetReady();
      // Filtering an earlier image must not change the source chosen from visible slots.
      updating=true;combineFiles.Checked=true;pageFilters[0]="even";sheetIndex=0;updating=false;await RenderPreview();await PresetReady();click(1);await PresetReady();AuditCheck(fileList.SelectedIndex==2,"Filtered combined sheet selection used the slot number as the source index.");
      updating=true;pageFilters[0]="all";sheetIndex=0;updating=false;await RenderPreview();await PresetReady();
      var surface=Controls[0];surface.Dock=DockStyle.None;surface.Location=Point.Empty;var captures=new List<object>();
      foreach(bool dark in new[]{false,true}){PrintTheme.Initialize(dark);PrintTheme.Apply(this);foreach(var size in new[]{new Size(1366,768),new Size(1600,900),new Size(1920,1080)}){surface.Size=size;surface.PerformLayout();await RenderPreview();await PresetReady();click(1);await PresetReady();string name=(dark?"dark":"light")+"-"+size.Width+"x"+size.Height;NativePrint.CaptureContent(surface,Path.Combine(args.Verify,name+".png"));using(var image=new Bitmap(preview.Width,preview.Height)){preview.DrawToBitmap(image,preview.ClientRectangle);image.Save(Path.Combine(args.Verify,name+"-preview.png"),ImageFormat.Png);}captures.Add(new{width=size.Width,height=size.Height,dark=dark});}}
      updating=true;mode="id-card";updating=false;await RenderPreview();await PresetReady();AuditCheck(!preview.Interactive&&preview.Items.Length==0,"ID source preview should use its dedicated editor.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,reports=reports,captures=captures,mouseSelection=true,keyboardSelection=true,rotationIsolated=true,finalSheetSelection=true,filteredSelection=true,blankSlotsIgnored=true,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  internal async Task VerifySource(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();await PresetReady();await RefreshPageSummary();
      AuditCheck(Selected(orientation)=="auto"&&!fill.Checked,"Full-page defaults must preserve the original orientation and complete source.");
      var requests=new List<object>();
      foreach(string stock in new[]{"A4","A3"}){
        updating=true;paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);orientation.SelectedIndex=0;layouts.SelectedIndex=0;copies.Value=2;updating=false;Changed();await PresetReady();
        var shapes=new List<bool>();int sourceIndex=0;
        foreach(int file in new[]{0,1,2,3}){
          fileList.SelectedIndex=file;sheetIndex=0;await PresetReady();int pages=IsImage(args.Files[file])?1:pageCount;
          for(int page=0;page<pages;page++){
            fileList.SelectedIndex=file;sheetIndex=IsImage(args.Files[file])?file:page;await RenderPreview();await PresetReady();
            shapes.Add(Landscape);preview.Sheet.Save(Path.Combine(args.Verify,stock+"-source-"+(sourceIndex++)+".png"),ImageFormat.Png);
          }
        }
        await RefreshPageSummary();string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));
        requests.Add(new{paper=stock,request=request,landscapes=shapes,summary=jobSummary.Text});
      }
      updating=true;fileList.SelectedIndex=0;sheetIndex=0;SetOrientation(false);updating=false;Changed();await PresetReady();AuditCheck(!Landscape,"Explicit portrait orientation was ignored.");
      preview.Sheet.Save(Path.Combine(args.Verify,"explicit-portrait.png"),ImageFormat.Png);
      SetOrientation(true);await PresetReady();AuditCheck(Landscape,"Explicit landscape orientation was ignored.");
      orientation.SelectedIndex=0;await PresetReady();
      foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}){Size=size;await RenderPreview();await RefreshPageSummary();NativePrint.Capture(this,Path.Combine(args.Verify,"native-"+Width+"x"+Height+".png"));}
      string before=Selected(printer),remembered=before;var alternate=printer.Items.Cast<Entry>().FirstOrDefault(item=>item.Id!=before);
      if(alternate!=null){updating=true;printer.SelectedItem=alternate;updating=false;await SelectPrinter();remembered=Selected(printer);}
      using(var fresh=new PrintWindow(new Options(new[]{"--"}.Concat(args.Files).ToArray()))){var handle=fresh.Handle;await fresh.LoadPrinters();AuditCheck(Selected(fresh.printer)==remembered,"A fresh Fast Print window lost the last selected printer.");fresh.Close();}
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,requests=requests,lastPrinterRestored=true,explicitOrientationChecked=true,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}
    finally{Close();}
  }
  internal async Task VerifyPageCounts(){
    Directory.CreateDirectory(args.Verify);
    try{
      AuditCheck(args.Files.All(file=>Path.GetDirectoryName(file)==Path.GetFullPath(args.Verify)),"Page-count fixtures must belong to this verification folder.");
      await LoadPrinters();await RenderPreview();await RefreshPageSummary();var initial=await Inventory();
      var reports=new List<object>();
      foreach(var definition in NativeLayout.All){
        layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==definition.count.ToString());await PresetReady();
        foreach(int quantity in new[]{1,3}){
          copies.Value=quantity;await RefreshPageSummary();
          reports.Add(new{per=PerSheet,copies=quantity,simplex=CountOutput(initial,false),duplex=CountOutput(initial,true),label=jobSummary.Text});
        }
      }
      layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");await PresetReady();fileList.SelectedIndex=1;await PresetReady();await RefreshPageSummary();
      AuditCheck(fileList.SelectedIndex==1,"Updating page labels changed the selected file.");
      var initialLabels=fileList.Items.Cast<Entry>().Select(item=>item.Label).ToArray();
      foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}){
        Size=size;await RenderPreview();await RefreshPageSummary();NativePrint.Capture(this,Path.Combine(args.Verify,"native-"+Width+"x"+Height+".png"));
        var measured=TextRenderer.MeasureText(jobSummary.Text,jobSummary.Font,new Size(jobSummary.ClientSize.Width,int.MaxValue),TextFormatFlags.WordBreak|TextFormatFlags.TextBoxControl);
        AuditCheck(measured.Height<=jobSummary.ClientSize.Height,"Page totals are clipped at "+Width+"x"+Height);
      }
      string verifiedRequest=await Request();
      File.Copy(Path.Combine(args.Verify,"replacement.pdf"),args.Files[0],true);File.SetLastWriteTimeUtc(args.Files[0],DateTime.UtcNow.AddSeconds(2));
      await RefreshPageSummary();var changed=await Inventory();
      AuditCheck(changed.Counts[0]!=initial.Counts[0]&&fileLabelKey==changed.Key,"An edited PDF kept stale page totals.");
      string missing=args.Files[0]+".missing";File.Move(args.Files[0],missing);
      try{await RefreshPageSummary();AuditCheck(jobSummary.Text.StartsWith(L("Page totals unavailable")),"A missing PDF kept a misleading total.");AuditCheck(fileLabelKey==null,"A missing file kept stale page labels.");}
      finally{File.Move(missing,args.Files[0]);}
      await RefreshPageSummary();
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,counts=initial.Counts,labels=initialLabels,reports=reports,changedCounts=changed.Counts,changedAndMissingChecked=true,summary=jobSummary.Text,request=verifiedRequest,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}
    finally{Close();}
  }
  internal async Task VerifyPresets(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();fillEdited=true;var reports=new List<object>();
      foreach(string stock in new[]{"A4","A3"})foreach(var definition in NativeLayout.All){
        updating=true;mode="";paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==stock);layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==definition.count.ToString());fileList.SelectedIndex=0;
        marginMm=definition.count==9?7:5;gapMm=definition.count==9?5:3;generalFill=fill.Checked=definition.count%2==0;
        for(int i=0;i<sourceRotations.Length;i++)sourceRotations[i]=0;
        if(definition.count==9){sourceRotations[0]=1;sourceRotations[1]=3;sourceRotations[sourceRotations.Length-1]=1;}
        updating=false;explicitProfile=null;UpdateProfiles();ApplyAutomaticProfile();sheetIndex=0;Changed();await PresetReady();
        string name=stock+"-"+definition.count,folder=Path.Combine(args.Verify,name);Directory.CreateDirectory(folder);
        preview.Sheet.Save(Path.Combine(folder,"images-first.png"),ImageFormat.Png);
        int imagePages=pageCount;sheetIndex=(imagePages-1)/definition.count;await RenderPreview();await PresetReady();preview.Sheet.Save(Path.Combine(folder,"images-final.png"),ImageFormat.Png);
        fileList.SelectedIndex=args.Files.Count-1;sheetIndex=0;await PresetReady();preview.Sheet.Save(Path.Combine(folder,"pdf-first.png"),ImageFormat.Png);
        int pdfPages=pageCount;sheetIndex=(pdfPages-1)/definition.count;await RenderPreview();await PresetReady();preview.Sheet.Save(Path.Combine(folder,"pdf-final.png"),ImageFormat.Png);
        string request=await Request(Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N")));
        reports.Add(new{name=name,paper=stock,count=definition.count,fill=fill.Checked,imagePages=imagePages,pdfPages=pdfPages,request=request,marginMm=marginMm,gapMm=gapMm,rotations=(int[])sourceRotations.Clone()});
      }
      updating=true;fileList.SelectedIndex=0;layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");paper.SelectedIndex=paper.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="A4");marginMm=5;gapMm=3;for(int i=0;i<sourceRotations.Length;i++)sourceRotations[i]=0;fill.Checked=generalFill=true;updating=false;sheetIndex=0;Changed();await PresetReady();
      RotateAllSources(1);await PresetReady();layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="6");await PresetReady();if(sourceRotations.Any(turn=>turn!=1))throw new InvalidOperationException("Global rotation changed with the preset.");layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");await PresetReady();RotateAllSources(0);await PresetReady();
      int before=sourceRotations[0];RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();if(sourceRotations[0]!=(before+1)%4||sourceRotations.Skip(1).Any(turn=>turn!=0))throw new InvalidOperationException("Selected rotation changed another source.");
      for(int i=0;i<3;i++){RotateSelectedSource(rotateSelected,EventArgs.Empty);await PresetReady();}
      foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}){Size=size;NativePrint.Capture(this,Path.Combine(args.Verify,"native-"+Width+"x"+Height+".png"));}
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=true,sourceSession=session,globalRotationConsistent=true,selectedRotationIndependent=true,defaultRotationConsistent=true,reports=reports}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}finally{Close();}
  }
  async Task Verify() {
    try {
      Directory.CreateDirectory(args.Verify);
      for(int i=0;i<2000 && (!print.Enabled || rendering==0);i++) await Task.Delay(50);
      if(!print.Enabled)throw new InvalidOperationException(status.Text);
      int originalPageCount=pageCount;
      foreach(var size in new[]{new Size(1100,743),new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}) {
        Size=size;await Task.Delay(80);
        NativePrint.Capture(this,Path.Combine(args.Verify,"native-"+Width+"x"+Height+".png"));
      }
      var assignments=new Dictionary<string,string>();
      foreach(var definition in NativeLayout.All) {
        int value=definition.count;layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id==value.ToString()); await Task.Delay(50);
        for(int i=0;i<200&&!print.Enabled;i++)await Task.Delay(50);if(!print.Enabled)throw new InvalidOperationException(status.Text);
        preview.Sheet.Save(Path.Combine(args.Verify,"layout-"+value+".png"),ImageFormat.Png);assignments[value.ToString()]=appliedProfile;
        fill.Checked=true;await Task.Delay(50);for(int i=0;i<200&&!print.Enabled;i++)await Task.Delay(50);
        preview.Sheet.Save(Path.Combine(args.Verify,"fit-"+value+".png"),ImageFormat.Png);
        fill.Checked=false;await Task.Delay(50);for(int i=0;i<200&&!print.Enabled;i++)await Task.Delay(50);
      }
      layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");await Task.Delay(50);for(int i=0;i<200&&!print.Enabled;i++)await Task.Delay(50);
      next.PerformClick();await Task.Delay(50);for(int i=0;i<200&&!print.Enabled;i++)await Task.Delay(50);
      preview.Sheet.Save(Path.Combine(args.Verify,"final-sheet.png"),ImageFormat.Png);
      sheetIndex=0;fill.Checked=true;await Task.Delay(50);for(int i=0;i<200&&!print.Enabled;i++)await Task.Delay(50);
      preview.Sheet.Save(Path.Combine(args.Verify,"fill-frame.png"),ImageFormat.Png);
      for(int i=0;i<8;i++){var clock=Stopwatch.StartNew();fill.Checked=!fill.Checked;await Task.Delay(40);for(int wait=0;wait<200&&!print.Enabled;wait++)await Task.Delay(10);warmRenderTimes.Add(clock.ElapsedMilliseconds);}
      var originalDefaults=FastPrintDriver.Capture(Selected(printer),IntPtr.Zero,null,false);
      copies.Value=3;ApplyControls();
      driverCache[Selected(printer)]=FastPrintDriver.Capture(Selected(printer),IntPtr.Zero,FastPrintDriver.FromDocument(settings),false);
      explicitProfile="current";UpdateProfiles();ApplyAutomaticProfile();
      foreach(int index in new[]{1,2}){layouts.SelectedIndex=index;await Task.Delay(50);for(int i=0;i<200&&!print.Enabled;i++)await Task.Delay(50);}
      bool currentOptionsPreserved=explicitProfile=="current" && Selected(profiles)=="current";
      if(!currentOptionsPreserved)throw new InvalidOperationException("Current printer options were lost after changing layout.");
      string request=await Request();
      var currentDefaults=FastPrintDriver.Capture(Selected(printer),IntPtr.Zero,null,false);
      var report=new { firstPaintMs=firstPaint,sourcePreviewReadyMs=sourcePreviewReady,printerReadyMs=printerReady,previewReadyMs=previewReady,workingMiB=Process.GetCurrentProcess().WorkingSet64/1048576.0,pages=originalPageCount,files=args.Files.Count,request=request,printer=Selected(printer),nativeOnly=true,cacheHits=cacheHits,cacheMisses=cacheMisses,cachedPixels=cachedPixels,warmRenderMs=warmRenderTimes.ToArray(),currentOptionsPreserved=currentOptionsPreserved,assignments=assignments,defaultsUnchanged=originalDefaults.Skip(76).Take(26).SequenceEqual(currentDefaults.Skip(76).Take(26)),docxConverter=NativePrint.FindOffice()!=null?"LibreOffice":NativePrint.HasWord?"Microsoft Word":"Unavailable" };
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(report),new UTF8Encoding(false)); Close();
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());Close();}
  }
  internal async Task VerifyPolaroid(){
    Directory.CreateDirectory(args.Verify);
    try{
      await LoadPrinters();var reports=new List<object>();
      foreach(int capacity in new[]{8,9}){
        int snapshotsBefore=driverSnapshotRequests,progressBefore=polaroidProgressEvents;var preparationClock=Stopwatch.StartNew();
        ChoosePolaroid(capacity);bool capturedProgress=false;
        for(int wait=0;wait<12000&&!print.Enabled;wait++){
          await Task.Delay(50);
          if(!capturedProgress&&polaroidProgressEvents>progressBefore){
            Size=new Size(1366,768);NativePrint.Capture(this,Path.Combine(args.Verify,"preparing-"+capacity+".png"));capturedProgress=true;
          }
        }
        preparationClock.Stop();
        if(driverSnapshotRequests!=snapshotsBefore)throw new InvalidOperationException("Polaroid preview accessed the vendor driver snapshot.");
        if(polaroidProgressEvents==progressBefore)throw new InvalidOperationException("Polaroid preparation did not report progress.");
        if(!print.Enabled||activePolaroid==null)throw new InvalidOperationException(status.Text);
        if(!IsPolaroid||Selected(paper)!="A4"||Selected(color)!="color"||Landscape!=(capacity==8))throw new InvalidOperationException("Polaroid settings were not applied.");
        string folder=Path.Combine(args.Verify,"polaroid-"+capacity);Directory.CreateDirectory(folder);
        File.Copy(Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(activePolaroid.Files[0])),"preview.log"),Path.Combine(folder,"framing.log"),true);
        for(int index=0;index<activePolaroid.Files.Length;index++){
          sheetIndex=index;await RenderPreview();
          preview.Sheet.Save(Path.Combine(folder,"preview-"+(index+1)+".png"),ImageFormat.Png);
          File.Copy(activePolaroid.Files[index],Path.Combine(folder,"sheet-"+(index+1)+".png"),true);
        }
        foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}){Size=size;NativePrint.Capture(this,Path.Combine(folder,"native-"+Width+"x"+Height+".png"));}
        fileList.SelectedIndex=args.Files.Count-1;await RenderPreview();
        if(sheetIndex!=activePolaroid.FileSheets[args.Files.Count-1])throw new InvalidOperationException("The file selector did not show its containing sheet.");
        string requestDirectory=Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N"));previewSessions.Add(requestDirectory);
        string request=await Request(requestDirectory);
        reports.Add(new{mode=mode,files=args.Files.Count,sheets=pageCount,request=request,selectedFileSheet=sheetIndex+1,preparationMs=preparationClock.ElapsedMilliseconds,progressEvents=polaroidProgressEvents-progressBefore,previewDriverSnapshots=driverSnapshotRequests-snapshotsBefore-1});
      }
      int preparations=polaroidPreparations;var clock=Stopwatch.StartNew();ChoosePolaroid(8);await RenderPreview();ChoosePolaroid(9);await RenderPreview();
      if(preparations!=polaroidPreparations)throw new InvalidOperationException("Polaroid mode switching did not reuse prepared sheets.");
      if(Visible)throw new InvalidOperationException("The verification form must stay hidden.");
      if(preview.BlankReplacements!=0)throw new InvalidOperationException("A prepared sheet was blanked during preview switching.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{cases=reports,cachedSwitchMs=clock.ElapsedMilliseconds,preparations=polaroidPreparations,blankPreviewReplacements=preview.BlankReplacements,singleCore=Environment.GetEnvironmentVariable("FAST_PRINT_TEST_SINGLE_CORE")=="1",cleanupDirectories=previewSessions.Concat(new[]{session}).ToArray(),headless=!Visible}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}
    finally{Close();}
  }
  [DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr window,int message,IntPtr wParam,IntPtr lParam);
  [DllImport("user32.dll")]static extern bool GetUpdateRect(IntPtr window,IntPtr rect,bool erase);
  [DllImport("user32.dll")]static extern int GetGuiResources(IntPtr process,int flags);
  static void AuditCheck(bool condition,string message){if(!condition)throw new InvalidOperationException(message);}
  void AuditImage(string path,Color color){
    AuditCheck(Path.GetDirectoryName(Path.GetFullPath(path))==Path.GetFullPath(args.Verify),"Only owned audit fixtures may be changed.");
    using(var image=new Bitmap(240,160))using(var graphics=Graphics.FromImage(image)){graphics.Clear(color);image.Save(path,Path.GetExtension(path)==".bmp"?ImageFormat.Bmp:ImageFormat.Png);}
    File.SetLastWriteTimeUtc(path,DateTime.UtcNow.AddSeconds(2));
  }
  internal async Task VerifyAudit(){
    Directory.CreateDirectory(args.Verify);
    try{
      foreach(string path in args.Files)AuditCheck(Path.GetDirectoryName(path)==Path.GetFullPath(args.Verify),"Audit inputs must be disposable fixture copies.");
      await LoadPrinters();await RenderPreview();AuditCheck(settingsReady&&print.Enabled,status.Text);
      var defaults=FastPrintDriver.Capture(Selected(printer),IntPtr.Zero,null,false);var actual=captures[Selected(printer)];copies.Value=7;
      var delayed=new TaskCompletionSource<PrinterCapture>();var old=SelectPrinter(()=>delayed.Task);
      AuditCheck(!settingsReady&&!print.Enabled,"A pending printer left Print available.");
      await RenderPreview();AuditCheck(!print.Enabled,"An old preview enabled Print during printer discovery.");
      await SelectPrinter(()=>Task.FromResult(actual));
      delayed.SetResult(new PrinterCapture{Bytes=actual.Bytes,Papers=actual.Papers,Resolutions=actual.Resolutions,Color=!actual.Color,Duplex=actual.Duplex});await old;
      AuditCheck(settingsReady&&canColor==actual.Color&&copies.Value==7,"A late printer result replaced current capabilities or lost copies.");
      var failed=new TaskCompletionSource<PrinterCapture>();old=SelectPrinter(()=>failed.Task);await SelectPrinter(()=>Task.FromResult(actual));
      failed.SetException(new InvalidOperationException("stale-printer-failure"));await old;
      AuditCheck(settingsReady&&status.Text!="stale-printer-failure","A stale printer error replaced the current state.");
      updating=true;mode="polaroid-9";color.SelectedIndex=0;ApplyControls();var before=FastPrintDriver.FromDocument(settings);
      using(var invalid=new PrintDocument()){
        invalid.PrinterSettings.PrinterName=Selected(printer);FastPrintDriver.Apply(invalid,before);invalid.DefaultPageSettings.PaperSize=invalid.PrinterSettings.PaperSizes.Cast<PaperSize>().First(size=>size.Kind==PaperKind.A3);
        bool rejected=false;try{ApplyDriverOptions(FastPrintDriver.FromDocument(invalid),before);}catch(InvalidOperationException){rejected=true;}
        AuditCheck(rejected&&settings.DefaultPageSettings.PaperSize.Kind==PaperKind.A4&&settings.DefaultPageSettings.Color,"Polaroid properties broke the A4/color lock: rejected="+rejected+", paper="+settings.DefaultPageSettings.PaperSize.Kind+", color="+settings.DefaultPageSettings.Color);
        AuditCheck(DriverSelectionError(PaperKind.A4,false)!=null,"Polaroid accepted black-and-white driver options.");
      }
      mode="";layouts.SelectedIndex=layouts.Items.FindIndex(item=>item.Id=="4");updating=false;await RenderPreview();
      string original=args.Files[0],prepared=await PreparedFile(original);using(var image=await Page(prepared,0,200))AuditCheck(image.GetPixel(image.Width/2,image.Height/2).R>180,"Unexpected initial BMP fixture.");
      AuditImage(original,Color.FromArgb(30,90,220));string updated=await PreparedFile(original);
      AuditCheck(prepared!=updated,"An edited BMP reused its old conversion.");using(var image=await Page(updated,0,200))AuditCheck(image.GetPixel(image.Width/2,image.Height/2).B>180,"An edited BMP preview kept old pixels.");
      string png=args.Files[1];using(var image=await Page(png,0,200)){}
      AuditImage(png,Color.FromArgb(200,40,180));using(var image=await Page(png,0,200)){var pixel=image.GetPixel(image.Width/2,image.Height/2);AuditCheck(pixel.R>170&&pixel.B>150&&pixel.G<80,"An edited PNG reused old cached pixels.");}
      string pdfFile=args.Files.Last();using(var image=await Page(pdfFile,0,200))AuditCheck(pageCount==1,"Unexpected initial PDF fixture.");
      File.Copy(Path.Combine(args.Verify,"replacement.pdf"),pdfFile,true);File.SetLastWriteTimeUtc(pdfFile,DateTime.UtcNow.AddSeconds(2));
      using(var image=await Page(pdfFile,0,200))AuditCheck(pageCount==2,"An edited PDF reused its old page count.");
      string requestMarker=Path.Combine(args.Verify,"request-path.txt");if(File.Exists(requestMarker))File.Delete(requestMarker);
      await Submit();AuditCheck(!File.Exists(requestMarker)&&print.Enabled&&visibleSourceVersion==SourceVersion(),"Changed files printed before the updated preview was reviewed.");
      sheetIndex=1;await RenderPreview();AuditCheck(fileList.SelectedIndex==4,"Image sheet navigation kept a filename from the previous sheet.");
      AuditImage(original,Color.FromArgb(40,120,220));appliedProfile="invalid";print.Enabled=true;await Submit();
      AuditCheck(!print.Enabled&&!File.Exists(requestMarker),"Refreshing a changed file bypassed an invalid profile.");
      appliedProfile=null;await RenderPreview();File.Delete(png);bool missing=false;try{await Submit();}catch(FileNotFoundException){missing=true;}
      AuditCheck(missing&&!print.Enabled,"A missing file retained an enabled Print action.");AuditImage(png,Color.FromArgb(200,40,180));await RenderPreview();
      File.WriteAllBytes(png,new byte[0]);bool empty=false;try{await Submit();}catch(InvalidOperationException){empty=true;}
      AuditCheck(empty&&!print.Enabled,"An empty replacement retained an enabled Print action.");AuditImage(png,Color.FromArgb(200,40,180));await RenderPreview();
      updating=true;int refreshes=0;EventHandler refreshed=delegate{refreshes++;};layouts.RefreshRequested+=refreshed;layouts.Activate(layouts.SelectedIndex);layouts.RefreshRequested-=refreshed;
      AuditCheck(refreshes==1,"The active layout cannot refresh an edited source.");updating=false;
      Size=new Size(820,640);NativePrint.Capture(this,Path.Combine(args.Verify,"minimum.png"));var dock=layouts.Dock;layouts.Dock=DockStyle.None;layouts.Size=new Size(240,180);var scroll=new Point(0,-120);int last=layouts.Controls.Count-1;
      AuditCheck(layouts.TileBounds(last,scroll).Top==4+(last/5)*52+scroll.Y,"The final layout ignored its scroll offset.");layouts.Width+=12;
      AuditCheck(layouts.TileBounds(last,scroll).Top==4+(last/5)*52+scroll.Y&&layouts.TileBounds(last,scroll).Width>200,"Resizing a scrolled layout list displaced its final option.");layouts.Dock=dock;
      sheetIndex=0;await RenderPreview();await Submit();AuditCheck(File.Exists(requestMarker),"The reviewed job was not prepared.");
      string colorRequest=File.ReadAllText(requestMarker);updating=true;color.SelectedIndex=color.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id=="mono");updating=false;await RenderPreview();
      preview.Sheet.Save(Path.Combine(args.Verify,"mono-preview.png"),ImageFormat.Png);
      string monoDirectory=Path.Combine(Path.GetTempPath(),"maher-fast-print-native",Guid.NewGuid().ToString("N"));previewSessions.Add(monoDirectory);string monoRequest=await Request(monoDirectory,true);
      AuditCheck(!NativePrint.Flag(NativePrint.Map(NativePrint.Read(monoRequest),"preset"),"color"),"The black-and-white selection was replaced by the driver's color default.");
      foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900)}){Size=size;NativePrint.Capture(this,Path.Combine(args.Verify,"native-"+Width+"x"+Height+".png"));}
      var after=FastPrintDriver.Capture(Selected(printer),IntPtr.Zero,null,false);AuditCheck(defaults.Skip(76).Take(26).SequenceEqual(after.Skip(76).Take(26)),"Printer defaults changed during the audit.");
      AuditCheck(!Visible,"The audit window became visible.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=true,stalePrinterResultsIgnored=true,pendingPrinterBlocksPrint=true,copiesPreserved=true,polaroidSettingsLocked=true,editedBmpRefreshed=true,editedPngRefreshed=true,editedPdfPageCountRefreshed=true,changedFilesRequireReview=true,invalidProfileBlocksPrint=true,missingFileBlocksPrint=true,sheetFilenameSynchronized=true,scrolledLayoutStable=true,activeLayoutRefresh=true,defaultsUnchanged=true,request=colorRequest,monoRequest=monoRequest,cleanupDirectories=previewSessions.Concat(new[]{session}).ToArray()}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}
    finally{Close();}
  }
  internal async Task VerifyPaint(){
    Directory.CreateDirectory(args.Verify);
    try{
      updating=true;
      printer.Items.Add(new Entry("test","Test printer"));printer.Items.Add(new Entry("alternate","Second printer"));printer.SelectedIndex=0;
      paper.Items.Add(new Entry("A4","A4"));paper.SelectedIndex=0;quality.Items.Add(new Entry("default",L("Automatic")));quality.SelectedIndex=0;
      profiles.Items.Add(new Entry("auto",L("Automatic")));profiles.SelectedIndex=0;
      using(var image=Image.FromFile(args.Files[0]))preview.Replace(new Bitmap(image));
      count.Text="1 / 2";status.Text="15 "+L("photos")+" · 2 "+L("sheets");print.Enabled=true;
      var reports=new List<object>();
      foreach(bool dark in new[]{false,true}){
        PrintTheme.Initialize(dark);PrintTheme.Apply(this);
        foreach(var size in new[]{new Size(1366,768),new Size(1920,1080),new Size(1600,900),new Size(820,640)}){Size=size;NativePrint.Capture(this,Path.Combine(args.Verify,(dark?"dark":"light")+"-"+Width+"x"+Height+".png"));}
        var combo=(PrintComboBox)printer;
        if(combo.ClientSize!=combo.Size)throw new InvalidOperationException("A legacy combo frame remains under the custom face.");
        foreach(Control control in new Control[]{printer,polaroid8,polaroid9,print,layouts.Controls[0]}){
          foreach(bool enabled in new[]{true,false}){
            control.Enabled=enabled;
            using(var bitmap=new Bitmap(control.Width,control.Height)){
              control.DrawToBitmap(bitmap,new Rectangle(Point.Empty,control.Size));
              bitmap.Save(Path.Combine(args.Verify,(dark?"dark":"light")+"-"+control.GetType().Name+"-"+control.AccessibleName+"-"+enabled+".png"),ImageFormat.Png);
              foreach(var point in new[]{new Point(0,0),new Point(control.Width-1,0),new Point(0,control.Height-1),new Point(control.Width-1,control.Height-1)})
                if(bitmap.GetPixel(point.X,point.Y).ToArgb()!=control.Parent.BackColor.ToArgb())throw new InvalidOperationException("A control retained a sharp legacy corner: "+control.GetType().Name+" at "+point+" actual "+bitmap.GetPixel(point.X,point.Y)+" expected "+control.Parent.BackColor);
            }
          }
          control.Enabled=true;
        }
        var preserved=preview.Sheet;preview.Busy(L("Preparing Polaroid sheets…"));
        using(var bitmap=new Bitmap(preview.Width,preview.Height))preview.DrawToBitmap(bitmap,new Rectangle(Point.Empty,preview.Size));
        if(!object.ReferenceEquals(preserved,preview.Sheet)||preview.BlankReplacements!=0)throw new InvalidOperationException("Loading cleared the previous preview.");preview.Busy(null);
        layouts.SelectedIndex=0;int invalidations=0;InvalidateEventHandler changed=delegate{invalidations++;};
        foreach(Control tile in layouts.Controls)tile.Invalidated+=changed;
        layouts.SelectedIndex=1;foreach(Control tile in layouts.Controls)tile.Invalidated-=changed;
        if(invalidations>2)throw new InvalidOperationException("Changing one selection repainted unrelated layout tiles.");
        using(var menu=new PrintContextMenu())using(var bitmap=new Bitmap(240,100))using(var graphics=Graphics.FromImage(bitmap)){
          menu.Size=bitmap.Size;menu.Renderer.DrawToolStripBackground(new ToolStripRenderEventArgs(graphics,menu,new Rectangle(Point.Empty,bitmap.Size),Color.Magenta));
          if(bitmap.GetPixel(120,50).ToArgb()!=PrintTheme.Surface.ToArgb())throw new InvalidOperationException("The options menu retained its native background layer.");
          bitmap.Save(Path.Combine(args.Verify,(dark?"dark":"light")+"-menu.png"),ImageFormat.Png);
        }
        int paints=combo.BufferedPaints;int resources=GetGuiResources(Process.GetCurrentProcess().Handle,0);var clock=Stopwatch.StartNew();
        for(int index=0;index<160;index++){
          combo.SelectedIndex=index%2;combo.Invalidate();
          if(SendMessage(combo.Handle,0x0014,IntPtr.Zero,IntPtr.Zero)!=new IntPtr(1))throw new InvalidOperationException("Native background erase was not suppressed.");
          SendMessage(combo.Handle,0x000F,IntPtr.Zero,IntPtr.Zero);
          if(GetUpdateRect(combo.Handle,IntPtr.Zero,false))throw new InvalidOperationException("A combo repaint left an invalid region queued.");
        }
        int frames=combo.BufferedPaints-paints,resourceDelta=GetGuiResources(Process.GetCurrentProcess().Handle,0)-resources;
        if(frames!=160||resourceDelta>4)throw new InvalidOperationException("Repainting duplicated frames or leaked GDI resources.");
        reports.Add(new{theme=dark?"dark":"light",frames=frames,repaintMs=clock.ElapsedMilliseconds,gdiDelta=resourceDelta,selectionInvalidations=invalidations,legacyCornerPixels=0,blankPreviewReplacements=preview.BlankReplacements});
      }
      if(Visible)throw new InvalidOperationException("The paint verification window became visible.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{headless=!Visible,reports=reports,cleanupDirectory=session}),new UTF8Encoding(false));
    }catch(Exception error){File.WriteAllText(Path.Combine(args.Verify,"error.txt"),error.ToString());}
    finally{Close();}
    await Task.FromResult(0);
  }
  protected override void Dispose(bool disposing) {
    if(disposing){closing=true;rendering++;foreach(var worker in previewWorkers.ToArray())try{if(!worker.HasExited){worker.Kill();worker.WaitForExit(3000);}}catch{}pdf=null;pdfDocuments.Clear();pdfDocumentOrder.Clear();foreach(var cached in pageCache.Values)cached.Dispose();pageCache.Clear();foreach(var thumbnail in polaroidThumbnails.Values)thumbnail.Dispose();polaroidThumbnails.Clear(); if(settings!=null)settings.Dispose();tips.Dispose();GC.Collect();GC.WaitForPendingFinalizers();if(args.Verify==null)foreach(string directory in previewSessions.Concat(new[]{session}))try{Directory.Delete(directory,true);}catch{} }
    base.Dispose(disposing);
  }
}
