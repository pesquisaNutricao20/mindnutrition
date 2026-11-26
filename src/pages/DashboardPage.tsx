import React, { useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Coffee,
  MessageCircle,
  Moon,
  ArrowRight,
  PenTool,
  Sparkles,
  TrendingUp,
  CalendarDays,
  Compass,
  PlusCircle,
  Sprout,
} from 'lucide-react';
import { TbHealthRecognition } from 'react-icons/tb';
import { PiHeartbeat } from 'react-icons/pi';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { StateView } from '../components/ui/StateView';
import { MascotBubble } from '../components/ui/MascotBubble';
import { isDayComplete } from '../data/challenge';
import { inferMealType } from '../lib/metrics';
import { buildIntegratedInsight } from '../lib/insights';
import type { Page, UserProfile } from '../types';

export function DashboardPage({
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
    <PageContainer className="flex flex-col gap-6 md:gap-10">
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

      <div><MascotBubble userProfile={userProfile} onMoodShared={onMoodShared} /></div>

      <section>
        <div className="responsive-page-header mb-4">
          <div className="flex items-center gap-2.5">
            <Coffee size={20} className="text-accent" />
            <h3 className="label-sm text-accent">Últimas refeições</h3>
          </div>
          {loggedMeals.length > 0 && <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full">{loggedMeals.length} registros</span>}
        </div>
        <div className="bg-white border border-line rounded-4xl overflow-hidden shadow-sm">
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
      <section className="rounded-4xl border border-line bg-white p-5 shadow-sm sm:p-6">
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
        className="group relative overflow-hidden rounded-4xl bg-linear-to-br from-accent via-accent to-accent-secondary p-6 text-left text-paper shadow-lg transition-all hover:shadow-xl active:scale-98"
      >
        <Sprout className="absolute -right-6 -bottom-8 text-white/15 w-40 h-40 rotate-12" aria-hidden="true" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <Sprout size={26} />
            </span>
            <div className="text-left">
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
      <section className="mobile-card-padding animated-gradient p-6 md:p-10 rounded-4xl shadow-lg relative overflow-hidden text-paper">
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
      <section className="rounded-4xl border border-line bg-white p-6 shadow-sm">
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
