let perfilesUsuarios=[];
let permisosUsuarios={};
let areasCatalogo=[], rolesBaseCatalogo=[];
const clientUsuarios=window.PMOAuth?.client;
const MODULOS=[
  {code:'rqm',name:'Buzón de RQM',desc:'Recepción, revisión, folios y aprobación de solicitudes',icon:'inbox'},
  {code:'matriz',name:'Matriz',desc:'Gestión operativa del portafolio',icon:'list-checks'},
  {code:'selfservice',name:'Mis solicitudes',desc:'Alta y seguimiento de solicitudes propias',icon:'file-plus-2'},
  {code:'dashboard',name:'Dashboard',desc:'Indicadores ejecutivos',icon:'layout-dashboard'},
  {code:'seguimiento',name:'Seguimiento',desc:'Roadmap, gráficas y reportes',icon:'route'},
  {code:'importar',name:'Importar',desc:'Carga masiva de la matriz',icon:'file-up'},
  {code:'catalogos',name:'Catálogos',desc:'Configuración funcional',icon:'settings-2'},
  {code:'proyectos',name:'Plataforma de Proyectos',desc:'Iniciativas y folios JIRA',icon:'briefcase-business'},
  {code:'portafolio',name:'Portafolio de productos',desc:'Seguimientos por producto',icon:'boxes'},
  {code:'dashboard_productos',name:'Dashboard de productos',desc:'Indicadores por producto',icon:'chart-no-axes-combined'},
  {code:'avisos',name:'Centro de Avisos',desc:'Consulta y publicación de comunicados',icon:'bell'},
  {code:'usuarios',name:'Usuarios',desc:'Cuentas, roles y permisos',icon:'users-round'}
];
function eu(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function rolBadge(rol){const c={administrador:'bg-violet-50 text-violet-700',pmo:'bg-blue-50 text-blue-700',direccion:'bg-amber-50 text-amber-700',usuario:'bg-slate-100 text-slate-700'}[rol]||'bg-slate-100';return `<span class="px-3 py-1 rounded-full text-xs font-black ${c}">${eu((rolesBaseCatalogo.find(r=>r.codigo===rol)?.nombre||window.PMOAuth.roleLabel(rol)))}</span>`;}
function nivelBadge(level){const c={none:'bg-rose-50 text-rose-700',read:'bg-amber-50 text-amber-700',manage:'bg-emerald-50 text-emerald-700'}[level]||'bg-slate-100';return `<span class="px-2.5 py-1 rounded-full text-[11px] font-black ${c}">${eu(window.PMOAuth.levelLabel(level))}</span>`;}
function plantillaRol(rol){return window.PMOAuth?.defaultsForRole?.(rol)||{};}
function permisosDe(id,rol){return permisosUsuarios[id]||plantillaRol(rol);}
async function cargarPerfiles(){
 const tbody=document.getElementById('tabla-usuarios');tbody.innerHTML='<tr><td colspan="6" class="p-10 text-center text-slate-400">Cargando perfiles y permisos...</td></tr>';
 const [{data,error},{data:access,error:accessError}]=await Promise.all([
  clientUsuarios.from('pmo_user_profiles').select('user_id,nombre,correo,rol,rol_base_codigo,activo,area_id,created_at,updated_at').order('nombre'),
  clientUsuarios.from('pmo_user_module_access').select('user_id,module_code,access_level')
 ]);
 if(error){tbody.innerHTML=`<tr><td colspan="6" class="p-10 text-center text-rose-600">${eu(error.message)}</td></tr>`;return;}
 permisosUsuarios={};
 if(!accessError)(access||[]).forEach(x=>{(permisosUsuarios[x.user_id]??={})[x.module_code]=x.access_level});
 perfilesUsuarios=data||[];renderPerfiles();renderKPIs();
}
function renderKPIs(){
 if(!document.getElementById('kpis-usuarios'))return;
 const items=[
  ['TOTAL',perfilesUsuarios.length],
  ['USUARIOS',perfilesUsuarios.filter(x=>x.rol==='usuario').length],
  ['PMO / DIRECCIÓN',perfilesUsuarios.filter(x=>['pmo','direccion'].includes(x.rol)).length],
  ['ACTIVOS',perfilesUsuarios.filter(x=>x.activo!==false).length]
 ];
 document.getElementById('kpis-usuarios').innerHTML=`
   <div class="w-full rounded-[28px] border border-slate-200 bg-white px-7 py-7 shadow-sm">
     <h3 class="text-2xl font-black text-slate-900">Resumen de Usuarios</h3>
     <div class="mt-4 h-[3px] w-full rounded-full bg-gradient-to-r from-orange-500 via-rose-400 to-blue-600"></div>
     <div class="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-5 text-center">
       ${items.map(x=>`<div><p class="text-3xl font-black text-red-500">${x[1]}</p><p class="mt-1 text-[11px] font-black uppercase text-slate-950">${x[0]}</p></div>`).join('')}
     </div>
   </div>`;
}
function resumenPermisos(p){const perms=permisosDe(p.user_id,p.rol);const n=MODULOS.filter(m=>(perms[m.code]||'none')!=='none').length;return `<span class="font-black text-slate-800">${n}</span><span class="text-slate-400"> / ${MODULOS.length} módulos</span>`;}
function renderPerfiles(){const q=(document.getElementById('buscar-usuario').value||'').toLowerCase();const rows=perfilesUsuarios.filter(p=>(`${p.nombre||''} ${p.correo||''}`).toLowerCase().includes(q));document.getElementById('tabla-usuarios').innerHTML=rows.length?rows.map(p=>`<tr><td class="p-4 font-black text-slate-900">${eu(p.nombre||'Sin nombre')}</td><td class="p-4 text-slate-600">${eu(p.correo||'—')}</td><td class="p-4">${rolBadge(p.rol_base_codigo||p.rol)}</td><td class="p-4 text-sm">${resumenPermisos(p)}</td><td class="p-4"><span class="inline-flex items-center gap-2 font-bold ${p.activo===false?'text-rose-600':'text-emerald-600'}"><span class="w-2.5 h-2.5 rounded-full ${p.activo===false?'bg-rose-500':'bg-emerald-500'}"></span>${p.activo===false?'Inactivo':'Activo'}</span></td><td class="p-4 text-right"><button onclick="abrirEditarUsuario('${p.user_id}')" class="px-4 py-2 rounded-xl border border-slate-200 font-black text-slate-700 inline-flex gap-2"><i data-lucide="pencil" class="w-4 h-4"></i>Editar</button><button onclick="eliminarUsuario('${p.user_id}')" title="Eliminar usuario" class="ml-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-black inline-flex gap-2"><i data-lucide="trash-2" class="w-4 h-4"></i>Eliminar</button></td></tr>`).join(''):'<tr><td colspan="6" class="p-10 text-center text-slate-400">No se encontraron perfiles.</td></tr>';lucide.createIcons();}
function optionsArea(current=''){return '<option value="">Sin área asignada</option>'+areasCatalogo.map(a=>`<option value="${eu(a.id)}" ${a.id===current?'selected':''}>${eu(a.nombre)}</option>`).join('')}
async function cargarCatalogosUsuarios(){
 const [a,r]=await Promise.all([clientUsuarios.from('cat_areas').select('id,nombre').order('nombre'),clientUsuarios.from('orbita_roles_base').select('codigo,nombre,permisos,seguridad_rol').order('codigo')]);
 areasCatalogo=a.data||[];rolesBaseCatalogo=r.data||[];
 if(a.error)console.warn('Áreas:',a.error.message);
 if(r.error)console.warn('Roles base (ejecuta SQL V3.3.03):',r.error.message);
 for(const prefix of ['edit','new']){
  document.getElementById(prefix+'-area').innerHTML=optionsArea();
  const select=document.getElementById(prefix+'-rol');
  select.innerHTML=(rolesBaseCatalogo.length?[...rolesBaseCatalogo].sort((a,b)=>{const order=['usuario','pmo','direccion','administrador'];const ai=order.indexOf(a.codigo),bi=order.indexOf(b.codigo);return (ai<0?99:ai)-(bi<0?99:bi)||a.nombre.localeCompare(b.nombre,'es')}):[{codigo:'usuario',nombre:'Usuario'},{codigo:'pmo',nombre:'PMO'},{codigo:'direccion',nombre:'Dirección'},{codigo:'administrador',nombre:'Administrador'}]).map(role=>`<option value="${eu(role.codigo)}">${eu(role.nombre)}</option>`).join('');
 }
}
function roleDefaults(rol){const r=rolesBaseCatalogo.find(x=>x.codigo===rol);return r?.permisos&&Object.keys(r.permisos).length?r.permisos:plantillaRol(r?.seguridad_rol||rol)}
function permissionGrid(prefix,permissions){return MODULOS.map(m=>`<div class="permission-row"><div class="permission-copy"><span class="permission-icon"><i data-lucide="${m.icon}"></i></span><div><strong>${m.name}</strong><small>${m.desc}</small></div></div><select id="${prefix}-perm-${m.code}" class="field permission-select" data-module="${m.code}"><option value="none">Sin acceso</option><option value="read">Solo consulta</option><option value="manage">Gestión</option></select></div>`).join('');}
function setPermissionValues(prefix,perms){MODULOS.forEach(m=>{const el=document.getElementById(`${prefix}-perm-${m.code}`);if(el)el.value=perms[m.code]||'none'});}
function readPermissionValues(prefix){const out={};MODULOS.forEach(m=>out[m.code]=document.getElementById(`${prefix}-perm-${m.code}`)?.value||'none');return out;}
async function applyRoleTemplate(prefix,role,ask=false){if(ask&&!(await PMOConfirm('Se reemplazarán los niveles seleccionados por la plantilla recomendada del rol.',{title:'Aplicar plantilla de permisos',confirmText:'Sí, aplicar'})))return;setPermissionValues(prefix,roleDefaults(role));lucide.createIcons();}
function setEditStatus(text,type='info'){const el=document.getElementById('edit-user-status');if(!el)return;el.className=`status-note ${type}${text?'':' hidden'}`;el.textContent=text;}
function abrirEditarUsuario(id){const p=perfilesUsuarios.find(x=>x.user_id===id);if(!p)return;document.getElementById('edit-user-id').value=p.user_id;document.getElementById('edit-nombre').value=p.nombre||'';document.getElementById('edit-correo').value=p.correo||'';document.getElementById('edit-password').value='';document.getElementById('edit-rol').value=p.rol_base_codigo||p.rol||'usuario';document.getElementById('edit-area').innerHTML=optionsArea(p.area_id);document.getElementById('edit-activo').checked=p.activo!==false;document.getElementById('edit-permissions-grid').innerHTML=permissionGrid('edit',permisosDe(p.user_id,p.rol));setPermissionValues('edit',permisosDe(p.user_id,p.rol));setEditStatus('','info');const editStatus=document.getElementById('edit-user-status');if(editStatus)editStatus.classList.add('hidden');document.getElementById('modal-usuario').classList.remove('hidden');lucide.createIcons();}
function cerrarModalUsuario(){document.getElementById('modal-usuario').classList.add('hidden');}
async function guardarPerfil(e){e.preventDefault();const btn=document.getElementById('btn-guardar-usuario');const password=document.getElementById('edit-password').value;const payload={user_id:document.getElementById('edit-user-id').value,nombre:document.getElementById('edit-nombre').value.trim(),correo:document.getElementById('edit-correo').value.trim().toLowerCase(),rol:rolesBaseCatalogo.find(x=>x.codigo===document.getElementById('edit-rol').value)?.seguridad_rol||'usuario',rol_base_codigo:document.getElementById('edit-rol').value,area_id:document.getElementById('edit-area').value||null,activo:document.getElementById('edit-activo').checked,permissions:readPermissionValues('edit')};if(password)payload.password=password;if(password&&password.length<8){setEditStatus('La nueva contraseña debe tener al menos 8 caracteres.','error');return;}btn.disabled=true;btn.textContent='Guardando...';try{const{data,error}=await clientUsuarios.functions.invoke('admin-update-user',{body:payload});if(error)throw error;if(data?.error)throw new Error(data.error);const selectedNew=Object.entries(payload.permissions).filter(([code,level])=>['proyectos','portafolio','dashboard_productos','avisos'].includes(code)&&level!=='none');if(selectedNew.length){const{data:verified,error:verifyError}=await clientUsuarios.from('pmo_user_module_access').select('module_code,access_level').eq('user_id',payload.user_id).in('module_code',selectedNew.map(([code])=>code));if(verifyError)throw new Error('No se pudo verificar que los permisos se guardaron: '+verifyError.message);const missing=selectedNew.filter(([code,level])=>!verified?.some(row=>row.module_code===code&&row.access_level===level));if(missing.length)throw new Error('La función de Supabase no guardó estos permisos: '+missing.map(([code])=>code).join(', ')+'. Actualiza la Edge Function admin-update-user incluida en este ZIP.')}const {data:checkedProfile,error:areaVerifyError}=await clientUsuarios.from('pmo_user_profiles').select('area_id,rol_base_codigo').eq('user_id',payload.user_id).single();if(areaVerifyError)throw new Error('No se pudo verificar el área: '+areaVerifyError.message);if(String(checkedProfile?.area_id||'')!==String(payload.area_id||''))throw new Error('El área no se guardó en Supabase. Debes desplegar la Edge Function admin-update-user de este ZIP antes de continuar.');if(checkedProfile?.rol_base_codigo!==payload.rol_base_codigo)throw new Error('El Rol Base no se guardó. Actualiza la Edge Function admin-update-user incluida en el ZIP.');setEditStatus('Usuario y permisos actualizados correctamente.','success');await cargarPerfiles();setTimeout(cerrarModalUsuario,800)}catch(err){console.error(err);let detalle=err?.message||String(err);try{if(err?.context instanceof Response){const body=await err.context.clone().json();detalle=body?.error||body?.message||detalle}}catch{}setEditStatus(`No se pudo actualizar: ${detalle}`,'error')}finally{btn.disabled=false;btn.textContent='Guardar cambios'}}
function abrirNuevoUsuario(){document.getElementById('form-nuevo-usuario').reset();document.getElementById('new-area').innerHTML=optionsArea();document.getElementById('new-activo').checked=true;document.getElementById('new-permissions-grid').innerHTML=permissionGrid('new',{});setPermissionValues('new',{});setNuevoStatus('','info');document.getElementById('modal-nuevo-usuario').classList.remove('hidden');lucide.createIcons();}
function cerrarNuevoUsuario(){document.getElementById('modal-nuevo-usuario').classList.add('hidden');}
function setNuevoStatus(text,type='info'){const el=document.getElementById('nuevo-user-status');el.className=`status-note ${type}${text?'':' hidden'}`;el.textContent=text;}
async function crearUsuario(e){e.preventDefault();const btn=document.getElementById('btn-crear-usuario');btn.disabled=true;btn.innerHTML='<span class="animate-pulse">Creando...</span>';const payload={nombre:document.getElementById('new-nombre').value.trim(),correo:document.getElementById('new-correo').value.trim().toLowerCase(),rol:rolesBaseCatalogo.find(x=>x.codigo===document.getElementById('new-rol').value)?.seguridad_rol||'usuario',rol_base_codigo:document.getElementById('new-rol').value,area_id:document.getElementById('new-area').value||null,password:document.getElementById('new-password').value,activo:document.getElementById('new-activo').checked,permissions:readPermissionValues('new')};try{const{data,error}=await clientUsuarios.functions.invoke('admin-create-user',{body:payload});if(error)throw error;if(data?.error)throw new Error(data.error);setNuevoStatus('Usuario y permisos creados correctamente.','success');await cargarPerfiles();setTimeout(cerrarNuevoUsuario,900)}catch(err){console.error(err);let detalle=err?.message||String(err);try{if(err?.context instanceof Response){const body=await err.context.clone().json();detalle=body?.error||body?.message||detalle}}catch{}setNuevoStatus(`No se pudo crear: ${detalle}`,'error')}finally{btn.disabled=false;btn.innerHTML='<i data-lucide="user-plus" class="w-4 h-4"></i>Crear usuario';lucide.createIcons()}}
window.abrirNuevoUsuario=abrirNuevoUsuario;window.cerrarNuevoUsuario=cerrarNuevoUsuario;window.cargarPerfiles=cargarPerfiles;window.abrirEditarUsuario=abrirEditarUsuario;window.cerrarModalUsuario=cerrarModalUsuario;window.applyRoleTemplate=applyRoleTemplate;
window.addEventListener('DOMContentLoaded',async()=>{const auth=await window.PMOAuth.guardPage();if(!auth)return;document.getElementById('hero-usuarios').innerHTML=window.PMOLayout.renderExecutiveHero({title:'Usuarios, roles y permisos',subtitle:'Asigna a cada persona Sin acceso, Solo consulta o Gestión por módulo.'});document.getElementById('buscar-usuario').addEventListener('input',renderPerfiles);document.getElementById('form-usuario').addEventListener('submit',guardarPerfil);document.getElementById('form-nuevo-usuario').addEventListener('submit',crearUsuario);document.getElementById('edit-rol').addEventListener('change',e=>applyRoleTemplate('edit',e.target.value,true));document.getElementById('new-rol').addEventListener('change',e=>applyRoleTemplate('new',e.target.value,false));await cargarCatalogosUsuarios();await cargarPerfiles();lucide.createIcons();});

async function eliminarUsuario(id){
 const p=perfilesUsuarios.find(x=>x.user_id===id);if(!p)return;
 if(id===window.PMOAuth?.user?.id){await PMOAlert('No puedes eliminar tu propia cuenta de administrador.',{type:'error'});return;}
 if(!window.PMOConfirm){await PMOAlert('No está disponible la confirmación segura.',{type:'error'});return;}
 const ok=await PMOConfirm(`Se eliminará la cuenta de ${p.nombre||p.correo} y sus accesos. Esta acción es irreversible.`,{title:'Eliminar usuario',confirmText:'Sí, eliminar',cancelText:'Cancelar'});if(!ok)return;
 try{const {data,error}=await clientUsuarios.functions.invoke('admin-delete-user',{body:{user_id:id}});if(error)throw error;if(data?.error)throw new Error(data.error);if(!data?.deleted)throw new Error('No se confirmó la eliminación en Auth.');await cargarPerfiles();await PMOAlert('Usuario eliminado correctamente.',{title:'Usuario eliminado'});}catch(err){await PMOAlert('No fue posible eliminar: '+(err?.message||err)+'. Verifica que la función admin-delete-user esté desplegada.',{type:'error'})}
}
