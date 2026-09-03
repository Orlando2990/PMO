/* PMO Control V3.2.50 — Cierre de Sprint
   Implementación deliberadamente aislada para no alterar navegación, cargas ni transiciones. */
(() => {
  const OWNER_EMAIL = 'p.castillo@finsus.mx';
  const MONTHS = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const PROGRESS = {BACKLOG:0, ANALISIS:20, ANÁLISIS:20, DESARROLLO:40, QA:60, UAT:80, LIBERADO:100};
  let cierresCache = [];

  const norm = v => String(v || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let pendingActionResolve=null;
  function askSprintAction({title,message,confirmText='Confirmar',tone='blue',kicker='Cierre de Sprint'}){
    const modal=document.getElementById('modal-confirmar-sprint');
    if(!modal) return Promise.resolve(false);
    document.getElementById('confirmar-sprint-titulo').textContent=title||'Confirmar acción';
    document.getElementById('confirmar-sprint-mensaje').textContent=message||'';
    document.getElementById('confirmar-sprint-kicker').textContent=kicker;
    const icon=document.getElementById('confirmar-sprint-icono');
    const btn=document.getElementById('confirmar-sprint-aceptar');
    const rose=tone==='rose';
    icon.className=`w-12 h-12 rounded-2xl ${rose?'bg-rose-50 text-rose-600':'bg-blue-50 text-blue-600'} flex items-center justify-center shrink-0`;
    icon.innerHTML=rose?'<i data-lucide="rotate-ccw" class="w-6 h-6"></i>':'<i data-lucide="calendar-check-2" class="w-6 h-6"></i>';
    btn.className=`px-5 py-3 rounded-xl ${rose?'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20':'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'} text-white font-black shadow-lg`;
    btn.textContent=confirmText;
    modal.classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
    return new Promise(resolve=>{
      pendingActionResolve=resolve;
      btn.onclick=()=>{modal.classList.add('hidden'); btn.onclick=null; pendingActionResolve=null; resolve(true);};
    });
  }
  function cancelAction(){
    document.getElementById('modal-confirmar-sprint')?.classList.add('hidden');
    if(pendingActionResolve){const r=pendingActionResolve; pendingActionResolve=null; r(false);}
  }


  function currentEmail(){
    return String(window.PMOAuth?.user?.email || document.getElementById('usuario-sesion')?.textContent || '').trim().toLowerCase();
  }
  function isOwner(){ return currentEmail() === OWNER_EMAIL; }
  function canManage(){ return window.PMOAuth?.canManage?.('dashboard') !== false; }

  function selectedSystem(){
    const el=document.getElementById('filtro-sistema-dashboard');
    if(!el?.value) return null;
    return {id:String(el.value), nombre:el.selectedOptions?.[0]?.textContent?.trim() || 'Sistema'};
  }
  function activeSprint(){
    if(typeof cats==='undefined' || !Array.isArray(cats?.sprints)) return null;
    const now=new Date();
    const name=MONTHS[now.getMonth()];
    const year=now.getFullYear();
    return cats.sprints.find(s=>norm(s.nombre)===norm(name) && Number(s.anio||0)===year) || null;
  }
  function sprintLabel(s){ return s ? `${String(s.nombre||'').trim()}${s.anio ? ' '+s.anio : ''}` : 'Sprint'; }
  function projectCurrentSprintId(p){ return String(p.sprint_actual_id || p.sprint_id || ''); }
  function projectStatus(p){ return norm(p.estatus || p.cat_estatus?.nombre || 'BACKLOG'); }
  function outOfPlan(p){ return norm(p.tipo_incorporacion)==='NO_PLANEADO' || norm(p.tipo_incorporacion)==='URGENTE'; }
  function projectProgress(p){ return PROGRESS[projectStatus(p)] ?? 0; }

  function liveSnapshot(sprint, system){
    const all=(typeof todosLosProyectos!=='undefined' ? todosLosProyectos : []);
    const items=all.filter(p =>
      String(p.sistema_id||'')===String(system.id) &&
      projectCurrentSprintId(p)===String(sprint.id) &&
      projectStatus(p)!=='CANCELADO'
    );
    const liberated=items.filter(p=>projectStatus(p)==='LIBERADO');
    const pending=items.filter(p=>projectStatus(p)!=='LIBERADO');
    const carry=items.filter(p=>String(p.sprint_id||'')!==String(sprint.id));
    const urgent=items.filter(outOfPlan);
    const avg=items.length ? Math.round(items.reduce((a,p)=>a+projectProgress(p),0)/items.length) : 0;

    const detail=items.map(p=>({
      id:String(p.id||''),
      id_req:p.id_req||'',
      nombre:p.nombre_rqm||'Sin nombre',
      estatus:p.estatus||p.cat_estatus?.nombre||'BACKLOG',
      avance:projectProgress(p),
      sprint_origen: p.cat_sprints ? sprintLabel(p.cat_sprints) : '',
      sprint_actual: p.sprint_actual ? sprintLabel(p.sprint_actual) : (p.cat_sprints ? sprintLabel(p.cat_sprints) : ''),
      tipo_incorporacion:p.tipo_incorporacion||'PLANEADO'
    }));
    const byStatus={};
    detail.forEach(x=>{const k=norm(x.estatus)||'BACKLOG';byStatus[k]=(byStatus[k]||0)+1;});
    return {
      atendidos:items.length, liberados:liberated.length, pendientes:pending.length,
      arrastres:carry.length, fuera_planeacion:urgent.length, avance:avg,
      por_estatus:byStatus, items:detail
    };
  }

  async function loadClosures(system){
    const {data,error}=await _supabase.from('pmo_sprint_cierres')
      .select('*').eq('sistema_id',String(system.id)).order('anio',{ascending:false}).order('mes_numero',{ascending:false});
    if(error){
      console.warn('Cierre de Sprint:',error.message);
      cierresCache=[];
      return {error};
    }
    cierresCache=data||[];
    return {data:cierresCache};
  }

  function kpi(label,value,classes,sub=''){
    return `<div class="rounded-2xl border p-4 ${classes}"><p class="text-[9px] font-black uppercase">${esc(label)}</p><p class="text-2xl font-black mt-1">${esc(value)}</p>${sub?`<p class="text-[10px] mt-1 opacity-75">${esc(sub)}</p>`:''}</div>`;
  }

  function historyRows(){
    if(!cierresCache.length) return `<div class="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-xs text-slate-400">Todavía no hay cierres históricos para este sistema.</div>`;
    return cierresCache.map(c=>`
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50">
        <div><p class="text-sm font-black text-slate-900">${esc(c.sprint_nombre)} ${esc(c.anio)}</p><p class="text-[11px] text-slate-400">Cerrado ${new Date(c.cerrado_en).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}</p></div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black">CERRADO</span>
          <button type="button" onclick="PMOSprintClose.view('${c.id}')" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-100">Ver cierre</button>
          ${isOwner()?`<button type="button" onclick="PMOSprintClose.reopen('${c.id}')" class="px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-xs font-black text-rose-700 hover:bg-rose-100">Reabrir Sprint</button>`:''}
        </div>
      </div>`).join('');
  }

  async function render(){
    const box=document.getElementById('cierre-sprint-contenido');
    if(!box) return;
    const system=selectedSystem();
    const context=document.getElementById('cierre-sprint-contexto');
    if(!system){
      if(context) context.textContent='Selecciona un sistema';
      box.innerHTML=`<div class="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-500">Selecciona un sistema en el filtro del Dashboard para consultar su Sprint vigente y sus cierres históricos.</div>`;
      return;
    }
    const sprint=activeSprint();
    if(context) context.textContent=system.nombre;
    if(!sprint){
      box.innerHTML=`<div class="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-700">No existe en el catálogo el Sprint correspondiente al mes y año actuales.</div>`;
      return;
    }
    const load=await loadClosures(system);
    if(load.error){
      box.innerHTML=`<div class="rounded-2xl border border-amber-100 bg-amber-50 p-5"><p class="text-sm font-black text-amber-800">Falta habilitar Cierre de Sprint en Supabase.</p><p class="text-xs text-amber-700 mt-1">Ejecuta el SQL incluido en esta versión y vuelve a cargar la página.</p></div>`;
      return;
    }
    const existing=cierresCache.find(c=>String(c.sprint_id)===String(sprint.id));
    const snap=existing?.snapshot || liveSnapshot(sprint,system);
    const label=sprintLabel(sprint);

    box.innerHTML=`
      <div class="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div class="xl:col-span-3 rounded-2xl border ${existing?'border-emerald-100 bg-emerald-50/30':'border-blue-100 bg-blue-50/30'} p-5">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p class="text-[10px] font-black uppercase tracking-wide ${existing?'text-emerald-600':'text-blue-500'}">${existing?'Sprint cerrado':'Sprint vigente'}</p>
              <h4 class="text-xl font-black text-slate-900 mt-1">${esc(label)}</h4>
              <p class="text-xs text-slate-500 mt-1">${existing?'Esta fotografía ya no cambia aunque los RQM continúen evolucionando.':'Mientras permanezca abierto, los indicadores se actualizan con la información actual.'}</p>
            </div>
            <span class="inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full ${existing?'bg-emerald-100 text-emerald-700':'bg-blue-100 text-blue-700'} text-xs font-black">${existing?'Cerrado':'En curso'}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
            ${kpi('Atendidos',snap.atendidos,'bg-white border-slate-100 text-slate-900')}
            ${kpi('Liberados',snap.liberados,'bg-white border-emerald-100 text-emerald-700')}
            ${kpi('Pendientes',snap.pendientes,'bg-white border-amber-100 text-amber-700')}
            ${kpi('Arrastres recibidos',snap.arrastres,'bg-white border-violet-100 text-violet-700')}
            ${kpi('Fuera de planeación',snap.fuera_planeacion,'bg-white border-orange-100 text-orange-700')}
            ${kpi('Avance',snap.avance+'%','bg-white border-indigo-100 text-indigo-700')}
          </div>
          <div class="flex flex-wrap gap-2 mt-5">
            <button type="button" onclick="PMOSprintClose.preview()" class="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50">${existing?'Ver cierre':'Vista previa'}</button>
            ${!existing && canManage()?`<button type="button" onclick="PMOSprintClose.closeCurrent()" class="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700">Cerrar Sprint</button>`:''}
            ${existing && isOwner()?`<button type="button" onclick="PMOSprintClose.reopen('${existing.id}')" class="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-black hover:bg-rose-100">Reabrir Sprint</button>`:''}
          </div>
        </div>
        <div class="xl:col-span-2 rounded-2xl border border-slate-200 p-5">
          <div class="flex items-center justify-between gap-3 mb-4"><div><h4 class="text-sm font-black text-slate-900">Cierres históricos</h4><p class="text-xs text-slate-400 mt-0.5">Se actualiza conforme cierres nuevos Sprints.</p></div><i data-lucide="history" class="w-5 h-5 text-slate-400"></i></div>
          <div class="space-y-2">${historyRows()}</div>
        </div>
      </div>`;
    if(window.lucide) lucide.createIcons();
  }

  function modal(snapshot,title,subtitle,closed=true){
    const m=document.getElementById('modal-cierre-sprint');
    if(!m) return;
    document.getElementById('modal-cierre-sprint-titulo').textContent=title;
    document.getElementById('modal-cierre-sprint-subtitulo').textContent=subtitle||'';

    const order=['LIBERADO','UAT','QA','DESARROLLO','ANALISIS','BACKLOG'];
    const labels={LIBERADO:'Liberados',UAT:'UAT',QA:'QA',DESARROLLO:'Desarrollo',ANALISIS:'Análisis',BACKLOG:'Backlog'};
    const tones={
      LIBERADO:{base:'bg-emerald-50 text-emerald-800',active:'ring-2 ring-emerald-300 bg-emerald-100'},
      UAT:{base:'bg-blue-50 text-blue-800',active:'ring-2 ring-blue-300 bg-blue-100'},
      QA:{base:'bg-amber-50 text-amber-800',active:'ring-2 ring-amber-300 bg-amber-100'},
      DESARROLLO:{base:'bg-violet-50 text-violet-800',active:'ring-2 ring-violet-300 bg-violet-100'},
      ANALISIS:{base:'bg-cyan-50 text-cyan-800',active:'ring-2 ring-cyan-300 bg-cyan-100'},
      BACKLOG:{base:'bg-slate-100 text-slate-700',active:'ring-2 ring-slate-300 bg-slate-200'}
    };
    const allItems=(snapshot.items||[]);
    let activeStatus='TODOS';

    const capture=document.getElementById('modal-cierre-sprint-body');
    capture.innerHTML=`<div id="pmo-cierre-captura" class="bg-white p-1">
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        ${kpi('Atendidos',snapshot.atendidos,'bg-slate-50 border-slate-100 text-slate-900','Durante el periodo')}
        ${kpi('Liberados',snapshot.liberados,'bg-emerald-50 border-emerald-100 text-emerald-800','Concluidos')}
        ${kpi('Pendientes',snapshot.pendientes,'bg-amber-50 border-amber-100 text-amber-800','Al cierre')}
        ${kpi('Arrastres recibidos',snapshot.arrastres,'bg-violet-50 border-violet-100 text-violet-800','De periodos previos')}
        ${kpi('Fuera de planeación',snapshot.fuera_planeacion,'bg-orange-50 border-orange-100 text-orange-800','Incorporados')}
        ${kpi('Avance',snapshot.avance+'%','bg-indigo-50 border-indigo-100 text-indigo-800','Al cierre')}
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-5 gap-5 mt-6">
        <div class="xl:col-span-2 rounded-2xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h4 class="font-black text-slate-900">Resultado del Sprint</h4>
            <p class="text-xs text-slate-500 mt-0.5">Estatus al momento del cierre.</p>
          </div>
          <div id="pmo-cierre-filtros-estatus" class="p-5 space-y-2.5"></div>
        </div>
        <div class="xl:col-span-3 rounded-2xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
            <div><h4 id="pmo-cierre-lista-titulo" class="font-black text-slate-900">Todos los requerimientos</h4><p id="pmo-cierre-lista-subtitulo" class="text-xs text-slate-500 mt-0.5">Requerimientos del Sprint al momento del cierre.</p></div>
            <span id="pmo-cierre-lista-conteo" class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">${allItems.length} RQM</span>
          </div>
          <div id="pmo-cierre-lista-items" class="divide-y divide-slate-100"></div>
        </div>
      </div>
      <div class="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><p class="text-xs font-black uppercase tracking-wide text-indigo-600">Resumen del cierre</p><p id="pmo-resumen-cierre-texto" class="text-sm text-slate-700 mt-1 leading-relaxed"></p></div>
          <button type="button" onclick="PMOSprintClose.copyClosureImage()" class="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black"><i data-lucide="copy" class="w-4 h-4"></i>Copiar imagen del cierre</button>
        </div>
      </div>
    </div>`;

    const summary=`El Sprint cerró con ${snapshot.atendidos} requerimientos atendidos, de los cuales ${snapshot.liberados} fueron liberados. Al cierre, ${snapshot.pendientes} permanecieron en proceso. El avance general fue de ${snapshot.avance}%.`;
    document.getElementById('pmo-resumen-cierre-texto').textContent=summary;

    const renderFilters=()=>{
      const box=document.getElementById('pmo-cierre-filtros-estatus');
      if(!box) return;
      const totalBtn=`<button type="button" data-status="TODOS" class="w-full flex items-center justify-between rounded-xl px-4 py-3 transition ${activeStatus==='TODOS'?'ring-2 ring-slate-300 bg-slate-200 text-slate-800':'bg-slate-50 text-slate-700 hover:bg-slate-100'}"><span class="text-sm font-black">Todos</span><span class="text-lg font-black">${allItems.length}</span></button>`;
      const statusButtons=order.filter(k=>(snapshot.por_estatus?.[k]||0)>0).map(k=>{
        const tone=tones[k];
        const active=activeStatus===k?` ${tone.active}`:' hover:brightness-[0.98]';
        return `<button type="button" data-status="${k}" class="w-full flex items-center justify-between rounded-xl px-4 py-3 transition ${tone.base}${active}"><span class="text-sm font-black">${labels[k]}</span><span class="text-lg font-black">${snapshot.por_estatus[k]}</span></button>`;
      }).join('');
      box.innerHTML=totalBtn+statusButtons;
      box.querySelectorAll('button[data-status]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          activeStatus=btn.dataset.status||'TODOS';
          renderFilters();
          renderList();
        });
      });
    };

    const renderList=()=>{
      const list=document.getElementById('pmo-cierre-lista-items');
      const titleEl=document.getElementById('pmo-cierre-lista-titulo');
      const subtitleEl=document.getElementById('pmo-cierre-lista-subtitulo');
      const countEl=document.getElementById('pmo-cierre-lista-conteo');
      if(!list||!titleEl||!subtitleEl||!countEl) return;

      const filtered=activeStatus==='TODOS'
        ? allItems
        : allItems.filter(x=>norm(x.estatus)===activeStatus);

      titleEl.textContent=activeStatus==='TODOS'?'Todos los requerimientos':labels[activeStatus]||activeStatus;
      subtitleEl.textContent=activeStatus==='TODOS'
        ? 'Requerimientos del Sprint al momento del cierre.'
        : `Requerimientos con estatus ${labels[activeStatus]||activeStatus}.`;
      countEl.textContent=`${filtered.length} RQM`;

      if(!filtered.length){
        list.innerHTML=`<div class="px-5 py-6 text-xs text-slate-400">No hay requerimientos para este estatus.</div>`;
        return;
      }

      list.innerHTML=filtered.map(x=>{
        const esLiberado=norm(x.estatus)==='LIBERADO';
        const destino=x.sprint_actual && x.sprint_actual!==title.replace('Cierre de Sprint · ','')
          ? `→ ${esc(x.sprint_actual)}`
          : (esLiberado?'Liberado':'Pendiente al cierre');
        return `<div class="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p class="text-xs font-black text-blue-700">${esc(x.id_req||'RQM')}</p>
            <p class="text-sm font-bold text-slate-800 mt-0.5">${esc(x.nombre)}</p>
            <p class="text-[11px] text-slate-400 mt-1">${esc(x.estatus)} · ${esc(x.avance)}% de avance</p>
          </div>
          <span class="text-[10px] font-black text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1.5 whitespace-nowrap">${destino}</span>
        </div>`;
      }).join('');
    };

    renderFilters();
    renderList();
    m.classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
  }
  async function closeCurrent(){
    const system=selectedSystem(), sprint=activeSprint();
    if(!system||!sprint) return;
    if(!canManage()){ alert('Tu acceso al Dashboard es de solo consulta.'); return; }
    const snapshot=liveSnapshot(sprint,system);
    const ok=await askSprintAction({
      title:`Cerrar ${sprintLabel(sprint)} · ${system.nombre}`,
      message:'Se guardará la fotografía del estado actual del Sprint. Los requerimientos seguirán siendo editables normalmente y esta fotografía quedará conservada.',
      confirmText:'Cerrar Sprint',
      tone:'blue'
    });
    if(!ok) return;
    const row={
      sprint_id:String(sprint.id), sprint_nombre:String(sprint.nombre||''), anio:Number(sprint.anio||new Date().getFullYear()),
      mes_numero:MONTHS.findIndex(m=>norm(m)===norm(sprint.nombre))+1,
      sistema_id:String(system.id), sistema_nombre:system.nombre, snapshot,
      cerrado_por_email:currentEmail()||null
    };
    const {error}=await _supabase.from('pmo_sprint_cierres').insert(row);
    if(error){ alert('No fue posible cerrar el Sprint: '+error.message); return; }
    await render();
  }

  async function reopen(id){
    if(!isOwner()) return;
    const closure=cierresCache.find(c=>String(c.id)===String(id));
    if(!closure) return;
    const ok=await askSprintAction({
      title:`Reabrir ${closure.sprint_nombre} ${closure.anio}`,
      message:'La fotografía guardada se eliminará y el Sprint volverá a mostrar información viva. Esta acción no genera bitácora.',
      confirmText:'Reabrir Sprint',
      tone:'rose'
    });
    if(!ok) return;
    const {error}=await _supabase.from('pmo_sprint_cierres').delete().eq('id',id);
    if(error){ alert('No fue posible reabrir el Sprint: '+error.message); return; }
    cerrarModalCierreSprint();
    await render();
  }

  function preview(){
    const system=selectedSystem(), sprint=activeSprint();
    if(!system||!sprint) return;
    const existing=cierresCache.find(c=>String(c.sprint_id)===String(sprint.id));
    const snap=existing?.snapshot || liveSnapshot(sprint,system);
    modal(snap,`Cierre de Sprint · ${sprintLabel(sprint)}`, existing?'Fotografía histórica del periodo.':'',!!existing);
  }
  function view(id){
    const c=cierresCache.find(x=>String(x.id)===String(id)); if(!c) return;
    modal(c.snapshot,`Cierre de Sprint · ${c.sprint_nombre} ${c.anio}`,`Fotografía histórica · ${c.sistema_nombre||''}`,true);
  }
  function closeModal(){ document.getElementById('modal-cierre-sprint')?.classList.add('hidden'); }
  async function copyClosureImage(){
    const target=document.getElementById('pmo-cierre-captura');
    if(!target) return;
    if(typeof html2canvas!=='function'){
      if(window.PMOAlert) await PMOAlert('No fue posible preparar la imagen del cierre.',{title:'No se pudo copiar',type:'error'});
      return;
    }
    try{
      const canvas=await html2canvas(target,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false});
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob) throw new Error('No se pudo generar la imagen.');
      if(!navigator.clipboard || typeof ClipboardItem==='undefined') throw new Error('El navegador no permite copiar imágenes al portapapeles.');
      await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
      if(window.PMOImageCopied) PMOImageCopied();
    }catch(e){
      console.error(e);
      if(window.PMOAlert) await PMOAlert(e.message||'No fue posible copiar la imagen.',{title:'No se pudo copiar',type:'error'});
    }
  }

  const oldFilter=window.filtrarDashboardPorSistema;
  if(typeof oldFilter==='function'){
    window.filtrarDashboardPorSistema=function(){ oldFilter(); setTimeout(render,0); };
  }
  window.addEventListener('load',()=>setTimeout(render,450));
  window.addEventListener('pmo:profile-ready',()=>setTimeout(render,100));

  window.PMOSprintClose={render,preview,view,closeCurrent,reopen,copyClosureImage,cancelAction};
  window.cerrarModalCierreSprint=closeModal;
})();
