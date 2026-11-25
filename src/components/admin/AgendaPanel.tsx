import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AdminApiError, adminApi } from '../../lib/adminApi';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Overlay } from '../ui/Overlay';
import { Skeleton } from '../ui/Skeleton';
import { StateView } from '../ui/StateView';
import {
  type CalendarCell,
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

type AgendaConfirmation =
  | { kind: 'appointment'; appointment: AdminAppointment }
  | { kind: 'block'; day: string; blocked: boolean; reason: string };

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
  const [confirmation, setConfirmation] = useState<AgendaConfirmation | null>(null);
  const [confirmationError, setConfirmationError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const decidingRef = useRef(false);
  const blockActionRef = useRef(false);
  const confirmationBusyRef = useRef(false);
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const monthDays = useMemo(() => cells.filter((cell) => cell.inMonth), [cells]);
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
    if (decidingRef.current) return false;
    decidingRef.current = true;
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
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível atualizar a consulta.', 'error');
      return false;
    } finally {
      decidingRef.current = false;
      setBusyId(null);
    }
  };

  const toggleBlock = async (target: AgendaConfirmation | null = confirmation) => {
    if (!target || target.kind !== 'block' || blockActionRef.current) return false;
    blockActionRef.current = true;
    setBlockBusy(true);
    try {
      const block = blockedByDay.get(target.day);
      if (block) {
        await adminApi(`/api/admin/appointments?blockId=${encodeURIComponent(block.id)}`, { method: 'DELETE' });
        toast('Dia liberado na agenda.', 'success');
      } else {
        await adminApi('/api/admin/appointments', {
          method: 'POST',
          body: JSON.stringify({ day: target.day, reason: target.reason.trim() }),
        });
        toast('Dia bloqueado para novas solicitações.', 'success');
        if (target.day === selectedDay) setBlockReason('');
      }
      setReloadToken((value) => value + 1);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível alterar o bloqueio.', 'error');
      return false;
    } finally {
      blockActionRef.current = false;
      setBlockBusy(false);
    }
  };

  const requestDecision = (appointment: AdminAppointment, status: 'confirmed' | 'declined' | 'completed' | 'cancelled') => {
    if (status !== 'cancelled') {
      void decide(appointment, status);
      return;
    }
    setConfirmationError('');
    setConfirmation({ kind: 'appointment', appointment });
  };

  const requestBlockAction = () => {
    setConfirmationError('');
    setConfirmation({ kind: 'block', day: selectedDay, blocked: Boolean(selectedBlock), reason: blockReason.trim() });
  };

  const confirmationBusy = confirmation?.kind === 'appointment'
    ? busyId === confirmation.appointment.id
    : blockBusy;

  const runConfirmation = async () => {
    if (!confirmation || confirmationBusyRef.current) return;
    confirmationBusyRef.current = true;
    setConfirmationError('');
    const success = confirmation.kind === 'appointment'
      ? await decide(confirmation.appointment, 'cancelled')
      : await toggleBlock(confirmation);
    if (success) {
      setConfirmation(null);
    } else {
      setConfirmationError('Não foi possível concluir a ação. Tente novamente.');
    }
    confirmationBusyRef.current = false;
  };

  const goToday = () => {
    const today = todayKey();
    setMonth(startOfMonth(new Date()));
    setSelectedDay(today);
  };

  const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10';
  const confirmationTitle = confirmation?.kind === 'appointment'
    ? 'Cancelar consulta?'
    : confirmation?.blocked ? 'Liberar este dia?' : 'Bloquear este dia?';
  const confirmationDescription = confirmation?.kind === 'appointment'
    ? `A consulta de ${confirmation.appointment.patient?.name || 'paciente'} em ${formatDayLong(confirmation.appointment.day)}, às ${formatSlot(confirmation.appointment.slot)}, será cancelada.`
    : confirmation
      ? confirmation.blocked
        ? `${formatDayLong(confirmation.day)} voltará a aceitar novas solicitações. As consultas já existentes serão mantidas.`
        : `${formatDayLong(confirmation.day)} sairá das opções de marcação do paciente. As consultas já existentes serão mantidas.`
      : '';

  const renderDay = (cell: CalendarCell, mobile = false) => {
    const list = appointmentsByDay.get(cell.key) || [];
    const blocked = blockedByDay.has(cell.key);
    const isToday = cell.key === (data?.today || todayKey());
    const isSelected = cell.key === selectedDay;
    const isPast = cell.key < (data?.today || todayKey());
    const accessibleSummary = `${formatDayLong(cell.key)}${cell.inMonth ? '' : ', fora do mês'}. ${blocked ? 'Dia bloqueado. ' : ''}${list.length} consulta${list.length === 1 ? '' : 's'}.`;

    return (
      <button
        key={cell.key}
        type="button"
        onClick={() => setSelectedDay(cell.key)}
        aria-pressed={isSelected}
        aria-label={accessibleSummary}
        className={mobile
          ? `flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
            isSelected ? 'border-accent bg-accent/10' : blocked ? 'border-danger/20 bg-danger/5' : isPast ? 'border-transparent bg-paper/40' : 'border-line bg-white hover:bg-paper/60'
          }`
          : `relative flex min-h-[72px] flex-col items-center justify-start gap-1 rounded-xl border px-1 py-1.5 transition ${
            isSelected
              ? 'border-accent bg-accent/10'
              : blocked
                ? 'border-danger/20 bg-danger/5 hover:border-danger/40'
                : isPast
                  ? 'border-transparent bg-paper/40 text-ink/50'
                  : 'border-transparent hover:border-line hover:bg-paper/60'
          } ${cell.inMonth ? 'text-ink' : 'text-ink/40'}`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-accent text-paper' : ''}`}>
          {cell.dayNumber}
        </span>
        {mobile ? (
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink/70">
              {blocked ? 'Dia bloqueado' : list.length ? `${list.length} consulta${list.length === 1 ? '' : 's'}` : 'Sem consultas'}
            </span>
            {list.length > 0 && (
              <span className="mt-0.5 block text-xs leading-relaxed text-ink/50">
                {list.map((appointment) => `${formatSlot(appointment.slot)} ${STATUS_LABELS[appointment.status] || appointment.status}`).join(' · ')}
              </span>
            )}
          </span>
        ) : (
          <>
            {blocked && <Lock size={12} className="text-danger" aria-hidden="true" />}
            <span className="flex flex-wrap items-center justify-center gap-1" aria-hidden="true">
              {list.slice(0, 4).map((appointment) => (
                <span key={appointment.id} className={`h-1.5 w-1.5 rounded-full ${statusDot[appointment.status] || 'bg-ink/25'}`} />
              ))}
              {list.length > 4 && <span className="text-xs font-bold text-ink/50">+{list.length - 4}</span>}
            </span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-line bg-white p-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-outfit text-xs font-semibold text-accent">Agenda</p>
          <h2 className="font-display text-xl font-semibold text-ink">Consultas e disponibilidade</h2>
          <p className="mt-1 text-xs text-ink/55">
            {pending.length
              ? `${pending.length} solicitaç${pending.length === 1 ? 'ão' : 'ões'} aguardando seu aceite`
              : 'Nenhuma solicitação pendente agora'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goToday}>Hoje</Button>
          <div className="flex items-center gap-1 rounded-full border border-line bg-paper p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-11 px-0"
              onClick={() => setMonth((current) => addMonths(current, -1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </Button>
            <span className="min-w-[140px] px-1 text-center text-sm font-bold capitalize text-ink/70">{monthLabel(month)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-11 px-0"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              aria-label="Próximo mês"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReloadToken((value) => value + 1)}
            loading={refreshing}
          >
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <StateView
          status="error"
          title="Não foi possível carregar a agenda"
          description={error}
          action={(
            <Button variant="secondary" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
              <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
            </Button>
          )}
        />
      )}

      {pending.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <Clock size={16} aria-hidden="true" /> Solicitações aguardando confirmação
          </p>
          <div className="mt-3 space-y-2">
            {pending.map((appointment) => (
              <div key={appointment.id} className="rounded-2xl border border-amber-200/70 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{appointment.patient?.name || 'Paciente'}</p>
                    <p className="text-xs capitalize text-ink/55">
                      {formatDayLong(appointment.day)} · {formatSlot(appointment.slot)} · {appointment.mode === 'presencial' ? 'Presencial' : 'Online'}
                    </p>
                    {appointment.notes && <p className="mt-1 text-xs leading-relaxed text-ink/55">“{appointment.notes}”</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => requestDecision(appointment, 'confirmed')}
                      disabled={Boolean(busyId)}
                      loading={busyId === appointment.id}
                    >
                      <Check size={14} aria-hidden="true" /> Aceitar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => requestDecision(appointment, 'declined')}
                      disabled={Boolean(busyId)}
                    >
                      <X size={14} aria-hidden="true" /> Recusar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-label="Calendário mensal" className="rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-5">
          <div className="md:hidden">
            {loading ? (
              <div role="status" aria-label="Carregando dias do mês" className="space-y-2">
                <span className="sr-only">Carregando dias do mês.</span>
                {Array.from({ length: 10 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {monthDays.map((cell) => renderDay(cell, true))}
              </div>
            )}
          </div>

          <div className="hidden md:block">
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="pb-1 text-xs font-bold uppercase tracking-wide text-ink/45">{label}</span>
              ))}
              {loading ? (
                Array.from({ length: 42 }).map((_, index) => (
                  <Skeleton key={index} className="min-h-[72px] rounded-xl" />
                ))
              ) : cells.map((cell) => renderDay(cell))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-xs font-semibold text-ink/50">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Pendente</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmada</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" /> Realizada</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={12} className="text-danger" aria-hidden="true" /> Dia bloqueado</span>
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-outfit text-xs font-semibold text-accent">Dia selecionado</p>
              <h3 className="font-display text-lg font-semibold capitalize text-ink">{formatDayLong(selectedDay)}</h3>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-28 rounded-full" />
            ) : (
              <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-ink/55">
                {selectedAppointments.length} consulta{selectedAppointments.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {loading && Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <Skeleton className="mt-3 h-3 w-1/2" />
                <Skeleton className="mt-3 h-11 w-full rounded-xl" />
              </div>
            ))}
            {!loading && !selectedAppointments.length && (
              <StateView
                status="empty"
                compact
                title="Nenhuma consulta neste dia"
                description="Selecione outro dia ou bloqueie a data se não haverá atendimento."
              />
            )}

            {selectedAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded-2xl border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{appointment.patient?.name || 'Paciente'}</p>
                    <p className="truncate text-xs text-ink/50">{appointment.patient?.email || 'Sem e-mail'}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${STATUS_TONES[appointment.status] || STATUS_TONES.pending}`}>
                    {STATUS_LABELS[appointment.status] || appointment.status}
                  </span>
                </div>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                  <Clock size={14} aria-hidden="true" /> {formatSlot(appointment.slot)} · {appointment.mode === 'presencial' ? 'Presencial' : 'Online'}
                </p>
                {appointment.notes && (
                  <div className="mt-3 rounded-xl bg-paper/70 p-3">
                    <p className="text-xs font-bold text-ink/50">Nota da pessoa</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink/65">“{appointment.notes}”</p>
                  </div>
                )}
                {appointment.nutritionistNote && (
                  <div className="mt-2 rounded-xl bg-accent/5 p-3">
                    <p className="text-xs font-bold text-accent">Sua nota</p>
                    <p className="mt-1 text-sm leading-relaxed text-accent">{appointment.nutritionistNote}</p>
                  </div>
                )}

                {appointment.status === 'pending' && (
                  <FormField
                    className="mt-3"
                    label="Nota para a pessoa"
                    htmlFor={`appointment-note-${appointment.id}`}
                    optional
                    hint="Até 800 caracteres. A nota acompanha a resposta da consulta."
                  >
                    <input
                      value={notes[appointment.id] || ''}
                      onChange={(event) => setNotes((current) => ({ ...current, [appointment.id]: event.target.value.slice(0, 800) }))}
                      maxLength={800}
                      disabled={Boolean(busyId)}
                      className={inputClass}
                      placeholder="Escreva uma orientação ou combinação"
                    />
                  </FormField>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {appointment.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => requestDecision(appointment, 'confirmed')}
                        disabled={Boolean(busyId)}
                        loading={busyId === appointment.id}
                      >
                        <Check size={14} aria-hidden="true" /> Aceitar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => requestDecision(appointment, 'declined')}
                        disabled={Boolean(busyId)}
                      >
                        <X size={14} aria-hidden="true" /> Recusar
                      </Button>
                    </>
                  )}
                  {appointment.status === 'confirmed' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => requestDecision(appointment, 'completed')}
                        disabled={Boolean(busyId)}
                        loading={busyId === appointment.id}
                      >
                        <Check size={14} aria-hidden="true" /> Realizada
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => requestDecision(appointment, 'cancelled')}
                        disabled={Boolean(busyId)}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Cancelar
                      </Button>
                    </>
                  )}
                  {onOpenInsights && (
                    <Button variant="secondary" size="sm" onClick={() => onOpenInsights(appointment.patient?.id || appointment.userId)}>
                      <Sparkles size={14} aria-hidden="true" /> Insights
                    </Button>
                  )}
                  {onOpenChat && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenChat({
                        id: appointment.patient?.id || appointment.userId,
                        name: appointment.patient?.name || '',
                        email: appointment.patient?.email || '',
                      })}
                    >
                      <MessageCircle size={14} aria-hidden="true" /> Mensagem
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-paper/50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-ink/65">
              <Lock size={15} aria-hidden="true" /> {selectedBlock ? 'Dia bloqueado' : 'Bloquear este dia'}
            </p>
            {selectedBlock ? (
              <div className="mt-3">
                {selectedBlock.reason && <p className="text-sm text-ink/55">Motivo: {selectedBlock.reason}</p>}
                <Button
                  className="mt-3"
                  variant="secondary"
                  size="sm"
                  onClick={requestBlockAction}
                  disabled={blockBusy}
                  loading={blockBusy}
                >
                  <Check size={14} aria-hidden="true" /> Liberar dia
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <FormField
                  className="min-w-0 flex-1"
                  label="Motivo do bloqueio"
                  htmlFor={`block-reason-${selectedDay}`}
                  optional
                >
                  <input
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value.slice(0, 300))}
                    maxLength={300}
                    className={inputClass}
                    placeholder="Ex.: feriado ou congresso"
                  />
                </FormField>
                <Button onClick={requestBlockAction} disabled={blockBusy} loading={blockBusy}>
                  <Lock size={14} aria-hidden="true" /> Bloquear
                </Button>
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-ink/50">
              Dias bloqueados somem das opções de marcação do paciente. Consultas já existentes continuam visíveis.
            </p>
          </div>
        </section>
      </div>

      <Overlay
        open={Boolean(confirmation)}
        onClose={() => {
          if (!confirmationBusy) {
            setConfirmation(null);
            setConfirmationError('');
          }
        }}
        title={confirmationTitle}
        description={confirmationDescription}
        size="sm"
        busy={confirmationBusy}
        initialFocusRef={cancelConfirmationRef}
        footer={(
          <div className="grid grid-cols-2 gap-3">
            <Button
              ref={cancelConfirmationRef}
              variant="secondary"
              disabled={confirmationBusy}
              onClick={() => {
                setConfirmation(null);
                setConfirmationError('');
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" loading={confirmationBusy} onClick={() => void runConfirmation()}>
              {confirmation?.kind === 'appointment' ? 'Cancelar consulta' : confirmation?.blocked ? 'Liberar dia' : 'Bloquear dia'}
            </Button>
          </div>
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          {confirmation?.kind === 'appointment' ? <Trash2 size={21} aria-hidden="true" /> : <Lock size={21} aria-hidden="true" />}
        </div>
        {confirmation?.kind === 'block' && confirmation.reason && (
          <p className="mt-4 text-sm leading-relaxed text-ink/60">Motivo informado: {confirmation.reason}</p>
        )}
        {confirmationError && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-danger/5 p-3 text-sm leading-relaxed text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {confirmationError}
          </p>
        )}
      </Overlay>
    </div>
  );
}
