using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

// Display order is independent of driver snapshots and print-option assignments.
internal static class NativePresetOrder {
  internal static Dictionary<string,object> Read(){
    string file=Path.Combine(NativePrint.LocalRoot,"preset-order.json");
    if(!File.Exists(file))return new Dictionary<string,object>{{"version",1},{"printers",new Dictionary<string,object>()}};
    try{
      if(new FileInfo(file).Length>4*1024*1024)throw new InvalidDataException();
      var data=NativePrint.Read(file);var printers=NativePrint.Map(data,"printers");
      if(NativePrint.Text(data,"version")!="1"||printers==null||printers.Count>200)throw new InvalidDataException();
      foreach(var pair in printers){
        if(string.IsNullOrWhiteSpace(pair.Key)||pair.Key.Length>512||pair.Key.Any(char.IsControl))throw new InvalidDataException();
        Ids(pair.Value);
      }
      return data;
    }catch(Exception error){throw new InvalidOperationException("Saved preset order could not be read.",error);}
  }
  static string[] Ids(object value){
    var sequence=value as System.Collections.IEnumerable;
    if(value is string||sequence==null)throw new InvalidDataException();
    var result=new List<string>();var unique=new HashSet<string>(StringComparer.Ordinal);
    foreach(object item in sequence){string id=item as string;if(id==null||!Regex.IsMatch(id,@"^[a-f0-9]{32}$")||!unique.Add(id)||result.Count>=1000)throw new InvalidDataException();result.Add(id);}
    return result.ToArray();
  }
  internal static Dictionary<string,int> Positions(string printer,bool strict=false){
    try{
      object value;var printers=NativePrint.Map(Read(),"printers");
      return printers.TryGetValue(printer,out value)?Ids(value).Select((id,index)=>new{id,index}).ToDictionary(item=>item.id,item=>item.index,StringComparer.Ordinal):new Dictionary<string,int>(StringComparer.Ordinal);
    }catch{if(strict)throw;return new Dictionary<string,int>(StringComparer.Ordinal);}
  }
  internal static void Save(string printer,string[] ids){
    if(string.IsNullOrWhiteSpace(printer)||printer.Length>512||printer.Any(char.IsControl))throw new InvalidOperationException("Invalid preset order.");
    try{Ids(ids);}catch{throw new InvalidOperationException("Invalid preset order.");}
    Directory.CreateDirectory(NativePrint.LocalRoot);
    // Serialize writers without locking profile files or changing driver data.
    using(var gate=new FileStream(Path.Combine(NativePrint.LocalRoot,"preset-order.lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None)){
      var data=Read();var printers=NativePrint.Map(data,"printers");if(!printers.ContainsKey(printer)&&printers.Count>=200)throw new InvalidOperationException("Invalid preset order.");printers[printer]=ids;
      string text=NativePrint.Json.Serialize(data);if(Encoding.UTF8.GetByteCount(text)>4*1024*1024)throw new InvalidOperationException("Invalid preset order.");
      string file=Path.Combine(NativePrint.LocalRoot,"preset-order.json"),temporary=file+"."+Guid.NewGuid().ToString("N")+".tmp";
      try{File.WriteAllText(temporary,text,new UTF8Encoding(false));if(File.Exists(file))File.Replace(temporary,file,file+".bak");else File.Move(temporary,file);}
      finally{if(File.Exists(temporary))File.Delete(temporary);}
    }
  }
}

internal sealed class PresetOrderDialog : Form {
  internal readonly ListBox Presets=new ListBox();
  internal readonly PrintButtonControl Up=new PrintButtonControl(),Down=new PrintButtonControl(),SaveButton=new PrintButtonControl{Primary=true};
  readonly string printer;readonly string[] original;readonly Func<string,string> translate;
  readonly ToolTip tips=new ToolTip();
  internal PresetOrderDialog(string printer,IEnumerable<Entry> entries,Func<string,string> translate,Font font,bool rtl,string selected){
    this.printer=printer;this.translate=translate;Font=font;Text=translate("Arrange presets…");Size=new Size(720,500);MinimumSize=new Size(620,460);StartPosition=FormStartPosition.CenterParent;AutoScaleMode=AutoScaleMode.Dpi;
    if(rtl){RightToLeft=RightToLeft.Yes;RightToLeftLayout=true;}
    var root=new PrintTableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(16),ColumnCount=1,RowCount=4};
    root.RowStyles.Add(new RowStyle(SizeType.Absolute,36));root.RowStyles.Add(new RowStyle(SizeType.Percent,100));root.RowStyles.Add(new RowStyle(SizeType.Absolute,48));root.RowStyles.Add(new RowStyle(SizeType.Absolute,44));Controls.Add(root);
    var owner=new Label{Text=translate("Printer")+": "+printer,Dock=DockStyle.Fill,AutoEllipsis=true,UseMnemonic=false};root.Controls.Add(owner,0,0);tips.SetToolTip(owner,printer);
    Presets.Dock=DockStyle.Fill;Presets.BorderStyle=BorderStyle.None;Presets.IntegralHeight=false;Presets.DrawMode=DrawMode.OwnerDrawFixed;Presets.ItemHeight=36;Presets.AccessibleName=translate("Saved preset");
    foreach(var entry in entries)Presets.Items.Add(entry);original=Ids();
    Presets.DrawItem+=delegate(object sender,DrawItemEventArgs e){
      if(e.Index<0)return;bool active=(e.State&DrawItemState.Selected)!=0;
      using(var brush=new SolidBrush(active?PrintTheme.Selected:PrintTheme.Surface))e.Graphics.FillRectangle(brush,e.Bounds);
      var flags=TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis|TextFormatFlags.NoPrefix;
      if(rtl)flags|=TextFormatFlags.RightToLeft|TextFormatFlags.Right;
      TextRenderer.DrawText(e.Graphics,Presets.Items[e.Index].ToString(),Font,Rectangle.Inflate(e.Bounds,-8,0),PrintTheme.Text,flags);if((e.State&DrawItemState.Focus)!=0)e.DrawFocusRectangle();
    };
    Presets.SelectedIndexChanged+=delegate{UpdateButtons();};
    Presets.KeyDown+=delegate(object sender,KeyEventArgs e){if(e.Alt&&(e.KeyCode==Keys.Up||e.KeyCode==Keys.Down)){MoveSelected(e.KeyCode==Keys.Up?-1:1);e.Handled=e.SuppressKeyPress=true;}};
    Presets.MouseMove+=delegate(object sender,MouseEventArgs e){int index=Presets.IndexFromPoint(e.Location);string text=index<0?"":Presets.Items[index].ToString();if(tips.GetToolTip(Presets)!=text)tips.SetToolTip(Presets,text);};
    var listFrame=new PrintTableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(1),ColumnCount=1,RowCount=1};listFrame.Paint+=delegate(object sender,PaintEventArgs e){using(var border=new Pen(PrintTheme.Border))e.Graphics.DrawRectangle(border,0,0,listFrame.Width-1,listFrame.Height-1);};listFrame.Controls.Add(Presets,0,0);root.Controls.Add(listFrame,0,1);
    var moves=new PrintFlowLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(0,8,0,0),WrapContents=false};
    Configure(Up,translate("Move up"),delegate{MoveSelected(-1);});Configure(Down,translate("Move down"),delegate{MoveSelected(1);});moves.Controls.Add(Up);moves.Controls.Add(Down);root.Controls.Add(moves,0,2);
    var actions=new PrintFlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.RightToLeft,WrapContents=false};
    Configure(SaveButton,translate("Save"),delegate{try{SaveOrder();}catch(Exception error){MessageBox.Show(this,translate(error.Message),translate("Fast Print"),MessageBoxButtons.OK,MessageBoxIcon.Error);}});
    var cancel=new PrintButtonControl{Quiet=true,DialogResult=DialogResult.Cancel};Configure(cancel,translate("Cancel"),delegate{Close();});actions.Controls.Add(SaveButton);actions.Controls.Add(cancel);root.Controls.Add(actions,0,3);
    AcceptButton=SaveButton;CancelButton=cancel;PrintTheme.Apply(this);
    Presets.SelectedIndex=Presets.Items.Count==0?-1:Math.Max(0,Presets.Items.Cast<Entry>().ToList().FindIndex(item=>item.Id==selected));UpdateButtons();
  }
  static void Configure(Button button,string text,EventHandler handler){button.Text=text;button.AutoSize=true;button.MinimumSize=new Size(100,36);button.Margin=new Padding(0,0,8,0);button.Click+=handler;}
  internal string[] Ids(){return Presets.Items.Cast<Entry>().Select(item=>item.Id).ToArray();}
  internal void MoveSelected(int offset){int index=Presets.SelectedIndex,next=index+offset;if(index<0||next<0||next>=Presets.Items.Count)return;var item=Presets.Items[index];Presets.Items.RemoveAt(index);Presets.Items.Insert(next,item);Presets.SelectedIndex=next;Presets.Focus();UpdateButtons();}
  void UpdateButtons(){Up.Enabled=Presets.SelectedIndex>0;Down.Enabled=Presets.SelectedIndex>=0&&Presets.SelectedIndex<Presets.Items.Count-1;SaveButton.Enabled=!Ids().SequenceEqual(original);}
  internal void SaveOrder(){NativePresetOrder.Save(printer,Ids());DialogResult=DialogResult.OK;}
  protected override void Dispose(bool disposing){if(disposing)tips.Dispose();base.Dispose(disposing);}
}
