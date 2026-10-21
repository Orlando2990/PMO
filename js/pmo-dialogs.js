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

    const iconBox=dialog.querySelector('.w-12.h-12.rounded-2xl');
    const variant=options.variant||'danger';
    if(variant==='violet'){
      if(iconBox){
        iconBox.className='w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 grid place-items-center shrink-0';
        iconBox.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10V3L4 6"/><path d="M7 3l3 3"/><path d="M17 14v7l-3-3"/><path d="M17 21l3-3"/></svg>';
      }
      accept.className='px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black shadow-lg shadow-violet-600/20';
    }else{
      if(iconBox){
        iconBox.className='w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 grid place-items-center shrink-0';
        iconBox.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>';
      }
      accept.className='px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-lg shadow-rose-600/20';
    }
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
    document.getElementById('pmo-alert-title').textContent=options.title||(options.type==='error'?'No se pudo completar la operación':options.type==='info'?'Información':'Operación completada');
    document.getElementById('pmo-alert-message').textContent=message||'';
    const icon=document.getElementById('pmo-alert-icon');
    const type=options.type||'success';
    if(type==='error'){
      icon.className='w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 grid place-items-center shrink-0';
      icon.innerHTML='<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/></svg>';
    }else if(type==='info'){
      icon.className='w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center shrink-0';
      icon.innerHTML='<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
    }else{
      icon.className='w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center shrink-0';
      icon.innerHTML='<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    }
    dialog.classList.remove('hidden');
    return new Promise(resolve=>{
      const btn=document.getElementById('pmo-alert-accept');
      const finish=()=>{dialog.classList.add('hidden');btn.onclick=null;resolve(true);};
      btn.onclick=finish; setTimeout(()=>btn.focus(),0);
    });
  };
})();


(function(){
  let timer=null;
  function ensureImageCopied(){
    if(document.getElementById('pmo-image-copied')) return;
    const wrap=document.createElement('div');
    wrap.id='pmo-image-copied';
    wrap.className='hidden fixed inset-0 z-[240] bg-slate-950/45 backdrop-blur-sm p-4 flex items-center justify-center';
    wrap.innerHTML=`
      <div class="w-full max-w-sm rounded-3xl bg-white border border-slate-200 shadow-2xl px-7 py-8 text-center" role="status" aria-live="polite">
        <div class="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>
        </div>
        <div class="mt-5 text-xl font-black text-slate-950">Imagen copiada</div>
      </div>`;
    document.body.appendChild(wrap);
  }
  window.PMOImageCopied=function(){
    ensureImageCopied();
    const dialog=document.getElementById('pmo-image-copied');
    dialog.classList.remove('hidden');
    clearTimeout(timer);
    timer=setTimeout(()=>dialog.classList.add('hidden'),1300);
  };
})();
