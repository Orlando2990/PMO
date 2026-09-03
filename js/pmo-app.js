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
        let proyectosDashboardActuales = [];
        let registrosAdendumsDashboard = [];
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

        const ORDEN_SPRINTS_PMO = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
        const ORDEN_ESTATUS_PMO = ['CANCELADO','BACKLOG','ANÁLISIS','DESARROLLO','QA','UAT','LIBERADO'];

        function etiquetaSprintPMO(sprint) {
            if (!sprint) return '';
            const nombre = String(sprint.nombre || '').trim();
            const anio = Number(sprint.anio || 0);
            return anio ? `${nombre} ${anio}` : nombre;
        }

        function ordenarCatalogoPMO(items, tipo) {
            const base = tipo === 'sprints' ? ORDEN_SPRINTS_PMO : ORDEN_ESTATUS_PMO;
            const normaliza = v => String(v || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const mapa = new Map(base.map((x, i) => [normaliza(x), i + 1]));
            return [...items].sort((a, b) => {
                if (tipo === 'sprints') {
                    const aa = Number(a?.anio || 0), ba = Number(b?.anio || 0);
                    if (aa && ba && aa !== ba) return aa - ba;
                }
                const ao = Number(a?.orden), bo = Number(b?.orden);
                const av = Number.isFinite(ao) && ao > 0, bv = Number.isFinite(bo) && bo > 0;
                if (av || bv) {
                    if (av && bv && ao !== bo) return ao - bo;
                    if (av !== bv) return av ? -1 : 1;
                }
                const ai = mapa.get(normaliza(a?.nombre)) ?? 999;
                const bi = mapa.get(normaliza(b?.nombre)) ?? 999;
                return ai !== bi ? ai - bi : String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es');
            });
        }

        async function cargarCatalogos() {
            try {
                const s = await _supabase.from('cat_sprints').select('*');
                const sis = await _supabase.from('cat_sistemas').select('*').order('nombre');
                const a = await _supabase.from('cat_areas').select('*').order('nombre');
                const c = await _supabase.from('cat_clasificaciones').select('*').order('nombre');
                const pri = await _supabase.from('cat_prioridades').select('*').order('orden').order('nombre');
                const comp = await _supabase.from('cat_complejidades').select('*').order('orden').order('nombre');
                const est = await _supabase.from('cat_estatus').select('*');
                const mot = await _supabase.from('cat_motivos_reprogramacion').select('*').order('nombre');

                cats.sprints = ordenarCatalogoPMO(s.data || [], 'sprints');
                cats.sistemas = sis.data || [];
                cats.areas = a.data || [];
                cats.clasificaciones = c.data || [];
                cats.prioridades = pri.data || [];
                cats.complejidades = comp.data || [];
                cats.estatus = ordenarCatalogoPMO(est.data || [], 'estatus');
                cats.motivos_reprogramacion = mot.data || [];

                llenarSelectsForm();
                llenarMotivosReprogramacion();
                llenarFiltroEstatus();
                llenarFiltroSistema();
                llenarFiltroSprint();
                renderizarListasAdmin();
            } catch (err) { console.error("Error al cargar catálogos:", err.message); }
        }

        function obtenerSprintActualId(p) {
            return p?.sprint_actual_id || p?.sprint_id || null;
        }

        function obtenerSprintNombrePorId(id) {
            if (!id) return '';
            return etiquetaSprintPMO((cats.sprints || []).find(s => String(s.id) === String(id))) || '';
        }

        function obtenerSprintActualNombre(p) {
            return obtenerSprintNombrePorId(obtenerSprintActualId(p)) || p?.cat_sprints?.nombre || 'Sin sprint';
        }

        function renderSprintOrigenActual(p) {
            const origen = p?.cat_sprints ? etiquetaSprintPMO(p.cat_sprints) : 'Sin Sprint';
            const actual = obtenerSprintActualNombre(p);
            if (String(origen).trim().toUpperCase() === String(actual).trim().toUpperCase()) return escaparHtmlPMO(origen);
            return `${escaparHtmlPMO(origen)} <span class="text-blue-600">→ ${escaparHtmlPMO(actual)}</span>`;
        }

        function esUrgentePMO(p) {
            const tipo = normalizarTexto(p?.tipo_incorporacion || 'PLANEADO').replace(/[_-]+/g, ' ');
            return tipo === 'NO PLANEADO' || tipo === 'URGENTE' || tipo === 'FUERA DE PLANEACION';
        }

        function badgeUrgentePMO(p) {
            if (!esUrgentePMO(p)) return '';
            return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-50 text-orange-700 border border-orange-100" title="Requerimiento incorporado fuera de la planeación del Sprint">🔥 Urgente</span>`;
        }

        function actualizarIncorporacionSprintUI() {}
        window.actualizarIncorporacionSprintUI = actualizarIncorporacionSprintUI;

        function sincronizarSprintActualNuevo() {
            const idProyecto = document.getElementById('form-id')?.value || '';
            if (idProyecto) return;
            const origen = document.getElementById('form-sprint');
            const actual = document.getElementById('form-sprint-actual');
            if (origen && actual) actual.value = origen.value || '';
        }

        function llenarSelectsForm() {
            document.getElementById('form-sprint').innerHTML = optionsTemplate(cats.sprints);
            const sprintActual = document.getElementById('form-sprint-actual');
            if (sprintActual) sprintActual.innerHTML = optionsTemplate(cats.sprints);
            const sprintOrigen = document.getElementById('form-sprint');
            if (sprintOrigen && !sprintOrigen.dataset.syncActualBound) {
                sprintOrigen.addEventListener('change', sincronizarSprintActualNuevo);
                sprintOrigen.dataset.syncActualBound = '1';
            }
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

        function esReprogramacionCompromiso(valorOriginal, valorNuevo) {
            if (!valorOriginal || !valorNuevo || valorOriginal === valorNuevo) return false;
            const anterior = new Date(valorOriginal + 'T00:00:00');
            const nueva = new Date(valorNuevo + 'T00:00:00');
            return !Number.isNaN(anterior.getTime()) && !Number.isNaN(nueva.getTime()) && nueva > anterior;
        }

        function usuarioPuedeAjustarFechaSinReprogramacion() {
            const correo = String(window.PMOAuth?.profile?.correo || window.PMOAuth?.user?.email || '').trim().toLowerCase();
            return correo === 'p.castillo@finsus.mx';
        }

        function actualizarVisibilidadAjusteFechaPrivado() {
            const bloque = document.getElementById('bloque-ajuste-fecha-privado');
            const check = document.getElementById('form-ajuste-sin-reprogramacion');
            const autorizado = usuarioPuedeAjustarFechaSinReprogramacion();
            if (bloque) bloque.classList.toggle('hidden', !autorizado);
            if (!autorizado && check) check.checked = false;
        }

        function ajusteSinReprogramacionActivo() {
            return usuarioPuedeAjustarFechaSinReprogramacion() && Boolean(document.getElementById('form-ajuste-sin-reprogramacion')?.checked);
        }

        function obtenerCambiosReprogramacionActuales() {
            if (!proyectoSeleccionadoOriginal || ajusteSinReprogramacionActivo()) return [];

            const definiciones = [
                {
                    clave: 'desarrollo',
                    fase: 'Compromiso Desarrollo',
                    campoBD: 'fecha_desarrollo',
                    inputId: 'form-fecha-desarrollo',
                    motivoId: 'form-motivo-desarrollo',
                    comentarioId: 'form-comentario-motivo-desarrollo'
                },
                {
                    clave: 'qa',
                    fase: 'Compromiso QA',
                    campoBD: 'fecha_qa',
                    inputId: 'form-fecha-qa',
                    motivoId: 'form-motivo-qa',
                    comentarioId: 'form-comentario-motivo-qa'
                },
                {
                    clave: 'uat',
                    fase: 'Compromiso UAT',
                    campoBD: 'fecha_uat',
                    inputId: 'form-fecha-uat',
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
                        cambio: esReprogramacionCompromiso(fechaAnterior, fechaNueva)
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
            const filtros = [
                document.getElementById('filtro-sistema'),
                document.getElementById('filtro-sistema-dashboard')
            ].filter(Boolean);

            filtros.forEach(filtro => {
                const valorActual = filtro.value;
                filtro.innerHTML = '<option value="">Todos los sistemas</option>';
                cats.sistemas.forEach(s => {
                    filtro.innerHTML += `<option value="${s.id}" data-nombre="${normalizarTexto(s.nombre)}">${s.nombre}</option>`;
                });
                filtro.value = valorActual;
            });
        }

        function llenarFiltroSprint() {
            const filtro = document.getElementById('filtro-sprint');
            if (!filtro) return;

            const valorActual = filtro.value;
            filtro.innerHTML = '<option value="">Todos los sprints</option>';

            cats.sprints.forEach(s => {
                filtro.innerHTML += `<option value="${s.id}" data-nombre="${normalizarTexto(etiquetaSprintPMO(s))}">${etiquetaSprintPMO(s)}</option>`;
            });

            filtro.value = valorActual;
        }

        const optionsTemplate = (arr) => {
            let html = '<option value="">-- Seleccionar --</option>';
            html += arr.map(x => `<option value="${x.id}">${arr === cats.sprints ? etiquetaSprintPMO(x) : x.nombre}</option>`).join('');
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
                    placeholder: 'Año (Ej: 2027)',
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
                        ${cat.tipo === 'sprints' ? etiquetaSprintPMO(item) : item.nombre}
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
                        type="${cat.tipo === 'sprints' ? 'number' : 'text'}"
                        id="${cat.inputId}"
                        ${cat.tipo === 'sprints' ? 'min="2026" max="2100" step="1"' : ''}
                        placeholder="${cat.placeholder}"
                        class="min-w-0 flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                    >

                    <button
                        onclick="${cat.tipo === 'sprints' ? 'crearSprintsAnio()' : `crearCatalogo('${cat.tipo}')`}"
                        class="${colores.button} text-white px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5"
                    >
                        <i data-lucide="plus-circle" class="w-4 h-4"></i>
                        ${cat.tipo === 'sprints' ? 'Generar año' : 'Añadir'}
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

        async function crearSprintsAnio() {
            const input = document.getElementById('add-sprint-name');
            const anio = Number(input?.value || 0);
            if (!Number.isInteger(anio) || anio < 2026 || anio > 2100) {
                alert('Captura un año válido, por ejemplo 2027.');
                return;
            }
            const existentes = new Set((cats.sprints || []).filter(s => Number(s.anio) === anio).map(s => normalizarTexto(s.nombre)));
            const nuevos = ORDEN_SPRINTS_PMO
                .filter(nombre => !existentes.has(normalizarTexto(nombre)))
                .map((nombre, i) => ({ nombre, anio, orden: i + 1 }));
            if (!nuevos.length) {
                alert(`Los 12 Sprints de ${anio} ya existen.`);
                return;
            }
            try {
                const { error } = await _supabase.from('cat_sprints').insert(nuevos);
                if (error) throw error;
                input.value = '';
                await cargarTodo();
            } catch (e) { alert('Error al generar los Sprints del año: ' + e.message); }
        }
        window.crearSprintsAnio = crearSprintsAnio;

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
                    .select('*, cat_sprints:sprint_id(nombre,anio), sprint_actual:cat_sprints!pmo_projects_sprint_actual_id_fkey(nombre,anio), cat_sistemas(nombre), cat_areas(nombre), cat_clasificaciones(nombre)')
                    .order('created_at', { ascending: false });

                if (errProyectos) throw errProyectos;
                todosLosProyectos = proyectos || [];

                // Visor de adendums: la relación padre-hijo vive en el buzón de RQM.
                // Si la consulta falla, el resto del Dashboard continúa funcionando.
                try {
                    const { data: registrosAdendum, error: errAdendum } = await _supabase
                        .from('rqm_control_requerimientos')
                        .select('id,numero_rqm,proyecto,tipo_registro,requerimiento_padre_id,numero_adendum,estatus,created_at');
                    if (errAdendum) throw errAdendum;
                    registrosAdendumsDashboard = registrosAdendum || [];
                } catch (e) {
                    console.warn('No fue posible cargar el visor de adendums:', e?.message || e);
                    registrosAdendumsDashboard = [];
                }

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
                        const esReprogramacionCompromisoActual =
                            ['Compromiso Desarrollo', 'Compromiso QA', 'Compromiso UAT'].includes(fase) &&
                            esReprogramacionCompromiso(h.fecha_anterior, h.fecha_nueva);
                        const esReprogramacionLegacy =
                            ['Fin Desarrollo', 'Fin QA', 'Fin UAT'].includes(fase) &&
                            h.fecha_anterior && h.fecha_nueva && h.fecha_anterior !== h.fecha_nueva &&
                            !razonNormalizada.includes('ACTUALIZACION DE FECHA');
                        const esReprogramacion = esReprogramacionCompromisoActual || esReprogramacionLegacy;

                        // Los ajustes administrativos no generan historial, pero se mantiene esta
                        // salvaguarda por compatibilidad con registros históricos anteriores.
                        if (esAjusteAdministrativo) {
                            if (!ajustesAdministrativos[h.project_id]) ajustesAdministrativos[h.project_id] = {};
                            ajustesAdministrativos[h.project_id][fase] = true;
                            return;
                        }

                        conteoCambios[h.project_id] = (conteoCambios[h.project_id] || 0) + 1;

                        if (esReprogramacion) {
                            conteoReprogramaciones[h.project_id] = (conteoReprogramaciones[h.project_id] || 0) + 1;
                        }
                    });
                }

                conteoCambiosGlobal = conteoCambios;
                conteoReprogramacionesGlobal = conteoReprogramaciones;
                ajustesAdministrativosGlobal = ajustesAdministrativos;

                renderizarTabla(todosLosProyectos, conteoCambiosGlobal);
                renderizarContadoresDinamicos(todosLosProyectos);
                if (document.getElementById('filtro-sistema-dashboard')) {
                    filtrarDashboardPorSistema();
                } else {
                    renderizarDashboardEjecutivo(todosLosProyectos);
                }
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
                            <div class="font-bold text-xs text-slate-900">${renderSprintOrigenActual(p)}</div>
                            <div class="text-[11px] text-slate-400 font-black mt-1">${p.cat_sistemas?.nombre || '—'}</div>
                            <div class="mt-2">${badgePrioridad}</div>
                            <div class="text-[11px] text-slate-400 mt-1 font-medium">${p.cat_clasificaciones?.nombre || 'Sin Clasificación'}</div>
                            <div class="mt-2">${badgeUrgentePMO(p)}</div>
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

            contenedor.innerHTML = `
                <div class="pmo-ytd-head">
                    <h3 class="pmo-ytd-title">Resumen de la Matriz</h3>
                </div>
                <div class="pmo-ytd-grid pmo-ytd-grid-six">
                    ${grupos.map(g => `<div class="pmo-ytd-item"><div class="pmo-ytd-value">${g.valor}</div><div class="pmo-ytd-label">${g.label}</div></div>`).join('')}
                </div>
            `;

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

            if (reprogramacionesDetectadas.length && !ajusteSinReprogramacionActivo()) {
                const sinMotivo = reprogramacionesDetectadas.find(c => !document.getElementById(c.motivoId)?.value);
                if (sinMotivo) {
                    btnGuardar.disabled = false;
                    btnGuardar.innerText = 'Guardar Cambios';
                    if (window.PMOAlert) {
                        await PMOAlert(`Selecciona un motivo para la reprogramación de ${sinMotivo.clave.toUpperCase()}.`, {
                            title: 'Motivo requerido',
                            type: 'warning'
                        });
                    } else {
                        alert(`Selecciona un motivo para la reprogramación de ${sinMotivo.clave.toUpperCase()}.`);
                    }
                    document.getElementById(sinMotivo.motivoId)?.focus();
                    return;
                }
            }

            const tipoIncorporacion = document.getElementById('form-urgente-sprint')?.checked ? 'NO_PLANEADO' : 'PLANEADO';

            const reqData = {
                id_req: document.getElementById('form-id-req').value.trim(),
                nombre_rqm: document.getElementById('form-nombre-rqm').value.trim(),
                sprint_id: document.getElementById('form-sprint').value || null,
                sprint_actual_id: document.getElementById('form-sprint-actual')?.value || document.getElementById('form-sprint').value || null,
                tipo_incorporacion: tipoIncorporacion,
                motivo_incorporacion: null,
                detalle_incorporacion: null,
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
                                const esCompromisoReprogramado = fase.startsWith('Compromiso ') && esReprogramacionCompromiso(ant || null, nva || null);
                                const motivoNombre = motivoTexto || nombreMotivoPorId(motivoId);
                                const razonTexto = esAjusteAdministrativo
                                    ? 'Ajuste administrativo - No afecta reprogramación ni desviación'
                                    : (esCompromisoReprogramado
                                        ? (motivoNombre
                                            ? `${motivoNombre}${comentarioMotivo ? ' - ' + comentarioMotivo : ''}`
                                            : (comentarioMotivo || 'Reprogramación de compromiso'))
                                        : 'Actualización de fecha');

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

                            await registrarLog('Compromiso Desarrollo', proyectoSeleccionadoOriginal.fecha_desarrollo, reqData.fecha_desarrollo, motivoDev.motivoId, motivoDev.comentario, motivoDev.motivoTexto, false);
                            await registrarLog('Inicio Desarrollo', proyectoSeleccionadoOriginal.fecha_inicio_desarrollo, reqData.fecha_inicio_desarrollo);
                            await registrarLog('Fin Desarrollo', proyectoSeleccionadoOriginal.fecha_fin_desarrollo, reqData.fecha_fin_desarrollo);

                            await registrarLog('Compromiso QA', proyectoSeleccionadoOriginal.fecha_qa, reqData.fecha_qa, motivoQA.motivoId, motivoQA.comentario, motivoQA.motivoTexto, false);
                            await registrarLog('Inicio QA', proyectoSeleccionadoOriginal.fecha_inicio_qa, reqData.fecha_inicio_qa);
                            await registrarLog('Fin QA', proyectoSeleccionadoOriginal.fecha_fin_qa, reqData.fecha_fin_qa);

                            await registrarLog('Compromiso UAT', proyectoSeleccionadoOriginal.fecha_uat, reqData.fecha_uat, motivoUAT.motivoId, motivoUAT.comentario, motivoUAT.motivoTexto, false);
                            await registrarLog('Inicio UAT', proyectoSeleccionadoOriginal.fecha_inicio_uat, reqData.fecha_inicio_uat);
                            await registrarLog('Fin UAT', proyectoSeleccionadoOriginal.fecha_fin_uat, reqData.fecha_fin_uat);

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
                    if (window.PMOAlert) {
                        await PMOAlert('El requerimiento se actualizó correctamente.', {
                            title: 'Cambios guardados'
                        });
                    } else {
                        alert('Requerimiento actualizado correctamente.');
                    }
                } else {
                    const { data, error } = await _supabase
                        .from('pmo_projects')
                        .insert([reqData])
                        .select();

                    if (error) throw error;

                    console.log("Guardado correctamente:", data);
                    if (window.PMOAlert) {
                        await PMOAlert('El requerimiento se guardó correctamente.', {
                            title: 'Requerimiento guardado'
                        });
                    } else {
                        alert('Requerimiento guardado correctamente.');
                    }
                }

                cerrarModal();
                await cargarTodo();

                // Cuando la edición se realiza desde Seguimiento Ejecutivo, cargarTodo()
                // actualiza los datos en memoria pero la vista ya montada necesita volver
                // a renderizarse para reflejar al instante fechas, desviación, atraso y semáforo.
                if (document.getElementById('seguimiento-lista')) {
                    renderizarSeguimientoEjecutivo();
                }

            } catch (error) {
                console.error("Error completo al guardar:", error);
                const msg = error?.message || '';
                if (window.PMOAlert) {
                    await PMOAlert('No se pudo guardar' + (msg ? ': ' + msg : '.'), {
                        title: 'No fue posible guardar',
                        type: 'error'
                    });
                } else {
                    alert('No se pudo guardar: ' + msg);
                }
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

                // Si el historial se elimina desde Seguimiento Ejecutivo, cargarTodo()
                // recalcula el conteo de reprogramaciones pero la tarjeta visible debe
                // volver a renderizarse para retirar inmediatamente el badge anterior.
                if (document.getElementById('seguimiento-lista')) {
                    renderizarSeguimientoEjecutivo();
                }

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
            const chkUrgenteSprintNuevo = document.getElementById('form-urgente-sprint');
            if (chkUrgenteSprintNuevo) chkUrgenteSprintNuevo.checked = false;
            document.getElementById('form-proyecto').reset();
            llenarSelectsForm();
            sincronizarSprintActualNuevo();
            setValueIfExists('form-tipo-incorporacion', 'PLANEADO');
            setValueIfExists('form-motivo-incorporacion', '');
            setValueIfExists('form-detalle-incorporacion', '');
            actualizarIncorporacionSprintUI();
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

        async function abrirModalEditar(id) {
            const p = todosLosProyectos.find(x => x.id === id);
            if (!p) return;

            proyectoSeleccionadoOriginal = { ...p };
            llenarSelectsForm();
            llenarMotivosReprogramacion();

            setValueIfExists('form-id', p.id);
            setValueIfExists('form-id-req', p.id_req);
            setValueIfExists('form-nombre-rqm', p.nombre_rqm);
            setValueIfExists('form-sprint', p.sprint_id);
            setValueIfExists('form-sprint-actual', obtenerSprintActualId(p));
            const chkUrgenteSprint = document.getElementById('form-urgente-sprint');
            if (chkUrgenteSprint) chkUrgenteSprint.checked = esUrgentePMO(p);
            setValueIfExists('form-sistema', p.sistema_id);
            setValueIfExists('form-clasificacion', p.clasificacion_id);
            setValueIfExists('form-area', p.area_id);
            setValueIfExists('form-solicitante', p.solicitante);
            setValueIfExists('form-responsable-sistemas', p.responsable_sistemas);
            setValueIfExists('form-asignado-a', p.asignado_a);
            setValueIfExists('form-prioridad', p.prioridad || 'Baja');
            setValueIfExists('form-complejidad', p.complejidad || 'Mediana');
            setValueIfExists('form-estatus', p.estatus || 'BACKLOG');
            let descripcionFormulario = p.descripcion || '';
            // Respaldo para RQM provenientes de Mis solicitudes: si un registro histórico
            // llegó a la Matriz sin descripción, recuperamos la Descripción general original.
            if (!descripcionFormulario && p.id_req) {
                try {
                    const { data: solicitudOrigen } = await _supabase
                        .from('rqm_control_requerimientos')
                        .select('datos_formulario,observaciones')
                        .eq('numero_rqm', p.id_req)
                        .maybeSingle();
                    const datosOrigen = solicitudOrigen?.datos_formulario || {};
                    descripcionFormulario = datosOrigen.descripcion_general || '';
                    if (!descripcionFormulario && solicitudOrigen?.observaciones) {
                        const m = String(solicitudOrigen.observaciones).match(/Descripción:\s*([\s\S]*?)(?=\n\n[A-ZÁÉÍÓÚÑ][^\n]{0,55}:|\n\n---|$)/i);
                        descripcionFormulario = m ? m[1].trim() : '';
                    }
                } catch (e) {
                    console.warn('No fue posible recuperar la Descripción general del Self Service:', e?.message || e);
                }
            }
            setValueIfExists('form-descripcion', descripcionFormulario);
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
            if (await PMOConfirm(`Se eliminará "${nombre}" únicamente de la Matriz de Requerimientos. La solicitud original y su folio permanecerán en el Buzón de RQM y en la vista del usuario para conservar la trazabilidad. Esta acción no se puede deshacer.`)) {
                const { error } = await _supabase.from('pmo_projects').delete().eq('id', id);
                if (error) {
                    await PMOAlert('No se pudo eliminar', error.message || 'Ocurrió un error al eliminar el proyecto de la Matriz.');
                    return;
                }
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

        function contextoMetricasPMO() {
            return {
                reprogramaciones: conteoReprogramacionesGlobal || {},
                ajustesAdministrativos: ajustesAdministrativosGlobal || {},
                hoy: new Date()
            };
        }

        function escaparHtmlPMO(valor) {
            return String(valor ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
        }

        function obtenerResumenUrgentesDashboard(proyectos) {
            const evaluables = (proyectos || []).filter(p => !esCanceladoDashboard(p));
            const urgentes = evaluables.filter(esUrgentePMO);
            return {
                total: urgentes.length,
                activos: urgentes.filter(p => !esLiberadoDashboard(p)).length,
                liberados: urgentes.filter(esLiberadoDashboard).length
            };
        }


        function obtenerResumenAdendumsDashboard(proyectos = proyectosDashboardActuales.length || document.getElementById('filtro-sistema-dashboard')?.value ? proyectosDashboardActuales : todosLosProyectos) {
            const registros = proyectos || [];
            const esAdendum = p => normalizarTexto(p?.tipo_registro) === 'ADENDUM';
            const adendums = registros.filter(esAdendum);
            const bases = registros.filter(p => !esAdendum(p));
            const basesPorId = new Map(bases.map(p => [String(p.id), p]));
            const porPadre = new Map();

            adendums.forEach(a => {
                const padre = a.requerimiento_padre_id ? basesPorId.get(String(a.requerimiento_padre_id)) : null;
                if (!padre) return;
                const clave = String(padre.id);
                if (!porPadre.has(clave)) porPadre.set(clave,{padre,adendums:[]});
                porPadre.get(clave).adendums.push(a);
            });

            const grupos=[...porPadre.values()].sort((a,b)=>
                String(a.padre.id_req||'').localeCompare(String(b.padre.id_req||''),'es',{numeric:true})
            );
            grupos.forEach(g=>g.adendums.sort((a,b)=>Number(a.numero_adendum||0)-Number(b.numero_adendum||0)));

            return {
                requerimientosBase:bases.length,
                requerimientosConAdendum:grupos.length,
                adendumsTotales:adendums.length,
                grupos
            };
        }

        function renderizarResumenAdendumsDashboard() {
            const r = obtenerResumenAdendumsDashboard();
            const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
            set('adendum-rqm-base', r.requerimientosBase);
            set('adendum-rqm-con-adendum', r.requerimientosConAdendum);
            set('adendum-total', r.adendumsTotales);
            const btn=document.getElementById('card-rqm-con-adendum');
            if(btn) btn.disabled = r.requerimientosConAdendum === 0;
        }

        function abrirVisorAdendums() {
            const r = obtenerResumenAdendumsDashboard(proyectosDashboardActuales.length || document.getElementById('filtro-sistema-dashboard')?.value ? proyectosDashboardActuales : todosLosProyectos);
            const modal = document.getElementById('modal-visor-adendums');
            const body = document.getElementById('visor-adendums-body');
            if (!modal || !body) return;

            if (!r.grupos.length) {
                body.innerHTML = '<div class="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500 text-center">No hay requerimientos con adendums registrados.</div>';
            } else {
                body.innerHTML = r.grupos.map(g => {
                    const padre = g.padre || {};
                    return `<div class="rounded-2xl border border-slate-200 overflow-hidden">
                        <div class="w-full text-left p-4 bg-slate-50">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <p class="text-xs font-black uppercase tracking-wide text-blue-600">${escaparHtmlPMO(padre.id_req || 'RQM base')}</p>
                                    <p class="font-black text-slate-900 mt-1">${escaparHtmlPMO(padre.nombre_rqm || 'Requerimiento')}</p>
                                </div>
                                <span class="shrink-0 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-black">${g.adendums.length} adendum${g.adendums.length===1?'':'s'}</span>
                            </div>
                        </div>
                        <div class="divide-y divide-slate-100">
                            ${g.adendums.map(a => `<div class="px-4 py-3 flex items-start gap-3">
                                <div class="w-8 h-8 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0"><i data-lucide="file-plus-2" class="w-4 h-4"></i></div>
                                <div><p class="text-sm font-black text-slate-800">${escaparHtmlPMO(a.id_req || 'Adendum')}</p><p class="text-xs text-slate-500 mt-0.5">${escaparHtmlPMO(a.nombre_rqm || 'Sin nombre')}</p></div>
                            </div>`).join('')}
                        </div>
                    </div>`;
                }).join('');
            }
            modal.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function cerrarVisorAdendums() {
            document.getElementById('modal-visor-adendums')?.classList.add('hidden');
        }
        window.abrirVisorAdendums = abrirVisorAdendums;
        window.cerrarVisorAdendums = cerrarVisorAdendums;

        function renderizarKpisEjecutivos(proyectos) {
            const contenedor = document.getElementById('kpis-ejecutivos');
            if (!contenedor || !window.PMOMetrics) return;
            const r = PMOMetrics.resumen(proyectos, contextoMetricasPMO());

            // Los cancelados no forman parte del portafolio considerado para desempeño.
            const portafolioVigente = Math.max(0, r.total - r.cancelados);
            const porcentajeLiberados = portafolioVigente ? Math.round((r.liberados / portafolioVigente) * 100) : 0;

            const kpis = [
                { titulo: 'Portafolio vigente', valor: portafolioVigente, detalle: `${r.cancelados} cancelado${r.cancelados === 1 ? '' : 's'} excluido${r.cancelados === 1 ? '' : 's'} del portafolio`, icono: 'layers', clase: 'bg-blue-50 text-blue-700' },
                { titulo: 'Liberados', valor: r.liberados, detalle: `${porcentajeLiberados}% del portafolio vigente`, icono: 'rocket', clase: 'bg-emerald-50 text-emerald-700' },
                { titulo: 'Lead time promedio', valor: r.leadTimePromedio === null ? '—' : `${r.leadTimePromedio} d`, detalle: 'Ingreso a liberación', icono: 'timer', clase: 'bg-amber-50 text-amber-700' },
                { titulo: 'Requerimientos atrasados', valor: r.requerimientosAtrasados, detalle: `${r.atrasos.length} fase${r.atrasos.length === 1 ? '' : 's'} abierta${r.atrasos.length === 1 ? '' : 's'} vencida${r.atrasos.length === 1 ? '' : 's'}`, icono: 'triangle-alert', clase: 'bg-rose-50 text-rose-700' },
                { titulo: 'Próximos 7 días', valor: r.proximos7.length, detalle: 'Compromisos abiertos por vencer', icono: 'calendar-range', clase: 'bg-cyan-50 text-cyan-700' },
                { titulo: 'Reprogramaciones', valor: r.reprogramaciones, detalle: `${r.proyectosReprogramados} requerimiento${r.proyectosReprogramados === 1 ? '' : 's'} afectado${r.proyectosReprogramados === 1 ? '' : 's'}`, icono: 'calendar-clock', clase: 'bg-orange-50 text-orange-700' },
                { titulo: 'Estabilidad del plan', valor: r.estabilidad === null ? '—' : `${r.estabilidad}%`, detalle: 'Requerimientos sin reprogramación', icono: 'shield-check', clase: 'bg-slate-100 text-slate-700' },
                { titulo: 'Arrastres actuales', valor: obtenerResumenArrastresDashboard(proyectos).activos, detalle: 'RQM activos provenientes de Sprints anteriores · Clic para ver cuáles', icono: 'arrow-right-left', clase: 'bg-indigo-50 text-indigo-700', accion: 'abrirDetalleArrastresDashboard()' }
            ];

            contenedor.innerHTML = kpis.map(k => `
                <div ${k.accion ? `onclick="${k.accion}" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${k.accion}}"` : ''} class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition ${k.accion ? 'cursor-pointer hover:border-indigo-200' : ''}">
                    <div class="flex justify-between items-start gap-4">
                        <div><p class="text-xs font-black uppercase tracking-wide text-slate-400">${k.titulo}</p><h3 class="text-3xl font-black text-slate-900 mt-2">${k.valor}</h3><p class="text-xs text-slate-500 mt-1">${k.detalle}</p></div>
                        <div class="relative group shrink-0">
                            <div class="${k.clase} w-11 h-11 rounded-2xl flex items-center justify-center ${k.tooltip ? 'cursor-help' : ''}"><i data-lucide="${k.icono}" class="w-5 h-5"></i></div>
                            ${k.tooltip ? `<div class="pointer-events-none absolute z-50 right-0 top-14 w-80 rounded-xl bg-slate-900 px-4 py-3 text-xs leading-relaxed font-medium text-white shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">${k.tooltip}<span class="absolute -top-1.5 right-4 w-3 h-3 bg-slate-900 rotate-45"></span></div>` : ''}
                        </div>
                    </div>
                </div>`).join('');

            const criticos = r.salud.ROJO || 0;
            const pulsoValor = document.getElementById('pmo-pulso-valor');
            const pulsoDetalle = document.getElementById('pmo-pulso-detalle');
            const pulsoBadge = document.getElementById('pmo-pulso-badge');
            if (pulsoValor) pulsoValor.textContent = (criticos || r.proximos7.length)
                ? `${criticos} crítico${criticos === 1 ? '' : 's'} · ${r.proximos7.length} próximo${r.proximos7.length === 1 ? '' : 's'}`
                : 'Portafolio sin riesgos inmediatos';
            if (pulsoDetalle) pulsoDetalle.textContent = (criticos || r.proximos7.length)
                ? 'Consulta el detalle inferior para identificar los requerimientos y el motivo de atención.'
                : 'No hay casos críticos ni compromisos abiertos que venzan en los próximos 7 días.';
            const resumenArrastres = obtenerResumenArrastresDashboard(proyectos);
            const resumenUrgentes = obtenerResumenUrgentesDashboard(proyectos);
            const urgentesTotal = document.getElementById('resumen-urgentes-total');
            const urgentesDetalle = document.getElementById('resumen-urgentes-detalle');
            if (urgentesTotal) urgentesTotal.textContent = resumenUrgentes.total;
            if (urgentesDetalle) urgentesDetalle.textContent = `${resumenUrgentes.liberados} liberados · ${resumenUrgentes.activos} activos`;
            if (pulsoBadge) pulsoBadge.textContent = `${r.vigentes} vigentes · ${r.liberados} liberados · ${resumenArrastres.activos} arrastre${resumenArrastres.activos === 1 ? '' : 's'} activo${resumenArrastres.activos === 1 ? '' : 's'} · ${resumenUrgentes.total} urgente${resumenUrgentes.total === 1 ? '' : 's'} · ${r.estabilidad ?? '—'}% estabilidad`;
            renderizarSaludPortafolio(r);
            renderizarAtencionEjecutiva(r);
            const setText = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor === null ? '—' : `${valor} días`; };
            setText('promedio-desarrollo', r.duracionDesarrollo);
            setText('promedio-qa', r.duracionQA);
            setText('promedio-uat', r.duracionUAT);
        }

        function renderizarSaludPortafolio(r) {
            const el = document.getElementById('pmo-command-health');
            if (!el) return;
            const base = Math.max(1, r.vigentes);
            const filas = [
                { label: 'Saludable', valor: r.salud.VERDE || 0, color: '#10b981', dot: 'pmo-health-green' },
                { label: 'Atención', valor: r.salud.AMARILLO || 0, color: '#f59e0b', dot: 'pmo-health-yellow' },
                { label: 'Crítico', valor: r.salud.ROJO || 0, color: '#ef4444', dot: 'pmo-health-red' }
            ];
            el.innerHTML = filas.map(f => `
                <div>
                    <div class="flex items-center justify-between mb-1"><div class="flex items-center gap-2"><span class="pmo-health-dot ${f.dot}"></span><span class="pmo-health-label">${f.label}</span></div><span class="pmo-health-value">${f.valor}</span></div>
                    <div class="pmo-mini-bar"><span style="width:${Math.round((f.valor/base)*100)}%;background:${f.color}"></span></div>
                </div>`).join('') + `<div class="pmo-health-footer pt-3 border-t border-slate-100"><b class="text-slate-800">${r.vigentes}</b> requerimientos vigentes evaluados automáticamente.</div>`;
        }

        function renderizarAtencionEjecutiva(r) {
            const el = document.getElementById('atencion-ejecutiva');
            if (!el) return;

            const criticos = (r.metricas || [])
                .filter(m => !m.cancelado && m.salud === 'ROJO')
                .map(m => {
                    const fase = m.fasesAtrasadas?.sort((a,b)=>b.atraso-a.atraso)?.[0]
                        || m.proximas?.sort((a,b)=>a.proximoVencimiento-b.proximoVencimiento)?.[0]
                        || m.fases?.find(f=>f.fin && f.desviacion>0)
                        || { nombre: m.estatus, compromiso: null };
                    return { proyecto:m.proyecto, fase:fase.nombre, fecha:fase.compromiso, motivo:m.motivoSalud, severidad:'ROJO', orden:0 };
                });

            const idsCriticos = new Set(criticos.map(a => a.proyecto.id));
            const proximos = (r.proximos7 || [])
                .filter(a => !idsCriticos.has(a.proyecto.id))
                .map(a => ({ proyecto:a.proyecto, fase:a.nombre, fecha:a.compromiso, motivo:a.proximoVencimiento===0?'Vence hoy':`Vence en ${a.proximoVencimiento} d`, severidad:'AMARILLO', orden:1, dias:a.proximoVencimiento }));

            const alertas = [...criticos, ...proximos]
                .sort((a,b)=>a.orden-b.orden || (a.dias??999)-(b.dias??999))
                .slice(0,12);

            if (!alertas.length) {
                el.innerHTML = '<div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 flex items-center gap-3 text-emerald-800"><i data-lucide="circle-check" class="w-5 h-5"></i><div><b>Sin riesgos inmediatos</b><p class="text-xs mt-1 text-emerald-700">No hay casos críticos ni compromisos abiertos que venzan en los próximos 7 días.</p></div></div>';
                return;
            }
            el.innerHTML = `<div class="pmo-risk-row text-[10px] font-black uppercase tracking-wide text-slate-400"><span>Requerimiento</span><span>Fase</span><span class="pmo-risk-hide-mobile">Compromiso</span><span class="pmo-risk-hide-mobile">Motivo</span></div>` + alertas.map(a => {
                const rojo = a.severidad === 'ROJO';
                return `<div class="pmo-risk-row"><div class="min-w-0"><p class="text-sm font-black text-slate-800 truncate">${escaparHtmlPMO(a.proyecto.id_req || 'Sin folio')} · ${escaparHtmlPMO(a.proyecto.nombre_rqm || 'Sin nombre')}</p><p class="text-xs text-slate-400 truncate mt-0.5">${escaparHtmlPMO(a.proyecto.cat_sistemas?.nombre || 'Sin sistema')}</p></div><span class="text-xs font-black text-slate-600">${escaparHtmlPMO(a.fase || '—')}</span><span class="text-xs font-bold text-slate-500 pmo-risk-hide-mobile">${a.fecha ? formatearFechaVista(a.fecha) : '—'}</span><span class="pmo-risk-hide-mobile inline-flex justify-center px-2.5 py-1 rounded-full text-[10px] font-black ${rojo ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}">${escaparHtmlPMO(a.motivo || 'Requiere atención')}</span></div>`;
            }).join('');
        }

        const etiquetasDonaEstatusDashboard = {
            id: 'etiquetasDonaEstatusDashboard',
            afterDatasetsDraw(chart) {
                if (chart.config.type !== 'doughnut') return;
                const { ctx } = chart;
                const dataset = chart.data.datasets?.[0];
                const meta = chart.getDatasetMeta(0);
                if (!dataset || !meta) return;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '900 13px Arial, sans-serif';

                meta.data.forEach((arco, indice) => {
                    const valor = Number(dataset.data[indice] || 0);
                    const visible = typeof chart.getDataVisibility === 'function'
                        ? chart.getDataVisibility(indice)
                        : !arco.hidden;
                    if (!visible || valor <= 0) return;

                    const props = arco.getProps(['x', 'y', 'startAngle', 'endAngle', 'innerRadius', 'outerRadius'], true);
                    const angulo = (props.startAngle + props.endAngle) / 2;
                    const radio = (props.innerRadius + props.outerRadius) / 2;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(String(valor), props.x + Math.cos(angulo) * radio, props.y + Math.sin(angulo) * radio);
                });

                const total = dataset.data.reduce((acumulado, valor, indice) => {
                    const visible = typeof chart.getDataVisibility === 'function'
                        ? chart.getDataVisibility(indice)
                        : !meta.data[indice]?.hidden;
                    return visible ? acumulado + Number(valor || 0) : acumulado;
                }, 0);

                const primerArco = meta.data.find((arco, indice) =>
                    typeof chart.getDataVisibility === 'function' ? chart.getDataVisibility(indice) : !arco.hidden
                );
                const centro = primerArco
                    ? primerArco.getProps(['x', 'y'], true)
                    : {
                        x: (chart.chartArea.left + chart.chartArea.right) / 2,
                        y: (chart.chartArea.top + chart.chartArea.bottom) / 2
                    };

                ctx.fillStyle = '#0f172a';
                ctx.font = '900 30px Arial, sans-serif';
                ctx.fillText(String(total), centro.x, centro.y - 8);
                ctx.fillStyle = '#64748b';
                ctx.font = '800 10px Arial, sans-serif';
                ctx.fillText(total === 1 ? 'REQUERIMIENTO' : 'REQUERIMIENTOS', centro.x, centro.y + 17);
                ctx.restore();
            }
        };

        function crearGraficaEstatusDashboard(proyectos) {
            const canvas = document.getElementById('chart-estatus');
            if (!canvas || typeof Chart === 'undefined') return;
            if (chartsEjecutivos['chart-estatus']) chartsEjecutivos['chart-estatus'].destroy();

            const conteo = contarPor(proyectos, p => normalizarTexto(p.estatus || 'BACKLOG'));
            const orden = ['LIBERADO', 'UAT', 'QA', 'BACKLOG', 'CANCELADO', 'ANALISIS', 'DESARROLLO'];
            const extras = Object.keys(conteo).filter(k => !orden.includes(k));
            const labels = [...orden.filter(k => Number(conteo[k] || 0) > 0), ...extras.filter(k => Number(conteo[k] || 0) > 0)];
            const data = labels.map(k => Number(conteo[k] || 0));

            const paleta = {
                LIBERADO: 'rgba(30, 58, 138, 0.90)',
                UAT: 'rgba(37, 99, 235, 0.85)',
                QA: 'rgba(245, 158, 11, 0.85)',
                BACKLOG: 'rgba(249, 115, 22, 0.85)',
                CANCELADO: 'rgba(16, 185, 129, 0.85)',
                ANALISIS: 'rgba(139, 92, 246, 0.85)',
                DESARROLLO: 'rgba(6, 182, 212, 0.85)'
            };
            const colores = labels.map(k => paleta[k] || 'rgba(100, 116, 139, 0.85)');

            chartsEjecutivos['chart-estatus'] = new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                plugins: [etiquetasDonaEstatusDashboard],
                data: {
                    labels,
                    datasets: [{
                        label: 'Requerimientos',
                        data,
                        backgroundColor: colores,
                        borderColor: '#ffffff',
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    layout: { padding: { left: 4, right: 4, top: 2, bottom: 2 } },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                boxWidth: 11,
                                boxHeight: 11,
                                padding: 14,
                                font: { size: 11, weight: 'bold' },
                                generateLabels(chart) {
                                    const ds = chart.data.datasets[0];
                                    return chart.data.labels.map((label, i) => ({
                                        text: `${label} ${ds.data[i]}`,
                                        fillStyle: ds.backgroundColor[i],
                                        strokeStyle: ds.backgroundColor[i],
                                        lineWidth: 0,
                                        hidden: !chart.getDataVisibility(i),
                                        index: i
                                    }));
                                }
                            },
                            onClick(e, item, legend) {
                                const chart = legend.chart;
                                chart.toggleDataVisibility(item.index);
                                chart.update();
                            }
                        },
                        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}` } }
                    }
                }
            });
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


        function esCanceladoDashboard(p) {
            return normalizarTexto(p?.estatus || '') === 'CANCELADO';
        }

        function esLiberadoDashboard(p) {
            return normalizarTexto(p?.estatus || '') === 'LIBERADO';
        }

        function obtenerResumenArrastresDashboard(proyectos) {
            const evaluables = (proyectos || []).filter(p => !esCanceladoDashboard(p));
            const arrastrados = evaluables.filter(p => {
                const origen = p?.sprint_id;
                const actual = obtenerSprintActualId(p);
                return origen && actual && String(origen) !== String(actual);
            });
            return {
                total: arrastrados.length,
                activos: arrastrados.filter(p => !esLiberadoDashboard(p)).length
            };
        }

        function crearOActualizarGraficaSprintsComparativa(proyectos) {
            const canvas = document.getElementById('chart-sprints');
            if (!canvas || typeof Chart === 'undefined') return;
            if (chartsEjecutivos['chart-sprints']) chartsEjecutivos['chart-sprints'].destroy();

            const evaluables = (proyectos || []).filter(p => !esCanceladoDashboard(p));
            const esArrastre = p => {
                const origen = p?.sprint_id;
                const actual = obtenerSprintActualId(p);
                return origen && actual && String(origen) !== String(actual);
            };
            const propios = contarPor(
                evaluables.filter(p => !esArrastre(p)),
                p => obtenerSprintActualNombre(p) || 'Sin sprint'
            );
            const arrastres = contarPor(
                evaluables.filter(esArrastre),
                p => obtenerSprintActualNombre(p) || 'Sin sprint'
            );
            // Orden cronológico real por periodo (año + mes).
            // Las claves de la gráfica ya incluyen año, por ejemplo "SEPTIEMBRE 2026",
            // por eso no debemos compararlas contra sólo s.nombre.
            const ordenCatalogo = (cats.sprints || [])
                .map(s => etiquetaSprintPMO(s))
                .filter(Boolean);
            const presentes = [...new Set([...Object.keys(propios), ...Object.keys(arrastres)])];
            const ordenMes = new Map(ORDEN_SPRINTS_PMO.map((m, i) => [normalizarTexto(m), i + 1]));
            const clavePeriodo = etiqueta => {
                const texto = String(etiqueta || '').trim();
                const matchAnio = texto.match(/\b(20\d{2})\b/);
                const anio = matchAnio ? Number(matchAnio[1]) : 9999;
                const nombreMes = normalizarTexto(texto.replace(/\b20\d{2}\b/g, '').trim());
                const mes = ordenMes.get(nombreMes) || 99;
                return [anio, mes, texto];
            };
            const labels = presentes.sort((a, b) => {
                const ka = clavePeriodo(a), kb = clavePeriodo(b);
                return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2], 'es');
            });

            chartsEjecutivos['chart-sprints'] = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: { labels, datasets: [
                    { label:'Propios del Sprint', data:labels.map(n=>propios[n]||0), backgroundColor:'rgba(37, 99, 235, 0.72)', borderColor:'rgba(37, 99, 235, 1)', borderWidth:1.5, borderRadius:5 },
                    { label:'Arrastres recibidos', data:labels.map(n=>arrastres[n]||0), backgroundColor:'rgba(139, 92, 246, 0.72)', borderColor:'rgba(139, 92, 246, 1)', borderWidth:1.5, borderRadius:5 }
                ]},
                options: {
                    responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
                    plugins:{
                        legend:{display:true,position:'bottom',labels:{boxWidth:12,font:{size:11,weight:'600'}}},
                        tooltip:{callbacks:{footer(items){
                            if(!items?.length) return '';
                            const propiosN=Number(items.find(i=>i.dataset.label==='Propios del Sprint')?.raw||0);
                            const arr=Number(items.find(i=>i.dataset.label==='Arrastres recibidos')?.raw||0);
                            return `Carga total del Sprint: ${propiosN+arr}`;
                        }}}
                    },
                    scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{ticks:{font:{size:11}}}}
                }
            });
        }

        function crearOActualizarGraficaUrgentesSprint(proyectos) {
            const canvas = document.getElementById('chart-urgentes-sprint');
            if (!canvas || typeof Chart === 'undefined') return;

            if (chartsEjecutivos['chart-urgentes-sprint']) {
                chartsEjecutivos['chart-urgentes-sprint'].destroy();
            }

            const evaluables = (proyectos || []).filter(p => !esCanceladoDashboard(p));
            const urgentes = evaluables.filter(esUrgentePMO);

            const conteo = contarPor(
                urgentes,
                p => obtenerSprintActualNombre(p) || 'Sin sprint'
            );

            const ordenCatalogo = (cats.sprints || []).map(s => s.nombre);
            const extras = Object.keys(conteo).filter(n => !ordenCatalogo.includes(n));
            const labels = [
                ...ordenCatalogo.filter(n => conteo[n]),
                ...extras
            ];

            chartsEjecutivos['chart-urgentes-sprint'] = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Urgentes',
                        data: labels.map(n => conteo[n] || 0),
                        backgroundColor: 'rgba(249, 115, 22, 0.72)',
                        borderColor: 'rgba(249, 115, 22, 1)',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label(ctx) {
                                    const n = Number(ctx.raw || 0);
                                    return `${n} requerimiento${n === 1 ? '' : 's'} urgente${n === 1 ? '' : 's'}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        },
                        x: {
                            ticks: { font: { size: 11 } }
                        }
                    }
                }
            });
        }

        function obtenerSerieLiberacionesOrdenada(proyectos) {
            const conteo = {};
            (proyectos || []).forEach(p => {
                if (!p.fecha_liberacion_prod) return;
                const fecha = String(p.fecha_liberacion_prod).slice(0, 10);
                const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (!match) return;
                const clave = `${match[1]}-${match[2]}`;
                conteo[clave] = (conteo[clave] || 0) + 1;
            });
            const claves = Object.keys(conteo).sort();
            const labels = claves.map(clave => {
                const [anio, mes] = clave.split('-').map(Number);
                return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
            });
            return { labels, valores: claves.map(k => conteo[k]), claves };
        }


        function cerrarDetalleDashboard() {
            document.getElementById('modal-detalle-dashboard')?.classList.add('hidden');
        }

        function abrirModalDetalleDashboard(titulo, subtitulo, contenidoHtml) {
            const modal = document.getElementById('modal-detalle-dashboard');
            const tituloEl = document.getElementById('detalle-dashboard-titulo');
            const subtituloEl = document.getElementById('detalle-dashboard-subtitulo');
            const body = document.getElementById('detalle-dashboard-body');
            if (!modal || !body) return;
            if (tituloEl) tituloEl.textContent = titulo || 'Detalle';
            if (subtituloEl) subtituloEl.textContent = subtitulo || '';
            body.innerHTML = contenidoHtml || '';
            modal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }

        function obtenerArrastresActivosDashboard(proyectos) {
            return (proyectos || []).filter(p => {
                if (esCanceladoDashboard(p) || esLiberadoDashboard(p)) return false;
                const origen = p?.sprint_id;
                const actual = obtenerSprintActualId(p);
                return origen && actual && String(origen) !== String(actual);
            });
        }

        function abrirDetalleArrastresDashboard() {
            const arrastres = obtenerArrastresActivosDashboard(proyectosDashboardActuales);
            const sistemaNombre = document.getElementById('filtro-sistema-dashboard')?.selectedOptions?.[0]?.textContent || 'Todos los sistemas';

            if (!arrastres.length) {
                abrirModalDetalleDashboard(
                    'Arrastres actuales',
                    sistemaNombre,
                    '<div class="rounded-2xl bg-slate-50 border border-slate-100 p-8 text-center text-sm text-slate-500">No hay RQM activos provenientes de Sprints anteriores.</div>'
                );
                return;
            }

            const filas = arrastres
                .sort((a,b) => String(a.id_req || '').localeCompare(String(b.id_req || ''), 'es', { numeric:true }))
                .map(p => `
                    <tr class="border-b border-slate-100 last:border-0">
                        <td class="px-4 py-3 whitespace-nowrap font-black text-blue-700">${escaparHtmlPMO(p.id_req || '—')}</td>
                        <td class="px-4 py-3 min-w-[280px] font-bold text-slate-800">${escaparHtmlPMO(p.nombre_rqm || '—')}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-slate-600">${escaparHtmlPMO(p.cat_sprints ? etiquetaSprintPMO(p.cat_sprints) : 'Sin sprint')}</td>
                        <td class="px-4 py-3 whitespace-nowrap font-bold text-indigo-700">${escaparHtmlPMO(obtenerSprintActualNombre(p) || 'Sin sprint')}</td>
                        <td class="px-4 py-3 whitespace-nowrap"><span class="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">${escaparHtmlPMO(p.estatus || 'Backlog')}</span></td>
                    </tr>`).join('');

            abrirModalDetalleDashboard(
                `Arrastres actuales · ${arrastres.length}`,
                `${sistemaNombre} · Consulta informativa de arrastres activos`,
                `<div class="overflow-x-auto rounded-2xl border border-slate-200">
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th class="text-left px-4 py-3">RQM</th>
                                <th class="text-left px-4 py-3">Requerimiento</th>
                                <th class="text-left px-4 py-3">Sprint origen</th>
                                <th class="text-left px-4 py-3">Sprint actual</th>
                                <th class="text-left px-4 py-3">Estatus</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>`
            );
        }

        function abrirDetalleLiberacionesMesDashboard(claveMes, etiquetaMes) {
            const proyectos = (proyectosDashboardActuales || []).filter(p => {
                if (!p.fecha_liberacion_prod) return false;
                return String(p.fecha_liberacion_prod).slice(0,7) === String(claveMes || '');
            }).sort((a,b) => String(a.fecha_liberacion_prod || '').localeCompare(String(b.fecha_liberacion_prod || '')));

            const sistemaNombre = document.getElementById('filtro-sistema-dashboard')?.selectedOptions?.[0]?.textContent || 'Todos los sistemas';

            if (!proyectos.length) {
                abrirModalDetalleDashboard(
                    `Liberaciones · ${etiquetaMes || claveMes}`,
                    sistemaNombre,
                    '<div class="rounded-2xl bg-slate-50 border border-slate-100 p-8 text-center text-sm text-slate-500">No hay liberaciones registradas para este periodo.</div>'
                );
                return;
            }

            const filas = proyectos.map(p => `
                <tr class="border-b border-slate-100 last:border-0">
                    <td class="px-4 py-3 whitespace-nowrap font-black text-blue-700">${escaparHtmlPMO(p.id_req || '—')}</td>
                    <td class="px-4 py-3 min-w-[320px] font-bold text-slate-800">${escaparHtmlPMO(p.nombre_rqm || '—')}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-slate-600">${escaparHtmlPMO(p.cat_sistemas?.nombre || 'Sin sistema')}</td>
                    <td class="px-4 py-3 whitespace-nowrap font-bold text-emerald-700">${formatearFechaVista(String(p.fecha_liberacion_prod || '').slice(0,10))}</td>
                </tr>`).join('');

            abrirModalDetalleDashboard(
                `Liberaciones · ${etiquetaMes || claveMes}`,
                `${proyectos.length} RQM liberado${proyectos.length === 1 ? '' : 's'} · ${sistemaNombre}`,
                `<div class="overflow-x-auto rounded-2xl border border-slate-200">
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th class="text-left px-4 py-3">RQM</th>
                                <th class="text-left px-4 py-3">Requerimiento</th>
                                <th class="text-left px-4 py-3">Sistema</th>
                                <th class="text-left px-4 py-3">Liberación</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>`
            );
        }

        function abrirDetalleIngresosMesDashboard(claveMes, etiquetaMes) {
            const proyectos = (proyectosDashboardActuales || []).filter(p => {
                if (!p.fecha_ingreso_pmo) return false;
                return String(p.fecha_ingreso_pmo).slice(0,7) === String(claveMes || '');
            }).sort((a,b) => String(a.fecha_ingreso_pmo || '').localeCompare(String(b.fecha_ingreso_pmo || '')));

            const sistemaNombre = document.getElementById('filtro-sistema-dashboard')?.selectedOptions?.[0]?.textContent || 'Todos los sistemas';

            if (!proyectos.length) {
                abrirModalDetalleDashboard(
                    `Ingresos · ${etiquetaMes || claveMes}`,
                    sistemaNombre,
                    '<div class="rounded-2xl bg-slate-50 border border-slate-100 p-8 text-center text-sm text-slate-500">No hay requerimientos ingresados para este periodo.</div>'
                );
                return;
            }

            const filas = proyectos.map(p => `
                <tr class="border-b border-slate-100 last:border-0">
                    <td class="px-4 py-3 whitespace-nowrap font-black text-blue-700">${escaparHtmlPMO(p.id_req || '—')}</td>
                    <td class="px-4 py-3 min-w-[320px] font-bold text-slate-800">${escaparHtmlPMO(p.nombre_rqm || '—')}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-slate-600">${escaparHtmlPMO(p.cat_sistemas?.nombre || 'Sin sistema')}</td>
                    <td class="px-4 py-3 whitespace-nowrap font-bold text-blue-700">${formatearFechaVista(String(p.fecha_ingreso_pmo || '').slice(0,10))}</td>
                </tr>`).join('');

            abrirModalDetalleDashboard(
                `Ingresos · ${etiquetaMes || claveMes}`,
                `${proyectos.length} RQM ingresado${proyectos.length === 1 ? '' : 's'} · ${sistemaNombre}`,
                `<div class="overflow-x-auto rounded-2xl border border-slate-200">
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th class="text-left px-4 py-3">RQM</th>
                                <th class="text-left px-4 py-3">Requerimiento</th>
                                <th class="text-left px-4 py-3">Sistema</th>
                                <th class="text-left px-4 py-3">Ingreso PMO</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>`
            );
        }

        function obtenerSerieIngresosOrdenada(proyectos) {
            const meses = new Map();
            (proyectos || []).forEach(p => {
                // En PMO, fecha_ingreso_pmo corresponde a la Fecha de asignación de folio del buzón.
                const match = String(p?.fecha_ingreso_pmo || '').match(/^(20\d{2})-(\d{2})/);
                if (!match) return;
                const clave = `${match[1]}-${match[2]}`;
                meses.set(clave, (meses.get(clave) || 0) + 1);
            });

            const presentes = [...meses.keys()].sort();
            const claves = [];
            if (presentes.length) {
                let [anio, mes] = presentes[0].split('-').map(Number);
                const [anioFin, mesFin] = presentes[presentes.length - 1].split('-').map(Number);
                while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
                    claves.push(`${anio}-${String(mes).padStart(2, '0')}`);
                    mes += 1;
                    if (mes === 13) { mes = 1; anio += 1; }
                }
            }

            const nombresMes = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
            return {
                claves,
                labels: claves.map(k => {
                    const [anio, mes] = k.split('-');
                    return `${nombresMes[Number(mes) - 1] || mes} ${anio}`;
                }),
                valores: claves.map(k => meses.get(k) || 0)
            };
        }

        function crearGraficaIngresosDashboard(proyectos) {
            const canvas = document.getElementById('chart-ingresos');
            if (!canvas || typeof Chart === 'undefined') return;
            if (chartsEjecutivos['chart-ingresos']) chartsEjecutivos['chart-ingresos'].destroy();

            const serie = obtenerSerieIngresosOrdenada(proyectos);
            chartsEjecutivos['chart-ingresos'] = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: serie.labels,
                    datasets: [{
                        label: 'Ingresos',
                        data: serie.valores,
                        backgroundColor: 'rgba(37, 99, 235, 0.72)',
                        borderColor: 'rgba(37, 99, 235, 1)',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 48
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    onHover: (event, elementos) => {
                        event.native.target.style.cursor = elementos.length ? 'pointer' : 'default';
                    },
                    onClick: (event, elementos) => {
                        if (!elementos?.length) return;
                        const indice = elementos[0].index;
                        abrirDetalleIngresosMesDashboard(serie.claves[indice], serie.labels[indice]);
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${ctx.raw} requerimiento${Number(ctx.raw) === 1 ? '' : 's'}`,
                                afterLabel: () => 'Clic para consultar los RQM'
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                        x: { ticks: { font: { size: 11 } } }
                    }
                }
            });
        }

        function crearGraficaLiberacionesDashboard(proyectos) {
            const canvas = document.getElementById('chart-liberaciones');
            if (!canvas || typeof Chart === 'undefined') return;
            if (chartsEjecutivos['chart-liberaciones']) chartsEjecutivos['chart-liberaciones'].destroy();

            const serie = obtenerSerieLiberacionesOrdenada(proyectos);
            chartsEjecutivos['chart-liberaciones'] = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: serie.labels,
                    datasets: [{
                        label: 'Liberados',
                        data: serie.valores,
                        backgroundColor: 'rgba(37, 99, 235, 0.18)',
                        borderColor: 'rgba(37, 99, 235, 1)',
                        borderWidth: 2,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    onHover: (event, elementos) => {
                        event.native.target.style.cursor = elementos.length ? 'pointer' : 'default';
                    },
                    onClick: (event, elementos) => {
                        if (!elementos?.length) return;
                        const indice = elementos[0].index;
                        abrirDetalleLiberacionesMesDashboard(serie.claves[indice], serie.labels[indice]);
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                afterLabel: () => 'Clic para consultar los RQM'
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                        x: { ticks: { font: { size: 11 } } }
                    }
                }
            });
        }

        window.cerrarDetalleDashboard = cerrarDetalleDashboard;
        window.abrirDetalleArrastresDashboard = abrirDetalleArrastresDashboard;
        window.abrirDetalleIngresosMesDashboard = abrirDetalleIngresosMesDashboard;
        window.abrirDetalleLiberacionesMesDashboard = abrirDetalleLiberacionesMesDashboard;

        function renderizarDashboardEjecutivo(proyectos) {
            const existeDashboard = document.getElementById('dashboard-ejecutivo') || document.getElementById('kpis-ejecutivos');
            if (!existeDashboard) return;

            proyectosDashboardActuales = proyectos || [];
            const filtroSistemaDashboard = document.getElementById('filtro-sistema-dashboard');
            const sistemaNombre = filtroSistemaDashboard?.selectedOptions?.[0]?.textContent || 'Todos los sistemas';
            const subtitulo = document.getElementById('dashboard-sistema-subtitulo');
            if (subtitulo) {
                subtitulo.textContent = `Resumen de tiempos y distribución de requerimientos · ${sistemaNombre}.`;
            }

            renderizarKpisEjecutivos(proyectosDashboardActuales);
            renderizarResumenAdendumsDashboard();

            crearGraficaEstatusDashboard(proyectosDashboardActuales);

            const porSistema = contarPor(proyectosDashboardActuales, p => p.cat_sistemas?.nombre || 'Sin sistema');
            crearOActualizarGrafica('chart-sistemas', 'bar', Object.keys(porSistema), Object.values(porSistema), 'Requerimientos');

            crearOActualizarGraficaSprintsComparativa(proyectosDashboardActuales);
            crearOActualizarGraficaUrgentesSprint(proyectosDashboardActuales);

            crearGraficaIngresosDashboard(proyectosDashboardActuales);
            crearGraficaLiberacionesDashboard(proyectosDashboardActuales);

            lucide.createIcons();
        }

        function filtrarDashboardPorSistema() {
            const filtro = document.getElementById('filtro-sistema-dashboard');
            const sistemaId = filtro?.value || '';
            const proyectos = !sistemaId
                ? todosLosProyectos
                : todosLosProyectos.filter(p => String(p.sistema_id || '') === String(sistemaId));
            renderizarDashboardEjecutivo(proyectos);
        }
        window.filtrarDashboardPorSistema = filtrarDashboardPorSistema;

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
                    (p.cat_sprints ? etiquetaSprintPMO(p.cat_sprints) : '').toLowerCase().includes(texto) ||
                    (obtenerSprintActualNombre(p) || '').toLowerCase().includes(texto) ||
                    (p.cat_clasificaciones?.nombre || '').toLowerCase().includes(texto);

                const coincideEstatus =
                    !estatusSeleccionado ||
                    estatusProyecto === estatusSeleccionado;

                const coincideSistema =
                    !sistemaSeleccionado ||
                    String(p.sistema_id || '') === String(sistemaSeleccionado);

                // El filtro operativo usa Sprint actual. Así, AGOSTO incluye
                // requerimientos propios de AGOSTO + arrastres recibidos de meses anteriores.
                const coincideSprint =
                    !sprintSeleccionado ||
                    String(obtenerSprintActualId(p) || '') === String(sprintSeleccionado);

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
                "Sprint de origen": p.cat_sprints?.nombre || '',
                "Sprint actual": obtenerSprintActualNombre(p) || '',
                "Urgente / Fuera de planeación": esUrgentePMO(p) ? 'Sí' : 'No',
                "Sistema": p.cat_sistemas?.nombre || '',
                "Prioridad": p.prioridad || '',
                "Clasificación": p.cat_clasificaciones?.nombre || '',
                "Responsable Sistemas": p.responsable_sistemas || '',
                "Asignado A": p.asignado_a || '',
                "Área Solicitante": p.cat_areas?.nombre || '',
                "Solicitante": p.solicitante || '',
                "Estatus": p.estatus || '',
                "Ingreso RQM": p.fecha_ingreso_pmo || '',
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
                    (p.cat_sprints ? etiquetaSprintPMO(p.cat_sprints) : '').toLowerCase().includes(texto) ||
                    (obtenerSprintActualNombre(p) || '').toLowerCase().includes(texto) ||
                    (p.cat_clasificaciones?.nombre || '').toLowerCase().includes(texto);
                const coincideEstatus = !estatusSeleccionado || estatusProyecto === estatusSeleccionado;
                const coincideSistema = !sistemaSeleccionado || String(p.sistema_id || '') === String(sistemaSeleccionado);
                const coincideSprint = !sprintSeleccionado || String(obtenerSprintActualId(p) || '') === String(sprintSeleccionado);
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
            const conteoSprint = contarPorCampo(proyectos, p => obtenerSprintActualNombre(p) || 'Sin sprint');
            const liberadosSemana = proyectos.filter(p => ['LIBERADO', 'PRODUCCIÓN', 'PRODUCCION'].includes(normalizarTexto(p.estatus || ''))).slice(0, 8).map(p => `<tr><td>${p.id_req || '—'}</td><td>${p.nombre_rqm || 'Sin nombre'}</td><td>${p.cat_sistemas?.nombre || '—'}</td><td>${formatearFechaVista(p.fecha_liberacion_prod)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted center">Sin requerimientos liberados en la vista actual.</td></tr>`;
            const riesgosHtml = riesgos.slice(0, 8).map(r => `<tr><td>${r.id_req}</td><td>${r.nombre}</td><td>${r.fase}</td><td><span class="pill danger">+${r.dias} día${r.dias === 1 ? '' : 's'}</span></td><td>${r.responsable}</td></tr>`).join('') || `<tr><td colspan="5" class="muted center">Sin desviaciones críticas registradas.</td></tr>`;
            const htmlReporte = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte GAP Semanal</title><style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#f8fafc}.page{width:1120px;margin:0 auto;background:#fff;min-height:100vh;padding:34px}.header{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:white;border-radius:24px;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start;box-shadow:0 16px 40px rgba(15,23,42,.18)}.brand{font-size:44px;font-weight:900;letter-spacing:-1px}.subtitle{margin-top:8px;color:rgba(255,255,255,.78);font-size:13px;font-weight:700}.report-title{text-align:right}.report-title h1{margin:0;font-size:25px;line-height:1.1}.report-title p{margin:10px 0 0;color:rgba(255,255,255,.75);font-size:12px;font-weight:700}.meta{margin:18px 0;display:flex;justify-content:space-between;gap:12px;color:#64748b;font-size:12px;font-weight:700}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0}.kpi{border:1px solid #e2e8f0;border-radius:20px;padding:18px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.06)}.kpi .label{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.7px;font-weight:900}.kpi .value{font-size:34px;font-weight:900;margin-top:8px;color:#0f172a}.kpi .detail{font-size:12px;color:#64748b;margin-top:4px;font-weight:700}.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;margin-top:18px}.card{border:1px solid #e2e8f0;border-radius:22px;padding:20px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.05);break-inside:avoid}.card h2{margin:0 0 4px;font-size:16px;font-weight:900}.card .desc{margin:0 0 18px;font-size:12px;color:#64748b;font-weight:700}.bar-row{display:grid;grid-template-columns:120px 1fr 36px;gap:10px;align-items:center;margin:10px 0;font-size:12px;font-weight:800}.bar-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#334155}.bar-track{height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden}.bar-fill{height:100%;background:linear-gradient(90deg,#2563eb,#06b6d4);border-radius:999px}.bar-value{text-align:right;color:#0f172a}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#0f2a6d;color:#fff;text-align:left;padding:10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px}td{padding:10px;border-bottom:1px solid #e2e8f0;color:#334155;font-weight:700}.pill{display:inline-block;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:900}.danger{background:#fee2e2;color:#be123c}.muted{color:#94a3b8;font-weight:700}.center{text-align:center}.summary{background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:18px;color:#1e3a8a;font-weight:800;line-height:1.55;font-size:13px}.footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:14px;color:#94a3b8;font-size:11px;font-weight:700;display:flex;justify-content:space-between}.actions{position:sticky;top:0;background:#f8fafc;padding:14px;display:flex;justify-content:center;gap:10px;z-index:10;border-bottom:1px solid #e2e8f0}.actions button{border:none;background:#2563eb;color:#fff;padding:10px 16px;border-radius:12px;font-weight:900;cursor:pointer}.actions button.secondary{background:#0f172a}@media print{body{background:white}.actions{display:none}.page{width:100%;padding:20px}.card,.kpi,.header{box-shadow:none}}
</style></head><body><div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button><button class="secondary" onclick="descargarHTML()">Descargar HTML</button></div><div class="page"><section class="header"><div><div class="brand">finsus</div><div class="subtitle">Finanzas Transparentes · Seguimiento GAP</div></div><div class="report-title"><h1>Reporte Ejecutivo GAP<br>Semanal</h1><p>${fecha}</p></div></section><div class="meta"><div>Vista aplicada: ${filtros}</div><div>Fuente: PMO Control</div></div><section class="kpis"><div class="kpi"><div class="label">Total requerimientos</div><div class="value">${total}</div><div class="detail">Portafolio vigente</div></div><div class="kpi"><div class="label">Liberados</div><div class="value">${liberados}</div><div class="detail">${total ? Math.round((liberados/total)*100) : 0}% del total</div></div><div class="kpi"><div class="label">Cumplimiento fechas</div><div class="value">${cumplimiento}%</div><div class="detail">${fasesEnTiempo}/${fasesMedidas} fases en tiempo</div></div><div class="kpi"><div class="label">Riesgos por desviación</div><div class="value">${riesgos.length}</div><div class="detail">Fases con atraso registrado</div></div></section><div class="grid"><section class="card"><h2>Resumen Ejecutivo</h2><p class="desc">Estado general del seguimiento operativo GAP.</p><div class="summary">Se reportan <b>${total}</b> requerimientos en la vista actual, con <b>${liberados}</b> liberados, <b>${enDesarrollo}</b> en desarrollo, <b>${enQA}</b> en QA, <b>${enUAT}</b> en UAT y <b>${cancelados}</b> cancelados. El cumplimiento de fechas medido es de <b>${cumplimiento}%</b>.</div></section><section class="card"><h2>Distribución por Estatus</h2><p class="desc">Carga actual del portafolio por etapa.</p>${barrasReporte(conteoEstatus)}</section></div><div class="grid"><section class="card"><h2>Distribución por Sistema</h2><p class="desc">Carga por aplicativo o plataforma.</p>${barrasReporte(conteoSistema)}</section><section class="card"><h2>Distribución por Sprint</h2><p class="desc">Volumen registrado por sprint.</p>${barrasReporte(conteoSprint)}</section></div><section class="card" style="margin-top:18px;"><h2>Requerimientos Liberados</h2><p class="desc">Últimos requerimientos liberados dentro de la vista actual.</p><table><thead><tr><th>ID Req</th><th>Proyecto</th><th>Sistema</th><th>Fecha Liberación</th></tr></thead><tbody>${liberadosSemana}</tbody></table></section><section class="card" style="margin-top:18px;"><h2>Riesgos y Desviaciones</h2><p class="desc">Fases con atraso respecto a la fecha compromiso.</p><table><thead><tr><th>ID Req</th><th>Proyecto</th><th>Fase</th><th>Desviación</th><th>Responsable</th></tr></thead><tbody>${riesgosHtml}</tbody></table></section><div class="footer"><span>PMO Control · Reporte generado automáticamente</span><span>GAP / Administración / QA / Desarrollo</span></div></div><script>function descargarHTML(){const contenido=document.documentElement.outerHTML;const blob=new Blob([contenido],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');const fechaArchivo=new Date().toISOString().slice(0,10);a.href=url;a.download='Reporte_GAP_Semanal_'+fechaArchivo+'.html';a.click();URL.revokeObjectURL(url);}</` + `script></body></html>`;
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

        function obtenerProyeccionTerminacionSeguimiento(proyectos = []) {
            const meses = {
                ENERO: 0, FEBRERO: 1, MARZO: 2, ABRIL: 3, MAYO: 4, JUNIO: 5,
                JULIO: 6, AGOSTO: 7, SEPTIEMBRE: 8, SETIEMBRE: 8, OCTUBRE: 9,
                NOVIEMBRE: 10, DICIEMBRE: 11
            };
            const pendientes = proyectosConsideradosAvanceSeguimiento(proyectos)
                .filter(p => estatusOperativoSeguimiento(p?.estatus || '') !== 'LIBERADO');

            if (!pendientes.length) {
                return { valor: 'COMPLETO', detalle: 'Portafolio liberado' };
            }

            let ultimo = null;
            let sinPlaneacion = 0;
            pendientes.forEach(p => {
                const nombre = String(obtenerSprintActualNombre(p) || '').trim();
                const normalizado = normalizarTexto(nombre);
                const mesEncontrado = Object.keys(meses).find(m => normalizado.includes(m));
                if (!mesEncontrado) {
                    sinPlaneacion += 1;
                    return;
                }
                const coincidenciaAnio = normalizado.match(/\b(20\d{2})\b/);
                const anio = coincidenciaAnio ? Number(coincidenciaAnio[1]) : new Date().getFullYear();
                const orden = anio * 12 + meses[mesEncontrado];
                if (!ultimo || orden > ultimo.orden) {
                    ultimo = { orden, valor: mesEncontrado === 'SETIEMBRE' ? 'SEPTIEMBRE' : mesEncontrado };
                }
            });

            if (!ultimo) {
                return { valor: 'POR DEFINIR', detalle: `${pendientes.length} RQM sin planeación` };
            }
            const detalle = sinPlaneacion > 0
                ? `${sinPlaneacion} RQM sin planeación`
                : 'Terminación estimada';
            return { valor: ultimo.valor, detalle };
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

        function obtenerMetricasSeguimientoProyecto(p) {
            if (!window.PMOMetrics) return null;
            return PMOMetrics.metricasProyecto(p, contextoMetricasPMO());
        }

        function calcularMaxDesviacionProyecto(p) {
            const metricas = obtenerMetricasSeguimientoProyecto(p);
            if (metricas) {
                const valores = metricas.fases
                    .filter(f => !f.ajusteAdministrativo && Number.isFinite(f.desviacion))
                    .map(f => f.desviacion);
                return valores.length ? Math.max(...valores) : null;
            }

            const vals = [];
            if (!tieneAjusteAdministrativo(p.id, 'Fin Desarrollo')) vals.push(obtenerDesviacionDias(p.fecha_desarrollo, p.fecha_fin_desarrollo));
            if (!tieneAjusteAdministrativo(p.id, 'Fin QA')) vals.push(obtenerDesviacionDias(p.fecha_qa, p.fecha_fin_qa));
            if (!tieneAjusteAdministrativo(p.id, 'Fin UAT')) vals.push(obtenerDesviacionDias(p.fecha_uat, p.fecha_fin_uat));
            const filtrados = vals.filter(v => typeof v === 'number');
            return filtrados.length ? Math.max(...filtrados) : null;
        }

        function contarAtrasosRealesProyecto(p) {
            const metricas = obtenerMetricasSeguimientoProyecto(p);
            if (metricas) return metricas.fasesAtrasadas.length;

            const atrasos = [];
            if (!tieneAjusteAdministrativo(p.id, 'Fin Desarrollo')) atrasos.push(calcularAtrasoReal(p.fecha_desarrollo, p.fecha_fin_desarrollo));
            if (!tieneAjusteAdministrativo(p.id, 'Fin QA')) atrasos.push(calcularAtrasoReal(p.fecha_qa, p.fecha_fin_qa));
            if (!tieneAjusteAdministrativo(p.id, 'Fin UAT')) atrasos.push(calcularAtrasoReal(p.fecha_uat, p.fecha_fin_uat));
            return atrasos.filter(Boolean).length;
        }

        function calcularMaxAtrasoProyecto(p) {
            const metricas = obtenerMetricasSeguimientoProyecto(p);
            if (metricas) return metricas.maxAtraso || 0;
            const atrasos = [];
            if (!tieneAjusteAdministrativo(p.id, 'Fin Desarrollo')) atrasos.push(calcularAtrasoReal(p.fecha_desarrollo, p.fecha_fin_desarrollo));
            if (!tieneAjusteAdministrativo(p.id, 'Fin QA')) atrasos.push(calcularAtrasoReal(p.fecha_qa, p.fecha_fin_qa));
            if (!tieneAjusteAdministrativo(p.id, 'Fin UAT')) atrasos.push(calcularAtrasoReal(p.fecha_uat, p.fecha_fin_uat));
            const dias = atrasos.map(v => Number.parseInt(v, 10)).filter(Number.isFinite);
            return dias.length ? Math.max(...dias) : 0;
        }

        function estadoSemaforoProyecto(p) {
            const metricas = obtenerMetricasSeguimientoProyecto(p);
            const reprogramaciones = metricas ? metricas.reprogramaciones : contarReprogramacionesProyecto(p.id);
            const atrasoDias = metricas ? metricas.maxAtraso : calcularMaxAtrasoProyecto(p);
            const desviacion = calcularMaxDesviacionProyecto(p);

            if (metricas?.cancelado) return { texto: 'Cancelado', clase: 'bg-slate-100 text-slate-600 border-slate-200', icono: '⚪' };
            if (atrasoDias > 0) return { texto: `Atraso ${atrasoDias}d`, clase: 'bg-rose-50 text-rose-700 border-rose-100', icono: '🔴' };
            if (reprogramaciones > 0) return { texto: 'Reprogramado', clase: 'bg-amber-50 text-amber-700 border-amber-100', icono: '🟡' };
            if (desviacion !== null && desviacion > 0) return { texto: 'Con desviación', clase: 'bg-orange-50 text-orange-700 border-orange-100', icono: '🟠' };
            if (metricas?.proximas?.length) return { texto: 'Próximo a vencer', clase: 'bg-cyan-50 text-cyan-700 border-cyan-100', icono: '🔵' };
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
            if (obtenerVistaPortafolioSeleccionada() === 'sprint') {
                return proyectosFiltrados;
            }

            // En "Portafolio general" la dona conserva la vista global respecto al Sprint,
            // pero debe respetar los filtros maestros de Estatus y Sistema del encabezado.
            const estatus = document.getElementById('seguimiento-filtro-estatus')?.value || '';
            const sistema = document.getElementById('seguimiento-filtro-sistema')?.value || '';

            return (todosLosProyectos || []).filter(p => {
                const okEstatus = !estatus || normalizarTexto(p.estatus || 'BACKLOG') === estatus;
                const okSistema = !sistema || String(p.sistema_id || '') === String(sistema);
                return okEstatus && okSistema;
            });
        }

        function actualizarTextosVistaPortafolio(proyectosDona) {
            const vista = obtenerVistaPortafolioSeleccionada();
            const titulo = document.getElementById('titulo-distribucion-portafolio');
            if (vista === 'sprint') {
                const sprint = obtenerNombreSprintSeleccionado();
                if (titulo) titulo.textContent = `Distribución del Sprint - ${sprint}`;
            } else if (titulo) {
                titulo.textContent = 'Distribución general del portafolio';
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
            const avance = calcularAvanceEstatusSeguimiento(p.estatus || 'BACKLOG');
            const metrica = window.PMOMetrics
                ? PMOMetrics.metricasProyecto(p, contextoMetricasPMO())
                : null;

            const salud = metrica?.salud || 'VERDE';
            const color = salud === 'ROJO' ? 'red' : salud === 'AMARILLO' ? 'yellow' : salud === 'NEUTRO' ? 'neutral' : 'green';
            const badgeClase = salud === 'ROJO'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : salud === 'AMARILLO'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : salud === 'NEUTRO'
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
            const icono = salud === 'ROJO' ? '🔴' : salud === 'AMARILLO' ? '🟡' : salud === 'NEUTRO' ? '⚪' : '🟢';

            const atraso = metrica?.maxAtraso || 0;
            const desviacion = metrica?.maxDesviacion || 0;
            const anticipacion = metrica?.maxAnticipacion || 0;
            const tieneFaseCerrada = Boolean(metrica?.fases?.some(f => f.fin));
            const desviacionTexto = !tieneFaseCerrada
                ? '—'
                : desviacion > 0
                    ? `+${desviacion} d`
                    : anticipacion > 0
                        ? `${anticipacion} d antes`
                        : '0 d';
            const atrasoTexto = atraso > 0 ? `${atraso} d` : '—';
            const estadoActual = metrica?.motivoSalud || 'En tiempo';

            const nombreSeguroJs = String(p.nombre_rqm || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const codigoSeguroJs = String(p.id_req || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            return `
                <article class="pmo-follow-card">
                    <div class="pmo-follow-accent ${color}"></div>
                    <div class="p-5">
                        <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-[11px] font-black bg-slate-950 text-white px-3 py-1.5 rounded-full">${p.id_req || 'SIN ID'}</span>
                                    <span class="text-[11px] font-black px-3 py-1.5 rounded-full border ${badgeClase}">${icono} ${escaparHtmlPMO(estadoActual)}</span>
                                </div>
                                <button type="button" onclick="abrirModalEditar('${p.id}')" class="block text-left mt-3 cursor-pointer group/seguimiento-rqm" title="Abrir y modificar requerimiento">
                                    <h4 class="text-lg font-black text-slate-950 group-hover/seguimiento-rqm:text-blue-700 transition-colors">${escaparHtmlPMO(p.nombre_rqm || 'Sin nombre')}</h4>
                                </button>
                                <p class="text-xs text-slate-500 mt-1">${escaparHtmlPMO(p.cat_sistemas?.nombre || 'Sin sistema')} · ${renderSprintOrigenActual(p)}</p>
                                <div class="flex gap-2 flex-wrap mt-3 text-[10px] font-black uppercase tracking-wide">
                                    <span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">${escaparHtmlPMO(p.estatus || 'BACKLOG')}</span>
                                    ${badgeUrgentePMO(p)}
                                    ${metrica?.reprogramaciones ? `
                                        <button type="button"
                                            onclick="verHistorial('${p.id}', '${nombreSeguroJs}', '${codigoSeguroJs}')"
                                            title="Ver registro de cambios"
                                            class="bg-violet-50 text-violet-700 hover:bg-violet-100 px-2.5 py-1 rounded-full cursor-pointer transition">
                                            ${metrica.reprogramaciones} reprogramación${metrica.reprogramaciones===1?'':'es'}
                                        </button>` : ''}
                                </div>
                            </div>
                            <div class="flex gap-2 flex-wrap xl:justify-end">
                                <div class="pmo-metric-state"><div class="label">Avance</div><div class="value text-blue-700">${avance}%</div></div>
                                <div class="pmo-metric-state"><div class="label">Desv.</div><div class="value ${desviacion>0?'text-rose-600':'text-emerald-600'}">${desviacionTexto}</div></div>
                                <div class="pmo-metric-state"><div class="label">Atraso</div><div class="value ${atraso>0?'text-rose-600':'text-slate-500'}">${atrasoTexto}</div></div>
                            </div>
                        </div>
                        ${renderizarLineaFases(p)}
                    </div>
                </article>`;
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
                if (window.PMOImageCopied) PMOImageCopied();
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
            const sistema = document.getElementById('seguimiento-filtro-sistema');

            if (sprint) {
                sprint.innerHTML = '<option class="text-slate-800" value="">Todos los sprints</option>' +
                    (cats.sprints || []).map(s => `<option class="text-slate-800" value="${s.id}">${etiquetaSprintPMO(s)}</option>`).join('');
            }

            if (estatus) {
                estatus.innerHTML = '<option class="text-slate-800" value="">Todos los estatus</option>' +
                    (cats.estatus || []).map(e => `<option class="text-slate-800" value="${normalizarTexto(e.nombre)}">${e.nombre.toUpperCase()}</option>`).join('');
            }

            if (sistema) {
                sistema.innerHTML = '<option class="text-slate-800" value="">Todos los sistemas</option>' +
                    (cats.sistemas || []).map(s => `<option class="text-slate-800" value="${s.id}">${escaparHtmlPMO(s.nombre)}</option>`).join('');
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
            const sistema = document.getElementById('seguimiento-filtro-sistema')?.value || '';

            const filtrados = (todosLosProyectos || []).filter(p => {
                const okSprint = !sprint || String(obtenerSprintActualId(p) || '') === String(sprint);
                const okEstatus = !estatus || normalizarTexto(p.estatus || 'BACKLOG') === estatus;
                const okSistema = !sistema || String(p.sistema_id || '') === String(sistema);
                return okSprint && okEstatus && okSistema;
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

            const resumenSeguimiento = window.PMOMetrics ? PMOMetrics.resumen(proyectos, contextoMetricasPMO()) : null;
            const total = proyectos.length;
            const liberados = resumenSeguimiento ? resumenSeguimiento.liberados : proyectos.filter(p => ['LIBERADO', 'PRODUCCIÓN', 'PRODUCCION'].includes(normalizarTexto(p.estatus))).length;
            const reprogramados = resumenSeguimiento ? resumenSeguimiento.proyectosReprogramados : proyectos.filter(p => contarReprogramacionesProyecto(p.id) > 0).length;
            const atrasados = resumenSeguimiento ? resumenSeguimiento.requerimientosAtrasados : proyectos.filter(p => contarAtrasosRealesProyecto(p) > 0).length;
            const enQa = proyectos.filter(p => normalizarTexto(p.estatus) === 'QA').length;
            const enUat = proyectos.filter(p => normalizarTexto(p.estatus) === 'UAT').length;

            const kpis = document.getElementById('seguimiento-kpis');
            if (kpis) {
                const considerados = proyectosConsideradosAvanceSeguimiento(proyectos);
                const faltantes = Math.max(0, considerados.length - liberados);
                const avanceTotal = calcularAvancePromedioSeguimiento(proyectos);
                const proyeccion = obtenerProyeccionTerminacionSeguimiento(proyectos);
                const fechaCorte = new Intl.DateTimeFormat('es-MX', { day:'2-digit', month:'long', year:'numeric' }).format(new Date());

                kpis.innerHTML = `
                    <div class="pmo-ytd-head">
                        <h3 class="pmo-ytd-title">Resumen YTD</h3>
                        <div class="pmo-ytd-actions no-export">
                            <button onclick="copiarSeccionImagen('seguimiento-kpis')" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition">
                                <i data-lucide="copy" class="w-4 h-4"></i> Copiar
                            </button>
                            <button onclick="exportarSeccionImagen('seguimiento-kpis', 'resumen_ytd')" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition">
                                <i data-lucide="image-down" class="w-4 h-4"></i> Imagen
                            </button>
                        </div>
                    </div>
                    <div class="pmo-ytd-grid">
                        <div class="pmo-ytd-item"><div class="pmo-ytd-value">${total}</div><div class="pmo-ytd-label">Ingresos Totales</div></div>
                        <div class="pmo-ytd-item"><div class="pmo-ytd-value">${liberados}</div><div class="pmo-ytd-label">RQM Liberados</div></div>
                        <div class="pmo-ytd-item"><div class="pmo-ytd-value">${avanceTotal}%</div><div class="pmo-ytd-label">Avance Total</div></div>
                        <div class="pmo-ytd-item"><div class="pmo-ytd-value">${faltantes}</div><div class="pmo-ytd-label">RQM Faltantes</div></div>
                        <div class="pmo-ytd-item"><div class="pmo-ytd-value textual">${proyeccion.valor}</div><div class="pmo-ytd-label">Proyección de terminación</div></div>
                    </div>
                    <div class="pmo-ytd-footer pmo-ytd-footer-clean">
                        <span class="pmo-ytd-cut">Corte al ${fechaCorte}</span>
                    </div>
                `;
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
            listo: false,
            hoja: '',
            filaEncabezado: 1
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

        function normalizarClaveImport(valor) {
            return String(valor ?? '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, ' ')
                .trim()
                .toUpperCase();
        }

        function valorImport(row, ...alias) {
            const index = {};
            Object.entries(row || {}).forEach(([clave, valor]) => {
                index[normalizarClaveImport(clave)] = valor;
            });
            for (const nombre of alias) {
                const valor = index[normalizarClaveImport(nombre)];
                if (valor !== undefined && valor !== null && String(valor).trim() !== '') return valor;
            }
            return null;
        }

        function detectarFilaEncabezado(hoja) {
            const muestra = XLSX.utils.sheet_to_json(hoja, {
                header: 1,
                defval: null,
                raw: true,
                range: 0
            }).slice(0, 20);

            let mejorIndice = 0;
            let mejorPuntaje = -1;
            const clavesEsperadas = [
                ['ID REQ', 'NUMERO DE REQUERIMIENTO', 'NUMERO RQM'],
                ['NOMBRE RQM', 'NOMBRE DEL RQM', 'PROYECTO', 'REQUERIMIENTO'],
                ['SPRINT'],
                ['SISTEMA'],
                ['ESTATUS']
            ];

            muestra.forEach((fila, indice) => {
                const normalizadas = (fila || []).map(normalizarClaveImport);
                const puntaje = clavesEsperadas.reduce((total, grupo) => (
                    total + (grupo.some(alias => normalizadas.includes(normalizarClaveImport(alias))) ? 1 : 0)
                ), 0);
                if (puntaje > mejorPuntaje) {
                    mejorPuntaje = puntaje;
                    mejorIndice = indice;
                }
            });

            return mejorPuntaje >= 2 ? mejorIndice : 0;
        }

        function obtenerHojaImportacion(workbook) {
            const preferidas = ['IMPORT_PMO_CONTROL', 'PMO CONTROL', 'MATRIZ DE PROYECTOS'];
            let nombre = preferidas.find(preferida =>
                workbook.SheetNames.some(real => normalizarClaveImport(real) === normalizarClaveImport(preferida))
            );
            if (nombre) nombre = workbook.SheetNames.find(real => normalizarClaveImport(real) === normalizarClaveImport(nombre));
            if (!nombre) nombre = workbook.SheetNames[0];

            const hoja = workbook.Sheets[nombre];
            const filaEncabezado = detectarFilaEncabezado(hoja);
            return { nombre, hoja, filaEncabezado };
        }

        function mapearDesdeImportPrep(row) {
            return {
                id_req: valorImport(row, 'id_req', 'ID REQ', 'Número de requerimiento', 'Numero RQM', 'Folio/RQM'),
                nombre_rqm: valorImport(row, 'nombre_rqm', 'Nombre RQM', 'Nombre del RQM', 'Nombre', 'Proyecto', 'Requerimiento'),
                sprint: valorImport(row, 'sprint', 'Sprint'),
                sistema: valorImport(row, 'sistema', 'Sistema'),
                clasificacion: valorImport(row, 'clasificacion', 'Clasificación', 'Clasificacion', 'Tipo de requerimiento'),
                prioridad: valorImport(row, 'prioridad', 'Prioridad'),
                area: valorImport(row, 'area', 'Área', 'Area', 'Área Solicitante', 'Area Solicitante'),
                descripcion: valorImport(row, 'descripcion', 'Descripción', 'Descripcion', 'Descripción general'),
                solicitante: valorImport(row, 'solicitante', 'Solicitante', 'Nombre solicitante'),
                responsable_sistemas: valorImport(row, 'responsable_sistemas', 'Responsable Sistemas'),
                asignado_a: valorImport(row, 'asignado_a', 'Asignado A', 'Asignado a'),
                estatus: valorImport(row, 'estatus', 'Estatus', 'Estado'),
                fecha_ingreso_pmo: excelSerialADateString(valorImport(row, 'fecha_ingreso_pmo', 'Ingreso RQM', 'Fecha de ingreso RQM')),
                fecha_desarrollo: excelSerialADateString(valorImport(row, 'fecha_desarrollo_compromiso', 'Compromiso Desarrollo', 'Fecha de entrega de sistemas')),
                fecha_inicio_desarrollo: excelSerialADateString(valorImport(row, 'fecha_inicio_desarrollo', 'Inicio Desarrollo', 'Fecha de inicio de desarrollo')),
                fecha_fin_desarrollo: excelSerialADateString(valorImport(row, 'fecha_fin_desarrollo', 'Fin Desarrollo', 'Nueva fecha compromiso')),
                fecha_qa: excelSerialADateString(valorImport(row, 'fecha_qa_compromiso', 'Compromiso QA', 'Fecha de salida pruebas QA')),
                fecha_inicio_qa: excelSerialADateString(valorImport(row, 'fecha_inicio_qa', 'Inicio QA', 'Fecha de entrada a pruebas QA')),
                fecha_fin_qa: excelSerialADateString(valorImport(row, 'fecha_fin_qa', 'Fin QA', 'Nueva fecha compromiso 1')),
                fecha_uat: excelSerialADateString(valorImport(row, 'fecha_uat_compromiso', 'Compromiso UAT', 'Fecha de salida pruebas UAT')),
                fecha_inicio_uat: excelSerialADateString(valorImport(row, 'fecha_inicio_uat', 'Inicio UAT', 'Fecha de entrada pruebas UAT')),
                fecha_fin_uat: excelSerialADateString(valorImport(row, 'fecha_fin_uat', 'Fin UAT', 'Nueva fecha compromiso 2')),
                fecha_liberacion_prod: excelSerialADateString(valorImport(row, 'fecha_liberacion_prod', 'Liberación Producción', 'Liberacion Produccion', 'Liberación Productiva')),
                comentarios: valorImport(row, 'comentarios', 'Comentarios')
            };
        }

        function mapearDesdeMatrizOriginal(row) {
            // Se conserva por compatibilidad, usando el mismo catálogo de alias.
            return mapearDesdeImportPrep(row);
        }

        function prepararRegistroImport(row, origen) {
            const base = mapearDesdeImportPrep(row);

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
                    raw: true,
                    range: seleccion.filaEncabezado
                });

                rows = rows.filter(r => {
                    const id = valorImport(r, 'id_req', 'ID REQ', 'Número de requerimiento', 'Numero RQM', 'Folio/RQM');
                    const nombre = valorImport(r, 'nombre_rqm', 'Nombre RQM', 'Nombre del RQM', 'Nombre', 'Proyecto', 'Requerimiento');
                    return id || nombre;
                });

                const preparados = rows.map(r => prepararRegistroImport(r, seleccion.nombre));
                const validados = preparados.map(validarRegistroImport);

                importacionPMO.registros = validados;
                importacionPMO.errores = validados.filter(r => !r.valido);
                importacionPMO.listo = validados.length > 0 && importacionPMO.errores.length === 0;
                importacionPMO.hoja = seleccion.nombre;
                importacionPMO.filaEncabezado = seleccion.filaEncabezado + 1;

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
            document.getElementById('import-kpi-historial').textContent = importacionPMO.filaEncabezado ? `F${importacionPMO.filaEncabezado}` : '—';

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
                    sprint_actual_id: r.sprint_id,
                    tipo_incorporacion: 'PLANEADO',
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


        window.addEventListener('pmo:profile-ready', actualizarVisibilidadAjusteFechaPrivado);
        document.addEventListener('DOMContentLoaded', () => setTimeout(actualizarVisibilidadAjusteFechaPrivado, 0));
