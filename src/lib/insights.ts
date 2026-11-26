import type { UserProfile } from '../types';
import {
  averageNumbers,
  clampNumber,
  getLatestMetricValue,
  getMoodScore,
  inferMealType,
  toNumberOrNull,
} from './metrics';

export const calculateProfileInsightScore = (profile: Partial<UserProfile>) => {
  const latestWeight = getLatestMetricValue(profile.weightEvolution);
  const latestWaist = getLatestMetricValue(profile.waistEvolution);
  const latestHip = getLatestMetricValue(profile.hipEvolution);
  const signals = [
    Boolean(profile.name || profile.email),
    Boolean(profile.age && profile.age > 0),
    Boolean(profile.height && profile.height > 0),
    Boolean(latestWeight),
    Boolean(profile.gender),
    Boolean(profile.activityLevel && profile.activityLevel > 0 && (profile.age || profile.gender || profile.objectives?.length)),
    Boolean(profile.objectives?.length),
    Boolean(profile.initialEmotions?.length),
    Boolean(profile.triggers?.length),
    Boolean(profile.checkIns?.length),
    Boolean(latestWaist && latestHip),
  ];
  const completed = signals.filter(Boolean).length;
  if (completed <= 1) return 0;
  return clampNumber(Math.round((completed / signals.length) * 78), 0, 78);
};

export const getInitialMoodBaseline = (profile: Partial<UserProfile>) => {
  const latestCheckIn = profile.checkIns?.[profile.checkIns.length - 1]?.mood;
  if (latestCheckIn) return getMoodScore(latestCheckIn);
  const emotionScores = (profile.initialEmotions || []).map(emotion => getMoodScore(emotion));
  return averageNumbers(emotionScores);
};

export const calculateMealAwarenessScore = (meal: any) => {
  const preHunger = toNumberOrNull(meal?.preHunger);
  const postHunger = toNumberOrNull(meal?.postHunger);
  const satisfaction = toNumberOrNull(meal?.satisfaction);
  const hasMood = Boolean(meal?.preMood || meal?.postMood || meal?.mood);
  const hasNotes = typeof meal?.notes === 'string' && meal.notes.trim().length > 0;
  const hasPhoto = Array.isArray(meal?.photos) ? meal.photos.length > 0 : Boolean(meal?.image);

  let completionScore = 0;
  if (preHunger !== null && postHunger !== null) completionScore += 25;
  else if (preHunger !== null || postHunger !== null) completionScore += 12;
  if (hasMood) completionScore += 22;
  if (satisfaction !== null) completionScore += 20;
  if (hasNotes) completionScore += 23;
  else if (hasPhoto) completionScore += 8;
  if (inferMealType(meal) !== 'Não classificada') completionScore += 10;

  if (preHunger !== null && postHunger !== null) {
    const regulationScore = clampNumber(50 + ((preHunger - postHunger) * 12) + (((satisfaction || 3) - 3) * 8));
    completionScore = (completionScore * 0.75) + (regulationScore * 0.25);
  }

  return clampNumber(Math.round(completionScore));
};

export const calculateAwarenessScore = (profile: Partial<UserProfile>, meals: any[]) => {
  if (meals.length) {
    const mealScore = averageNumbers(meals.map(calculateMealAwarenessScore));
    return clampNumber(Math.round(mealScore || 0));
  }
  return calculateProfileInsightScore(profile);
};

export const buildRadarData = (profile: Partial<UserProfile>, meals: any[], awarenessScore: number) => {
  const profileScore = calculateProfileInsightScore(profile);
  const moodScore = averageNumbers(meals.flatMap(meal => [
    getMoodScore(meal?.postMood),
    getMoodScore(meal?.preMood),
    getMoodScore(meal?.mood),
  ])) ?? getInitialMoodBaseline(profile) ?? (profileScore ? 55 : 0);
  const satisfactionScore = averageNumbers(meals.map(meal => {
    const satisfaction = toNumberOrNull(meal?.satisfaction);
    return satisfaction !== null ? satisfaction * 20 : null;
  }));
  const hungerRegulationScore = averageNumbers(meals.map(meal => {
    const preHunger = toNumberOrNull(meal?.preHunger);
    const postHunger = toNumberOrNull(meal?.postHunger);
    if (preHunger === null || postHunger === null) return null;
    return clampNumber(55 + ((preHunger - postHunger) * 10));
  }));
  const uniqueMealDays = new Set(meals.map(meal => {
    const date = meal?.date ? new Date(meal.date) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('pt-BR') : null;
  }).filter(Boolean));
  const activityLevel = profile.activityLevel || 0;
  const energyScore = profile.tmb && profile.net
    ? clampNumber(48 + ((profile.net / profile.tmb) * 22), 35, 92)
    : activityLevel
      ? clampNumber(45 + ((activityLevel - 1.2) / 0.525) * 32, 38, 82)
      : (profileScore ? 48 : 0);
  const consistencyScore = meals.length
    ? clampNumber((uniqueMealDays.size * 16) + (Math.min(meals.length, 8) * 4), 20, 100)
    : (profileScore ? 32 : 0);

  return [
    { subject: 'Saciedade', A: Math.round(satisfactionScore ?? hungerRegulationScore ?? (profileScore ? 52 : 0)), B: 85, fullMark: 100 },
    { subject: 'Consciência', A: awarenessScore, B: 88, fullMark: 100 },
    { subject: 'Energia', A: Math.round(energyScore), B: 82, fullMark: 100 },
    { subject: 'Humor', A: Math.round(clampNumber(moodScore)), B: 82, fullMark: 100 },
    { subject: 'Constância', A: Math.round(consistencyScore), B: 80, fullMark: 100 },
    { subject: 'Contexto', A: profileScore, B: 86, fullMark: 100 },
  ];
};

export const getWeightGoal = (profile: Partial<UserProfile>) => {
  const latestWeight = getLatestMetricValue(profile.weightEvolution);
  if (!latestWeight) return null;
  const goals = profile.objectives || [];
  if (goals.includes('Emagrecimento consciente')) return parseFloat((latestWeight * 0.95).toFixed(1));
  if (goals.includes('Hipertrofia') || goals.includes('Ganho de peso')) return parseFloat((latestWeight * 1.05).toFixed(1));
  const firstWeight = (profile.weightEvolution || []).find(item => item.value > 0)?.value;
  return firstWeight && firstWeight !== latestWeight ? firstWeight : null;
};

export const getAwarenessNarrative = (score: number) => {
  if (score < 30) return 'Todo começo conta: registre uma refeição, uma noite de sono ou uma reflexão para tornar seus padrões mais visíveis.';
  if (score < 50) return 'Você já está reunindo sinais importantes. Pequenos registros consistentes ajudam a transformar percepção em escolhas mais conscientes.';
  if (score < 70) return 'Sua consciência está em construção sólida: você reconhece sinais do corpo e tem material para observar tendências com mais clareza.';
  if (score < 85) return 'Você demonstra boa conexão entre contexto, fome e saciedade. Continue usando os registros para ajustar sua rotina com gentileza.';
  return 'Sua jornada tem registros consistentes e contextualizados. Use os Insights para manter o que funciona e acolher os dias mais difíceis.';
};

export const buildIntegratedInsight = (profile: Partial<UserProfile>, meals: any[]) => {
  const components: Array<{ label: string; value: number; weight: number; description: string }> = [];
  if (meals.length) components.push({ label: 'Refeições', value: calculateAwarenessScore(profile, meals), weight: 45, description: 'Fome, saciedade, humor e completude dos registros.' });

  const sleepLogs = profile.sleepLogs || [];
  if (sleepLogs.length) {
    const qualityValues = { Ruim: 30, Regular: 55, Bom: 78, Excelente: 95 } as const;
    const sleepValue = averageNumbers(sleepLogs.map(log => {
      const durationScore = clampNumber(100 - Math.abs(log.hours - 8) * 18, 25, 100);
      return (durationScore * 0.55) + (qualityValues[log.quality] * 0.45);
    })) || 0;
    components.push({ label: 'Sono', value: Math.round(sleepValue), weight: 25, description: 'Duração e qualidade relatadas do descanso.' });
  }

  const notes = profile.dailyNotes || [];
  if (notes.length) {
    const moodValue = averageNumbers(notes.map(note => getMoodScore(note.mood) ?? 58)) || 58;
    const detailValue = averageNumbers(notes.map(note => clampNumber((note.text?.trim().length || 0) * 2.2, 25, 100))) || 25;
    components.push({ label: 'Diário', value: Math.round((moodValue * 0.55) + (detailValue * 0.45)), weight: 15, description: 'Humor e riqueza de contexto das reflexões.' });
  }

  const profileValue = calculateProfileInsightScore(profile);
  if (profileValue) components.push({ label: 'Perfil', value: profileValue, weight: 15, description: 'Medidas e informações que personalizam a leitura.' });

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const score = totalWeight
    ? Math.round(components.reduce((sum, component) => sum + component.value * component.weight, 0) / totalWeight)
    : 0;
  return { score, components, coverage: Math.round((totalWeight / 100) * 100), narrative: getAwarenessNarrative(score) };
};

export const COLORS = ['var(--accent)', 'var(--accent-secondary)', 'var(--accent-light)', 'var(--accent-secondary-light)', 'var(--ink)'];
