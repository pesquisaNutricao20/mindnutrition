import {
  HttpError,
  assertSameOrigin,
  createRateLimiter,
  getClientIp,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from './_lib/http.js';
import {
  VISION_MODEL,
  callGroq,
  cleanText,
  parseJsonContent,
} from './_lib/groq.js';

const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 14 });
const DATA_URL_PATTERN = /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/;
const MAX_IMAGE_CHARS = 7.5 * 1024 * 1024;

const listOfText = (value, maxItems = 6, maxLength = 120) => (
  Array.isArray(value)
    ? value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : []
);

function normalizeAnalysis(raw, fallbackSummary) {
  const nutrients = raw?.nutrientes && typeof raw.nutrientes === 'object' ? raw.nutrientes : {};
  const toLabel = (value) => cleanText(value, 60) || 'Não estimado';
  return {
    dish: cleanText(raw?.prato || raw?.dish, 80) || 'Refeição identificada',
    summary: cleanText(raw?.resumo || raw?.summary, 700) || cleanText(fallbackSummary, 700),
    nutrients: {
      calories: toLabel(nutrients.calorias ?? nutrients.calories),
      protein: toLabel(nutrients.proteinas ?? nutrients.protein),
      carbs: toLabel(nutrients.carboidratos ?? nutrients.carbs),
      fat: toLabel(nutrients.gorduras ?? nutrients.fat),
      fiber: toLabel(nutrients.fibras ?? nutrients.fiber),
      sugar: toLabel(nutrients.acucares ?? nutrients.sugar),
    },
    colors: listOfText(raw?.cores || raw?.colors, 6, 40),
    balance: cleanText(raw?.equilibrio || raw?.balance, 400),
    attentionPoints: listOfText(raw?.pontosDeAtencao || raw?.alerts, 5, 160),
    confidence: cleanText(raw?.confianca || raw?.confidence, 20).toLowerCase() || 'média',
  };
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
      message: `Aguarde ${limit.retryAfter || 60} segundos para analisar outra imagem.`,
    });
  }

  try {
    const body = await readJsonBody(request, 8 * 1024 * 1024);
    const image = typeof body?.image === 'string' ? body.image.trim() : '';
    const description = cleanText(body?.description, 600);

    if (!image) throw new HttpError(400, 'Envie uma foto da refeição para analisar.');
    if (image.length > MAX_IMAGE_CHARS) throw new HttpError(413, 'A foto é grande demais. Tente uma imagem menor.');
    if (!DATA_URL_PATTERN.test(image)) {
      throw new HttpError(400, 'Formato de imagem não aceito. Use JPG, PNG ou WEBP.');
    }

    const prompt = `Você é um assistente de educação nutricional do Mind Nutrition. Analise a foto de uma refeição e devolva SOMENTE um JSON válido, sem markdown e sem texto fora do JSON.

Regras:
- Apenas estime com base no que está visível. Não invente ingredientes escondidos.
- Use faixas aproximadas, com unidade, e sinalize incerteza (ex.: "~ 450-550 kcal").
- Não prescreva dieta, não diagnostique e não julgue a escolha da pessoa.
- Descreva as cores predominantes do prato para apoiar a leitura visual.
- Responda em português do Brasil.

Formato exato:
{
  "prato": "nome provável do prato",
  "resumo": "2 a 3 frases sobre o que aparece na foto",
  "nutrientes": {
    "calorias": "faixa aproximada",
    "proteinas": "faixa aproximada",
    "carboidratos": "faixa aproximada",
    "gorduras": "faixa aproximada",
    "fibras": "faixa aproximada",
    "acucares": "faixa aproximada"
  },
  "cores": ["cor 1", "cor 2", "cor 3"],
  "equilibrio": "leitura gentil sobre variedade e equilíbrio do prato",
  "pontosDeAtencao": ["ponto 1", "ponto 2"],
  "confianca": "alta | média | baixa"
}${description ? `\n\nA pessoa descreveu a refeição assim: "${description}"` : ''}`;

    const { content } = await callGroq({
      model: VISION_MODEL,
      temperature: 0.25,
      maxTokens: 900,
      timeoutMs: 60000,
      messages: [
        {
          role: 'system',
          content: 'Você analisa fotos de refeições para educação nutricional, com estimativas visuais honestas e linguagem acolhedora. Nunca dá diagnóstico.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
    });

    const parsed = parseJsonContent(content);
    if (!parsed || typeof parsed !== 'object') {
      throw new HttpError(502, 'Não consegui interpretar a análise da imagem. Tente outra foto.');
    }

    return sendJson(response, 200, {
      analysis: normalizeAnalysis(parsed, content),
      model: VISION_MODEL,
    });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível analisar a foto agora. Tente novamente.');
  }
}
