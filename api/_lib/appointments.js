import { HttpError } from './http.js';

export const CLINIC_TIME_ZONE = 'America/Sao_Paulo';

// Turnos de atendimento (Monday = 1 ... Saturday = 6).
export const WORKING_WEEKDAYS = [1, 2, 3, 4, 5, 6];
export const APPOINTMENT_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'declined', 'cancelled', 'completed'];

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function todayInClinicTimeZone() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function normalizeDay(value) {
  const day = typeof value === 'string' ? value.trim() : '';
  if (!DAY_PATTERN.test(day)) throw new HttpError(400, 'Escolha uma data válida para a consulta.');
  const parsed = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, 'Escolha uma data válida para a consulta.');
  return day;
}

export function normalizeSlot(value) {
  const raw = typeof value === 'string' ? value.trim().slice(0, 5) : '';
  const slot = APPOINTMENT_SLOTS.includes(raw) ? raw : '';
  if (!slot) throw new HttpError(400, 'Escolha um horário disponível na agenda.');
  return slot;
}

export function dayOfWeek(day) {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function clinicTimeNow() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

export function assertBookableDay(day, slot) {
  const today = todayInClinicTimeZone();
  if (day < today) throw new HttpError(400, 'Escolha uma data a partir de hoje.');
  if (!WORKING_WEEKDAYS.includes(dayOfWeek(day))) {
    throw new HttpError(400, 'Os atendimentos acontecem de segunda a sábado.');
  }
  if (day > addDays(today, 120)) {
    throw new HttpError(400, 'A agenda está aberta para os próximos quatro meses.');
  }
  // No mesmo dia, horários que já passaram não podem ser reservados.
  if (day === today && slot && slot <= clinicTimeNow()) {
    throw new HttpError(400, 'Esse horário já passou. Escolha outro horário ou outro dia.');
  }
}

export function addDays(day, amount) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Converte dia + horário do consultório em um timestamptz (UTC−3, sem DST). */
export function toScheduledAt(day, slot) {
  return new Date(`${day}T${slot}:00-03:00`).toISOString();
}

export function mapAppointment(row) {
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    day: typeof row.day === 'string' ? row.day : String(row.day || '').slice(0, 10),
    slot: typeof row.slot === 'string' ? row.slot.slice(0, 5) : String(row.slot || '').slice(0, 5),
    mode: row.mode === 'presencial' ? 'presencial' : 'online',
    status: APPOINTMENT_STATUSES.includes(row.status) ? row.status : 'pending',
    notes: String(row.notes || ''),
    nutritionistNote: String(row.nutritionist_note || ''),
    createdAt: row.created_at || null,
    decidedAt: row.decided_at || null,
  };
}

export function mapMessage(row) {
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    sender: row.sender === 'nutritionist' ? 'nutritionist' : 'user',
    body: String(row.body || ''),
    createdAt: row.created_at || null,
    readAt: row.read_at || null,
  };
}
