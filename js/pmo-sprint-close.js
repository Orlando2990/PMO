/* PMO Control V3.2.83 — Cierre de Sprint
   Implementación deliberadamente aislada para no alterar navegación, cargas ni transiciones. */
(() => {
  const OWNER_EMAIL = 'p.castillo@finsus.mx';
  const MONTHS = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const PROGRESS = {BACKLOG:0, ANALISIS:20, ANÁLISIS:20, DESARROLLO:40, QA:60, UAT:80, LIBERADO:100};
  let cierresCache = [];
  const UNIFIED_ID = 'ALL';
  let closureScope = 'all'; // Filter used only for viewing, never for saving.
  let activeTab = 'actual';
  let combinedClosures = [];

  const norm = v => String(v || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let pendingActionResolve=null;
  function askSprintAction({title,message,confirmText='Confirmar',tone='blue',kicker='Cierre de Sprint'}){
    const modal=document.getElementById('modal-confirmar-sprint');
    if(!modal) return Promise.resolve(false);
    document.getElementById('confirmar-sprint-titulo').textContent=title||'Confirmar acción';
    const mensajeEl=document.getElementById('confirmar-sprint-mensaje');
    if(mensajeEl){
      mensajeEl.textContent=message||'';
      mensajeEl.classList.toggle('hidden',!message);
    }
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
  function dashboardSystems(){
    if(typeof cats==='undefined' || !Array.isArray(cats?.sistemas)) return [];
    return cats.sistemas.filter(x=>x?.id);
  }
  function scopedSystem(){
    if(closureScope==='all') return {id:'all',nombre:'Todos los sistemas'};
    const x=dashboardSystems().find(x=>String(x.id)===closureScope);
    return x?{id:String(x.id),nombre:String(x.nombre||'Sistema')}:{id:'all',nombre:'Todos los sistemas'};
  }
  function setScope(value){ closureScope=value; render(); }
  function setTab(value){ activeTab=value==='history'?'history':'actual'; render(); }
  function scopeSelector(){
    const opts=[['all','Todos los sistemas'],...dashboardSystems().map(x=>[String(x.id),String(x.nombre)])];
    return `<div class="flex flex-wrap gap-3 items-center mb-4"><label for="pmo-cierre-scope" class="text-xs font-black text-slate-600">Filtrar resultados por sistema</label><select id="pmo-cierre-scope" onchange="PMOSprintClose.setScope(this.value)" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800">${opts.map(([id,name])=>`<option value="${esc(id)}" ${closureScope===id?'selected':''}>${esc(name)}</option>`).join('')}</select></div>`;
  }
  function tabSelector(){ return `<div class="flex flex-wrap gap-2 mb-4"><button type="button" onclick="PMOSprintClose.setTab('actual')" class="px-4 py-2.5 rounded-xl text-xs font-black ${activeTab==='actual'?'bg-blue-600 text-white':'bg-slate-100 text-slate-700'}">Sprint vigente</button><button type="button" onclick="PMOSprintClose.setTab('history')" class="px-4 py-2.5 rounded-xl text-xs font-black ${activeTab==='history'?'bg-blue-600 text-white':'bg-slate-100 text-slate-700'}">Historial de cierres</button></div>`; }
  function filterSnapshot(snapshot,system){
    if(system.id==='all') return snapshot;
    const items=(snapshot?.items||[]).filter(x=>String(x.sistema_id||'')===String(system.id));
    return summaryFromItems(items);
  }
  function summaryFromItems(items){
    const por_estatus={};
    for(const x of items){const status=norm(x.estatus)||'BACKLOG';por_estatus[status]=(por_estatus[status]||0)+1;}
    const liberados=items.filter(x=>norm(x.estatus)==='LIBERADO').length;
    return {atendidos:items.length,liberados,pendientes:items.length-liberados,arrastres:items.filter(x=>x.es_arrastre===true || (x.sprint_origen && x.sprint_actual && norm(x.sprint_origen)!==norm(x.sprint_actual))).length,fuera_planeacion:items.filter(x=>norm(x.tipo_incorporacion)==='NO_PLANEADO'||norm(x.tipo_incorporacion)==='URGENTE').length,avance:items.length?Math.round(items.reduce((n,x)=>n+Number(x.avance||0),0)/items.length):0,por_estatus,items};
  }
  function mergedSnapshot(snapshots){
    const items=snapshots.flatMap(s=>Array.isArray(s?.items)?s.items:[]);
    const por_estatus={};
    for(const s of snapshots) for(const [status,count] of Object.entries(s?.por_estatus||{})) por_estatus[status]=(por_estatus[status]||0)+Number(count||0);
    const atendidos=snapshots.reduce((n,s)=>n+Number(s?.atendidos||0),0);
    return {atendidos,liberados:snapshots.reduce((n,s)=>n+Number(s?.liberados||0),0),pendientes:snapshots.reduce((n,s)=>n+Number(s?.pendientes||0),0),arrastres:snapshots.reduce((n,s)=>n+Number(s?.arrastres||0),0),fuera_planeacion:snapshots.reduce((n,s)=>n+Number(s?.fuera_planeacion||0),0),avance:atendidos?Math.round(snapshots.reduce((n,s)=>n+Number(s?.avance||0)*Number(s?.atendidos||0),0)/atendidos):0,por_estatus,items};
  }
  function allLiveSnapshot(sprint){
    const all=(typeof todosLosProyectos!=='undefined' ? todosLosProyectos : []);
    const ids=[...new Set(all.filter(p=>projectCurrentSprintId(p)===String(sprint.id)&&projectStatus(p)!=='CANCELADO').map(p=>String(p.sistema_id||'')).filter(Boolean))];
    return mergedSnapshot(ids.map(id=>liveSnapshot(sprint,{id})));
  }
  async function loadCombinedClosures(){
    const {data,error}=await _supabase.from('pmo_sprint_cierres').select('*').order('anio',{ascending:false}).order('mes_numero',{ascending:false});
    if(error) return {error};
    combinedClosures=data||[];
    return {data:combinedClosures};
  }
  function consolidatedHistory(){
    const groups=new Map();
    for(const c of combinedClosures){
      const key=String(c.sprint_id);
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(c);
    }
    if(!groups.size) return '<p class="text-xs text-slate-400">Todavía no hay cierres históricos.</p>';
    return [...groups.values()].map(group=>{
      const first=group[0];
      const unified=group.find(x=>String(x.sistema_id)===UNIFIED_ID && !x.reabierto);
      const legacy=group.filter(x=>String(x.sistema_id)!==UNIFIED_ID && !x.reabierto);
      const snap=unified?.snapshot || mergedSnapshot(legacy.map(x=>x.snapshot||{}));
      const status=unified?'Cierre mensual único':`Histórico anterior · ${legacy.length} sistema(s)`;
      return `<div class="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-wrap justify-between gap-2 items-center"><div><p class="text-sm font-black">${esc(first.sprint_nombre)} ${esc(first.anio)}</p><p class="text-[11px] text-slate-500">${esc(status)} · ${snap.atendidos} RQM</p></div><button type="button" onclick="PMOSprintClose.viewCombined('${esc(String(first.sprint_id))}')" class="border border-slate-200 rounded-lg bg-white px-3 py-2 text-xs font-black">Ver fotografía</button></div>`;
    }).join('');
  }
  function viewCombined(sprintId){
    const rows=combinedClosures.filter(x=>String(x.sprint_id)===String(sprintId)&&!x.reabierto);
    const unified=rows.find(x=>String(x.sistema_id)===UNIFIED_ID);
    const legacy=rows.filter(x=>String(x.sistema_id)!==UNIFIED_ID);
    if(!unified && !legacy.length) return;
    const src=unified||legacy[0];
    const snap=unified?.snapshot||mergedSnapshot(legacy.map(x=>x.snapshot||{}));
    const filter=scopedSystem();
    if(filter.id!=='all' && unified && !(snap.items||[]).every(x=>x.sistema_id)){
      alert('Esta fotografía anterior no incluye la identificación por sistema en todos sus registros. Selecciona Todos los sistemas para consultarla completa.');return;
    }
    const view=filter.id==='all'?snap:unified?filterSnapshot(snap,filter):mergedSnapshot(legacy.filter(x=>String(x.sistema_id)===String(filter.id)).map(x=>x.snapshot||{}));
    modal(view,`Cierre de Sprint · ${src.sprint_nombre} ${src.anio}`,unified?'Fotografía mensual única · vista histórica':'Histórico anterior por sistema · sin alterar',true);
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
      tipo_incorporacion:p.tipo_incorporacion||'PLANEADO',
      sistema_id:String(p.sistema_id||''),
      sistema_nombre:p.cat_sistemas?.nombre || p.sistema || '',
      es_arrastre:String(p.sprint_id||'')!==String(sprint.id)
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
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border ${c.reabierto?'border-amber-100 bg-amber-50/50':'border-slate-100 bg-slate-50'}">
        <div><p class="text-sm font-black text-slate-900">${esc(c.sprint_nombre)} ${esc(c.anio)}</p><p class="text-[11px] text-slate-400">${c.reabierto?'Reabierto · fotografía anterior conservada':'Cerrado '+new Date(c.cerrado_en).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}</p></div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2.5 py-1 rounded-full ${c.reabierto?'bg-amber-100 text-amber-700':'bg-emerald-50 text-emerald-700'} text-[10px] font-black">${c.reabierto?'REABIERTO':'CERRADO'}</span>
          <button type="button" onclick="PMOSprintClose.view('${c.id}')" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-100">Ver fotografía</button>
          ${c.reabierto && isOwner()?`<button type="button" onclick="PMOSprintClose.reclose('${c.id}')" class="px-3 py-2 rounded-xl bg-blue-600 text-xs font-black text-white hover:bg-blue-700">Cerrar nuevamente</button>`:''}
          ${!c.reabierto && isOwner()?`<button type="button" onclick="PMOSprintClose.reopen('${c.id}')" class="px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-xs font-black text-rose-700 hover:bg-rose-100">Reabrir Sprint</button>`:''}
        </div>
      </div>`).join('');
  }

  async function render(){
    const box=document.getElementById('cierre-sprint-contenido');
    if(!box) return;
    const context=document.getElementById('cierre-sprint-contexto');
    if(context) context.textContent='CIERRE MENSUAL';
    const sprint=activeSprint();
    if(!sprint){box.innerHTML='<div class="p-5 text-sm text-amber-700">No se encontró el sprint correspondiente al mes actual.</div>';return;}
    const load=await loadCombinedClosures();
    if(load.error){box.innerHTML=`<div class="p-5 text-rose-700">No se pudo consultar el historial: ${esc(load.error.message)}</div>`;return;}
    const system=scopedSystem();
    const unified=combinedClosures.find(x=>String(x.sprint_id)===String(sprint.id)&&String(x.sistema_id)===UNIFIED_ID&&!x.reabierto);
    const previous=combinedClosures.find(x=>String(x.sprint_id)===String(sprint.id)&&String(x.sistema_id)===UNIFIED_ID&&x.reabierto);
    const raw=unified?.snapshot || previous?.snapshot || allLiveSnapshot(sprint);
    const snapshot=system.id==='all'?raw:unified||previous?filterSnapshot(raw,system):liveSnapshot(sprint,system);
    const tabs=tabSelector()+scopeSelector();
    if(activeTab==='history'){
      box.innerHTML=tabs+`<div class="rounded-2xl border border-slate-200 p-5"><h4 class="font-black text-slate-900 mb-2">Fotografías de sprints anteriores</h4><p class="text-xs text-slate-500 mb-4">Los cierres anteriores por sistema se conservan y se muestran como históricos heredados. No se suman dos veces con un cierre mensual único.</p><div class="space-y-2">${consolidatedHistory()}</div></div>`;
    } else {
      box.innerHTML=tabs+`<div class="rounded-2xl border ${unified?'border-emerald-100 bg-emerald-50/20':'border-blue-100 bg-blue-50/20'} p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-[10px] uppercase font-black ${unified?'text-emerald-700':'text-blue-600'}">${unified?'Sprint cerrado · fotografía guardada':previous?'Sprint reabierto · fotografía preservada':'Sprint vigente · información actual'}</p><h4 class="text-xl font-black mt-1">${esc(sprintLabel(sprint))}</h4><p class="text-xs text-slate-500 mt-1">${esc(system.nombre)} · un único cierre mensual para todos los sistemas</p></div><span class="text-xs font-black px-3 py-1 rounded-full ${unified?'bg-emerald-100 text-emerald-700':'bg-blue-100 text-blue-700'}">${unified?'CERRADO':previous?'REABIERTO':'EN CURSO'}</span></div><div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">${kpi('Atendidos',snapshot.atendidos,'bg-white border-slate-100')}${kpi('Liberados',snapshot.liberados,'bg-white border-emerald-100')}${kpi('Pendientes',snapshot.pendientes,'bg-white border-amber-100')}${kpi('Arrastres recibidos',snapshot.arrastres,'bg-white border-violet-100')}${kpi('Fuera de planeación',snapshot.fuera_planeacion,'bg-white border-orange-100')}${kpi('Avance',snapshot.avance+'%','bg-white border-indigo-100')}</div><div class="flex flex-wrap gap-2 mt-5"><button type="button" onclick="PMOSprintClose.preview()" class="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-black">${unified?'Ver fotografía':'Vista previa'}</button>${!unified&&!previous&&canManage()?'<button type="button" onclick="PMOSprintClose.closeCurrent()" class="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">Cerrar Sprint</button>':''}${unified&&isOwner()?`<button type="button" onclick="PMOSprintClose.reopen('${unified.id}')" class="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 text-xs font-black">Reabrir Sprint</button>`:''}${previous&&isOwner()?`<button type="button" onclick="PMOSprintClose.reclose('${previous.id}')" class="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">Cerrar nuevamente</button>`:''}</div><p class="text-xs text-slate-500 mt-4">El filtro por sistema solo cambia la consulta. El cierre guarda todos los sistemas juntos y no modifica fotografías anteriores.</p></div>`;
    }
    if(window.lucide)lucide.createIcons();
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
        const esArrastre=Boolean(x.sprint_origen && x.sprint_actual && norm(x.sprint_origen)!==norm(x.sprint_actual));
        const esFuera=norm(x.tipo_incorporacion)==='NO_PLANEADO' || norm(x.tipo_incorporacion)==='URGENTE';
        const marcas=`${esArrastre?'<span title="Arrastre de Sprint anterior" class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 text-violet-700 text-[10px] font-black"><i data-lucide="arrow-right-left" class="w-3.5 h-3.5"></i> Arrastre</span>':''}${esFuera?'<span title="Fuera de planeación" class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-[10px] font-black"><i data-lucide="flame" class="w-3.5 h-3.5"></i> Fuera de planeación</span>':''}`;
        return `<div class="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap"><p class="text-xs font-black text-blue-700">${esc(x.id_req||'RQM')}</p>${marcas}</div>
            <p class="text-sm font-bold text-slate-800 mt-0.5">${esc(x.nombre)}</p>
            <p class="text-[11px] text-slate-400 mt-1">${esc(x.estatus)} · ${esc(x.avance)}% de avance</p>
          </div>
          <span class="text-[10px] font-black text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1.5 whitespace-nowrap">${destino}</span>
        </div>`;
      }).join('');
      if(window.lucide) lucide.createIcons();
    };

    renderFilters();
    renderList();
    m.classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
  }
  async function closeCurrent(){
    const sprint=activeSprint();
    if(!sprint) return;
    if(!canManage()){alert('Tu acceso al Dashboard es de solo consulta.');return;}
    const load=await loadCombinedClosures();
    if(load.error){alert('No fue posible verificar cierres existentes: '+load.error.message);return;}
    if(combinedClosures.some(x=>String(x.sprint_id)===String(sprint.id)&&String(x.sistema_id)===UNIFIED_ID)){
      alert('Ya existe una fotografía mensual de este Sprint. Para conservarla utiliza la opción de reapertura.');return;
    }
    const snapshot=allLiveSnapshot(sprint);
    const ok=await askSprintAction({title:`Cerrar ${sprintLabel(sprint)} · Todos los sistemas`,message:`Se guardará una sola fotografía mensual que incluye ${snapshot.atendidos} requerimientos de todos los sistemas. No se modificarán cierres históricos anteriores.`,confirmText:'Cerrar Sprint'});
    if(!ok)return;
    const row={sprint_id:String(sprint.id),sprint_nombre:String(sprint.nombre||''),anio:Number(sprint.anio||new Date().getFullYear()),mes_numero:MONTHS.findIndex(m=>norm(m)===norm(sprint.nombre))+1,sistema_id:UNIFIED_ID,sistema_nombre:'Todos los sistemas',snapshot,cerrado_por_email:currentEmail()||null};
    const {error}=await _supabase.from('pmo_sprint_cierres').insert(row);
    if(error){alert('No fue posible cerrar el Sprint: '+error.message);return;}
    await render();
  }

  async function reopen(id){
    if(!isOwner()) return;
    const closure=combinedClosures.find(c=>String(c.id)===String(id)&&String(c.sistema_id)===UNIFIED_ID);
    if(!closure) return;
    const ok=await askSprintAction({
      title:`Reabrir ${closure.sprint_nombre} ${closure.anio}`,
      message:'',
      confirmText:'Reabrir Sprint',
      tone:'rose'
    });
    if(!ok) return;
    const {error}=await _supabase.from('pmo_sprint_cierres').update({
      reabierto:true,
      reabierto_en:new Date().toISOString(),
      reabierto_por_email:currentEmail()||null
    }).eq('id',id);
    if(error){ alert('No fue posible reabrir el Sprint: '+error.message); return; }
    cerrarModalCierreSprint();
    await render();
  }

  async function reclose(id){
    if(!isOwner()) return;
    const closure=combinedClosures.find(c=>String(c.id)===String(id)&&String(c.sistema_id)===UNIFIED_ID);
    if(!closure) return;
    const sprint=(cats?.sprints||[]).find(s=>String(s.id)===String(closure.sprint_id));
    if(!sprint) return;
    // La fotografía histórica es inmutable en un recierre administrativo.
    // Los requerimientos arrastrados a otro Sprint no deben desaparecer del cierre original.
    const ok=await askSprintAction({
      title:`Cerrar nuevamente ${closure.sprint_nombre} ${closure.anio}`,
      message:'Se cerrará nuevamente el Sprint conservando exactamente su fotografía histórica. No se recalculará con los requerimientos actuales.',
      confirmText:'Cerrar nuevamente',
      tone:'blue'
    });
    if(!ok) return;
    const {error}=await _supabase.from('pmo_sprint_cierres').update({
      reabierto:false, cerrado_por_email:currentEmail()||null,
      reabierto_en:null, reabierto_por_email:null
    }).eq('id',id);
    if(error){ alert('No fue posible cerrar nuevamente el Sprint: '+error.message); return; }
    await render();
  }

  function preview(){
    const sprint=activeSprint();if(!sprint)return;
    const unified=combinedClosures.find(x=>String(x.sprint_id)===String(sprint.id)&&String(x.sistema_id)===UNIFIED_ID&&!x.reabierto);
    const previous=combinedClosures.find(x=>String(x.sprint_id)===String(sprint.id)&&String(x.sistema_id)===UNIFIED_ID&&x.reabierto);
    const sys=scopedSystem();
    const raw=unified?.snapshot||previous?.snapshot||allLiveSnapshot(sprint);
    const snap=sys.id==='all'?raw:unified||previous?filterSnapshot(raw,sys):liveSnapshot(sprint,sys);
    modal(snap,`Cierre de Sprint · ${sprintLabel(sprint)}`,`${sys.nombre} · ${unified?'fotografía mensual guardada':previous?'fotografía anterior · reabierto':'vista previa'}`,!!unified);
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

  window.PMOSprintClose={render,preview,view,viewCombined,setScope,setTab,closeCurrent,reopen,reclose,copyClosureImage,cancelAction};
  window.cerrarModalCierreSprint=closeModal;
})();
