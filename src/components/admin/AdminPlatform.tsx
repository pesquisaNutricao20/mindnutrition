import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import iconApp from '../../assets/logo/icon_app.png';
import { AdminApiError, adminApi } from '../../lib/adminApi';
import { RichTextEditor } from './RichTextEditor';
import { AgendaPanel } from './AgendaPanel';
import { MessagesPanel } from './MessagesPanel';
import { UserInsightsPanel } from './UserInsightsPanel';

type ToastKind = 'success' | 'error' | 'info';
type ToastFn = (message: string, kind?: ToastKind) => void;

type AdminStatus = 'checking' | 'login' | 'ready';
type AdminTab = 'overview' | 'users' | 'articles' | 'agenda' | 'messages';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  age: number | null;
  height: number | null;
  imc: number | null;
  weight: number | null;
  gender: string;
  objectives: string[];
  onboardingComplete: boolean;
  notesCount: number;
  sleepCount: number;
  updatedAt: string | null;
  lastActive: string | null;
}

interface AdminStats {
  total: number;
  onboarded: number;
  pending: number;
  withImc: number;
  averageImc: number | null;
  updatedToday: number;
  withEmail: number;
}

interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AdminUsersResponse {
  users: AdminUser[];
  stats: AdminStats;
  pagination: AdminPagination;
  generatedAt: string;
}

interface AdminArticle {
  id: string;
  title: string;
  type?: string;
  summary?: string;
  content?: string[] | string;
  content_html?: string;
  image?: string;
  source_label?: string;
  source_url?: string;
  duration?: string;
  published?: boolean;
  updated_at?: string;
  created_at?: string;
}

interface ArticleDraft {
  id: string | null;
  title: string;
  type: string;
  summary: string;
  contentHtml: string;
  image: string;
  sourceLabel: string;
  sourceUrl: string;
  duration: string;
  published: boolean;
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatRelative = (value?: string | null) => {
  if (!value) return 'Sem atividade';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem atividade';
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 30) return `Há ${diffDays} dias`;
  return formatDate(value);
};

const imcTone = (imc: number | null) => {
  if (!imc) return 'border-line bg-paper text-ink/60';
  if (imc < 18.5) return 'border-sky-200 bg-sky-50 text-sky-700';
  if (imc < 25) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (imc < 30) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
};

const paragraphsToHtml = (paragraphs: string[]) => paragraphs
  .map((paragraph) => String(paragraph || '').trim())
  .filter(Boolean)
  .map((paragraph) => `<p>${paragraph
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</p>`)
  .join('');

const emptyDraft = (): ArticleDraft => ({
  id: null,
  title: '',
  type: 'Leitura',
  summary: '',
  contentHtml: '',
  image: '',
  sourceLabel: '',
  sourceUrl: '',
  duration: '4 min',
  published: true,
});

const draftFromArticle = (article: AdminArticle): ArticleDraft => ({
  id: article.id,
  title: article.title || '',
  type: article.type || 'Leitura',
  summary: article.summary || '',
  contentHtml: article.content_html
    || (Array.isArray(article.content)
      ? paragraphsToHtml(article.content)
      : paragraphsToHtml(String(article.content || '').split(/\n{2,}/))),
  image: article.image || '',
  sourceLabel: article.source_label || '',
  sourceUrl: article.source_url || '',
  duration: article.duration || '4 min',
  published: article.published !== false,
});

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line/50 ${className}`} />;
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="label-sm text-ink/45">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-ink/45">{hint}</p>
    </div>
  );
}

function AdminSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-line bg-white shadow-sm">
          <img src={iconApp} alt="" className="h-12 w-12 object-contain" />
          <span className="absolute -inset-2 rounded-[2.25rem] border border-accent/20" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-xl font-semibold text-ink">Painel Nutricional</p>
          <p className="text-xs font-medium text-ink/50">Verificando acesso seguro...</p>
        </div>
        <div className="h-1 w-36 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/2 animate-[ai-progress-slide_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}

function AdminLoginScreen({
  onAuthenticated,
  onBack,
  toast,
}: {
  onAuthenticated: (expiresAt?: string) => void;
  onBack: () => void;
  toast: ToastFn;
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!password.trim()) {
      setError('Informe a senha administrativa.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const session = await adminApi<{ authorized: boolean; expiresAt?: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setPassword('');
      toast('Acesso administrativo liberado.', 'success');
      onAuthenticated(session?.expiresAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível entrar no painel.';
      setError(message);
      toast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 py-12">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-accent-secondary/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-ink/55 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ArrowLeft size={15} /> Voltar ao site
        </button>

        <div className="rounded-[2.5rem] border border-line bg-white p-7 shadow-xl shadow-accent/5 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
              <img src={iconApp} alt="" className="h-8 w-8 object-contain" />
            </span>
            <div>
              <p className="label-sm text-accent">Área restrita</p>
              <h1 className="font-display text-2xl font-semibold text-ink">Painel Nutricional</h1>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink/60">
            Entre com a senha administrativa para gerenciar pacientes e conteúdos da biblioteca.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-password" className="label-sm mb-1.5 block text-accent">
                Senha administrativa
              </label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError('');
                  }}
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Digite a senha"
                  maxLength={256}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'admin-login-error' : undefined}
                  className="w-full rounded-2xl border border-line bg-paper py-3.5 pl-11 pr-12 text-sm font-medium text-ink outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink/40 transition hover:bg-line/60 hover:text-ink/70"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && (
                <p id="admin-login-error" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-red-600">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-sm font-bold text-paper shadow-md shadow-accent/20 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
              {isSubmitting ? 'Validando acesso...' : 'Entrar no painel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function UsersTable({
  users,
  loading,
  onSelect,
  onMessage,
}: {
  users: AdminUser[];
  loading: boolean;
  onSelect?: (user: AdminUser) => void;
  onMessage?: (user: AdminUser) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center">
        <Users size={28} className="mx-auto text-ink/25" />
        <p className="mt-3 text-sm font-semibold text-ink">Nenhum usuário encontrado</p>
        <p className="mt-1 text-xs text-ink/50">Ajuste a busca ou os filtros aplicados.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_90px_minmax(0,1.4fr)_190px] gap-4 border-b border-line bg-paper/60 px-5 py-3 text-[10px] font-bold text-ink/40 md:grid">
        <span>Paciente</span>
        <span>Perfil</span>
        <span>IMC</span>
        <span>Objetivos</span>
        <span className="text-right">Atividade</span>
      </div>
      <div className="divide-y divide-line/70">
        {users.map((user) => (
          <div
            key={user.id}
            className="grid gap-3 px-4 py-4 transition hover:bg-paper/50 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_90px_minmax(0,1.4fr)_190px] md:items-center md:gap-4 md:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold uppercase text-accent">
                {(user.name || user.email || '?').slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{user.name || 'Sem nome'}</p>
                <p className="truncate text-xs text-ink/50">{user.email || 'Sem e-mail'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink/60 md:block md:space-y-0.5">
              <span>{user.gender || 'Gênero não informado'}</span>
              {user.age ? <span className="md:block">{user.age} anos</span> : null}
              {user.weight ? <span className="md:block">{user.weight} kg</span> : null}
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex min-w-[52px] justify-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${imcTone(user.imc)}`}>
                {user.imc ? user.imc.toFixed(1) : '—'}
              </span>
              <span className={`text-[10px] font-bold md:hidden ${user.onboardingComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
                {user.onboardingComplete ? 'Ativo' : 'Pendente'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {user.objectives.length ? (
                user.objectives.slice(0, 3).map((objective) => (
                  <span key={objective} className="w-fit rounded-full bg-line/50 px-2 py-0.5 text-[10px] font-semibold text-ink/60">
                    {objective}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-ink/35">Sem objetivos</span>
              )}
              {user.objectives.length > 3 && (
                <span className="w-fit rounded-full bg-line/50 px-2 py-0.5 text-[10px] font-semibold text-ink/60">
                  +{user.objectives.length - 3}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
              <span className="hidden rounded-full border px-2 py-0.5 text-[10px] font-bold md:inline-flex"
                style={{ borderColor: user.onboardingComplete ? '#a7f3d0' : '#fde68a', color: user.onboardingComplete ? '#047857' : '#b45309', background: user.onboardingComplete ? '#ecfdf5' : '#fffbeb' }}
              >
                {user.onboardingComplete ? 'Onboarding' : 'Pendente'}
              </span>
              <div className="flex items-center gap-1">
                {onMessage && (
                  <button
                    type="button"
                    onClick={() => onMessage(user)}
                    title={`Enviar mensagem para ${user.name || user.email}`}
                    aria-label={`Enviar mensagem para ${user.name || user.email}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink/50 transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
                  >
                    <MessageCircle size={12} />
                  </button>
                )}
                {onSelect && (
                  <button
                    type="button"
                    onClick={() => onSelect(user)}
                    title={`Ver insights de ${user.name || user.email}`}
                    aria-label={`Ver insights de ${user.name || user.email}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink/50 transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
                  >
                    <Sparkles size={12} />
                  </button>
                )}
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-ink/65">{formatRelative(user.lastActive)}</p>
                <p className="text-[10px] text-ink/35">{formatDate(user.lastActive)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticleEditorModal({
  draft,
  onChange,
  onClose,
  onSave,
  saving,
  error,
}: {
  draft: ArticleDraft;
  onChange: (draft: ArticleDraft) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
}) {
  const inputClass = 'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10';
  const labelClass = 'label-sm mb-1.5 block text-accent';

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <section className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-line bg-paper shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <p className="label-sm text-accent">{draft.id ? 'Editar conteúdo' : 'Novo conteúdo'}</p>
            <h2 className="font-display text-xl font-semibold text-ink">{draft.id ? 'Atualizar artigo' : 'Publicar artigo'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink/50 transition hover:bg-paper disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <label htmlFor="article-title" className={labelClass}>Título</label>
              <input
                id="article-title"
                value={draft.title}
                maxLength={160}
                onChange={(event) => onChange({ ...draft, title: event.target.value })}
                className={inputClass}
                placeholder="Ex.: Como identificar a fome emocional"
              />
            </div>
            <div>
              <label htmlFor="article-type" className={labelClass}>Tipo</label>
              <input
                id="article-type"
                value={draft.type}
                maxLength={60}
                onChange={(event) => onChange({ ...draft, type: event.target.value })}
                className={inputClass}
                placeholder="Leitura, Guia, Exercício"
              />
            </div>
          </div>

          <div>
            <label htmlFor="article-summary" className={labelClass}>Resumo</label>
            <textarea
              id="article-summary"
              value={draft.summary}
              maxLength={600}
              onChange={(event) => onChange({ ...draft, summary: event.target.value })}
              className={`${inputClass} h-20 resize-none`}
              placeholder="Um resumo curto que aparece nos cards da biblioteca."
            />
          </div>

          <div>
            <label className={labelClass}>Conteúdo do artigo</label>
            <RichTextEditor
              key={draft.id || 'new-article'}
              value={draft.contentHtml}
              onChange={(html) => onChange({ ...draft, contentHtml: html })}
            />
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink/40">
              Editor rico: títulos, listas, citações, links e imagens. O texto é publicado na biblioteca exatamente como aparece aqui.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_110px]">
            <div>
              <label htmlFor="article-image" className={labelClass}>Imagem de capa (URL)</label>
              <div className="relative">
                <ImageIcon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  id="article-image"
                  value={draft.image}
                  onChange={(event) => onChange({ ...draft, image: event.target.value })}
                  className={`${inputClass} pl-9`}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <label htmlFor="article-duration" className={labelClass}>Duração</label>
              <div className="relative">
                <Clock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  id="article-duration"
                  value={draft.duration}
                  maxLength={24}
                  onChange={(event) => onChange({ ...draft, duration: event.target.value })}
                  className={`${inputClass} pl-9`}
                  placeholder="4 min"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="article-source-label" className={labelClass}>Fonte</label>
              <input
                id="article-source-label"
                value={draft.sourceLabel}
                maxLength={160}
                onChange={(event) => onChange({ ...draft, sourceLabel: event.target.value })}
                className={inputClass}
                placeholder="Ex.: Sociedade Brasileira de Nutrição"
              />
            </div>
            <div>
              <label htmlFor="article-source-url" className={labelClass}>Link da fonte</label>
              <div className="relative">
                <FileText size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  id="article-source-url"
                  value={draft.sourceUrl}
                  onChange={(event) => onChange({ ...draft, sourceUrl: event.target.value })}
                  className={`${inputClass} pl-9`}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line bg-white px-4 py-3">
            <span>
              <span className="block text-sm font-bold text-ink">Publicado na biblioteca</span>
              <span className="block text-[11px] text-ink/45">Desligue para manter o artigo em rascunho.</span>
            </span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${draft.published ? 'bg-accent' : 'bg-line'}`}>
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(event) => onChange({ ...draft, published: event.target.checked })}
                className="sr-only"
              />
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${draft.published ? 'left-6' : 'left-1'}`} />
            </span>
          </label>

          {error && (
            <p className="flex items-start gap-1.5 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-line px-5 py-2.5 text-xs font-bold text-ink/65 transition hover:bg-paper disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-bold text-paper shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Salvando...' : draft.id ? 'Salvar alterações' : 'Publicar artigo'}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function AdminPlatform({ onExit, toast }: { onExit: () => void; toast: ToastFn }) {
  const [status, setStatus] = useState<AdminStatus>('checking');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');

  const [overview, setOverview] = useState<AdminUsersResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pagination, setPagination] = useState<AdminPagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'onboarded' | 'pending' | 'imc'>('all');
  const [sort, setSort] = useState<'recent' | 'name' | 'imc'>('recent');
  const [page, setPage] = useState(1);

  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState('');
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [articleFormError, setArticleFormError] = useState('');
  const [deletingArticle, setDeletingArticle] = useState<AdminArticle | null>(null);
  const [removingArticle, setRemovingArticle] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [insightsUserId, setInsightsUserId] = useState<string | null>(null);
  const [messagesFocusUser, setMessagesFocusUser] = useState<{ id: string; name: string; email: string } | null>(null);

  const openConversation = (user: { id: string; name: string; email: string }) => {
    setInsightsUserId(null);
    setMessagesFocusUser(user);
    setTab('messages');
  };

  const latestRequest = useRef(0);

  const handleSessionExpired = () => {
    setStatus('login');
    setExpiresAt(null);
    toast('Sua sessão administrativa expirou. Entre novamente.', 'info');
  };

  useEffect(() => {
    let active = true;
    adminApi<{ authorized: boolean; expiresAt?: string }>('/api/admin/session')
      .then((session) => {
        if (!active) return;
        if (session?.authorized) {
          setExpiresAt(session.expiresAt || null);
          setStatus('ready');
        } else {
          setStatus('login');
        }
      })
      .catch(() => {
        if (active) setStatus('login');
      });
    return () => {
      active = false;
    };
  }, []);

  const loadOverview = async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const data = await adminApi<AdminUsersResponse>('/api/admin/users?page=1&pageSize=6&sort=recent');
      setOverview(data);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        handleSessionExpired();
        return;
      }
      setOverviewError(error instanceof Error ? error.message : 'Não foi possível carregar os dados do painel.');
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'ready' && tab === 'overview') void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [query, filter, sort]);

  useEffect(() => {
    if (status !== 'ready' || tab !== 'users') return;
    const requestId = ++latestRequest.current;
    let active = true;
    setUsersLoading(true);
    setUsersError('');

    const params = new URLSearchParams({
      page: String(page),
      pageSize: '20',
      sort,
      filter,
    });
    if (query) params.set('search', query);

    adminApi<AdminUsersResponse>(`/api/admin/users?${params.toString()}`)
      .then((data) => {
        if (!active || requestId !== latestRequest.current) return;
        setUsers(data.users || []);
        setStats(data.stats || null);
        setPagination(data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 });
      })
      .catch((error) => {
        if (!active || requestId !== latestRequest.current) return;
        if (error instanceof AdminApiError && error.status === 401) {
          handleSessionExpired();
          return;
        }
        setUsersError(error instanceof Error ? error.message : 'Não foi possível carregar os usuários.');
      })
      .finally(() => {
        if (active && requestId === latestRequest.current) setUsersLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tab, page, sort, filter, query, reloadToken]);

  const loadArticles = async () => {
    setArticlesLoading(true);
    setArticlesError('');
    try {
      const data = await adminApi<{ articles: AdminArticle[] }>('/api/admin/articles');
      setArticles(data.articles || []);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        handleSessionExpired();
        return;
      }
      setArticlesError(error instanceof Error ? error.message : 'Não foi possível carregar os artigos.');
    } finally {
      setArticlesLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'ready' && tab === 'articles') void loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tab]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await adminApi('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão no servidor.', 'error');
      setLoggingOut(false);
      return;
    }
    setStatus('login');
    setExpiresAt(null);
    setOverview(null);
    setUsers([]);
    setStats(null);
    setArticles([]);
    setTab('overview');
    toast('Sessão encerrada com segurança.', 'success');
    setLoggingOut(false);
  };

  const handleSaveArticle = async () => {
    if (!draft || savingArticle) return;
    setSavingArticle(true);
    setArticleFormError('');
    try {
      const body = {
        ...(draft.id ? { id: draft.id } : {}),
        title: draft.title.trim(),
        type: draft.type.trim() || 'Leitura',
        summary: draft.summary.trim(),
        contentHtml: draft.contentHtml,
        image: draft.image.trim(),
        sourceLabel: draft.sourceLabel.trim(),
        sourceUrl: draft.sourceUrl.trim(),
        duration: draft.duration.trim() || '4 min',
        published: draft.published,
      };
      await adminApi('/api/admin/articles', {
        method: draft.id ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      toast(draft.id ? 'Artigo atualizado.' : 'Artigo publicado.', 'success');
      setDraft(null);
      await loadArticles();
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        handleSessionExpired();
        return;
      }
      setArticleFormError(error instanceof Error ? error.message : 'Não foi possível salvar o artigo.');
    } finally {
      setSavingArticle(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!deletingArticle || removingArticle) return;
    setRemovingArticle(true);
    try {
      await adminApi(`/api/admin/articles?id=${encodeURIComponent(deletingArticle.id)}`, { method: 'DELETE' });
      toast('Artigo removido.', 'success');
      setDeletingArticle(null);
      await loadArticles();
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        handleSessionExpired();
        return;
      }
      toast(error instanceof Error ? error.message : 'Não foi possível remover o artigo.', 'error');
    } finally {
      setRemovingArticle(false);
    }
  };

  const sessionLabel = useMemo(() => {
    if (!expiresAt) return null;
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }, [expiresAt]);

  if (status === 'checking') return <AdminSplash />;

  if (status === 'login') {
    return (
      <AdminLoginScreen
        toast={toast}
        onBack={onExit}
        onAuthenticated={(value) => {
          setExpiresAt(value || null);
          setStatus('ready');
        }}
      />
    );
  }

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={15} /> },
    { id: 'agenda', label: 'Agenda', icon: <CalendarDays size={15} /> },
    { id: 'messages', label: 'Mensagens', icon: <MessageCircle size={15} /> },
    { id: 'users', label: 'Usuários', icon: <Users size={15} /> },
    { id: 'articles', label: 'Artigos', icon: <BookOpen size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-paper pb-16">
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10">
                <img src={iconApp} alt="" className="h-7 w-7 object-contain" />
              </span>
              <div>
                <p className="label-sm text-accent">Área administrativa</p>
                <h1 className="font-display text-lg font-semibold leading-tight text-ink">Painel Nutricional</h1>
              </div>
            </div>
            <div className="flex items-center gap-1 md:hidden">
              <button
                type="button"
                onClick={onExit}
                aria-label="Voltar ao site"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink/55 transition hover:bg-paper"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair do painel"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-red-500 transition hover:bg-red-50"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={tab === item.id}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  tab === item.id
                    ? 'bg-accent text-paper shadow-sm shadow-accent/20'
                    : 'border border-line bg-white text-ink/60 hover:bg-paper'
                }`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {sessionLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[10px] font-bold text-ink/50">
                <Clock size={12} /> Sessão até {sessionLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onExit}
              className="rounded-full border border-line px-3.5 py-2 text-[11px] font-bold text-ink/55 transition hover:bg-paper"
            >
              Ver site
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-100 px-3.5 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={13} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-8">
        {tab === 'overview' && (
          <div className="space-y-6">
            {overviewError ? (
              <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                  <AlertTriangle size={17} /> {overviewError}
                </p>
                <button
                  type="button"
                  onClick={loadOverview}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                >
                  <RefreshCw size={13} /> Tentar novamente
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {overviewLoading || !overview ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="rounded-3xl border border-line bg-white p-5">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="mt-4 h-8 w-20" />
                        <Skeleton className="mt-2 h-2.5 w-28" />
                      </div>
                    ))
                  ) : (
                    <>
                      <StatCard
                        label="Pacientes"
                        value={overview.stats.total}
                        hint={`${overview.stats.withEmail} com e-mail válido`}
                        icon={<Users size={17} />}
                      />
                      <StatCard
                        label="Onboarding completo"
                        value={`${overview.stats.onboarded}`}
                        hint={`${overview.stats.pending} perfis pendentes`}
                        icon={<UserCheck size={17} />}
                      />
                      <StatCard
                        label="Ativos hoje"
                        value={overview.stats.updatedToday}
                        hint="Atualizados nas últimas 24h"
                        icon={<Activity size={17} />}
                      />
                      <StatCard
                        label="IMC médio"
                        value={overview.stats.averageImc ?? '—'}
                        hint={`${overview.stats.withImc} pacientes com IMC`}
                        icon={<TrendingUp size={17} />}
                      />
                    </>
                  )}
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                  <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="label-sm text-accent">Últimas atividades</p>
                        <h2 className="font-display text-xl font-semibold text-ink">Pacientes recentes</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab('users')}
                        className="text-[11px] font-bold text-accent transition hover:opacity-70"
                      >
                        Ver todos
                      </button>
                    </div>
                    <div className="mt-4">
                      <UsersTable
                        users={overview?.users || []}
                        loading={overviewLoading}
                        onSelect={(user) => setInsightsUserId(user.id)}
                        onMessage={(user) => openConversation({ id: user.id, name: user.name, email: user.email })}
                      />
                    </div>
                  </section>

                  <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
                    <p className="label-sm text-accent">Resumo clínico</p>
                    <h2 className="font-display text-xl font-semibold text-ink">Distribuição dos perfis</h2>
                    <div className="mt-4 space-y-3">
                      {[
                        { label: 'Onboarding concluído', value: overview?.stats.onboarded || 0, tone: 'bg-emerald-500' },
                        { label: 'Aguardando onboarding', value: overview?.stats.pending || 0, tone: 'bg-amber-500' },
                        { label: 'Com IMC registrado', value: overview?.stats.withImc || 0, tone: 'bg-accent' },
                        { label: 'Com e-mail válido', value: overview?.stats.withEmail || 0, tone: 'bg-sky-500' },
                      ].map((item) => {
                        const total = Math.max(overview?.stats.total || 0, 1);
                        const width = Math.min(100, Math.round((item.value / total) * 100));
                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between text-[11px] font-semibold text-ink/60">
                              <span>{item.label}</span>
                              <span>{item.value}</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line/50">
                              {overviewLoading ? (
                                <Skeleton className="h-full w-2/3 rounded-full" />
                              ) : (
                                <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${width}%` }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-paper/70 p-3">
                      <ShieldCheck size={15} className="shrink-0 text-accent" />
                      <p className="text-[10px] leading-relaxed text-ink/45">
                        Dados carregados pelo servidor com chave de serviço. Nenhuma credencial fica exposta no navegador.
                      </p>
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'agenda' && (
          <AgendaPanel
            toast={toast}
            onOpenInsights={(userId) => setInsightsUserId(userId)}
            onOpenChat={openConversation}
          />
        )}

        {tab === 'messages' && (
          <MessagesPanel
            toast={toast}
            focusUser={messagesFocusUser}
            onFocusHandled={() => setMessagesFocusUser(null)}
            onOpenInsights={(userId) => setInsightsUserId(userId)}
          />
        )}

        {tab === 'users' && (
          <div className="space-y-4">
            {stats && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Total', value: stats.total },
                  { label: 'Onboarding', value: stats.onboarded },
                  { label: 'Pendentes', value: stats.pending },
                  { label: 'IMC médio', value: stats.averageImc ?? '—' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-line bg-white px-4 py-3">
                    <p className="text-[10px] font-bold text-ink/40">{item.label}</p>
                    <p className="mt-0.5 font-display text-xl font-semibold text-ink">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome ou e-mail"
                    aria-label="Buscar pacientes"
                    className="w-full rounded-full border border-line bg-paper py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'onboarded', label: 'Ativos' },
                    { id: 'pending', label: 'Pendentes' },
                    { id: 'imc', label: 'Com IMC' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id as typeof filter)}
                      aria-pressed={filter === item.id}
                      className={`rounded-full px-3.5 py-2 text-[11px] font-bold transition ${
                        filter === item.id ? 'bg-accent/10 text-accent' : 'border border-line text-ink/55 hover:bg-paper'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as typeof sort)}
                    aria-label="Ordenar pacientes"
                    className="rounded-full border border-line bg-white px-3 py-2 text-[11px] font-bold text-ink/65 outline-none focus:border-accent"
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="name">Nome A-Z</option>
                    <option value="imc">Maior IMC</option>
                  </select>
                </div>
              </div>
            </div>

            {usersError ? (
              <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                  <AlertTriangle size={17} /> {usersError}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadToken((current) => current + 1)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                >
                  <RefreshCw size={13} /> Recarregar
                </button>
              </div>
            ) : (
              <UsersTable
                users={users}
                loading={usersLoading}
                onSelect={(user) => setInsightsUserId(user.id)}
                onMessage={(user) => openConversation({ id: user.id, name: user.name, email: user.email })}
              />
            )}

            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-[11px] font-medium text-ink/50">
                {pagination.total
                  ? `Mostrando ${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} de ${pagination.total}`
                  : 'Nenhum resultado'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={pagination.page <= 1 || usersLoading}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3.5 py-2 text-[11px] font-bold text-ink/60 transition hover:bg-paper disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                  disabled={pagination.page >= pagination.totalPages || usersLoading}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3.5 py-2 text-[11px] font-bold text-ink/60 transition hover:bg-paper disabled:opacity-40"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'articles' && (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-white p-4 sm:flex-row sm:items-center">
              <div>
                <p className="label-sm text-accent">Biblioteca</p>
                <h2 className="font-display text-xl font-semibold text-ink">Conteúdos publicados</h2>
                <p className="mt-0.5 text-[11px] text-ink/45">
                  {articles.length} artigo{articles.length === 1 ? '' : 's'} no servidor
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadArticles}
                  disabled={articlesLoading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2.5 text-[11px] font-bold text-ink/60 transition hover:bg-paper disabled:opacity-50"
                >
                  <RefreshCw size={13} className={articlesLoading ? 'animate-spin' : ''} /> Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setArticleFormError('');
                    setDraft(emptyDraft());
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[11px] font-bold text-paper shadow-sm transition hover:bg-accent/90"
                >
                  <Plus size={14} /> Novo artigo
                </button>
              </div>
            </div>

            {articlesError ? (
              <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                  <AlertTriangle size={17} /> {articlesError}
                </p>
                <button
                  type="button"
                  onClick={loadArticles}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                >
                  <RefreshCw size={13} /> Tentar novamente
                </button>
              </div>
            ) : articlesLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-3xl border border-line bg-white">
                    <Skeleton className="aspect-[16/10] rounded-none" />
                    <div className="space-y-2 p-4">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-2.5 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line bg-white p-12 text-center">
                <BookOpen size={30} className="mx-auto text-ink/25" />
                <p className="mt-3 text-sm font-semibold text-ink">Nenhum artigo cadastrado</p>
                <p className="mt-1 text-xs text-ink/50">Crie o primeiro conteúdo da biblioteca.</p>
                <button
                  type="button"
                  onClick={() => {
                    setArticleFormError('');
                    setDraft(emptyDraft());
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-paper"
                >
                  <Plus size={14} /> Criar artigo
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {articles.map((article) => (
                  <article key={article.id} className="flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
                    <div className="relative aspect-[16/10] bg-gradient-to-br from-accent/15 to-accent-secondary/15">
                      {article.image ? (
                        <img src={article.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen size={28} className="text-accent/50" />
                        </div>
                      )}
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-accent backdrop-blur">
                          {article.type || 'Leitura'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur ${
                          article.published === false ? 'bg-amber-100/95 text-amber-700' : 'bg-emerald-100/95 text-emerald-700'
                        }`}>
                          {article.published === false ? 'Rascunho' : 'Publicado'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-ink">{article.title}</h3>
                      <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-ink/50">{article.summary}</p>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-ink/40">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} /> {article.duration || '4 min'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={11} /> {formatDate(article.updated_at || article.created_at)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setArticleFormError('');
                            setDraft(draftFromArticle(article));
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line py-2 text-[11px] font-bold text-accent transition hover:bg-accent/5"
                        >
                          <Edit2 size={12} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingArticle(article)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-red-100 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={12} /> Excluir
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {draft && (
        <ArticleEditorModal
          draft={draft}
          onChange={setDraft}
          onClose={() => {
            if (!savingArticle) {
              setDraft(null);
              setArticleFormError('');
            }
          }}
          onSave={handleSaveArticle}
          saving={savingArticle}
          error={articleFormError}
        />
      )}

      {insightsUserId && (
        <UserInsightsPanel
          userId={insightsUserId}
          onClose={() => setInsightsUserId(null)}
          onOpenChat={openConversation}
        />
      )}

      {deletingArticle && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => !removingArticle && setDeletingArticle(null)} />
          <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-red-100 bg-paper p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 size={19} />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-ink">Excluir artigo?</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              "{deletingArticle.title}" será removido da biblioteca. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeletingArticle(null)}
                disabled={removingArticle}
                className="rounded-full border border-line px-4 py-2.5 text-xs font-bold text-ink/60 transition hover:bg-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteArticle}
                disabled={removingArticle}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {removingArticle ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
