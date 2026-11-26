import type { Page, UserProfile } from '../types';
import { getLatestMetricValue, sortMetricsChronologically, type MetricPoint } from './metrics';

export function calculateNutritionalNeeds(
  weight: number,
  heightCm: number,
  age: number,
  gender: string,
  activityLevel: number,
  goals: string[] = []
) {
  if (!weight || !heightCm || !age) return { imc: 0, tmb: 0, net: 0 };
  const heightCmSafe = heightCm > 0 && heightCm < 3 ? heightCm * 100 : heightCm;
  const heightM = heightCmSafe / 100;
  const imc = weight / (heightM * heightM);

  let tmb = (10 * weight) + (6.25 * heightCmSafe) - (5 * age);
  tmb = (gender === 'Masculino' || gender === 'Homem') ? tmb + 5 : tmb - 161;

  let net = tmb * (activityLevel || 1.2);
  if (goals.includes('Emagrecimento consciente')) net -= 400;
  if (goals.includes('Hipertrofia') || goals.includes('Ganho de peso')) net += 400;

  return {
    imc: parseFloat(imc.toFixed(1)),
    tmb: Math.round(tmb),
    net: Math.round(net)
  };
}

export const getImcInterpretation = (imc?: number | null) => {
  if (!imc) return { label: 'Sem dados', tone: 'text-ink/50', description: 'Informe peso e altura.' };
  if (imc < 18.5) return { label: 'Abaixo da faixa de referência', tone: 'text-accent-secondary', description: 'Indicador de triagem; avalie o contexto com um profissional.' };
  if (imc < 25) return { label: 'Faixa de referência', tone: 'text-accent', description: 'Indicador de triagem; não substitui avaliação individual.' };
  if (imc < 30) return { label: 'Acima da faixa de referência', tone: 'text-accent-secondary', description: 'Indicador de triagem; avalie o contexto com um profissional.' };
  return { label: 'Faixa elevada de referência', tone: 'text-accent-secondary', description: 'Indicador de triagem; não substitui acompanhamento profissional.' };
};

export const isProfileComplete = (profile: Partial<UserProfile>) => {
  const latestWeight = profile.weightEvolution?.[profile.weightEvolution.length - 1]?.value;
  const hasIdentity = Boolean(profile.name || profile.email);
  const hasRequiredMeasurements = Boolean(profile.height && latestWeight);
  const hasCompletionMarker = Boolean(profile.onboardingComplete || profile.profileCompletedAt);
  const hasLegacyMetrics = Boolean(profile.imc || profile.tmb || profile.net);

  return Boolean(
    hasIdentity &&
    (hasCompletionMarker || hasRequiredMeasurements || hasLegacyMetrics)
  );
};

export const withProfileCompletionState = (profile: UserProfile): UserProfile => {
  if (!isProfileComplete(profile)) return profile;
  return {
    ...profile,
    onboardingComplete: true,
    profileCompletedAt: profile.profileCompletedAt || new Date().toISOString(),
  };
};

export const mergeProfileData = (base: UserProfile, incoming?: Partial<UserProfile> | null): UserProfile => {
  if (!incoming) return base;

  const merged = { ...base, ...incoming } as UserProfile;
  const arrayFields: (keyof UserProfile)[] = [
    'objectives',
    'initialEmotions',
    'triggers',
    'foods',
    'comorbidities',
    'checkIns',
    'dailyNotes',
    'sleepLogs',
    'weightEvolution',
    'waistEvolution',
    'armEvolution',
    'abdomenEvolution',
    'hipEvolution',
  ];
  const numberFields: (keyof UserProfile)[] = ['age', 'height', 'activityLevel', 'imc', 'tmb', 'net'];
  const stringFields: (keyof UserProfile)[] = ['name', 'email', 'photo', 'gender', 'profileCompletedAt'];

  arrayFields.forEach(field => {
    const baseValue = base[field];
    const incomingValue = incoming[field];
    if (Array.isArray(baseValue) && baseValue.length && (!Array.isArray(incomingValue) || incomingValue.length === 0)) {
      (merged as any)[field] = baseValue;
    }
  });

  numberFields.forEach(field => {
    const baseValue = base[field];
    const incomingValue = incoming[field];
    if (typeof baseValue === 'number' && baseValue > 0 && (typeof incomingValue !== 'number' || incomingValue <= 0)) {
      (merged as any)[field] = baseValue;
    }
  });

  stringFields.forEach(field => {
    const baseValue = base[field];
    const incomingValue = incoming[field];
    if (typeof baseValue === 'string' && baseValue && (typeof incomingValue !== 'string' || !incomingValue)) {
      (merged as any)[field] = baseValue;
    }
  });

  if (base.onboardingComplete && incoming.onboardingComplete !== true) {
    merged.onboardingComplete = true;
  }

  return merged;
};

export const getPostLoginPage = (profile: Partial<UserProfile>): Page => (
  isProfileComplete(profile) ? 'dashboard' : 'diagnosis'
);

export const sanitizeProfileDefaults = (profile: UserProfile): UserProfile => {
  const currentDateLabel = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const normalizeDates = (items: MetricPoint[] = []) => items.map(item => item.date === 'Hoje' ? { ...item, date: currentDateLabel } : item);
  const weightEvolution = sortMetricsChronologically(normalizeDates(profile.weightEvolution));
  const rawHeight = Number(profile.height);
  const height = Number.isFinite(rawHeight) && rawHeight > 0
    ? (rawHeight < 3 ? Number((rawHeight * 100).toFixed(1)) : rawHeight)
    : 0;
  const latestWeight = getLatestMetricValue(weightEvolution);
  const computedImc = height && latestWeight
    ? Number((latestWeight / Math.pow(height / 100, 2)).toFixed(1))
    : null;
  const storedImc = Number(profile.imc);
  const imc = computedImc && computedImc >= 10 && computedImc <= 80
    ? computedImc
    : (Number.isFinite(storedImc) && storedImc >= 10 && storedImc <= 80 ? storedImc : profile.imc);

  return {
    ...profile,
    height,
    ...(imc !== undefined ? { imc } : {}),
    weightEvolution,
    waistEvolution: sortMetricsChronologically(normalizeDates(profile.waistEvolution)),
    armEvolution: sortMetricsChronologically(normalizeDates(profile.armEvolution)),
    abdomenEvolution: sortMetricsChronologically(normalizeDates(profile.abdomenEvolution)),
    hipEvolution: sortMetricsChronologically(normalizeDates(profile.hipEvolution)),
  };
};
