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
  static void CaptureHandles(Control parent){var handle=parent.Handle;foreach(Control child in parent.Controls)CaptureHandles(child);}
  static void CaptureLayout(Control parent){parent.PerformLayout();foreach(Control child in parent.Controls)CaptureLayout(child);parent.PerformLayout();}
  static void CaptureChildren(Control parent,Graphics graphics){
    foreach(Control child in parent.Controls.Cast<Control>().Reverse()){
      if(child.Width<1||child.Height<1)continue;
      using(var bitmap=new Bitmap(child.Width,child.Height)){
        var handle=child.Handle;child.DrawToBitmap(bitmap,new Rectangle(Point.Empty,child.Size));
        var state=graphics.Save();graphics.TranslateTransform(child.Left,child.Top);graphics.SetClip(new Rectangle(Point.Empty,child.Size),CombineMode.Intersect);
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
      if(options.Verify!=null)VerificationSettingsRoot=Environment.GetEnvironmentVariable("FAST_PRINT_TEST_SETTINGS");
      using (var form = new PrintWindow(options)) {
        if(options.VerifyPolaroid||options.VerifyPaint||options.VerifyAudit){
          using(var context=new ApplicationContext()){
            form.FormClosed+=delegate{context.ExitThread();};
            var handle=form.Handle;
            form.BeginInvoke(new Action(async delegate{if(options.VerifyAudit)await form.VerifyAudit();else if(options.VerifyPaint)await form.VerifyPaint();else await form.VerifyPolaroid();}));
            Application.Run(context);
          }
        }else Application.Run(form);
      }
      return 0;
    } catch (Exception error) {
      int verify=Array.IndexOf(args,"--verify-polaroid");if(verify<0)verify=Array.IndexOf(args,"--verify-paint");if(verify<0)verify=Array.IndexOf(args,"--verify-audit");if(verify>=0&&verify+1<args.Length){Directory.CreateDirectory(args[verify+1]);File.WriteAllText(Path.Combine(args[verify+1],"error.txt"),error.ToString());return 1;}
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
  internal static Process Start(string exe, IEnumerable<string> args) {
    var info = new ProcessStartInfo(exe, string.Join(" ", args.Select(Quote))) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetDirectoryName(exe) };
    info.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE"); info.EnvironmentVariables.Remove("ELECTRON_RENDERER_URL");
    return Process.Start(info);
  }
  internal static Dictionary<string, object> Read(string file) { return Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(file)); }
  internal static string Text(Dictionary<string, object> data, string key, string fallback = "") { object value; return data.TryGetValue(key, out value) && value != null ? Convert.ToString(value, CultureInfo.InvariantCulture) : fallback; }
  internal static bool Flag(Dictionary<string, object> data, string key) { object value; return data.TryGetValue(key, out value) && value is bool && (bool)value; }
  internal static Dictionary<string, object> Map(Dictionary<string, object> data, string key) { object value; return data.TryGetValue(key, out value) ? value as Dictionary<string, object> : null; }
  internal static string LocalRoot { get { return VerificationSettingsRoot??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MaherTka", "FastPrint"); } }
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
  internal bool VerifyPolaroid,VerifyPaint,VerifyAudit;
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
  internal Bitmap Sheet;
  string busyText;
  internal int BlankReplacements;
  internal PreviewSurface() { SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true); BackColor = PrintTheme.Stage; AccessibleName = "Print preview"; }
  internal void Busy(string text){if(busyText==text)return;busyText=text;Invalidate();}
  protected override void OnPaintBackground(PaintEventArgs e){}
  protected override void OnPaint(PaintEventArgs e) {
    e.Graphics.SmoothingMode=SmoothingMode.None;
    using(var background=new SolidBrush(PrintTheme.Stage))e.Graphics.FillRectangle(background,ClientRectangle);
    if(Sheet!=null)DrawSheet(e.Graphics);
    if(!string.IsNullOrEmpty(busyText)){
      using(var veil=new SolidBrush(Color.FromArgb(210,PrintTheme.Stage)))e.Graphics.FillRectangle(veil,ClientRectangle);
      TextRenderer.DrawText(e.Graphics,busyText,Font,new Rectangle(16,16,Math.Max(1,Width-32),Math.Max(1,Height-32)),PrintTheme.Text,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.WordBreak|TextFormatFlags.NoPrefix);
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
  readonly CheckBox fill = new CheckBox();
  readonly Button print = new PrintButtonControl(), previous = new PrintButtonControl(), next = new PrintButtonControl(), polaroid8 = new PrintButtonControl(), polaroid9 = new PrintButtonControl();
  readonly Label status = new Label(), count = new Label();
  readonly ToolTip tips = new ToolTip();
  readonly Dictionary<string, string> converted = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
  readonly Dictionary<string, Task<string>> preparing = new Dictionary<string, Task<string>>(StringComparer.OrdinalIgnoreCase);
  readonly Dictionary<string,Task<string>> pdfSnapshots=new Dictionary<string,Task<string>>(StringComparer.OrdinalIgnoreCase);
  readonly List<Dictionary<string, object>> saved = new List<Dictionary<string, object>>();
  readonly Dictionary<string, byte[]> driverCache = new Dictionary<string, byte[]>();
  readonly Dictionary<string,string> fingerprints=new Dictionary<string,string>();
  readonly Dictionary<string,Bitmap> pageCache=new Dictionary<string,Bitmap>();
  readonly Dictionary<string,int> pageWidths=new Dictionary<string,int>(),documentPages=new Dictionary<string,int>();
  readonly LinkedList<string> pageRecency=new LinkedList<string>();
  long cachedPixels;
  readonly SemaphoreSlim previewGate=new SemaphoreSlim(1,1);
  readonly SemaphoreSlim polaroidGate=new SemaphoreSlim(1,1);
  sealed class PolaroidSheets {internal string[] Files;internal int[] FileSheets,FileLastSheets;internal string Key;internal int Photos;}
  readonly Dictionary<string,Task<PolaroidSheets>> polaroidPreviews=new Dictionary<string,Task<PolaroidSheets>>();
  readonly List<string> previewSessions=new List<string>();
  readonly List<Process> previewWorkers=new List<Process>();
  readonly Dictionary<string,Bitmap> polaroidThumbnails=new Dictionary<string,Bitmap>();
  readonly LinkedList<string> polaroidThumbnailOrder=new LinkedList<string>();
  PolaroidSheets activePolaroid;
  int polaroidPreparations;
  long cacheHits,cacheMisses,lastRenderMs;
  bool canColor,canDuplex;
  readonly List<long> warmRenderTimes=new List<long>();
  readonly string session = Path.Combine(Path.GetTempPath(), "maher-fast-print-native", Guid.NewGuid().ToString("N"));
  Dictionary<string, object> preferences = new Dictionary<string, object>();
  PrintDocument settings;
  PdfDocument pdf;
  string loadedFile, mode = "", explicitProfile, appliedProfile, profileError,visibleSourceVersion;
  int printerGeneration,printerRefreshGeneration;
  bool settingsReady;
  bool updating, closing, submitting, initialApplied, copiesEdited;
  int sheetIndex, pageCount = 1, rendering;
  long firstPaint, printerReady, previewReady,sourcePreviewReady;
  readonly Dictionary<string, string[]> translations = new Dictionary<string, string[]> {
    {"Fast Print", new[]{"Impression rapide","الطباعة السريعة"}}, {"Printer",new[]{"Imprimante","الطابعة"}}, {"Paper size",new[]{"Format du papier","مقاس الورق"}},
    {"Quality",new[]{"Qualité","الجودة"}}, {"Color",new[]{"Couleur","ألوان"}}, {"Black & white",new[]{"Noir et blanc","أبيض وأسود"}}, {"Saved preset",new[]{"Préréglage enregistré","الإعداد المحفوظ"}},
    {"Automatic",new[]{"Automatique","تلقائي"}}, {"Portrait",new[]{"Portrait","عمودي"}}, {"Landscape",new[]{"Paysage","أفقي"}}, {"Orientation",new[]{"Orientation","الاتجاه"}},
    {"Full page",new[]{"Pleine page","صفحة كاملة"}}, {"2 pages per sheet",new[]{"2 pages par feuille","صفحتان لكل ورقة"}}, {"4 pages per sheet",new[]{"4 pages par feuille","4 صفحات لكل ورقة"}},
    {"ID card — 9 cm",new[]{"Carte d’identité — 9 cm","بطاقة هوية — 9 سم"}}, {"Copies",new[]{"Copies","النسخ"}}, {"Fit to frame",new[]{"Remplir le cadre","ملء الإطار"}},
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
    ,{"Light appearance",new[]{"Apparence claire","مظهر فاتح"}}
    ,{"Dark appearance",new[]{"Apparence sombre","مظهر داكن"}}
    ,{"System appearance",new[]{"Apparence du système","مظهر النظام"}}
    ,{"Preparing Polaroid sheets…",new[]{"Préparation des feuilles Polaroid…","جارٍ تحضير أوراق البولارويد…"}}
    ,{"photos",new[]{"photos","صور"}}
    ,{"sheets",new[]{"feuilles","أوراق"}}
    ,{"Files changed. Review the updated preview before printing.",new[]{"Fichiers modifiés. Vérifiez le nouvel aperçu avant d’imprimer.","تغيرت الملفات. راجع المعاينة المحدثة قبل الطباعة."}}
    ,{"Files changed while preparing. Refresh the preview.",new[]{"Fichiers modifiés pendant la préparation. Actualisez l’aperçu.","تغيرت الملفات أثناء التحضير. حدّث المعاينة."}}
    ,{"Polaroid requires A4 and color. Keep these settings in printer properties.",new[]{"Polaroid nécessite A4 et couleur. Conservez ces réglages dans les propriétés.","يتطلب البولارويد ورق A4 والطباعة بالألوان. حافظ على هذين الإعدادين في خصائص الطابعة."}}
    ,{"Choose a non-empty file smaller than 512 MB.",new[]{"Choisissez un fichier non vide de moins de 512 Mo.","اختر ملفًا غير فارغ أصغر من 512 ميغابايت."}}
    ,{"The selected file is missing.",new[]{"Le fichier sélectionné est introuvable.","الملف المحدد غير موجود."}}
  };
  string L(string key) { string[] values; return (args.Language == "ar" || args.Language == "fr") && translations.TryGetValue(key, out values) ? values[args.Language == "ar" ? 1 : 0] : key; }
  string Selected(ComboBox box) { var item = box.SelectedItem as Entry; return item == null ? "" : item.Id; }
  string SelectedLayout { get { var item = layouts.SelectedItem as Entry; return item == null ? "1" : item.Id; } }
  int PerSheet { get { int count; return int.TryParse(SelectedLayout, out count) ? count : 1; } }
  bool Special { get { return mode != ""; } }
  bool IsPolaroid { get { return mode.StartsWith("polaroid-"); } }
  bool Landscape { get { return mode == "polaroid-8" || (!IsPolaroid && (NativeLayout.Find(PerSheet).landscape || Selected(orientation) == "landscape")); } }
  internal PrintWindow(Options options) {
    args = options; Directory.CreateDirectory(session);
    Text = L("Fast Print"); Font = new Font("Segoe UI", 9.75f); StartPosition = FormStartPosition.CenterScreen;
    ClientSize = new Size(1100, 704); MinimumSize = new Size(820, 640); AutoScaleMode = AutoScaleMode.Dpi;
    DoubleBuffered=true;
    if (args.Language == "ar") { RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; }
    var root = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 6, Padding = new Padding(16) };
    root.RowStyles.Add(new RowStyle(SizeType.Absolute, 44)); root.RowStyles.Add(new RowStyle(SizeType.Absolute, 64)); root.RowStyles.Add(new RowStyle(SizeType.Absolute, 64));
    root.RowStyles.Add(new RowStyle(SizeType.Absolute, 44)); root.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); root.RowStyles.Add(new RowStyle(SizeType.Absolute, 100));
    Controls.Add(root);
    root.Controls.Add(new Label { Text = L("Fast Print"), Font = new Font(Font.FontFamily, 16f,FontStyle.Bold), Dock = DockStyle.Fill, AutoEllipsis = true }, 0, 0);
    var top = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 1 };
    top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40)); top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 18)); top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 23)); top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 19));
    top.Controls.Add(Field("Printer", printer), 0, 0); top.Controls.Add(Field("Paper size", paper), 1, 0); top.Controls.Add(Field("Quality", quality), 2, 0); top.Controls.Add(Field("Color", color), 3, 0); root.Controls.Add(top, 0, 1);
    var middle = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1 };
    middle.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40)); middle.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 38)); middle.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 22));
    var photos = new PrintFlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, AutoScroll = true }; photos.Controls.Add(new Label { Text = L("Polaroid"), AutoSize = true, Margin = new Padding(0, 8, 8, 0) });
    SetButton(polaroid8, "8 PIC", delegate { ChoosePolaroid(8); }); SetButton(polaroid9, "9 PIC", delegate { ChoosePolaroid(9); }); photos.Controls.Add(polaroid8); photos.Controls.Add(polaroid9);
    middle.Controls.Add(photos, 0, 0); middle.Controls.Add(Field("Saved preset", profiles), 1, 0); middle.Controls.Add(Field("Orientation", orientation), 2, 0); root.Controls.Add(middle, 0, 2);
    fileList.Dock = DockStyle.Fill; fileList.DropDownStyle = ComboBoxStyle.DropDownList; fileList.AccessibleName = L("Selected files");
    for (int i = 0; i < args.Files.Count; i++) fileList.Items.Add(new Entry(i.ToString(), (i + 1) + " / " + args.Files.Count + " · " + Path.GetFileName(args.Files[i])));
    fileList.SelectedIndex = 0; root.Controls.Add(fileList, 0, 3);
    var work = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2 };
    work.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); work.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 264)); work.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); work.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
    preview.Dock = DockStyle.Fill; work.Controls.Add(preview, 0, 0);
    layouts.Dock = DockStyle.Fill;
    layouts.Items.AddRange(NativeLayout.All.Select(item=>new Entry(item.count.ToString(),item.count==1?L("Full page"):item.count+" "+L("per sheet"))));
    layouts.Items.Add(new Entry("id-card",L("ID card — 9 cm")));layouts.Reload();layouts.SelectedIndex = 0;
    layouts.AccessibleName = L("Layout"); work.Controls.Add(layouts, 1, 0);work.SetRowSpan(layouts,2);
    var navigation = new PrintFlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
    SetButton(previous, "◀", delegate { if (sheetIndex > 0) { sheetIndex--; QueuePreview(); } }); SetButton(next, "▶", delegate { if ((sheetIndex + 1) * (Special ? 1 : PerSheet) < pageCount) { sheetIndex++; QueuePreview(); } }); previous.AccessibleName = L("Previous sheet"); next.AccessibleName = L("Next sheet"); previous.MinimumSize = next.MinimumSize = new Size(40, 28); previous.Width = next.Width = 40;
    count.AutoSize = true; count.Margin = new Padding(8); navigation.Controls.Add(count); navigation.Controls.Add(previous); navigation.Controls.Add(next); work.Controls.Add(navigation, 0, 1); root.Controls.Add(work, 0, 4);
    var bottom = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 }; bottom.RowStyles.Add(new RowStyle(SizeType.Absolute, 48)); bottom.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
    var controls = new PrintFlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, AutoScroll = true };
    controls.Controls.Add(new Label { Text = L("Copies"), AutoSize = true, Margin = new Padding(0, 6, 8, 0) }); copies.Minimum = 1; copies.Maximum = 999; copies.Value = 1; copies.Width = 64; copies.AccessibleName = L("Copies"); controls.Controls.Add(copies);
    fill.Text = L("Fit to frame"); fill.AutoSize = true; controls.Controls.Add(fill);
    var driver = new PrintButtonControl();
    var menu = new PrintContextMenu();
    menu.Items.Add(L("Printer properties…"), null, DriverOptions);
    menu.Items.Add(L("Manage saved presets…"), null, async delegate { await ManagePresets(); });
    menu.Items.Add(L("Light appearance"),null,delegate{PrintTheme.Initialize(false);PrintTheme.Apply(this);});
    menu.Items.Add(L("Dark appearance"),null,delegate{PrintTheme.Initialize(true);PrintTheme.Apply(this);});
    menu.Items.Add(L("System appearance"),null,delegate{PrintTheme.Initialize();PrintTheme.Apply(this);});
    SetButton(driver, L("Options…"), delegate { menu.Show(driver, new Point(0,driver.Height)); }); controls.Controls.Add(driver);
    var refresh = new PrintButtonControl{Quiet=true}; SetButton(refresh, L("Refresh printers"), async delegate { await LoadPrinters(true); }); controls.Controls.Add(refresh); bottom.Controls.Add(controls, 0, 0);
    var footer = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1 }; footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); footer.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); footer.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
    status.Dock = DockStyle.Fill; status.AutoEllipsis = true;status.UseMnemonic=false; status.AccessibleRole = AccessibleRole.StaticText; footer.Controls.Add(status, 0, 0);
    SetButton(print, L("Print"), async delegate { await Submit(); });((PrintButtonControl)print).Primary=true; print.Enabled = false; var cancel = new PrintButtonControl{Quiet=true}; SetButton(cancel, L("Cancel"), delegate { Close(); }); cancel.DialogResult = DialogResult.Cancel;
    footer.Controls.Add(cancel, 1, 0); footer.Controls.Add(print, 2, 0); bottom.Controls.Add(footer, 0, 1); root.Controls.Add(bottom, 0, 5);
    AcceptButton = print; CancelButton = cancel;
    count.RightToLeft=RightToLeft.No;copies.RightToLeft=RightToLeft.No;polaroid8.RightToLeft=polaroid9.RightToLeft=RightToLeft.No;
    copies.ValueChanged += delegate { if (!updating) copiesEdited = true; };
    color.Items.AddRange(new object[] { new Entry("color", L("Color")), new Entry("mono", L("Black & white")) }); color.SelectedIndex = 0;
    orientation.Items.AddRange(new object[] { new Entry("portrait", L("Portrait")), new Entry("landscape", L("Landscape")) }); orientation.SelectedIndex = 0;
    printer.SelectedIndexChanged += async delegate { if (!updating) await SelectPrinter(); };
    paper.SelectedIndexChanged += delegate { if (!updating) { explicitProfile = null; UpdateProfiles(); ApplyAutomaticProfile(); Changed(); } };
    profiles.SelectedIndexChanged += delegate { if (!updating) { explicitProfile = Selected(profiles) == "auto" ? null : Selected(profiles); ApplyAutomaticProfile(); Changed(); } };
    color.SelectedIndexChanged += delegate { if (!updating) { ApplyAutomaticProfile(); Changed(); } };
    orientation.SelectedIndexChanged += delegate { if (!updating) Changed(); }; fill.CheckedChanged += delegate { if (!updating) Changed(); };
    layouts.SelectedIndexChanged += delegate { if (!updating) { mode = SelectedLayout == "id-card" ? "id-card" : ""; sheetIndex = 0; ApplyAutomaticProfile(); Changed(); } };
    layouts.RefreshRequested += delegate { if(!updating)QueuePreview(); };
    fileList.SelectedIndexChanged += delegate { if (!updating) { int start,end;ImageRange(fileList.SelectedIndex,out start,out end);sheetIndex=IsPolaroid&&activePolaroid!=null&&activePolaroid.Key==PolaroidKey()?activePolaroid.FileSheets[fileList.SelectedIndex]:!Special&&end>start?(fileList.SelectedIndex-start)/PerSheet:0; QueuePreview(); } };
    Shown += async delegate { firstPaint = NativePrint.Clock.ElapsedMilliseconds;var prime=PrimePreview();await LoadPrinters();if(args.Verify!=null&&!closing){await prime;await Verify();} };
    HandleCreated+=delegate{PrintTheme.Apply(this);};PrintTheme.Apply(this);
    FormClosing += delegate(object sender, FormClosingEventArgs e) { if (submitting) e.Cancel = true; else closing = true; };
  }
  Control Field(string name, ComboBox combo) {
    var field = new PrintTableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, Margin = new Padding(0, 0, 12, 0) };
    field.RowStyles.Add(new RowStyle(SizeType.Absolute, 22)); field.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
    field.Controls.Add(new Label { Text = L(name), Dock = DockStyle.Fill, AutoEllipsis = true }, 0, 0);
    combo.Dock = DockStyle.Top; combo.DropDownStyle = ComboBoxStyle.DropDownList; combo.AccessibleName = L(name); combo.DropDownWidth = 340; combo.Margin=new Padding(0,4,0,0);field.Controls.Add(combo, 0, 1); return field;
  }
  void SetButton(Button button, string label, EventHandler handler) { button.Text = label; button.AutoSize = true; button.MinimumSize = new Size(80,36);button.Margin=new Padding(0,0,8,0); button.Click += handler; }
  sealed class PrinterCapture {
    internal byte[] Bytes;internal PaperSize[] Papers;internal PrinterResolution[] Resolutions;internal bool Color,Duplex;
  }
  readonly Dictionary<string,PrinterCapture> captures=new Dictionary<string,PrinterCapture>();
  async Task LoadPrinters(bool refresh=false) {
    int refreshGeneration=++printerRefreshGeneration;++printerGeneration;++rendering;settingsReady=false;SetPrinterControlsEnabled(false);
    print.Enabled = false; status.Text = L("Loading printers…");
    try {
      if(refresh){captures.Clear();driverCache.Clear();fingerprints.Clear();}
      string wanted = Selected(printer); var names = await Task.Run(() => PrinterSettings.InstalledPrinters.Cast<string>().ToList()); if (closing||refreshGeneration!=printerRefreshGeneration) return;
      try { preferences = File.Exists(Path.Combine(NativePrint.LocalRoot, "preferences.json")) ? NativePrint.Read(Path.Combine(NativePrint.LocalRoot, "preferences.json")) : new Dictionary<string, object>(); }
      catch { preferences = new Dictionary<string, object>(); }
      saved.Clear(); string directory = Path.Combine(NativePrint.LocalRoot, "profiles");
      if (Directory.Exists(directory)) foreach (string file in Directory.GetFiles(directory, "*.json")) { try { var value = NativePrint.Read(file); if (NativePrint.Text(value, "version") == "1") saved.Add(value); } catch { } }
      string preferred = NativePrint.Text(preferences, "defaultPrinter");
      updating = true; printer.Items.Clear(); foreach (string name in names.OrderBy(n => n == preferred ? 0 : 1).ThenBy(n => n)) printer.Items.Add(new Entry(name, name));
      string initial = args.Initial == null ? "" : NativePrint.Text(args.Initial, "printer");
      int index = printer.Items.Cast<Entry>().ToList().FindIndex(e => e.Id == (wanted != "" ? wanted : initial != "" ? initial : preferred));
      if (index < 0) { string system = new PrinterSettings().PrinterName; index = printer.Items.Cast<Entry>().ToList().FindIndex(e => e.Id == system); }
      printer.SelectedIndex = printer.Items.Count == 0 ? -1 : Math.Max(0, index); updating = false;
      if (printer.Items.Count == 0) { status.Text = L("No compatible printers found"); return; }
      await SelectPrinter(); printerReady = NativePrint.Clock.ElapsedMilliseconds;
    } catch (Exception error) { if(!closing&&refreshGeneration==printerRefreshGeneration){updating = false; status.Text = error.Message;} }
  }
  async Task SelectPrinter(Func<Task<PrinterCapture>> captureOverride=null) {
    int selection=++printerGeneration;++rendering;settingsReady=false;SetPrinterControlsEnabled(false);
    print.Enabled = false;
    string name = Selected(printer);
    try {
      PrinterCapture capture;
      if(!captures.TryGetValue(name,out capture)||captureOverride!=null){
        capture=captureOverride!=null?await captureOverride():await Task.Run(()=>{
          var bytes=FastPrintDriver.Capture(name,IntPtr.Zero,null,false);
          using(var document=new PrintDocument()){
            document.PrinterSettings.PrinterName=name;FastPrintDriver.Apply(document,bytes);
            return new PrinterCapture{Bytes=bytes,Papers=document.PrinterSettings.PaperSizes.Cast<PaperSize>().Where(item=>item.Kind==PaperKind.A4||item.Kind==PaperKind.A3).ToArray(),Resolutions=document.PrinterSettings.PrinterResolutions.Cast<PrinterResolution>().ToArray(),Color=document.PrinterSettings.SupportsColor,Duplex=document.PrinterSettings.CanDuplex};
          }
        });
      }
      if (closing || selection!=printerGeneration || name != Selected(printer)) return;
      if(!captures.ContainsKey(name)){captures[name]=capture;driverCache[name]=capture.Bytes;}
      canColor=capture.Color;canDuplex=capture.Duplex;
      if (settings != null) settings.Dispose(); settings = new PrintDocument(); settings.PrinterSettings.PrinterName = name; FastPrintDriver.Apply(settings, driverCache[name]);
      updating = true; paper.Items.Clear(); foreach (PaperSize size in capture.Papers) paper.Items.Add(new Entry(size.Kind.ToString(), size.Kind.ToString(), size));
      int a4 = paper.Items.Cast<Entry>().ToList().FindIndex(item => item.Id == "A4");
      paper.SelectedIndex = paper.Items.Count == 0 ? -1 : Math.Max(0, a4);
      quality.Items.Clear(); quality.Items.Add(new Entry("default", L("Automatic")));
      foreach (PrinterResolution resolution in capture.Resolutions) quality.Items.Add(new Entry(resolution.Kind + ":" + resolution.X + ":" + resolution.Y, resolution.Kind == PrinterResolutionKind.Custom ? resolution.X + " × " + resolution.Y + " dpi" : resolution.Kind.ToString(), resolution)); quality.SelectedIndex = 0;
      color.Items.Clear(); if (canColor) color.Items.Add(new Entry("color", L("Color"))); color.Items.Add(new Entry("mono", L("Black & white"))); color.SelectedIndex = 0;
      mode = ""; layouts.SelectedIndex = 0; orientation.SelectedIndex = settings.DefaultPageSettings.Landscape ? 1 : 0; if(!copiesEdited)copies.Value = Math.Max(1, Math.Min(999, (int)settings.PrinterSettings.Copies));
      explicitProfile = null; updating = false; UpdateProfiles(); ApplyAutomaticProfile();
      if (!initialApplied && args.Initial != null) {
        initialApplied = true; updating = true;
        string initialPaper = NativePrint.Text(args.Initial, "paper", "A4");
        for(int i=0;i<paper.Items.Count;i++)if(((Entry)paper.Items[i]).Id==initialPaper)paper.SelectedIndex=i;
        color.SelectedIndex = NativePrint.Flag(args.Initial,"color") && canColor ? 0 : color.Items.Count-1;
        mode = NativePrint.Text(args.Initial,"mode"); string layout=mode=="id-card"?"id-card":NativePrint.Text(args.Initial,"pagesPerSheet","1");
        layouts.SelectedIndex=layouts.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==layout);
        explicitProfile=NativePrint.Text(args.Initial,"profileId");if(explicitProfile=="")explicitProfile=null;
        updating=false;UpdateProfiles();ApplyAutomaticProfile();
      }
      settingsReady=true;SetPrinterControlsEnabled(true);Changed();
      if(paper.SelectedIndex<0)status.Text=L("No compatible printers found");
    } catch (Exception error) { if(!closing&&selection==printerGeneration){settingsReady=false;updating = false;status.Text = error.Message;preview.Busy(error.Message);print.Enabled=false;} }
  }
  void SetPrinterControlsEnabled(bool enabled){paper.Enabled=quality.Enabled=color.Enabled=profiles.Enabled=orientation.Enabled=fill.Enabled=enabled;layouts.Enabled=enabled;polaroid8.Enabled=polaroid9.Enabled=enabled;}
  void UpdateProfiles() {
    updating = true; profiles.Items.Clear(); profiles.Items.Add(new Entry("auto", L("Automatic")));
    if(explicitProfile=="current")profiles.Items.Add(new Entry("current",L("Current printer options")));
    foreach (var profile in saved.Where(p => NativePrint.Text(p, "printer") == Selected(printer) && NativePrint.Text(p, "paper") == Selected(paper))) profiles.Items.Add(new Entry(NativePrint.Text(profile, "id"), NativePrint.Text(profile, "name")));
    profiles.SelectedIndex = 0; if (explicitProfile != null) for (int i = 1; i < profiles.Items.Count; i++) if (((Entry)profiles.Items[i]).Id == explicitProfile) profiles.SelectedIndex = i;
    updating = false;
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
        var bytes = ProtectedData.Unprotect(Convert.FromBase64String(NativePrint.Text(profile, "driverSettings")), null, DataProtectionScope.CurrentUser); FastPrintDriver.Apply(settings, bytes);
      } else { if (id != null && id!="current") throw new InvalidOperationException("This saved preset was removed. Refresh printers."); FastPrintDriver.Apply(settings, driverCache[Selected(printer)]); }
      appliedProfile = profile == null ? null : NativePrint.Text(profile, "id");profileError=null;
      updating = true; orientation.SelectedIndex = settings.DefaultPageSettings.Landscape ? 1 : 0; if(!copiesEdited)copies.Value = Math.Max(1, Math.Min(999, (int)settings.PrinterSettings.Copies)); updating = false;
    } catch (Exception error) { updating = false; status.Text = error.Message;profileError=error.Message; appliedProfile = "invalid"; }
  }
  void ChoosePolaroid(int count) {
    if (!settingsReady || settings == null || !canColor) return;
    updating = true; mode = "polaroid-" + count; layouts.ClearSelected();fileList.SelectedIndex=0;
    for (int i = 0; i < paper.Items.Count; i++) if (((Entry)paper.Items[i]).Id == "A4") paper.SelectedIndex = i;
    color.SelectedIndex = 0; fill.Checked = false; updating = false; explicitProfile = null; UpdateProfiles(); ApplyAutomaticProfile(); sheetIndex = 0; Changed();
  }
  void Changed() {
    bool compatible = settingsReady && settings != null && canColor && paper.Items.Cast<Entry>().Any(e => e.Id == "A4");
    polaroid8.Enabled = polaroid9.Enabled = compatible; paper.Enabled = color.Enabled = settingsReady&&!IsPolaroid; orientation.Enabled = settingsReady&&!Special && !NativeLayout.Find(PerSheet).landscape; fill.Enabled = settingsReady&&!Special;
    ((PrintButtonControl)polaroid8).Selected=mode=="polaroid-8";((PrintButtonControl)polaroid9).Selected=mode=="polaroid-9";
    if(IsPolaroid || (!Special && NativeLayout.Find(PerSheet).landscape)){updating=true;orientation.SelectedIndex=mode=="polaroid-9"?0:1;updating=false;}
    print.Text = mode == "id-card" ? L("Review ID…") : L("Print"); QueuePreview();
  }
  async void QueuePreview() { int request=rendering+1;try { await RenderPreview(); } catch (Exception error) { if (!closing&&request==rendering) { status.Text = error.Message;preview.Busy(error.Message);print.Enabled = false; } } }
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
  async Task<int> PdfPages(string path){var document=await PdfDocument.LoadFromFileAsync(await StorageFile.GetFileFromPathAsync(await PdfSnapshot(path)));return (int)document.PageCount;}
  async Task PrimePreview(){
    await previewGate.WaitAsync();
    try{string path=await PreparedFile(args.Files[0]);if(!closing)using(var page=await Page(path,0,640)){if(!closing){preview.Replace(new Bitmap(page));count.Text=L("Source preview");sourcePreviewReady=NativePrint.Clock.ElapsedMilliseconds;}}}
    catch(Exception){/* The visible preview reports actionable errors. */}
    finally{previewGate.Release();}
  }
  async Task<Bitmap> Page(string path,int index,int width){
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
      if (loadedFile != version) { pdf = await PdfDocument.LoadFromFileAsync(await StorageFile.GetFileFromPathAsync(await PdfSnapshot(path))); loadedFile = version; }
      pageCount = (int)pdf.PageCount;
      using (var page = pdf.GetPage((uint)index)) using (var stream = new InMemoryRandomAccessStream()) {
        await page.RenderToStreamAsync(stream, new PdfPageRenderOptions { DestinationWidth = (uint)width });
        using (var input = stream.AsStreamForRead()) using (var image = Image.FromStream(input)) return new Bitmap(image);
      }
    }
    loadedFile = null; pdf = null; pageCount = 1;
    using (var image = Image.FromFile(path)) {
      if (image.PropertyIdList.Contains(0x112)) {
        int rotation = image.GetPropertyItem(0x112).Value[0]; var turns = new Dictionary<int, RotateFlipType> { {2,RotateFlipType.RotateNoneFlipX},{3,RotateFlipType.Rotate180FlipNone},{4,RotateFlipType.Rotate180FlipX},{5,RotateFlipType.Rotate90FlipX},{6,RotateFlipType.Rotate90FlipNone},{7,RotateFlipType.Rotate270FlipX},{8,RotateFlipType.Rotate270FlipNone} }; if (turns.ContainsKey(rotation)) image.RotateFlip(turns[rotation]);
      }
      return new Bitmap(image, Math.Max(1, Math.Min(width, image.Width)), Math.Max(1, (int)(image.Height * Math.Min(1.0, (double)width / image.Width))));
    }
  }
  bool IsImage(string path){string extension=Path.GetExtension(path).ToLowerInvariant();return extension!=".pdf"&&extension!=".docx";}
  void ImageRange(int index,out int start,out int end){start=end=index;if(Special||!IsImage(args.Files[index]))return;while(start>0&&IsImage(args.Files[start-1]))start--;while(end+1<args.Files.Count&&IsImage(args.Files[end+1]))end++;}
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
    string request=await Request(directory);polaroidPreparations++;
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
    try{using(var process=Process.Start(info)){
      previewWorkers.Add(process);var errors=process.StandardError.ReadToEndAsync();var output=process.StandardOutput.ReadToEndAsync();
      try{
        bool exited=await Task.Run(()=>process.WaitForExit(10*60*1000));
        if(!exited){process.Kill();throw new InvalidOperationException("Polaroid preparation timed out. Try fewer photos.");}
        string error=await errors;await output;if(closing)throw new OperationCanceledException();
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
  async Task RenderPreview() {
    int generation=++rendering;print.Enabled=false;
    await Task.Delay(35);var renderClock=Stopwatch.StartNew();
    if(generation!=rendering||!settingsReady||settings==null||Selected(paper)==""||closing)return;
    string sources=SourceVersion();
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
    bool imageGroup=!Special&&groupEnd>groupStart;
    string path=await PreparedFile(imageGroup?args.Files[groupStart]:source);
    if (generation != rendering || closing) return;
    int decodeWidth=Math.Max(180,(int)(640/Math.Sqrt(Special?1:PerSheet)));
    using (var first = await Page(path, 0, decodeWidth)) {
      if (generation != rendering || closing) return;
      int per = Special ? 1 : PerSheet; int pages = imageGroup?groupEnd-groupStart+1:pageCount; sheetIndex = Math.Min(sheetIndex, Math.Max(0, (pages - 1) / per));
      double paperRatio=Selected(paper)=="A3"?420.0/297:297.0/210;
      int h=Math.Min(1000,Math.Max(480,(int)(preview.ClientSize.Height*1.35)));int w=(int)Math.Round(h/paperRatio);if(Landscape){int swap=w;w=h;h=swap;}
      var canvas = new Bitmap(w, h);
      try{
      using (var g = Graphics.FromImage(canvas)) {
        g.Clear(Color.White); g.InterpolationMode = InterpolationMode.HighQualityBicubic; var grid=NativeLayout.Find(per);int cols=grid.columns,rows=grid.rows;
        float physicalWidth=Selected(paper)=="A3"?(Landscape?420:297):(Landscape?297:210);
        float gap=w*3f/physicalWidth;float cw=(w-gap*(cols-1))/cols,ch=(h-gap*(rows-1))/rows;
        for (int slot = 0; slot < per && sheetIndex * per + slot < pages; slot++) {
          int number = sheetIndex * per + slot;
          using (var image = number == 0 ? new Bitmap(first) : imageGroup?await Page(await PreparedFile(args.Files[groupStart+number]),0,decodeWidth):await Page(path, number, decodeWidth)) {
            if (generation != rendering || closing) return;
            float scale = fill.Checked && !Special ? Math.Max(cw / image.Width, ch / image.Height) : Math.Min(cw / image.Width, ch / image.Height);
            var cell = new RectangleF((slot % cols) * (cw + gap), (slot / cols) * (ch + gap), cw, ch); var state = g.Save(); g.SetClip(cell);
            var target = new RectangleF(cell.X + (cw - image.Width * scale) / 2, cell.Y + (ch - image.Height * scale) / 2, image.Width * scale, image.Height * scale);
            using (var attributes = new ImageAttributes()) {
              if (Selected(color) == "mono") attributes.SetColorMatrix(new ColorMatrix(new float[][] { new[]{.2126f,.2126f,.2126f,0,0},new[]{.7152f,.7152f,.7152f,0,0},new[]{.0722f,.0722f,.0722f,0,0},new[]{0f,0,0,1,0},new[]{0f,0,0,0,1} }));
              g.DrawImage(image, Rectangle.Round(target), 0, 0, image.Width, image.Height, GraphicsUnit.Pixel, attributes);
            }
            g.Restore(state);
          }
        }
      }
      if(SourceVersion()!=sources)throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
      if(imageGroup){int firstFile=groupStart+sheetIndex*per;if(fileList.SelectedIndex<firstFile||fileList.SelectedIndex>=Math.Min(firstFile+per,groupEnd+1)){updating=true;fileList.SelectedIndex=firstFile;updating=false;}}
      pageCount=pages;preview.Replace(canvas);canvas=null;visibleSourceVersion=sources; count.Text = (Special ? L("Source preview") + " · " : "") + (sheetIndex + 1) + " / " + Math.Ceiling((double)pages / per);
      previous.Enabled = sheetIndex > 0; next.Enabled = (sheetIndex + 1) * per < pages;
      status.Text = appliedProfile=="invalid"?profileError:mode == "id-card" ? L("Choose a back image in the ID editor before printing.") : Path.GetFileName(args.Files[fileList.SelectedIndex]);
      tips.SetToolTip(status, status.Text); print.Enabled = appliedProfile != "invalid"; if(previewReady==0)previewReady = NativePrint.Clock.ElapsedMilliseconds;
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
      driverCache[Selected(printer)] = bytes; explicitProfile = "current"; appliedProfile = null;
      UpdateProfiles();
      updating = true; quality.SelectedIndex=0; orientation.SelectedIndex = settings.DefaultPageSettings.Landscape ? 1 : 0; copies.Value = Math.Max(1, Math.Min(999, (int)settings.PrinterSettings.Copies));
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
    if (!settingsReady||settings==null||paper.SelectedItem == null) throw new InvalidOperationException(L("No compatible printers found"));
    if(IsPolaroid&&(Selected(paper)!="A4"||Selected(color)!="color"))throw new InvalidOperationException(L("Polaroid requires A4 and color. Keep these settings in printer properties."));
    settings.DefaultPageSettings.PaperSize = (PaperSize)((Entry)paper.SelectedItem).Value; settings.DefaultPageSettings.Landscape = Landscape; settings.DefaultPageSettings.Color = Selected(color) == "color";
    var resolution = quality.SelectedItem as Entry; if (resolution != null && resolution.Value != null) settings.DefaultPageSettings.PrinterResolution = (PrinterResolution)resolution.Value;
    settings.PrinterSettings.Copies = (short)copies.Value;
    if (IsPolaroid && canDuplex) settings.PrinterSettings.Duplex = Duplex.Simplex;
  }
  async Task<string> Request(string directory=null,bool requireReviewed=false) {
    directory=directory??session;Directory.CreateDirectory(directory);
    bool outputColor=Selected(color)=="color";
    ApplyControls(); var bytes = FastPrintDriver.Capture(Selected(printer), IntPtr.Zero, FastPrintDriver.FromDocument(settings), false); FastPrintDriver.Apply(settings, bytes);
    bool virtualGrayscale=!outputColor&&(string.Equals(Selected(printer),"Microsoft Print to PDF",StringComparison.OrdinalIgnoreCase)||string.Equals(Selected(printer),"Microsoft XPS Document Writer",StringComparison.OrdinalIgnoreCase));
    if (settings.DefaultPageSettings.PaperSize.Kind.ToString() != Selected(paper) || settings.DefaultPageSettings.Landscape != Landscape || settings.DefaultPageSettings.Color!=outputColor&&!virtualGrayscale) throw new InvalidOperationException("The printer driver could not keep the selected paper, orientation and color.");
    string id = Guid.NewGuid().ToString("N"); var page = settings.DefaultPageSettings;
    var profile = new Dictionary<string, object> { {"version",1},{"id",id},{"name","Fast Print session"},{"printer",Selected(printer)},{"paper",Selected(paper)},{"color",page.Color},{"landscape",page.Landscape},{"duplex",settings.PrinterSettings.Duplex.ToString()},{"tray",page.PaperSource.SourceName},{"trayId",page.PaperSource.RawKind},{"driverFingerprint",FastPrintDriver.Fingerprint(Selected(printer))},{"driverSettings",Convert.ToBase64String(ProtectedData.Protect(bytes,null,DataProtectionScope.CurrentUser))} };
    File.WriteAllText(Path.Combine(directory,id+".json"),NativePrint.Json.Serialize(profile),new UTF8Encoding(false));
    // Grayscale is rendered into the artwork even when a color-only driver resets dmColor.
    var preset = new Dictionary<string, object> { {"printer",Selected(printer)},{"paper",Selected(paper)},{"color",outputColor},{"pagesPerSheet",Special?1:PerSheet},{"profileId",id},{"landscape",Landscape},{"duplex",canDuplex && (settings.PrinterSettings.Duplex == Duplex.Vertical || settings.PrinterSettings.Duplex == Duplex.Horizontal)},{"fitToFrame",fill.Checked && !Special},{"combineImages",!Special} }; if (Special) preset["mode"]=mode;
    int selectedCopies=(int)copies.Value;
    var files = new List<string>(); foreach (string path in args.Files) files.Add(await PreparedFile(path));
    if(requireReviewed&&visibleSourceVersion!=SourceVersion())throw new InvalidOperationException(L("Files changed while preparing. Refresh the preview."));
    string request = Path.Combine(directory,"request.json"); File.WriteAllText(request,NativePrint.Json.Serialize(new { version=1,files=files,preset=preset,copies=selectedCopies }),new UTF8Encoding(false)); return request;
  }
  async Task Submit() {
    if (submitting || !print.Enabled) return; submitting=true; print.Enabled=false;
    bool restorePrint=true;
    try {
      if(visibleSourceVersion!=SourceVersion()||IsPolaroid&&(activePolaroid==null||activePolaroid.Key!=PolaroidKey())){restorePrint=false;await RenderPreview();if(print.Enabled)status.Text=L("Files changed. Review the updated preview before printing.");return;}
      string request = await Request(null,true);
      if (args.Verify != null) { File.WriteAllText(Path.Combine(args.Verify,"request-path.txt"),request); return; }
      if (string.IsNullOrEmpty(args.App) || !File.Exists(args.App)) throw new InvalidOperationException("Fast Print worker is missing. Repair the app installation.");
      var arguments = new List<string>(); if (!string.IsNullOrEmpty(args.AppPath)) arguments.Add(args.AppPath); arguments.Add("--fast-print-request"); arguments.Add(request);
      pdf=null;loadedFile=null;GC.Collect();GC.WaitForPendingFinalizers();
      using (var process = NativePrint.Start(args.App,arguments)) { Hide(); await Task.Run(()=>process.WaitForExit()); if(process.ExitCode!=0) { Show(); status.Text="Print preparation failed. Check the print queue before retrying."; return; } }
      submitting=false; Close();
    } catch(Exception error) { restorePrint=false;status.Text=error.Message;preview.Busy(error.Message);if(args.Verify!=null)throw;MessageBox.Show(this,error.Message,L("Fast Print"),MessageBoxButtons.OK,MessageBoxIcon.Error); }
    finally { submitting=false; if(!closing&&restorePrint)print.Enabled=settingsReady&&appliedProfile!="invalid"; }
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
        ChoosePolaroid(capacity);for(int wait=0;wait<2400&&!print.Enabled;wait++)await Task.Delay(50);
        if(!print.Enabled||activePolaroid==null)throw new InvalidOperationException(status.Text);
        if(!IsPolaroid||Selected(paper)!="A4"||Selected(color)!="color"||Landscape!=(capacity==8))throw new InvalidOperationException("Polaroid settings were not applied.");
        string folder=Path.Combine(args.Verify,"polaroid-"+capacity);Directory.CreateDirectory(folder);
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
        reports.Add(new{mode=mode,files=args.Files.Count,sheets=pageCount,request=request,selectedFileSheet=sheetIndex+1});
      }
      int preparations=polaroidPreparations;var clock=Stopwatch.StartNew();ChoosePolaroid(8);await RenderPreview();ChoosePolaroid(9);await RenderPreview();
      if(preparations!=polaroidPreparations)throw new InvalidOperationException("Polaroid mode switching did not reuse prepared sheets.");
      if(Visible)throw new InvalidOperationException("The verification form must stay hidden.");
      if(preview.BlankReplacements!=0)throw new InvalidOperationException("A prepared sheet was blanked during preview switching.");
      File.WriteAllText(Path.Combine(args.Verify,"result.json"),NativePrint.Json.Serialize(new{cases=reports,cachedSwitchMs=clock.ElapsedMilliseconds,preparations=polaroidPreparations,blankPreviewReplacements=preview.BlankReplacements,cleanupDirectories=previewSessions.Concat(new[]{session}).ToArray(),headless=!Visible}),new UTF8Encoding(false));
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
      AuditCheck(layouts.TileBounds(last,scroll).Top==244,"The final layout ignored its scroll offset.");layouts.Width+=12;
      AuditCheck(layouts.TileBounds(last,scroll).Top==244&&layouts.TileBounds(last,scroll).Width>200,"Resizing a scrolled layout list displaced its final option.");layouts.Dock=dock;
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
    if(disposing){closing=true;rendering++;foreach(var worker in previewWorkers.ToArray())try{if(!worker.HasExited){worker.Kill();worker.WaitForExit(3000);}}catch{}pdf=null;foreach(var cached in pageCache.Values)cached.Dispose();pageCache.Clear();foreach(var thumbnail in polaroidThumbnails.Values)thumbnail.Dispose();polaroidThumbnails.Clear(); if(settings!=null)settings.Dispose();tips.Dispose();GC.Collect();GC.WaitForPendingFinalizers();if(args.Verify==null)foreach(string directory in previewSessions.Concat(new[]{session}))try{Directory.Delete(directory,true);}catch{} }
    base.Dispose(disposing);
  }
}
