import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLICSUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_PUBLICSUPABASE_ANON_KEY ||
  import.meta.env.VITE_PUBLICSUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const MEAL_PHOTOS_BUCKET = 'meal-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30;
const SYNC_QUEUE_KEY = 'nutriSyncQueueV1';
const MAX_PENDING_OPS = 120;
const MAX_INLINE_PHOTO_CHARS = 600_000;

const parseSupabaseUrl = (url: string | undefined) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const parsedSupabaseUrl = parseSupabaseUrl(supabaseUrl);

export const supabaseConfig = {
  isConfigured: Boolean(supabaseUrl && supabaseKey),
  hasValidUrl: Boolean(parsedSupabaseUrl),
  url: supabaseUrl || '',
  host: parsedSupabaseUrl?.host || '',
};

export const isSupabaseConfigured = supabaseConfig.isConfigured && supabaseConfig.hasValidUrl;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export class SyncError extends Error {
  code: string;

  constructor(message: string, code = 'sync') {
    super(message);
    this.name = 'SyncError';
    this.code = code;
  }
}

let isDataSchemaAvailable = true;

export function isNetworkOrDnsError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || '');
  return /failed to fetch|networkerror|load failed|name_not_resolved|err_name_not_resolved|dns|offline|timed out|timeout/i.test(message);
}

export function isSupabaseSchemaMissingError(err: unknown) {
  const maybeError = err as { code?: string; message?: string; details?: string; hint?: string } | null;
  const text = [
    maybeError?.code,
    maybeError?.message,
    maybeError?.details,
    maybeError?.hint,
    err instanceof Error ? err.message : '',
  ].filter(Boolean).join(' ');

  return /PGRST205|42P01|schema cache|Could not find the table|relation .* does not exist|bucket not found/i.test(text);
}

function markSchemaUnavailable(err: unknown) {
  if (!isDataSchemaAvailable) return;
  isDataSchemaAvailable = false;
  emitSyncState({ status: 'error', message: getFriendlySupabaseError(err) });
}

export function isSupabaseDataSyncAvailable() {
  return Boolean(supabase && isDataSchemaAvailable);
}

export function getSupabaseConfigMessage() {
  if (!supabaseConfig.isConfigured) {
    return 'O login ainda não está configurado. Verifique as variáveis do Supabase no .env.local.';
  }
  if (!supabaseConfig.hasValidUrl) {
    return 'A URL do Supabase no .env.local não é válida. Use uma URL https do seu projeto Supabase.';
  }
  return '';
}

export function getFriendlySupabaseError(err: unknown) {
  const configMessage = getSupabaseConfigMessage();
  if (configMessage) return configMessage;
  if (err instanceof SyncError && err.message) return err.message;
  if (isNetworkOrDnsError(err)) {
    return 'Sem conexão com o servidor agora. Seus dados ficaram salvos neste aparelho e serão sincronizados quando a internet voltar.';
  }
  if (isSupabaseSchemaMissingError(err)) {
    return 'O banco ainda não está pronto. Rode as migrations do Supabase para habilitar o salvamento na nuvem.';
  }

  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
  if (/user already registered|already been registered/i.test(message)) return 'Este e-mail já tem uma conta. Tente entrar.';
  if (/password should be at least/i.test(message)) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (/rate limit|too many requests|email rate limit/i.test(message)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.';
  if (/jwt|session.*expired|refresh token/i.test(message)) return 'Sua sessão expirou. Entre novamente para continuar.';
  if (message) return message;
  return 'Não foi possível concluir a operação agora.';
}

// -------------------------------------------------------------
// Sessão
// -------------------------------------------------------------

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user) return data.session;

  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session ?? null;
}

async function requireSession(): Promise<Session> {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    throw new SyncError('Sua sessão expirou. Entre novamente para sincronizar seus dados.', 'auth');
  }
  return session;
}

function requireClient() {
  if (!supabase) throw new SyncError(getSupabaseConfigMessage(), 'config');
  return supabase;
}

// -------------------------------------------------------------
// Estado de sincronização (feedback na interface)
// -------------------------------------------------------------

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export interface SyncSnapshot {
  status: SyncStatus;
  pending: number;
  message?: string;
}

type SyncListener = (snapshot: SyncSnapshot) => void;

const syncListeners = new Set<SyncListener>();
let syncSnapshot: SyncSnapshot = { status: 'idle', pending: 0 };
let savedResetTimer: ReturnType<typeof setTimeout> | null = null;

function emitSyncState(next: Partial<SyncSnapshot>) {
  syncSnapshot = { ...syncSnapshot, ...next, pending: pendingOps.length };
  syncListeners.forEach((listener) => listener(syncSnapshot));
}

export function getSyncSnapshot() {
  return syncSnapshot;
}

export function subscribeSyncState(listener: SyncListener) {
  syncListeners.add(listener);
  listener(syncSnapshot);
  return () => {
    syncListeners.delete(listener);
  };
}

function markSaved() {
  emitSyncState({ status: 'saved', message: undefined });
  if (savedResetTimer) clearTimeout(savedResetTimer);
  savedResetTimer = setTimeout(() => {
    if (syncSnapshot.status === 'saved') emitSyncState({ status: 'idle' });
  }, 2500);
}

// -------------------------------------------------------------
// Fila serializada + pendências offline
// -------------------------------------------------------------

type MealOp = { kind: 'meal'; userId: string; meal: Record<string, unknown> };
type DeleteMealOp = { kind: 'meal-delete'; userId: string; mealId: string };
type ProfileOp = { kind: 'profile'; userId: string; email: string; profile: Record<string, unknown> };
type QueueOp = MealOp | DeleteMealOp | ProfileOp;

let pendingOps: QueueOp[] = readPendingOps();
let writeChain: Promise<unknown> = Promise.resolve();
let isFlushing = false;

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

function readPendingOps(): QueueOp[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((op) => op && typeof op === 'object' && 'kind' in op).slice(-MAX_PENDING_OPS) : [];
  } catch {
    return [];
  }
}

function persistPendingOps() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(pendingOps));
  } catch {
    // Fotos em base64 podem estourar a cota local; a fila segue em memória.
    try {
      const slim = pendingOps.map((op) => op.kind === 'meal'
        ? { ...op, meal: { ...op.meal, photos: [] } }
        : op);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(slim));
    } catch {
      // Sem persistência local nesta sessão.
    }
  }
}

function opKey(op: QueueOp) {
  if (op.kind === 'meal') return `meal:${op.userId}:${String(op.meal.id || '')}`;
  if (op.kind === 'meal-delete') return `meal:${op.userId}:${op.mealId}`;
  return `profile:${op.userId}`;
}

function addPending(op: QueueOp) {
  const key = opKey(op);
  pendingOps = pendingOps.filter((item) => opKey(item) !== key);
  pendingOps.push(op);
  if (pendingOps.length > MAX_PENDING_OPS) pendingOps = pendingOps.slice(-MAX_PENDING_OPS);
  persistPendingOps();
  emitSyncState({ status: 'offline', message: 'Alterações guardadas neste aparelho. Sincronizando quando a conexão voltar.' });
}

function isRetryableError(err: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const status = Number((err as { status?: number } | null)?.status || 0);
  if (status >= 500 || status === 429 || status === 408) return true;
  return isNetworkOrDnsError(err);
}

// -------------------------------------------------------------
// Normalização e fotos
// -------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function toUuid(value: unknown): Promise<string> {
  const text = typeof value === 'string' ? value.trim() : '';
  if (UUID_RE.test(text)) return text.toLowerCase();

  const source = `mind-nutrition:${text || Math.random().toString(36).slice(2)}`;
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)));
    digest[6] = (digest[6] & 0x0f) | 0x50;
    digest[8] = (digest[8] & 0x3f) | 0x80;
    const hex = Array.from(digest.slice(0, 16)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const base = (hash >>> 0).toString(16).padStart(8, '0').repeat(4);
  return `${base.slice(0, 8)}-${base.slice(8, 12)}-5${base.slice(13, 16)}-8${base.slice(17, 20)}-${base.slice(20, 32)}`;
}

export function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();

  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    if (!Number.isNaN(fromNumber.getTime())) return fromNumber.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return new Date().toISOString();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0).toISOString();
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

    const dateParts = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
    if (dateParts) {
      const day = Number(dateParts[1]);
      const month = Number(dateParts[2]) - 1;
      let year = dateParts[3] ? Number(dateParts[3]) : new Date().getFullYear();
      if (year < 100) year += 2000;
      const fromParts = new Date(year, month, day, 12, 0, 0);
      if (!Number.isNaN(fromParts.getTime())) return fromParts.toISOString();
    }
  }

  return new Date().toISOString();
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    const binary = atob(match[2].replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: match[1] });
  } catch {
    return null;
  }
}

async function contentHash(value: string) {
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    return Array.from(digest.slice(0, 10)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function extensionForMime(mime: string) {
  if (/png/i.test(mime)) return 'png';
  if (/webp/i.test(mime)) return 'webp';
  if (/gif/i.test(mime)) return 'gif';
  return 'jpg';
}

export function extractStoragePath(value: string): string {
  if (!value || /^(data:|blob:|https?:)/i.test(value)) return '';
  const match = /\/storage\/v1\/object\/(?:sign|public)\/meal-photos\/([^?]+)/i.exec(value);
  if (match) return decodeURIComponent(match[1]);
  return /^[\w-]+\/[\w./-]+\.(jpg|jpeg|png|webp|gif)$/i.test(value) ? value : '';
}

export async function uploadImageDataUrl(userId: string, dataUrl: string, prefix = 'meal'): Promise<string | null> {
  const client = requireClient();
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;
  const hash = await contentHash(dataUrl);
  const path = `${userId}/${prefix}-${hash}.${extensionForMime(blob.type)}`;
  const { error } = await client.storage.from(MEAL_PHOTOS_BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw error;
  return path;
}

export async function signPhotoPaths(paths: string[]): Promise<Map<string, string>> {
  const client = requireClient();
  const unique = Array.from(new Set(paths.filter((path) => typeof path === 'string' && path.length > 0)));
  const map = new Map<string, string>();
  if (!unique.length) return map;

  const { data, error } = await client.storage.from(MEAL_PHOTOS_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  (data || []).forEach((item) => {
    if (item?.path && item?.signedUrl && !item.error) map.set(item.path, item.signedUrl);
  });
  return map;
}

function normalizePhotoEntries(meal: Record<string, unknown>) {
  const raw = Array.isArray(meal.photos) ? meal.photos.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  const image = typeof meal.image === 'string' ? meal.image : '';
  if (image && !raw.includes(image)) raw.unshift(image);
  return raw;
}

async function prepareMealPhotos(userId: string, meal: Record<string, unknown>) {
  const photos = normalizePhotoEntries(meal);
  const existingPaths = Array.isArray(meal.photoPaths)
    ? meal.photoPaths.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];

  const paths: string[] = [];
  const externalPhotos: string[] = [];
  const inlinePhotos: string[] = [];
  let storageFailed = false;

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    if (photo.startsWith('data:image/')) {
      if (storageFailed) {
        inlinePhotos.push(photo);
        continue;
      }
      try {
        const path = await uploadImageDataUrl(userId, photo, 'meal');
        if (path) paths.push(path);
        else inlinePhotos.push(photo);
      } catch (err) {
        storageFailed = true;
        if (isSupabaseSchemaMissingError(err)) markSchemaUnavailable(err);
        console.info('Upload de foto indisponível, mantendo imagem local:', getFriendlySupabaseError(err));
        inlinePhotos.push(photo);
      }
      continue;
    }

    if (existingPaths[index]) {
      paths.push(existingPaths[index]);
      continue;
    }

    const storagePath = extractStoragePath(photo);
    if (storagePath) paths.push(storagePath);
    else if (/^https?:\/\//i.test(photo)) externalPhotos.push(photo);
  }

  const inlineSize = inlinePhotos.reduce((total, photo) => total + photo.length, 0);
  const safeInlinePhotos = inlineSize <= MAX_INLINE_PHOTO_CHARS ? inlinePhotos : [];

  return {
    photoPaths: Array.from(new Set(paths)),
    externalPhotos,
    inlinePhotos: safeInlinePhotos,
    droppedPhotos: inlinePhotos.length - safeInlinePhotos.length,
  };
}

// -------------------------------------------------------------
// Operações remotas
// -------------------------------------------------------------

async function performMealUpsert(op: MealOp) {
  const client = requireClient();
  const session = await requireSession();
  const userId = session.user.id;
  const meal = op.meal && typeof op.meal === 'object' ? op.meal : {};
  const mealId = await toUuid(meal.id);
  const date = toIsoTimestamp(meal.date);
  const photoState = await prepareMealPhotos(userId, meal);

  const payload: Record<string, unknown> = {
    ...meal,
    id: mealId,
    date,
    photos: photoState.inlinePhotos,
    image: photoState.externalPhotos[0] || photoState.inlinePhotos[0] || '',
    photoPaths: photoState.photoPaths,
    externalPhotos: photoState.externalPhotos,
    syncedAt: new Date().toISOString(),
  };

  const { error } = await client.from('meals').upsert({
    id: mealId,
    user_id: userId,
    payload,
    created_at: date,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) throw error;
  return { id: mealId, photoPaths: photoState.photoPaths, droppedPhotos: photoState.droppedPhotos };
}

async function performMealDelete(op: DeleteMealOp) {
  const client = requireClient();
  const session = await requireSession();
  const userId = session.user.id;
  const mealId = await toUuid(op.mealId);

  const { data } = await client
    .from('meals')
    .select('payload')
    .eq('user_id', userId)
    .eq('id', mealId)
    .maybeSingle();

  const { error } = await client.from('meals').delete().eq('user_id', userId).eq('id', mealId);
  if (error) throw error;

  const payload = (data as { payload?: Record<string, unknown> } | null)?.payload;
  const paths = Array.isArray(payload?.photoPaths) ? payload!.photoPaths as string[] : [];
  if (paths.length) {
    await client.storage.from(MEAL_PHOTOS_BUCKET).remove(paths).catch(() => undefined);
  }
}

async function performProfileUpsert(op: ProfileOp) {
  const client = requireClient();
  const session = await requireSession();
  const userId = session.user.id;
  const email = (op.email || session.user.email || '').trim();
  const profile = op.profile && typeof op.profile === 'object' ? { ...op.profile } : {};

  let photo = typeof profile.photo === 'string' ? profile.photo : '';
  let photoPath = typeof profile.photoPath === 'string' ? profile.photoPath : '';

  if (photo.startsWith('data:image/')) {
    try {
      const uploaded = await uploadImageDataUrl(userId, photo, 'avatar');
      if (uploaded) {
        photoPath = uploaded;
        photo = '';
      }
    } catch (err) {
      if (isSupabaseSchemaMissingError(err)) markSchemaUnavailable(err);
      console.info('Upload do avatar indisponível:', getFriendlySupabaseError(err));
      if (photo.length > 300_000) photo = '';
    }
  } else if (/^https?:\/\//i.test(photo)) {
    photo = '';
  }

  const data = { ...profile, email, photo, photoPath };

  const { error } = await client.from('profiles').upsert({
    id: userId,
    email,
    name: typeof profile.name === 'string' ? profile.name : '',
    photo: '',
    data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) throw error;
  return { photoPath };
}

async function executeOp(op: QueueOp) {
  if (op.kind === 'meal') return performMealUpsert(op);
  if (op.kind === 'meal-delete') return performMealDelete(op);
  return performProfileUpsert(op);
}

async function syncOperation<T>(op: QueueOp, task: () => Promise<T>): Promise<{ synced: boolean; result?: T; queued?: boolean }> {
  if (!isSupabaseDataSyncAvailable()) return { synced: false };
  emitSyncState({ status: 'saving', message: undefined });
  try {
    const result = await enqueueWrite(task);
    markSaved();
    scheduleFlush();
    return { synced: true, result };
  } catch (err) {
    if (isSupabaseSchemaMissingError(err)) {
      markSchemaUnavailable(err);
      throw err;
    }
    if (isRetryableError(err)) {
      addPending(op);
      return { synced: false, queued: true };
    }
    emitSyncState({ status: 'error', message: getFriendlySupabaseError(err) });
    throw err;
  }
}

export async function flushSyncQueue() {
  if (isFlushing || !isSupabaseDataSyncAvailable() || !pendingOps.length) return;
  isFlushing = true;
  emitSyncState({ status: 'saving', message: undefined });
  try {
    while (pendingOps.length) {
      const op = pendingOps[0];
      try {
        await enqueueWrite(() => executeOp(op));
        pendingOps.shift();
        persistPendingOps();
      } catch (err) {
        if (isRetryableError(err)) {
          emitSyncState({ status: 'offline', message: 'Ainda sem conexão. Tentaremos novamente em breve.' });
          break;
        }
        if (isSupabaseSchemaMissingError(err)) markSchemaUnavailable(err);
        pendingOps.shift();
        persistPendingOps();
        emitSyncState({ status: 'error', message: getFriendlySupabaseError(err) });
      }
    }
    if (!pendingOps.length) markSaved();
  } finally {
    isFlushing = false;
  }
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (typeof window === 'undefined' || !pendingOps.length) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushSyncQueue();
  }, 1200);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushSyncQueue());
  window.addEventListener('focus', () => void flushSyncQueue());
  if (pendingOps.length) setTimeout(() => void flushSyncQueue(), 1500);
}

// -------------------------------------------------------------
// API pública de dados
// -------------------------------------------------------------

export async function loadProfile(userId: string) {
  if (!isSupabaseDataSyncAvailable()) return null;
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      markSchemaUnavailable(error);
      return null;
    }
    throw error;
  }
  if (!data) return null;

  const stored = data.data && typeof data.data === 'object' ? data.data as Record<string, unknown> : {};
  let photo = typeof data.photo === 'string' ? data.photo : '';
  const photoPath = typeof stored.photoPath === 'string' ? stored.photoPath : '';

  if (photoPath) {
    try {
      const signed = await signPhotoPaths([photoPath]);
      photo = signed.get(photoPath) || photo;
    } catch (err) {
      console.info('Não foi possível assinar a foto do perfil:', getFriendlySupabaseError(err));
    }
  }

  return {
    ...stored,
    id: data.id,
    email: data.email || stored.email || '',
    name: data.name || stored.name || '',
    photo: photo || stored.photo || '',
    photoPath,
  };
}

export async function upsertProfile(userId: string, email: string, profile: Record<string, unknown>) {
  const op: ProfileOp = { kind: 'profile', userId, email, profile };
  return syncOperation(op, () => performProfileUpsert(op));
}

export async function loadMeals(userId: string) {
  if (!isSupabaseDataSyncAvailable()) return [];
  const client = requireClient();
  const { data, error } = await client
    .from('meals')
    .select('id,payload,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      markSchemaUnavailable(error);
      return [];
    }
    throw error;
  }

  const rows = (data || []) as Array<{ id: string; payload: Record<string, unknown> | null; created_at?: string; updated_at?: string }>;
  const allPaths = rows.flatMap((row) => {
    const paths = row.payload && typeof row.payload === 'object' ? row.payload.photoPaths : null;
    return Array.isArray(paths) ? paths.filter((item): item is string => typeof item === 'string') : [];
  });

  let signed = new Map<string, string>();
  if (allPaths.length) {
    try {
      signed = await signPhotoPaths(allPaths);
    } catch (err) {
      console.info('Não foi possível assinar fotos das refeições:', getFriendlySupabaseError(err));
    }
  }

  return rows.map((row) => {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const paths = Array.isArray(payload.photoPaths)
      ? payload.photoPaths.filter((item): item is string => typeof item === 'string')
      : [];
    const signedPhotos = paths.map((path) => signed.get(path) || '').filter(Boolean);
    const inlinePhotos = Array.isArray(payload.photos)
      ? payload.photos.filter((item): item is string => typeof item === 'string')
      : [];
    const externalPhotos = Array.isArray(payload.externalPhotos)
      ? payload.externalPhotos.filter((item): item is string => typeof item === 'string')
      : [];
    const photos = signedPhotos.length ? signedPhotos : [...inlinePhotos, ...externalPhotos];

    return {
      ...payload,
      id: typeof payload.id === 'string' ? payload.id : row.id,
      date: typeof payload.date === 'string' ? payload.date : (row.created_at || new Date().toISOString()),
      photos,
      photoPaths: paths,
      image: signedPhotos[0] || (typeof payload.image === 'string' ? payload.image : '') || photos[0] || '',
      updatedAt: row.updated_at || payload.syncedAt || row.created_at,
    };
  });
}

export async function insertMeal(userId: string, meal: Record<string, unknown>) {
  const op: MealOp = { kind: 'meal', userId, meal };
  return syncOperation(op, () => performMealUpsert(op));
}

export async function deleteMeal(userId: string, mealId: string) {
  const op: DeleteMealOp = { kind: 'meal-delete', userId, mealId };
  return syncOperation(op, () => performMealDelete(op));
}

export async function deleteCurrentUserData(userId: string) {
  const client = requireClient();
  const session = await requireSession();
  const uid = session.user.id || userId;

  try {
    const { data: files } = await client.storage.from(MEAL_PHOTOS_BUCKET).list(uid, { limit: 1000 });
    if (files?.length) {
      await client.storage.from(MEAL_PHOTOS_BUCKET).remove(files.map((file) => `${uid}/${file.name}`));
    }
  } catch {
    // Se o storage ainda não estiver configurado, seguimos com a remoção dos registros.
  }

  const { error } = await client.rpc('delete_current_user_data');
  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      markSchemaUnavailable(error);
      throw error;
    }
    const mealsDelete = await client.from('meals').delete().eq('user_id', uid);
    if (mealsDelete.error) throw mealsDelete.error;
    const profileDelete = await client.from('profiles').delete().eq('id', uid);
    if (profileDelete.error) throw profileDelete.error;
  }
}

export async function getPendingSyncCount() {
  return pendingOps.length;
}
