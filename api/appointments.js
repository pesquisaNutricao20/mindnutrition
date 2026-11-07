import { requireUser } from './_lib/auth.js';
import {
  APPOINTMENT_SLOTS,
  addDays,
  assertBookableDay,
  mapAppointment,
  normalizeDay,
  normalizeSlot,
  toScheduledAt,
  todayInClinicTimeZone,
} from './_lib/appointments.js';
import {
  HttpError,
  assertSameOrigin,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from './_lib/http.js';
import { isSupabaseAdminConfigured, supabaseAdminRequest } from './_lib/supabaseAdmin.js';

async function loadAvailability() {
  const today = todayInClinicTimeZone();
  const horizon = addDays(today, 120);

  const [busyRows, blockRows] = await Promise.all([
    supabaseAdminRequest('/rest/v1/appointments', {
      query: {
        select: 'day,slot',
        day: `gte.${today}`,
        status: 'in.(pending,confirmed)',
        order: 'day.asc',
        limit: 3000,
      },
    }),
    supabaseAdminRequest('/rest/v1/appointment_blocks', {
      query: { select: 'day', day: `gte.${today}`, order: 'day.asc', limit: 400 },
    }),
  ]);

  const busySlots = {};
  (Array.isArray(busyRows) ? busyRows : []).forEach((row) => {
    const day = String(row.day || '').slice(0, 10);
    const slot = String(row.slot || '').slice(0, 5);
    if (!day || !slot) return;
    busySlots[day] = [...(busySlots[day] || []), slot];
  });

  return {
    today,
    horizon,
    slots: APPOINTMENT_SLOTS,
    busySlots,
    blockedDays: (Array.isArray(blockRows) ? blockRows : [])
      .map((row) => String(row.day || '').slice(0, 10))
      .filter(Boolean),
  };
}

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PATCH'].includes(request.method || 'GET')) {
    return methodNotAllowed(response, 'GET, POST, PATCH');
  }

  try {
    if (request.method !== 'GET') assertSameOrigin(request);
    if (!isSupabaseAdminConfigured()) {
      throw new HttpError(503, 'O Supabase ainda não está configurado no servidor para a agenda.');
    }

    const user = await requireUser(request);

    if (request.method === 'GET') {
      const [rows, availability] = await Promise.all([
        supabaseAdminRequest('/rest/v1/appointments', {
          query: {
            select: '*',
            user_id: `eq.${user.id}`,
            order: 'day.desc,slot.desc',
            limit: 200,
          },
        }),
        loadAvailability(),
      ]);

      return sendJson(response, 200, {
        appointments: (Array.isArray(rows) ? rows : []).map(mapAppointment),
        availability,
      });
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request, 16 * 1024);
      const day = normalizeDay(body?.day);
      const slot = normalizeSlot(body?.slot);
      const mode = body?.mode === 'presencial' ? 'presencial' : 'online';
      const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 800) : '';

      assertBookableDay(day, slot);

      const [blockedRows, activeRows] = await Promise.all([
        supabaseAdminRequest('/rest/v1/appointment_blocks', {
          query: { select: 'id', day: `eq.${day}`, limit: 1 },
        }),
        supabaseAdminRequest('/rest/v1/appointments', {
          query: {
            select: 'id,day,slot,status',
            user_id: `eq.${user.id}`,
            status: 'in.(pending,confirmed)',
            day: `gte.${todayInClinicTimeZone()}`,
            limit: 1,
          },
        }),
      ]);

      if (Array.isArray(blockedRows) && blockedRows.length) {
        throw new HttpError(409, 'A nutricionista não atende nesse dia. Escolha outra data.');
      }
      if (Array.isArray(activeRows) && activeRows.length) {
        throw new HttpError(409, 'Você já tem uma consulta ativa na agenda. Cancele ou aguarde a resposta antes de marcar outra.');
      }

      const conflictRows = await supabaseAdminRequest('/rest/v1/appointments', {
        query: {
          select: 'id',
          day: `eq.${day}`,
          slot: `eq.${slot}`,
          status: 'in.(pending,confirmed)',
          limit: 1,
        },
      });
      if (Array.isArray(conflictRows) && conflictRows.length) {
        throw new HttpError(409, 'Esse horário acabou de ser ocupado. Escolha outro.');
      }

      const rows = await supabaseAdminRequest('/rest/v1/appointments', {
        method: 'POST',
        body: {
          user_id: user.id,
          day,
          slot,
          scheduled_at: toScheduledAt(day, slot),
          mode,
          status: 'pending',
          notes,
        },
        headers: { Prefer: 'return=representation' },
      });

      const inserted = Array.isArray(rows) ? rows[0] : rows;
      return sendJson(response, 201, { appointment: mapAppointment(inserted) });
    }

    // PATCH — o paciente cancela a própria consulta.
    const body = await readJsonBody(request, 8 * 1024);
    const id = typeof body?.id === 'string' ? body.id.trim().slice(0, 64) : '';
    if (!id) throw new HttpError(400, 'Informe a consulta que deseja cancelar.');

    const rows = await supabaseAdminRequest('/rest/v1/appointments', {
      method: 'PATCH',
      query: {
        id: `eq.${id}`,
        user_id: `eq.${user.id}`,
        status: 'in.(pending,confirmed)',
      },
      body: { status: 'cancelled', decided_at: new Date().toISOString() },
      headers: { Prefer: 'return=representation' },
    });

    if (!Array.isArray(rows) || !rows.length) {
      throw new HttpError(404, 'Consulta não encontrada ou já encerrada.');
    }
    return sendJson(response, 200, { appointment: mapAppointment(rows[0]) });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível acessar a agenda agora.');
  }
}
