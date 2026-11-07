const ALLOWED_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'hr', 'div',
]);

const DANGEROUS_BLOCKS = /<(script|style|iframe|object|embed|form|svg|math|template|noscript)[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_SINGLE = /<(script|style|iframe|object|embed|form|input|button|link|meta|base|svg|math)[^>]*\/?>/gi;

const ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify']);

const isHttpUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const escapeAttribute = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const readAttribute = (attributes, name) => {
  const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes || '');
  if (!match) return '';
  return match[2] ?? match[3] ?? match[4] ?? '';
};

/**
 * Whitelist sanitizer: only known formatting tags survive, every attribute is
 * dropped except a validated href/src on links and images. The editor is the
 * only producer of this HTML, so the goal is defense in depth.
 */
export function sanitizeArticleHtml(input) {
  if (typeof input !== 'string') return '';
  let html = input.slice(0, 80000);
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(DANGEROUS_BLOCKS, '');
  html = html.replace(DANGEROUS_SINGLE, '');

  html = html.replace(/<\/?([a-zA-Z0-9]+)(\s(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/g, (match, rawTag, rawAttributes) => {
    const tag = String(rawTag || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    const isClosing = /^<\//.test(match);
    if (isClosing) return `</${tag}>`;

    if (tag === 'a') {
      const href = readAttribute(rawAttributes, 'href').trim();
      if (!isHttpUrl(href)) return '';
      return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer noopener">`;
    }

    if (['p', 'h1', 'h2', 'h3', 'h4'].includes(tag)) {
      const style = readAttribute(rawAttributes, 'style');
      const match = /text-align\s*:\s*(left|center|right|justify)/i.exec(style || '');
      const align = match ? match[1].toLowerCase() : '';
      return ALIGN_VALUES.has(align) ? `<${tag} style="text-align:${align}">` : `<${tag}>`;
    }

    if (tag === 'img') {
      const src = readAttribute(rawAttributes, 'src').trim();
      if (!isHttpUrl(src)) return '';
      const alt = readAttribute(rawAttributes, 'alt').trim().slice(0, 180);
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy">`;
    }

    return `<${tag}>`;
  });

  // Um link com href inválido tem a abertura removida; aqui removemos o
  // fechamento órfão para não deixar HTML malformado.
  let anchorDepth = 0;
  html = html.replace(/<a\b[^>]*>|<\/a\s*>/gi, (match) => {
    if (/^<\/a/i.test(match)) {
      if (anchorDepth === 0) return '';
      anchorDepth -= 1;
      return match;
    }
    anchorDepth += 1;
    return match;
  });

  return html.trim().slice(0, 80000);
}

const decodeEntities = (value) => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_match, code) => {
    const parsed = Number(code);
    return Number.isFinite(parsed) && parsed > 0 && parsed < 0x10ffff ? String.fromCodePoint(parsed) : '';
  });

/** Extrai parágrafos em texto puro do HTML para busca e leitores antigos. */
export function htmlToParagraphs(html, maxParagraphs = 80) {
  if (typeof html !== 'string' || !html.trim()) return [];
  const plain = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|div|ul|ol)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(plain)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .slice(0, maxParagraphs)
    .map((paragraph) => paragraph.slice(0, 6000));
}

/** Converte parágrafos antigos em HTML para abrir artigos legados no editor. */
export function paragraphsToHtml(paragraphs) {
  if (!Array.isArray(paragraphs)) return '';
  return paragraphs
    .map((paragraph) => String(paragraph || '').trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</p>`)
    .join('');
}
