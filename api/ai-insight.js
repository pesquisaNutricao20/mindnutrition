import {
  assertSameOrigin,
  createRateLimiter,
  getClientIp,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from './_lib/http.js';
import { TEXT_MODEL, callGroq } from './_lib/groq.js';
import { prepareInsightPrompt } from './_lib/insightPrompt.js';

const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 6 });

// Diferente de cleanText: mantém as quebras de linha para o cliente conseguir
// separar abertura, observações e sugestão em blocos formatados.
function normalizeSummary(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2600);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');

  try {
    assertSameOrigin(request);
  } catch (error) {
    return handleApiError(response, error);
  }

  const limit = limiter.consume(getClientIp(request));
  if (!limit.allowed) {
    return sendJson(response, 429, {
      message: `Aguarde ${limit.retryAfter || 60} segundos antes de gerar outro resumo.`,
    });
  }

  try {
    const payload = await readJsonBody(request, 512 * 1024);
    const prompt = prepareInsightPrompt(payload);
    const { content, usage } = await callGroq({
      model: TEXT_MODEL,
      temperature: 0.38,
      maxTokens: 900,
      messages: [
        {
          role: 'system',
          content: 'Você é o Mascote Nutre. Oferece educação e reflexão em alimentação consciente, com linguagem gentil, e nunca presta atendimento médico.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const summary = normalizeSummary(content);
    if (!summary) {
      return sendJson(response, 502, { message: 'A IA não retornou um resumo válido. Tente novamente.' });
    }

    return sendJson(response, 200, { summary, model: TEXT_MODEL, usage });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível gerar a leitura da sua jornada agora.');
  }
}
