export const APPOINTMENT_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Confirmada',
  declined: 'Não confirmada',
  cancelled: 'Cancelada',
  completed: 'Realizada',
};

export const STATUS_TONES: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  declined: 'border-red-200 bg-red-50 text-red-600',
  cancelled: 'border-line bg-paper text-ink/50',
  completed: 'border-sky-200 bg-sky-50 text-sky-700',
};

const pad = (value: number) => String(value).padStart(2, '0');

export const toDayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayKey = () => toDayKey(new Date());

export function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export type CalendarCell = {
  key: string;
  dayNumber: number;
  inMonth: boolean;
  weekday: number;
};

export function buildMonthGrid(month: Date): CalendarCell[] {
  const first = startOfMonth(month);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());

  const cells: CalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    cells.push({
      key: toDayKey(date),
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === first.getMonth(),
      weekday: date.getDay(),
    });
  }
  return cells;
}

export function formatDayLong(dayKey: string) {
  if (!dayKey) return '';
  const date = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dayKey;
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

export function formatSlot(slot: string) {
  return slot?.slice(0, 5) || '';
}

export function isPastDay(dayKey: string, today = todayKey()) {
  return dayKey < today;
}

/** Hora atual no fuso do consultório (America/Sao_Paulo), no formato HH:MM. */
export function clinicTimeNow() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

export type Availability = {
  today: string;
  horizon?: string;
  slots: string[];
  busySlots: Record<string, string[]>;
  blockedDays: string[];
};

export function dayAvailability(dayKey: string, availability: Availability | null) {
  if (!availability) return { available: false, freeSlots: [] as string[], reason: 'Carregando agenda...' };
  const slots = availability.slots?.length ? availability.slots : APPOINTMENT_SLOTS;
  const busy = new Set(availability.busySlots?.[dayKey] || []);
  const isToday = dayKey === availability.today;
  const now = isToday ? clinicTimeNow() : '';
  const freeSlots = slots.filter((slot) => !busy.has(slot) && (!isToday || slot > now));
  const weekday = new Date(`${dayKey}T12:00:00`).getDay();

  if (dayKey < availability.today) return { available: false, freeSlots: [], reason: 'Data passada' };
  if (availability.horizon && dayKey > availability.horizon) {
    return { available: false, freeSlots: [], reason: 'Agenda ainda não aberta para este dia' };
  }
  if (availability.blockedDays?.includes(dayKey)) {
    return { available: false, freeSlots: [], reason: 'Sem atendimento neste dia' };
  }
  if (weekday === 0) return { available: false, freeSlots: [], reason: 'Sem atendimento aos domingos' };
  if (!freeSlots.length) {
    return {
      available: false,
      freeSlots: [],
      reason: isToday ? 'Horários deste dia já passaram' : 'Agenda cheia neste dia',
    };
  }
  return { available: true, freeSlots, reason: '' };
}

export function formatDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
