import { useEffect, useRef, useState } from 'react';
import { Activity, BookOpen, Brain, Info, Moon, PlusCircle, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { TbHealthRecognition } from 'react-icons/tb';
import { PiHeartbeat } from 'react-icons/pi';
import { motion, useReducedMotion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AiSummaryModal } from '../components/shared/AiSummaryModal';
import { ChartFrame } from '../components/shared/ChartFrame';
import { ConfirmationModal } from '../components/shared/ConfirmationModal';
import { MetricsModal } from '../components/shared/MetricsModal';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { StateView } from '../components/ui/StateView';
import mascotAi from '../assets/mascote_ai3.png';
import { COLORS, buildIntegratedInsight, buildRadarData, calculateProfileInsightScore, getWeightGoal } from '../lib/insights';
import { getLatestMetricValue, inferMealType, sortMetricsChronologically } from '../lib/metrics';
import { authHeaders } from '../lib/portal';
import type { Page, UserProfile } from '../types';

function plainSummaryText(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^(?:[-*•▪–]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ProgressPageComponent({
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
    <PageContainer hasTopbar={false} className="space-y-8">
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
              <span className="text-accent"><Brain size={20} /></span> Seus dados combinados
            </h3>
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
            <h3 className="mt-1 text-lg font-bold">Dados percentuais, não um diagnóstico</h3>
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
                  <h3 className="mt-1 text-xl font-bold">Resumo da sua jornada</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink/60">Descreve refeições, sono, diário, medidas e a leitura de consciência para destacar padrões observáveis.</p>
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
