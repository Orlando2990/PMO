// PMO Control - Autenticación y permisos por módulo
(function () {
  const SUPABASE_URL = "https://cogiyoslnmtnnvnohoht.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ2l5b3Nsbm10bm52bm9ob2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDI5NDQsImV4cCI6MjA5NjY3ODk0NH0.sikG94OCbALSbHRN8-jc2W_QOgP15qXn4VwsqhOK7lM";
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

  const ROLE_LABELS = { usuario:'Usuario', pmo:'PMO', direccion:'Dirección', administrador:'Administrador' };
  const LEVEL_LABELS = { none:'Sin acceso', read:'Solo consulta', manage:'Gestión' };
  const PAGE_MODULE = {
    'self_service.html':'selfservice','index.html':'matriz','solicitudes_rqm.html':'rqm',
    'importar_matriz.html':'importar','index_dashboard_ejecutivo.html':'dashboard',
    'seguimiento_ejecutivo.html':'seguimiento','admin_catalogos.html':'catalogos','usuarios.html':'usuarios'
  };
  const MODULE_ROUTE = {
    selfservice:'self_service.html', matriz:'index.html', rqm:'solicitudes_rqm.html',
    dashboard:'index_dashboard_ejecutivo.html', seguimiento:'seguimiento_ejecutivo.html',
    importar:'importar_matriz.html', catalogos:'admin_catalogos.html', usuarios:'usuarios.html'
  };
  const MODULE_ORDER=['selfservice','matriz','rqm','dashboard','seguimiento','importar','catalogos','usuarios'];
  const ROLE_DEFAULTS = {
    usuario:{selfservice:'manage'},
    pmo:{selfservice:'manage',matriz:'manage',rqm:'manage',dashboard:'read',seguimiento:'manage',catalogos:'read'},
    direccion:{selfservice:'manage',matriz:'read',rqm:'read',dashboard:'read',seguimiento:'read'},
    administrador:{selfservice:'manage',matriz:'manage',rqm:'manage',dashboard:'manage',seguimiento:'manage',importar:'manage',catalogos:'manage',usuarios:'manage'}
  };

  let currentUser=null, currentProfile=null, currentPermissions={}, guardPromise=null;
  function pageName(){return(location.pathname.split('/').pop()||'index.html').toLowerCase();}
  function cachedProfile(){try{return JSON.parse(localStorage.getItem('pmo_profile')||'null')}catch{return null}}
  function cachedPermissions(){try{return JSON.parse(localStorage.getItem('pmo_permissions')||'{}')}catch{return {}}}
  function cacheProfile(p){currentProfile=p||null;p?localStorage.setItem('pmo_profile',JSON.stringify(p)):localStorage.removeItem('pmo_profile')}
  function cachePermissions(p){currentPermissions=p||{};localStorage.setItem('pmo_permissions',JSON.stringify(currentPermissions))}
  function roleLabel(r){return ROLE_LABELS[r]||r||'Sin rol'}
  function levelLabel(l){return LEVEL_LABELS[l]||l||'Sin acceso'}
  function isRole(...roles){return roles.includes((currentProfile||cachedProfile())?.rol)}
  function defaultsForRole(role){return {...(ROLE_DEFAULTS[role]||{})}}
  function accessLevel(moduleCode){return currentPermissions[moduleCode]||cachedPermissions()[moduleCode]||'none'}
  function canView(moduleCode){return accessLevel(moduleCode)!=='none'}
  function canManage(moduleCode){return accessLevel(moduleCode)==='manage'}
  function moduleForPage(page=pageName()){return PAGE_MODULE[page]||null}
  function canAccess(page){const m=moduleForPage(page);return !m||canView(m)}
  function homeForPermissions(perms=currentPermissions){for(const m of MODULE_ORDER){if((perms[m]||'none')!=='none')return MODULE_ROUTE[m]}return'login.html'}
  function homeForRole(role){return homeForPermissions(Object.keys(currentPermissions).length?currentPermissions:defaultsForRole(role))}

  async function loadProfile(user){
    if(!client||!user)return null;
    const {data,error}=await client.from('pmo_user_profiles').select('user_id,nombre,correo,rol,area_id,activo').eq('user_id',user.id).maybeSingle();
    if(error)throw error;return data||null;
  }
  async function loadPermissions(user,profile){
    const fallback=defaultsForRole(profile?.rol);
    if(!client||!user)return fallback;
    const {data,error}=await client.from('pmo_user_module_access').select('module_code,access_level').eq('user_id',user.id);
    if(error){
      // Compatibilidad: mientras se ejecuta el SQL nuevo, el sistema sigue operando con la plantilla del rol.
      if(/does not exist|schema cache|relation/i.test(error.message||'')){console.warn('Permisos por módulo aún no instalados; se usan permisos por rol.');return fallback}
      throw error;
    }
    if(!data?.length)return fallback;
    const result={};for(const row of data)result[row.module_code]=row.access_level;
    return result;
  }
  function showAccessMessage(message,showHome=true){
    const home=homeForPermissions();

    // El shell agrega padding para sidebar/topbar. Al bloquear el acceso debemos
    // retirarlo para centrar la tarjeta contra la ventana completa del navegador.
    document.documentElement.style.width='100%';
    document.documentElement.style.height='100%';
    document.body.className='';
    document.body.removeAttribute('data-pmo-module');
    document.body.removeAttribute('data-pmo-access');
    document.body.style.cssText='margin:0!important;padding:0!important;width:100%!important;height:100%!important;min-height:100%!important;overflow:hidden!important;background:#f8fafc!important;';

    document.body.innerHTML=`<main aria-label="Acceso no disponible" style="position:fixed;inset:0;width:100vw;height:100dvh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:Arial,sans-serif;padding:24px;box-sizing:border-box;z-index:2147483647"><section style="width:min(100%,540px);margin:0;background:white;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 20px 45px rgba(15,23,42,.12);text-align:center"><div style="font-size:42px">🔐</div><h1 style="color:#0f172a;margin:16px 0 8px;font-size:22px;line-height:1.2">Acceso no disponible</h1><p style="color:#64748b;line-height:1.6;margin:0">${message}</p><div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:20px">${showHome&&home!=='login.html'?`<button onclick="location.href='${home}'" style="margin:0;background:#2563eb;color:white;border:0;border-radius:12px;padding:12px 18px;font-weight:800;cursor:pointer">Ir a mi inicio</button>`:''}<button onclick="PMOAuth.signOut()" style="margin:0;background:#0f172a;color:white;border:0;border-radius:12px;padding:12px 18px;font-weight:800;cursor:pointer">Cerrar sesión</button></div></section></main>`;
  }
  function paintIdentity(){const p=currentProfile||cachedProfile();document.getElementById('usuario-sesion')&&(document.getElementById('usuario-sesion').textContent=p?.nombre||p?.correo||currentUser?.email||'Usuario');document.getElementById('rol-sesion')&&(document.getElementById('rol-sesion').textContent=roleLabel(p?.rol))}

  const WRITE_WORDS=/guardar|crear|nuevo|editar|eliminar|borrar|convertir|aprobar|rechazar|ajuste|actualizarEstatus|importarMatriz|reprogramar|limpiarHistorial/i;
  const SAFE_WORDS=/export|descargar|pdf|copiar|ver|detalle|comentario|filtrar|buscar|actualizar\(\)|cargar|toggle|cerrar|scroll/i;
  function isWriteElement(el){
    if(el.matches?.('[data-pmo-write]'))return true;
    if(el.matches?.('[data-pmo-readonly-ok]'))return false;
    const onclick=el.getAttribute?.('onclick')||'';
    if(onclick&&SAFE_WORDS.test(onclick))return false;
    if(onclick&&WRITE_WORDS.test(onclick))return true;
    if(el.type==='submit')return true;
    return false;
  }
  function enforceReadOnly(moduleCode=moduleForPage()){
    if(!moduleCode||canManage(moduleCode))return;
    document.body.dataset.pmoAccess='read';
    const apply=()=>document.querySelectorAll('button,input[type="submit"],[data-pmo-write]').forEach(el=>{
      if(isWriteElement(el)){el.disabled=true;el.classList.add('pmo-readonly-disabled');el.title='Disponible únicamente con nivel Gestión';}
    });
    apply();new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',e=>{const el=e.target.closest('button,[data-pmo-write]');if(el&&isWriteElement(el)){e.preventDefault();e.stopImmediatePropagation();alert('Tu acceso a este módulo es de Solo consulta.');}},true);
  }
  async function doGuard(){
    if(!client)return null;
    const {data:{session},error}=await client.auth.getSession();if(error||!session){location.replace('login.html');return null}
    currentUser=session.user;
    let profile,permissions;
    try{profile=await loadProfile(currentUser);if(profile)permissions=await loadPermissions(currentUser,profile)}catch(err){console.error(err);showAccessMessage('No fue posible consultar tu perfil o permisos. Verifica la configuración en Supabase.',false);return null}
    if(!profile){showAccessMessage('Tu cuenta está autenticada, pero todavía no tiene un perfil asignado.',false);return null}
    if(profile.activo===false){showAccessMessage('Tu cuenta está desactivada. Contacta al administrador.',false);return null}
    cacheProfile(profile);cachePermissions(permissions||{});
    if(!canAccess(pageName())){showAccessMessage('No tienes permiso para consultar este módulo.');return null}
    paintIdentity();
    const moduleCode=moduleForPage();document.body.dataset.pmoModule=moduleCode||'';document.body.dataset.pmoAccess=moduleCode?accessLevel(moduleCode):'';
    window.dispatchEvent(new CustomEvent('pmo:profile-ready',{detail:{profile,permissions:currentPermissions}}));
    setTimeout(()=>enforceReadOnly(moduleCode),0);
    return{user:currentUser,profile,permissions:currentPermissions};
  }
  function guardPage(){if(!guardPromise)guardPromise=doGuard().finally(()=>guardPromise=null);return guardPromise}
  async function signOut(){cacheProfile(null);localStorage.removeItem('pmo_permissions');currentPermissions={};if(client)await client.auth.signOut();location.replace('login.html')}

  window.PMOAuth={client,guardPage,signOut,loadProfile,loadPermissions,cachedProfile,cachedPermissions,cacheProfile,cachePermissions,
    get user(){return currentUser},get profile(){return currentProfile||cachedProfile()},get permissions(){return Object.keys(currentPermissions).length?currentPermissions:cachedPermissions()},
    roleLabel,levelLabel,isRole,defaultsForRole,accessLevel,canView,canManage,moduleForPage,canAccess,homeForRole,homeForPermissions,paintIdentity,enforceReadOnly,
    MODULE_ROUTE,MODULE_ORDER,ROLE_DEFAULTS};
  window.cerrarSesion=signOut;
  document.addEventListener('DOMContentLoaded',()=>{if(pageName()!=='login.html')guardPage()});
})();
