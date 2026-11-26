import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  MapPin,
  MessageCircleHeart,
  RefreshCw,
  Send,
  Video,
  X,
} from 'lucide-react';
import iconApp from '../assets/logo/icon_app.png';
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
import { Button } from './ui/Button';
import { FormField } from './ui/FormField';
import { Overlay } from './ui/Overlay';
import { PageContainer } from './ui/PageContainer';

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
  const tabsId = useId();
  const chatTabRef = useRef<HTMLButtonElement | null>(null);
  const appointmentsTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [newMessageAnnouncements, setNewMessageAnnouncements] = useState<ChatMessage[]>([]);
  const sendingRef = useRef(false);
  const knownMessageIdsRef = useRef<Set<string> | null>(null);
  const chatHydratedRef = useRef(false);
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
  const [bookingError, setBookingError] = useState('');
  const bookingRef = useRef(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<PatientAppointment | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const cancellingRef = useRef(false);
  const keepAppointmentRef = useRef<HTMLButtonElement | null>(null);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const today = availability?.today || todayKey();
  const activeAppointment = appointments.find((appointment) => isActiveAppointment(appointment, today)) || null;
  const selectedAvailability = dayAvailability(selectedDay, availability);

  const trackNewMessages = (incoming: ChatMessage[]) => {
    const known = knownMessageIdsRef.current || new Set<string>();
    const fresh = chatHydratedRef.current ? incoming.filter((message) => !known.has(message.id)) : [];
    incoming.forEach((message) => known.add(message.id));
    knownMessageIdsRef.current = known;
    if (fresh.length) {
      setNewMessageAnnouncements((current) => [...current, ...fresh].slice(-20));
    }
  };

  const loadChat = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setMessagesLoading(true);
    try {
      const data = await loadConversation();
      const incoming = data.messages || [];
      trackNewMessages(incoming);
      chatHydratedRef.current = true;
      setMessages(incoming);
      setMessagesError('');
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
      setMessagesError(error instanceof Error ? error.message : 'Não foi possível carregar a conversa.');
    } finally {
      if (!options.silent) setMessagesLoading(false);
    }
  };

  const loadAgenda = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setAppointmentsLoading(true);
    try {
      const data = await loadAppointments();
      setAppointments(data.appointments || []);
      setAvailability(data.availability || null);
      setAppointmentsError('');
    } catch (error) {
      setAppointmentsError(error instanceof Error ? error.message : 'Não foi possível carregar a agenda.');
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
    if (tab !== 'chat') return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, tab]);

  useEffect(() => {
    if (selectedSlot && !dayAvailability(selectedDay, availability).freeSlots.includes(selectedSlot)) {
      setSelectedSlot('');
      setBookingError('Esse horário não está mais disponível. Escolha outro.');
    }
  }, [availability, selectedDay, selectedSlot]);

  useEffect(() => {
    setSelectedSlot('');
    setBookingError('');
  }, [selectedDay]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    let next: CareTab | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = tab === 'chat' ? 'appointments' : 'chat';
    if (event.key === 'Home') next = 'chat';
    if (event.key === 'End') next = 'appointments';
    if (!next) return;
    event.preventDefault();
    setTab(next);
    (next === 'chat' ? chatTabRef : appointmentsTabRef).current?.focus();
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    try {
      const result = await sendConversationMessage(body);
      setMessages((current) => (
        current.some((message) => message.id === result.message.id) ? current : [...current, result.message]
      ));
      setText('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Não foi possível enviar sua mensagem.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleBook = async () => {
    if (bookingRef.current) return;
    if (!selectedSlot) {
      setBookingError('Escolha um horário disponível para continuar.');
      return;
    }
    if (!selectedAvailability.available || !selectedAvailability.freeSlots.includes(selectedSlot)) {
      setBookingError(selectedAvailability.reason || 'Escolha outro dia para a consulta.');
      return;
    }
    bookingRef.current = true;
    setBooking(true);
    setBookingError('');
    try {
      await bookAppointment({ day: selectedDay, slot: selectedSlot, mode, notes: bookingNotes.trim() });
      toast('Solicitação enviada! Sua nutricionista vai confirmar em breve.', 'success');
      setSelectedSlot('');
      setBookingNotes('');
      await loadAgenda({ silent: true });
    } catch (error) {
      const message = error instanceof PortalApiError ? error.message : 'Não foi possível solicitar a consulta.';
      setBookingError(message);
      await loadAgenda({ silent: true });
    } finally {
      bookingRef.current = false;
      setBooking(false);
    }
  };

  const handleCancel = async (appointment: PatientAppointment) => {
    if (cancellingRef.current) return false;
    cancellingRef.current = true;
    setCancellingId(appointment.id);
    setCancelError('');
    try {
      const result = await cancelAppointment(appointment.id);
      setAppointments((current) => current.map((item) => (
        item.id === appointment.id ? result.appointment : item
      )));
      toast('Consulta cancelada. Você pode escolher outro horário quando quiser.', 'success');
      await loadAgenda({ silent: true });
      return true;
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Não foi possível cancelar a consulta.');
      return false;
    } finally {
      cancellingRef.current = false;
      setCancellingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    const cancelled = await handleCancel(appointmentToCancel);
    if (cancelled) {
      setAppointmentToCancel(null);
      setCancelError('');
    }
  };

  const unreadFromNutritionist = messages.filter((message) => message.sender === 'nutritionist' && !message.readAt).length;

  return (
    <PageContainer hasTopbar={false} className="mx-auto flex h-[100dvh] min-h-0! w-full max-w-5xl! flex-col gap-4 overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]! pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]! md:pb-8! md:pt-6!">
      <header className="flex shrink-0 items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => onNavigate('dashboard')}
          aria-label="Voltar ao início"
          className="h-14 w-14 shrink-0 p-0"
        >
          <ArrowLeft size={48} className="h-12 w-12 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <h1 className="section-title">Seu cuidado.</h1>
          <p className="section-subtitle mt-0.5 text-ink/60">Conversa e consultas com sua nutricionista.</p>
        </div>
      </header>

      <div role="tablist" aria-label="Conversa e consultas" className="flex shrink-0 flex-wrap gap-2">
        <Button
          ref={chatTabRef}
          role="tab"
          id={`${tabsId}-chat-tab`}
          aria-selected={tab === 'chat'}
          aria-controls={`${tabsId}-chat-panel`}
          tabIndex={tab === 'chat' ? 0 : -1}
          variant={tab === 'chat' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTab('chat')}
          onKeyDown={handleTabKeyDown}
          className="px-4"
        >
          <MessageCircleHeart size={15} aria-hidden="true" /> Conversa
          {unreadFromNutritionist > 0 && (
            <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-accent">
              {unreadFromNutritionist}
            </span>
          )}
        </Button>
        <Button
          ref={appointmentsTabRef}
          role="tab"
          id={`${tabsId}-appointments-tab`}
          aria-selected={tab === 'appointments'}
          aria-controls={`${tabsId}-appointments-panel`}
          tabIndex={tab === 'appointments' ? 0 : -1}
          variant={tab === 'appointments' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTab('appointments')}
          onKeyDown={handleTabKeyDown}
          className="px-4"
        >
          <CalendarDays size={15} aria-hidden="true" /> Consultas
          {activeAppointment && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-accent-secondary" aria-hidden="true" />
              <span className="sr-only">Consulta ativa</span>
            </>
          )}
        </Button>
      </div>

      <div role="log" aria-live="polite" aria-relevant="additions" aria-atomic="false" className="sr-only">
        {newMessageAnnouncements.map((message) => (
          <p key={message.id}>
            {message.sender === 'user' ? 'Você: ' : 'Nutricionista: '}{message.body}
          </p>
        ))}
      </div>

      <section
        id={`${tabsId}-chat-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-chat-tab`}
        tabIndex={0}
        hidden={tab !== 'chat'}
        className={tab === 'chat' ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-line bg-white shadow-sm' : 'hidden'}
      >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-paper/50 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={iconApp}
                alt="Logo Mind Nutrition"
                className="h-10 w-10 shrink-0 rounded-full border border-line bg-white object-contain p-1.5"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5">
                  <span className="logo-wordmark text-sm">Mind Nutrition</span>
                  <BadgeCheck size={16} className="shrink-0 fill-accent text-white" aria-label="Perfil verificado" />
                </p>
                <p className="text-[11px] text-ink/45">Sua nutricionista · mensagens privadas</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadChat()}
              loading={messagesLoading}
              aria-label="Atualizar conversa"
              className="h-11 w-11 shrink-0 p-0"
            >
              <RefreshCw size={16} className={messagesLoading ? 'invisible' : ''} aria-hidden="true" />
            </Button>
          </div>

          {!messagesLoading && messagesError && (
            <div role="alert" className="shrink-0 border-b border-danger/20 bg-danger/5 px-4 py-3 text-xs font-semibold text-danger sm:px-5">
              <p className="flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {messagesError}</p>
              <Button variant="secondary" size="sm" onClick={() => void loadChat()} className="mt-2 min-h-11 bg-white text-danger">
                Tentar novamente
              </Button>
            </div>
          )}

          <div
            ref={scrollRef}
            role="region"
            aria-label="Mensagens da conversa"
            tabIndex={0}
            className="chat-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-paper/25 px-4 py-5 sm:px-6"
          >
            {messagesLoading && !messages.length && (
              <p role="status" className="flex items-center gap-2 text-xs font-semibold text-ink/45">
                <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" /> Abrindo a conversa...
              </p>
            )}

            {!messagesLoading && !messagesError && !messages.length && (
              <div className="mx-auto max-w-md rounded-3xl border border-dashed border-line bg-white/80 p-6 text-center">
                <MessageCircleHeart size={26} className="mx-auto text-accent/50" />
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
                    <p className="whitespace-pre-wrap break-words">
                      <span className="sr-only">{mine ? 'Você: ' : 'Nutricionista: '}</span>{message.body}
                    </p>
                    <p className={`mt-1 text-[10px] font-semibold ${mine ? 'text-paper/70' : 'text-ink/35'}`}>
                      <time dateTime={message.createdAt || undefined}>{formatDateTime(message.createdAt)}</time>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <form
            aria-busy={sending}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
            className="shrink-0 border-t border-line bg-white px-3 pt-3 pb-3 sm:px-4 sm:pt-4 sm:pb-4"
          >
            <div className="flex items-start gap-2">
              <FormField
                label="Sua mensagem"
                htmlFor="care-message"
                error={sendError}
                hint={(
                  <span className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <span>Enter envia; Shift + Enter adiciona uma linha.</span>
                    <span>{text.length}/2000</span>
                  </span>
                )}
                className="min-w-0 flex-1"
              >
                <textarea
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value.slice(0, 2000));
                    if (sendError) setSendError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={2}
                  maxLength={2000}
                  disabled={sending}
                  placeholder="Escreva sua mensagem com liberdade..."
                  className="min-h-[48px] w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </FormField>
              <Button
                type="submit"
                loading={sending}
                disabled={!text.trim()}
                aria-label={sending ? 'Enviando mensagem' : 'Enviar mensagem'}
                className="h-12 w-12 shrink-0 p-0"
              >
                <Send size={17} className={sending ? 'invisible' : ''} aria-hidden="true" />
              </Button>
            </div>
            <p role="status" className="sr-only">{sending ? 'Enviando mensagem...' : ''}</p>
            {sendError && (
              <Button variant="secondary" size="sm" onClick={() => void handleSend()} className="mt-2">
                Tentar novamente
              </Button>
            )}
          </form>
        </section>

      <section
        id={`${tabsId}-appointments-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-appointments-tab`}
        tabIndex={0}
        hidden={tab !== 'appointments'}
        className={tab === 'appointments' ? 'min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1' : 'hidden'}
      >
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
              <Button
                variant="secondary"
                size="sm"
                aria-haspopup="dialog"
                onClick={() => {
                  setCancelError('');
                  setAppointmentToCancel(activeAppointment);
                }}
                className="mt-3 bg-white"
              >
                <X size={14} aria-hidden="true" /> Cancelar consulta
              </Button>
            </section>
          )}

          <section className="rounded-[2rem] border border-line bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-sm text-accent">Agenda aberta</p>
                <h2 className="font-display text-xl font-semibold text-ink">Escolha um dia e horário</h2>
                <p className="mt-0.5 text-[11px] text-ink/45">Atendimentos de segunda a sábado. Dias ocupados e bloqueados ficam indisponíveis.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 rounded-full border border-line bg-paper p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMonth((current) => addMonths(current, -1))}
                    aria-label="Mês anterior"
                    className="h-11 w-11 p-0"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </Button>
                  <span className="min-w-[100px] text-center text-[11px] font-bold capitalize text-ink/70 sm:min-w-[132px]">{monthLabel(month)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMonth((current) => addMonths(current, 1))}
                    aria-label="Próximo mês"
                    className="h-11 w-11 p-0"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadAgenda()}
                  loading={appointmentsLoading}
                  aria-label="Atualizar agenda"
                  className="h-11 w-11 shrink-0 border border-line bg-white p-0"
                >
                  <RefreshCw size={16} className={appointmentsLoading ? 'invisible' : ''} aria-hidden="true" />
                </Button>
              </div>
            </div>

            {appointmentsError && (
              <div role="alert" className="mt-4 rounded-2xl border border-danger/30 bg-danger/5 p-3 text-xs font-semibold text-danger">
                <p className="flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {appointmentsError}</p>
                <Button variant="secondary" size="sm" onClick={() => void loadAgenda()} className="mt-2 min-h-11 bg-white text-danger">
                  Tentar novamente
                </Button>
              </div>
            )}

            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="overflow-x-auto pb-1">
                <div className="grid min-w-[332px] grid-cols-7 gap-1 text-center">
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label} className="pb-1 text-xs font-bold uppercase tracking-wide text-ink/35">{label}</span>
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
                        aria-label={`${formatDayLong(cell.key)}${info.available ? ', disponível' : `, ${info.reason}`}`}
                        aria-pressed={isSelected}
                        aria-current={isToday ? 'date' : undefined}
                        disabled={booking}
                        className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
                        {own && <span className="h-1.5 w-1.5 rounded-full bg-accent-secondary" />}
                        {!info.available && !own && <span className="h-1 w-1 rounded-full bg-ink/15" />}
                      </button>
                    );
                  })}
                </div>
              </div>
                {appointmentsLoading && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink/40">
                    <Loader2 size={12} className="animate-spin text-accent" /> Atualizando disponibilidade...
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-ink/40">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Disponível</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent-secondary" /> Sua consulta</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink/15" /> Indisponível</span>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-paper/40 p-4">
                <form
                  aria-busy={booking}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleBook();
                  }}
                >
                  <ol className="space-y-4">
                    <li>
                      <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[11px] text-accent" aria-hidden="true">1</span>
                        Dia
                      </h3>
                      <p className="mt-1.5 text-sm font-semibold capitalize text-ink/70">{formatDayLong(selectedDay)}</p>
                      {!selectedAvailability.available && (
                        <div className="mt-3 rounded-2xl border border-dashed border-line bg-white/70 p-4 text-center">
                          <Info size={18} className="mx-auto text-ink/30" aria-hidden="true" />
                          <p className="mt-1.5 text-xs font-semibold text-ink/55">{selectedAvailability.reason || 'Sem horários disponíveis.'}</p>
                          <p className="mt-1 text-[10px] text-ink/40">Escolha outro dia no calendário.</p>
                        </div>
                      )}
                    </li>

                    {selectedAvailability.available && (
                      <>
                        <li className="border-t border-line pt-4">
                          <fieldset disabled={booking}>
                            <legend className="flex items-center gap-2 text-sm font-bold text-ink">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[11px] text-accent" aria-hidden="true">2</span>
                              Horário
                            </legend>
                            <p className="mt-1 text-[11px] text-ink/45">Escolha um dos horários livres.</p>
                            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                              {selectedAvailability.freeSlots.map((slot) => (
                                <Button
                                  key={slot}
                                  variant={selectedSlot === slot ? 'primary' : 'secondary'}
                                  size="sm"
                                  aria-pressed={selectedSlot === slot}
                                  onClick={() => {
                                    setSelectedSlot(slot);
                                    if (bookingError) setBookingError('');
                                  }}
                                  className="min-h-11 rounded-xl px-1 text-[11px]"
                                >
                                  {formatSlot(slot)}
                                </Button>
                              ))}
                            </div>
                          </fieldset>
                        </li>

                        <li className="border-t border-line pt-4">
                          <fieldset disabled={booking}>
                            <legend className="flex items-center gap-2 text-sm font-bold text-ink">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[11px] text-accent" aria-hidden="true">3</span>
                              Modalidade
                            </legend>
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              {[
                                { id: 'online' as const, label: 'Online', icon: Video },
                                { id: 'presencial' as const, label: 'Presencial', icon: MapPin },
                              ].map((option) => (
                                <Button
                                  key={option.id}
                                  variant={mode === option.id ? 'primary' : 'secondary'}
                                  size="sm"
                                  aria-pressed={mode === option.id}
                                  onClick={() => setMode(option.id)}
                                  className="min-h-11 rounded-xl px-2 text-[11px]"
                                >
                                  <option.icon size={14} aria-hidden="true" /> {option.label}
                                </Button>
                              ))}
                            </div>
                          </fieldset>
                        </li>

                        <li className="border-t border-line pt-4">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[11px] text-accent" aria-hidden="true">4</span>
                            Confirmação
                          </h3>
                          <FormField
                            label="Recado para a nutricionista"
                            htmlFor="care-booking-notes"
                            optional
                            hint={`${bookingNotes.length}/800 caracteres`}
                            className="mt-2"
                          >
                            <textarea
                              value={bookingNotes}
                              onChange={(event) => setBookingNotes(event.target.value.slice(0, 800))}
                              rows={2}
                              maxLength={800}
                              disabled={booking}
                              placeholder="Quer contar algo antes? (opcional)"
                              className="min-h-[72px] w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </FormField>
                          <p id="care-booking-confirmation" className="mt-3 rounded-xl bg-white/80 p-3 text-[11px] leading-relaxed text-ink/60">
                            {selectedSlot
                              ? `${formatDayLong(selectedDay)}, ${formatSlot(selectedSlot)} · ${mode === 'presencial' ? 'Presencial' : 'Online'}.`
                              : 'Selecione um horário para revisar sua consulta.'}
                          </p>
                          {activeAppointment && (
                            <p className="mt-2 text-[11px] font-semibold text-ink/55">Você já tem uma consulta ativa. Cancele-a antes de solicitar outro horário.</p>
                          )}
                          {bookingError && (
                            <p id="care-booking-error" role="alert" className="mt-2 flex items-start gap-1.5 rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs font-semibold text-danger">
                              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {bookingError}
                            </p>
                          )}
                          <Button
                            type="submit"
                            fullWidth
                            loading={booking}
                            disabled={booking || appointmentsLoading || !selectedSlot || Boolean(activeAppointment)}
                            aria-describedby={`care-booking-confirmation${bookingError ? ' care-booking-error' : ''}`}
                            className="mt-3 min-h-12"
                          >
                            {!booking && selectedSlot && !activeAppointment && <CheckCircle2 size={15} aria-hidden="true" />}
                            {activeAppointment ? 'Você já tem uma consulta ativa' : !selectedSlot ? 'Escolha um horário' : bookingError ? 'Tentar novamente' : 'Solicitar consulta'}
                          </Button>
                          <p role="status" className="sr-only">{booking ? 'Enviando solicitação de consulta...' : ''}</p>
                          <p className="mt-2 text-[10px] leading-relaxed text-ink/40">
                            A solicitação fica aguardando o aceite da nutricionista. Você acompanha o status aqui e na conversa.
                          </p>
                        </li>
                      </>
                    )}
                  </ol>
                </form>
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
      </section>

      <Overlay
        open={Boolean(appointmentToCancel)}
        onClose={() => {
          if (cancellingRef.current) return;
          setAppointmentToCancel(null);
          setCancelError('');
        }}
        title="Cancelar consulta?"
        description="Confira os detalhes antes de cancelar. Você poderá escolher outro horário disponível."
        variant="drawer"
        busy={cancellingId !== null}
        initialFocusRef={keepAppointmentRef}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              ref={keepAppointmentRef}
              variant="secondary"
              onClick={() => {
                setAppointmentToCancel(null);
                setCancelError('');
              }}
              disabled={cancellingId !== null}
              className="min-h-11"
            >
              Manter consulta
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleConfirmCancel()}
              loading={cancellingId !== null}
              disabled={cancellingId !== null || !appointmentToCancel}
              className="min-h-11"
            >
              Confirmar cancelamento
            </Button>
          </div>
        )}
      >
        {appointmentToCancel && (
          <div className="rounded-2xl border border-line bg-paper/60 p-4">
            <p className="font-display text-lg font-semibold capitalize text-ink">{formatDayLong(appointmentToCancel.day)}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60">
              <Clock size={15} aria-hidden="true" /> {formatSlot(appointmentToCancel.slot)} · {appointmentToCancel.mode === 'presencial' ? 'Presencial' : 'Online'}
            </p>
          </div>
        )}
        {cancelError && (
          <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-2xl border border-danger/30 bg-danger/5 p-3 text-xs font-semibold text-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {cancelError}
          </p>
        )}
      </Overlay>
    </PageContainer>
  );
}
