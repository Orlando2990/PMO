(function(){
  const BLUE='000066', LIGHT='EAF2FF', GREY='F5F7FA';
  function safe(v){ return String(v ?? ''); }
  function norm(v){ return safe(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(); }
  function selected(arr,v){ return Array.isArray(arr) && arr.some(x=>norm(x)===norm(v)); }
  function cb(ok,label){ return `${ok?'☒':'☐'} ${label}`; }
  function fmtDate(v){ if(!v) return ''; const s=String(v).slice(0,10).split('-'); return s.length===3?`${s[2]}/${s[1]}/${s[0]}`:String(v); }
  function dataUrlBytes(dataUrl){
    const b64=String(dataUrl||'').split(',')[1]||''; const bin=atob(b64); const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out;
  }
  function blobName(v){ return safe(v).replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_') || 'Solicitud'; }
  async function imageSize(dataUrl,maxW=590,maxH=500){
    return await new Promise(resolve=>{ const img=new Image(); img.onload=()=>{ const r=Math.min(maxW/img.width,maxH/img.height,1); resolve({width:Math.max(1,Math.round(img.width*r)),height:Math.max(1,Math.round(img.height*r))}); }; img.onerror=()=>resolve({width:520,height:300}); img.src=dataUrl; });
  }
  function borders(docx){ const b={style:docx.BorderStyle.SINGLE,size:12,color:BLUE}; return {top:b,bottom:b,left:b,right:b,insideHorizontal:b,insideVertical:b}; }
  function cell(docx,text,opt={}){
    const children=Array.isArray(text)?text:[new docx.Paragraph({alignment:opt.align||docx.AlignmentType.LEFT,spacing:{before:0,after:0},children:[new docx.TextRun({text:safe(text),bold:!!opt.bold,size:opt.size||18})]})];
    return new docx.TableCell({columnSpan:opt.columnSpan||undefined,width:opt.width?{size:opt.width,type:docx.WidthType.DXA}:undefined,verticalAlign:docx.VerticalAlign.CENTER,shading:opt.shading?{fill:opt.shading,type:docx.ShadingType.CLEAR}:undefined,margins:{top:80,bottom:80,left:90,right:90},children});
  }
  function row(docx,cells,height){ return new docx.TableRow({height:height?{value:height,rule:docx.HeightRule.ATLEAST}:undefined,children:cells}); }
  function table(docx,rows,widths){ return new docx.Table({width:{size:100,type:docx.WidthType.PERCENTAGE},layout:docx.TableLayoutType.FIXED,borders:borders(docx),columnWidths:widths,rows}); }
  function titleBox(docx,title,content,height=700){
    return table(docx,[row(docx,[cell(docx,[new docx.Paragraph({spacing:{after:100},children:[new docx.TextRun({text:title,bold:true,size:18})]}),new docx.Paragraph({children:[new docx.TextRun({text:safe(content),size:18})]})],{width:9360})],height)],[9360]);
  }
  function pageBreak(docx){ return new docx.Paragraph({children:[new docx.PageBreak()]}); }
  const ATTACHMENT_ICON_B64='iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABZ0lEQVR4nO2bMU4DMRBFZxE3CEdAHIE6h0F09DkCPV2Uw6TmCChHIEpHG6qVyMogrWe8D2f+a6Osv5/G9sjaHU5f57Ml5oYOQCMBdAAaCaAD0Nx6/vz48hmVo8h2s7Ln12Pxt/e3u5Axqiug9eRHtptV0/GrBCw1+ZGWEoa5jdB00I9dTCmW2B8uo63vBzMze3i6zOBZDq5NsOXkS4xCIsft7hSYVoWX7gSYxUroUoDZ7xvjXLoVYBYjoWsBZn4Jrk6wNeOxV+LnUYgdg9eABNABaCSADkAjAXQAGgmgA9CEd4LTy4oIWt47pK+A9ALCl8DS12Re0leABNABaNILUB/Q7MmdkF6A+gA6AI0E0AFo0gv4V30AsYGmr4D0AtQH0AFoJIAOQCMBdAAaCaAD0LgEtLj+Wnrc2S9Lmy3/tvhfeL8bqKqAqI8VvETkqF4CtISo8auWwDWhU4AOQCMBdAAaCaAD0HwDWMZSjSztShcAAAAASUVORK5CYII=';
  function u16(n){return [n&255,(n>>>8)&255]} function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
  function zstr(s){return [...new TextEncoder().encode(String(s||'')),0]}
  function hexBytes(hex){
    const clean=String(hex||'').replace(/\s+/g,'');
    const out=new Uint8Array(clean.length/2);
    for(let i=0;i<out.length;i++) out[i]=parseInt(clean.slice(i*2,i*2+2),16);
    return out;
  }
  async function olePackageBytes(file){
    if(!window.CFB || !file?.blob) return null;
    const raw=new Uint8Array(await file.blob.arrayBuffer());
    const name=file.nombre_archivo||file.nombre||'archivo';
    const body=[...u16(2),...zstr(name),...zstr(name),...u16(0),...u16(0),...zstr('C:\\'+name),...u32(raw.length),...raw];
    const native=new Uint8Array([...u32(body.length),...body]);
    const cfb=CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb,'\x01Ole10Native',native);
    CFB.utils.cfb_add(cfb,'\x01Ole',hexBytes('0100000200000000000000000000000000000000'));
    CFB.utils.cfb_add(cfb,'\x03ObjInfo',hexBytes('000003000d00000000000000'));
    // Metadatos del objeto OLE tipo Package. Estos streams permiten que Word trate el adjunto como archivo incrustado real.
    CFB.utils.cfb_add(cfb,'\x01CompObj',hexBytes(
      '0100feff030a0000ffffffff02000000'+
      '00000000000000000000000000000000000000000000000000000000'+
      '080000005061636b61676500'+
      '00000000'+
      '080000005061636b61676500'+
      '0000000000000000'
    ));
    return new Uint8Array(CFB.write(cfb,{type:'array'}));
  }
  async function incrustarAdjuntosEnDocx(blob,documentos){
    const docs=(documentos||[]).filter(x=>x.blob); if(!docs.length || !window.JSZip || !window.CFB) return blob;
    const zip=await JSZip.loadAsync(blob); let xml=await zip.file('word/document.xml').async('string'); let rels=await zip.file('word/_rels/document.xml.rels').async('string'); let ct=await zip.file('[Content_Types].xml').async('string');
    if(!xml.includes('xmlns:v=')) xml=xml.replace('<w:document ','<w:document xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" ');
    let maxRid=0; for(const m of rels.matchAll(/Id="rId(\d+)"/g)) maxRid=Math.max(maxRid,Number(m[1]));
    if(!ct.includes('Extension="bin"')) ct=ct.replace('</Types>','<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.oleObject"/></Types>');
    if(!ct.includes('Extension="png"')) ct=ct.replace('</Types>','<Default Extension="png" ContentType="image/png"/></Types>');
    const icon=Uint8Array.from(atob(ATTACHMENT_ICON_B64),c=>c.charCodeAt(0));
    for(let i=0;i<docs.length;i++){
      const bin=await olePackageBytes(docs[i]); if(!bin) continue; const ridOle='rId'+(++maxRid), ridImg='rId'+(++maxRid); const n=i+1;
      zip.file(`word/embeddings/oleObject${n}.bin`,bin); zip.file(`word/media/attachment${n}.png`,icon);
      rels=rels.replace('</Relationships>',`<Relationship Id="${ridOle}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="embeddings/oleObject${n}.bin"/><Relationship Id="${ridImg}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/attachment${n}.png"/></Relationships>`);
      const marker=`__PMO_EMBED_${i}__`; const obj=`<w:r><w:object w:dxaOrig="700" w:dyaOrig="700"><v:shape id="_x0000_i${1025+n}" type="#_x0000_t75" style="width:32pt;height:32pt"><v:imagedata r:id="${ridImg}" o:title=""/></v:shape><o:OLEObject Type="Embed" ProgID="Package" ShapeID="_x0000_i${1025+n}" DrawAspect="Icon" ObjectID="_${100000+n}" r:id="${ridOle}"/></w:object></w:r>`;
      const re=new RegExp(`<w:r[^>]*>[\s\S]*?<w:t[^>]*>${marker}<\/w:t>[\s\S]*?<\/w:r>`); xml=xml.replace(re,obj);
    }
    zip.file('word/document.xml',xml); zip.file('word/_rels/document.xml.rels',rels); zip.file('[Content_Types].xml',ct);
    return await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }


  async function descargarAdjuntosRQM(data){
    const docs=(data?.documentos||[]).filter(x=>x?.blob);
    if(!docs.length || !window.JSZip) return false;
    const zip=new JSZip();
    const usados=new Set();
    docs.forEach((archivo,indice)=>{
      const original=safe(archivo.nombre_archivo||archivo.nombre||`adjunto_${indice+1}`);
      let nombre=original.replace(/[\/:*?"<>|]+/g,'_') || `adjunto_${indice+1}`;
      const punto=nombre.lastIndexOf('.');
      const baseNombre=punto>0?nombre.slice(0,punto):nombre;
      const extension=punto>0?nombre.slice(punto):'';
      let candidato=nombre, consecutivo=2;
      while(usados.has(candidato.toLowerCase())) candidato=`${baseNombre}_${consecutivo++}${extension}`;
      usados.add(candidato.toLowerCase());
      zip.file(candidato,archivo.blob);
    });
    const zipBlob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
    const base=blobName(data?.numero_rqm||'Solicitud_RQM');
    saveAs(zipBlob,`${base}_Adjuntos.zip`);
    return true;
  }

  async function generarWordFormatoRQM(data){
    const d=window.docx;
    if(!d?.Document || !window.saveAs){ alert('No se pudo cargar el generador Word. Verifica tu conexión a internet.'); return; }
    const sys=norm(data.sistema_nombre);
    const areas=['Core Bancario','Finanzas','Contabilidad','Cobranza','Crédito al consumo','Operaciones','Mesa de control','Call Center','Todas las anteriores'];
    const deps=['Manuales','CheckList','Boletines','Capacitaciones','Todos los anteriores'];
    const tipos=['Mejora','Normativo','Proyecto','Mantenimiento','Hallazgo','Solicitud de info'];
    const children=[];

    const headerTable=new d.Table({width:{size:100,type:d.WidthType.PERCENTAGE},layout:d.TableLayoutType.FIXED,borders:{top:{style:d.BorderStyle.NONE},bottom:{style:d.BorderStyle.SINGLE,size:4,color:'C9CDD3'},left:{style:d.BorderStyle.NONE},right:{style:d.BorderStyle.NONE},insideHorizontal:{style:d.BorderStyle.NONE},insideVertical:{style:d.BorderStyle.SINGLE,size:4,color:'E5E7EB'}},columnWidths:[6200,3160],rows:[row(d,[cell(d,[new d.Paragraph({children:[new d.TextRun({text:'finsus',bold:true,size:62,color:'272738'})]}),new d.Paragraph({children:[new d.TextRun({text:'Finanzas Transparentes',size:24,color:'272738'})]})],{width:6200}),cell(d,[new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:safe(data.numero_rqm||'RQM 00 00'),size:20})]}),new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:'Fecha de elaboración:',size:18})]}),new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:fmtDate(data.fecha_asignacion),size:18})]})],{width:3160})],900)]});
    children.push(headerTable,new d.Paragraph({spacing:{before:260,after:160},alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:'Requerimiento a Sistemas',bold:true,size:32,color:BLUE})]}));

    const sysLine=[cb(sys==='GENESIS','GENESIS'),cb(sys==='COBRANZA','COBRANZA'),cb(sys==='COTIZADOR WEB','COTIZADOR WEB'),cb(!['GENESIS','COBRANZA','COTIZADOR WEB'].includes(sys),'OTRO'),`ESPECIFIQUE: ${!['GENESIS','COBRANZA','COTIZADOR WEB'].includes(sys)?safe(data.sistema_nombre):''}`].join('     ');
    children.push(titleBox(d,'SISTEMA AFECTADO:',sysLine,700),new d.Paragraph({spacing:{after:150}}));
    children.push(table(d,[
      row(d,[cell(d,'Nombre del RQM',{bold:true,width:1900}),cell(d,data.proyecto,{width:7460})],420),
      row(d,[cell(d,'Número del RQM',{bold:true,width:1900}),cell(d,data.numero_rqm,{width:7460})],420),
      row(d,[cell(d,'Versión',{bold:true,width:1900}),cell(d,data.version,{width:7460})],420),
      row(d,[cell(d,'Descripción general',{bold:true,width:1900}),cell(d,data.descripcion_general,{width:7460})],1000)
    ],[1900,7460]),new d.Paragraph({spacing:{after:150}}));
    children.push(titleBox(d,'TIPO DE REQUERIMIENTO:',tipos.map(v=>cb(norm(data.tipo_requerimiento)===norm(v),v)).join('    '),650),new d.Paragraph({spacing:{after:150}}));
    children.push(table(d,[
      row(d,[cell(d,'Prioridad',{bold:true,width:1700}),cell(d,['Baja','Mediana','Alta'].map(v=>cb(norm(data.prioridad)===norm(v),v)).join('        '),{width:7660})],400),
      row(d,[cell(d,'Complejidad',{bold:true,width:1700}),cell(d,['Baja','Mediana','Alta'].map(v=>cb(norm(data.complejidad)===norm(v),v)).join('        '),{width:7660})],400),
      row(d,[cell(d,'Solicitante',{bold:true,width:1700}),cell(d,data.solicitado_por,{width:7660})],400),
      row(d,[cell(d,'Área solicitante',{bold:true,width:1700}),cell(d,data.area_nombre,{width:7660})],400),
      row(d,[cell(d,'Fecha de ingreso',{bold:true,width:1700}),cell(d,fmtDate(data.fecha_asignacion),{width:7660})],400),
      row(d,[cell(d,'Responsable',{bold:true,width:1700}),cell(d,data.responsable,{width:7660})],400)
    ],[1700,7660]),new d.Paragraph({spacing:{after:150}}));
    const areaLine1=areas.slice(0,6).map(v=>cb(selected(data.areas_impactadas_lista,v),v)).join('   ');
    const areaLine2=`${areas.slice(6).map(v=>cb(selected(data.areas_impactadas_lista,v),v)).join('   ')}   ${cb(selected(data.areas_impactadas_lista,'Otro'),'Otro')}  Especifique: ${safe(data.areas_impactadas_otro)}`;
    children.push(titleBox(d,'AREAS IMPACTADAS:',`${areaLine1}\n${areaLine2}`,850),pageBreak(d));

    children.push(titleBox(d,'DEPENDENCIAS PARA SALIDA A PRODUCCION:',`${deps.map(v=>cb(selected(data.dependencias_lista,v),v)).join('    ')}    ${cb(selected(data.dependencias_lista,'Otros'),'Otros')}  Especifique: ${safe(data.dependencias_otro)}`,750));
    children.push(new d.Paragraph({spacing:{before:300,after:100},children:[new d.TextRun({text:'Aprobaciones',size:26})]}));
    children.push(table(d,[row(d,['Preparado por','Fecha','Revisado por','Fecha','Aprobado por','Fecha y firma'].map((x,i)=>cell(d,x,{bold:true,width:[1900,700,2100,700,2700,1260][i]})),480),row(d,[1900,700,2100,700,2700,1260].map(w=>cell(d,'',{width:w})),850)],[1900,700,2100,700,2700,1260]));
    children.push(new d.Paragraph({spacing:{before:300,after:100},children:[new d.TextRun({text:'Control de versiones',size:26})]}));
    // Tabla simple sin las líneas internas que se encimaban bajo “Modificado” y “Revisado”.
    children.push(table(d,[row(d,[cell(d,'No.\nversión',{bold:true,width:1100}),cell(d,'Descripción del\ncambio',{bold:true,width:2400}),cell(d,'Sección\nmodificada',{bold:true,width:1800}),cell(d,'Modificado',{bold:true,width:2300,align:d.AlignmentType.CENTER}),cell(d,'Revisado',{bold:true,width:1760,align:d.AlignmentType.CENTER})],700),row(d,[1100,2400,1800,2300,1760].map(w=>cell(d,'',{width:w})),1000)],[1100,2400,1800,2300,1760]));
    children.push(new d.Paragraph({spacing:{after:120}}),titleBox(d,'ANTECEDENTES',data.antecedentes,720),titleBox(d,'OBJETIVO',data.objetivo,720),titleBox(d,'DESCRIPCION (Pantallas, Imágenes, Documentos)',data.descripcion_detallada,1650));

    const evidencias=(data.imagenes||[]).filter(x=>x.data_url);
    const documentos=(data.documentos||[]);
    // Máximo dos imágenes por hoja, todas dentro de un solo cuadro azul de DESCRIPCIÓN.
    for(let offset=0; offset<evidencias.length; offset+=2){
      const lote=evidencias.slice(offset,offset+2);
      const contenido=[new d.Paragraph({spacing:{after:90},children:[new d.TextRun({text:'DESCRIPCION (Pantallas, Imágenes, Documentos)',bold:true,size:18})]})];
      for(const img of lote){
        const size=await imageSize(img.data_url,720,300);
        contenido.push(new d.Paragraph({spacing:{before:70,after:70},children:[new d.TextRun({text:safe(img.nombre_archivo||img.nombre||'Evidencia'),size:17})]}));
        contenido.push(new d.Paragraph({alignment:d.AlignmentType.CENTER,spacing:{after:110},children:[new d.ImageRun({data:dataUrlBytes(img.data_url),transformation:size})]}));
      }
      children.push(pageBreak(d),table(d,[row(d,[cell(d,contenido,{width:9360})],1100)],[9360]));
    }
    if(documentos.length){
      const contenidoDocs=[new d.Paragraph({spacing:{after:100},children:[new d.TextRun({text:'DESCRIPCION (Pantallas, Imágenes, Documentos)',bold:true,size:18})]}),new d.Paragraph({spacing:{before:80,after:80},children:[new d.TextRun({text:'DOCUMENTOS ADJUNTOS',bold:true,size:22,color:BLUE})]})];
      for(let i=0;i<documentos.length;i++){
        const doc=documentos[i];
        contenidoDocs.push(new d.Paragraph({spacing:{before:70,after:70},bullet:{level:0},children:[new d.TextRun({text:`${safe(doc.nombre_archivo||doc.nombre)}${doc.tamano_bytes?` (${(doc.tamano_bytes/1024/1024).toFixed(2)} MB)`:''}`,bold:true,size:19,color:'1E3A8A'})]}));
      }
      contenidoDocs.push(new d.Paragraph({spacing:{before:60},children:[new d.TextRun({text:'Los archivos originales se descargan en un paquete ZIP junto con este formato.',italics:true,size:17,color:'64748B'})]}));
      children.push(pageBreak(d),table(d,[row(d,[cell(d,contenidoDocs,{width:9360})],1200)],[9360]));
    }

    children.push(pageBreak(d));
    const firmantes=Array.isArray(data.firmantes_usuarios)?data.firmantes_usuarios.filter(x=>safe(x.nombre).trim()):[];
    const totalFilas=Math.max(4,firmantes.length);
    const filasFirmas=Array.from({length:totalFilas},(_,i)=>row(d,[cell(d,firmantes[i]?.nombre||'',{width:5700}),cell(d,firmantes[i]?fmtDate(data.fecha_asignacion):'',{width:1500,align:d.AlignmentType.CENTER}),cell(d,'',{width:2160})],500));
    children.push(table(d,[row(d,[cell(d,'FIRMAS DE USUARIOS',{bold:true,width:9360,columnSpan:3,align:d.AlignmentType.CENTER})],400),row(d,[cell(d,'Nombre',{bold:true,width:5700,align:d.AlignmentType.CENTER}),cell(d,'Fecha',{bold:true,width:1500,align:d.AlignmentType.CENTER}),cell(d,'Firma',{bold:true,width:2160,align:d.AlignmentType.CENTER})],400),...filasFirmas],[5700,1500,2160]));
    children.push(new d.Paragraph({spacing:{before:700,after:120}}));
    children.push(table(d,[row(d,[cell(d,'FIRMAS DE SISTEMAS',{bold:true,width:9360,columnSpan:5,align:d.AlignmentType.CENTER})],400),row(d,[cell(d,'Nombre',{bold:true,width:3300,align:d.AlignmentType.CENTER}),cell(d,'Fecha de Recepción',{bold:true,width:1500,align:d.AlignmentType.CENTER}),cell(d,'Fecha de Aceptación',{bold:true,width:1500,align:d.AlignmentType.CENTER}),cell(d,'Fecha compromiso\nde entrega',{bold:true,width:1600,align:d.AlignmentType.CENTER}),cell(d,'Firma',{bold:true,width:1460,align:d.AlignmentType.CENTER})],500),row(d,[cell(d,'',{width:3300}),cell(d,'',{width:1500}),cell(d,'',{width:1500}),cell(d,'',{width:1600}),cell(d,'',{width:1460})],950)],[3300,1500,1500,1600,1460]));

    const footer=new d.Footer({children:[new d.Paragraph({border:{top:{style:d.BorderStyle.SINGLE,size:4,color:'A0A0A0'}},spacing:{before:70},children:[new d.TextRun({text:'Fecha de emisión: 10 abril 2024',size:14}),new d.TextRun({text:'                         Área que emite: Producto Crédito Al Consumo**                         ',size:14}),new d.TextRun({text:'Página ',size:14}),new d.TextRun({children:[d.PageNumber.CURRENT],size:14})]})]});
    const doc=new d.Document({sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:360,right:480,bottom:520,left:480}}},footers:{default:footer},children}]});
    const blob=await d.Packer.toBlob(doc);
    const base=blobName(data.numero_rqm||'Solicitud_RQM');
    saveAs(blob,`${base}.docx`);

    await descargarAdjuntosRQM(data);
  }
  window.generarWordFormatoRQM=generarWordFormatoRQM;
  window.descargarAdjuntosRQM=descargarAdjuntosRQM;
})();
