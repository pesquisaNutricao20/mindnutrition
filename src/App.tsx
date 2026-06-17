import React, { useState, useEffect, useRef } from 'react';
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
  Bell,
  Lock,
  Mail,
  Edit2,
  MessageSquare,
  Send,
  Bot,
  CheckCircle,
  Brain,
  Zap,
  TrendingUp,
  HelpCircle,
  ArrowUpLeft,
  X,
  Palette,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { GiOvermind } from 'react-icons/gi';
import { BsFlower1 } from 'react-icons/bs';
import { TbHealthRecognition } from 'react-icons/tb';
import { PiHeartbeat } from 'react-icons/pi';
import { FaBrain } from 'react-icons/fa';
import { motion, AnimatePresence, useAnimation, useMotionValue } from 'motion/react';
import { useToast } from './components/Toast';
import { MascotComponent } from './components/Mascot';
import { FullscreenImageViewer, MeasurementImageCard } from './components/FullscreenImageViewer';
import { AuthPage } from './components/AuthPage';
import { Avatar } from './components/ui/Avatar';
import { ProfileAvatar } from './components/ui/ProfileAvatar';
import { HungerOdometer } from './components/ui/HungerOdometer';
import { TypewriterText } from './components/ui/TypewriterText';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { MascotBubble } from './components/ui/MascotBubble';
import { APP_THEMES, DEFAULT_THEME_ID } from './constants/themes';
import { DEFAULT_PROFILE_PHOTO, readValidatedImages, MAX_IMAGE_SIZE_MB, MAX_MEAL_PHOTOS } from './constants';
import type { Page, UserProfile } from './types';
import {
  deleteCurrentUserData,
  getCurrentSession,
  insertMeal,
  isSupabaseConfigured,
  loadMeals,
  loadProfile,
  supabase,
  upsertProfile,
} from './lib/supabase';
import mascoteEyesOpen from './assets/mascote_eyes_open.png';
import mascoteEyesClosed from './assets/mascote_eyes_closed.png';
import mascoteFlying from './assets/mascote_flying.png';
import mascoteAi from './assets/mascote_ai3.png';
import balancaImg from './assets/balanca.png';
import fitaImg from './assets/fita.png';
import cinturaImg from './assets/cintura.png';
import abdomenImg from './assets/abdomen.png';
import quadrilImg from './assets/quadril.png';
import {
  ResponsiveContainer,
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
  tmb = (gender === 'Masculino') ? tmb + 5 : tmb - 161;

  let net = tmb * activityLevel;
  if (goals.includes('Emagrecimento consciente')) net -= 400;
  if (goals.includes('Hipertrofia') || goals.includes('Ganho de peso')) net += 400;

  return {
    imc: parseFloat(imc.toFixed(1)),
    tmb: Math.round(tmb),
    net: Math.round(net)
  };
}

const MOCK_EMOTIONAL_DATA = [
  { day: 'Seg', humor: 40, fisico: 30, emocional: 70, mood: 'Calmo' },
  { day: 'Ter', humor: 70, fisico: 20, emocional: 80, mood: 'Ansioso' },
  { day: 'Qua', humor: 45, fisico: 50, emocional: 50, mood: 'Neutro' },
  { day: 'Qui', humor: 90, fisico: 10, emocional: 90, mood: 'Tenso' },
  { day: 'Sex', humor: 65, fisico: 60, emocional: 40, mood: 'Calmo' },
  { day: 'Sáb', humor: 80, fisico: 30, emocional: 70, mood: 'Ansioso' },
  { day: 'Dom', humor: 55, fisico: 70, emocional: 30, mood: 'Neutro' },
];

const MOCK_RADAR_DATA = [
  { subject: 'Saciedade', A: 120, B: 110, fullMark: 150 },
  { subject: 'Consciência', A: 98, B: 130, fullMark: 150 },
  { subject: 'Energia', A: 86, B: 130, fullMark: 150 },
  { subject: 'Humor', A: 99, B: 100, fullMark: 150 },
  { subject: 'Digestão', A: 85, B: 90, fullMark: 150 },
  { subject: 'Sono', A: 65, B: 85, fullMark: 150 },
];

const MOCK_PIE_DATA = [
  { name: 'Fome Física', value: 400 },
  { name: 'Fome Emocional', value: 300 },
  { name: 'Fome Social', value: 200 },
];

const COLORS = ['var(--accent)', 'var(--accent-pink)', '#5A9485'];

const MOCK_WEIGHT_DATA = [
  { date: '01/04', value: 76.5 },
  { date: '08/04', value: 76.0 },
  { date: '15/04', value: 75.8 },
  { date: '22/04', value: 75.3 },
  { date: '29/04', value: 75.0 },
];

const MOCK_MEALS = [
  { time: '08:30', title: 'Café da Manhã', mood: 'Calmo', icon: Coffee, type: 'Física', image: 'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&q=80&w=800', notes: 'Aveia com frutas vermelhas. Me senti presente enquanto comia.' },
  { time: '12:45', title: 'Almoço', mood: 'Neutro', icon: Sun, type: 'Física', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800', notes: 'Salada completa e uma proteína. Sem pressa hoje.' },
  { time: '16:00', title: 'Lanche', mood: 'Ansioso', icon: Coffee, type: 'Emocional', image: 'https://images.unsplash.com/photo-1550617931-e17a7b70dce2?auto=format&fit=crop&q=80&w=800', notes: 'Estava ansioso com o trabalho e comi um cupcake.' },
  { time: '20:15', title: 'Jantar', mood: 'Calmo', icon: Moon, type: 'Física', image: 'https://images.unsplash.com/photo-1476224203421-9ce393618115?auto=format&fit=crop&q=80&w=800', notes: 'Sopa reconfortante.' },
];

const MOCK_CONTENT = [
  { id: 1, title: 'Comer Consciente', duration: '3 min', icon: GiOvermind, type: 'Artigo', image: 'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=800', summary: 'Descubra o poder de estar presente em cada garfada.' },
  { id: 2, title: 'Física vs Emocional', duration: '5 min', icon: Leaf, type: 'Guia', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800', summary: 'Aprenda a ouvir os sinais reais do seu corpo.' },
  { id: 3, title: 'Lidando com a Culpa', duration: '4 min', icon: Heart, type: 'Reflexão', image: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800', summary: 'Transforme sua relação com o alimento e consigo mesmo.' },
  { id: 4, title: 'Sinais de Saciedade', duration: '2 min', icon: Sun, type: 'Prática', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800', summary: 'Dicas práticas para identificar quando parar.' }
];

const MOCK_FOODS_JSON = [
  { id: 1, name: 'Maçã', calories: 52, macros: { carb: 14, protein: 0.3, fat: 0.2 } },
  { id: 2, name: 'Banana', calories: 89, macros: { carb: 23, protein: 1.1, fat: 0.3 } },
  { id: 3, name: 'Ovo Cozido', calories: 155, macros: { carb: 1.1, protein: 13, fat: 11 } },
  { id: 4, name: 'Arroz Integral', calories: 111, macros: { carb: 23, protein: 2.6, fat: 0.9 } },
];

// ---------- Sub-Components ----------

export default function App() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    if (window.location.pathname === '/nutricionista') {
      return localStorage.getItem('nutriAdminLoggedIn') === 'true' ? 'admin-dashboard' : 'admin-login';
    }
    return 'landing';
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
    const saved = localStorage.getItem('nutriArticles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({ ...item, icon: Library }));
      } catch { return [...MOCK_CONTENT]; }
    }
    return [...MOCK_CONTENT];
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
    height: 0,
    weightEvolution: MOCK_WEIGHT_DATA,
    waistEvolution: [{ date: '29/04', value: 88 }],
    armEvolution: [],
    abdomenEvolution: [],
    hipEvolution: [{ date: '29/04', value: 104 }],
    age: 25,
    activityLevel: 1.2
  });

  const persistUserProfile = async (profile: UserProfile, userId = currentUserId) => {
    setUserProfile(profile);
    localStorage.setItem('nutriUser', JSON.stringify(profile));
    const sessionUserId = userId || (await getCurrentSession().catch(() => null))?.user?.id || null;
    if (sessionUserId && profile.email) {
      setCurrentUserId(sessionUserId);
      upsertProfile(sessionUserId, profile.email, profile as unknown as Record<string, unknown>).catch((err) => {
        console.warn('Supabase profile sync failed:', err);
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
          setUserProfile(JSON.parse(saved));
          setSavedLoginNotice(true);
        } catch {}
      }
      if (savedMeals) {
        try { setLoggedMeals(JSON.parse(savedMeals)); } catch {}
      }

      if (isSupabaseConfigured) {
        try {
          const session = await getCurrentSession();
          if (session?.user && active) {
            setCurrentUserId(session.user.id);
            setSavedLoginNotice(true);
            const [remoteProfile, remoteMeals] = await Promise.all([
              loadProfile(session.user.id).catch(() => null),
              loadMeals(session.user.id).catch(() => []),
            ]);
            if (remoteProfile && active) {
              setUserProfile(prev => {
                const hydrated = { ...prev, ...remoteProfile, email: session.user.email || remoteProfile.email || prev.email };
                localStorage.setItem('nutriUser', JSON.stringify(hydrated));
                return hydrated;
              });
            } else if (session.user.email && active) {
              setUserProfile(prev => {
                const hydrated = { ...prev, email: session.user.email || prev.email };
                localStorage.setItem('nutriUser', JSON.stringify(hydrated));
                return hydrated;
              });
            }
            if (remoteMeals.length && active) {
              setLoggedMeals(remoteMeals);
              localStorage.setItem('nutriMeals', JSON.stringify(remoteMeals));
            }
          }
        } catch (err) {
          console.warn('Supabase session hydrate failed:', err);
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
        console.warn('Supabase meal sync failed:', err);
      });
    }
  };

  // ---------- Navigation ----------

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Início' },
    { id: 'progress', icon: Activity, label: 'Insights' },
    { id: 'meal-log', icon: PlusCircle, label: 'Registrar', primary: true },
    { id: 'chat', icon: MessageSquare, label: 'Nutri AI' },
    { id: 'content', icon: Library, label: 'Biblioteca' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  const appPageIds = navItems.map(item => item.id);

  const handleSectionSwipe = (offsetX: number) => {
    if (Math.abs(offsetX) < 120 || !appPageIds.includes(currentPage)) return;
    const currentIndex = appPageIds.indexOf(currentPage);
    const nextIndex = offsetX < 0
      ? Math.min(currentIndex + 1, appPageIds.length - 1)
      : Math.max(currentIndex - 1, 0);
    if (nextIndex !== currentIndex) setCurrentPage(appPageIds[nextIndex] as Page);
  };

  const renderTopNavbar = () => {
    if (['landing', 'auth', 'diagnosis', 'admin-login', 'admin-dashboard', 'admin-users', 'admin-articles', 'chat'].includes(currentPage) || isLoading) return null;
    return (
      <header className="app-topbar">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent text-paper flex items-center justify-center animated-gradient shrink-0">
            <BsFlower1 size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight truncate">Mind Nutrition</h1>
          </div>
        </div>
        <button onClick={() => setCurrentPage('profile')} className="w-10 h-10 rounded-full overflow-hidden border border-line bg-white shrink-0">
          <ProfileAvatar photo={userProfile.photo} size="sm" className="border-0" />
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
              onClick={() => setCurrentPage(item.id as Page)}
              className={`relative w-14 h-14 mb-2 flex items-center justify-center rounded-2xl transition-all ${isActive ? 'bg-accent/20 text-accent' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
                }`}
              title={item.label}
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
    if (currentPage === 'meal-log' || currentPage === 'chat') return null;

    // Mobile nav shows 5 items max for better UX
    const mobileItems = navItems.filter(i => i.id !== 'profile');

    return (
      <div className="mobile-nav fixed bottom-0 left-0 w-full z-40 bg-paper border-t border-line pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <nav className="flex justify-around items-center px-2 h-20">
          {mobileItems.map((item) => {
            const isActive = currentPage === item.id;

            if (item.primary) {
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id as Page)}
                  className="relative -top-6 w-16 h-16 rounded-full bg-accent text-paper flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform border-4 border-paper"
                >
                  <item.icon size={28} />
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id as Page)}
                className={`flex flex-col items-center justify-center w-[4.5rem] h-full gap-1 transition-colors ${isActive ? 'text-accent' : 'text-ink/50 hover:text-ink'
                  }`}
              >
                <div className="relative p-2 rounded-[1.25rem] flex items-center justify-center">
                  {isActive && (
                    <motion.div
                      layoutId="mob-nav-active"
                      className="absolute inset-0 border-2 border-accent rounded-[1.25rem] bg-accent/5"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                </div>
                <span className="text-[9px] font-bold mt-0.5">{item.label}</span>
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
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        drag={appPageIds.includes(currentPage) && !noPadding ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_, info) => handleSectionSwipe(info.offset.x)}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`w-full min-h-screen pb-36 md:pb-16 ${pagePadding} max-w-4xl mx-auto`}
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
      className="w-full h-[100dvh] overflow-hidden fixed inset-0 z-50 bg-paper"
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
                  Vá além do ruído das dietas. Descubra uma abordagem psicológica e gentil para sua alimentação.
                </p>
              </div>

              <button
                onClick={() => {
                  if (localStorage.getItem('nutriUser')) {
                    setCurrentPage('dashboard');
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
    user: { id: string; email?: string };
    isLogin: boolean;
    signupPhoto: string;
  }) => {
    const { user, isLogin, signupPhoto } = params;
    setCurrentUserId(user.id);
    const remoteProfile = await loadProfile(user.id).catch(() => null);
    const remoteMeals = await loadMeals(user.id).catch(() => []);
    const nextProfile = { ...userProfile, photo: signupPhoto, ...(remoteProfile || {}), email: user.email || '' };
    await persistUserProfile(nextProfile, user.id);
    if (remoteMeals.length) {
      setLoggedMeals(remoteMeals);
      localStorage.setItem('nutriMeals', JSON.stringify(remoteMeals));
    }
    setSavedLoginNotice(true);
    toast(isLogin ? 'Login salvo com segurança.' : 'Conta criada. Complete seu perfil.', 'success');
    setCurrentPage(remoteProfile?.name ? 'dashboard' : 'diagnosis');
  };

  const DiagnosisQuiz = () => {
    const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);
    const [errorMsg, setErrorMsg] = useState('');

    const steps = [
      { id: 'name', title: "Como prefere ser chamado?", subtitle: "Sua identidade é essencial.", type: 'input', field: 'name', placeholder: 'Seu nome ou apelido' },
      { id: 'age', title: "Qual a sua idade?", subtitle: "Para calcularmos suas necessidades basais.", type: 'input_number', field: 'age', placeholder: 'Ex: 25' },
      { id: 'gender', title: "Como você se identifica?", subtitle: "Tratamento preferencial.", type: 'options', field: 'gender', options: ["Masculino", "Feminino", "Não-binário", "Prefiro não identificar"] },
      { id: 'activity', title: "Qual seu nível de atividade física?", subtitle: "Impacta seu metabolismo diário.", type: 'options_activity', field: 'activityLevel', options: [
        { label: "Sedentário (pouco ou nenhum)", value: 1.2 },
        { label: "Levemente ativo (1-3 dias/sem)", value: 1.375 },
        { label: "Moderadamente ativo (3-5 dias/sem)", value: 1.55 },
        { label: "Muito ativo (6-7 dias/sem)", value: 1.725 }
      ]},
      { id: 'emotions', title: "Como se sente ultimamente?", subtitle: "Selecione quantos quiser.", type: 'multiselect', field: 'initialEmotions', options: ["Estresse", "Alegria", "Frustração", "Ansiedade", "Calma"] },
      { id: 'comorbidities', title: "Você possui alguma condição de saúde?", subtitle: "Isso nos ajuda a personalizar seu cuidado.", type: 'multiselect', field: 'comorbidities', options: ["Nenhuma", "Diabetes", "Hipertensão", "Ansiedade/Depressão", "Outros"] },
      { id: 'triggers', title: "Você come sem fome quando sente...", subtitle: "Identificando gatilhos.", type: 'multiselect', field: 'triggers', options: ["Tédio", "Solidão", "Cansaço", "Estresse", "Ansiedade"] },
      { id: 'foods', title: "O que busca nesses momentos?", subtitle: "Padrões de escolha.", type: 'multiselect', field: 'foods', options: ["Café", "Doces", "Massas", "Salgadinhos", "Fast Food"] },
      { id: 'objectives', title: "Qual seu objetivo?", subtitle: "Podemos focar em mais de um.", type: 'multiselect', field: 'objectives', options: ["Hipertrofia", "Ganho de peso", "Emagrecimento consciente", "Melhorar relação com a comida"] },
      { id: 'measurements', title: "Suas medidas iniciais", subtitle: "Para acompanhar sua evolução com gentileza.", type: 'measurements' }
    ];

    const current = steps[diagnosisStep];

    const handleNext = async () => {
      setErrorMsg('');
      if (current.type === 'input' && !tempProfile.name) {
        setErrorMsg('Por favor, informe seu nome.');
        return;
      }
      if (current.type === 'measurements') {
        if (!tempProfile.height || tempProfile.weightEvolution[0].value === 0) {
          setErrorMsg('Preencha altura e peso para continuar.');
          return;
        }
        
        // Calculate Nutritional Needs
        const result = calculateNutritionalNeeds(
          tempProfile.weightEvolution[0].value,
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

            {current.type === 'multiselect' && (
              <div className="space-y-6">
                <div className="grid gap-3">
                  {current.options?.map((opt: any) => {
                    const isOther = opt === 'Outros';
                    const arr = (tempProfile[current.field as keyof UserProfile] as string[]) || [];
                    const selected = arr.includes(opt) || (isOther && arr.some(i => i.startsWith('Outros')));
                    
                    return (
                      <div key={String(opt)}>
                        <button
                          onClick={() => {
                            if (isOther) {
                              if (selected) {
                                setTempProfile({ ...tempProfile, [current.field!]: arr.filter(i => !i.startsWith('Outros')) });
                              } else {
                                setTempProfile({ ...tempProfile, [current.field!]: [...arr, 'Outros: '] });
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
                              value={arr.find(i => i.startsWith('Outros'))?.replace('Outros: ', '') || ''}
                              onChange={(e) => {
                                const newArr = arr.filter(i => !i.startsWith('Outros'));
                                newArr.push('Outros: ' + e.target.value);
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
              const h = tempProfile.height || 0;
              const w = tempProfile.weightEvolution?.[0]?.value || 0;
              const imc = h > 0 && w > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : null;
              let imcStatus = '';
              if (imc) {
                const val = parseFloat(imc);
                if (val < 18.5) imcStatus = 'Abaixo do peso';
                else if (val < 25) imcStatus = 'Peso ideal';
                else if (val < 30) imcStatus = 'Sobrepeso';
                else imcStatus = 'Obesidade';
              }

              return (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="label-sm">Altura (cm)</label>
                      <input type="number" placeholder="Ex: 170" className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-2xl font-medium outline-none"
                        onChange={(e) => { setTempProfile({ ...tempProfile, height: parseFloat(e.target.value) }); setErrorMsg(''); }} />
                    </div>
                    <div>
                      <label className="label-sm">Peso (kg)</label>
                      <input type="number" placeholder="Ex: 70.5" className="w-full py-3 border-b-2 border-line focus:border-accent bg-transparent text-2xl font-medium outline-none"
                        onChange={(e) => { setTempProfile({ ...tempProfile, weightEvolution: [{ date: 'Hoje', value: parseFloat(e.target.value) }] }); setErrorMsg(''); }} />
                    </div>
                  </div>
                  
                  {imc && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-accent/10 border border-accent/30 rounded-[2rem] flex flex-col items-center gap-2">
                      <span className="label-sm text-accent">Seu IMC Atual</span>
                      <div className="text-5xl font-display text-ink">{imc}</div>
                      <span className="text-sm font-bold bg-white px-4 py-1.5 rounded-full shadow-sm text-accent">{imcStatus}</span>
                    </motion.div>
                  )}

                  <div className="p-5 bg-accent-pink/10 border border-accent-pink/30 rounded-2xl flex gap-4">
                    <BookOpen className="text-accent-pink shrink-0" />
                    <p className="text-sm font-medium text-ink/80 leading-relaxed">
                      Sua altura e peso nos ajudam a entender sua jornada corporal e personalizar as recomendações.
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
    const quotes = [
      "A consciência é o primeiro passo para a cura. Observe sem julgar.",
      "Nutrir o corpo é um ato de amor próprio. Faça as pazes com seu prato.",
      "Você não tem fome de comida, tem fome de afeto, de calma, de presença.",
      "Pequenas pausas mudam grandes impulsos. Respire antes de comer."
    ];

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

        <MascotBubble userProfile={userProfile} onShowToast={toast} />

        <section className="animated-gradient p-8 md:p-12 rounded-[2rem] shadow-lg relative overflow-hidden text-paper">
          <Sparkles className="absolute -right-4 -top-4 text-paper/20 w-32 h-32 spin-slow" />
          <div className="relative z-10">
            <h3 className="label-sm mb-4 glass-badge font-bold">Reflexão do Dia</h3>
            <div className="min-h-[6rem] md:min-h-[5rem] flex items-center">
              <AnimatePresence mode="wait">
                <motion.p key={quoteIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }} className="serif-body text-2xl md:text-3xl leading-relaxed drop-shadow-sm">
                  "{quotes[quoteIndex]}"
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-accent" />
              <h3 className="label-sm">Biblioteca</h3>
            </div>
            <button onClick={() => setCurrentPage('content')} className="text-xs font-bold text-accent hover:underline">Ver tudo</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {adminArticles.slice(0, 3).map((post) => (
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
          <div className="flex items-center justify-between mb-6">
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
              loggedMeals.slice(0, 8).map((meal: any, i: number) => (
                <div key={i} onClick={() => { setSelectedMeal(meal); setCurrentPage('meal-details'); }}
                  className="p-4 px-6 border-b border-line last:border-0 flex items-center justify-between hover:bg-accent/5 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${meal.type === 'Emocional' ? 'bg-accent-pink/20 text-accent-pink' : 'bg-accent/10 text-accent'}`}>
                      {meal.icon ? <meal.icon size={20} /> : <Coffee size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{meal.title || 'Refeição'}</h4>
                      <p className="text-xs text-ink/50 font-medium">
                        {meal.time || new Date(meal.date).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} • {meal.preMood || meal.mood || 'Registrado'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-ink/30" />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </PageWrapper>
    );
  };

  const AIChat = () => {
    const { toast } = useToast();
    const [msg, setMsg] = useState('');
    const [typing, setTyping] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
    const [modelOpen, setModelOpen] = useState(false);
    const [history, setHistory] = useState<{ sender: 'user' | 'bot', text: string }[]>(() => {
      const saved = localStorage.getItem('nutriChatHistory');
      if (saved) return JSON.parse(saved);
      return [
        { sender: 'bot', text: `Olá ${userProfile.name || 'amigo'}! Sou a IA do Mind Nutrition. Estou aqui para analisar seus dados e oferecer conselhos gentis sobre sua alimentação. Como posso ajudar hoje?` }
      ];
    });
    const chatRef = useRef<HTMLDivElement>(null);
    const isFirstRender = useRef(true);
    const [fullscreenImg, setFullscreenImg] = useState(false);
    const aiModels = [
      { id: 'gemini-3-flash-preview', label: 'Gemini', desc: 'Rápido e equilibrado', logo: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/gemini-color.png' },
      { id: 'kimi-k2.6', label: 'Kimi', desc: 'Leitura longa e contexto', logo: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/kimi-color.png' },
      { id: 'gemma-3', label: 'Gemma', desc: 'Respostas compactas', logo: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/gemma-color.png' },
    ];
    const activeModel = aiModels.find(model => model.id === selectedModel) || aiModels[0];

    useEffect(() => {
      localStorage.setItem('nutriChatHistory', JSON.stringify(history));
    }, [history]);

    useEffect(() => {
      if (isFirstRender.current) { isFirstRender.current = false; return; }
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, [history, typing]);

    const handleClearHistory = () => {
      setHistory([{ sender: 'bot', text: `Histórico apagado. Olá ${userProfile.name || 'amigo'}! Como posso ajudar hoje?` }]);
      toast('Histórico limpo!', 'heart');
    };

    const handleSend = async () => {
      if (!msg.trim()) return;
      const userMessage = msg.trim();
      setHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
      setMsg('');
      setTyping(true);

      const contextData = `
        Perfil do Usuário:
        Nome: ${userProfile.name}
        Idade: ${userProfile.age}
        Altura: ${userProfile.height}cm
        Peso Atual: ${userProfile.weightEvolution?.[userProfile.weightEvolution.length - 1]?.value || '--'}kg
        Cintura: ${userProfile.waistEvolution?.[userProfile.waistEvolution.length - 1]?.value || '--'}cm
        Quadril: ${userProfile.hipEvolution?.[userProfile.hipEvolution.length - 1]?.value || '--'}cm
        Objetivo: ${userProfile.objectives?.join(', ')}
        Condições: ${userProfile.comorbidities?.join(', ')}
        Gatilhos Emocionais: ${userProfile.triggers?.join(', ')}
      `;

      try {
        const ollamaHistory = history.map(h => ({
          role: h.sender === 'user' ? 'user' : 'assistant',
          content: h.text
        }));

        const response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: `Você é a Nutri AI, uma assistente gentil e compreensiva de nutrição consciente. Use os dados a seguir para personalizar suas respostas:\n${contextData}` },
              ...ollamaHistory,
              { role: 'user', content: userMessage }
            ],
            stream: false
          })
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setHistory(prev => [...prev, { sender: 'bot', text: data.message.content }]);
      } catch (err) {
        setHistory(prev => [...prev, { sender: 'bot', text: 'Desculpe, não consegui me conectar ao serviço de IA no momento. Verifique se o Ollama está rodando localmente (http://localhost:11434).' }]);
        toast('Erro de conexão com a IA', 'error');
      } finally {
        setTyping(false);
      }
    };

    return (
      <PageWrapper noPadding>
        <div className="flex flex-col min-h-[100dvh] h-[100dvh] w-full max-w-5xl mx-auto bg-[radial-gradient(circle_at_top_left,var(--accent-light)_0%,transparent_34%),linear-gradient(180deg,var(--paper)_0%,#ffffff_120%)] overflow-hidden">
          <header className="px-4 md:px-8 pt-4 pb-4 flex items-center justify-between gap-3 border-b border-line shrink-0 bg-white/80 backdrop-blur-xl z-20 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentPage('dashboard')} className="w-11 h-11 rounded-2xl border border-line flex items-center justify-center hover:bg-line transition-colors bg-white shadow-sm shrink-0">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <img src={mascoteAi} alt="Nutri AI" className="w-12 h-12 rounded-2xl object-contain bg-white p-1.5 shadow-sm border border-line" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-paper" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-lg text-ink">Nutri AI</h2>
                  <p className="text-[11px] font-bold text-accent">{typing ? 'Digitando...' : `Usando ${activeModel.label}`}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setModelOpen(open => !open)}
                  className="bg-white border border-line rounded-2xl pl-2 pr-3 py-2 text-xs font-bold outline-none focus:border-accent shadow-sm flex items-center gap-2 min-w-[9.5rem] hover:border-accent transition-colors"
                >
                  <img src={activeModel.logo} alt="" className="w-6 h-6 rounded-lg object-contain bg-ink/5" />
                  <span className="hidden sm:flex flex-col items-start leading-tight">
                    <span>{activeModel.label}</span>
                    <span className="font-medium text-[9px] text-ink/40">{activeModel.desc}</span>
                  </span>
                  <ChevronDown size={14} className={`ml-auto transition-transform ${modelOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {modelOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      className="absolute right-0 mt-2 w-72 bg-white border border-line rounded-3xl shadow-2xl p-3 z-50"
                    >
                      {aiModels.map(model => (
                        <button
                          key={model.id}
                          onClick={() => { setSelectedModel(model.id); setModelOpen(false); }}
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left hover:bg-accent/10 transition-colors ${selectedModel === model.id ? 'text-accent bg-accent/10 ring-1 ring-accent/20' : 'text-ink'}`}
                        >
                          <img src={model.logo} alt="" className="w-10 h-10 rounded-xl object-contain bg-ink/5 border border-line" />
                          <span className="flex-1">
                            <span className="block text-sm font-bold">{model.label}</span>
                            <span className="block text-[11px] font-medium text-ink/45 mt-0.5">{model.desc}</span>
                          </span>
                          {selectedModel === model.id && <CheckCircle size={16} className="text-accent" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={handleClearHistory} className="bg-red-50 text-red-500 border border-red-200 px-3 md:px-4 py-2.5 rounded-2xl text-xs font-bold hover:bg-red-100 transition-colors shadow-sm">
                Limpar
              </button>
            </div>
          </header>

          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 space-y-5">
            {history.map((h, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`flex w-full gap-3 ${h.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {h.sender === 'bot' && (
                  <img src={mascoteAi} alt="Nutri AI" className="w-10 h-10 rounded-2xl object-contain bg-accent/10 p-1 shrink-0 mt-auto shadow-sm" />
                )}
                {h.sender === 'user' && (
                  <ProfileAvatar photo={userProfile.photo} size="sm" className="rounded-2xl shrink-0 mt-auto shadow-sm border border-line" />
                )}
                <div className={`max-w-[82%] md:max-w-[68%] px-5 py-4 rounded-3xl text-[0.95rem] md:text-base font-medium shadow-sm leading-relaxed ${
                  h.sender === 'user' ? 'bg-accent text-white rounded-br-md' : 'bg-white border border-line text-ink rounded-bl-md'
                }`}>
                  {h.sender === 'bot' && i === history.length - 1 && !typing ? (
                    <TypewriterText text={h.text} />
                  ) : h.text}
                </div>
              </motion.div>
            ))}
            {typing && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="flex gap-3">
                <img src={mascoteAi} alt="Nutri AI" className="w-10 h-10 rounded-2xl object-contain bg-accent/10 p-1 shrink-0 shadow-sm" />
                <div className="bg-white border border-line rounded-3xl rounded-bl-md px-5 py-4 flex items-center gap-1.5 shadow-sm">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-2 h-2 rounded-full bg-accent/40"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                  <span className="ml-2 label-sm text-accent animate-pulse">Pensando...</span>
                </div>
              </motion.div>
            )}
          </div>

          <div className="shrink-0 px-4 md:px-8 py-4 bg-paper/90 backdrop-blur-xl border-t border-line pb-safe">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <input
                type="text" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte algo sobre sua alimentação..."
                className="flex-1 py-4 px-6 bg-white border border-line rounded-2xl shadow-sm focus:border-accent focus:outline-none text-base font-medium"
              />
              <motion.button
                onClick={handleSend} disabled={!msg.trim() || typing}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 bg-accent text-white rounded-2xl flex items-center justify-center disabled:opacity-40 hover:bg-accent/90 transition-all shadow-lg shrink-0">
                <Send size={20} className="-ml-0.5" />
              </motion.button>
            </div>
            <p className="text-center text-[10px] text-ink/30 mt-3 font-medium">
              Mind Nutrition AI • Respostas baseadas no seu perfil
            </p>
          </div>
        </div>
      </PageWrapper>
    );
  };

  const MealLog = () => {
    const { toast } = useToast();
    const [step, setStep] = useState<'pre' | 'meal' | 'post'>('pre');
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
      { label: 'Euforia', icon: Sparkles },
      { label: 'Alegria', icon: Smile },
      { label: 'Neutro', icon: Meh },
      { label: 'Frustração', icon: Frown },
      { label: 'Culpa', icon: PiHeartbeat }
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
                  <div className="bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-6">De onde vem sua vontade de comer?</h3>
                    <HungerOdometer value={log.preHunger} onChange={v => setLog({ ...log, preHunger: v })} />
                  </div>
                  <div className="bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-4">Como você está se sentindo agora?</h3>
                    <div className="grid grid-cols-5 gap-2">
                      {moods.map(m => (
                        <button key={m.label} onClick={() => setLog({ ...log, preMood: m.label })}
                          className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all ${log.preMood === m.label ? 'border-accent bg-accent/10 text-accent' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}>
                          <m.icon size={24} />
                          <span className="text-[9px] font-bold">{m.label}</span>
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
                  <div className="flex gap-4 w-full">
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
                    <div className="flex items-center justify-between gap-3 mb-3">
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
                    className="w-full h-40 bg-paper border border-line rounded-[2rem] p-8 font-medium text-lg resize-none focus:outline-none focus:border-accent shadow-sm"
                    value={log.notes} onChange={e => setLog({ ...log, notes: e.target.value })} />
                  <button onClick={() => setStep('post')} className="w-full py-6 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg">
                    Finalizar Refeição
                  </button>
                </>
              )}
              {step === 'post' && (
                <>
                  <div className="bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-6">Reavalie sua fome (Saciedade)</h3>
                    <HungerOdometer value={log.postHunger} onChange={v => setLog({ ...log, postHunger: v })} />
                  </div>
                  <div className="bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-4">Como se sente após comer?</h3>
                    <div className="grid grid-cols-5 gap-2">
                      {moods.map(m => (
                        <button key={m.label} onClick={() => setLog({ ...log, postMood: m.label })}
                          className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all ${log.postMood === m.label ? 'border-accent bg-accent/10 text-accent' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}>
                          <m.icon size={24} />
                          <span className="text-[9px] font-bold">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-paper border border-line p-8 rounded-[2rem] shadow-sm">
                    <h3 className="font-bold mb-4">Nível de Satisfação</h3>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(v => (
                        <button key={v} onClick={() => setLog({ ...log, satisfaction: v })}
                          className={`flex-1 py-5 rounded-2xl border-2 font-bold text-xl transition-all ${log.satisfaction === v ? 'bg-accent border-accent text-paper' : 'border-line bg-transparent hover:bg-line text-ink'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => {
                    const newMeal = { ...log, title: 'Refeição', date: new Date().toISOString(), time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}), type: log.preHunger >= 6 ? 'Física' : 'Emocional', image: log.photos[0] || '' };
                    saveMeal(newMeal);
                    setCurrentPage('dashboard');
                  }} className="w-full py-6 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg animated-gradient">
                    Salvar Registro Diário
                  </button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </PageWrapper>
    );
  };

  const ProgressPage = () => {
    const [showMetricsModal, setShowMetricsModal] = useState(false);
    const [fullscreenImages, setFullscreenImages] = useState<{images: any[], index: number, open: boolean}>({ images: [], index: 0, open: false });
    const [newMetrics, setNewMetrics] = useState({
      weight: userProfile.weightEvolution?.[userProfile.weightEvolution.length - 1]?.value || 0,
      waist: userProfile.waistEvolution?.[userProfile.waistEvolution.length - 1]?.value || 0,
      arm: userProfile.armEvolution?.[userProfile.armEvolution.length - 1]?.value || 0,
      abdomen: userProfile.abdomenEvolution?.[userProfile.abdomenEvolution.length - 1]?.value || 0,
      hip: userProfile.hipEvolution?.[userProfile.hipEvolution.length - 1]?.value || 0,
    });

    const measurementImages = [
      { src: balancaImg, title: 'Balança Digital', description: 'Utilize uma balança digital para medir seu peso corporal. Preferencialmente pela manhã, em jejum e após ir ao banheiro.' },
      { src: fitaImg, title: 'Fita Métrica', description: 'Utilize uma fita métrica flexível e inelástica para suas medições corporais.' },
      { src: cinturaImg, title: 'Medida da Cintura', description: 'Utilize uma fita métrica flexível na parte mais estreita do tronco, geralmente localizada um pouco acima do umbigo e abaixo das costelas.' },
      { src: abdomenImg, title: 'Medida do Abdômen', description: 'Utilize uma fita métrica inelástica, posicione-a no ponto médio entre a última costela e a crista ilíaca (osso do quadril) ou na altura do umbigo, em pé e sem apertar a pele. A medição deve ser feita no final da expiração.' },
      { src: quadrilImg, title: 'Medida do Quadril', description: 'Posicione-se em pé, com os pés juntos, e passe uma fita métrica flexível em torno da parte mais larga das nádegas (geralmente na altura da maior curvatura do bumbum), garantindo que a fita esteja reta e paralela ao solo.' },
    ];

    const openFullscreen = (index: number) => {
      setFullscreenImages({ images: measurementImages, index, open: true });
    };

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
        updatedProfile.imc = parseFloat((newMetrics.weight / Math.pow(updatedProfile.height / 100, 2)).toFixed(1));
      }

      persistUserProfile(updatedProfile);
      setShowMetricsModal(false);
    };

    const imcData = (userProfile.weightEvolution || []).map(w => ({
      date: w.date,
      value: userProfile.height ? parseFloat((w.value / Math.pow(userProfile.height / 100, 2)).toFixed(1)) : 0
    }));

    const rcqData = (userProfile.waistEvolution || []).map(w => {
      const h = (userProfile.hipEvolution || []).find(hip => hip.date === w.date);
      return {
        date: w.date,
        value: h && h.value > 0 ? parseFloat((w.value / h.value).toFixed(2)) : 0
      };
    }).filter(d => d.value > 0);

    const physicalMeals = loggedMeals.filter((meal: any) => meal.type === 'Física' || meal.type === 'FÃ­sica').length;
    const emotionalMeals = loggedMeals.filter((meal: any) => meal.type === 'Emocional').length;
    const hungerPieData = [
      { name: 'Fome Física', value: physicalMeals },
      { name: 'Fome Emocional', value: emotionalMeals },
      { name: 'Não classificada', value: Math.max(loggedMeals.length - physicalMeals - emotionalMeals, 0) },
    ].filter(item => item.value > 0);
    const chartPieData = hungerPieData.length ? hungerPieData : [{ name: 'Nenhuma refeição registrada', value: 1 }];
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const emotionalData = dayLabels.map((day, index) => {
      const meals = loggedMeals.filter((meal: any) => new Date(meal.date || Date.now()).getDay() === index);
      return {
        day,
        fisico: meals.filter((meal: any) => meal.type === 'Física' || meal.type === 'FÃ­sica').length,
        emocional: meals.filter((meal: any) => meal.type === 'Emocional').length,
      };
    });
    const awarenessScore = loggedMeals.length
      ? Math.min(100, Math.round((loggedMeals.filter((meal: any) => meal.notes || meal.postMood || meal.satisfaction).length / loggedMeals.length) * 100))
      : 0;

    return (
    <PageWrapper>
      <div className="space-y-10">
        <div className="flex items-center justify-between">
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="animated-gradient text-paper p-10 rounded-[2.5rem] shadow-lg flex flex-col justify-center lg:col-span-1">
            <h3 className="label-sm text-paper mb-4 glass-badge inline-block self-start font-bold">Consciência Plena</h3>
            <div className="text-7xl font-display mb-2 text-paper drop-shadow-md">{awarenessScore}%</div>
            <p className="text-sm font-medium text-paper/90 leading-relaxed">{loggedMeals.length ? 'Baseado nas refeições registradas e nas emoções informadas.' : 'Registre refeições para gerar sua leitura de consciência.'}</p>
          </div>

          <div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm lg:col-span-2">
            <h3 className="font-bold mb-6 flex items-center gap-2"><span className="text-accent"><Brain size={18} /></span> Equilíbrio Mental vs Físico</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={MOCK_RADAR_DATA}>
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--ink)' }} />
                  <Radar name="Atual" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} />
                  <Radar name="Meta" dataKey="B" stroke="var(--accent-pink)" fill="var(--accent-pink)" fillOpacity={0.1} />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold flex items-center gap-2"><span className="text-accent"><TbHealthRecognition size={20} /></span> Evolução do Peso Corporal</h3>
              <div className="flex gap-4">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-ink/40"><div className="w-2 h-2 rounded-full bg-accent"></div> Atual</span>
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-ink/40"><div className="w-2 h-2 rounded-full bg-accent-pink"></div> Meta</span>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userProfile.weightEvolution}>
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
                  <ReferenceLine y={74} stroke="var(--accent-pink)" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: 'Meta (74kg)', fill: 'var(--accent-pink)', fontSize: 10, fontWeight: 'bold' }} />
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
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm">
            <h3 className="font-bold flex items-center gap-2 mb-8"><span className="text-accent-pink"><Activity size={20} /></span> Evolução do IMC</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={imcData}>
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
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {rcqData.length > 0 && (
            <div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm lg:col-span-2">
              <h3 className="font-bold flex items-center gap-2 mb-8"><span className="text-ink/60"><Activity size={20} /></span> Evolução RCQ (Relação Cintura-Quadril)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rcqData}>
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
                    <ReferenceLine y={userProfile.gender === 'Feminino' ? 0.85 : 0.9} stroke="var(--accent-pink)" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'right', value: 'Risco Elevado', fill: 'var(--accent-pink)', fontSize: 10, fontWeight: 'bold' }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--ink)"
                      strokeWidth={5}
                      fillOpacity={1}
                      fill="url(#colorRCQ)"
                      dot={{ r: 6, fill: 'var(--paper)', stroke: 'var(--ink)', strokeWidth: 3 }}
                      activeDot={{ r: 8, fill: 'var(--ink)', stroke: 'var(--paper)', strokeWidth: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm flex flex-col">
            <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-accent-pink"><Zap size={18} /></span> Fontes de Fome</h3>
            <div className="flex-1 flex items-center">
              <div className="h-44 w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartPieData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                      {chartPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-3">
                {chartPieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs font-bold">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm">
            <h3 className="font-bold mb-6 flex items-center gap-2"><span className="text-accent-pink"><PiHeartbeat size={20} /></span> Oscilação Emocional</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emotionalData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink)' }} dy={10} />
                  <Tooltip cursor={{ fill: 'var(--line)', opacity: 0.5 }} contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="fisico" stackId="a" fill="var(--accent)" radius={[0, 0, 6, 6]} barSize={16} />
                  <Bar dataKey="emocional" stackId="a" fill="var(--accent-pink)" radius={[6, 6, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-8 mt-6">
              <span className="flex items-center gap-2 text-xs font-bold"><div className="w-4 h-4 rounded-full bg-accent"></div> Fome Física</span>
              <span className="flex items-center gap-2 text-xs font-bold"><div className="w-4 h-4 rounded-full bg-accent-pink"></div> Fome Emocional</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Refeições', val: String(loggedMeals.length), icon: Coffee, trend: loggedMeals.length ? 'ativo' : 'zero' },
            { label: 'Físicas', val: String(physicalMeals), icon: Activity, trend: `${Math.round((physicalMeals / Math.max(loggedMeals.length, 1)) * 100)}%` },
            { label: 'Emocionais', val: String(emotionalMeals), icon: Heart, trend: `${Math.round((emotionalMeals / Math.max(loggedMeals.length, 1)) * 100)}%` },
            { label: 'Foco', val: `${awarenessScore}%`, icon: TrendingUp, trend: loggedMeals.length ? 'real' : 'aguardando' },
          ].map((m, i) => (
            <div key={i} className="bg-accent/5 p-6 rounded-3xl border border-accent/10">
              <m.icon size={20} className="text-accent mb-3" />
              <div className="text-2xl font-display text-ink">{m.val}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-bold text-ink/40 uppercase">{m.label}</span>
                <span className="text-[10px] font-bold text-accent">{m.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showMetricsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setShowMetricsModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-paper w-full max-w-2xl rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-12 pb-8 shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <h3 className="display-title text-3xl mb-4 text-center">Atualizar Métricas</h3>
              <p className="text-center text-ink/60 mb-8 serif-body">Clique nas imagens para ver as instruções completas</p>
              <div className="space-y-6">
                 <div className="flex gap-4 items-center bg-white p-4 rounded-3xl border border-line shadow-sm">
                    <div className="w-20 h-20 rounded-2xl shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openFullscreen(0)}>
                      <img src={balancaImg} alt="Balança" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <label className="label-sm block mb-1">Peso (kg)</label>
                      <input type="number" className="w-full py-2 bg-transparent border-b-2 border-line focus:border-accent outline-none font-display text-2xl" 
                        value={newMetrics.weight || ''}
                        onChange={e => setNewMetrics({...newMetrics, weight: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                 </div>

                 <div className="flex gap-4 items-center bg-white p-4 rounded-3xl border border-line shadow-sm">
                    <div className="w-20 h-20 rounded-2xl shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openFullscreen(2)}>
                      <img src={cinturaImg} alt="Cintura" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <label className="label-sm block mb-1">Cintura (cm)</label>
                      <input type="number" className="w-full py-2 bg-transparent border-b-2 border-line focus:border-accent outline-none font-display text-2xl" 
                        value={newMetrics.waist || ''}
                        onChange={e => setNewMetrics({...newMetrics, waist: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                 </div>

                 <div className="flex gap-4 items-center bg-white p-4 rounded-3xl border border-line shadow-sm">
                    <div className="w-20 h-20 rounded-2xl shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openFullscreen(3)}>
                      <img src={abdomenImg} alt="Abdômen" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <label className="label-sm block mb-1">Abdômen (cm)</label>
                      <input type="number" className="w-full py-2 bg-transparent border-b-2 border-line focus:border-accent outline-none font-display text-2xl" 
                        value={newMetrics.abdomen || ''}
                        onChange={e => setNewMetrics({...newMetrics, abdomen: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                 </div>

                 <div className="flex gap-4 items-center bg-white p-4 rounded-3xl border border-line shadow-sm">
                    <div className="w-20 h-20 rounded-2xl shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openFullscreen(4)}>
                      <img src={quadrilImg} alt="Quadril" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <label className="label-sm block mb-1">Quadril (cm)</label>
                      <input type="number" className="w-full py-2 bg-transparent border-b-2 border-line focus:border-accent outline-none font-display text-2xl" 
                        value={newMetrics.hip || ''}
                        onChange={e => setNewMetrics({...newMetrics, hip: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                 </div>

                 <div className="pt-4">
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                     {measurementImages.map((img, idx) => (
                       <MeasurementImageCard
                         key={idx}
                         imageSrc={img.src}
                         title={img.title}
                         description={img.description}
                         onClick={() => openFullscreen(idx)}
                       />
                     ))}
                   </div>
                 </div>

                 <div className="pt-2">
                   <button onClick={handleSaveMetrics} className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-xl hover:shadow-2xl transition-all">
                     Salvar Métricas
                   </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FullscreenImageViewer
        images={fullscreenImages.images}
        currentIndex={fullscreenImages.index}
        isOpen={fullscreenImages.open}
        onClose={() => setFullscreenImages(prev => ({ ...prev, open: false }))}
        onNavigate={(index) => setFullscreenImages(prev => ({ ...prev, index }))}
      />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {adminArticles.map((item) => (
              <button key={item.id} onClick={() => setSelectedArticle(item)} className="group text-left bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm hover:shadow-lg transition-all">
                <div className="h-44 w-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-ink/20 group-hover:bg-transparent transition-colors z-10" />
                  <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-4 left-4 z-20 bg-paper/95 backdrop-blur-md px-4 py-1.5 rounded-full label-sm text-accent">
                    {item.type}
                  </div>
                </div>
                <div className="p-6">
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
    const MealIcon = selectedMeal.icon || Coffee;
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

          <div className="bg-white border border-line rounded-[2.5rem] overflow-hidden shadow-sm">
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
                <MealIcon size={16} className={selectedMeal.type === 'Física' ? 'text-accent' : 'text-accent-pink'} />
                <span className="text-xs font-bold uppercase">{selectedMeal.time}</span>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="flex gap-4">
                <div className="flex-1 bg-accent/5 rounded-3xl p-6 border border-accent/10">
                  <span className="label-sm text-accent mb-2 block">Tipo de Fome</span>
                  <div className="text-xl font-bold flex items-center gap-2">
                    {selectedMeal.type === 'Física' ? <TbHealthRecognition size={24} /> : <PiHeartbeat size={24} />}
                    {selectedMeal.type}
                  </div>
                </div>
                <div className="flex-1 bg-ink/5 rounded-3xl p-6 border border-line">
                  <span className="label-sm text-ink/50 mb-2 block">Estado Emocional</span>
                  <div className="text-xl font-bold flex items-center gap-2">
                    <Smile size={24} className="text-ink/70" />
                    {selectedMeal.mood}
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
                  className="w-full p-6 bg-white border border-line rounded-3xl shadow-sm hover:border-accent hover:bg-accent/5 transition-all flex items-center gap-4 text-left"
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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

  const NotificationSettings = () => (
    <PageWrapper>
      <div className="space-y-12">
        <button onClick={() => setCurrentPage('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="display-title text-5xl">Notificações.</h2>
        <div className="space-y-6 max-w-md">
          {[
            { title: 'Lembretes de Refeição', desc: 'Sinalize momentos de pausa consciente.' },
            { title: 'Dicas do Mascote', desc: 'Pequenas mensagens de carinho do Nutri.' },
            { title: 'Alertas de Evolução', desc: 'Notificações sobre suas conquistas.' }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-6 bg-white border border-line rounded-3xl shadow-sm">
              <div>
                <h4 className="font-bold text-lg">{item.title}</h4>
                <p className="text-xs text-ink/50 font-medium">{item.desc}</p>
              </div>
              <div className="w-12 h-6 bg-accent rounded-full p-1 relative cursor-pointer">
                <div className="w-4 h-4 bg-paper rounded-full shadow-md translate-x-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );

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
                  <div>
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
    const handleDeleteData = async () => {
      if (!window.confirm('Apagar seus dados de perfil e refeições do banco? Esta ação não pode ser desfeita.')) return;
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
        toast('Não foi possível apagar os dados no banco agora.', 'error');
      }
    };

    return (
    <PageWrapper>
      <div className="space-y-12">
        <button onClick={() => setCurrentPage('profile')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="display-title text-5xl">Privacidade.</h2>
        <div className="space-y-6 max-w-md">
          {[
            { title: 'Perfil Privado', desc: 'Seus dados visíveis apenas para você.' },
            { title: 'Backup na Nuvem', desc: 'Sincronize seus dados em outros dispositivos.' },
            { title: 'Autenticação em 2 Passos', desc: 'Mais segurança para seu Studio.' }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-6 bg-white border border-line rounded-3xl shadow-sm">
              <div>
                <h4 className="font-bold text-lg">{item.title}</h4>
                <p className="text-xs text-ink/50 font-medium">{item.desc}</p>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 relative cursor-pointer ${i === 0 ? 'bg-accent' : 'bg-line'}`}>
                <div className={`w-4 h-4 bg-paper rounded-full shadow-md ${i === 0 ? 'translate-x-6' : ''}`} />
              </div>
            </div>
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
          <div className="bg-accent/10 border border-accent/20 p-6 rounded-3xl mb-8">
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Heart size={20} className="text-accent" /> Contato Humano</h3>
            <p className="text-sm text-ink/70 mb-6 font-medium">Nossa equipe clínica está pronta para te atender com todo cuidado e atenção.</p>
            
            <div className="space-y-4">
              <a href="https://wa.me/5511999999999" target="_blank" className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><MessageSquare size={18} /></div>
                <div>
                  <span className="block font-bold text-sm">WhatsApp da Clínica</span>
                  <span className="block text-xs text-ink/60">(11) 99999-9999</span>
                </div>
              </a>
              <a href="tel:+551133333333" className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Activity size={18} /></div>
                <div>
                  <span className="block font-bold text-sm">Telefone Fixo</span>
                  <span className="block text-xs text-ink/60">(11) 3333-3333</span>
                </div>
              </a>
              <a href="mailto:contato@serenanutre.com" className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-accent-pink/20 text-accent-pink rounded-full flex items-center justify-center"><Mail size={18} /></div>
                <div>
                  <span className="block font-bold text-sm">E-mail de Suporte</span>
                  <span className="block text-xs text-ink/60">contato@serenanutre.com</span>
                </div>
              </a>
            </div>
          </div>

          {[
            { title: 'Dúvidas Frequentes', desc: 'Respostas para as perguntas mais comuns.' },
            { title: 'Termos de Uso', desc: 'Nossas regras e responsabilidades.' }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-6 bg-white border border-line rounded-3xl shadow-sm hover:shadow-md cursor-pointer transition-all">
              <div>
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
    const profileActions = [
      { label: 'Editar dados', icon: Edit2, page: 'settings-account' },
      { label: 'Notificações', icon: Bell, page: 'settings-notifications' },
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
            <button onClick={() => setCurrentPage('settings-account')} className="shrink-0 px-5 py-3 rounded-2xl bg-ink text-paper text-sm font-bold inline-flex items-center gap-2 shadow-sm">
              <Edit2 size={16} /> Editar
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'IMC', val: userProfile.imc || '--', tone: 'text-accent bg-accent/10 border-accent/20' },
            { label: 'TMB', val: userProfile.tmb || '--', tone: 'text-accent-pink bg-accent-pink/10 border-accent-pink/20' },
            { label: 'Idade', val: userProfile.age || '--', tone: 'text-ink/70 bg-white border-line' },
            { label: 'Peso', val: latestWeight ? `${latestWeight}kg` : '--', tone: 'text-accent bg-white border-line' },
            { label: 'C/Q', val: latestWaist && latestHip ? (latestWaist / latestHip).toFixed(2) : '--', tone: 'text-accent-pink bg-white border-line' },
          ].map(item => (
            <div key={item.label} className={`rounded-2xl p-4 text-center border shadow-sm ${item.tone}`}>
              <span className="text-[10px] font-bold uppercase block mb-1 opacity-70">{item.label}</span>
              <span className="text-2xl font-display text-ink">{item.val}</span>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-[1fr_1.2fr] gap-4">
          <div className="bg-white border border-line p-6 rounded-3xl shadow-sm">
            <span className="label-sm text-accent">Resumo</span>
            <p className="font-bold text-lg mt-2">{userProfile.objectives?.[0] || 'Defina seu foco principal'}</p>
            <p className="text-sm text-ink/50 mt-2">{userProfile.triggers?.length ? `Gatilhos: ${userProfile.triggers.slice(0, 3).join(', ')}` : 'Gatilhos ainda não informados.'}</p>
            <div className="mt-5 w-12 h-12 bg-accent text-paper rounded-2xl flex items-center justify-center">
              <Brain size={24} />
            </div>
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
            className="w-full py-4 flex items-center justify-center gap-2 text-ink/50 hover:text-accent font-medium transition-colors">
            <HelpCircle size={18} /> Sobre o Mind Nutrition
          </button>
          <button onClick={() => setCurrentPage('landing')} className="w-full py-6 mt-4 flex items-center justify-center gap-3 text-red-500 font-bold border-2 border-red-500/10 rounded-full hover:bg-red-50 transition-colors shadow-sm">
            <LogOut size={20} />
            <span className="uppercase tracking-widest text-sm">Voltar ao Início</span>
          </button>
        </div>
      </div>
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
          <header className="flex items-center justify-between">
            <div>
              <h2 className="display-title text-4xl">Painel do Nutricionista</h2>
              <p className="serif-body text-xl text-ink/60 mt-1">Gerencie usuários e conteúdos</p>
            </div>
            <button onClick={() => { setAdminLoggedIn(false); localStorage.removeItem('nutriAdminLoggedIn'); setCurrentPage('landing'); }}
              className="flex items-center gap-2 text-red-500 font-bold hover:bg-red-50 px-4 py-2 rounded-full transition-colors">
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
                  className="w-full bg-white border border-line p-6 rounded-3xl shadow-sm hover:border-accent hover:shadow-md transition-all flex items-center gap-4 text-left">
                  <ProfileAvatar photo={user.photo} size="md" className="border-2 border-accent/20" />
                  <div className="flex-1">
                    <h4 className="font-bold text-lg">{user.name || 'Sem nome'}</h4>
                    <p className="text-sm text-ink/50">{user.email || 'Sem e-mail'}</p>
                  </div>
                  <div className="text-right">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-paper w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
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
          <div className="flex items-center justify-between">
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
              className="bg-accent text-paper px-6 py-3 rounded-full font-bold text-sm shadow-sm hover:bg-accent/90 transition-colors flex items-center gap-2">
              <PlusCircle size={18} /> Novo Artigo
            </button>
          </div>

          <div className="space-y-4">
            {adminArticles.map((article) => (
              <div key={article.id} className="bg-white border border-line p-6 rounded-3xl shadow-sm flex items-center gap-4">
                <img src={article.image} alt="" className="w-20 h-20 rounded-2xl object-cover" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-accent uppercase">{article.type}</span>
                  <h4 className="font-bold text-lg">{article.title}</h4>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setShowNewArticle(false)} />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-paper w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl">
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
          {currentPage === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }} className="w-full">
              <AIChat />
            </motion.div>
          )}
          {currentPage === 'profile' && <ProfilePage key="profile" />}
          {currentPage === 'settings-account' && <AccountSettings key="account" />}
          {currentPage === 'settings-notifications' && <NotificationSettings key="notifications" />}
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
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={closeArticle} />
            <motion.div
              initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: '100%', scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag={window.innerWidth < 768 ? "y" : false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={handleArticleDragEnd} style={{ y: articleY }}
              className="relative bg-paper w-full h-[90vh] md:h-auto md:max-h-[90vh] md:max-w-3xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
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
                  <p className="drop-cap serif-body text-2xl leading-relaxed mb-8">
                    A relação com a comida é um reflexo profundo de nossas emoções. Quando o estresse ataca, o prato muitas vezes se torna um refúgio.
                  </p>
                  <p className="text-xl leading-relaxed mb-6 font-medium">
                    A prática do <strong>mindful eating</strong> (comer consciente) propõe uma pausa. Não se trata de dietas restritivas, mas de ouvir os sinais do seu corpo.
                  </p>
                  <div className="p-10 bg-accent/10 border-l-8 border-accent rounded-r-[2rem] my-12 serif-body text-2xl text-ink shadow-inner">
                    "Você não tem fome de comida, tem fome de afeto, de calma, de presença."
                  </div>
                  <p className="text-xl leading-relaxed">
                    Na próxima refeição, antes de dar a primeira garfada, feche os olhos por 5 segundos. Pergunte-se: "Como está minha fome física agora? De 0 a 10?". Esse pequeno espaço de tempo é o suficiente para retomar o controle.
                  </p>
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
