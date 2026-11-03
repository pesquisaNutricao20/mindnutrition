import { handleApiError, methodNotAllowed, sendJson } from './_lib/http.js';
import { isSupabaseAdminConfigured, supabaseAdminRequest } from './_lib/supabaseAdmin.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');

  if (!isSupabaseAdminConfigured()) {
    return sendJson(response, 503, { message: 'A biblioteca remota ainda não está configurada.' });
  }

  try {
    const rows = await supabaseAdminRequest('/rest/v1/articles', {
      query: {
        select: '*',
        published: 'eq.true',
        order: 'created_at.desc',
        limit: 200,
      },
    });
    return sendJson(response, 200, { articles: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível carregar a biblioteca agora.');
  }
}
