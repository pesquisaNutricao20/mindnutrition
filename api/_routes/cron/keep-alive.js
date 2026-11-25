import {
  constantTimeEqual,
  handleApiError,
  methodNotAllowed,
  sendJson,
} from '../../_lib/http.js';
import { supabaseAdminRequest } from '../../_lib/supabaseAdmin.js';

const INTERVAL_DAYS = 6;

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');

  const secret = process.env.CRON_SECRET;
  if (!secret || !constantTimeEqual(request.headers?.authorization, `Bearer ${secret}`)) {
    return sendJson(response, 401, { message: 'Não autorizado.' });
  }

  // Hobby da Vercel só permite cron diário; o módulo mantém o intervalo de 6 dias
  // mesmo quando o mês termina em dia não múltiplo de 6.
  const force = new URL(request.url || '/', 'http://localhost').searchParams.get('force') === '1';
  const epochDay = Math.floor(Date.now() / 86_400_000);
  const remainder = epochDay % INTERVAL_DAYS;
  if (!force && remainder !== 0) {
    return sendJson(response, 200, { ok: true, pinged: false, nextInDays: INTERVAL_DAYS - remainder });
  }

  try {
    // Uma leitura mínima: SELECT id FROM profiles LIMIT 1.
    await supabaseAdminRequest('/rest/v1/profiles', {
      query: { select: 'id', limit: 1 },
      timeoutMs: 10000,
    });
    return sendJson(response, 200, { ok: true, pinged: true, at: new Date().toISOString() });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível consultar o Supabase.');
  }
}
