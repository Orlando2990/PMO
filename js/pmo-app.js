const SUPABASE_URL = "https://cogiyoslnmtnnvnohoht.supabase.co";
        const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ2l5b3Nsbm10bm52bm9ob2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDI5NDQsImV4cCI6MjA5NjY3ODk0NH0.sikG94OCbALSbHRN8-jc2W_QOgP15qXn4VwsqhOK7lM";

        const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        

        async function verificarSesion() {
            const { data: { session }, error } = await _supabase.auth.getSession();

            if (error || !session) {
                window.location.href = 'login.html';
                return null;
            }

            return session.user;
        }

        async function cerrarSesion() {
            await _supabase.auth.signOut();
            window.location.href = 'login.html';
        }

        function pintarUsuarioSesion(user) {
            const el = document.getElementById('usuario-sesion');
            if (!el || !user) return;
            el.textContent = user.email || 'Usuario';
        }

let todosLosProyectos = [];
        let conteoCambiosGlobal = {};
        let conteoReprogramacionesGlobal = {};
        let ajustesAdministrativosGlobal = {};
        let proyectoSeleccionadoOriginal = null;
        let cats = { sprints: [], sistemas: [], areas: [], clasificaciones: [], prioridades: [], complejidades: [], estatus: [], motivos_reprogramacion: [] };

        function toggleAdminPanel() { document.getElementById('panel-admin').classList.toggle('hidden'); }

        async function cargarTodo() {
            await cargarCatalogos();
            await cargarProyectos();
        }

        async function cargarCatalogos() {
            try {
                const s = await _supabase.from('cat_sprints').select('*').order('nombre');
                const sis = await _supabase.from('cat_sistemas').select('*').order('nombre');
                const a = await _supabase.from('cat_areas').select('*').order('nombre');
                const c = await _supabase.from('cat_clasificaciones').select('*').order('nombre');
                const pri = await _supabase.from('cat_prioridades').select('*').order('orden').order('nombre');
                const comp = await _supabase.from('cat_complejidades').select('*').order('orden').order('nombre');
                const est = await _supabase.from('cat_estatus').select('*').order('nombre');
                const mot = await _supabase.from('cat_motivos_reprogramacion').select('*').order('nombre');

                cats.sprints = s.data || [];
                cats.sistemas = sis.data || [];
                cats.areas = a.data || [];
                cats.clasificaciones = c.data || [];
                cats.prioridades = pri.data || [];
                cats.complejidades = comp.data || [];
                cats.estatus = est.data || [];
                cats.motivos_reprogramacion = mot.data || [];

                llenarSelectsForm();
                llenarMotivosReprogramacion();
                llenarFiltroEstatus();
                llenarFiltroSistema();
                llenarFiltroSprint();
                renderizarListasAdmin();
            } catch (err) { console.error("Error al cargar catálogos:", err.message); }
        }

        function llenarSelectsForm() {
            document.getElementById('form-sprint').innerHTML = optionsTemplate(cats.sprints);
            document.getElementById('form-sistema').innerHTML = optionsTemplate(cats.sistemas);
            document.getElementById('form-area').innerHTML = optionsTemplate(cats.areas);
            document.getElementById('form-clasificacion').innerHTML = optionsTemplate(cats.clasificaciones);
            document.getElementById('form-prioridad').innerHTML = cats.prioridades.map(x=>`<option value="${x.nombre}">${x.nombre.toUpperCase()}</option>`).join('');
            document.getElementById('form-complejidad').innerHTML = cats.complejidades.map(x=>`<option value="${x.nombre}">${x.nombre.toUpperCase()}</option>`).join('');
            document.getElementById('form-estatus').innerHTML = cats.estatus.map(x =>
                `<option value="${x.nombre}">${x.nombre.toUpperCase()}</option>`
            ).join('') || '<option value="BACKLOG">BACKLOG</option>';
        }

        function normalizarTexto(valor) {
            return (valor || '')
                .toString()
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
        }

        
        function esCambioReprogramacion(valorOriginal, valorNuevo) {
            return Boolean(valorOriginal && valorNuevo && valorOriginal !== valorNuevo);
        }

        function ajusteSinReprogramacionActivo() {
            return Boolean(document.getElementById('form-ajuste-sin-reprogramacion')?.checked);
        }

        function obtenerCambiosReprogramacionActuales() {
            if (!proyectoSeleccionadoOriginal || ajusteSinReprogramacionActivo()) return [];

            const definiciones = [
                {
                    clave: 'desarrollo',
                    fase: 'Fin Desarrollo',
                    campoBD: 'fecha_fin_desarrollo',
                    inputId: 'form-fecha-fin-desarrollo',
                    motivoId: 'form-motivo-desarrollo',
                    comentarioId: 'form-comentario-motivo-desarrollo'
                },
                {
                    clave: 'qa',
                    fase: 'Fin QA',
                    campoBD: 'fecha_fin_qa',
                    inputId: 'form-fecha-fin-qa',
                    motivoId: 'form-motivo-qa',
                    comentarioId: 'form-comentario-motivo-qa'
                },
                {
                    clave: 'uat',
                    fase: 'Fin UAT',
                    campoBD: 'fecha_fin_uat',
                    inputId: 'form-fecha-fin-uat',
                    motivoId: 'form-motivo-uat',
                    comentarioId: 'form-comentario-motivo-uat'
                }
            ];

            return definiciones
                .map(def => {
                    const fechaAnterior = proyectoSeleccionadoOriginal?.[def.campoBD] || null;
                    const fechaNueva = document.getElementById(def.inputId)?.value || null;

                    return {
                        ...def,
                        fechaAnterior,
                        fechaNueva,
                        cambio: esCambioReprogramacion(fechaAnterior, fechaNueva)
                    };
                })
                .filter(x => x.cambio);
        }

        function contarReprogramacionesProyecto(projectId) {
            return conteoReprogramacionesGlobal?.[projectId] || 0;
        }

        function tieneAjusteAdministrativo(projectId, fase) {
            return Boolean(ajustesAdministrativosGlobal?.[projectId]?.[fase]);
        }

        function badgeReprogramado(projectId) {
            const total = contarReprogramacionesProyecto(projectId);
            if (!total) return '';

            return `
                <div class="mt-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 shadow-xs">
                        <i data-lucide="calendar-clock" class="w-3 h-3"></i>
                        Reprogramado
                    </span>
                </div>
            `;
        }

        function optionsMotivosTemplate() {
            let html = '<option value="">-- Seleccionar motivo --</option>';
            html += (cats.motivos_reprogramacion || [])
                .map(x => `<option value="${x.id}" data-nombre="${x.nombre}">${x.nombre}</option>`)
                .join('');

            return html;
        }

        function llenarMotivosReprogramacion() {
            ['form-motivo-desarrollo', 'form-motivo-qa', 'form-motivo-uat'].forEach(id => {
                const select = document.getElementById(id);
                if (select) select.innerHTML = optionsMotivosTemplate();
            });
        }

        function nombreMotivoPorId(id, selectId = null) {
            if (id) {
                const desdeCatalogo = (cats.motivos_reprogramacion || []).find(x => String(x.id) === String(id))?.nombre;
                if (desdeCatalogo) return desdeCatalogo;
            }

            if (selectId) {
                const select = document.getElementById(selectId);
                const textoSeleccionado = select?.options?.[select.selectedIndex]?.textContent?.trim();
                if (textoSeleccionado && !textoSeleccionado.includes('Seleccionar')) return textoSeleccionado;
            }

            return '';
        }

        function limpiarMotivosReprogramacion() {
            const checkAjuste = document.getElementById('form-ajuste-sin-reprogramacion');
            if (checkAjuste) checkAjuste.checked = false;

            ['desarrollo', 'qa', 'uat'].forEach(fase => {
                const grupo = document.getElementById(`grupo-reprogramacion-${fase}`);
                const select = document.getElementById(`form-motivo-${fase}`);
                const comentario = document.getElementById(`form-comentario-motivo-${fase}`);

                if (grupo) grupo.classList.add('hidden');
                if (select) {
                    select.value = '';
                    select.removeAttribute('required');
                }
                if (comentario) comentario.value = '';
            });

            document.getElementById('contenedor-razon')?.classList.add('hidden');
        }

        function actualizarIndicadorReprogramadoFormulario() {
            const badge = document.getElementById('badge-reprogramado-form');
            if (!badge) return;

            const total = proyectoSeleccionadoOriginal ? contarReprogramacionesProyecto(proyectoSeleccionadoOriginal.id) : 0;

            if (!total) {
                badge.classList.add('hidden');
                badge.innerHTML = '';
                return;
            }

            badge.classList.remove('hidden');
            badge.innerHTML = `
                <i data-lucide="calendar-clock" class="w-3.5 h-3.5"></i>
                Reprogramado
            `;

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function obtenerBadgePrioridad(prioridad) {
            const p = normalizarTexto(prioridad || 'BAJA');

            if (p === 'ALTA') {
                return `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-100 shadow-xs">
                        <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                        ALTA
                    </span>
                `;
            }

            if (p === 'MEDIA') {
                return `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 shadow-xs">
                        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                        MEDIA
                    </span>
                `;
            }

            return `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-xs">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    BAJA
                </span>
            `;
        }

        function llenarFiltroEstatus() {
            const filtro = document.getElementById('filtro-estatus');
            if (!filtro) return;

            const valorActual = filtro.value;
            filtro.innerHTML = '<option value="">Todos los estatus</option>';

            cats.estatus.forEach(e => {
                const valorNormalizado = normalizarTexto(e.nombre);
                filtro.innerHTML += `<option value="${valorNormalizado}">${e.nombre.toUpperCase()}</option>`;
            });

            filtro.value = valorActual;
        }

        function llenarFiltroSistema() {
            const filtro = document.getElementById('filtro-sistema');
            if (!filtro) return;

            const valorActual = filtro.value;
            filtro.innerHTML = '<option value="">Todos los sistemas</option>';

            cats.sistemas.forEach(s => {
                filtro.innerHTML += `<option value="${s.id}" data-nombre="${normalizarTexto(s.nombre)}">${s.nombre}</option>`;
            });

            filtro.value = valorActual;
        }

        function llenarFiltroSprint() {
            const filtro = document.getElementById('filtro-sprint');
            if (!filtro) return;

            const valorActual = filtro.value;
            filtro.innerHTML = '<option value="">Todos los sprints</option>';

            cats.sprints.forEach(s => {
                filtro.innerHTML += `<option value="${s.id}" data-nombre="${normalizarTexto(s.nombre)}">${s.nombre}</option>`;
            });

            filtro.value = valorActual;
        }

        const optionsTemplate = (arr) => {
            let html = '<option value="">-- Seleccionar --</option>';
            html += arr.map(x => `<option value="${x.id}">${x.nombre}</option>`).join('');
            return html;
        };

        function renderizarListasAdmin() {
            const contenedor = document.getElementById('contenedor-catalogos-admin');
            if (!contenedor) return;

            const catalogos = [
                {
                    titulo: 'Sprints',
                    tipo: 'sprints',
                    tabla: 'cat_sprints',
                    inputId: 'add-sprint-name',
                    placeholder: 'Nuevo Sprint',
                    icono: 'calendar-days',
                    color: 'blue',
                    items: cats.sprints
                },
                {
                    titulo: 'Sistemas',
                    tipo: 'sistemas',
                    tabla: 'cat_sistemas',
                    inputId: 'add-sistema-name',
                    placeholder: 'Nuevo Sistema',
                    icono: 'monitor',
                    color: 'cyan',
                    items: cats.sistemas
                },
                {
                    titulo: 'Áreas',
                    tipo: 'areas',
                    tabla: 'cat_areas',
                    inputId: 'add-area-name',
                    placeholder: 'Nueva Área',
                    icono: 'building-2',
                    color: 'violet',
                    items: cats.areas
                },
                {
                    titulo: 'Clasificación',
                    tipo: 'clasificaciones',
                    tabla: 'cat_clasificaciones',
                    inputId: 'add-clasif-name',
                    placeholder: 'Tipo',
                    icono: 'tag',
                    color: 'orange',
                    items: cats.clasificaciones
                },
                {
                    titulo: 'Catálogo Estatus',
                    tipo: 'estatus',
                    tabla: 'cat_estatus',
                    inputId: 'add-estatus-name',
                    placeholder: 'Nombre (Ej: QA)',
                    icono: 'badge-check',
                    color: 'emerald',
                    items: cats.estatus
                }
            ];

            const colorClasses = {
                blue: {
                    border: 'border-t-blue-500',
                    text: 'text-blue-700',
                    bg: 'bg-blue-50',
                    button: 'bg-blue-600 hover:bg-blue-700',
                    badge: 'bg-blue-100 text-blue-700'
                },
                cyan: {
                    border: 'border-t-cyan-500',
                    text: 'text-cyan-700',
                    bg: 'bg-cyan-50',
                    button: 'bg-cyan-600 hover:bg-cyan-700',
                    badge: 'bg-cyan-100 text-cyan-700'
                },
                violet: {
                    border: 'border-t-violet-500',
                    text: 'text-violet-700',
                    bg: 'bg-violet-50',
                    button: 'bg-violet-600 hover:bg-violet-700',
                    badge: 'bg-violet-100 text-violet-700'
                },
                orange: {
                    border: 'border-t-orange-500',
                    text: 'text-orange-700',
                    bg: 'bg-orange-50',
                    button: 'bg-orange-600 hover:bg-orange-700',
                    badge: 'bg-orange-100 text-orange-700'
                },
                emerald: {
                    border: 'border-t-emerald-500',
                    text: 'text-emerald-700',
                    bg: 'bg-emerald-50',
                    button: 'bg-emerald-600 hover:bg-emerald-700',
                    badge: 'bg-emerald-100 text-emerald-700'
                }
            };

            contenedor.innerHTML = catalogos.map(cat => {
                const colores = colorClasses[cat.color];
                const total = cat.items.length;

                const lista = total > 0
                    ? cat.items.map(item => `
                <li class="flex justify-between items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-xl shadow-xs hover:shadow-sm transition">
                    <span class="text-xs font-bold text-slate-700 truncate">
                        ${item.nombre}
                    </span>

                    <button
                        onclick="eliminarCatalogo('${cat.tabla}', '${item.id}')"
                        class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer"
                        title="Eliminar"
                    >
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </li>
            `).join('')
                    : `
                <li class="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Sin elementos registrados
                </li>
            `;

                return `
            <div class="bg-white rounded-2xl border border-slate-200 border-t-4 ${colores.border} shadow-sm p-4 flex flex-col min-h-[390px]">
                <div class="flex justify-between items-center mb-5">
                    <div class="flex items-center gap-2">
                        <div class="${colores.bg} ${colores.text} p-2 rounded-xl">
                            <i data-lucide="${cat.icono}" class="w-5 h-5"></i>
                        </div>
                        <h3 class="text-sm font-black uppercase tracking-wide ${colores.text}">
                            ${cat.titulo}
                        </h3>
                    </div>

                    <span class="text-xs font-black px-2.5 py-1 rounded-full ${colores.badge}">
                        ${total}
                    </span>
                </div>

                <div class="flex gap-2 mb-4">
                    <input
                        type="text"
                        id="${cat.inputId}"
                        placeholder="${cat.placeholder}"
                        class="min-w-0 flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                    >

                    <button
                        onclick="crearCatalogo('${cat.tipo}')"
                        class="${colores.button} text-white px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5"
                    >
                        <i data-lucide="plus-circle" class="w-4 h-4"></i>
                        Añadir
                    </button>
                </div>

                <ul class="space-y-2 overflow-y-auto pr-1 max-h-60 flex-1">
                    ${lista}
                </ul>

                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-500">
                    <div class="${colores.bg} ${colores.text} p-1.5 rounded-lg">
                        <i data-lucide="database" class="w-3.5 h-3.5"></i>
                    </div>
                    Total: ${total} elemento${total === 1 ? '' : 's'}
                </div>
            </div>
        `;
            }).join('');

            lucide.createIcons();
        }

        async function crearCatalogo(tipo) {
            const inpId = tipo === 'sprints' ? 'add-sprint-name' : (tipo === 'sistemas' ? 'add-sistema-name' : (tipo === 'areas' ? 'add-area-name' : (tipo === 'clasificaciones' ? 'add-clasif-name' : 'add-estatus-name')));
            const tabla = tipo === 'sprints' ? 'cat_sprints' : (tipo === 'sistemas' ? 'cat_sistemas' : (tipo === 'areas' ? 'cat_areas' : (tipo === 'clasificaciones' ? 'cat_clasificaciones' : 'cat_estatus')));
            const inputElement = document.getElementById(inpId);
            const valor = inputElement?.value.trim();
            if (!valor) return;

            try {
                const { error } = await _supabase.from(tabla).insert([{ nombre: valor }]);
                if (error) throw error;
                inputElement.value = '';
                await cargarTodo();
            } catch (e) { alert("Error: " + e.message); }
        }

        async function eliminarCatalogo(tabla, id) {
            if (await PMOConfirm("Se eliminará este elemento del catálogo. Esta acción no se puede deshacer.")) {
                try {
                    const { error } = await _supabase.from(tabla).delete().eq('id', id);
                    if (error) throw error;
                    await cargarTodo();
                } catch (e) { alert("Error: " + e.message); }
            }
        }

        async function cargarProyectos() {
            try {
                const { data: proyectos, error: errProyectos } = await _supabase
                    .from('pmo_projects')
                    .select('*, cat_sprints(nombre), cat_sistemas(nombre), cat_areas(nombre), cat_clasificaciones(nombre)')
                    .order('created_at', { ascending: false });

                if (errProyectos) throw errProyectos;
                todosLosProyectos = proyectos || [];

                const { data: historial } = await _supabase
                    .from('pmo_date_history')
                    .select('project_id, fase, fecha_anterior, fecha_nueva, razon');

                const conteoCambios = {};
                const conteoReprogramaciones = {};
                const ajustesAdministrativos = {};

                if (historial) {
                    historial.forEach(h => {
                        const fase = h.fase || '';
                        const razonNormalizada = normalizarTexto(h.razon || '');
                        const esAjusteAdministrativo = razonNormalizada.includes('AJUSTE ADMINISTRATIVO');
                        const esCambioFin =
                            ['Fin Desarrollo', 'Fin QA', 'Fin UAT'].includes(fase) &&
                            h.fecha_anterior &&
                            h.fecha_nueva &&
                            h.fecha_anterior !== h.fecha_nueva;

                        // Los ajustes administrativos se usan solo como marca técnica para excluir
                        // reprogramación/desviación, pero NO deben contar ni mostrarse como cambios.
                        if (esCambioFin && esAjusteAdministrativo) {
                            if (!ajustesAdministrativos[h.project_id]) ajustesAdministrativos[h.project_id] = {};
                            ajustesAdministrativos[h.project_id][fase] = true;
                            return;
                        }

                        conteoCambios[h.project_id] = (conteoCambios[h.project_id] || 0) + 1;

                        if (esCambioFin) {
                            conteoReprogramaciones[h.project_id] = (conteoReprogramaciones[h.project_id] || 0) + 1;
                        }
                    });
                }

                conteoCambiosGlobal = conteoCambios;
                conteoReprogramacionesGlobal = conteoReprogramaciones;
                ajustesAdministrativosGlobal = ajustesAdministrativos;

                renderizarTabla(todosLosProyectos, conteoCambiosGlobal);
                renderizarContadoresDinamicos(todosLosProyectos);
                renderizarDashboardEjecutivo(todosLosProyectos);
            } catch (error) { console.error("Error:", error.message); }
        }

        function formatearFechaVista(fechaString) {
            if (!fechaString) return '—';
            return new Date(fechaString + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
        }

        function formatearFechaRango(inicio, fin) {
            if (!inicio && !fin) return '—';
            if (inicio && fin) return `${formatearFechaVista(inicio)} → ${formatearFechaVista(fin)}`;
            if (inicio) return `Inicio: ${formatearFechaVista(inicio)}`;
            return `Fin: ${formatearFechaVista(fin)}`;
        }

        function recortarTextoPMO(texto, max = 46) {
            const limpio = String(texto || '—').trim();
            return limpio.length > max ? limpio.slice(0, max - 1).trim() + '…' : limpio;
        }

        function nombreCortoPMO(nombre) {
            const limpio = String(nombre || '—').trim();
            if (limpio === '—') return limpio;
            const partes = limpio.split(/\s+/).filter(Boolean);
            if (partes.length <= 2) return limpio;
            return `${partes[0]} ${partes[1]}`;
        }

        function badgeFasePMO(label, inicio, fin, compromiso) {
            const dias = calcularDiasEntreFechas(inicio, fin);
            const desviacion = calcularDesviacion(compromiso, fin);
            const clase = claseDesviacion(desviacion);
            const textoDesviacion = desviacion ? desviacion : '—';
            return `
                <div class="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-2 h-2 rounded-full ${fin ? 'bg-emerald-500' : inicio ? 'bg-blue-500' : 'bg-slate-300'}"></span>
                        <span class="text-[11px] font-black text-slate-600 uppercase">${label}</span>
                    </div>
                    <div class="flex items-center gap-1.5 whitespace-nowrap">
                        <span class="text-[10px] font-bold text-slate-400">${dias || '—'} d</span>
                        <span class="px-1.5 py-0.5 rounded-lg text-[10px] font-black ${clase}">${textoDesviacion}</span>
                    </div>
                </div>`;
        }

        function obtenerAvancePorEstatusPMO(estatus) {
            const estado = normalizarTexto(estatus || 'BACKLOG');
            if (estado.includes('LIBERADO') || estado.includes('PRODUCCION')) return { pct: 100, label: 'Liberación' };
            if (estado.includes('UAT')) return { pct: 80, label: 'UAT' };
            if (estado === 'QA' || estado.includes('PRUEBA')) return { pct: 60, label: 'QA' };
            if (estado.includes('DESARROLLO')) return { pct: 40, label: 'Desarrollo' };
            if (estado.includes('ANALISIS') || estado.includes('ANÁLISIS')) return { pct: 20, label: 'Análisis' };
            return { pct: 0, label: 'Backlog' };
        }

        function renderizarTimelinePMO(p) {
            const avance = obtenerAvancePorEstatusPMO(p.estatus);
            const hitos = [
                { pct: 0, label: 'Backlog' },
                { pct: 20, label: 'Análisis' },
                { pct: 40, label: 'Desarrollo' },
                { pct: 60, label: 'QA' },
                { pct: 80, label: 'UAT' },
                { pct: 100, label: 'Liberación' }
            ];

            return `
                <div class="min-w-[260px] max-w-[320px]">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-black text-slate-800">${avance.label}</span>
                        <span class="text-xs font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-full">${avance.pct}%</span>
                    </div>
                    <div class="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div class="absolute left-0 top-0 h-full rounded-full bg-blue-500" style="width:${avance.pct}%"></div>
                    </div>
                    <div class="relative flex justify-between mt-2">
                        ${hitos.map(h => `
                            <div title="${h.label} · ${h.pct}%" class="flex flex-col items-center gap-1">
                                <span class="w-2.5 h-2.5 rounded-full border ${avance.pct >= h.pct ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}"></span>
                                <span class="text-[9px] font-bold ${avance.pct >= h.pct ? 'text-blue-600' : 'text-slate-300'}">${h.pct}</span>
                            </div>`).join('')}
                    </div>
                </div>`;
        }

        function renderizarDesviacionPMO(p) {
            return `
                <div class="space-y-1.5 min-w-[170px]">
                    ${badgeFasePMO('Dev', p.fecha_inicio_desarrollo, p.fecha_fin_desarrollo, p.fecha_desarrollo)}
                    ${badgeFasePMO('QA', p.fecha_inicio_qa, p.fecha_fin_qa, p.fecha_qa)}
                    ${badgeFasePMO('UAT', p.fecha_inicio_uat, p.fecha_fin_uat, p.fecha_uat)}
                </div>`;
        }

        function renderizarTabla(proyectos, conteoCambios = {}) {
            const tbody = document.getElementById('tabla-proyectos-body');
            // Algunas pantallas, como Dashboard Ejecutivo, usan pmo-app.js para KPIs y gráficas,
            // pero no tienen tabla de matriz. En esos casos no debemos detener la carga.
            if (!tbody) return;
            tbody.innerHTML = '';

            if (proyectos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400">Sin datos en matriz.</td></tr>';
                return;
            }

            proyectos.forEach(p => {
                const estatusNormalizado = (p.estatus || 'BACKLOG').toUpperCase();
                let badgePrioridad = obtenerBadgePrioridad(p.prioridad);

                let badgeEstatus = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700"><span class="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>${p.estatus || 'BACKLOG'}</span>`;
                if (estatusNormalizado === 'DESARROLLO') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700"><span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>Desarrollo</span>';
                else if (estatusNormalizado === 'QA') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700"><span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>QA</span>';
                else if (estatusNormalizado === 'UAT') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700"><span class="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>UAT</span>';
                else if (estatusNormalizado === 'LIBERADO' || estatusNormalizado === 'PRODUCCIÓN') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Liberado</span>';
                else if (estatusNormalizado === 'REGISTRADO') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Registrado</span>';
                else if (estatusNormalizado === 'CANCELADO') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700"><span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>Cancelado</span>';

                const totalCambios = conteoCambios[p.id] || 0;
                let badgeNotificacionReloj = totalCambios > 0 ? `<span class="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[9px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-xs animate-bounce">${totalCambios}</span>` : '';
                const nombreCompleto = p.nombre_rqm || 'Sin nombre';

                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50/70 transition duration-150 group border-b border-slate-100">
                        <td class="p-4 pl-6 align-top min-w-[260px]">
                            <button onclick="abrirModalEditar('${p.id}')" class="text-left cursor-pointer group/req" title="${nombreCompleto.replace(/"/g, '&quot;')}">
                                <div class="font-black text-slate-900 leading-snug group-hover/req:text-blue-700">${recortarTextoPMO(nombreCompleto, 58)}</div>
                                <div class="text-xs text-slate-400 font-mono mt-1">${p.id_req || '—'}</div>
                            </button>
                        </td>
                        <td class="p-4 align-top min-w-[140px]">
                            <div class="font-bold text-xs text-slate-900">${p.cat_sprints?.nombre || 'Sin Sprint'}</div>
                            <div class="text-[11px] text-slate-400 font-black mt-1">${p.cat_sistemas?.nombre || '—'}</div>
                            <div class="mt-2">${badgePrioridad}</div>
                            <div class="text-[11px] text-slate-400 mt-1 font-medium">${p.cat_clasificaciones?.nombre || 'Sin Clasificación'}</div>
                        </td>
                        <td class="p-4 align-top">${renderizarTimelinePMO(p)}</td>
                        <td class="p-4 align-top">${renderizarDesviacionPMO(p)}</td>
                        <td class="p-4 align-top min-w-[150px]">
                            <div class="space-y-2">${badgeEstatus}${badgeReprogramado(p.id)}</div>
                        </td>
                        <td class="p-4 pr-6 text-right whitespace-nowrap align-top">
                            <div class="inline-flex items-center gap-1 rounded-2xl bg-slate-50 border border-slate-100 p-1">
                                <button title="Historial" onclick="verHistorial('${p.id}', '${(p.nombre_rqm || '').replace(/'/g, "\\'")}', '${(p.id_req || '').replace(/'/g, "\\'")}')" class="relative inline-flex items-center p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition cursor-pointer">
                                    <i data-lucide="clock" class="w-4 h-4"></i>
                                    ${badgeNotificacionReloj}
                                </button>
                                <button title="Eliminar" onclick="eliminarProyecto('${p.id}', '${(p.nombre_rqm || '').replace(/'/g, "\\'")}')" class="inline-flex items-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            lucide.createIcons();
        }

        function renderizarContadoresDinamicos(proyectos) {
            const contenedor = document.getElementById('contenedor-contadores');
            if (!contenedor) return;

            const grupos = [
                { key: 'TOTAL', label: 'TOTAL', icono: 'layers', bg: 'bg-blue-50', color: 'text-blue-600', valor: proyectos.length },
                { key: 'LIBERADO', label: 'LIBERADOS', icono: 'rocket', bg: 'bg-emerald-50', color: 'text-emerald-600', valor: proyectos.filter(p => normalizarTexto(p.estatus || '').includes('LIBERADO') || normalizarTexto(p.estatus || '').includes('PRODUCCION')).length },
                { key: 'QA', label: 'QA', icono: 'shield-check', bg: 'bg-amber-50', color: 'text-amber-600', valor: proyectos.filter(p => normalizarTexto(p.estatus || '') === 'QA').length },
                { key: 'UAT', label: 'UAT', icono: 'clipboard-check', bg: 'bg-orange-50', color: 'text-orange-600', valor: proyectos.filter(p => normalizarTexto(p.estatus || '') === 'UAT').length },
                { key: 'REPROGRAMADOS', label: 'REPROGRAMADOS', icono: 'calendar-clock', bg: 'bg-violet-50', color: 'text-violet-600', valor: proyectos.filter(p => p.reprogramado || p.tiene_reprogramacion || p.razon_cambio_fechas).length },
                { key: 'ATRASADOS', label: 'ATRASADOS', icono: 'triangle-alert', bg: 'bg-rose-50', color: 'text-rose-600', valor: proyectos.filter(p => Number(p.dias_desviacion || p.dias_atraso || 0) > 0).length }
            ];

            contenedor.innerHTML = grupos.map(g => `
                <div class="pmo-summary-card">
                    <div>
                        <p class="pmo-summary-label">${g.label}</p>
                        <h2 class="pmo-summary-value">${g.valor}</h2>
                    </div>
                    <div class="pmo-summary-icon ${g.bg} ${g.color}">
                        <i data-lucide="${g.icono}" class="w-6 h-6"></i>
                    </div>
                </div>
            `).join('');

            lucide.createIcons();
        }

        function verificarCambioFechas() {
            if (!proyectoSeleccionadoOriginal) {
                limpiarMotivosReprogramacion();
                return;
            }

            const cambios = obtenerCambiosReprogramacionActuales();
            const hayCambios = cambios.length > 0;

            document.getElementById('contenedor-razon')?.classList.toggle('hidden', !hayCambios);

            ['desarrollo', 'qa', 'uat'].forEach(fase => {
                const grupo = document.getElementById(`grupo-reprogramacion-${fase}`);
                const select = document.getElementById(`form-motivo-${fase}`);

                const activo = cambios.some(c => c.clave === fase);

                if (grupo) grupo.classList.toggle('hidden', !activo);
                if (select) {
                    if (activo) select.setAttribute('required', 'true');
                    else {
                        select.removeAttribute('required');
                        select.value = '';
                    }
                }
            });

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        // Eventos de fechas inicializados después de pintar el HTML compartido.

        
        function inicializarEventosFechasFormulario() {
            [
                'form-fecha-desarrollo',
                'form-fecha-qa',
                'form-fecha-uat',
                'form-fecha-inicio-desarrollo',
                'form-fecha-fin-desarrollo',
                'form-fecha-inicio-qa',
                'form-fecha-fin-qa',
                'form-fecha-inicio-uat',
                'form-fecha-fin-uat',
                'form-fecha-liberacion-prod'
            ].forEach(id => {
                const campo = document.getElementById(id);
                if (!campo || campo.dataset.eventosInicializados === 'true') return;

                campo.addEventListener('input', () => {
                    verificarCambioFechas();
                    actualizarDiasFases();
                });

                campo.addEventListener('change', () => {
                    verificarCambioFechas();
                    actualizarDiasFases();
                });

                campo.dataset.eventosInicializados = 'true';
            });

            const checkAjuste = document.getElementById('form-ajuste-sin-reprogramacion');
            if (checkAjuste && checkAjuste.dataset.eventosInicializados !== 'true') {
                checkAjuste.addEventListener('change', () => {
                    if (checkAjuste.checked) {
                        limpiarMotivosReprogramacion();
                        checkAjuste.checked = true;
                    }
                    verificarCambioFechas();
                });
                checkAjuste.dataset.eventosInicializados = 'true';
            }
        }

        function calcularDiasEntreFechas(inicio, fin) {
            if (!inicio || !fin) return '';

            const fechaInicio = new Date(inicio + 'T00:00:00');
            const fechaFin = new Date(fin + 'T00:00:00');

            const diferencia = fechaFin - fechaInicio;
            const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));

            return dias >= 0 ? dias : '';
        }

        function calcularDesviacion(fechaCompromiso, fechaReal) {
            if (!fechaCompromiso || !fechaReal) return '';

            const compromiso = new Date(fechaCompromiso + 'T00:00:00');
            const real = new Date(fechaReal + 'T00:00:00');

            const dias = Math.ceil((real - compromiso) / (1000 * 60 * 60 * 24));

            if (dias > 0) return `🔴 +${dias} día${dias === 1 ? '' : 's'}`;
            if (dias === 0) return '⚪ En tiempo';

            const diasAdelanto = Math.abs(dias);
            return `🟢 -${diasAdelanto} día${diasAdelanto === 1 ? '' : 's'}`;
        }

        function claseDesviacion(valor) {
            if (!valor) return 'bg-slate-100 text-slate-400';
            if (valor.includes('+')) return 'bg-rose-50 text-rose-700';
            if (valor.includes('-')) return 'bg-emerald-50 text-emerald-700';
            if (valor.includes('En tiempo')) return 'bg-slate-100 text-slate-700';
            return 'bg-slate-100 text-slate-400';
        }

        function calcularAtrasoReal(fechaCompromiso, fechaReal) {
            if (!fechaCompromiso || fechaReal) return '';

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            const compromiso = new Date(fechaCompromiso + 'T00:00:00');
            const dias = Math.ceil((hoy - compromiso) / (1000 * 60 * 60 * 24));

            if (dias > 0) return `🔴 ${dias} día${dias === 1 ? '' : 's'}`;

            return '';
        }

        function badgeAtrasoReal(fechaCompromiso, fechaReal) {
            const atraso = calcularAtrasoReal(fechaCompromiso, fechaReal);
            if (!atraso) return '';

            return `
                <span class="ml-1 px-1.5 py-0.5 rounded font-black bg-rose-100 text-rose-700" title="Atraso real: la fase sigue abierta y ya venció el compromiso">
                    Atraso ${atraso}
                </span>
            `;
        }


        function actualizarBadgeDesviacion(id, valor) {
            const el = document.getElementById(id);
            if (!el) return;

            el.textContent = valor || '—';
            el.className = `inline-flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-black ${claseDesviacion(valor)}`;
        }

        function actualizarDiasFases() {
            const compromisoDev = document.getElementById('form-fecha-desarrollo')?.value;
            const compromisoQA = document.getElementById('form-fecha-qa')?.value;
            const compromisoUAT = document.getElementById('form-fecha-uat')?.value;

            const iniDev = document.getElementById('form-fecha-inicio-desarrollo')?.value;
            const finDev = document.getElementById('form-fecha-fin-desarrollo')?.value;
            const iniQA = document.getElementById('form-fecha-inicio-qa')?.value;
            const finQA = document.getElementById('form-fecha-fin-qa')?.value;
            const iniUAT = document.getElementById('form-fecha-inicio-uat')?.value;
            const finUAT = document.getElementById('form-fecha-fin-uat')?.value;

            document.getElementById('form-dias-desarrollo').value = calcularDiasEntreFechas(iniDev, finDev);
            document.getElementById('form-dias-qa').value = calcularDiasEntreFechas(iniQA, finQA);
            document.getElementById('form-dias-uat').value = calcularDiasEntreFechas(iniUAT, finUAT);

            actualizarBadgeDesviacion('form-atraso-desarrollo', calcularDesviacion(compromisoDev, finDev));
            actualizarBadgeDesviacion('form-atraso-qa', calcularDesviacion(compromisoQA, finQA));
            actualizarBadgeDesviacion('form-atraso-uat', calcularDesviacion(compromisoUAT, finUAT));
        }


        function obtenerMotivoReprogramacion(fase) {
            const select = document.getElementById(`form-motivo-${fase}`);
            const comentario = document.getElementById(`form-comentario-motivo-${fase}`)?.value?.trim() || '';
            const motivoId = select?.value || null;
            const textoSeleccionado = select?.options?.[select.selectedIndex]?.textContent?.trim() || '';
            const textoDesdeData = select?.options?.[select.selectedIndex]?.dataset?.nombre?.trim() || '';
            const motivoTexto = (textoDesdeData || textoSeleccionado || '').includes('Seleccionar') ? '' : (textoDesdeData || textoSeleccionado || '');

            return { motivoId, motivoTexto, comentario };
        }

        async function procesarFormulario(event) {
            event.preventDefault();

            const btnGuardar = document.getElementById('btn-guardar');
            btnGuardar.disabled = true;
            btnGuardar.innerText = 'Guardando...';

            const id = document.getElementById('form-id').value;
            const reprogramacionesDetectadas = obtenerCambiosReprogramacionActuales();

            const reqData = {
                id_req: document.getElementById('form-id-req').value.trim(),
                nombre_rqm: document.getElementById('form-nombre-rqm').value.trim(),
                sprint_id: document.getElementById('form-sprint').value || null,
                sistema_id: document.getElementById('form-sistema').value || null,
                clasificacion_id: document.getElementById('form-clasificacion').value || null,
                area_id: document.getElementById('form-area').value || null,
                solicitante: document.getElementById('form-solicitante').value.trim() || null,
                responsable_sistemas: document.getElementById('form-responsable-sistemas').value.trim() || null,
                asignado_a: document.getElementById('form-asignado-a').value.trim() || null,
                prioridad: document.getElementById('form-prioridad').value,
                complejidad: document.getElementById('form-complejidad').value || null,
                estatus: document.getElementById('form-estatus').value,
                descripcion: document.getElementById('form-descripcion').value.trim() || null,
                fecha_ingreso_pmo: document.getElementById('form-fecha-ingreso').value || null,
                fecha_desarrollo: document.getElementById('form-fecha-desarrollo')?.value || null,
                fecha_qa: document.getElementById('form-fecha-qa')?.value || null,
                fecha_uat: document.getElementById('form-fecha-uat')?.value || null,
                dias_desarrollo: document.getElementById('form-dias-desarrollo').value ? Number(document.getElementById('form-dias-desarrollo').value) : null,
                dias_qa: document.getElementById('form-dias-qa').value ? Number(document.getElementById('form-dias-qa').value) : null,
                dias_uat: document.getElementById('form-dias-uat').value ? Number(document.getElementById('form-dias-uat').value) : null,

                fecha_inicio_desarrollo: document.getElementById('form-fecha-inicio-desarrollo').value || null,
                fecha_fin_desarrollo: document.getElementById('form-fecha-fin-desarrollo').value || null,
                fecha_inicio_qa: document.getElementById('form-fecha-inicio-qa').value || null,
                fecha_fin_qa: document.getElementById('form-fecha-fin-qa').value || null,
                fecha_inicio_uat: document.getElementById('form-fecha-inicio-uat').value || null,
                fecha_fin_uat: document.getElementById('form-fecha-fin-uat').value || null,
                fecha_liberacion_prod: document.getElementById('form-fecha-liberacion-prod').value || null,
                comentarios: document.getElementById('form-comentarios').value.trim() || null

            };

            console.log("Datos que se intentan guardar:", reqData);

            try {
                if (id) {
                    if (proyectoSeleccionadoOriginal) {
                        const registrarLog = async (fase, ant, nva, motivoId = null, comentarioMotivo = null, motivoTexto = null, esAjusteAdministrativo = false) => {
                            if (esCambioReprogramacion(ant || null, nva || null)) {
                                const motivoNombre = motivoTexto || nombreMotivoPorId(motivoId);
                                const razonTexto = esAjusteAdministrativo
                                    ? 'Ajuste administrativo - No afecta reprogramación ni desviación'
                                    : (motivoNombre
                                        ? `${motivoNombre}${comentarioMotivo ? ' - ' + comentarioMotivo : ''}`
                                        : (comentarioMotivo || 'Reprogramación de fecha fin'));

                                const payload = {
                                    project_id: id,
                                    fase: fase,
                                    fecha_anterior: ant || null,
                                    fecha_nueva: nva || null,
                                    razon: razonTexto,
                                    motivo_id: esAjusteAdministrativo ? null : (motivoId || null),
                                    comentario_motivo: esAjusteAdministrativo ? null : (comentarioMotivo || null)
                                };

                                let { error } = await _supabase
                                    .from('pmo_date_history')
                                    .insert([payload]);

                                if (error && (
                                    error.message?.includes('motivo_id') ||
                                    error.message?.includes('comentario_motivo') ||
                                    error.message?.includes('schema cache')
                                )) {
                                    const fallbackPayload = {
                                        project_id: id,
                                        fase: fase,
                                        fecha_anterior: ant || null,
                                        fecha_nueva: nva || null,
                                        razon: razonTexto
                                    };

                                    const fallback = await _supabase
                                        .from('pmo_date_history')
                                        .insert([fallbackPayload]);

                                    error = fallback.error;
                                }

                                if (error) throw error;
                            }
                        };

                        const omitirReprogramacion = ajusteSinReprogramacionActivo();

                        // Si el usuario marca "Ajuste administrativo sin reprogramación",
                        // el cambio de fechas se guarda en el requerimiento, pero NO se registra
                        // ningún movimiento en el reloj de auditoría temporal.
                        if (!omitirReprogramacion) {
                            const motivoDev = obtenerMotivoReprogramacion('desarrollo');
                            const motivoQA = obtenerMotivoReprogramacion('qa');
                            const motivoUAT = obtenerMotivoReprogramacion('uat');

                            await registrarLog('Compromiso Desarrollo', proyectoSeleccionadoOriginal.fecha_desarrollo, reqData.fecha_desarrollo);
                            await registrarLog('Inicio Desarrollo', proyectoSeleccionadoOriginal.fecha_inicio_desarrollo, reqData.fecha_inicio_desarrollo);
                            await registrarLog('Fin Desarrollo', proyectoSeleccionadoOriginal.fecha_fin_desarrollo, reqData.fecha_fin_desarrollo, motivoDev.motivoId, motivoDev.comentario, motivoDev.motivoTexto, false);

                            await registrarLog('Compromiso QA', proyectoSeleccionadoOriginal.fecha_qa, reqData.fecha_qa);
                            await registrarLog('Inicio QA', proyectoSeleccionadoOriginal.fecha_inicio_qa, reqData.fecha_inicio_qa);
                            await registrarLog('Fin QA', proyectoSeleccionadoOriginal.fecha_fin_qa, reqData.fecha_fin_qa, motivoQA.motivoId, motivoQA.comentario, motivoQA.motivoTexto, false);

                            await registrarLog('Compromiso UAT', proyectoSeleccionadoOriginal.fecha_uat, reqData.fecha_uat);
                            await registrarLog('Inicio UAT', proyectoSeleccionadoOriginal.fecha_inicio_uat, reqData.fecha_inicio_uat);
                            await registrarLog('Fin UAT', proyectoSeleccionadoOriginal.fecha_fin_uat, reqData.fecha_fin_uat, motivoUAT.motivoId, motivoUAT.comentario, motivoUAT.motivoTexto, false);

                            await registrarLog('Liberación Producción', proyectoSeleccionadoOriginal.fecha_liberacion_prod, reqData.fecha_liberacion_prod);
                        }
                    }

                    const { data, error } = await _supabase
                        .from('pmo_projects')
                        .update(reqData)
                        .eq('id', id)
                        .select();

                    if (error) throw error;

                    console.log("Actualizado correctamente:", data);
                    alert("Requerimiento actualizado correctamente.");
                } else {
                    const { data, error } = await _supabase
                        .from('pmo_projects')
                        .insert([reqData])
                        .select();

                    if (error) throw error;

                    console.log("Guardado correctamente:", data);
                    alert("Requerimiento guardado correctamente.");
                }

                cerrarModal();
                await cargarTodo();

            } catch (error) {
                console.error("Error completo al guardar:", error);
                const msg = error?.message || '';
                alert("No se pudo guardar: " + msg);
            } finally {
                btnGuardar.disabled = false;
                btnGuardar.innerText = 'Guardar Cambios';
            }
        }

        async function verHistorial(id, nombre, codigo) {
    document.getElementById('historial-subtitulo').innerText = `${codigo} · ${nombre}`;
    const listaDiv = document.getElementById('historial-lista');
    document.getElementById('modal-historial').classList.remove('hidden');

    try {
        const { data, error } = await _supabase
            .from('pmo_date_history')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const historialVisible = (data || []).filter(h => {
            const razonNormalizada = normalizarTexto(h.razon || '');
            return !razonNormalizada.includes('AJUSTE ADMINISTRATIVO');
        });

        if (!historialVisible || historialVisible.length === 0) {
            listaDiv.innerHTML = `
                <div class="text-center py-6 text-slate-400 text-xs">
                    Sin desfases en hitos.
                </div>
            `;
            return;
        }

        const proyecto = todosLosProyectos.find(p => p.id === id);

        const fases = [
            {
                nombre: 'Desarrollo',
                icono: 'code-2',
                color: 'blue',
                inicioCampo: 'fecha_inicio_desarrollo',
                finCampo: 'fecha_fin_desarrollo',
                logs: ['Compromiso Desarrollo', 'Inicio Desarrollo', 'Fin Desarrollo']
            },
            {
                nombre: 'QA',
                icono: 'shield-check',
                color: 'amber',
                inicioCampo: 'fecha_inicio_qa',
                finCampo: 'fecha_fin_qa',
                logs: ['Compromiso QA', 'Inicio QA', 'Fin QA']
            },
            {
                nombre: 'UAT',
                icono: 'clipboard-check',
                color: 'orange',
                inicioCampo: 'fecha_inicio_uat',
                finCampo: 'fecha_fin_uat',
                logs: ['Compromiso UAT', 'Inicio UAT', 'Fin UAT']
            },
            {
                nombre: 'Producción',
                icono: 'rocket',
                color: 'emerald',
                inicioCampo: null,
                finCampo: 'fecha_liberacion_prod',
                logs: ['Liberación Producción']
            }
        ];

        const colores = {
            blue: {
                border: 'border-blue-500',
                bg: 'bg-blue-50',
                text: 'text-blue-700'
            },
            amber: {
                border: 'border-amber-500',
                bg: 'bg-amber-50',
                text: 'text-amber-700'
            },
            orange: {
                border: 'border-orange-500',
                bg: 'bg-orange-50',
                text: 'text-orange-700'
            },
            emerald: {
                border: 'border-emerald-500',
                bg: 'bg-emerald-50',
                text: 'text-emerald-700'
            }
        };

        function diasEntre(inicio, fin) {
            if (!inicio || !fin) return '—';

            const d1 = new Date(inicio + 'T00:00:00');
            const d2 = new Date(fin + 'T00:00:00');
            const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));

            return diff >= 0 ? `${diff} día${diff === 1 ? '' : 's'}` : '—';
        }

        function obtenerRazon(logsFase) {
            const logConRazon = logsFase.find(l => l.razon);
            return logConRazon?.razon || 'Sin razón registrada';
        }

        const tarjetasFase = fases.map(fase => {
            const logsFase = historialVisible.filter(l => fase.logs.includes(l.fase));

            if (logsFase.length === 0) return '';

            const estilo = colores[fase.color];

            const fechaInicio = fase.inicioCampo ? proyecto?.[fase.inicioCampo] : null;
            const fechaFin = fase.finCampo ? proyecto?.[fase.finCampo] : null;

            const cambios = logsFase.map(log => `
                <div class="text-[11px] bg-white rounded-lg px-3 py-2 border border-slate-100 space-y-1">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-slate-500">${log.fase}</span>
                        <span class="font-mono text-slate-700">
                            ${formatearFechaVista(log.fecha_anterior)}
                            <span class="mx-1 font-bold">➜</span>
                            ${formatearFechaVista(log.fecha_nueva)}
                        </span>
                    </div>
                    <div class="text-slate-500">
                        <b>Motivo:</b> ${log.razon || 'Sin motivo registrado'}
                    </div>
                </div>
            `).join('');

            return `
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="border-l-4 ${estilo.border} p-4 space-y-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div class="${estilo.bg} ${estilo.text} p-2 rounded-xl">
                                    <i data-lucide="${fase.icono}" class="w-4 h-4"></i>
                                </div>
                                <div>
                                    <p class="text-sm font-black text-slate-800">${fase.nombre}</p>
                                    <p class="text-[11px] text-slate-400 font-bold uppercase tracking-wide">
                                        Historial agrupado por fase
                                    </p>
                                </div>
                            </div>

                            <div class="flex items-center gap-2">
                                <span class="${estilo.bg} ${estilo.text} text-[11px] font-black px-3 py-1 rounded-full">
                                    ${logsFase.length} cambio${logsFase.length === 1 ? '' : 's'}
                                </span>
                                <button type="button"
                                    onclick='borrarHistorialFase(${JSON.stringify(id)}, ${JSON.stringify(nombre)}, ${JSON.stringify(codigo)}, ${JSON.stringify(fase.nombre)}, ${JSON.stringify(fase.logs)})'
                                    title="Borrar historial de ${fase.nombre}"
                                    class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div class="bg-slate-50 rounded-xl p-3">
                                <p class="text-[10px] font-bold text-slate-400 uppercase">Inicio</p>
                                <p class="font-bold text-slate-700 mt-1">
                                    ${fechaInicio ? formatearFechaVista(fechaInicio) : '—'}
                                </p>
                            </div>

                            <div class="bg-slate-50 rounded-xl p-3">
                                <p class="text-[10px] font-bold text-slate-400 uppercase">
                                    ${fase.nombre === 'Producción' ? 'Liberación' : 'Fin'}
                                </p>
                                <p class="font-bold text-slate-700 mt-1">
                                    ${fechaFin ? formatearFechaVista(fechaFin) : '—'}
                                </p>
                            </div>

                            <div class="bg-slate-50 rounded-xl p-3">
                                <p class="text-[10px] font-bold text-slate-400 uppercase">Duración</p>
                                <p class="font-bold text-slate-700 mt-1">
                                    ${fase.nombre === 'Producción' ? '—' : diasEntre(fechaInicio, fechaFin)}
                                </p>
                            </div>
                        </div>

                        <details class="group">
                            <summary class="cursor-pointer text-[11px] font-bold text-slate-500 hover:text-slate-800">
                                Ver movimientos registrados
                            </summary>
                            <div class="mt-3 space-y-2">
                                ${cambios}
                            </div>
                        </details>
                    </div>
                </div>
            `;
        }).join('');

        listaDiv.innerHTML = tarjetasFase || `
            <div class="text-center py-6 text-slate-400 text-xs">
                Sin desfases en hitos.
            </div>
        `;

        lucide.createIcons();

    } catch (e) {
        listaDiv.innerHTML = `
            <div class="text-rose-500 text-xs">
                ${e.message}
            </div>
        `;
    }
}

        async function borrarHistorialFase(projectId, nombre, codigo, nombreFase, logsFase) {
            const confirmar = await PMOConfirm(`Se borrará el historial de ${nombreFase}. Los movimientos registrados de esa fase no podrán recuperarse.`, {title:"Confirmar limpieza de historial", confirmText:"Sí, borrar historial"});
            if (!confirmar) return;

            try {
                const { error } = await _supabase
                    .from('pmo_date_history')
                    .delete()
                    .eq('project_id', projectId)
                    .in('fase', logsFase);

                if (error) throw error;

                await cargarTodo();
                await verHistorial(projectId, nombre, codigo);
            } catch (e) {
                console.error('Error al borrar historial:', e);
                alert('No se pudo borrar el historial: ' + (e?.message || e));
            }
        }

        window.borrarHistorialFase = borrarHistorialFase;

        function abrirModalNuevo() {
            proyectoSeleccionadoOriginal = null;
            document.getElementById('form-id').value = '';
            document.getElementById('form-proyecto').reset();
            llenarSelectsForm();
            llenarMotivosReprogramacion();
            document.getElementById('modal-titulo').innerText = 'Registrar Nuevo Requerimiento';
            limpiarMotivosReprogramacion();
            document.getElementById('modal-proyecto').classList.remove('hidden');
            inicializarEventosFechasFormulario();
            actualizarDiasFases();
        }

        function setValueIfExists(id, value) {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        }

        function abrirModalEditar(id) {
            const p = todosLosProyectos.find(x => x.id === id);
            if (!p) return;

            proyectoSeleccionadoOriginal = { ...p };
            llenarSelectsForm();
            llenarMotivosReprogramacion();

            setValueIfExists('form-id', p.id);
            setValueIfExists('form-id-req', p.id_req);
            setValueIfExists('form-nombre-rqm', p.nombre_rqm);
            setValueIfExists('form-sprint', p.sprint_id);
            setValueIfExists('form-sistema', p.sistema_id);
            setValueIfExists('form-clasificacion', p.clasificacion_id);
            setValueIfExists('form-area', p.area_id);
            setValueIfExists('form-solicitante', p.solicitante);
            setValueIfExists('form-responsable-sistemas', p.responsable_sistemas);
            setValueIfExists('form-asignado-a', p.asignado_a);
            setValueIfExists('form-prioridad', p.prioridad || 'Baja');
            setValueIfExists('form-complejidad', p.complejidad || 'Mediana');
            setValueIfExists('form-estatus', p.estatus || 'BACKLOG');
            setValueIfExists('form-descripcion', p.descripcion);
            setValueIfExists('form-fecha-ingreso', p.fecha_ingreso_pmo);

            setValueIfExists('form-fecha-desarrollo', p.fecha_desarrollo);
            setValueIfExists('form-fecha-qa', p.fecha_qa);
            setValueIfExists('form-fecha-uat', p.fecha_uat);
            setValueIfExists('form-fecha-liberacion', p.fecha_liberacion);

            setValueIfExists('form-fecha-inicio-desarrollo', p.fecha_inicio_desarrollo);
            setValueIfExists('form-fecha-fin-desarrollo', p.fecha_fin_desarrollo);
            setValueIfExists('form-fecha-inicio-qa', p.fecha_inicio_qa);
            setValueIfExists('form-fecha-fin-qa', p.fecha_fin_qa);
            setValueIfExists('form-fecha-inicio-uat', p.fecha_inicio_uat);
            setValueIfExists('form-fecha-fin-uat', p.fecha_fin_uat);
            setValueIfExists('form-fecha-liberacion-prod', p.fecha_liberacion_prod);

            setValueIfExists('form-dias-desarrollo', p.dias_desarrollo);
            setValueIfExists('form-dias-qa', p.dias_qa);
            setValueIfExists('form-dias-uat', p.dias_uat);
            setValueIfExists('form-dias-liberacion', p.dias_liberacion);

            setValueIfExists('form-comentarios', p.comentarios);
            limpiarMotivosReprogramacion();
            actualizarIndicadorReprogramadoFormulario();
            document.getElementById('modal-titulo').innerText = 'Modificar Requerimiento';
            document.getElementById('modal-proyecto').classList.remove('hidden');
            inicializarEventosFechasFormulario();

            if (typeof actualizarDiasFases === 'function') {
                actualizarDiasFases();
            }
            verificarCambioFechas();
        }

        function cerrarModal() { document.getElementById('modal-proyecto').classList.add('hidden'); }
        function cerrarModalHistorial() { document.getElementById('modal-historial').classList.add('hidden'); }

        async function eliminarProyecto(id, nombre) {
            if (await PMOConfirm(`Se eliminará el requerimiento "${nombre}". Esta acción no se puede deshacer.`)) {
                await _supabase.from('pmo_projects').delete().eq('id', id);
                await cargarProyectos();
            }
        }


        let chartsEjecutivos = {};

        function contarPor(proyectos, obtenerClave) {
            const conteos = {};
            proyectos.forEach(p => {
                const clave = obtenerClave(p) || 'Sin dato';
                conteos[clave] = (conteos[clave] || 0) + 1;
            });
            return conteos;
        }

        function diasEntreFechasKpi(inicio, fin) {
            if (!inicio || !fin) return null;
            const d1 = new Date(inicio + 'T00:00:00');
            const d2 = new Date(fin + 'T00:00:00');
            const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
            return Number.isFinite(diff) && diff >= 0 ? diff : null;
        }

        function promedio(valores) {
            const validos = valores.filter(v => typeof v === 'number' && !Number.isNaN(v));
            if (!validos.length) return 0;
            return Math.round(validos.reduce((a, b) => a + b, 0) / validos.length);
        }

        function obtenerDesviacionDias(compromiso, real) {
            if (!compromiso || !real) return null;
            const d1 = new Date(compromiso + 'T00:00:00');
            const d2 = new Date(real + 'T00:00:00');
            const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
            return Number.isFinite(diff) ? diff : null;
        }

        
        function obtenerFechaInicioLeadTime(p) {
            // Prioridad correcta: Fecha de ingreso PMO.
            // Si no existe en registros antiguos, usamos created_at como respaldo.
            // Si tampoco existe, usamos el primer hito disponible para no dejar el KPI vacío.
            if (p.fecha_ingreso_pmo) return p.fecha_ingreso_pmo;
            if (p.created_at) return String(p.created_at).slice(0, 10);
            if (p.fecha_inicio_desarrollo) return p.fecha_inicio_desarrollo;
            if (p.fecha_desarrollo) return p.fecha_desarrollo;
            return null;
        }

        function renderizarKpisEjecutivos(proyectos) {
            const contenedor = document.getElementById('kpis-ejecutivos');
            if (!contenedor) return;

            const total = proyectos.length;
            const liberados = proyectos.filter(p => ['LIBERADO', 'PRODUCCIÓN', 'PRODUCCION'].includes((p.estatus || '').toUpperCase())).length;

            const leadTimes = proyectos
                .map(p => {
                    const inicioLead = obtenerFechaInicioLeadTime(p);
                    return diasEntreFechasKpi(inicioLead, p.fecha_liberacion_prod);
                })
                .filter(v => v !== null);

            const desviaciones = [];
            proyectos.forEach(p => {
                [
                    obtenerDesviacionDias(p.fecha_desarrollo, p.fecha_fin_desarrollo),
                    obtenerDesviacionDias(p.fecha_qa, p.fecha_fin_qa),
                    obtenerDesviacionDias(p.fecha_uat, p.fecha_fin_uat)
                ].forEach(v => { if (v !== null) desviaciones.push(v); });
            });

            const fasesMedidas = desviaciones.length;
            const fasesEnTiempo = desviaciones.filter(v => v <= 0).length;
            const cumplimiento = fasesMedidas ? Math.round((fasesEnTiempo / fasesMedidas) * 100) : 0;

            const totalAtrasosReales = proyectos.reduce((acc, p) => {
                return acc +
                    (calcularAtrasoReal(p.fecha_desarrollo, p.fecha_fin_desarrollo) ? 1 : 0) +
                    (calcularAtrasoReal(p.fecha_qa, p.fecha_fin_qa) ? 1 : 0) +
                    (calcularAtrasoReal(p.fecha_uat, p.fecha_fin_uat) ? 1 : 0);
            }, 0);

            const totalReprogramaciones = Object.values(conteoReprogramacionesGlobal || {}).reduce((acc, n) => acc + n, 0);
            const proyectosReprogramados = Object.keys(conteoReprogramacionesGlobal || {}).length;

            const promedioLead = promedio(leadTimes);
            const detalleLead = leadTimes.length
                ? `${leadTimes.length} requerimiento${leadTimes.length === 1 ? '' : 's'} medido${leadTimes.length === 1 ? '' : 's'}`
                : 'Sin liberaciones con fecha';

            const kpis = [
                { titulo: 'Total requerimientos', valor: total, detalle: 'Portafolio vigente', icono: 'layers', clase: 'bg-blue-50 text-blue-700' },
                { titulo: 'Liberados', valor: liberados, detalle: `${total ? Math.round((liberados / total) * 100) : 0}% del total`, icono: 'rocket', clase: 'bg-emerald-50 text-emerald-700' },
                { titulo: 'Cumplimiento fechas', valor: `${cumplimiento}%`, detalle: `${fasesEnTiempo}/${fasesMedidas} fases en tiempo`, icono: 'badge-check', clase: 'bg-violet-50 text-violet-700' },
                { titulo: 'Lead time promedio', valor: leadTimes.length ? `${promedioLead} d` : '—', detalle: detalleLead, icono: 'timer', clase: 'bg-amber-50 text-amber-700' },
                { titulo: 'Reprogramaciones', valor: totalReprogramaciones, detalle: `${proyectosReprogramados} requerimiento${proyectosReprogramados === 1 ? '' : 's'}`, icono: 'calendar-clock', clase: 'bg-orange-50 text-orange-700' },
                { titulo: 'Atrasos reales', valor: totalAtrasosReales, detalle: 'Fases abiertas vencidas', icono: 'alert-triangle', clase: 'bg-rose-50 text-rose-700' }
            ];

            contenedor.innerHTML = kpis.map(k => `
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition">
                    <div class="flex justify-between items-start gap-4">
                        <div>
                            <p class="text-xs font-black uppercase tracking-wide text-slate-400">${k.titulo}</p>
                            <h3 class="text-3xl font-black text-slate-900 mt-2">${k.valor}</h3>
                            <p class="text-xs text-slate-500 mt-1">${k.detalle}</p>
                        </div>
                        <div class="${k.clase} w-11 h-11 rounded-2xl flex items-center justify-center">
                            <i data-lucide="${k.icono}" class="w-5 h-5"></i>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function crearOActualizarGrafica(idCanvas, tipo, labels, data, label) {
            const canvas = document.getElementById(idCanvas);
            if (!canvas || typeof Chart === 'undefined') return;
            const ctx = canvas.getContext('2d');

            if (chartsEjecutivos[idCanvas]) {
                chartsEjecutivos[idCanvas].destroy();
            }

            const colores = [
                'rgba(37, 99, 235, 0.75)',
                'rgba(16, 185, 129, 0.75)',
                'rgba(245, 158, 11, 0.75)',
                'rgba(139, 92, 246, 0.75)',
                'rgba(244, 63, 94, 0.75)',
                'rgba(6, 182, 212, 0.75)',
                'rgba(249, 115, 22, 0.75)'
            ];

            chartsEjecutivos[idCanvas] = new Chart(ctx, {
                type: tipo,
                data: {
                    labels,
                    datasets: [{
                        label,
                        data,
                        backgroundColor: tipo === 'line' ? 'rgba(37, 99, 235, 0.18)' : colores,
                        borderColor: tipo === 'line' ? 'rgba(37, 99, 235, 1)' : colores.map(c => c.replace('0.75', '1')),
                        borderWidth: 2,
                        tension: 0.35,
                        fill: tipo === 'line'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: tipo === 'doughnut', position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                    },
                    scales: tipo === 'doughnut' ? {} : {
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                        x: { ticks: { font: { size: 11 } } }
                    }
                }
            });
        }

        function renderizarDashboardEjecutivo(proyectos) {
            const existeDashboard = document.getElementById('dashboard-ejecutivo') || document.getElementById('kpis-ejecutivos');
            if (!existeDashboard) return;
            renderizarKpisEjecutivos(proyectos);

            const porEstatus = contarPor(proyectos, p => (p.estatus || 'BACKLOG').toUpperCase());
            crearOActualizarGrafica('chart-estatus', 'doughnut', Object.keys(porEstatus), Object.values(porEstatus), 'Estatus');

            const porSistema = contarPor(proyectos, p => p.cat_sistemas?.nombre || 'Sin sistema');
            crearOActualizarGrafica('chart-sistemas', 'bar', Object.keys(porSistema), Object.values(porSistema), 'Requerimientos');

            const porSprint = contarPor(proyectos, p => p.cat_sprints?.nombre || 'Sin sprint');
            crearOActualizarGrafica('chart-sprints', 'bar', Object.keys(porSprint), Object.values(porSprint), 'Requerimientos');

            const liberaciones = {};
            proyectos.forEach(p => {
                if (!p.fecha_liberacion_prod) return;
                const d = new Date(p.fecha_liberacion_prod + 'T00:00:00');
                const clave = d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
                liberaciones[clave] = (liberaciones[clave] || 0) + 1;
            });
            crearOActualizarGrafica('chart-liberaciones', 'line', Object.keys(liberaciones), Object.values(liberaciones), 'Liberados');

            lucide.createIcons();
        }

        function filtrarProyectos() {
            const texto = (document.getElementById('input-buscar')?.value || '').toLowerCase().trim();
            const estatusSeleccionado = normalizarTexto(document.getElementById('filtro-estatus')?.value || '');
            const sistemaSeleccionado = document.getElementById('filtro-sistema')?.value || '';
            const sprintSeleccionado = document.getElementById('filtro-sprint')?.value || '';

            const filtrados = todosLosProyectos.filter(p => {
                const estatusProyecto = normalizarTexto(p.estatus || 'BACKLOG');

                const coincideTexto =
                    !texto ||
                    (p.nombre_rqm || '').toLowerCase().includes(texto) ||
                    (p.id_req || '').toLowerCase().includes(texto) ||
                    (p.responsable_sistemas || '').toLowerCase().includes(texto) ||
                    (p.asignado_a || '').toLowerCase().includes(texto) ||
                    (p.cat_sistemas?.nombre || '').toLowerCase().includes(texto) ||
                    (p.cat_sprints?.nombre || '').toLowerCase().includes(texto) ||
                    (p.cat_clasificaciones?.nombre || '').toLowerCase().includes(texto);

                const coincideEstatus =
                    !estatusSeleccionado ||
                    estatusProyecto === estatusSeleccionado;

                const coincideSistema =
                    !sistemaSeleccionado ||
                    String(p.sistema_id || '') === String(sistemaSeleccionado);

                const coincideSprint =
                    !sprintSeleccionado ||
                    String(p.sprint_id || '') === String(sprintSeleccionado);

                return coincideTexto && coincideEstatus && coincideSistema && coincideSprint;
            });

            renderizarTabla(filtrados, conteoCambiosGlobal);
            renderizarContadoresDinamicos(filtrados);
            renderizarDashboardEjecutivo(filtrados);
        }

        function exportarExcel() {
            if (typeof XLSX === 'undefined') {
                alert('No se pudo cargar la librería de Excel. Revisa tu conexión a internet.');
                return;
            }

            const datos = todosLosProyectos.map(p => ({
                "ID REQ": p.id_req || '',
                "Nombre RQM": p.nombre_rqm || '',
                "Sprint": p.cat_sprints?.nombre || '',
                "Sistema": p.cat_sistemas?.nombre || '',
                "Prioridad": p.prioridad || '',
                "Clasificación": p.cat_clasificaciones?.nombre || '',
                "Responsable Sistemas": p.responsable_sistemas || '',
                "Asignado A": p.asignado_a || '',
                "Área Solicitante": p.cat_areas?.nombre || '',
                "Solicitante": p.solicitante || '',
                "Estatus": p.estatus || '',
                "Ingreso RQM a PMO": p.fecha_ingreso_pmo || '',
                "Compromiso Desarrollo": p.fecha_desarrollo || '',
                "Inicio Desarrollo": p.fecha_inicio_desarrollo || '',
                "Fin Desarrollo": p.fecha_fin_desarrollo || '',
                "Días Desarrollo": calcularDiasEntreFechas(p.fecha_inicio_desarrollo, p.fecha_fin_desarrollo) || '',
                "Atraso Desarrollo": calcularDesviacion(p.fecha_desarrollo, p.fecha_fin_desarrollo) || '',
                "Compromiso QA": p.fecha_qa || '',
                "Inicio QA": p.fecha_inicio_qa || '',
                "Fin QA": p.fecha_fin_qa || '',
                "Días QA": calcularDiasEntreFechas(p.fecha_inicio_qa, p.fecha_fin_qa) || '',
                "Atraso QA": calcularDesviacion(p.fecha_qa, p.fecha_fin_qa) || '',
                "Compromiso UAT": p.fecha_uat || '',
                "Inicio UAT": p.fecha_inicio_uat || '',
                "Fin UAT": p.fecha_fin_uat || '',
                "Días UAT": calcularDiasEntreFechas(p.fecha_inicio_uat, p.fecha_fin_uat) || '',
                "Atraso UAT": calcularDesviacion(p.fecha_uat, p.fecha_fin_uat) || '',
                "Liberación Producción": p.fecha_liberacion_prod || '',
                "Descripción": p.descripcion || '',
                "Comentarios": p.comentarios || ''
            }));

            const ws = XLSX.utils.json_to_sheet(datos);
            const wb = XLSX.utils.book_new();

            ws['!cols'] = Object.keys(datos[0] || { "PMO Control": "" }).map(() => ({ wch: 22 }));

            XLSX.utils.book_append_sheet(wb, ws, "PMO Control");
            XLSX.writeFile(wb, `PMO_Control_${new Date().toISOString().slice(0, 10)}.xlsx`);
        }

        
        function obtenerProyectosFiltradosActuales() {
            const texto = (document.getElementById('input-buscar')?.value || '').toLowerCase().trim();
            const estatusSeleccionado = normalizarTexto(document.getElementById('filtro-estatus')?.value || '');
            const sistemaSeleccionado = document.getElementById('filtro-sistema')?.value || '';
            const sprintSeleccionado = document.getElementById('filtro-sprint')?.value || '';

            return todosLosProyectos.filter(p => {
                const estatusProyecto = normalizarTexto(p.estatus || 'BACKLOG');
                const coincideTexto =
                    !texto ||
                    (p.nombre_rqm || '').toLowerCase().includes(texto) ||
                    (p.id_req || '').toLowerCase().includes(texto) ||
                    (p.responsable_sistemas || '').toLowerCase().includes(texto) ||
                    (p.asignado_a || '').toLowerCase().includes(texto) ||
                    (p.cat_sistemas?.nombre || '').toLowerCase().includes(texto) ||
                    (p.cat_sprints?.nombre || '').toLowerCase().includes(texto) ||
                    (p.cat_clasificaciones?.nombre || '').toLowerCase().includes(texto);
                const coincideEstatus = !estatusSeleccionado || estatusProyecto === estatusSeleccionado;
                const coincideSistema = !sistemaSeleccionado || String(p.sistema_id || '') === String(sistemaSeleccionado);
                const coincideSprint = !sprintSeleccionado || String(p.sprint_id || '') === String(sprintSeleccionado);
                return coincideTexto && coincideEstatus && coincideSistema && coincideSprint;
            });
        }

        function contarPorCampo(proyectos, obtenerCampo) {
            const conteo = {};
            proyectos.forEach(p => {
                const clave = obtenerCampo(p) || 'Sin dato';
                conteo[clave] = (conteo[clave] || 0) + 1;
            });
            return conteo;
        }

        function barrasReporte(conteo) {
            const entradas = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
            const max = Math.max(...entradas.map(x => x[1]), 1);
            if (entradas.length === 0) return '<p class="muted">Sin datos para mostrar.</p>';
            return entradas.map(([label, valor]) => {
                const ancho = Math.max(8, Math.round((valor / max) * 100));
                return `<div class="bar-row"><div class="bar-label">${label}</div><div class="bar-track"><div class="bar-fill" style="width:${ancho}%"></div></div><div class="bar-value">${valor}</div></div>`;
            }).join('');
        }

        function obtenerDesviacionNumero(fechaCompromiso, fechaReal) {
            if (!fechaCompromiso || !fechaReal) return null;
            const compromiso = new Date(fechaCompromiso + 'T00:00:00');
            const real = new Date(fechaReal + 'T00:00:00');
            return Math.ceil((real - compromiso) / (1000 * 60 * 60 * 24));
        }

        function obtenerRiesgosReporte(proyectos) {
            const riesgos = [];
            proyectos.forEach(p => {
                [
                    { fase: 'Desarrollo', compromiso: p.fecha_desarrollo, real: p.fecha_fin_desarrollo },
                    { fase: 'QA', compromiso: p.fecha_qa, real: p.fecha_fin_qa },
                    { fase: 'UAT', compromiso: p.fecha_uat, real: p.fecha_fin_uat }
                ].forEach(f => {
                    const desviacion = obtenerDesviacionNumero(f.compromiso, f.real);
                    if (desviacion !== null && desviacion > 0) {
                        riesgos.push({ id_req: p.id_req || '—', nombre: p.nombre_rqm || 'Sin nombre', fase: f.fase, dias: desviacion, estatus: p.estatus || '—', responsable: p.responsable_sistemas || '—' });
                    }
                });
            });
            return riesgos.sort((a, b) => b.dias - a.dias);
        }

        function generarReporteGAPSemanal() {
            const proyectos = obtenerProyectosFiltradosActuales();
            const total = proyectos.length;
            const liberados = proyectos.filter(p => ['LIBERADO', 'PRODUCCIÓN', 'PRODUCCION'].includes(normalizarTexto(p.estatus || ''))).length;
            const enDesarrollo = proyectos.filter(p => normalizarTexto(p.estatus || '') === 'DESARROLLO').length;
            const enQA = proyectos.filter(p => normalizarTexto(p.estatus || '') === 'QA').length;
            const enUAT = proyectos.filter(p => normalizarTexto(p.estatus || '') === 'UAT').length;
            const cancelados = proyectos.filter(p => normalizarTexto(p.estatus || '') === 'CANCELADO').length;
            const desviaciones = [];
            proyectos.forEach(p => {
                [obtenerDesviacionNumero(p.fecha_desarrollo, p.fecha_fin_desarrollo), obtenerDesviacionNumero(p.fecha_qa, p.fecha_fin_qa), obtenerDesviacionNumero(p.fecha_uat, p.fecha_fin_uat)].forEach(v => { if (v !== null) desviaciones.push(v); });
            });
            const fasesMedidas = desviaciones.length;
            const fasesEnTiempo = desviaciones.filter(v => v <= 0).length;
            const cumplimiento = fasesMedidas ? Math.round((fasesEnTiempo / fasesMedidas) * 100) : 0;
            const riesgos = obtenerRiesgosReporte(proyectos);
            const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
            const filtros = [document.getElementById('filtro-estatus')?.selectedOptions?.[0]?.text || 'Todos los estatus', document.getElementById('filtro-sistema')?.selectedOptions?.[0]?.text || 'Todos los sistemas', document.getElementById('filtro-sprint')?.selectedOptions?.[0]?.text || 'Todos los sprints'].join(' · ');
            const conteoEstatus = contarPorCampo(proyectos, p => p.estatus || 'BACKLOG');
            const conteoSistema = contarPorCampo(proyectos, p => p.cat_sistemas?.nombre || 'Sin sistema');
            const conteoSprint = contarPorCampo(proyectos, p => p.cat_sprints?.nombre || 'Sin sprint');
            const liberadosSemana = proyectos.filter(p => ['LIBERADO', 'PRODUCCIÓN', 'PRODUCCION'].includes(normalizarTexto(p.estatus || ''))).slice(0, 8).map(p => `<tr><td>${p.id_req || '—'}</td><td>${p.nombre_rqm || 'Sin nombre'}</td><td>${p.cat_sistemas?.nombre || '—'}</td><td>${formatearFechaVista(p.fecha_liberacion_prod)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted center">Sin requerimientos liberados en la vista actual.</td></tr>`;
            const riesgosHtml = riesgos.slice(0, 8).map(r => `<tr><td>${r.id_req}</td><td>${r.nombre}</td><td>${r.fase}</td><td><span class="pill danger">+${r.dias} día${r.dias === 1 ? '' : 's'}</span></td><td>${r.responsable}</td></tr>`).join('') || `<tr><td colspan="5" class="muted center">Sin desviaciones críticas registradas.</td></tr>`;
            const htmlReporte = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte GAP Semanal</title><style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#f8fafc}.page{width:1120px;margin:0 auto;background:#fff;min-height:100vh;padding:34px}.header{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:white;border-radius:24px;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start;box-shadow:0 16px 40px rgba(15,23,42,.18)}.brand{font-size:44px;font-weight:900;letter-spacing:-1px}.subtitle{margin-top:8px;color:rgba(255,255,255,.78);font-size:13px;font-weight:700}.report-title{text-align:right}.report-title h1{margin:0;font-size:25px;line-height:1.1}.report-title p{margin:10px 0 0;color:rgba(255,255,255,.75);font-size:12px;font-weight:700}.meta{margin:18px 0;display:flex;justify-content:space-between;gap:12px;color:#64748b;font-size:12px;font-weight:700}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0}.kpi{border:1px solid #e2e8f0;border-radius:20px;padding:18px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.06)}.kpi .label{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.7px;font-weight:900}.kpi .value{font-size:34px;font-weight:900;margin-top:8px;color:#0f172a}.kpi .detail{font-size:12px;color:#64748b;margin-top:4px;font-weight:700}.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;margin-top:18px}.card{border:1px solid #e2e8f0;border-radius:22px;padding:20px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.05);break-inside:avoid}.card h2{margin:0 0 4px;font-size:16px;font-weight:900}.card .desc{margin:0 0 18px;font-size:12px;color:#64748b;font-weight:700}.bar-row{display:grid;grid-template-columns:120px 1fr 36px;gap:10px;align-items:center;margin:10px 0;font-size:12px;font-weight:800}.bar-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#334155}.bar-track{height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden}.bar-fill{height:100%;background:linear-gradient(90deg,#2563eb,#06b6d4);border-radius:999px}.bar-value{text-align:right;color:#0f172a}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#0f2a6d;color:#fff;text-align:left;padding:10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px}td{padding:10px;border-bottom:1px solid #e2e8f0;color:#334155;font-weight:700}.pill{display:inline-block;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:900}.danger{background:#fee2e2;color:#be123c}.muted{color:#94a3b8;font-weight:700}.center{text-align:center}.summary{background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:18px;color:#1e3a8a;font-weight:800;line-height:1.55;font-size:13px}.footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:14px;color:#94a3b8;font-size:11px;font-weight:700;display:flex;justify-content:space-between}.actions{position:sticky;top:0;background:#f8fafc;padding:14px;display:flex;justify-content:center;gap:10px;z-index:10;border-bottom:1px solid #e2e8f0}.actions button{border:none;background:#2563eb;color:#fff;padding:10px 16px;border-radius:12px;font-weight:900;cursor:pointer}.actions button.secondary{background:#0f172a}@media print{body{background:white}.actions{display:none}.page{width:100%;padding:20px}.card,.kpi,.header{box-shadow:none}}
</style></head><body><div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button><button class="secondary" onclick="descargarHTML()">Descargar HTML</button></div><div class="page"><section class="header"><div><div class="brand">finsus</div><div class="subtitle">Finanzas Transparentes · Seguimiento GAP</div></div><div class="report-title"><h1>Reporte Ejecutivo GAP<br>Semanal</h1><p>${fecha}</p></div></section><div class="meta"><div>Vista aplicada: ${filtros}</div><div>Fuente: PMO Control</div></div><section class="kpis"><div class="kpi"><div class="label">Total requerimientos</div><div class="value">${total}</div><div class="detail">Portafolio vigente</div></div><div class="kpi"><div class="label">Liberados</div><div class="value">${liberados}</div><div class="detail">${total ? Math.round((liberados/total)*100) : 0}% del total</div></div><div class="kpi"><div class="label">Cumplimiento fechas</div><div class="value">${cumplimiento}%</div><div class="detail">${fasesEnTiempo}/${fasesMedidas} fases en tiempo</div></div><div class="kpi"><div class="label">Riesgos por desviación</div><div class="value">${riesgos.length}</div><div class="detail">Fases con atraso registrado</div></div></section><div class="grid"><section class="card"><h2>Resumen Ejecutivo</h2><p class="desc">Estado general del seguimiento operativo GAP.</p><div class="summary">Se reportan <b>${total}</b> requerimientos en la vista actual, con <b>${liberados}</b> liberados, <b>${enDesarrollo}</b> en desarrollo, <b>${enQA}</b> en QA, <b>${enUAT}</b> en UAT y <b>${cancelados}</b> cancelados. El cumplimiento de fechas medido es de <b>${cumplimiento}%</b>.</div></section><section class="card"><h2>Distribución por Estatus</h2><p class="desc">Carga actual del portafolio por etapa.</p>${barrasReporte(conteoEstatus)}</section></div><div class="grid"><section class="card"><h2>Distribución por Sistema</h2><p class="desc">Carga por aplicativo o plataforma.</p>${barrasReporte(conteoSistema)}</section><section class="card"><h2>Distribución por Sprint</h2><p class="desc">Volumen registrado por sprint.</p>${barrasReporte(conteoSprint)}</section></div><section class="card" style="margin-top:18px;"><h2>Requerimientos Liberados</h2><p class="desc">Últimos requerimientos liberados dentro de la vista actual.</p><table><thead><tr><th>ID Req</th><th>Proyecto</th><th>Sistema</th><th>Fecha Liberación</th></tr></thead><tbody>${liberadosSemana}</tbody></table></section><section class="card" style="margin-top:18px;"><h2>Riesgos y Desviaciones</h2><p class="desc">Fases con atraso respecto a la fecha compromiso.</p><table><thead><tr><th>ID Req</th><th>Proyecto</th><th>Fase</th><th>Desviación</th><th>Responsable</th></tr></thead><tbody>${riesgosHtml}</tbody></table></section><div class="footer"><span>PMO Control · Reporte generado automáticamente</span><span>GAP / PMO / QA / Desarrollo</span></div></div><script>function descargarHTML(){const contenido=document.documentElement.outerHTML;const blob=new Blob([contenido],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');const fechaArchivo=new Date().toISOString().slice(0,10);a.href=url;a.download='Reporte_GAP_Semanal_'+fechaArchivo+'.html';a.click();URL.revokeObjectURL(url);}</` + `script></body></html>`;
            const ventana = window.open('', '_blank');
            if (!ventana) { alert('El navegador bloqueó la ventana emergente. Permite pop-ups para generar el reporte.'); return; }
            ventana.document.open();
            ventana.document.write(htmlReporte);
            ventana.document.close();
        }

        

        let seguimientoCharts = {};

        // Modelo definitivo: se administran ESTATUS operativos y el mapa muestra las 11 actividades del flujo.
        // El carrito se posiciona automáticamente según el estatus del requerimiento; no se captura fase_actual.
        const fasesSeguimientoEjecutivo = [
            { key: 'FOLIO', label: '1. SOLICITUD\nDE FOLIO', corto: 'Folio', icono: '✉️' },
            { key: 'RQM', label: '2. INGRESO\nDE RQM', corto: 'RQM', icono: '📝' },
            { key: 'RECEPCION', label: '3. RECEPCIÓN\nDEL PROYECTO', corto: 'Recepción', icono: '📂' },
            { key: 'ASIGNACION', label: '4. ASIGNACIÓN\nDE ORDEN DE ATENCIÓN', corto: 'Asignación', icono: '📋' },
            { key: 'MESA', label: '5. MESA DE\nTRABAJO', corto: 'Mesa', icono: '👥' },
            { key: 'DEV', label: '6. DESARROLLO\nDEV', corto: 'DEV', icono: '💻' },
            { key: 'INST_QA', label: '7. INSTALACIÓN\nQA', corto: 'Inst. QA', icono: '🧪' },
            { key: 'CERT_QA', label: '8. CERTIFICACIÓN\nQA', corto: 'Cert. QA', icono: '✅' },
            { key: 'UAT', label: '9. PRUEBAS DE\nUSUARIO UAT', corto: 'UAT', icono: '👤' },
            { key: 'PROD', label: '10. LIBERACIÓN\nA PRODUCCIÓN', corto: 'PROD', icono: '🚀' },
            { key: 'FEEDBACK', label: '11. FEEDBACK\nY CALIDAD', corto: 'Feedback', icono: '⭐' }
        ];

        const estatusSeguimientoEjecutivo = [
            { key: 'BACKLOG', label: 'BACKLOG' },
            { key: 'ANALISIS', label: 'ANÁLISIS' },
            { key: 'DESARROLLO', label: 'DESARROLLO' },
            { key: 'QA', label: 'QA' },
            { key: 'UAT', label: 'UAT' },
            { key: 'LIBERADO', label: 'LIBERADO' }
        ];

        function estatusOperativoSeguimiento(valor) {
            const e = normalizarTexto(valor || 'BACKLOG');
            if (e.includes('CANCEL')) return 'CANCELADO';
            if (e.includes('ANALISIS') || e.includes('ANÁLISIS')) return 'ANALISIS';
            if (e.includes('DESARROLLO') || e.includes('DEV')) return 'DESARROLLO';
            if (e === 'QA' || e.includes('CERTIFICACION') || e.includes('CERTIFICACIÓN')) return 'QA';
            if (e.includes('UAT') || e.includes('USUARIO')) return 'UAT';
            if (e.includes('LIBERADO') || e.includes('PRODUCCION') || e.includes('PRODUCCIÓN') || e.includes('PROD')) return 'LIBERADO';
            return 'BACKLOG';
        }

        function calcularAvanceEstatusSeguimiento(valor) {
            const key = estatusOperativoSeguimiento(valor || 'BACKLOG');
            const mapa = {
                BACKLOG: 0,
                ANALISIS: 20,
                DESARROLLO: 40,
                QA: 60,
                UAT: 80,
                LIBERADO: 100,
                CANCELADO: 0
            };
            return mapa[key] ?? 0;
        }


        function esProyectoCanceladoSeguimiento(p) {
            return estatusOperativoSeguimiento(p?.estatus || '') === 'CANCELADO';
        }

        function proyectosConsideradosAvanceSeguimiento(proyectos = []) {
            const lista = Array.isArray(proyectos) ? proyectos : [];
            return lista.filter(p => !esProyectoCanceladoSeguimiento(p));
        }

        function calcularAvancePromedioSeguimiento(proyectos = []) {
            const lista = proyectosConsideradosAvanceSeguimiento(proyectos);
            if (!lista.length) return 0;
            const total = lista.reduce((acc, p) => acc + calcularAvanceEstatusSeguimiento(p?.estatus || 'BACKLOG'), 0);
            return Math.round(total / lista.length);
        }

        function actualizarAvanceGeneralSeguimiento(proyectos = []) {
            const listaOriginal = Array.isArray(proyectos) ? proyectos : [];
            const listaConsiderada = proyectosConsideradosAvanceSeguimiento(listaOriginal);
            const cancelados = listaOriginal.length - listaConsiderada.length;
            const valor = calcularAvancePromedioSeguimiento(listaOriginal);
            const valorEl = document.getElementById('seguimiento-avance-general-valor');
            const detalleEl = document.getElementById('seguimiento-avance-general-detalle');
            const cardEl = document.getElementById('seguimiento-avance-general');

            if (valorEl) valorEl.textContent = `${valor}%`;
            if (detalleEl) {
                const total = listaConsiderada.length;
                const textoBase = `${total} requerimiento${total === 1 ? '' : 's'} considerado${total === 1 ? '' : 's'}`;
                detalleEl.textContent = cancelados > 0 ? `${textoBase} · ${cancelados} cancelado${cancelados === 1 ? '' : 's'} no considerado${cancelados === 1 ? '' : 's'}` : textoBase;
            }

            if (cardEl) {
                cardEl.classList.remove('bg-emerald-50','border-emerald-100','bg-amber-50','border-amber-100','bg-rose-50','border-rose-100','bg-blue-50','border-blue-100');
                const color = valor >= 85
                    ? ['bg-emerald-50','border-emerald-100']
                    : valor >= 60
                        ? ['bg-amber-50','border-amber-100']
                        : ['bg-rose-50','border-rose-100'];
                cardEl.classList.add(...color);
            }
        }

        function indiceFaseSeguimiento(proyectoOestatus) {
            const estatus = typeof proyectoOestatus === 'object' ? proyectoOestatus?.estatus : proyectoOestatus;
            const key = estatusOperativoSeguimiento(estatus);
            const mapa = {
                BACKLOG: 3,      // Solicitud, RQM, Recepción y Asignación
                ANALISIS: 4,     // Mesa de Trabajo
                DESARROLLO: 5,   // Desarrollo DEV
                QA: 7,           // Instalación QA + Certificación QA
                UAT: 8,          // Pruebas usuario UAT
                LIBERADO: 10,     // Liberado: se pinta hasta Feedback y Calidad
                CANCELADO: 0
            };
            return mapa[key] ?? 0;
        }

        function nombreFaseActualSeguimiento(p) {
            const fase = fasesSeguimientoEjecutivo[indiceFaseSeguimiento(p)];
            return fase?.corto || 'Folio';
        }


        function fechasFaseSeguimiento(p, key) {
            const fmt = (fecha) => fecha ? formatearFechaVista(fecha).replace('.', '') : '';
            const linea = (a, b) => {
                const ia = fmt(a);
                const ib = fmt(b);
                if (ia && ib) return `${ia}<br>${ib}`;
                return ia || ib || '';
            };

            switch (key) {
                case 'DEV':
                    return linea(p.fecha_inicio_desarrollo, p.fecha_fin_desarrollo);
                case 'INST_QA':
                    return fmt(p.fecha_fin_desarrollo);
                case 'CERT_QA':
                    return linea(p.fecha_inicio_qa, p.fecha_fin_qa);
                case 'UAT':
                    return linea(p.fecha_inicio_uat, p.fecha_fin_uat);
                case 'PROD':
                    return fmt(p.fecha_liberacion_prod);
                default:
                    return '';
            }
        }

        function calcularMaxDesviacionProyecto(p) {
            const vals = [];

            if (!tieneAjusteAdministrativo(p.id, 'Fin Desarrollo')) {
                vals.push(obtenerDesviacionDias(p.fecha_desarrollo, p.fecha_fin_desarrollo));
            }

            if (!tieneAjusteAdministrativo(p.id, 'Fin QA')) {
                vals.push(obtenerDesviacionDias(p.fecha_qa, p.fecha_fin_qa));
            }

            if (!tieneAjusteAdministrativo(p.id, 'Fin UAT')) {
                vals.push(obtenerDesviacionDias(p.fecha_uat, p.fecha_fin_uat));
            }

            const filtrados = vals.filter(v => typeof v === 'number');
            if (!filtrados.length) return null;
            return Math.max(...filtrados);
        }

        function contarAtrasosRealesProyecto(p) {
            const atrasos = [];
            if (!tieneAjusteAdministrativo(p.id, 'Fin Desarrollo')) atrasos.push(calcularAtrasoReal(p.fecha_desarrollo, p.fecha_fin_desarrollo));
            if (!tieneAjusteAdministrativo(p.id, 'Fin QA')) atrasos.push(calcularAtrasoReal(p.fecha_qa, p.fecha_fin_qa));
            if (!tieneAjusteAdministrativo(p.id, 'Fin UAT')) atrasos.push(calcularAtrasoReal(p.fecha_uat, p.fecha_fin_uat));
            return atrasos.filter(Boolean).length;
        }

        function estadoSemaforoProyecto(p) {
            const reprogramaciones = contarReprogramacionesProyecto(p.id);
            const atrasos = contarAtrasosRealesProyecto(p);
            const desviacion = calcularMaxDesviacionProyecto(p);

            if (atrasos > 0) return { texto: 'Atraso real', clase: 'bg-rose-50 text-rose-700 border-rose-100', icono: '🔴' };
            // Reprogramado debe salir únicamente cuando existe auditoría real de reprogramación.
            // Una desviación positiva (+días) no necesariamente es reprogramación; puede ser un ajuste administrativo.
            if (reprogramaciones > 0) return { texto: 'Reprogramado', clase: 'bg-amber-50 text-amber-700 border-amber-100', icono: '🟡' };
            if (desviacion !== null && desviacion > 0) return { texto: 'Con desviación', clase: 'bg-orange-50 text-orange-700 border-orange-100', icono: '🟠' };
            return { texto: 'En tiempo', clase: 'bg-emerald-50 text-emerald-700 border-emerald-100', icono: '🟢' };
        }

        function destruirGraficaSeguimiento(id) {
            if (seguimientoCharts[id]) {
                seguimientoCharts[id].destroy();
                delete seguimientoCharts[id];
            }
        }

        const etiquetasValoresSeguimiento = {
            id: 'etiquetasValoresSeguimiento',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const tipo = chart.config.type;
                const dataset = chart.data.datasets?.[0];
                const meta = chart.getDatasetMeta(0);
                if (!dataset || !meta) return;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '900 13px Arial, sans-serif';

                meta.data.forEach((elemento, indice) => {
                    const valor = Number(dataset.data[indice] || 0);
                    const visible = typeof chart.getDataVisibility === 'function'
                        ? chart.getDataVisibility(indice)
                        : !elemento.hidden;
                    if (!visible) return;

                    if (tipo === 'bar') {
                        const pos = elemento.getCenterPoint();
                        if (valor > 0) {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(String(valor), pos.x, pos.y);
                        } else {
                            const baseY = elemento.base ?? chart.chartArea.bottom;
                            ctx.fillStyle = '#64748b';
                            ctx.fillText('0', pos.x, baseY - 12);
                        }
                        return;
                    }

                    if (tipo === 'doughnut' && valor > 0) {
                        const props = elemento.getProps(['x', 'y', 'startAngle', 'endAngle', 'innerRadius', 'outerRadius'], true);
                        const angulo = (props.startAngle + props.endAngle) / 2;
                        const radio = (props.innerRadius + props.outerRadius) / 2;
                        const x = props.x + Math.cos(angulo) * radio;
                        const y = props.y + Math.sin(angulo) * radio;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(String(valor), x, y);
                    }
                });

                if (tipo === 'doughnut') {
                    const total = dataset.data.reduce((acumulado, valor, indice) => {
                        const visible = typeof chart.getDataVisibility === 'function'
                            ? chart.getDataVisibility(indice)
                            : !meta.data[indice]?.hidden;
                        return visible ? acumulado + Number(valor || 0) : acumulado;
                    }, 0);
                    const primerArco = meta.data.find((arco, indice) => {
                        return typeof chart.getDataVisibility === 'function'
                            ? chart.getDataVisibility(indice)
                            : !arco.hidden;
                    });
                    const centro = primerArco
                        ? primerArco.getProps(['x', 'y'], true)
                        : {
                            x: (chart.chartArea.left + chart.chartArea.right) / 2,
                            y: (chart.chartArea.top + chart.chartArea.bottom) / 2
                        };

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#0f172a';
                    ctx.font = '900 32px Arial, sans-serif';
                    ctx.fillText(String(total), centro.x, centro.y - 8);

                    ctx.fillStyle = '#64748b';
                    ctx.font = '800 11px Arial, sans-serif';
                    ctx.fillText(total === 1 ? 'REQUERIMIENTO' : 'REQUERIMIENTOS', centro.x, centro.y + 18);
                }

                ctx.restore();
            }
        };

        function crearGraficaSeguimiento(idCanvas, tipo, labels, data, label) {
            const canvas = document.getElementById(idCanvas);
            if (!canvas || typeof Chart === 'undefined') return;

            destruirGraficaSeguimiento(idCanvas);

            const colores = [
                'rgba(30, 58, 138, 0.90)',
                'rgba(37, 99, 235, 0.85)',
                'rgba(245, 158, 11, 0.85)',
                'rgba(249, 115, 22, 0.85)',
                'rgba(16, 185, 129, 0.85)',
                'rgba(225, 29, 72, 0.85)',
                'rgba(100, 116, 139, 0.85)'
            ];

            seguimientoCharts[idCanvas] = new Chart(canvas, {
                type: tipo,
                plugins: [etiquetasValoresSeguimiento],
                data: {
                    labels,
                    datasets: [{
                        label,
                        data,
                        backgroundColor: tipo === 'doughnut' ? colores : 'rgba(30, 58, 138, 0.92)',
                        borderColor: tipo === 'doughnut' ? '#ffffff' : 'rgba(30, 58, 138, 1)',
                        borderWidth: tipo === 'doughnut' ? 3 : 1,
                        borderRadius: tipo === 'bar' ? 8 : 0,
                        maxBarThickness: 70
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: tipo === 'doughnut' ? '62%' : undefined,
                    plugins: {
                        legend: { display: tipo === 'doughnut', position: 'right', labels: { boxWidth: 12, padding: 14, font: { size: 12, weight: 'bold' } } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}` } }
                    },
                    scales: tipo === 'doughnut' ? {} : {
                        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(148, 163, 184, 0.18)' } },
                        x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } }
                    }
                }
            });
        }

        function obtenerVistaPortafolioSeleccionada() {
            return document.getElementById('seguimiento-vista-portafolio')?.value || 'general';
        }

        function obtenerProyectosDonaSeguimiento(proyectosFiltrados) {
            return obtenerVistaPortafolioSeleccionada() === 'sprint'
                ? proyectosFiltrados
                : (todosLosProyectos || []);
        }

        function actualizarTextosVistaPortafolio(proyectosDona) {
            const vista = obtenerVistaPortafolioSeleccionada();
            const titulo = document.getElementById('titulo-distribucion-portafolio');
            const subtitulo = document.getElementById('subtitulo-distribucion-portafolio');
            const badge = document.getElementById('badge-vista-portafolio');
            const total = Array.isArray(proyectosDona) ? proyectosDona.length : 0;

            if (vista === 'sprint') {
                const sprint = obtenerNombreSprintSeleccionado();
                if (titulo) titulo.textContent = `Distribución del Sprint - ${sprint}`;
                if (subtitulo) subtitulo.textContent = `${total} requerimiento${total === 1 ? '' : 's'} del sprint seleccionado`;
                if (badge) {
                    badge.textContent = 'Vista sprint';
                    badge.className = 'inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700';
                }
            } else {
                if (titulo) titulo.textContent = 'Distribución general del portafolio';
                if (subtitulo) subtitulo.textContent = `${total} requerimiento${total === 1 ? '' : 's'} registrados en total`;
                if (badge) {
                    badge.textContent = 'Vista general';
                    badge.className = 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700';
                }
            }
        }

        function renderizarGraficasSeguimientoEjecutivo(proyectos) {
            const gruposBase = estatusSeguimientoEjecutivo.map(g => g.label);
            const conteoAvance = Object.fromEntries(gruposBase.map(g => [g, 0]));

            proyectos.forEach(p => {
                const key = estatusOperativoSeguimiento(p.estatus || 'BACKLOG');
                const label = estatusSeguimientoEjecutivo.find(g => g.key === key)?.label || 'BACKLOG';
                if (conteoAvance[label] !== undefined) conteoAvance[label] += 1;
            });

            crearGraficaSeguimiento('seguimiento-chart-avance', 'bar', gruposBase, gruposBase.map(g => conteoAvance[g]), 'Requerimientos');

            const proyectosDona = obtenerProyectosDonaSeguimiento(proyectos);
            actualizarTextosVistaPortafolio(proyectosDona);

            const orden = ['LIBERADO', 'UAT', 'QA', 'DESARROLLO', 'ANALISIS', 'BACKLOG', 'CANCELADO'];
            const porEstatus = {};
            proyectosDona.forEach(p => {
                const key = estatusOperativoSeguimiento(p.estatus || 'BACKLOG');
                porEstatus[key] = (porEstatus[key] || 0) + 1;
            });

            const labels = orden.filter(k => porEstatus[k] > 0).map(k => `${k} ${porEstatus[k]}`);
            const data = orden.filter(k => porEstatus[k] > 0).map(k => porEstatus[k]);
            crearGraficaSeguimiento('seguimiento-chart-portafolio', 'doughnut', labels, data, 'Portafolio');
        }

        function renderizarLineaFases(p) {
            const actual = indiceFaseSeguimiento(p);
            const progreso = Math.max(0, Math.min(100, (actual / (fasesSeguimientoEjecutivo.length - 1)) * 100));

            return `
                <div class="mt-7 overflow-x-auto pb-2">
                    <div class="relative min-w-[1120px] px-2 py-2">
                        <div class="absolute left-8 right-8 top-[38px] h-1.5 rounded-full bg-slate-200"></div>
                        <div class="absolute left-8 top-[38px] h-1.5 rounded-full bg-emerald-500 transition-all" style="width: ${progreso}%; max-width: calc(100% - 4rem);"></div>
                        <div class="grid grid-cols-11 gap-2 relative z-10">
                            ${fasesSeguimientoEjecutivo.map((fase, idx) => {
                                const completada = idx < actual;
                                const actualFase = idx === actual;
                                const pendiente = idx > actual;
                                const circuloClase = actualFase
                                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110 shadow-lg shadow-blue-200/70'
                                    : completada
                                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100'
                                        : 'bg-slate-100 text-slate-400';
                                const textoClase = actualFase ? 'text-blue-700' : completada ? 'text-slate-700' : 'text-slate-400';
                                const checkClase = actualFase ? 'bg-blue-600 text-white' : completada ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400';
                                const fechas = fechasFaseSeguimiento(p, fase.key);

                                return `
                                    <div class="text-center">
                                        <div class="h-[74px] flex flex-col items-center justify-start">
                                            <div class="w-14 h-14 rounded-full ${circuloClase} flex items-center justify-center text-2xl transition relative">
                                                ${actualFase ? '<span class="inline-block" style="transform:scaleX(-1);">🚙</span>' : `<span>${fase.icono}</span>`}
                                            </div>
                                            <div class="mt-2 w-5 h-5 rounded-full ${checkClase} flex items-center justify-center text-[11px] font-black">${(completada || actualFase) ? '✓' : ''}</div>
                                        </div>
                                        <div class="mt-3 min-h-[54px] flex items-start justify-center">
                                            <p class="text-[10px] md:text-[11px] font-black uppercase leading-tight whitespace-pre-line ${textoClase}">${fase.label}</p>
                                        </div>
                                        <div class="mt-1 min-h-[30px] text-[9px] md:text-[10px] font-black leading-tight text-slate-500">
                                            ${fechas || '&nbsp;'}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        function renderizarTarjetaSeguimiento(p) {
            const semaforo = estadoSemaforoProyecto(p);
            const desviacion = calcularMaxDesviacionProyecto(p);
            const atrasos = contarAtrasosRealesProyecto(p);
            const avance = calcularAvanceEstatusSeguimiento(p.estatus || 'BACKLOG');

            return `
                <article class="border border-slate-100 rounded-3xl p-5 bg-slate-50/40 hover:bg-white hover:shadow-md transition">
                    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-[11px] font-black bg-slate-900 text-white px-2.5 py-1 rounded-full">${p.id_req || 'SIN ID'}</span>
                                <span class="text-[11px] font-black px-2.5 py-1 rounded-full border ${semaforo.clase}">${semaforo.icono} ${semaforo.texto}</span>
                            </div>

                            <h4 class="text-base font-black text-slate-900 mt-3">${p.nombre_rqm || 'Sin nombre'}</h4>
                            <p class="text-xs text-slate-500 mt-1">${p.cat_sistemas?.nombre || 'Sin sistema'} · ${p.cat_sprints?.nombre || 'Sin sprint'}</p>
                            <p class="text-[11px] text-slate-400 mt-1 font-bold">Estatus: <span class="text-slate-600">${p.estatus || 'BACKLOG'}</span></p>
                        </div>

                        <div class="grid grid-cols-3 gap-2 text-center min-w-[260px]">
                            <div class="bg-white border border-slate-100 rounded-2xl p-3">
                                <p class="text-[10px] font-black text-slate-400 uppercase">Avance</p>
                                <p class="text-lg font-black text-slate-900">${avance}%</p>
                            </div>
                            <div class="bg-white border border-slate-100 rounded-2xl p-3">
                                <p class="text-[10px] font-black text-slate-400 uppercase">Desv.</p>
                                <p class="text-lg font-black ${desviacion && desviacion > 0 ? 'text-rose-600' : 'text-emerald-600'}">${desviacion === null ? '—' : (desviacion > 0 ? '+' : '') + desviacion + 'd'}</p>
                            </div>
                            <div class="bg-white border border-slate-100 rounded-2xl p-3">
                                <p class="text-[10px] font-black text-slate-400 uppercase">Atraso</p>
                                <p class="text-lg font-black ${atrasos ? 'text-rose-600' : 'text-slate-400'}">${atrasos || '—'}</p>
                            </div>
                        </div>
                    </div>

                    ${renderizarLineaFases(p)}
                </article>
            `;
        }


        function obtenerNombreSprintSeleccionado() {
            const sel = document.getElementById('seguimiento-filtro-sprint');
            if (!sel || !sel.value) return 'TODOS LOS SPRINTS';
            return String(sel.options[sel.selectedIndex]?.textContent || 'SPRINT').trim().toUpperCase();
        }

        function obtenerRangoSemanaActual() {
            const hoy = new Date();
            const dia = hoy.getDay(); // Domingo = 0
            const diferenciaLunes = dia === 0 ? -6 : 1 - dia;
            const lunes = new Date(hoy);
            lunes.setDate(hoy.getDate() + diferenciaLunes);
            const viernes = new Date(lunes);
            viernes.setDate(lunes.getDate() + 4);
            const ddLunes = String(lunes.getDate()).padStart(2, '0');
            const ddViernes = String(viernes.getDate()).padStart(2, '0');
            const mesViernes = viernes.toLocaleDateString('es-MX', { month: 'long' });
            const anioViernes = viernes.getFullYear();
            if (lunes.getMonth() === viernes.getMonth()) {
                return `Semana del ${ddLunes} al ${ddViernes} de ${mesViernes} ${anioViernes}`;
            }
            const mesLunes = lunes.toLocaleDateString('es-MX', { month: 'long' });
            return `Semana del ${ddLunes} de ${mesLunes} al ${ddViernes} de ${mesViernes} ${anioViernes}`;
        }

        function actualizarTextosReporteSeguimiento() {
            const tituloAvance = document.getElementById('titulo-avance-sprint');
            if (tituloAvance) tituloAvance.textContent = `Avance del Sprint - ${obtenerNombreSprintSeleccionado()}`;
            const rango = document.getElementById('seguimiento-rango-semana');
            if (rango) rango.textContent = obtenerRangoSemanaActual();
        }

        function nombreArchivoReporte(base) {
            const limpio = String(base || 'reporte')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9_-]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .toLowerCase();
            return `${limpio}_${new Date().toISOString().slice(0, 10)}`;
        }

        function ocultarBotonesExportacion(elemento, ocultar = true) {
            if (!elemento) return;
            elemento.querySelectorAll('.no-export').forEach(el => {
                if (ocultar) {
                    el.dataset.exportVisibility = el.style.visibility || '';
                    el.style.visibility = 'hidden';
                } else {
                    el.style.visibility = el.dataset.exportVisibility || '';
                    delete el.dataset.exportVisibility;
                }
            });
        }

        function descargarDataUrl(dataUrl, nombreArchivo) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = nombreArchivo;
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

        function dataUrlABlob(dataUrl) {
            const partes = dataUrl.split(',');
            const mime = (partes[0].match(/:(.*?);/) || [])[1] || 'image/png';
            const binario = atob(partes[1] || '');
            const len = binario.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binario.charCodeAt(i);
            return new Blob([bytes], { type: mime });
        }

        async function copiarDataUrlComoImagen(dataUrl) {
            if (!navigator.clipboard || !window.ClipboardItem) {
                throw new Error('clipboard_api_no_disponible');
            }
            const blob = dataUrlABlob(dataUrl);
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        }

        async function cargarScriptExportacion(src) {
            return new Promise((resolve, reject) => {
                const existente = [...document.scripts].find(s => s.src === src);
                if (existente) {
                    if (existente.dataset.loaded === 'true') return resolve();
                    existente.addEventListener('load', resolve, { once: true });
                    existente.addEventListener('error', reject, { once: true });
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        async function asegurarLibreriasExportacion() {
            const tareas = [];
            if (!window.htmlToImage) {
                tareas.push(cargarScriptExportacion('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js').catch(() => null));
            }
            if (!window.jspdf?.jsPDF) {
                tareas.push(cargarScriptExportacion('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').catch(() => null));
            }
            if (!window.html2canvas) {
                tareas.push(cargarScriptExportacion('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js').catch(() => null));
            }
            if (tareas.length) await Promise.all(tareas);
        }

        async function capturarSeccionReporte(idElemento, opciones = {}) {
            const elemento = document.getElementById(idElemento);
            if (!elemento) return null;

            await asegurarLibreriasExportacion();
            ocultarBotonesExportacion(elemento, true);

            const incluirEncabezadoExport = opciones.incluirEncabezadoExport !== false;
            let headerTemporal = null;
            let tituloSeccionOculto = null;
            let rangoSeccionOculto = null;
            if (opciones.ocultarTituloSeccion === true && idElemento === 'reporte-mapa-requerimientos') {
                tituloSeccionOculto = elemento.querySelector('h3');
                rangoSeccionOculto = elemento.querySelector('#seguimiento-rango-semana');
                [tituloSeccionOculto, rangoSeccionOculto].forEach(el => {
                    if (!el) return;
                    el.dataset.exportDisplay = el.style.display || '';
                    el.style.display = 'none';
                });
            }
            if (idElemento === 'reporte-mapa-requerimientos' && incluirEncabezadoExport) {
                headerTemporal = document.createElement('div');
                headerTemporal.className = 'export-temp-header mb-5 rounded-2xl overflow-hidden';
                headerTemporal.innerHTML = `
                    <div style="background:#0f172a;color:white;padding:22px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px;">
                        <div>
                            <div style="font-size:24px;font-weight:900;line-height:1.1;">Seguimiento semanal de requerimientos</div>
                            <div style="font-size:13px;font-weight:700;color:#dbeafe;margin-top:8px;">${obtenerRangoSemanaActual()}</div>
                        </div>
                        <div style="font-size:36px;font-weight:900;letter-spacing:1px;">FINSUS</div>
                    </div>`;
                elemento.prepend(headerTemporal);
            }

            try {
                // Preferimos html-to-image porque maneja mejor los estilos modernos de Tailwind.
                if (window.htmlToImage?.toPng) {
                    const dataUrl = await window.htmlToImage.toPng(elemento, {
                        cacheBust: true,
                        pixelRatio: 2,
                        backgroundColor: '#ffffff',
                        filter: (node) => !(node.classList && node.classList.contains('no-export'))
                    });
                    return { dataUrl, width: elemento.scrollWidth, height: elemento.scrollHeight };
                }

                if (window.html2canvas) {
                    const canvas = await window.html2canvas(elemento, {
                        backgroundColor: '#ffffff',
                        scale: 2,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                        scrollX: 0,
                        scrollY: -window.scrollY
                    });
                    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
                }

                return null;
            } catch (error) {
                console.error('Error al exportar sección:', error);
                return null;
            } finally {
                if (headerTemporal) headerTemporal.remove();
                [tituloSeccionOculto, rangoSeccionOculto].forEach(el => {
                    if (!el) return;
                    el.style.display = el.dataset.exportDisplay || '';
                    delete el.dataset.exportDisplay;
                });
                ocultarBotonesExportacion(elemento, false);
            }
        }

        async function exportarSeccionImagen(idElemento, nombreBase) {
            const captura = await capturarSeccionReporte(idElemento, {
                incluirEncabezadoExport: true,
                ocultarTituloSeccion: idElemento === 'reporte-mapa-requerimientos'
            });
            if (!captura?.dataUrl) {
                alert('No fue posible generar la imagen. Revisa tu conexión a internet y vuelve a intentarlo.');
                return;
            }
            descargarDataUrl(captura.dataUrl, `${nombreArchivoReporte(nombreBase)}.png`);
        }

        async function copiarSeccionImagen(idElemento) {
            const captura = await capturarSeccionReporte(idElemento, {
                incluirEncabezadoExport: true,
                ocultarTituloSeccion: idElemento === 'reporte-mapa-requerimientos'
            });
            if (!captura?.dataUrl) {
                alert('No fue posible generar la imagen para copiar. Revisa tu conexión a internet y vuelve a intentarlo.');
                return;
            }

            try {
                await copiarDataUrlComoImagen(captura.dataUrl);
                alert('Imagen copiada. Ahora puedes pegarla en Outlook con Ctrl + V.');
            } catch (error) {
                console.error('No fue posible copiar la imagen:', error);
                alert('Tu navegador no permitió copiar la imagen automáticamente. Usa el botón Imagen para descargarla o prueba desde Chrome/Edge con la página en HTTPS o localhost.');
            }
        }

        async function cargarImagenDesdeDataUrl(dataUrl) {
            return await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = dataUrl;
            });
        }

        async function exportarGraficasJuntas() {
            const [avance, portafolio] = await Promise.all([
                capturarSeccionReporte('reporte-avance-sprint', { incluirEncabezadoExport: false }),
                capturarSeccionReporte('reporte-distribucion-portafolio', { incluirEncabezadoExport: false })
            ]);

            if (!avance?.dataUrl || !portafolio?.dataUrl) {
                alert('No fue posible generar la imagen conjunta. Revisa tu conexión a internet y vuelve a intentarlo.');
                return;
            }

            try {
                const [imgAvance, imgPortafolio] = await Promise.all([
                    cargarImagenDesdeDataUrl(avance.dataUrl),
                    cargarImagenDesdeDataUrl(portafolio.dataUrl)
                ]);
                const separacion = 28;
                const margen = 24;
                const altoObjetivo = Math.max(imgAvance.height, imgPortafolio.height);
                const anchoAvance = Math.round(imgAvance.width * altoObjetivo / imgAvance.height);
                const anchoPortafolio = Math.round(imgPortafolio.width * altoObjetivo / imgPortafolio.height);
                const canvas = document.createElement('canvas');
                canvas.width = anchoAvance + anchoPortafolio + separacion + margen * 2;
                canvas.height = altoObjetivo + margen * 2;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(imgAvance, margen, margen, anchoAvance, altoObjetivo);
                ctx.drawImage(imgPortafolio, margen + anchoAvance + separacion, margen, anchoPortafolio, altoObjetivo);
                descargarDataUrl(canvas.toDataURL('image/png'), `${nombreArchivoReporte('graficas_seguimiento_ejecutivo')}.png`);
            } catch (error) {
                console.error('Error al combinar las gráficas:', error);
                alert('No fue posible combinar las gráficas en una sola imagen.');
            }
        }

        async function exportarSeguimientoPDF() {
            await asegurarLibreriasExportacion();
            if (!window.jspdf?.jsPDF) {
                alert('No fue posible cargar el generador de PDF. Revisa tu conexión a internet y vuelve a intentarlo.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'mm', 'a4');
            const secciones = [
                ['reporte-avance-sprint', document.getElementById('titulo-avance-sprint')?.textContent || 'Avance del Sprint'],
                ['reporte-distribucion-portafolio', document.getElementById('titulo-distribucion-portafolio')?.textContent || 'Distribución del portafolio'],
                ['reporte-mapa-requerimientos', 'Seguimiento semanal de requerimientos']
            ];

            let paginaAgregada = false;

            for (const [id, titulo] of secciones) {
                const captura = await capturarSeccionReporte(id, { incluirEncabezadoExport: false, ocultarTituloSeccion: id === 'reporte-mapa-requerimientos' });
                if (!captura?.dataUrl) continue;

                if (paginaAgregada) pdf.addPage('a4', 'l');
                paginaAgregada = true;

                pdf.setFillColor(15, 23, 42);
                pdf.rect(0, 0, 297, 24, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(13);
                pdf.text(String(titulo).slice(0, 80), 12, 10);
                pdf.setFontSize(8);
                pdf.text(obtenerRangoSemanaActual(), 12, 17);
                pdf.setFontSize(18);
                pdf.text('FINSUS', 276, 14, { align: 'right' });

                const pageW = 297;
                const pageH = 210;
                const margin = 10;
                const maxW = pageW - margin * 2;
                const maxH = pageH - 36;
                let imgW = maxW;
                let imgH = captura.height * imgW / captura.width;
                if (imgH > maxH) {
                    imgH = maxH;
                    imgW = captura.width * imgH / captura.height;
                }
                const x = (pageW - imgW) / 2;
                pdf.addImage(captura.dataUrl, 'PNG', x, 30, imgW, imgH, undefined, 'FAST');
            }

            if (!paginaAgregada) {
                alert('No fue posible generar el PDF.');
                return;
            }

            pdf.save(`${nombreArchivoReporte('seguimiento_semanal_requerimientos')}.pdf`);
        }

        // Asegura que los botones con onclick funcionen en cualquier navegador.
        window.exportarSeccionImagen = exportarSeccionImagen;
        window.copiarSeccionImagen = copiarSeccionImagen;
        window.exportarGraficasJuntas = exportarGraficasJuntas;
        window.exportarSeguimientoPDF = exportarSeguimientoPDF;
        window.cambiarVistaPortafolio = cambiarVistaPortafolio;

        function llenarFiltrosSeguimientoEjecutivo() {
            actualizarTextosReporteSeguimiento();
            const sprint = document.getElementById('seguimiento-filtro-sprint');
            const estatus = document.getElementById('seguimiento-filtro-estatus');

            if (sprint) {
                sprint.innerHTML = '<option class="text-slate-800" value="">Todos los sprints</option>' +
                    (cats.sprints || []).map(s => `<option class="text-slate-800" value="${s.id}">${s.nombre}</option>`).join('');
            }

            if (estatus) {
                estatus.innerHTML = '<option class="text-slate-800" value="">Todos los estatus</option>' +
                    (cats.estatus || []).map(e => `<option class="text-slate-800" value="${normalizarTexto(e.nombre)}">${e.nombre.toUpperCase()}</option>`).join('');
            }
        }

        function prioridadOrdenSeguimiento(estatus) {
            const orden = {
                LIBERADO: 0,
                UAT: 1,
                QA: 2,
                DESARROLLO: 3,
                ANALISIS: 4,
                BACKLOG: 5,
                CANCELADO: 6
            };
            return orden[estatusOperativoSeguimiento(estatus)] ?? 99;
        }

        function fechaCompromisoOrdenSeguimiento(p) {
            const estatus = estatusOperativoSeguimiento(p?.estatus || 'BACKLOG');
            const candidatasPorEstatus = {
                LIBERADO: [p?.fecha_liberacion_prod],
                UAT: [p?.fecha_fin_uat, p?.fecha_uat, p?.fecha_liberacion_prod],
                QA: [p?.fecha_fin_qa, p?.fecha_qa, p?.fecha_inicio_uat, p?.fecha_fin_uat],
                DESARROLLO: [p?.fecha_fin_desarrollo, p?.fecha_desarrollo, p?.fecha_inicio_qa],
                ANALISIS: [p?.fecha_inicio_desarrollo, p?.fecha_fin_desarrollo, p?.fecha_desarrollo],
                BACKLOG: [p?.fecha_ingreso_pmo, p?.fecha_ingreso, p?.created_at],
                CANCELADO: [p?.updated_at, p?.created_at]
            };

            const fechas = (candidatasPorEstatus[estatus] || [])
                .filter(Boolean)
                .map(valor => {
                    const fecha = new Date(String(valor).length === 10 ? `${valor}T00:00:00` : valor);
                    return Number.isNaN(fecha.getTime()) ? null : fecha.getTime();
                })
                .filter(valor => valor !== null);

            return fechas.length ? Math.min(...fechas) : Number.POSITIVE_INFINITY;
        }

        function claveRqmOrdenSeguimiento(p) {
            const texto = String(p?.id_req || p?.numero_rqm || '').trim();
            const numeros = texto.match(/\d+/g);
            return {
                numero: numeros?.length ? Number(numeros[numeros.length - 1]) : Number.POSITIVE_INFINITY,
                texto: normalizarTexto(texto)
            };
        }

        function ordenarProyectosSeguimiento(proyectos = []) {
            return [...proyectos].sort((a, b) => {
                const porEstatus = prioridadOrdenSeguimiento(a?.estatus) - prioridadOrdenSeguimiento(b?.estatus);
                if (porEstatus !== 0) return porEstatus;

                const porAvance = calcularAvanceEstatusSeguimiento(b?.estatus || 'BACKLOG') - calcularAvanceEstatusSeguimiento(a?.estatus || 'BACKLOG');
                if (porAvance !== 0) return porAvance;

                const porFecha = fechaCompromisoOrdenSeguimiento(a) - fechaCompromisoOrdenSeguimiento(b);
                if (porFecha !== 0) return porFecha;

                const rqmA = claveRqmOrdenSeguimiento(a);
                const rqmB = claveRqmOrdenSeguimiento(b);
                if (rqmA.numero !== rqmB.numero) return rqmA.numero - rqmB.numero;
                return rqmA.texto.localeCompare(rqmB.texto, 'es', { numeric: true, sensitivity: 'base' });
            });
        }

        function obtenerProyectosSeguimientoFiltrados() {
            const sprint = document.getElementById('seguimiento-filtro-sprint')?.value || '';
            const estatus = document.getElementById('seguimiento-filtro-estatus')?.value || '';

            const filtrados = (todosLosProyectos || []).filter(p => {
                const okSprint = !sprint || String(p.sprint_id || '') === String(sprint);
                const okEstatus = !estatus || normalizarTexto(p.estatus || 'BACKLOG') === estatus;
                return okSprint && okEstatus;
            });

            return ordenarProyectosSeguimiento(filtrados);
        }

        function cambiarVistaPortafolio() {
            renderizarSeguimientoEjecutivo();
        }

        function filtrarSeguimientoEjecutivo() {
            actualizarTextosReporteSeguimiento();
            renderizarSeguimientoEjecutivo();
        }

        function renderizarSeguimientoEjecutivo() {
            actualizarTextosReporteSeguimiento();
            const lista = document.getElementById('seguimiento-lista');
            if (!lista) return;

            const proyectos = obtenerProyectosSeguimientoFiltrados();
            renderizarGraficasSeguimientoEjecutivo(proyectos);
            actualizarAvanceGeneralSeguimiento(proyectos);

            const totalVisible = document.getElementById('seguimiento-total-visible');
            if (totalVisible) totalVisible.textContent = `${proyectos.length} visible${proyectos.length === 1 ? '' : 's'}`;

            const total = proyectos.length;
            const liberados = proyectos.filter(p => ['LIBERADO', 'PRODUCCIÓN', 'PRODUCCION'].includes(normalizarTexto(p.estatus))).length;
            const reprogramados = proyectos.filter(p => contarReprogramacionesProyecto(p.id) > 0).length;
            const atrasados = proyectos.filter(p => contarAtrasosRealesProyecto(p) > 0).length;
            const enQa = proyectos.filter(p => normalizarTexto(p.estatus) === 'QA').length;
            const enUat = proyectos.filter(p => normalizarTexto(p.estatus) === 'UAT').length;

            const kpis = document.getElementById('seguimiento-kpis');
            if (kpis) {
                const items = [
                    { t: 'Total', v: total, i: 'layers', c: 'bg-blue-50 text-blue-700' },
                    { t: 'Liberados', v: liberados, i: 'rocket', c: 'bg-emerald-50 text-emerald-700' },
                    { t: 'QA', v: enQa, i: 'shield-check', c: 'bg-amber-50 text-amber-700' },
                    { t: 'UAT', v: enUat, i: 'clipboard-check', c: 'bg-orange-50 text-orange-700' },
                    { t: 'Reprogramados', v: reprogramados, i: 'calendar-clock', c: 'bg-violet-50 text-violet-700' },
                    { t: 'Atrasados', v: atrasados, i: 'alert-triangle', c: 'bg-rose-50 text-rose-700' }
                ];

                kpis.innerHTML = items.map(x => `
                    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">${x.t}</p>
                                <h3 class="text-3xl font-black text-slate-900 mt-2">${x.v}</h3>
                            </div>
                            <div class="${x.c} w-11 h-11 rounded-2xl flex items-center justify-center">
                                <i data-lucide="${x.i}" class="w-5 h-5"></i>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            const riesgos = document.getElementById('seguimiento-riesgos');
            if (riesgos) {
                riesgos.innerHTML = `
                    <div class="flex items-center justify-between bg-amber-50 text-amber-700 rounded-2xl px-4 py-3">
                        <span class="text-xs font-black">Reprogramados</span>
                        <span class="text-lg font-black">${reprogramados}</span>
                    </div>
                    <div class="flex items-center justify-between bg-rose-50 text-rose-700 rounded-2xl px-4 py-3">
                        <span class="text-xs font-black">Atrasos reales</span>
                        <span class="text-lg font-black">${atrasados}</span>
                    </div>
                    <div class="flex items-center justify-between bg-blue-50 text-blue-700 rounded-2xl px-4 py-3">
                        <span class="text-xs font-black">En QA/UAT</span>
                        <span class="text-lg font-black">${enQa + enUat}</span>
                    </div>
                `;
            }

            lista.innerHTML = proyectos.length
                ? proyectos.map(renderizarTarjetaSeguimiento).join('')
                : `<div class="text-center py-10 text-slate-400 text-sm font-bold">Sin requerimientos para los filtros seleccionados.</div>`;

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }


        

        let importacionPMO = {
            registros: [],
            historial: [],
            errores: [],
            listo: false
        };

        function normalizarCatalogoImport(valor) {
            return normalizarTexto(valor)
                .replace(/\s+/g, ' ')
                .replace(/\s+$/g, '')
                .trim();
        }

        function buscarCatalogoPorNombre(lista, nombre) {
            const objetivo = normalizarCatalogoImport(nombre);
            if (!objetivo) return null;
            return (lista || []).find(x => normalizarCatalogoImport(x.nombre) === objetivo) || null;
        }

        function excelSerialADateString(valor) {
            if (!valor && valor !== 0) return null;

            if (typeof valor === 'number') {
                const fecha = XLSX.SSF.parse_date_code(valor);
                if (!fecha) return null;
                const yyyy = fecha.y;
                const mm = String(fecha.m).padStart(2, '0');
                const dd = String(fecha.d).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }

            if (valor instanceof Date && !isNaN(valor)) {
                const yyyy = valor.getFullYear();
                const mm = String(valor.getMonth() + 1).padStart(2, '0');
                const dd = String(valor.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }

            const texto = String(valor).trim();
            if (!texto) return null;

            if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);

            const partes = texto.split(/[\/\-]/);
            if (partes.length === 3) {
                let [d, m, y] = partes;
                if (y.length === 2) y = '20' + y;
                if (Number(y) > 1900) {
                    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
            }

            return null;
        }

        function calcularDiasImport(inicio, fin) {
            if (!inicio || !fin) return null;
            const d1 = new Date(inicio + 'T00:00:00');
            const d2 = new Date(fin + 'T00:00:00');
            const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
            return diff >= 0 ? diff : null;
        }

        function obtenerHojaImportacion(workbook) {
            const preferidas = ['IMPORT_PMO_CONTROL', 'MATRIZ DE PROYECTOS'];
            for (const nombre of preferidas) {
                if (workbook.SheetNames.includes(nombre)) return { nombre, hoja: workbook.Sheets[nombre] };
            }
            const nombre = workbook.SheetNames[0];
            return { nombre, hoja: workbook.Sheets[nombre] };
        }

        function mapearDesdeImportPrep(row) {
            const get = (k) => row[k] ?? row[k?.toUpperCase?.()] ?? null;

            return {
                id_req: get('id_req'),
                nombre_rqm: get('nombre_rqm'),
                sprint: get('sprint'),
                sistema: get('sistema'),
                clasificacion: get('clasificacion'),
                prioridad: get('prioridad'),
                area: get('area'),
                descripcion: get('descripcion'),
                solicitante: get('solicitante'),
                responsable_sistemas: get('responsable_sistemas'),
                asignado_a: get('asignado_a'),
                estatus: get('estatus'),
                fecha_ingreso_pmo: excelSerialADateString(get('fecha_ingreso_pmo')),
                fecha_desarrollo: excelSerialADateString(get('fecha_desarrollo_compromiso')),
                fecha_inicio_desarrollo: excelSerialADateString(get('fecha_inicio_desarrollo')),
                fecha_fin_desarrollo: excelSerialADateString(get('fecha_fin_desarrollo')),
                fecha_qa: excelSerialADateString(get('fecha_qa_compromiso')),
                fecha_inicio_qa: excelSerialADateString(get('fecha_inicio_qa')),
                fecha_fin_qa: excelSerialADateString(get('fecha_fin_qa')),
                fecha_uat: excelSerialADateString(get('fecha_uat_compromiso')),
                fecha_inicio_uat: excelSerialADateString(get('fecha_inicio_uat')),
                fecha_fin_uat: excelSerialADateString(get('fecha_fin_uat')),
                fecha_liberacion_prod: excelSerialADateString(get('fecha_liberacion_prod')),
                comentarios: get('comentarios')
            };
        }

        function mapearDesdeMatrizOriginal(row) {
            return {
                id_req: row['ID REQ'],
                nombre_rqm: row['NOMBRE DEL RQM'],
                sprint: row['SPRINT '] || row['SPRINT'],
                sistema: row['SISTEMA'],
                clasificacion: row['CLASIFICACIÓN'],
                prioridad: row['PRIORIDAD'],
                area: row['ÁREA'],
                descripcion: row['DESCRIPCIÓN'],
                solicitante: row['SOLICITANTE'],
                responsable_sistemas: row['RESPONSABLE SISTEMAS'],
                asignado_a: row['ASIGNADO A '],
                estatus: row['ESTATUS'],
                fecha_ingreso_pmo: excelSerialADateString(row['FECHA DE INGRESO RQM A PMO']),
                fecha_desarrollo: excelSerialADateString(row['FECHA DE ENTREGA DE SISTEMAS']),
                fecha_inicio_desarrollo: excelSerialADateString(row['FECHA DE INICIO DE DESARROLLO']),
                fecha_fin_desarrollo: excelSerialADateString(row['NUEVA FECHA COMPROMISO'] || row['FECHA DE ENTREGA DE SISTEMAS']),
                fecha_qa: excelSerialADateString(row['FECHA DE SALIDA PRUEBAS QA']),
                fecha_inicio_qa: excelSerialADateString(row['FECHA DE ENTRADA A PRUEBAS QA']),
                fecha_fin_qa: excelSerialADateString(row['NUEVA FECHA COMPROMISO_1'] || row['FECHA DE SALIDA PRUEBAS QA']),
                fecha_uat: excelSerialADateString(row['FECHA DE SALIDA PRUEBAS UAT']),
                fecha_inicio_uat: excelSerialADateString(row['FECHA DE ENTRADA PRUEBAS UAT']),
                fecha_fin_uat: excelSerialADateString(row['NUEVA FECHA COMPROMISO_2'] || row['FECHA DE SALIDA PRUEBAS UAT']),
                fecha_liberacion_prod: excelSerialADateString(row['LIBERACIÓN PRODUCTIVA']),
                comentarios: row['COMENTARIOS_2'] || row['COMENTARIOS']
            };
        }

        function prepararRegistroImport(row, origen) {
            const base = origen === 'IMPORT_PMO_CONTROL'
                ? mapearDesdeImportPrep(row)
                : mapearDesdeMatrizOriginal(row);

            base.id_req = base.id_req ? String(base.id_req).trim() : null;
            base.nombre_rqm = base.nombre_rqm ? String(base.nombre_rqm).trim() : null;
            base.prioridad = base.prioridad ? String(base.prioridad).trim().toUpperCase() : 'BAJA';
            base.estatus = base.estatus ? String(base.estatus).trim().toUpperCase() : 'BACKLOG';

            if (base.estatus === 'PRODUCCIÓN' || base.estatus === 'PRODUCCION') base.estatus = 'LIBERADO';

            base.dias_desarrollo = calcularDiasImport(base.fecha_inicio_desarrollo, base.fecha_fin_desarrollo);
            base.dias_qa = calcularDiasImport(base.fecha_inicio_qa, base.fecha_fin_qa);
            base.dias_uat = calcularDiasImport(base.fecha_inicio_uat, base.fecha_fin_uat);

            return base;
        }

        function validarRegistroImport(reg) {
            const errores = [];

            if (!reg.id_req) errores.push('Sin ID REQ');
            if (!reg.nombre_rqm) errores.push('Sin nombre');

            const sprint = buscarCatalogoPorNombre(cats.sprints, reg.sprint);
            const sistema = buscarCatalogoPorNombre(cats.sistemas, reg.sistema);
            const area = buscarCatalogoPorNombre(cats.areas, reg.area);
            const clasificacion = buscarCatalogoPorNombre(cats.clasificaciones, reg.clasificacion);
            const estatus = buscarCatalogoPorNombre(cats.estatus, reg.estatus);

            if (reg.sprint && !sprint) errores.push(`Sprint no encontrado: ${reg.sprint}`);
            if (reg.sistema && !sistema) errores.push(`Sistema no encontrado: ${reg.sistema}`);
            if (reg.area && !area) errores.push(`Área no encontrada: ${reg.area}`);
            if (reg.clasificacion && !clasificacion) errores.push(`Clasificación no encontrada: ${reg.clasificacion}`);
            if (reg.estatus && !estatus) errores.push(`Estatus no encontrado: ${reg.estatus}`);

            return {
                ...reg,
                sprint_id: sprint?.id || null,
                sistema_id: sistema?.id || null,
                area_id: area?.id || null,
                clasificacion_id: clasificacion?.id || null,
                valido: errores.length === 0,
                errores
            };
        }

        async function procesarArchivoImportacion(event) {
            const file = event.target.files?.[0];
            if (!file) return;

            document.getElementById('import-file-name').textContent = file.name;
            mostrarEstadoImport('Procesando archivo...', 'info');

            try {
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
                const seleccion = obtenerHojaImportacion(workbook);

                let rows = XLSX.utils.sheet_to_json(seleccion.hoja, {
                    defval: null,
                    raw: true
                });

                rows = rows.filter(r => {
                    const id = r['id_req'] || r['ID REQ'];
                    const nombre = r['nombre_rqm'] || r['NOMBRE DEL RQM'];
                    return id || nombre;
                });

                const preparados = rows.map(r => prepararRegistroImport(r, seleccion.nombre));
                const validados = preparados.map(validarRegistroImport);

                importacionPMO.registros = validados;
                importacionPMO.errores = validados.filter(r => !r.valido);
                importacionPMO.listo = validados.length > 0 && importacionPMO.errores.length === 0;

                renderizarResumenImportacion();

                if (importacionPMO.listo) {
                    mostrarEstadoImport('Archivo validado correctamente. Listo para importar.', 'ok');
                } else {
                    mostrarEstadoImport('Hay errores por corregir antes de importar.', 'error');
                }

            } catch (error) {
                console.error(error);
                mostrarEstadoImport('No se pudo leer el archivo: ' + error.message, 'error');
            }
        }

        function mostrarEstadoImport(texto, tipo) {
            const el = document.getElementById('import-status');
            if (!el) return;

            const estilos = {
                info: 'bg-blue-50 text-blue-700 border border-blue-100',
                ok: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
                error: 'bg-rose-50 text-rose-700 border border-rose-100'
            };

            el.className = `rounded-2xl p-4 text-sm font-bold ${estilos[tipo] || estilos.info}`;
            el.textContent = texto;
            el.classList.remove('hidden');
        }

        function renderizarResumenImportacion() {
            const registros = importacionPMO.registros || [];
            const validos = registros.filter(r => r.valido);
            const errores = registros.filter(r => !r.valido);

            document.getElementById('import-kpi-total').textContent = registros.length;
            document.getElementById('import-kpi-validos').textContent = validos.length;
            document.getElementById('import-kpi-errores').textContent = errores.length;
            document.getElementById('import-kpi-historial').textContent = 'F2';

            document.getElementById('import-preview-count').textContent = `${registros.length} registro${registros.length === 1 ? '' : 's'}`;

            const btn = document.getElementById('btn-importar-matriz');
            if (importacionPMO.listo) {
                btn.disabled = false;
                btn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-5 py-3 font-black text-sm transition cursor-pointer shadow-md';
            } else {
                btn.disabled = true;
                btn.className = 'w-full bg-slate-300 text-white rounded-2xl px-5 py-3 font-black text-sm transition disabled:cursor-not-allowed';
            }

            const validaciones = document.getElementById('import-validaciones');
            if (validaciones) {
                if (errores.length === 0 && registros.length > 0) {
                    validaciones.innerHTML = `
                        <div class="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl px-4 py-3">
                            ✅ Todos los registros pasaron validación de catálogos.
                        </div>
                    `;
                } else if (errores.length > 0) {
                    validaciones.innerHTML = errores.slice(0, 12).map((r, idx) => `
                        <div class="bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl px-4 py-3">
                            <b>${r.id_req || 'Registro ' + (idx + 1)}:</b> ${r.errores.join(' · ')}
                        </div>
                    `).join('');
                } else {
                    validaciones.innerHTML = '<div class="text-slate-400 italic">Aún no hay archivo cargado.</div>';
                }
            }

            const tbody = document.getElementById('import-preview-body');
            if (!tbody) return;

            if (registros.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Carga un archivo para ver la vista previa.</td></tr>';
                return;
            }

            tbody.innerHTML = registros.slice(0, 20).map(r => `
                <tr class="hover:bg-slate-50">
                    <td class="p-4 font-bold text-slate-900">${r.id_req || '—'}</td>
                    <td class="p-4 max-w-xs">
                        <div class="font-bold text-slate-700 truncate">${r.nombre_rqm || '—'}</div>
                        <div class="text-[11px] text-slate-400 truncate">${r.solicitante || 'Sin solicitante'}</div>
                    </td>
                    <td class="p-4 text-xs font-bold text-slate-600">${r.sprint || '—'}</td>
                    <td class="p-4 text-xs font-bold text-slate-600">${r.sistema || '—'}</td>
                    <td class="p-4 text-xs font-bold text-slate-600">${r.area || '—'}</td>
                    <td class="p-4 text-xs font-black">${r.prioridad || '—'}</td>
                    <td class="p-4 text-xs font-black">${r.estatus || '—'}</td>
                    <td class="p-4">
                        ${r.valido
                            ? '<span class="text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-1">Válido</span>'
                            : '<span class="text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-100 rounded-full px-2.5 py-1">Error</span>'
                        }
                    </td>
                </tr>
            `).join('');
        }

        async function importarMatrizPMO() {
            if (!importacionPMO.listo) {
                alert('Corrige los errores antes de importar.');
                return;
            }

            const confirmar = confirm(`Se importarán ${importacionPMO.registros.length} requerimientos a PMO Control. ¿Continuar?`);
            if (!confirmar) return;

            const btn = document.getElementById('btn-importar-matriz');
            btn.disabled = true;
            btn.textContent = 'Importando...';

            try {
                const payload = importacionPMO.registros.map(r => ({
                    id_req: r.id_req,
                    nombre_rqm: r.nombre_rqm,
                    sprint_id: r.sprint_id,
                    sistema_id: r.sistema_id,
                    sistema: r.sistema || null,
                    clasificacion_id: r.clasificacion_id,
                    area_id: r.area_id,
                    solicitante: r.solicitante || null,
                    responsable_sistemas: r.responsable_sistemas || null,
                    asignado_a: r.asignado_a || null,
                    prioridad: r.prioridad || 'BAJA',
                    estatus: r.estatus || 'BACKLOG',
                    descripcion: r.descripcion || null,
                    fecha_ingreso_pmo: r.fecha_ingreso_pmo || null,
                    fecha_desarrollo: r.fecha_desarrollo || null,
                    fecha_inicio_desarrollo: r.fecha_inicio_desarrollo || null,
                    fecha_fin_desarrollo: r.fecha_fin_desarrollo || null,
                    dias_desarrollo: r.dias_desarrollo,
                    fecha_qa: r.fecha_qa || null,
                    fecha_inicio_qa: r.fecha_inicio_qa || null,
                    fecha_fin_qa: r.fecha_fin_qa || null,
                    dias_qa: r.dias_qa,
                    fecha_uat: r.fecha_uat || null,
                    fecha_inicio_uat: r.fecha_inicio_uat || null,
                    fecha_fin_uat: r.fecha_fin_uat || null,
                    dias_uat: r.dias_uat,
                    fecha_liberacion_prod: r.fecha_liberacion_prod || null,
                    comentarios: r.comentarios || null
                }));

                const { error } = await _supabase
                    .from('pmo_projects')
                    .insert(payload);

                if (error) throw error;

                mostrarEstadoImport(`Importación completa: ${payload.length} requerimientos insertados.`, 'ok');
                alert('Importación completada correctamente.');
                btn.textContent = 'Importación completada';

            } catch (error) {
                console.error(error);
                mostrarEstadoImport('No se pudo importar: ' + error.message, 'error');
                alert('No se pudo importar: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Importar a PMO Control';
            }
        }


        window.onload = async () => {
            if (typeof inicializarPanelRequerimientosHTML === 'function') inicializarPanelRequerimientosHTML();
            if (typeof inicializarEventosFechasFormulario === 'function') inicializarEventosFechasFormulario();

            const user = await verificarSesion();
            if (!user) return;

            pintarUsuarioSesion(user);
            await cargarTodo();

            if (document.getElementById('seguimiento-lista')) {
                llenarFiltrosSeguimientoEjecutivo();
                renderizarSeguimientoEjecutivo();
            }

            lucide.createIcons();
        };
