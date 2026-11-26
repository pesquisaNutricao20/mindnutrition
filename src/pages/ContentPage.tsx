import { useEffect, useState } from 'react';
import { CheckCircle2, Library, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { StateView } from '../components/ui/StateView';
import { DEFAULT_LIBRARY_ARTICLES, getReadingDuration } from '../data/library';
import { DEFAULT_RECIPES, recipeToArticle } from '../data/recipes';
import type { Page } from '../types';

export function ContentPageComponent({
  onSelectArticle,
  onNavigate,
  readArticleIds,
}: {
  onSelectArticle: (article: any) => void;
  onNavigate: (page: Page) => void;
  readArticleIds: string[];
}) {
  const [articles, setArticles] = useState<any[]>(() => [...DEFAULT_LIBRARY_ARTICLES]);
  const [filter, setFilter] = useState<'all' | 'articles' | 'recipes'>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    fetch('/api/articles')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('library unavailable')))
      .then(result => {
        if (!active || !Array.isArray(result?.articles) || !result.articles.length) return;
        const remote = result.articles
          .filter((article: any) => article?.published !== false && article?.title)
          .map((article: any) => ({
            ...article,
            content: Array.isArray(article.content) ? article.content : [],
            contentHtml: typeof article.content_html === 'string' ? article.content_html : '',
            type: article.type || 'Leitura',
            duration: article.duration || getReadingDuration(article),
            sourceLabel: article.source_label || article.sourceLabel,
            sourceUrl: article.source_url || article.sourceUrl,
          }));
        if (remote.length) {
          const remoteIds = new Set(remote.map((article: any) => article.id));
          setArticles([...remote, ...DEFAULT_LIBRARY_ARTICLES.filter(article => !remoteIds.has(article.id))]);
        }
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const articleItems = articles.filter(item => item.type !== 'Receita');
  const recipeItems = [
    ...DEFAULT_RECIPES.map(recipeToArticle),
    ...articles.filter(item => item.type === 'Receita'),
  ];
  const visibleItems = filter === 'recipes' ? recipeItems : filter === 'articles' ? articleItems : [...articleItems, ...recipeItems];

  return (
    <PageContainer hasTopbar={false} className="space-y-6">
      <PageHeader
        title="Biblioteca"
        subtitle="Leituras e receitas para o dia a dia."
        back={{ label: 'Voltar ao dashboard', onClick: () => onNavigate('dashboard') }}
      />

      {loading && <p role="status" className="flex items-center gap-2 text-sm text-ink/60"><Loader2 size={15} className="animate-spin" /> Atualizando a biblioteca...</p>}
      {loadError && articles.length > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-ink/70">Não foi possível atualizar; exibindo biblioteca local.</p>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey(value => value + 1)}>Tentar novamente</Button>
        </div>
      )}

      <div role="group" aria-label="Filtrar biblioteca" className="flex flex-wrap items-center gap-2">
        {([['all', 'Tudo'], ['articles', 'Artigos'], ['recipes', 'Receitas']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`min-h-11 rounded-full px-4 py-2 text-xs font-bold transition ${filter === id ? 'bg-accent text-paper' : 'border border-line bg-white text-ink/60 hover:border-accent'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <StateView
          status={loadError ? 'error' : 'empty'}
          title={loadError ? 'A biblioteca não carregou' : 'Nenhum conteúdo nesta categoria'}
          description={loadError ? 'Verifique sua conexão e tente novamente.' : 'Escolha outra categoria para continuar.'}
          action={loadError ? <Button onClick={() => setReloadKey(value => value + 1)}>Tentar novamente</Button> : <Button onClick={() => onNavigate('dashboard')}>Voltar ao dashboard</Button>}
        />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectArticle(item)}
            className="group text-left bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
          >
            <div className="aspect-[16/10] w-full relative overflow-hidden bg-line">
              <img src={item.image || DEFAULT_RECIPES[0].image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-3 left-3 bg-paper/95 backdrop-blur-md px-3.5 py-1 rounded-full label-sm text-accent">
                {item.type}
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg mb-1 leading-tight">{item.title}</h3>
                <p className="text-xs text-ink/60 line-clamp-2 mb-3 leading-relaxed">{item.summary}</p>
              </div>
              <div className="flex items-center gap-1.5 text-accent text-xs font-bold mt-2">
                <Library size={14} /> {item.duration || getReadingDuration(item)}
              </div>
              {readArticleIds.includes(item.id) && <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs font-bold text-accent"><CheckCircle2 size={12} /> Lido</span>}
            </div>
          </button>
        ))}
      </div>
      )}
    </PageContainer>
  );
}
