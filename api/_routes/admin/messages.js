import { requireAdmin } from '../../_lib/admin.js';
import { mapMessage } from '../../_lib/appointments.js';
import {
  HttpError,
  assertSameOrigin,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from '../../_lib/http.js';
import { isSupabaseAdminConfigured, supabaseAdminRequest } from '../../_lib/supabaseAdmin.js';

const MAX_MESSAGE_LENGTH = 2000;

async function loadProfiles(ids) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();
  const rows = await supabaseAdminRequest('/rest/v1/profiles', {
    query: {
      select: 'id,email,name,photo,updated_at',
      id: `in.(${unique.join(',')})`,
      limit: unique.length,
    },
  });
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    map.set(String(row.id), {
      id: String(row.id),
      name: String(row.name || '').slice(0, 120),
      email: String(row.email || '').slice(0, 160),
      updatedAt: row.updated_at || null,
    });
  });
  return map;
}

async function markUserMessagesRead(userId) {
  await supabaseAdminRequest('/rest/v1/messages', {
    method: 'PATCH',
    query: { user_id: `eq.${userId}`, sender: 'eq.user', read_at: 'is.null' },
    body: { read_at: new Date().toISOString() },
    headers: { Prefer: 'return=minimal' },
  });
}

export default async function handler(request, response) {
  if (!requireAdmin(request, response)) return;
  if (!['GET', 'POST', 'PUT'].includes(request.method || 'GET')) {
    return methodNotAllowed(response, 'GET, POST, PUT');
  }

  try {
    if (request.method !== 'GET') assertSameOrigin(request);
    if (!isSupabaseAdminConfigured()) {
      throw new HttpError(503, 'O Supabase ainda não está configurado no servidor para as mensagens.');
    }

    const url = new URL(request.url || '/', 'http://localhost');
    const userId = String(url.searchParams.get('userId') || '').trim().slice(0, 64);

    if (request.method === 'GET' && userId) {
      const [rows, profiles, unreadRows] = await Promise.all([
        supabaseAdminRequest('/rest/v1/messages', {
          query: { select: '*', user_id: `eq.${userId}`, order: 'created_at.asc', limit: 500 },
        }),
        loadProfiles([userId]),
        supabaseAdminRequest('/rest/v1/messages', {
          query: { select: 'id', user_id: `eq.${userId}`, sender: 'eq.user', read_at: 'is.null', limit: 500 },
        }),
      ]);

      return sendJson(response, 200, {
        messages: (Array.isArray(rows) ? rows : []).map(mapMessage),
        user: profiles.get(userId) || { id: userId, name: '', email: '' },
        unreadFromUser: Array.isArray(unreadRows) ? unreadRows.length : 0,
      });
    }

    if (request.method === 'GET') {
      const [recentRows, unreadRows] = await Promise.all([
        supabaseAdminRequest('/rest/v1/messages', {
          query: { select: '*', order: 'created_at.desc', limit: 400 },
        }),
        supabaseAdminRequest('/rest/v1/messages', {
          query: { select: 'user_id', sender: 'eq.user', read_at: 'is.null', limit: 1000 },
        }),
      ]);

      const messages = (Array.isArray(recentRows) ? recentRows : []).map(mapMessage);
      const unreadByUser = new Map();
      (Array.isArray(unreadRows) ? unreadRows : []).forEach((row) => {
        const id = String(row.user_id || '');
        if (id) unreadByUser.set(id, (unreadByUser.get(id) || 0) + 1);
      });

      const byUser = new Map();
      messages.forEach((message) => {
        if (!byUser.has(message.userId)) byUser.set(message.userId, []);
        byUser.get(message.userId).push(message);
      });

      const profiles = await loadProfiles(Array.from(byUser.keys()));
      const conversations = Array.from(byUser.entries()).map(([id, list]) => {
        const ordered = [...list].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        const last = ordered[ordered.length - 1];
        const profile = profiles.get(id) || { id, name: '', email: '' };
        return {
          userId: id,
          name: profile.name,
          email: profile.email,
          lastMessage: last?.body || '',
          lastSender: last?.sender || 'user',
          lastAt: last?.createdAt || null,
          unreadFromUser: unreadByUser.get(id) || 0,
          messageCount: ordered.length,
        };
      }).sort((a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime());

      return sendJson(response, 200, { conversations });
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request, 16 * 1024);
      const targetUserId = typeof body?.userId === 'string' ? body.userId.trim().slice(0, 64) : '';
      const text = typeof body?.body === 'string' ? body.body.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
      if (!targetUserId) throw new HttpError(400, 'Selecione a pessoa para receber a mensagem.');
      if (!text) throw new HttpError(400, 'Escreva uma mensagem antes de enviar.');

      const rows = await supabaseAdminRequest('/rest/v1/messages', {
        method: 'POST',
        body: { user_id: targetUserId, sender: 'nutritionist', body: text },
        headers: { Prefer: 'return=representation' },
      });
      await markUserMessagesRead(targetUserId).catch(() => undefined);

      const inserted = Array.isArray(rows) ? rows[0] : rows;
      return sendJson(response, 201, { message: mapMessage(inserted) });
    }

    const body = await readJsonBody(request, 8 * 1024);
    const targetUserId = typeof body?.userId === 'string' ? body.userId.trim().slice(0, 64) : '';
    if (!targetUserId) throw new HttpError(400, 'Selecione a conversa.');
    await markUserMessagesRead(targetUserId);
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível carregar as mensagens agora.');
  }
}
