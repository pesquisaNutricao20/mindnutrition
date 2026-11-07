import { HttpError } from './http.js';
import { callNvidia, isNvidiaConfigured } from './nvidia.js';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// A Groq hospeda o GPT-OSS 120B (texto). Para fotos usamos o Qwen 3.8, o modelo
// multimodal disponível na Groq, pois o gpt-oss-120b não aceita imagens.
export const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b';
export const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export function cleanText(value, maxLength = 180) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

async function callGroqProvider({
  messages,
  model = TEXT_MODEL,
  temperature = 0.4,
  maxTokens = 700,
  json = false,
  timeoutMs = 45000,
}) {
  if (!isGroqConfigured()) {
    throw new HttpError(503, 'A inteligência artificial ainda não foi configurada no servidor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new HttpError(504, 'A análise demorou mais que o esperado. Tente novamente.');
    }
    throw new HttpError(502, 'Não foi possível conectar ao serviço de inteligência artificial.');
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 20;
    throw new HttpError(429, `Muitas solicitações em pouco tempo. Tente novamente em ${Math.max(5, Math.ceil(wait))} segundos.`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, 'A chave da inteligência artificial não foi aceita pelo provedor.');
  }
  if (!response.ok) {
    const detail = cleanText(payload?.error?.message, 160);
    const status = response.status >= 500 ? 502 : 400;
    throw new HttpError(status, detail ? `O provedor de IA retornou um erro: ${detail}` : 'O provedor de IA não conseguiu responder agora.');
  }

  const message = payload?.choices?.[0]?.message;
  const content = typeof message?.content === 'string' ? message.content.trim() : '';
  if (!content) {
    throw new HttpError(502, 'A inteligência artificial não retornou uma resposta válida.');
  }

  return { content, usage: payload?.usage || null, model, provider: 'groq' };
}

const FALLBACK_STATUSES = new Set([429, 500, 502, 503, 504]);

// Fallback de texto para a NVIDIA (MiniMax M3.1). O modelo é somente texto,
// então análise de fotos permanece exclusivamente na Groq.
export async function callGroq(options) {
  const vision = (options?.model || TEXT_MODEL) === VISION_MODEL;

  if (!isGroqConfigured()) {
    if (!vision && isNvidiaConfigured()) return callNvidia(options);
    throw new HttpError(503, 'A inteligência artificial ainda não foi configurada no servidor.');
  }

  try {
    return await callGroqProvider(options);
  } catch (error) {
    if (vision || !isNvidiaConfigured() || !FALLBACK_STATUSES.has(error?.status)) throw error;
    return callNvidia(options);
  }
}

export function parseJsonContent(content) {
  const trimmed = String(content || '').trim();
  const withoutFence = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
