import { requireUser } from '../_lib/auth.js';
import {
  assertSameOrigin,
  createRateLimiter,
  getClientIp,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from '../_lib/http.js';
import { TEXT_MODEL, callGroq } from '../_lib/groq.js';
import { prepareInsightPrompt } from '../_lib/insightPrompt.js';

const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 6 });
const userLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 40, blockMs: 10 * 60 * 1000 });

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
    const user = await requireUser(request);
    const userLimit = userLimiter.consume(`user:${user.id}`);
    if (!userLimit.allowed) {
      return sendJson(response, 429, {
        message: `Aguarde ${userLimit.retryAfter || 600} segundos antes de gerar outro resumo.`,
      }, { 'Retry-After': String(userLimit.retryAfter || 600) });
    }

    const payload = await readJsonBody(request, 512 * 1024);
    const prompt = prepareInsightPrompt(payload);
    const { content, usage, model, provider } = await callGroq({
      model: TEXT_MODEL,
      temperature: 0.38,
      maxTokens: 900,
      messages: [
        {
          role: 'system',
          content: 'Você é o Mascote Nutre. Oferece educação e reflexão em alimentação consciente com base em nutrição comportamental, com linguagem gentil e sem julgamento. Nunca cita calorias, macronutrientes, metas ou números de composição nutricional, nunca classifica alimentos como bons ou ruins e nunca presta atendimento médico.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const summary = normalizeSummary(content);
    if (!summary) {
      return sendJson(response, 502, { message: 'A IA não retornou um resumo válido. Tente novamente.' });
    }

    return sendJson(response, 200, { summary, model: model || TEXT_MODEL, provider: provider || 'groq', usage });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível gerar a leitura da sua jornada agora.');
  }
}
