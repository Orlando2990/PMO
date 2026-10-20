// PMO Control - Shell reutilizable con navegación lateral por rol
(function () {
    const MODULES = {
        matriz: { title:'Matriz de requerimientos', subtitle:'Gestión operativa del portafolio', icon:'layers-3', active:'matriz', hideTopAccount:true },
        avisos: { title:'Centro de Avisos', subtitle:'Comunicados y novedades de GAP', icon:'bell', active:'avisos', hideTopAccount:true },
        proyectos: { title:'Plataforma de Proyectos', subtitle:'Iniciativas, JIRA y seguimiento transversal', icon:'briefcase-business', active:'proyectos', hideTopAccount:true },
        dashboard: { title:'Dashboard ejecutivo', subtitle:'Indicadores y salud del portafolio', icon:'layout-dashboard', active:'dashboard', hideTopAccount:true },
        seguimiento: { title:'Seguimiento ejecutivo', subtitle:'Roadmap, avances y reportes', icon:'route', active:'seguimiento', hideTopAccount:true },
        portafolio: { title:'Portafolio de productos', subtitle:'Seguimiento ejecutivo por sistema y producto', icon:'boxes', active:'portafolio', hideTopAccount:true },
        dashboard_productos: { title:'Dashboard de productos', subtitle:'Indicadores y salud del portafolio de productos', icon:'chart-no-axes-combined', active:'dashboard_productos', hideTopAccount:true },
        importar: { title:'Importar matriz', subtitle:'Carga masiva desde Excel', icon:'file-up', active:'importar', hideTopAccount:true },
        rqm: { title:'Buzón de RQM', subtitle:'Recepción, folios y revisión de requerimientos', icon:'clipboard-list', active:'rqm', hideTopAccount:true },
        selfservice: { title:'Portal de solicitudes', subtitle:'Alta y seguimiento de requerimientos', icon:'file-plus-2', active:'selfservice', hideTopAccount:true },
        catalogos: { title:'Catálogos', subtitle:'Configuración funcional del sistema', icon:'settings-2', active:'catalogos', hideTopAccount:true },
        usuarios: { title:'Usuarios y roles', subtitle:'Administración de accesos', icon:'users-round', active:'usuarios', hideTopAccount:true }
    };

    const NAV_GROUPS = [
        { label:'Trabajo', items:[
            { key:'rqm', label:'Buzón de RQM', href:'solicitudes_rqm.html', icon:'inbox', roles:['pmo','administrador'] },
            { key:'matriz', label:'Matriz', href:'index.html', icon:'list-checks', roles:['pmo','administrador'] },
            { key:'selfservice', label:'Mis solicitudes', href:'self_service.html', icon:'file-plus-2', roles:['usuario','pmo','administrador'] }
        ]},
        { label:'Análisis', items:[
            { key:'proyectos', label:'Plataforma de Proyectos', href:'plataforma_proyectos_mockup.html', icon:'briefcase-business', roles:['pmo','direccion','administrador'] },
            { key:'dashboard', label:'Dashboard', href:'index_dashboard_ejecutivo.html', icon:'layout-dashboard', roles:['pmo','direccion','administrador'] },
            { key:'seguimiento', label:'Seguimiento', href:'seguimiento_ejecutivo.html', icon:'route', roles:['pmo','direccion','administrador'] },
            { key:'portafolio', label:'Portafolio productos', href:'portafolio_productos.html', icon:'boxes', roles:['pmo','direccion','administrador'] },
            { key:'dashboard_productos', label:'Dashboard productos', href:'dashboard_portafolio_productos.html', icon:'chart-no-axes-combined', roles:['pmo','direccion','administrador'] }
        ]},
        { label:'Comunicación', items:[
            { key:'avisos', label:'Centro de Avisos', href:'centro_avisos_mockup.html', icon:'bell', roles:['usuario','pmo','direccion','administrador'] }
        ]},
        { label:'Administración', items:[
            { key:'importar', label:'Importar', href:'importar_matriz.html', icon:'file-up', roles:['administrador'] },
            { key:'catalogos', label:'Catálogos', href:'admin_catalogos.html', icon:'settings-2', roles:['administrador'] },
            { key:'usuarios', label:'Usuarios', href:'usuarios.html', icon:'users-round', roles:['administrador'] }
        ]}
    ];

    function detectModule() {
        const page=(location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if(page.includes('centro_avisos')) return 'avisos';
        if(page.includes('plataforma_proyectos')) return 'proyectos';
        if(page.includes('dashboard_portafolio_productos')) return 'dashboard_productos';
        if(page.includes('dashboard')) return 'dashboard';
        if(page.includes('seguimiento')) return 'seguimiento';
        if(page.includes('portafolio_productos')) return 'portafolio';
        if(page.includes('importar')) return 'importar';
        if(page.includes('solicitudes_rqm')) return 'rqm';
        if(page.includes('admin_catalogos')) return 'catalogos';
        if(page.includes('self_service')) return 'selfservice';
        if(page.includes('usuarios')) return 'usuarios';
        return 'matriz';
    }

    function initials(name='Usuario') {
        return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    }

    function visibleGroups(role, active) {
        return NAV_GROUPS.map(group => ({
            ...group,
            items: group.items.filter(item => window.PMOAuth?.canView?.(item.permissionKey || item.key))
        })).filter(group => group.items.length).map(group => `
            <div class="pmo-side-group">
                <p class="pmo-side-label">${group.label}</p>
                ${group.items.map(item => `
                    <a href="${item.href}" class="pmo-side-link ${active===item.key?'active':''}">
                        <i data-lucide="${item.icon}"></i><span>${item.label}</span>
                        ${item.key==='avisos'?'<span class="pmo-side-notice-count" id="pmo-side-notice-count" aria-label="Avisos pendientes" hidden></span>':''}
                    </a>`).join('')}
            </div>`).join('');
    }

    function renderHeader(moduleKey) {
        const key=moduleKey || detectModule();
        const cfg=MODULES[key] || MODULES.matriz;
        const profile=window.PMOAuth?.profile || window.PMOAuth?.cachedProfile?.() || null;
        const role=profile?.rol || 'usuario';
        const home=window.PMOAuth?.homeForPermissions?.() || 'login.html';
        const displayName=profile?.nombre || profile?.correo || 'Usuario';
        const roleName=window.PMOAuth?.roleLabel?.(role) || role;
        const canShowPrimary=cfg.primaryLabel && (!cfg.primaryRoles || cfg.primaryRoles.includes(role));
        const accountHtml=cfg.hideTopAccount ? '' : `
                <button class="pmo-top-account" onclick="PMOLayout.toggleAccountMenu()">
                    <span class="pmo-avatar mini">${initials(displayName)}</span>
                    <span><strong>${displayName}</strong><small>${roleName}</small></span>
                    <i data-lucide="chevron-down"></i>
                </button>`;
        const noticeBell=window.PMOAuth?.canView?.('avisos') ? `
            <button type="button" id="pmo-notice-bell" class="pmo-notice-bell" aria-label="Avisos pendientes" aria-expanded="false" aria-controls="pmo-notice-popover" title="Avisos pendientes" onclick="PMOLayout.toggleNotifications()">
                <i data-lucide="bell"></i><span class="pmo-notice-count" id="pmo-notice-top-count" hidden></span>
            </button>` : '';
        const primaryHtml=canShowPrimary ? `
            <button onclick="${cfg.primaryAction}" class="pmo-top-primary">
                <i data-lucide="${cfg.primaryIcon}"></i><span>${cfg.primaryLabel}</span>
            </button>` : '';

        return `
        <aside class="pmo-sidebar" aria-label="Navegación principal">
            <button class="pmo-side-brand" onclick="window.location.href='${home}'" title="Ir al inicio">
                <span class="pmo-side-logo"><img src="assets/orbita-icon.png" alt="ORBITA" style="width:100%;height:100%;object-fit:contain;background:white;border-radius:9px;padding:2px"></span>
                <span><strong>ORBITA</strong><small>Plataforma de GAP</small></span>
            </button>
            <nav class="pmo-side-nav">${visibleGroups(role,cfg.active)}</nav>
            <div class="pmo-side-account">
                <div class="pmo-avatar">${initials(displayName)}</div>
                <div class="pmo-account-copy"><strong id="usuario-sesion">${displayName}</strong><small id="rol-sesion">${roleName}</small></div>
                <button class="pmo-account-menu" onclick="cerrarSesion()" title="Cerrar sesión"><i data-lucide="log-out"></i></button>
            </div>
        </aside>
        <header class="pmo-topbar">
            <div class="pmo-top-title">
                <span class="pmo-top-icon"><i data-lucide="${cfg.icon}"></i></span>
                <div><h1>${cfg.title}</h1><p><span class="pmo-status-dot"></span>${cfg.subtitle}</p></div>
            </div>
            <div class="pmo-top-actions">
                ${noticeBell}
                ${accountHtml}
                ${primaryHtml}
            </div>
            <div id="pmo-notice-popover" class="pmo-notice-popover hidden" role="dialog" aria-label="Avisos pendientes">
                <div class="pmo-notice-popover-head"><span><i data-lucide="bell-ring"></i> Avisos pendientes</span><button type="button" aria-label="Cerrar notificaciones" onclick="PMOLayout.toggleNotifications(false)"><i data-lucide="x"></i></button></div>
                <div id="pmo-notice-items" class="pmo-notice-items"><p class="pmo-notice-empty">Consultando avisos…</p></div>
                <a class="pmo-notice-all" href="centro_avisos_mockup.html">Ir al Centro de Avisos <i data-lucide="arrow-right"></i></a>
            </div>
            <div id="pmo-account-popover" class="pmo-account-popover hidden">
                <div><strong>${displayName}</strong><span>${profile?.correo || ''}</span></div>
                <button onclick="cerrarSesion()"><i data-lucide="log-out"></i>Cerrar sesión</button>
            </div>
        </header>`;
    }

    function mountHeader() {
        const mount=document.getElementById('pmo-app-header');
        if(!mount) return;
        document.body.classList.add('pmo-shell-enabled');
        mount.innerHTML=renderHeader(mount.dataset.pmoModule);
        if(window.lucide) window.lucide.createIcons();
    }

    // Centro de Avisos: notificación discreta en toda la plataforma.
    // La tabla orbita_avisos conserva la segmentación/RLS; las lecturas son por usuario.
    let noticeUserId=null, noticeTimer=null, noticeRefreshPending=false, notices=[], noticesLoaded=false;
    const locallyReadNotices=new Set();
    const noticeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function isNoticeForUser(n,profile){
        const audience=String(n.alcance||'general').toLowerCase();
        const area=String(profile?.area_id||'');
        // Coincidir con el código de rol que evalúa orbita_puede_ver_aviso en Supabase.
        const role=String(profile?.rol||'').toLowerCase();
        const areaMatches=Array.isArray(n.areas)&&n.areas.some(a=>String(a)===area);
        const roleMatches=Array.isArray(n.perfiles)&&n.perfiles.some(r=>String(r).toLowerCase()===role);
        if(audience==='general')return true;
        if(audience==='area')return areaMatches;
        if(audience==='perfil')return roleMatches;
        if(audience==='ambos')return areaMatches&&roleMatches;
        return false;
    }
    function renderNoticeIndicators(){
        const count=notices.length;
        [document.getElementById('pmo-notice-top-count'),document.getElementById('pmo-side-notice-count')].forEach(el=>{
            if(!el)return;
            el.hidden=count===0;
            el.textContent=count>99?'99+':String(count);
            el.title=count===1?'1 aviso sin leer':count+' avisos sin leer';
        });
        const bell=document.getElementById('pmo-notice-bell');
        if(bell)bell.setAttribute('aria-label',count?`${count} avisos sin leer`:'No tienes avisos pendientes');
        const list=document.getElementById('pmo-notice-items');
        if(!list)return;
        if(!noticesLoaded){list.innerHTML='<p class="pmo-notice-empty">Consultando avisos…</p>';return;}
        if(!count){list.innerHTML='<p class="pmo-notice-empty"><span aria-hidden="true">✓</span> Estás al día. No tienes avisos pendientes.</p>';return;}
        list.innerHTML=notices.slice(0,5).map(n=>`<a class="pmo-notice-item" href="centro_avisos_mockup.html?aviso=${encodeURIComponent(n.id)}"><span class="pmo-notice-item-icon">${n.importante?'!':'●'}</span><span><strong>${noticeHTML(n.titulo)}</strong><small>${noticeHTML(n.categoria||'Comunicado')} · Sin leer</small></span><i data-lucide="chevron-right"></i></a>`).join('')+(count>5?`<p class="pmo-notice-more">Y ${count-5} aviso(s) más en el Centro de Avisos</p>`:'');
        if(window.lucide)window.lucide.createIcons();
    }
    async function refreshNotices(){
        const auth=window.PMOAuth, user=auth?.user, profile=auth?.profile, client=auth?.client;
        if(!client||!user||!profile||!auth.canView?.('avisos'))return;
        if(noticeRefreshPending)return;
        noticeRefreshPending=true;
        try{
            // Los usuarios de Consulta sólo recuperan registros permitidos por RLS.
            // Gestión puede ver avisos ajenos; se filtran también para su campana.
            const [{data:records,error:recordsError},{data:readRows,error:readsError}]=await Promise.all([
                client.from('orbita_avisos').select('id,titulo,categoria,importante,estado,alcance,areas,perfiles,publicado_en,creado_en').eq('estado','publicado').order('publicado_en',{ascending:false}),
                client.from('orbita_avisos_lecturas').select('aviso_id').eq('usuario_id',user.id)
            ]);
            if(recordsError||readsError)throw(recordsError||readsError);
            if(window.PMOAuth?.user?.id!==user.id)return;
            const readSet=new Set((readRows||[]).map(r=>r.aviso_id));
            for(const id of readSet)locallyReadNotices.delete(id);
            notices=(records||[]).filter(n=>isNoticeForUser(n,profile)&&!readSet.has(n.id)&&!locallyReadNotices.has(n.id));
            noticesLoaded=true;
            renderNoticeIndicators();
        }catch(err){
            // Ante errores de red o RLS no inventamos un contador ni mostramos comunicados restringidos.
            console.warn('ORBITA: no se pudo actualizar el contador de avisos:',err?.message||err);
        }finally{noticeRefreshPending=false}
    }
    function toggleNotifications(force){
        const pop=document.getElementById('pmo-notice-popover');
        if(!pop)return;
        const open=typeof force==='boolean'?force:pop.classList.contains('hidden');
        pop.classList.toggle('hidden',!open);
        document.getElementById('pmo-notice-bell')?.setAttribute('aria-expanded',String(open));
        if(open){renderNoticeIndicators();refreshNotices()}
    }
    function startNotifications(){
        const auth=window.PMOAuth, user=auth?.user;
        if(!user||!auth?.canView?.('avisos'))return;
        if(noticeUserId===user.id){renderNoticeIndicators();return;}
        noticeUserId=user.id;
        notices=[];noticesLoaded=false;locallyReadNotices.clear();
        if(noticeTimer)clearInterval(noticeTimer);
        noticeTimer=setInterval(()=>{if(!document.hidden)refreshNotices()},60000);
        refreshNotices();
    }
    function noticeRead(id){
        locallyReadNotices.add(id);
        notices=notices.filter(n=>n.id!==id);
        noticesLoaded=true;
        renderNoticeIndicators();
        // Notificar a otras pestañas de ORBITA cuando cambie una lectura.
        try{localStorage.setItem('orbita:avisos:actualizados',String(Date.now()))}catch{}
    }
    window.addEventListener('orbita:aviso-leido',e=>{if(e.detail?.id)noticeRead(e.detail.id);else refreshNotices()});
    window.addEventListener('orbita:avisos-cambiaron',()=>refreshNotices());
    window.addEventListener('storage',e=>{if(e.key==='orbita:avisos:actualizados')refreshNotices()});
    window.addEventListener('focus',refreshNotices);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshNotices()});

    function toggleSidebar(){ document.body.classList.toggle('pmo-sidebar-open'); }
    function closeSidebar(){ document.body.classList.remove('pmo-sidebar-open'); }
    function toggleAccountMenu(){ document.getElementById('pmo-account-popover')?.classList.toggle('hidden'); }

    window.PMOLayout={
        renderHeader, mountHeader, toggleSidebar, closeSidebar, toggleAccountMenu, toggleNotifications, refreshNotices,
        renderExecutiveHero(options={}) {
            const title=options.title || 'Seguimiento Ejecutivo del Portafolio';
            const actions=options.actions !== undefined ? options.actions : '';
            return `<section class="pmo-exec-hero"><div><h2 class="pmo-exec-title">${title}</h2></div>${actions?`<div class="pmo-exec-actions">${actions}</div>`:''}</section>`;
        }
    };

    document.addEventListener('click', (e)=>{
        const pop=document.getElementById('pmo-account-popover');
        if(pop && !e.target.closest('.pmo-top-account') && !e.target.closest('#pmo-account-popover')) pop.classList.add('hidden');
        if(!e.target.closest('#pmo-notice-popover')&&!e.target.closest('#pmo-notice-bell'))toggleNotifications(false);
    });
    document.addEventListener('DOMContentLoaded', mountHeader);
    window.addEventListener('pmo:profile-ready', () => { mountHeader(); window.PMOAuth?.paintIdentity?.(); startNotifications(); });
})();
