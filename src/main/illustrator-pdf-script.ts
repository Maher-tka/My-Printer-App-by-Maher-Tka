export interface IllustratorPdfLayoutFile {
  svgPath: string
  widthMm: number
  heightMm: number
  repeatCount: number
}

/** Save one vinyl sheet with CS6 editing data and three verified layers. */
export function createIllustratorPdfScript(
  layouts: IllustratorPdfLayoutFile[],
  pdfPath: string,
  layoutNumber = 1,
  keepOpen = true,
  statusPath?: string
): string {
  if (layouts.length !== 1) throw new Error('Export one vinyl sheet per PDF.')
  return `(function(){
 var previous=app.userInteractionLevel,doc=null,stage='open';
 var statusPath=${JSON.stringify(statusPath ?? null)};
 function status(name,message){stage=name;if(!statusPath)return;try{var f=new File(statusPath);f.encoding='UTF-8';if(f.open('w')){f.write(name+'\\n'+(message||''));f.close();}}catch(ignore){}}
 try {app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
 var layout=${JSON.stringify(layouts[0])},destination=new File(${JSON.stringify(pdfPath)});
 for(var j=0;j<app.documents.length;j++){try{if(app.documents[j].fullName.fsName.toLowerCase()===destination.fsName.toLowerCase())throw new Error('DestinationOpen');}catch(e){if(e.message==='DestinationOpen')throw new Error('The destination PDF is already open in Illustrator. Close it or choose another filename.');}}
 status('open layout');doc=app.open(new File(layout.svgPath));
 if(doc.artboards.length!==1)throw new Error('The vinyl sheet must have one artboard.');
 var box=doc.artboards[0].artboardRect;
 function dimensions(){var b=doc.artboards[0].artboardRect;if(Math.abs((b[2]-b[0])*25.4/72-layout.widthMm)>0.2||Math.abs((b[1]-b[3])*25.4/72-layout.heightMm)>0.2)throw new Error('Sheet dimensions changed.');}
 dimensions();
 function group(name){for(var j=0;j<doc.groupItems.length;j++)if(doc.groupItems[j].name===name)return doc.groupItems[j];throw new Error('Missing production group: '+name);}
 status('prepare layers');var a=group('Artwork'),c=group('CutContour'),m=group('RegistrationMarks'),old=[],cutBox=c.geometricBounds;
 var relative=[cutBox[0]-box[0],box[1]-cutBox[1],cutBox[2]-cutBox[0],cutBox[1]-cutBox[3]];
 for(var j=0;j<doc.layers.length;j++)old.push(doc.layers[j]);
 var art=doc.layers.add();art.name='Artwork';var cut=doc.layers.add();cut.name='CutContour';var marks=doc.layers.add();marks.name='FC RegisterMark Layer1';
 a.move(art,ElementPlacement.PLACEATEND);c.move(cut,ElementPlacement.PLACEATEND);m.move(marks,ElementPlacement.PLACEATEND);
 for(var j=0;j<old.length;j++){if(old[j].pageItems.length)throw new Error('Objects outside production groups.');old[j].remove();}
 function spot(name,m,k){var s;try{s=doc.spots.getByName(name);}catch(e){s=doc.spots.add();s.name=name;}s.colorType=ColorModel.SPOT;var color=new CMYKColor();color.cyan=0;color.magenta=m;color.yellow=0;color.black=k;s.color=color;var result=new SpotColor();result.spot=s;result.tint=100;return result;}
 var knife=spot('CutContour',100,0),mark=spot('MimakiFCRM',0,100),direction=spot('MimakiFCRMDir',0,100);
 var expectedCuts=0,corners=0,arrows=0;
 function paint(container,kind){var items=container.typename==='CompoundPathItem'?container.pathItems:container.pageItems;
  for(var j=0;j<items.length;j++){var p=items[j];if(p.parent!==container)continue;
   if(p.typename==='GroupItem'||p.typename==='CompoundPathItem'){paint(p,kind);continue;}
   if(p.typename!=='PathItem')throw new Error('Non-vector geometry in '+kind+' layer.');
   if(kind==='cut'){p.filled=false;p.stroked=true;p.strokeColor=knife;p.strokeWidth=0.25;expectedCuts++;}
   else if(p.name==='MimakiFCRMDir'){p.stroked=false;p.filled=true;p.fillColor=direction;arrows++;}
   else {p.filled=false;p.stroked=true;p.strokeColor=mark;p.strokeWidth=72/25.4;corners++;}
  }
 }
 paint(c,'cut');paint(m,'marks');
 if(!expectedCuts||!a.pageItems.length)throw new Error('The sheet is missing artwork or cutting paths.');
 if(corners!==4||arrows!==1)throw new Error('The sheet must have four corner marks and one direction arrow.');
 doc.artboards[0].name='Layout ${layoutNumber} - print '+layout.repeatCount+' sheet(s)';
 art.visible=true;art.printable=true;cut.visible=false;cut.printable=false;marks.visible=true;marks.printable=true;
 var pdf=new PDFSaveOptions();pdf.preserveEditability=true;pdf.acrobatLayers=true;pdf.compatibility=PDFCompatibility.ACROBAT6;pdf.artboardRange='1';
 // PDFSaveOptions cannot downsave Illustrator's editing stream. Prime the PDF
 // layer/printing options, then write that stream with the CS6 AI serializer.
 var folder=new File(layout.svgPath).parent.fsName;
 var printSource=new File(folder+'/cs6-print-source.pdf'),legacy=new File(folder+'/cs6-sheet.ai');
 status('save PDF');doc.saveAs(printSource,pdf);
 var ai=new IllustratorSaveOptions();ai.compatibility=Compatibility.ILLUSTRATOR16;ai.pdfCompatible=true;ai.compressed=true;ai.embedLinkedFiles=true;
 doc.saveAs(legacy,ai);doc.close(SaveOptions.DONOTSAVECHANGES);doc=null;
 // PDF-compatible AI is already a real PDF container. Copying keeps the CS6
 // stream; resaving with PDFSaveOptions would regenerate modern editing data.
 if(!legacy.copy(destination.fsName))throw new Error('Could not save the CS6-compatible PDF to the chosen folder.');
 status('reopen PDF');doc=app.open(destination);status('verify saved sheet');
 if(doc.layers.length!==3||doc.artboards.length!==1)throw new Error('Saved PDF must have three layers and one artboard.');
 art=doc.layers.getByName('Artwork');cut=doc.layers.getByName('CutContour');marks=doc.layers.getByName('FC RegisterMark Layer1');
 if(!art.visible||!marks.visible||cut.visible||cut.printable||!art.printable||!marks.printable)throw new Error('Saved PDF did not preserve layer visibility and printing settings.');
 var actualCuts=0,actualCorners=0,actualArrows=0;
 for(var j=0;j<doc.pathItems.length;j++){var p=doc.pathItems[j],sc=p.stroked?p.strokeColor:null,fc=p.filled?p.fillColor:null;
  var ss=sc&&sc.typename==='SpotColor'?sc.spot.name:'',fs=fc&&fc.typename==='SpotColor'?fc.spot.name:'';
  if(ss==='CutContour'||ss==='MimakiFCRM'||fs==='MimakiFCRMDir'){
   var owner=p.parent;while(owner&&(owner.typename==='GroupItem'||owner.typename==='CompoundPathItem'))owner=owner.parent;
   if(ss==='CutContour'){if(!owner||owner.typename!=='Layer'||owner.name!=='CutContour')throw new Error('Cut paths were merged into another layer.');actualCuts++;}
   else {if(!owner||owner.typename!=='Layer'||owner.name!=='FC RegisterMark Layer1')throw new Error('Registration marks were merged into another layer.');if(ss==='MimakiFCRM')actualCorners++;else actualArrows++;}
  }
 }
 if(actualCuts!==expectedCuts||actualCorners!==4||actualArrows!==1)throw new Error('Saved PDF lost cutting paths or registration marks.');
 dimensions();var b=doc.artboards[0].artboardRect,g=group('CutContour').geometricBounds,actual=[g[0]-b[0],b[1]-g[1],g[2]-g[0],g[1]-g[3]];
 for(var j=0;j<4;j++)if(Math.abs(actual[j]-relative[j])>0.6)throw new Error('Saved PDF shifted the cutting paths.');
 doc.selection=null;app.redraw();if(!${JSON.stringify(keepOpen)}){doc.close(SaveOptions.DONOTSAVECHANGES);doc=null;}
 try{printSource.remove();legacy.remove();}catch(ignore){}
 status('complete');return 'Verified CS6: one artboard, four corner marks, one direction arrow, three layers and '+actualCuts+' sticker cutting paths.';
 }catch(e){var failure=stage+': '+e.message;if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}catch(ignore){}}status('error',failure);throw new Error(failure);
 }finally{app.userInteractionLevel=previous;}
})()`
}
