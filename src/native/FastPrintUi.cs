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
internal sealed class NativeLayout {
  public int count { get; set; }
  public int columns { get; set; }
  public int rows { get; set; }
  public bool landscape { get; set; }
  internal static readonly NativeLayout[] All=Load();
  static NativeLayout[] Load(){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("FastPrint.Layouts"))using(var reader=new StreamReader(stream))return NativePrint.Json.Deserialize<NativeLayout[]>(reader.ReadToEnd());}
  internal static NativeLayout Find(int count){return All.FirstOrDefault(item=>item.count==count)??All[0];}
}
internal static class PrintTheme {
  internal static bool Dark;
  internal static Color Background,Surface,Text,Muted,Accent,Border,Selected,Stage,PrimaryText;
  internal static int Radius=14;
  [DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr window,int attribute,ref int value,int size);
  internal static void Initialize(bool? dark=null){
    if(dark.HasValue)Dark=dark.Value;
    else try{using(var key=Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))Dark=key!=null&&Convert.ToInt32(key.GetValue("AppsUseLightTheme",1))==0;}catch{Dark=false;}
    string css;using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("FastPrint.Tokens"))using(var reader=new StreamReader(stream))css=reader.ReadToEnd();
    string light=css.Substring(css.IndexOf(":root {",StringComparison.Ordinal));light=light.Substring(0,light.IndexOf('}'));
    string block=Dark?css.Substring(css.IndexOf(":root.dark",StringComparison.Ordinal)):light;
    Func<string,string> token=name=>{var match=Regex.Match(block,@"--"+Regex.Escape(name)+@":\s*([^;]+);");if(!match.Success)match=Regex.Match(light,@"--"+Regex.Escape(name)+@":\s*([^;]+);");return match.Groups[1].Value.Trim();};
    Background=ColorTranslator.FromHtml(token("ui-background"));Surface=ColorTranslator.FromHtml(token("ui-surface-strong"));Text=ColorTranslator.FromHtml(token("ui-text"));Muted=ColorTranslator.FromHtml(token("ui-text-secondary"));Accent=ColorTranslator.FromHtml(token("ui-accent"));
    Border=Blend(Text,Surface,Dark?.17f:.13f);Selected=Blend(Accent,Surface,Dark?.18f:.10f);Stage=Blend(Text,Background,Dark?.07f:.035f);
    PrimaryText=Dark?Background:ColorTranslator.FromHtml(Regex.Match(light,@"--ui-surface-strong:\s*([^;]+)").Groups[1].Value.Trim());
    Radius=int.Parse(Regex.Match(token("ui-radius-md"),@"\d+").Value);
    if(SystemInformation.HighContrast){Background=SystemColors.Control;Surface=SystemColors.Window;Text=SystemColors.WindowText;Muted=SystemColors.ControlText;Accent=SystemColors.Highlight;Border=SystemColors.WindowText;Selected=SystemColors.Highlight;PrimaryText=SystemColors.HighlightText;Stage=Background;}
  }
  internal static Color Blend(Color top,Color bottom,float alpha){return Color.FromArgb((int)(top.R*alpha+bottom.R*(1-alpha)),(int)(top.G*alpha+bottom.G*(1-alpha)),(int)(top.B*alpha+bottom.B*(1-alpha)));}
  internal static GraphicsPath Round(RectangleF r,float radius){var path=new GraphicsPath();float d=Math.Min(radius*2,Math.Min(r.Width,r.Height));if(d<=0)return path;path.AddArc(r.X,r.Y,d,d,180,90);path.AddArc(r.Right-d,r.Y,d,d,270,90);path.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);path.AddArc(r.X,r.Bottom-d,d,d,90,90);path.CloseFigure();return path;}
  internal static void Apply(Control root){
    root.ForeColor=Text;
    if(root is Form || root is TableLayoutPanel || root is FlowLayoutPanel || root is LayoutPicker)root.BackColor=Background;
    if(root is PreviewSurface)root.BackColor=Stage;
    if(root is PrintButtonControl)root.BackColor=Background;
    if(root is ComboBox || root is NumericUpDown || root is TextBoxBase){root.BackColor=Surface;root.ForeColor=Text;}
    if(root is Label || root is CheckBox)root.BackColor=Color.Transparent;
    var combo=root as ComboBox;if(combo!=null){combo.FlatStyle=FlatStyle.Standard;combo.IntegralHeight=false;combo.MaxDropDownItems=12;}
    foreach(Control child in root.Controls)Apply(child);
    root.Invalidate();
    var form=root as Form;if(form!=null&&form.IsHandleCreated)try{int dark=Dark?1:0,rounded=2;DwmSetWindowAttribute(form.Handle,20,ref dark,4);DwmSetWindowAttribute(form.Handle,33,ref rounded,4);}catch{}
  }
}
internal sealed class PrintComboBox : ComboBox {
  [StructLayout(LayoutKind.Sequential)]struct PaintData {
    internal IntPtr dc;internal int erase;internal int left,top,right,bottom;internal int restore,update;
    [MarshalAs(UnmanagedType.ByValArray,SizeConst=32)]internal byte[] reserved;
  }
  [DllImport("user32.dll")]static extern IntPtr BeginPaint(IntPtr window,out PaintData paint);
  [DllImport("user32.dll")]static extern bool EndPaint(IntPtr window,ref PaintData paint);
  internal int BufferedPaints;
  internal PrintComboBox(){DrawMode=DrawMode.OwnerDrawFixed;DropDownStyle=ComboBoxStyle.DropDownList;ItemHeight=28;FlatStyle=FlatStyle.Standard;IntegralHeight=false;}
  protected override CreateParams CreateParams {get{var value=base.CreateParams;value.Style&=~0x00800000;value.ExStyle&=~0x00000200;return value;}}
  protected override void OnDrawItem(DrawItemEventArgs e){
    if((e.State&DrawItemState.ComboBoxEdit)!=0){PrintPaint.Frame(e.Graphics,ClientSize,graphics=>Face(graphics,ClientSize));return;}
    if(e.Index<0)return;bool selected=(e.State&DrawItemState.Selected)!=0;
    using(var brush=new SolidBrush(selected?PrintTheme.Selected:PrintTheme.Surface))e.Graphics.FillRectangle(brush,e.Bounds);
    TextRenderer.DrawText(e.Graphics,Items[e.Index].ToString(),Font,new Rectangle(e.Bounds.X+10,e.Bounds.Y,e.Bounds.Width-20,e.Bounds.Height),PrintTheme.Text,TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix);
    if((e.State&DrawItemState.Focus)!=0)e.DrawFocusRectangle();
  }
  void Face(Graphics graphics,Size size){
    graphics.SmoothingMode=SmoothingMode.None;
    using(var background=new SolidBrush(Parent==null?PrintTheme.Background:Parent.BackColor))graphics.FillRectangle(background,new Rectangle(Point.Empty,size));
    graphics.SmoothingMode=SmoothingMode.AntiAlias;
    var rect=new RectangleF(1,1,size.Width-3,size.Height-3);
    using(var path=PrintTheme.Round(rect,PrintTheme.Radius))using(var brush=new SolidBrush(PrintTheme.Surface))using(var pen=new Pen(Focused?PrintTheme.Accent:PrintTheme.Border)){graphics.FillPath(brush,path);graphics.DrawPath(pen,path);}
    bool rtl=RightToLeft==RightToLeft.Yes;int arrow=rtl?18:size.Width-18;
    using(var pen=new Pen(Enabled?PrintTheme.Muted:PrintTheme.Border,1.5f)){graphics.DrawLines(pen,new[]{new Point(arrow-4,size.Height/2-2),new Point(arrow,size.Height/2+2),new Point(arrow+4,size.Height/2-2)});}
    string label=SelectedItem==null?Text:SelectedItem.ToString();
    var text=new Rectangle(rtl?32:12,0,Math.Max(1,size.Width-44),size.Height);
    TextRenderer.DrawText(graphics,label,Font,text,Enabled?PrintTheme.Text:PrintTheme.Muted,TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix|(rtl?TextFormatFlags.RightToLeft|TextFormatFlags.Right:TextFormatFlags.Left));
  }
  protected override void WndProc(ref Message message){
    // Own the complete face: never paint the native box underneath the rounded one.
    // WM_NCCALCSIZE returning zero makes the entire face client area; WM_PAINT
    // must validate its region with BeginPaint/EndPaint, not draw through GetWindowDC.
    if(message.Msg==0x0083||message.Msg==0x0085){message.Result=IntPtr.Zero;return;}
    if(message.Msg==0x0014){message.Result=new IntPtr(1);return;}
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
  protected override void OnDropDownClosed(EventArgs e){base.OnDropDownClosed(e);Invalidate();}
}
internal static class PrintPaint {
  internal static void Frame(Graphics target,Size size,Action<Graphics> draw){
    if(size.Width<1||size.Height<1)return;
    using(var frame=BufferedGraphicsManager.Current.Allocate(target,new Rectangle(Point.Empty,size))){draw(frame.Graphics);frame.Render(target);}
  }
}
internal sealed class PrintTableLayoutPanel : TableLayoutPanel {
  internal PrintTableLayoutPanel(){SetStyle(ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint|ControlStyles.ResizeRedraw,true);}
}
internal sealed class PrintFlowLayoutPanel : FlowLayoutPanel {
  internal PrintFlowLayoutPanel(){SetStyle(ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint|ControlStyles.ResizeRedraw,true);}
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
    using(var brush=new SolidBrush(Parent==null?PrintTheme.Background:Parent.BackColor))e.Graphics.FillRectangle(brush,ClientRectangle);
    e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;var rect=new RectangleF(1,1,Width-3,Height-3);
    var background=Primary&&Enabled?PrintTheme.Accent:Selected?PrintTheme.Selected:Quiet?PrintTheme.Background:PrintTheme.Surface;
    if(hover&&Enabled)background=PrintTheme.Blend(PrintTheme.Accent,background,.08f);
    var foreground=!Enabled?PrintTheme.Muted:Primary?PrintTheme.PrimaryText:Selected?PrintTheme.Accent:PrintTheme.Text;
    using(var path=PrintTheme.Round(rect,PrintTheme.Radius))using(var brush=new SolidBrush(background))using(var pen=new Pen(Focused&&ShowFocusCues?PrintTheme.Accent:PrintTheme.Border,Focused&&ShowFocusCues?2:1)){e.Graphics.FillPath(brush,path);if(!Quiet||Focused)e.Graphics.DrawPath(pen,path);}
    PaintContent(e.Graphics,foreground);
  }
  protected virtual void PaintContent(Graphics graphics,Color foreground){TextRenderer.DrawText(graphics,Text,Font,ClientRectangle,foreground,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);}
}
internal sealed class LayoutPicker : ScrollableControl {
  internal readonly List<Entry> Items=new List<Entry>();
  readonly List<PrintButtonControl> tiles=new List<PrintButtonControl>();
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
    for(int i=0;i<Items.Count;i++){int index=i;var tile=new LayoutTile(Items[i]){TabIndex=i,AccessibleName=Items[i].Label,Selected=i==selected};tile.Click+=delegate{Activate(index);};tile.KeyDown+=delegate(object sender,KeyEventArgs e){int direction=RightToLeft==RightToLeft.Yes?-1:1;int offset=e.KeyCode==Keys.Right?direction:e.KeyCode==Keys.Left?-direction:e.KeyCode==Keys.Down?2:e.KeyCode==Keys.Up?-2:0;if(offset!=0){SelectedIndex=Math.Max(0,Math.Min(Items.Count-1,index+offset));tiles[SelectedIndex].Focus();e.Handled=true;}};tile.PreviewKeyDown+=delegate(object sender,PreviewKeyDownEventArgs e){if(e.KeyCode==Keys.Right||e.KeyCode==Keys.Left||e.KeyCode==Keys.Up||e.KeyCode==Keys.Down)e.IsInputKey=true;};tiles.Add(tile);Controls.Add(tile);}Arrange();
  }
  protected override void OnResize(EventArgs e){base.OnResize(e);Arrange();}
  bool arranging;
  internal Rectangle TileBounds(int index,Point offset){int width=Math.Max(85,(ClientSize.Width-SystemInformation.VerticalScrollBarWidth-16)/2);return new Rectangle(offset.X+4+(Items[index].Id=="id-card"?0:RightToLeft==RightToLeft.Yes?1-index%2:index%2)*(width+8),offset.Y+4+(index/2)*90,Items[index].Id=="id-card"?width*2+8:width,82);}
  void Arrange(){if(tiles==null||arranging)return;arranging=true;SuspendLayout();try{AutoScrollMinSize=new Size(0,((tiles.Count+1)/2)*90+8);var offset=AutoScrollPosition;for(int i=0;i<tiles.Count;i++)tiles[i].Bounds=TileBounds(i,offset);}finally{ResumeLayout(true);arranging=false;}}
  internal sealed class LayoutTile : PrintButtonControlBase {
    internal LayoutTile(Entry entry):base(entry){}
  }
}
// A Button-derived tile keeps native UI Automation, focus, Space and Enter support.
internal class PrintButtonControlBase : PrintButtonControl {
  readonly Entry entry;
  internal PrintButtonControlBase(Entry value){entry=value;Text=value.Label;MinimumSize=new Size(80,82);AccessibleRole=AccessibleRole.RadioButton;}
  protected override AccessibleObject CreateAccessibilityInstance(){return new TileAccessibility(this);}
  sealed class TileAccessibility : Control.ControlAccessibleObject {
    readonly PrintButtonControlBase tile;
    internal TileAccessibility(PrintButtonControlBase value):base(value){tile=value;}
    public override AccessibleStates State {get{return base.State|(tile.Selected?AccessibleStates.Checked:AccessibleStates.None);}}
    public override string DefaultAction {get{return "Select";}}
    public override void DoDefaultAction(){tile.PerformClick();}
  }
  protected override void PaintContent(Graphics graphics,Color foreground){
    int count;int.TryParse(entry.Id,out count);var layout=NativeLayout.Find(count);var box=new Rectangle(Width/2-19,10,38,40);
    using(var paper=new SolidBrush(PrintTheme.Surface))using(var pen=new Pen(PrintTheme.Border)){graphics.FillRectangle(paper,box);graphics.DrawRectangle(pen,box);}
    int columns=layout.columns,rows=layout.rows;float cellW=30f/columns,cellH=32f/rows;
    using(var ink=new SolidBrush(PrintTheme.Blend(PrintTheme.Accent,PrintTheme.Surface,Selected?.65f:.30f)))
      for(int i=0;i<layout.count;i++)graphics.FillRectangle(ink,box.X+4+(i%columns)*cellW,box.Y+4+(i/columns)*cellH,Math.Max(1,cellW-2),Math.Max(1,cellH-2));
    TextRenderer.DrawText(graphics,entry.Label,Font,new Rectangle(4,55,Width-8,22),foreground,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
  }
}
