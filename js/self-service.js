const SUPABASE_URL = "https://cogiyoslnmtnnvnohoht.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ2l5b3Nsbm10bm52bm9ob2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDI5NDQsImV4cCI6MjA5NjY3ODk0NH0.sikG94OCbALSbHRN8-jc2W_QOgP15qXn4VwsqhOK7lM";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioActual = null;
let sistemas = [];
let misSolicitudes = [];

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
  const { data:{ session }, error } = await _supabase.auth.getSession();
  if(error || !session){ window.location.href = 'login.html'; return null; }
  return session.user;
}
async function cerrarSesion(){ await _supabase.auth.signOut(); window.location.href='login.html'; }
function pintarUsuario(user){ document.getElementById('usuario-sesion').textContent = user?.email || 'Usuario'; }

async function cargarCatalogos(){
  const { data, error } = await _supabase.from('cat_sistemas').select('*').order('nombre');
  if(error){ alert('No se pudieron cargar sistemas: ' + error.message); return; }
  sistemas = data || [];
  document.getElementById('ss-sistema').innerHTML = '<option value="">Selecciona sistema</option>' + sistemas.map(s => `<option value="${s.id}" data-nombre="${esc(s.nombre)}">${esc(s.nombre)}</option>`).join('');
}

function getSistemaSeleccionado(){
  const sel = document.getElementById('ss-sistema');
  const opt = sel.selectedOptions[0];
  return { id: sel.value || null, nombre: opt?.dataset?.nombre || opt?.textContent || '' };
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
    sistema_id: r.sistema_id || '',
    sistema_nombre: r.sistema_nombre || '',
    numero_rqm: r.numero_rqm || '',
    proyecto: r.proyecto || '',
    tipo_requerimiento: valorObservacion(obs, 'Tipo de requerimiento') || r.tipo_requerimiento || 'Proyecto',
    version: valorObservacion(obs, 'Versión') || '1',
    prioridad: valorObservacion(obs, 'Prioridad sugerida') || 'Media',
    descripcion_general: valorObservacion(obs, 'Descripción') || '',
    solicitado_por: r.solicitado_por || '',
    area_nombre: valorObservacion(obs, 'Área solicitante') || '',
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
    f.prioridad ? `Prioridad sugerida: ${f.prioridad}` : '',
    f.version ? `Versión: ${f.version}` : '',
    f.area_nombre ? `Área solicitante: ${f.area_nombre}` : '',
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

function getFormData(numeroRQM){
  const sistema = getSistemaSeleccionado();
  return {
    sistema_id: sistema.id,
    sistema_nombre: sistema.nombre,
    numero_rqm: numeroRQM,
    proyecto: document.getElementById('ss-nombre').value.trim(),
    tipo_requerimiento: document.getElementById('ss-tipo').value,
    version: document.getElementById('ss-version').value.trim() || '1',
    prioridad: document.getElementById('ss-prioridad').value,
    descripcion_general: document.getElementById('ss-descripcion').value.trim(),
    solicitado_por: document.getElementById('ss-solicitante').value.trim(),
    area_nombre: document.getElementById('ss-area').value.trim(),
    fecha_asignacion: document.getElementById('ss-fecha').value || hoyISO(),
    areas_impactadas: document.getElementById('ss-areas-impactadas').value.trim(),
    dependencias_produccion: document.getElementById('ss-dependencias').value.trim(),
    antecedentes: document.getElementById('ss-antecedentes').value.trim(),
    objetivo: document.getElementById('ss-objetivo').value.trim(),
    descripcion_detallada: document.getElementById('ss-detalle').value.trim()
  };
}

function limpiarFormulario(){
  document.getElementById('form-self-service').reset();
  document.getElementById('ss-version').value = '1';
  document.getElementById('ss-fecha').value = hoyISO();
  document.getElementById('folio-preview').textContent = 'Folio pendiente';
}

async function guardarSolicitud(ev){
  ev.preventDefault();
  const btn = document.getElementById('btn-guardar-self');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>Guardando...';
  lucide.createIcons();
  try{
    const sistema = getSistemaSeleccionado();
    if(!sistema.id) throw new Error('Selecciona el sistema afectado.');
    const numeroRQM = await obtenerSiguienteRQM(sistema);
    const f = getFormData(numeroRQM);
    document.getElementById('folio-preview').textContent = numeroRQM;

    const observaciones = buildObservacionesFromData(f);

    const payload = {
      sistema_id: f.sistema_id,
      sistema_nombre: f.sistema_nombre,
      proyecto: f.proyecto,
      solicitado_por: f.solicitado_por,
      fecha_asignacion: f.fecha_asignacion,
      numero_rqm: f.numero_rqm,
      estatus: 'REGISTRADO',
      observaciones,
      creado_por: usuarioActual?.id || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await _supabase.from('rqm_control_requerimientos').insert([payload]);
    if(error) throw error;

    generarPDF(f);
    limpiarFormulario();
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
      <button onclick="verDetalleSolicitud(${idx})" class="icon-btn" title="Ver detalle"><i data-lucide="eye" class="w-4 h-4"></i><span class="hidden xl:inline">Ver</span></button>
      <button onclick="abrirEditarSolicitud(${idx})" class="icon-btn blue" title="Editar requerimiento"><i data-lucide="pencil" class="w-4 h-4"></i></button>
      <button onclick="descargarPDFSolicitud(${idx})" class="icon-btn dark" title="Descargar formato PDF"><i data-lucide="download" class="w-4 h-4"></i><span class="hidden xl:inline">PDF</span></button>
    </td>
  </tr>`).join('');
  lucide.createIcons();
}

function solicitudToPDFData(r){
  return solicitudToFormData(r);
}
function descargarPDFSolicitud(idx){ const r = misSolicitudes[idx]; if(r) generarPDF(solicitudToPDFData(r)); }

function generarPDF(data){
  const jspdf = window.jspdf;
  if(!jspdf?.jsPDF){ alert('No se pudo cargar el generador PDF. Verifica tu conexión a internet.'); return; }
  const doc = new jspdf.jsPDF({ unit:'pt', format:'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 38;
  let y = 40;
  const azul = [0, 0, 102];
  const gris = [226,232,240];

  function header(page=1){
    doc.setFont('helvetica','bold'); doc.setFontSize(40); doc.setTextColor(35,35,60); doc.text('finsus', margin, 78);
    doc.setFont('helvetica','normal'); doc.setFontSize(15); doc.text('Finanzas Transparentes', margin, 102);
    doc.setDrawColor(210); doc.line(margin, 122, pageW-margin, 122);
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(30); doc.text(data.numero_rqm || '', pageW-margin-70, 72);
    doc.setFont('helvetica','normal'); doc.text('Fecha de elaboración:', pageW-margin-100, 88);
    doc.text(fmtFecha(data.fecha_asignacion), pageW-margin-85, 102);
    y = 170;
  }
  function footer(page){
    doc.setDrawColor(180); doc.line(margin, pageH-42, pageW-margin, pageH-42);
    doc.setFontSize(8); doc.setTextColor(60); doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-MX')}`, margin+40, pageH-24);
    doc.text(`Página ${page}`, pageW-margin-60, pageH-24);
  }
  function boxTitle(text){
    doc.setFillColor(...gris); doc.setDrawColor(...azul); doc.setLineWidth(1.2); doc.rect(margin, y, pageW-margin*2, 24, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0); doc.text(text, margin+8, y+16); y += 24;
  }
  function row(label, value, h=28){
    const labelW = 165;
    doc.setDrawColor(...azul); doc.rect(margin, y, labelW, h); doc.rect(margin+labelW, y, pageW-margin*2-labelW, h);
    doc.setFillColor(...gris); doc.rect(margin, y, labelW, h, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0); doc.text(label, margin+8, y+17);
    doc.setFont('helvetica','normal');
    const lines = doc.splitTextToSize(String(value || '—'), pageW-margin*2-labelW-14);
    doc.text(lines, margin+labelW+8, y+17);
    y += h;
  }
  function paragraphBox(title, text){
    const lines = doc.splitTextToSize(String(text || '—'), pageW-margin*2-18);
    const h = Math.max(55, lines.length * 12 + 34);
    if(y + h > pageH - 70){ footer(1); doc.addPage(); header(2); }
    boxTitle(title);
    doc.setDrawColor(...azul); doc.rect(margin, y, pageW-margin*2, h-24);
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(lines, margin+9, y+18);
    y += h-24+18;
  }

  header(1);
  doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(...azul); doc.text('REQUERIMIENTO A SISTEMAS', pageW/2, y, {align:'center'}); y += 24;
  boxTitle('SISTEMA AFECTADO:'); row('', data.sistema_nombre || '—', 26);
  y += 16;
  row('Nombre del RQM', data.proyecto || '—', 28);
  row('Número del RQM', `${data.numero_rqm || '—'}     Versión: ${data.version || '1'}`, 28);
  row('Descripción general', data.descripcion_general || '—', 68);
  y += 16;
  boxTitle('TIPO DE REQUERIMIENTO:'); row('', data.tipo_requerimiento || 'Proyecto', 26);
  y += 16;
  row('Prioridad', data.prioridad || '—', 28);
  row('Solicitante', data.solicitado_por || '—', 28);
  row('Área solicitante', data.area_nombre || '—', 28);
  row('Fecha de ingreso', fmtFecha(data.fecha_asignacion), 28);
  y += 16;
  boxTitle('AREAS IMPACTADAS:'); row('', data.areas_impactadas || '—', 32);
  y += 12;
  paragraphBox('DEPENDENCIAS PARA SALIDA A PRODUCCIÓN:', data.dependencias_produccion);
  paragraphBox('ANTECEDENTES:', data.antecedentes);
  paragraphBox('OBJETIVO:', data.objetivo || data.descripcion_general);
  paragraphBox('DESCRIPCIÓN / OBSERVACIONES:', data.descripcion_detallada || data.descripcion_general);
  footer(1);
  doc.save(`${(data.numero_rqm || 'Solicitud').replace(/\s+/g,'_')}.pdf`);
}

window.addEventListener('DOMContentLoaded', async () => {
  usuarioActual = await verificarSesion();
  if(!usuarioActual) return;
  pintarUsuario(usuarioActual);
  document.getElementById('ss-fecha').value = hoyISO();
  document.getElementById('form-self-service').addEventListener('submit', guardarSolicitud);
  await cargarCatalogos();
  await cargarMisSolicitudes();
  document.getElementById('mis-solicitudes')?.classList.add('collapsed');
  lucide.createIcons();
});
