import { requireAdmin } from '../../_lib/admin.js';
import { htmlToParagraphs, sanitizeArticleHtml } from '../../_lib/articleContent.js';
import {
  HttpError,
  assertSameOrigin,
  handleApiError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from '../../_lib/http.js';
import { isSupabaseAdminConfigured, supabaseAdminRequest } from '../../_lib/supabaseAdmin.js';

const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const isHttpUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

function normalizeContent(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\n{2,}/)
      : [];
  return items
    .map((item) => clean(item, 6000))
    .filter(Boolean)
    .slice(0, 40);
}

function normalizeArticle(input, { partial = false } = {}) {
  const article = {};

  const assign = (key, value) => {
    if (partial && input[key] === undefined) return;
    article[key] = value;
  };

  assign('title', clean(input.title, 160));
  assign('type', clean(input.type, 60) || 'Leitura');
  assign('summary', clean(input.summary, 600));
  assign('image', clean(input.image, 800));
  assign('source_label', clean(input.sourceLabel ?? input.source_label, 160));
  assign('source_url', clean(input.sourceUrl ?? input.source_url, 800));
  assign('duration', clean(input.duration, 24));
  assign('published', input.published === undefined ? true : Boolean(input.published));

  // O editor rico envia HTML; guardamos o HTML saneado e também os parágrafos
  // em texto puro, que alimentam a busca e a leitura de artigos antigos.
  const htmlSource = input.contentHtml ?? input.content_html;
  if (htmlSource !== undefined) {
    const html = sanitizeArticleHtml(htmlSource);
    article.content_html = html;
    article.content = htmlToParagraphs(html);
  } else if (!partial || input.content !== undefined) {
    article.content = normalizeContent(input.content);
    article.content_html = '';
  }

  if (!partial || input.title !== undefined) {
    if (article.title.length < 3) throw new HttpError(400, 'Informe um título com pelo menos 3 caracteres.');
  }
  if (!partial || input.summary !== undefined) {
    if (article.summary.length < 10) throw new HttpError(400, 'Escreva um resumo com pelo menos 10 caracteres.');
  }
  if (!isHttpUrl(article.image)) throw new HttpError(400, 'A imagem deve ser uma URL http(s) válida.');
  if (!isHttpUrl(article.source_url)) throw new HttpError(400, 'A fonte deve ser uma URL http(s) válida.');
  if ((!partial || htmlSource !== undefined || input.content !== undefined) && !article.content?.length) {
    throw new HttpError(400, 'Escreva pelo menos um parágrafo de conteúdo.');
  }
  if (!article.duration) article.duration = '4 min';

  article.updated_at = new Date().toISOString();
  return article;
}

export default async function handler(request, response) {
  if (!requireAdmin(request, response)) return;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
    return methodNotAllowed(response, 'GET, POST, PUT, DELETE');
  }

  try {
    assertSameOrigin(request);
    if (!isSupabaseAdminConfigured()) {
      throw new HttpError(503, 'O Supabase ainda não está configurado no servidor para gerenciar artigos.');
    }

    if (request.method === 'GET') {
      const rows = await supabaseAdminRequest('/rest/v1/articles', {
        query: { select: '*', order: 'updated_at.desc', limit: 300 },
      });
      return sendJson(response, 200, { articles: Array.isArray(rows) ? rows : [] });
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request, 512 * 1024);
      const article = normalizeArticle(body);
      const rows = await supabaseAdminRequest('/rest/v1/articles', {
        method: 'POST',
        body: article,
        headers: { Prefer: 'return=representation' },
      });
      return sendJson(response, 201, { article: Array.isArray(rows) ? rows[0] : rows });
    }

    if (request.method === 'PUT') {
      const body = await readJsonBody(request, 512 * 1024);
      const id = clean(body?.id, 64);
      if (!id) throw new HttpError(400, 'Informe o artigo a ser atualizado.');
      const article = normalizeArticle(body, { partial: true });
      const rows = await supabaseAdminRequest('/rest/v1/articles', {
        method: 'PATCH',
        query: { id: `eq.${id}` },
        body: article,
        headers: { Prefer: 'return=representation' },
      });
      if (!Array.isArray(rows) || !rows.length) throw new HttpError(404, 'Artigo não encontrado.');
      return sendJson(response, 200, { article: rows[0] });
    }

    const url = new URL(request.url || '/', 'http://localhost');
    const id = clean(url.searchParams.get('id'), 64);
    if (!id) throw new HttpError(400, 'Informe o artigo a ser removido.');
    await supabaseAdminRequest('/rest/v1/articles', {
      method: 'DELETE',
      query: { id: `eq.${id}` },
    });
    return sendJson(response, 200, { deleted: true });
  } catch (error) {
    return handleApiError(response, error, 'Não foi possível concluir a operação com artigos.');
  }
}
