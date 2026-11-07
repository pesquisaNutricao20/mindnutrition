import { requireAdmin } from '../_lib/admin.js';
import { mapAppointment, mapMessage } from '../_lib/appointments.js';
import { HttpError, handleApiError, methodNotAllowed, sendJson } from '../_lib/http.js';
import { isSupabaseAdminConfigured, supabaseAdminRequest } from '../_lib/supabaseAdmin.js';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value, digits = 1) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

const average = (values) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const normalizeLabel = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const dayKey = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const moodScores = {
  euforia: 90, alegria: 84, animado: 84, calmo: 76, neutro: 60,
  ansioso: 36, ansiedade: 36, estresse: 32, estressado: 32, frustracao: 30,
  deprimido: 25, solitario: 32, raivoso: 28, culpa: 24, tenso: 34, cansado: 40, triste: 30,
};

const scoreMood = (value) => {
  const key = normalizeLabel(value);
  const match = Object.keys(moodScores).find((entry) => key.startsWith(entry));
  return match ? moodScores[match] : null;
};

function mealType(meal) {
  const value = normalizeLabel(meal?.inferredType || meal?.type || meal?.hungerType);
  if (value.includes('fisica') || value.includes('fisiologica')) return 'physical';
  if (value.includes('emocional')) return 'emotional';
  return 'unclassified';
}

function awarenessOf(meal) {
  let score = 0;
  if (toNumber(meal?.preHunger) !== null) score += 20;
  if (toNumber(meal?.postHunger) !== null) score += 20;
  if (meal?.preMood || meal?.postMood || meal?.mood) score += 20;
  if (toNumber(meal?.satisfaction) !== null) score += 20;
  if (String(meal?.notes || '').trim() || (Array.isArray(meal?.photos) && meal.photos.length) || meal?.image) score += 20;
  return score;
}

function periodOf(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sem horário';
  const hour = parsed.getHours();
  if (hour < 6) return 'Madrugada';
  if (hour < 12) return 'Manhã';
  if (hour < 18) return 'Tarde';
  return 'Noite';
}

function summarizeMetrics(entries) {
  if (!Array.isArray(entries)) return { points: [], first: null, last: null, delta: null };
  const points = entries
    .map((entry) => ({ date: String(entry?.date || '').slice(0, 16), value: toNumber(entry?.value) }))
    .filter((entry) => entry.value !== null && entry.value > 0)
    .slice(-30);
  if (!points.length) return { points: [], first: null, last: null, delta: null };
  const first = points[0].value;
  const last = points[points.length - 1].value;
  return { points, first, last, delta: round(last - first, 1) };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  if (!requireAdmin(request, response)) return;

  try {
    if (!isSupabaseAdminConfigured()) {
      throw new HttpError(503, 'O Supabase ainda não está configurado no servidor para os insights.');
    }

    const url = new URL(request.url || '/', 'http://localhost');
    const userId = String(url.searchParams.get('userId') || '').trim().slice(0, 64);
    if (!userId) throw new HttpError(400, 'Selecione o paciente.');

    const profileRows = await supabaseAdminRequest('/rest/v1/profiles', {
      query: { select: '*', id: `eq.${userId}`, limit: 1 },
    });
    const profileRow = Array.isArray(profileRows) ? profileRows[0] : null;
    if (!profileRow) throw new HttpError(404, 'Paciente não encontrado.');

    const [mealRows, appointmentRows, messageRows] = await Promise.all([
      supabaseAdminRequest('/rest/v1/meals', {
        query: { select: 'id,payload,created_at', user_id: `eq.${userId}`, order: 'created_at.desc', limit: 400 },
      }),
      supabaseAdminRequest('/rest/v1/appointments', {
        query: { select: '*', user_id: `eq.${userId}`, order: 'day.desc,slot.desc', limit: 20 },
      }),
      supabaseAdminRequest('/rest/v1/messages', {
        query: { select: '*', user_id: `eq.${userId}`, order: 'created_at.desc', limit: 1 },
      }),
    ]);

    const data = profileRow.data && typeof profileRow.data === 'object' ? profileRow.data : {};
    const rawHeight = toNumber(data.height);
    const height = rawHeight && rawHeight > 0 && rawHeight < 3 ? round(rawHeight * 100, 1) : rawHeight;

    const meals = (Array.isArray(mealRows) ? mealRows : []).map((row) => {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      return { ...payload, date: payload.date || row.created_at, createdAt: row.created_at };
    }).filter((meal) => meal.date);

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const last30 = meals.filter((meal) => {
      const time = new Date(meal.date).getTime();
      return Number.isFinite(time) && time >= thirtyDaysAgo;
    });

    const weight = summarizeMetrics(data.weightEvolution);
    const imc = weight.last && height
      ? round(weight.last / ((height / 100) ** 2), 1)
      : toNumber(data.imc);

    const emotions = {};
    const periods = { Madrugada: 0, Manhã: 0, Tarde: 0, Noite: 0, 'Sem horário': 0 };
    let physical = 0;
    let emotional = 0;
    let unclassified = 0;

    meals.forEach((meal) => {
      const type = mealType(meal);
      if (type === 'physical') physical += 1;
      else if (type === 'emotional') emotional += 1;
      else unclassified += 1;

      const period = periodOf(meal.date);
      periods[period] = (periods[period] || 0) + 1;

      [meal.preMood, meal.postMood, meal.mood].forEach((mood) => {
        const key = String(mood || '').trim();
        if (!key) return;
        emotions[key] = (emotions[key] || 0) + 1;
      });
    });

    const daysLogged = new Set(meals.map((meal) => dayKey(meal.date)).filter(Boolean));
    const sleepLogs = Array.isArray(data.sleepLogs) ? data.sleepLogs : [];
    const sleepHours = average(sleepLogs.map((log) => toNumber(log?.hours)));
    const qualityScores = { Ruim: 30, Regular: 55, Bom: 78, Excelente: 95 };
    const sleepQuality = average(sleepLogs.map((log) => qualityScores[log?.quality] ?? null));

    const checkIns = Array.isArray(data.checkIns) ? data.checkIns.slice(-10) : [];
    const moodAverage = average(checkIns.map((entry) => scoreMood(entry?.mood)));

    const measuredMeals = meals.filter((meal) => awarenessOf(meal) > 0);
    const awareness = measuredMeals.length
      ? Math.round(average(measuredMeals.map(awarenessOf)))
      : 0;

    const topEmotions = Object.entries(emotions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    const highlights = [];
    if (!meals.length) {
      highlights.push('Ainda não há refeições registradas. A conversa e a agenda continuam disponíveis para acolher esse primeiro passo.');
    } else {
      const preAvg = average(meals.map((meal) => toNumber(meal.preHunger)));
      const postAvg = average(meals.map((meal) => toNumber(meal.postHunger)));
      if (preAvg !== null && postAvg !== null) {
        highlights.push(
          postAvg < preAvg
            ? `A fome média cai de ${round(preAvg)}/10 para ${round(postAvg)}/10 depois das refeições — um sinal de regulação percebido.`
            : `A fome média registrada é ${round(preAvg)}/10 antes e ${round(postAvg)}/10 depois. Vale conversar sobre o que acontece nesse intervalo.`,
        );
      }
      if (physical + emotional > 0) {
        const emotionalShare = Math.round((emotional / (physical + emotional)) * 100);
        highlights.push(
          emotionalShare >= 50
            ? `Cerca de ${emotionalShare}% das refeições classificadas foram marcadas como emocionais. Sem julgamento: esse dado ajuda a escolher acolhimentos além do prato.`
            : `Cerca de ${emotionalShare}% das refeições classificadas foram marcadas como emocionais; a maioria foi percebida como fome física.`,
        );
      }
      const nightMeals = periods.Noite || 0;
      if (nightMeals && meals.length >= 4 && nightMeals / meals.length >= 0.4) {
        highlights.push(`A noite concentra ${Math.round((nightMeals / meals.length) * 100)}% dos registros. Observar sono e cansaço pode ajudar a entender esse padrão.`);
      }
      const satisfactionAvg = average(meals.map((meal) => toNumber(meal.satisfaction)));
      if (satisfactionAvg !== null) {
        highlights.push(`Satisfação média após comer: ${round(satisfactionAvg)}/5 em ${meals.length} registros.`);
      }
    }
    if (sleepHours !== null) {
      highlights.push(`Sono médio de ${round(sleepHours)}h em ${sleepLogs.length} registro${sleepLogs.length === 1 ? '' : 's'}.`);
    }
    if (!highlights.length) highlights.push('Poucos dados por enquanto. Converse com a pessoa sobre como ela prefere começar a registrar.');

    const latestMeals = meals.slice(0, 8).map((meal) => ({
      date: meal.date,
      title: String(meal.title || meal.description || 'Refeição').slice(0, 80),
      type: mealType(meal),
      preHunger: toNumber(meal.preHunger),
      postHunger: toNumber(meal.postHunger),
      satisfaction: toNumber(meal.satisfaction),
      preMood: String(meal.preMood || '').slice(0, 40),
      postMood: String(meal.postMood || meal.mood || '').slice(0, 40),
      notes: String(meal.notes || '').slice(0, 240),
      aiDish: String(meal?.aiAnalysis?.dish || '').slice(0, 80),
    }));

    return sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      user: {
        id: String(profileRow.id || ''),
        email: String(profileRow.email || '').slice(0, 160),
        name: String(profileRow.name || data.name || '').slice(0, 120),
        photo: String(profileRow.photo || data.photoPath || '').slice(0, 400),
        age: toNumber(data.age),
        gender: String(data.gender || '').slice(0, 40),
        height,
        weight: weight.last,
        imc,
        activityLevel: toNumber(data.activityLevel),
        objectives: Array.isArray(data.objectives) ? data.objectives.slice(0, 8) : [],
        initialEmotions: Array.isArray(data.initialEmotions) ? data.initialEmotions.slice(0, 8) : [],
        triggers: Array.isArray(data.triggers) ? data.triggers.slice(0, 8) : [],
        foods: Array.isArray(data.foods) ? data.foods.slice(0, 8) : [],
        comorbidities: Array.isArray(data.comorbidities) ? data.comorbidities.slice(0, 8) : [],
        onboardingComplete: Boolean(data.onboardingComplete || data.profileCompletedAt),
        createdAt: profileRow.created_at || null,
        updatedAt: profileRow.updated_at || null,
      },
      insights: {
        awareness,
        highlights,
        meals: {
          total: meals.length,
          last30: last30.length,
          daysLogged: daysLogged.size,
          physical,
          emotional,
          unclassified,
          averagePreHunger: round(average(meals.map((meal) => toNumber(meal.preHunger)))),
          averagePostHunger: round(average(meals.map((meal) => toNumber(meal.postHunger)))),
          averageSatisfaction: round(average(meals.map((meal) => toNumber(meal.satisfaction)))),
          periods,
          topEmotions,
          recent: latestMeals,
        },
        sleep: {
          count: sleepLogs.length,
          averageHours: round(sleepHours),
          qualityScore: round(sleepQuality, 0),
          latest: sleepLogs.slice(0, 5).map((log) => ({
            date: String(log?.date || '').slice(0, 16),
            hours: toNumber(log?.hours),
            quality: String(log?.quality || '').slice(0, 20),
          })),
        },
        diary: {
          count: Array.isArray(data.dailyNotes) ? data.dailyNotes.length : 0,
          latest: (Array.isArray(data.dailyNotes) ? data.dailyNotes : []).slice(0, 5).map((note) => ({
            date: String(note?.date || '').slice(0, 16),
            mood: String(note?.mood || '').slice(0, 30),
            text: String(note?.text || '').slice(0, 300),
          })),
        },
        mood: {
          checkIns: checkIns.map((entry) => ({
            date: String(entry?.date || '').slice(0, 16),
            mood: String(entry?.mood || '').slice(0, 30),
          })),
          averageScore: round(moodAverage, 0),
        },
        measures: {
          weight,
          waist: summarizeMetrics(data.waistEvolution),
          abdomen: summarizeMetrics(data.abdomenEvolution),
          hip: summarizeMetrics(data.hipEvolution),
          arm: summarizeMetrics(data.armEvolution),
        },
      },
      appointments: (Array.isArray(appointmentRows) ? appointmentRows : []).map(mapAppointment),
      conversation: (() => {
        const row = Array.isArray(messageRows) ? messageRows[0] : null;
        if (!row) return { lastMessage: '', lastSender: '', lastAt: null, unreadFromUser: 0 };
        const last = mapMessage(row);
        return {
          lastMessage: last.body,
          lastSender: last.sender,
          lastAt: last.createdAt,
          unreadFromUser: 0,
        };
      })(),
    });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível carregar os insights do paciente.');
  }
}
