import { useEffect, useRef, useState } from 'react';
import { Check, Flower2, Sprout } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ChallengePlant } from '../components/ui/ChallengePlant';
import { FormField } from '../components/ui/FormField';
import { Overlay } from '../components/ui/Overlay';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import {
  CHALLENGE_ACTIVITIES,
  CHALLENGE_MISSIONS,
  WEEK_BADGES,
  challengeFeedback,
  dayPoints,
  gardenStage,
  isDayComplete,
} from '../data/challenge';
import type { ChallengeState, Page, UserProfile } from '../types';

export function ChallengePage({
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
      <PageContainer hasTopbar={false} className="space-y-6">
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
    <PageContainer hasTopbar={false} className="space-y-6">
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
        <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
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
