/** Produces a native Illustrator print/cut document; never issues a device command. */
export function createIllustratorCutScript(
  svgPath: string,
  aiPath: string,
  pdfPath: string,
  widthMm: number,
  heightMm: number
): string {
  return `(function(){
 var previousInteraction=app.userInteractionLevel;
 try {app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
 var doc=app.open(new File(${JSON.stringify(svgPath)}));
 var box=doc.artboards[0].artboardRect;
 if(Math.abs((box[2]-box[0])*25.4/72-${widthMm})>0.2 || Math.abs((box[1]-box[3])*25.4/72-${heightMm})>0.2) throw new Error('Imported artwork dimensions changed; do not cut this job.');
 function group(name){for(var i=0;i<doc.groupItems.length;i++){if(doc.groupItems[i].name===name)return doc.groupItems[i];}throw new Error('Missing SVG group: '+name);}
 var artworkGroup=group('Artwork'), cutGroup=group('CutContour'), marksGroup=group('RegistrationMarks');
 var oldLayers=[];for(var i=0;i<doc.layers.length;i++)oldLayers.push(doc.layers[i]);
 var art=doc.layers.add();art.name='Artwork';
 var cut=doc.layers.add();cut.name='CutContour';
 var marks=doc.layers.add();marks.name='FC RegisterMark Layer1';
 artworkGroup.move(art,ElementPlacement.PLACEATEND);cutGroup.move(cut,ElementPlacement.PLACEATEND);marksGroup.move(marks,ElementPlacement.PLACEATEND);
 for(var i=0;i<oldLayers.length;i++){if(oldLayers[i].pageItems.length!==0)throw new Error('Unexpected objects outside production groups.');oldLayers[i].remove();}
 function spot(name,magenta,black){var s;try{s=doc.spots.getByName(name);}catch(e){s=doc.spots.add();s.name=name;}s.colorType=ColorModel.SPOT;var c=new CMYKColor();c.cyan=0;c.magenta=magenta;c.yellow=0;c.black=black;s.color=c;var out=new SpotColor();out.spot=s;out.tint=100;return out;}
 var knife=spot('CutContour',100,0), mark=spot('MimakiFCRM',0,100), direction=spot('MimakiFCRMDir',0,100);
 function paint(container,kind){
  var items=container.typename==='CompoundPathItem'?container.pathItems:container.pageItems;
  for(var i=0;i<items.length;i++){var p=items[i];if(p.parent!==container)continue;
   if(p.typename==='GroupItem'||p.typename==='CompoundPathItem'){paint(p,kind);continue;}
   if(p.typename!=='PathItem')throw new Error('Non-vector geometry in '+kind+' layer.');
   if(kind==='cut'){p.filled=false;p.stroked=true;p.strokeColor=knife;p.strokeWidth=0.25;}
   else if(p.name==='MimakiFCRMDir'){p.stroked=false;p.filled=true;p.fillColor=direction;}
   else {p.filled=false;p.stroked=true;p.strokeColor=mark;p.strokeWidth=72/25.4;}
  }
 }
 paint(cutGroup,'cut');paint(marksGroup,'marks');
 art.printable=true;marks.printable=true;cut.printable=false;cut.visible=false;art.locked=true;marks.locked=true;
 var printSource=new File(${JSON.stringify(pdfPath + '.print-source.pdf')}),legacy=new File(${JSON.stringify(aiPath)});
 var pdf=new PDFSaveOptions();pdf.preserveEditability=true;pdf.acrobatLayers=true;pdf.compatibility=PDFCompatibility.ACROBAT6;doc.saveAs(printSource,pdf);
 var ai=new IllustratorSaveOptions();ai.compatibility=Compatibility.ILLUSTRATOR16;ai.pdfCompatible=true;ai.compressed=true;ai.embedLinkedFiles=true;doc.saveAs(legacy,ai);
 if(!legacy.copy(${JSON.stringify(pdfPath)}))throw new Error('Could not save the CS6-compatible print PDF.');
 try{printSource.remove();}catch(ignore){}
 cut.visible=true;doc.activeLayer=cut;doc.selection=null;cutGroup.selected=true;app.redraw();
 return 'Prepared native layers; select FineCut Plot and detect marks on the work PC. No device job was sent.';
 } finally {app.userInteractionLevel=previousInteraction;}
})()`
}
