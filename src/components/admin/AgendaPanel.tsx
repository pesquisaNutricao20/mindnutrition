import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AdminApiError, adminApi } from '../../lib/adminApi';
import { Skeleton } from './Skeleton';
import {
  STATUS_LABELS,
  STATUS_TONES,
  WEEKDAY_LABELS,
  addMonths,
  buildMonthGrid,
  formatDayLong,
  formatSlot,
  monthLabel,
  startOfMonth,
  todayKey,
} from '../../lib/schedule';

type AdminAppointment = {
  id: string;
  userId: string;
  day: string;
  slot: string;
  mode: 'online' | 'presencial';
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
  notes: string;
  nutritionistNote: string;
  patient: { id: string; name: string; email: string };
};

type Block = { id: string; day: string; reason: string };

type AgendaResponse = {
  today: string;
  slots: string[];
  appointments: AdminAppointment[];
  blocks: Block[];
};

const statusDot: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-500',
  completed: 'bg-sky-400',
  declined: 'bg-red-400',
  cancelled: 'bg-ink/25',
};

export function AgendaPanel({
  toast,
  onOpenChat,
  onOpenInsights,
}: {
  toast: (message: string, kind?: 'success' | 'error' | 'info') => void;
  onOpenChat?: (user: { id: string; name: string; email: string }) => void;
  onOpenInsights?: (userId: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [blockReason, setBlockReason] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const range = useMemo(() => ({
    from: cells[0]?.key || todayKey(),
    to: cells[cells.length - 1]?.key || todayKey(),
  }), [cells]);

  useEffect(() => {
    let active = true;
    if (!data) setLoading(true); else setRefreshing(true);
    setError('');
    adminApi<AgendaResponse>(`/api/admin/appointments?from=${range.from}&to=${range.to}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof AdminApiError && err.status === 401) {
          setError('Sua sessão expirou. Entre novamente.');
          return;
        }
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a agenda.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [range.from, range.to, reloadToken]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AdminAppointment[]>();
    (data?.appointments || []).forEach((appointment) => {
      if (!map.has(appointment.day)) map.set(appointment.day, []);
      map.get(appointment.day)!.push(appointment);
    });
    map.forEach((list) => list.sort((a, b) => a.slot.localeCompare(b.slot)));
    return map;
  }, [data]);

  const blockedByDay = useMemo(() => {
    const map = new Map<string, Block>();
    (data?.blocks || []).forEach((block) => map.set(block.day, block));
    return map;
  }, [data]);

  const pending = (data?.appointments || [])
    .filter((appointment) => appointment.status === 'pending')
    .sort((a, b) => `${a.day}${a.slot}`.localeCompare(`${b.day}${b.slot}`));

  const selectedAppointments = appointmentsByDay.get(selectedDay) || [];
  const selectedBlock = blockedByDay.get(selectedDay);

  const decide = async (appointment: AdminAppointment, status: 'confirmed' | 'declined' | 'completed' | 'cancelled') => {
    if (busyId) return;
    setBusyId(appointment.id);
    try {
      await adminApi('/api/admin/appointments', {
        method: 'PUT',
        body: JSON.stringify({
          id: appointment.id,
          status,
          nutritionistNote: notes[appointment.id] || '',
        }),
      });
      toast(
        status === 'confirmed'
          ? 'Consulta confirmada. A pessoa já pode ver na agenda.'
          : status === 'declined'
            ? 'Solicitação recusada com elegância.'
            : status === 'completed'
              ? 'Consulta marcada como realizada.'
              : 'Consulta cancelada.',
        'success',
      );
      setReloadToken((value) => value + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível atualizar a consulta.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleBlock = async () => {
    if (blockBusy) return;
    setBlockBusy(true);
    try {
      if (selectedBlock) {
        await adminApi(`/api/admin/appointments?blockId=${encodeURIComponent(selectedBlock.id)}`, { method: 'DELETE' });
        toast('Dia liberado na agenda.', 'success');
      } else {
        await adminApi('/api/admin/appointments', {
          method: 'POST',
          body: JSON.stringify({ day: selectedDay, reason: blockReason.trim() }),
        });
        toast('Dia bloqueado para novas solicitações.', 'success');
        setBlockReason('');
      }
      setReloadToken((value) => value + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível alterar o bloqueio.', 'error');
    } finally {
      setBlockBusy(false);
    }
  };

  const goToday = () => {
    const today = todayKey();
    setMonth(startOfMonth(new Date()));
    setSelectedDay(today);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-white p-4 sm:flex-row sm:items-center">
        <div>
          <p className="label-sm text-accent">Agenda</p>
          <h2 className="font-display text-xl font-semibold text-ink">Consultas e disponibilidade</h2>
          <p className="mt-0.5 text-[11px] text-ink/45">
            {pending.length
              ? `${pending.length} solicitaç${pending.length === 1 ? 'ão' : 'ões'} aguardando seu aceite`
              : 'Nenhuma solicitação pendente agora'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-full border border-line px-3.5 py-2 text-[11px] font-bold text-ink/60 transition hover:bg-paper"
          >
            Hoje
          </button>
          <div className="flex items-center gap-1 rounded-full border border-line bg-paper px-1 py-1">
            <button
              type="button"
              onClick={() => setMonth((current) => addMonths(current, -1))}
              aria-label="Mês anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink/60 transition hover:bg-white"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[130px] text-center text-[11px] font-bold capitalize text-ink/70">{monthLabel(month)}</span>
            <button
              type="button"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              aria-label="Próximo mês"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink/60 transition hover:bg-white"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            aria-label="Atualizar agenda"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink/50 transition hover:bg-paper"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-700"><AlertTriangle size={16} /> {error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-100"
          >
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-800">
            <Clock size={14} /> Solicitações aguardando confirmação
          </p>
          <div className="mt-3 space-y-2">
            {pending.map((appointment) => (
              <div key={appointment.id} className="rounded-2xl border border-amber-200/70 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{appointment.patient?.name || 'Paciente'}</p>
                    <p className="text-[11px] capitalize text-ink/55">
                      {formatDayLong(appointment.day)} · {formatSlot(appointment.slot)} · {appointment.mode === 'presencial' ? 'Presencial' : 'Online'}
                    </p>
                    {appointment.notes && <p className="mt-1 text-[11px] leading-relaxed text-ink/50">“{appointment.notes}”</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void decide(appointment, 'confirmed')}
                      disabled={busyId === appointment.id}
                      className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold text-paper transition hover:bg-accent/90 disabled:opacity-50"
                    >
                      {busyId === appointment.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(appointment, 'declined')}
                      disabled={busyId === appointment.id}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-[10px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <X size={11} /> Recusar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="pb-1 text-[10px] font-bold uppercase tracking-wide text-ink/35">{label}</span>
            ))}
            {loading ? (
              Array.from({ length: 35 }).map((_, index) => (
                <Skeleton key={index} className="min-h-[62px] rounded-xl" />
              ))
            ) : cells.map((cell) => {
              const list = appointmentsByDay.get(cell.key) || [];
              const blocked = blockedByDay.has(cell.key);
              const isToday = cell.key === (data?.today || todayKey());
              const isSelected = cell.key === selectedDay;
              const isPast = cell.key < (data?.today || todayKey());
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDay(cell.key)}
                  className={`relative flex min-h-[62px] flex-col items-center justify-start gap-0.5 rounded-xl border px-1 py-1.5 transition ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : blocked
                        ? 'border-red-100 bg-red-50/70 hover:border-red-200'
                        : isPast
                          ? 'border-transparent bg-paper/40 text-ink/30'
                          : 'border-transparent hover:border-line hover:bg-paper/60'
                  } ${cell.inMonth ? 'text-ink' : 'text-ink/25'}`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    isToday ? 'bg-accent text-paper' : ''
                  }`}>
                    {cell.dayNumber}
                  </span>
                  {blocked && <Lock size={9} className="text-red-400" />}
                  <div className="flex flex-wrap items-center justify-center gap-0.5">
                    {list.slice(0, 4).map((appointment) => (
                      <span key={appointment.id} className={`h-1.5 w-1.5 rounded-full ${statusDot[appointment.status]}`} />
                    ))}
                    {list.length > 4 && <span className="text-[8px] font-bold text-ink/40">+{list.length - 4}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[10px] font-semibold text-ink/45">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Pendente</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmada</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" /> Realizada</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={10} className="text-red-400" /> Dia bloqueado</span>
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="label-sm text-accent">Dia selecionado</p>
              <h3 className="font-display text-lg font-semibold capitalize text-ink">{formatDayLong(selectedDay)}</h3>
            </div>
            {loading ? (
              <Skeleton className="h-6 w-24 rounded-full" />
            ) : (
              <span className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-ink/50">
                {selectedAppointments.length} consulta{selectedAppointments.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {loading && Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-2.5 w-1/2" />
                <Skeleton className="mt-2 h-8 w-full rounded-lg" />
              </div>
            ))}
            {!loading && !selectedAppointments.length && (
              <div className="rounded-2xl border border-dashed border-line bg-paper/40 p-4 text-center">
                <CalendarDays size={20} className="mx-auto text-ink/25" />
                <p className="mt-2 text-[11px] font-semibold text-ink/50">Nenhuma consulta neste dia.</p>
              </div>
            )}

            {selectedAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded-2xl border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{appointment.patient?.name || 'Paciente'}</p>
                    <p className="truncate text-[10px] text-ink/45">{appointment.patient?.email || 'Sem e-mail'}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${STATUS_TONES[appointment.status] || STATUS_TONES.pending}`}>
                    {STATUS_LABELS[appointment.status] || appointment.status}
                  </span>
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                  <Clock size={11} /> {formatSlot(appointment.slot)} · {appointment.mode === 'presencial' ? 'Presencial' : 'Online'}
                </p>
                {appointment.notes && (
                  <p className="mt-1.5 rounded-xl bg-paper/70 p-2 text-[11px] leading-relaxed text-ink/55">“{appointment.notes}”</p>
                )}
                {appointment.nutritionistNote && (
                  <p className="mt-1.5 rounded-xl bg-accent/5 p-2 text-[11px] leading-relaxed text-accent">Sua nota: {appointment.nutritionistNote}</p>
                )}

                {appointment.status === 'pending' && (
                  <input
                    value={notes[appointment.id] || ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [appointment.id]: event.target.value.slice(0, 800) }))}
                    placeholder="Nota para a pessoa (opcional)"
                    className="mt-2 w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[11px] text-ink outline-none focus:border-accent focus:bg-white"
                  />
                )}

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {appointment.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void decide(appointment, 'confirmed')}
                        disabled={busyId === appointment.id}
                        className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold text-paper disabled:opacity-50"
                      >
                        <Check size={11} /> Aceitar
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide(appointment, 'declined')}
                        disabled={busyId === appointment.id}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-[10px] font-bold text-red-600 disabled:opacity-50"
                      >
                        <X size={11} /> Recusar
                      </button>
                    </>
                  )}
                  {appointment.status === 'confirmed' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void decide(appointment, 'completed')}
                        disabled={busyId === appointment.id}
                        className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                      >
                        <Check size={11} /> Realizada
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide(appointment, 'cancelled')}
                        disabled={busyId === appointment.id}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[10px] font-bold text-ink/55 disabled:opacity-50"
                      >
                        <Trash2 size={11} /> Cancelar
                      </button>
                    </>
                  )}
                  {onOpenInsights && (
                    <button
                      type="button"
                      onClick={() => onOpenInsights(appointment.patient?.id || appointment.userId)}
                      className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[10px] font-bold text-accent transition hover:bg-accent/5"
                    >
                      <Sparkles size={11} /> Insights
                    </button>
                  )}
                  {onOpenChat && (
                    <button
                      type="button"
                      onClick={() => onOpenChat({
                        id: appointment.patient?.id || appointment.userId,
                        name: appointment.patient?.name || '',
                        email: appointment.patient?.email || '',
                      })}
                      className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[10px] font-bold text-ink/55 transition hover:bg-paper"
                    >
                      <MessageCircle size={11} /> Mensagem
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-paper/50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink/60">
              <Lock size={12} /> {selectedBlock ? 'Dia bloqueado' : 'Bloquear este dia'}
            </p>
            {selectedBlock ? (
              <div className="mt-2">
                {selectedBlock.reason && <p className="text-[11px] text-ink/50">Motivo: {selectedBlock.reason}</p>}
                <button
                  type="button"
                  onClick={() => void toggleBlock()}
                  disabled={blockBusy}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-bold text-accent transition hover:bg-accent/5 disabled:opacity-50"
                >
                  {blockBusy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Liberar dia
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
                <input
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value.slice(0, 300))}
                  placeholder="Motivo (opcional)"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] text-ink outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => void toggleBlock()}
                  disabled={blockBusy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[10px] font-bold text-paper transition hover:bg-ink/90 disabled:opacity-50"
                >
                  {blockBusy ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />} Bloquear
                </button>
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-ink/35">
              Dias bloqueados somem das opções de marcação do paciente. Consultas já existentes continuam visíveis.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
