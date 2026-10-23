/* Órbita Kanban v3.3.30: únicamente lectura. Reutiliza los mismos proyectos y filtros de la Matriz. */
(function(){
'use strict';
const stages=[['ANALISIS','Análisis','#8b5cf6'],['DESARROLLO','Desarrollo','#2563eb'],['QA','QA','#d97706'],['UAT','UAT','#0891b2'],['LIBERADO','Liberado','#16a34a']];
let current=[], view='matriz';
const expandedPanels={BACKLOG:false,CANCELADO:false};
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'BACKLOG').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const status=v=>{const s=norm(v);return s==='PRODUCCION'?'LIBERADO':s};
window.cambiarVistaOrbita=function(next){
 if(!['matriz','kanban'].includes(next))return;
 view=next;
 const table=document.getElementById('orbita-matriz-table'), kanban=document.getElementById('orbita-kanban-panel');
 if(!table||!kanban)return;
 table.hidden=next!=='matriz';kanban.hidden=next!=='kanban';
 for(const v of ['matriz','kanban']){const b=document.getElementById('orbita-view-'+v);if(b){b.classList.toggle('active',v===next);b.setAttribute('aria-pressed',String(v===next));}}
 if(next==='kanban'){window.orbitaRenderKanban(current);}
};
window.orbitaRenderKanban=function(projects){
 current=Array.isArray(projects)?projects:[];
 const host=document.getElementById('orbita-kanban-panel');if(!host)return;
 const buckets={BACKLOG:current.filter(p=>status(p.estatus)==='BACKLOG'),CANCELADO:current.filter(p=>status(p.estatus)==='CANCELADO')};
 const unknown=current.filter(p=>!['BACKLOG','CANCELADO',...stages.map(s=>s[0])].includes(status(p.estatus))).length;
 const renderCard=p=>{const pr=norm(p.prioridad),pc=pr==='ALTA'?'alta':pr==='URGENTE'?'urgente':'';
  return `<button type="button" class="orbita-kanban-card" data-orbita-kanban-id="${escapeHTML(p.id)}" title="Consultar requerimiento"><div class="orbita-kanban-folio">${escapeHTML(p.id_req||'Sin folio')}</div><div class="orbita-kanban-name">${escapeHTML(p.nombre_rqm||'Sin nombre')}</div><div class="orbita-kanban-meta">${escapeHTML(p.cat_sistemas?.nombre||p.sistema||'Sin sistema')}</div><div class="orbita-kanban-meta">${escapeHTML(p.asignado_a||p.responsable_sistemas||'Sin responsable')}</div><span class="orbita-kanban-priority ${pc}">${escapeHTML(p.prioridad||'Sin prioridad')}</span></button>`;
 };
 let html='<div class="orbita-kanban-head"><div><h2 class="orbita-kanban-title">Tablero de requerimientos</h2></div></div>';
 html+='<div class="orbita-kanban-drawers">';
 for(const [key,label,color] of [['BACKLOG','Backlog','#64748b'],['CANCELADO','Cancelados','#ef4444']]){
  const open=expandedPanels[key],items=buckets[key];
  html+=`<section class="orbita-kanban-drawer"><button type="button" class="orbita-kanban-drawer-toggle" data-orbita-drawer="${key}" aria-expanded="${open}" aria-controls="orbita-drawer-${key}"><span class="orbita-kanban-dot" style="background:${color}"></span><span>${label}</span><span class="orbita-kanban-num">${items.length}</span><span class="orbita-kanban-chevron" aria-hidden="true">${open?'▴':'▾'}</span></button><div id="orbita-drawer-${key}" class="orbita-kanban-drawer-content" ${open?'':'hidden'}>`;
  if(!items.length)html+='<p class="orbita-kanban-empty">Sin requerimientos en esta etapa</p>';
  else html+=`<div class="orbita-kanban-drawer-cards">${items.map(renderCard).join('')}</div>`;
  html+='</div></section>';
 }
 html+='</div><div class="orbita-kanban-track">';
 for(const [key,label,color] of stages){
  const items=current.filter(p=>status(p.estatus)===key);
  html+=`<section class="orbita-kanban-column"><header class="orbita-kanban-colhead"><span class="orbita-kanban-dot" style="background:${color}"></span>${label}<span class="orbita-kanban-num">${items.length}</span></header><div class="orbita-kanban-stack">`;
  if(!items.length)html+='<p class="orbita-kanban-empty">Sin requerimientos en esta etapa</p>';
  html+=items.map(renderCard).join('');
  html+='</div></section>';
 }
 html+='</div>';
 if(unknown)html+=`<p class="orbita-kanban-other">${unknown} requerimiento(s) con estatus distinto de las etapas configuradas. Consúltalos en la Matriz.</p>`;
 host.innerHTML=html;
 host.querySelectorAll('[data-orbita-drawer]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.orbitaDrawer;expandedPanels[key]=!expandedPanels[key];window.orbitaRenderKanban(current)}));
 host.querySelectorAll('[data-orbita-kanban-id]').forEach(b=>b.addEventListener('click',()=>window.orbitaMostrarDetalleKanban(b.dataset.orbitaKanbanId)));
};
window.orbitaMostrarDetalleKanban=function(id){
 const p=current.find(r=>String(r.id)===String(id));if(!p)return;
 const fields=[['Folio',p.id_req],['Estatus',p.estatus],['Sistema',p.cat_sistemas?.nombre||p.sistema],['Prioridad',p.prioridad],['Responsable',p.asignado_a||p.responsable_sistemas],['Solicitante',p.solicitante],['Fecha de ingreso',p.fecha_ingreso_pmo],['Fecha de liberación',p.fecha_liberacion_prod||p.fecha_liberacion],['Descripción',p.descripcion],['Comentarios',p.comentarios]];
 const old=document.getElementById('orbita-kanban-modal');if(old)old.remove();
 const layer=document.createElement('div');layer.id='orbita-kanban-modal';layer.className='orbita-kanban-detail-backdrop';layer.innerHTML=`<div class="orbita-kanban-detail" role="dialog" aria-modal="true" aria-label="Detalle de requerimiento"><div style="display:flex;justify-content:space-between;align-items:start;gap:15px"><div><div class="orbita-kanban-folio">${escapeHTML(p.id_req||'Sin folio')}</div><h2 style="font-size:21px;font-weight:900;color:#0f172a;margin-top:6px">${escapeHTML(p.nombre_rqm||'Requerimiento')}</h2></div><button type="button" class="orbita-kanban-close" data-close-kanban aria-label="Cerrar">✕</button></div><div class="orbita-kanban-detail-grid">${fields.map(([k,v])=>`<div class="orbita-kanban-detail-field"><div class="orbita-kanban-detail-label">${k}</div><div class="orbita-kanban-detail-value">${escapeHTML(v||'—')}</div></div>`).join('')}</div></div>`;
 layer.addEventListener('click',e=>{if(e.target===layer||e.target.closest('[data-close-kanban]'))layer.remove()});
 document.body.appendChild(layer);layer.querySelector('[data-close-kanban]').focus();
};
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('orbita-kanban-modal')?.remove()});
})();
