import { requireAdmin } from '../_lib/admin.js';
import {
  APPOINTMENT_SLOTS,
  APPOINTMENT_STATUSES,
  addDays,
  mapAppointment,
  normalizeDay,
  todayInClinicTimeZone,
} from '../_lib/appointments.js';
import {
  HttpError,
  assertSameOrigin,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from '../_lib/http.js';
import { isSupabaseAdminConfigured, supabaseAdminRequest } from '../_lib/supabaseAdmin.js';

async function loadPatients(ids) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();
  const rows = await supabaseAdminRequest('/rest/v1/profiles', {
    query: { select: 'id,email,name,photo', id: `in.(${unique.join(',')})`, limit: unique.length },
  });
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    map.set(String(row.id), {
      id: String(row.id),
      name: String(row.name || '').slice(0, 120),
      email: String(row.email || '').slice(0, 160),
    });
  });
  return map;
}

export default async function handler(request, response) {
  if (!requireAdmin(request, response)) return;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method || 'GET')) {
    return methodNotAllowed(response, 'GET, POST, PUT, DELETE');
  }

  try {
    if (request.method !== 'GET') assertSameOrigin(request);
    if (!isSupabaseAdminConfigured()) {
      throw new HttpError(503, 'O Supabase ainda não está configurado no servidor para a agenda.');
    }

    const url = new URL(request.url || '/', 'http://localhost');
    const today = todayInClinicTimeZone();

    if (request.method === 'GET') {
      const rawFrom = url.searchParams.get('from');
      const rawTo = url.searchParams.get('to');
      const from = rawFrom ? normalizeDay(rawFrom) : today;
      const to = rawTo ? normalizeDay(rawTo) : addDays(today, 60);
      if (to < from) throw new HttpError(400, 'Período inválido para a agenda.');

      const [appointmentRows, blockRows] = await Promise.all([
        supabaseAdminRequest('/rest/v1/appointments', {
          query: {
            select: '*',
            day: `gte.${from}`,
            and: `(day.lte.${to})`,
            order: 'day.asc,slot.asc',
            limit: 1000,
          },
        }),
        supabaseAdminRequest('/rest/v1/appointment_blocks', {
          query: { select: '*', day: `gte.${from}`, and: `(day.lte.${to})`, order: 'day.asc', limit: 400 },
        }),
      ]);

      const appointments = (Array.isArray(appointmentRows) ? appointmentRows : []).map(mapAppointment);
      const patients = await loadPatients(appointments.map((item) => item.userId));

      return sendJson(response, 200, {
        today,
        slots: APPOINTMENT_SLOTS,
        appointments: appointments.map((appointment) => ({
          ...appointment,
          patient: patients.get(appointment.userId) || { id: appointment.userId, name: '', email: '' },
        })),
        blocks: (Array.isArray(blockRows) ? blockRows : []).map((row) => ({
          id: String(row.id || ''),
          day: String(row.day || '').slice(0, 10),
          reason: String(row.reason || ''),
        })),
      });
    }

    if (request.method === 'PUT') {
      const body = await readJsonBody(request, 16 * 1024);
      const id = typeof body?.id === 'string' ? body.id.trim().slice(0, 64) : '';
      const status = APPOINTMENT_STATUSES.includes(body?.status) ? body.status : '';
      const note = typeof body?.nutritionistNote === 'string' ? body.nutritionistNote.trim().slice(0, 800) : '';
      if (!id) throw new HttpError(400, 'Informe a consulta a ser atualizada.');
      if (!status || status === 'pending') throw new HttpError(400, 'Escolha um status válido para a consulta.');

      const currentRows = await supabaseAdminRequest('/rest/v1/appointments', {
        query: { select: '*', id: `eq.${id}`, limit: 1 },
      });
      const current = Array.isArray(currentRows) ? currentRows[0] : null;
      if (!current) throw new HttpError(404, 'Consulta não encontrada.');

      if (status === 'confirmed') {
        const conflictRows = await supabaseAdminRequest('/rest/v1/appointments', {
          query: {
            select: 'id',
            day: `eq.${String(current.day).slice(0, 10)}`,
            slot: `eq.${String(current.slot).slice(0, 5)}`,
            status: 'in.(pending,confirmed)',
            id: `neq.${id}`,
            limit: 1,
          },
        });
        if (Array.isArray(conflictRows) && conflictRows.length) {
          throw new HttpError(409, 'Já existe outra consulta ativa nesse horário.');
        }
      }

      const rows = await supabaseAdminRequest('/rest/v1/appointments', {
        method: 'PATCH',
        query: { id: `eq.${id}` },
        body: {
          status,
          nutritionist_note: note || current.nutritionist_note || '',
          decided_at: ['confirmed', 'declined', 'cancelled', 'completed'].includes(status)
            ? new Date().toISOString()
            : null,
        },
        headers: { Prefer: 'return=representation' },
      });

      const updated = Array.isArray(rows) ? rows[0] : rows;
      if (!updated) throw new HttpError(404, 'Consulta não encontrada.');
      return sendJson(response, 200, { appointment: mapAppointment(updated) });
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request, 8 * 1024);
      const day = normalizeDay(body?.day);
      const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : '';

      const rows = await supabaseAdminRequest('/rest/v1/appointment_blocks', {
        method: 'POST',
        query: { on_conflict: 'day' },
        body: { day, reason },
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      });
      const inserted = Array.isArray(rows) ? rows[0] : rows;
      return sendJson(response, 201, {
        block: {
          id: String(inserted?.id || ''),
          day: String(inserted?.day || day).slice(0, 10),
          reason: String(inserted?.reason || reason),
        },
      });
    }

    const blockId = String(url.searchParams.get('blockId') || '').trim().slice(0, 64);
    const blockDay = url.searchParams.get('day');
    if (!blockId && !blockDay) throw new HttpError(400, 'Informe o dia bloqueado a ser liberado.');

    await supabaseAdminRequest('/rest/v1/appointment_blocks', {
      method: 'DELETE',
      query: blockId ? { id: `eq.${blockId}` } : { day: `eq.${normalizeDay(blockDay)}` },
    });
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível atualizar a agenda agora.');
  }
}
