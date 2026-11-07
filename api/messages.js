import { requireUser } from './_lib/auth.js';
import { mapMessage } from './_lib/appointments.js';
import {
  HttpError,
  assertSameOrigin,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from './_lib/http.js';
import { isSupabaseAdminConfigured, supabaseAdminRequest } from './_lib/supabaseAdmin.js';

const MAX_MESSAGE_LENGTH = 2000;

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PUT'].includes(request.method || 'GET')) {
    return methodNotAllowed(response, 'GET, POST, PUT');
  }

  try {
    if (request.method !== 'GET') assertSameOrigin(request);
    if (!isSupabaseAdminConfigured()) {
      throw new HttpError(503, 'O Supabase ainda não está configurado no servidor para a conversa.');
    }

    const user = await requireUser(request);

    if (request.method === 'GET') {
      const rows = await supabaseAdminRequest('/rest/v1/messages', {
        query: {
          select: '*',
          user_id: `eq.${user.id}`,
          order: 'created_at.asc',
          limit: 500,
        },
      });
      const messages = (Array.isArray(rows) ? rows : []).map(mapMessage);
      return sendJson(response, 200, {
        messages,
        unreadCount: messages.filter((message) => message.sender === 'nutritionist' && !message.readAt).length,
      });
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request, 16 * 1024);
      const text = typeof body?.body === 'string' ? body.body.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
      if (text.length < 1) throw new HttpError(400, 'Escreva uma mensagem antes de enviar.');

      // Limite simples anti-flood: até 20 mensagens por minuto por pessoa.
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const recent = await supabaseAdminRequest('/rest/v1/messages', {
        query: {
          select: 'id',
          user_id: `eq.${user.id}`,
          sender: 'eq.user',
          created_at: `gte.${oneMinuteAgo}`,
          limit: 30,
        },
      });
      if (Array.isArray(recent) && recent.length >= 20) {
        throw new HttpError(429, 'Aguarde um instante antes de enviar outra mensagem.');
      }

      const rows = await supabaseAdminRequest('/rest/v1/messages', {
        method: 'POST',
        body: { user_id: user.id, sender: 'user', body: text },
        headers: { Prefer: 'return=representation' },
      });
      const inserted = Array.isArray(rows) ? rows[0] : rows;
      return sendJson(response, 201, { message: mapMessage(inserted) });
    }

    // PUT — marca as mensagens da nutricionista como lidas.
    await supabaseAdminRequest('/rest/v1/messages', {
      method: 'PATCH',
      query: {
        user_id: `eq.${user.id}`,
        sender: 'eq.nutritionist',
        read_at: 'is.null',
      },
      body: { read_at: new Date().toISOString() },
      headers: { Prefer: 'return=minimal' },
    });
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível carregar a conversa agora.');
  }
}
