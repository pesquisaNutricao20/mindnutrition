import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Home,
  PlusCircle,
  BookOpen,
  Activity,
  User,
  ChevronRight,
  Camera,
  Heart,
  Smile,
  Frown,
  Meh,
  Coffee,
  Sun,
  Moon,
  ArrowLeft,
  Settings,
  LogOut,
  Sparkles,
  Leaf,
  ArrowRight,
  Library,
  Lock,
  Mail,
  Edit2,
  CheckCircle,
  CheckCircle2,
  Brain,
  Zap,
  TrendingUp,
  HelpCircle,
  Info,
  X,
  Trash2,
  PenTool,
  MessageCircle,
  Bell,
  CalendarDays,
  Compass,
  ScanLine,
  Utensils,
  RefreshCw,
  Loader2,
  Sprout,
  Flower2,
  Check,
} from 'lucide-react';
import { TbHealthRecognition } from 'react-icons/tb';
import { PiHeartbeat } from 'react-icons/pi';
import { FaBrain, FaWhatsapp } from 'react-icons/fa';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useToast } from './components/Toast';
import { AuthPage } from './components/AuthPage';
import { ProfileAvatar } from './components/ui/ProfileAvatar';
import { FlyingMascotSprite } from './components/ui/FlyingMascotSprite';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { MascotBubble } from './components/ui/MascotBubble';
import { ChallengePlant } from './components/ui/ChallengePlant';
import { PageContainer } from './components/ui/PageContainer';
import { PageHeader } from './components/ui/PageHeader';
import { Button } from './components/ui/Button';
import { FormField } from './components/ui/FormField';
import { Overlay } from './components/ui/Overlay';
import { StateView } from './components/ui/StateView';
import { AdminPlatform } from './components/admin/AdminPlatform';
import { UserCarePage } from './components/UserCarePage';
import { DEFAULT_PROFILE_PHOTO, readValidatedImages, MAX_IMAGE_SIZE_MB, MAX_MEAL_PHOTOS } from './constants';
import type { Page, UserProfile, DailyNote, SleepLog, ChallengeState } from './types';
import { DEFAULT_RECIPES, recipeToArticle } from './data/recipes';
import {
  CHALLENGE_ACTIVITIES, CHALLENGE_MISSIONS, WEEK_BADGES,
  challengeFeedback, dayPoints, gardenStage, isDayComplete,
} from './data/challenge';
import {
  clearSyncQueue,
  deleteCurrentUserData,
  getFriendlySupabaseError,
  getCurrentSession,
  insertMeal,
  deleteMeal,
  isSupabaseDataSyncAvailable,
  isSupabaseConfigured,
  loadMeals,
  loadProfile,
  supabase,
  toIsoTimestamp,
  upsertProfile,
} from './lib/supabase';
import { authHeaders, loadConversation, loadUnreadMessageCount, type ChatMessage } from './lib/portal';
import iconApp from './assets/logo/icon_app.png';
import mascotAi from './assets/mascote_ai3.png';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';

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

const getImcInterpretation = (imc?: number | null) => {
  if (!imc) return { label: 'Sem dados', tone: 'text-ink/50', description: 'Informe peso e altura.' };
  if (imc < 18.5) return { label: 'Abaixo da faixa de referência', tone: 'text-accent-secondary', description: 'Indicador de triagem; avalie o contexto com um profissional.' };
  if (imc < 25) return { label: 'Faixa de referência', tone: 'text-accent', description: 'Indicador de triagem; não substitui avaliação individual.' };
  if (imc < 30) return { label: 'Acima da faixa de referência', tone: 'text-accent-secondary', description: 'Indicador de triagem; avalie o contexto com um profissional.' };
  return { label: 'Faixa elevada de referência', tone: 'text-accent-secondary', description: 'Indicador de triagem; não substitui acompanhamento profissional.' };
};

type MetricPoint = { date: string; value: number; recordedAt?: string };
type MealClassification = 'Física' | 'Emocional' | 'Não classificada';

export const HUNGER_DEFINITIONS = {
  fisica: {
    title: 'Fome fisiológica (Física)',
    description: 'A fome fisiológica caracteriza-se pela necessidade biológica de ingestão de alimentos para manutenção das demandas energéticas e nutricionais do organismo, apresentando-se geralmente de maneira gradual e sendo reduzida após a ingestão alimentar.',
    signals: [
      'Aparece gradualmente ao longo do tempo',
      'Estômago vazio, sensação física de abertura ou ronco',
      'Aceita diferentes opções de alimentos saudáveis',
      'Reduzida e satisfeita após a ingestão alimentar',
      'Sensação de saciedade sem sentimento de culpa'
    ]
  },
  emocional: {
    title: 'Fome emocional',
    description: 'A fome emocional refere-se ao comportamento de comer desencadeado ou influenciado por estados emocionais, como ansiedade, tristeza, estresse, frustração ou tédio, podendo acontecer independentemente da necessidade energética e estar associado à busca por alimentos específicos e mais palatáveis.',
    signals: [
      'Surge de repente com sensação de urgência',
      'Busca por alimentos específicos e muito palatáveis (doces, massas, salgados)',
      'Desencadeada por sentimentos (ansiedade, estresse, tédio, solidão)',
      'Pode persistir mesmo após o estômago estar cheio',
      'Frequentemente acompanhada por culpa ou arrependimento'
    ]
  }
};

const clampNumber = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const averageNumbers = (values: Array<number | null | undefined>) => {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!validValues.length) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
};

const toNumberOrNull = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getLatestMetricValue = (items?: MetricPoint[]) => {
  const sorted = sortMetricsChronologically(items);
  const latest = sorted[sorted.length - 1];
  return latest && Number.isFinite(latest.value) && latest.value > 0 ? latest.value : null;
};

const parseDateForSorting = (dateStr: string, recordedAt?: string) => {
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

const sortMetricsChronologically = (items: MetricPoint[] = []) => {
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

const getMoodScore = (mood?: string | null) => {
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

const isEmotionallyChargedMood = (mood?: string | null) => {
  const score = getMoodScore(mood);
  return typeof score === 'number' && score <= 40;
};

const normalizeMealType = (type?: string | null): MealClassification => {
  const value = normalizeText(type);
  if (value.includes('fisica') || value.includes('fisiologica')) return 'Física';
  if (value.includes('emocional')) return 'Emocional';
  return 'Não classificada';
};

const inferMealType = (meal: any): MealClassification => {
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

const calculateProfileInsightScore = (profile: Partial<UserProfile>) => {
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

const getInitialMoodBaseline = (profile: Partial<UserProfile>) => {
  const latestCheckIn = profile.checkIns?.[profile.checkIns.length - 1]?.mood;
  if (latestCheckIn) return getMoodScore(latestCheckIn);
  const emotionScores = (profile.initialEmotions || []).map(emotion => getMoodScore(emotion));
  return averageNumbers(emotionScores);
};

const calculateMealAwarenessScore = (meal: any) => {
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

const calculateAwarenessScore = (profile: Partial<UserProfile>, meals: any[]) => {
  if (meals.length) {
    const mealScore = averageNumbers(meals.map(calculateMealAwarenessScore));
    return clampNumber(Math.round(mealScore || 0));
  }
  return calculateProfileInsightScore(profile);
};

const buildRadarData = (profile: Partial<UserProfile>, meals: any[], awarenessScore: number) => {
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

const getWeightGoal = (profile: Partial<UserProfile>) => {
  const latestWeight = getLatestMetricValue(profile.weightEvolution);
  if (!latestWeight) return null;
  const goals = profile.objectives || [];
  if (goals.includes('Emagrecimento consciente')) return parseFloat((latestWeight * 0.95).toFixed(1));
  if (goals.includes('Hipertrofia') || goals.includes('Ganho de peso')) return parseFloat((latestWeight * 1.05).toFixed(1));
  const firstWeight = (profile.weightEvolution || []).find(item => item.value > 0)?.value;
  return firstWeight && firstWeight !== latestWeight ? firstWeight : null;
};

type ChartFrameProps = {
  className?: string;
  minHeight?: number;
  children: (size: { width: number; height: number }) => React.ReactNode;
};

const ChartFrame = ({ className = 'h-64', minHeight = 180, children }: ChartFrameProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let rafId = 0;
    const updateSize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = frame.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.max(Math.floor(rect.height), minHeight);
        setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);
    window.addEventListener('resize', updateSize);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [minHeight]);

  return (
    <div ref={frameRef} className={`chart-frame ${className}`} style={{ minHeight }}>
      {size.width > 0 && size.height > 0 ? children(size) : (
        <div className="h-full min-h-[inherit] rounded-3xl bg-paper/70 animate-pulse" />
      )}
    </div>
  );
};

const isProfileComplete = (profile: Partial<UserProfile>) => {
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

const withProfileCompletionState = (profile: UserProfile): UserProfile => {
  if (!isProfileComplete(profile)) return profile;
  return {
    ...profile,
    onboardingComplete: true,
    profileCompletedAt: profile.profileCompletedAt || new Date().toISOString(),
  };
};

const mergeProfileData = (base: UserProfile, incoming?: Partial<UserProfile> | null): UserProfile => {
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

const getPostLoginPage = (profile: Partial<UserProfile>): Page => (
  isProfileComplete(profile) ? 'dashboard' : 'diagnosis'
);

const MODAL_BACKDROP_CLASS = 'modal-backdrop absolute inset-0';
const COLORS = ['var(--accent)', 'var(--accent-secondary)', 'var(--accent-light)', 'var(--accent-secondary-light)', 'var(--ink)'];

const sanitizeProfileDefaults = (profile: UserProfile): UserProfile => {
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

const getAwarenessNarrative = (score: number) => {
  if (score < 30) return 'Todo começo conta: registre uma refeição, uma noite de sono ou uma reflexão para tornar seus padrões mais visíveis.';
  if (score < 50) return 'Você já está reunindo sinais importantes. Pequenos registros consistentes ajudam a transformar percepção em escolhas mais conscientes.';
  if (score < 70) return 'Sua consciência está em construção sólida: você reconhece sinais do corpo e tem material para observar tendências com mais clareza.';
  if (score < 85) return 'Você demonstra boa conexão entre contexto, fome e saciedade. Continue usando os registros para ajustar sua rotina com gentileza.';
  return 'Sua jornada tem registros consistentes e contextualizados. Use os Insights para manter o que funciona e acolher os dias mais difíceis.';
};

const buildIntegratedInsight = (profile: Partial<UserProfile>, meals: any[]) => {
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

const getReadingDuration = (article: { summary?: string; content?: string[] }) => {
  const words = [article.summary || '', ...(article.content || [])]
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min`;
};

const DEFAULT_LIBRARY_ARTICLES = [
  {
    id: 'fome-fisica-emocional',
    title: 'Fome Física vs Fome Emocional',
    duration: '4 min',
    icon: Heart,
    type: 'Consciência Alimentar',
    image: 'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=800',
    summary: 'Aprenda a diferenciar os sinais do seu corpo e acolher suas vontades com gentileza.',
    content: [
      'A fome fisiológica caracteriza-se pela necessidade biológica de ingestão de alimentos para manutenção das demandas energéticas e nutricionais do organismo, apresentando-se geralmente de maneira gradual e sendo reduzida após a ingestão alimentar.',
      'A fome emocional refere-se ao comportamento de comer desencadeado ou influenciado por estados emocionais, como ansiedade, tristeza, estresse, frustração ou tédio, podendo acontecer independentemente da necessidade energética e estar associado à busca por alimentos específicos e mais palatáveis.',
      'Observar a origem da sua vontade de comer não serve para você se julgar ou se restringir. Serve para dar ao corpo exatamente o que ele precisa: alimento nutritivo quando há fome biológica, ou descanso, acolhimento e carinho quando há uma necessidade emocional.'
    ],
    sourceLabel: 'Prof. Wanderleia da Consolação Paiva'
  },
  {
    id: 'mindful-eating-pausa',
    title: 'Mindful Eating: A Arte da Pausa',
    duration: '3 min',
    icon: Leaf,
    type: 'Prática Consciente',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800',
    summary: 'Como três respirações profundas antes da refeição transformam sua digestão e saciedade.',
    content: [
      'Comer no piloto automático, olhando telas ou sob pressa, impede o cérebro de registrar os sinais naturais de saciedade emitidos pelo estômago e pelo trato gastrointestinal.',
      'Fazer uma breve pausa de 30 segundos antes da primeira garfada: observar as cores, os aromas e agradecer pelo prato ativa o sistema nervoso parassimpático, preparando as enzimas digestivas.',
      'Comer devagar e saborear cada textura traz satisfação genuína com quantidades confortáveis de comida.'
    ],
    sourceLabel: 'Abordagem Mind Nutrition'
  },
  {
    id: 'sono-ultraprocessados',
    title: 'Comida de tirar o sono',
    duration: '3 min',
    icon: Moon,
    type: 'Sono e alimentação',
    image: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800',
    summary: 'Como ultraprocessados, cafeína e refeições pesadas podem atrapalhar suas noites.',
    content: [
      'Os ultraprocessados podem interferir no funcionamento de hormônios como a melatonina, aumentar a inflamação e tornar a digestão mais lenta - fatores que podem incomodar na hora de dormir.',
      'Refrigerantes e energéticos, doces e sobremesas, além de lanches tipo fast food, estão entre os exemplos citados por reunirem cafeína, açúcar, gordura e sal em níveis que podem prejudicar o relaxamento e o sono profundo.',
      'Em vez de buscar perfeição, observe com curiosidade: o que você costuma comer e beber nas horas que antecedem o sono? Pequenos ajustes na rotina podem ser um bom ponto de partida.'
    ],
    sourceLabel: 'Hospital Alemão Oswaldo Cruz',
    sourceUrl: 'https://www.hospitaloswaldocruz.org.br/imprensa/hospital-na-midia/comida-de-tirar-o-sono-como-os-ultraprocessados-prejudicam-as-suas-noites/'
  },
  {
    id: 'sono-comportamento-alimentar',
    title: 'Sono, apetite e escolhas alimentares',
    duration: '5 min',
    icon: Coffee,
    type: 'Ciência do sono',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
    summary: 'Entenda a relação entre menos sono, sinais de fome e escolhas alimentares.',
    content: [
      'A privação de sono pode aumentar a grelina, hormônio associado à fome, e reduzir a leptina, relacionada à saciedade. Essa combinação tende a intensificar o apetite.',
      'Alterações no sono também podem influenciar o comportamento alimentar, favorecendo escolhas mais frequentes de alimentos doces e de maior densidade energética em momentos de cansaço.',
      'Esse conhecimento não é motivo para culpa: ele ajuda a entender que sono, alimentação e emoções fazem parte da mesma rotina de cuidado.'
    ],
    sourceLabel: 'Padrões de sono, comportamento alimentar e o risco de doenças não transmissíveis',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10255419/'
  },
  {
    id: 'autocompaixao-alimentacao',
    title: 'Autocompaixão contra o ciclo de dietas',
    duration: '4 min',
    icon: Sparkles,
    type: 'Cuidado Emocional',
    image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=800',
    summary: 'Por que a autocrítica piora a compulsão e como a gentileza restaura o equilíbrio.',
    content: [
      'Dietas restritivas e regras extremas geram estresse mental. Quando um deslize acontece, a autocrítica frequente desencadeia a sensação de fracasso e novos episódios de exagero.',
      'A autocompaixão consiste em tratar a si mesmo com a mesma bondade que você ofereceria a um amigo querido em um momento difícil.',
      'Cada dia e cada refeição são uma nova oportunidade para recomeçar com calma e carinho com seu corpo.'
    ],
    sourceLabel: 'Dr. Kristin Neff - Mindful Self-Compassion'
  }
];

// =========================================================================
// STANDALONE MODALS (Never defined inside parent body to follow hook rules)
// =========================================================================

interface HungerGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HungerGuideModal = ({ isOpen, onClose }: HungerGuideModalProps) => (
  <Overlay
    open={isOpen}
    onClose={onClose}
    title="Fome Física x Fome Emocional"
    description="Escute os sinais do seu corpo com carinho. Use estas orientações para identificar sua real necessidade no momento."
    size="lg"
    footer={<Button fullWidth onClick={onClose}>Entendi, obrigado(a)</Button>}
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-3xl border border-accent/25 bg-accent/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full bg-accent inline-block" />
          <h3 className="font-bold text-accent text-base sm:text-lg">{HUNGER_DEFINITIONS.fisica.title}</h3>
        </div>
        <p className="text-xs sm:text-sm text-ink/80 leading-relaxed italic mb-3">
          "{HUNGER_DEFINITIONS.fisica.description}"
        </p>
        <ul className="space-y-1.5 text-xs text-ink/70">
          {HUNGER_DEFINITIONS.fisica.signals.map((signal, index) => (
            <li key={index} className="flex items-start gap-1.5">• <span>{signal}</span></li>
          ))}
        </ul>
      </section>
      <section className="rounded-3xl border border-accent-secondary/30 bg-accent-secondary/10 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full bg-accent-secondary inline-block" />
          <h3 className="font-bold text-accent-secondary text-base sm:text-lg">{HUNGER_DEFINITIONS.emocional.title}</h3>
        </div>
        <p className="text-xs sm:text-sm text-ink/80 leading-relaxed italic mb-3">
          "{HUNGER_DEFINITIONS.emocional.description}"
        </p>
        <ul className="space-y-1.5 text-xs text-ink/70">
          {HUNGER_DEFINITIONS.emocional.signals.map((signal, index) => (
            <li key={index} className="flex items-start gap-1.5">• <span>{signal}</span></li>
          ))}
        </ul>
      </section>
    </div>
  </Overlay>
);

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal = ({ isOpen, onClose }: TutorialModalProps) => (
  <Overlay
    open={isOpen}
    onClose={onClose}
    title="Como Funciona o Mind Nutrition?"
    description="Três passos para observar sua alimentação com mais presença e gentileza."
    size="lg"
    footer={<Button fullWidth onClick={onClose}>Começar a Explorar</Button>}
  >
    <div className="space-y-4">
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">1</div>
        <div>
          <h3 className="font-bold text-sm">Pausa & Observação Pré-Refeição</h3>
          <p className="text-xs text-ink/65 mt-1">Antes de comer, reserve 30 segundos para avaliar sua fome de 0 a 10 e reconhecer suas emoções.</p>
        </div>
      </div>
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">2</div>
        <div>
          <h3 className="font-bold text-sm">Registro Gentil da Refeição</h3>
          <p className="text-xs text-ink/65 mt-1">Tire fotos, anote sabores e texturas sem foco em calorias ou regras rígidas.</p>
        </div>
      </div>
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">3</div>
        <div>
          <h3 className="font-bold text-sm">Saciedade & Autoconhecimento</h3>
          <p className="text-xs text-ink/65 mt-1">Após comer, avalie seu nível de satisfação (0 a 5) e veja seus padrões no painel de Insights.</p>
        </div>
      </div>
    </div>
  </Overlay>
);

interface DailyDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string, mood?: string) => void | Promise<void>;
}

export const DailyDiaryModal = ({ isOpen, onClose, onSave }: DailyDiaryModalProps) => {
  const [diaryText, setDiaryText] = useState('');
  const [diaryMood, setDiaryMood] = useState('Calmo(a)');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (diaryText.trim().length < 3) {
      setError('Escreva pelo menos 3 caracteres para salvar sua anotação.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(diaryText, diaryMood);
      setDiaryText('');
      onClose();
    } catch {
      setError('Não foi possível salvar agora. Sua anotação continua aqui; tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      title="Anotações & Reflexões do Dia"
      description="Escreva situações, sentimentos ou acontecimentos que influenciaram suas escolhas e sua alimentação hoje."
      size="lg"
      busy={saving}
      footer={<Button fullWidth type="submit" form="daily-diary-form" loading={saving}>Salvar no Diário</Button>}
    >
      <form id="daily-diary-form" onSubmit={handleSubmit} className="space-y-5">
        <FormField
          label="Como foi seu dia?"
          htmlFor="diary-text"
          required
          hint="Mínimo de 3 caracteres. Este espaço é só seu."
          error={error}
        >
          <textarea
            id="diary-text"
            value={diaryText}
            onChange={(event) => { setDiaryText(event.target.value); if (error) setError(''); }}
            maxLength={1200}
            disabled={saving}
            placeholder="Sentiu ansiedade no trabalho? Celebrou algo especial? Descreva livremente..."
            className="w-full h-36 p-4 rounded-2xl bg-white border border-line text-sm resize-none font-medium disabled:opacity-60"
          />
        </FormField>
        <fieldset disabled={saving}>
          <legend className="mb-2 text-sm font-semibold text-ink">Sentimento predominante</legend>
          <div className="flex flex-wrap gap-2">
            {['Calmo(a)', 'Alegre', 'Ansioso(a)', 'Estressado(a)', 'Cansado(a)', 'Grato(a)'].map(mood => (
              <button
                key={mood}
                type="button"
                onClick={() => setDiaryMood(mood)}
                aria-pressed={diaryMood === mood}
                className={`min-h-11 px-4 rounded-full text-xs font-bold border transition-colors ${diaryMood === mood ? 'bg-accent text-paper border-accent' : 'bg-white text-ink/65 border-line'}`}
              >
                {mood}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Overlay>
  );
};

interface SleepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hours: number, quality: 'Ruim' | 'Regular' | 'Bom' | 'Excelente', notes?: string) => void | Promise<void>;
}

export const SleepModal = ({ isOpen, onClose, onSave }: SleepModalProps) => {
  const [hours, setHours] = useState(7.5);
  const [quality, setQuality] = useState<'Ruim' | 'Regular' | 'Bom' | 'Excelente'>('Bom');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (hours < 3 || hours > 12) {
      setError('Informe um valor entre 3 e 12 horas.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(hours, quality, notes);
      onClose();
    } catch {
      setError('Não foi possível salvar agora. Os valores continuam aqui; tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      title="Como foi seu descanso?"
      description="Uma boa noite de sono regula a grelina e leptina, facilitando escolhas alimentares mais equilibradas."
      size="lg"
      busy={saving}
      footer={<Button fullWidth type="submit" form="sleep-form" loading={saving}>Registrar Sono</Button>}
    >
      <form id="sleep-form" onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Horas dormidas" htmlFor="sleep-hours" hint="Escolha um valor entre 3 e 12 horas." error={error}>
          <input
            id="sleep-hours"
            type="range"
            min="3"
            max="12"
            step="0.5"
            value={hours}
            onChange={(event) => { setHours(parseFloat(event.target.value)); setError(''); }}
            disabled={saving}
            aria-valuetext={`${hours} horas`}
            className="w-full accent-accent h-2 bg-line rounded-lg cursor-pointer"
          />
        </FormField>
        <div className="flex items-center justify-between rounded-2xl bg-accent/5 px-4 py-3">
          <span className="text-sm font-semibold text-ink/70">Tempo registrado</span>
          <output htmlFor="sleep-hours" className="text-xl font-bold text-accent">{hours}h</output>
        </div>
        <fieldset disabled={saving}>
          <legend className="mb-2 text-sm font-semibold text-ink">Qualidade do sono</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['Ruim', 'Regular', 'Bom', 'Excelente'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setQuality(option)}
                aria-pressed={quality === option}
                className={`min-h-11 rounded-2xl text-xs font-bold border text-center transition-colors ${quality === option ? 'bg-accent text-paper border-accent shadow-xs' : 'bg-white text-ink/65 border-line'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <FormField label="Observações" htmlFor="sleep-notes" optional>
          <input
            id="sleep-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={250}
            disabled={saving}
            placeholder="Ex: Acordei durante a noite, tomei café tarde..."
            className="w-full min-h-12 px-4 py-3 rounded-2xl bg-white border border-line text-sm font-medium disabled:opacity-60"
          />
        </FormField>
      </form>
    </Overlay>
  );
};

function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  const handleConfirm = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await onConfirm();
      if (result === false) {
        setError('Não foi possível concluir a ação. Tente novamente.');
        return;
      }
      onClose();
    } catch {
      setError('Não foi possível concluir a ação. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      busy={saving}
      initialFocusRef={cancelRef}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="danger" onClick={handleConfirm} loading={saving}>{confirmLabel}</Button>
        </div>
      }
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger"><Trash2 size={21} aria-hidden="true" /></div>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-danger/5 p-3 text-sm leading-relaxed text-danger">{error}</p>}
    </Overlay>
  );
}

// =========================================================================
// AI SUMMARY MODAL
// =========================================================================

const SUMMARY_BULLET = /^(?:[-*•▪–]|\d+[.)])\s+/;
const SUMMARY_SUGGESTION = /^sugest[ãa]o\s*:\s*/i;
const SUMMARY_MARK = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/;

type SummaryBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'suggestion'; text: string };

function splitSummaryBlocks(text: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length) blocks.push({ kind: 'bullets', items: bullets });
    bullets = [];
  };
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushAll = () => {
    flushBullets();
    flushParagraph();
  };

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/[ \t]+/g, ' ').trim();
    if (!line) {
      flushAll();
      return;
    }
    const cleanLine = line.replace(SUMMARY_BULLET, '');
    if (SUMMARY_SUGGESTION.test(cleanLine)) {
      flushAll();
      const body = cleanLine.replace(SUMMARY_SUGGESTION, '').trim();
      blocks.push({ kind: 'suggestion', text: body.charAt(0).toUpperCase() + body.slice(1) });
      return;
    }
    if (/^#{1,6}\s+/.test(line)) {
      flushAll();
      blocks.push({ kind: 'heading', text: line.replace(/^#{1,6}\s+/, '') });
      return;
    }
    const boldHeading = line.match(/^\*\*([^*]{2,60})\*\*:?$/);
    if (boldHeading) {
      flushAll();
      blocks.push({ kind: 'heading', text: boldHeading[1] });
      return;
    }
    if (SUMMARY_BULLET.test(line)) {
      flushParagraph();
      bullets.push(cleanLine);
      return;
    }
    flushBullets();
    paragraph.push(line);
  });
  flushAll();
  return blocks;
}

const SummaryRichText = ({ text }: { text: string }) => {
  const parts = text.split(SUMMARY_MARK);
  return (
    <>
      {parts.map((part, index) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          return <strong key={index} className="font-bold text-accent">{part.slice(2, -2)}</strong>;
        }
        if (/^[*_][^*_]+[*_]$/.test(part)) {
          return <em key={index} className="italic text-ink/75">{part.slice(1, -1)}</em>;
        }
        if (/^`[^`]+`$/.test(part)) {
          return (
            <code key={index} className="rounded-lg bg-accent/10 px-1.5 py-0.5 font-mono text-[0.85em] font-semibold text-accent">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};

type AiSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  summary: string;
  signals: { score: number; coverage: number; components: { label: string; value: number }[] };
};

function plainSummaryText(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^(?:[-*•▪–]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const AiSummaryModal = ({ isOpen, onClose, onRegenerate, summary, signals }: AiSummaryModalProps) => {
  const blocks = splitSummaryBlocks(summary);
  const [expanded, setExpanded] = useState(false);
  const firstBulletsIndex = blocks.findIndex(block => block.kind === 'bullets');
  const labelsComeFromModel = blocks.some(block => block.kind === 'heading');
  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);
  const tiles = [
    { label: 'Consciência', value: `${signals.score}%` },
    { label: 'Cobertura dos sinais', value: `${signals.coverage}%` },
  ];
  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      title="Resumo do Mascote Nutre"
      description="Uma leitura educativa dos seus registros recentes."
      size="lg"
      closeLabel="Fechar resumo"
      panelClassName={expanded ? 'modal-panel-expanded' : ''}
      headerClassName="animated-gradient relative shrink-0 overflow-hidden px-5 pb-5 pt-1 text-paper sm:px-7 sm:pb-6 sm:pt-2"
      header={
        <>
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Reduzir o painel do resumo' : 'Ampliar o painel do resumo'}
            className="modal-grip modal-grip-light min-h-11"
          />
          <Sparkles size={96} className="pointer-events-none absolute -right-5 -top-6 text-paper/20" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <img src={mascotAi} alt="Mascote Nutre do Mind Nutrition" className="h-14 w-14 shrink-0 rounded-2xl bg-paper/15 object-contain p-1 drop-shadow-md" />
              <div className="min-w-0">
                <span className="label-sm text-paper">Mascote Nutre</span>
                <h3 className="font-display mt-1 text-xl leading-[1.08] sm:text-2xl">Sua leitura conectada</h3>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar resumo" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper/15 text-paper transition hover:bg-paper/25">
              <X size={18} />
            </button>
          </div>
        </>
      }
      bodyClassName="space-y-5"
      footer={
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-ink/55">
            Este resumo é educativo, usa apenas dados resumidos e não substitui acompanhamento profissional.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button fullWidth variant="secondary" onClick={onClose}>Fechar</Button>
            <Button fullWidth onClick={onRegenerate}><RefreshCw size={15} /> Gerar novamente</Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className="rounded-2xl border border-line bg-paper/60 px-4 py-3">
            <p className="text-xs font-bold text-ink/55">{tile.label}</p>
            <p className="font-display mt-0.5 text-2xl text-accent">{tile.value}</p>
          </div>
        ))}
      </div>

      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <p key={`${index}-heading`} className="label-sm text-accent">
              <SummaryRichText text={block.text} />
            </p>
          );
        }
        if (block.kind === 'paragraph') {
          const isOpening = index === 0;
          return (
            <p
              key={`${index}-paragraph`}
              className={isOpening ? 'serif-body text-lg leading-relaxed text-ink/85' : 'text-[15px] leading-relaxed text-ink/75'}
            >
              <SummaryRichText text={block.text} />
            </p>
          );
        }
        if (block.kind === 'suggestion') {
          return (
            <div key={`${index}-suggestion`} className="flex gap-3 rounded-2xl border border-accent/25 bg-accent/5 p-4">
              <Leaf size={19} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-ink/80">
                <span className="font-bold text-accent">Sugestão · </span>
                <SummaryRichText text={block.text} />
              </p>
            </div>
          );
        }
        return (
          <div key={`${index}-bullets`} className="space-y-3">
            {index === firstBulletsIndex && !labelsComeFromModel && (
              <span className="label-sm text-accent">O que seus registros mostram</span>
            )}
            {block.items.map((item, itemIndex) => (
              <div key={`${index}-${itemIndex}`} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                  {itemIndex + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink/75">
                  <SummaryRichText text={item} />
                </p>
              </div>
            ))}
          </div>
        );
      })}

      {signals.components.length > 0 && (
        <div className="rounded-2xl border border-line bg-paper/60 p-4">
          <span className="label-sm text-accent">Como chegamos aí</span>
          <div className="mt-3 space-y-3">
            {signals.components.map(component => (
              <div key={component.label}>
                <div className="flex items-center justify-between gap-3 text-xs font-bold"><span>{component.label}</span><span className="text-accent">{component.value}%</span></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, component.value))}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Overlay>
  );
};

// =========================================================================
// MAIN APP COMPONENT
// =========================================================================

export default function App() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    if (window.location.pathname === '/nutricionista') return 'admin-dashboard';
    return 'landing';
  });
  const [diagnosisStep, setDiagnosisStep] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [loggedMeals, setLoggedMeals] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState<ChatMessage[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [careInitialTab, setCareInitialTab] = useState<'chat' | 'appointments'>('chat');
  const [showHungerModal, setShowHungerModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showDailyDiaryModal, setShowDailyDiaryModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [aiSummaryShortcut, setAiSummaryShortcut] = useState(0);
  const isHistoryNavigation = useRef(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '',
    email: '',
    photo: DEFAULT_PROFILE_PHOTO,
    gender: '',
    objectives: [],
    initialEmotions: [],
    triggers: [],
    foods: [],
    comorbidities: [],
    checkIns: [],
    dailyNotes: [],
    sleepLogs: [],
    readArticleIds: [],
    height: 0,
    weightEvolution: [],
    waistEvolution: [],
    armEvolution: [],
    abdomenEvolution: [],
    hipEvolution: [],
    age: 0,
    activityLevel: 1.2
  });

  // Touch Swipe for mobile tab navigation
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const mainTabs: Page[] = ['dashboard', 'progress', 'content', 'profile'];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 70;
    const isRightSwipe = distance < -70;
    const currentIndex = mainTabs.indexOf(currentPage);

    if (currentIndex >= 0) {
      if (isLeftSwipe && currentIndex < mainTabs.length - 1) {
        setCurrentPage(mainTabs[currentIndex + 1]);
      } else if (isRightSwipe && currentIndex > 0) {
        setCurrentPage(mainTabs[currentIndex - 1]);
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const persistUserProfile = async (profile: UserProfile, userId = currentUserId) => {
    const profileToPersist = withProfileCompletionState(sanitizeProfileDefaults(profile));
    setUserProfile(profileToPersist);
    localStorage.setItem('nutriUser', JSON.stringify(profileToPersist));
    const sessionUserId = userId || (await getCurrentSession().catch(() => null))?.user?.id || null;
    if (sessionUserId && profileToPersist.email) {
      setCurrentUserId(sessionUserId);
      void upsertProfile(sessionUserId, profileToPersist.email, profileToPersist as unknown as Record<string, unknown>)
        .then((result) => {
          if (result.queued) {
            toast('Perfil salvo neste aparelho. Vamos sincronizar quando a conexão voltar.', 'info');
          }
        })
        .catch((err) => {
          console.info('Supabase profile sync skipped:', getFriendlySupabaseError(err));
          toast(getFriendlySupabaseError(err), 'error');
        });
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          throw new Error('Não foi possível encerrar a sessão. Tente novamente.');
        }
      }
    }
    clearSyncQueue();
    try {
      localStorage.removeItem('nutriUser');
      localStorage.removeItem('nutriMeals');
      localStorage.removeItem('nutriAppFeedback');
    } catch {
      throw new Error('Não foi possível limpar os dados deste aparelho. Tente novamente.');
    }
    setLoggedMeals([]);
    setCurrentUserId(null);
    setUnreadMessages(0);
    window.location.replace('/');
  };

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const saved = localStorage.getItem('nutriUser');
      const savedMeals = localStorage.getItem('nutriMeals');
      if (saved) {
        try {
          const savedProfile = withProfileCompletionState(sanitizeProfileDefaults(JSON.parse(saved)));
          setUserProfile(savedProfile);
        } catch { }
      }
      if (savedMeals) {
        try { setLoggedMeals(JSON.parse(savedMeals)); } catch { }
      }

      if (isSupabaseConfigured) {
        try {
          const session = await getCurrentSession();
          if (session?.user && active) {
            const metadata = session.user.user_metadata || {};
            const metadataName = metadata.full_name || metadata.name || metadata.display_name || '';
            const metadataPhoto = metadata.avatar_url || metadata.picture || '';
            setCurrentUserId(session.user.id);
            const remoteProfile = await loadProfile(session.user.id).catch(() => null);
            let remoteMeals: any[] | null = null;
            if (isSupabaseDataSyncAvailable()) {
              try { remoteMeals = await loadMeals(session.user.id); } catch { remoteMeals = null; }
            }
            if (remoteProfile && active) {
              setUserProfile(prev => {
                const hydrated = withProfileCompletionState(sanitizeProfileDefaults({
                  ...remoteProfile,
                  email: session.user.email || remoteProfile.email || prev.email,
                  name: remoteProfile.name || prev.name || metadataName,
                  photo: remoteProfile.photo || prev.photo || metadataPhoto,
                } as UserProfile));
                localStorage.setItem('nutriUser', JSON.stringify(hydrated));
                setCurrentPage(page => page === 'landing' || page === 'dashboard' ? getPostLoginPage(hydrated) : page);
                return hydrated;
              });
            }
            if (remoteMeals !== null && active) {
              setLoggedMeals(remoteMeals);
              localStorage.setItem('nutriMeals', JSON.stringify(remoteMeals));
            }
          }
        } catch (err) {
          console.info('Supabase session hydrate skipped:', getFriendlySupabaseError(err));
        }
      }

      setTimeout(() => active && setIsLoading(false), 500);
    };
    hydrate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setUnreadMessages(0);
      return;
    }
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      loadUnreadMessageCount()
        .then((count) => { if (active) setUnreadMessages(count); })
        .catch(() => undefined);
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    refresh();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [currentUserId]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const page = event.state?.mindNutritionPage as Page | undefined;
      if (!page) return;
      isHistoryNavigation.current = true;
      setCurrentPage(page);
    };
    window.history.replaceState({ mindNutritionPage: currentPage }, '');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isHistoryNavigation.current) {
      isHistoryNavigation.current = false;
      return;
    }
    window.history.pushState({ mindNutritionPage: currentPage }, '');
  }, [currentPage]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem('nutriUser', JSON.stringify(userProfile));
  }, [userProfile, isLoading]);

  const closeArticle = () => {
    if (selectedArticle?.id && !(userProfile.readArticleIds || []).includes(selectedArticle.id)) {
      void persistUserProfile({ ...userProfile, readArticleIds: [...(userProfile.readArticleIds || []), selectedArticle.id] });
    }
    setSelectedArticle(null);
  };

  const saveMeal = async (meal: any) => {
    const normalizedMeal = {
      ...meal,
      id: meal.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      date: toIsoTimestamp(meal.date),
    };
    const updated = [normalizedMeal, ...loggedMeals.filter(existing => existing.id !== normalizedMeal.id)];
    setLoggedMeals(updated);
    localStorage.setItem('nutriMeals', JSON.stringify(updated));

    if (!currentUserId) {
      toast('Refeição salva neste aparelho. Entre na sua conta para sincronizar na nuvem.', 'info');
      return { synced: false, queued: false };
    }

    try {
      const result = await insertMeal(currentUserId, normalizedMeal);
      if (result.queued) {
        toast('Refeição salva neste aparelho. Sincronizamos assim que a conexão voltar.', 'info');
      } else if (!result.synced) {
        toast('Refeição salva localmente. A nuvem ainda não está configurada.', 'info');
      }
      return result;
    } catch (err) {
      console.info('Supabase meal sync skipped:', getFriendlySupabaseError(err));
      toast(getFriendlySupabaseError(err), 'error');
      return { synced: false, queued: false };
    }
  };

  const removeMeal = async (meal: any) => {
    const updated = loggedMeals.filter(item => item.id !== meal.id);
    setLoggedMeals(updated);
    localStorage.setItem('nutriMeals', JSON.stringify(updated));
    if (!currentUserId || !meal.id) return { ok: true };
    try {
      const result = await deleteMeal(currentUserId, meal.id);
      if (result.queued) toast('Exclusão salva neste aparelho. Sincronizamos quando a conexão voltar.', 'info');
      return { ok: true };
    } catch (err) {
      console.info('Supabase meal deletion skipped:', getFriendlySupabaseError(err));
      toast(getFriendlySupabaseError(err), 'error');
      return { ok: false };
    }
  };

  const addDailyNote = async (noteText: string, mood?: string) => {
    if (!noteText.trim()) return;
    const newNote: DailyNote = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      text: noteText.trim(),
      mood: mood || 'Neutro',
      createdAt: new Date().toISOString()
    };
    const updated = {
      ...userProfile,
      dailyNotes: [newNote, ...(userProfile.dailyNotes || [])]
    };
    await persistUserProfile(updated);
    toast('Anotação do dia salva no seu diário!', 'success');
  };

  const addSleepLog = async (hours: number, quality: 'Ruim' | 'Regular' | 'Bom' | 'Excelente', notes?: string) => {
    const newLog: SleepLog = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      hours,
      quality,
      notes: notes?.trim()
    };
    const updated = {
      ...userProfile,
      sleepLogs: [newLog, ...(userProfile.sleepLogs || [])]
    };
    await persistUserProfile(updated);
    toast('Registro de sono adicionado!', 'success');
  };

  // ---------- Navigation ----------

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Início' },
    { id: 'progress', icon: Activity, label: 'Insights' },
    { id: 'meal-log', icon: PlusCircle, label: 'Registrar', primary: true },
    { id: 'content', icon: Library, label: 'Biblioteca' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  const isNavItemActive = (id: Page) => {
    if (id === 'profile') {
      return ['profile', 'settings-account', 'settings-privacy', 'settings-help'].includes(currentPage);
    }
    if (id === 'meal-log') return ['meal-log', 'meal-details'].includes(currentPage);
    return currentPage === id;
  };

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      const data = await loadConversation();
      setUnreadMessages(data.unreadCount || 0);
      setUnreadNotifications(
        (data.messages || []).filter((message) => message.sender === 'nutritionist' && !message.readAt)
      );
    } catch {
      setUnreadNotifications([]);
      setNotificationsError('Não foi possível carregar as mensagens. Verifique sua conexão e tente novamente.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const openNotifications = () => {
    setShowNotificationsModal(true);
    void loadNotifications();
  };

  const openChatFromNotification = () => {
    setShowNotificationsModal(false);
    setCareInitialTab('chat');
    setCurrentPage('messages');
  };

  const renderTopNavbar = () => {
    if (['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles'].includes(currentPage) || isLoading) return null;

    return (
      <header className="app-topbar">
        <button
          type="button"
          onClick={() => setCurrentPage('dashboard')}
          className="topbar-brand min-h-11"
          aria-label="Ir para o início"
          aria-current={currentPage === 'dashboard' ? 'page' : undefined}
        >
          <img src={iconApp} alt="Ícone Mind Nutrition" className="h-10 w-10 shrink-0 object-contain" />
          <div className="hidden min-w-0 min-[360px]:block">
            <h1 className="topbar-title logo-wordmark">Mind Nutrition</h1>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNotifications}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink/60 transition hover:border-accent/40 hover:text-accent"
            aria-label={unreadMessages > 0 ? `Notificações: ${unreadMessages} não lidas` : 'Notificações'}
            title="Notificações"
          >
            <Bell size={17} />
            {unreadMessages > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => { setCareInitialTab('chat'); setCurrentPage('messages'); }}
            className="relative hidden h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink/60 transition hover:border-accent/40 hover:text-accent sm:inline-flex"
            aria-label={unreadMessages > 0 ? `Mensagens: ${unreadMessages} não lidas` : 'Mensagens e consultas'}
            aria-current={currentPage === 'messages' ? 'page' : undefined}
            title="Mensagens e consultas"
          >
            <MessageCircle size={17} />
            {unreadMessages > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-secondary px-1 text-[9px] font-bold text-white">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowHungerModal(true)}
            className="hidden min-h-11 sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 transition-colors"
            title="Diferenciar Fome Física e Emocional"
          >
            <HelpCircle size={15} />
            <span className="hidden md:inline">Fome Física x Emocional</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('profile')}
            className="topbar-profile min-h-11"
            aria-label="Abrir perfil"
            aria-current={isNavItemActive('profile') ? 'page' : undefined}
          >
            <span className="hidden min-w-0 text-right sm:block">
              <span className="topbar-eyebrow">Perfil</span>
              <span className="topbar-user">{userProfile.name || 'Completar dados'}</span>
            </span>
            <ProfileAvatar photo={userProfile.photo} size="sm" className="border-0 shadow-sm" />
          </button>
        </div>
      </header>
    );
  };

  const renderDesktopSidebar = () => {
    if (['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles'].includes(currentPage) || isLoading) return null;
    return (
      <aside className="app-sidebar" aria-label="Navegação principal">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item.id as Page);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentPage(item.id as Page)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative w-14 h-14 mb-2 flex items-center justify-center rounded-2xl transition-all ${isActive ? 'bg-accent/20 text-accent' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'}`}
              title={item.label}
            >
              {item.primary ? (
                <div className="w-12 h-12 rounded-full bg-accent text-paper flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform">
                  <item.icon size={24} />
                </div>
              ) : (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 border-2 border-accent rounded-2xl"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                </>
              )}
            </button>
          );
        })}
      </aside>
    );
  };

  const renderMobileNav = () => {
    if (['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles', 'meal-log'].includes(currentPage) || isLoading) return null;

    // Cinco itens: Início, Insights, Registrar (centro), Biblioteca, Perfil.
    return (
      <div className="mobile-nav fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-safe pointer-events-none">
        <nav aria-label="Navegação principal" className="pointer-events-auto grid grid-cols-5 h-16 w-full max-w-[24rem] items-center rounded-[1.75rem] border border-line bg-white px-1.5 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.id as Page);

            if (item.primary) {
              return (
                <div key={item.id} className="flex justify-center items-center">
                  <button
                    type="button"
                    onClick={() => setCurrentPage('meal-log')}
                    className="relative -top-5 w-14 h-14 rounded-full flex items-center justify-center border-4 border-white bg-accent text-paper shadow-lg hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Registrar Refeição"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <PlusCircle size={30} />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentPage(item.id as Page)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center h-14 rounded-full gap-0.5 transition-colors ${isActive ? 'text-accent font-bold' : 'text-ink/50 hover:text-ink'}`}
              >
                <div className="relative p-1 rounded-full flex items-center justify-center">
                  {isActive && (
                    <motion.div
                      layoutId="mob-nav-active"
                      className="absolute inset-0 rounded-full bg-accent/15"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon size={20} strokeWidth={isActive ? 2.6 : 2} className="relative z-10" />
                </div>
                <span className="text-xs font-bold leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  // -------------------------------------------------------------
  // PAGE RENDERERS
  // -------------------------------------------------------------

  const handleAuthenticatedUser = async (params: {
    user: { id: string; email?: string; user_metadata?: Record<string, any> };
    isLogin: boolean;
    signupPhoto: string;
  }) => {
    const { user, isLogin, signupPhoto } = params;
    const metadata = user.user_metadata || {};
    const metadataName = metadata.full_name || metadata.name || metadata.display_name || '';
    const metadataPhoto = metadata.avatar_url || metadata.picture || '';
    setCurrentUserId(user.id);
    const remoteProfile = await loadProfile(user.id).catch(() => null);
    let remoteMeals: any[] | null = null;
    if (isSupabaseDataSyncAvailable()) {
      try { remoteMeals = await loadMeals(user.id); } catch { remoteMeals = null; }
    }
    const nextProfile = remoteProfile && isLogin
      ? withProfileCompletionState(sanitizeProfileDefaults({
          ...remoteProfile,
          photo: remoteProfile.photo || metadataPhoto || userProfile.photo,
          name: remoteProfile.name || metadataName || userProfile.name,
          email: user.email || remoteProfile.email || '',
        } as UserProfile))
      : withProfileCompletionState(mergeProfileData(userProfile, {
          ...(remoteProfile || {}),
          photo: signupPhoto || metadataPhoto || userProfile.photo,
          name: remoteProfile?.name || userProfile.name || metadataName,
          email: user.email || '',
        }));
    await persistUserProfile(nextProfile, user.id);
    if (remoteMeals !== null) {
      setLoggedMeals(remoteMeals);
      localStorage.setItem('nutriMeals', JSON.stringify(remoteMeals));
    }
    toast(isLogin ? 'Login realizado com segurança.' : 'Conta criada! Complete seus dados iniciais.', 'success');
    setCurrentPage(getPostLoginPage(nextProfile));
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="app-shell bg-paper text-ink min-h-screen">
      <div className="paper-texture" />

      {renderDesktopSidebar()}
      {renderTopNavbar()}

      <main className="app-main relative z-10 w-full overflow-x-hidden">
        <AnimatePresence mode="wait">
          {currentPage === 'landing' && (
            <PageContainer
              noPadding
              key="landing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="landing-gradient fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-paper">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-paper via-transparent to-paper pointer-events-none z-0" />
                <div className="relative z-10 mx-auto flex h-full w-full max-w-[2000px] flex-col">
                  <div className="flex flex-1 flex-col justify-center px-5 py-6 pb-32 sm:px-8 md:px-16">
                    <div className="max-w-4xl mx-auto w-full">
                      <div className="mb-4 flex items-center gap-2.5">
                        <img src={iconApp} alt="Ícone Mind Nutrition" className="h-10 w-10 object-contain" />
                        <span className="logo-wordmark text-xl text-accent">Mind Nutrition</span>
                      </div>
                      <h1 className="display-title mb-6 text-accent text-[2.65rem] sm:text-[3.7rem] md:text-[4.6rem] leading-[0.92]">Sua jornada começa aqui.</h1>

                      <div className="relative z-20 mb-6 max-w-xl rounded-[1.5rem] border border-line bg-white/70 p-4 shadow-sm backdrop-blur-md sm:p-5">
                        <p className="serif-body mb-2 text-xl leading-tight text-ink sm:text-2xl">
                          Vá além do ruído das dietas.
                        </p>
                        <p className="text-ink/75 font-medium text-sm md:text-base leading-relaxed">
                          Descubra uma abordagem gentil para a sua alimentação. Experimente refletir sobre o que você está sentindo e avalie se precisa, de fato, comer.
                        </p>
                      </div>

                      <div className="relative z-20 flex flex-wrap gap-3">
                        <button
                          onClick={() => setCurrentPage(currentUserId ? getPostLoginPage(userProfile) : 'auth')}
                          className="group relative inline-flex items-center gap-3 rounded-2xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-widest text-paper shadow-lg transition-all hover:scale-105 active:scale-95"
                        >
                          <FaBrain size={22} />
                          <span>{currentUserId ? 'Continuar Jornada' : 'Começar Jornada'}</span>
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="landing-waves" aria-hidden="true">
                  <svg className="landing-wave landing-wave-back" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <path fill="var(--accent-secondary)" d="M0,192L48,181.3C96,171,192,149,288,138.7C384,128,480,128,576,149.3C672,171,768,213,864,208C960,203,1056,149,1152,133.3C1248,117,1344,139,1392,149.3L1440,160L1440,320L0,320Z" />
                  </svg>
                  <svg className="landing-wave landing-wave-front" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <path fill="var(--accent)" d="M0,224L48,208C96,192,192,160,288,154.7C384,149,480,171,576,192C672,213,768,235,864,229.3C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L0,320Z" />
                  </svg>
                </div>
              </div>
            </PageContainer>
          )}

          {currentPage === 'auth' && (
            <AuthPage
              key="auth"
              userProfile={userProfile}
              onAuthenticated={handleAuthenticatedUser}
              onNavigate={setCurrentPage}
              onShowToast={toast}
            />
          )}

          {currentPage === 'diagnosis' && (
            <DiagnosisPage
              key="diagnosis"
              userProfile={userProfile}
              step={diagnosisStep}
              setStep={setDiagnosisStep}
              onComplete={async (p) => {
                await persistUserProfile(p);
                toast('Perfil inicial configurado com sucesso!', 'success');
                setCurrentPage('dashboard');
              }}
              onBack={() => diagnosisStep > 0 ? setDiagnosisStep(s => s - 1) : setCurrentPage('auth')}
              onOpenHungerModal={() => setShowHungerModal(true)}
            />
          )}

          {currentPage === 'dashboard' && (
            <DashboardPage
              key="dashboard"
              userProfile={userProfile}
              loggedMeals={loggedMeals}
              onNavigate={setCurrentPage}
              onOpenTutorial={() => setShowTutorialModal(true)}
              onOpenDiary={() => setShowDailyDiaryModal(true)}
              onOpenSleep={() => setShowSleepModal(true)}
              onOpenAiSummary={() => { setAiSummaryShortcut(value => value + 1); setCurrentPage('progress'); }}
              onMoodShared={(mood) => {
                const checkIns = [...(userProfile.checkIns || []), { date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), mood }];
                persistUserProfile({ ...userProfile, checkIns });
              }}
              onSelectMeal={(m) => { setSelectedMeal(m); setCurrentPage('meal-details'); }}
              toast={toast}
              unreadMessages={unreadMessages}
              onOpenCare={(tab) => {
                setCareInitialTab(tab);
                setCurrentPage('messages');
              }}
            />
          )}

          {currentPage === 'meal-log' && (
            <MealLogPage
              key="meal-log"
              onSaveMeal={async (newMeal) => {
                const result = await saveMeal(newMeal);
                if (result.synced || result.queued || !currentUserId) {
                  toast('Refeição registrada com sucesso!', 'success');
                }
                setCurrentPage('dashboard');
              }}
              onNavigate={setCurrentPage}
              onOpenHungerModal={() => setShowHungerModal(true)}
              toast={toast}
            />
          )}

          {currentPage === 'content' && (
            <ContentPageComponent
              key="content"
              onSelectArticle={setSelectedArticle}
              onNavigate={setCurrentPage}
              readArticleIds={userProfile.readArticleIds || []}
            />
          )}

          {currentPage === 'messages' && (
            <UserCarePage
              key="messages"
              onNavigate={setCurrentPage}
              toast={toast}
              onUnreadChange={setUnreadMessages}
              initialTab={careInitialTab}
            />
          )}

          {currentPage === 'progress' && (
            <ProgressPageComponent
              key="progress"
              userProfile={userProfile}
              loggedMeals={loggedMeals}
              onNavigate={setCurrentPage}
              onSaveProfile={persistUserProfile}
              toast={toast}
              aiSummaryShortcut={aiSummaryShortcut}
            />
          )}

          {currentPage === 'challenge' && (
            <ChallengePage
              key="challenge"
              userProfile={userProfile}
              loggedMeals={loggedMeals}
              onSaveProfile={persistUserProfile}
              onNavigate={setCurrentPage}
              toast={toast}
            />
          )}

          {currentPage === 'profile' && (
            <ProfilePageComponent
              key="profile"
              userProfile={userProfile}
              onNavigate={setCurrentPage}
              onOpenDiary={() => setShowDailyDiaryModal(true)}
              onSaveProfile={persistUserProfile}
              onOpenCare={(tab) => { setCareInitialTab(tab); setCurrentPage('messages'); }}
              onLogout={handleLogout}
              toast={toast}
            />
          )}

          {currentPage === 'settings-account' && (
            <AccountSettingsPage
              key="account"
              userProfile={userProfile}
              onSaveProfile={async (p) => {
                await persistUserProfile(p);
                toast('Perfil salvo neste aparelho.', 'success');
                setCurrentPage('profile');
              }}
              onNavigate={setCurrentPage}
            />
          )}


          {currentPage === 'settings-privacy' && (
            <PrivacySettingsPage
              key="privacy"
              currentUserId={currentUserId}
              onDeleteData={async () => {
                try {
                  if (currentUserId) await deleteCurrentUserData(currentUserId);
                  clearSyncQueue();
                  if (supabase) {
                    try {
                      await supabase.auth.signOut();
                    } catch {
                      await supabase.auth.signOut({ scope: 'local' });
                    }
                  }
                  localStorage.removeItem('nutriUser');
                  localStorage.removeItem('nutriMeals');
                  setLoggedMeals([]);
                  setCurrentUserId(null);
                  toast('Seus dados foram apagados.', 'success');
                  setCurrentPage('landing');
                } catch {
                  toast('Não foi possível concluir a exclusão. Verifique a conexão e tente novamente.', 'error');
                  return false;
                }
              }}
              onNavigate={setCurrentPage}
            />
          )}

          {currentPage === 'settings-help' && (
            <SettingsHelpPage
              key="help"
              onNavigate={setCurrentPage}
            />
          )}

          {currentPage === 'meal-details' && (
            <MealDetailsPageComponent
              key="meal-details"
              selectedMeal={selectedMeal}
              onNavigate={setCurrentPage}
              onUpdate={async (meal) => {
                const result = await saveMeal(meal);
                setSelectedMeal(meal);
                if (result.synced || result.queued || !currentUserId) toast('Refeição atualizada.', 'success');
              }}
              onDelete={async () => {
                if (!selectedMeal) return false;
                const result = await removeMeal(selectedMeal);
                if (!result.ok) return false;
                setSelectedMeal(null);
                setCurrentPage('dashboard');
                toast('Refeição excluída.', 'success');
              }}
              toast={toast}
            />
          )}

          {(currentPage === 'admin-dashboard' || currentPage === 'admin-login') && (
            <AdminPlatform
              key="admin-platform"
              toast={toast}
              onExit={() => {
                window.history.replaceState({ mindNutritionPage: 'landing' }, '', '/');
                setCurrentPage('landing');
              }}
            />
          )}
        </AnimatePresence>
      </main>

      {renderMobileNav()}

      {/* Standalone Modals (zero dynamic hooks in helper function bodies) */}
      <HungerGuideModal isOpen={showHungerModal} onClose={() => setShowHungerModal(false)} />
      <TutorialModal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} />
      <DailyDiaryModal
        isOpen={showDailyDiaryModal}
        onClose={() => setShowDailyDiaryModal(false)}
        onSave={addDailyNote}
      />
      <SleepModal
        isOpen={showSleepModal}
        onClose={() => setShowSleepModal(false)}
        onSave={addSleepLog}
      />

      <Overlay
        open={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        title="Mensagens da nutricionista"
        description="Avisos da sua conversa que ainda não foram vistos."
        closeLabel="Fechar notificações"
        footer={<Button fullWidth onClick={openChatFromNotification}>Abrir conversa</Button>}
      >
        {notificationsLoading ? (
          <StateView status="loading" title="Carregando mensagens..." compact />
        ) : notificationsError ? (
          <StateView
            status="error"
            title="Não foi possível carregar as mensagens"
            description={notificationsError}
            compact
            action={<Button variant="secondary" onClick={() => void loadNotifications()} loading={notificationsLoading}>Tentar novamente</Button>}
          />
        ) : unreadNotifications.length === 0 ? (
          <StateView status="empty" title="Nenhuma mensagem não vista" description="Quando a nutricionista enviar uma mensagem, ela aparecerá aqui." compact />
        ) : (
          <div className="space-y-3">
            {unreadNotifications.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={openChatFromNotification}
                className="w-full rounded-2xl border border-line bg-white p-4 text-left transition hover:border-accent hover:bg-accent/5"
              >
                <span className="text-xs font-bold text-accent">Mensagem não vista</span>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/80">{message.body}</p>
                <span className="mt-2 block text-xs text-ink/50">
                  {message.createdAt
                    ? new Date(message.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </Overlay>

      <Overlay
        open={Boolean(selectedArticle)}
        onClose={closeArticle}
        title={selectedArticle?.title || 'Artigo'}
        variant="drawer"
        dragToClose
        closeLabel="Fechar artigo"
        headerClassName="article-reader-header flex items-center justify-between gap-4"
        header={
          <>
            <span className="label-sm text-accent">{selectedArticle?.type}</span>
            <button type="button" onClick={closeArticle} aria-label="Fechar artigo" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line hover:bg-line transition-colors">
              <X size={18} />
            </button>
          </>
        }
        footer={<Button fullWidth onClick={closeArticle}>{selectedArticle?.type === 'Receita' ? 'Concluir receita' : 'Concluir leitura'}</Button>}
      >
        <h2 className="display-title text-3xl sm:text-4xl mb-6 leading-tight">{selectedArticle?.title}</h2>
        <div className="mask-image-full mb-6 overflow-hidden rounded-[2rem] shadow-md h-52 sm:h-72">
          <img src={selectedArticle?.image || DEFAULT_RECIPES[0].image} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="prose prose-lg max-w-none text-ink/90 space-y-4">
          {selectedArticle?.contentHtml || selectedArticle?.content_html ? (
            <div
              className="article-rich"
              dangerouslySetInnerHTML={{ __html: selectedArticle.contentHtml || selectedArticle.content_html }}
            />
          ) : (
            (selectedArticle?.content || [selectedArticle?.summary]).map((paragraph: string, index: number) => (
              <p key={index} className={index === 0 ? 'drop-cap serif-body text-xl sm:text-2xl leading-relaxed mb-6 font-normal' : 'text-base sm:text-lg leading-relaxed font-medium text-ink/85'}>
                {paragraph}
              </p>
            ))
          )}
          {selectedArticle?.sourceLabel && (
            <div className="mt-8 rounded-2xl border border-line bg-white p-4 text-xs leading-relaxed text-ink/65">
              <span className="label-sm text-accent">Fonte e referência</span>
              {selectedArticle.sourceUrl ? (
                <a href={selectedArticle.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block font-bold text-accent hover:underline">{selectedArticle.sourceLabel}</a>
              ) : <p className="mt-1 font-bold">{selectedArticle.sourceLabel}</p>}
            </div>
          )}
        </div>
      </Overlay>
    </div>
  );
}

// =========================================================================
// STANDALONE PAGE COMPONENTS
// =========================================================================

function DiagnosisPage({
  userProfile,
  step,
  setStep,
  onComplete,
  onBack,
  onOpenHungerModal
}: {
  userProfile: UserProfile;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  onComplete: (profile: UserProfile) => void | Promise<void>;
  onBack: () => void;
  onOpenHungerModal: () => void;
}) {
  const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'age' | 'height' | 'weight', string>>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const steps = [
    { id: 'name', title: "Como prefere ser chamado?", subtitle: "Sua identidade é essencial para nós.", type: 'input', field: 'name', placeholder: 'Seu nome ou apelido' },
    { id: 'gender', title: "Como você se identifica?", subtitle: "Escolha a opção que melhor representa você.", type: 'options', field: 'gender', options: ["Mulher", "Homem", "Não Binário(a)", "Outro", "Prefiro não informar"] },
    {
      id: 'basics', title: "Sobre sua rotina", subtitle: "Esses dados ajudam a personalizar seu cuidado com gentileza.", type: 'basic', options: [
        { label: "Sedentário (pouco ou nenhum exercício)", value: 1.2 },
        { label: "Levemente ativo (exercício leve 1-3 dias/sem)", value: 1.375 },
        { label: "Moderadamente ativo (exercício 3-5 dias/sem)", value: 1.55 },
        { label: "Muito ativo (exercício pesado 6-7 dias/sem)", value: 1.725 }
      ]
    },
    { id: 'emotions', title: "Como você se sente ultimamente?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'initialEmotions', options: ["Estressado(a)", "Frustrado(a)", "Deprimido(a)", "Solitário(a)", "Ansioso(a)", "Raivoso(a)", "Alegre", "Animado(a)", "Calmo(a)", "Outro"] },
    { id: 'comorbidities', title: "Você possui alguma condição de saúde?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'comorbidities', options: ["Não possuo nenhuma condição", "Sou diabético(a)", "Sou hipertenso(a)", "Tenho alterações da tireoide", "Tenho transtornos emocionais", "Outro"] },
    { id: 'triggers', title: "Quais emoções você costuma sentir antes de comer sem fome física?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'triggers', options: ["Tédio", "Cansaço", "Raiva", "Tristeza", "Ansiedade", "Alegria", "Outro"], hasHelpGuide: true },
    { id: 'foods', title: "Quando sente vontade de comer por causa das suas emoções, quais alimentos procura?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'foods', options: ["Doces", "Salgados", "Massas", "Salgadinhos", "Fast food", "Outro"] },
    { id: 'objectives', title: "Qual é o seu principal objetivo com este aplicativo?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'objectives', options: ["Emagrecimento consciente", "Melhorar a relação com a comida", "Ganho de peso", "Hipertrofia", "Cuidar da minha saúde", "Outro"] },
    { id: 'measurements', title: "Suas medidas iniciais", subtitle: "Para personalizar suas necessidades com acolhimento.", type: 'measurements' }
  ];

  const current = steps[step] || steps[0];

  const handleNext = async () => {
    if (submittingRef.current) return;
    const errors: Partial<Record<'name' | 'age' | 'height' | 'weight', string>> = {};
    setFormError('');
    if (current.type === 'input' && !tempProfile.name?.trim()) {
      errors.name = 'Por favor, informe seu nome.';
    }
    if (current.type === 'basic' && (!tempProfile.age || tempProfile.age < 10 || tempProfile.age > 120)) {
      errors.age = 'Informe uma idade válida para continuar.';
    }
    if (current.type === 'measurements') {
      const initialWeight = tempProfile.weightEvolution?.[0]?.value || 0;
      if (tempProfile.height < 80 || tempProfile.height > 250) errors.height = 'Informe uma altura entre 80 e 250 cm.';
      if (initialWeight < 20 || initialWeight > 350) errors.weight = 'Informe um peso entre 20 e 350 kg.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    if (current.type === 'measurements') {
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const initialWeight = tempProfile.weightEvolution?.[0]?.value || 0;
        const result = calculateNutritionalNeeds(
          initialWeight,
          tempProfile.height,
          tempProfile.age || 25,
          tempProfile.gender || 'Feminino',
          tempProfile.activityLevel || 1.2,
          tempProfile.objectives
        );
        const finalProfile = withProfileCompletionState({ ...tempProfile, ...result });
        await onComplete(finalProfile);
      } catch {
        setFormError('Não foi possível concluir o diagnóstico. Tente novamente.');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    if (step < steps.length - 1) setStep(s => s + 1);
  };

  return (
    <>
    <PageContainer
      variant="narrow"
      noPadding
      hasTopbar={false}
      className="space-y-6 px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] md:pb-12"
    >
      <PageHeader
        title={current.title}
        subtitle={current.subtitle}
        eyebrow={`Etapa ${step + 1} de ${steps.length}`}
        back={{ label: step > 0 ? 'Voltar à etapa anterior' : 'Sair do diagnóstico', onClick: onBack }}
        actions={current.hasHelpGuide ? (
          <button
            type="button"
            onClick={onOpenHungerModal}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/20"
          >
            <HelpCircle size={14} /> Entender fome
          </button>
        ) : undefined}
      />

      <div
        role="progressbar"
        aria-label="Progresso do diagnóstico"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Etapa ${step + 1} de ${steps.length}`}
        className="grid grid-cols-9 gap-1.5"
      >
        {steps.map((item, index) => (
          <span key={item.id} className={`h-2 rounded-full ${index <= step ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>

      <form id="diagnosis-form" onSubmit={event => { event.preventDefault(); void handleNext(); }}>
        {formError && <p role="alert" className="rounded-2xl bg-danger/5 p-3 text-sm font-semibold text-danger">{formError}</p>}

        {current.type === 'input' && (
          <FormField
            label="Nome ou apelido"
            htmlFor="diagnosis-name"
            required
            error={fieldErrors.name}
            hint="Você poderá alterar isso depois no seu perfil."
          >
            <input
              id="diagnosis-name"
              type="text"
              placeholder={current.placeholder}
              className="input-field min-h-14 text-lg"
              value={tempProfile.name}
              maxLength={80}
              autoComplete="name"
              autoFocus
              onChange={(e) => {
                setTempProfile({ ...tempProfile, name: e.target.value });
                setFieldErrors(previous => ({ ...previous, name: undefined }));
              }}
            />
          </FormField>
        )}

        {current.type === 'options' && (
          <fieldset className="space-y-3">
            <legend className="sr-only">{current.title}</legend>
            {(current.options as string[] | undefined)?.map((opt: string) => {
              const isOther = opt === 'Outro';
              const isSelected = tempProfile[current.field as keyof UserProfile] === opt || (isOther && String(tempProfile[current.field as keyof UserProfile]).startsWith('Outro:'));
              return (
                <div key={opt} className="space-y-2">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (isOther) {
                        setTempProfile({ ...tempProfile, [current.field!]: 'Outro: ' });
                      } else {
                        setTempProfile({ ...tempProfile, [current.field!]: opt });
                        setTimeout(() => setStep(value => value + 1), 120);
                      }
                    }}
                    className={`w-full min-h-14 p-5 text-left border-2 rounded-2xl font-bold text-base sm:text-lg transition-all ${isSelected ? 'border-accent bg-accent/10 text-accent shadow-xs' : 'border-line hover:border-accent hover:bg-accent/5'}`}
                  >
                    {opt}
                  </button>
                  {isOther && isSelected && (
                    <FormField label="Como você se identifica?" htmlFor="diagnosis-gender-other">
                      <input
                        id="diagnosis-gender-other"
                        type="text"
                        placeholder="Especifique..."
                        className="input-field min-h-12"
                        value={String(tempProfile[current.field as keyof UserProfile]).replace(/^Outro:\s*/, '')}
                        onChange={(e) => setTempProfile({ ...tempProfile, [current.field!]: `Outro: ${e.target.value}` })}
                        autoFocus
                      />
                    </FormField>
                  )}
                </div>
              );
            })}
          </fieldset>
        )}

        {current.type === 'basic' && (
          <div className="space-y-6">
            <FormField label="Qual é a sua idade?" htmlFor="diagnosis-age" required error={fieldErrors.age}>
              <input
                id="diagnosis-age"
                type="number"
                min="10"
                max="120"
                inputMode="numeric"
                placeholder="Ex: 28"
                className="input-field min-h-14 text-lg font-bold"
                value={tempProfile.age || ''}
                onChange={(e) => {
                  setTempProfile({ ...tempProfile, age: parseFloat(e.target.value) || 0 });
                  setFieldErrors(previous => ({ ...previous, age: undefined }));
                }}
              />
            </FormField>
            <fieldset>
              <legend className="label-sm mb-3 text-accent">Como é sua rotina de atividade física?</legend>
              <div className="grid gap-2">
                {(current.options as Array<{ label: string; value: number }> | undefined)?.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={tempProfile.activityLevel === opt.value}
                    onClick={() => setTempProfile({ ...tempProfile, activityLevel: opt.value })}
                    className={`w-full min-h-12 rounded-2xl border-2 p-4 text-left text-sm font-medium transition-colors ${tempProfile.activityLevel === opt.value ? 'border-accent bg-accent/10 text-accent shadow-xs' : 'border-line hover:border-accent'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {current.type === 'multiselect' && (
          <fieldset className="space-y-6">
            <legend className="sr-only">{current.title} Marque uma ou mais opções.</legend>
            <div className="grid gap-3">
              {(current.options as string[] | undefined)?.map((opt: string) => {
                const isOther = opt.startsWith('Outro');
                const arr = (tempProfile[current.field as keyof UserProfile] as string[]) || [];
                const selected = arr.includes(opt) || (isOther && arr.some(i => i.startsWith('Outro')));

                return (
                  <div key={opt}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        if (isOther) {
                          if (selected) {
                            setTempProfile({ ...tempProfile, [current.field!]: arr.filter(i => !i.startsWith('Outro')) });
                          } else {
                            setTempProfile({ ...tempProfile, [current.field!]: [...arr, 'Outro: '] });
                          }
                        } else {
                          const nextArr = selected ? arr.filter(i => i !== opt) : [...arr, opt];
                          setTempProfile({ ...tempProfile, [current.field!]: nextArr });
                        }
                      }}
                      className={`w-full min-h-14 p-4 sm:p-5 text-left border-2 rounded-2xl font-bold text-base transition-all ${selected ? 'border-accent bg-accent text-paper shadow-sm' : 'border-line hover:border-accent bg-white/70'}`}
                    >
                      {opt}
                    </button>
                    {isOther && selected && (
                      <div className="mt-2">
                        <label htmlFor={`diagnosis-${current.id}-other`} className="mb-1.5 block text-sm font-semibold text-ink">Descreva sua resposta</label>
                        <input
                          id={`diagnosis-${current.id}-other`}
                          type="text"
                          autoFocus
                          placeholder="Descreva aqui..."
                          className="input-field min-h-12"
                          value={arr.find(i => i.startsWith('Outro'))?.replace(/^Outro[s]?:\s*/, '') || ''}
                          onChange={(e) => {
                            const newArr = arr.filter(i => !i.startsWith('Outro'));
                            newArr.push('Outro: ' + e.target.value);
                            setTempProfile({ ...tempProfile, [current.field!]: newArr });
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        {current.type === 'measurements' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Altura (cm)" htmlFor="diagnosis-height" required error={fieldErrors.height}>
                <input
                  id="diagnosis-height"
                  type="number"
                  min="80"
                  max="250"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ex: 170"
                  className="input-field min-h-14 text-lg font-bold"
                  value={tempProfile.height || ''}
                  onChange={(e) => {
                    setTempProfile({ ...tempProfile, height: parseFloat(e.target.value) || 0 });
                    setFieldErrors(previous => ({ ...previous, height: undefined }));
                  }}
                />
              </FormField>
              <FormField label="Peso atual (kg)" htmlFor="diagnosis-weight" required error={fieldErrors.weight}>
                <input
                  id="diagnosis-weight"
                  type="number"
                  min="20"
                  max="350"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ex: 70.5"
                  className="input-field min-h-14 text-lg font-bold"
                  value={tempProfile.weightEvolution?.[0]?.value || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    setTempProfile({ ...tempProfile, weightEvolution: [{ date, value: val }] });
                    setFieldErrors(previous => ({ ...previous, weight: undefined }));
                  }}
                />
              </FormField>
            </div>

            <div className="p-4 bg-accent/10 border border-accent/20 rounded-2xl flex gap-3 items-center">
              <Sparkles className="text-accent shrink-0" size={22} />
              <p className="text-xs font-medium text-ink/75 leading-relaxed">
                Sua altura e peso nos ajudam a calibrar estimativas de energia de forma acolhedora e privativa.
              </p>
            </div>
          </div>
        )}

        <div className="hidden pt-2 md:block">
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {current.type === 'measurements' ? 'Finalizar e acessar meu espaço' : current.type === 'multiselect' ? 'Confirmar escolhas' : 'Continuar'}
          </Button>
        </div>
      </form>
    </PageContainer>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:hidden">
      <Button type="submit" form="diagnosis-form" size="lg" fullWidth loading={submitting}>
        {current.type === 'measurements' ? 'Finalizar e acessar meu espaço' : current.type === 'multiselect' ? 'Confirmar escolhas' : 'Continuar'}
      </Button>
    </div>
    </>
  );
}

function DashboardPage({
  userProfile,
  loggedMeals,
  onNavigate,
  onOpenTutorial,
  onOpenDiary,
  onOpenSleep,
  onOpenAiSummary,
  onMoodShared,
  onSelectMeal,
  toast,
  unreadMessages,
  onOpenCare
}: {
  userProfile: UserProfile;
  loggedMeals: any[];
  onNavigate: (page: Page) => void;
  onOpenTutorial: () => void;
  onOpenDiary: () => void;
  onOpenSleep: () => void;
  onOpenAiSummary: () => void;
  onMoodShared: (mood: string) => void;
  onSelectMeal: (meal: any) => void;
  toast: any;
  unreadMessages: number;
  onOpenCare: (tab: 'chat' | 'appointments') => void;
}) {
  const [appRating, setAppRating] = useState<number | null>(() => {
    const saved = localStorage.getItem('nutriAppFeedback');
    return saved ? Number(saved) : null;
  });

  const quotes = [
    'Hoje você não precisa resolver toda a sua vida. Precisa apenas cuidar do próximo passo.',
    'Compaixão por si mesmo é simplesmente dar a si a mesma bondade que daríamos aos outros. - Kristin Neff',
    'Entre o estímulo e a resposta existe um espaço. Nesse espaço está nosso poder de escolher. - Viktor Frankl',
    'Você não pode parar as ondas, mas pode aprender a surfar. - Jon Kabat-Zinn',
    'A esperança pode tornar o momento presente menos difícil de suportar. - Thich Nhat Hanh'
  ];

  const integratedInsight = buildIntegratedInsight(userProfile, loggedMeals);
  const awarenessScore = integratedInsight.score;
  const firstName = userProfile.name?.trim().split(/\s+/)[0] || 'você';
  const latestMood = userProfile.checkIns?.[userProfile.checkIns.length - 1]?.mood;
  const latestSleep = userProfile.sleepLogs?.[0];
  const challengeDays = userProfile.challenge?.days || [];
  const completedChallengeDays = challengeDays.filter(isDayComplete).length;
  const quoteIndex = Math.floor(Date.now() / 86_400_000) % quotes.length;

  return (
    <PageContainer className="flex flex-col gap-8 md:gap-10">
      <PageHeader
        eyebrow="Mind Nutrition"
        title={userProfile.name ? `Espaço de ${firstName}` : 'Seu espaço de cuidado'}
        subtitle="Um passo de cada vez, no seu ritmo."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={onOpenAiSummary}><Sparkles size={15} /> Resumo IA</Button>
            <Button variant="ghost" size="sm" onClick={onOpenTutorial}><Compass size={15} /> Guia rápido</Button>
          </>
        }
      />

      <Button
        size="lg"
        fullWidth
        onClick={() => onNavigate('meal-log')}
        className="min-h-16 justify-between rounded-[1.5rem] px-5 text-left"
      >
        <span className="flex items-center gap-4">
          <PlusCircle size={26} />
          <span><span className="block">Registrar refeição</span><span className="block text-xs font-medium text-paper/80">Observe fome, saciedade e humor agora</span></span>
        </span>
        <ArrowRight size={20} />
      </Button>

      <div><MascotBubble userProfile={userProfile} onMoodShared={onMoodShared} /></div>

      <section>
        <div className="responsive-page-header mb-4">
          <div className="flex items-center gap-2.5">
            <Coffee size={20} className="text-accent" />
            <h3 className="label-sm text-accent">Últimas refeições</h3>
          </div>
          {loggedMeals.length > 0 && <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full">{loggedMeals.length} registros</span>}
        </div>
        <div className="bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm">
          {loggedMeals.length === 0 ? (
            <StateView status="empty" title="Nenhuma refeição registrada ainda" description="Comece a registrar suas refeições para acompanhar sua fome, saciedade e sentimentos." action={<Button onClick={() => onNavigate('meal-log')}>Registrar primeira refeição</Button>} />
          ) : (
            loggedMeals.slice(0, 8).map((meal: any, i: number) => {
              const mealType = inferMealType(meal);
              const MealIcon = mealType === 'Física' ? TbHealthRecognition : mealType === 'Emocional' ? PiHeartbeat : Coffee;
              const satisfaction = meal.satisfaction === null || meal.satisfaction === undefined ? 'Não informada' : `${meal.satisfaction}/5`;
              return (
                <button
                  key={meal.id || i}
                  type="button"
                  onClick={() => onSelectMeal(meal)}
                  className="w-full min-h-20 p-4 sm:px-6 border-b border-line last:border-0 flex items-center justify-between gap-3 hover:bg-accent/5 transition-colors text-left"
                >
                  <span className="flex min-w-0 items-center gap-3 sm:gap-4">
                    {meal.photos?.[0] || meal.image ? (
                      <img src={meal.photos?.[0] || meal.image} alt="" className="w-12 h-12 rounded-2xl object-cover border border-line shrink-0" />
                    ) : (
                      <span className={`flex w-12 h-12 items-center justify-center rounded-2xl shrink-0 ${mealType === 'Emocional' ? 'bg-accent-secondary/20 text-accent-secondary' : 'bg-accent/10 text-accent'}`}><MealIcon size={22} /></span>
                    )}
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-base font-bold text-ink">{meal.title || 'Refeição'}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${mealType === 'Emocional' ? 'bg-accent-secondary/15 text-accent-secondary' : 'bg-accent/15 text-accent'}`}>{mealType}</span>
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-ink/50">
                        {meal.time || new Date(meal.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Satisfação: {satisfaction} • {meal.postMood || meal.preMood || 'Neutro'}
                      </span>
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-ink/30 shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Acompanhamento: conversa e consultas */}
      <section className="rounded-[2rem] border border-line bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-sm text-accent">Seu acompanhamento</p>
            <h3 className="font-display text-xl font-semibold text-ink">Converse e agende sua consulta</h3>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-ink/55">
              Fale direto com sua nutricionista e escolha um horário livre na agenda. Cada solicitação é confirmada por ela.
            </p>
          </div>
          {unreadMessages > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold text-paper">
              <MessageCircle size={12} /> {unreadMessages} nova{unreadMessages === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onOpenCare('chat')}
            className="group flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-paper/50 p-4 text-left transition hover:border-accent hover:bg-accent/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <MessageCircle size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">Abrir conversa</span>
              <span className="block text-[11px] text-ink/50">Mensagens privadas com sua nutricionista</span>
            </span>
            <ChevronRight size={16} className="ml-auto shrink-0 text-ink/30 transition group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenCare('appointments')}
            className="group flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-paper/50 p-4 text-left transition hover:border-accent hover:bg-accent/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-secondary/15 text-accent-secondary">
              <CalendarDays size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">Marcar consulta</span>
              <span className="block text-[11px] text-ink/50">Veja os dias e horários livres</span>
            </span>
            <ChevronRight size={16} className="ml-auto shrink-0 text-ink/30 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      {/* Desafio de 21 Dias */}
      <button
        type="button"
        onClick={() => onNavigate('challenge')}
        className="group relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent via-accent to-accent-secondary p-6 text-left text-paper shadow-lg transition-all hover:shadow-xl active:scale-98"
      >
        <Sprout className="absolute -right-6 -bottom-8 text-white/15 w-40 h-40 rotate-12" aria-hidden="true" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <Sprout size={26} />
            </span>
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-paper/80">Jornada guiada · 21 dias</p>
              <h3 className="font-display text-2xl font-bold leading-tight mt-0.5">Desafio de 21 Dias</h3>
              <p className="mt-1 text-xs font-medium text-paper/85">Observar, compreender e cultivar em pequenos registros diários.</p>
            </div>
          </div>
          <ArrowRight size={22} className="shrink-0 transition-transform group-hover:translate-x-1" />
        </div>
        <div className="relative z-10 mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-bold text-paper/85"><span>{completedChallengeDays} de 21 dias concluídos</span><span>{Math.round(completedChallengeDays / 21 * 100)}%</span></div>
          <div role="progressbar" aria-label="Progresso do desafio" aria-valuemin={0} aria-valuemax={21} aria-valuenow={completedChallengeDays} className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${completedChallengeDays / 21 * 100}%` }} /></div>
        </div>
      </button>

      {/* Card Reflexão do Dia & Status */}
      <section className="mobile-card-padding animated-gradient p-6 md:p-10 rounded-[2rem] shadow-lg relative overflow-hidden text-paper">
        <Sparkles className="absolute -right-4 -top-4 text-paper/20 w-32 h-32 spin-slow" aria-hidden="true" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-center">
          <div>
            <h3 className="label-sm mb-3 glass-badge font-bold inline-block">Reflexão do dia</h3>
            <p className="serif-body text-xl md:text-2xl leading-relaxed drop-shadow-sm">“{quotes[quoteIndex]}”</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('progress')}
            className="min-h-24 rounded-[1.75rem] border border-white/30 bg-white/15 p-5 text-left transition-transform hover:scale-[1.02] active:scale-98"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-paper/80">Hoje, {firstName}</p>
              <ChevronRight size={16} className="text-paper/70" />
            </div>
            <p className="mt-1.5 text-lg font-bold truncate">{latestMood ? `Humor registrado: ${latestMood}` : 'Toque para ver seus sinais da jornada'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-black/10 p-2.5"><span className="block text-xl font-bold">{loggedMeals.length}</span><span className="text-xs font-bold tracking-wide text-paper/70">refeições</span></div>
              <div className="rounded-xl bg-black/10 p-2.5"><span className="block text-xl font-bold">{awarenessScore}%</span><span className="text-xs font-bold tracking-wide text-paper/70">consciência</span></div>
            </div>
          </button>
        </div>
      </section>

      <Button variant="secondary" fullWidth onClick={onOpenDiary}><PenTool size={18} /> Abrir diário do dia</Button>

      {/* Quick Hub Grid */}
      <section className="grid gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => onNavigate('progress')} className="group min-h-32 rounded-[1.75rem] border border-line bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><TrendingUp size={20} /></span>
          <h3 className="mt-4 font-bold text-base">Sinais da jornada</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink/55">Gráficos de evolução, fontes de fome e radar de consciência.</p>
        </button>
        <button type="button" onClick={onOpenSleep} className="group min-h-32 rounded-[1.75rem] border border-line bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Moon size={20} /></span>
          <h3 className="mt-4 font-bold text-base">Cuidar do sono</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink/55">
            {latestSleep ? `${latestSleep.hours}h de sono (${latestSleep.quality}) registrado.` : 'Registre seu descanso e veja o impacto no apetite.'}
          </p>
        </button>
        <button type="button" onClick={() => onNavigate('content')} className="group min-h-32 rounded-[1.75rem] border border-line bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-secondary/15 text-accent-secondary"><BookOpen size={20} /></span>
          <h3 className="mt-4 font-bold text-base">Biblioteca científica</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink/55">Artigos e receitas sobre nutrição gentil e autocompaixão.</p>
        </button>
      </section>

      {/* Avaliação do App */}
      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-sm">
        <p className="label-sm text-accent">Sua experiência</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-ink/70">Como está sendo sua experiência com o Mind Nutrition?</p>
          <div className="flex gap-2" aria-label="Avalie o aplicativo de 1 a 5">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => { setAppRating(rating); localStorage.setItem('nutriAppFeedback', String(rating)); toast('Obrigada pelo seu feedback!', 'success'); }}
                className={`h-11 w-11 rounded-full border text-sm font-bold transition-all active:scale-95 ${appRating === rating ? 'border-accent bg-accent text-paper shadow-xs' : 'border-line bg-paper text-ink/60 hover:border-accent'}`}
                aria-label={`${rating} estrelas`}
                aria-pressed={appRating === rating}
              >
                {rating}★
              </button>
            ))}
          </div>
        </div>
      </section>

    </PageContainer>
  );
}

type MealAiAnalysis = {
  dish?: string;
  summary?: string;
  identified?: { name: string; confidence: string }[];
  unrecognized?: string[];
  colors?: string[];
  balance?: string;
  attentionPoints?: string[];
  confidence?: string;
};

function MealAiAnalysisCard({
  analysis,
  loading,
  error,
  hasPhoto,
  onAnalyze,
  showAction = true,
}: {
  analysis: MealAiAnalysis | null;
  loading: boolean;
  error: string;
  hasPhoto: boolean;
  onAnalyze: () => void;
  showAction?: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-accent/25 bg-accent/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-accent"><ScanLine size={20} /></span>
          <div>
            <h3 className="text-sm font-bold">Olhar gentil sobre o prato</h3>
            <p className="mt-0.5 text-xs text-ink/55">A IA comenta apenas o que reconhece com segurança. Sem calorias e sem julgamento.</p>
          </div>
        </div>
        {showAction && (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={loading || !hasPhoto}
            aria-busy={loading || undefined}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-accent/30 bg-white px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {loading ? 'Analisando' : error ? 'Tentar novamente' : analysis ? 'Reanalisar' : 'Analisar'}
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-accent/20 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-accent">
            <Loader2 size={14} className="animate-spin" />
            A IA está observando cores, porções e variedade do prato...
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-accent/15">
            <div className="ai-progress h-full w-1/3 rounded-full bg-accent" />
          </div>
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="mt-3 rounded-2xl border border-danger/25 bg-danger/5 p-3 text-sm font-medium text-danger">
          {error} Use “Tentar novamente” para refazer a análise.
        </p>
      )}

      {!loading && !error && !analysis && (
        <p className="mt-3 rounded-2xl border border-dashed border-accent/25 bg-white/70 p-3 text-xs text-ink/55">
          {hasPhoto
            ? 'Toque em Analisar para a IA observar cores, variedade e o que consegue reconhecer com segurança.'
            : 'Adicione uma foto da refeição para receber a leitura visual.'}
        </p>
      )}

      {!loading && analysis && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-paper">
                <Utensils size={12} /> {analysis.dish || 'Prato identificado'}
              </span>
              {analysis.confidence && (
                <span className="rounded-full border border-accent/25 bg-white px-2.5 py-1 text-[10px] font-bold text-accent">
                  Confiança {analysis.confidence}
                </span>
              )}
            </div>
            {analysis.summary && <p className="mt-2 text-sm leading-relaxed text-ink/75">{analysis.summary}</p>}
          </div>

          {!!analysis.identified?.length && (
            <div>
              <span className="text-[10px] font-bold text-ink/45">Reconhecido com segurança</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {analysis.identified.map((item) => (
                  <span key={`${item.name}-${item.confidence}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink/70">
                    {item.name}
                    <span className="text-[9px] font-semibold text-ink/35">{item.confidence}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!analysis.unrecognized?.length && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <span className="text-[10px] font-bold text-amber-700">Não incluído na análise por incerteza</span>
              <ul className="mt-1.5 space-y-1">
                {analysis.unrecognized.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-800/85">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />{item}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700/70">
                Se você quiser, conte na descrição ou nas observações o que era esse item — assim o registro fica completo para você.
              </p>
            </div>
          )}

          {!!analysis.colors?.length && (
            <div>
              <span className="text-[10px] font-bold text-ink/45">Cores do prato</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {analysis.colors.map(color => (
                  <span key={color} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink/70 border border-line">{color}</span>
                ))}
              </div>
            </div>
          )}

          {analysis.balance && (
            <p className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-ink/70 border border-line">{analysis.balance}</p>
          )}

          {!!analysis.attentionPoints?.length && (
            <div>
              <span className="text-[10px] font-bold text-ink/45">Observações gentis</span>
              <ul className="mt-1.5 space-y-1.5">
                {analysis.attentionPoints.map(point => (
                  <li key={point} className="flex items-start gap-2 text-xs text-ink/65"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />{point}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] leading-relaxed text-ink/45">Leitura visual acolhedora e sem números nutricionais. Alimentos em que a IA não teve segurança ficam fora da análise. Isso não substitui avaliação nutricional individual.</p>
        </div>
      )}
    </div>
  );
}

function MealLogPage({
  onSaveMeal,
  onNavigate,
  onOpenHungerModal,
  toast
}: {
  onSaveMeal: (meal: any) => void | Promise<void>;
  onNavigate: (page: Page) => void;
  onOpenHungerModal: () => void;
  toast: any;
}) {
  const [step, setStep] = useState<'pre' | 'meal' | 'post'>('pre');
  const [aiAnalysis, setAiAnalysis] = useState<MealAiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const savingRef = useRef(false);
  const analyzingRef = useRef(false);
  const [log, setLog] = useState<{
    title: string;
    preHunger: number;
    hungerType: MealClassification;
    preMood: string;
    postHunger: number | null;
    postMood: string;
    satisfaction: number;
    notes: string;
    photos: string[];
  }>({
    title: 'Refeição',
    preHunger: 5,
    hungerType: 'Física',
    preMood: 'Neutro',
    postHunger: null,
    postMood: 'Neutro',
    satisfaction: 4,
    notes: '',
    photos: []
  });

  const analyzeMealPhoto = async (image: string, description = '') => {
    if (!image || analyzingRef.current) return;
    analyzingRef.current = true;
    setIsAnalyzing(true);
    setAiAnalysisError('');
    try {
      const response = await fetch('/api/ai-meal-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ image, description }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.analysis) {
        throw new Error(result.message || 'Não foi possível analisar a foto agora.');
      }
      setAiAnalysis(result.analysis);
      toast('Análise da refeição concluída.', 'success');
    } catch (error) {
      setAiAnalysisError(error instanceof Error ? error.message : 'Não foi possível analisar a foto agora.');
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const handleMealPhotos = async (files: FileList | null) => {
    if (loadingPhotos) return;
    setLoadingPhotos(true);
    try {
      const result = await readValidatedImages(files, log.photos.length);
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      if (result.images.length) {
        setLog(prev => ({ ...prev, photos: [...prev.photos, ...result.images] }));
        toast('Foto adicionada! A análise será feita apenas se você solicitar.', 'success');
      }
    } finally {
      setLoadingPhotos(false);
    }
  };

  const saveMealRecord = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const inferredType = log.hungerType;
      const newMeal = {
        ...log,
        id: crypto.randomUUID(),
        title: log.title?.trim() || 'Refeição',
        date: new Date().toISOString(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: inferredType,
        inferredType,
        mood: log.postMood || log.preMood,
        hungerDelta: log.postHunger === null ? null : log.postHunger - log.preHunger,
        image: log.photos[0] || '',
        aiAnalysis: aiAnalysis ? { ...aiAnalysis, analyzedAt: new Date().toISOString() } : undefined,
      };
      await onSaveMeal(newMeal);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar a refeição. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const moods = [
    { label: 'Alegre', icon: Smile },
    { label: 'Calmo(a)', icon: Sun },
    { label: 'Neutro', icon: Meh },
    { label: 'Ansioso(a)', icon: PiHeartbeat },
    { label: 'Estressado(a)', icon: Zap },
    { label: 'Frustrado(a)', icon: Frown },
    { label: 'Triste', icon: Frown },
    { label: 'Cansado(a)', icon: Coffee }
  ];

  const satisfactionDescriptions: Record<number, string> = {
    0: 'Nada satisfeito',
    1: 'Muito pouco',
    2: 'Pouco',
    3: 'Moderadamente',
    4: 'Satisfeito',
    5: 'Muito'
  };

  const stepNumber = step === 'pre' ? 1 : step === 'meal' ? 2 : 3;
  const nextLabel = step === 'pre' ? 'Iniciar refeição' : step === 'meal' ? 'Ir para pós-refeição' : 'Salvar refeição';

  return (
    <>
      <PageContainer
        variant="narrow"
        noPadding
        className="space-y-6 px-4 pt-24 sm:px-8 md:px-12 md:pt-28 pb-[calc(14rem+env(safe-area-inset-bottom,0px))] md:pb-12"
      >
        <PageHeader
          title={step === 'pre' ? 'Antes da refeição' : step === 'meal' ? 'Durante a refeição' : 'Depois da refeição'}
          subtitle="Reserve um momento para perceber seus sinais."
          eyebrow={`Etapa ${stepNumber} de 3`}
          back={{
            label: step === 'pre' ? 'Voltar ao dashboard' : 'Voltar à etapa anterior',
            onClick: () => {
              if (saving) return;
              if (step === 'pre') onNavigate('dashboard');
              else setStep(step === 'meal' ? 'pre' : 'meal');
            },
          }}
          actions={step === 'pre' ? (
            <button type="button" onClick={onOpenHungerModal} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/20">
              <HelpCircle size={15} /> Entender a fome
            </button>
          ) : undefined}
        />
        <div role="progressbar" aria-label="Progresso do registro de refeição" aria-valuemin={1} aria-valuemax={3} aria-valuenow={stepNumber} aria-valuetext={`Etapa ${stepNumber} de 3`} className="grid grid-cols-3 gap-2">
          {(['Antes', 'Durante', 'Depois'] as const).map((label, index) => (
            <span key={label} className={`h-2 rounded-full ${index < stepNumber ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </div>

        <form
          id="meal-log-form"
          className="space-y-6"
          aria-busy={saving || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) return;
            if (step === 'pre') setStep('meal');
            else if (step === 'meal') setStep('post');
            else void saveMealRecord();
          }}
        >
        {/* STEP 1: PRÉ-REFEIÇÃO */}
        {step === 'pre' && (
          <>
            <fieldset className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <legend className="font-bold text-lg">De onde vem sua fome?</legend>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">Escolha o sinal que melhor representa este momento.</p>
              <div className="mx-auto mt-3 flex w-full max-w-xs flex-col items-center">
                <div className="h-20 w-20">
                  <FlyingMascotSprite alt="Mascote pensando" animation="thinking" className="h-full w-full" />
                </div>
                <span className="mt-1 text-center text-xs font-bold text-ink/45">Pausa breve: como seu corpo e suas emoções estão?</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(['Física', 'Emocional'] as MealClassification[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLog({ ...log, hungerType: type })}
                    aria-pressed={log.hungerType === type}
                    className={`min-h-12 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-colors ${log.hungerType === type ? 'border-accent bg-accent text-paper' : 'border-line bg-white text-ink/60 hover:border-accent'}`}
                  >
                    Fome {type}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <legend className="font-bold text-lg">Como você está se sentindo agora?</legend>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">Reconhecer suas emoções antes da refeição acalma a mente.</p>
              <div className="mood-grid mt-4">
                {moods.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setLog({ ...log, preMood: m.label })}
                    aria-pressed={log.preMood === m.label}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all ${log.preMood === m.label ? 'border-accent bg-accent/10 text-accent font-bold shadow-2xs' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}
                  >
                    <m.icon size={22} />
                    <span className="text-xs font-bold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {/* STEP 2: A REFEIÇÃO */}
        {step === 'meal' && (
          <>
            <div className="bg-white border border-line p-6 rounded-[2rem] shadow-sm">
              <FormField label="Nome da refeição" htmlFor="meal-title" hint="Use um nome curto para reconhecer este registro depois.">
                <input
                  id="meal-title"
                  type="text"
                  value={log.title}
                  maxLength={100}
                  onChange={(e) => setLog({ ...log, title: e.target.value })}
                  placeholder="Ex: Almoço com a família"
                  className="input-field text-lg font-bold"
                />
              </FormField>
            </div>

            <div className="meal-photo-actions w-full grid grid-cols-2 gap-4">
              <label className="aspect-video rounded-[2rem] border-2 border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center gap-2 text-accent hover:bg-accent/10 active:scale-95 transition-all cursor-pointer relative overflow-hidden">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  disabled={loadingPhotos}
                  className="absolute inset-0 cursor-pointer w-full h-full disabled:cursor-wait"
                  onChange={(e) => { void handleMealPhotos(e.target.files); e.target.value = ''; }}
                />
                <Camera size={28} />
                <span className="font-bold text-xs sm:text-sm">Tirar Foto</span>
              </label>

              <label className="aspect-video rounded-[2rem] border-2 border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center gap-2 text-accent hover:bg-accent/10 active:scale-95 transition-all cursor-pointer relative overflow-hidden">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={loadingPhotos}
                  className="absolute inset-0 cursor-pointer w-full h-full disabled:cursor-wait"
                  onChange={(e) => { void handleMealPhotos(e.target.files); e.target.value = ''; }}
                />
                <Library size={28} />
                <span className="font-bold text-xs sm:text-sm">Abrir Galeria</span>
              </label>
            </div>

            <div className="rounded-[2rem] border border-line bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm">Fotos da Refeição (Opcional)</h3>
                  <p className="text-xs text-ink/45">Até {MAX_MEAL_PHOTOS} fotos por refeição.</p>
                </div>
                <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full" aria-live="polite">{log.photos.length}/{MAX_MEAL_PHOTOS}</span>
              </div>
              {log.photos.length === 0 ? (
                <div className="h-20 rounded-2xl bg-ink/5 border border-dashed border-line flex items-center justify-center text-xs font-bold text-ink/35">
                  Nenhuma foto anexada
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {log.photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-line">
                      <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                      {isAnalyzing && index === 0 && (
                        <div className="ai-scan-overlay" aria-hidden="true">
                          <div className="ai-scan-grid" />
                          <div className="ai-scan-line" />
                          <span className="ai-scan-label"><ScanLine size={11} /> Analisando</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setLog(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
                          if (index === 0) {
                            setAiAnalysis(null);
                            setAiAnalysisError('');
                          }
                        }}
                        aria-label={`Remover foto ${index + 1}`}
                        className="absolute top-1 right-1 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-ink/80 text-paper"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <MealAiAnalysisCard
              analysis={aiAnalysis}
              loading={isAnalyzing}
              error={aiAnalysisError}
              hasPhoto={Boolean(log.photos[0])}
              onAnalyze={() => { if (log.photos[0]) void analyzeMealPhoto(log.photos[0], log.notes); }}
            />

            <div className="bg-white border border-line p-5 rounded-[2rem]">
              <FormField label="O que você está comendo?" htmlFor="meal-notes" hint="Descreva o prato, os sabores ou como está seu ritmo ao comer." optional>
                <textarea
                  id="meal-notes"
                  placeholder="Suas observações..."
                  className="input-field min-h-28 resize-y"
                  value={log.notes}
                  maxLength={1000}
                  onChange={e => setLog({ ...log, notes: e.target.value })}
                />
              </FormField>
            </div>
          </>
        )}

        {/* STEP 3: PÓS-REFEIÇÃO */}
        {step === 'post' && (
          <>
            <fieldset className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <legend className="font-bold text-lg">Como foi sua saciedade?</legend>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">Avalie o quanto esta refeição atendeu às suas necessidades físicas.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setLog({ ...log, satisfaction: val })}
                    aria-pressed={log.satisfaction === val}
                    className={`min-h-18 rounded-2xl border-2 p-3 text-left transition-all ${log.satisfaction === val ? 'bg-accent border-accent text-paper shadow-sm' : 'border-line bg-white hover:border-accent'}`}
                  >
                    <span className="block text-xl font-bold">{val}</span>
                    <span className="mt-0.5 block text-xs font-bold leading-tight">{satisfactionDescriptions[val]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <legend className="font-bold text-lg">Seu humor após a refeição</legend>
              <div className="mood-grid mt-3">
                {moods.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setLog({ ...log, postMood: m.label })}
                    aria-pressed={log.postMood === m.label}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all ${log.postMood === m.label ? 'border-accent bg-accent/10 text-accent font-bold shadow-2xs' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}
                  >
                    <m.icon size={22} />
                    <span className="text-xs font-bold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

          {saveError && <p role="alert" className="rounded-2xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger">{saveError}</p>}
          <div className="hidden md:block">
            <Button type="submit" size="lg" fullWidth loading={saving}>{nextLabel}</Button>
          </div>
        </form>
      </PageContainer>

      <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-40 border-t border-line bg-paper px-4 py-3 md:hidden">
        <Button type="submit" form="meal-log-form" size="lg" fullWidth loading={saving}>{nextLabel}</Button>
      </div>
    </>
  );
}

function ContentPageComponent({
  onSelectArticle,
  onNavigate,
  readArticleIds,
}: {
  onSelectArticle: (article: any) => void;
  onNavigate: (page: Page) => void;
  readArticleIds: string[];
}) {
  const [articles, setArticles] = useState<any[]>(() => [...DEFAULT_LIBRARY_ARTICLES]);
  const [filter, setFilter] = useState<'all' | 'articles' | 'recipes'>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    fetch('/api/articles')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('library unavailable')))
      .then(result => {
        if (!active || !Array.isArray(result?.articles) || !result.articles.length) return;
        const remote = result.articles
          .filter((article: any) => article?.published !== false && article?.title)
          .map((article: any) => ({
            ...article,
            content: Array.isArray(article.content) ? article.content : [],
            contentHtml: typeof article.content_html === 'string' ? article.content_html : '',
            type: article.type || 'Leitura',
            duration: article.duration || getReadingDuration(article),
            sourceLabel: article.source_label || article.sourceLabel,
            sourceUrl: article.source_url || article.sourceUrl,
          }));
        if (remote.length) {
          const remoteIds = new Set(remote.map((article: any) => article.id));
          setArticles([...remote, ...DEFAULT_LIBRARY_ARTICLES.filter(article => !remoteIds.has(article.id))]);
        }
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const articleItems = articles.filter(item => item.type !== 'Receita');
  const recipeItems = [
    ...DEFAULT_RECIPES.map(recipeToArticle),
    ...articles.filter(item => item.type === 'Receita'),
  ];
  const visibleItems = filter === 'recipes' ? recipeItems : filter === 'articles' ? articleItems : [...articleItems, ...recipeItems];

  return (
    <PageContainer className="space-y-6 px-4 pt-24 sm:px-8 md:px-12 md:pt-28">
      <PageHeader
        title="Biblioteca"
        subtitle="Leituras e receitas para o dia a dia."
        back={{ label: 'Voltar ao dashboard', onClick: () => onNavigate('dashboard') }}
      />

      {loading && <p role="status" className="flex items-center gap-2 text-sm text-ink/60"><Loader2 size={15} className="animate-spin" /> Atualizando a biblioteca...</p>}
      {loadError && articles.length > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-ink/70">Não foi possível atualizar; exibindo biblioteca local.</p>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey(value => value + 1)}>Tentar novamente</Button>
        </div>
      )}

      <div role="group" aria-label="Filtrar biblioteca" className="flex flex-wrap items-center gap-2">
        {([['all', 'Tudo'], ['articles', 'Artigos'], ['recipes', 'Receitas']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`min-h-11 rounded-full px-4 py-2 text-xs font-bold transition ${filter === id ? 'bg-accent text-paper' : 'border border-line bg-white text-ink/60 hover:border-accent'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <StateView
          status={loadError ? 'error' : 'empty'}
          title={loadError ? 'A biblioteca não carregou' : 'Nenhum conteúdo nesta categoria'}
          description={loadError ? 'Verifique sua conexão e tente novamente.' : 'Escolha outra categoria para continuar.'}
          action={loadError ? <Button onClick={() => setReloadKey(value => value + 1)}>Tentar novamente</Button> : <Button onClick={() => onNavigate('dashboard')}>Voltar ao dashboard</Button>}
        />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectArticle(item)}
            className="group text-left bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
          >
            <div className="aspect-[16/10] w-full relative overflow-hidden bg-line">
              <img src={item.image || DEFAULT_RECIPES[0].image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-3 left-3 bg-paper/95 backdrop-blur-md px-3.5 py-1 rounded-full label-sm text-accent">
                {item.type}
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg mb-1 leading-tight">{item.title}</h3>
                <p className="text-xs text-ink/60 line-clamp-2 mb-3 leading-relaxed">{item.summary}</p>
              </div>
              <div className="flex items-center gap-1.5 text-accent text-xs font-bold mt-2">
                <Library size={14} /> {item.duration || getReadingDuration(item)}
              </div>
              {readArticleIds.includes(item.id) && <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs font-bold text-accent"><CheckCircle2 size={12} /> Lido</span>}
            </div>
          </button>
        ))}
      </div>
      )}
    </PageContainer>
  );
}

function ChallengePage({
  userProfile,
  loggedMeals,
  onSaveProfile,
  onNavigate,
  toast,
}: {
  userProfile: UserProfile;
  loggedMeals: any[];
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
  onNavigate: (page: Page) => void;
  toast: any;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const challenge = userProfile.challenge;
  type DayRecord = ChallengeState['days'][number];
  const days = challenge?.days || [];
  const [reflection, setReflection] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);

  const elapsed = Math.max(1, Math.floor((new Date(today).getTime() - new Date(challenge?.startedAt || today).getTime()) / 86_400_000) + 1);
  const dayNumber = Math.min(21, elapsed);
  const finished = elapsed > 21;
  const currentDay: DayRecord = days.find(item => item.date === today) || { day: dayNumber, date: today };
  const mission = CHALLENGE_MISSIONS[dayNumber - 1];
  const week = mission.week;
  const completedDays = days.filter(isDayComplete).length;
  const totalPoints = days.reduce((sum, item) => sum + dayPoints(item), 0);
  const weekCompleted = days.filter(item => Math.ceil(item.day / 7) === week && isDayComplete(item)).length;

  useEffect(() => {
    setReflection(currentDay.reflection || '');
  }, [currentDay.date, currentDay.reflection]);

  const saveDay = async (patch: Partial<DayRecord>) => {
    if (!challenge || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const nextDay: DayRecord = { ...currentDay, ...patch, createdAt: currentDay.createdAt || new Date().toISOString() };
      const nextDays = days.some(item => item.date === today)
        ? days.map(item => item.date === today ? nextDay : item)
        : [...days, nextDay];
      const reachedFlower = nextDays.filter(isDayComplete).length >= 15;
      await onSaveProfile({
        ...userProfile,
        challenge: {
          ...challenge,
          days: nextDays,
          completedAt: reachedFlower ? (challenge.completedAt || new Date().toISOString()) : challenge.completedAt,
        },
      });
      return true;
    } catch {
      setSaveError('Não foi possível salvar o registro. Tente novamente.');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const startChallenge = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await onSaveProfile({ ...userProfile, challenge: { startedAt: today, days: [] } });
      toast('Jornada iniciada. Bem-vinda à sua observação!', 'success');
    } catch {
      setSaveError('Não foi possível iniciar a jornada. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!challenge) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Desafio de 21 dias" subtitle="Observar, compreender e cultivar." back={{ label: 'Voltar ao dashboard', onClick: () => onNavigate('dashboard') }} />
        <section className="rounded-[2rem] border border-line bg-white p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/10 text-accent"><Sprout size={30} /></span>
          <p className="label-sm mt-5 text-accent">Mind Nutrition · NutConsciente</p>
          <h2 className="section-title mt-2">Desafio de 21 Dias</h2>
          <p className="section-subtitle mx-auto mt-3 max-w-xl text-ink/65">
            Observar, compreender e cultivar. Uma jornada para conhecer melhor a relação entre alimentação, sono e emoções — sem metas de peso, calorias ou desempenho.
          </p>
          <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
            {['01 · Observar · dias 1 a 7', '02 · Compreender · dias 8 a 14', '03 · Cultivar · dias 15 a 21'].map(step => (
              <div key={step} className="rounded-2xl border border-line bg-paper p-4 text-xs font-bold text-ink/70">{step}</div>
            ))}
          </div>
          {saveError && <p role="alert" className="mx-auto mt-5 max-w-lg rounded-2xl bg-danger/5 p-3 text-sm text-danger">{saveError}</p>}
          <Button size="lg" onClick={() => void startChallenge()} loading={saving} className="mt-8">
            Começar minha jornada
          </Button>
          <p className="mx-auto mt-4 max-w-lg text-xs leading-relaxed text-ink/50">
            Você pode pausar, registros parciais não são punidos e os 21 dias delimitam uma prática inicial — não uma promessa de formação de hábito.
          </p>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Minha jornada consciente"
        subtitle="Observar · Compreender · Cultivar"
        back={{ label: 'Voltar ao dashboard', onClick: () => onNavigate('dashboard') }}
      />

      {saveError && <p role="alert" className="rounded-2xl bg-danger/5 p-3 text-sm text-danger">{saveError}</p>}
      {finished && (
        <section className="rounded-[1.75rem] border border-accent/30 bg-accent/10 p-5">
          <p className="label-sm text-accent">Jornada concluída</p>
          <h3 className="font-bold text-lg mt-1">Você chegou ao fim destes 21 dias.</h3>
          <Button size="sm" onClick={() => setShowReport(true)} className="mt-3">Ver relatório final</Button>
        </section>
      )}

      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-sm text-accent">Dia {dayNumber} de 21 · Semana {week}</p>
            <h3 className="font-display text-2xl mt-1">{['', 'Descobrindo meus hábitos', 'Entendendo minhas emoções', 'Cultivando novos hábitos'][week]}</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-xs font-bold text-accent"><Sprout size={15} /> {totalPoints} sementes</div>
        </div>
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-end">
          <ChallengePlant completedDays={completedDays} />
          <div className="w-full flex-1 pb-1">
            <div role="progressbar" aria-label="Dias concluídos do desafio" aria-valuemin={0} aria-valuemax={21} aria-valuenow={completedDays} className="h-2.5 overflow-hidden rounded-full bg-line/50">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (completedDays / 21) * 100)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs font-bold text-ink/50">
              <span>{completedDays} dias concluídos</span><span>{gardenStage(completedDays)}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink/45">A cada dia concluído sua plantinha ganha altura e folhas novas; com 15 dias ela floresce.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-accent/30 bg-accent/5 p-6">
        <p className="label-sm text-accent">Missão do dia · {mission.title}</p>
        <p className="serif-body mt-2 text-xl leading-relaxed text-ink/85">{mission.activity}</p>
      </section>

      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-sm" aria-busy={saving || undefined}>
        <p className="label-sm text-accent">Registros de hoje</p>
        <p className="mt-1 text-sm text-ink/60">Próximo passo: marque as atividades que você realizou e deixe uma reflexão, se quiser.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {CHALLENGE_ACTIVITIES.map(activity => {
            const done = Boolean(currentDay[activity.key]);
            return (
              <button
                key={activity.key}
                type="button"
                aria-pressed={done}
                disabled={saving}
                onClick={() => void saveDay({ [activity.key]: !done })}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-wait disabled:opacity-60 ${done ? 'border-accent bg-accent/10' : 'border-line bg-paper hover:border-accent'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${done ? 'bg-accent text-paper' : 'bg-white text-ink/40'}`}>
                  {done ? <Check size={17} /> : <span className="text-xs font-bold">+10</span>}
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{activity.label}</span>
                  <span className="block text-xs text-ink/50">{activity.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 rounded-2xl bg-paper p-4 text-xs leading-relaxed text-ink/70">{challengeFeedback(currentDay)}</p>
        <div className="mt-5">
          <FormField label="Reflexão curta" htmlFor="challenge-reflection" hint="O que chamou sua atenção hoje?" optional>
            <textarea
              id="challenge-reflection"
              value={reflection}
              onChange={event => setReflection(event.target.value)}
              rows={3}
              disabled={saving}
              placeholder="Suas observações..."
              className="input-field resize-y"
            />
          </FormField>
        </div>
        <Button className="mt-3" loading={saving} disabled={reflection.trim() === (currentDay.reflection || '').trim()} onClick={async () => { if (await saveDay({ reflection: reflection.trim() })) toast('Reflexão salva.', 'success'); }}>Salvar reflexão</Button>
      </section>

      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-sm">
        <p className="label-sm text-accent">Conquistas da semana</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {WEEK_BADGES.map(badge => {
            const earned = days.filter(item => Math.ceil(item.day / 7) === badge.week && isDayComplete(item)).length >= 4;
            return (
              <div key={badge.week} className={`rounded-2xl border p-4 ${earned ? 'border-accent bg-accent/10' : 'border-line bg-paper opacity-70'}`}>
                <div className="flex items-center gap-2">
                  {badge.week === 3 && !earned ? <Flower2 size={18} className="text-accent" /> : <Sprout size={18} className="text-accent" />}
                  <span className="text-xs font-bold text-ink/60">Semana {badge.week}</span>
                </div>
                <h4 className="mt-2 text-sm font-bold">{badge.name}</h4>
                <p className="mt-1 text-xs text-ink/55">{earned ? badge.stage : '4 dias na semana para conquistar'}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><p className="label-sm text-accent">Semana {week}</p><h3 className="font-bold text-lg">Revisão dos dias</h3></div>
          <Button variant="ghost" size="sm" onClick={() => setShowReport(true)}>Ver relatório</Button>
        </div>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 7 }, (_, index) => (week - 1) * 7 + index + 1).map(number => {
            const record = days.find(item => item.day === number);
            const points = record ? dayPoints(record) : 0;
            return (
              <div key={number} className="flex items-center justify-between rounded-xl bg-paper px-4 py-3 text-xs">
                <span className="font-bold text-ink/70">Dia {number}</span>
                <span className="text-ink/55">{record ? `${points} sementes` : 'Sem registro'}</span>
                <span className={`font-bold ${record && isDayComplete(record) ? 'text-accent' : 'text-ink/40'}`}>{record && isDayComplete(record) ? 'Concluído' : 'Parcial'}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink/50">{loggedMeals.length ? `${loggedMeals.length} refeições no histórico do aplicativo.` : 'Registre refeições no aplicativo para enriquecer sua observação.'}</p>
      </section>

      <Overlay
        open={showReport}
        onClose={() => setShowReport(false)}
        title="Minha leitura"
        description="Relatório da sua jornada de 21 dias."
        size="xl"
        footer={<Button fullWidth onClick={() => setShowReport(false)}>Fechar relatório</Button>}
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white border border-line p-4 text-center"><span className="block text-2xl font-display">{completedDays}</span><span className="text-xs font-bold text-ink/55">dias concluídos</span></div>
          <div className="rounded-2xl bg-white border border-line p-4 text-center"><span className="block text-2xl font-display">{totalPoints}</span><span className="text-xs font-bold text-ink/55">sementes</span></div>
          <div className="rounded-2xl bg-white border border-line p-4 text-center"><span className="block text-sm font-bold text-accent">{gardenStage(completedDays)}</span><span className="text-xs font-bold text-ink/55">jardim</span></div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-ink/70">
          Participação, satisfação e usabilidade são resultados próprios desta jornada. Os registros apoiam a reflexão — não provam efeito sobre hábitos e não substituem orientação individualizada.
        </p>
        <h3 className="mt-5 label-sm text-accent">Reflexões registradas</h3>
        <div className="mt-2 space-y-2">
          {days.filter(item => item.reflection).length
            ? days.filter(item => item.reflection).map(item => (
                <div key={item.date} className="rounded-2xl border border-line bg-white p-3 text-xs"><b>Dia {item.day}:</b> {item.reflection}</div>
              ))
            : <p className="text-xs text-ink/55">Nenhuma reflexão registrada até aqui.</p>}
        </div>
      </Overlay>
    </PageContainer>
  );
}

type MetricKey = 'weight' | 'height' | 'waist' | 'arm' | 'abdomen' | 'hip';
type MetricEvolutionKey = 'weightEvolution' | 'waistEvolution' | 'armEvolution' | 'abdomenEvolution' | 'hipEvolution';

function MetricsModal({
  isOpen,
  onClose,
  userProfile,
  onSaveProfile,
  toast,
}: {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
  toast: any;
}) {
  const emptyMetrics = () => ({
    weight: getLatestMetricValue(userProfile.weightEvolution) || 0,
    height: userProfile.height || 0,
    waist: getLatestMetricValue(userProfile.waistEvolution) || 0,
    arm: getLatestMetricValue(userProfile.armEvolution) || 0,
    abdomen: getLatestMetricValue(userProfile.abdomenEvolution) || 0,
    hip: getLatestMetricValue(userProfile.hipEvolution) || 0,
  });
  const [newMetrics, setNewMetrics] = useState(emptyMetrics);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<MetricKey, string>>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ key: MetricEvolutionKey; date: string; label: string } | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setNewMetrics(emptyMetrics());
      setFieldErrors({});
      setFormError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userProfile]);

  const metricFields = [
    { key: 'weight', label: 'Peso', unit: 'kg', max: 350, hint: 'Registre em condições parecidas para comparar a evolução.' },
    { key: 'height', label: 'Altura', unit: 'cm', max: 250, hint: 'Usada junto com o peso para calcular o IMC.' },
    { key: 'waist', label: 'Cintura', unit: 'cm', max: 250, hint: 'Use uma fita flexível, sem apertar a pele.' },
    { key: 'abdomen', label: 'Abdômen', unit: 'cm', max: 250, hint: 'Meça de pé, ao final de uma expiração confortável.' },
    { key: 'hip', label: 'Quadril', unit: 'cm', max: 250, hint: 'Passe a fita pela região mais larga do quadril.' },
    { key: 'arm', label: 'Braço', unit: 'cm', max: 100, hint: 'Opcional: meça o braço relaxado, no ponto médio.' },
  ] as const;

  const metricHistory = metricFields
    .filter(field => field.key !== 'height')
    .flatMap(field => {
      const key = `${field.key}Evolution` as MetricEvolutionKey;
      return (userProfile[key] || []).map(item => ({ ...item, label: field.label, unit: field.unit, key }));
    })
    .sort((a, b) => parseDateForSorting(b.date) - parseDateForSorting(a.date))
    .slice(0, 8);

  const handleSaveMetrics = async () => {
    if (savingRef.current) return;
    const errors: Partial<Record<MetricKey, string>> = {};
    for (const field of metricFields) {
      const value = newMetrics[field.key];
      if (!Number.isFinite(value) || value < 0) errors[field.key] = 'Informe um valor maior ou igual a zero.';
      else if (value > field.max) errors[field.key] = `O valor máximo é ${field.max} ${field.unit}.`;
      else if (field.key === 'height' && value > 0 && value < 80) errors[field.key] = 'A altura deve ter pelo menos 80 cm.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError('Revise os campos indicados antes de salvar.');
      return;
    }
    if (!Object.values(newMetrics).some(value => value > 0)) {
      setFormError('Informe ao menos uma medida para salvar.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError('');
    try {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const recordedAt = now.toISOString();
      const updatedProfile = { ...userProfile };

      const updateEvolution = (key: MetricEvolutionKey, value: number) => {
        if (value <= 0) return;
        const arr = (updatedProfile[key] as any[]) || [];
        const existingForDate = arr.findIndex(item => {
          const itemTime = parseDateForSorting(item.date, item.recordedAt);
          if (!itemTime) return false;
          const itemDay = new Date(itemTime);
          return itemDay.getFullYear() === now.getFullYear()
            && itemDay.getMonth() === now.getMonth()
            && itemDay.getDate() === now.getDate();
        });
        const next = existingForDate >= 0
          ? arr.map((item, index) => index === existingForDate ? { ...item, date, value, recordedAt } : item)
          : [...arr, { date, value, recordedAt }];
        (updatedProfile[key] as any) = sortMetricsChronologically(next);
      };

      updateEvolution('weightEvolution', newMetrics.weight);
      updateEvolution('waistEvolution', newMetrics.waist);
      updateEvolution('armEvolution', newMetrics.arm);
      updateEvolution('abdomenEvolution', newMetrics.abdomen);
      updateEvolution('hipEvolution', newMetrics.hip);
      if (newMetrics.height > 0) updatedProfile.height = newMetrics.height;

      const latestWeight = getLatestMetricValue(updatedProfile.weightEvolution);
      if (updatedProfile.height && latestWeight) {
        Object.assign(updatedProfile, calculateNutritionalNeeds(
          latestWeight,
          updatedProfile.height,
          updatedProfile.age || 25,
          updatedProfile.gender || 'Feminino',
          updatedProfile.activityLevel || 1.2,
          updatedProfile.objectives || []
        ));
      }

      await onSaveProfile(updatedProfile);
      onClose();
      toast('Métricas corporais atualizadas!', 'success');
    } catch {
      setFormError('Não foi possível salvar as medidas. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const removeMetricRecord = async (key: MetricEvolutionKey, date: string) => {
    const next = { ...userProfile, [key]: (userProfile[key] || []).filter(item => item.date !== date) };
    const latestWeight = getLatestMetricValue(next.weightEvolution);
    if (next.height && latestWeight) {
      Object.assign(next, calculateNutritionalNeeds(latestWeight, next.height, next.age || 25, next.gender || 'Feminino', next.activityLevel || 1.2, next.objectives || []));
    }
    await onSaveProfile(next);
    toast('Registro removido. Você pode inserir a medida correta.', 'success');
  };

  return (
    <>
      <Overlay
        open={isOpen}
        onClose={onClose}
        title="Atualizar medidas"
        description="Peso, altura e medidas opcionais. Preencha apenas o que desejar."
        size="lg"
        busy={saving}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="metrics-form" loading={saving}>Salvar medidas</Button>
          </div>
        }
      >
        <form id="metrics-form" onSubmit={event => { event.preventDefault(); void handleSaveMetrics(); }}>
          {formError && <p role="alert" className="mb-4 rounded-2xl bg-danger/5 p-3 text-sm leading-relaxed text-danger">{formError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {metricFields.map((field) => (
              <FormField
                key={field.key}
                htmlFor={`metric-${field.key}`}
                label={`${field.label} (${field.unit})`}
                optional
                hint={field.hint}
                error={fieldErrors[field.key]}
                className="rounded-2xl bg-white border border-line p-4"
              >
                <input
                  id={`metric-${field.key}`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max={field.max}
                  value={newMetrics[field.key] || ''}
                  onChange={e => {
                    setNewMetrics({ ...newMetrics, [field.key]: parseFloat(e.target.value) || 0 });
                    setFieldErrors(previous => ({ ...previous, [field.key]: undefined }));
                  }}
                  placeholder="0"
                  className="min-h-12 w-full rounded-xl border border-line bg-paper px-3 py-2 text-xl font-bold text-ink outline-none focus:border-accent"
                />
              </FormField>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3"><span className="font-bold text-sm">Registros recentes</span><span className="text-xs font-bold text-ink/55">Corrija ou apague</span></div>
            {metricHistory.length ? <div className="mt-3 space-y-2">{metricHistory.map(item => (
              <div key={`${item.key}-${item.date}`} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                <span className="text-xs font-medium"><b>{item.label}:</b> {item.value} {item.unit} · {item.date}</span>
                <button type="button" onClick={() => setPendingDelete({ key: item.key, date: item.date, label: item.label })} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger/10" title="Apagar registro" aria-label={`Apagar registro de ${item.label} de ${item.date}`}><Trash2 size={16} /></button>
              </div>
            ))}</div> : <p className="mt-2 text-xs text-ink/55">Nenhuma medida salva ainda.</p>}
          </div>
        </form>
      </Overlay>
      <ConfirmationModal
        isOpen={Boolean(pendingDelete)}
        title="Excluir registro?"
        description={`O registro de ${pendingDelete?.label || 'medida'} será removido deste aparelho e da sua conta.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!pendingDelete) return false;
          await removeMetricRecord(pendingDelete.key, pendingDelete.date);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}

function ProgressPageComponent({
  userProfile,
  loggedMeals,
  onNavigate,
  onSaveProfile,
  toast,
  aiSummaryShortcut,
}: {
  userProfile: UserProfile;
  loggedMeals: any[];
  onNavigate: (page: Page) => void;
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
  toast: any;
  aiSummaryShortcut: number;
}) {
  const reduceMotion = useReducedMotion();
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState('');
  const [showAiSummaryModal, setShowAiSummaryModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ type: 'sleep' | 'diary'; id: string; label: string } | null>(null);
  const aiSummaryRef = useRef<HTMLElement | null>(null);
  const aiSummaryLoadingRef = useRef(false);
  const deletingRef = useRef(false);

  const deleteRecord = async () => {
    if (!pendingDelete || deletingRef.current) return false;
    deletingRef.current = true;
    try {
      const nextProfile = pendingDelete.type === 'sleep'
        ? { ...userProfile, sleepLogs: (userProfile.sleepLogs || []).filter(log => log.id !== pendingDelete.id) }
        : { ...userProfile, dailyNotes: (userProfile.dailyNotes || []).filter(note => note.id !== pendingDelete.id) };
      await onSaveProfile(nextProfile);
      toast(pendingDelete.type === 'sleep' ? 'Registro de sono removido.' : 'Anotação removida.', 'success');
      return true;
    } finally {
      deletingRef.current = false;
    }
  };

  const latestWeight = getLatestMetricValue(userProfile.weightEvolution);
  const hasBodyBaseline = Boolean(userProfile.height && latestWeight);
  const profileReadinessScore = calculateProfileInsightScore(userProfile);
  const hasInitialInsightData = Boolean(hasBodyBaseline || profileReadinessScore > 0 || loggedMeals.length);
  const mealTypes = loggedMeals.map((meal: any) => inferMealType(meal));
  const physicalMeals = mealTypes.filter(type => type === 'Física').length;
  const emotionalMeals = mealTypes.filter(type => type === 'Emocional').length;
  const unclassifiedMeals = Math.max(loggedMeals.length - physicalMeals - emotionalMeals, 0);
  const integratedInsight = buildIntegratedInsight(userProfile, loggedMeals);
  const awarenessScore = integratedInsight.score;
  const radarData = buildRadarData(userProfile, loggedMeals, awarenessScore);
  const weightGoal = getWeightGoal(userProfile);

  const sortedWeightEvolution = sortMetricsChronologically(userProfile.weightEvolution);
  const weightValues = sortedWeightEvolution.map(point => point.value);
  const weightDomain: [number, number] = weightValues.length
    ? [Math.floor(Math.min(...weightValues) - 1), Math.ceil(Math.max(...weightValues) + 1)]
    : [0, 100];

  const imcData = userProfile.height > 0
    ? sortedWeightEvolution.map(point => ({
        date: point.date,
        recordedAt: point.recordedAt,
        value: parseFloat((point.value / Math.pow(userProfile.height / 100, 2)).toFixed(1)),
      })).filter(item => Number.isFinite(item.value) && item.value > 0 && item.value < 80)
    : [];
  const imcValues = imcData.map(point => point.value);
  const imcDomain: [number, number] = imcValues.length
    ? [Math.max(10, Math.floor(Math.min(...imcValues) - 0.5)), Math.ceil(Math.max(...imcValues) + 0.5)]
    : [15, 35];

  const hasWeightData = sortedWeightEvolution.length > 0;
  const hasImcData = imcData.length > 0;
  const hasWeightShape = sortedWeightEvolution.length > 1;
  const hasImcShape = imcData.length > 1;
  const latestImcValue = imcData.length ? imcData[imcData.length - 1].value : null;
  const currentImc = userProfile.height && latestWeight
    ? parseFloat((latestWeight / Math.pow(userProfile.height / 100, 2)).toFixed(1))
    : (userProfile.imc ?? latestImcValue);

  // Filter only categories with counts > 0 for clean Pie chart
  const hungerPieData = [
    { name: 'Fome Física', value: physicalMeals, color: 'var(--accent)' },
    { name: 'Fome Emocional', value: emotionalMeals, color: 'var(--accent-secondary)' },
    { name: 'Não classificada', value: unclassifiedMeals, color: 'var(--accent-light)' },
  ].filter(item => item.value > 0);

  const hasMealData = loggedMeals.length > 0;

  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const emotionalData = dayLabels.map((day, index) => {
    const meals = loggedMeals.filter((meal: any) => new Date(meal.date || Date.now()).getDay() === index);
    const types = meals.map((meal: any) => inferMealType(meal));
    return {
      day,
      fisico: types.filter(type => type === 'Física').length,
      emocional: types.filter(type => type === 'Emocional').length,
    };
  });
  const sleepTrendData = (userProfile.sleepLogs || []).slice(0, 7).reverse().map((log, index) => ({
    date: log.date || `Registro ${index + 1}`,
    hours: log.hours,
    quality: log.quality,
  }));
  const hasSleepTrendData = sleepTrendData.length > 0;

  const generateAiSummary = async () => {
    if (aiSummaryLoadingRef.current) return;
    aiSummaryLoadingRef.current = true;
    setIsAiSummaryLoading(true);
    setAiSummaryError('');
    setAiSummary('');
    setShowAiSummaryModal(false);
    try {
      const insightProfile = {
        objectives: userProfile.objectives,
        age: userProfile.age,
        imc: currentImc,
        height: userProfile.height,
        weightEvolution: sortedWeightEvolution.slice(-12),
        waistEvolution: sortMetricsChronologically(userProfile.waistEvolution).slice(-12),
        abdomenEvolution: sortMetricsChronologically(userProfile.abdomenEvolution).slice(-12),
        hipEvolution: sortMetricsChronologically(userProfile.hipEvolution).slice(-12),
        dailyNotes: (userProfile.dailyNotes || []).slice(0, 10).map(note => ({ date: note.date, mood: note.mood, text: note.text })),
        sleepLogs: (userProfile.sleepLogs || []).slice(0, 10).map(log => ({ date: log.date, hours: log.hours, quality: log.quality })),
      };
      const insightMeals = loggedMeals.slice(0, 40).map((meal: any) => ({
        date: meal.date,
        time: meal.time,
        title: meal.title,
        hungerType: meal.hungerType || meal.inferredType || meal.type,
        preHunger: meal.preHunger,
        postHunger: meal.postHunger,
        satisfaction: meal.satisfaction,
        preMood: meal.preMood,
        postMood: meal.postMood || meal.mood,
        notes: meal.notes,
        aiDish: meal.aiAnalysis?.dish,
      }));

      const response = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          profile: insightProfile,
          meals: insightMeals,
          signals: {
            awarenessScore,
            coverage: integratedInsight.coverage,
            components: integratedInsight.components.map(component => ({ label: component.label, value: component.value })),
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.summary !== 'string') {
        throw new Error(result.message || 'Não foi possível gerar o resumo agora.');
      }
      setAiSummary(result.summary);
      setShowAiSummaryModal(true);
    } catch (error) {
      setAiSummaryError(error instanceof Error ? error.message : 'Não foi possível gerar o resumo agora.');
    } finally {
      aiSummaryLoadingRef.current = false;
      setIsAiSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (!aiSummaryShortcut) return;
    const timer = window.setTimeout(() => {
      aiSummaryRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [aiSummaryShortcut, reduceMotion]);

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Insights."
        subtitle="Sinais do seu comportamento alimentar, organizados para uma leitura tranquila."
        back={{ label: 'Voltar ao início', onClick: () => onNavigate('dashboard') }}
        actions={(
          <Button onClick={() => setShowMetricsModal(true)} className="shrink-0">
            <PlusCircle size={17} aria-hidden="true" /> Atualizar medidas
          </Button>
        )}
      />
      <nav aria-label="Seções do progresso" className="flex gap-2 overflow-x-auto pb-1">
        {[
          { href: '#resumo-nutre', label: 'Resumo' },
          { href: '#sinais-jornada', label: 'Sinais' },
          { href: '#evolucao-sono', label: 'Sono' },
          { href: '#evolucao-medidas', label: 'Medidas' },
          { href: '#registros-refeicoes', label: 'Refeições' },
        ].map(item => (
          <a key={item.href} href={item.href} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-white px-4 text-sm font-bold text-ink/70 transition hover:border-accent hover:text-accent">
            {item.label}
          </a>
        ))}
      </nav>

      {/* Sinais da sua jornada (Radar) & Consciência */}
      <div id="sinais-jornada" className="grid scroll-mt-28 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }} className="mobile-card-padding animated-gradient text-paper p-8 rounded-[2.5rem] shadow-lg flex flex-col justify-center lg:col-span-1">
          <h3 className="label-sm text-paper mb-3 glass-badge font-bold inline-block self-start">Consciência Geral</h3>
          <motion.div initial={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.16, type: 'spring', stiffness: 180, damping: 18 }} className="text-6xl sm:text-7xl font-display mb-2 text-paper drop-shadow-md">{awarenessScore}%</motion.div>
          <p className="text-xs sm:text-sm font-medium text-paper/90 leading-relaxed">
            {integratedInsight.narrative}
          </p>
          <span className="mt-4 text-[10px] font-bold text-paper/75">Leitura baseada em {integratedInsight.coverage}% dos sinais disponíveis</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.45, ease: 'easeOut' }} className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2.5rem] shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="text-accent"><Brain size={20} /></span> Insights da jornada
            </h3>
            <button type="button" onClick={() => toast('O gráfico mostra o equilíbrio entre saciedade, consciência, energia, humor, constância e contexto.', 'info')} className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-bold text-accent">
              <Info size={14} aria-hidden="true" /> Entender eixos
            </button>
          </div>
          <p className="mb-4 text-xs sm:text-sm leading-relaxed text-ink/55">
            Representação multidimensional do seu bem-estar alimentar.
          </p>
          {hasInitialInsightData ? (
            <>
            <ChartFrame className="h-64" minHeight={180}>
              {({ width, height }) => (
                <RadarChart width={width} height={height} cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 600 }} />
                  <Radar name="Atual" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} isAnimationActive={!reduceMotion} />
                  <Tooltip formatter={(value: number | undefined) => `${value}%`} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 12px 30px rgba(0,0,0,0.12)' }} />
                </RadarChart>
              )}
            </ChartFrame>
            <ul className="mt-3 grid gap-1 text-xs text-ink/65 sm:grid-cols-2">
              {radarData.map(point => <li key={point.subject} className="flex justify-between gap-3 rounded-lg bg-paper px-3 py-2"><span>{point.subject}</span><strong className="text-accent">{point.A}%</strong></li>)}
            </ul>
            </>
          ) : (
            <div className="min-h-56 rounded-3xl border border-dashed border-line bg-paper/60 p-6 flex flex-col justify-center text-center">
              <p className="font-bold text-base">Complete seus dados para liberar o radar de jornada.</p>
            </div>
          )}
        </motion.div>
      </div>

      <section className="rounded-[2rem] border border-line bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="label-sm text-accent">Como a leitura é formada</span>
            <h3 className="mt-1 text-lg font-bold">Sinais conectados, não um diagnóstico</h3>
          </div>
          <p className="text-xs text-ink/55">Quanto mais registros válidos, mais representativo fica o resultado.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {integratedInsight.components.map((component, index) => (
            <motion.div key={component.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.06 }} className="rounded-2xl border border-line bg-paper p-4">
              <div className="flex items-center justify-between gap-3"><span className="font-bold text-sm">{component.label}</span><span className="font-display text-2xl text-accent">{component.value}%</span></div>
              <p className="mt-2 text-xs leading-relaxed text-ink/55">{component.description}</p>
            </motion.div>
          ))}
          {!integratedInsight.components.length && <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink/60 sm:col-span-2 lg:col-span-4">Comece preenchendo o perfil, registrando uma refeição ou anotando sono e diário.</p>}
        </div>
      </section>

      <motion.section ref={aiSummaryRef} id="resumo-nutre" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45 }} className="animated-gradient relative overflow-hidden rounded-[2rem] p-1 shadow-lg scroll-mt-28">
        <div className="relative rounded-[1.8rem] bg-paper/95 p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <motion.div animate={reduceMotion ? { y: 0 } : isAiSummaryLoading ? { y: [0, -8, 0] } : { y: [0, -3, 0] }} transition={{ duration: isAiSummaryLoading ? 0.8 : 2.8, repeat: reduceMotion ? 0 : Infinity, ease: 'easeInOut' }} className="mx-auto h-24 w-24 shrink-0 sm:mx-0">
              <img src={mascotAi} alt="Mascote Nutre do Mind Nutrition" className="h-full w-full object-contain drop-shadow-md" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="label-sm text-accent">Mascote Nutre</span>
                  <h3 className="mt-1 text-xl font-bold">Leitura conectada da sua jornada</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink/60">Conecta refeições, sono, diário, medidas e a leitura de consciência para destacar padrões observáveis.</p>
                </div>
                <Button type="button" size="sm" onClick={generateAiSummary} loading={isAiSummaryLoading} disabled={!hasInitialInsightData} className="shrink-0">
                  <Sparkles size={15} aria-hidden="true" /> {isAiSummaryLoading ? 'Lendo seus sinais...' : aiSummary ? 'Gerar novamente' : 'Gerar resumo'}
                </Button>
              </div>
              <div aria-busy={isAiSummaryLoading || undefined} className="mt-4 min-h-20 rounded-2xl border border-line bg-white/80 p-4 text-sm leading-relaxed text-ink/75">
                {isAiSummaryLoading && <p role="status" className="flex items-center gap-2 text-ink/55"><span>O mascote está conectando seus registros</span><span className="inline-flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" /></span></p>}
                {!isAiSummaryLoading && aiSummaryError && (
                  <div role="alert" className="space-y-3 text-danger">
                    <p>{aiSummaryError}</p>
                    <Button variant="secondary" size="sm" onClick={generateAiSummary}><RefreshCw size={14} aria-hidden="true" /> Tentar novamente</Button>
                  </div>
                )}
                {!isAiSummaryLoading && aiSummary && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-accent">Leitura pronta</p>
                      <p className="mt-1 line-clamp-2 text-ink/70">{plainSummaryText(aiSummary)}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setShowAiSummaryModal(true)} className="shrink-0">
                      <BookOpen size={15} aria-hidden="true" /> Ver resumo
                    </Button>
                  </div>
                )}
                {!isAiSummaryLoading && !aiSummary && !aiSummaryError && !hasInitialInsightData && (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-ink/55">Complete seus dados ou registre uma refeição para gerar uma leitura conectada.</p>
                    <Button variant="secondary" size="sm" onClick={() => onNavigate('settings-account')}>Completar perfil</Button>
                  </div>
                )}
                {!isAiSummaryLoading && !aiSummary && !aiSummaryError && hasInitialInsightData && <p className="text-ink/55">Quando estiver pronta, gere uma leitura breve e acolhedora a partir dos registros que você já fez.</p>}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink/55">O resumo é educativo, usa apenas dados resumidos e não substitui acompanhamento profissional.</p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-3xl border border-line bg-white p-5">
          <div className="flex items-center justify-between gap-2"><span className="label-sm text-accent">Sono</span>{userProfile.sleepLogs?.[0] && <button type="button" onClick={() => setPendingDelete({ type: 'sleep', id: userProfile.sleepLogs![0].id, label: 'registro de sono' })} className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold text-danger transition hover:bg-danger/10" aria-label="Apagar registro de sono">Apagar</button>}</div>
          <p className="mt-2 text-lg font-bold">{userProfile.sleepLogs?.[0] ? `${userProfile.sleepLogs[0].hours}h · ${userProfile.sleepLogs[0].quality}` : 'Sem registro'}</p>
          <p className="mt-1 text-xs text-ink/55">O descanso ajuda a interpretar seus sinais de fome.</p>
        </section>
        <section className="rounded-3xl border border-line bg-white p-5">
          <div className="flex items-center justify-between gap-2"><span className="label-sm text-accent">Diário</span>{userProfile.dailyNotes?.[0] && <button type="button" onClick={() => setPendingDelete({ type: 'diary', id: userProfile.dailyNotes![0].id, label: 'anotação do diário' })} className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold text-danger transition hover:bg-danger/10" aria-label="Apagar anotação do diário">Apagar</button>}</div>
          <p className="mt-2 text-lg font-bold">{userProfile.dailyNotes?.length || 0} registros</p>
          <p className="mt-1 line-clamp-2 text-xs text-ink/55">{userProfile.dailyNotes?.[0]?.text || 'Registre acontecimentos e emoções para enriquecer seus insights.'}</p>
        </section>
        <section className="rounded-3xl border border-line bg-white p-5">
          <span className="label-sm text-accent">IMC atual</span>
          <p className="mt-2 text-lg font-bold">{currentImc ?? '--'}</p>
          <p className="mt-1 text-xs text-ink/55">Indicador calculado com a última altura e pesagem.</p>
        </section>
      </div>

      <section id="evolucao-sono" className="mobile-card-padding scroll-mt-28 rounded-[2rem] border border-line bg-white p-6 sm:p-8 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-base sm:text-lg"><span className="text-accent-secondary"><Moon size={21} aria-hidden="true" /></span> Evolução do sono</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink/55">Horas de descanso nos seus últimos sete registros.</p>
          </div>
          <span className="text-[10px] font-bold text-ink/45">Referência visual: 8h</span>
        </div>
        {hasSleepTrendData ? (
          <>
          <ChartFrame className="h-56" minHeight={170}>
            {({ width, height }) => (
              <AreaChart width={width} height={height} data={sleepTrendData}>
                <defs><linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.38} /><stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.55} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dy={6} />
                <YAxis domain={[0, 12]} ticks={[0, 4, 8, 12]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dx={-6} />
                <Tooltip formatter={(value: number | undefined, _name, item) => [`${value ?? 0}h · ${item?.payload?.quality || 'sem qualidade'}`, 'Sono']} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' }} />
                <ReferenceLine y={8} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} />
                <Area type="monotone" dataKey="hours" stroke="var(--accent-secondary)" strokeWidth={3.5} fill="url(#sleepGrad)" dot={{ r: 4, fill: 'var(--paper)', stroke: 'var(--accent-secondary)', strokeWidth: 2 }} isAnimationActive={!reduceMotion} />
              </AreaChart>
            )}
          </ChartFrame>
          <details className="mt-3 rounded-2xl border border-line bg-paper/50 px-4">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-accent">Ver valores do sono</summary>
            <ul className="space-y-2 pb-3 text-sm text-ink/70">
              {sleepTrendData.map((point, index) => <li key={`${point.date}-${index}`} className="flex justify-between gap-3"><span>{point.date}</span><strong>{point.hours}h · {point.quality}</strong></li>)}
            </ul>
          </details>
          </>
        ) : <StateView status="empty" compact title="Sua evolução do sono começa aqui" description="Registre uma noite de sono para acompanhar as horas e a qualidade do descanso." action={<Button size="sm" onClick={() => onNavigate('dashboard')}>Abrir diário e sono</Button>} />}
      </section>

      {/* Gráficos de Evolução (Peso e IMC com ordenação cronológica) */}
      <div id="evolucao-medidas" className="grid scroll-mt-28 gap-6 lg:grid-cols-2">
        <div className="mobile-card-padding rounded-[2.5rem] border border-line bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <span className="text-accent"><TbHealthRecognition size={22} aria-hidden="true" /></span> Evolução do Peso
            </h3>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink/60">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" /> Histórico
              </span>
              {weightGoal && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-accent-secondary">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-secondary" aria-hidden="true" /> Meta ({weightGoal} kg)
                </span>
              )}
            </div>
          </div>
          <p className="mb-4 text-xs text-ink/50 leading-relaxed">
            Datas em ordem cronológica (antigas à esquerda, mais recente à direita).
          </p>
          {hasWeightData ? (
            <>
            <ChartFrame className="h-60" minHeight={170}>
              {({ width, height }) => (
                <AreaChart width={width} height={height} data={sortedWeightEvolution}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dy={6} />
                  <YAxis domain={weightDomain} allowDecimals axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dx={-6} />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' }} formatter={(val: number | undefined) => `${val} kg`} />
                  {!hasWeightShape && <ReferenceLine x={sortedWeightEvolution[0]?.date} stroke="var(--accent)" strokeWidth={3} />}
                  {weightGoal && (
                    <ReferenceLine y={weightGoal} stroke="var(--accent-secondary)" strokeDasharray="4 4" strokeWidth={2} />
                  )}
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={4} fill={hasWeightShape ? 'url(#weightGrad)' : 'transparent'} dot={{ r: 5, fill: 'var(--paper)', stroke: 'var(--accent)', strokeWidth: 2.5 }} isAnimationActive={!reduceMotion} />
                </AreaChart>
              )}
            </ChartFrame>
            <details className="mt-3 rounded-2xl border border-line bg-paper/50 px-4">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-accent">Ver valores de peso</summary>
              <ul className="space-y-2 pb-3 text-sm text-ink/70">
                {sortedWeightEvolution.slice(-8).reverse().map((point, index) => <li key={`${point.date}-${index}`} className="flex justify-between gap-3"><span>{point.date}</span><strong>{point.value} kg</strong></li>)}
              </ul>
            </details>
            </>
          ) : (
            <StateView status="empty" compact title="Adicione seu peso" description="Use Atualizar medidas no topo para começar sua evolução corporal." />
          )}
        </div>

        <div className="mobile-card-padding rounded-[2.5rem] border border-line bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <span className="text-accent-secondary"><Activity size={22} aria-hidden="true" /></span> Evolução do IMC
            </h3>
            <span className="text-xs font-bold text-ink/55">Triagem indicativa</span>
          </div>
          <p className="mb-4 text-xs text-ink/50 leading-relaxed">
            Calculado a partir de altura e peso ao longo do tempo.
          </p>
          {hasImcData ? (
            <>
            <ChartFrame className="h-60" minHeight={170}>
              {({ width, height }) => (
                <AreaChart width={width} height={height} data={imcData}>
                  <defs>
                    <linearGradient id="imcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dy={6} />
                  <YAxis domain={imcDomain} allowDecimals axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dx={-6} />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' }} formatter={(val: number | undefined) => `${val}`} />
                  {!hasImcShape && <ReferenceLine x={imcData[0]?.date} stroke="var(--accent-secondary)" strokeWidth={3} />}
                  <ReferenceLine y={24.9} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="value" stroke="var(--accent-secondary)" strokeWidth={4} fill={hasImcShape ? 'url(#imcGrad)' : 'transparent'} dot={{ r: 5, fill: 'var(--paper)', stroke: 'var(--accent-secondary)', strokeWidth: 2.5 }} isAnimationActive={!reduceMotion} />
                </AreaChart>
              )}
            </ChartFrame>
            <details className="mt-3 rounded-2xl border border-line bg-paper/50 px-4">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-accent">Ver valores de IMC</summary>
              <ul className="space-y-2 pb-3 text-sm text-ink/70">
                {imcData.slice(-8).reverse().map((point, index) => <li key={`${point.date}-${index}`} className="flex justify-between gap-3"><span>{point.date}</span><strong>{point.value}</strong></li>)}
              </ul>
            </details>
            </>
          ) : (
            <StateView status="empty" compact title="Informe altura e peso" description="O IMC é calculado a partir desses dados e exibido como triagem indicativa." />
          )}
        </div>
      </div>

      {/* Gráficos de Fome & Registros por dia da semana */}
      <div id="registros-refeicoes" className="grid scroll-mt-28 gap-6 md:grid-cols-2">
        <div className="mobile-card-padding rounded-[2.5rem] border border-line bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-1 flex items-center gap-2 text-base font-bold sm:text-lg">
            <span className="text-accent"><Zap size={20} aria-hidden="true" /></span> Fontes de fome
          </h3>
          <p className="mb-4 text-xs text-ink/60">Proporção entre refeições biológicas e emocionais.</p>
          {hasMealData && hungerPieData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ChartFrame className="h-44 w-full sm:w-1/2" minHeight={140}>
                {({ width, height }) => (
                  <PieChart width={width} height={height}>
                    <Pie data={hungerPieData} innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value" isAnimationActive={!reduceMotion}>
                      {hungerPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number | undefined, name: string | undefined) => `${val}`} />
                  </PieChart>
                )}
              </ChartFrame>
              <div className="w-full sm:w-1/2 space-y-2">
                {hungerPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-paper border border-line/60">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || COLORS[i % COLORS.length] }} />
                      <span className="text-xs font-bold">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-accent">{item.value} ({Math.round((item.value / loggedMeals.length) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <StateView status="empty" compact title="Registre sua primeira refeição" description="Os registros permitem visualizar a proporção entre fome física e emocional." action={<Button size="sm" onClick={() => onNavigate('meal-log')}>Registrar refeição</Button>} />
          )}
        </div>

        <div className="mobile-card-padding rounded-[2.5rem] border border-line bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-1 flex items-center gap-2 text-base font-bold sm:text-lg">
            <span className="text-accent-secondary"><PiHeartbeat size={20} aria-hidden="true" /></span> Registros por dia da semana
          </h3>
          <p className="mb-4 text-xs text-ink/60">Acumulado de todas as refeições registradas em cada dia da semana.</p>
          {hasMealData ? (
            <>
              <ChartFrame className="h-44" minHeight={140}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={emotionalData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dy={6} />
                    <Tooltip cursor={{ fill: 'var(--line)', opacity: 0.3 }} />
                    <Bar dataKey="fisico" stackId="a" fill="var(--accent)" radius={[0, 0, 4, 4]} barSize={16} name="Fome Física" isAnimationActive={!reduceMotion} />
                    <Bar dataKey="emocional" stackId="a" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} barSize={16} name="Fome Emocional" isAnimationActive={!reduceMotion} />
                  </BarChart>
                )}
              </ChartFrame>
              <div className="mt-3 flex justify-center gap-6">
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink/70">
                  <span className="h-3 w-3 rounded-full bg-accent" aria-hidden="true" /> Física
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink/70">
                  <span className="h-3 w-3 rounded-full bg-accent-secondary" aria-hidden="true" /> Emocional
                </span>
              </div>
              <details className="mt-3 rounded-2xl border border-line bg-paper/50 px-4">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-accent">Ver registros por dia</summary>
                <ul className="space-y-2 pb-3 text-sm text-ink/70">
                  {emotionalData.map(point => <li key={point.day} className="flex justify-between gap-3"><span>{point.day}</span><strong>{point.fisico} física · {point.emocional} emocional</strong></li>)}
                </ul>
              </details>
            </>
          ) : (
            <StateView status="empty" compact title="Os dados semanais começam com um registro" description="Adicione uma refeição para visualizar a distribuição pelos dias da semana." action={<Button size="sm" onClick={() => onNavigate('meal-log')}>Registrar refeição</Button>} />
          )}
        </div>
      </div>

      <MetricsModal
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
        userProfile={userProfile}
        onSaveProfile={onSaveProfile}
        toast={toast}
      />

      <ConfirmationModal
        isOpen={Boolean(pendingDelete)}
        title="Excluir registro?"
        description="Este registro será removido dos seus dados. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={deleteRecord}
        onClose={() => setPendingDelete(null)}
      />

      <AiSummaryModal
        isOpen={showAiSummaryModal}
        onClose={() => setShowAiSummaryModal(false)}
        onRegenerate={() => { setShowAiSummaryModal(false); generateAiSummary(); }}
        summary={aiSummary}
        signals={{ score: awarenessScore, coverage: integratedInsight.coverage, components: integratedInsight.components }}
      />
    </PageContainer>
  );
}

function ProfilePageComponent({
  userProfile,
  onNavigate,
  onOpenDiary,
  onSaveProfile,
  onOpenCare,
  onLogout,
  toast
}: {
  userProfile: UserProfile;
  onNavigate: (page: Page) => void;
  onOpenDiary: () => void;
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
  onOpenCare: (tab: 'chat' | 'appointments') => void;
  onLogout: () => void | Promise<void>;
  toast: any;
}) {
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const latestWeight = userProfile.weightEvolution?.[userProfile.weightEvolution.length - 1]?.value;
  const latestWaist = userProfile.waistEvolution?.[userProfile.waistEvolution.length - 1]?.value;
  const latestHip = userProfile.hipEvolution?.[userProfile.hipEvolution.length - 1]?.value;
  const liveNeeds = latestWeight && userProfile.height
    ? calculateNutritionalNeeds(
      latestWeight,
      userProfile.height,
      userProfile.age || 25,
      userProfile.gender || 'Feminino',
      userProfile.activityLevel || 1.2,
      userProfile.objectives || []
    )
    : null;
  const currentImc = userProfile.imc ?? liveNeeds?.imc ?? null;
  const imcInterpretation = getImcInterpretation(currentImc);
  const currentTmb = userProfile.tmb ?? liveNeeds?.tmb ?? null;

  const profileActions = [
    { label: 'Editar Dados', icon: Edit2, page: 'settings-account' },
    { label: 'Privacidade', icon: Lock, page: 'settings-privacy' },
    { label: 'Ajuda & Contato', icon: HelpCircle, page: 'settings-help' },
  ];

  return (
    <PageContainer variant="wide" className="max-w-4xl space-y-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-sm md:p-8">
        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <div className="relative shrink-0">
            <ProfileAvatar photo={userProfile.photo} size="xl" className="border-4 border-paper shadow-xl" />
            <button
              type="button"
              onClick={() => onNavigate('settings-account')}
              aria-label="Alterar foto e dados do perfil"
              className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white bg-accent text-paper shadow-lg"
            >
              <Camera size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <span className="label-sm text-accent">Perfil Pessoal</span>
            <h2 className="section-title mt-1">{userProfile.name || 'Seu Perfil'}</h2>
            <p className="mt-1 text-xs font-medium text-ink/55 sm:text-sm">{userProfile.email || 'E-mail do perfil não informado'}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
              <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold">Gênero: {userProfile.gender || 'Não informado'}</span>
              <span className="px-3 py-1 rounded-full bg-paper border border-line text-ink/70 text-xs font-bold">Idade: {userProfile.age ? `${userProfile.age} anos` : 'Não informada'}</span>
              {(userProfile.objectives || []).slice(0, 2).map((item) => (
                <span key={item} className="px-3 py-1 rounded-full bg-accent-secondary/15 text-accent-secondary text-xs font-bold">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="profile-metrics-title">
        <h3 id="profile-metrics-title" className="label-sm mb-3 text-accent">Suas métricas</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 bg-white p-4 rounded-2xl border border-line sm:col-span-1">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-accent">IMC atual</span><button type="button" onClick={() => toast('IMC é uma relação entre peso e altura usada como triagem. Ele não diagnostica saúde e precisa ser interpretado no seu contexto.', 'info')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent text-xs font-bold text-accent" aria-label="Entender IMC"><Info size={15} aria-hidden="true" /></button></div>
          <div className="mt-2 flex items-end justify-between gap-3"><span className="text-3xl font-display">{currentImc ?? '--'}</span><span className={`text-right text-xs font-bold ${imcInterpretation.tone}`}>{imcInterpretation.label}</span></div>
          <p className="mt-2 text-xs leading-relaxed text-ink/55">{imcInterpretation.description}</p>
        </div>
        <div className="col-span-2 bg-white p-4 rounded-2xl border border-line sm:col-span-1">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-accent-secondary">TMB estimada</span><button type="button" onClick={() => toast('TMB é a energia mínima que seu corpo usa em repouso para funções vitais. É uma estimativa, não uma meta alimentar isolada.', 'info')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent-secondary text-xs font-bold text-accent-secondary" aria-label="Entender TMB"><Info size={15} aria-hidden="true" /></button></div>
          <div className="mt-2 text-3xl font-display">{currentTmb ?? '--'}<span className="ml-1 text-sm font-sans font-bold text-ink/55">kcal/dia</span></div>
          <p className="mt-2 text-xs leading-relaxed text-ink/55">Energia estimada em repouso, antes da atividade do dia.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-line text-center">
          <span className="block text-xs font-bold text-ink/55">Peso</span>
          <span className="text-2xl font-display">{latestWeight ? `${latestWeight} kg` : '--'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-line text-center">
          <span className="block text-xs font-bold text-ink/55">Altura</span>
          <span className="text-2xl font-display">{userProfile.height ? `${userProfile.height} cm` : '--'}</span>
        </div>
        </div>
      </section>

      <section aria-labelledby="profile-journey-title">
        <h3 id="profile-journey-title" className="label-sm mb-3 text-accent">Sua jornada</h3>
        <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => onOpenCare('chat')}
          className="sm:hidden"
        >
          <MessageCircle size={15} aria-hidden="true" /> Abrir conversa
        </Button>
        <Button onClick={() => setShowMetricsModal(true)}>
          <Activity size={15} aria-hidden="true" /> Atualizar métricas
        </Button>
      </div>
      </section>

      {/* Diário do Usuário */}
      {(userProfile.dailyNotes && userProfile.dailyNotes.length > 0) && (
        <div className="bg-white border border-line p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <PenTool size={18} className="text-accent" /> Anotações do Diário ({userProfile.dailyNotes.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={onOpenDiary} className="shrink-0">
              <PenTool size={14} aria-hidden="true" /> Nova anotação
            </Button>
          </div>
          <div className="space-y-3">
            {userProfile.dailyNotes.map((note) => (
              <div key={note.id} className="p-4 rounded-2xl bg-paper border border-line/60">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-accent">{note.date} · Humor: {note.mood || 'Neutro'}</span>
                </div>
                <p className="text-xs sm:text-sm text-ink/80 font-medium">"{note.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <section aria-labelledby="profile-settings-title">
        <h3 id="profile-settings-title" className="label-sm mb-3 text-accent">Configurações</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {profileActions.map((item) => (
            <button key={item.label} type="button" onClick={() => onNavigate(item.page as Page)} className="min-h-24 rounded-3xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-accent hover:bg-accent/5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-ink/5 text-ink/70">
                <item.icon size={18} aria-hidden="true" />
              </div>
              <span className="text-xs font-bold sm:text-sm">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col items-center gap-3 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toast('Mind Nutrition v1.2 - Desenvolvido com carinho para seu bem-estar alimentar.', 'info', 4000)}
        >
          <HelpCircle size={15} aria-hidden="true" /> Sobre o Mind Nutrition
        </Button>
        <Button variant="danger" fullWidth onClick={() => setShowExitConfirmation(true)}>
          <LogOut size={16} aria-hidden="true" /> Sair
        </Button>
      </div>
      <ConfirmationModal
        isOpen={showExitConfirmation}
        title="Sair da conta?"
        description="Você precisará entrar novamente. Os dados sincronizados continuam na sua conta e os dados locais deste aparelho serão apagados."
        confirmLabel="Sair"
        onConfirm={onLogout}
        onClose={() => setShowExitConfirmation(false)}
      />
      <MetricsModal
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
        userProfile={userProfile}
        onSaveProfile={onSaveProfile}
        toast={toast}
      />
    </PageContainer>
  );
}

function AccountSettingsPage({
  userProfile,
  onSaveProfile,
  onNavigate
}: {
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
  onNavigate: (page: Page) => void;
}) {
  const [name, setName] = useState(userProfile.name || '');
  const [email, setEmail] = useState(userProfile.email || '');
  const [gender, setGender] = useState(userProfile.gender || 'Mulher');
  const [age, setAge] = useState(userProfile.age || 25);
  const [height, setHeight] = useState(userProfile.height || 165);
  const [photo, setPhoto] = useState(userProfile.photo || DEFAULT_PROFILE_PHOTO);
  const [objectives, setObjectives] = useState(userProfile.objectives || []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const savingRef = useRef(false);
  const loadingPhotoRef = useRef(false);
  const isDirty = name !== (userProfile.name || '')
    || email !== (userProfile.email || '')
    || gender !== (userProfile.gender || 'Mulher')
    || age !== (userProfile.age || 25)
    || height !== (userProfile.height || 165)
    || photo !== (userProfile.photo || DEFAULT_PROFILE_PHOTO)
    || objectives.join('|') !== (userProfile.objectives || []).join('|');

  const handlePhoto = async (files: FileList | null) => {
    if (loadingPhotoRef.current) return;
    loadingPhotoRef.current = true;
    setLoadingPhoto(true);
    setError('');
    try {
      const result = await readValidatedImages(files, 0);
      if (result.error) { setError(result.error); return; }
      if (result.images[0]) setPhoto(result.images[0]);
    } finally {
      loadingPhotoRef.current = false;
      setLoadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (savingRef.current || !isDirty) return;
    if (!name.trim() || name.trim().length > 80) {
      setError('Informe um nome entre 1 e 80 caracteres.');
      return;
    }
    if (age < 10 || age > 120 || height < 80 || height > 250) {
      setError('Revise idade e altura: os valores estão fora de uma faixa plausível.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSaveProfile({
        ...userProfile,
        name: name.trim(),
        email: email.trim(),
        gender,
        age,
        height,
        photo,
        objectives,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o perfil. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <PageContainer variant="narrow" className="space-y-6">
      <PageHeader
        title="Editar perfil"
        subtitle="Revise seus dados pessoais e o que deseja acompanhar na jornada."
        back={{ label: 'Voltar ao perfil', onClick: () => { if (!saving) onNavigate('profile'); } }}
      />

      <form
        className="space-y-5 rounded-[2rem] border border-line bg-white p-6 shadow-sm sm:p-8"
        aria-busy={saving || undefined}
        onSubmit={(event) => { event.preventDefault(); void handleSave(); }}
      >
        {error && <p role="alert" className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-sm font-semibold text-danger">{error}</p>}
        <fieldset disabled={saving || loadingPhoto} className="space-y-5">
          <div className="flex items-center gap-4">
            <ProfileAvatar photo={photo} size="lg" />
            <div className="space-y-2">
              <label
                htmlFor="profile-photo"
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-bold text-accent hover:bg-accent/20"
              >
                <Camera size={16} aria-hidden="true" /> {loadingPhoto ? 'Lendo foto...' : 'Alterar foto'}
              </label>
              <input
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => { void handlePhoto(event.target.files); }}
              />
              <p className="text-xs text-ink/60">JPEG, PNG ou WebP.</p>
            </div>
          </div>
        <FormField label="Nome de exibição" htmlFor="profile-name" required>
          <input
            id="profile-name"
            type="text"
            value={name}
            maxLength={80}
            required
            onChange={(event) => setName(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-accent"
          />
        </FormField>

        <FormField
          label="E-mail do perfil"
          htmlFor="profile-email"
          hint="Usado nos dados do perfil. Esta tela não altera o e-mail de acesso ao Supabase Auth."
        >
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-accent"
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Gênero / sexo" htmlFor="profile-gender">
            <select
              id="profile-gender"
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-accent"
            >
              <option value="Mulher">Mulher</option>
              <option value="Homem">Homem</option>
              <option value="Não Binário(a)">Não Binário(a)</option>
              <option value="Outro">Outro</option>
              <option value="Prefiro não informar">Prefiro não informar</option>
            </select>
          </FormField>

          <FormField label="Idade" htmlFor="profile-age" hint="Entre 10 e 120 anos.">
            <input
              id="profile-age"
              type="number"
              min="10"
              max="120"
              inputMode="numeric"
              value={age}
              onChange={(event) => setAge(parseInt(event.target.value, 10) || 0)}
              className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-accent"
            />
          </FormField>
        </div>

        <FormField label="Altura" htmlFor="profile-height" hint="Em centímetros, entre 80 e 250.">
          <input
            id="profile-height"
            type="number"
            min="80"
            max="250"
            inputMode="decimal"
            value={height}
            onChange={(event) => setHeight(parseFloat(event.target.value) || 0)}
            className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-accent"
          />
        </FormField>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">Metas da jornada</legend>
          <p className="text-xs text-ink/60">Selecione uma ou mais opções.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {['Emagrecimento consciente', 'Melhorar a relação com a comida', 'Ganho de peso', 'Hipertrofia', 'Cuidar da minha saúde'].map((objective) => {
              const selected = objectives.includes(objective);
              return (
                <button
                  type="button"
                  key={objective}
                  aria-pressed={selected}
                  onClick={() => setObjectives(selected ? objectives.filter(item => item !== objective) : [...objectives, objective])}
                  className={`min-h-11 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${selected ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-white text-ink/70 hover:border-accent'}`}
                >
                  {objective}
                </button>
              );
            })}
          </div>
        </fieldset>
        </fieldset>

        <Button type="submit" fullWidth loading={saving} disabled={!isDirty || loadingPhoto}>
          Salvar alterações
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink/55">As alterações são salvas neste aparelho e enviadas para sincronização quando a conexão permitir.</p>
      </form>
    </PageContainer>
  );
}

function PrivacySettingsPage({
  currentUserId,
  onDeleteData,
  onNavigate
}: {
  currentUserId: string | null;
  onDeleteData: () => void | boolean | Promise<void | boolean>;
  onNavigate: (page: Page) => void;
}) {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  return (
    <PageContainer variant="narrow" className="space-y-6">
      <PageHeader
        title="Privacidade"
        subtitle="Entenda onde seus dados ficam salvos e como removê-los."
        back={{ label: 'Voltar ao perfil', onClick: () => onNavigate('profile') }}
      />
      <section className="space-y-5 rounded-[2rem] border border-line bg-white p-6 shadow-sm" aria-labelledby="privacy-storage-title">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-4">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h3 id="privacy-storage-title" className="text-base font-bold text-ink">
              {currentUserId ? 'Sincronização da conta' : 'Armazenamento neste aparelho'}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink/65">
              {currentUserId
                ? 'Seu perfil é salvo neste aparelho e o app tenta sincronizá-lo com o servidor quando há uma sessão ativa. Se a conexão falhar, o registro local continua disponível.'
                : 'Seu perfil fica salvo neste aparelho. A sincronização com o servidor fica indisponível até que você entre novamente.'}
            </p>
          </div>
        </div>
        <div className="space-y-3 border-t border-line pt-5">
          <h3 className="text-base font-bold text-ink">Apagar dados</h3>
          <p className="text-sm leading-relaxed text-ink/65">Remove perfil, refeições, diário, sono e medidas{currentUserId ? ' da conta sincronizada' : ' deste aparelho'}. Esta ação não pode ser desfeita.</p>
          <Button variant="danger" fullWidth onClick={() => setShowDeleteConfirmation(true)}>
            <Trash2 size={16} aria-hidden="true" /> Apagar dados
          </Button>
        </div>
      </section>
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Apagar todos os dados?"
        description={currentUserId
          ? 'Seu perfil, refeições, diário, sono e medidas serão removidos da conta e deste aparelho. Esta ação não pode ser desfeita.'
          : 'Seu perfil, refeições, diário, sono e medidas serão removidos deste aparelho. Esta ação não pode ser desfeita.'}
        confirmLabel="Apagar dados"
        onConfirm={onDeleteData}
        onClose={() => setShowDeleteConfirmation(false)}
      />
    </PageContainer>
  );
}

function SettingsHelpPage({
  onNavigate
}: {
  onNavigate: (page: Page) => void;
}) {
  return (
    <PageContainer variant="narrow" className="space-y-6">
      <PageHeader
        title="Ajuda & contato"
        subtitle="Fale com a equipe para tirar dúvidas sobre o app e sua jornada."
        back={{ label: 'Voltar ao perfil', onClick: () => onNavigate('profile') }}
      />
      <section className="space-y-5 rounded-[2rem] border border-line bg-white p-6 shadow-sm" aria-labelledby="help-team-title">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Heart size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 id="help-team-title" className="text-base font-bold text-ink">Equipe Mind Nutrition</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">Estamos à disposição para tirar dúvidas e acolher você.</p>
          </div>
        </div>
        <div className="space-y-3">
          <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-accent">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><FaWhatsapp size={18} aria-hidden="true" /></div>
            <div className="min-w-0">
              <span className="block text-sm font-bold text-ink">WhatsApp da equipe</span>
              <span className="mt-0.5 block text-xs text-ink/60">(11) 99999-9999</span>
            </div>
          </a>
          <a href="mailto:contato@mindnutrition.app" className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-accent">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-secondary/15 text-accent-secondary"><Mail size={16} aria-hidden="true" /></div>
            <div className="min-w-0">
              <span className="block text-sm font-bold text-ink">E-mail de suporte</span>
              <span className="mt-0.5 block break-all text-xs text-ink/60">contato@mindnutrition.app</span>
            </div>
          </a>
        </div>
      </section>
    </PageContainer>
  );
}

function MealDetailsPageComponent({
  selectedMeal,
  onNavigate,
  onUpdate,
  onDelete,
  toast,
}: {
  selectedMeal: any;
  onNavigate: (page: Page) => void;
  onUpdate: (meal: any) => void | Promise<void>;
  onDelete: () => void | boolean | Promise<void | boolean>;
  toast: any;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const savingRef = useRef(false);
  const loadingPhotosRef = useRef(false);
  const [title, setTitle] = useState(selectedMeal?.title || 'Refeição');
  const [notes, setNotes] = useState(selectedMeal?.notes || '');
  const [photos, setPhotos] = useState<string[]>(() => selectedMeal?.photos?.length ? selectedMeal.photos : (selectedMeal?.image ? [selectedMeal.image] : []));
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  if (!selectedMeal) return null;
  const mealType = inferMealType(selectedMeal);
  const mealPhotos = photos;
  const originalTitle = selectedMeal.title || 'Refeição';
  const originalNotes = selectedMeal.notes || '';
  const originalPhotos = selectedMeal.photos?.length ? selectedMeal.photos : (selectedMeal.image ? [selectedMeal.image] : []);
  const isDirty = title !== originalTitle || notes !== originalNotes || photos.join('|') !== originalPhotos.join('|');
  const satisfactionLabels = ['Nada satisfeito', 'Muito pouco', 'Pouco', 'Moderadamente', 'Satisfeito', 'Muito'];
  const hasSatisfaction = Number.isInteger(selectedMeal.satisfaction) && selectedMeal.satisfaction >= 0 && selectedMeal.satisfaction <= 5;

  const cancelEditing = () => {
    if (saving) return;
    setTitle(originalTitle);
    setNotes(originalNotes);
    setPhotos(originalPhotos);
    setSaveError('');
    setIsEditing(false);
  };

  const addMealPhotos = async (files: FileList | null) => {
    if (loadingPhotosRef.current) return;
    loadingPhotosRef.current = true;
    setLoadingPhotos(true);
    try {
      const result = await readValidatedImages(files, mealPhotos.length);
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      if (result.images.length) setPhotos(current => [...current, ...result.images]);
    } finally {
      loadingPhotosRef.current = false;
      setLoadingPhotos(false);
    }
  };

  const saveChanges = async () => {
    if (savingRef.current || !isDirty) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await onUpdate({ ...selectedMeal, title: title.trim() || 'Refeição', notes: notes.trim(), photos: mealPhotos, image: mealPhotos[0] || '' });
      setIsEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar a edição. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <PageContainer variant="narrow" className="space-y-6 px-4 pt-24 sm:px-8 md:px-12 md:pt-28">
      <PageHeader
        title={isEditing ? 'Editar refeição' : originalTitle}
        subtitle={`${selectedMeal.time || ''} · ${mealType}`}
        eyebrow="Detalhes da refeição"
        back={{ label: 'Voltar ao dashboard', onClick: () => { if (!saving) onNavigate('dashboard'); } }}
        actions={(
          <>
            <Button variant={isEditing ? 'secondary' : 'ghost'} size="sm" onClick={isEditing ? cancelEditing : () => setIsEditing(true)} disabled={saving}>
              {isEditing ? 'Cancelar' : <><Edit2 size={15} /> Editar</>}
            </Button>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirmation(true)} className="text-danger hover:bg-danger/10">
                <Trash2 size={15} /> Excluir
              </Button>
            )}
          </>
        )}
      />

      <div className="bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm">
        {mealPhotos[0] ? (
          <div className="h-64 sm:h-80 w-full relative bg-accent/5">
            <img src={mealPhotos[0]} alt={selectedMeal.title} className="w-full h-full object-cover" />
            <div className="absolute top-4 right-4 bg-paper/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold shadow-md">
              {selectedMeal.time}
            </div>
          </div>
        ) : null}

        <div className="p-6 space-y-6">
          {isEditing && (
            <div className="space-y-5 rounded-2xl border border-line bg-paper p-4" aria-busy={saving || undefined}>
              <FormField label="Nome da refeição" htmlFor="edit-meal-title">
                <input id="edit-meal-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} disabled={saving} className="input-field font-bold" />
              </FormField>
              <FormField label="Anotações" htmlFor="edit-meal-notes" optional>
                <textarea id="edit-meal-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} disabled={saving} className="input-field min-h-24 resize-y" />
              </FormField>
              <fieldset>
                <legend className="label-sm text-accent">Fotos</legend>
                <p className="mt-1 text-xs text-ink/55">Até {MAX_MEAL_PHOTOS} fotos. Adicionar ou remover não inicia análise de IA.</p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {mealPhotos.map((photo, index) => (
                    <div key={`${photo.slice(0, 24)}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-white">
                      <img src={photo} alt={`Foto ${index + 1} da refeição`} className="h-full w-full object-cover" />
                      <button type="button" disabled={saving} onClick={() => setPhotos(current => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/80 text-paper disabled:opacity-50" aria-label={`Remover foto ${index + 1}`}><X size={14} /></button>
                    </div>
                  ))}
                  {mealPhotos.length < MAX_MEAL_PHOTOS && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-accent bg-accent/5 p-2 text-center text-xs font-bold text-accent hover:bg-accent/10">
                      {loadingPhotos ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
                      {loadingPhotos ? 'Carregando' : 'Adicionar'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={loadingPhotos || saving} className="sr-only" onChange={(event) => { void addMealPhotos(event.target.files); event.target.value = ''; }} />
                    </label>
                  )}
                </div>
              </fieldset>
              {saveError && <p role="alert" className="rounded-xl bg-danger/5 p-3 text-sm text-danger">{saveError}</p>}
              <Button fullWidth onClick={() => void saveChanges()} loading={saving} disabled={!isDirty}>Salvar edição</Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
              <span className="text-xs font-bold text-accent block">Tipo de fome</span>
              <span className="text-lg font-bold text-ink">{mealType}</span>
            </div>
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-xs font-bold text-ink/50 block">Satisfação física</span>
              <span className="text-lg font-bold text-ink">
                {hasSatisfaction ? `${selectedMeal.satisfaction}/5 (${satisfactionLabels[selectedMeal.satisfaction]})` : 'Não informada'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-xs font-bold text-ink/50 block">Humor antes / depois</span>
              <span className="text-sm font-bold text-ink">{selectedMeal.preMood || 'Neutro'} ➔ {selectedMeal.postMood || selectedMeal.mood || 'Neutro'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-xs font-bold text-ink/50 block">Fome antes / depois</span>
              <span className="text-sm font-bold text-ink">{selectedMeal.preHunger ?? 5}/10{selectedMeal.postHunger !== null && selectedMeal.postHunger !== undefined ? ` ➔ ${selectedMeal.postHunger}/10` : ''}</span>
            </div>
          </div>

          {mealPhotos.length > 1 && (
            <div>
              <h4 className="font-bold text-sm mb-3">Outras Fotos</h4>
              <div className="grid grid-cols-3 gap-2">
                {mealPhotos.slice(1).map((p: string, idx: number) => (
                  <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-line">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedMeal.aiAnalysis && (
            <MealAiAnalysisCard
              analysis={selectedMeal.aiAnalysis}
              loading={false}
              error=""
              hasPhoto={Boolean(mealPhotos[0])}
              onAnalyze={() => undefined}
              showAction={false}
            />
          )}

          {notes && (
            <div className="p-5 bg-paper rounded-2xl border border-line">
              <span className="label-sm text-accent mb-1 block">Anotações</span>
              <p className="text-sm text-ink/80 italic font-medium">"{notes}"</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Excluir esta refeição?"
        description="A refeição, suas fotos e os sinais registrados serão removidos dos seus dados. Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={onDelete}
        onClose={() => setShowDeleteConfirmation(false)}
      />
    </PageContainer>
  );
}
