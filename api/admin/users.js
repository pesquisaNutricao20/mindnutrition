import { requireAdmin } from '../_lib/admin.js';
import { handleApiError, methodNotAllowed, sendJson } from '../_lib/http.js';
import { isSupabaseAdminConfigured, supabaseAdminRequest } from '../_lib/supabaseAdmin.js';

const MAX_USERS = 1000;

const SELECT = [
  'id',
  'email',
  'name',
  'updated_at',
  'age:data->>age',
  'height:data->>height',
  'imc:data->>imc',
  'gender:data->>gender',
  'objectives:data->objectives',
  'onboarding:data->>onboardingComplete',
  'completed:data->>profileCompletedAt',
  'notes:data->dailyNotes',
  'sleep:data->sleepLogs',
  'weight:data->weightEvolution',
].join(',');

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const latestWeight = (entries) => {
  if (!Array.isArray(entries)) return null;
  const valid = entries.filter((entry) => toNumber(entry?.value) > 0);
  if (!valid.length) return null;
  const withTime = valid.map((entry) => {
    const raw = entry.createdAt || entry.date;
    const parsed = new Date(raw);
    return { value: toNumber(entry.value), time: Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime() };
  });
  withTime.sort((a, b) => a.time - b.time);
  return withTime[withTime.length - 1].value;
};

function mapUser(row) {
  const rawImc = toNumber(row.imc);
  const weight = latestWeight(row.weight);
  const rawHeight = toNumber(row.height);
  const height = rawHeight && rawHeight > 0 && rawHeight < 3 ? Number((rawHeight * 100).toFixed(1)) : rawHeight;
  const storedImc = rawImc && rawImc >= 10 && rawImc <= 80 ? rawImc : null;
  const computedImc = weight && height
    ? Number((weight / ((height / 100) ** 2)).toFixed(1))
    : null;
  const imc = computedImc && computedImc >= 10 && computedImc <= 80 ? computedImc : storedImc;

  return {
    id: String(row.id || ''),
    email: String(row.email || '').slice(0, 160),
    name: String(row.name || '').slice(0, 120),
    age: toNumber(row.age),
    height,
    imc,
    weight,
    gender: String(row.gender || '').slice(0, 40),
    objectives: Array.isArray(row.objectives)
      ? row.objectives.map((item) => String(item).slice(0, 60)).filter(Boolean).slice(0, 6)
      : [],
    onboardingComplete: Boolean(row.onboarding) || Boolean(row.completed),
    notesCount: Array.isArray(row.notes) ? row.notes.length : 0,
    sleepCount: Array.isArray(row.sleep) ? row.sleep.length : 0,
    updatedAt: row.updated_at || null,
    lastActive: row.updated_at || null,
  };
}

function sortUsers(users, sort) {
  const list = [...users];
  if (sort === 'name') {
    return list.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR'));
  }
  if (sort === 'imc') {
    return list.sort((a, b) => (b.imc || 0) - (a.imc || 0));
  }
  return list.sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  if (!requireAdmin(request, response)) return;

  try {
    if (!isSupabaseAdminConfigured()) {
      return sendJson(response, 503, {
        message: 'O Supabase ainda não tem as chaves de servidor configuradas para listar usuários.',
      });
    }

    const url = new URL(request.url || '/', 'http://localhost');
    const rawSearch = String(url.searchParams.get('search') || '').slice(0, 80);
    const search = rawSearch.replace(/[^\p{L}\p{N}\s@._-]/gu, '').trim();
    const page = Math.max(1, Math.min(Number(url.searchParams.get('page')) || 1, 100));
    const pageSize = Math.max(5, Math.min(Number(url.searchParams.get('pageSize')) || 20, 100));
    const sort = ['recent', 'name', 'imc'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'recent';
    const filter = url.searchParams.get('filter') || 'all';

    const rows = await supabaseAdminRequest('/rest/v1/profiles', {
      query: {
        select: SELECT,
        order: 'updated_at.desc.nullslast',
        limit: MAX_USERS,
        ...(search ? { or: `(name.ilike.*${search}*,email.ilike.*${search}*)` } : {}),
      },
    });

    let users = (Array.isArray(rows) ? rows : []).map(mapUser).filter((user) => user.id);
    users = sortUsers(users, sort);

    const total = users.length;
    const imcValues = users.map((user) => user.imc).filter((value) => Number.isFinite(value) && value >= 10 && value <= 80);
    const stats = {
      total,
      onboarded: users.filter((user) => user.onboardingComplete).length,
      pending: users.filter((user) => !user.onboardingComplete).length,
      withImc: imcValues.length,
      averageImc: imcValues.length ? Number((imcValues.reduce((sum, value) => sum + value, 0) / imcValues.length).toFixed(1)) : null,
      updatedToday: users.filter((user) => {
        if (!user.updatedAt) return false;
        return new Date(user.updatedAt).toDateString() === new Date().toDateString();
      }).length,
      withEmail: users.filter((user) => /@/.test(user.email)).length,
    };

    if (filter === 'onboarded') users = users.filter((user) => user.onboardingComplete);
    if (filter === 'pending') users = users.filter((user) => !user.onboardingComplete);
    if (filter === 'imc') users = users.filter((user) => Number.isFinite(user.imc));

    const filteredTotal = users.length;
    const offset = (page - 1) * pageSize;
    const pageUsers = users.slice(offset, offset + pageSize);

    return sendJson(response, 200, {
      users: pageUsers,
      stats,
      pagination: {
        page,
        pageSize,
        total: filteredTotal,
        totalPages: Math.max(1, Math.ceil(filteredTotal / pageSize)),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível carregar os usuários agora.');
  }
}
