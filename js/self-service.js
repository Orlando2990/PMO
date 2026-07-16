const SUPABASE_URL = "https://cogiyoslnmtnnvnohoht.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ2l5b3Nsbm10bm52bm9ob2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDI5NDQsImV4cCI6MjA5NjY3ODk0NH0.sikG94OCbALSbHRN8-jc2W_QOgP15qXn4VwsqhOK7lM";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioActual = null;
let sistemas = [];
let misSolicitudes = [];
let imagenesSeleccionadas = [];
let requerimientosBase = [];
let catalogosSS = { tipos: [], prioridades: [], complejidades: [], areasImpactadas: [], dependencias: [] };
let solicitudEditandoId = null;
let solicitudEditandoIndice = null;

function esc(v){ return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function hoyISO(){ return new Date().toISOString().slice(0,10); }
function fmtFecha(v){ if(!v) return '—'; const [y,m,d] = String(v).slice(0,10).split('-'); return d && m && y ? `${d}/${m}/${y}` : v; }
function normalizar(v){ return String(v || '').trim().toUpperCase(); }
function scrollToSection(id){ document.getElementById(id)?.scrollIntoView({behavior:'smooth', block:'start'}); }
function togglePanel(id, forceOpen){
  const el = document.getElementById(id);
  if(!el) return;
  if(forceOpen === true) el.classList.remove('collapsed');
  else el.classList.toggle('collapsed');
  el.scrollIntoView({behavior:'smooth', block:'start'});
  if(window.lucide) lucide.createIcons();
}

async function verificarSesion(){
  const auth = await window.PMOAuth?.guardPage?.();
  if(auth?.user) return auth.user;
  const { data:{ session }, error } = await _supabase.auth.getSession();
  if(error || !session){ window.location.href = 'login.html'; return null; }
  return session.user;
}
async function cerrarSesion(){ await _supabase.auth.signOut(); window.location.href='login.html'; }
function pintarUsuario(user){
  const p=window.PMOAuth?.profile;
  const usuarioEl=document.getElementById('usuario-sesion');
  if(usuarioEl) usuarioEl.textContent=p?.nombre || p?.correo || user?.email || 'Usuario';
  const rolEl=document.getElementById('rol-sesion');
  if(rolEl) rolEl.textContent=window.PMOAuth?.roleLabel?.(p?.rol) || p?.rol || 'Usuario';
  const links=document.getElementById('pmo-role-links');
  if(links && ['pmo','administrador'].includes(p?.rol)){
    links.innerHTML=`<button onclick="window.location.href='index.html'" class="user-nav-btn"><i data-lucide="layout-dashboard" class="w-4 h-4"></i>Ir a PMO Control</button>`;
  }
}

async function cargarCatalogos(){
  const consultas = await Promise.all([
    _supabase.from('cat_sistemas').select('*').order('nombre'),
    _supabase.from('cat_clasificaciones').select('*').order('nombre'),
    _supabase.from('cat_prioridades').select('*').order('orden').order('nombre'),
    _supabase.from('cat_complejidades').select('*').order('orden').order('nombre'),
    _supabase.from('cat_areas_impactadas').select('*').order('orden').order('nombre'),
    _supabase.from('cat_dependencias_produccion').select('*').order('orden').order('nombre')
  ]);
  const error = consultas.find(x => x.error)?.error;
  if(error){ alert('No se pudieron cargar los catálogos del formulario: ' + error.message); return; }
  sistemas = consultas[0].data || [];
  catalogosSS.tipos = consultas[1].data || [];
  catalogosSS.prioridades = consultas[2].data || [];
  catalogosSS.complejidades = consultas[3].data || [];
  catalogosSS.areasImpactadas = consultas[4].data || [];
  catalogosSS.dependencias = consultas[5].data || [];

  const checks = (items, name, defaultName='') => items.map((item,i) => `<label class="check-option"><input type="checkbox" name="${name}" value="${esc(item.nombre)}" ${(defaultName ? normalizar(item.nombre)===normalizar(defaultName) : i===0)?'checked':''}>${esc(item.nombre)}</label>`).join('');
  document.getElementById('ss-sistemas-checks').innerHTML = sistemas.map((sis, i) => `<label class="check-option"><input type="checkbox" name="ss-sistema-check" value="${esc(sis.id)}" data-nombre="${esc(sis.nombre)}" ${i===0?'checked':''}>${esc(sis.nombre)}</label>`).join('') + `<label class="check-option"><input type="checkbox" name="ss-sistema-check" value="OTRO" data-nombre="OTRO">Otro</label>`;
  document.getElementById('ss-tipos-checks').innerHTML = checks(catalogosSS.tipos,'ss-tipo','Proyecto');
  document.getElementById('ss-prioridades-checks').innerHTML = checks(catalogosSS.prioridades,'ss-prioridad','Mediana');
  document.getElementById('ss-complejidades-checks').innerHTML = checks(catalogosSS.complejidades,'ss-complejidad','Mediana');
  document.getElementById('ss-areas-impactadas-checks').innerHTML = checks(catalogosSS.areasImpactadas,'ss-area-impactada','') + `<label class="check-option"><input type="checkbox" id="ss-area-otro-check" name="ss-area-impactada" value="Otro">Otro</label>`;
  document.getElementById('ss-dependencias-checks').innerHTML = checks(catalogosSS.dependencias,'ss-dependencia','') + `<label class="check-option"><input type="checkbox" id="ss-dep-otro-check" name="ss-dependencia" value="Otros">Otros</label>`;
  activarGruposUnicos();
  configurarCamposOtro();
}

async function cargarRequerimientosBase(){
  const {data,error}=await _supabase.from('rqm_control_requerimientos')
    .select('id,numero_rqm,proyecto,sistema_id,sistema_nombre,estatus,tipo_registro')
    .or('tipo_registro.is.null,tipo_registro.eq.REQUERIMIENTO')
    .order('numero_rqm',{ascending:true});
  if(error){ console.error('No se pudieron cargar los RQM base',error); return; }
  requerimientosBase=(data||[]).filter(r=>/^RQM\s+\d+\s+\d+$/i.test(String(r.numero_rqm||'').trim()));
  const sel=document.getElementById('ss-adendum-padre');
  if(sel) sel.innerHTML='<option value="">Selecciona el requerimiento original</option>'+requerimientosBase.map(r=>`<option value="${esc(r.id)}">${esc(r.numero_rqm)} · ${esc(r.proyecto)}</option>`).join('');
}

function getClaseRegistro(){ return valorCheckUnico('ss-clase-registro','REQUERIMIENTO'); }
function actualizarTipoRegistroUI(){
  const esAdendum=getClaseRegistro()==='ADENDUM';
  document.getElementById('ss-adendum-padre-wrap')?.classList.toggle('hidden',!esAdendum);
  const padre=document.getElementById('ss-adendum-padre'); if(padre) padre.required=esAdendum;
  document.getElementById('folio-preview').textContent=esAdendum?'Adendum pendiente':'Folio pendiente';
}

function getSistemaSeleccionado(){
  const check = document.querySelector('input[name="ss-sistema-check"]:checked');
  if(!check) return { id:null, nombre:'' };
  if(check.value === 'OTRO') return { id:null, nombre:document.getElementById('ss-sistema-otro')?.value.trim() || 'Otro' };
  return { id:check.value, nombre:check.dataset.nombre || '' };
}

function parseNumeroRQM(numero){
  const digits = String(numero || '').replace(/\D/g, '');
  if(!digits) return 0;
  return parseInt(digits, 10) || 0;
}
function formatNumeroRQM(n){
  const padded = String(n).padStart(4, '0');
  return `RQM ${padded.slice(0,2)} ${padded.slice(2)}`;
}

async function obtenerSiguienteRQM(sistema){
  let query = _supabase
    .from('rqm_control_requerimientos')
    .select('numero_rqm,sistema_id,sistema_nombre')
    .not('numero_rqm','is',null)
    .limit(1000);
  if(sistema.id) query = query.eq('sistema_id', sistema.id);
  else query = query.eq('sistema_nombre', sistema.nombre);
  const { data, error } = await query;
  if(error) throw error;
  const max = (data || []).reduce((acc, r) => Math.max(acc, parseNumeroRQM(r.numero_rqm)), 0);
  return formatNumeroRQM(max + 1);
}

function mapEstatusUsuario(e){
  const n = normalizar(e);
  if(n === 'CONVERTIDO A PMO') return 'APROBADA PMO';
  if(n === 'REGISTRADO' || n === 'NUEVO' || n === 'ENVIADA') return 'EN REVISIÓN PMO';
  if(n.includes('AJUSTE')) return 'REQUIERE AJUSTE';
  if(n === 'DESARROLLO') return 'EN DESARROLLO';
  if(n === 'QA') return 'EN QA';
  if(n === 'UAT') return 'EN UAT';
  if(n === 'LIBERADO') return 'LIBERADA';
  if(n === 'CANCELADO' || n === 'RECHAZADO') return n;
  return e || 'ENVIADA';
}
function badgeClass(e){
  const n = normalizar(mapEstatusUsuario(e));
  if(n.includes('AJUSTE')) return 'bg-amber-50 text-amber-700 border-amber-100';
  if(n.includes('APROBADA')) return 'bg-blue-50 text-blue-700 border-blue-100';
  if(n.includes('LIBERADA')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if(n.includes('RECHAZADO') || n.includes('CANCELADO')) return 'bg-rose-50 text-rose-700 border-rose-100';
  return 'bg-slate-50 text-slate-700 border-slate-100';
}

function extraerComentarioPMO(observaciones){
  const txt = String(observaciones || '');
  const m = txt.match(/(?:COMENTARIO PMO|Comentario PMO|PMO):\s*([\s\S]*)$/i);
  if(m) return m[1].trim();
  const m2 = txt.match(/(?:REQUIERE AJUSTE|RECHAZADO|APROBADO)[\s\S]*?-\s*([\s\S]*)$/i);
  return m2 ? m2[1].trim() : '';
}

function valorObservacion(observaciones, etiqueta){
  const txt = String(observaciones || '');
  const re = new RegExp(etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*([\\s\\S]*?)(?=\\n\\n[A-ZÁÉÍÓÚÑ][^\\n]{0,55}:|\\n\\n---|$)', 'i');
  const m = txt.match(re);
  return m ? m[1].trim() : '';
}
function limpiarObservacionesSistema(observaciones){
  return String(observaciones || '')
    .split(/\n\n---\n/)[0]
    .replace(/^Generado desde Self Service\. Pendiente de revisión PMO\.\s*/i, '')
    .trim();
}
function solicitudToFormData(r){
  const obs = r.observaciones || '';
  return {
    tipo_registro: r.tipo_registro || (/^A\d+\s/i.test(r.numero_rqm||'')?'ADENDUM':'REQUERIMIENTO'),
    requerimiento_padre_id: r.requerimiento_padre_id || null,
    numero_adendum: r.numero_adendum || null,
    sistema_id: r.sistema_id || '',
    sistema_nombre: r.sistema_nombre || '',
    numero_rqm: r.numero_rqm || '',
    proyecto: r.proyecto || '',
    tipo_requerimiento: valorObservacion(obs, 'Tipo de requerimiento') || r.tipo_requerimiento || 'Proyecto',
    version: valorObservacion(obs, 'Versión') || '1',
    prioridad: valorObservacion(obs, 'Prioridad') || valorObservacion(obs, 'Prioridad sugerida') || 'Mediana',
    complejidad: valorObservacion(obs, 'Complejidad') || 'Mediana',
    descripcion_general: valorObservacion(obs, 'Descripción') || '',
    solicitado_por: r.solicitado_por || '',
    area_nombre: valorObservacion(obs, 'Área solicitante') || '',
    responsable: valorObservacion(obs, 'Responsable') || 'Miriam Lizbeth Arauz Chavez',
    fecha_asignacion: r.fecha_asignacion || (r.created_at ? String(r.created_at).slice(0,10) : hoyISO()),
    areas_impactadas: valorObservacion(obs, 'Áreas impactadas') || '',
    dependencias_produccion: valorObservacion(obs, 'Dependencias') || '',
    antecedentes: valorObservacion(obs, 'Antecedentes') || '',
    objetivo: valorObservacion(obs, 'Objetivo') || '',
    descripcion_detallada: valorObservacion(obs, 'Detalle') || ''
  };
}
function buildObservacionesFromData(f, intro='Generado desde Self Service. Pendiente de revisión PMO.'){
  return [
    intro,
    f.tipo_requerimiento ? `Tipo de requerimiento: ${f.tipo_requerimiento}` : '',
    f.prioridad ? `Prioridad: ${f.prioridad}` : '',
    f.complejidad ? `Complejidad: ${f.complejidad}` : '',
    f.version ? `Versión: ${f.version}` : '',
    f.area_nombre ? `Área solicitante: ${f.area_nombre}` : '',
    f.responsable ? `Responsable: ${f.responsable}` : '',
    f.descripcion_general ? `Descripción: ${f.descripcion_general}` : '',
    f.areas_impactadas ? `Áreas impactadas: ${f.areas_impactadas}` : '',
    f.dependencias_produccion ? `Dependencias: ${f.dependencias_produccion}` : '',
    f.antecedentes ? `Antecedentes: ${f.antecedentes}` : '',
    f.objetivo ? `Objetivo: ${f.objetivo}` : '',
    f.descripcion_detallada ? `Detalle: ${f.descripcion_detallada}` : ''
  ].filter(Boolean).join('\n\n');
}

function semaforoClass(estatus){
  const n = normalizar(mapEstatusUsuario(estatus));
  if(n.includes('REQUIERE AJUSTE')) return 'amber';
  if(n.includes('RECHAZADO') || n.includes('CANCELADO')) return 'red';
  if(n.includes('LIBERADA') || n.includes('APROBADA')) return 'green';
  if(n.includes('DESARROLLO') || n.includes('QA') || n.includes('UAT')) return 'blue';
  return 'slate';
}
function semaforoTexto(estatus){
  const n = normalizar(mapEstatusUsuario(estatus));
  if(n.includes('REQUIERE AJUSTE')) return 'Atención requerida';
  if(n.includes('RECHAZADO')) return 'Rechazada';
  if(n.includes('CANCELADO')) return 'Cancelada';
  if(n.includes('LIBERADA')) return 'Liberada';
  if(n.includes('APROBADA')) return 'Aprobada por PMO';
  if(n.includes('DESARROLLO') || n.includes('QA') || n.includes('UAT')) return 'En proceso';
  return 'En revisión';
}
function abrirModalSS(titulo, subtitulo, bodyHtml, footerHtml='') {
  document.getElementById('modal-ss-title').textContent = titulo;
  document.getElementById('modal-ss-subtitle').textContent = subtitulo || '';
  document.getElementById('modal-ss-body').innerHTML = bodyHtml;
  document.getElementById('modal-ss-footer').innerHTML = footerHtml || `<button type="button" onclick="cerrarModalSS()" class="px-5 py-3 rounded-xl bg-slate-950 text-white font-black">Cerrar</button>`;
  document.getElementById('modal-self-service').classList.remove('hidden');
  if(window.lucide) lucide.createIcons();
}
function cerrarModalSS(){ document.getElementById('modal-self-service')?.classList.add('hidden'); }
function detalleHtmlSolicitud(r){
  return `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
    <div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-black text-slate-400 uppercase">Tipo</p><p class="font-black text-slate-950 mt-1">${esc((r.tipo_registro==='ADENDUM'||/^A\d+\s/i.test(r.numero_rqm||''))?'Adendum':'Requerimiento')}</p></div>
    <div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-black text-slate-400 uppercase">Folio/RQM</p><p class="font-black text-slate-950 mt-1">${esc(r.numero_rqm || '—')}</p></div>
    <div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-black text-slate-400 uppercase">Sistema</p><p class="font-black text-slate-950 mt-1">${esc(r.sistema_nombre || '—')}</p></div>
    <div class="rounded-2xl bg-slate-50 p-4 md:col-span-2"><p class="text-xs font-black text-slate-400 uppercase">Nombre</p><p class="font-black text-slate-950 mt-1">${esc(r.proyecto || '—')}</p></div>
    <div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-black text-slate-400 uppercase">Fecha</p><p class="font-black text-slate-950 mt-1">${fmtFecha(r.fecha_asignacion || r.created_at)}</p></div>
    <div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-black text-slate-400 uppercase">Semáforo</p><p class="font-black text-slate-950 mt-1">${esc(semaforoTexto(r.estatus))}</p></div>
    <div class="rounded-2xl bg-slate-50 p-4 md:col-span-2"><p class="text-xs font-black text-slate-400 uppercase">Información capturada</p><pre class="whitespace-pre-wrap font-sans text-slate-700 mt-2 leading-relaxed">${esc(r.observaciones || '—')}</pre></div>
  </div>`;
}
function verDetalleSolicitud(idx){
  const r = misSolicitudes[idx];
  if(!r) return;
  abrirModalSS('Detalle de solicitud', r.numero_rqm || 'Solicitud', detalleHtmlSolicitud(r));
}
function verComentariosPMO(idx){
  const r = misSolicitudes[idx];
  if(!r) return;
  const comentario = extraerComentarioPMO(r.observaciones) || 'PMO aún no ha agregado comentarios para esta solicitud.';
  abrirModalSS('Comentarios de PMO', r.numero_rqm || 'Solicitud', `<div class="comment-box whitespace-pre-wrap">${esc(comentario)}</div>`);
}
function abrirEditarSolicitud(idx){
  const r = misSolicitudes[idx];
  if(!puedeEditarSolicitud(r)){ alert('Esta solicitud ya no puede editarse. Solo se permite cuando es nueva o requiere ajuste.'); return; }
  if(!r) return;
  const f = solicitudToFormData(r);
  const sistemaOpts = sistemas.map(s => `<option value="${s.id}" data-nombre="${esc(s.nombre)}" ${s.id===f.sistema_id || s.nombre===f.sistema_nombre ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('');
  const body = `<form id="form-editar-ss" class="space-y-6">
    <input type="hidden" id="edit-ss-index" value="${idx}">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div><label class="field-label">Sistema afectado *</label><select id="edit-ss-sistema" class="field-input" required><option value="">Selecciona sistema</option>${sistemaOpts}</select></div>
      <div><label class="field-label">Tipo de requerimiento *</label><select id="edit-ss-tipo" class="field-input"><option ${f.tipo_requerimiento==='Proyecto'?'selected':''}>Proyecto</option><option ${f.tipo_requerimiento==='Mejora'?'selected':''}>Mejora</option><option ${f.tipo_requerimiento==='Mantenimiento'?'selected':''}>Mantenimiento</option><option ${f.tipo_requerimiento==='Normativo'?'selected':''}>Normativo</option></select></div>
      <div><label class="field-label">Versión *</label><input id="edit-ss-version" class="field-input" value="${esc(f.version)}" required></div>
      <div class="md:col-span-2"><label class="field-label">Nombre del RQM *</label><input id="edit-ss-proyecto" class="field-input" value="${esc(f.proyecto)}" required></div>
      <div><label class="field-label">Prioridad *</label><select id="edit-ss-prioridad" class="field-input"><option ${f.prioridad==='Baja'?'selected':''}>Baja</option><option ${f.prioridad==='Media'?'selected':''}>Media</option><option ${f.prioridad==='Alta'?'selected':''}>Alta</option></select></div>
      <div class="md:col-span-3"><label class="field-label">Descripción general *</label><textarea id="edit-ss-descripcion" rows="4" class="field-input" required>${esc(f.descripcion_general)}</textarea></div>
      <div><label class="field-label">Solicitante *</label><input id="edit-ss-solicitante" class="field-input" value="${esc(f.solicitado_por)}" required></div>
      <div><label class="field-label">Área solicitante *</label><input id="edit-ss-area" class="field-input" value="${esc(f.area_nombre)}" required></div>
      <div><label class="field-label">Fecha de ingreso *</label><input id="edit-ss-fecha" type="date" class="field-input" value="${esc(String(f.fecha_asignacion).slice(0,10))}" required></div>
      <div><label class="field-label">Áreas impactadas</label><input id="edit-ss-areas" class="field-input" value="${esc(f.areas_impactadas)}"></div>
      <div><label class="field-label">Dependencias para salida a producción</label><input id="edit-ss-dependencias" class="field-input" value="${esc(f.dependencias_produccion)}"></div>
      <div class="md:col-span-3"><label class="field-label">Antecedentes</label><textarea id="edit-ss-antecedentes" rows="3" class="field-input">${esc(f.antecedentes)}</textarea></div>
      <div class="md:col-span-3"><label class="field-label">Objetivo</label><textarea id="edit-ss-objetivo" rows="3" class="field-input">${esc(f.objetivo)}</textarea></div>
      <div class="md:col-span-3"><label class="field-label">Descripción detallada / observaciones</label><textarea id="edit-ss-detalle" rows="5" class="field-input">${esc(f.descripcion_detallada)}</textarea></div>
      <div class="md:col-span-3"><label class="field-label">Comentario para PMO *</label><textarea id="edit-ss-comentario" rows="3" class="field-input" placeholder="Ej. Ya corregí la información solicitada." required></textarea></div>
    </div>
  </form>`;
  const footer = `<button type="button" onclick="cerrarModalSS()" class="px-5 py-3 rounded-xl border border-slate-200 bg-white font-black text-slate-700">Cancelar</button>
    <button type="button" onclick="guardarEdicionSolicitudUsuario()" class="px-5 py-3 rounded-xl bg-blue-600 text-white font-black">Guardar cambios</button>`;
  abrirModalSS('Editar requerimiento', r.numero_rqm || 'Solicitud', body, footer);
}
async function guardarEdicionSolicitudUsuario(){
  const idx = Number(document.getElementById('edit-ss-index')?.value);
  const r = misSolicitudes[idx];
  if(!r) return;
  const sel = document.getElementById('edit-ss-sistema');
  const opt = sel.selectedOptions[0];
  const f = {
    sistema_id: sel.value || null,
    sistema_nombre: opt?.dataset?.nombre || opt?.textContent || r.sistema_nombre || '',
    numero_rqm: r.numero_rqm,
    proyecto: document.getElementById('edit-ss-proyecto').value.trim(),
    tipo_requerimiento: document.getElementById('edit-ss-tipo').value,
    version: document.getElementById('edit-ss-version').value.trim() || '1',
    prioridad: document.getElementById('edit-ss-prioridad').value,
    descripcion_general: document.getElementById('edit-ss-descripcion').value.trim(),
    solicitado_por: document.getElementById('edit-ss-solicitante').value.trim(),
    area_nombre: document.getElementById('edit-ss-area').value.trim(),
    fecha_asignacion: document.getElementById('edit-ss-fecha').value || hoyISO(),
    areas_impactadas: document.getElementById('edit-ss-areas').value.trim(),
    dependencias_produccion: document.getElementById('edit-ss-dependencias').value.trim(),
    antecedentes: document.getElementById('edit-ss-antecedentes').value.trim(),
    objetivo: document.getElementById('edit-ss-objetivo').value.trim(),
    descripcion_detallada: document.getElementById('edit-ss-detalle').value.trim()
  };
  const comentario = document.getElementById('edit-ss-comentario').value.trim();
  if(!f.sistema_id || !f.proyecto || !f.descripcion_general || !f.solicitado_por || !f.area_nombre || !comentario){ alert('Completa los campos obligatorios y el comentario para PMO.'); return; }
  const fecha = new Date().toLocaleString('es-MX');
  const observaciones = `${buildObservacionesFromData(f, 'Solicitud corregida por usuario. Pendiente de revisión PMO.')}

---
COMENTARIO USUARIO (${fecha}):
${comentario}`.trim();
  const { error } = await _supabase.from('rqm_control_requerimientos').update({
    sistema_id: f.sistema_id,
    sistema_nombre: f.sistema_nombre,
    proyecto: f.proyecto,
    solicitado_por: f.solicitado_por,
    fecha_asignacion: f.fecha_asignacion,
    observaciones,
    estatus: 'REGISTRADO',
    updated_at: new Date().toISOString()
  }).eq('id', r.id);
  if(error){ alert('No se pudo guardar la corrección: ' + error.message); return; }
  cerrarModalSS();
  await cargarMisSolicitudes();
  alert('Tu corrección fue enviada a PMO.');
}

function activarGruposUnicos(){
  document.querySelectorAll('[data-single-group]').forEach(group => {
    group.querySelectorAll('input[type="checkbox"]').forEach(ch => ch.addEventListener('change', () => {
      if(ch.checked) group.querySelectorAll('input[type="checkbox"]').forEach(other => { if(other !== ch) other.checked = false; });
      if(!group.querySelector('input:checked')) ch.checked = true;
    }));
  });
  document.querySelectorAll('input[name="ss-clase-registro"]').forEach(ch=>ch.addEventListener('change',actualizarTipoRegistroUI));
  document.getElementById('ss-adendum-padre')?.addEventListener('change',e=>{
    const r=requerimientosBase.find(x=>x.id===e.target.value);
    if(!r) return;
    document.querySelectorAll('input[name="ss-sistema-check"]').forEach(ch=>{
      ch.checked=(r.sistema_id && ch.value===r.sistema_id) || (!r.sistema_id && normalizar(ch.dataset.nombre)===normalizar(r.sistema_nombre));
    });
    document.getElementById('folio-preview').textContent=`Siguiente adendum de ${r.numero_rqm}`;
  });
  document.querySelectorAll('input[name="ss-sistema-check"]').forEach(ch => ch.addEventListener('change', () => {
    if(ch.checked) document.querySelectorAll('input[name="ss-sistema-check"]').forEach(other => { if(other !== ch) other.checked = false; });
    if(!document.querySelector('input[name="ss-sistema-check"]:checked')) ch.checked = true;
    document.getElementById('ss-sistema-otro-wrap')?.classList.toggle('hidden', !(ch.checked && ch.value === 'OTRO'));
  }));
}
function valoresChecks(name){ return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value); }
function valorCheckUnico(name, fallback=''){ return document.querySelector(`input[name="${name}"]:checked`)?.value || fallback; }
function configurarCamposOtro(){
  document.getElementById('ss-area-otro-check')?.addEventListener('change', e => document.getElementById('ss-area-otro-wrap')?.classList.toggle('hidden', !e.target.checked));
  document.getElementById('ss-dep-otro-check')?.addEventListener('change', e => document.getElementById('ss-dep-otro-wrap')?.classList.toggle('hidden', !e.target.checked));
}


function archivoADataURL(file){
  return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); });
}
async function agregarImagenesSolicitud(files){
  const permitidos=['image/png','image/jpeg','image/webp'];
  for(const file of [...files]){
    if(!permitidos.includes(file.type)){ alert(`${file.name}: formato no permitido.`); continue; }
    if(file.size > 5*1024*1024){ alert(`${file.name}: supera el límite de 5 MB.`); continue; }
    if(imagenesSeleccionadas.length>=8){ alert('Puedes adjuntar hasta 8 imágenes por solicitud.'); break; }
    const dataUrl=await archivoADataURL(file);
    imagenesSeleccionadas.push({file,dataUrl,nombre:file.name,tipo:file.type});
  }
  renderPreviewImagenes();
}
function renderPreviewImagenes(){
  const cont=document.getElementById('ss-imagenes-preview'); if(!cont) return;
  cont.innerHTML=imagenesSeleccionadas.length ? imagenesSeleccionadas.map((img,i)=>`<div class="evidence-card">
    <img src="${img.dataUrl}" alt="${esc(img.nombre)}"><div class="evidence-meta"><span title="${esc(img.nombre)}">${esc(img.nombre)}</span><button type="button" onclick="quitarImagenSolicitud(${i})" title="Quitar"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>
  </div>`).join('') : '<div class="evidence-empty">Aún no has agregado capturas.</div>';
  if(window.lucide) lucide.createIcons();
}
function quitarImagenSolicitud(i){ imagenesSeleccionadas.splice(i,1); renderPreviewImagenes(); }
async function subirImagenesSolicitud(solicitudId){
  if(!imagenesSeleccionadas.length) return [];
  const resultados=[];
  for(let i=0;i<imagenesSeleccionadas.length;i++){
    const img=imagenesSeleccionadas[i];
    const ext=(img.nombre.split('.').pop()||'jpg').toLowerCase();
    const path=`${usuarioActual.id}/${solicitudId}/${Date.now()}_${i}.${ext}`;
    const {error:upErr}=await _supabase.storage.from('rqm-evidencias').upload(path,img.file,{contentType:img.tipo,upsert:false});
    if(upErr) throw upErr;
    const {data:row,error:rowErr}=await _supabase.from('rqm_solicitud_imagenes').insert({solicitud_id:solicitudId,storage_path:path,nombre_archivo:img.nombre,orden:i,creado_por:usuarioActual.id}).select('*').single();
    if(rowErr) throw rowErr;
    resultados.push({...row,data_url:img.dataUrl});
  }
  return resultados;
}
async function cargarImagenesSolicitud(solicitudId){
  const {data,error}=await _supabase.from('rqm_solicitud_imagenes').select('*').eq('solicitud_id',solicitudId).order('orden');
  if(error) throw error;
  const out=[];
  for(const row of data||[]){
    const {data:blob,error:downErr}=await _supabase.storage.from('rqm-evidencias').download(row.storage_path);
    if(downErr) continue;
    out.push({...row,data_url:await archivoADataURL(blob)});
  }
  return out;
}

function getFormData(numeroRQM){
  const sistema = getSistemaSeleccionado();
  const areas = valoresChecks('ss-area-impactada');
  const deps = valoresChecks('ss-dependencia');
  return {
    tipo_registro: getClaseRegistro(),
    requerimiento_padre_id: getClaseRegistro()==='ADENDUM' ? (document.getElementById('ss-adendum-padre')?.value || null) : null,
    sistema_id: sistema.id,
    sistema_nombre: sistema.nombre,
    numero_rqm: numeroRQM,
    proyecto: document.getElementById('ss-nombre').value.trim(),
    tipo_requerimiento: valorCheckUnico('ss-tipo','Proyecto'),
    version: document.getElementById('ss-version').value.trim() || '1',
    prioridad: valorCheckUnico('ss-prioridad','Mediana'),
    complejidad: valorCheckUnico('ss-complejidad','Mediana'),
    descripcion_general: document.getElementById('ss-descripcion').value.trim(),
    solicitado_por: document.getElementById('ss-solicitante').value.trim(),
    area_nombre: document.getElementById('ss-area').value.trim(),
    fecha_asignacion: document.getElementById('ss-fecha').value || hoyISO(),
    responsable: document.getElementById('ss-responsable').value.trim(),
    areas_impactadas_lista: areas,
    areas_impactadas_otro: areas.includes('Otro') ? document.getElementById('ss-area-otro').value.trim() : '',
    areas_impactadas: areas.filter(x=>x!=='Otro').concat(areas.includes('Otro') && document.getElementById('ss-area-otro').value.trim() ? [`Otro: ${document.getElementById('ss-area-otro').value.trim()}`] : []).join(', '),
    dependencias_lista: deps,
    dependencias_otro: deps.includes('Otros') ? document.getElementById('ss-dep-otro').value.trim() : '',
    dependencias_produccion: deps.filter(x=>x!=='Otros').concat(deps.includes('Otros') && document.getElementById('ss-dep-otro').value.trim() ? [`Otros: ${document.getElementById('ss-dep-otro').value.trim()}`] : []).join(', '),
    antecedentes: document.getElementById('ss-antecedentes').value.trim(),
    objetivo: document.getElementById('ss-objetivo').value.trim(),
    descripcion_detallada: document.getElementById('ss-detalle').value.trim()
  };
}

function marcarCheckUnico(name, valor){
  const objetivo=normalizar(valor);
  document.querySelectorAll(`input[name="${name}"]`).forEach(x=>x.checked=normalizar(x.value)===objetivo);
}
function marcarChecksMultiples(name, texto){
  const vals=String(texto||'').split(',').map(x=>normalizar(x.replace(/^Otro(?:s)?:\s*/i,''))).filter(Boolean);
  document.querySelectorAll(`input[name="${name}"]`).forEach(x=>x.checked=vals.includes(normalizar(x.value)));
}
async function cargarSolicitudEnFormulario(idx){
  const r=misSolicitudes[idx]; if(!r) return;
  if(!puedeEditarSolicitud(r)){ alert('Esta solicitud ya no puede editarse. Solo se permite cuando es nueva o requiere ajuste.'); return; }
  const f=solicitudToFormData(r);
  solicitudEditandoId=r.id; solicitudEditandoIndice=idx;
  togglePanel('formulario-solicitud',true);
  document.querySelectorAll('input[name="ss-clase-registro"]').forEach(x=>x.checked=x.value===f.tipo_registro);
  actualizarTipoRegistroUI();
  if(f.requerimiento_padre_id) document.getElementById('ss-adendum-padre').value=f.requerimiento_padre_id;
  document.querySelectorAll('input[name="ss-sistema-check"]').forEach(x=>x.checked=(f.sistema_id && x.value===f.sistema_id) || (!f.sistema_id && normalizar(x.dataset.nombre)===normalizar(f.sistema_nombre)));
  document.getElementById('ss-nombre').value=f.proyecto;
  document.getElementById('ss-version').value=f.version;
  document.getElementById('ss-descripcion').value=f.descripcion_general;
  marcarCheckUnico('ss-tipo',f.tipo_requerimiento);
  marcarCheckUnico('ss-prioridad',f.prioridad);
  marcarCheckUnico('ss-complejidad',f.complejidad);
  document.getElementById('ss-solicitante').value=f.solicitado_por;
  document.getElementById('ss-area').value=f.area_nombre;
  document.getElementById('ss-fecha').value=String(f.fecha_asignacion||'').slice(0,10);
  document.getElementById('ss-responsable').value=f.responsable;
  marcarChecksMultiples('ss-area-impactada',f.areas_impactadas);
  marcarChecksMultiples('ss-dependencia',f.dependencias_produccion);
  document.getElementById('ss-antecedentes').value=f.antecedentes;
  document.getElementById('ss-objetivo').value=f.objetivo;
  document.getElementById('ss-detalle').value=f.descripcion_detallada;
  document.getElementById('folio-preview').textContent=`Editando ${r.numero_rqm}`;
  const btn=document.getElementById('btn-guardar-self'); if(btn) btn.innerHTML='<i data-lucide="save" class="w-4 h-4"></i>Guardar cambios y descargar formato';
  scrollToSection('formulario-solicitud'); if(window.lucide) lucide.createIcons();
}
function limpiarFormulario(){
  solicitudEditandoId=null; solicitudEditandoIndice=null;
  document.getElementById('form-self-service').reset();
  document.getElementById('ss-version').value = '1';
  document.getElementById('ss-fecha').value = hoyISO();
  document.getElementById('ss-version').value = '1';
  document.getElementById('ss-responsable').value = 'Miriam Lizbeth Arauz Chavez';
  document.getElementById('ss-area-otro-wrap')?.classList.add('hidden');
  document.getElementById('ss-dep-otro-wrap')?.classList.add('hidden');
  document.getElementById('ss-sistema-otro-wrap')?.classList.add('hidden');
  document.querySelectorAll('input[name="ss-clase-registro"]').forEach((x,i)=>x.checked=i===0);
  const padre=document.getElementById('ss-adendum-padre'); if(padre) padre.value='';
  document.getElementById('ss-adendum-padre-wrap')?.classList.add('hidden');
  document.getElementById('folio-preview').textContent = 'Folio pendiente';
  imagenesSeleccionadas = [];
  const inputImgs=document.getElementById('ss-imagenes'); if(inputImgs) inputImgs.value='';
  renderPreviewImagenes();
}

async function guardarSolicitud(ev){
  ev.preventDefault();
  const btn = document.getElementById('btn-guardar-self');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>Guardando...';
  lucide.createIcons();
  try{
    const sistema = getSistemaSeleccionado();
    if(!sistema.nombre) throw new Error('Selecciona el sistema afectado.');
    const clase=getClaseRegistro();
    const padreId=clase==='ADENDUM' ? document.getElementById('ss-adendum-padre')?.value : null;
    if(clase==='ADENDUM' && !padreId) throw new Error('Selecciona el requerimiento original para crear el adendum.');
    const f = getFormData(solicitudEditandoId ? (misSolicitudes[solicitudEditandoIndice]?.numero_rqm || 'PENDIENTE') : 'PENDIENTE');
    const observaciones = buildObservacionesFromData(f, solicitudEditandoId ? 'Solicitud actualizada por el usuario. Pendiente de revisión PMO.' : (clase==='ADENDUM' ? 'Generado desde Self Service como adendum. Pendiente de revisión PMO.' : 'Generado desde Self Service. Pendiente de revisión PMO.'));
    if(solicitudEditandoId){
      const original=misSolicitudes[solicitudEditandoIndice];
      const {error:updateError}=await _supabase.from('rqm_control_requerimientos').update({
        sistema_id:f.sistema_id, sistema_nombre:f.sistema_nombre, proyecto:f.proyecto,
        solicitado_por:f.solicitado_por, fecha_asignacion:f.fecha_asignacion,
        observaciones, updated_at:new Date().toISOString()
      }).eq('id',solicitudEditandoId).eq('creado_por',usuarioActual.id);
      if(updateError) throw updateError;
      if(imagenesSeleccionadas.length) await subirImagenesSolicitud(solicitudEditandoId);
      f.numero_rqm=original.numero_rqm; f.imagenes=await cargarImagenesSolicitud(solicitudEditandoId);
      await generarPDF(f); limpiarFormulario(); document.getElementById('formulario-solicitud')?.classList.add('collapsed'); await cargarMisSolicitudes(); scrollToSection('mis-solicitudes');
      alert(`${f.numero_rqm} fue actualizado correctamente.`); return;
    }
    const {data:solicitudCreada,error}=await _supabase.rpc('crear_solicitud_self_service_atomica',{
      p_tipo_registro:clase,
      p_requerimiento_padre_id:padreId||null,
      p_sistema_id:f.sistema_id,
      p_sistema_nombre:f.sistema_nombre,
      p_proyecto:f.proyecto,
      p_solicitado_por:f.solicitado_por,
      p_fecha_asignacion:f.fecha_asignacion,
      p_observaciones:observaciones
    });
    if(error) throw error;
    const creada=Array.isArray(solicitudCreada)?solicitudCreada[0]:solicitudCreada;
    if(!creada?.id || !creada?.numero_rqm) throw new Error('Supabase no devolvió el folio asignado.');
    const numeroRQM=creada.numero_rqm;
    f.numero_rqm=numeroRQM;
    f.tipo_registro=creada.tipo_registro||clase;
    f.numero_adendum=creada.numero_adendum||null;
    document.getElementById('folio-preview').textContent = numeroRQM;
    const imagenesGuardadas = await subirImagenesSolicitud(creada.id);
    f.imagenes = imagenesGuardadas.length ? imagenesGuardadas : imagenesSeleccionadas;

    await generarPDF(f);
    limpiarFormulario();
    document.getElementById('formulario-solicitud')?.classList.add('collapsed');
    await cargarMisSolicitudes();
    scrollToSection('mis-solicitudes');
    alert(`${numeroRQM} fue registrado correctamente y enviado a revisión PMO.`);
  }catch(e){
    console.error(e);
    alert('No se pudo guardar la solicitud: ' + (e.message || e));
  }finally{
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i>Guardar y descargar formato';
    lucide.createIcons();
  }
}

async function cargarMisSolicitudes(){
  let query = _supabase
    .from('rqm_control_requerimientos')
    .select('*')
    .order('created_at',{ascending:false})
    .order('fecha_asignacion',{ascending:false});
  if(usuarioActual?.id) query = query.eq('creado_por', usuarioActual.id);
  query = query.eq('origen_registro', 'SELF_SERVICE');
  const { data, error } = await query;
  if(error){ alert('No se pudieron cargar tus solicitudes: ' + error.message); return; }
  misSolicitudes = data || [];
  renderMisSolicitudes();
  renderKPIs();
}

function renderKPIs(){
  const total = misSolicitudes.length;
  const revision = misSolicitudes.filter(r => ['REGISTRADO','NUEVO','ENVIADA'].includes(normalizar(r.estatus))).length;
  const aprobadas = misSolicitudes.filter(r => normalizar(r.estatus) === 'CONVERTIDO A PMO').length;
  const ajuste = misSolicitudes.filter(r => normalizar(r.estatus).includes('AJUSTE')).length;
  const cards = [
    ['MIS SOLICITUDES', total, 'list-checks'],
    ['EN REVISIÓN PMO', revision, 'clock-3'],
    ['APROBADAS PMO', aprobadas, 'badge-check'],
    ['REQUIEREN AJUSTE', ajuste, 'triangle-alert']
  ];
  document.getElementById('kpis-usuario').innerHTML = cards.map(c => `<div class="portal-card p-5"><div class="flex justify-between items-start"><div><p class="text-xs font-black text-slate-400 tracking-wider">${c[0]}</p><p class="text-3xl font-black text-slate-950 mt-2">${c[1]}</p></div><div class="p-3 rounded-2xl bg-blue-50 text-blue-600"><i data-lucide="${c[2]}" class="w-5 h-5"></i></div></div></div>`).join('');
  lucide.createIcons();
}

function puedeEditarSolicitud(r){ const e=normalizar(r?.estatus); return ['REGISTRADO','NUEVO','ENVIADA'].includes(e) || e.includes('AJUSTE'); }

function renderMisSolicitudes(){
  const tbody = document.getElementById('tabla-mis-solicitudes');
  if(!misSolicitudes.length){
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="mx-auto w-12 h-12 rounded-2xl bg-slate-50 grid place-items-center mb-3"><i data-lucide="file-plus-2" class="w-6 h-6 text-slate-400"></i></div><strong>Aún no tienes solicitudes registradas.</strong><br>Cuando captures un requerimiento aparecerá aquí.</td></tr>`;
    lucide.createIcons();
    return;
  }
  tbody.innerHTML = misSolicitudes.map((r,idx) => `<tr class="border-t border-slate-100 hover:bg-slate-50/70">
    <td class="p-4 font-black text-slate-950 whitespace-nowrap">${esc(r.numero_rqm || '—')}</td>
    <td class="p-4"><div class="font-black text-slate-900">${esc(r.proyecto || '—')}</div><div class="text-slate-400 mt-1">Solicitud</div></td>
    <td class="p-4 text-slate-700">${esc(r.sistema_nombre || '—')}</td>
    <td class="p-4 text-slate-700 whitespace-nowrap">${fmtFecha(r.fecha_asignacion || r.created_at)}</td>
    <td class="p-4"><div class="flex items-center gap-2"><span class="status-light ${semaforoClass(r.estatus)}"></span><span class="text-xs font-black text-slate-500">${esc(semaforoTexto(r.estatus))}</span></div></td>
    <td class="p-4 text-right whitespace-nowrap">
      ${puedeEditarSolicitud(r) ? `<button onclick="cargarSolicitudEnFormulario(${idx})" class="icon-btn blue" title="Editar mi requerimiento"><i data-lucide="pencil" class="w-4 h-4"></i><span class="hidden xl:inline">Editar</span></button>` : `<button class="icon-btn opacity-40 cursor-not-allowed" disabled title="Solo puede editarse cuando es nuevo o requiere ajuste"><i data-lucide="lock-keyhole" class="w-4 h-4"></i></button>`}
      <button onclick="descargarPDFSolicitud(${idx})" class="icon-btn dark" title="Descargar formato PDF"><i data-lucide="download" class="w-4 h-4"></i><span class="hidden xl:inline">PDF</span></button>
      ${normalizar(r.estatus)==='CONVERTIDO A PMO' ? `<button onclick="verAvanceSolicitud(${idx})" class="icon-btn progress" title="Ver avance"><i data-lucide="route" class="w-4 h-4"></i><span class="hidden xl:inline">Avance</span></button>` : ''}
      <button onclick="eliminarSolicitud(${idx})" class="icon-btn text-rose-600 border-rose-200 bg-rose-50" title="Eliminar solicitud"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </td>
  </tr>`).join('');
  lucide.createIcons();
}


async function eliminarSolicitud(idx){
  const r=misSolicitudes[idx];
  if(!r) return;
  if(!(await PMOConfirm(`Se eliminará definitivamente ${r.numero_rqm || 'esta solicitud'}. Esta acción no se puede deshacer.`))) return;
  const {data:imgs}=await _supabase.from('rqm_solicitud_imagenes').select('storage_path').eq('solicitud_id',r.id);
  if(imgs?.length) await _supabase.storage.from('rqm-evidencias').remove(imgs.map(x=>x.storage_path));
  let query=_supabase.from('rqm_control_requerimientos').delete().eq('id',r.id);
  if(usuarioActual?.id) query=query.eq('creado_por',usuarioActual.id);
  query=query.eq('origen_registro','SELF_SERVICE');
  const {error}=await query;
  if(error){ alert('No se pudo eliminar la solicitud: '+error.message); return; }
  await cargarMisSolicitudes();
}


function solicitudToPDFData(r){ return solicitudToFormData(r); }
async function descargarPDFSolicitud(idx){
  const r=misSolicitudes[idx]; if(!r) return;
  try{
    const data=solicitudToPDFData(r);
    data.imagenes=await cargarImagenesSolicitud(r.id);
    await generarPDF(data);
  }catch(e){ alert('No se pudo preparar el PDF: '+(e.message||e)); }
}

function faseActualProyecto(p){
  const n=normalizar(p?.estatus);
  if(n.includes('LIBER')) return 'LIBERADO';
  if(n.includes('UAT')) return 'UAT';
  if(n.includes('QA')) return 'QA';
  if(n.includes('DESAR')) return 'DESARROLLO';
  if(n.includes('ANAL')) return 'ANÁLISIS';
  return 'BACKLOG';
}
async function verAvanceSolicitud(idx){
  const r=misSolicitudes[idx]; if(!r) return;
  abrirModalSS('Avance del requerimiento',r.numero_rqm||'Solicitud','<div class="roadmap-loading"><i data-lucide="loader-2" class="w-7 h-7 animate-spin"></i><span>Consultando avance...</span></div>');
  try{
    const {data:p,error}=await _supabase.from('pmo_projects').select('*').eq('id_req',r.numero_rqm).maybeSingle();
    if(error) throw error;
    if(!p){ document.getElementById('modal-ss-body').innerHTML='<div class="roadmap-empty">PMO ya aprobó la solicitud. El seguimiento estará disponible cuando el proyecto termine de registrarse en la Matriz.</div>'; return; }
    const fases=['BACKLOG','ANÁLISIS','DESARROLLO','QA','UAT','LIBERADO'];
    const actual=faseActualProyecto(p), pos=fases.indexOf(actual), porcentaje=Math.max(0,Math.round((pos/(fases.length-1))*100));
    const fechas={
      'BACKLOG':p.fecha_ingreso_pmo,
      'ANÁLISIS':p.fecha_ingreso_pmo,
      'DESARROLLO':p.fecha_fin_desarrollo||p.fecha_desarrollo,
      'QA':p.fecha_fin_qa||p.fecha_qa,
      'UAT':p.fecha_fin_uat||p.fecha_uat,
      'LIBERADO':p.fecha_liberacion_prod||p.fecha_liberacion
    };
    const steps=fases.map((f,i)=>`<div class="roadmap-step ${i<pos?'done':i===pos?'current':'pending'}">
      <div class="roadmap-dot">${i<pos?'<i data-lucide="check" class="w-4 h-4"></i>':i+1}</div>
      <div class="roadmap-step-copy"><strong>${f}</strong><span>${i<pos?'Etapa concluida':i===pos?'Etapa actual':'Pendiente'}</span>${fechas[f]?`<small>Fecha: ${fmtFecha(fechas[f])}</small>`:''}</div>
    </div>`).join('');
    document.getElementById('modal-ss-body').innerHTML=`<div class="roadmap-hero"><div><span class="roadmap-kicker">Seguimiento en tiempo real</span><h4>${esc(p.nombre_rqm||r.proyecto||'Requerimiento')}</h4><p>Tu solicitud ya forma parte del portafolio PMO.</p></div><div class="roadmap-percent"><strong>${porcentaje}%</strong><span>avance</span></div></div>
      <div class="roadmap-progress"><span style="width:${porcentaje}%"></span></div>
      <div class="roadmap-current"><div><span>Etapa actual</span><strong>${actual}</strong></div><div><span>Estatus PMO</span><strong>${esc(p.estatus||'Registrado')}</strong></div><div><span>Última actualización</span><strong>${fmtFecha((p.updated_at||p.created_at||'').slice(0,10))}</strong></div></div>
      <div class="roadmap-timeline">${steps}</div>
      <div class="roadmap-note"><i data-lucide="info" class="w-5 h-5"></i><span>Este avance es informativo y se actualiza con la información registrada por PMO en la Matriz.</span></div>`;
    if(window.lucide) lucide.createIcons();
  }catch(e){ document.getElementById('modal-ss-body').innerHTML=`<div class="roadmap-empty">No fue posible consultar el avance: ${esc(e.message||e)}</div>`; }
}

async function generarPDF(data){
  const jspdf=window.jspdf;
  if(!jspdf?.jsPDF){ alert('No se pudo cargar el generador PDF. Verifica tu conexión a internet.'); return; }
  const doc=new jspdf.jsPDF({unit:'pt',format:'letter'}), W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), M=22, azul=[0,0,110];
  const paginas=[];
  const check='[ ]',mark='[X]',isSel=(arr,v)=>Array.isArray(arr)&&arr.includes(v),cb=(sel,label)=>`${sel?mark:check} ${label}`;
  function head(page,total){doc.setTextColor(42,42,60);doc.setFont('helvetica','bold');doc.setFontSize(38);doc.text('finsus',M+6,58);doc.setFont('helvetica','normal');doc.setFontSize(13);doc.text('Finanzas Transparentes',M+6,79);doc.setDrawColor(195);doc.line(M,98,W-M,98);doc.line(W-190,15,W-190,118);doc.setFontSize(10);doc.text(data.numero_rqm||'RQM 00 00',W-M-80,32);doc.text('Fecha de elaboración:',W-M-126,48);doc.text(fmtFecha(data.fecha_asignacion),W-M-88,62);doc.setDrawColor(170);doc.line(M,H-34,W-M,H-34);doc.setFontSize(7.5);doc.setTextColor(60);doc.text('Fecha de emisión: 10 abril 2024',M+6,H-19);doc.text('Área que emite: Producto Crédito Al Consumo**',W/2,H-19,{align:'center'});doc.text(`Página ${page} de ${total}`,W-M-4,H-19,{align:'right'});}
  function box(x,y,w,h,title){doc.setDrawColor(...azul);doc.setLineWidth(1.2);doc.rect(x,y,w,h);if(title){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(0);doc.text(title,x+6,y+14);}}
  function fit(text,w,size=9){doc.setFontSize(size);return doc.splitTextToSize(String(text||''),w);}
  function textIn(text,x,y,w,size=9){doc.setFont('helvetica','normal');doc.setFontSize(size);doc.setTextColor(0);doc.text(fit(text,w,size),x,y);}
  function tableRow(y,label,value,h=25,labelW=115){box(M,y,W-2*M,h);doc.line(M+labelW,y,M+labelW,y+h);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text(label,M+5,y+16);textIn(value,M+labelW+6,y+16,W-2*M-labelW-12,8.5);}
  function nuevaPagina(draw){paginas.push(draw);}

  nuevaPagina(()=>{let y=148;doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(...azul);doc.text('Requerimiento a Sistemas',W/2,y,{align:'center'});y+=12;box(M,y,W-2*M,50,'SISTEMA AFECTADO:');const sys=normalizar(data.sistema_nombre);textIn([cb(sys==='GENESIS','GENESIS'),cb(sys==='COBRANZA','COBRANZA'),cb(sys==='COTIZADOR WEB','COTIZADOR WEB'),cb(!['GENESIS','COBRANZA','COTIZADOR WEB'].includes(sys),'OTRO'),`ESPECIFIQUE: ${!['GENESIS','COBRANZA','COTIZADOR WEB'].includes(sys)?data.sistema_nombre:''}`].join('     '),M+6,y+34,W-2*M-12,8);y+=76;tableRow(y,'Nombre del RQM',data.proyecto,24);y+=24;tableRow(y,'Número del RQM',data.numero_rqm,24);y+=24;tableRow(y,'Versión',data.version,24);y+=24;tableRow(y,'Descripción general',data.descripcion_general,64);y+=82;box(M,y,W-2*M,48,'TIPO DE REQUERIMIENTO:');textIn(['Mejora','Normativo','Proyecto','Mantenimiento','Hallazgo','Solicitud de info'].map(v=>cb(data.tipo_requerimiento===v,v)).join('    '),M+6,y+32,W-2*M-12,8);y+=66;box(M,y,W-2*M,150);let ry=y;const rows=[['Prioridad',['Baja','Mediana','Alta'].map(v=>cb(data.prioridad===v,v)).join('        ')],['Complejidad',['Baja','Mediana','Alta'].map(v=>cb(data.complejidad===v,v)).join('        ')],['Solicitante',data.solicitado_por],['Área solicitante',data.area_nombre],['Fecha de ingreso',fmtFecha(data.fecha_asignacion)],['Responsable',data.responsable]];rows.forEach((r,i)=>{if(i)doc.line(M,ry+i*25,W-M,ry+i*25);doc.line(M+105,ry+i*25,M+105,ry+(i+1)*25);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(r[0],M+5,ry+i*25+16);textIn(r[1],M+111,ry+i*25+16,W-2*M-117,8);});y+=168;box(M,y,W-2*M,62,'AREAS IMPACTADAS:');const areas=['Core Bancario','Finanzas','Contabilidad','Cobranza','Crédito al consumo','Operaciones','Mesa de control','Call Center','Todas las anteriores'];textIn(areas.slice(0,6).map(v=>cb(isSel(data.areas_impactadas_lista,v),v)).join('   '),M+6,y+31,W-2*M-12,7.3);textIn(`${areas.slice(6).map(v=>cb(isSel(data.areas_impactadas_lista,v),v)).join('   ')}   ${cb(isSel(data.areas_impactadas_lista,'Otro'),'Otro')}  Especifique: ${data.areas_impactadas_otro||''}`,M+6,y+48,W-2*M-12,7.3);});

  nuevaPagina(()=>{let y=145;box(M,y,W-2*M,58,'DEPENDENCIAS PARA SALIDA A PRODUCCION:');const deps=['Manuales','CheckList','Boletines','Capacitaciones','Todos los anteriores'];textIn(`${deps.map(v=>cb(isSel(data.dependencias_lista,v),v)).join('    ')}    ${cb(isSel(data.dependencias_lista,'Otros'),'Otros')}  Especifique: ${data.dependencias_otro||''}`,M+6,y+35,W-2*M-12,7.5);y+=95;doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Aprobaciones',M+6,y);y+=10;box(M,y,W-2*M,60);[105,145,265,305,465].forEach(x=>doc.line(M+x,y,M+x,y+60));doc.line(M,y+25,W-M,y+25);['Preparado por','Fecha','Revisado por','Fecha','Aprobado por','Fecha y firma'].forEach((t,i)=>{const xs=[M+4,M+110,M+150,M+270,M+310,M+470];doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(t,xs[i],y+16);});y+=94;doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Control de versiones',M+6,y);y+=10;box(M,y,W-2*M,72);[60,195,295,455,500].forEach(x=>doc.line(M+x,y,M+x,y+72));doc.line(M,y+30,W-M,y+30);doc.line(M+295,y+16,M+455,y+16);doc.line(M+455,y+16,W-M,y+16);['No.\nversión','Descripción del\ncambio','Sección\nmodificada','Modificado','Revisado'].forEach((t,i)=>{const xs=[M+5,M+65,M+200,M+350,M+500];doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(t.split('\n'),xs[i],y+12,{align:i>2?'center':'left'});});y+=92;box(M,y,W-2*M,56,'ANTECEDENTES');textIn(data.antecedentes,M+7,y+29,W-2*M-14,8.5);y+=56;box(M,y,W-2*M,56,'OBJETIVO');textIn(data.objetivo,M+7,y+29,W-2*M-14,8.5);y+=56;box(M,y,W-2*M,170,'DESCRIPCION (Pantallas, Imágenes, Documentos)');textIn(data.descripcion_detallada,M+7,y+29,W-2*M-14,8.5);});

  for(const img of (data.imagenes||[])){
    nuevaPagina(async()=>{const titleY=140;box(M,titleY,W-2*M,H-titleY-65,'DESCRIPCION (Pantallas, Imágenes, Documentos)');doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(img.nombre_archivo||img.nombre||'Evidencia',M+8,titleY+30);const props=doc.getImageProperties(img.data_url);const maxW=W-2*M-28,maxH=H-titleY-115,ratio=Math.min(maxW/props.width,maxH/props.height);const iw=props.width*ratio,ih=props.height*ratio;doc.addImage(img.data_url,props.fileType||'JPEG',M+(W-2*M-iw)/2,titleY+45,iw,ih);});
  }
  nuevaPagina(()=>{let y=145;box(M,y,W-2*M,174,'FIRMAS DE USUARIOS');doc.line(M,y+24,W-M,y+24);doc.line(M,y+49,W-M,y+49);doc.line(M+230,y+24,M+230,y+174);doc.line(M+390,y+24,M+390,y+174);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Nombre',M+115,y+41,{align:'center'});doc.text('Fecha',M+310,y+41,{align:'center'});doc.text('Firma',M+475,y+41,{align:'center'});for(let i=1;i<5;i++)doc.line(M,y+49+i*25,W-M,y+49+i*25);y+=235;box(M,y,W-2*M,110,'FIRMAS DE SISTEMAS');doc.line(M,y+24,W-M,y+24);doc.line(M,y+53,W-M,y+53);[150,260,370,470].forEach(x=>doc.line(M+x,y+24,M+x,y+110));['Nombre','Fecha de Recepción','Fecha de Aceptación','Fecha compromiso\nde entrega','Firma'].forEach((t,i)=>{const xs=[M+75,M+205,M+315,M+420,M+520];doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(t.split('\n'),xs[i],y+40,{align:'center'});});});

  const total=paginas.length;
  for(let i=0;i<total;i++){if(i>0)doc.addPage();head(i+1,total);await paginas[i]();}
  doc.save(`${(data.numero_rqm||'Solicitud').replace(/\s+/g,'_')}.pdf`);
}

window.eliminarSolicitud=eliminarSolicitud;
window.agregarImagenesSolicitud=agregarImagenesSolicitud;
window.quitarImagenSolicitud=quitarImagenSolicitud;
window.verAvanceSolicitud=verAvanceSolicitud;

window.addEventListener('DOMContentLoaded', async () => {
  // El formulario siempre inicia contraído; solo se abre al pulsar la flecha o al editar.
  document.getElementById('formulario-solicitud')?.classList.add('collapsed');
  usuarioActual = await verificarSesion();
  if(!usuarioActual) return;
  pintarUsuario(usuarioActual);
  document.getElementById('ss-fecha').value = hoyISO();
  document.getElementById('ss-solicitante').value = window.PMOAuth?.profile?.nombre || usuarioActual?.user_metadata?.nombre || usuarioActual?.email || '';
  document.getElementById('form-self-service').addEventListener('submit', guardarSolicitud);
  document.getElementById('ss-imagenes')?.addEventListener('change',e=>agregarImagenesSolicitud(e.target.files));
  renderPreviewImagenes();
  activarGruposUnicos(); configurarCamposOtro();
  await cargarCatalogos();
  await cargarRequerimientosBase();
  await cargarMisSolicitudes();
  document.getElementById('mis-solicitudes')?.classList.add('collapsed');
  lucide.createIcons();
});
