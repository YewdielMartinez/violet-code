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
    const { data, error } = await supabase
      .from('bitacora_acceso')
      .select('id, creado_en, accion, tabla_afectada, registro_id, empleado(nombre), usuario_externo(nombre)')
      .order('creado_en', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((row) => {
      const emp = unwrapOne(row.empleado);
      const ext = unwrapOne(row.usuario_externo);
      return {
        id: row.id,
        creadoEn: row.creado_en,
        accion: row.accion,
        tablaAfectada: row.tabla_afectada,
        actorNombre: emp?.nombre ?? ext?.nombre ?? null,
        registroId: row.registro_id,
      };
    });
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
    let query = supabase
      .from('alerta')
      .select(
        'id, creado_en, estado, prioridad, origen, persona(nombres, apellido_paterno), cat_asentamiento(nombre), atendida_por_emp:empleado!alerta_atendida_por_fkey(nombre)',
      )
      .eq('activo', true)
      .order('prioridad', { ascending: true })
      .order('creado_en', { ascending: false })
      .limit(limit);

    if (estado) {
      query = query.eq('estado', estado);
    } else {
      query = query.neq('estado', 'atendida');
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row) => {
      const persona = unwrapOne(row.persona);
      const asent = unwrapOne(row.cat_asentamiento);
      const emp = unwrapOne(row.atendida_por_emp);
      return {
        id: row.id,
        creadoEn: row.creado_en,
        estado: row.estado,
        prioridad: row.prioridad,
        origen: row.origen,
        usuariaNombre: persona ? fullName(persona.nombres, persona.apellido_paterno) : null,
        asentamiento: asent?.nombre ?? null,
        atendidaPorNombre: emp?.nombre ?? null,
      };
    });
  },

  async getCasesSummary(userId: string): Promise<CasesSummary> {
    const [fichasRes, urgenciasRes] = await Promise.all([
      supabase.from('ficha_registro').select('id, estado, creado_por').eq('activo', true).limit(300),
      supabase.from('vista_lista_urgencias').select('ficha_id').limit(300),
    ]);

    if (fichasRes.error) throw fichasRes.error;
    if (urgenciasRes.error) throw urgenciasRes.error;

    let open = 0;
    let inFollowUp = 0;
    let mine = 0;

    for (const row of fichasRes.data ?? []) {
      if (row.estado === 'abierto') open++;
      if (row.estado === 'en_seguimiento') inFollowUp++;
      if (row.creado_por === userId && row.estado !== 'cerrado' && row.estado !== 'archivado') mine++;
    }

    return {
      open,
      inFollowUp,
      urgencias: (urgenciasRes.data ?? []).length,
      mine,
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

    const { data, error } = await supabase
      .from('cita')
      .select('id, programada_en, estado, cat_area(nombre), persona(nombres, apellido_paterno)')
      .eq('activo', true)
      .gte('programada_en', startOfToday.toISOString())
      .not('estado', 'in', '("cancelada","reagendada")')
      .order('programada_en', { ascending: true })
      .limit(50);

    if (error) throw error;

    const now = new Date();
    const rows = data ?? [];
    const today = rows.filter((c) => new Date(c.programada_en) <= endOfToday).length;
    const next = rows.find((c) => new Date(c.programada_en) >= now && c.estado !== 'asistio' && c.estado !== 'no_asistio');
    const nextArea = next ? unwrapOne(next.cat_area)?.nombre ?? null : null;
    const nextPersona = next ? unwrapOne(next.persona) : null;

    return {
      today,
      nextAt: next?.programada_en ?? null,
      nextArea,
      nextUsuaria: nextPersona ? fullName(nextPersona.nombres, nextPersona.apellido_paterno) : null,
    };
  },

  async getAppointments(fromIsoDate: string, toIsoDate: string): Promise<CitaItem[]> {
    const { data, error } = await supabase
      .from('cita')
      .select('id, programada_en, estado, prioridad, cat_area(clave, nombre), persona(nombres, apellido_paterno)')
      .eq('activo', true)
      .gte('programada_en', `${fromIsoDate}T00:00:00`)
      .lte('programada_en', `${toIsoDate}T23:59:59.999`)
      .order('programada_en', { ascending: true })
      .limit(200);

    if (error) throw error;

    return (data ?? []).map((row) => {
      const area = unwrapOne(row.cat_area);
      const persona = unwrapOne(row.persona);
      return {
        id: row.id,
        programadaEn: row.programada_en,
        estado: row.estado,
        prioridad: row.prioridad,
        areaClave: area?.clave ?? null,
        areaNombre: area?.nombre ?? 'Área',
        usuariaNombre: persona ? fullName(persona.nombres, persona.apellido_paterno) : 'Usuaria',
      };
    });
  },
};
