import { createAdminSessionToken, isAdminConfigured, setAdminSessionCookie, verifyAdminPassword } from '../_lib/admin.js';
import {
  HttpError,
  assertSameOrigin,
  createRateLimiter,
  getClientIp,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from '../_lib/http.js';

const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 8, blockMs: 10 * 60 * 1000 });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');

  try {
    assertSameOrigin(request);
  } catch (error) {
    return handleApiError(response, error);
  }

  const ip = getClientIp(request);
  const limit = loginLimiter.consume(ip);
  if (!limit.allowed) {
    return sendJson(response, 429, {
      message: `Muitas tentativas. Aguarde ${limit.retryAfter || 600} segundos e tente novamente.`,
    }, { 'Retry-After': String(limit.retryAfter || 600) });
  }

  try {
    if (!isAdminConfigured()) {
      throw new HttpError(503, 'O acesso administrativo ainda não foi configurado. Defina ADMIN_KEY_HASH no servidor.');
    }

    const body = await readJsonBody(request, 8 * 1024);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || password.length > 256) {
      throw new HttpError(400, 'Informe a senha administrativa.');
    }

    const valid = verifyAdminPassword(password);
    if (!valid) {
      await wait(350);
      throw new HttpError(401, 'Senha incorreta. Verifique e tente novamente.');
    }

    loginLimiter.reset(ip);
    const { token, expiresAt } = createAdminSessionToken();
    setAdminSessionCookie(request, response, token, expiresAt);
    return sendJson(response, 200, {
      authorized: true,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível validar o acesso administrativo.');
  }
}
