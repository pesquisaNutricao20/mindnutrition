import { config as loadEnvironment } from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3001);
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const requestWindows = new Map();

loadEnvironment({ path: path.join(rootDirectory, '.env.local'), quiet: true });
loadEnvironment({ path: path.join(rootDirectory, '.env'), quiet: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '96kb' }));

const cleanText = (value, maxLength = 180) => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
  : '';

function acceptsRequest(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const recent = (requestWindows.get(ip) || []).filter(timestamp => now - timestamp < windowMs);
  if (recent.length >= 5) return false;
  recent.push(now);
  requestWindows.set(ip, recent);
  return true;
}

function prepareInsightPrompt(payload) {
  const profile = payload?.profile && typeof payload.profile === 'object' ? payload.profile : {};
  const meals = Array.isArray(payload?.meals) ? payload.meals.slice(-30) : [];
  const diary = Array.isArray(profile.dailyNotes) ? profile.dailyNotes.slice(-5) : [];
  const sleep = Array.isArray(profile.sleepLogs) ? profile.sleepLogs.slice(-7) : [];
  const metrics = ['weightEvolution', 'waistEvolution', 'abdomenEvolution', 'hipEvolution']
    .map(key => ({ key, entries: Array.isArray(profile[key]) ? profile[key].slice(-4) : [] }))
    .filter(group => group.entries.length);

  const safeMeals = meals.map(meal => ({
    date: cleanText(meal?.date, 24),
    category: cleanText(meal?.hungerType || meal?.type || meal?.mealType, 24),
    hunger: Number.isFinite(Number(meal?.hunger)) ? Number(meal.hunger) : undefined,
    satiety: Number.isFinite(Number(meal?.satiety)) ? Number(meal.satiety) : undefined,
    mood: cleanText(meal?.mood, 32),
    note: cleanText(meal?.notes || meal?.description, 140),
  }));

  const safeDiary = diary.map(entry => ({
    date: cleanText(entry?.date, 24),
    mood: cleanText(entry?.mood, 32),
    note: cleanText(entry?.text, 220),
  }));

  const safeSleep = sleep.map(entry => ({
    date: cleanText(entry?.date, 24),
    hours: Number.isFinite(Number(entry?.hours)) ? Number(entry.hours) : undefined,
    quality: cleanText(entry?.quality, 32),
  }));

  const context = {
    objective: Array.isArray(profile.objectives) ? profile.objectives.map(item => cleanText(item, 40)).filter(Boolean).slice(0, 4) : [],
    ageRange: Number.isFinite(Number(profile.age)) ? `${Math.floor(Number(profile.age) / 10) * 10}-${Math.floor(Number(profile.age) / 10) * 10 + 9}` : undefined,
    imc: Number.isFinite(Number(profile.imc)) ? Number(profile.imc) : undefined,
    deterministicSignals: payload?.signals && typeof payload.signals === 'object' ? payload.signals : {},
    meals: safeMeals,
    diary: safeDiary,
    sleep: safeSleep,
    metrics,
  };

  return `Você é o Mascote IA do Mind Nutrition. Analise somente o resumo anonimizado abaixo e escreva em português do Brasil.

Objetivo: ajudar a pessoa a observar padrões entre rotina alimentar, fome física/emocional, saciedade, humor, diário, sono e evolução corporal. Não diagnostique, não prescreva dieta, não calcule metas calóricas e não use tom de culpa. Se a base estiver pequena, diga isso com clareza e sugira um próximo registro simples. Não invente dados.

Formato: uma abertura acolhedora de até 2 frases e, em seguida, 3 observações acionáveis curtas. Termine com uma sugestão gentil e indique que isso não substitui acompanhamento profissional quando houver sinais insuficientes ou assunto de saúde.

Resumo de dados:
${JSON.stringify(context)}`;
}

app.post('/api/ai-insight', async (request, response) => {
  if (!process.env.OPEN_ROUTER_KEY) {
    return response.status(503).json({ message: 'O resumo de IA ainda não foi configurado no servidor.' });
  }
  if (!acceptsRequest(request.ip || 'unknown')) {
    return response.status(429).json({ message: 'Aguarde alguns minutos antes de gerar outro resumo.' });
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPEN_ROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-OpenRouter-Title': 'Mind Nutrition',
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m3:free',
        messages: [
          { role: 'system', content: 'Você oferece educação e reflexão em alimentação consciente; não presta atendimento médico.' },
          { role: 'user', content: prepareInsightPrompt(request.body) },
        ],
        temperature: 0.45,
        max_tokens: 420,
      }),
    });
    const result = await upstream.json().catch(() => ({}));
    const summary = cleanText(result?.choices?.[0]?.message?.content, 2200);
    if (!upstream.ok || !summary) {
      return response.status(502).json({ message: 'Não foi possível gerar o resumo agora. Tente novamente mais tarde.' });
    }
    return response.json({ summary });
  } catch {
    return response.status(502).json({ message: 'Não foi possível conectar ao serviço de resumo agora.' });
  }
});

app.use(express.static(path.join(rootDirectory, 'dist')));
app.get('*', (_request, response) => response.sendFile(path.join(rootDirectory, 'dist', 'index.html')));

app.listen(port, () => {
  console.log(`Mind Nutrition disponível em http://localhost:${port}`);
});
