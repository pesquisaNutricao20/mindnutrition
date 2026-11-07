import { HttpError } from './http.js';

export function getSupabaseAdminConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_PUBLICSUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  return { url, serviceKey };
}

export function isSupabaseAdminConfigured() {
  const { url, serviceKey } = getSupabaseAdminConfig();
  return Boolean(url && serviceKey);
}

export async function supabaseAdminRequest(path, { method = 'GET', query, body, headers = {}, timeoutMs = 20000 } = {}) {
  const { url, serviceKey } = getSupabaseAdminConfig();
  if (!url || !serviceKey) {
    throw new HttpError(503, 'O Supabase ainda não foi configurado no servidor para o painel administrativo.');
  }

  const search = query
    ? `?${Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&')}`
    : '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}${path}${search}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

    if (!response.ok) {
      const detail = payload && typeof payload === 'object'
        ? { code: payload.code, message: payload.message, hint: payload.hint }
        : undefined;
      console.error('[supabase-admin]', response.status, detail);
      if (response.status === 404) {
        throw new HttpError(503, 'A tabela necessária ainda não existe no Supabase. Rode as migrações do projeto.');
      }
      if (response.status === 409) {
        throw new HttpError(409, 'Esse registro já existe ou o horário acabou de ser reservado. Tente outra opção.');
      }
      throw new HttpError(502, 'Não foi possível consultar o Supabase agora.');
    }

    return payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === 'AbortError') {
      throw new HttpError(504, 'O Supabase demorou demais para responder.');
    }
    throw new HttpError(502, 'Não foi possível conectar ao Supabase.');
  } finally {
    clearTimeout(timer);
  }
}
