import type { Page } from '../types';

export interface AppRoute {
  page: Page;
  path: string;
  mealId?: string;
  recognized: boolean;
}

const PAGE_PATHS: Partial<Record<Page, string>> = {
  landing: '/',
  auth: '/entrar',
  diagnosis: '/diagnostico',
  dashboard: '/painel',
  'meal-log': '/refeicoes/registrar',
  content: '/biblioteca',
  messages: '/cuidado',
  progress: '/progresso',
  challenge: '/desafio',
  profile: '/perfil',
  'settings-account': '/configuracoes/conta',
  'settings-privacy': '/configuracoes/privacidade',
  'settings-help': '/configuracoes/ajuda',
  'admin-dashboard': '/nutricionista',
};

const PATH_PAGES = new Map<string, Page>();
for (const [page, path] of Object.entries(PAGE_PATHS)) {
  if (path && !PATH_PAGES.has(path)) PATH_PAGES.set(path, page as Page);
}

export function getPagePath(page: Page, mealId?: string): string {
  if (page.startsWith('admin-')) return '/nutricionista';
  if (page === 'meal-details') {
    return mealId ? `/refeicoes/${encodeURIComponent(mealId)}` : '/painel';
  }
  return PAGE_PATHS[page] || '/';
}

export function parseRoute(pathname: string): AppRoute {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const page = PATH_PAGES.get(normalizedPath);
  if (page) return { page, path: getPagePath(page), recognized: true };

  const mealMatch = normalizedPath.match(/^\/refeicoes\/([^/]+)$/);
  if (mealMatch) {
    let mealId = mealMatch[1];
    try {
      mealId = decodeURIComponent(mealId);
    } catch {
      // O identificador permanece literal quando a URL está malformada.
    }
    return {
      page: 'meal-details',
      path: `/refeicoes/${encodeURIComponent(mealId)}`,
      mealId,
      recognized: true,
    };
  }

  return { page: 'landing', path: '/', recognized: false };
}
