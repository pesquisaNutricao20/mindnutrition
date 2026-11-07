import './api/_lib/env.js';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySecurityHeaders } from './api/_lib/http.js';
import aiInsight from './api/_routes/ai-insight.js';
import aiMealImage from './api/_routes/ai-meal-image.js';
import articles from './api/_routes/articles.js';
import adminLogin from './api/_routes/admin/login.js';
import adminLogout from './api/_routes/admin/logout.js';
import adminSession from './api/_routes/admin/session.js';
import adminUsers from './api/_routes/admin/users.js';
import adminArticles from './api/_routes/admin/articles.js';
import adminAppointments from './api/_routes/admin/appointments.js';
import adminMessages from './api/_routes/admin/messages.js';
import adminInsights from './api/_routes/admin/insights.js';
import messages from './api/_routes/messages.js';
import appointments from './api/_routes/appointments.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.use((_request, response, next) => {
  applySecurityHeaders(response);
  if (isProduction) {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        'upgrade-insecure-requests',
      ].join('; '),
    );
  }
  next();
});

// Corpo maior apenas para a análise de imagem; o handler valida tipo e tamanho.
app.use('/api/ai-meal-image', express.json({ limit: '8mb' }));
app.use('/api', express.json({ limit: '1mb' }));

const route = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response)).catch(next);
};

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    ai: Boolean(process.env.GROQ_API_KEY),
    admin: Boolean(process.env.ADMIN_KEY_HASH || process.env.ADMIN_KEY),
    supabaseAdmin: Boolean((process.env.SUPABASE_URL || process.env.VITE_PUBLICSUPABASE_URL) && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)),
  });
});

app.post('/api/ai-insight', route(aiInsight));
app.post('/api/ai-meal-image', route(aiMealImage));
app.get('/api/articles', route(articles));
app.all('/api/messages', route(messages));
app.all('/api/appointments', route(appointments));

app.post('/api/admin/login', route(adminLogin));
app.post('/api/admin/logout', route(adminLogout));
app.get('/api/admin/session', route(adminSession));
app.get('/api/admin/users', route(adminUsers));
app.all('/api/admin/articles', route(adminArticles));
app.all('/api/admin/appointments', route(adminAppointments));
app.all('/api/admin/messages', route(adminMessages));
app.get('/api/admin/insights', route(adminInsights));

app.use('/api', (_request, response) => response.status(404).json({ message: 'Endpoint não encontrado.' }));

app.use(express.static(path.join(rootDirectory, 'dist'), {
  setHeaders: (response, filePath) => {
    if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
      response.setHeader('Cache-Control', 'no-cache');
    } else if (/assets[\/]/.test(filePath)) {
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

app.get('*', (_request, response) => {
  response.setHeader('Cache-Control', 'no-cache');
  response.sendFile(path.join(rootDirectory, 'dist', 'index.html'));
});

app.use((error, _request, response, _next) => {
  console.error('[server]', error);
  if (response.headersSent) return;
  response.status(500).json({ message: 'Erro interno no servidor.' });
});

app.listen(port, () => {
  console.log(`Mind Nutrition disponível em http://localhost:${port}`);
});
