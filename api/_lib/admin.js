import {
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import {
  HttpError,
  appendSetCookie,
  constantTimeEqual,
  isSecureRequest,
  parseCookies,
} from './http.js';

export const ADMIN_COOKIE = 'mn_admin';
const SESSION_VERSION = 1;
const DEFAULT_TTL_HOURS = 8;

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');
const base64UrlDecode = (value) => Buffer.from(String(value), 'base64url');

const digest = (value) => createHash('sha256').update(String(value)).digest();

function getAdminHash() {
  return String(process.env.ADMIN_KEY_HASH || '').trim();
}

function getAdminPlainKey() {
  return String(process.env.ADMIN_KEY || '').trim();
}

export function isAdminConfigured() {
  return Boolean(getAdminHash() || getAdminPlainKey());
}

function parseHash(value) {
  const parts = String(value).split('$');
  const scheme = parts[0];
  if (scheme === 'scrypt' && parts.length === 6) {
    const [, n, r, p, salt, key] = parts;
    return {
      scheme,
      N: Number(n),
      r: Number(r),
      p: Number(p),
      salt: base64UrlDecode(salt),
      key: base64UrlDecode(key),
    };
  }
  if (scheme === 'pbkdf2' && parts.length === 4) {
    const [, iterations, salt, key] = parts;
    return {
      scheme,
      iterations: Number(iterations),
      salt: base64UrlDecode(salt),
      key: base64UrlDecode(key),
    };
  }
  throw new HttpError(503, 'O hash da senha administrativa está em um formato inválido.');
}

function isSafeScryptParams({ N, r, p }) {
  return Number.isInteger(N) && N >= 4096 && N <= 262144
    && Number.isInteger(r) && r >= 1 && r <= 32
    && Number.isInteger(p) && p >= 1 && p <= 16;
}

export function hashAdminPassword(password, { N = 32768, r = 8, p = 1 } = {}) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Use uma senha com pelo menos 8 caracteres para o administrador.');
  }
  if (!isSafeScryptParams({ N, r, p })) {
    throw new Error('Parâmetros de hash inválidos.');
  }
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32, { N, r, p, maxmem: 256 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${base64UrlEncode(salt)}$${base64UrlEncode(key)}`;
}

export function verifyAdminPassword(password) {
  if (!isAdminConfigured()) {
    throw new HttpError(503, 'O acesso administrativo ainda não foi configurado. Defina ADMIN_KEY_HASH no servidor.');
  }
  if (typeof password !== 'string' || !password || password.length > 256) return false;

  const configuredHash = getAdminHash();
  if (configuredHash) {
    const parsed = parseHash(configuredHash);
    let derived;
    if (parsed.scheme === 'scrypt') {
      if (!isSafeScryptParams(parsed)) return false;
      derived = scryptSync(password, parsed.salt, parsed.key.length, {
        N: parsed.N,
        r: parsed.r,
        p: parsed.p,
        maxmem: 256 * 1024 * 1024,
      });
    } else {
      const iterations = Number(parsed.iterations);
      if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 2000000) return false;
      derived = pbkdf2Sync(password, parsed.salt, iterations, parsed.key.length, 'sha256');
    }
    if (derived.length !== parsed.key.length) return false;
    return timingSafeEqual(derived, parsed.key);
  }

  return constantTimeEqual(digest(password), digest(getAdminPlainKey()));
}

function getSessionSecret() {
  const explicit = String(process.env.ADMIN_SESSION_SECRET || '').trim();
  if (explicit) return explicit;
  const material = getAdminHash() || getAdminPlainKey();
  return createHash('sha256').update(`mind-nutrition-admin-session:${material}`).digest('hex');
}

function signPayload(payload) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function getSessionTtlMs() {
  const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS);
  const safeHours = Number.isFinite(hours) && hours > 0 && hours <= 72 ? hours : DEFAULT_TTL_HOURS;
  return safeHours * 60 * 60 * 1000;
}

export function createAdminSessionToken() {
  const expiresAt = Date.now() + getSessionTtlMs();
  const payload = base64UrlEncode(JSON.stringify({ v: SESSION_VERSION, exp: expiresAt }));
  return { token: `${payload}.${signPayload(payload)}`, expiresAt };
}

export function verifyAdminSessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(payload).toString('utf8'));
    if (parsed?.v !== SESSION_VERSION) return null;
    if (!Number.isFinite(parsed?.exp) || parsed.exp <= Date.now()) return null;
    return { expiresAt: parsed.exp };
  } catch {
    return null;
  }
}

function buildCookie(req, value, maxAgeSeconds) {
  const attributes = [
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (isSecureRequest(req)) attributes.push('Secure');
  return attributes.join('; ');
}

export function setAdminSessionCookie(req, response, token, expiresAt) {
  appendSetCookie(response, buildCookie(req, token, Math.ceil((expiresAt - Date.now()) / 1000)));
}

export function clearAdminSessionCookie(req, response) {
  appendSetCookie(response, buildCookie(req, '', 0));
}

export function readAdminSession(request) {
  const cookies = parseCookies(request);
  return verifyAdminSessionToken(cookies[ADMIN_COOKIE]);
}

export function requireAdmin(request, response) {
  const session = readAdminSession(request);
  if (!session) {
    response.statusCode = 401;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({ message: 'Sessão administrativa expirada. Entre novamente.' }));
    return null;
  }
  return session;
}

export function getAdminSessionSummary(request) {
  const session = readAdminSession(request);
  if (!session) return null;
  return { authorized: true, expiresAt: new Date(session.expiresAt).toISOString() };
}
