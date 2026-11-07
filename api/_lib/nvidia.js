import { HttpError } from './http.js';

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

export const NVIDIA_MODEL = process.env.NVIDIA_TEXT_MODEL || 'minimaxai/minimax-m3.1-flash';

export function isNvidiaConfigured() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export async function callNvidia({ messages, temperature = 0.4, maxTokens = 700, timeoutMs = 45000 }) {
  if (!isNvidiaConfigured()) {
    throw new HttpError(503, 'O provedor alternativo de IA não foi configurado no servidor.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(NVIDIA_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new HttpError(504, 'A análise demorou mais que o esperado. Tente novamente.');
    }
    throw new HttpError(502, 'Não foi possível conectar ao serviço alternativo de inteligência artificial.');
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);

  if (response.status === 429) {
    throw new HttpError(429, 'Muitas solicitações em pouco tempo. Tente novamente em alguns segundos.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, 'A chave do provedor alternativo de IA não foi aceita.');
  }
  if (!response.ok) {
    const detail = typeof payload?.error?.message === 'string'
      ? payload.error.message.replace(/\s+/g, ' ').trim().slice(0, 160)
      : '';
    throw new HttpError(502, detail ? `O provedor alternativo retornou um erro: ${detail}` : 'O provedor alternativo de IA não conseguiu responder agora.');
  }

  const content = typeof payload?.choices?.[0]?.message?.content === 'string'
    ? payload.choices[0].message.content.trim()
    : '';
  if (!content) {
    throw new HttpError(502, 'O provedor alternativo de IA não retornou uma resposta válida.');
  }

  return { content, usage: payload?.usage || null, model: NVIDIA_MODEL, provider: 'nvidia' };
}
