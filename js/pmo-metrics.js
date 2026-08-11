(function (global) {
  'use strict';

  const DAY_MS = 86400000;

  function fecha(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
    const texto = String(valor).slice(0, 10);
    const d = new Date(texto + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function diasEntre(inicio, fin) {
    const a = fecha(inicio), b = fecha(fin);
    if (!a || !b) return null;
    return Math.round((b - a) / DAY_MS);
  }

  function normalizar(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  function estatusOperativo(valor) {
    const e = normalizar(valor || 'BACKLOG');
    if (e.includes('CANCEL')) return 'CANCELADO';
    if (e.includes('LIBERADO') || e.includes('PRODUCCION') || e === 'PROD') return 'LIBERADO';
    if (e.includes('UAT') || e.includes('USUARIO')) return 'UAT';
    if (e === 'QA' || e.includes('PRUEBA') || e.includes('CERTIFICACION')) return 'QA';
    if (e.includes('DESARROLLO') || e === 'DEV') return 'DESARROLLO';
    if (e.includes('ANALISIS')) return 'ANALISIS';
    return 'BACKLOG';
  }

  function faseAjustada(contexto, proyectoId, fase) {
    return Boolean(contexto?.ajustesAdministrativos?.[proyectoId]?.[fase]);
  }

  function metricasFase({ nombre, compromiso, inicio, fin, ajusteAdministrativo = false, hoy = new Date() }) {
    const duracion = diasEntre(inicio, fin);
    const desviacion = compromiso && fin ? diasEntre(compromiso, fin) : null;
    const atraso = compromiso && !fin ? Math.max(0, diasEntre(compromiso, hoy) || 0) : 0;
    const proximoVencimiento = compromiso && !fin ? diasEntre(hoy, compromiso) : null;
    const medida = Boolean(compromiso && fin && !ajusteAdministrativo);
    const cumplida = medida ? desviacion <= 0 : null;

    let estado = 'SIN_DATOS';
    if (ajusteAdministrativo) estado = 'AJUSTE_ADMINISTRATIVO';
    else if (fin) estado = desviacion > 0 ? 'CERRADA_FUERA_TIEMPO' : 'CERRADA_EN_TIEMPO';
    else if (compromiso && atraso > 0) estado = 'ABIERTA_ATRASADA';
    else if (compromiso && proximoVencimiento !== null && proximoVencimiento >= 0 && proximoVencimiento <= 7) estado = 'PROXIMA_VENCER';
    else if (inicio || compromiso) estado = 'ABIERTA_EN_TIEMPO';

    return { nombre, compromiso, inicio, fin, duracion, desviacion, atraso, proximoVencimiento, medida, cumplida, estado, ajusteAdministrativo };
  }

  function metricasProyecto(p, contexto = {}) {
    const hoy = contexto.hoy || new Date();
    const fases = [
      metricasFase({ nombre: 'Desarrollo', compromiso: p.fecha_desarrollo, inicio: p.fecha_inicio_desarrollo, fin: p.fecha_fin_desarrollo, ajusteAdministrativo: faseAjustada(contexto, p.id, 'Fin Desarrollo'), hoy }),
      metricasFase({ nombre: 'QA', compromiso: p.fecha_qa, inicio: p.fecha_inicio_qa, fin: p.fecha_fin_qa, ajusteAdministrativo: faseAjustada(contexto, p.id, 'Fin QA'), hoy }),
      metricasFase({ nombre: 'UAT', compromiso: p.fecha_uat, inicio: p.fecha_inicio_uat, fin: p.fecha_fin_uat, ajusteAdministrativo: faseAjustada(contexto, p.id, 'Fin UAT'), hoy })
    ];

    const estatus = estatusOperativo(p.estatus);
    const cancelado = estatus === 'CANCELADO';
    const reprogramaciones = Number(contexto?.reprogramaciones?.[p.id] || 0);
    const inicioLead = p.fecha_ingreso_pmo || (p.created_at ? String(p.created_at).slice(0, 10) : null) || p.fecha_inicio_desarrollo || null;
    const leadTime = p.fecha_liberacion_prod ? diasEntre(inicioLead, p.fecha_liberacion_prod) : null;
    const cycleTime = p.fecha_liberacion_prod ? diasEntre(p.fecha_inicio_desarrollo, p.fecha_liberacion_prod) : null;
    const antiguedad = cancelado || estatus === 'LIBERADO' ? null : diasEntre(inicioLead, hoy);
    const atrasoTotal = fases.reduce((s, f) => s + (f.ajusteAdministrativo ? 0 : f.atraso), 0);
    const maxAtraso = Math.max(0, ...fases.map(f => f.ajusteAdministrativo ? 0 : f.atraso));
    const desviacionesPositivas = fases.filter(f => !f.ajusteAdministrativo && typeof f.desviacion === 'number' && f.desviacion > 0);
    const maxDesviacion = Math.max(0, ...desviacionesPositivas.map(f => f.desviacion));
    const fasesAtrasadas = fases.filter(f => f.estado === 'ABIERTA_ATRASADA');
    const proximas = fases.filter(f => f.estado === 'PROXIMA_VENCER');

    let salud = 'VERDE';
    let motivoSalud = 'Sin riesgos actuales';
    if (cancelado) { salud = 'NEUTRO'; motivoSalud = 'Requerimiento cancelado'; }
    else if (maxAtraso > 5 || maxDesviacion > 5 || reprogramaciones >= 2) { salud = 'ROJO'; motivoSalud = maxAtraso > 5 ? `${maxAtraso} días de atraso` : maxDesviacion > 5 ? `${maxDesviacion} días de desviación` : `${reprogramaciones} reprogramaciones`; }
    else if (maxAtraso > 0 || maxDesviacion > 0 || reprogramaciones === 1 || proximas.length) { salud = 'AMARILLO'; motivoSalud = maxAtraso > 0 ? `${maxAtraso} días de atraso` : maxDesviacion > 0 ? `${maxDesviacion} días de desviación` : reprogramaciones ? 'Reprogramado' : 'Próximo vencimiento'; }

    return { proyecto: p, estatus, cancelado, fases, reprogramaciones, leadTime, cycleTime, antiguedad, atrasoTotal, maxAtraso, maxDesviacion, fasesAtrasadas, proximas, salud, motivoSalud };
  }

  function promedio(lista) {
    const validos = lista.filter(v => Number.isFinite(v));
    return validos.length ? Math.round(validos.reduce((a, b) => a + b, 0) / validos.length) : null;
  }

  function resumen(proyectos = [], contexto = {}) {
    const metricas = proyectos.map(p => metricasProyecto(p, contexto));
    const vigentes = metricas.filter(m => !m.cancelado);
    const fases = vigentes.flatMap(m => m.fases);
    const fasesMedidas = fases.filter(f => f.medida);
    const fasesCumplidas = fasesMedidas.filter(f => f.cumplida);
    const atrasos = vigentes.flatMap(m => m.fasesAtrasadas.map(f => ({ ...f, proyecto: m.proyecto, salud: m.salud })));
    const proximos7 = vigentes.flatMap(m => m.proximas.map(f => ({ ...f, proyecto: m.proyecto, salud: m.salud })));
    const desviaciones = fases.filter(f => !f.ajusteAdministrativo && Number.isFinite(f.desviacion));
    const reprogramados = vigentes.filter(m => m.reprogramaciones > 0);
    const sinReprogramar = vigentes.length - reprogramados.length;
    const salud = { VERDE: 0, AMARILLO: 0, ROJO: 0, NEUTRO: 0 };
    metricas.forEach(m => salud[m.salud] = (salud[m.salud] || 0) + 1);

    const porEstatus = {};
    metricas.forEach(m => porEstatus[m.estatus] = (porEstatus[m.estatus] || 0) + 1);

    return {
      metricas,
      total: proyectos.length,
      vigentes: vigentes.length,
      cancelados: metricas.filter(m => m.cancelado).length,
      liberados: metricas.filter(m => m.estatus === 'LIBERADO').length,
      porEstatus,
      fasesMedidas: fasesMedidas.length,
      fasesCumplidas: fasesCumplidas.length,
      cumplimiento: fasesMedidas.length ? Math.round((fasesCumplidas.length / fasesMedidas.length) * 100) : null,
      atrasos,
      requerimientosAtrasados: new Set(atrasos.map(a => a.proyecto.id)).size,
      proximos7,
      reprogramaciones: vigentes.reduce((s, m) => s + m.reprogramaciones, 0),
      proyectosReprogramados: reprogramados.length,
      estabilidad: vigentes.length ? Math.round((sinReprogramar / vigentes.length) * 100) : null,
      leadTimePromedio: promedio(metricas.map(m => m.leadTime)),
      cycleTimePromedio: promedio(metricas.map(m => m.cycleTime)),
      desviacionPromedio: promedio(desviaciones.map(f => f.desviacion)),
      duracionDesarrollo: promedio(vigentes.map(m => m.fases[0].duracion)),
      duracionQA: promedio(vigentes.map(m => m.fases[1].duracion)),
      duracionUAT: promedio(vigentes.map(m => m.fases[2].duracion)),
      salud
    };
  }

  global.PMOMetrics = { fecha, diasEntre, estatusOperativo, metricasFase, metricasProyecto, resumen };
})(window);
