export type MetricPoint = { date: string; value: number; recordedAt?: string };
export type MealClassification = 'Física' | 'Emocional' | 'Não classificada';

export const clampNumber = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export const averageNumbers = (values: Array<number | null | undefined>) => {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!validValues.length) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
};

export const toNumberOrNull = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const getLatestMetricValue = (items?: MetricPoint[]) => {
  const sorted = sortMetricsChronologically(items);
  const latest = sorted[sorted.length - 1];
  return latest && Number.isFinite(latest.value) && latest.value > 0 ? latest.value : null;
};

export const parseDateForSorting = (dateStr: string, recordedAt?: string) => {
  if (recordedAt) {
    const stamped = new Date(recordedAt).getTime();
    if (!Number.isNaN(stamped)) return stamped;
  }
  if (!dateStr) return 0;
  if (dateStr === 'Hoje') return Date.now();
  if (dateStr.includes('/') || dateStr.includes('.')) {
    const parts = dateStr.split(/[\/.]/);
    if (parts.length === 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const now = new Date();
      const candidate = new Date(now.getFullYear(), month, day, 12);
      // Um registro de dezembro visto em janeiro pertence ao ano anterior.
      if (candidate.getTime() > now.getTime() + 45 * 24 * 60 * 60 * 1000) {
        candidate.setFullYear(now.getFullYear() - 1);
      }
      return candidate.getTime();
    }
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year < 100 ? 2000 + year : year, month, day, 12).getTime();
    }
  }
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sortMetricsChronologically = (items: MetricPoint[] = []) => {
  const byDay = new Map<string, MetricPoint>();
  items.forEach((item) => {
    const value = Number(item?.value);
    if (!item?.date || !Number.isFinite(value) || value <= 0) return;
    const timestamp = parseDateForSorting(item.date, item.recordedAt);
    if (!timestamp) return;
    const day = new Date(timestamp);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const normalized: MetricPoint = { ...item, value, recordedAt: item.recordedAt || new Date(timestamp).toISOString() };
    const previous = byDay.get(key);
    if (!previous || parseDateForSorting(previous.date, previous.recordedAt) <= timestamp) {
      byDay.set(key, normalized);
    }
  });
  return Array.from(byDay.values()).sort(
    (a, b) => parseDateForSorting(a.date, a.recordedAt) - parseDateForSorting(b.date, b.recordedAt)
  );
};

export const getMoodScore = (mood?: string | null) => {
  const key = normalizeText(mood);
  const moodScores: Record<string, number> = {
    euforia: 90,
    alegria: 84,
    animado: 84,
    animada: 84,
    calmo: 76,
    calma: 76,
    "calmo(a)": 76,
    neutro: 60,
    ansioso: 36,
    ansiosa: 36,
    "ansioso(a)": 36,
    ansiedade: 36,
    estresse: 32,
    "estressado(a)": 32,
    estressado: 32,
    estressada: 32,
    frustracao: 30,
    "frustrado(a)": 30,
    deprimido: 25,
    deprimida: 25,
    "deprimido(a)": 25,
    solitario: 32,
    solitaria: 32,
    "solitario(a)": 32,
    raivoso: 28,
    raivosa: 28,
    "raivoso(a)": 28,
    culpa: 24,
    tenso: 34,
    cansado: 40,
    "cansado(a)": 40,
    triste: 30
  };
  return moodScores[key] ?? null;
};

export const isEmotionallyChargedMood = (mood?: string | null) => {
  const score = getMoodScore(mood);
  return typeof score === 'number' && score <= 40;
};

export const normalizeMealType = (type?: string | null): MealClassification => {
  const value = normalizeText(type);
  if (value.includes('fisica') || value.includes('fisiologica')) return 'Física';
  if (value.includes('emocional')) return 'Emocional';
  return 'Não classificada';
};

export const inferMealType = (meal: any): MealClassification => {
  const existingType = normalizeMealType(meal?.inferredType || meal?.type);
  const preHunger = toNumberOrNull(meal?.preHunger);
  const postHunger = toNumberOrNull(meal?.postHunger);
  const satisfaction = toNumberOrNull(meal?.satisfaction);
  const hasBehaviorSignals = [preHunger, postHunger, satisfaction].some(value => value !== null)
    || Boolean(meal?.preMood || meal?.postMood || meal?.mood);

  if (!hasBehaviorSignals) return existingType !== 'Não classificada' ? existingType : 'Física';

  let physicalScore = 0;
  let emotionalScore = 0;

  if (preHunger !== null) {
    if (preHunger >= 6) physicalScore += 3;
    else if (preHunger === 5) physicalScore += 1;
    else if (preHunger <= 3) emotionalScore += 2;
  }

  if (preHunger !== null && postHunger !== null) {
    const hungerDrop = preHunger - postHunger;
    if (hungerDrop >= 2) physicalScore += 2;
    if (postHunger >= preHunger && preHunger <= 4) emotionalScore += 2;
    else if (postHunger > preHunger) emotionalScore += 1;
  }

  if (satisfaction !== null) {
    if (satisfaction >= 4) physicalScore += 1;
    if (satisfaction <= 2) emotionalScore += 1;
  }

  if (isEmotionallyChargedMood(meal?.preMood) || isEmotionallyChargedMood(meal?.postMood) || isEmotionallyChargedMood(meal?.mood)) {
    emotionalScore += 2;
  }

  if (existingType === 'Física') physicalScore += 1;
  if (existingType === 'Emocional') emotionalScore += 1;

  if (physicalScore >= 3 && physicalScore >= emotionalScore) return 'Física';
  if (emotionalScore >= 3 && emotionalScore > physicalScore) return 'Emocional';
  return existingType !== 'Não classificada' ? existingType : 'Física';
};
