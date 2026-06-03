import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLICSUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_PUBLICSUPABASE_ANON_KEY ||
  import.meta.env.VITE_PUBLICSUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function loadProfile(userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data.data ? { ...data.data, id: data.id, email: data.email } : data;
}

export async function upsertProfile(userId: string, email: string, profile: Record<string, unknown>) {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    name: profile.name || '',
    photo: profile.photo || '',
    data: profile,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function loadMeals(userId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((item: any) => item.payload || item.data || item);
}

export async function insertMeal(userId: string, meal: Record<string, unknown>) {
  if (!supabase) return;
  const { error } = await supabase.from('meals').insert({
    user_id: userId,
    payload: meal,
    created_at: meal.date || new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteCurrentUserData(userId: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('delete_current_user_data');
  if (error) {
    await supabase.from('meals').delete().eq('user_id', userId).throwOnError();
    await supabase.from('profiles').delete().eq('id', userId).throwOnError();
  }
}
