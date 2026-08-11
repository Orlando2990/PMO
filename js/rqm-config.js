(function(){
  const CLAVE='formato_descarga_rqm';
  const STORAGE='pmo_formato_descarga_rqm';
  let formato='word';

  function normalizar(v){
    const x=String(v||'').trim().toLowerCase();
    return x==='pdf'?'pdf':'word';
  }
  function leerLocal(){
    try{return normalizar(localStorage.getItem(STORAGE)||'word');}catch(_){return 'word';}
  }
  function guardarLocal(v){
    try{localStorage.setItem(STORAGE,normalizar(v));}catch(_){}
  }
  async function cargar(client){
    formato=leerLocal();
    if(!client) return formato;
    try{
      const {data,error}=await client.from('pmo_configuracion').select('valor').eq('clave',CLAVE).maybeSingle();
      if(!error && data?.valor){
        formato=normalizar(data.valor.formato||data.valor);
        guardarLocal(formato);
      }
    }catch(e){ console.warn('Configuración de formato RQM no disponible; se usará la preferencia local.',e); }
    return formato;
  }
  async function guardar(client,v){
    formato=normalizar(v); guardarLocal(formato);
    if(!client) return {formato,remoto:false};
    const {error}=await client.from('pmo_configuracion').upsert({clave:CLAVE,valor:{formato},actualizado_en:new Date().toISOString()},{onConflict:'clave'});
    if(error) throw error;
    return {formato,remoto:true};
  }
  function obtener(){return formato;}
  function etiqueta(){return formato==='pdf'?'PDF':'Word';}
  function extension(){return formato==='pdf'?'.pdf':'.docx';}

  window.PMORQMConfig={cargar,guardar,obtener,etiqueta,extension,normalizar,CLAVE};
})();
