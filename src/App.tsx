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
  Brain,
  Zap,
  TrendingUp,
  HelpCircle,
  Info,
  ArrowUpLeft,
  X,
  Palette,
  Trash2
} from 'lucide-react';
import { GiOvermind } from 'react-icons/gi';
import { BsFlower1 } from 'react-icons/bs';
import { TbHealthRecognition } from 'react-icons/tb';
import { PiHeartbeat } from 'react-icons/pi';
import { FaBrain, FaWhatsapp } from 'react-icons/fa';
import { motion, AnimatePresence, useAnimation, useMotionValue } from 'motion/react';
import { useToast } from './components/Toast';
import { MascotComponent } from './components/Mascot';
import { AuthPage } from './components/AuthPage';
import { Avatar } from './components/ui/Avatar';
import { ProfileAvatar } from './components/ui/ProfileAvatar';
import { HungerOdometer } from './components/ui/HungerOdometer';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { APP_THEMES, DEFAULT_THEME_ID } from './constants/themes';
import { DEFAULT_PROFILE_PHOTO, readValidatedImages, MAX_IMAGE_SIZE_MB, MAX_MEAL_PHOTOS } from './constants';
import type { Page, UserProfile } from './types';
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
import mascoteEyesOpen from './assets/mascote_eyes_open.png';
import mascoteEyesClosed from './assets/mascote_eyes_closed.png';
import mascoteFlying from './assets/mascote_flying.png';
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
  goals: string[]
) {
  if (!weight || !heightCm || !age) return { imc: 0, tmb: 0, net: 0 };
  const heightM = heightCm / 100;
  const imc = weight / (heightM * heightM);

  let tmb = (10 * weight) + (6.25 * heightCm) - (5 * age);
  tmb = (gender === 'Masculino' || gender === 'Homem') ? tmb + 5 : tmb - 161;

  let net = tmb * activityLevel;
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
  };
  return moodScores[key] ?? null;
};

const isEmotionallyChargedMood = (mood?: string | null) => {
  const score = getMoodScore(mood);
  return typeof score === 'number' && score <= 40;
};

const normalizeMealType = (type?: string | null): MealClassification => {
  const value = normalizeText(type);
  if (value.includes('fisica')) return 'Física';
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

  if (!hasBehaviorSignals) return existingType;

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

  if (physicalScore >= 3 && physicalScore >= emotionalScore + 1) return 'Física';
  if (emotionalScore >= 3 && emotionalScore >= physicalScore + 1) return 'Emocional';
  return existingType;
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
  return (profile.waistEvolution || [])
    .map(waist => {
      const sameDateHip = (profile.hipEvolution || []).find(hip => hip.date === waist.date)?.value;
      const hipValue = sameDateHip || latestHip;
      return {
        date: waist.date,
        value: waist.value > 0 && hipValue ? parseFloat((waist.value / hipValue).toFixed(2)) : 0,
      };
    })
    .filter(item => item.value > 0);
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

// Keep modal/card overlays as a dark scrim instead of backdrop blur; high blur is costly on mobile GPUs.
const MODAL_BACKDROP_CLASS = 'absolute inset-0 bg-ink/85';

const COLORS = ['var(--accent)', 'var(--accent-pink)', '#5A9485'];

const MOCK_WEIGHT_DATA = [
  { date: '01/04', value: 76.5 },
  { date: '08/04', value: 76.0 },
  { date: '15/04', value: 75.8 },
  { date: '22/04', value: 75.3 },
  { date: '29/04', value: 75.0 },
];

const isDemoWeightEvolution = (items?: MetricPoint[]) => (
  Boolean(items?.length === MOCK_WEIGHT_DATA.length)
  && MOCK_WEIGHT_DATA.every((mockItem, index) => items?.[index]?.date === mockItem.date && items?.[index]?.value === mockItem.value)
);

const sanitizeProfileDefaults = (profile: UserProfile): UserProfile => {
  const currentDateLabel = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const normalizeDates = (items: MetricPoint[] = []) => items.map(item => item.date === 'Hoje' ? { ...item, date: currentDateLabel } : item);
  const normalizedProfile = {
    ...profile,
    weightEvolution: normalizeDates(profile.weightEvolution),
    waistEvolution: normalizeDates(profile.waistEvolution),
    armEvolution: normalizeDates(profile.armEvolution),
    abdomenEvolution: normalizeDates(profile.abdomenEvolution),
    hipEvolution: normalizeDates(profile.hipEvolution),
  };
  const profileLooksIncomplete = !normalizedProfile.onboardingComplete && !normalizedProfile.profileCompletedAt && !normalizedProfile.height;
  if (!profileLooksIncomplete || !isDemoWeightEvolution(normalizedProfile.weightEvolution)) return normalizedProfile;
  return {
    ...normalizedProfile,
    weightEvolution: [],
    waistEvolution: [],
    hipEvolution: [],
    age: normalizedProfile.age === 25 ? 0 : normalizedProfile.age,
  };
};

const DEFAULT_LIBRARY_ARTICLES = [
  {
    id: 'sono-ultraprocessados', title: 'Comida de tirar o sono', duration: '3 min', icon: Moon, type: 'Sono e alimentação', image: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800',
    summary: 'Como ultraprocessados, cafeína e refeições pesadas podem atrapalhar suas noites.',
    content: [
      'Os ultraprocessados podem interferir no funcionamento de hormônios como a melatonina, aumentar a inflamação e tornar a digestão mais lenta - fatores que podem incomodar na hora de dormir.',
      'Refrigerantes e energéticos, doces e sobremesas, além de lanches tipo fast food, estão entre os exemplos citados por reunirem cafeína, açúcar, gordura e sal em níveis que podem prejudicar o relaxamento e o sono profundo.',
      'Em vez de buscar perfeição, observe com curiosidade: o que você costuma comer e beber nas horas que antecedem o sono? Pequenos ajustes na rotina podem ser um bom ponto de partida.'
    ], sourceLabel: 'Hospital Alemão Oswaldo Cruz', sourceUrl: 'https://www.hospitaloswaldocruz.org.br/imprensa/hospital-na-midia/comida-de-tirar-o-sono-como-os-ultraprocessados-prejudicam-as-suas-noites/'
  },
  {
    id: 'sono-comportamento-alimentar', title: 'Sono, apetite e escolhas alimentares', duration: '5 min', icon: Coffee, type: 'Ciência do sono', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
    summary: 'Entenda a relação entre menos sono, sinais de fome e escolhas alimentares.',
    content: [
      'A privação de sono pode aumentar a grelina, hormônio associado à fome, e reduzir a leptina, relacionada à saciedade. Essa combinação tende a intensificar o apetite.',
      'Alterações no sono também podem influenciar o comportamento alimentar, favorecendo escolhas mais frequentes de alimentos doces e de maior densidade energética em momentos de cansaço.',
      'Esse conhecimento não é motivo para culpa: ele ajuda a entender que sono, alimentação e emoções fazem parte da mesma rotina de cuidado.'
    ], sourceLabel: 'Padrões de sono, comportamento alimentar e o risco de doenças não transmissíveis', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10255419/'
  },
  {
    id: 'sono-dieta-saudavel', title: 'Qualidade do sono e dieta saudável', duration: '3 min', icon: Leaf, type: 'Revisão sistemática', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800',
    summary: 'Boas noites de sono e uma alimentação equilibrada costumam caminhar juntas.',
    content: [
      'Uma revisão sistemática aponta que pessoas que relatam duração de sono curta têm menor probabilidade de manter uma dieta saudável, enquanto a boa qualidade do sono se associa a uma maior probabilidade de escolhas alimentares saudáveis.',
      'A relação é de mão dupla: rotina, ambiente, estresse, refeições e descanso podem se influenciar. Por isso, vale olhar para a semana inteira, e não para uma única noite ou refeição.',
      'Experimente escolher um pequeno cuidado possível hoje: reduzir telas perto de dormir, fazer uma refeição mais tranquila ou preparar um horário de descanso mais regular.'
    ], sourceLabel: 'Impacto da alimentação associada ao hábito do sono: uma revisão sistemática'
  },
  {
    id: 'sono-peso', title: 'Sono reduzido e ganho de peso', duration: '4 min', icon: Heart, type: 'Leitura científica', image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=800',
    summary: 'Por que noites curtas podem mexer com a fome e o apetite por doces e carboidratos.',
    content: [
      'Estudos reunidos em uma revisão apontam que a privação crônica de sono pode influenciar o peso por efeitos no apetite, na atividade física e na termorregulação.',
      'Em um estudo citado, comparar quatro horas com dez horas de sono ao longo de dois dias aumentou fome e apetite, especialmente por alimentos ricos em gordura e carboidratos, junto a alterações em grelina e leptina.',
      'Cuidar do sono não é uma regra rígida nem uma solução isolada. É uma forma gentil de apoiar o corpo e tornar as escolhas alimentares um pouco mais fáceis.'
    ], sourceLabel: 'Duração reduzida do sono e ganho de peso: uma revisão sistemática', sourceUrl: 'https://docs.google.com/document/d/1cALISiOtVT7v5QywW867eYoB7ayQe_EAfd8bDaPUJ1Y/edit?tab=t.0'
  }
];

// ---------- Sub-Components ----------

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
  const [savedLoginNotice, setSavedLoginNotice] = useState(false);
  const [themeId, setThemeId] = useState(() => localStorage.getItem('mindTheme') || DEFAULT_THEME_ID);
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
    height: 0,
    weightEvolution: [],
    waistEvolution: [],
    armEvolution: [],
    abdomenEvolution: [],
    hipEvolution: [],
    age: 0,
    activityLevel: 1.2
  });

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
          setSavedLoginNotice(true);
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
            setSavedLoginNotice(true);
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
            } else if (session.user.email && active) {
              setUserProfile(prev => {
                const hydrated = withProfileCompletionState(mergeProfileData(prev, {
                  email: session.user.email || prev.email,
                  name: prev.name || metadataName,
                  photo: prev.photo && prev.photo !== DEFAULT_PROFILE_PHOTO ? prev.photo : metadataPhoto || prev.photo,
                }));
                localStorage.setItem('nutriUser', JSON.stringify(hydrated));
                upsertProfile(session.user.id, session.user.email || hydrated.email, hydrated as unknown as Record<string, unknown>).catch((err) => {
                  console.info('Supabase profile sync skipped:', getFriendlySupabaseError(err));
                });
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

      setTimeout(() => active && setIsLoading(false), 900);
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
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('nutriArticles', JSON.stringify(adminArticles));
  }, [adminArticles]);

  useEffect(() => {
    const targetPath = ['admin-login', 'admin-dashboard', 'admin-users', 'admin-articles'].includes(currentPage) ? '/nutricionista' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.replaceState({}, '', targetPath);
    }
  }, [currentPage]);

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
            <BsFlower1 size={18} />
          </div>
          <div className="min-w-0">
            <span className="topbar-eyebrow">Mind Nutrition</span>
            <h1 className="topbar-title">Mind Nutrition</h1>
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

        <button onClick={() => setCurrentPage('profile')} className="topbar-profile">
          <span className="hidden min-w-0 text-right sm:block">
            <span className="topbar-eyebrow">Perfil</span>
            <span className="topbar-user">{userProfile.name || 'Completar dados'}</span>
          </span>
          <ProfileAvatar photo={userProfile.photo} size="sm" className="border-0 shadow-sm" />
        </button>
      </header>
    );
  };

  const renderDesktopSidebar = () => {
    if (['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles'].includes(currentPage) || isLoading) return null;
    return (
      <aside className="app-sidebar">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && setCurrentPage(item.id as Page)}
              disabled={item.disabled}
              aria-label={item.disabled ? 'Nutri AI temporariamente indisponível' : item.label}
              className={`relative w-14 h-14 mb-2 flex items-center justify-center rounded-2xl transition-all ${item.disabled ? 'cursor-not-allowed opacity-35' : isActive ? 'bg-accent/20 text-accent' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
                }`}
              title={item.disabled ? 'Nutri AI temporariamente indisponível' : item.label}
            >
              {item.primary ? (
                <div className="w-12 h-12 rounded-full bg-accent text-paper flex items-center justify-center shadow-md hover:scale-105 transition-transform">
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
    if (['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles'].includes(currentPage) || isLoading) return null;
    if (currentPage === 'meal-log') return null;

    // Mobile nav shows 5 items max for better UX
    const mobileItems = navItems.filter(i => i.id !== 'profile');

    return (
      <div className="mobile-nav fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pb-safe pointer-events-none">
        <nav className="pointer-events-auto flex h-16 w-full max-w-[24rem] items-center justify-around rounded-full border border-white/60 bg-paper/72 px-2 shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          {mobileItems.map((item) => {
            const isActive = currentPage === item.id;

            if (item.primary) {
              return (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setCurrentPage(item.id as Page)}
                  disabled={item.disabled}
                  className={`relative -top-4 w-16 h-16 rounded-full flex items-center justify-center border-4 border-paper transition-transform ${item.disabled ? 'cursor-not-allowed bg-ink/20 text-ink/35' : 'bg-accent text-paper shadow-lg hover:scale-105 active:scale-95'}`}
                >
                  <item.icon size={28} />
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => !item.disabled && setCurrentPage(item.id as Page)}
                disabled={item.disabled}
                aria-label={item.disabled ? 'Nutri AI temporariamente indisponível' : item.label}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-full gap-0.5 transition-colors ${item.disabled ? 'cursor-not-allowed text-ink/25' : isActive ? 'text-accent' : 'text-ink/50 hover:text-ink'
                }`}
              >
                <div className="relative p-2 rounded-full flex items-center justify-center">
                  {isActive && (
                    <motion.div
                      layoutId="mob-nav-active"
                      className="absolute inset-0 rounded-full bg-accent/12"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon size={21} strokeWidth={isActive ? 2.6 : 2.1} className="relative z-10" />
                </div>
                <span className="text-[8px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  // ---------- Transitions ----------

  const PageWrapper = ({ children, noPadding = false }: { children: React.ReactNode, noPadding?: boolean }) => {
    const hasTopbar = !['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles', 'chat'].includes(currentPage);
    const pagePadding = noPadding ? '' : `px-5 md:px-12 ${hasTopbar ? 'pt-28 md:pt-28' : 'pt-8 md:pt-12'}`;
    const bottomPadding = noPadding ? '' : 'pb-32 md:pb-12';
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`w-full min-h-screen ${bottomPadding} ${pagePadding} max-w-6xl mx-auto`}
      >
        {children}
      </motion.div>
    );
  };

  // ---------- Components ----------

  // ---------- Pages ----------

  const LandingPage = () => (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="landing-gradient w-full h-[100dvh] overflow-hidden fixed inset-0 z-50 bg-paper"
      style={{ backgroundImage: 'radial-gradient(var(--line) 1px, transparent 1px)', backgroundSize: '30px 30px' }}
    >
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-paper via-transparent to-paper pointer-events-none z-0" />
      <div className="w-full h-full flex flex-col relative z-10 max-w-[2000px] mx-auto">

        <div className="flex-1 flex flex-col justify-center px-8 md:px-16 pb-20 md:pb-32 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <div className="mb-12 relative inline-block">
                <div className="absolute -top-12 -left-8 text-accent/20 w-32 h-32 spin-slow pointer-events-none">
                  <BsFlower1 size="100%" />
                </div>
                <h1 className="font-title text-accent text-[4.5rem] sm:text-[6rem] md:text-[8rem] leading-[0.85] tracking-tight relative z-10">Mind</h1>
                <h1 className="font-title text-accent-pink -mt-3 md:-mt-8 text-right text-[4.2rem] sm:text-[5.8rem] md:text-[8rem] leading-[0.85] text-shadow-md tracking-tight relative z-10">Nutrition</h1>
              </div>

              <div className="max-w-md mb-12 bg-white/50 backdrop-blur-sm p-6 rounded-3xl border border-line shadow-sm relative z-20">
                <p className="serif-body text-2xl md:text-3xl text-ink leading-tight mb-4">
                  Um diálogo autêntico com seu próprio corpo.
                </p>
                <p className="text-ink/70 font-medium text-sm md:text-base leading-relaxed">
                  Uma abordagem gentil para a sua alimentação. Experimente refletir sobre o que você está sentindo e avalie se precisa, de fato, comer.
                </p>
              </div>

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
                className="group relative inline-flex items-center gap-4 bg-paper text-ink border-2 px-10 py-6 rounded-[2rem] overflow-hidden snappy hover:scale-105 shadow-xl animated-border z-20"
              >
                <span className="relative z-10 font-bold uppercase tracking-widest text-sm flex items-center gap-3">
                  <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-accent">
                    <FaBrain size={24} />
                  </motion.span>
                  {localStorage.getItem('nutriUser') ? 'Continuar Jornada' : 'Começar Jornada'}
                </span>
                <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
        </div>
        
        {/* Wavy Shape Divider */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] pointer-events-none z-0">
          <svg className="relative block w-full h-[100px] md:h-[150px]" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V120H0Z" fill="var(--accent-pink)" opacity="0.3"></path>
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-23.82V120H0Z" fill="var(--accent)" opacity="0.5"></path>
          </svg>
        </div>
      </div>
    </motion.div>
  );

  const handleAuthenticated = async (params: {
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
    setSavedLoginNotice(true);
    toast(isLogin ? 'Login salvo com segurança.' : 'Conta criada. Complete seu perfil.', 'success');
    setCurrentPage(getPostLoginPage(nextProfile));
  };

  const DiagnosisQuiz = () => {
    const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);
    const [errorMsg, setErrorMsg] = useState('');

    const steps = [
      { id: 'name', title: "Como prefere ser chamado?", subtitle: "Sua identidade é essencial.", type: 'input', field: 'name', placeholder: 'Seu nome ou apelido' },
      { id: 'gender', title: "Como você se identifica?", subtitle: "Escolha a opção que melhor representa você.", type: 'options', field: 'gender', options: ["Homem", "Mulher", "Não Binário(a)", "Outro", "Prefiro não informar"] },
      { id: 'basics', title: "Sobre sua rotina", subtitle: "Esses dados ajudam a personalizar o cuidado, sem metas rígidas.", type: 'basic', options: [
        { label: "Sedentário (pouco ou nenhum)", value: 1.2 },
        { label: "Levemente ativo (1-3 dias/sem)", value: 1.375 },
        { label: "Moderadamente ativo (3-5 dias/sem)", value: 1.55 },
        { label: "Muito ativo (6-7 dias/sem)", value: 1.725 }
      ]},
      { id: 'emotions', title: "Como você se sente ultimamente?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'initialEmotions', options: ["Estressado(a)", "Frustrado(a)", "Deprimido(a)", "Solitário(a)", "Ansioso(a)", "Raivoso(a)", "Alegre", "Animado(a)", "Calmo(a)", "Outro"] },
      { id: 'comorbidities', title: "Você possui alguma condição de saúde?", subtitle: "Marque uma ou mais opções para personalizarmos seu cuidado.", type: 'multiselect', field: 'comorbidities', options: ["Não possuo nenhuma condição", "Sou diabético(a)", "Sou hipertenso(a)", "Tenho alterações da tireoide", "Tenho transtornos emocionais", "Outro"] },
      { id: 'triggers', title: "Quais emoções você costuma sentir antes de comer sem fome física?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'triggers', options: ["Tédio", "Cansaço", "Raiva", "Tristeza", "Ansiedade", "Alegria", "Outro"] },
      { id: 'foods', title: "Quando sente vontade de comer por causa das suas emoções, quais alimentos você procura?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'foods', options: ["Doces", "Salgados", "Massas", "Salgadinhos", "Fast food", "Outro"] },
      { id: 'objectives', title: "Qual é o seu principal objetivo com este aplicativo?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'objectives', options: ["Emagrecimento consciente", "Melhorar a relação com a comida", "Ganho de peso", "Hipertrofia", "Cuidar da minha saúde", "Outro"] },
      { id: 'measurements', title: "Suas medidas iniciais", subtitle: "Para acompanhar sua evolução com gentileza.", type: 'measurements' }
    ];

    const current = steps[diagnosisStep];

    const handleNext = async () => {
      setErrorMsg('');
      if (current.type === 'input' && !tempProfile.name) {
        setErrorMsg('Por favor, informe seu nome.');
        return;
      }
      if ((current.type === 'input_number' && current.field === 'age') || current.type === 'basic') {
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
        
        // Calculate Nutritional Needs
        const result = calculateNutritionalNeeds(
          initialWeight,
          tempProfile.height,
          tempProfile.age || 25,
          tempProfile.gender,
          tempProfile.activityLevel || 1.2,
          tempProfile.objectives
        );
        
        const finalProfile = { ...tempProfile, ...result };
        await persistUserProfile(finalProfile);
        setCurrentPage('dashboard');
        return;
      }

      if (diagnosisStep < steps.length - 1) {
        setDiagnosisStep(s => s + 1);
      }
    };

    return (
      <PageWrapper>
        <div className="space-y-10">
          <div className="flex items-center gap-4">
            <button onClick={() => diagnosisStep > 0 ? setDiagnosisStep(s => s - 1) : setCurrentPage('auth')} className="p-2 -ml-2 rounded-full hover:bg-line transition-colors">
              <ArrowLeft size={20} className="text-ink" />
            </button>
            <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent to-accent-pink"
                initial={{ width: 0 }}
                animate={{ width: `${((diagnosisStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="display-title text-4xl">{current.title}</h2>
            <p className="serif-body text-xl text-ink/60">{current.subtitle}</p>
          </div>

          <div className="pt-4 max-w-md">
            {errorMsg && <p className="text-red-500 font-bold mb-4">{errorMsg}</p>}

            {current.type === 'input' && (
              <div className="space-y-6">
                <input
                  type="text" placeholder={current.placeholder}
                  className="w-full py-4 bg-transparent border-b-2 border-ink focus:border-accent focus:outline-none text-2xl font-medium"
                  value={tempProfile.name}
                  onChange={(e) => { setTempProfile({ ...tempProfile, name: e.target.value }); setErrorMsg(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  autoFocus
                />
                <button
                  onClick={handleNext}
                  className={`w-full py-5 text-paper rounded-full font-bold uppercase tracking-widest text-sm transition-colors ${tempProfile.name ? 'bg-accent hover:bg-accent/90' : 'bg-ink/30 cursor-not-allowed'}`}
                >
                  Continuar
                </button>
              </div>
            )}
            
            {current.type === 'input_number' && (
              <div className="space-y-6">
                <input
                  type="number" placeholder={current.placeholder}
                  className="w-full py-4 bg-transparent border-b-2 border-ink focus:border-accent focus:outline-none text-2xl font-medium"
                  value={tempProfile[current.field as keyof UserProfile] as any || ''}
                  onChange={(e) => { setTempProfile({ ...tempProfile, [current.field!]: parseFloat(e.target.value) }); setErrorMsg(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  autoFocus
                />
                <button
                  onClick={handleNext}
                  className={`w-full py-5 text-paper rounded-full font-bold uppercase tracking-widest text-sm transition-colors ${tempProfile[current.field as keyof UserProfile] ? 'bg-accent hover:bg-accent/90' : 'bg-ink/30 cursor-not-allowed'}`}
                >
                  Continuar
                </button>
              </div>
            )}

            {current.type === 'options' && (
              <div className="space-y-3">
                {current.options?.map((opt: any) => (
                  <button key={opt} onClick={() => { setTempProfile({ ...tempProfile, [current.field!]: opt }); handleNext(); }}
                    className="w-full p-6 text-left border-2 border-line rounded-2xl hover:border-accent hover:bg-accent/5 font-medium text-lg transition-colors">
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {current.type === 'options_activity' && (
              <div className="space-y-3">
                {current.options?.map((opt: any) => (
                  <button key={opt.label} onClick={() => { setTempProfile({ ...tempProfile, [current.field!]: opt.value }); handleNext(); }}
                    className="w-full p-6 text-left border-2 border-line rounded-2xl hover:border-accent hover:bg-accent/5 font-medium text-lg transition-colors">
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {current.type === 'basic' && (
              <div className="space-y-6">
                <div>
                  <label className="label-sm">Qual é a sua idade?</label>
                  <input
                    type="number"
                    placeholder="Ex: 25"
                    className="mt-2 w-full py-4 bg-transparent border-b-2 border-ink focus:border-accent focus:outline-none text-2xl font-medium"
                    value={tempProfile.age || ''}
                    onChange={(e) => { setTempProfile({ ...tempProfile, age: parseFloat(e.target.value) }); setErrorMsg(''); }}
                  />
                </div>
                <div>
                  <label className="label-sm mb-3 block">Como é sua rotina de atividade física?</label>
                  <div className="grid gap-2">
                    {current.options?.map((opt: any) => (
                      <button key={opt.label} type="button" onClick={() => setTempProfile({ ...tempProfile, activityLevel: opt.value })}
                        className={`w-full rounded-2xl border-2 p-4 text-left text-sm font-medium transition-colors ${tempProfile.activityLevel === opt.value ? 'border-accent bg-accent/10 text-accent' : 'border-line hover:border-accent'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleNext} className={`w-full py-5 text-paper rounded-full font-bold uppercase tracking-widest text-sm transition-colors ${tempProfile.age ? 'bg-accent hover:bg-accent/90' : 'bg-ink/30 cursor-not-allowed'}`}>
                  Continuar
                </button>
              </div>
            )}

            {current.type === 'multiselect' && (
              <div className="space-y-6">
                <div className="grid gap-3">
                  {current.options?.map((opt: any) => {
                    const isOther = String(opt).startsWith('Outro');
                    const arr = (tempProfile[current.field as keyof UserProfile] as string[]) || [];
                    const selected = arr.includes(opt) || (isOther && arr.some(i => i.startsWith('Outro')));
                    
                    return (
                      <div key={String(opt)}>
                        <button
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
                          className={`w-full p-5 text-left border-2 rounded-2xl font-medium text-lg transition-colors ${selected ? 'border-accent bg-accent text-paper' : 'border-line hover:border-accent'}`}
                        >
                          {String(opt)}
                        </button>
                        {isOther && selected && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                            <input
                              type="text"
                              autoFocus
                              placeholder="Descreva..."
                              className="w-full mt-3 p-4 border-2 border-line rounded-xl bg-transparent focus:border-accent outline-none font-medium"
                              value={arr.find(i => i.startsWith('Outro'))?.replace(/^Outro[s]?: /, '') || ''}
                              onChange={(e) => {
                                const newArr = arr.filter(i => !i.startsWith('Outro'));
                                newArr.push('Outro: ' + e.target.value);
                                setTempProfile({ ...tempProfile, [current.field!]: newArr });
                              }}
                            />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleNext} className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-md">
                  Confirmar Escolhas
                </button>
              </div>
            )}

            {current.type === 'measurements' && (() => {
              return (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    <div>
                      <label className="label-sm">Altura (cm)</label>
                      <input type="number" placeholder="Ex: 170" className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-2xl font-medium outline-none"
                        onChange={(e) => { setTempProfile({ ...tempProfile, height: parseFloat(e.target.value) }); setErrorMsg(''); }} />
                    </div>
                    <div>
                      <label className="label-sm">Peso (kg)</label>
                      <input type="number" placeholder="Ex: 70.5" className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-2xl font-medium outline-none"
                        onChange={(e) => { setTempProfile({ ...tempProfile, weightEvolution: [{ date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: parseFloat(e.target.value) }] }); setErrorMsg(''); }} />
                    </div>
                  </div>
                  
                  <div className="p-5 bg-accent-pink/10 border border-accent-pink/30 rounded-2xl flex gap-4">
                    <BookOpen className="text-accent-pink shrink-0" />
                    <p className="text-sm font-medium text-ink/80 leading-relaxed">
                      Sua altura e peso nos ajudam a personalizar as recomendações. Essas medidas ficam privadas no seu perfil e não definem seu valor ou sua jornada.
                    </p>
                  </div>
                  <button onClick={handleNext} className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg hover:bg-accent/90">
                    Finalizar Configuração
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </PageWrapper>
    );
  };

  const Dashboard = () => {
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [appRating, setAppRating] = useState<number | null>(() => {
      const savedRating = localStorage.getItem('nutriAppFeedback');
      return savedRating ? Number(savedRating) : null;
    });
    const quotes = [
      'Hoje você não precisa resolver toda a sua vida. Precisa apenas cuidar do próximo passo.',
      'Compaixão por si mesmo é simplesmente dar a si a mesma bondade que daríamos aos outros. - Kristin Neff',
      'Você não pode parar as ondas, mas pode aprender a surfar. - Jon Kabat-Zinn',
      'A esperança pode tornar o momento presente menos difícil de suportar. - Thich Nhat Hanh'
    ];
    const awarenessScore = calculateAwarenessScore(userProfile, loggedMeals);
    const profileProgress = calculateProfileInsightScore(userProfile);
    const latestMood = userProfile.checkIns?.[userProfile.checkIns.length - 1]?.mood;
    const firstName = userProfile.name?.trim().split(/\s+/)[0] || 'você';

    useEffect(() => {
      const interval = setInterval(() => {
        setQuoteIndex((prev) => (prev + 1) % quotes.length);
      }, 5000);
      return () => clearInterval(interval);
    }, []);

    return (
    <PageWrapper>
      <div className="space-y-12">
        <header>
          <p className="label-sm text-accent">Início</p>
          <h2 className="serif-body text-2xl md:text-3xl text-ink/70 mt-2">
            {userProfile.name ? `Espaço de ${userProfile.name}` : 'Espaço de Consciência'}
          </h2>
        </header>

        <section className="mobile-card-padding animated-gradient p-8 md:p-12 rounded-[2rem] shadow-lg relative overflow-hidden text-paper">
          <Sparkles className="absolute -right-4 -top-4 text-paper/20 w-32 h-32 spin-slow" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
            <div>
              <h3 className="label-sm mb-4 glass-badge font-bold">Reflexão do dia</h3>
              <div className="min-h-[7rem] flex items-center">
                <AnimatePresence mode="wait">
                  <motion.p key={quoteIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }} className="serif-body text-2xl md:text-3xl leading-relaxed drop-shadow-sm">
                    “{quotes[quoteIndex]}”
                  </motion.p>
                </AnimatePresence>
              </div>
              <button onClick={() => setCurrentPage('meal-log')} className="mt-7 inline-flex items-center gap-2 rounded-full bg-paper px-5 py-3 text-sm font-bold text-ink transition-transform hover:scale-[1.02]">
                <PlusCircle size={17} /> Fazer uma pausa antes de comer
              </button>
            </div>
            <div className="rounded-[1.75rem] border border-white/20 bg-white/12 p-5 backdrop-blur-sm">
              <p className="text-sm font-bold text-paper/80">Hoje, {firstName}</p>
              <p className="mt-2 text-xl font-bold">{latestMood ? `Você registrou: ${latestMood}` : 'Seu espaço está pronto para começar.'}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/10 p-3"><span className="block text-2xl font-bold">{loggedMeals.length}</span><span className="text-[10px] font-bold uppercase tracking-wide text-paper/70">registros</span></div>
                <div className="rounded-2xl bg-black/10 p-3"><span className="block text-2xl font-bold">{awarenessScore}%</span><span className="text-[10px] font-bold uppercase tracking-wide text-paper/70">consciência</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <button onClick={() => setCurrentPage('meal-log')} className="group rounded-[1.75rem] border border-line bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Coffee size={20} /></span>
            <h3 className="mt-5 font-bold">Registrar uma refeição</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">Observe fome, humor e saciedade no seu ritmo.</p>
          </button>
          <button onClick={() => setCurrentPage('progress')} className="group rounded-[1.75rem] border border-line bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-pink/15 text-accent-pink"><TrendingUp size={20} /></span>
            <h3 className="mt-5 font-bold">Ver sinais da jornada</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">{profileProgress ? 'Acompanhe sua leitura atual com contexto.' : 'Complete o perfil para liberar uma leitura inicial.'}</p>
          </button>
          <button onClick={() => setCurrentPage('content')} className="group rounded-[1.75rem] border border-line bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><BookOpen size={20} /></span>
            <h3 className="mt-5 font-bold">Cuidar do sono</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">Leituras breves sobre sono, apetite e alimentação.</p>
          </button>
        </section>

        <section>
          <div className="responsive-page-header mb-6">
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-accent" />
              <h3 className="label-sm">Biblioteca</h3>
            </div>
            <button onClick={() => setCurrentPage('content')} className="text-xs font-bold text-accent hover:underline">Ver tudo</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DEFAULT_LIBRARY_ARTICLES.slice(0, 3).map((post) => (
              <button
                key={post.id}
                onClick={() => { setSelectedArticle(post); setCurrentPage('content'); }}
                className="group text-left bg-paper border border-line rounded-[1.5rem] overflow-hidden hover:shadow-md transition-all flex flex-row md:flex-col items-stretch md:items-start"
              >
                <div className="w-24 min-h-full md:w-full md:h-36 shrink-0 overflow-hidden bg-line">
                  <img src={post.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="p-4 flex-1">
                  <span className="text-[8px] font-bold text-accent uppercase">{post.type}</span>
                  <h4 className="font-bold text-sm md:text-base leading-tight mt-1 line-clamp-1">{post.title}</h4>
                  <p className="text-[9px] md:text-xs text-ink/50 mt-1 line-clamp-2 md:line-clamp-1">{post.summary}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="responsive-page-header mb-6">
            <div className="flex items-center gap-3">
              <Coffee size={18} className="text-accent" />
              <h3 className="label-sm">Entradas de Hoje</h3>
            </div>
            {loggedMeals.length > 0 && (
              <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full">{loggedMeals.length} registros</span>
            )}
          </div>
          <div className="bg-paper border border-line rounded-[2rem] overflow-hidden">
            {loggedMeals.length === 0 ? (
              <div className="p-12 text-center">
                <Coffee size={48} className="text-ink/20 mx-auto mb-4" />
                <p className="serif-body text-xl text-ink/50 mb-2">Nenhuma refeição registrada ainda</p>
                <p className="text-sm text-ink/40 mb-6">Comece a registrar suas refeições para acompanhar sua jornada alimentar</p>
                <button onClick={() => setCurrentPage('meal-log')} className="bg-accent text-paper px-6 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-accent/90 transition-colors">
                  Registrar Primeira Refeição
                </button>
              </div>
            ) : (
              loggedMeals.slice(0, 8).map((meal: any, i: number) => {
                const mealType = inferMealType(meal);
                const MealIcon = meal.icon || (mealType === 'Física' ? TbHealthRecognition : mealType === 'Emocional' ? PiHeartbeat : Coffee);
                return (
                  <div key={i} onClick={() => { setSelectedMeal(meal); setCurrentPage('meal-details'); }}
                    className="p-4 sm:px-6 border-b border-line last:border-0 flex items-center justify-between gap-3 hover:bg-accent/5 transition-colors cursor-pointer">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${mealType === 'Emocional' ? 'bg-accent-pink/20 text-accent-pink' : mealType === 'Física' ? 'bg-accent/10 text-accent' : 'bg-ink/5 text-ink/50'}`}>
                        <MealIcon size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-bold text-base sm:text-lg">{meal.title || 'Refeição'}</h4>
                        <p className="text-xs text-ink/50 font-medium">
                          {meal.time || new Date(meal.date).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} • {meal.postMood || meal.preMood || meal.mood || mealType}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-ink/30" />
                  </div>
                );
              })
            )}

          </div>
        </section>

        <section className="rounded-[2rem] border border-line bg-white p-6 shadow-sm">
          <p className="label-sm text-accent">Sua experiência</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-ink/65">Como está sendo usar o aplicativo?</p>
            <div className="flex gap-2" aria-label="Avalie o aplicativo de 1 a 5">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => { setAppRating(rating); localStorage.setItem('nutriAppFeedback', String(rating)); toast('Obrigada pela avaliação!', 'success'); }}
                  className={`h-10 w-10 rounded-full border text-sm font-bold transition-colors ${appRating === rating ? 'border-accent bg-accent text-paper' : 'border-line bg-paper text-ink/55 hover:border-accent'}`}
                  aria-label={`${rating} de 5`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
    );
  };

  const MealLog = () => {
    const { toast } = useToast();
    const [step, setStep] = useState<'pre' | 'meal' | 'post'>('pre');
    const [showHungerGuide, setShowHungerGuide] = useState(false);
    const [log, setLog] = useState<{ preHunger: number; preMood: string; postHunger: number; postMood: string; satisfaction: number; notes: string; photos: string[] }>({ preHunger: 5, preMood: 'Neutro', postHunger: 5, postMood: 'Neutro', satisfaction: 3, notes: '', photos: [] });

    const handleMealPhotos = async (files: FileList | null) => {
      const result = await readValidatedImages(files, log.photos.length);
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      if (result.images.length) {
        setLog(prev => ({ ...prev, photos: [...prev.photos, ...result.images] }));
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

    return (
      <PageWrapper>
        <div className="space-y-8">
          <header className="flex items-center gap-4 border-b border-line pb-6">
            <button onClick={() => step === 'pre' ? setCurrentPage('dashboard') : setStep(step === 'meal' ? 'pre' : 'meal')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="label-sm text-accent">Passo {step === 'pre' ? '1' : step === 'meal' ? '2' : '3'}</span>
              <h2 className="display-title text-3xl">{step === 'pre' ? 'Pré-refeição' : step === 'meal' ? 'A Refeição' : 'Pós-refeição'}</h2>
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
              {step === 'pre' && (
                <>
                  <div className="mobile-card-padding bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <div className="mb-6 flex items-center justify-between gap-3">
                      <h3 className="font-bold">De onde vem sua vontade de comer?</h3>
                      <button type="button" onClick={() => setShowHungerGuide(true)} className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/15">
                        <HelpCircle size={15} /> Diferenciar fomes
                      </button>
                    </div>
                    <HungerOdometer value={log.preHunger} onChange={v => setLog({ ...log, preHunger: v })} />
                  </div>
                  <div className="mobile-card-padding bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-4">Como você está se sentindo agora?</h3>
                    <div className="mood-grid">
                      {moods.map(m => (
                        <button key={m.label} onClick={() => setLog({ ...log, preMood: m.label })}
                          className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border-2 px-2 py-4 text-center transition-all ${log.preMood === m.label ? 'border-accent bg-accent/10 text-accent' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}>
                          <m.icon size={24} />
                          <span className="text-[10px] font-bold leading-tight">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setStep('meal')} className="w-full py-6 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg">
                    Iniciar Refeição
                  </button>
                </>
              )}
              {step === 'meal' && (
                <>
                  <div className="meal-photo-actions w-full">
                    <button className="flex-1 aspect-video rounded-[2rem] border-2 border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center gap-3 text-accent hover:bg-accent/10 transition-colors relative overflow-hidden">
                      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={(e) => handleMealPhotos(e.target.files)} />
                      <Camera size={32} />
                      <span className="font-bold text-sm">Câmera</span>
                    </button>
                    <button className="flex-1 aspect-video rounded-[2rem] border-2 border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center gap-3 text-accent hover:bg-accent/10 transition-colors relative overflow-hidden">
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={(e) => handleMealPhotos(e.target.files)} />
                      <Library size={32} />
                      <span className="font-bold text-sm">Galeria</span>
                    </button>
                  </div>
                  <div className="rounded-[2rem] border border-line bg-white p-4">
                    <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-sm">Fotos adicionadas</h3>
                        <p className="text-xs text-ink/45">JPG, PNG ou WEBP até {MAX_IMAGE_SIZE_MB}MB cada.</p>
                      </div>
                      <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full">{log.photos.length}/{MAX_MEAL_PHOTOS}</span>
                    </div>
                    {log.photos.length === 0 ? (
                      <div className="h-24 rounded-2xl bg-ink/5 border border-dashed border-line flex items-center justify-center text-xs font-bold text-ink/35">
                        Nenhuma foto adicionada
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {log.photos.map((photo, index) => (
                          <div key={photo.slice(0, 48) + index} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-line">
                            <img src={photo} alt={`Foto da refeição ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => setLog(prev => ({ ...prev, photos: prev.photos.filter((_, photoIndex) => photoIndex !== index) }))}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-ink/75 text-paper flex items-center justify-center"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea placeholder="O que você está comendo? Quais as texturas e sabores?"
                    className="w-full h-40 bg-paper border border-line rounded-[2rem] p-5 text-base font-medium resize-none focus:outline-none focus:border-accent shadow-sm sm:p-8 sm:text-lg"
                    value={log.notes} onChange={e => setLog({ ...log, notes: e.target.value })} />
                  <button onClick={() => setStep('post')} className="w-full py-6 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg">
                    Finalizar Refeição
                  </button>
                </>
              )}
              {step === 'post' && (
                <>
                  <div className="mobile-card-padding bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-6">Reavalie sua fome (Saciedade)</h3>
                    <HungerOdometer value={log.postHunger} onChange={v => setLog({ ...log, postHunger: v })} />
                  </div>
                  <div className="mobile-card-padding bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-4">Como se sente após comer?</h3>
                    <div className="mood-grid">
                      {moods.map(m => (
                        <button key={m.label} onClick={() => setLog({ ...log, postMood: m.label })}
                          className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border-2 px-2 py-4 text-center transition-all ${log.postMood === m.label ? 'border-accent bg-accent/10 text-accent' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}>
                          <m.icon size={24} />
                          <span className="text-[10px] font-bold leading-tight">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mobile-card-padding bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-1">Como você se sente após comer?</h3>
                    <p className="mb-4 text-sm leading-relaxed text-ink/55">Avalie o quanto esta refeição atendeu às suas necessidades físicas.</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        { value: 0, label: 'Nada satisfeito(a)' },
                        { value: 1, label: 'Muito pouco satisfeito(a)' },
                        { value: 2, label: 'Pouco satisfeito(a)' },
                        { value: 3, label: 'Moderadamente satisfeito(a)' },
                        { value: 4, label: 'Satisfeito(a)' },
                        { value: 5, label: 'Muito satisfeito(a)' },
                      ].map(({ value, label }) => (
                        <button key={value} onClick={() => setLog({ ...log, satisfaction: value })}
                          className={`min-h-20 rounded-2xl border-2 px-3 py-3 text-left transition-all ${log.satisfaction === value ? 'bg-accent border-accent text-paper' : 'border-line bg-transparent hover:bg-line text-ink'}`}>
                          <span className="block text-lg font-bold">{value}</span>
                          <span className="mt-1 block text-[10px] font-bold leading-tight">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => {
                    const inferredType = inferMealType(log);
                    const newMeal = {
                      ...log,
                      title: 'Refeição',
                      date: new Date().toISOString(),
                      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                      type: inferredType,
                      inferredType,
                      mood: log.postMood || log.preMood,
                      hungerDelta: log.postHunger - log.preHunger,
                      image: log.photos[0] || ''
                    };
                    saveMeal(newMeal);
                    toast('Registro salvo. Seus insights foram atualizados.', 'success');
                    setCurrentPage('dashboard');
                  }} className="w-full py-6 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg animated-gradient">
                    Salvar Registro Diário
                  </button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>
            {showHungerGuide && (
              <div className="modal-shell fixed inset-0 z-50 flex">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={MODAL_BACKDROP_CLASS} onClick={() => setShowHungerGuide(false)} />
                <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} className="modal-panel relative max-w-xl bg-paper p-6 shadow-2xl sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="label-sm text-accent">Pausa de observação</span>
                      <h3 className="modal-title mt-2 font-bold">Fome física ou emocional?</h3>
                    </div>
                    <button type="button" onClick={() => setShowHungerGuide(false)} className="icon-button h-10 w-10"><X size={18} /></button>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-ink/60">Não há resposta certa. Use estes sinais apenas como apoio para se escutar com mais gentileza.</p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <section className="rounded-3xl border border-accent/20 bg-accent/5 p-5">
                      <h4 className="font-bold text-accent">🍽 Fome física</h4>
                      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink/70">
                        <li>• Estômago vazio ou roncando.</li>
                        <li>• Faz algumas horas desde a última refeição.</li>
                        <li>• Falta de energia.</li>
                        <li>• Aceitaria diferentes tipos de alimento.</li>
                      </ul>
                    </section>
                    <section className="rounded-3xl border border-accent-pink/25 bg-accent-pink/10 p-5">
                      <h4 className="font-bold text-accent-pink">💭 Fome emocional</h4>
                      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink/70">
                        <li>• Vontade ligada a ansiedade, estresse, tristeza, tédio ou preocupação.</li>
                        <li>• Desejo por um alimento específico.</li>
                        <li>• Vontade que surgiu de repente.</li>
                        <li>• Sem sinais físicos claros de fome.</li>
                      </ul>
                    </section>
                  </div>
                  <button type="button" onClick={() => setShowHungerGuide(false)} className="mt-6 w-full rounded-full bg-accent py-4 text-sm font-bold text-paper">Voltar ao registro</button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </PageWrapper>
    );
  };

  const ProgressPage = () => {
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

    useEffect(() => {
      if (showMetricsModal) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
    }, [showMetricsModal]);

    const handleSaveMetrics = () => {
      const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const updatedProfile = { ...userProfile };
      
      const updateEvolution = (key: 'weightEvolution' | 'waistEvolution' | 'armEvolution' | 'abdomenEvolution' | 'hipEvolution', val: number) => {
        if (val <= 0) return;
        const arr = (updatedProfile[key] as any[]) || [];
        (updatedProfile[key] as any) = [...arr, { date, value: val }];
      };

      updateEvolution('weightEvolution', newMetrics.weight);
      updateEvolution('waistEvolution', newMetrics.waist);
      updateEvolution('armEvolution', newMetrics.arm);
      updateEvolution('abdomenEvolution', newMetrics.abdomen);
      updateEvolution('hipEvolution', newMetrics.hip);

      if (updatedProfile.height && newMetrics.weight) {
        const recalculatedNeeds = calculateNutritionalNeeds(
          newMetrics.weight,
          updatedProfile.height,
          updatedProfile.age || 25,
          updatedProfile.gender,
          updatedProfile.activityLevel || 1.2,
          updatedProfile.objectives || []
        );
        updatedProfile.imc = recalculatedNeeds.imc;
        updatedProfile.tmb = recalculatedNeeds.tmb;
        updatedProfile.net = recalculatedNeeds.net;
      }

      persistUserProfile(updatedProfile);
      setShowMetricsModal(false);
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
    const rcqLimit = userProfile.gender === 'Feminino' || userProfile.gender === 'Mulher' ? 0.85 : 0.9;

    const imcData = (userProfile.weightEvolution || []).map(w => ({
      date: w.date,
      value: userProfile.height ? parseFloat((w.value / Math.pow(userProfile.height / 100, 2)).toFixed(1)) : 0
    })).filter(item => item.value > 0);
    const hasWeightData = Boolean(userProfile.weightEvolution?.some(item => item.value > 0));
    const hasImcData = imcData.length > 0;

    const rcqData = buildRcqData(userProfile);
    const hungerPieData = [
      { name: 'Fome Física', value: physicalMeals },
      { name: 'Fome Emocional', value: emotionalMeals },
      { name: 'Não classificada', value: unclassifiedMeals },
    ].filter(item => item.value > 0);
    const chartPieData = hungerPieData.length ? hungerPieData : [{ name: 'Nenhuma refeição registrada', value: 1 }];
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const emotionalData = dayLabels.map((day, index) => {
      const meals = loggedMeals.filter((meal: any) => new Date(meal.date || Date.now()).getDay() === index);
      const types = meals.map((meal: any) => inferMealType(meal));
      const moodAverage = averageNumbers(meals.flatMap((meal: any) => [
        getMoodScore(meal.postMood),
        getMoodScore(meal.preMood),
        getMoodScore(meal.mood),
      ]));
      return {
        day,
        fisico: types.filter(type => type === 'Física').length,
        emocional: types.filter(type => type === 'Emocional').length,
        humor: moodAverage ? Math.round(moodAverage) : 0,
      };
    });
    const hasMealData = loggedMeals.length > 0;
    const hasEnoughMealData = loggedMeals.length >= 3;
    const missingMealLogs = Math.max(3 - loggedMeals.length, 0);
    const insightNotice = hasMealData
      ? {
        label: 'Amostra em construção',
        title: 'Já existe leitura inicial, mas os padrões ainda precisam de mais contexto.',
        description: `Ainda faltam ${missingMealLogs} registro${missingMealLogs === 1 ? '' : 's'} para comparar tendências com mais segurança. Os gráficos abaixo usam os sinais já preenchidos sem tratar isso como diagnóstico.`,
        action: 'Registrar refeição',
      }
      : hasInitialInsightData
        ? {
          label: 'Dados iniciais disponíveis',
          title: 'Já dá para gerar uma leitura inicial do perfil.',
          description: 'Use essa leitura como ponto de partida. Registre refeições para revelar padrões de fome, humor, saciedade e constância ao longo dos dias.',
          action: 'Registrar primeira refeição',
        }
        : {
          label: 'Perfil incompleto',
          title: 'Complete os dados iniciais para liberar os primeiros insights.',
          description: 'Altura, peso, objetivo, emoções e gatilhos ajudam o app a calcular métricas corporais e personalizar a análise sem usar dados genéricos.',
          action: 'Completar perfil',
        };

    return (
    <PageWrapper>
      <div className="space-y-10">
        <div className="responsive-page-header">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('dashboard')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="display-title text-5xl">Insights.</h2>
              <p className="serif-body text-xl text-ink/60 mt-1 italic">Análise do seu comportamento.</p>
            </div>
          </div>
          <button onClick={() => setShowMetricsModal(true)} className="hidden md:flex bg-accent text-paper px-6 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-accent/90 transition-colors items-center gap-2">
            <PlusCircle size={18} /> Adicionar Métricas Corporais
          </button>
        </div>
        
        <div className="md:hidden">
          <button onClick={() => setShowMetricsModal(true)} className="w-full bg-accent text-paper px-6 py-4 rounded-2xl font-bold text-sm shadow-sm hover:bg-accent/90 transition-colors flex justify-center items-center gap-2">
            <PlusCircle size={18} /> Adicionar Métricas Corporais
          </button>
        </div>

        {!hasEnoughMealData && (
          <section className="bg-white border border-line rounded-[2rem] p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Activity size={26} />
              </div>
              <div className="flex-1">
                <span className="label-sm text-accent">{insightNotice.label}</span>
                <h3 className="font-bold text-xl mt-2">{insightNotice.title}</h3>
                <p className="text-sm text-ink/60 mt-2 leading-relaxed">
                  {insightNotice.description}
                </p>
              </div>
              <button onClick={() => setCurrentPage(hasInitialInsightData ? 'meal-log' : 'diagnosis')} className="bg-accent text-paper px-5 py-3 rounded-2xl font-bold text-sm shadow-sm hover:bg-accent/90 transition-colors">
                {insightNotice.action}
              </button>
            </div>
          </section>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 min-w-0">
          <div className="mobile-card-padding animated-gradient text-paper p-10 rounded-[2.5rem] shadow-lg flex flex-col justify-center lg:col-span-1">
            <h3 className="label-sm text-paper mb-4 glass-badge inline-block self-start font-bold">Consciência Plena</h3>
            <div className="text-7xl font-display mb-2 text-paper drop-shadow-md">{awarenessScore}%</div>
            <p className="text-sm font-medium text-paper/90 leading-relaxed">
              {loggedMeals.length
                ? 'Baseado na completude dos registros, fome, humor, saciedade e notas.'
                : hasInitialInsightData
                  ? 'Leitura inicial baseada no perfil preenchido. Refeições registradas deixam o score mais preciso.'
                  : 'Complete o perfil para iniciar uma leitura personalizada, sem dados demonstrativos.'}
            </p>
          </div>

          <div className="mobile-card-padding bg-white border border-line p-8 rounded-[2.5rem] shadow-sm lg:col-span-2 min-w-0">
            <h3 className="font-bold mb-2 flex items-center gap-2"><span className="text-accent"><Brain size={18} /></span> Sinais da sua jornada</h3>
            <p className="mb-5 text-sm leading-relaxed text-ink/55">Leitura indicativa de saciedade, consciência, energia, humor, constância e contexto. O polígono mostra somente os sinais preenchidos por você.</p>
            {hasInitialInsightData ? (
            <ChartFrame className="h-64" minHeight={180}>
              {({ width, height }) => (
                <RadarChart width={width} height={height} cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--ink)' }} />
                  <Radar name="Atual" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 12px 30px rgba(0,0,0,0.12)' }} formatter={(value: number) => [`${value}%`, 'Seu registro']} />
                </RadarChart>
              )}
            </ChartFrame>
            ) : (
              <div className="min-h-64 rounded-3xl border border-dashed border-line bg-paper/70 p-5 sm:p-8 flex flex-col justify-center">
                <span className="label-sm text-accent">Sem base inicial</span>
                <p className="font-bold text-xl mt-3">Complete perfil ou registre uma refeição para iniciar o radar.</p>
                <p className="text-sm text-ink/55 mt-2 leading-relaxed">O app não usa amostra falsa para preencher este gráfico. Altura, peso, objetivos, emoções ou registros reais já liberam uma primeira leitura.</p>
              </div>
            )}
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-accent/5 p-4 text-xs leading-relaxed text-ink/65">
              <Info size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>No celular, toque nos pontos do gráfico para ver o valor de cada sinal. Quanto mais registros reais, mais útil fica esta leitura.</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 min-w-0">
          <div className="mobile-card-padding bg-white border border-line p-8 rounded-[2.5rem] shadow-sm min-w-0">
            <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-bold flex items-center gap-2"><span className="text-accent"><TbHealthRecognition size={20} /></span> Evolução do Peso Corporal</h3>
              <div className="flex flex-wrap gap-4">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-ink/40"><div className="w-2 h-2 rounded-full bg-accent"></div> Atual</span>
                {weightGoal && (
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-ink/40"><div className="w-2 h-2 rounded-full bg-accent-pink"></div> Meta</span>
                )}
              </div>
            </div>
            {weightGoal && <p className="-mt-4 mb-5 text-xs leading-relaxed text-ink/50">A linha rosa é uma estimativa ligada ao objetivo escolhido e serve apenas como referência de acompanhamento.</p>}
            <p className="mb-5 text-sm leading-relaxed text-ink/55">Cada ponto representa uma medida registrada. Toque ou passe o cursor pelos pontos para comparar data e valor.</p>
            {hasWeightData ? (
              <ChartFrame className="h-64" minHeight={180}>
                {({ width, height }) => (
                  <AreaChart width={width} height={height} data={userProfile.weightEvolution}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="var(--accent)" floodOpacity="0.4" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.5} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 600 }} dy={10} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--ink)' }} dx={-10} />
                    <Tooltip
                      contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '1.25rem', backgroundColor: 'var(--paper)' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--accent)' }}
                    />
                    {weightGoal && (
                      <ReferenceLine y={weightGoal} stroke="var(--accent-pink)" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: `Meta (${weightGoal}kg)`, fill: 'var(--accent-pink)', fontSize: 10, fontWeight: 'bold' }} />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--accent)"
                      strokeWidth={5}
                      fillOpacity={1}
                      fill="url(#colorWeight)"
                      style={{ filter: 'url(#shadow)' }}
                      dot={{ r: 6, fill: 'var(--paper)', stroke: 'var(--accent)', strokeWidth: 3 }}
                      activeDot={{ r: 8, fill: 'var(--accent)', stroke: 'var(--paper)', strokeWidth: 4 }}
                      isAnimationActive
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                )}
              </ChartFrame>
            ) : (
              <div className="min-h-64 rounded-3xl bg-paper border border-dashed border-line p-6 flex flex-col justify-center">
                <span className="label-sm text-accent">Sem peso registrado</span>
                <p className="font-bold text-lg mt-2">Adicione seu peso para acompanhar tendência corporal.</p>
                <p className="text-sm text-ink/55 mt-2">O gráfico não usa dados demonstrativos. A primeira medida já cria o ponto inicial da evolução.</p>
              </div>
            )}
          </div>

          <div className="mobile-card-padding bg-white border border-line p-8 rounded-[2.5rem] shadow-sm min-w-0">
            <h3 className="font-bold flex items-center gap-2 mb-2"><span className="text-accent-pink"><Activity size={20} /></span> Evolução do IMC</h3>
            <p className="mb-6 text-sm leading-relaxed text-ink/55">Uma triagem geral calculada a partir de altura e peso. Acompanhe a tendência, sem transformar um número em julgamento.</p>
            {hasImcData ? (
              <ChartFrame className="h-64" minHeight={180}>
                {({ width, height }) => (
                  <AreaChart width={width} height={height} data={imcData}>
                    <defs>
                      <linearGradient id="colorIMC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-pink)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--accent-pink)" stopOpacity={0} />
                      </linearGradient>
                      <filter id="shadowIMC" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="var(--accent-pink)" floodOpacity="0.4" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.5} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 600 }} dy={10} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--ink)' }} dx={-10} />
                    <Tooltip
                      contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '1.25rem', backgroundColor: 'var(--paper)' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--accent-pink)' }}
                    />
                    <ReferenceLine y={24.9} stroke="var(--accent)" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: 'Ideal Max (24.9)', fill: 'var(--accent)', fontSize: 10, fontWeight: 'bold' }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--accent-pink)"
                      strokeWidth={5}
                      fillOpacity={1}
                      fill="url(#colorIMC)"
                      style={{ filter: 'url(#shadowIMC)' }}
                      dot={{ r: 6, fill: 'var(--paper)', stroke: 'var(--accent-pink)', strokeWidth: 3 }}
                      activeDot={{ r: 8, fill: 'var(--accent-pink)', stroke: 'var(--paper)', strokeWidth: 4 }}
                      isAnimationActive
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                )}
              </ChartFrame>
            ) : (
              <div className="min-h-64 rounded-3xl bg-paper border border-dashed border-line p-6 flex flex-col justify-center">
                <span className="label-sm text-accent-pink">IMC indisponível</span>
                <p className="font-bold text-lg mt-2">Informe altura e peso para calcular o IMC.</p>
                <p className="text-sm text-ink/55 mt-2">Esse indicador é uma triagem geral e fica mais útil quando acompanhado da evolução corporal.</p>
              </div>
            )}
          </div>

          {rcqData.length > 0 && (
            <div className="mobile-card-padding bg-white border border-line p-8 rounded-[2.5rem] shadow-sm lg:col-span-2 min-w-0">
              <h3 className="font-bold flex items-center gap-2 mb-2"><span className="text-ink/60"><Activity size={20} /></span> Evolução RCQ (Relação Cintura-Quadril)</h3>
              <p className="mb-6 text-sm leading-relaxed text-ink/55">Compara as medidas de cintura e quadril registradas na mesma data. A linha pontilhada é apenas uma referência de triagem.</p>
              <ChartFrame className="h-64" minHeight={180}>
                {({ width, height }) => (
                  <AreaChart width={width} height={height} data={rcqData}>
                    <defs>
                      <linearGradient id="colorRCQ" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--ink)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--ink)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.5} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 600 }} dy={10} />
                    <YAxis domain={[0, 'dataMax + 0.2']} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--ink)' }} dx={-10} />
                    <Tooltip
                      contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '1.25rem', backgroundColor: 'var(--paper)' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--ink)' }}
                    />
                    <ReferenceLine y={rcqLimit} stroke="var(--accent-pink)" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: 'Risco Elevado', fill: 'var(--accent-pink)', fontSize: 10, fontWeight: 'bold' }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--ink)"
                      strokeWidth={5}
                      fillOpacity={1}
                      fill="url(#colorRCQ)"
                      dot={{ r: 6, fill: 'var(--paper)', stroke: 'var(--ink)', strokeWidth: 3 }}
                      activeDot={{ r: 8, fill: 'var(--ink)', stroke: 'var(--paper)', strokeWidth: 4 }}
                      isAnimationActive
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                )}
              </ChartFrame>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 min-w-0">
          <div className="mobile-card-padding bg-white border border-line p-8 rounded-[2.5rem] shadow-sm flex flex-col min-w-0">
            <h3 className="font-bold mb-2 flex items-center gap-2"><span className="text-accent-pink"><Zap size={18} /></span> Fontes de Fome</h3>
            <p className="mb-4 text-sm leading-relaxed text-ink/55">Mostra como os registros foram classificados a partir de fome, humor e satisfação. É uma leitura de padrão, não um rótulo.</p>
            {hasMealData ? (
            <div className="flex-1 flex flex-col gap-5 sm:flex-row sm:items-center">
              <ChartFrame className="h-44 w-full sm:w-1/2" minHeight={140}>
                {({ width, height }) => (
                  <PieChart width={width} height={height}>
                    <Pie data={chartPieData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" isAnimationActive animationDuration={750} animationEasing="ease-out">
                      {chartPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                )}
              </ChartFrame>
              <div className="w-full space-y-3 sm:w-1/2">
                {chartPieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs font-bold">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
            ) : (
              <div className="min-h-44 rounded-3xl bg-paper border border-dashed border-line p-6 flex flex-col justify-center">
                <span className="label-sm text-accent-pink">Sem refeições registradas</span>
                <p className="font-bold text-lg mt-2">Registre uma refeição para comparar fontes de fome.</p>
                <p className="text-sm text-ink/55 mt-2">A classificação considera fome antes/depois, humor e satisfação. Sem registro real, o app não cria uma proporção artificial.</p>
              </div>
            )}
          </div>

          <div className="mobile-card-padding bg-white border border-line p-8 rounded-[2.5rem] shadow-sm min-w-0">
            <h3 className="font-bold mb-2 flex items-center gap-2"><span className="text-accent-pink"><PiHeartbeat size={20} /></span> Oscilação Emocional</h3>
            <p className="mb-5 text-sm leading-relaxed text-ink/55">Compare, ao longo da semana, os registros associados à fome física e à fome emocional. Toque em cada coluna para detalhar o dia.</p>
            {hasMealData ? (
            <>
            <ChartFrame className="h-56" minHeight={160}>
              {({ width, height }) => (
                <BarChart width={width} height={height} data={emotionalData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dy={10} />
                  <Tooltip cursor={{ fill: 'var(--line)', opacity: 0.5 }} contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="fisico" stackId="a" fill="var(--accent)" radius={[0, 0, 6, 6]} barSize={16} isAnimationActive animationDuration={750} />
                  <Bar dataKey="emocional" stackId="a" fill="var(--accent-pink)" radius={[6, 6, 0, 0]} barSize={16} isAnimationActive animationDuration={750} />
                </BarChart>
              )}
            </ChartFrame>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mt-6">
              <span className="flex items-center gap-2 text-xs font-bold"><div className="w-4 h-4 rounded-full bg-accent"></div> Fome Física</span>
              <span className="flex items-center gap-2 text-xs font-bold"><div className="w-4 h-4 rounded-full bg-accent-pink"></div> Fome Emocional</span>
            </div>
            </>
            ) : (
              <div className="min-h-56 rounded-3xl bg-paper border border-dashed border-line p-6 flex flex-col justify-center">
                <span className="label-sm text-accent-pink">Linha do tempo em espera</span>
                <p className="font-bold text-lg mt-2">O gráfico semanal aparece após o primeiro registro de refeição.</p>
                <p className="text-sm text-ink/55 mt-2">Use o registro de refeição para informar humor e saciedade. Esses dados tornam os insights mais úteis e menos genéricos.</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Refeições', val: String(loggedMeals.length), icon: Coffee, trend: hasEnoughMealData ? 'amostra' : hasMealData ? 'inicial' : 'zero' },
            { label: 'Físicas', val: String(physicalMeals), icon: Activity, trend: hasMealData ? `${Math.round((physicalMeals / loggedMeals.length) * 100)}%` : 'sem dados' },
            { label: 'Emocionais', val: String(emotionalMeals), icon: Heart, trend: hasMealData ? `${Math.round((emotionalMeals / loggedMeals.length) * 100)}%` : 'sem dados' },
            { label: 'Foco', val: `${awarenessScore}%`, icon: TrendingUp, trend: hasMealData ? 'registros' : profileReadinessScore ? 'perfil' : 'pendente' },
          ].map((m, i) => (
            <div key={i} className="bg-accent/5 p-4 sm:p-6 rounded-3xl border border-accent/10">
              <m.icon size={20} className="text-accent mb-3" />
              <div className="text-2xl font-display text-ink">{m.val}</div>
              <div className="flex flex-col gap-1 mt-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] font-bold text-ink/40 uppercase">{m.label}</span>
                <span className="text-[10px] font-bold text-accent">{m.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showMetricsModal && (
          <div className="modal-shell fixed inset-0 z-50 flex">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={MODAL_BACKDROP_CLASS} onClick={() => setShowMetricsModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 24 }} className="modal-panel relative w-full max-w-3xl bg-paper p-5 shadow-2xl sm:p-7 md:p-10">
              <button type="button" onClick={() => setShowMetricsModal(false)} className="icon-button absolute right-5 top-5 h-10 w-10"><X size={18} /></button>
              <div className="pr-12">
                <span className="label-sm text-accent">Acompanhamento corporal</span>
                <h3 className="display-title modal-title mt-2">Atualizar métricas</h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/60">Registre apenas o que fizer sentido para você. Comparar medidas em condições parecidas ajuda a perceber tendências, não a buscar perfeição.</p>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {metricFields.map((field) => {
                  const MetricIcon = field.icon;
                  return (
                    <label key={field.key} className="group rounded-3xl border border-line bg-white p-4 transition-colors hover:border-accent/45 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
                      <span className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><MetricIcon size={20} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2"><span className="font-bold">{field.label}</span><span className="text-xs font-bold text-ink/40">{field.unit}</span></span>
                          <span className="mt-1 block text-xs leading-relaxed text-ink/50">{field.hint}</span>
                        </span>
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={newMetrics[field.key] || ''}
                        onChange={e => setNewMetrics({ ...newMetrics, [field.key]: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="mt-4 w-full border-b-2 border-line bg-transparent py-2 text-2xl font-bold outline-none transition-colors placeholder:text-ink/20 focus:border-accent"
                      />
                    </label>
                  );
                })}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-accent/5 p-4 text-xs leading-relaxed text-ink/60">
                <Info size={16} className="mt-0.5 shrink-0 text-accent" />
                <span>As informações ficam no seu perfil para compor os gráficos de evolução. Você pode atualizar somente uma medida por vez.</span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setShowMetricsModal(false)} className="rounded-full border border-line px-5 py-4 text-sm font-bold text-ink/60 hover:bg-white">Cancelar</button>
                <button onClick={handleSaveMetrics} className="rounded-full bg-accent px-5 py-4 text-sm font-bold text-paper shadow-lg shadow-accent/20 transition-transform hover:scale-[1.01]">Salvar métricas</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </PageWrapper>
  );
};

  const ContentPage = () => {
    return (
      <PageWrapper>
        <div className="space-y-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('dashboard')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="display-title text-5xl">Biblioteca.</h2>
              <p className="serif-body text-xl text-ink/60 mt-1 italic">Conhecimento que nutre.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {DEFAULT_LIBRARY_ARTICLES.map((item) => (
              <button key={item.id} onClick={() => setSelectedArticle(item)} className="group text-left bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm hover:shadow-lg transition-all">
                <div className="h-44 w-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-ink/20 group-hover:bg-transparent transition-colors z-10" />
                  <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-4 left-4 z-20 bg-paper/95 backdrop-blur-md px-4 py-1.5 rounded-full label-sm text-accent">
                    {item.type}
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="font-bold text-xl mb-2 leading-tight">{item.title}</h3>
                  <p className="text-xs text-ink/60 line-clamp-2 mb-4 leading-relaxed">{item.summary}</p>
                  <div className="flex items-center gap-2 text-accent text-xs font-bold">
                    <Library size={14} /> {item.duration} de leitura
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </PageWrapper>
    );
  };

  const MealDetailsPage = () => {
    if (!selectedMeal) return null;
    const mealType = inferMealType(selectedMeal);
    const mealMood = selectedMeal.postMood || selectedMeal.preMood || selectedMeal.mood || 'Não informado';
    const MealIcon = selectedMeal.icon || (mealType === 'Física' ? TbHealthRecognition : mealType === 'Emocional' ? PiHeartbeat : Coffee);
    const mealPhotos = selectedMeal.photos?.length ? selectedMeal.photos : (selectedMeal.image ? [selectedMeal.image] : []);
    return (
      <PageWrapper>
        <div className="space-y-8">
          <header className="flex items-center gap-4 border-b border-line pb-6">
            <button onClick={() => setCurrentPage('dashboard')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="label-sm text-accent">Detalhes da Refeição</span>
              <h2 className="display-title text-3xl">{selectedMeal.title}</h2>
            </div>
          </header>

          <div className="bg-white border border-line rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="h-64 md:h-96 w-full relative bg-accent/5">
              {mealPhotos[0] ? (
                <img src={mealPhotos[0]} alt={selectedMeal.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-ink/35 gap-3">
                  <Coffee size={42} />
                  <span className="text-sm font-bold">Sem foto nesta refeição</span>
                </div>
              )}
              <div className="absolute top-4 right-4 bg-paper/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-md">
                <MealIcon size={16} className={mealType === 'Física' ? 'text-accent' : mealType === 'Emocional' ? 'text-accent-pink' : 'text-ink/50'} />
                <span className="text-xs font-bold uppercase">{selectedMeal.time}</span>
              </div>
            </div>
            
            <div className="p-5 sm:p-8 space-y-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex-1 bg-accent/5 rounded-3xl p-6 border border-accent/10">
                  <span className="label-sm text-accent mb-2 block">Tipo de Fome</span>
                  <div className="text-xl font-bold flex items-center gap-2">
                    {mealType === 'Física' ? <TbHealthRecognition size={24} /> : mealType === 'Emocional' ? <PiHeartbeat size={24} /> : <Coffee size={24} />}
                    {mealType}
                  </div>
                </div>
                <div className="flex-1 bg-ink/5 rounded-3xl p-6 border border-line">
                  <span className="label-sm text-ink/50 mb-2 block">Estado Emocional</span>
                  <div className="text-xl font-bold flex items-center gap-2">
                    <Smile size={24} className="text-ink/70" />
                    {mealMood}
                  </div>
                </div>
              </div>

              {mealPhotos.length > 0 && (
                <div>
                  <h3 className="font-bold text-xl mb-4">Fotos da Refeição</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {mealPhotos.map((photo: string, index: number) => (
                      <div key={photo.slice(0, 48) + index} className="aspect-square overflow-hidden rounded-3xl border border-line bg-line">
                        <img src={photo} alt={`Foto da refeição ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-bold text-xl mb-4">Notas da Refeição</h3>
                <div className="p-6 bg-paper border border-line rounded-3xl text-ink/80 text-lg leading-relaxed shadow-inner">
                  "{selectedMeal.notes}"
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  };

  const AccountSettings = () => {
    const { toast } = useToast();
    const [editMode, setEditMode] = useState<'none' | 'name' | 'email' | 'photo' | 'all'>('none');
    const [name, setName] = useState(userProfile.name);
    const [email, setEmail] = useState(userProfile.email);
    const [draftProfile, setDraftProfile] = useState<UserProfile>(userProfile);

    const updateDraftList = (field: keyof UserProfile, value: string) => {
      setDraftProfile(prev => ({
        ...prev,
        [field]: value.split(',').map(item => item.trim()).filter(Boolean),
      }));
    };

    const updateLatestMetric = (field: keyof UserProfile, value: number) => {
      setDraftProfile(prev => {
        const current = ([...(prev[field] as any[] || [])]);
        const entry = { date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value };
        if (current.length) current[current.length - 1] = { ...current[current.length - 1], value };
        else current.push(entry);
        return { ...prev, [field]: current } as UserProfile;
      });
    };

    const handleSave = () => {
      let newProfile = editMode === 'all' ? { ...draftProfile } : { ...userProfile };
      if (editMode === 'name') newProfile.name = name;
      if (editMode === 'email') newProfile.email = email;
      if (editMode === 'all') {
        const latestWeight = newProfile.weightEvolution?.[newProfile.weightEvolution.length - 1]?.value || 0;
        const result = calculateNutritionalNeeds(latestWeight, newProfile.height, newProfile.age, newProfile.gender, newProfile.activityLevel, newProfile.objectives);
        newProfile = { ...newProfile, ...result };
      }
      persistUserProfile(newProfile);
      toast('Perfil atualizado com sucesso!', 'success');
      setEditMode('none');
      setCurrentPage('profile');
    };

    return (
      <PageWrapper>
        <div className="space-y-12">
          <button onClick={() => setCurrentPage('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="display-title text-5xl">Conta.</h2>
          
          {editMode === 'none' && (
            <div className="space-y-4 max-w-md">
              <p className="serif-body text-xl text-ink/60 mb-6">O que deseja atualizar?</p>
              {[
                { key: 'name', label: 'Nome', desc: 'Alterar seu nome de exibição', icon: User },
                { key: 'email', label: 'E-mail', desc: 'Atualizar seu endereço de e-mail', icon: Mail },
                { key: 'photo', label: 'Foto', desc: 'Trocar sua foto de perfil', icon: Camera },
                { key: 'all', label: 'Todos os dados', desc: 'Editar todas as informações', icon: Edit2 },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setDraftProfile(userProfile); setName(userProfile.name); setEmail(userProfile.email); setEditMode(item.key as any); }}
                  className="w-full p-5 sm:p-6 bg-white border border-line rounded-3xl shadow-sm hover:border-accent hover:bg-accent/5 transition-all flex items-center gap-4 text-left"
                >
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{item.label}</h4>
                    <p className="text-xs text-ink/50">{item.desc}</p>
                  </div>
                  <ChevronRight size={20} className="text-ink/20 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {editMode !== 'none' && (
            <div className="space-y-8 max-w-md">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setEditMode('none')} className="p-2 rounded-full hover:bg-line transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <h3 className="font-bold text-xl">
                  {editMode === 'name' ? 'Editar Nome' : editMode === 'email' ? 'Editar E-mail' : editMode === 'photo' ? 'Editar Foto' : 'Editar Todos os Dados'}
                </h3>
              </div>

              {(editMode === 'name' || editMode === 'all') && (
                <div>
                  <label className="label-sm text-ink/50">Nome de exibição</label>
                  <input value={editMode === 'all' ? draftProfile.name : name} onChange={e => {
                    if (editMode === 'all') setDraftProfile(prev => ({ ...prev, name: e.target.value }));
                    setName(e.target.value);
                  }} className="w-full py-4 bg-transparent border-b-2 border-line focus:border-accent outline-none text-xl font-bold" />
                </div>
              )}

              {(editMode === 'email' || editMode === 'all') && (
                <div>
                  <label className="label-sm text-ink/50">E-mail</label>
                  <input value={editMode === 'all' ? draftProfile.email : email} onChange={e => {
                    if (editMode === 'all') setDraftProfile(prev => ({ ...prev, email: e.target.value }));
                    setEmail(e.target.value);
                  }} className="w-full py-4 bg-transparent border-b-2 border-line focus:border-accent outline-none text-xl font-bold" />
                </div>
              )}

              {editMode === 'all' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-sm text-ink/50">Idade</label>
                      <input type="number" value={draftProfile.age || ''} onChange={e => setDraftProfile(prev => ({ ...prev, age: parseFloat(e.target.value) || 0 }))} className="w-full py-4 bg-transparent border-b-2 border-line focus:border-accent outline-none text-xl font-bold" />
                    </div>
                    <div>
                      <label className="label-sm text-ink/50">Altura (cm)</label>
                      <input type="number" value={draftProfile.height || ''} onChange={e => setDraftProfile(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))} className="w-full py-4 bg-transparent border-b-2 border-line focus:border-accent outline-none text-xl font-bold" />
                    </div>
                  </div>
                  <div>
                    <label className="label-sm text-ink/50">Gênero</label>
                    <select value={draftProfile.gender} onChange={e => setDraftProfile(prev => ({ ...prev, gender: e.target.value }))} className="w-full py-4 bg-transparent border-b-2 border-line focus:border-accent outline-none text-lg font-bold">
                      <option value="">Selecione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Não-binário">Não-binário</option>
                      <option value="Prefiro não identificar">Prefiro não identificar</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-sm text-ink/50">Nível de atividade</label>
                    <select value={draftProfile.activityLevel || 1.2} onChange={e => setDraftProfile(prev => ({ ...prev, activityLevel: parseFloat(e.target.value) }))} className="w-full py-4 bg-transparent border-b-2 border-line focus:border-accent outline-none text-lg font-bold">
                      <option value={1.2}>Sedentário</option>
                      <option value={1.375}>Levemente ativo</option>
                      <option value={1.55}>Moderadamente ativo</option>
                      <option value={1.725}>Muito ativo</option>
                    </select>
                  </div>
                  {[
                    { field: 'objectives', label: 'Objetivos' },
                    { field: 'initialEmotions', label: 'Emoções iniciais' },
                    { field: 'triggers', label: 'Gatilhos' },
                    { field: 'foods', label: 'Preferências alimentares' },
                    { field: 'comorbidities', label: 'Condições de saúde' },
                  ].map(item => (
                    <div key={item.field}>
                      <label className="label-sm text-ink/50">{item.label}</label>
                      <input value={((draftProfile[item.field as keyof UserProfile] as string[]) || []).join(', ')} onChange={e => updateDraftList(item.field as keyof UserProfile, e.target.value)} className="w-full py-4 bg-transparent border-b-2 border-line focus:border-accent outline-none text-base font-bold" />
                    </div>
                  ))}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { field: 'weightEvolution', label: 'Peso (kg)' },
                      { field: 'waistEvolution', label: 'Cintura (cm)' },
                      { field: 'abdomenEvolution', label: 'Abdômen (cm)' },
                      { field: 'hipEvolution', label: 'Quadril (cm)' },
                      { field: 'armEvolution', label: 'Braço (cm)' },
                    ].map(item => {
                      const values = (draftProfile[item.field as keyof UserProfile] as any[]) || [];
                      return (
                        <div key={item.field}>
                          <label className="label-sm text-ink/50">{item.label}</label>
                          <input type="number" value={values[values.length - 1]?.value || ''} onChange={e => updateLatestMetric(item.field as keyof UserProfile, parseFloat(e.target.value) || 0)} className="w-full py-4 bg-transparent border-b-2 border-line focus:border-accent outline-none text-xl font-bold" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {editMode === 'photo' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <ProfileAvatar photo={userProfile.photo} size="xl" className="border-4 border-accent shadow-lg" />
                    <label className="absolute bottom-0 right-0 w-10 h-10 bg-ink text-paper rounded-full flex items-center justify-center shadow-lg border-2 border-paper cursor-pointer">
                      <Camera size={18} />
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
                        const result = await readValidatedImages(e.target.files, 0);
                        if (result.error) {
                          toast(result.error, 'error');
                          return;
                        }
                        if (result.images[0]) {
                          const newProfile = { ...userProfile, photo: result.images[0] };
                          persistUserProfile(newProfile);
                          toast('Foto atualizada!', 'success');
                        }
                      }} />
                    </label>
                  </div>
                  <button onClick={handleSave} className="w-full py-5 bg-accent text-paper rounded-full font-bold shadow-lg hover:bg-accent/90 transition-colors">
                    Salvar Foto
                  </button>
                </div>
              )}

              {editMode !== 'photo' && (
                <button onClick={handleSave} className="w-full py-5 bg-accent text-paper rounded-full font-bold shadow-lg hover:bg-accent/90 transition-colors">
                  Salvar Alterações
                </button>
              )}
            </div>
          )}
        </div>
      </PageWrapper>
    );
  };

  const ThemeSettings = () => (
    <PageWrapper>
      <div className="space-y-12">
        <button onClick={() => setCurrentPage('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="display-title text-5xl">Temas.</h2>
          <p className="serif-body text-xl text-ink/60 mt-2">Escolha uma paleta para o app.</p>
        </div>
        <div className="grid gap-4 max-w-2xl">
          {APP_THEMES.map(theme => {
            const active = theme.id === themeId;
            return (
              <button
                key={theme.id}
                onClick={() => setThemeId(theme.id)}
                className={`w-full p-5 bg-white border rounded-3xl shadow-sm text-left transition-all ${active ? 'border-accent ring-4 ring-accent/10' : 'border-line hover:border-accent/50'}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg">{theme.name}</h3>
                    <p className="text-xs text-ink/50 font-medium mt-1">{theme.description}</p>
                  </div>
                  {active && <CheckCircle size={20} className="text-accent shrink-0" />}
                </div>
                <div className="flex gap-2 mt-4">
                  {[theme.colors.ink, theme.colors.paper, theme.colors.accent, theme.colors.accentPink, theme.colors.accentLight].map((color, index) => (
                    <span key={index} className="w-9 h-9 rounded-full border border-line shadow-sm" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </PageWrapper>
  );

  const PrivacySettings = () => {
    const { toast } = useToast();
    const [privacyPrefs, setPrivacyPrefs] = useState<Record<string, boolean>>(() => {
      const saved = localStorage.getItem('mindPrivacyPrefs');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
      return { privateProfile: true, cloudBackup: true, twoFactor: false };
    });

    const updatePrivacyPref = (key: string) => {
      const updated = { ...privacyPrefs, [key]: !privacyPrefs[key] };
      setPrivacyPrefs(updated);
      localStorage.setItem('mindPrivacyPrefs', JSON.stringify(updated));
      toast('Preferencia de privacidade atualizada.', 'success');
    };

    const handleDeleteData = async () => {
      if (!window.confirm('Apagar seus dados de perfil e refeicoes do banco? Esta acao nao pode ser desfeita.')) return;
      try {
        if (currentUserId) await deleteCurrentUserData(currentUserId);
        await supabase?.auth.signOut();
        localStorage.removeItem('nutriUser');
        localStorage.removeItem('nutriMeals');
        setLoggedMeals([]);
        setCurrentUserId(null);
        toast('Seus dados foram apagados.', 'success');
        setCurrentPage('landing');
      } catch (err) {
        toast('Nao foi possivel apagar os dados no banco agora.', 'error');
      }
    };

    const privacyOptions = [
      { key: 'privateProfile', title: 'Perfil Privado', desc: 'Seus dados visiveis apenas para voce.' },
      { key: 'cloudBackup', title: 'Backup na Nuvem', desc: 'Sincronize seus dados em outros dispositivos quando o Supabase estiver ativo.' },
      { key: 'twoFactor', title: 'Autenticacao em 2 Passos', desc: 'Preferencia registrada. A ativacao final depende do provedor de autenticacao.' },
    ];

    return (
      <PageWrapper>
        <div className="space-y-12">
          <button onClick={() => setCurrentPage('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="display-title text-5xl">Privacidade.</h2>
          <div className="space-y-6 max-w-md">
            {privacyOptions.map((item) => (
              <button key={item.key} type="button" onClick={() => updatePrivacyPref(item.key)} className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-line rounded-3xl shadow-sm text-left hover:border-accent/50 transition-colors">
                <div className="min-w-0">
                  <h4 className="font-bold text-lg">{item.title}</h4>
                  <p className="text-xs text-ink/50 font-medium">{item.desc}</p>
                </div>
                <div className={`w-12 h-6 rounded-full p-1 relative shrink-0 transition-colors ${privacyPrefs[item.key] ? 'bg-accent' : 'bg-line'}`}>
                  <div className={`w-4 h-4 bg-paper rounded-full shadow-md transition-transform ${privacyPrefs[item.key] ? 'translate-x-6' : ''}`} />
                </div>
              </button>
            ))}
            <button onClick={handleDeleteData} className="w-full py-5 text-red-500 font-bold border-2 border-red-500/10 rounded-full hover:bg-red-50 transition-colors mt-8 flex items-center justify-center gap-2">
              <Trash2 size={18} /> Apagar meus dados do banco
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  };
  const SettingsHelp = () => (
    <PageWrapper>
      <div className="space-y-12">
        <button onClick={() => setCurrentPage('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="display-title text-5xl">Ajuda.</h2>
        <div className="space-y-6 max-w-md">
          <div className="bg-accent/10 border border-accent/20 p-5 sm:p-6 rounded-3xl mb-8">
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Heart size={20} className="text-accent" /> Contato Humano</h3>
            <p className="text-sm text-ink/70 mb-6 font-medium">Nossa equipe clínica está pronta para te atender com todo cuidado e atenção.</p>
            
            <div className="space-y-4">
              <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><FaWhatsapp size={20} /></div>
                <div className="min-w-0">
                  <span className="block font-bold text-sm">WhatsApp da Clínica</span>
                  <span className="block text-xs text-ink/60">(11) 99999-9999</span>
                </div>
              </a>
              <a href="tel:+551133333333" className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><PhoneCall size={18} /></div>
                <div className="min-w-0">
                  <span className="block font-bold text-sm">Telefone Fixo</span>
                  <span className="block text-xs text-ink/60">(11) 3333-3333</span>
                </div>
              </a>
              <a href="mailto:contato@serenanutre.com" className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-accent-pink/20 text-accent-pink rounded-full flex items-center justify-center"><Mail size={18} /></div>
                <div className="min-w-0">
                  <span className="block font-bold text-sm">E-mail de Suporte</span>
                  <span className="block truncate text-xs text-ink/60">contato@serenanutre.com</span>
                </div>
              </a>
            </div>
          </div>

          {[
            { title: 'Dúvidas Frequentes', desc: 'Respostas para as perguntas mais comuns.' },
            { title: 'Termos de Uso', desc: 'Nossas regras e responsabilidades.' }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-line rounded-3xl shadow-sm hover:shadow-md cursor-pointer transition-all">
              <div className="min-w-0">
                <h4 className="font-bold text-lg">{item.title}</h4>
                <p className="text-xs text-ink/50 font-medium">{item.desc}</p>
              </div>
              <ChevronRight size={20} className="text-ink/30" />
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );

  const ProfilePage = () => {
    const { toast } = useToast();
    const latestWeight = userProfile.weightEvolution?.[userProfile.weightEvolution.length - 1]?.value;
    const latestWaist = userProfile.waistEvolution?.[userProfile.waistEvolution.length - 1]?.value;
    const latestHip = userProfile.hipEvolution?.[userProfile.hipEvolution.length - 1]?.value;
    const liveNeeds = latestWeight && userProfile.height
      ? calculateNutritionalNeeds(
        latestWeight,
        userProfile.height,
        userProfile.age || 25,
        userProfile.gender,
        userProfile.activityLevel || 1.2,
        userProfile.objectives || []
      )
      : null;
    const [selectedMetric, setSelectedMetric] = useState<null | {
      label: string;
      val: string | number;
      tone: string;
      title: string;
      description: string;
      interpretation: string;
    }>(null);
    const profileMetrics = [
      {
        label: 'IMC',
        val: userProfile.imc || liveNeeds?.imc || '--',
        tone: 'text-accent bg-accent/10 border-accent/20',
        title: 'Índice de Massa Corporal',
        description: 'O IMC cruza peso e altura para criar uma leitura geral do estado corporal. Ele é útil como triagem, mas não substitui uma avaliação profissional.',
        interpretation: 'Use como ponto de contexto. Massa muscular, retenção de líquidos, composição corporal e histórico de saúde podem mudar a interpretação do número.',
      },
      {
        label: 'TMB',
        val: userProfile.tmb || liveNeeds?.tmb || '--',
        tone: 'text-accent-pink bg-accent-pink/10 border-accent-pink/20',
        title: 'Taxa Metabólica Basal',
        description: 'A TMB estima quanta energia seu corpo usa em repouso para manter funções vitais, como respiração, circulação e temperatura corporal.',
        interpretation: 'Ela ajuda a personalizar metas e reflexões alimentares. Não é uma meta de consumo por si só, porque rotina, treino, sono e saúde alteram a necessidade diária.',
      },
      {
        label: 'Idade',
        val: userProfile.age || '--',
        tone: 'text-ink/70 bg-white border-line',
        title: 'Idade informada no perfil',
        description: 'A idade entra nos cálculos metabólicos e ajuda o app a contextualizar recomendações de energia, rotina e evolução corporal.',
        interpretation: 'Mantenha esse dado atualizado para melhorar estimativas como TMB e leituras de progresso ao longo do tempo.',
      },
      {
        label: 'Peso',
        val: latestWeight ? `${latestWeight}kg` : '--',
        tone: 'text-accent bg-white border-line',
        title: 'Peso corporal mais recente',
        description: 'Mostra o último peso registrado na evolução corporal. O valor isolado diz pouco; a tendência ao longo das semanas costuma ser mais útil.',
        interpretation: 'Observe junto com humor, fome, medidas corporais e constância dos registros para evitar conclusões apressadas.',
      },
      {
        label: 'C/Q',
        val: latestWaist && latestHip ? (latestWaist / latestHip).toFixed(2) : '--',
        tone: 'text-accent-pink bg-white border-line',
        title: 'Relação Cintura/Quadril',
        description: 'A C/Q divide a medida da cintura pela medida do quadril. Ela ajuda a contextualizar distribuição corporal e risco cardiometabólico em triagens.',
        interpretation: 'É apenas um indicador de acompanhamento. Diferenças de biotipo, técnica de medição e contexto clínico importam bastante.',
      },
    ];
    const profileActions = [
      { label: 'Editar dados', icon: Edit2, page: 'settings-account' },
      { label: 'Temas', icon: Palette, page: 'settings-theme' },
      { label: 'Privacidade', icon: Lock, page: 'settings-privacy' },
      { label: 'Ajuda', icon: HelpCircle, page: 'settings-help' },
    ];
    return (
    <PageWrapper>
      <div className="space-y-8">
        <header className="relative overflow-hidden rounded-[2rem] bg-white border border-line p-6 md:p-8 shadow-sm">
          <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-6">
            <div className="relative shrink-0">
              <ProfileAvatar photo={userProfile.photo} size="xl" className="border-4 border-paper shadow-xl" />
              <button onClick={() => setCurrentPage('settings-account')} className="absolute -bottom-1 -right-1 w-11 h-11 rounded-2xl bg-accent text-paper flex items-center justify-center shadow-lg border-4 border-white">
                <Camera size={17} />
              </button>
            </div>
            <div className="text-center sm:text-left flex-1 min-w-0">
              <span className="label-sm text-accent">Perfil</span>
              <h2 className="display-title text-4xl md:text-5xl mt-2">{userProfile.name || 'Seu perfil'}</h2>
              <p className="text-sm font-medium text-ink/55 mt-2">{userProfile.email || 'Complete seus dados para personalizar o app'}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                {(userProfile.objectives?.length ? userProfile.objectives.slice(0, 3) : ['Jornada em construção']).map((item: string) => (
                  <span key={item} className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold">{item}</span>
                ))}
              </div>
            </div>
            <button onClick={() => setCurrentPage('settings-account')} className="w-full shrink-0 px-5 py-3 rounded-2xl bg-ink text-paper text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm sm:w-auto">
              <Edit2 size={16} /> Editar
            </button>
          </div>
        </header>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="label-sm text-accent">Toque nos indicadores para entender cada termo</span>
            <HelpCircle size={16} className="text-accent/70 shrink-0" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {profileMetrics.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => setSelectedMetric(item)}
                className={`group rounded-2xl p-4 text-left border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/30 ${item.tone}`}
                aria-label={`Entender ${item.label}`}
              >
                <span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase mb-2 opacity-70">
                  {item.label}
                  <HelpCircle size={14} className="opacity-60 group-hover:opacity-100" />
                </span>
                <span className="block text-2xl font-display text-ink">{item.val}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_1.2fr] gap-4">
          <div className="bg-white border border-line p-6 rounded-3xl shadow-sm">
            <span className="label-sm text-accent">Resumo</span>
            <p className="font-bold text-lg mt-2">{userProfile.objectives?.[0] || 'Complete seu foco principal'}</p>
            <p className="text-sm text-ink/50 mt-2">{userProfile.triggers?.length ? `Gatilhos: ${userProfile.triggers.slice(0, 3).join(', ')}` : 'Informe seus gatilhos para personalizar os lembretes e insights.'}</p>
            <div className="mt-5 w-12 h-12 bg-accent text-paper rounded-2xl flex items-center justify-center">
              <Brain size={24} />
            </div>
            {(!userProfile.objectives?.length || !userProfile.triggers?.length) && (
              <button onClick={() => setCurrentPage('diagnosis')} className="mt-5 w-full rounded-2xl bg-accent/10 px-4 py-3 text-sm font-bold text-accent transition-colors hover:bg-accent/15">
                Completar perfil
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {profileActions.map((item) => (
              <button key={item.label} onClick={() => setCurrentPage(item.page as Page)} className="bg-white border border-line rounded-3xl p-4 text-left shadow-sm hover:border-accent hover:bg-accent/5 transition-all group">
                <div className="w-11 h-11 rounded-2xl bg-ink/5 flex items-center justify-center text-ink/70 group-hover:bg-accent group-hover:text-paper transition-all mb-4">
                  <item.icon size={20} />
                </div>
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button onClick={() => toast('Mind Nutrition é uma plataforma guiada por IA para uma relação mais saudável com a alimentação. Versão 1.0.0', 'info', 5000)}
            className="w-full py-4 flex items-center justify-center gap-2 text-center text-ink/50 hover:text-accent font-medium transition-colors">
            <HelpCircle size={18} /> Sobre o Mind Nutrition
          </button>
          <button onClick={() => setCurrentPage('landing')} className="w-full py-6 mt-4 flex items-center justify-center gap-3 text-red-500 font-bold border-2 border-red-500/10 rounded-full hover:bg-red-50 transition-colors shadow-sm">
            <LogOut size={20} />
            <span className="uppercase tracking-widest text-sm">Voltar ao Início</span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {selectedMetric && (
          <div className="modal-shell fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={MODAL_BACKDROP_CLASS}
              onClick={() => setSelectedMetric(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="modal-panel relative bg-paper p-6 md:p-8 shadow-2xl max-w-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="label-sm text-accent">Entenda o termo</span>
                  <h3 className="modal-title font-bold mt-2">{selectedMetric.title}</h3>
                </div>
                <button type="button" onClick={() => setSelectedMetric(null)} className="icon-button">
                  <X size={18} />
                </button>
              </div>
              <div className={`mt-6 rounded-3xl border p-5 ${selectedMetric.tone}`}>
                <span className="text-[10px] font-bold uppercase opacity-70">{selectedMetric.label}</span>
                <strong className="mt-1 block text-4xl font-display text-ink">{selectedMetric.val}</strong>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-ink/65">{selectedMetric.description}</p>
              <div className="mt-4 rounded-3xl bg-white border border-line p-5">
                <span className="label-sm text-accent-pink">Como interpretar</span>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{selectedMetric.interpretation}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageWrapper>
    );
  };

  const AdminLoginPage = () => {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleAdminLogin = () => {
      if (email === 'admin@serenanutre.com' && password === 'admin123') {
        setAdminLoggedIn(true);
        localStorage.setItem('nutriAdminLoggedIn', 'true');
        toast('Bem-vindo, Administrador!', 'success');
        setCurrentPage('admin-dashboard');
      } else {
        setError('Credenciais inválidas. Tente novamente.');
        toast('Credenciais inválidas!', 'error');
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full min-h-screen bg-paper flex items-center justify-center px-6"
      >
        <div className="w-full max-w-md space-y-10">
          <div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm space-y-6">
            {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}
            <div>
              <label className="label-sm text-accent">E-mail</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                className="w-full py-3 bg-transparent border-b-2 border-line focus:border-accent focus:outline-none transition-colors text-lg font-medium" placeholder="admin@serenanutre.com" />
            </div>
            <div>
              <label className="label-sm text-accent">Senha</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full py-3 bg-transparent border-b-2 border-line focus:border-accent focus:outline-none transition-colors text-lg font-medium" placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} />
            </div>
            <button onClick={handleAdminLogin}
              className="w-full py-5 bg-accent text-paper font-bold text-lg rounded-full shadow-lg hover:bg-accent/90 transition-colors">
              Entrar
            </button>
          </div>

          <button onClick={() => setCurrentPage('landing')} className="w-full flex items-center justify-center gap-2 text-ink/50 hover:text-accent font-medium transition-colors">
            <ArrowLeft size={18} /> Voltar ao site
          </button>
        </div>
      </motion.div>
    );
  };

  const AdminDashboardPage = () => {
    if (!adminLoggedIn) {
      setCurrentPage('admin-login');
      return null;
    }

    return (
      <PageWrapper>
        <div className="space-y-10">
          <header className="responsive-page-header">
            <div>
              <h2 className="display-title text-4xl">Painel do Nutricionista</h2>
              <p className="serif-body text-xl text-ink/60 mt-1">Gerencie usuários e conteúdos</p>
            </div>
            <button onClick={() => { setAdminLoggedIn(false); localStorage.removeItem('nutriAdminLoggedIn'); setCurrentPage('landing'); }}
              className="flex items-center justify-center gap-2 text-red-500 font-bold hover:bg-red-50 px-4 py-2 rounded-full transition-colors">
              <LogOut size={18} /> Sair
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button onClick={() => setCurrentPage('admin-users')}
              className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm hover:border-accent hover:shadow-lg transition-all text-left group">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <User size={28} className="text-accent" />
              </div>
              <h3 className="font-bold text-xl mb-1">Usuários</h3>
              <p className="text-sm text-ink/50">{adminUsers.length} usuários cadastrados</p>
            </button>

            <button onClick={() => setCurrentPage('admin-articles')}
              className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm hover:border-accent hover:shadow-lg transition-all text-left group">
              <div className="w-14 h-14 bg-accent-pink/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-accent-pink/20 transition-colors">
                <BookOpen size={28} className="text-accent-pink" />
              </div>
              <h3 className="font-bold text-xl mb-1">Artigos</h3>
              <p className="text-sm text-ink/50">{adminArticles.length} artigos publicados</p>
            </button>

            <div className="bg-accent/5 border border-accent/10 p-8 rounded-[2.5rem]">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                <Activity size={28} className="text-accent" />
              </div>
              <h3 className="font-bold text-xl mb-1">Estatísticas</h3>
              <p className="text-sm text-ink/50">Em breve</p>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  };

  const AdminUsersPage = () => {
    if (!adminLoggedIn) {
      setCurrentPage('admin-login');
      return null;
    }

    const [selectedUser, setSelectedUser] = useState<any>(null);

    useEffect(() => {
      if (selectedUser) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
    }, [selectedUser]);

    return (
      <PageWrapper>
        <div className="space-y-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('admin-dashboard')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="display-title text-4xl">Usuários</h2>
              <p className="serif-body text-xl text-ink/60 mt-1">{adminUsers.length} perfis cadastrados</p>
            </div>
          </div>

          {adminUsers.length === 0 ? (
            <div className="text-center py-16">
              <User size={48} className="text-ink/20 mx-auto mb-4" />
              <p className="serif-body text-xl text-ink/50">Nenhum usuário cadastrado ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adminUsers.map((user, idx) => (
                <button key={idx} onClick={() => setSelectedUser(user)}
                  className="w-full bg-white border border-line p-5 sm:p-6 rounded-3xl shadow-sm hover:border-accent hover:shadow-md transition-all flex items-center gap-4 text-left">
                  <ProfileAvatar photo={user.photo} size="md" className="border-2 border-accent/20" />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-bold text-lg">{user.name || 'Sem nome'}</h4>
                    <p className="truncate text-sm text-ink/50">{user.email || 'Sem e-mail'}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs font-bold text-accent">{user.objectives?.[0] || 'Sem objetivo'}</p>
                    <p className="text-xs text-ink/40">IMC: {user.imc || '--'}</p>
                  </div>
                  <ChevronRight size={20} className="text-ink/20" />
                </button>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedUser && (
            <div className="modal-shell fixed inset-0 z-50 flex">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={MODAL_BACKDROP_CLASS} onClick={() => setSelectedUser(null)} />
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 24 }} className="modal-panel relative bg-paper max-w-lg p-5 md:p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setSelectedUser(null)} className="p-2 rounded-full hover:bg-line transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <h3 className="font-bold text-xl">Perfil do Usuário</h3>
                </div>

                <div className="flex flex-col items-center mb-8">
                  <ProfileAvatar photo={selectedUser.photo} size="lg" className="border-4 border-accent shadow-lg mb-4" />
                  <h4 className="font-bold text-2xl">{selectedUser.name || 'Sem nome'}</h4>
                  <p className="text-sm text-ink/50">{selectedUser.email}</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-accent/10 rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold text-accent uppercase block">IMC</span>
                      <span className="text-xl font-display">{selectedUser.imc || '--'}</span>
                    </div>
                    <div className="bg-accent-pink/10 rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold text-accent-pink uppercase block">TMB</span>
                      <span className="text-xl font-display">{selectedUser.tmb || '--'}</span>
                    </div>
                    <div className="bg-line rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold text-ink/60 uppercase block">Idade</span>
                      <span className="text-xl font-display">{selectedUser.age || '--'}</span>
                    </div>
                  </div>

                  {selectedUser.objectives && selectedUser.objectives.length > 0 && (
                    <div className="bg-white border border-line p-4 rounded-2xl">
                      <span className="label-sm text-accent">Objetivos</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedUser.objectives.map((obj: string, i: number) => (
                          <span key={i} className="text-xs font-bold bg-accent/10 text-accent px-3 py-1 rounded-full">{obj}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedUser.comorbidities && selectedUser.comorbidities.length > 0 && (
                    <div className="bg-white border border-line p-4 rounded-2xl">
                      <span className="label-sm text-ink/50">Condições de Saúde</span>
                      <p className="text-sm mt-1">{selectedUser.comorbidities.join(', ')}</p>
                    </div>
                  )}

                  {selectedUser.triggers && selectedUser.triggers.length > 0 && (
                    <div className="bg-white border border-line p-4 rounded-2xl">
                      <span className="label-sm text-ink/50">Gatilhos Emocionais</span>
                      <p className="text-sm mt-1">{selectedUser.triggers.join(', ')}</p>
                    </div>
                  )}

                  <div className="bg-white border border-line p-4 rounded-2xl">
                    <span className="label-sm text-ink/50">Peso Atual</span>
                    <p className="text-xl font-bold mt-1">{selectedUser.weightEvolution?.[selectedUser.weightEvolution.length - 1]?.value || '--'} kg</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </PageWrapper>
    );
  };

  const AdminArticlesPage = () => {
    const { toast } = useToast();
    if (!adminLoggedIn) {
      setCurrentPage('admin-login');
      return null;
    }

    const [showNewArticle, setShowNewArticle] = useState(false);
    const [newArticle, setNewArticle] = useState({ title: '', type: 'Artigo', summary: '', image: '', duration: '3 min' });

    useEffect(() => {
      if (showNewArticle) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
    }, [showNewArticle]);

    const handleAddArticle = () => {
      if (!newArticle.title || !newArticle.summary) {
        toast('Preencha título e resumo!', 'error');
        return;
      }
      const article = {
        ...newArticle,
        id: Date.now(),
        icon: BookOpen,
        image: newArticle.image || 'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=800',
      };
      setAdminArticles(prev => [...prev, article]);
      setShowNewArticle(false);
      setNewArticle({ title: '', type: 'Artigo', summary: '', image: '', duration: '3 min' });
      toast('Artigo publicado com sucesso!', 'success');
    };

    const handleDeleteArticle = (id: number) => {
      setAdminArticles(prev => prev.filter(a => a.id !== id));
      toast('Artigo removido!', 'info');
    };

    return (
      <PageWrapper>
        <div className="space-y-10">
          <div className="responsive-page-header">
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentPage('admin-dashboard')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="display-title text-4xl">Artigos</h2>
                <p className="serif-body text-xl text-ink/60 mt-1">{adminArticles.length} artigos publicados</p>
              </div>
            </div>
            <button onClick={() => setShowNewArticle(true)}
              className="bg-accent text-paper px-6 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
              <PlusCircle size={18} /> Novo Artigo
            </button>
          </div>

          <div className="space-y-4">
            {adminArticles.map((article) => (
              <div key={article.id} className="bg-white border border-line p-4 sm:p-6 rounded-3xl shadow-sm flex items-center gap-4">
                <img src={article.image} alt="" className="w-16 h-16 rounded-2xl object-cover sm:w-20 sm:h-20" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-accent uppercase">{article.type}</span>
                  <h4 className="truncate font-bold text-base sm:text-lg">{article.title}</h4>
                  <p className="text-xs text-ink/50 line-clamp-1">{article.summary}</p>
                </div>
                <button onClick={() => handleDeleteArticle(article.id)}
                  className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {showNewArticle && (
            <div className="modal-shell fixed inset-0 z-50 flex">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={MODAL_BACKDROP_CLASS} onClick={() => setShowNewArticle(false)} />
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 24 }} className="modal-panel relative bg-paper max-w-lg p-5 md:p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-xl">Novo Artigo</h3>
                  <button onClick={() => setShowNewArticle(false)} className="p-2 rounded-full hover:bg-line transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="label-sm text-accent">Título</label>
                    <input type="text" value={newArticle.title} onChange={e => setNewArticle({...newArticle, title: e.target.value})}
                      className="w-full py-3 bg-transparent border-b-2 border-line focus:border-accent focus:outline-none text-lg font-medium" placeholder="Título do artigo" />
                  </div>
                  <div>
                    <label className="label-sm text-accent">Tipo</label>
                    <select value={newArticle.type} onChange={e => setNewArticle({...newArticle, type: e.target.value})}
                      className="w-full py-3 bg-transparent border-b-2 border-line focus:border-accent focus:outline-none text-lg font-medium">
                      <option value="Artigo">Artigo</option>
                      <option value="Guia">Guia</option>
                      <option value="Reflexão">Reflexão</option>
                      <option value="Prática">Prática</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-sm text-accent">Resumo</label>
                    <textarea value={newArticle.summary} onChange={e => setNewArticle({...newArticle, summary: e.target.value})}
                      className="w-full p-4 bg-transparent border-2 border-line rounded-2xl focus:border-accent focus:outline-none text-sm font-medium resize-none h-24" placeholder="Breve descrição do artigo..." />
                  </div>
                  <div>
                    <label className="label-sm text-accent">URL da Imagem (opcional)</label>
                    <input type="text" value={newArticle.image} onChange={e => setNewArticle({...newArticle, image: e.target.value})}
                      className="w-full py-3 bg-transparent border-b-2 border-line focus:border-accent focus:outline-none text-sm font-medium" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="label-sm text-accent">Duração</label>
                    <input type="text" value={newArticle.duration} onChange={e => setNewArticle({...newArticle, duration: e.target.value})}
                      className="w-full py-3 bg-transparent border-b-2 border-line focus:border-accent focus:outline-none text-sm font-medium" placeholder="3 min" />
                  </div>

                  <button onClick={handleAddArticle}
                    className="w-full py-5 bg-accent text-paper rounded-full font-bold shadow-lg hover:bg-accent/90 transition-colors mt-4">
                    Publicar Artigo
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </PageWrapper>
    );
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="app-shell bg-paper text-ink min-h-screen">
      <div className="paper-texture" />

      {renderDesktopSidebar()}
      {renderTopNavbar()}

      <main className="app-main relative z-10 w-full overflow-x-hidden">
        <AnimatePresence mode="wait">
          {currentPage === 'landing' && <LandingPage key="landing" />}
          {currentPage === 'auth' && (
            <AuthPage
              key="auth"
              userProfile={userProfile}
              onAuthenticated={handleAuthenticated}
              onNavigate={setCurrentPage}
              onShowToast={toast}
            />
          )}
          {currentPage === 'diagnosis' && <DiagnosisQuiz key="diagnosis" />}
          {currentPage === 'dashboard' && <Dashboard key="dashboard" />}
          {currentPage === 'meal-log' && <MealLog key="meal-log" />}
          {currentPage === 'content' && <ContentPage key="content" />}
          {currentPage === 'progress' && <ProgressPage key="progress" />}
          {currentPage === 'profile' && <ProfilePage key="profile" />}
          {currentPage === 'settings-account' && <AccountSettings key="account" />}
          {currentPage === 'settings-theme' && <ThemeSettings key="themes" />}
          {currentPage === 'settings-privacy' && <PrivacySettings key="privacy" />}
          {currentPage === 'settings-help' && <SettingsHelp key="help" />}
          {currentPage === 'meal-details' && <MealDetailsPage key="meal-details" />}
          {currentPage === 'admin-login' && <AdminLoginPage key="admin-login" />}
          {currentPage === 'admin-dashboard' && <AdminDashboardPage key="admin-dashboard" />}
          {currentPage === 'admin-users' && <AdminUsersPage key="admin-users" />}
          {currentPage === 'admin-articles' && <AdminArticlesPage key="admin-articles" />}
        </AnimatePresence>
      </main>

      {renderMobileNav()}

      <AnimatePresence>
        {selectedArticle && (
          <div className="modal-shell fixed inset-0 z-50 flex">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={MODAL_BACKDROP_CLASS} onClick={closeArticle} />
            <motion.div
              initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: '100%', scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag={window.innerWidth < 768 ? "y" : false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={handleArticleDragEnd} style={{ y: articleY }}
              className="modal-panel relative bg-paper md:max-w-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-line rounded-full mx-auto mt-4 mb-2 md:hidden" />
              <div className="overflow-y-auto flex-1 p-8 md:p-12 pb-32">
                <div className="flex justify-between items-center mb-4">
                  <span className="label-sm text-accent tracking-[0.2em]">{selectedArticle.type}</span>
                  <button onClick={closeArticle} className="hidden md:flex w-10 h-10 rounded-full border border-line items-center justify-center hover:bg-line transition-colors">
                    <ArrowLeft size={16} className="-rotate-90" />
                  </button>
                </div>
                <h2 className="display-title text-5xl mb-8 leading-[0.9]">{selectedArticle.title}</h2>
                <div className="mask-image-full mb-10 overflow-hidden rounded-[2.5rem] shadow-2xl">
                  <img src={selectedArticle.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="prose prose-xl max-w-none text-ink/90">
                  {(selectedArticle.content || [
                    selectedArticle.summary || 'Use este espaço como uma pausa para observar sua relação com a alimentação com mais gentileza.',
                    'As informações da Biblioteca servem para apoiar sua reflexão e não substituem acompanhamento profissional individualizado.'
                  ]).map((paragraph: string, index: number) => (
                    <p key={index} className={index === 0 ? 'drop-cap serif-body text-2xl leading-relaxed mb-8' : 'text-xl leading-relaxed mb-6 font-medium'}>{paragraph}</p>
                  ))}
                  {selectedArticle.sourceLabel && (
                    <div className="mt-10 rounded-3xl border border-line bg-white p-5 text-sm leading-relaxed text-ink/65">
                      <span className="label-sm text-accent">Fonte</span>
                      {selectedArticle.sourceUrl ? (
                        <a href={selectedArticle.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block font-bold text-accent hover:underline">{selectedArticle.sourceLabel}</a>
                      ) : <p className="mt-2 font-bold">{selectedArticle.sourceLabel}</p>}
                    </div>
                  )}
                </div>
                <button onClick={closeArticle} className="mt-16 w-full py-6 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-xl">
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
