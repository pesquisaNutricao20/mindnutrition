import { getCurrentSession } from './supabase';

export class PortalApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PortalApiError';
    this.status = status;
  }
}

async function authFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const session = await getCurrentSession().catch(() => null);
  if (!session?.access_token) {
    throw new PortalApiError(401, 'Entre na sua conta para acessar a conversa e a agenda.');
  }

  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers || {}),
    },
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new PortalApiError(response.status, payload?.message || 'Não foi possível concluir a operação agora.');
  }
  return payload as T;
}

export type ChatMessage = {
  id: string;
  userId: string;
  sender: 'user' | 'nutritionist';
  body: string;
  createdAt: string | null;
  readAt: string | null;
};

export type AppointmentStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export type PatientAppointment = {
  id: string;
  day: string;
  slot: string;
  mode: 'online' | 'presencial';
  status: AppointmentStatus;
  notes: string;
  nutritionistNote: string;
  createdAt: string | null;
  decidedAt: string | null;
};

export type AppointmentAvailability = {
  today: string;
  horizon: string;
  slots: string[];
  busySlots: Record<string, string[]>;
  blockedDays: string[];
};

export async function loadConversation() {
  return authFetch<{ messages: ChatMessage[]; unreadCount: number }>('/api/messages');
}

export async function sendConversationMessage(body: string) {
  return authFetch<{ message: ChatMessage }>('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function markConversationRead() {
  return authFetch<{ ok: boolean }>('/api/messages', { method: 'PUT', body: JSON.stringify({}) });
}

export async function loadAppointments() {
  return authFetch<{ appointments: PatientAppointment[]; availability: AppointmentAvailability }>('/api/appointments');
}

export async function bookAppointment(input: {
  day: string;
  slot: string;
  mode: 'online' | 'presencial';
  notes?: string;
}) {
  return authFetch<{ appointment: PatientAppointment }>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancelAppointment(id: string) {
  return authFetch<{ appointment: PatientAppointment }>('/api/appointments', {
    method: 'PATCH',
    body: JSON.stringify({ id }),
  });
}

export async function loadUnreadMessageCount() {
  const result = await loadConversation();
  return result.unreadCount || 0;
}
