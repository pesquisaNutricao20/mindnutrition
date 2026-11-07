import { methodNotAllowed, sendJson } from '../_lib/http.js';

export default function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');

  return sendJson(response, 200, {
    ok: true,
    ai: Boolean(process.env.GROQ_API_KEY),
    admin: Boolean(process.env.ADMIN_KEY_HASH || process.env.ADMIN_KEY),
    supabaseAdmin: Boolean(
      (process.env.SUPABASE_URL || process.env.VITE_PUBLICSUPABASE_URL)
      && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
    ),
  });
}
