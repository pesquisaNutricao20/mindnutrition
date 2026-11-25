import React, { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  CalendarDays,
  HeartPulse,
  MessageCircle,
  Moon,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AdminApiError, adminApi } from '../../lib/adminApi';
import { STATUS_LABELS, STATUS_TONES, formatDayLong, formatSlot } from '../../lib/schedule';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
import { Skeleton } from '../ui/Skeleton';
import { StateView } from '../ui/StateView';

type Metric = { points: { date: string; value: number }[]; first: number | null; last: number | null; delta: number | null };

type InsightsResponse = {
  generatedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    age: number | null;
    gender: string;
    height: number | null;
    weight: number | null;
    imc: number | null;
    activityLevel: number | null;
    objectives: string[];
    initialEmotions: string[];
    triggers: string[];
    foods: string[];
    comorbidities: string[];
    onboardingComplete: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  };
  insights: {
    awareness: number;
    highlights: string[];
    meals: {
      total: number;
      last30: number;
      daysLogged: number;
      physical: number;
      emotional: number;
      unclassified: number;
      averagePreHunger: number | null;
      averagePostHunger: number | null;
      averageSatisfaction: number | null;
      periods: Record<string, number>;
      topEmotions: { label: string; count: number }[];
      recent: Array<{
        date: string;
        title: string;
        type: string;
        preHunger: number | null;
        postHunger: number | null;
        satisfaction: number | null;
        preMood: string;
        postMood: string;
        notes: string;
        aiDish: string;
      }>;
    };
    sleep: {
      count: number;
      averageHours: number | null;
      qualityScore: number | null;
      latest: Array<{ date: string; hours: number | null; quality: string }>;
    };
    diary: {
      count: number;
      latest: Array<{ date: string; mood: string; text: string }>;
    };
    mood: {
      checkIns: Array<{ date: string; mood: string }>;
      averageScore: number | null;
    };
    measures: {
      weight: Metric;
      waist: Metric;
      abdomen: Metric;
      hip: Metric;
      arm: Metric;
    };
  };
  appointments: Array<{
    id: string;
    day: string;
    slot: string;
    mode: string;
    status: string;
    notes: string;
    nutritionistNote: string;
  }>;
  conversation: {
    lastMessage: string;
    lastSender: string;
    lastAt: string | null;
    unreadFromUser: number;
  };
};

const metricLabels: Array<{ key: keyof InsightsResponse['insights']['measures']; label: string; unit: string }> = [
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'waist', label: 'Cintura', unit: 'cm' },
  { key: 'abdomen', label: 'Abdômen', unit: 'cm' },
  { key: 'hip', label: 'Quadril', unit: 'cm' },
  { key: 'arm', label: 'Braço', unit: 'cm' },
];

function Section({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</span>}
        <div>
          {eyebrow && <p className="font-outfit text-xs font-semibold text-accent">{eyebrow}</p>}
          <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs font-medium text-ink/45">{hint}</p>}
    </div>
  );
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-xs text-ink/40">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink/65">
          {item}
        </span>
      ))}
    </div>
  );
}

function DistributionBar({ physical, emotional, unclassified }: { physical: number; emotional: number; unclassified: number }) {
  const total = Math.max(physical + emotional + unclassified, 1);
  const parts = [
    { label: 'Física', value: physical, tone: 'bg-accent' },
    { label: 'Emocional', value: emotional, tone: 'bg-accent-secondary' },
    { label: 'Não classificada', value: unclassified, tone: 'bg-line' },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line/60">
        {parts.map((part) => (
          <div key={part.label} className={part.tone} style={{ width: `${(part.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs font-semibold text-ink/55">
        {parts.map((part) => (
          <span key={part.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${part.tone}`} /> {part.label}: {part.value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function UserInsightsPanel({
  userId,
  onClose,
  onOpenChat,
}: {
  userId: string;
  onClose: () => void;
  onOpenChat: (user: { id: string; name: string; email: string }) => void;
}) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    adminApi<InsightsResponse>(`/api/admin/insights?userId=${encodeURIComponent(userId)}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof AdminApiError ? err.message : 'Não foi possível carregar os insights.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, reloadToken]);

  const user = data?.user;
  const insights = data?.insights;
  const upcoming = (data?.appointments || []).filter((item) => ['pending', 'confirmed'].includes(item.status)).slice(0, 4);

  return (
    <Overlay
      open
      onClose={onClose}
      title={user?.name || 'Insights do paciente'}
      description={user?.email || 'Resumo dos registros e do acompanhamento do paciente.'}
      variant="drawer"
      panelClassName="md:max-w-3xl"
      bodyClassName="space-y-4 px-4 py-4 sm:px-5"
      closeLabel="Fechar insights"
    >
      <div aria-busy={loading || undefined}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            disabled={!user}
            onClick={() => user && onOpenChat({ id: user.id, name: user.name, email: user.email })}
          >
            <MessageCircle size={14} aria-hidden="true" /> Mensagem
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReloadToken((value) => value + 1)}
            loading={loading}
          >
            <RefreshCw size={14} aria-hidden="true" /> Atualizar
          </Button>
        </div>
          {loading && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-3xl border border-line bg-white p-4">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="mt-3 h-6 w-12" />
                    <Skeleton className="mt-2 h-2 w-20" />
                  </div>
                ))}
              </div>
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-line bg-white p-5">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="mt-4 h-2.5 w-full" />
                  <Skeleton className="mt-2 h-2.5 w-4/5" />
                  <Skeleton className="mt-2 h-2.5 w-3/5" />
                </div>
              ))}
            </>
          )}

          {!loading && error && (
            <StateView
              status="error"
              title="Não foi possível carregar os insights"
              description={error}
              action={(
                <Button variant="secondary" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
                  <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
                </Button>
              )}
            />
          )}

          {!loading && !error && (!user || !insights) && (
            <StateView status="empty" title="Nenhum dado disponível" description="Os insights deste paciente ainda não podem ser exibidos." />
          )}

          {!loading && !error && user && insights && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Consciência" value={`${insights.awareness}%`} hint="Registros + emoções" />
                <Stat label="Refeições" value={insights.meals.total} hint={`${insights.meals.last30} nos últimos 30 dias`} />
                <Stat label="Dias registrados" value={insights.meals.daysLogged} hint="Constância sem cobrança" />
                <Stat label="Satisfação" value={insights.meals.averageSatisfaction ?? '—'} hint="Média de 0 a 5" />
              </div>

              <Section title="Leitura acolhedora" eyebrow="Padrões observados" icon={<Sparkles size={17} />}>
                <ul className="space-y-2">
                  {insights.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2 rounded-2xl bg-accent/5 p-3 text-xs leading-relaxed text-ink/75">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </Section>

              <div className="grid gap-4 sm:grid-cols-2">
                <Section title="Perfil" eyebrow="Contexto" icon={<HeartPulse size={17} />}>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-paper/70 p-2.5"><span className="text-ink/40">Idade</span><p className="font-bold text-ink">{user.age ? `${user.age} anos` : '—'}</p></div>
                    <div className="rounded-xl bg-paper/70 p-2.5"><span className="text-ink/40">Altura</span><p className="font-bold text-ink">{user.height ? `${user.height} cm` : '—'}</p></div>
                    <div className="rounded-xl bg-paper/70 p-2.5"><span className="text-ink/40">Peso atual</span><p className="font-bold text-ink">{user.weight ? `${user.weight} kg` : '—'}</p></div>
                    <div className="rounded-xl bg-paper/70 p-2.5"><span className="text-ink/40">IMC</span><p className="font-bold text-ink">{user.imc ?? '—'}</p></div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Objetivos</p>
                    <Chips items={user.objectives} empty="Nenhum objetivo informado." />
                    <p className="pt-1 text-xs font-bold uppercase tracking-wide text-ink/40">Gatilhos emocionais</p>
                    <Chips items={user.triggers} empty="Nenhum gatilho informado." />
                    <p className="pt-1 text-xs font-bold uppercase tracking-wide text-ink/40">Emoções iniciais</p>
                    <Chips items={user.initialEmotions} empty="Nenhuma emoção informada." />
                  </div>
                </Section>

                <Section title="Fome e emoções" eyebrow="Refeições" icon={<Activity size={17} />}>
                  <DistributionBar physical={insights.meals.physical} emotional={insights.meals.emotional} unclassified={insights.meals.unclassified} />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Stat label="Fome antes" value={insights.meals.averagePreHunger ?? '—'} />
                    <Stat label="Fome depois" value={insights.meals.averagePostHunger ?? '—'} />
                    <Stat label="Registros" value={insights.meals.total} />
                  </div>
                  {insights.meals.topEmotions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Emoções mais citadas</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {insights.meals.topEmotions.map((emotion) => (
                          <span key={emotion.label} className="rounded-full bg-accent-secondary/15 px-2.5 py-1 text-xs font-semibold text-ink/65">
                            {emotion.label} · {emotion.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-ink/55">
                    {Object.entries(insights.meals.periods).filter(([, count]) => count > 0).map(([period, count]) => (
                      <span key={period} className="rounded-lg bg-paper/70 px-2 py-1">{period}: <strong className="text-ink/75">{count}</strong></span>
                    ))}
                  </div>
                </Section>
              </div>

              <Section title="Medidas e evolução" eyebrow="Sem metas, sem cobrança" icon={<TrendingUp size={17} />}>
                <div className="space-y-2">
                  {metricLabels.map((metric) => {
                    const entry = insights.measures[metric.key];
                    if (!entry.last) {
                      return (
                        <div key={metric.key} className="flex items-center justify-between rounded-xl bg-paper/60 px-3 py-2 text-xs text-ink/40">
                          <span>{metric.label}</span><span>Sem registro</span>
                        </div>
                      );
                    }
                    const trend = entry.delta === null ? null : entry.delta > 0 ? `+${entry.delta}` : String(entry.delta);
                    return (
                      <div key={metric.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper/60 px-3 py-2 text-xs">
                        <span className="font-semibold text-ink/60">{metric.label}</span>
                        <span className="font-bold text-ink">
                          {entry.first} → {entry.last} {metric.unit}
                        </span>
                        {trend && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ink/50">{trend} {metric.unit}</span>}
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="grid gap-4 sm:grid-cols-2">
                <Section title="Sono" eyebrow="Descanso" icon={<Moon size={17} />}>
                  {insights.sleep.count ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Stat label="Média de horas" value={insights.sleep.averageHours ?? '—'} />
                        <Stat label="Qualidade" value={insights.sleep.qualityScore ?? '—'} hint="0 a 100" />
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {insights.sleep.latest.map((log, index) => (
                          <div key={`${log.date}-${index}`} className="flex items-center justify-between rounded-lg bg-paper/60 px-2.5 py-1.5 text-xs text-ink/60">
                            <span>{log.date || 'Sem data'}</span>
                            <span className="font-semibold text-ink/75">{log.hours ?? '—'}h · {log.quality || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-xs text-ink/40">Nenhum registro de sono ainda.</p>}
                </Section>

                <Section title="Humor e diário" eyebrow="Contexto emocional" icon={<BookOpen size={17} />}>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Check-ins" value={insights.mood.checkIns.length} />
                    <Stat label="Humor médio" value={insights.mood.averageScore ?? '—'} hint="0 a 100" />
                  </div>
                  {insights.diary.latest.length ? (
                    <div className="mt-3 space-y-2">
                      {insights.diary.latest.map((note, index) => (
                        <div key={`${note.date}-${index}`} className="rounded-xl bg-paper/60 p-2.5 text-xs leading-relaxed text-ink/65">
                          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-ink/40">
                            <span>{note.date || 'Sem data'}</span>
                            {note.mood && <span>· {note.mood}</span>}
                          </div>
                          {note.text || 'Sem texto.'}
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-xs text-ink/40">Nenhuma anotação no diário ainda.</p>}
                </Section>
              </div>

              <Section title="Refeições recentes" eyebrow="Últimos registros" icon={<CalendarDays size={17} />}>
                {insights.meals.recent.length ? (
                  <div className="space-y-2">
                    {insights.meals.recent.map((meal, index) => (
                      <div key={`${meal.date}-${index}`} className="rounded-2xl border border-line bg-paper/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-ink">{meal.title}{meal.aiDish ? ` · ${meal.aiDish}` : ''}</p>
                          <span className="text-xs font-semibold text-ink/40">
                            {new Date(meal.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-bold">
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">{meal.type === 'physical' ? 'Fome física' : meal.type === 'emotional' ? 'Fome emocional' : 'Não classificada'}</span>
                          {meal.preHunger !== null && <span className="rounded-full bg-white px-2 py-0.5 text-ink/55">Fome {meal.preHunger}/10 antes</span>}
                          {meal.postHunger !== null && <span className="rounded-full bg-white px-2 py-0.5 text-ink/55">{meal.postHunger}/10 depois</span>}
                          {meal.satisfaction !== null && <span className="rounded-full bg-white px-2 py-0.5 text-ink/55">Satisfação {meal.satisfaction}/5</span>}
                          {meal.preMood && <span className="rounded-full bg-white px-2 py-0.5 text-ink/55">{meal.preMood}</span>}
                        </div>
                        {meal.notes && <p className="mt-2 text-xs leading-relaxed text-ink/55">{meal.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-ink/40">Nenhuma refeição registrada ainda.</p>}
              </Section>

              <Section title="Consultas" eyebrow="Agenda do paciente" icon={<CalendarDays size={17} />}>
                {upcoming.length ? (
                  <div className="space-y-2">
                    {upcoming.map((appointment) => (
                      <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper/40 p-3">
                        <div>
                          <p className="text-xs font-bold capitalize text-ink">{formatDayLong(appointment.day)}</p>
                          <p className="text-xs text-ink/50">{formatSlot(appointment.slot)} · {appointment.mode === 'presencial' ? 'Presencial' : 'Online'}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_TONES[appointment.status] || STATUS_TONES.pending}`}>
                          {STATUS_LABELS[appointment.status] || appointment.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-ink/40">Nenhuma consulta ativa no momento.</p>}
              </Section>

              <p className="pb-4 text-center text-xs leading-relaxed text-ink/35">
                Insights gerados a partir dos registros do próprio paciente. Use como apoio à conversa, nunca como julgamento.
              </p>
            </>
          )}
      </div>
    </Overlay>
  );
}
