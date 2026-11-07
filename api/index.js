import { sendJson } from './_lib/http.js';
import aiInsight from './_routes/ai-insight.js';
import aiMealImage from './_routes/ai-meal-image.js';
import appointments from './_routes/appointments.js';
import articles from './_routes/articles.js';
import health from './_routes/health.js';
import messages from './_routes/messages.js';
import adminAppointments from './_routes/admin/appointments.js';
import adminArticles from './_routes/admin/articles.js';
import adminInsights from './_routes/admin/insights.js';
import adminLogin from './_routes/admin/login.js';
import adminLogout from './_routes/admin/logout.js';
import adminMessages from './_routes/admin/messages.js';
import adminSession from './_routes/admin/session.js';
import adminUsers from './_routes/admin/users.js';

// Uma única Serverless Function para todo o /api: o plano Hobby da Vercel
// limita o deployment a 12 funções, e cada arquivo solto em /api vira uma.
const routes = new Map([
  ['/api/ai-insight', aiInsight],
  ['/api/ai-meal-image', aiMealImage],
  ['/api/appointments', appointments],
  ['/api/articles', articles],
  ['/api/health', health],
  ['/api/messages', messages],
  ['/api/admin/appointments', adminAppointments],
  ['/api/admin/articles', adminArticles],
  ['/api/admin/insights', adminInsights],
  ['/api/admin/login', adminLogin],
  ['/api/admin/logout', adminLogout],
  ['/api/admin/messages', adminMessages],
  ['/api/admin/session', adminSession],
  ['/api/admin/users', adminUsers],
]);

function requestPath(request) {
  const candidates = [
    request.url,
    request.headers?.['x-forwarded-uri'],
    request.headers?.['x-original-url'],
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const pathname = new URL(candidate, 'http://localhost').pathname.replace(/\/+$/, '');
    if (pathname.startsWith('/api/') && pathname !== '/api/index') return pathname;
  }
  const route = new URL(request.url || '/', 'http://localhost').searchParams.get('route');
  return route ? `/api/${route.replace(/^\/+|\/+$/g, '')}` : '';
}

export default async function handler(request, response) {
  const route = routes.get(requestPath(request));
  if (!route) return sendJson(response, 404, { message: 'Endpoint não encontrado.' });
  return route(request, response);
}
