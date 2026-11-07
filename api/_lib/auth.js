import { HttpError } from './http.js';
import { getSupabaseAdminConfig } from './supabaseAdmin.js';

/**
 * Valida o access token do Supabase enviado pelo cliente e devolve o usuário
 * autenticado. Nunca confia em user_id vindo do corpo da requisição.
 */
export async function requireUser(request) {
  const header = String(request.headers?.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Entre na sua conta para continuar.');

  const { url, serviceKey } = getSupabaseAdminConfig();
  if (!url || !serviceKey) {
    throw new HttpError(503, 'O Supabase ainda não está configurado no servidor para este recurso.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HttpError(401, 'Sua sessão expirou. Entre novamente para continuar.');
    }

    const user = await response.json().catch(() => null);
    if (!user?.id) throw new HttpError(401, 'Sua sessão expirou. Entre novamente para continuar.');

    return {
      id: String(user.id),
      email: typeof user.email === 'string' ? user.email : '',
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === 'AbortError') {
      throw new HttpError(504, 'A validação da sua sessão demorou demais. Tente novamente.');
    }
    throw new HttpError(502, 'Não foi possível validar sua sessão agora.');
  } finally {
    clearTimeout(timer);
  }
}
