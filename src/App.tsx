import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Home, PlusCircle, Activity, User, Bell, Library, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from './components/Toast';
import { ProfileAvatar } from './components/ui/ProfileAvatar';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { PageContainer } from './components/ui/PageContainer';
import { Button } from './components/ui/Button';
import { Overlay } from './components/ui/Overlay';
import { StateView } from './components/ui/StateView';
import { RouteErrorBoundary } from './components/ui/RouteErrorBoundary';
import { HungerGuideModal } from './components/shared/HungerGuideModal';
import { TutorialModal } from './components/shared/TutorialModal';
import { DailyDiaryModal } from './components/shared/DailyDiaryModal';
import { SleepModal } from './components/shared/SleepModal';
import { DEFAULT_PROFILE_PHOTO } from './constants';
import type { Page, UserProfile, DailyNote, SleepLog } from './types';
import { DEFAULT_RECIPES } from './data/recipes';
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
import { loadConversation, loadUnreadMessageCount, type ChatMessage } from './lib/portal';
import { getPagePath, parseRoute } from './lib/routes';
import {
  getPostLoginPage,
  mergeProfileData,
  sanitizeProfileDefaults,
  withProfileCompletionState,
} from './lib/profile';
import iconApp from './assets/logo/icon_app.png';
import { LandingPage } from './pages/LandingPage';

const AuthPage = lazy(() => import('./components/AuthPage').then(({ AuthPage }) => ({ default: AuthPage })));
const DiagnosisPage = lazy(() => import('./pages/DiagnosisPage').then(({ DiagnosisPage }) => ({ default: DiagnosisPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })));
const MealLogPage = lazy(() => import('./pages/MealLogPage').then(({ MealLogPage }) => ({ default: MealLogPage })));
const MealDetailsPageComponent = lazy(() => import('./pages/MealDetailsPage').then(({ MealDetailsPageComponent }) => ({ default: MealDetailsPageComponent })));
const ContentPageComponent = lazy(() => import('./pages/ContentPage').then(({ ContentPageComponent }) => ({ default: ContentPageComponent })));
const UserCarePage = lazy(() => import('./components/UserCarePage').then(({ UserCarePage }) => ({ default: UserCarePage })));
const ProgressPageComponent = lazy(() => import('./pages/ProgressPage').then(({ ProgressPageComponent }) => ({ default: ProgressPageComponent })));
const ChallengePage = lazy(() => import('./pages/ChallengePage').then(({ ChallengePage }) => ({ default: ChallengePage })));
const ProfilePageComponent = lazy(() => import('./pages/ProfilePage').then(({ ProfilePageComponent }) => ({ default: ProfilePageComponent })));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage').then(({ AccountSettingsPage }) => ({ default: AccountSettingsPage })));
const PrivacySettingsPage = lazy(() => import('./pages/PrivacySettingsPage').then(({ PrivacySettingsPage }) => ({ default: PrivacySettingsPage })));
const SettingsHelpPage = lazy(() => import('./pages/SettingsHelpPage').then(({ SettingsHelpPage }) => ({ default: SettingsHelpPage })));
const AdminPlatform = lazy(() => import('./components/admin/AdminPlatform').then(({ AdminPlatform }) => ({ default: AdminPlatform })));

const PAGES_WITHOUT_NAV: Page[] = [
  'landing',
  'auth',
  'diagnosis',
  'admin-login',
  'admin-dashboard',
  'admin-users',
  'admin-articles',
  'meal-log',
  'meal-details',
  'content',
  'challenge',
  'progress',
  'settings-account',
  'settings-privacy',
  'settings-help',
  'messages',
];

// =========================================================================
// MAIN APP COMPONENT
// =========================================================================

export default function App() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute] = useState(() => parseRoute(window.location.pathname));
  const [currentPage, setCurrentPageState] = useState<Page>(initialRoute.page);
  const [routeMealId, setRouteMealId] = useState<string | undefined>(initialRoute.mealId);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
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

  const setCurrentPage = useCallback((
    page: Page | ((previous: Page) => Page),
    mealId?: string,
    options?: { replace?: boolean },
  ) => {
    const requestedPage = typeof page === 'function' ? page(currentPageRef.current) : page;
    const targetMealId = requestedPage === 'meal-details'
      ? mealId || selectedMeal?.id || routeMealId
      : undefined;
    const nextPage = requestedPage === 'meal-details' && !targetMealId ? 'dashboard' : requestedPage;
    const nextPath = getPagePath(nextPage, targetMealId);

    if (window.location.pathname !== nextPath) {
      const state = { mindNutritionPage: nextPage };
      if (options?.replace) window.history.replaceState(state, '', nextPath);
      else window.history.pushState(state, '', nextPath);
    }

    currentPageRef.current = nextPage;
    setRouteMealId(targetMealId);
    setCurrentPageState(nextPage);
  }, [selectedMeal, routeMealId]);

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
    const route = parseRoute(window.location.pathname);
    if (!route.recognized) {
      window.history.replaceState({ mindNutritionPage: route.page }, '', route.path);
    } else {
      window.history.replaceState(
        { ...window.history.state, mindNutritionPage: route.page },
        '',
        `${route.path}${window.location.search}${window.location.hash}`,
      );
    }

    const handlePopState = () => {
      const nextRoute = parseRoute(window.location.pathname);
      if (!nextRoute.recognized) {
        window.history.replaceState({ mindNutritionPage: nextRoute.page }, '', nextRoute.path);
      }
      currentPageRef.current = nextRoute.page;
      setSelectedMeal(previous => previous?.id === nextRoute.mealId ? previous : null);
      setRouteMealId(nextRoute.mealId);
      setCurrentPageState(nextRoute.page);
      window.scrollTo(0, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (currentPage !== 'meal-details' || !routeMealId) return;
    const meal = loggedMeals.find(item => String(item.id) === routeMealId);
    setSelectedMeal(meal || null);
  }, [loggedMeals, currentPage, routeMealId]);

  useEffect(() => {
    window.scrollTo(0, 0);
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

  const hasAppNavigation = !PAGES_WITHOUT_NAV.includes(currentPage);

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
    if (!hasAppNavigation || isLoading) return null;

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
    if (!hasAppNavigation || isLoading) return null;
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
    if (!hasAppNavigation || isLoading) return null;

    // Cinco itens: Início, Insights, Registrar (centro), Biblioteca, Perfil.
    return (
      <div className="mobile-nav fixed inset-x-0 bottom-0 z-40 flex justify-center bg-white pb-[env(safe-area-inset-bottom,0px)] pointer-events-none">
        <nav aria-label="Navegação principal" className="pointer-events-auto grid h-16 w-full grid-cols-5 items-center rounded-t-[1.75rem] rounded-b-none border-x-0 border-b-0 border-t border-line bg-white px-1.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.id as Page);

            if (item.primary) {
              return (
                <div key={item.id} className="flex justify-center items-center">
                  <button
                    type="button"
                    onClick={() => setCurrentPage('meal-log')}
                    className="relative -top-5 flex h-12 w-16 items-center justify-center rounded-full border-4 border-white bg-accent text-paper shadow-lg hover:scale-105 active:scale-95 transition-transform"
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
                <div className="relative flex items-center justify-center px-3 py-1.5">
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
          <Suspense
            fallback={(
              <PageContainer hasTopbar={hasAppNavigation}>
                <StateView status="loading" title="Abrindo página..." compact />
              </PageContainer>
            )}
          >
            <RouteErrorBoundary
              key={currentPage}
              hasTopbar={hasAppNavigation}
              onHome={() => setCurrentPage('landing')}
            >
          {currentPage === 'landing' && (
            <LandingPage
              key="landing"
              hasSession={Boolean(currentUserId)}
              onStart={() => setCurrentPage(currentUserId ? getPostLoginPage(userProfile) : 'auth')}
            />
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
              onSelectMeal={(m) => { setSelectedMeal(m); setCurrentPage('meal-details', m.id); }}
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
              onOpenHungerGuide={() => setShowHungerModal(true)}
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
            selectedMeal ? (
              <MealDetailsPageComponent
                key={selectedMeal.id || 'meal-details'}
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
            ) : (
              <PageContainer variant="narrow" hasTopbar={false}>
                <StateView
                  status="empty"
                  title="Refeição não encontrada"
                  description="O registro pode ter sido excluído ou não está disponível neste aparelho."
                  action={<Button onClick={() => setCurrentPage('dashboard')}>Voltar ao painel</Button>}
                />
              </PageContainer>
            )
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
            </RouteErrorBoundary>
          </Suspense>
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
