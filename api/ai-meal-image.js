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

const listOfFoods = (value, maxItems = 12) => (
  Array.isArray(value)
    ? value
      .map((item) => {
        const name = cleanText(typeof item === 'string' ? item : item?.alimento || item?.name, 80);
        if (!name) return null;
        const confidence = cleanText(item?.confianca || item?.confidence, 20).toLowerCase();
        const normalized = confidence === 'alta' ? 'alta' : confidence === 'baixa' ? 'baixa' : 'média';
        return { name, confidence: normalized };
      })
      .filter(Boolean)
      .slice(0, maxItems)
    : []
);

function normalizeAnalysis(raw, fallbackSummary) {
  // Garantia adicional: itens de baixa confiança nunca entram na análise;
  // eles são movidos para "não identificados" e informados à pessoa.
  const identifiedRaw = listOfFoods(raw?.identificados || raw?.identified);
  const identified = identifiedRaw.filter((item) => item.confidence !== 'baixa');
  const lowConfidence = identifiedRaw
    .filter((item) => item.confidence === 'baixa')
    .map((item) => `${item.name} — não incluído por incerteza`);

  return {
    dish: cleanText(raw?.prato || raw?.dish, 80) || 'Refeição observada',
    summary: cleanText(raw?.resumo || raw?.summary, 700) || cleanText(fallbackSummary, 700),
    identified,
    unrecognized: [...listOfText(raw?.naoIdentificados || raw?.unrecognized, 8, 160), ...lowConfidence].slice(0, 8),
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

    const prompt = `Você é um assistente de educação nutricional do Mind Nutrition, com abordagem de nutrição comportamental. Analise a foto de uma refeição e devolva SOMENTE um JSON válido, sem markdown e sem texto fora do JSON.

Regras de nutrição comportamental (obrigatórias):
- Nunca julgue a escolha, o prato ou a pessoa. Não use palavras como "erro", "falha", "deslize", "excesso", "culpa" ou "deveria".
- Nunca informe calorias, macronutrientes, gramas, metas calóricas ou qualquer número de composição nutricional.
- Não prescreva dieta, não diagnostique e não prometa resultados.
- Fale sobre variedade, cores, texturas, presença de grupos de alimentos, prazer e sinais de fome/saciedade, sempre com acolhimento.

Regras de reconhecimento (obrigatórias):
- Inclua em "identificados" apenas alimentos que você reconhece com segurança razoável na imagem.
- Se não tiver certeza de um alimento (por exemplo: molho, recheio, acompanhamento parcialmente escondido), NÃO o inclua em "identificados" nem em qualquer análise.
- Liste cada item incerto ou omitido em "naoIdentificados" com um texto curto e honesto (ex.: "possível molho — não incluído por incerteza").
- Se nada puder ser identificado com segurança, deixe "identificados" vazio e explique isso em "resumo" e em "naoIdentificados".
- O campo "resumo" deve deixar claro que a análise considerou apenas o que foi identificado com segurança e citar brevemente o que ficou de fora.

Formato exato:
{
  "prato": "nome provável do prato ou 'Refeição observada'",
  "resumo": "2 a 3 frases acolhedoras sobre o que foi identificado e o que ficou fora da análise",
  "identificados": [{ "alimento": "nome do alimento", "confianca": "alta | média" }],
  "naoIdentificados": ["item incerto — não incluído por incerteza"],
  "cores": ["cor 1", "cor 2", "cor 3"],
  "equilibrio": "leitura gentil sobre variedade e equilíbrio do prato, sem números",
  "pontosDeAtencao": ["observação gentil 1", "observação gentil 2"],
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
          content: 'Você analisa fotos de refeições para educação nutricional com nutrição comportamental. Só menciona alimentos identificados com segurança; o que é incerto fica fora da análise e é informado com honestidade. Nunca cita calorias, macros, números de porção, nunca julga e nunca dá diagnóstico.',
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
