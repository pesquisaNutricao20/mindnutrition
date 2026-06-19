import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLICSUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_PUBLICSUPABASE_ANON_KEY ||
  import.meta.env.VITE_PUBLICSUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

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

let isDataSchemaAvailable = true;

export function isNetworkOrDnsError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || '');
  return /failed to fetch|networkerror|load failed|name_not_resolved|err_name_not_resolved|dns/i.test(message);
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

  return /PGRST205|42P01|schema cache|Could not find the table|relation .* does not exist/i.test(text);
}

function skipRemoteDataSync() {
  isDataSchemaAvailable = false;
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
  if (isNetworkOrDnsError(err)) {
    return 'Não foi possível acessar o servidor de login agora. Confira sua conexão e se o projeto Supabase configurado ainda está ativo.';
  }
  if (isSupabaseSchemaMissingError(err)) {
    return 'Login conectado, mas as tabelas do aplicativo ainda não foram criadas no Supabase. O app vai continuar usando dados locais.';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Não foi possível concluir a operação agora.';
}

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function loadProfile(userId: string) {
  if (!isSupabaseDataSyncAvailable()) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      skipRemoteDataSync();
      return null;
    }
    throw error;
  }
  if (!data) return null;
  return data.data ? { ...data.data, id: data.id, email: data.email } : data;
}

export async function upsertProfile(userId: string, email: string, profile: Record<string, unknown>) {
  if (!isSupabaseDataSyncAvailable()) return;
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    name: profile.name || '',
    photo: profile.photo || '',
    data: profile,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      skipRemoteDataSync();
      return;
    }
    throw error;
  }
}

export async function loadMeals(userId: string) {
  if (!isSupabaseDataSyncAvailable()) return [];
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      skipRemoteDataSync();
      return [];
    }
    throw error;
  }
  return (data || []).map((item: any) => item.payload || item.data || item);
}

export async function insertMeal(userId: string, meal: Record<string, unknown>) {
  if (!isSupabaseDataSyncAvailable()) return;
  const { error } = await supabase.from('meals').insert({
    user_id: userId,
    payload: meal,
    created_at: meal.date || new Date().toISOString(),
  });
  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      skipRemoteDataSync();
      return;
    }
    throw error;
  }
}

export async function deleteCurrentUserData(userId: string) {
  if (!isSupabaseDataSyncAvailable()) return;
  const { error } = await supabase.rpc('delete_current_user_data');
  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      skipRemoteDataSync();
      return;
    }
    await supabase.from('meals').delete().eq('user_id', userId).throwOnError();
    await supabase.from('profiles').delete().eq('id', userId).throwOnError();
  }
}
