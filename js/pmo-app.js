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
        let proyectoSeleccionadoOriginal = null;
        let cats = { sprints: [], sistemas: [], areas: [], clasificaciones: [], estatus: [], motivos_reprogramacion: [] };

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
                const est = await _supabase.from('cat_estatus').select('*').order('nombre');
                const mot = await _supabase.from('cat_motivos_reprogramacion').select('*').order('nombre');

                cats.sprints = s.data || [];
                cats.sistemas = sis.data || [];
                cats.areas = a.data || [];
                cats.clasificaciones = c.data || [];
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

        function obtenerCambiosReprogramacionActuales() {
            if (!proyectoSeleccionadoOriginal) return [];

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

        function badgeReprogramado(projectId) {
            const total = contarReprogramacionesProyecto(projectId);
            if (!total) return '';

            return `
                <div class="mt-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 shadow-xs">
                        <i data-lucide="calendar-clock" class="w-3 h-3"></i>
                        Reprogramado (${total})
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
                Reprogramado (${total})
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
            if (confirm("¿Seguro de eliminar este elemento?")) {
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
                    .select('project_id, fase, fecha_anterior, fecha_nueva');

                const conteoCambios = {};
                const conteoReprogramaciones = {};

                if (historial) {
                    historial.forEach(h => {
                        conteoCambios[h.project_id] = (conteoCambios[h.project_id] || 0) + 1;

                        const esReprogramacion =
                            ['Fin Desarrollo', 'Fin QA', 'Fin UAT'].includes(h.fase || '') &&
                            h.fecha_anterior &&
                            h.fecha_nueva &&
                            h.fecha_anterior !== h.fecha_nueva;

                        if (esReprogramacion) {
                            conteoReprogramaciones[h.project_id] = (conteoReprogramaciones[h.project_id] || 0) + 1;
                        }
                    });
                }

                conteoCambiosGlobal = conteoCambios;
                conteoReprogramacionesGlobal = conteoReprogramaciones;

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

        function renderizarTabla(proyectos, conteoCambios = {}) {
            const tbody = document.getElementById('tabla-proyectos-body');
            tbody.innerHTML = '';

            if (proyectos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="11" class="p-8 text-center text-slate-400">Sin datos en matriz.</td></tr>';
                return;
            }

            proyectos.forEach(p => {
                const estatusNormalizado = (p.estatus || 'BACKLOG').toUpperCase();

                // Mapear el avance visual según las 5 etapas tradicionales de forma secuencial
                let etapa = 1;
                if (estatusNormalizado === 'DESARROLLO') etapa = 2;
                else if (estatusNormalizado === 'QA') etapa = 3;
                else if (estatusNormalizado === 'UAT') etapa = 4;
                else if (estatusNormalizado === 'LIBERADO' || estatusNormalizado === 'PRODUCCIÓN') etapa = 5;

                let porcentaje = estatusNormalizado === 'CANCELADO' ? 0 : etapa * 20;

                let segIngreso = etapa >= 1 ? 'bg-blue-500' : 'bg-slate-100';
                let segDesarrollo = etapa >= 2 ? 'bg-indigo-500' : 'bg-slate-100';
                let segQA = etapa >= 3 ? 'bg-amber-500' : 'bg-slate-100';
                let segUAT = etapa >= 4 ? 'bg-orange-500' : 'bg-slate-100';
                let segProd = etapa >= 5 ? 'bg-emerald-500' : 'bg-slate-100';

                if (estatusNormalizado === 'CANCELADO') {
                    segIngreso = segDesarrollo = segQA = segUAT = segProd = 'bg-slate-200';
                }

                let badgePrioridad = obtenerBadgePrioridad(p.prioridad);

                let badgeEstatus = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">• ${p.estatus || 'BACKLOG'}</span>`;
                if (estatusNormalizado === 'DESARROLLO') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700"><span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>Desarrollo</span>';
                else if (estatusNormalizado === 'QA') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700"><span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>QA</span>';
                else if (estatusNormalizado === 'LIBERADO' || estatusNormalizado === 'PRODUCCIÓN') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Liberado</span>';
                else if (estatusNormalizado === 'CANCELADO') badgeEstatus = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700"><span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>Cancelado</span>';

                const totalCambios = conteoCambios[p.id] || 0;
                let badgeNotificacionReloj = totalCambios > 0 ? `<span class="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[9px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-xs animate-bounce">${totalCambios}</span>` : '';

                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50/50 transition duration-150 group border-b border-slate-100">
                        <td class="p-4 pl-6 align-top">
                            <div class="font-semibold text-slate-900">${p.nombre_rqm}</div>
                            <div class="text-xs text-slate-400 font-mono mt-0.5">${p.id_req}</div>
                            <div class="mt-3 max-w-xs space-y-1">
                                <div class="flex justify-between text-[10px] font-bold text-slate-500">
                                    <span>Progreso</span>
                                    <span class="text-slate-700">${porcentaje}%</span>
                                </div>
                                <div class="grid grid-cols-5 gap-1 h-1.5 w-full bg-transparent">
                                    <div class="rounded-l-full ${segIngreso} transition-all duration-300"></div>
                                    <div class="${segDesarrollo} transition-all duration-300"></div>
                                    <div class="${segQA} transition-all duration-300"></div>
                                    <div class="${segUAT} transition-all duration-300"></div>
                                    <div class="rounded-r-full ${segProd} transition-all duration-300"></div>
                                </div>
                            </div>
                        </td>
                        <td class="p-4 text-slate-600">
                            <div class="font-medium text-xs text-slate-900">${p.cat_sprints?.nombre || 'Sin Sprint'}</div>
                            <div class="text-[11px] text-slate-400 font-bold">${p.cat_sistemas?.nombre || '—'}</div>
                        </td>
                        <td class="p-4">
                            <div>${badgePrioridad}</div>
                            <div class="text-[11px] text-slate-400 mt-1 font-medium">${p.cat_clasificaciones?.nombre || 'Sin Clasificación'}</div>
                        </td>
                        <td class="p-4 text-slate-600">
                            <div class="font-medium text-xs">${p.responsable_sistemas || '—'}</div>
                            <div class="text-[11px] text-slate-400">Asignado: ${p.asignado_a || '—'}</div>
                        </td>
                        <td class="p-4 font-mono text-[11px] text-slate-500">${formatearFechaRango(p.fecha_inicio_desarrollo, p.fecha_fin_desarrollo)}</td>
                        <td class="p-4 font-mono text-[11px] text-slate-500">${formatearFechaRango(p.fecha_inicio_qa, p.fecha_fin_qa)}</td>
                        <td class="p-4 font-mono text-[11px] text-slate-500">${formatearFechaRango(p.fecha_inicio_uat, p.fecha_fin_uat)}</td>
                        <td class="p-4 font-mono text-[11px] text-slate-500">${formatearFechaVista(p.fecha_liberacion_prod)}</td>
<td class="p-4 text-[11px] text-slate-500 space-y-1">
    <div>
        Dev: <b>${calcularDiasEntreFechas(p.fecha_inicio_desarrollo, p.fecha_fin_desarrollo) || '—'}</b>
        <span class="ml-1 px-1.5 py-0.5 rounded font-bold ${claseDesviacion(calcularDesviacion(p.fecha_desarrollo, p.fecha_fin_desarrollo))}">
            ${calcularDesviacion(p.fecha_desarrollo, p.fecha_fin_desarrollo) || '—'}
        </span>
        ${badgeAtrasoReal(p.fecha_desarrollo, p.fecha_fin_desarrollo)}
    </div>
    <div>
        QA: <b>${calcularDiasEntreFechas(p.fecha_inicio_qa, p.fecha_fin_qa) || '—'}</b>
        <span class="ml-1 px-1.5 py-0.5 rounded font-bold ${claseDesviacion(calcularDesviacion(p.fecha_qa, p.fecha_fin_qa))}">
            ${calcularDesviacion(p.fecha_qa, p.fecha_fin_qa) || '—'}
        </span>
        ${badgeAtrasoReal(p.fecha_qa, p.fecha_fin_qa)}
    </div>
    <div>
        UAT: <b>${calcularDiasEntreFechas(p.fecha_inicio_uat, p.fecha_fin_uat) || '—'}</b>
        <span class="ml-1 px-1.5 py-0.5 rounded font-bold ${claseDesviacion(calcularDesviacion(p.fecha_uat, p.fecha_fin_uat))}">
            ${calcularDesviacion(p.fecha_uat, p.fecha_fin_uat) || '—'}
        </span>
        ${badgeAtrasoReal(p.fecha_uat, p.fecha_fin_uat)}
    </div>
</td>
                        
                        
                        <td class="p-4">${badgeEstatus}${badgeReprogramado(p.id)}</td>
                        <td class="p-4 pr-6 text-right space-x-1 whitespace-nowrap">
                            <button onclick="verHistorial('${p.id}', '${p.nombre_rqm}', '${p.id_req}')" class="relative inline-flex items-center p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer">
                                <i data-lucide="clock" class="w-4 h-4"></i>
                                ${badgeNotificacionReloj}
                            </button>
                            <button onclick="abrirModalEditar('${p.id}')" class="inline-flex items-center p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                            <button onclick="eliminarProyecto('${p.id}', '${p.nombre_rqm}')" class="inline-flex items-center p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </td>
                    </tr>
                `;
            });
            lucide.createIcons();
        }

        function renderizarContadoresDinamicos(proyectos) {
            const contenedor = document.getElementById('contenedor-contadores');
            if (!contenedor) return;

            const conteos = {};

            cats.estatus.forEach(e => {
                conteos[e.nombre.toUpperCase()] = 0;
            });

            if (conteos['CANCELADO'] === undefined)
                conteos['CANCELADO'] = 0;

            proyectos.forEach(p => {
                const est = (p.estatus || 'BACKLOG').toUpperCase();

                if (conteos[est] !== undefined)
                    conteos[est]++;
            });

            const estilos = {
                BACKLOG: {
                    icono: 'folder',
                    gradiente: 'from-blue-500 to-blue-700'
                },
                DESARROLLO: {
                    icono: 'code-2',
                    gradiente: 'from-indigo-500 to-indigo-700'
                },
                QA: {
                    icono: 'shield-alert',
                    gradiente: 'from-amber-400 to-amber-600'
                },
                UAT: {
                    icono: 'clipboard-check',
                    gradiente: 'from-orange-400 to-orange-600'
                },
                LIBERADO: {
                    icono: 'rocket',
                    gradiente: 'from-emerald-500 to-emerald-700'
                },
                PRODUCCIÓN: {
                    icono: 'rocket',
                    gradiente: 'from-emerald-500 to-emerald-700'
                },
                CANCELADO: {
                    icono: 'ban',
                    gradiente: 'from-rose-500 to-rose-700'
                }
            };

            contenedor.innerHTML = Object.keys(conteos)
                .map(key => {

                    const estilo = estilos[key] || {
                        icono: 'help-circle',
                        gradiente: 'from-slate-500 to-slate-700'
                    };

                    return `
                <div class="
                    bg-gradient-to-br
                    ${estilo.gradiente}
                    rounded-3xl
                    p-5
                    text-white
                    shadow-lg
                    hover:scale-105
                    transition-all
                    duration-300
                    cursor-pointer
                ">
                    <div class="flex justify-between items-start">

                        <div>
                            <p class="
                                text-xs
                                uppercase
                                tracking-widest
                                font-bold
                                text-white/80
                            ">
                                ${key}
                            </p>

                            <h2 class="
                                text-4xl
                                font-black
                                mt-3
                            ">
                                ${conteos[key]}
                            </h2>
                        </div>

                        <div class="
                            w-14
                            h-14
                            rounded-2xl
                            bg-white/20
                            flex
                            items-center
                            justify-center
                            backdrop-blur-sm
                        ">
                            <i
                                data-lucide="${estilo.icono}"
                                class="w-7 h-7"
                            ></i>
                        </div>

                    </div>

                    <div class="mt-5">
                        <div class="
                            h-1.5
                            bg-white/20
                            rounded-full
                            overflow-hidden
                        ">
                            <div class="
                                h-full
                                bg-white
                                rounded-full
                                w-full
                                opacity-70
                            ">
                            </div>
                        </div>
                    </div>
                </div>
            `;
                })
                .join('');

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
                        const registrarLog = async (fase, ant, nva, motivoId = null, comentarioMotivo = null, motivoSelectId = null) => {
                            if (esCambioReprogramacion(ant || null, nva || null)) {
                                const motivoNombre = nombreMotivoPorId(motivoId, motivoSelectId);
                                const razonTexto = motivoNombre
                                    ? `${motivoNombre}${comentarioMotivo ? ' - ' + comentarioMotivo : ''}`
                                    : (comentarioMotivo || motivoNombre || 'Reprogramación de fecha fin');

                                const payload = {
                                    project_id: id,
                                    fase: fase,
                                    fecha_anterior: ant || null,
                                    fecha_nueva: nva || null,
                                    razon: razonTexto,
                                    motivo_id: motivoId || null,
                                    comentario_motivo: comentarioMotivo || null
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

                        await registrarLog('Compromiso Desarrollo', proyectoSeleccionadoOriginal.fecha_desarrollo, reqData.fecha_desarrollo);
                        await registrarLog('Inicio Desarrollo', proyectoSeleccionadoOriginal.fecha_inicio_desarrollo, reqData.fecha_inicio_desarrollo);
                        await registrarLog('Fin Desarrollo', proyectoSeleccionadoOriginal.fecha_fin_desarrollo, reqData.fecha_fin_desarrollo);

                        await registrarLog('Compromiso QA', proyectoSeleccionadoOriginal.fecha_qa, reqData.fecha_qa);
                        await registrarLog('Inicio QA', proyectoSeleccionadoOriginal.fecha_inicio_qa, reqData.fecha_inicio_qa);
                        await registrarLog('Fin QA', proyectoSeleccionadoOriginal.fecha_fin_qa, reqData.fecha_fin_qa);

                        await registrarLog('Compromiso UAT', proyectoSeleccionadoOriginal.fecha_uat, reqData.fecha_uat);
                        await registrarLog('Inicio UAT', proyectoSeleccionadoOriginal.fecha_inicio_uat, reqData.fecha_inicio_uat);
                        await registrarLog('Fin UAT', proyectoSeleccionadoOriginal.fecha_fin_uat, reqData.fecha_fin_uat);

                        await registrarLog('Liberación Producción', proyectoSeleccionadoOriginal.fecha_liberacion_prod, reqData.fecha_liberacion_prod);
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
                alert("No se pudo guardar: " + error.message);
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

        if (!data || data.length === 0) {
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
            const logsFase = data.filter(l => fase.logs.includes(l.fase));

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

                            <span class="${estilo.bg} ${estilo.text} text-[11px] font-black px-3 py-1 rounded-full">
                                ${logsFase.length} cambio${logsFase.length === 1 ? '' : 's'}
                            </span>
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
            setValueIfExists('form-prioridad', p.prioridad || 'BAJA');
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
            if (confirm(`¿Eliminar permanently "${nombre}"?`)) {
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
        const fasesSeguimientoEjecutivo = [
            { key: 'ANALISIS', label: 'Análisis', icono: '🔎' },
            { key: 'BACKLOG', label: 'Backlog', icono: '📥' },
            { key: 'DESARROLLO', label: 'Desarrollo', icono: '👨‍💻' },
            { key: 'QA', label: 'QA', icono: '🧪' },
            { key: 'UAT', label: 'UAT', icono: '👤' },
            { key: 'LIBERADO', label: 'Liberación', icono: '🚀' }
        ];

        function indiceFaseSeguimiento(estatus) {
            const e = normalizarTexto(estatus || 'BACKLOG');
            if (e.includes('ANALISIS') || e.includes('ANÁLISIS')) return 0;
            if (e.includes('BACKLOG')) return 1;
            if (e.includes('DESARROLLO')) return 2;
            if (e === 'QA') return 3;
            if (e === 'UAT') return 4;
            if (e.includes('LIBERADO') || e.includes('PRODUCCION') || e.includes('PRODUCCIÓN')) return 5;
            return 1;
        }

        function calcularMaxDesviacionProyecto(p) {
            const vals = [
                obtenerDesviacionDias(p.fecha_desarrollo, p.fecha_fin_desarrollo),
                obtenerDesviacionDias(p.fecha_qa, p.fecha_fin_qa),
                obtenerDesviacionDias(p.fecha_uat, p.fecha_fin_uat)
            ].filter(v => typeof v === 'number');

            if (!vals.length) return null;
            return Math.max(...vals);
        }

        function contarAtrasosRealesProyecto(p) {
            return [
                calcularAtrasoReal(p.fecha_desarrollo, p.fecha_fin_desarrollo),
                calcularAtrasoReal(p.fecha_qa, p.fecha_fin_qa),
                calcularAtrasoReal(p.fecha_uat, p.fecha_fin_uat)
            ].filter(Boolean).length;
        }

        function estadoSemaforoProyecto(p) {
            const reprogramaciones = contarReprogramacionesProyecto(p.id);
            const atrasos = contarAtrasosRealesProyecto(p);
            const desviacion = calcularMaxDesviacionProyecto(p);

            if (atrasos > 0) return { texto: 'Atraso real', clase: 'bg-rose-50 text-rose-700 border-rose-100', icono: '🔴' };
            if (reprogramaciones > 0 || (desviacion !== null && desviacion > 0)) return { texto: 'Reprogramado', clase: 'bg-amber-50 text-amber-700 border-amber-100', icono: '🟡' };
            return { texto: 'En tiempo', clase: 'bg-emerald-50 text-emerald-700 border-emerald-100', icono: '🟢' };
        }

        function destruirGraficaSeguimiento(id) {
            if (seguimientoCharts[id]) {
                seguimientoCharts[id].destroy();
                delete seguimientoCharts[id];
            }
        }

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

        function renderizarGraficasSeguimientoEjecutivo(proyectos) {
            const fasesBase = ['Análisis', 'Desarrollo', 'QA', 'UAT', 'Liberados'];
            const conteoAvance = { 'Análisis': 0, 'Desarrollo': 0, 'QA': 0, 'UAT': 0, 'Liberados': 0 };

            proyectos.forEach(p => {
                const est = normalizarTexto(p.estatus || 'BACKLOG');
                if (est.includes('ANALISIS') || est.includes('ANÁLISIS') || est === 'BACKLOG') conteoAvance['Análisis']++;
                else if (est === 'DESARROLLO') conteoAvance['Desarrollo']++;
                else if (est === 'QA') conteoAvance['QA']++;
                else if (est === 'UAT') conteoAvance['UAT']++;
                else if (est.includes('LIBERADO') || est.includes('PRODUCCION') || est.includes('PRODUCCIÓN')) conteoAvance['Liberados']++;
            });

            crearGraficaSeguimiento('seguimiento-chart-avance', 'bar', fasesBase, fasesBase.map(f => conteoAvance[f]), 'Requerimientos');

            const porEstatus = {};
            proyectos.forEach(p => {
                const est = normalizarTexto(p.estatus || 'BACKLOG');
                const nombre = est.includes('LIBERADO') || est.includes('PRODUCCION') || est.includes('PRODUCCIÓN')
                    ? 'Liberados'
                    : est.charAt(0) + est.slice(1).toLowerCase();

                porEstatus[nombre] = (porEstatus[nombre] || 0) + 1;
            });

            crearGraficaSeguimiento('seguimiento-chart-portafolio', 'doughnut', Object.keys(porEstatus), Object.values(porEstatus), 'Portafolio');
        }

        function renderizarLineaFases(p) {
            const actual = indiceFaseSeguimiento(p.estatus);

            return `
                <div class="mt-4">
                    <div class="grid grid-cols-6 gap-2 items-start">
                        ${fasesSeguimientoEjecutivo.map((fase, idx) => {
                            const completada = idx < actual;
                            const actualFase = idx === actual;
                            const circuloClase = actualFase ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110' : completada ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400';
                            const lineaClase = idx <= actual ? 'bg-blue-500' : 'bg-slate-200';

                            return `
                                <div class="relative flex flex-col items-center text-center">
                                    ${idx < fasesSeguimientoEjecutivo.length - 1 ? `<div class="absolute top-5 left-1/2 w-full h-1 ${lineaClase} -z-0"></div>` : ''}
                                    <div class="relative z-10 w-10 h-10 rounded-2xl ${circuloClase} flex items-center justify-center shadow-sm transition">
                                        <span class="text-lg">${actualFase ? '🚗' : fase.icono}</span>
                                    </div>
                                    <p class="text-[10px] font-black text-slate-500 mt-2 uppercase leading-tight">${fase.label}</p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        function renderizarTarjetaSeguimiento(p) {
            const semaforo = estadoSemaforoProyecto(p);
            const reprogramaciones = contarReprogramacionesProyecto(p.id);
            const desviacion = calcularMaxDesviacionProyecto(p);
            const atrasos = contarAtrasosRealesProyecto(p);
            const avance = Math.round(((indiceFaseSeguimiento(p.estatus) + 1) / fasesSeguimientoEjecutivo.length) * 100);

            return `
                <article class="border border-slate-100 rounded-3xl p-5 bg-slate-50/40 hover:bg-white hover:shadow-md transition">
                    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-[11px] font-black bg-slate-900 text-white px-2.5 py-1 rounded-full">${p.id_req || 'SIN ID'}</span>
                                <span class="text-[11px] font-black px-2.5 py-1 rounded-full border ${semaforo.clase}">${semaforo.icono} ${semaforo.texto}</span>
                                ${reprogramaciones ? `<span class="text-[11px] font-black px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100">Reprogramado (${reprogramaciones})</span>` : ''}
                            </div>

                            <h4 class="text-base font-black text-slate-900 mt-3">${p.nombre_rqm || 'Sin nombre'}</h4>
                            <p class="text-xs text-slate-500 mt-1">${p.cat_sistemas?.nombre || 'Sin sistema'} · ${p.cat_sprints?.nombre || 'Sin sprint'} · Responsable: ${p.responsable_sistemas || '—'}</p>
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

        function llenarFiltrosSeguimientoEjecutivo() {
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

        function obtenerProyectosSeguimientoFiltrados() {
            const sprint = document.getElementById('seguimiento-filtro-sprint')?.value || '';
            const estatus = document.getElementById('seguimiento-filtro-estatus')?.value || '';

            return (todosLosProyectos || []).filter(p => {
                const okSprint = !sprint || String(p.sprint_id || '') === String(sprint);
                const okEstatus = !estatus || normalizarTexto(p.estatus || 'BACKLOG') === estatus;
                return okSprint && okEstatus;
            });
        }

        function filtrarSeguimientoEjecutivo() {
            renderizarSeguimientoEjecutivo();
        }

        function renderizarSeguimientoEjecutivo() {
            const lista = document.getElementById('seguimiento-lista');
            if (!lista) return;

            const proyectos = obtenerProyectosSeguimientoFiltrados();
            renderizarGraficasSeguimientoEjecutivo(proyectos);

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
