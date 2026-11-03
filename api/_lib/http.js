import { timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const DEFAULT_JSON_LIMIT = 96 * 1024;

export function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload ?? {});
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(extraHeaders)) response.setHeader(key, value);
  response.end(body);
}

export function methodNotAllowed(response, allow) {
  response.setHeader('Allow', allow);
  return sendJson(response, 405, { message: 'Método não permitido.' });
}

export function getClientIp(request) {
  const trustProxy = process.env.TRUST_PROXY === 'true' || Boolean(process.env.VERCEL);
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = String(candidate || '').split(',')[0].trim();
    if (first) return first;
  }
  return String(request.socket?.remoteAddress || 'unknown');
}

export function readJsonBody(request, maxBytes = DEFAULT_JSON_LIMIT) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    const size = Buffer.byteLength(JSON.stringify(request.body));
    if (size > maxBytes) throw new HttpError(413, 'O conteúdo enviado é grande demais.');
    return Promise.resolve(request.body);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      request.removeAllListeners?.('data');
      request.removeAllListeners?.('end');
      request.removeAllListeners?.('error');
      reject(error);
    };

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        fail(new HttpError(413, 'O conteúdo enviado é grande demais.'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'O corpo da requisição não é um JSON válido.'));
      }
    });
    request.on('error', () => fail(new HttpError(400, 'Não foi possível ler a requisição.')));
  });
}

export function applySecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self), payment=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}

export function parseCookies(request) {
  const header = request.headers?.cookie;
  if (!header) return {};
  const result = {};
  for (const part of String(header).split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

export function appendSetCookie(response, cookie) {
  const current = response.getHeader('Set-Cookie');
  if (!current) {
    response.setHeader('Set-Cookie', cookie);
    return;
  }
  const list = Array.isArray(current) ? current : [String(current)];
  response.setHeader('Set-Cookie', [...list, cookie]);
}

export function isSecureRequest(request) {
  const proto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (proto) return proto === 'https';
  return Boolean(request.socket?.encrypted);
}

export function assertSameOrigin(request) {
  const origin = request.headers.origin;
  const referer = request.headers.referer;
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  if (!host) return;
  const candidate = origin || (referer ? new URL(referer).origin : '');
  if (!candidate) return;
  let candidateHost = '';
  try {
    candidateHost = new URL(candidate).host;
  } catch {
    throw new HttpError(403, 'Origem da requisição inválida.');
  }
  if (candidateHost !== String(host).split(',')[0].trim()) {
    throw new HttpError(403, 'Origem da requisição não autorizada.');
  }
}

export function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function createRateLimiter({ windowMs, max, blockMs = 0 }) {
  const buckets = new Map();

  const prune = (now) => {
    if (buckets.size < 500) return;
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastSeen > windowMs * 2) buckets.delete(key);
    }
  };

  return {
    consume(key) {
      const now = Date.now();
      prune(now);
      const id = String(key || 'unknown');
      const bucket = buckets.get(id) || { hits: [], blockedUntil: 0 };
      if (bucket.blockedUntil > now) {
        return { allowed: false, retryAfter: Math.ceil((bucket.blockedUntil - now) / 1000) };
      }
      bucket.hits = bucket.hits.filter((timestamp) => now - timestamp < windowMs);
      if (bucket.hits.length >= max) {
        bucket.blockedUntil = now + blockMs;
        bucket.lastSeen = now;
        buckets.set(id, bucket);
        return { allowed: false, retryAfter: Math.ceil((blockMs || windowMs) / 1000) };
      }
      bucket.hits.push(now);
      bucket.lastSeen = now;
      buckets.set(id, bucket);
      return { allowed: true, remaining: Math.max(max - bucket.hits.length, 0) };
    },
    reset(key) {
      buckets.delete(String(key || 'unknown'));
    },
  };
}

export function handleApiError(response, error, fallbackMessage) {
  if (error instanceof HttpError) {
    return sendJson(response, error.status, { message: error.message });
  }
  console.error('[api]', error);
  return sendJson(response, 502, { message: fallbackMessage || 'Não foi possível concluir a operação agora.' });
}
