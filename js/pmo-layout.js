// PMO Control - Shell reutilizable con navegación lateral por rol
(function () {
    const MODULES = {
        matriz: { title:'Matriz de requerimientos', subtitle:'Gestión operativa del portafolio', icon:'layers-3', active:'matriz', hideTopAccount:true },
        dashboard: { title:'Dashboard ejecutivo', subtitle:'Indicadores y salud del portafolio', icon:'layout-dashboard', active:'dashboard', hideTopAccount:true },
        seguimiento: { title:'Seguimiento ejecutivo', subtitle:'Roadmap, avances y reportes', icon:'route', active:'seguimiento', hideTopAccount:true },
        importar: { title:'Importar matriz', subtitle:'Carga masiva desde Excel', icon:'file-up', active:'importar', hideTopAccount:true },
        rqm: { title:'Control de RQM', subtitle:'Folios y solicitudes de requerimiento', icon:'clipboard-list', active:'rqm', hideTopAccount:true },
        selfservice: { title:'Portal de solicitudes', subtitle:'Alta y seguimiento de requerimientos', icon:'file-plus-2', active:'selfservice', hideTopAccount:true },
        catalogos: { title:'Catálogos', subtitle:'Configuración funcional del sistema', icon:'settings-2', active:'catalogos', hideTopAccount:true },
        usuarios: { title:'Usuarios y roles', subtitle:'Administración de accesos', icon:'users-round', active:'usuarios', hideTopAccount:true }
    };

    const NAV_GROUPS = [
        { label:'Trabajo', items:[
            { key:'selfservice', label:'Mis solicitudes', href:'self_service.html', icon:'file-plus-2', roles:['usuario','pmo','administrador'] },
            { key:'matriz', label:'Matriz', href:'index.html', icon:'list-checks', roles:['pmo','administrador'] },
            { key:'rqm', label:'Control RQM', href:'solicitudes_rqm.html', icon:'clipboard-list', roles:['pmo','administrador'] }
        ]},
        { label:'Análisis', items:[
            { key:'dashboard', label:'Dashboard', href:'index_dashboard_ejecutivo.html', icon:'layout-dashboard', roles:['pmo','direccion','administrador'] },
            { key:'seguimiento', label:'Seguimiento', href:'seguimiento_ejecutivo.html', icon:'route', roles:['pmo','direccion','administrador'] }
        ]},
        { label:'Administración', items:[
            { key:'importar', label:'Importar', href:'importar_matriz.html', icon:'file-up', roles:['administrador'] },
            { key:'catalogos', label:'Catálogos', href:'admin_catalogos.html', icon:'settings-2', roles:['administrador'] },
            { key:'usuarios', label:'Usuarios', href:'usuarios.html', icon:'users-round', roles:['administrador'] }
        ]}
    ];

    function detectModule() {
        const page=(location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if(page.includes('dashboard')) return 'dashboard';
        if(page.includes('seguimiento')) return 'seguimiento';
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
            items: group.items.filter(item => window.PMOAuth?.canView?.(item.key))
        })).filter(group => group.items.length).map(group => `
            <div class="pmo-side-group">
                <p class="pmo-side-label">${group.label}</p>
                ${group.items.map(item => `
                    <a href="${item.href}" class="pmo-side-link ${active===item.key?'active':''}">
                        <i data-lucide="${item.icon}"></i><span>${item.label}</span>
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
        const primaryHtml=canShowPrimary ? `
            <button onclick="${cfg.primaryAction}" class="pmo-top-primary">
                <i data-lucide="${cfg.primaryIcon}"></i><span>${cfg.primaryLabel}</span>
            </button>` : '';

        return `
        <div class="pmo-mobile-backdrop" onclick="PMOLayout.closeSidebar()"></div>
        <aside class="pmo-sidebar" aria-label="Navegación principal">
            <button class="pmo-side-brand" onclick="window.location.href='${home}'" title="Ir al inicio">
                <span class="pmo-side-logo"><i data-lucide="layers-3"></i></span>
                <span><strong>PMO Control</strong><small>Gestión de requerimientos</small></span>
            </button>
            <nav class="pmo-side-nav">${visibleGroups(role,cfg.active)}</nav>
            <div class="pmo-side-account">
                <div class="pmo-avatar">${initials(displayName)}</div>
                <div class="pmo-account-copy"><strong id="usuario-sesion">${displayName}</strong><small id="rol-sesion">${roleName}</small></div>
                <button class="pmo-account-menu" onclick="cerrarSesion()" title="Cerrar sesión"><i data-lucide="log-out"></i></button>
            </div>
        </aside>
        <header class="pmo-topbar">
            <button class="pmo-menu-toggle" onclick="PMOLayout.toggleSidebar()" aria-label="Abrir menú"><i data-lucide="menu"></i></button>
            <div class="pmo-top-title">
                <span class="pmo-top-icon"><i data-lucide="${cfg.icon}"></i></span>
                <div><h1>${cfg.title}</h1><p><span class="pmo-status-dot"></span>${cfg.subtitle}</p></div>
            </div>
            <div class="pmo-top-actions">
                ${accountHtml}
                ${primaryHtml}
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

    function toggleSidebar(){ document.body.classList.toggle('pmo-sidebar-open'); }
    function closeSidebar(){ document.body.classList.remove('pmo-sidebar-open'); }
    function toggleAccountMenu(){ document.getElementById('pmo-account-popover')?.classList.toggle('hidden'); }

    window.PMOLayout={
        renderHeader, mountHeader, toggleSidebar, closeSidebar, toggleAccountMenu,
        renderExecutiveHero(options={}) {
            const title=options.title || 'Seguimiento Ejecutivo del Portafolio';
            const subtitle=options.subtitle || 'Visualiza el avance por fases, KPIs, semáforos, desviaciones y reprogramaciones.';
            const pill=options.pill || 'Vista ejecutiva del portafolio';
            const actions=options.actions !== undefined ? options.actions : '';
            return `<section class="pmo-exec-hero"><div><div class="pmo-exec-pill"><i data-lucide="sparkles"></i> ${pill}</div><h2 class="pmo-exec-title">${title}</h2><p class="pmo-exec-subtitle">${subtitle}</p></div>${actions?`<div class="pmo-exec-actions">${actions}</div>`:''}</section>`;
        }
    };

    document.addEventListener('click', (e)=>{
        const pop=document.getElementById('pmo-account-popover');
        if(pop && !e.target.closest('.pmo-top-account') && !e.target.closest('#pmo-account-popover')) pop.classList.add('hidden');
    });
    document.addEventListener('DOMContentLoaded', mountHeader);
    window.addEventListener('pmo:profile-ready', () => { mountHeader(); window.PMOAuth?.paintIdentity?.(); });
})();
