// PMO Control - Layout reutilizable
// Encabezado, navegación y estilos ejecutivos centralizados.
(function () {
    const MODULES = {
        matriz: {
            title: 'PMO Control',
            subtitle: 'Gestión de Requerimientos y Catálogos',
            icon: 'layers',
            active: 'matriz',
            primaryLabel: 'Nuevo Requerimiento',
            primaryIcon: 'plus',
            primaryAction: 'abrirModalNuevo()'
        },
        dashboard: {
            title: 'Dashboard Ejecutivo',
            subtitle: 'Vista ejecutiva de indicadores y estatus',
            icon: 'layout-dashboard',
            active: 'dashboard',
            primaryLabel: 'Nuevo Requerimiento',
            primaryIcon: 'plus',
            primaryAction: 'abrirModalNuevo()'
        },
        seguimiento: {
            title: 'Seguimiento Ejecutivo',
            subtitle: 'Vista integral del avance de requerimientos GAP',
            icon: 'route',
            active: 'seguimiento'
        },
        importar: {
            title: 'Importar Matriz',
            subtitle: 'Carga masiva de requerimientos desde Excel',
            icon: 'file-up',
            active: 'importar'
        },
        rqm: {
            title: 'Control de RQM',
            subtitle: 'Control de números de requerimiento',
            icon: 'clipboard-list',
            active: 'rqm',
            primaryLabel: 'Nuevo RQM',
            primaryIcon: 'plus',
            primaryAction: 'abrirModalRQM()'
        },
        catalogos: {
            title: 'Catálogos',
            subtitle: 'Administración de catálogos PMO Control',
            icon: 'settings',
            active: 'catalogos'
        }
    };

    const NAV = [
        { key: 'matriz', label: 'Matriz', href: 'index.html', icon: 'list-checks' },
        { key: 'rqm', label: 'Control RQM', href: 'solicitudes_rqm.html', icon: 'clipboard-list' },
        { key: 'dashboard', label: 'Dashboard', href: 'index_dashboard_ejecutivo.html', icon: 'layout-dashboard' },
        { key: 'seguimiento', label: 'Seguimiento', href: 'seguimiento_ejecutivo.html', icon: 'route' },
        { key: 'importar', label: 'Importar', href: 'importar_matriz.html', icon: 'file-up' }
    ];

    function detectModule() {
        const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if (page.includes('dashboard')) return 'dashboard';
        if (page.includes('seguimiento')) return 'seguimiento';
        if (page.includes('importar')) return 'importar';
        if (page.includes('solicitudes_rqm')) return 'rqm';
        if (page.includes('admin_catalogos')) return 'catalogos';
        return 'matriz';
    }

    function renderHeader(moduleKey) {
        const key = moduleKey || detectModule();
        const cfg = MODULES[key] || MODULES.matriz;
        const navHtml = NAV.map(item => `
            <button onclick="window.location.href='${item.href}'" class="nav-btn ${cfg.active === item.key ? 'active' : ''}">
                <i data-lucide="${item.icon}" class="w-4 h-4"></i>${item.label}
            </button>`).join('');
        const primaryHtml = cfg.primaryLabel ? `
            <button onclick="${cfg.primaryAction}" class="nav-primary">
                <i data-lucide="${cfg.primaryIcon}" class="w-4 h-4"></i>${cfg.primaryLabel}
            </button>` : '';

        return `
        <header class="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
            <div class="pmo-header-shell">
                <div class="pmo-brand" onclick="window.location.href='index.html'" title="Regresar al inicio">
                    <div class="pmo-brand-icon"><i data-lucide="${cfg.icon}" class="w-6 h-6"></i></div>
                    <div class="min-w-0">
                        <h1 class="pmo-brand-title">${cfg.title}</h1>
                        <p class="pmo-brand-subtitle"><span class="pmo-status-dot"></span>${cfg.subtitle}</p>
                    </div>
                </div>
                <div class="pmo-nav">
                    ${navHtml}
                    <div class="nav-user">
                        <i data-lucide="user-check" class="w-4 h-4 text-emerald-600"></i>
                        <span id="usuario-sesion" class="text-xs font-bold text-slate-600 max-w-[170px] truncate">Usuario</span>
                    </div>
                    <button onclick="cerrarSesion()" class="nav-logout"><i data-lucide="log-out" class="w-4 h-4"></i>Salir</button>
                    ${primaryHtml}
                </div>
            </div>
        </header>`;
    }

    function mountHeader() {
        const mount = document.getElementById('pmo-app-header');
        if (!mount) return;
        mount.innerHTML = renderHeader(mount.dataset.pmoModule);
        if (window.lucide) window.lucide.createIcons();
    }

    window.PMOLayout = {
        renderHeader,
        mountHeader,
        renderExecutiveHero(options = {}) {
            const title = options.title || 'Seguimiento Ejecutivo del Portafolio <br class="hidden sm:block">';
            const subtitle = options.subtitle || 'Visualiza el avance por fases, KPIs, semáforos, desviaciones y reprogramaciones.';
            const pill = options.pill || 'Vista ejecutiva del portafolio';
            const actions = (options.actions !== undefined) ? options.actions : '';
            return `
                <section class="pmo-exec-hero">
                    <div>
                        <div class="pmo-exec-pill"><i data-lucide="sparkles" class="w-4 h-4"></i> ${pill}</div>
                        <h2 class="pmo-exec-title">${title}</h2>
                        <p class="pmo-exec-subtitle">${subtitle}</p>
                    </div>
                    <div class="pmo-exec-actions">${actions}</div>
                </section>`;
        }
    };

    document.addEventListener('DOMContentLoaded', mountHeader);
})();
