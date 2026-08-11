(function(){
  function ensureDialog(){
    if(document.getElementById('pmo-confirm-dialog')) return;
    const wrap=document.createElement('div');
    wrap.id='pmo-confirm-dialog';
    wrap.className='hidden fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm p-4 flex items-center justify-center';
    wrap.innerHTML=`
      <div class="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="pmo-confirm-title">
        <div class="p-6 border-b border-slate-100 flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 grid place-items-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
          </div>
          <div class="min-w-0">
            <h3 id="pmo-confirm-title" class="text-xl font-black text-slate-950">Confirmar eliminación</h3>
            <p id="pmo-confirm-message" class="mt-2 text-sm leading-6 text-slate-600"></p>
          </div>
        </div>
        <div class="p-5 bg-slate-50 flex justify-end gap-3">
          <button id="pmo-confirm-cancel" type="button" class="px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-black">Cancelar</button>
          <button id="pmo-confirm-accept" type="button" class="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-lg shadow-rose-600/20">Sí, eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }
  window.PMOConfirm=function(message, options={}){
    ensureDialog();
    const dialog=document.getElementById('pmo-confirm-dialog');
    const title=document.getElementById('pmo-confirm-title');
    const msg=document.getElementById('pmo-confirm-message');
    const accept=document.getElementById('pmo-confirm-accept');
    const cancel=document.getElementById('pmo-confirm-cancel');
    title.textContent=options.title||'Confirmar eliminación';
    msg.textContent=message||'Esta acción no se puede deshacer.';
    accept.textContent=options.confirmText||'Sí, eliminar';
    cancel.textContent=options.cancelText||'Cancelar';
    dialog.classList.remove('hidden');
    return new Promise(resolve=>{
      let done=false;
      const finish=(value)=>{if(done)return;done=true;dialog.classList.add('hidden');accept.onclick=null;cancel.onclick=null;dialog.onclick=null;document.removeEventListener('keydown',onKey);resolve(value);};
      const onKey=(e)=>{if(e.key==='Escape')finish(false);};
      accept.onclick=()=>finish(true);
      cancel.onclick=()=>finish(false);
      dialog.onclick=(e)=>{if(e.target===dialog)finish(false);};
      document.addEventListener('keydown',onKey);
      setTimeout(()=>cancel.focus(),0);
    });
  };
})();


(function(){
  function ensureAlert(){
    if(document.getElementById('pmo-alert-dialog')) return;
    const wrap=document.createElement('div');
    wrap.id='pmo-alert-dialog';
    wrap.className='hidden fixed inset-0 z-[220] bg-slate-950/55 backdrop-blur-sm p-4 flex items-center justify-center';
    wrap.innerHTML=`<div class="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden" role="alertdialog" aria-modal="true">
      <div class="p-6 border-b border-slate-100 flex items-start gap-4">
        <div id="pmo-alert-icon" class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center shrink-0">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div class="min-w-0"><h3 id="pmo-alert-title" class="text-xl font-black text-slate-950">Operación completada</h3><p id="pmo-alert-message" class="mt-2 text-sm leading-6 text-slate-600"></p></div>
      </div>
      <div class="p-5 bg-slate-50 flex justify-end"><button id="pmo-alert-accept" type="button" class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-600/20">Aceptar</button></div>
    </div>`;
    document.body.appendChild(wrap);
  }
  window.PMOAlert=function(message,options={}){
    ensureAlert();
    const dialog=document.getElementById('pmo-alert-dialog');
    document.getElementById('pmo-alert-title').textContent=options.title||'Operación completada';
    document.getElementById('pmo-alert-message').textContent=message||'';
    const icon=document.getElementById('pmo-alert-icon');
    const error=options.type==='error';
    icon.className=`w-12 h-12 rounded-2xl ${error?'bg-rose-50 text-rose-600':'bg-emerald-50 text-emerald-600'} grid place-items-center shrink-0`;
    dialog.classList.remove('hidden');
    return new Promise(resolve=>{
      const btn=document.getElementById('pmo-alert-accept');
      const finish=()=>{dialog.classList.add('hidden');btn.onclick=null;resolve(true);};
      btn.onclick=finish; setTimeout(()=>btn.focus(),0);
    });
  };
})();
