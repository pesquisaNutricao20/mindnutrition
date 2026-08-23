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
  PhoneCall,
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
  Palette,
  Trash2,
  PenTool,
  BedDouble,
  Compass,
} from 'lucide-react';
import { TbHealthRecognition } from 'react-icons/tb';
import { PiHeartbeat } from 'react-icons/pi';
import { FaBrain, FaWhatsapp } from 'react-icons/fa';
import { motion, AnimatePresence, useAnimation, useMotionValue } from 'motion/react';
import { useToast } from './components/Toast';
import { AuthPage } from './components/AuthPage';
import { ProfileAvatar } from './components/ui/ProfileAvatar';
import { HungerOdometer } from './components/ui/HungerOdometer';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { MascotBubble } from './components/ui/MascotBubble';
import { APP_THEMES, DEFAULT_THEME_ID } from './constants/themes';
import { DEFAULT_PROFILE_PHOTO, readValidatedImages, MAX_IMAGE_SIZE_MB, MAX_MEAL_PHOTOS } from './constants';
import type { Page, UserProfile, DailyNote, SleepLog } from './types';
import {
  deleteCurrentUserData,
  getFriendlySupabaseError,
  getCurrentSession,
  insertMeal,
  isSupabaseDataSyncAvailable,
  isSupabaseConfigured,
  loadMeals,
  loadProfile,
  supabase,
  upsertProfile,
} from './lib/supabase';
import iconApp from './assets/logo/icon_app.png';
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
  const heightM = heightCm / 100;
  const imc = weight / (heightM * heightM);

  let tmb = (10 * weight) + (6.25 * heightCm) - (5 * age);
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

type MetricPoint = { date: string; value: number };
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
  const latest = [...(items || [])].reverse().find(item => Number.isFinite(item.value) && item.value > 0);
  return latest?.value || null;
};

const parseDateForSorting = (dateStr: string) => {
  if (!dateStr) return 0;
  if (dateStr === 'Hoje') return Date.now();
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, month, day).getTime();
    }
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year < 100 ? 2000 + year : year, month, day).getTime();
    }
  }
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortMetricsChronologically = (items: MetricPoint[] = []) => {
  return [...items].sort((a, b) => parseDateForSorting(a.date) - parseDateForSorting(b.date));
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

const buildRcqData = (profile: Partial<UserProfile>) => {
  const latestHip = getLatestMetricValue(profile.hipEvolution);
  const unsorted = (profile.waistEvolution || [])
    .map(waist => {
      const sameDateHip = (profile.hipEvolution || []).find(hip => hip.date === waist.date)?.value;
      const hipValue = sameDateHip || latestHip;
      return {
        date: waist.date,
        value: waist.value > 0 && hipValue ? parseFloat((waist.value / hipValue).toFixed(2)) : 0,
      };
    })
    .filter(item => item.value > 0);
  return sortMetricsChronologically(unsorted);
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

const MODAL_BACKDROP_CLASS = 'absolute inset-0 bg-ink/85';
const COLORS = ['#6BAF9E', '#C9A3B5', '#5A9485', '#8EBAAA', '#D6EDE6'];

const sanitizeProfileDefaults = (profile: UserProfile): UserProfile => {
  const currentDateLabel = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const normalizeDates = (items: MetricPoint[] = []) => items.map(item => item.date === 'Hoje' ? { ...item, date: currentDateLabel } : item);
  return {
    ...profile,
    weightEvolution: sortMetricsChronologically(normalizeDates(profile.weightEvolution)),
    waistEvolution: sortMetricsChronologically(normalizeDates(profile.waistEvolution)),
    armEvolution: sortMetricsChronologically(normalizeDates(profile.armEvolution)),
    abdomenEvolution: sortMetricsChronologically(normalizeDates(profile.abdomenEvolution)),
    hipEvolution: sortMetricsChronologically(normalizeDates(profile.hipEvolution)),
  };
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

export const HungerGuideModal = ({ isOpen, onClose }: HungerGuideModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-shell fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={MODAL_BACKDROP_CLASS} onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} className="modal-panel relative max-w-2xl bg-paper p-6 shadow-2xl sm:p-8 rounded-[2rem] border border-line">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="label-sm text-accent">Pausa de Observação & Orientação</span>
                <h3 className="modal-title font-title mt-2 text-2xl sm:text-3xl font-bold">Fome Física x Fome Emocional</h3>
              </div>
              <button type="button" onClick={onClose} className="icon-button h-10 w-10"><X size={18} /></button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">
              Escute os sinais do seu corpo com carinho. Use estas orientações para identificar sua real necessidade no momento:
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <section className="rounded-3xl border border-accent/25 bg-accent/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-accent inline-block" />
                  <h4 className="font-bold text-accent text-base sm:text-lg">{HUNGER_DEFINITIONS.fisica.title}</h4>
                </div>
                <p className="text-xs sm:text-sm text-ink/80 leading-relaxed italic mb-3">
                  "{HUNGER_DEFINITIONS.fisica.description}"
                </p>
                <ul className="space-y-1.5 text-xs text-ink/70">
                  {HUNGER_DEFINITIONS.fisica.signals.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">• <span>{s}</span></li>
                  ))}
                </ul>
              </section>
              <section className="rounded-3xl border border-accent-pink/30 bg-accent-pink/10 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-accent-pink inline-block" />
                  <h4 className="font-bold text-accent-pink text-base sm:text-lg">{HUNGER_DEFINITIONS.emocional.title}</h4>
                </div>
                <p className="text-xs sm:text-sm text-ink/80 leading-relaxed italic mb-3">
                  "{HUNGER_DEFINITIONS.emocional.description}"
                </p>
                <ul className="space-y-1.5 text-xs text-ink/70">
                  {HUNGER_DEFINITIONS.emocional.signals.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">• <span>{s}</span></li>
                  ))}
                </ul>
              </section>
            </div>
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-full bg-accent py-4 text-sm font-bold text-paper shadow-md hover:bg-accent/90">
              Entendi, obrigado(a)
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal = ({ isOpen, onClose }: TutorialModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-shell fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={MODAL_BACKDROP_CLASS} onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} className="modal-panel relative max-w-xl bg-paper p-6 shadow-2xl sm:p-8 rounded-[2rem] border border-line">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="label-sm text-accent">Boas-vindas</span>
                <h3 className="modal-title font-title mt-1 text-2xl font-bold">Como Funciona o Mind Nutrition?</h3>
              </div>
              <button type="button" onClick={onClose} className="icon-button h-10 w-10"><X size={18} /></button>
            </div>
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">1</div>
                <div>
                  <h4 className="font-bold text-sm">Pausa & Observação Pré-Refeição</h4>
                  <p className="text-xs text-ink/65 mt-1">Antes de comer, reserve 30 segundos para avaliar sua fome de 0 a 10 e reconhecer suas emoções.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">2</div>
                <div>
                  <h4 className="font-bold text-sm">Registro Gentil da Refeição</h4>
                  <p className="text-xs text-ink/65 mt-1">Tire fotos, anote sabores e texturas sem foco em calorias ou regras rígidas.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">3</div>
                <div>
                  <h4 className="font-bold text-sm">Saciedade & Autoconhecimento</h4>
                  <p className="text-xs text-ink/65 mt-1">Após comer, avalie seu nível de satisfação (0 a 5) e veja seus padrões no painel de Insights.</p>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-full bg-accent py-4 text-sm font-bold text-paper shadow-md hover:bg-accent/90">
              Começar a Explorar
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface DailyDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string, mood?: string) => void;
}

export const DailyDiaryModal = ({ isOpen, onClose, onSave }: DailyDiaryModalProps) => {
  const [diaryText, setDiaryText] = useState('');
  const [diaryMood, setDiaryMood] = useState('Calmo(a)');

  if (!isOpen) return null;

  return (
    <div className="modal-shell fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={MODAL_BACKDROP_CLASS} onClick={onClose} />
      <div className="modal-panel relative max-w-xl bg-paper p-6 shadow-2xl sm:p-8 rounded-[2rem] border border-line z-10 w-full">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="label-sm text-accent">Diário Livre</span>
            <h3 className="modal-title font-title mt-1 text-2xl font-bold">Anotações & Reflexões do Dia</h3>
          </div>
          <button type="button" onClick={onClose} className="icon-button h-10 w-10"><X size={18} /></button>
        </div>
        <p className="mt-2 text-xs text-ink/60">
          Escreva situações, sentimentos ou acontecimentos que influenciaram suas escolhas e sua alimentação hoje.
        </p>
        <div className="mt-4 space-y-4">
          <textarea
            value={diaryText}
            onChange={(e) => setDiaryText(e.target.value)}
            placeholder="Como foi o seu dia? Sentiu ansiedade no trabalho? Celebrou algo especial? Descreva livremente..."
            className="w-full h-32 p-4 rounded-2xl bg-white border border-line focus:border-accent focus:outline-none text-sm resize-none font-medium"
          />
          <div>
            <label className="label-sm block text-accent mb-2">Sentimento predominante:</label>
            <div className="flex flex-wrap gap-2">
              {['Calmo(a)', 'Alegre', 'Ansioso(a)', 'Estressado(a)', 'Cansado(a)', 'Grato(a)'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDiaryMood(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${diaryMood === m ? 'bg-accent text-paper border-accent' : 'bg-white text-ink/65 border-line'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSave(diaryText, diaryMood);
              setDiaryText('');
              onClose();
            }}
            className="w-full py-4 bg-accent text-paper rounded-full font-bold text-sm shadow-md hover:bg-accent/90"
          >
            Salvar no Diário
          </button>
        </div>
      </div>
    </div>
  );
};

interface SleepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hours: number, quality: 'Ruim' | 'Regular' | 'Bom' | 'Excelente', notes?: string) => void;
}

export const SleepModal = ({ isOpen, onClose, onSave }: SleepModalProps) => {
  const [hours, setHours] = useState(7.5);
  const [quality, setQuality] = useState<'Ruim' | 'Regular' | 'Bom' | 'Excelente'>('Bom');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  return (
    <div className="modal-shell fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={MODAL_BACKDROP_CLASS} onClick={onClose} />
      <div className="modal-panel relative max-w-xl bg-paper p-6 shadow-2xl sm:p-8 rounded-[2rem] border border-line z-10 w-full">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="label-sm text-accent">Módulo de Sono</span>
            <h3 className="modal-title font-title mt-1 text-2xl font-bold">Como foi seu descanso?</h3>
          </div>
          <button type="button" onClick={onClose} className="icon-button h-10 w-10"><X size={18} /></button>
        </div>
        <p className="mt-2 text-xs text-ink/60">
          Uma boa noite de sono regula a grelina e leptina, facilitando escolhas alimentares mais equilibradas.
        </p>
        <div className="mt-5 space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="label-sm text-accent">Horas dormidas:</label>
              <span className="text-xl font-bold text-accent">{hours}h</span>
            </div>
            <input
              type="range"
              min="3"
              max="12"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(parseFloat(e.target.value))}
              className="w-full accent-accent h-2 bg-line rounded-lg cursor-pointer"
            />
          </div>
          <div>
            <label className="label-sm block text-accent mb-2">Qualidade do sono:</label>
            <div className="grid grid-cols-4 gap-2">
              {(['Ruim', 'Regular', 'Bom', 'Excelente'] as const).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`py-2.5 rounded-2xl text-xs font-bold border text-center transition-colors ${quality === q ? 'bg-accent text-paper border-accent shadow-xs' : 'bg-white text-ink/65 border-line'}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-sm block text-accent mb-2">Observações (opcional):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Acordei durante a noite, tomei café tarde..."
              className="w-full px-4 py-3 rounded-2xl bg-white border border-line text-xs font-medium focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onSave(hours, quality, notes);
              onClose();
            }}
            className="w-full py-4 bg-accent text-paper rounded-full font-bold text-sm shadow-md hover:bg-accent/90"
          >
            Registrar Sono
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// MAIN APP COMPONENT
// =========================================================================

export default function App() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    if (window.location.pathname === '/nutricionista') {
      return localStorage.getItem('nutriAdminLoggedIn') === 'true' ? 'admin-dashboard' : 'admin-login';
    }
    const savedUser = localStorage.getItem('nutriUser');
    return savedUser ? 'dashboard' : 'landing';
  });
  const [diagnosisStep, setDiagnosisStep] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [loggedMeals, setLoggedMeals] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [themeId, setThemeId] = useState(() => localStorage.getItem('mindTheme') || DEFAULT_THEME_ID);
  const [showHungerModal, setShowHungerModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showDailyDiaryModal, setShowDailyDiaryModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => localStorage.getItem('nutriAdminLoggedIn') === 'true');
  const [adminUsers, setAdminUsers] = useState<any[]>(() => {
    const saved = localStorage.getItem('nutriAllUsers');
    return saved ? JSON.parse(saved) : [];
  });
  const [adminArticles, setAdminArticles] = useState<any[]>(() => {
    return [...DEFAULT_LIBRARY_ARTICLES];
  });
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
      upsertProfile(sessionUserId, profileToPersist.email, profileToPersist as unknown as Record<string, unknown>).catch((err) => {
        console.info('Supabase profile sync skipped:', getFriendlySupabaseError(err));
      });
    }
  };

  useEffect(() => {
    const theme = APP_THEMES.find(item => item.id === themeId) || APP_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--ink', theme.colors.ink);
    root.style.setProperty('--paper', theme.colors.paper);
    root.style.setProperty('--accent', theme.colors.accent);
    root.style.setProperty('--accent-pink', theme.colors.accentPink);
    root.style.setProperty('--accent-light', theme.colors.accentLight);
    root.style.setProperty('--accent-pink-light', theme.colors.accentPinkLight);
    root.style.setProperty('--line', theme.colors.line);
    localStorage.setItem('mindTheme', theme.id);
  }, [themeId]);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const saved = localStorage.getItem('nutriUser');
      const savedMeals = localStorage.getItem('nutriMeals');
      if (saved) {
        try {
          const savedProfile = withProfileCompletionState(sanitizeProfileDefaults(JSON.parse(saved)));
          setUserProfile(savedProfile);
          setCurrentPage(prev => prev === 'landing' ? getPostLoginPage(savedProfile) : prev);
        } catch {}
      }
      if (savedMeals) {
        try { setLoggedMeals(JSON.parse(savedMeals)); } catch {}
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
            const remoteMeals = isSupabaseDataSyncAvailable()
              ? await loadMeals(session.user.id).catch(() => [])
              : [];
            if (remoteProfile && active) {
              setUserProfile(prev => {
                const hydrated = withProfileCompletionState(mergeProfileData(prev, {
                  ...remoteProfile,
                  email: session.user.email || remoteProfile.email || prev.email,
                  name: remoteProfile.name || prev.name || metadataName,
                  photo: remoteProfile.photo || prev.photo || metadataPhoto,
                }));
                localStorage.setItem('nutriUser', JSON.stringify(hydrated));
                setCurrentPage(page => page === 'landing' || page === 'dashboard' ? getPostLoginPage(hydrated) : page);
                return hydrated;
              });
            }
            if (remoteMeals.length && active) {
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
    if (!isLoading) localStorage.setItem('nutriUser', JSON.stringify(userProfile));
    if (userProfile.name && userProfile.email) {
      const allUsers = JSON.parse(localStorage.getItem('nutriAllUsers') || '[]');
      const existingIndex = allUsers.findIndex((u: any) => u.email === userProfile.email);
      if (existingIndex >= 0) {
        allUsers[existingIndex] = userProfile;
      } else {
        allUsers.push(userProfile);
      }
      localStorage.setItem('nutriAllUsers', JSON.stringify(allUsers));
      setAdminUsers(allUsers);
    }
  }, [userProfile, isLoading]);

  useEffect(() => {
    localStorage.setItem('nutriArticles', JSON.stringify(adminArticles));
  }, [adminArticles]);

  const articleControls = useAnimation();
  const articleY = useMotionValue(0);

  useEffect(() => {
    if (selectedArticle) {
      articleControls.start({ y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedArticle, articleControls]);

  const handleArticleDragEnd = (event: any, info: any) => {
    if (info.offset.y > 100) {
      closeArticle();
    } else {
      articleControls.start({ y: 0 });
    }
  };

  const closeArticle = () => {
    articleControls.start({ y: '100%' }).then(() => setSelectedArticle(null));
  };

  const saveMeal = (meal: any) => {
    const updated = [meal, ...loggedMeals];
    setLoggedMeals(updated);
    localStorage.setItem('nutriMeals', JSON.stringify(updated));
    if (currentUserId) {
      insertMeal(currentUserId, meal).catch((err) => {
        console.info('Supabase meal sync skipped:', getFriendlySupabaseError(err));
      });
    }
  };

  const addDailyNote = (noteText: string, mood?: string) => {
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
    persistUserProfile(updated);
    toast('Anotação do dia salva no seu diário!', 'success');
  };

  const addSleepLog = (hours: number, quality: 'Ruim' | 'Regular' | 'Bom' | 'Excelente', notes?: string) => {
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
    persistUserProfile(updated);
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

  const renderTopNavbar = () => {
    if (['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles'].includes(currentPage) || isLoading) return null;
    const activeNavItem = navItems.find(item => item.id === currentPage);
    const pageLabelMap: Partial<Record<Page, string>> = {
      'meal-details': 'Detalhes',
      'settings-account': 'Conta',
      'settings-theme': 'Temas',
      'settings-privacy': 'Privacidade',
      'settings-help': 'Ajuda',
    };
    const pageLabel = activeNavItem?.label || pageLabelMap[currentPage] || 'Jornada';
    const ActiveIcon = activeNavItem?.icon || Sparkles;

    return (
      <header className="app-topbar">
        <button
          type="button"
          onClick={() => setCurrentPage('dashboard')}
          className="topbar-brand"
          aria-label="Ir para o início"
        >
          <div className="topbar-mark">
            <img src={iconApp} alt="Mind Nutrition" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <span className="topbar-eyebrow">Seu app de nutrição</span>
            <h1 className="topbar-title logo-wordmark">Mind Nutrition</h1>
          </div>
        </button>

        <div className="topbar-section">
          <div className="topbar-section-icon">
            <ActiveIcon size={18} />
          </div>
          <div className="min-w-0">
            <span className="topbar-eyebrow">Você está em</span>
            <strong className="topbar-page">{pageLabel}</strong>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHungerModal(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 transition-colors"
            title="Diferenciar Fome Física e Emocional"
          >
            <HelpCircle size={15} />
            <span className="hidden md:inline">Fome Física x Emocional</span>
          </button>

          <button onClick={() => setCurrentPage('profile')} className="topbar-profile">
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
      <aside className="app-sidebar">
        <div className="w-12 h-12 mb-6 rounded-2xl overflow-hidden p-1 border border-accent/20 bg-white shadow-sm flex items-center justify-center">
          <img src={iconApp} alt="Mind Nutrition" className="w-full h-full object-contain" />
        </div>
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id as Page)}
              aria-label={item.label}
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

    // Mobile nav contains 5 symmetrical items: Início, Insights, Registrar (Center), Biblioteca, Perfil
    return (
      <div className="mobile-nav fixed inset-x-0 bottom-3 z-40 flex justify-center px-4 pb-safe pointer-events-none">
        <nav className="pointer-events-auto grid grid-cols-5 h-16 w-full max-w-[24rem] items-center rounded-full border border-white/70 bg-paper/90 px-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;

            if (item.primary) {
              return (
                <div key={item.id} className="flex justify-center items-center">
                  <button
                    onClick={() => setCurrentPage('meal-log')}
                    className="relative -top-5 w-14 h-14 rounded-full flex items-center justify-center border-4 border-paper bg-accent text-paper shadow-lg hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Registrar Refeição"
                  >
                    <PlusCircle size={30} />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id as Page)}
                aria-label={item.label}
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
                <span className="text-[9px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  const PageWrapper = ({ children, noPadding = false }: { children: React.ReactNode, noPadding?: boolean }) => {
    const hasTopbar = !['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles'].includes(currentPage);
    const pagePadding = noPadding ? '' : `px-4 sm:px-8 md:px-12 ${hasTopbar ? 'pt-24 md:pt-28' : 'pt-8 md:pt-12'}`;
    const bottomPadding = noPadding ? '' : 'pb-28 md:pb-16';
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`w-full min-h-screen ${bottomPadding} ${pagePadding} max-w-6xl mx-auto swipe-tab-container`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </motion.div>
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
    const remoteMeals = isSupabaseDataSyncAvailable()
      ? await loadMeals(user.id).catch(() => [])
      : [];
    const nextProfile = withProfileCompletionState(mergeProfileData(userProfile, {
      ...(remoteProfile || {}),
      photo: signupPhoto || metadataPhoto || userProfile.photo,
      name: remoteProfile?.name || userProfile.name || metadataName,
      email: user.email || '',
    }));
    await persistUserProfile(nextProfile, user.id);
    if (remoteMeals.length) {
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
            <PageWrapper noPadding key="landing">
              <div className="landing-gradient w-full h-[100dvh] overflow-hidden fixed inset-0 z-50 bg-paper" style={{ backgroundImage: 'radial-gradient(var(--line) 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-paper via-transparent to-paper pointer-events-none z-0" />
                <div className="w-full h-full flex flex-col relative z-10 max-w-[2000px] mx-auto">
                  <div className="flex-1 flex flex-col justify-center px-8 md:px-16 pb-20 md:pb-32 overflow-y-auto">
                    <div className="max-w-4xl mx-auto w-full">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white p-2 border border-accent/20 shadow-md">
                          <img src={iconApp} alt="Mind Nutrition Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="label-sm text-accent tracking-[0.2em]">Mind Nutrition</span>
                      </div>
                      <div className="mb-10 relative inline-block">
                        <h1 className="font-title text-accent text-[4rem] sm:text-[5.5rem] md:text-[7.5rem] leading-[0.85] tracking-tight relative z-10">Mind</h1>
                        <h1 className="font-title text-accent-pink -mt-2 md:-mt-6 text-right text-[3.8rem] sm:text-[5.2rem] md:text-[7.5rem] leading-[0.85] tracking-tight relative z-10">Nutrition</h1>
                      </div>

                      <div className="max-w-xl mb-10 bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[2rem] border border-line shadow-sm relative z-20">
                        <p className="serif-body text-2xl md:text-3xl text-ink leading-tight mb-4">
                          Vá além do ruído das dietas.
                        </p>
                        <p className="text-ink/75 font-medium text-sm md:text-base leading-relaxed">
                          Descubra uma abordagem gentil para a sua alimentação. Experimente refletir sobre o que você está sentindo e avalie se precisa, de fato, comer.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-4 z-20 relative">
                        <button
                          onClick={() => {
                            const saved = localStorage.getItem('nutriUser');
                            if (saved) {
                              try {
                                setCurrentPage(getPostLoginPage(JSON.parse(saved)));
                              } catch {
                                setCurrentPage('diagnosis');
                              }
                            } else {
                              setCurrentPage('auth');
                            }
                          }}
                          className="group relative inline-flex items-center gap-4 bg-accent text-paper px-8 sm:px-10 py-5 rounded-[2rem] font-bold uppercase tracking-widest text-sm shadow-xl hover:scale-105 active:scale-95 transition-all"
                        >
                          <FaBrain size={22} />
                          <span>{localStorage.getItem('nutriUser') ? 'Continuar Jornada' : 'Começar Jornada'}</span>
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PageWrapper>
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
              onMoodShared={(mood) => {
                const checkIns = [...(userProfile.checkIns || []), { date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), mood }];
                persistUserProfile({ ...userProfile, checkIns });
              }}
              onSelectMeal={(m) => { setSelectedMeal(m); setCurrentPage('meal-details'); }}
              toast={toast}
            />
          )}

          {currentPage === 'meal-log' && (
            <MealLogPage
              key="meal-log"
              onSaveMeal={(newMeal) => {
                saveMeal(newMeal);
                toast('Refeição registrada com sucesso!', 'success');
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
            />
          )}

          {currentPage === 'profile' && (
            <ProfilePageComponent
              key="profile"
              userProfile={userProfile}
              onNavigate={setCurrentPage}
              onOpenDiary={() => setShowDailyDiaryModal(true)}
              toast={toast}
            />
          )}

          {currentPage === 'settings-account' && (
            <AccountSettingsPage
              key="account"
              userProfile={userProfile}
              onSaveProfile={(p) => {
                persistUserProfile(p);
                toast('Dados da conta atualizados com sucesso!', 'success');
                setCurrentPage('profile');
              }}
              onNavigate={setCurrentPage}
            />
          )}

          {currentPage === 'settings-theme' && (
            <ThemeSettingsPage
              key="themes"
              themeId={themeId}
              onSetTheme={setThemeId}
              onNavigate={setCurrentPage}
            />
          )}

          {currentPage === 'settings-privacy' && (
            <PrivacySettingsPage
              key="privacy"
              currentUserId={currentUserId}
              onDeleteData={async () => {
                if (!window.confirm('Apagar seus dados de perfil e refeições? Esta ação não pode ser desfeita.')) return;
                try {
                  if (currentUserId) await deleteCurrentUserData(currentUserId);
                  await supabase?.auth.signOut();
                  localStorage.removeItem('nutriUser');
                  localStorage.removeItem('nutriMeals');
                  setLoggedMeals([]);
                  setCurrentUserId(null);
                  toast('Seus dados foram apagados com segurança.', 'success');
                  setCurrentPage('landing');
                } catch {
                  toast('Não foi possível apagar os dados no banco agora.', 'error');
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
            />
          )}

          {currentPage === 'admin-login' && (
            <AdminLoginPageComponent
              key="admin-login"
              onLoginSuccess={() => {
                setAdminLoggedIn(true);
                localStorage.setItem('nutriAdminLoggedIn', 'true');
                toast('Bem-vindo, Administrador!', 'success');
                setCurrentPage('admin-dashboard');
              }}
              onNavigate={setCurrentPage}
              toast={toast}
            />
          )}

          {currentPage === 'admin-dashboard' && (
            <AdminDashboardPageComponent
              key="admin-dashboard"
              adminUsers={adminUsers}
              adminArticles={adminArticles}
              onLogout={() => {
                setAdminLoggedIn(false);
                localStorage.removeItem('nutriAdminLoggedIn');
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

      {/* Article Reader Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="modal-shell fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={MODAL_BACKDROP_CLASS} onClick={closeArticle} />
            <motion.div
              initial={{ y: '100%', scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: '100%', scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag={typeof window !== 'undefined' && window.innerWidth < 768 ? "y" : false}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={handleArticleDragEnd}
              style={{ y: articleY }}
              className="modal-panel relative bg-paper md:max-w-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
            >
              <div className="w-12 h-1.5 bg-line rounded-full mx-auto mt-4 mb-2 md:hidden" />
              <div className="overflow-y-auto flex-1 p-6 sm:p-10 pb-28">
                <div className="flex justify-between items-center mb-4">
                  <span className="label-sm text-accent tracking-[0.2em]">{selectedArticle.type}</span>
                  <button onClick={closeArticle} className="w-10 h-10 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <h2 className="display-title text-3xl sm:text-4xl mb-6 leading-tight">{selectedArticle.title}</h2>
                <div className="mask-image-full mb-6 overflow-hidden rounded-[2rem] shadow-md h-52 sm:h-72">
                  <img src={selectedArticle.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="prose prose-lg max-w-none text-ink/90 space-y-4">
                  {(selectedArticle.content || [selectedArticle.summary]).map((paragraph: string, index: number) => (
                    <p key={index} className={index === 0 ? 'drop-cap serif-body text-xl sm:text-2xl leading-relaxed mb-6 font-normal' : 'text-base sm:text-lg leading-relaxed font-medium text-ink/85'}>
                      {paragraph}
                    </p>
                  ))}
                  {selectedArticle.sourceLabel && (
                    <div className="mt-8 rounded-2xl border border-line bg-white p-4 text-xs leading-relaxed text-ink/65">
                      <span className="label-sm text-accent">Fonte & Referência</span>
                      {selectedArticle.sourceUrl ? (
                        <a href={selectedArticle.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block font-bold text-accent hover:underline">{selectedArticle.sourceLabel}</a>
                      ) : <p className="mt-1 font-bold">{selectedArticle.sourceLabel}</p>}
                    </div>
                  )}
                </div>
                <button onClick={closeArticle} className="mt-10 w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-xl hover:bg-accent/90">
                  Concluir Leitura Consciente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
  onComplete: (profile: UserProfile) => void;
  onBack: () => void;
  onOpenHungerModal: () => void;
}) {
  const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);
  const [errorMsg, setErrorMsg] = useState('');

  const steps = [
    { id: 'name', title: "Como prefere ser chamado?", subtitle: "Sua identidade é essencial para nós.", type: 'input', field: 'name', placeholder: 'Seu nome ou apelido' },
    { id: 'gender', title: "Como você se identifica?", subtitle: "Escolha a opção que melhor representa você.", type: 'options', field: 'gender', options: ["Mulher", "Homem", "Não Binário(a)", "Outro", "Prefiro não informar"] },
    { id: 'basics', title: "Sobre sua rotina", subtitle: "Esses dados ajudam a personalizar seu cuidado com gentileza.", type: 'basic', options: [
      { label: "Sedentário (pouco ou nenhum exercício)", value: 1.2 },
      { label: "Levemente ativo (exercício leve 1-3 dias/sem)", value: 1.375 },
      { label: "Moderadamente ativo (exercício 3-5 dias/sem)", value: 1.55 },
      { label: "Muito ativo (exercício pesado 6-7 dias/sem)", value: 1.725 }
    ]},
    { id: 'emotions', title: "Como você se sente ultimamente?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'initialEmotions', options: ["Estressado(a)", "Frustrado(a)", "Deprimido(a)", "Solitário(a)", "Ansioso(a)", "Raivoso(a)", "Alegre", "Animado(a)", "Calmo(a)", "Outro"] },
    { id: 'comorbidities', title: "Você possui alguma condição de saúde?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'comorbidities', options: ["Não possuo nenhuma condição", "Sou diabético(a)", "Sou hipertenso(a)", "Tenho alterações da tireoide", "Tenho transtornos emocionais", "Outro"] },
    { id: 'triggers', title: "Quais emoções você costuma sentir antes de comer sem fome física?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'triggers', options: ["Tédio", "Cansaço", "Raiva", "Tristeza", "Ansiedade", "Alegria", "Outro"], hasHelpGuide: true },
    { id: 'foods', title: "Quando sente vontade de comer por causa das suas emoções, quais alimentos procura?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'foods', options: ["Doces", "Salgados", "Massas", "Salgadinhos", "Fast food", "Outro"] },
    { id: 'objectives', title: "Qual é o seu principal objetivo com este aplicativo?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'objectives', options: ["Emagrecimento consciente", "Melhorar a relação com a comida", "Ganho de peso", "Hipertrofia", "Cuidar da minha saúde", "Outro"] },
    { id: 'measurements', title: "Suas medidas iniciais", subtitle: "Para personalizar suas necessidades com acolhimento.", type: 'measurements' }
  ];

  const current = steps[step] || steps[0];

  const handleNext = () => {
    setErrorMsg('');
    if (current.type === 'input' && !tempProfile.name?.trim()) {
      setErrorMsg('Por favor, informe seu nome.');
      return;
    }
    if (current.type === 'basic') {
      if (!tempProfile.age || tempProfile.age < 10) {
        setErrorMsg('Informe uma idade válida para continuar.');
        return;
      }
    }
    if (current.type === 'measurements') {
      const initialWeight = tempProfile.weightEvolution?.[0]?.value || 0;
      if (!tempProfile.height || initialWeight <= 0) {
        setErrorMsg('Preencha altura e peso para continuar.');
        return;
      }
      const result = calculateNutritionalNeeds(
        initialWeight,
        tempProfile.height,
        tempProfile.age || 25,
        tempProfile.gender || 'Feminino',
        tempProfile.activityLevel || 1.2,
        tempProfile.objectives
      );
      const finalProfile = withProfileCompletionState({ ...tempProfile, ...result });
      onComplete(finalProfile);
      return;
    }

    if (step < steps.length - 1) {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-28 max-w-xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-line transition-colors">
          <ArrowLeft size={20} className="text-ink" />
        </button>
        <div className="flex-1 h-2.5 bg-line rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent to-accent-pink"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-ink/40">{step + 1}/{steps.length}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="display-title text-3xl sm:text-4xl">{current.title}</h2>
          {current.hasHelpGuide && (
            <button
              type="button"
              onClick={onOpenHungerModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20"
            >
              <HelpCircle size={14} /> Diferenciar Fomes
            </button>
          )}
        </div>
        <p className="serif-body text-lg text-ink/65">{current.subtitle}</p>
      </div>

      <div className="pt-2">
        {errorMsg && <p className="text-red-500 font-bold mb-4 text-sm bg-red-50 p-3 rounded-xl border border-red-200">{errorMsg}</p>}

        {current.type === 'input' && (
          <div className="space-y-6">
            <input
              type="text"
              placeholder={current.placeholder}
              className="w-full py-4 bg-transparent border-b-2 border-ink focus:border-accent focus:outline-none text-2xl font-medium"
              value={tempProfile.name}
              onChange={(e) => { setTempProfile({ ...tempProfile, name: e.target.value }); setErrorMsg(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              autoFocus
            />
            <button
              onClick={handleNext}
              className={`w-full py-5 text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-md transition-all ${tempProfile.name ? 'bg-accent hover:bg-accent/90 active:scale-95' : 'bg-ink/30 cursor-not-allowed'}`}
            >
              Continuar
            </button>
          </div>
        )}

        {current.type === 'options' && (
          <div className="space-y-3">
            {(current.options as string[] | undefined)?.map((opt: string) => {
              const isOther = opt === 'Outro';
              const isSelected = tempProfile[current.field as keyof UserProfile] === opt || (isOther && String(tempProfile[current.field as keyof UserProfile]).startsWith('Outro:'));
              return (
                <div key={opt} className="space-y-2">
                  <button
                    onClick={() => {
                      if (isOther) {
                        setTempProfile({ ...tempProfile, [current.field!]: 'Outro: ' });
                      } else {
                        setTempProfile({ ...tempProfile, [current.field!]: opt });
                        setTimeout(handleNext, 120);
                      }
                    }}
                    className={`w-full p-5 text-left border-2 rounded-2xl font-bold text-base sm:text-lg transition-all ${isSelected ? 'border-accent bg-accent/10 text-accent shadow-xs' : 'border-line hover:border-accent hover:bg-accent/5'}`}
                  >
                    {opt}
                  </button>
                  {isOther && isSelected && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Especifique..."
                        className="flex-1 p-3 rounded-xl border-2 border-line bg-white focus:border-accent focus:outline-none text-sm font-medium"
                        value={String(tempProfile[current.field as keyof UserProfile]).replace(/^Outro:\s*/, '')}
                        onChange={(e) => setTempProfile({ ...tempProfile, [current.field!]: `Outro: ${e.target.value}` })}
                        autoFocus
                      />
                      <button onClick={handleNext} className="px-5 py-3 bg-accent text-paper rounded-xl font-bold text-xs uppercase shadow-sm">
                        Ok
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {current.type === 'basic' && (
          <div className="space-y-6">
            <div>
              <label className="label-sm text-accent mb-2 block">Qual é a sua idade?</label>
              <input
                type="number"
                placeholder="Ex: 28"
                className="w-full py-3 bg-transparent border-b-2 border-ink focus:border-accent focus:outline-none text-2xl font-bold"
                value={tempProfile.age || ''}
                onChange={(e) => { setTempProfile({ ...tempProfile, age: parseFloat(e.target.value) || 0 }); setErrorMsg(''); }}
              />
            </div>
            <div>
              <label className="label-sm text-accent mb-3 block">Como é sua rotina de atividade física?</label>
              <div className="grid gap-2">
                {(current.options as Array<{ label: string; value: number }> | undefined)?.map((opt: any) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setTempProfile({ ...tempProfile, activityLevel: opt.value })}
                    className={`w-full rounded-2xl border-2 p-4 text-left text-sm font-medium transition-colors ${tempProfile.activityLevel === opt.value ? 'border-accent bg-accent/10 text-accent shadow-xs' : 'border-line hover:border-accent'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleNext} className={`w-full py-5 text-paper rounded-full font-bold uppercase tracking-widest text-sm transition-all ${tempProfile.age ? 'bg-accent hover:bg-accent/90 active:scale-95 shadow-md' : 'bg-ink/30 cursor-not-allowed'}`}>
              Continuar
            </button>
          </div>
        )}

        {current.type === 'multiselect' && (
          <div className="space-y-6">
            <div className="grid gap-3">
              {(current.options as string[] | undefined)?.map((opt: string) => {
                const isOther = opt.startsWith('Outro');
                const arr = (tempProfile[current.field as keyof UserProfile] as string[]) || [];
                const selected = arr.includes(opt) || (isOther && arr.some(i => i.startsWith('Outro')));

                return (
                  <div key={opt}>
                    <button
                      type="button"
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
                      className={`w-full p-4 sm:p-5 text-left border-2 rounded-2xl font-bold text-base transition-all ${selected ? 'border-accent bg-accent text-paper shadow-sm' : 'border-line hover:border-accent bg-white/70'}`}
                    >
                      {opt}
                    </button>
                    {isOther && selected && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Descreva aqui..."
                          className="w-full p-3 border-2 border-line rounded-xl bg-white focus:border-accent outline-none font-medium text-sm"
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
            <button onClick={handleNext} className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-md hover:bg-accent/90 active:scale-95 transition-all">
              Confirmar Escolhas
            </button>
          </div>
        )}

        {current.type === 'measurements' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-line">
                <label className="label-sm text-accent mb-1 block">Altura (cm)</label>
                <input
                  type="number"
                  placeholder="Ex: 170"
                  className="w-full py-2 border-b-2 border-line focus:border-accent bg-transparent text-2xl font-bold outline-none"
                  onChange={(e) => { setTempProfile({ ...tempProfile, height: parseFloat(e.target.value) || 0 }); setErrorMsg(''); }}
                />
              </div>
              <div className="bg-white p-5 rounded-2xl border border-line">
                <label className="label-sm text-accent mb-1 block">Peso Atual (kg)</label>
                <input
                  type="number"
                  placeholder="Ex: 70.5"
                  className="w-full py-2 border-b-2 border-line focus:border-accent bg-transparent text-2xl font-bold outline-none"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    setTempProfile({
                      ...tempProfile,
                      weightEvolution: [{ date, value: val }]
                    });
                    setErrorMsg('');
                  }}
                />
              </div>
            </div>

            <div className="p-4 bg-accent/10 border border-accent/20 rounded-2xl flex gap-3 items-center">
              <Sparkles className="text-accent shrink-0" size={22} />
              <p className="text-xs font-medium text-ink/75 leading-relaxed">
                Sua altura e peso nos ajudam a calibrar estimativas de energia de forma acolhedora e privativa.
              </p>
            </div>

            <button onClick={handleNext} className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg hover:bg-accent/90 active:scale-95 transition-all">
              Finalizar e Acessar Meu Espaço
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardPage({
  userProfile,
  loggedMeals,
  onNavigate,
  onOpenTutorial,
  onOpenDiary,
  onOpenSleep,
  onMoodShared,
  onSelectMeal,
  toast
}: {
  userProfile: UserProfile;
  loggedMeals: any[];
  onNavigate: (page: Page) => void;
  onOpenTutorial: () => void;
  onOpenDiary: () => void;
  onOpenSleep: () => void;
  onMoodShared: (mood: string) => void;
  onSelectMeal: (meal: any) => void;
  toast: any;
}) {
  const [quoteIndex, setQuoteIndex] = useState(0);
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

  const awarenessScore = calculateAwarenessScore(userProfile, loggedMeals);
  const firstName = userProfile.name?.trim().split(/\s+/)[0] || 'você';
  const latestMood = userProfile.checkIns?.[userProfile.checkIns.length - 1]?.mood;
  const latestSleep = userProfile.sleepLogs?.[0];

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [quotes.length]);

  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-24 md:pt-28 pb-28 max-w-6xl mx-auto space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="label-sm text-accent">Mind Nutrition</p>
          <h2 className="serif-body text-2xl md:text-3xl text-ink/80 mt-1">
            {userProfile.name ? `Espaço de ${firstName}` : 'Seu Espaço de Cuidado'}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenTutorial}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-line text-xs font-bold text-ink/70 hover:border-accent hover:text-accent shadow-2xs"
          >
            <Compass size={15} /> Guia Rápido
          </button>
        </div>
      </header>

      {/* Mascote Interactive Bubble */}
      <MascotBubble
        userProfile={userProfile}
        onShowToast={toast}
        onMoodShared={onMoodShared}
      />

      {/* Quick Action: Pause & Log above cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => onNavigate('meal-log')}
          className="group flex items-center justify-between p-5 rounded-[2rem] bg-accent text-paper shadow-lg hover:bg-accent/95 active:scale-98 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <PlusCircle size={26} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg">Fazer Pausa & Registrar Refeição</h3>
              <p className="text-xs text-paper/80 font-medium">Observe fome, saciedade e humor agora</p>
            </div>
          </div>
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={onOpenDiary}
          className="group flex items-center justify-between p-5 rounded-[2rem] bg-white border border-line shadow-sm hover:border-accent active:scale-98 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-pink/15 text-accent-pink flex items-center justify-center">
              <PenTool size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg text-ink">Diário do Dia</h3>
              <p className="text-xs text-ink/50 font-medium">Anote sentimentos e acontecimentos livres</p>
            </div>
          </div>
          <ArrowRight size={20} className="text-ink/40 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Card Reflexão do Dia & Status */}
      <section className="mobile-card-padding animated-gradient p-6 md:p-10 rounded-[2rem] shadow-lg relative overflow-hidden text-paper">
        <Sparkles className="absolute -right-4 -top-4 text-paper/20 w-32 h-32 spin-slow" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-center">
          <div>
            <h3 className="label-sm mb-3 glass-badge font-bold inline-block">Reflexão do dia</h3>
            <div className="min-h-[5.5rem] flex items-center">
              <AnimatePresence mode="wait">
                <motion.p key={quoteIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }} className="serif-body text-xl md:text-2xl leading-relaxed drop-shadow-sm">
                  “{quotes[quoteIndex]}”
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('progress')}
            className="rounded-[1.75rem] border border-white/30 bg-white/15 p-5 backdrop-blur-md text-left transition-transform hover:scale-[1.02] active:scale-98"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-paper/80 uppercase">Hoje, {firstName}</p>
              <ChevronRight size={16} className="text-paper/70" />
            </div>
            <p className="mt-1.5 text-lg font-bold truncate">{latestMood ? `Humor registrado: ${latestMood}` : 'Toque para ver seus sinais da jornada'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-black/10 p-2.5"><span className="block text-xl font-bold">{loggedMeals.length}</span><span className="text-[9px] font-bold uppercase tracking-wide text-paper/70">refeições</span></div>
              <div className="rounded-xl bg-black/10 p-2.5"><span className="block text-xl font-bold">{awarenessScore}%</span><span className="text-[9px] font-bold uppercase tracking-wide text-paper/70">consciência</span></div>
            </div>
          </button>
        </div>
      </section>

      {/* Quick Hub Grid */}
      <section className="grid gap-4 sm:grid-cols-3">
        <button onClick={() => onNavigate('progress')} className="group rounded-[1.75rem] border border-line bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><TrendingUp size={20} /></span>
          <h3 className="mt-4 font-bold text-base">Sinais da Jornada</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink/55">Gráficos de evolução, fontes de fome e radar de consciência.</p>
        </button>
        <button onClick={onOpenSleep} className="group rounded-[1.75rem] border border-line bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Moon size={20} /></span>
          <h3 className="mt-4 font-bold text-base">Cuidar do Sono</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink/55">
            {latestSleep ? `${latestSleep.hours}h de sono (${latestSleep.quality}) registrado.` : 'Registre seu descanso e veja o impacto no apetite.'}
          </p>
        </button>
        <button onClick={() => onNavigate('content')} className="group rounded-[1.75rem] border border-line bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-pink/15 text-accent-pink"><BookOpen size={20} /></span>
          <h3 className="mt-4 font-bold text-base">Biblioteca Científica</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink/55">Artigos acolhedores sobre nutrição gentil e autocompaixão.</p>
        </button>
      </section>

      {/* Entradas de Hoje */}
      <section>
        <div className="responsive-page-header mb-4">
          <div className="flex items-center gap-2.5">
            <Coffee size={20} className="text-accent" />
            <h3 className="label-sm text-accent">Entradas de Hoje</h3>
          </div>
          {loggedMeals.length > 0 && (
            <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full">{loggedMeals.length} registros</span>
          )}
        </div>
        <div className="bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm">
          {loggedMeals.length === 0 ? (
            <div className="p-10 text-center">
              <Coffee size={44} className="text-ink/20 mx-auto mb-3" />
              <p className="serif-body text-xl text-ink/60 mb-2">Nenhuma refeição registrada ainda</p>
              <p className="text-xs text-ink/45 mb-6 max-w-sm mx-auto">Comece a registrar suas refeições para acompanhar sua fome, saciedade e sentimentos.</p>
              <button onClick={() => onNavigate('meal-log')} className="bg-accent text-paper px-6 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-accent/90 active:scale-95 transition-all">
                Registrar Primeira Refeição
              </button>
            </div>
          ) : (
            loggedMeals.slice(0, 8).map((meal: any, i: number) => {
              const mealType = inferMealType(meal);
              const MealIcon = mealType === 'Física' ? TbHealthRecognition : mealType === 'Emocional' ? PiHeartbeat : Coffee;
              return (
                <div
                  key={meal.id || i}
                  onClick={() => onSelectMeal(meal)}
                  className="p-4 sm:px-6 border-b border-line last:border-0 flex items-center justify-between gap-3 hover:bg-accent/5 transition-colors cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    {meal.photos?.[0] || meal.image ? (
                      <img src={meal.photos?.[0] || meal.image} alt="" className="w-12 h-12 rounded-2xl object-cover border border-line shrink-0" />
                    ) : (
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${mealType === 'Emocional' ? 'bg-accent-pink/20 text-accent-pink' : 'bg-accent/10 text-accent'}`}>
                        <MealIcon size={22} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate font-bold text-base">{meal.title || 'Refeição'}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${mealType === 'Emocional' ? 'bg-accent-pink/15 text-accent-pink' : 'bg-accent/15 text-accent'}`}>
                          {mealType}
                        </span>
                      </div>
                      <p className="text-xs text-ink/50 font-medium mt-0.5">
                        {meal.time || new Date(meal.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Satisfação: {meal.satisfaction ?? 4}/5 • {meal.postMood || meal.preMood || 'Neutro'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-ink/30 shrink-0" />
                </div>
              );
            })
          )}
        </div>
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
                className={`h-10 w-10 rounded-full border text-sm font-bold transition-all active:scale-95 ${appRating === rating ? 'border-accent bg-accent text-paper shadow-xs' : 'border-line bg-paper text-ink/60 hover:border-accent'}`}
                aria-label={`${rating} estrelas`}
              >
                {rating}★
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MealLogPage({
  onSaveMeal,
  onNavigate,
  onOpenHungerModal,
  toast
}: {
  onSaveMeal: (meal: any) => void;
  onNavigate: (page: Page) => void;
  onOpenHungerModal: () => void;
  toast: any;
}) {
  const [step, setStep] = useState<'pre' | 'meal' | 'post'>('pre');
  const [log, setLog] = useState<{
    title: string;
    preHunger: number;
    preMood: string;
    postHunger: number;
    postMood: string;
    satisfaction: number;
    notes: string;
    photos: string[];
  }>({
    title: 'Refeição',
    preHunger: 5,
    preMood: 'Neutro',
    postHunger: 5,
    postMood: 'Neutro',
    satisfaction: 4,
    notes: '',
    photos: []
  });

  const handleMealPhotos = async (files: FileList | null) => {
    const result = await readValidatedImages(files, log.photos.length);
    if (result.error) {
      toast(result.error, 'error');
      return;
    }
    if (result.images.length) {
      setLog(prev => ({ ...prev, photos: [...prev.photos, ...result.images] }));
      toast('Foto adicionada!', 'success');
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

  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-28 max-w-2xl mx-auto space-y-8">
      <header className="flex items-center gap-4 border-b border-line pb-6">
        <button
          type="button"
          onClick={() => {
            if (step === 'pre') onNavigate('dashboard');
            else if (step === 'meal') setStep('pre');
            else if (step === 'post') setStep('meal');
          }}
          className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors"
          aria-label="Voltar etapa"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <span className="label-sm text-accent">Passo {step === 'pre' ? '1 de 3' : step === 'meal' ? '2 de 3' : '3 de 3'}</span>
          <h2 className="display-title text-3xl sm:text-4xl">
            {step === 'pre' ? 'Pré-refeição' : step === 'meal' ? 'A Refeição' : 'Pós-refeição'}
          </h2>
        </div>
      </header>

      <div className="space-y-8">
        {/* STEP 1: PRÉ-REFEIÇÃO */}
        {step === 'pre' && (
          <>
            <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg">De onde vem sua fome?</h3>
                  <p className="text-xs text-ink/55 mt-0.5">Avalie seu nível corporal de 0 (sem fome física) a 10 (fome intensa).</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenHungerModal}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/20 transition-colors shrink-0"
                >
                  <HelpCircle size={15} /> Diferenciar Fomes
                </button>
              </div>
              <div className="pt-4">
                <HungerOdometer value={log.preHunger} onChange={v => setLog({ ...log, preHunger: v })} />
              </div>
            </div>

            <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-lg mb-1">Como você está se sentindo agora?</h3>
              <p className="text-xs text-ink/55 mb-4">Reconhecer suas emoções antes da refeição acalma a mente.</p>
              <div className="mood-grid">
                {moods.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setLog({ ...log, preMood: m.label })}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all ${log.preMood === m.label ? 'border-accent bg-accent/10 text-accent font-bold shadow-2xs' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}
                  >
                    <m.icon size={22} />
                    <span className="text-[10px] font-bold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep('meal')}
              className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg hover:bg-accent/90 active:scale-98 transition-all"
            >
              Iniciar Refeição (Passo 2)
            </button>
          </>
        )}

        {/* STEP 2: A REFEIÇÃO */}
        {step === 'meal' && (
          <>
            <div className="bg-white border border-line p-6 rounded-[2rem] shadow-sm">
              <label className="label-sm text-accent mb-2 block">Nome da Refeição:</label>
              <input
                type="text"
                value={log.title}
                onChange={(e) => setLog({ ...log, title: e.target.value })}
                placeholder="Ex: Almoço com a família, Lanche da tarde..."
                className="w-full py-2 bg-transparent border-b-2 border-line focus:border-accent text-lg font-bold outline-none"
              />
            </div>

            <div className="meal-photo-actions w-full grid grid-cols-2 gap-4">
              <label className="aspect-video rounded-[2rem] border-2 border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center gap-2 text-accent hover:bg-accent/10 active:scale-95 transition-all cursor-pointer relative overflow-hidden">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => { handleMealPhotos(e.target.files); e.target.value = ''; }}
                />
                <Camera size={28} />
                <span className="font-bold text-xs sm:text-sm">Tirar Foto</span>
              </label>

              <label className="aspect-video rounded-[2rem] border-2 border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center gap-2 text-accent hover:bg-accent/10 active:scale-95 transition-all cursor-pointer relative overflow-hidden">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => { handleMealPhotos(e.target.files); e.target.value = ''; }}
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
                <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full">{log.photos.length}/{MAX_MEAL_PHOTOS}</span>
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
                      <button
                        type="button"
                        onClick={() => setLog(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }))}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/80 text-paper flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-line p-5 rounded-[2rem]">
              <label className="label-sm text-accent mb-2 block">O que você está comendo?</label>
              <textarea
                placeholder="Descreva o prato, os sabores, texturas ou como está seu ritmo ao comer..."
                className="w-full h-28 bg-transparent text-sm font-medium resize-none focus:outline-none"
                value={log.notes}
                onChange={e => setLog({ ...log, notes: e.target.value })}
              />
            </div>

            <button
              type="button"
              onClick={() => setStep('post')}
              className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg hover:bg-accent/90 active:scale-98 transition-all"
            >
              Próximo: Pós-refeição (Passo 3)
            </button>
          </>
        )}

        {/* STEP 3: PÓS-REFEIÇÃO */}
        {step === 'post' && (
          <>
            <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-lg mb-1">Reavalie sua fome (Saciedade)</h3>
              <p className="text-xs text-ink/55 mb-4">Como seu estômago está se sentindo agora?</p>
              <HungerOdometer value={log.postHunger} onChange={v => setLog({ ...log, postHunger: v })} />
            </div>

            <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-lg mb-1">Como você se sente após comer?</h3>
              <p className="text-xs text-ink/55 mb-4">Avalie o quanto esta refeição atendeu às suas necessidades físicas.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setLog({ ...log, satisfaction: val })}
                    className={`min-h-18 rounded-2xl border-2 p-3 text-left transition-all ${log.satisfaction === val ? 'bg-accent border-accent text-paper shadow-sm' : 'border-line bg-white hover:border-accent'}`}
                  >
                    <span className="block text-xl font-bold">{val}</span>
                    <span className="mt-0.5 block text-xs font-bold leading-tight">{satisfactionDescriptions[val]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-lg mb-1">Seu humor após a refeição:</h3>
              <div className="mood-grid mt-3">
                {moods.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setLog({ ...log, postMood: m.label })}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all ${log.postMood === m.label ? 'border-accent bg-accent/10 text-accent font-bold shadow-2xs' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}
                  >
                    <m.icon size={22} />
                    <span className="text-[10px] font-bold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const inferredType = inferMealType(log);
                const newMeal = {
                  ...log,
                  id: Date.now().toString(),
                  title: log.title?.trim() || 'Refeição',
                  date: new Date().toISOString(),
                  time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                  type: inferredType,
                  inferredType,
                  mood: log.postMood || log.preMood,
                  hungerDelta: log.postHunger - log.preHunger,
                  image: log.photos[0] || ''
                };
                onSaveMeal(newMeal);
              }}
              className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-xl hover:bg-accent/90 active:scale-98 transition-all"
            >
              Salvar Registro da Refeição
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ContentPageComponent({
  onSelectArticle,
  onNavigate
}: {
  onSelectArticle: (article: any) => void;
  onNavigate: (page: Page) => void;
}) {
  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-24 md:pt-28 pb-28 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('dashboard')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="display-title text-4xl sm:text-5xl">Biblioteca.</h2>
          <p className="serif-body text-lg text-ink/60 mt-0.5">Conhecimento científico e acolhedor.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {DEFAULT_LIBRARY_ARTICLES.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectArticle(item)}
            className="group text-left bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
          >
            <div className="h-44 w-full relative overflow-hidden bg-line">
              <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                <Library size={14} /> {item.duration} de leitura
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressPageComponent({
  userProfile,
  loggedMeals,
  onNavigate,
  onSaveProfile,
  toast
}: {
  userProfile: UserProfile;
  loggedMeals: any[];
  onNavigate: (page: Page) => void;
  onSaveProfile: (profile: UserProfile) => void;
  toast: any;
}) {
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [newMetrics, setNewMetrics] = useState({
    weight: userProfile.weightEvolution?.[userProfile.weightEvolution.length - 1]?.value || 0,
    waist: userProfile.waistEvolution?.[userProfile.waistEvolution.length - 1]?.value || 0,
    arm: userProfile.armEvolution?.[userProfile.armEvolution.length - 1]?.value || 0,
    abdomen: userProfile.abdomenEvolution?.[userProfile.abdomenEvolution.length - 1]?.value || 0,
    hip: userProfile.hipEvolution?.[userProfile.hipEvolution.length - 1]?.value || 0,
  });

  const metricFields = [
    { key: 'weight', label: 'Peso', unit: 'kg', icon: TbHealthRecognition, hint: 'Registre em condições parecidas para comparar a evolução.' },
    { key: 'waist', label: 'Cintura', unit: 'cm', icon: Activity, hint: 'Use uma fita flexível, sem apertar a pele.' },
    { key: 'abdomen', label: 'Abdômen', unit: 'cm', icon: PiHeartbeat, hint: 'Meça de pé, ao final de uma expiração confortável.' },
    { key: 'hip', label: 'Quadril', unit: 'cm', icon: TrendingUp, hint: 'Passe a fita pela região mais larga do quadril.' },
  ] as const;

  const handleSaveMetrics = () => {
    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const updatedProfile = { ...userProfile };
    
    const updateEvolution = (key: 'weightEvolution' | 'waistEvolution' | 'armEvolution' | 'abdomenEvolution' | 'hipEvolution', val: number) => {
      if (val <= 0) return;
      const arr = (updatedProfile[key] as any[]) || [];
      (updatedProfile[key] as any) = sortMetricsChronologically([...arr, { date, value: val }]);
    };

    updateEvolution('weightEvolution', newMetrics.weight);
    updateEvolution('waistEvolution', newMetrics.waist);
    updateEvolution('armEvolution', newMetrics.arm);
    updateEvolution('abdomenEvolution', newMetrics.abdomen);
    updateEvolution('hipEvolution', newMetrics.hip);

    if (updatedProfile.height && newMetrics.weight) {
      const recalculated = calculateNutritionalNeeds(
        newMetrics.weight,
        updatedProfile.height,
        updatedProfile.age || 25,
        updatedProfile.gender || 'Feminino',
        updatedProfile.activityLevel || 1.2,
        updatedProfile.objectives || []
      );
      updatedProfile.imc = recalculated.imc;
      updatedProfile.tmb = recalculated.tmb;
      updatedProfile.net = recalculated.net;
    }

    onSaveProfile(updatedProfile);
    setShowMetricsModal(false);
    toast('Métricas corporais atualizadas!', 'success');
  };

  const latestWeight = getLatestMetricValue(userProfile.weightEvolution);
  const hasBodyBaseline = Boolean(userProfile.height && latestWeight);
  const profileReadinessScore = calculateProfileInsightScore(userProfile);
  const hasInitialInsightData = Boolean(hasBodyBaseline || profileReadinessScore > 0 || loggedMeals.length);
  const mealTypes = loggedMeals.map((meal: any) => inferMealType(meal));
  const physicalMeals = mealTypes.filter(type => type === 'Física').length;
  const emotionalMeals = mealTypes.filter(type => type === 'Emocional').length;
  const unclassifiedMeals = Math.max(loggedMeals.length - physicalMeals - emotionalMeals, 0);
  const awarenessScore = calculateAwarenessScore(userProfile, loggedMeals);
  const radarData = buildRadarData(userProfile, loggedMeals, awarenessScore);
  const weightGoal = getWeightGoal(userProfile);

  const sortedWeightEvolution = sortMetricsChronologically(userProfile.weightEvolution);
  const imcData = sortedWeightEvolution.map(w => ({
    date: w.date,
    value: userProfile.height ? parseFloat((w.value / Math.pow(userProfile.height / 100, 2)).toFixed(1)) : 0
  })).filter(item => item.value > 0);

  const hasWeightData = sortedWeightEvolution.length > 0;
  const hasImcData = imcData.length > 0;

  // Filter only categories with counts > 0 for clean Pie chart
  const hungerPieData = [
    { name: 'Fome Física', value: physicalMeals, color: '#6BAF9E' },
    { name: 'Fome Emocional', value: emotionalMeals, color: '#C9A3B5' },
    { name: 'Não classificada', value: unclassifiedMeals, color: '#5A9485' },
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

  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-24 md:pt-28 pb-28 max-w-6xl mx-auto space-y-10">
      <div className="responsive-page-header">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="display-title text-4xl sm:text-5xl">Insights.</h2>
            <p className="serif-body text-lg text-ink/60 mt-0.5">Sinais do seu comportamento alimentar.</p>
          </div>
        </div>
        <button onClick={() => setShowMetricsModal(true)} className="bg-accent text-paper px-6 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-accent/90 active:scale-95 transition-all inline-flex items-center gap-2">
          <PlusCircle size={18} /> Adicionar Medidas
        </button>
      </div>

      {/* Sinais da sua jornada (Radar) & Consciência */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="mobile-card-padding animated-gradient text-paper p-8 rounded-[2.5rem] shadow-lg flex flex-col justify-center lg:col-span-1">
          <h3 className="label-sm text-paper mb-3 glass-badge font-bold inline-block self-start">Consciência Geral</h3>
          <div className="text-6xl sm:text-7xl font-display mb-2 text-paper drop-shadow-md">{awarenessScore}%</div>
          <p className="text-xs sm:text-sm font-medium text-paper/90 leading-relaxed">
            {loggedMeals.length
              ? 'Calculado a partir da atenção à saciedade, notas, fotos e consistência das refeições.'
              : 'Complete o perfil ou registre refeições para refinar sua pontuação.'}
          </p>
        </div>

        <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2.5rem] shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="text-accent"><Brain size={20} /></span> Sinais da sua jornada
            </h3>
            <button type="button" onClick={() => toast('O radar equilibra Saciedade, Consciência, Energia, Humor, Constância e Contexto.', 'info')} className="text-xs text-accent font-bold flex items-center gap-1">
              <Info size={14} /> Entender Eixos
            </button>
          </div>
          <p className="mb-4 text-xs sm:text-sm leading-relaxed text-ink/55">
            Representação multidimensional do seu bem-estar alimentar.
          </p>
          {hasInitialInsightData ? (
            <ChartFrame className="h-64" minHeight={180}>
              {({ width, height }) => (
                <RadarChart width={width} height={height} cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 600 }} />
                  <Radar name="Atual" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} isAnimationActive />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Nível']} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 12px 30px rgba(0,0,0,0.12)' }} />
                </RadarChart>
              )}
            </ChartFrame>
          ) : (
            <div className="min-h-56 rounded-3xl border border-dashed border-line bg-paper/60 p-6 flex flex-col justify-center text-center">
              <p className="font-bold text-base">Complete seus dados para liberar o radar de jornada.</p>
            </div>
          )}
        </div>
      </div>

      {/* Gráficos de Evolução (Peso e IMC com ordenação cronológica) */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
          <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <span className="text-accent"><TbHealthRecognition size={22} /></span> Evolução do Peso
            </h3>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-ink/60">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" /> Histórico
              </span>
              {weightGoal && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-accent-pink">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-pink" /> Meta ({weightGoal}kg)
                </span>
              )}
            </div>
          </div>
          <p className="mb-4 text-xs text-ink/50 leading-relaxed">
            Datas em ordem cronológica (antigas à esquerda, mais recente à direita).
          </p>
          {hasWeightData ? (
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
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dx={-6} />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' }} formatter={(val: number) => [`${val} kg`, 'Peso']} />
                  {weightGoal && (
                    <ReferenceLine y={weightGoal} stroke="var(--accent-pink)" strokeDasharray="4 4" strokeWidth={2} />
                  )}
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={4} fill="url(#weightGrad)" dot={{ r: 5, fill: 'var(--paper)', stroke: 'var(--accent)', strokeWidth: 2.5 }} />
                </AreaChart>
              )}
            </ChartFrame>
          ) : (
            <div className="min-h-56 rounded-3xl bg-paper/60 border border-dashed border-line p-6 flex flex-col justify-center text-center">
              <p className="font-bold text-sm text-ink/60">Adicione seu peso para acompanhar a evolução corporal.</p>
            </div>
          )}
        </div>

        <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
          <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <span className="text-accent-pink"><Activity size={22} /></span> Evolução do IMC
            </h3>
            <span className="text-[10px] font-bold uppercase text-ink/40">Triagem indicativa</span>
          </div>
          <p className="mb-4 text-xs text-ink/50 leading-relaxed">
            Calculado a partir de altura e peso ao longo do tempo.
          </p>
          {hasImcData ? (
            <ChartFrame className="h-60" minHeight={170}>
              {({ width, height }) => (
                <AreaChart width={width} height={height} data={imcData}>
                  <defs>
                    <linearGradient id="imcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-pink)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent-pink)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dy={6} />
                  <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dx={-6} />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' }} formatter={(val: number) => [`${val}`, 'IMC']} />
                  <ReferenceLine y={24.9} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="value" stroke="var(--accent-pink)" strokeWidth={4} fill="url(#imcGrad)" dot={{ r: 5, fill: 'var(--paper)', stroke: 'var(--accent-pink)', strokeWidth: 2.5 }} />
                </AreaChart>
              )}
            </ChartFrame>
          ) : (
            <div className="min-h-56 rounded-3xl bg-paper/60 border border-dashed border-line p-6 flex flex-col justify-center text-center">
              <p className="font-bold text-sm text-ink/60">Informe altura e peso para calcular a curva de IMC.</p>
            </div>
          )}
        </div>
      </div>

      {/* Gráficos de Fome & Oscilação Semanal */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
          <h3 className="font-bold text-base sm:text-lg mb-1 flex items-center gap-2">
            <span className="text-accent"><Zap size={20} /></span> Fontes de Fome
          </h3>
          <p className="mb-4 text-xs text-ink/50">Proporção entre refeições biológicas e emocionais.</p>
          {hasMealData && hungerPieData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ChartFrame className="h-44 w-full sm:w-1/2" minHeight={140}>
                {({ width, height }) => (
                  <PieChart width={width} height={height}>
                    <Pie data={hungerPieData} innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value" isAnimationActive>
                      {hungerPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number, name: string) => [`${val} (${Math.round((val / loggedMeals.length) * 100)}%)`, name]} />
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
            <div className="min-h-44 rounded-3xl bg-paper/60 border border-dashed border-line p-6 flex flex-col justify-center text-center">
              <p className="font-bold text-sm text-ink/60">Registre refeições para calcular suas fontes de fome.</p>
            </div>
          )}
        </div>

        <div className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
          <h3 className="font-bold text-base sm:text-lg mb-1 flex items-center gap-2">
            <span className="text-accent-pink"><PiHeartbeat size={20} /></span> Oscilação Semanal
          </h3>
          <p className="mb-4 text-xs text-ink/50">Distribuição de refeições nos dias da semana.</p>
          {hasMealData ? (
            <>
              <ChartFrame className="h-44" minHeight={140}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={emotionalData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dy={6} />
                    <Tooltip cursor={{ fill: 'var(--line)', opacity: 0.3 }} />
                    <Bar dataKey="fisico" stackId="a" fill="var(--accent)" radius={[0, 0, 4, 4]} barSize={16} name="Fome Física" />
                    <Bar dataKey="emocional" stackId="a" fill="var(--accent-pink)" radius={[4, 4, 0, 0]} barSize={16} name="Fome Emocional" />
                  </BarChart>
                )}
              </ChartFrame>
              <div className="flex justify-center gap-6 mt-3">
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink/70">
                  <div className="w-3 h-3 rounded-full bg-accent" /> Física
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink/70">
                  <div className="w-3 h-3 rounded-full bg-accent-pink" /> Emocional
                </span>
              </div>
            </>
          ) : (
            <div className="min-h-44 rounded-3xl bg-paper/60 border border-dashed border-line p-6 flex flex-col justify-center text-center">
              <p className="font-bold text-sm text-ink/60">Os dados semanais serão exibidos após os primeiros registros.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Métricas Corporais */}
      {showMetricsModal && (
        <div className="modal-shell fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={MODAL_BACKDROP_CLASS} onClick={() => setShowMetricsModal(false)} />
          <div className="modal-panel relative w-full max-w-2xl bg-paper p-6 sm:p-8 shadow-2xl rounded-[2.5rem] border border-line z-10">
            <button type="button" onClick={() => setShowMetricsModal(false)} className="icon-button absolute right-5 top-5 h-10 w-10"><X size={18} /></button>
            <span className="label-sm text-accent">Métricas Corporais</span>
            <h3 className="display-title text-3xl mt-1">Atualizar Medidas</h3>
            <p className="text-xs text-ink/60 mt-1">Insira suas medidas com tranquilidade para acompanhar tendências.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {metricFields.map((field) => (
                <label key={field.key} className="block p-4 rounded-2xl bg-white border border-line">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm">{field.label}</span>
                    <span className="text-xs font-bold text-ink/40">{field.unit}</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={newMetrics[field.key] || ''}
                    onChange={e => setNewMetrics({ ...newMetrics, [field.key]: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full border-b-2 border-line bg-transparent py-1.5 text-xl font-bold outline-none focus:border-accent"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowMetricsModal(false)} className="flex-1 py-4 rounded-full border border-line text-sm font-bold text-ink/60 hover:bg-white">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveMetrics} className="flex-1 py-4 rounded-full bg-accent text-paper text-sm font-bold shadow-md hover:bg-accent/90">
                Salvar Medidas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilePageComponent({
  userProfile,
  onNavigate,
  onOpenDiary,
  toast
}: {
  userProfile: UserProfile;
  onNavigate: (page: Page) => void;
  onOpenDiary: () => void;
  toast: any;
}) {
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

  const profileActions = [
    { label: 'Editar Dados', icon: Edit2, page: 'settings-account' },
    { label: 'Temas do App', icon: Palette, page: 'settings-theme' },
    { label: 'Privacidade', icon: Lock, page: 'settings-privacy' },
    { label: 'Ajuda & Contato', icon: HelpCircle, page: 'settings-help' },
  ];

  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-24 md:pt-28 pb-28 max-w-4xl mx-auto space-y-8">
      <header className="relative overflow-hidden rounded-[2rem] bg-white border border-line p-6 md:p-8 shadow-sm">
        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <div className="relative shrink-0">
            <ProfileAvatar photo={userProfile.photo} size="xl" className="border-4 border-paper shadow-xl" />
            <button
              type="button"
              onClick={() => onNavigate('settings-account')}
              className="absolute -bottom-1 -right-1 w-10 h-10 rounded-2xl bg-accent text-paper flex items-center justify-center shadow-lg border-2 border-white"
            >
              <Camera size={16} />
            </button>
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <span className="label-sm text-accent">Perfil Pessoal</span>
            <h2 className="display-title text-3xl sm:text-4xl mt-1">{userProfile.name || 'Seu Perfil'}</h2>
            <p className="text-xs sm:text-sm font-medium text-ink/55 mt-1">{userProfile.email || 'Dados salvos localmente e na nuvem'}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
              <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold">Gênero: {userProfile.gender || 'Não informado'}</span>
              <span className="px-3 py-1 rounded-full bg-paper border border-line text-ink/70 text-xs font-bold">Idade: {userProfile.age ? `${userProfile.age} anos` : 'Não informada'}</span>
              {(userProfile.objectives || []).slice(0, 2).map((item) => (
                <span key={item} className="px-3 py-1 rounded-full bg-accent-pink/15 text-accent-pink text-xs font-bold">{item}</span>
              ))}
            </div>
          </div>
          <button onClick={() => onNavigate('settings-account')} className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-ink text-paper text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm">
            <Edit2 size={14} /> Editar
          </button>
        </div>
      </header>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-line text-center">
          <span className="text-[10px] font-bold uppercase text-accent block">IMC Atual</span>
          <span className="text-2xl font-display">{userProfile.imc || liveNeeds?.imc || '--'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-line text-center">
          <span className="text-[10px] font-bold uppercase text-accent-pink block">TMB Estimada</span>
          <span className="text-2xl font-display">{userProfile.tmb || liveNeeds?.tmb || '--'} kcal</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-line text-center">
          <span className="text-[10px] font-bold uppercase text-ink/50 block">Peso</span>
          <span className="text-2xl font-display">{latestWeight ? `${latestWeight} kg` : '--'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-line text-center">
          <span className="text-[10px] font-bold uppercase text-ink/50 block">Altura</span>
          <span className="text-2xl font-display">{userProfile.height ? `${userProfile.height} cm` : '--'}</span>
        </div>
      </div>

      {/* Diário do Usuário */}
      {(userProfile.dailyNotes && userProfile.dailyNotes.length > 0) && (
        <div className="bg-white border border-line p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <PenTool size={18} className="text-accent" /> Anotações do Diário ({userProfile.dailyNotes.length})
            </h3>
            <button type="button" onClick={onOpenDiary} className="text-xs font-bold text-accent hover:underline">
              + Nova Anotação
            </button>
          </div>
          <div className="space-y-3">
            {userProfile.dailyNotes.slice(0, 3).map((note) => (
              <div key={note.id} className="p-4 rounded-2xl bg-paper border border-line/60">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase text-accent">{note.date} • Humor: {note.mood || 'Neutro'}</span>
                </div>
                <p className="text-xs sm:text-sm text-ink/80 font-medium">"{note.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações de Configuração */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {profileActions.map((item) => (
          <button key={item.label} onClick={() => onNavigate(item.page as Page)} className="bg-white border border-line rounded-3xl p-4 text-left shadow-sm hover:border-accent hover:bg-accent/5 transition-all group">
            <div className="w-10 h-10 rounded-2xl bg-ink/5 flex items-center justify-center text-ink/70 group-hover:bg-accent group-hover:text-paper transition-all mb-3">
              <item.icon size={18} />
            </div>
            <span className="font-bold text-xs sm:text-sm">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="pt-4 flex flex-col items-center gap-3">
        <button
          onClick={() => toast('Mind Nutrition v1.2 - Desenvolvido com carinho para seu bem-estar alimentar.', 'info', 4000)}
          className="text-xs font-medium text-ink/50 hover:text-accent transition-colors flex items-center gap-1.5"
        >
          <HelpCircle size={15} /> Sobre o Mind Nutrition
        </button>
        <button
          onClick={() => onNavigate('landing')}
          className="w-full py-4 text-red-500 font-bold border-2 border-red-500/10 rounded-full hover:bg-red-50 transition-colors text-xs uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> Desconectar / Voltar ao Início
        </button>
      </div>
    </div>
  );
}

function AccountSettingsPage({
  userProfile,
  onSaveProfile,
  onNavigate
}: {
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
  onNavigate: (page: Page) => void;
}) {
  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const [gender, setGender] = useState(userProfile.gender || 'Mulher');
  const [age, setAge] = useState(userProfile.age || 25);
  const [height, setHeight] = useState(userProfile.height || 165);

  const handleSave = () => {
    const updated = {
      ...userProfile,
      name: name.trim(),
      email: email.trim(),
      gender,
      age,
      height
    };
    onSaveProfile(updated);
  };

  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-28 max-w-xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="display-title text-4xl">Editar Perfil</h2>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-line shadow-sm space-y-5">
        <div>
          <label className="label-sm text-accent mb-1 block">Nome de exibição</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-lg font-bold outline-none"
          />
        </div>
        <div>
          <label className="label-sm text-accent mb-1 block">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-lg font-bold outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-sm text-accent mb-1 block">Gênero / Sexo</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-sm font-bold outline-none"
            >
              <option value="Mulher">Mulher</option>
              <option value="Homem">Homem</option>
              <option value="Não Binário(a)">Não Binário(a)</option>
              <option value="Outro">Outro</option>
              <option value="Prefiro não informar">Prefiro não informar</option>
            </select>
          </div>
          <div>
            <label className="label-sm text-accent mb-1 block">Idade</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(parseInt(e.target.value, 10) || 0)}
              className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-sm font-bold outline-none"
            />
          </div>
        </div>
        <div>
          <label className="label-sm text-accent mb-1 block">Altura (cm)</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
            className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-sm font-bold outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-md hover:bg-accent/90 active:scale-95 transition-all mt-4"
        >
          Salvar Alterações
        </button>
      </div>
    </div>
  );
}

function ThemeSettingsPage({
  themeId,
  onSetTheme,
  onNavigate
}: {
  themeId: string;
  onSetTheme: (id: string) => void;
  onNavigate: (page: Page) => void;
}) {
  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-28 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="display-title text-4xl">Temas do App</h2>
      </div>
      <div className="grid gap-3">
        {APP_THEMES.map(theme => {
          const active = theme.id === themeId;
          return (
            <button
              key={theme.id}
              onClick={() => onSetTheme(theme.id)}
              className={`w-full p-5 bg-white border rounded-3xl shadow-sm text-left transition-all ${active ? 'border-accent ring-4 ring-accent/15' : 'border-line hover:border-accent/40'}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base sm:text-lg">{theme.name}</h3>
                  <p className="text-xs text-ink/50 mt-0.5">{theme.description}</p>
                </div>
                {active && <CheckCircle size={22} className="text-accent shrink-0" />}
              </div>
              <div className="flex gap-2 mt-4">
                {[theme.colors.ink, theme.colors.paper, theme.colors.accent, theme.colors.accentPink, theme.colors.accentLight].map((c, idx) => (
                  <span key={idx} className="w-8 h-8 rounded-full border border-line shadow-xs" style={{ backgroundColor: c }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PrivacySettingsPage({
  currentUserId,
  onDeleteData,
  onNavigate
}: {
  currentUserId: string | null;
  onDeleteData: () => void;
  onNavigate: (page: Page) => void;
}) {
  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-28 max-w-xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="display-title text-4xl">Privacidade</h2>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
        <div className="p-4 rounded-2xl bg-paper border border-line flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm">Armazenamento Seguro</h4>
            <p className="text-xs text-ink/50 mt-0.5">Seus dados ficam protegidos com fallback local.</p>
          </div>
          <CheckCircle2 size={20} className="text-accent" />
        </div>
        <button
          onClick={onDeleteData}
          className="w-full py-4 text-red-500 font-bold border-2 border-red-500/20 rounded-full hover:bg-red-50 transition-colors text-xs uppercase tracking-wider flex items-center justify-center gap-2 mt-4"
        >
          <Trash2 size={16} /> Apagar todos os meus dados
        </button>
      </div>
    </div>
  );
}

function SettingsHelpPage({
  onNavigate
}: {
  onNavigate: (page: Page) => void;
}) {
  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-28 max-w-xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="display-title text-4xl">Ajuda & Contato</h2>
      </div>
      <div className="bg-white border border-line p-6 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 text-accent flex items-center justify-center font-bold">
            <Heart size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base">Equipe Mind Nutrition</h3>
            <p className="text-xs text-ink/50">Estamos à disposição para tirar dúvidas e acolher você.</p>
          </div>
        </div>
        <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-paper p-3.5 rounded-2xl border border-line hover:border-accent transition-colors">
          <div className="w-9 h-9 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><FaWhatsapp size={18} /></div>
          <div className="min-w-0">
            <span className="block font-bold text-xs">WhatsApp da Equipe</span>
            <span className="block text-[10px] text-ink/60">(11) 99999-9999</span>
          </div>
        </a>
        <a href="mailto:contato@mindnutrition.app" className="flex items-center gap-3 bg-paper p-3.5 rounded-2xl border border-line hover:border-accent transition-colors">
          <div className="w-9 h-9 bg-accent-pink/20 text-accent-pink rounded-full flex items-center justify-center"><Mail size={16} /></div>
          <div className="min-w-0">
            <span className="block font-bold text-xs">E-mail de Suporte</span>
            <span className="block text-[10px] text-ink/60">contato@mindnutrition.app</span>
          </div>
        </a>
      </div>
    </div>
  );
}

function MealDetailsPageComponent({
  selectedMeal,
  onNavigate
}: {
  selectedMeal: any;
  onNavigate: (page: Page) => void;
}) {
  if (!selectedMeal) return null;
  const mealType = inferMealType(selectedMeal);
  const mealPhotos = selectedMeal.photos?.length ? selectedMeal.photos : (selectedMeal.image ? [selectedMeal.image] : []);
  const satisfactionLabels = ['Nada satisfeito', 'Muito pouco', 'Pouco', 'Moderadamente', 'Satisfeito', 'Muito'];

  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-28 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center gap-4 border-b border-line pb-4">
        <button onClick={() => onNavigate('dashboard')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <span className="label-sm text-accent">Detalhes da Refeição</span>
          <h2 className="display-title text-3xl">{selectedMeal.title || 'Refeição'}</h2>
        </div>
      </header>

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
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
              <span className="text-[10px] font-bold uppercase text-accent block">Tipo de Fome</span>
              <span className="text-lg font-bold text-ink">{mealType}</span>
            </div>
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-[10px] font-bold uppercase text-ink/50 block">Satisfação Física</span>
              <span className="text-lg font-bold text-ink">
                {selectedMeal.satisfaction ?? 4}/5 ({satisfactionLabels[selectedMeal.satisfaction ?? 4]})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-[10px] font-bold uppercase text-ink/50 block">Humor Antes / Depois</span>
              <span className="text-sm font-bold text-ink">{selectedMeal.preMood || 'Neutro'} ➔ {selectedMeal.postMood || selectedMeal.mood || 'Neutro'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-[10px] font-bold uppercase text-ink/50 block">Fome Antes / Depois</span>
              <span className="text-sm font-bold text-ink">{selectedMeal.preHunger ?? 5}/10 ➔ {selectedMeal.postHunger ?? 5}/10</span>
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

          {selectedMeal.notes && (
            <div className="p-5 bg-paper rounded-2xl border border-line">
              <span className="label-sm text-accent mb-1 block">Anotações</span>
              <p className="text-sm text-ink/80 italic font-medium">"{selectedMeal.notes}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminLoginPageComponent({
  onLoginSuccess,
  onNavigate,
  toast
}: {
  onLoginSuccess: () => void;
  onNavigate: (page: Page) => void;
  toast: any;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAdminLogin = () => {
    if (email === 'admin@serenanutre.com' && password === 'admin123') {
      onLoginSuccess();
    } else {
      setError('Credenciais inválidas. Tente novamente.');
      toast('Credenciais inválidas!', 'error');
    }
  };

  return (
    <div className="w-full min-h-screen px-4 pt-12 pb-28 max-w-md mx-auto space-y-6">
      <div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm space-y-5">
        <h2 className="display-title text-3xl">Painel Nutricional</h2>
        {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
        <div>
          <label className="label-sm text-accent mb-1 block">E-mail</label>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} className="w-full py-2 border-b-2 border-line focus:border-accent bg-transparent text-base outline-none" />
        </div>
        <div>
          <label className="label-sm text-accent mb-1 block">Senha</label>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} className="w-full py-2 border-b-2 border-line focus:border-accent bg-transparent text-base outline-none" onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
        </div>
        <button onClick={handleAdminLogin} className="w-full py-4 bg-accent text-paper font-bold text-sm uppercase rounded-full shadow-md hover:bg-accent/90">
          Entrar
        </button>
      </div>
    </div>
  );
}

function AdminDashboardPageComponent({
  adminUsers,
  adminArticles,
  onLogout
}: {
  adminUsers: any[];
  adminArticles: any[];
  onLogout: () => void;
}) {
  return (
    <div className="w-full min-h-screen px-4 sm:px-8 md:px-12 pt-8 md:pt-12 pb-28 max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="display-title text-4xl">Painel do Nutricionista</h2>
          <p className="text-xs text-ink/60 mt-1">Gerencie usuários e conteúdos</p>
        </div>
        <button onClick={onLogout} className="text-red-500 font-bold text-xs flex items-center gap-1">
          <LogOut size={16} /> Sair
        </button>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-line p-6 rounded-3xl shadow-sm">
          <h3 className="font-bold text-lg mb-1">Usuários Registrados</h3>
          <p className="text-2xl font-display text-accent">{adminUsers.length}</p>
        </div>
        <div className="bg-white border border-line p-6 rounded-3xl shadow-sm">
          <h3 className="font-bold text-lg mb-1">Artigos na Biblioteca</h3>
          <p className="text-2xl font-display text-accent-pink">{adminArticles.length}</p>
        </div>
      </div>
    </div>
  );
}
