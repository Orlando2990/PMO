// PMO Control - Panel HTML reutilizable
// Este archivo pinta el panel de requerimientos y modales en cualquier pantalla.
// Si necesitas mover columnas, cambiar labels o agregar campos visuales al panel,
// hazlo aquí una sola vez.

function renderizarPanelRequerimientos() {
    const contenedor = document.getElementById('pmo-panel-requerimientos');
    if (!contenedor) return;

    contenedor.innerHTML = String.raw`
        <!-- Vista ejecutiva estándar -->
        ${window.PMOLayout ? window.PMOLayout.renderExecutiveHero() : ''}

        <!-- Indicadores ejecutivos -->
        <section id="contenedor-contadores" class="pmo-summary-grid"></section>

        <!-- Tabla Principal -->
        <section class="pmo-panel-table bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div
                class="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50/50">
                <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full">
                    <div class="relative flex-1 max-w-md">
                        <i data-lucide="search"
                            class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <input type="text" id="input-buscar" oninput="filtrarProyectos()"
                            placeholder="Buscar requerimiento..."
                            class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-hidden">
                    </div>

                    <div class="relative w-full sm:w-64">
                        <i data-lucide="filter"
                            class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <select id="filtro-estatus" onchange="filtrarProyectos()"
                            class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-semibold text-slate-600 focus:outline-hidden">
                            <option value="">Todos los estatus</option>
                        </select>
                    </div>

                    <div class="relative w-full sm:w-64">
                        <i data-lucide="monitor"
                            class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <select id="filtro-sistema" onchange="filtrarProyectos()"
                            class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-semibold text-slate-600 focus:outline-hidden">
                            <option value="">Todos los sistemas</option>
                        </select>
                    </div>

                    <div class="relative w-full sm:w-64">
                        <i data-lucide="calendar-days"
                            class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <select id="filtro-sprint" onchange="filtrarProyectos()"
                            class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-semibold text-slate-600 focus:outline-hidden">
                            <option value="">Todos los sprints</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr
                            class="text-slate-400 text-xs uppercase font-bold tracking-wider border-b border-slate-100 bg-slate-50/20">
                            <th class="p-4 pl-6">Requerimiento</th>
                            <th class="p-4">Sprint / Sistema / Prioridad</th>
                            <th class="p-4">Avance</th>
                            <th class="p-4">Días / Desviación</th>
                            <th class="p-4">Estado</th>
                            <th class="p-4 pr-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-proyectos-body" class="text-sm divide-y divide-slate-100">
                        <tr>
                            <td colspan="6" class="p-8 text-center text-slate-400">Cargando...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderizarModalesRequerimientos() {
    const contenedor = document.getElementById('orbita-modales-requerimientos');
    if (!contenedor) return;

    contenedor.innerHTML = String.raw`
    <!-- MODAL FORMULARIO REQUERIMIENTO -->
    <div id="modal-proyecto"
        class="hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-center items-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-100">
            <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div class="flex items-center space-x-2.5">
                    <div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <i data-lucide="edit-3" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 id="modal-titulo" class="font-bold text-slate-900 text-base">Registrar Nuevo Requerimiento</h3>
                        <span id="badge-reprogramado-form" class="hidden mt-1 w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100"></span>
                    </div>
                </div>
                <button onclick="cerrarModal()" class="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>

            <form id="form-proyecto" onsubmit="procesarFormulario(event)"
                class="p-6 space-y-4 max-h-[75vh] overflow-y-auto overflow-x-hidden">
                <input type="hidden" id="form-id">

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">ID REQ</label>
                        <input type="text" id="form-id-req" required placeholder="Ej: RQM 00 02"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Nombre del RQM</label>
                        <input type="text" id="form-nombre-rqm" required
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Sprint (Catálogo)</label>
                        <select id="form-sprint"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Sistema (Catálogo)</label>
                        <select id="form-sistema"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Clasificación
                            (Catálogo)</label>
                        <select id="form-clasificacion"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></select>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Área Solicitante
                            (Catálogo)</label>
                        <select id="form-area"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Nombre Solicitante</label>
                        <input type="text" id="form-solicitante"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Responsable
                            Sistemas</label>
                        <input type="text" id="form-responsable-sistemas"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Asignado A</label>
                        <input type="text" id="form-asignado-a"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Prioridad</label>
                        <select id="form-prioridad"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                            <option value="BAJA">BAJA</option>
                            <option value="MEDIA">MEDIA</option>
                            <option value="ALTA">ALTA</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Estatus (Catálogo)</label>
                        <select id="form-estatus"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></select>
                    </div>
                    <div>
                        <label class="text-xs font-bold uppercase text-slate-400 block mb-1">Ingreso RQM a PMO</label>
                        <input type="date" id="form-fecha-ingreso"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Descripción del
                        Requerimiento</label>
                    <textarea id="form-descripcion" rows="2"
                        class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></textarea>
                </div>

                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        📅 Tracking completo de fases
                    </span>

                    <div class="grid grid-cols-1 gap-4 text-xs">
                        <div class="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Compromiso
                                    Desarrollo</label>
                                <input type="date" id="form-fecha-desarrollo"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Inicio
                                    Desarrollo</label>
                                <input type="date" id="form-fecha-inicio-desarrollo"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fin
                                    Desarrollo</label>
                                <input type="date" id="form-fecha-fin-desarrollo"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Días
                                    Desarrollo</label>
                                <input type="text" id="form-dias-desarrollo" readonly
                                    class="w-full bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Desviación
                                    Desarrollo</label>
                                <span id="form-atraso-desarrollo"
                                    class="inline-flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-black bg-slate-100 text-slate-400">—</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Compromiso
                                    QA</label>
                                <input type="date" id="form-fecha-qa"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Inicio
                                    QA</label>
                                <input type="date" id="form-fecha-inicio-qa"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fin QA</label>
                                <input type="date" id="form-fecha-fin-qa"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Días QA</label>
                                <input type="text" id="form-dias-qa" readonly
                                    class="w-full bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Desviación QA</label>
                                <span id="form-atraso-qa"
                                    class="inline-flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-black bg-slate-100 text-slate-400">—</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Compromiso
                                    UAT</label>
                                <input type="date" id="form-fecha-uat"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Inicio
                                    UAT</label>
                                <input type="date" id="form-fecha-inicio-uat"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fin UAT</label>
                                <input type="date" id="form-fecha-fin-uat"
                                    class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Días
                                    UAT</label>
                                <input type="text" id="form-dias-uat" readonly
                                    class="w-full bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Desviación UAT</label>
                                <span id="form-atraso-uat"
                                    class="inline-flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-black bg-slate-100 text-slate-400">—</span>
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Liberación
                                Producción</label>
                            <input type="date" id="form-fecha-liberacion-prod"
                                class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                        </div>
                    </div>
                </div>

                <div class="w-full">
                    <label class="block text-xs font-bold uppercase text-slate-400 mb-1">
                        Comentarios Generales
                    </label>
                    <input type="text" id="form-comentarios"
                        class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                </div>

                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <label class="flex items-start gap-3 cursor-pointer select-none">
                        <input type="checkbox" id="form-ajuste-sin-reprogramacion"
                            class="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                        <span>
                            <span class="block text-xs font-black uppercase text-slate-700">Ajuste administrativo sin reprogramación</span>
                            <span class="block text-[11px] text-slate-500 mt-0.5">
                                Permite cambiar fechas fin de Desarrollo, QA o UAT sin registrar reprogramación y sin solicitar motivo.
                            </span>
                        </span>
                    </label>
                </div>

                <div id="contenedor-razon" class="hidden bg-amber-50 border border-amber-100 p-4 rounded-xl space-y-4">
                    <div>
                        <label class="text-xs font-bold uppercase text-amber-700 flex items-center gap-1">
                            <i data-lucide="calendar-clock" class="w-4 h-4"></i>
                            Motivo de reprogramación
                        </label>
                        <p class="text-[11px] text-amber-700/80 mt-1">
                            Captura un motivo por cada compromiso reprogramado.
                        </p>
                    </div>

                    <div id="grupo-reprogramacion-desarrollo" class="hidden bg-white border border-amber-100 rounded-xl p-3 space-y-2">
                        <p class="text-[11px] font-black text-slate-600 uppercase">Desarrollo</p>
                        <select id="form-motivo-desarrollo"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></select>
                        <input type="text" id="form-comentario-motivo-desarrollo"
                            placeholder="Detalle opcional del motivo..."
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    </div>

                    <div id="grupo-reprogramacion-qa" class="hidden bg-white border border-amber-100 rounded-xl p-3 space-y-2">
                        <p class="text-[11px] font-black text-slate-600 uppercase">QA</p>
                        <select id="form-motivo-qa"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></select>
                        <input type="text" id="form-comentario-motivo-qa"
                            placeholder="Detalle opcional del motivo..."
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    </div>

                    <div id="grupo-reprogramacion-uat" class="hidden bg-white border border-amber-100 rounded-xl p-3 space-y-2">
                        <p class="text-[11px] font-black text-slate-600 uppercase">UAT</p>
                        <select id="form-motivo-uat"
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"></select>
                        <input type="text" id="form-comentario-motivo-uat"
                            placeholder="Detalle opcional del motivo..."
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    </div>
                </div>

                <div class="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onclick="cerrarModal()"
                        class="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl cursor-pointer">
                        Cancelar
                    </button>
                    <button type="submit" id="btn-guardar"
                        class="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md cursor-pointer">
                        Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL HISTORIAL -->
    <div id="modal-historial"
        class="hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-center items-center p-4">
        <div
            class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div class="flex items-center space-x-2.5">
                    <div class="p-2 bg-slate-100 text-slate-700 rounded-lg"><i data-lucide="clock" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-900 text-base">Auditoría Temporal de Hitos</h3>
                        <p id="historial-subtitulo"
                            class="text-xs text-slate-400 font-mono tracking-wide uppercase mt-0.5">REQ</p>
                    </div>
                </div>
                <button onclick="cerrarModalHistorial()"
                    class="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"><i data-lucide="x"
                        class="w-5 h-5"></i></button>
            </div>
            <div id="historial-lista" class="p-6 space-y-4 overflow-y-auto bg-slate-50/50 flex-1"></div>
        </div>
    </div>
    `;
}

function inicializarPanelRequerimientosHTML() {
    renderizarPanelRequerimientos();
    renderizarModalesRequerimientos();
}
