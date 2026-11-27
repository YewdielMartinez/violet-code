import { supabase } from '../client';
import type {
  AlertaItem,
  AlertsSummary,
  AuditEvent,
  CaseItem,
  CasesSummary,
  CitaItem,
  EstadoAlerta,
  SchedulingSummary,
} from '@/domain/models/Dashboard';
import type { DashboardRepository } from '@/domain/ports/DashboardRepository';

const AREA_LABELS: Record<string, string> = {
  trabajo_social: 'Trabajo Social',
  psicologia: 'Psicología',
  juridico: 'Jurídico',
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function fullName(nombres: string | null | undefined, apPat: string | null | undefined): string {
  return [nombres, apPat].filter(Boolean).join(' ').trim() || 'Sin nombre';
}

function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const supabaseDashboardRepository: DashboardRepository = {
  async getRecentActivity(limit = 8): Promise<AuditEvent[]> {
    const { data, error } = await supabase.rpc('get_bitacora', {
      p_limite: limit,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      creadoEn: row.creado_en,
      accion: row.accion,
      tablaAfectada: row.tabla_afectada,
      actorNombre: row.actor_nombre ?? null,
      registroId: row.registro_id ?? null,
    }));
  },

  async getAlertsSummary(): Promise<AlertsSummary> {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('alerta')
      .select('id, creado_en, estado')
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(200);

    if (error) throw error;

    const todayKey = localDayKey(new Date());
    const dayCounts = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayCounts.set(localDayKey(d), 0);
    }

    let active = 0;
    let newToday = 0;
    let inProgress = 0;
    let closedThisWeek = 0;

    for (const row of data ?? []) {
      const created = new Date(row.creado_en);
      const day = localDayKey(created);
      if (dayCounts.has(day)) {
        dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      }
      if (row.estado !== 'atendida') active++;
      if (row.estado === 'nueva' && day === todayKey) newToday++;
      if (row.estado === 'tomada') inProgress++;
      if (row.estado === 'atendida' && created >= since) closedThisWeek++;
    }

    return {
      active,
      newToday,
      inProgress,
      closedThisWeek,
      byDay: Array.from(dayCounts, ([date, count]) => ({ date, count })),
    };
  },

  async getAlerts(estado?: EstadoAlerta, limit = 8): Promise<AlertaItem[]> {
    const { data, error } = await supabase.rpc('get_cola_alertas', {
      p_estados: estado ? [estado] : ['nueva', 'tomada'],
      p_limite: limit,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.alerta_id,
      creadoEn: row.creado_en,
      estado: row.estado,
      prioridad: row.prioridad,
      origen: row.origen,
      usuariaNombre: row.nombre_completo ?? null,
      asentamiento: row.asentamiento_nombre ?? null,
      atendidaPorNombre: row.atendida_por_nombre ?? null,
    }));
  },

  async getCasesSummary(userId: string): Promise<CasesSummary> {
    // Solo conteos (HEAD + count exact): no descarga filas y no se trunca en N registros.
    const countFichas = () =>
      supabase.from('ficha_registro').select('id', { count: 'exact', head: true }).eq('activo', true);

    const [openRes, followUpRes, mineRes, urgenciasRes] = await Promise.all([
      countFichas().eq('estado', 'abierto'),
      countFichas().eq('estado', 'en_seguimiento'),
      countFichas().eq('creado_por', userId).not('estado', 'in', '(cerrado,archivado)'),
      supabase.from('vista_lista_urgencias').select('ficha_id', { count: 'exact', head: true }),
    ]);

    for (const res of [openRes, followUpRes, mineRes, urgenciasRes]) {
      if (res.error) throw res.error;
    }

    return {
      open: openRes.count ?? 0,
      inFollowUp: followUpRes.count ?? 0,
      urgencias: urgenciasRes.count ?? 0,
      mine: mineRes.count ?? 0,
    };
  },

  async getCasesToReview(mine: boolean, userId: string, limit = 6): Promise<CaseItem[]> {
    let query = supabase
      .from('ficha_registro')
      .select('id, folio, estado, actualizado_en, creado_por, persona(nombres, apellido_paterno)')
      .eq('activo', true)
      .in('estado', ['abierto', 'en_seguimiento'])
      .order('actualizado_en', { ascending: false })
      .limit(limit);

    if (mine) {
      query = query.eq('creado_por', userId);
    }

    const [fichasRes, urgenciasRes] = await Promise.all([
      query,
      supabase.from('vista_lista_urgencias').select('ficha_id').limit(300),
    ]);

    if (fichasRes.error) throw fichasRes.error;
    if (urgenciasRes.error) throw urgenciasRes.error;

    const urgenciasSet = new Set((urgenciasRes.data ?? []).map((u) => u.ficha_id).filter(Boolean));

    return (fichasRes.data ?? []).map((row) => {
      const persona = unwrapOne(row.persona);
      return {
        id: row.id,
        folio: row.folio,
        usuariaNombre: persona ? fullName(persona.nombres, persona.apellido_paterno) : 'Expediente',
        estado: row.estado,
        actualizadoEn: row.actualizado_en,
        enListaUrgencias: urgenciasSet.has(row.id),
      };
    });
  },

  async getSchedulingSummary(): Promise<SchedulingSummary> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endPlus30Days = new Date(startOfToday);
    endPlus30Days.setDate(endPlus30Days.getDate() + 30);

    const { data, error } = await supabase.rpc('get_agenda', {
      p_desde: startOfToday.toISOString(),
      p_hasta: endPlus30Days.toISOString(),
      p_estados: ['agendada', 'confirmada', 'asistio', 'no_asistio'],
      p_limite: 50,
    });

    if (error) throw error;

    const now = new Date();
    const rows = data ?? [];
    const today = rows.filter((c) => new Date(c.programada_en) <= endOfToday).length;
    const next = rows.find(
      (c) => new Date(c.programada_en) >= now && c.estado !== 'asistio' && c.estado !== 'no_asistio',
    );

    return {
      today,
      nextAt: next?.programada_en ?? null,
      nextArea: next ? (AREA_LABELS[next.area_clave] ?? next.area_clave) : null,
      nextUsuaria: next?.nombre_completo ?? null,
    };
  },

  async getAppointments(fromIsoDate: string, toIsoDate: string): Promise<CitaItem[]> {
    const { data, error } = await supabase.rpc('get_agenda', {
      p_desde: `${fromIsoDate}T00:00:00`,
      p_hasta: `${toIsoDate}T23:59:59.999`,
      p_limite: 200,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.cita_id,
      programadaEn: row.programada_en,
      estado: row.estado,
      prioridad: row.prioridad ?? null,
      areaClave: row.area_clave ?? null,
      areaNombre: AREA_LABELS[row.area_clave] ?? 'Área',
      usuariaNombre: row.nombre_completo || 'Usuaria',
    }));
  },
};
