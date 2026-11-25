import { HttpError } from './http.js';

// Endpoint compatível com a API OpenAI da Gemini. A chave fica somente no servidor.
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-flash-lite';
export const VISION_MODEL = process.env.GEMINI_VISION_MODEL || TEXT_MODEL;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function callGemini({
  messages,
  model = TEXT_MODEL,
  temperature = 0.4,
  maxTokens = 700,
  timeoutMs = 45000,
  json = false,
}) {
  if (!isGeminiConfigured()) {
    throw new HttpError(503, 'A inteligência artificial ainda não foi configurada no servidor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
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
    throw new HttpError(429, 'Muitas solicitações em pouco tempo. Tente novamente em alguns segundos.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, 'A chave da inteligência artificial não foi aceita pelo provedor.');
  }
  if (!response.ok) {
    const detail = typeof payload?.error?.message === 'string'
      ? payload.error.message.replace(/\s+/g, ' ').trim().slice(0, 160)
      : '';
    const status = response.status >= 500 ? 502 : 400;
    throw new HttpError(status, detail ? `O provedor de IA retornou um erro: ${detail}` : 'O provedor de IA não conseguiu responder agora.');
  }

  const content = typeof payload?.choices?.[0]?.message?.content === 'string'
    ? payload.choices[0].message.content.trim()
    : '';
  if (!content) {
    throw new HttpError(502, 'A inteligência artificial não retornou uma resposta válida.');
  }

  return { content, usage: payload?.usage || null, model, provider: 'gemini' };
}
