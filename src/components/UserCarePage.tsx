import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import type { Page } from '../types';
import {
  PortalApiError,
  bookAppointment,
  cancelAppointment,
  loadAppointments,
  loadConversation,
  markConversationRead,
  sendConversationMessage,
  type AppointmentAvailability,
  type ChatMessage,
  type PatientAppointment,
} from '../lib/portal';
import {
  STATUS_LABELS,
  STATUS_TONES,
  WEEKDAY_LABELS,
  addMonths,
  buildMonthGrid,
  dayAvailability,
  formatDateTime,
  formatDayLong,
  formatSlot,
  monthLabel,
  startOfMonth,
  todayKey,
} from '../lib/schedule';

type CareTab = 'chat' | 'appointments';

const isActiveAppointment = (appointment: PatientAppointment, today: string) => (
  ['pending', 'confirmed'].includes(appointment.status) && appointment.day >= today
);

export function UserCarePage({
  onNavigate,
  toast,
  onUnreadChange,
  initialTab = 'chat',
}: {
  onNavigate: (page: Page) => void;
  toast: (message: string, kind?: 'success' | 'error' | 'info') => void;
  onUnreadChange?: (count: number) => void;
  initialTab?: CareTab;
}) {
  const [tab, setTab] = useState<CareTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [availability, setAvailability] = useState<AppointmentAvailability | null>(null);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [selectedSlot, setSelectedSlot] = useState('');
  const [mode, setMode] = useState<'online' | 'presencial'>('online');
  const [bookingNotes, setBookingNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const today = availability?.today || todayKey();
  const activeAppointment = appointments.find((appointment) => isActiveAppointment(appointment, today)) || null;
  const selectedAvailability = dayAvailability(selectedDay, availability);

  const loadChat = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setMessagesLoading(true);
    setMessagesError('');
    try {
      const data = await loadConversation();
      setMessages(data.messages || []);
      onUnreadChange?.(data.unreadCount || 0);
      if (data.unreadCount > 0) {
        await markConversationRead().catch(() => undefined);
        const now = new Date().toISOString();
        setMessages((current) => current.map((message) => (
          message.sender === 'nutritionist' && !message.readAt ? { ...message, readAt: now } : message
        )));
        onUnreadChange?.(0);
      }
    } catch (error) {
      if (!options.silent) {
        setMessagesError(error instanceof Error ? error.message : 'Não foi possível carregar a conversa.');
      }
    } finally {
      if (!options.silent) setMessagesLoading(false);
    }
  };

  const loadAgenda = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setAppointmentsLoading(true);
    setAppointmentsError('');
    try {
      const data = await loadAppointments();
      setAppointments(data.appointments || []);
      setAvailability(data.availability || null);
    } catch (error) {
      if (!options.silent) {
        setAppointmentsError(error instanceof Error ? error.message : 'Não foi possível carregar a agenda.');
      }
    } finally {
      if (!options.silent) setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    void loadChat();
    void loadAgenda();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadChat({ silent: true });
    }, 9000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setSelectedSlot('');
  }, [selectedDay]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const result = await sendConversationMessage(body);
      setMessages((current) => [...current, result.message]);
      setText('');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível enviar sua mensagem.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleBook = async () => {
    if (booking) return;
    if (!selectedSlot) {
      toast('Escolha um horário disponível para continuar.', 'error');
      return;
    }
    if (!selectedAvailability.available) {
      toast(selectedAvailability.reason || 'Escolha outro dia para a consulta.', 'error');
      return;
    }
    setBooking(true);
    try {
      await bookAppointment({ day: selectedDay, slot: selectedSlot, mode, notes: bookingNotes.trim() });
      toast('Solicitação enviada! Sua nutricionista vai confirmar em breve.', 'success');
      setSelectedSlot('');
      setBookingNotes('');
      await loadAgenda({ silent: true });
    } catch (error) {
      const message = error instanceof PortalApiError ? error.message : 'Não foi possível solicitar a consulta.';
      toast(message, 'error');
      await loadAgenda({ silent: true });
    } finally {
      setBooking(false);
    }
  };

  const handleCancel = async (appointment: PatientAppointment) => {
    if (cancellingId) return;
    setCancellingId(appointment.id);
    try {
      await cancelAppointment(appointment.id);
      toast('Consulta cancelada. Você pode escolher outro horário quando quiser.', 'success');
      await loadAgenda({ silent: true });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível cancelar a consulta.', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const unreadFromNutritionist = messages.filter((message) => message.sender === 'nutritionist' && !message.readAt).length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-28 pt-24 sm:px-8 md:px-12 md:pt-28">
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          aria-label="Voltar ao início"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line transition-colors hover:bg-line"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="display-title text-4xl sm:text-5xl">Seu cuidado.</h1>
          <p className="serif-body mt-0.5 text-lg text-ink/60">Conversa e consultas com sua nutricionista.</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('chat')}
          aria-pressed={tab === 'chat'}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition ${
            tab === 'chat' ? 'bg-accent text-paper shadow-sm' : 'border border-line bg-white text-ink/60 hover:bg-paper'
          }`}
        >
          <MessageCircle size={15} /> Conversa
          {unreadFromNutritionist > 0 && (
            <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-accent">
              {unreadFromNutritionist}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('appointments')}
          aria-pressed={tab === 'appointments'}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition ${
            tab === 'appointments' ? 'bg-accent text-paper shadow-sm' : 'border border-line bg-white text-ink/60 hover:bg-paper'
          }`}
        >
          <CalendarDays size={15} /> Consultas
          {activeAppointment && <span className="h-1.5 w-1.5 rounded-full bg-accent-pink" />}
        </button>
      </div>

      {tab === 'chat' && (
        <section className="flex min-h-[62vh] flex-col overflow-hidden rounded-[2rem] border border-line bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-paper/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Sparkles size={18} />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">Sua nutricionista</p>
                <p className="text-[11px] text-ink/45">Mensagens privadas, respondidas com calma</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadChat()}
              aria-label="Atualizar conversa"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink/50 transition hover:bg-white"
            >
              <RefreshCw size={13} className={messagesLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div ref={scrollRef} className="chat-scroll flex-1 space-y-3 overflow-y-auto bg-paper/25 px-4 py-5 sm:px-6" style={{ maxHeight: '54vh', minHeight: 320 }}>
            {messagesLoading && !messages.length && (
              <p className="flex items-center gap-2 text-xs font-semibold text-ink/45">
                <Loader2 size={14} className="animate-spin text-accent" /> Abrindo a conversa...
              </p>
            )}

            {!messagesLoading && messagesError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                <p className="flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {messagesError}</p>
                <button type="button" onClick={() => void loadChat()} className="mt-2 rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white">
                  Tentar novamente
                </button>
              </div>
            )}

            {!messagesLoading && !messagesError && !messages.length && (
              <div className="mx-auto max-w-md rounded-3xl border border-dashed border-line bg-white/80 p-6 text-center">
                <MessageCircle size={26} className="mx-auto text-accent/50" />
                <p className="mt-2 text-sm font-bold text-ink">A conversa começa por aqui</p>
                <p className="mt-1 text-xs leading-relaxed text-ink/50">
                  Escreva o que quiser compartilhar sobre sua rotina, suas dúvidas ou como está se sentindo. Não existe pergunta boba.
                </p>
              </div>
            )}

            {messages.map((message) => {
              const mine = message.sender === 'user';
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    mine ? 'rounded-br-lg bg-accent text-paper' : 'rounded-bl-lg border border-line bg-white text-ink/85'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    <p className={`mt-1 text-[10px] font-semibold ${mine ? 'text-paper/70' : 'text-ink/35'}`}>
                      {formatDateTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-line bg-white p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 2000))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder="Escreva sua mensagem com liberdade..."
                className="min-h-[48px] flex-1 resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !text.trim()}
                aria-label="Enviar mensagem"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-paper shadow-md transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
            <p className="mt-1 text-right text-[10px] font-semibold text-ink/30">{text.length}/2000</p>
          </div>
        </section>
      )}

      {tab === 'appointments' && (
        <div className="space-y-4">
          {activeAppointment && (
            <section className="rounded-[2rem] border border-accent/30 bg-accent/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-sm text-accent">Sua próxima consulta</p>
                  <p className="mt-1 font-display text-xl font-semibold capitalize text-ink">{formatDayLong(activeAppointment.day)}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink/60">
                    <Clock size={13} /> {formatSlot(activeAppointment.slot)} · {activeAppointment.mode === 'presencial' ? 'Presencial' : 'Online'}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${STATUS_TONES[activeAppointment.status]}`}>
                  {STATUS_LABELS[activeAppointment.status]}
                </span>
              </div>
              {activeAppointment.notes && (
                <p className="mt-3 rounded-2xl bg-white/70 p-3 text-xs leading-relaxed text-ink/60">
                  <strong className="text-ink/70">Seu recado:</strong> {activeAppointment.notes}
                </p>
              )}
              {activeAppointment.nutritionistNote && (
                <p className="mt-2 rounded-2xl bg-white/70 p-3 text-xs leading-relaxed text-ink/60">
                  <strong className="text-ink/70">Recado da nutricionista:</strong> {activeAppointment.nutritionistNote}
                </p>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-ink/50">
                {activeAppointment.status === 'pending'
                  ? 'Sua solicitação está com a nutricionista. Assim que ela confirmar, o horário fica reservado para você.'
                  : 'Horário confirmado. Se precisar remarcar, cancele e escolha outro momento — sem problema.'}
              </p>
              <button
                type="button"
                onClick={() => void handleCancel(activeAppointment)}
                disabled={cancellingId === activeAppointment.id}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-[11px] font-bold text-ink/60 transition hover:bg-paper disabled:opacity-50"
              >
                {cancellingId === activeAppointment.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                Cancelar consulta
              </button>
            </section>
          )}

          <section className="rounded-[2rem] border border-line bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-sm text-accent">Agenda aberta</p>
                <h2 className="font-display text-xl font-semibold text-ink">Escolha um dia e horário</h2>
                <p className="mt-0.5 text-[11px] text-ink/45">Atendimentos de segunda a sábado. Dias ocupados e bloqueados ficam indisponíveis.</p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-line bg-paper px-1 py-1">
                <button
                  type="button"
                  onClick={() => setMonth((current) => addMonths(current, -1))}
                  aria-label="Mês anterior"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink/60 transition hover:bg-white"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="min-w-[128px] text-center text-[11px] font-bold capitalize text-ink/70">{monthLabel(month)}</span>
                <button
                  type="button"
                  onClick={() => setMonth((current) => addMonths(current, 1))}
                  aria-label="Próximo mês"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink/60 transition hover:bg-white"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {appointmentsError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                <p className="flex items-center gap-1.5"><AlertTriangle size={14} /> {appointmentsError}</p>
                <button type="button" onClick={() => void loadAgenda()} className="mt-2 rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white">
                  Tentar novamente
                </button>
              </div>
            )}

            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label} className="pb-1 text-[10px] font-bold uppercase tracking-wide text-ink/35">{label}</span>
                  ))}
                  {cells.map((cell) => {
                    const info = dayAvailability(cell.key, availability);
                    const isSelected = cell.key === selectedDay;
                    const isToday = cell.key === today;
                    const own = appointments.find((appointment) => (
                      appointment.day === cell.key && isActiveAppointment(appointment, today)
                    ));
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setSelectedDay(cell.key)}
                        aria-label={`${cell.key}${info.available ? ' disponível' : ` — ${info.reason}`}`}
                        className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-bold transition ${
                          isSelected
                            ? 'border-accent bg-accent/10 text-accent'
                            : info.available
                              ? 'border-transparent bg-paper/60 text-ink/75 hover:border-accent/30 hover:bg-accent/5'
                              : 'border-transparent bg-paper/30 text-ink/25'
                        } ${cell.inMonth ? '' : 'opacity-50'}`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${isToday ? 'bg-accent text-paper' : ''}`}>
                          {cell.dayNumber}
                        </span>
                        {own && <span className="h-1.5 w-1.5 rounded-full bg-accent-pink" />}
                        {!info.available && !own && <span className="h-1 w-1 rounded-full bg-ink/15" />}
                      </button>
                    );
                  })}
                </div>
                {appointmentsLoading && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink/40">
                    <Loader2 size={12} className="animate-spin text-accent" /> Atualizando disponibilidade...
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-ink/40">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Disponível</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent-pink" /> Sua consulta</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink/15" /> Indisponível</span>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-paper/40 p-4">
                <p className="label-sm text-accent">Dia escolhido</p>
                <p className="mt-0.5 text-sm font-bold capitalize text-ink">{formatDayLong(selectedDay)}</p>

                {!selectedAvailability.available ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-line bg-white/70 p-4 text-center">
                    <Info size={18} className="mx-auto text-ink/30" />
                    <p className="mt-1.5 text-xs font-semibold text-ink/55">{selectedAvailability.reason || 'Sem horários disponíveis.'}</p>
                    <p className="mt-1 text-[10px] text-ink/40">Escolha outro dia no calendário.</p>
                  </div>
                ) : (
                  <>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-ink/40">Horários livres</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {selectedAvailability.freeSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          aria-pressed={selectedSlot === slot}
                          className={`rounded-xl border px-1 py-2 text-[11px] font-bold transition ${
                            selectedSlot === slot
                              ? 'border-accent bg-accent text-paper shadow-sm'
                              : 'border-line bg-white text-ink/65 hover:border-accent/40'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'online' as const, label: 'Online', icon: Video },
                        { id: 'presencial' as const, label: 'Presencial', icon: MapPin },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setMode(option.id)}
                          aria-pressed={mode === option.id}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                            mode === option.id ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-white text-ink/55'
                          }`}
                        >
                          <option.icon size={12} /> {option.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={bookingNotes}
                      onChange={(event) => setBookingNotes(event.target.value.slice(0, 800))}
                      rows={2}
                      maxLength={800}
                      placeholder="Quer contar algo antes? (opcional)"
                      className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-[11px] text-ink outline-none focus:border-accent"
                    />

                    <button
                      type="button"
                      onClick={() => void handleBook()}
                      disabled={booking || !selectedSlot || Boolean(activeAppointment)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-xs font-bold text-paper shadow-md transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {booking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      {activeAppointment ? 'Você já tem uma consulta ativa' : 'Solicitar consulta'}
                    </button>
                    <p className="mt-2 text-[10px] leading-relaxed text-ink/40">
                      A solicitação fica aguardando o aceite da nutricionista. Você acompanha o status aqui e na conversa.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {appointments.filter((appointment) => !isActiveAppointment(appointment, today)).length > 0 && (
            <section className="rounded-[2rem] border border-line bg-white p-4 shadow-sm sm:p-6">
              <p className="label-sm text-accent">Histórico</p>
              <h2 className="font-display text-lg font-semibold text-ink">Consultas anteriores</h2>
              <div className="mt-3 space-y-2">
                {appointments
                  .filter((appointment) => !isActiveAppointment(appointment, today))
                  .slice(0, 8)
                  .map((appointment) => (
                    <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper/40 p-3">
                      <div>
                        <p className="text-xs font-bold capitalize text-ink">{formatDayLong(appointment.day)}</p>
                        <p className="text-[11px] text-ink/50">{formatSlot(appointment.slot)} · {appointment.mode === 'presencial' ? 'Presencial' : 'Online'}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_TONES[appointment.status] || STATUS_TONES.cancelled}`}>
                        {STATUS_LABELS[appointment.status] || appointment.status}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
