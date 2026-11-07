import { cleanText } from './groq.js';

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const summarizeMetric = (entries) => {
  if (!Array.isArray(entries) || !entries.length) return undefined;
  const safe = entries
    .slice(-6)
    .map((entry) => ({
      date: cleanText(entry?.date, 24),
      value: toFiniteNumber(entry?.value),
    }))
    .filter((entry) => entry.date && Number.isFinite(entry.value));
  if (safe.length < 2) return safe.length ? safe : undefined;
  const first = safe[0].value;
  const last = safe[safe.length - 1].value;
  return {
    first,
    last,
    delta: Number((last - first).toFixed(2)),
    points: safe,
  };
};

export function prepareInsightPrompt(payload) {
  const profile = payload?.profile && typeof payload.profile === 'object' ? payload.profile : {};
  const meals = Array.isArray(payload?.meals) ? payload.meals.slice(-30) : [];
  const diary = Array.isArray(profile.dailyNotes) ? profile.dailyNotes.slice(-7) : [];
  const sleep = Array.isArray(profile.sleepLogs) ? profile.sleepLogs.slice(-7) : [];

  const safeMeals = meals.map((meal) => ({
    date: cleanText(meal?.date, 24),
    day: cleanText(meal?.time, 12),
    hungerType: cleanText(meal?.hungerType || meal?.inferredType || meal?.type, 24),
    preHunger: toFiniteNumber(meal?.preHunger),
    postHunger: toFiniteNumber(meal?.postHunger),
    satisfaction: toFiniteNumber(meal?.satisfaction),
    preMood: cleanText(meal?.preMood, 32),
    postMood: cleanText(meal?.postMood || meal?.mood, 32),
    note: cleanText(meal?.notes || meal?.description, 180),
  }));

  const physicalCount = safeMeals.filter((meal) => /f[ií]sica/i.test(meal.hungerType)).length;
  const emotionalCount = safeMeals.filter((meal) => /emocional/i.test(meal.hungerType)).length;
  const averageSatisfaction = (() => {
    const values = safeMeals.map((meal) => meal.satisfaction).filter((value) => Number.isFinite(value));
    if (!values.length) return undefined;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
  })();

  const context = {
    objetivo: Array.isArray(profile.objectives)
      ? profile.objectives.map((item) => cleanText(item, 40)).filter(Boolean).slice(0, 4)
      : [],
    faixaEtaria: Number.isFinite(Number(profile.age))
      ? `${Math.floor(Number(profile.age) / 10) * 10}-${Math.floor(Number(profile.age) / 10) * 10 + 9}`
      : undefined,
    imc: toFiniteNumber(profile.imc),
    alturaCm: toFiniteNumber(profile.height),
    sinaisCalculados: payload?.signals && typeof payload.signals === 'object' ? payload.signals : {},
    refeicoesResumo: {
      total: safeMeals.length,
      fisica: physicalCount,
      emocional: emotionalCount,
      satisfacaoMedia: averageSatisfaction,
    },
    refeicoes: safeMeals,
    diario: Array.isArray(diary)
      ? diary.map((entry) => ({
        date: cleanText(entry?.date, 24),
        humor: cleanText(entry?.mood, 32),
        nota: cleanText(entry?.text, 240),
      }))
      : [],
    sono: Array.isArray(sleep)
      ? sleep.map((entry) => ({
        date: cleanText(entry?.date, 24),
        horas: toFiniteNumber(entry?.hours),
        qualidade: cleanText(entry?.quality, 32),
      }))
      : [],
    medidas: {
      peso: summarizeMetric(profile.weightEvolution),
      cintura: summarizeMetric(profile.waistEvolution),
      abdomen: summarizeMetric(profile.abdomenEvolution),
      quadril: summarizeMetric(profile.hipEvolution),
    },
  };

  return `Você é o Mascote Nutre do Mind Nutrition. Escreva em português do Brasil, com acolhimento e sem julgamento, sempre a partir da nutrição comportamental.

TAREFA
Analise apenas o resumo anonimizado abaixo e destaque padrões observáveis entre rotina alimentar, fome física/emocional, saciedade, humor, diário, sono e evolução corporal.

REGRAS OBRIGATÓRIAS (nutrição comportamental)
- Não diagnostique, não prescreva dieta e não prometa resultados.
- Nunca cite calorias, macronutrientes, metas calóricas, gramas, porções ou qualquer número de composição nutricional.
- Nunca classifique alimentos como "bons" ou "ruins" e nunca associe comida a culpa, pecado ou recompensa.
- Evite linguagem de cobrança, controle, restrição ou "deveria". Nada que possa deixar a pessoa desconfortável.
- Não comente peso, medidas ou IMC de forma valorativa. Se citar evolução, faça isso de forma neutra, sem metas.
- Nunca use tom de culpa, restrição ou cobrança.
- Não invente dados. Se a base for pequena, diga isso com clareza.
- Use no máximo 3 observações, cada uma ligada a algum dado do resumo.
- Você pode citar números de comportamento do resumo (ex.: satisfação média, dias registrados, horas de sono), nunca números nutricionais.
- Foque em comportamento: horários, emoções, fome e saciedade, sono, contexto e relação com a comida.
- Termine com uma sugestão gentil, possível e sem restrição, e lembre que o conteúdo é educativo e não substitui acompanhamento profissional.

FORMATO (markdown simples, obrigatório)
- Primeira parte: uma abertura de até 2 frases, sem título.
- Depois, exatamente três linhas de observação, cada uma começando com "- " e com até 2 frases.
- Encerre com uma linha começando exatamente por "Sugestão: ".
- Use **negrito** apenas para destacar números ou palavras-chave (máximo 4 destaques). Não use títulos com "#", tabelas, links ou blocos de código.
- Separe a abertura das observações com uma linha em branco.

RESUMO DE DADOS
${JSON.stringify(context)}`;
}

export function splitSummary(summary) {
  return String(summary || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);
}
