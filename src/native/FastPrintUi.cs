using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows.Forms;

// The native view consumes the same layout definitions and visual tokens as the app.
internal static class PrintAppearance {
  internal static string Preference="system";
  internal static string Read(){
    string file=Path.Combine(NativePrint.LocalRoot,"appearance.json");
    try{if(!File.Exists(file)||new FileInfo(file).Length>4096)return "system";var data=NativePrint.Read(file);string value=NativePrint.Text(data,"preference");return NativePrint.Text(data,"version")=="1"&&new[]{"light","dark","system"}.Contains(value)?value:"system";}catch{return "system";}
  }
  internal static void Apply(string preference){
    if(!new[]{"light","dark","system"}.Contains(preference))throw new ArgumentException("Invalid appearance preference.");
    Preference=preference;PrintTheme.Initialize(preference=="dark"?(bool?)true:preference=="light"?(bool?)false:null);
  }
  internal static void Start(string overridePreference){Apply(overridePreference??Read());}
  internal static void Save(string preference){
    if(!new[]{"light","dark","system"}.Contains(preference))throw new ArgumentException("Invalid appearance preference.");
    Directory.CreateDirectory(NativePrint.LocalRoot);string file=Path.Combine(NativePrint.LocalRoot,"appearance.json"),temporary=file+"."+Guid.NewGuid().ToString("N")+".tmp";
    try{File.WriteAllText(temporary,NativePrint.Json.Serialize(new{version=1,preference=preference}),new System.Text.UTF8Encoding(false));if(File.Exists(file))File.Replace(temporary,file,null);else File.Move(temporary,file);}
    finally{if(File.Exists(temporary))File.Delete(temporary);}
    Apply(preference);
  }
}
// Printer and preset icons are independent of driver snapshots and source images.
internal static class PrinterIconStore {
  sealed class CachedIcon {internal DateTime Modified;internal long Length;internal Bitmap Image;}
  static readonly Dictionary<string,CachedIcon> cache=new Dictionary<string,CachedIcon>(StringComparer.OrdinalIgnoreCase);
  static string IconPath(string printer){
    using(var hash=System.Security.Cryptography.SHA256.Create()){
      string name=BitConverter.ToString(hash.ComputeHash(System.Text.Encoding.UTF8.GetBytes(printer.ToUpperInvariant()))).Replace("-","").ToLowerInvariant();
      return Path.Combine(NativePrint.LocalRoot,"printer-icons",name+".png");
    }
  }
  static string PresetPath(string id){if(!Regex.IsMatch(id??"",@"^[a-f0-9]{32}$"))throw new InvalidOperationException("Choose a saved preset first.");return Path.Combine(NativePrint.LocalRoot,"preset-icons",id+".png");}
  static void Forget(string path){CachedIcon old;if(cache.TryGetValue(path,out old)){cache.Remove(path);old.Image.Dispose();}}
  internal static void Invalidate(string printer){if(!String.IsNullOrWhiteSpace(printer))Forget(IconPath(printer));}
  internal static Bitmap Get(string printer){
    if(String.IsNullOrWhiteSpace(printer))return null;
    return GetPath(IconPath(printer));
  }
  internal static Bitmap GetPreset(string id){return Regex.IsMatch(id??"",@"^[a-f0-9]{32}$")?GetPath(PresetPath(id)):null;}
  internal static Dictionary<string,Bitmap> GetPresetIcons(HashSet<string> savedIds){
    var icons=new Dictionary<string,Bitmap>(StringComparer.Ordinal);string folder=Path.Combine(NativePrint.LocalRoot,"preset-icons");
    try{if(Directory.Exists(folder))foreach(string file in Directory.GetFiles(folder,"*.png")){string id=Path.GetFileNameWithoutExtension(file);if(savedIds.Contains(id)&&Regex.IsMatch(id,@"^[a-f0-9]{32}$")){var icon=GetPath(file);if(icon!=null)icons[id]=icon;}}}
    catch(Exception error){System.Diagnostics.Trace.WriteLine("Fast Print preset icons unavailable: "+error.Message);}return icons;
  }
  static Bitmap GetPath(string path){
    try{
      var file=new FileInfo(path);if(!file.Exists){Forget(path);return null;}
      CachedIcon old;if(cache.TryGetValue(path,out old)&&old.Modified==file.LastWriteTimeUtc&&old.Length==file.Length)return old.Image;
      Forget(path);if(file.Length>1024*1024)return null;
      using(var stream=File.OpenRead(path))using(var image=Image.FromStream(stream,true,true)){
        if(image.Width!=64||image.Height!=64)return null;
        var bitmap=new Bitmap(image);cache[path]=new CachedIcon{Image=bitmap,Length=file.Length,Modified=file.LastWriteTimeUtc};return bitmap;
      }
    }catch(Exception error){System.Diagnostics.Trace.WriteLine("Fast Print icon unavailable: "+error.Message);return null;}
  }
  internal static void Set(string printer,string source){
    if(String.IsNullOrWhiteSpace(printer))throw new InvalidOperationException("Choose a printer first.");
    SetPath(IconPath(printer),source);
  }
  internal static void SetPreset(string id,string source){SetPath(PresetPath(id),source);}
  static void SetPath(string path,string source){
    var input=new FileInfo(source);if(!input.Exists||input.Length<1||input.Length>16*1024*1024)throw new InvalidOperationException("Choose an image smaller than 16 MB.");
    Directory.CreateDirectory(Path.GetDirectoryName(path));string temporary=path+"."+Guid.NewGuid().ToString("N")+".tmp";
    try{
      using(var stream=File.OpenRead(source))using(var image=Image.FromStream(stream,true,true)){
        if(image.Width<1||image.Height<1||(long)image.Width*image.Height>16000000)throw new InvalidOperationException("Choose an image up to 16 megapixels.");
        using(var bitmap=new Bitmap(64,64,System.Drawing.Imaging.PixelFormat.Format32bppArgb))using(var graphics=Graphics.FromImage(bitmap)){
          graphics.Clear(Color.Transparent);graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;float scale=Math.Min(64f/image.Width,64f/image.Height);float width=image.Width*scale,height=image.Height*scale;
          graphics.DrawImage(image,new RectangleF((64-width)/2,(64-height)/2,width,height));bitmap.Save(temporary,System.Drawing.Imaging.ImageFormat.Png);
        }
      }
      if(File.Exists(path))File.Replace(temporary,path,null);else File.Move(temporary,path);
      Forget(path);
    }finally{if(File.Exists(temporary))File.Delete(temporary);}
  }
  internal static void Reset(string printer){if(String.IsNullOrWhiteSpace(printer))throw new InvalidOperationException("Choose a printer first.");string path=IconPath(printer);if(File.Exists(path))File.Delete(path);Forget(path);}
  internal static void ResetPreset(string id){string path=PresetPath(id);if(File.Exists(path))File.Delete(path);Forget(path);}
  internal static void InvalidatePreset(string id){Forget(PresetPath(id));}
}
internal sealed class NativeLayout {
  public int count { get; set; }
  public int columns { get; set; }
  public int rows { get; set; }
  public bool landscape { get; set; }
  internal static readonly NativeLayout[] All=Load();
  static NativeLayout[] Load(){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("FastPrint.Layouts"))using(var reader=new StreamReader(stream))return NativePrint.Json.Deserialize<NativeLayout[]>(reader.ReadToEnd());}
  internal RectangleF Cell(int slot,int occupied,float width,float height,float margin,float gap){
    float cw=(width-2*margin-gap*(columns-1))/columns,ch=(height-2*margin-gap*(rows-1))/rows;
    int row=slot/columns;
    return new RectangleF(margin+(slot%columns)*(cw+gap),margin+row*(ch+gap),cw,ch);
  }
  internal static NativeLayout Find(int count){return All.FirstOrDefault(item=>item.count==count)??All[0];}
  internal static NativeLayout ForSheet(int count,bool landscape){var grid=Find(count);return count>1&&grid.landscape!=landscape?new NativeLayout{count=count,columns=grid.rows,rows=grid.columns,landscape=landscape}:grid;}
  internal static int ContentTurns(int count,bool align,int width,int height,float cellWidth,float cellHeight,int manual){return ((count>1&&align&&width!=height&&(width>height)!=(cellWidth>cellHeight)?1:0)+manual)%4;}
  internal const string SizeError="Actual-size items do not fit. Choose fewer pages per sheet, a larger paper, or another orientation.";
  internal RectangleF[] MontageCells(SizeF[] sizes,float width,float height,float margin,float gap,bool compact,bool actual,bool fill){
    var cells=new RectangleF[sizes.Length];
    for(int slot=0;slot<sizes.Length;slot++){
      var cell=Cell(slot,sizes.Length,width,height,margin,gap);var size=sizes[slot];
      if(!compact&&!actual){cells[slot]=cell;continue;}
      float scale=actual?1:fill?Math.Max(cell.Width/size.Width,cell.Height/size.Height):Math.Min(cell.Width/size.Width,cell.Height/size.Height);
      float w=fill&&!actual?cell.Width:size.Width*scale,h=fill&&!actual?cell.Height:size.Height*scale;
      if(!compact&&(w>cell.Width+.001f||h>cell.Height+.001f))throw new InvalidOperationException(SizeError);
      cells[slot]=new RectangleF(cell.X+(cell.Width-w)/2,cell.Y+(cell.Height-h)/2,w,h);
    }
    if(!compact)return cells;
    int usedRows=(sizes.Length+columns-1)/columns;var widths=new float[usedRows];var heights=new float[usedRows];
    for(int slot=0;slot<cells.Length;slot++){int row=slot/columns;widths[row]+=cells[slot].Width+(slot%columns==0?0:gap);heights[row]=Math.Max(heights[row],cells[slot].Height);}
    float totalHeight=heights.Sum()+Math.Max(0,usedRows-1)*gap;
    if(widths.Max()>width-2*margin+.001f||totalHeight>height-2*margin+.001f)throw new InvalidOperationException(SizeError);
    float y=(height-totalHeight)/2;
    for(int row=0;row<usedRows;row++){float x=(width-widths[row])/2;for(int slot=row*columns;slot<Math.Min(cells.Length,(row+1)*columns);slot++){var cell=cells[slot];cells[slot]=new RectangleF(x,y+(heights[row]-cell.Height)/2,cell.Width,cell.Height);x+=cell.Width+gap;}y+=heights[row]+gap;}
    return cells;
  }
  internal static void DrawSeparators(Graphics graphics,RectangleF[] cells,Color color,float pixelWidth){
    var groups=new Dictionary<string,List<float[]>>();
    foreach(var cell in cells)foreach(var edge in new[]{new[]{0f,cell.Top,cell.Left,cell.Right},new[]{0f,cell.Bottom,cell.Left,cell.Right},new[]{1f,cell.Left,cell.Top,cell.Bottom},new[]{1f,cell.Right,cell.Top,cell.Bottom}}){
      string key=edge[0]+":"+edge[1].ToString("F4",System.Globalization.CultureInfo.InvariantCulture);List<float[]> spans;if(!groups.TryGetValue(key,out spans)){spans=new List<float[]>();groups[key]=spans;}spans.Add(edge);
    }
    graphics.SmoothingMode=SmoothingMode.AntiAlias;
    using(var pen=new Pen(color,pixelWidth))foreach(var group in groups.Values){
      var sorted=group.OrderBy(edge=>edge[2]).ToArray();var current=(float[])sorted[0].Clone();
      for(int index=1;index<=sorted.Length;index++){
        if(index<sorted.Length&&sorted[index][2]<=current[3]+.0001f){current[3]=Math.Max(current[3],sorted[index][3]);continue;}
        if(current[0]==1)graphics.DrawLine(pen,current[1],current[2],current[1],current[3]);else graphics.DrawLine(pen,current[2],current[1],current[3],current[1]);
        if(index<sorted.Length)current=(float[])sorted[index].Clone();
      }
    }
  }
}
internal static class PrintTheme {
  internal static bool Dark;
  internal static Color Background,Surface,Glass,Text,Muted,Accent,Border,ControlBorder,Selected,Stage,PrimaryText,PrimaryStart,PrimaryEnd,ShellStart,ShellMiddle,ShellEnd;
  internal static int Radius=14,PanelRadius=18;
  [DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr window,int attribute,ref int value,int size);
  internal static void Initialize(bool? dark=null){
    if(dark.HasValue)Dark=dark.Value;
    else try{using(var key=Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))Dark=key!=null&&Convert.ToInt32(key.GetValue("AppsUseLightTheme",1))==0;}catch{Dark=false;}
    string css;using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("FastPrint.Tokens"))using(var reader=new StreamReader(stream))css=reader.ReadToEnd();
    string light=css.Substring(css.IndexOf(":root {",StringComparison.Ordinal));light=light.Substring(0,light.IndexOf('}'));
    string block=Dark?css.Substring(css.IndexOf(":root.dark",StringComparison.Ordinal)):light;
    Func<string,string> token=name=>{var match=Regex.Match(block,@"--"+Regex.Escape(name)+@":\s*([^;]+);");if(!match.Success)match=Regex.Match(light,@"--"+Regex.Escape(name)+@":\s*([^;]+);");return match.Groups[1].Value.Trim();};
    var baseBackground=ColorTranslator.FromHtml(token("ui-background"));
    var shellGround=ColorTranslator.FromHtml(token("ui-shell-ground"));var shellTint=ColorTranslator.FromHtml(token("ui-shell-tint"));
    Background=Blend(baseBackground,Blend(shellTint,shellGround,.35f),Dark?.65f:.50f);
    var shellHighlight=ColorTranslator.FromHtml(token("ui-shell-highlight"));
    var shellFrame=Regex.Match(token("ui-shell-frame"),@"rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)");
    if(!shellFrame.Success)throw new InvalidOperationException("Invalid shell frame in shared UI tokens.");
    var frame=Color.FromArgb(int.Parse(shellFrame.Groups[1].Value),int.Parse(shellFrame.Groups[2].Value),int.Parse(shellFrame.Groups[3].Value));
    float frameAlpha=float.Parse(shellFrame.Groups[4].Value,System.Globalization.CultureInfo.InvariantCulture);
    ShellStart=Blend(frame,shellHighlight,frameAlpha);ShellMiddle=Blend(frame,shellGround,frameAlpha);ShellEnd=Blend(frame,shellTint,frameAlpha);
    var strongSurface=ColorTranslator.FromHtml(token("ui-surface-strong"));Text=ColorTranslator.FromHtml(token("ui-text"));Muted=ColorTranslator.FromHtml(token("ui-text-secondary"));Accent=ColorTranslator.FromHtml(token("ui-accent"));
    Glass=Blend(strongSurface,Background,Dark?.62f:.55f);
    var control=Regex.Match(token("ui-glass-control"),@"rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)");
    if(!control.Success)throw new InvalidOperationException("Invalid glass control in shared UI tokens.");
    var controlTint=Color.FromArgb(int.Parse(control.Groups[1].Value),int.Parse(control.Groups[2].Value),int.Parse(control.Groups[3].Value));
    Surface=Blend(controlTint,Glass,float.Parse(control.Groups[4].Value,System.Globalization.CultureInfo.InvariantCulture));
    Border=Blend(Text,Glass,Dark?.17f:.13f);ControlBorder=ColorTranslator.FromHtml(token("ui-control-border"));Selected=Blend(Accent,Glass,Dark?.22f:.13f);Stage=Blend(Text,Background,Dark?.07f:.035f);
    var gradient=Regex.Matches(token("ui-primary-gradient"),@"#[0-9a-fA-F]{6}");
    if(gradient.Count!=2)throw new InvalidOperationException("Invalid primary gradient in shared UI tokens.");
    PrimaryStart=ColorTranslator.FromHtml(gradient[0].Value);PrimaryEnd=ColorTranslator.FromHtml(gradient[1].Value);
    PrimaryText=Dark?ColorTranslator.FromHtml(token("ui-nav-active-foreground")):ColorTranslator.FromHtml(Regex.Match(light,@"--ui-surface-strong:\s*([^;]+)").Groups[1].Value.Trim());
    Radius=int.Parse(Regex.Match(token("ui-radius-md"),@"\d+").Value);
    PanelRadius=int.Parse(Regex.Match(token("ui-radius-lg"),@"\d+").Value);
    if(SystemInformation.HighContrast){Background=ShellStart=ShellMiddle=ShellEnd=SystemColors.Control;Surface=Glass=SystemColors.Window;Text=SystemColors.WindowText;Muted=SystemColors.ControlText;Accent=PrimaryStart=PrimaryEnd=SystemColors.Highlight;Border=ControlBorder=SystemColors.WindowText;Selected=SystemColors.Highlight;PrimaryText=SystemColors.HighlightText;Stage=Background;}
  }
  internal static Color Blend(Color top,Color bottom,float alpha){return Color.FromArgb((int)(top.R*alpha+bottom.R*(1-alpha)),(int)(top.G*alpha+bottom.G*(1-alpha)),(int)(top.B*alpha+bottom.B*(1-alpha)));}
  // Paint one shared shell gradient in window coordinates, including behind
  // nested native controls, so panels do not interrupt the background.
  internal static void PaintBackground(Control control,Graphics graphics){
    for(Control ancestor=control.Parent;ancestor!=null;ancestor=ancestor.Parent)
      if(ancestor is PrintGlassPanel){using(var fill=new SolidBrush(Glass))graphics.FillRectangle(fill,control.ClientRectangle);return;}
    Control root=control;int x=0,y=0;
    while(root.Parent!=null&&!(root.Parent is Form)){x+=root.Left;y+=root.Top;root=root.Parent;}
    if(root.Width<1||root.Height<1){using(var fill=new SolidBrush(Background))graphics.FillRectangle(fill,control.ClientRectangle);return;}
    var bounds=new Rectangle(-x,-y,root.Width,root.Height);
    using(var fill=new LinearGradientBrush(bounds,ShellStart,ShellEnd,45f)){
      fill.InterpolationColors=new ColorBlend{Colors=new[]{ShellStart,ShellMiddle,ShellEnd},Positions=new[]{0f,.52f,1f}};
      graphics.FillRectangle(fill,control.ClientRectangle);
    }
  }
  internal static GraphicsPath Round(RectangleF r,float radius){var path=new GraphicsPath();float d=Math.Min(radius*2,Math.Min(r.Width,r.Height));if(d<=0)return path;path.AddArc(r.X,r.Y,d,d,180,90);path.AddArc(r.Right-d,r.Y,d,d,270,90);path.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);path.AddArc(r.X,r.Bottom-d,d,d,90,90);path.CloseFigure();return path;}
  internal static void Apply(Control root){
    root.ForeColor=Text;
    if(root is Form)root.BackColor=Background;
    else if(root is PrintGlassPanel)root.BackColor=Glass;
    else if(root is TableLayoutPanel || root is FlowLayoutPanel || root is LayoutPicker)root.BackColor=root.Parent==null?Background:root.Parent.BackColor;
    if(root is PreviewSurface)root.BackColor=Stage;
    if(root is PrintButtonControl)root.BackColor=Background;
    if(root is ComboBox || root is NumericUpDown || root is TextBoxBase || root is ListBox){root.BackColor=Surface;root.ForeColor=Text;}
    if(root is Label || root is CheckBox)root.BackColor=Color.Transparent;
    var combo=root as ComboBox;if(combo!=null){combo.FlatStyle=FlatStyle.Standard;combo.IntegralHeight=false;combo.MaxDropDownItems=12;}
    foreach(Control child in root.Controls)Apply(child);
    root.Invalidate();
    var form=root as Form;if(form!=null&&form.IsHandleCreated)try{int dark=Dark?1:0,rounded=2;DwmSetWindowAttribute(form.Handle,20,ref dark,4);DwmSetWindowAttribute(form.Handle,33,ref rounded,4);}catch{}
  }
}
internal sealed class PrintComboBox : ComboBox {
  [StructLayout(LayoutKind.Sequential)]struct ComboInfo {internal int size;internal RectangleInfo item,button;internal int buttonState;internal IntPtr combo,itemWindow,listWindow;}
  [StructLayout(LayoutKind.Sequential)]struct RectangleInfo {internal int left,top,right,bottom;}
  [DllImport("user32.dll")]static extern bool GetComboBoxInfo(IntPtr combo,ref ComboInfo info);
  [DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr window,int message,IntPtr wParam,IntPtr lParam);
  sealed class PresetListWindow : NativeWindow {
    readonly PrintComboBox owner;
    internal PresetListWindow(PrintComboBox owner){this.owner=owner;}
    protected override void WndProc(ref Message message){if(message.Msg==0x020A&&owner.ScrollPresetWheel(message.WParam)){message.Result=IntPtr.Zero;return;}base.WndProc(ref message);}
  }
  [StructLayout(LayoutKind.Sequential)]struct PaintData {
    internal IntPtr dc;internal int erase;internal int left,top,right,bottom;internal int restore,update;
    [MarshalAs(UnmanagedType.ByValArray,SizeConst=32)]internal byte[] reserved;
  }
  [DllImport("user32.dll")]static extern IntPtr BeginPaint(IntPtr window,out PaintData paint);
  [DllImport("user32.dll")]static extern bool EndPaint(IntPtr window,ref PaintData paint);
  internal int BufferedPaints;
  internal bool CompactSelection;
  internal bool ControlledPresetScrolling;
  PresetListWindow presetListWindow;IntPtr presetListHandle;int wheelRemainder;
  internal PrintComboBox(){DrawMode=DrawMode.OwnerDrawFixed;DropDownStyle=ComboBoxStyle.DropDownList;ItemHeight=28;FlatStyle=FlatStyle.Standard;IntegralHeight=false;}
  protected override CreateParams CreateParams {get{var value=base.CreateParams;value.Style&=~0x00800000;value.ExStyle&=~0x00000200;return value;}}
  protected override void OnDrawItem(DrawItemEventArgs e){
    if((e.State&DrawItemState.ComboBoxEdit)!=0){PrintPaint.Frame(e.Graphics,ClientSize,graphics=>Face(graphics,ClientSize));return;}
    if(e.Index<0)return;bool selected=(e.State&DrawItemState.Selected)!=0;
    DrawListRow(e.Graphics,e.Bounds,e.Index,selected);
    if((e.State&DrawItemState.Focus)!=0)e.DrawFocusRectangle();
  }
  internal void DrawListRow(Graphics graphics,Rectangle bounds,int index,bool selected){
    var entry=Items[index] as Entry;var foreground=selected&&SystemInformation.HighContrast?SystemColors.HighlightText:PrintTheme.Text;
    using(var brush=new SolidBrush(selected?PrintTheme.Selected:PrintTheme.Surface))graphics.FillRectangle(brush,bounds);
    bool rtl=RightToLeft==RightToLeft.Yes;
    var flags=TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix|(rtl?TextFormatFlags.RightToLeft|TextFormatFlags.Right:TextFormatFlags.Left);
    if(entry==null||String.IsNullOrEmpty(entry.PresetPrinter)){
      TextRenderer.DrawText(graphics,Items[index].ToString(),Font,Rectangle.Inflate(bounds,-10,0),foreground,flags);return;
    }
    var previous=index>0?Items[index-1] as Entry:null;
    if(previous!=null&&!String.Equals(previous.PresetPrinter,entry.PresetPrinter,StringComparison.OrdinalIgnoreCase))
      using(var separator=new Pen(SystemInformation.HighContrast?foreground:PrintTheme.Blend(PrintTheme.Text,PrintTheme.Surface,PrintTheme.Dark?.48f:.42f),2f))graphics.DrawLine(separator,bounds.Left+8,bounds.Top+1,bounds.Right-8,bounds.Top+1);
    int iconX=rtl?bounds.Right-28:bounds.Left+10, iconY=bounds.Top+17;
    bool konica=entry.PresetPrinter.IndexOf("konica",StringComparison.OrdinalIgnoreCase)>=0;
    if(entry.PresetIcon!=null){var state=graphics.Save();graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;graphics.DrawImage(entry.PresetIcon,new Rectangle(iconX-3,iconY-4,24,24));graphics.Restore(state);}
    else using(var pen=new Pen(konica&&!SystemInformation.HighContrast?PrintTheme.PrimaryEnd:foreground,1.4f)){
      if(konica){
        // Floor-standing laser copier: scanner, output tray, cabinet and paper drawers.
        graphics.DrawRectangle(pen,iconX+2,iconY-2,12,3);graphics.DrawRectangle(pen,iconX,iconY+1,16,13);
        graphics.DrawLine(pen,iconX+2,iconY+5,iconX+14,iconY+5);graphics.DrawLine(pen,iconX+4,iconY+9,iconX+12,iconY+9);graphics.DrawLine(pen,iconX+4,iconY+12,iconX+12,iconY+12);
      }else{graphics.DrawRectangle(pen,iconX,iconY+4,16,9);graphics.DrawRectangle(pen,iconX+3,iconY,10,5);graphics.DrawRectangle(pen,iconX+3,iconY+9,10,6);}
    }
    int badgeWidth=Math.Min(180,Math.Max(0,bounds.Width-170));int textLeft=rtl?bounds.Left+badgeWidth+10:bounds.Left+34;
    int textWidth=Math.Max(1,bounds.Width-badgeWidth-44);
    using(var small=new Font(Font.FontFamily,Math.Max(7.5f,Font.Size-1f),FontStyle.Regular)){
      TextRenderer.DrawText(graphics,Convert.ToString(entry.Value),Font,new Rectangle(textLeft,bounds.Top+4,textWidth,21),foreground,flags);
      TextRenderer.DrawText(graphics,entry.PresetPrinter,small,new Rectangle(textLeft,bounds.Top+24,textWidth,19),selected&&SystemInformation.HighContrast?foreground:PrintTheme.Muted,flags);
    }
    var badges=String.Join("  ·  ",new[]{entry.PresetPaper,entry.PresetColor}.Where(value=>!String.IsNullOrEmpty(value)).ToArray());
    var badgeRect=new Rectangle(rtl?bounds.Left+8:bounds.Right-badgeWidth-8,bounds.Top+6,badgeWidth,bounds.Height-12);
    using(var outline=new Pen(selected&&SystemInformation.HighContrast?foreground:PrintTheme.ControlBorder))using(var shape=PrintTheme.Round(new RectangleF(badgeRect.X,badgeRect.Y,badgeRect.Width-1,badgeRect.Height-1),PrintTheme.Radius))graphics.DrawPath(outline,shape);
    var badgeText=Rectangle.Inflate(badgeRect,-6,0);
    if(entry.PaperIcon!=null){int x=rtl?badgeRect.Right-29:badgeRect.Left+5;var state=graphics.Save();graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;graphics.DrawImage(entry.PaperIcon,new Rectangle(x,badgeRect.Top+(badgeRect.Height-24)/2,24,24));graphics.Restore(state);if(!rtl)badgeText.X+=28;badgeText.Width=Math.Max(1,badgeText.Width-28);}
    TextRenderer.DrawText(graphics,badges,Font,badgeText,foreground,TextFormatFlags.VerticalCenter|TextFormatFlags.HorizontalCenter|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix|(rtl?TextFormatFlags.RightToLeft:0));
  }
  void Face(Graphics graphics,Size size){
    graphics.SmoothingMode=SmoothingMode.None;
    PrintTheme.PaintBackground(this,graphics);
    graphics.SmoothingMode=SmoothingMode.AntiAlias;
    var rect=new RectangleF(1,1,size.Width-3,size.Height-3);
    if(rect.Width<=0||rect.Height<=0)return;
    var top=SystemInformation.HighContrast?PrintTheme.Surface:PrintTheme.Blend(Color.White,PrintTheme.Surface,PrintTheme.Dark?.03f:.08f);
    var bottom=SystemInformation.HighContrast?PrintTheme.Surface:PrintTheme.Blend(PrintTheme.Background,PrintTheme.Surface,PrintTheme.Dark?.05f:.06f);
    using(var path=PrintTheme.Round(rect,PrintTheme.Radius))using(var brush=new LinearGradientBrush(rect,top,bottom,90f))using(var pen=new Pen(Focused?PrintTheme.Accent:PrintTheme.ControlBorder)){graphics.FillPath(brush,path);graphics.DrawPath(pen,path);}
    bool rtl=RightToLeft==RightToLeft.Yes;int arrow=rtl?18:size.Width-18;
    using(var pen=new Pen(Enabled?PrintTheme.Muted:PrintTheme.Border,1.5f)){graphics.DrawLines(pen,new[]{new Point(arrow-4,size.Height/2-2),new Point(arrow,size.Height/2+2),new Point(arrow+4,size.Height/2-2)});}
    string label=FaceText();
    var text=new Rectangle(rtl?32:12,0,Math.Max(1,size.Width-44),size.Height);
    TextRenderer.DrawText(graphics,label,Font,text,Enabled?PrintTheme.Text:PrintTheme.Muted,TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix|(rtl?TextFormatFlags.RightToLeft|TextFormatFlags.Right:TextFormatFlags.Left));
  }
  internal string FaceText(){var entry=SelectedItem as Entry;return CompactSelection&&entry!=null&&entry.Value is string?(string)entry.Value:SelectedItem==null?Text:SelectedItem.ToString();}
  bool ScrollPresetWheel(IntPtr parameter){
    if(!ControlledPresetScrolling||presetListHandle==IntPtr.Zero)return false;
    int delta=unchecked((short)((parameter.ToInt64()>>16)&0xffff));wheelRemainder+=delta;
    int steps=wheelRemainder/120;wheelRemainder%=120;
    if(steps!=0){int first=SendMessage(presetListHandle,0x018e,IntPtr.Zero,IntPtr.Zero).ToInt32();if(first>=0)SendMessage(presetListHandle,0x0197,new IntPtr(Math.Max(0,Math.Min(Items.Count-1,first-steps))),IntPtr.Zero);}
    return true;
  }
  protected override void OnDropDown(EventArgs e){
    base.OnDropDown(e);wheelRemainder=0;
    if(!ControlledPresetScrolling)return;
    var info=new ComboInfo{size=Marshal.SizeOf(typeof(ComboInfo))};
    if(GetComboBoxInfo(Handle,ref info)&&info.listWindow!=IntPtr.Zero){presetListHandle=info.listWindow;presetListWindow=new PresetListWindow(this);presetListWindow.AssignHandle(presetListHandle);}
  }
  protected override void WndProc(ref Message message){
    // Own the complete face: never paint the native box underneath the rounded one.
    // WM_NCCALCSIZE returning zero makes the entire face client area; WM_PAINT
    // must validate its region with BeginPaint/EndPaint, not draw through GetWindowDC.
    if(message.Msg==0x0083||message.Msg==0x0085){message.Result=IntPtr.Zero;return;}
    if(message.Msg==0x0014){message.Result=new IntPtr(1);return;}
    if(message.Msg==0x020A&&ScrollPresetWheel(message.WParam)){message.Result=IntPtr.Zero;return;}
    if(message.Msg==0x000F){
      PaintData paint;var dc=BeginPaint(Handle,out paint);
      try{if(dc!=IntPtr.Zero)using(var graphics=Graphics.FromHdc(dc)){PrintPaint.Frame(graphics,ClientSize,target=>Face(target,ClientSize));BufferedPaints++;}}
      finally{EndPaint(Handle,ref paint);}message.Result=IntPtr.Zero;return;
    }
    if(message.Msg==0x0317||message.Msg==0x0318){if(message.WParam!=IntPtr.Zero)using(var graphics=Graphics.FromHdc(message.WParam))PrintPaint.Frame(graphics,Size,target=>Face(target,Size));message.Result=IntPtr.Zero;return;}
    base.WndProc(ref message);
  }
  protected override void OnSelectedIndexChanged(EventArgs e){base.OnSelectedIndexChanged(e);Invalidate();}
  protected override void OnTextChanged(EventArgs e){base.OnTextChanged(e);Invalidate();}
  protected override void OnGotFocus(EventArgs e){base.OnGotFocus(e);Invalidate();}
  protected override void OnLostFocus(EventArgs e){base.OnLostFocus(e);Invalidate();}
  protected override void OnEnabledChanged(EventArgs e){base.OnEnabledChanged(e);Invalidate();}
  protected override void OnDropDownClosed(EventArgs e){if(presetListWindow!=null){presetListWindow.ReleaseHandle();presetListWindow=null;}presetListHandle=IntPtr.Zero;wheelRemainder=0;base.OnDropDownClosed(e);Invalidate();}
  protected override void OnHandleDestroyed(EventArgs e){if(presetListWindow!=null){presetListWindow.ReleaseHandle();presetListWindow=null;}presetListHandle=IntPtr.Zero;wheelRemainder=0;base.OnHandleDestroyed(e);}
  internal static void VerifyPresetWheel(){
    using(var combo=new PrintComboBox{ControlledPresetScrolling=true})using(var list=new ListBox{Height=100,Width=260}){
      for(int index=0;index<40;index++){combo.Items.Add(index.ToString());list.Items.Add(index.ToString());}
      var handle=list.Handle;list.SelectedIndex=0;combo.presetListHandle=handle;
      var hook=new PresetListWindow(combo);hook.AssignHandle(handle);
      try{
        Action<int> wheel=delta=>SendMessage(handle,0x020A,new IntPtr((long)(ushort)(short)delta<<16),IntPtr.Zero);
        Func<int> top=()=>SendMessage(handle,0x018e,IntPtr.Zero,IntPtr.Zero).ToInt32();
        wheel(-120);if(top()!=1||list.SelectedIndex!=0)throw new InvalidOperationException("Preset scrolling skipped rows or changed selection.");
        wheel(-30);wheel(-30);wheel(-30);if(top()!=1)throw new InvalidOperationException("Partial wheel input moved too early.");wheel(-30);if(top()!=2)throw new InvalidOperationException("Precision wheel input was lost.");
        wheel(120);if(top()!=1||list.SelectedIndex!=0)throw new InvalidOperationException("Reverse scrolling changed the selected preset.");
      }finally{hook.ReleaseHandle();combo.presetListHandle=IntPtr.Zero;}
    }
  }
}
internal static class PrintPaint {
  internal static void Frame(Graphics target,Size size,Action<Graphics> draw){
    if(size.Width<1||size.Height<1)return;
    using(var frame=BufferedGraphicsManager.Current.Allocate(target,new Rectangle(Point.Empty,size))){draw(frame.Graphics);frame.Render(target);}
  }
}
internal sealed class PrintTableLayoutPanel : TableLayoutPanel {
  internal PrintTableLayoutPanel(){SetStyle(ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint|ControlStyles.ResizeRedraw,true);}
  protected override void OnPaintBackground(PaintEventArgs e){PrintTheme.PaintBackground(this,e.Graphics);}
}
// A calm, token-based glass-inspired surface. It avoids desktop blur and stays
// legible in high contrast and on low-end PCs.
internal sealed class PrintGlassPanel : TableLayoutPanel {
  internal PrintGlassPanel(){SetStyle(ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint|ControlStyles.ResizeRedraw,true);}
  protected override void OnPaintBackground(PaintEventArgs e){
    PrintTheme.PaintBackground(this,e.Graphics);
    if(Width<=3||Height<=3)return;
    e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;
    var rect=new RectangleF(1,1,Math.Max(0,Width-3),Math.Max(0,Height-3));
    using(var path=PrintTheme.Round(rect,PrintTheme.PanelRadius))using(var fill=new SolidBrush(PrintTheme.Glass))using(var border=new Pen(PrintTheme.Border)){e.Graphics.FillPath(fill,path);e.Graphics.DrawPath(border,path);}
    if(!SystemInformation.HighContrast&&Width>8&&Height>8){var inner=new RectangleF(2,2,Width-5,Height-5);using(var path=PrintTheme.Round(inner,Math.Max(1,PrintTheme.PanelRadius-1)))using(var rim=new Pen(PrintTheme.Blend(Color.White,PrintTheme.Glass,PrintTheme.Dark?.10f:.48f)))e.Graphics.DrawPath(rim,path);}
  }
}
internal sealed class PrintFlowLayoutPanel : FlowLayoutPanel {
  internal PrintFlowLayoutPanel(){SetStyle(ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint|ControlStyles.ResizeRedraw,true);}
  protected override void OnPaintBackground(PaintEventArgs e){PrintTheme.PaintBackground(this,e.Graphics);}
}
internal sealed class PrintShellPanel : Panel {
  internal PrintShellPanel(){SetStyle(ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint|ControlStyles.ResizeRedraw,true);}
  protected override void OnPaintBackground(PaintEventArgs e){PrintTheme.PaintBackground(this,e.Graphics);}
}
internal sealed class PrintContextMenu : ContextMenuStrip {
  internal PrintContextMenu(){DoubleBuffered=true;Renderer=new MenuRenderer();ShowImageMargin=false;Padding=new Padding(4);}
  protected override void OnOpening(System.ComponentModel.CancelEventArgs e){BackColor=PrintTheme.Surface;ForeColor=PrintTheme.Text;foreach(ToolStripItem item in Items)item.ForeColor=PrintTheme.Text;base.OnOpening(e);}
  sealed class MenuColors : ProfessionalColorTable {
    public override Color ToolStripDropDownBackground {get{return PrintTheme.Surface;}}
    public override Color MenuBorder {get{return PrintTheme.Border;}}
    public override Color MenuItemSelected {get{return PrintTheme.Selected;}}
    public override Color MenuItemBorder {get{return PrintTheme.Border;}}
  }
  sealed class MenuRenderer : ToolStripProfessionalRenderer {
    internal MenuRenderer():base(new MenuColors()){RoundedEdges=true;}
    protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e){using(var brush=new SolidBrush(PrintTheme.Surface))e.Graphics.FillRectangle(brush,e.AffectedBounds);}
    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e){if(e.Item.Selected){using(var path=PrintTheme.Round(new RectangleF(2,1,e.Item.Width-4,e.Item.Height-2),PrintTheme.Radius))using(var brush=new SolidBrush(PrintTheme.Selected))e.Graphics.FillPath(brush,path);}}
    protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e){e.TextColor=e.Item.Enabled?PrintTheme.Text:PrintTheme.Muted;base.OnRenderItemText(e);}
  }
}
internal class PrintButtonControl : Button {
  internal bool Primary,Quiet;
  bool selected;
  internal bool Selected {get{return selected;}set{if(selected==value)return;selected=value;Invalidate();}}
  bool hover;
  internal PrintButtonControl(){SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);FlatStyle=FlatStyle.Flat;FlatAppearance.BorderSize=0;MinimumSize=new Size(80,36);Padding=new Padding(12,0,12,0);Cursor=Cursors.Hand;UseVisualStyleBackColor=false;}
  public override Size GetPreferredSize(Size proposed){var text=TextRenderer.MeasureText(Text,Font);return new Size(Math.Max(MinimumSize.Width,text.Width+32),Math.Max(MinimumSize.Height,text.Height+16));}
  protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
  protected override void OnMouseLeave(EventArgs e){hover=false;Invalidate();base.OnMouseLeave(e);}
  protected override void OnEnabledChanged(EventArgs e){Invalidate();base.OnEnabledChanged(e);}
  protected override void OnPaintBackground(PaintEventArgs e){}
  protected override CreateParams CreateParams {get{var value=base.CreateParams;value.Style&=~0x00800000;value.ExStyle&=~0x00000200;return value;}}
  protected override void WndProc(ref Message message){
    if(message.Msg==0x0014){message.Result=new IntPtr(1);return;}
    if(message.Msg==0x0085){message.Result=IntPtr.Zero;return;}
    if(message.Msg==0x0317||message.Msg==0x0318){if(message.WParam!=IntPtr.Zero)using(var graphics=Graphics.FromHdc(message.WParam))PrintPaint.Frame(graphics,Size,target=>OnPaint(new PaintEventArgs(target,ClientRectangle)));message.Result=IntPtr.Zero;return;}
    base.WndProc(ref message);
  }
  protected override void OnPaint(PaintEventArgs e){
    e.Graphics.SmoothingMode=SmoothingMode.None;
    PrintTheme.PaintBackground(this,e.Graphics);
    e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;var rect=new RectangleF(1,1,Width-3,Height-3);if(rect.Width<=0||rect.Height<=0)return;
    var background=Primary&&Enabled?PrintTheme.Accent:Selected?PrintTheme.Selected:Quiet?(Parent==null?PrintTheme.Background:Parent.BackColor):PrintTheme.Surface;
    if(hover&&Enabled)background=PrintTheme.Blend(PrintTheme.Accent,background,.08f);
    var foreground=!Enabled?PrintTheme.Muted:Primary||Selected&&SystemInformation.HighContrast?PrintTheme.PrimaryText:Selected?PrintTheme.Accent:PrintTheme.Text;
    var primary=Primary&&Enabled;
    var top=primary?PrintTheme.PrimaryStart:SystemInformation.HighContrast?background:PrintTheme.Blend(Color.White,background,PrintTheme.Dark?.03f:.08f);
    var bottom=primary?PrintTheme.PrimaryEnd:SystemInformation.HighContrast?background:PrintTheme.Blend(PrintTheme.Background,background,PrintTheme.Dark?.05f:.06f);
    if(primary&&hover&&!SystemInformation.HighContrast){top=PrintTheme.Blend(PrintTheme.Text,top,.06f);bottom=PrintTheme.Blend(PrintTheme.Text,bottom,.06f);}
    using(var path=PrintTheme.Round(rect,PrintTheme.Radius))using(var brush=new LinearGradientBrush(rect,top,bottom,primary?25f:90f))using(var pen=new Pen(Focused&&ShowFocusCues||Selected?PrintTheme.Accent:PrintTheme.ControlBorder,Focused&&ShowFocusCues||Selected?2:1)){if(!Quiet||hover||Selected)e.Graphics.FillPath(brush,path);if(!Quiet||Focused||Selected)e.Graphics.DrawPath(pen,path);}
    PaintContent(e.Graphics,foreground);
  }
  protected virtual void PaintContent(Graphics graphics,Color foreground){TextRenderer.DrawText(graphics,Text,Font,ClientRectangle,foreground,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);}
}
internal sealed class LayoutPicker : ScrollableControl {
  internal readonly List<Entry> Items=new List<Entry>();
  readonly List<PrintButtonControl> tiles=new List<PrintButtonControl>();
  readonly ToolTip tips=new ToolTip();
  int selected=-1;
  internal event EventHandler SelectedIndexChanged;
  internal event EventHandler RefreshRequested;
  internal object SelectedItem { get { return selected>=0&&selected<Items.Count?Items[selected]:null; } }
  internal int SelectedIndex { get {return selected;}set{if(selected==value)return;selected=value;for(int i=0;i<tiles.Count;i++)tiles[i].Selected=i==selected;if(selected>=0&&selected<tiles.Count)ScrollControlIntoView(tiles[selected]);if(SelectedIndexChanged!=null)SelectedIndexChanged(this,EventArgs.Empty);} }
  internal void ClearSelected(){SelectedIndex=-1;}
  internal void Activate(int index){if(index<0||index>=Items.Count)throw new ArgumentOutOfRangeException("index");if(SelectedIndex==index){if(RefreshRequested!=null)RefreshRequested(this,EventArgs.Empty);}else SelectedIndex=index;}
  internal LayoutPicker(){AutoScroll=true;DoubleBuffered=true;TabStop=false;AccessibleName="Layout";Padding=new Padding(4);BackColor=PrintTheme.Background;}
  internal void Reload(){
    foreach(var tile in tiles)tile.Dispose();tiles.Clear();Controls.Clear();
    for(int i=0;i<Items.Count;i++){int index=i;var tile=new LayoutTile(Items[i]){TabIndex=i,AccessibleName=Items[i].Label,Selected=i==selected};tips.SetToolTip(tile,Items[i].Label);tile.Click+=delegate{Activate(index);};tile.KeyDown+=delegate(object sender,KeyEventArgs e){int direction=RightToLeft==RightToLeft.Yes?-1:1;int offset=e.KeyCode==Keys.Right?direction:e.KeyCode==Keys.Left?-direction:e.KeyCode==Keys.Down?5:e.KeyCode==Keys.Up?-5:0;if(offset!=0){SelectedIndex=Math.Max(0,Math.Min(Items.Count-1,index+offset));tiles[SelectedIndex].Focus();e.Handled=true;}};tile.PreviewKeyDown+=delegate(object sender,PreviewKeyDownEventArgs e){if(e.KeyCode==Keys.Right||e.KeyCode==Keys.Left||e.KeyCode==Keys.Up||e.KeyCode==Keys.Down)e.IsInputKey=true;};tiles.Add(tile);Controls.Add(tile);}Arrange();
  }
  protected override void OnResize(EventArgs e){base.OnResize(e);Arrange();}
  bool arranging;
  internal Rectangle TileBounds(int index,Point offset){int width=Math.Max(44,(ClientSize.Width-40)/5);return new Rectangle(offset.X+4+(Items[index].Id=="id-card"?0:RightToLeft==RightToLeft.Yes?4-index%5:index%5)*(width+8),offset.Y+4+(index/5)*52,Items[index].Id=="id-card"?width*5+32:width,44);}
  void Arrange(){if(tiles==null||arranging)return;arranging=true;SuspendLayout();try{AutoScrollMinSize=new Size(0,((tiles.Count+4)/5)*52);var offset=AutoScrollPosition;for(int i=0;i<tiles.Count;i++)tiles[i].Bounds=TileBounds(i,offset);}finally{ResumeLayout(true);arranging=false;}}
  protected override void Dispose(bool disposing){if(disposing)tips.Dispose();base.Dispose(disposing);}
  internal sealed class LayoutTile : PrintButtonControlBase {
    internal LayoutTile(Entry entry):base(entry){}
  }
}
// A Button-derived tile keeps native UI Automation, focus, Space and Enter support.
internal class PrintButtonControlBase : PrintButtonControl {
  readonly Entry entry;
  internal PrintButtonControlBase(Entry value){entry=value;Text=value.Label;MinimumSize=new Size(44,44);AccessibleRole=AccessibleRole.RadioButton;}
  protected override AccessibleObject CreateAccessibilityInstance(){return new TileAccessibility(this);}
  sealed class TileAccessibility : Control.ControlAccessibleObject {
    readonly PrintButtonControlBase tile;
    internal TileAccessibility(PrintButtonControlBase value):base(value){tile=value;}
    public override AccessibleStates State {get{return base.State|(tile.Selected?AccessibleStates.Checked:AccessibleStates.None);}}
    public override string DefaultAction {get{return "Select";}}
    public override void DoDefaultAction(){tile.PerformClick();}
  }
  protected override void PaintContent(Graphics graphics,Color foreground){
    int count;bool numeric=int.TryParse(entry.Id,out count);
    using(var labelFont=new Font(Font.FontFamily,numeric?14f:Font.Size,numeric?FontStyle.Bold:FontStyle.Regular))
      TextRenderer.DrawText(graphics,numeric?entry.Id:entry.Label,labelFont,new Rectangle(5,2,Width-10,Height-4),foreground,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix);
  }
}
