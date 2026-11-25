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
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Sprout,
  UserCheck,
  Users,
} from 'lucide-react';
import iconApp from '../../assets/logo/icon_app.png';
import { AdminApiError, adminApi } from '../../lib/adminApi';
import { STATUS_TONES } from '../../lib/schedule';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Overlay } from '../ui/Overlay';
import { StateView } from '../ui/StateView';
import { RichTextEditor } from './RichTextEditor';
import { AgendaPanel } from './AgendaPanel';
import { MessagesPanel } from './MessagesPanel';
import { UserInsightsPanel } from './UserInsightsPanel';
import { Skeleton } from '../ui/Skeleton';

type ToastKind = 'success' | 'error' | 'info';
type ToastFn = (message: string, kind?: ToastKind) => void;

type AdminStatus = 'checking' | 'login' | 'ready';
type AdminTab = 'overview' | 'users' | 'articles' | 'agenda' | 'messages' | 'challenge';

const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={17} /> },
  { id: 'agenda', label: 'Agenda', icon: <CalendarDays size={17} /> },
  { id: 'messages', label: 'Mensagens', icon: <MessageCircle size={17} /> },
  { id: 'users', label: 'Usuários', icon: <Users size={17} /> },
  { id: 'challenge', label: 'Desafio', icon: <Sprout size={17} /> },
  { id: 'articles', label: 'Artigos', icon: <BookOpen size={17} /> },
];

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
  challenge?: {
    startedAt: string | null;
    days: number;
    completed: number;
    points: number;
    lastDate: string | null;
  } | null;
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
  if (imc < 18.5) return STATUS_TONES.completed;
  if (imc < 25) return STATUS_TONES.confirmed;
  if (imc < 30) return STATUS_TONES.pending;
  return STATUS_TONES.declined;
};

const imcCategory = (imc: number | null) => {
  if (!imc) return 'IMC não informado';
  if (imc < 18.5) return 'IMC abaixo de 18,5';
  if (imc < 25) return 'IMC entre 18,5 e 24,9';
  if (imc < 30) return 'IMC entre 25 e 29,9';
  return 'IMC a partir de 30';
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
        <span className="font-outfit text-xs font-semibold text-ink/50">{label}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium text-ink/50">{hint}</p>
    </div>
  );
}

function AdminSplash() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-line bg-white shadow-sm">
          <img src={iconApp} alt="" className="h-12 w-12 object-contain" />
          <span className="absolute -inset-2 rounded-[2.25rem] border border-accent/20" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-xl font-semibold text-ink">Painel Nutricional</p>
          <p className="text-sm font-medium text-ink/55">Verificando acesso seguro...</p>
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
  const submittingRef = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!password.trim()) {
      setError('Informe a senha administrativa.');
      return;
    }

    submittingRef.current = true;
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
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 py-12">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-accent/5" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-accent-secondary/5" />

      <div className="relative w-full max-w-md">
        <Button variant="ghost" size="sm" className="mb-5" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao site
        </Button>

        <div className="rounded-[2.5rem] border border-line bg-white p-6 shadow-xl shadow-accent/5 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
              <img src={iconApp} alt="" className="h-8 w-8 object-contain" />
            </span>
            <div>
              <p className="font-outfit text-xs font-semibold text-accent">Área restrita</p>
              <h1 className="font-display text-2xl font-semibold text-ink">Painel Nutricional</h1>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink/60">
            Entre com a senha administrativa para gerenciar pacientes e conteúdos da biblioteca.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <FormField label="Senha administrativa" htmlFor="admin-password" error={error}>
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
                className="min-h-12 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base font-medium text-ink outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
              />
            </FormField>
            <Button
              variant="ghost"
              size="sm"
              className="-mt-2"
              onClick={() => setShowPassword((current) => !current)}
              disabled={isSubmitting}
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            </Button>

            <Button type="submit" fullWidth loading={isSubmitting}>
              <ShieldCheck size={17} aria-hidden="true" /> {isSubmitting ? 'Validando acesso...' : 'Entrar no painel'}
            </Button>
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
      <div role="status" aria-label="Carregando usuários" className="space-y-2">
        <span className="sr-only">Carregando usuários.</span>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-11 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!users.length) {
    return (
      <StateView
        status="empty"
        title="Nenhum usuário encontrado"
        description="Ajuste a busca ou os filtros aplicados."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_90px_minmax(0,1.4fr)_210px] gap-4 border-b border-line bg-paper/60 px-5 py-3 text-xs font-bold text-ink/45 md:grid">
        <span>Paciente</span>
        <span>Perfil</span>
        <span>IMC</span>
        <span>Objetivos</span>
        <span className="text-right">Atividade</span>
      </div>
      <div className="divide-y divide-line/70">
        {users.map((user) => (
          <article
            key={user.id}
            className="grid gap-3 px-4 py-4 transition hover:bg-paper/50 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_90px_minmax(0,1.4fr)_210px] md:items-center md:gap-4 md:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold uppercase text-accent">
                {(user.name || user.email || '?').slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{user.name || 'Sem nome'}</p>
                <p className="truncate text-xs text-ink/50">{user.email || 'Sem e-mail'}</p>
              </div>
            </div>

            <div className="text-xs text-ink/60 md:space-y-1">
              <span className="mb-1 block font-semibold text-ink/45 md:hidden">Perfil</span>
              <span className="block">{user.gender || 'Gênero não informado'}</span>
              <span className="block">{user.age ? `${user.age} anos` : 'Idade não informada'}</span>
              <span className="block">{user.weight ? `${user.weight} kg` : 'Peso não informado'}</span>
              <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${user.onboardingComplete ? STATUS_TONES.confirmed : STATUS_TONES.pending}`}>
                {user.onboardingComplete ? 'Onboarding concluído' : 'Onboarding pendente'}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold text-ink/45 md:hidden">IMC</span>
              <span
                className={`inline-flex min-w-[60px] justify-center rounded-full border px-3 py-1.5 text-xs font-bold ${imcTone(user.imc)}`}
                aria-label={user.imc ? `${user.imc.toFixed(1)}. ${imcCategory(user.imc)}` : imcCategory(null)}
              >
                {user.imc ? user.imc.toFixed(1) : '—'}
              </span>
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold text-ink/45 md:hidden">Objetivos</span>
              <div className="flex flex-wrap gap-1.5">
                {user.objectives.length ? (
                  user.objectives.slice(0, 3).map((objective) => (
                    <span key={objective} className="w-fit rounded-full bg-line/50 px-2.5 py-1 text-xs font-semibold text-ink/60">
                      {objective}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-ink/45">Sem objetivos</span>
                )}
                {user.objectives.length > 3 && (
                  <span className="w-fit rounded-full bg-line/50 px-2.5 py-1 text-xs font-semibold text-ink/60">
                    +{user.objectives.length - 3}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
              <div>
                <span className="mb-1 block text-xs font-semibold text-ink/45 md:hidden">Última atividade</span>
                <p className="text-xs font-bold text-ink/65">{formatRelative(user.lastActive)}</p>
                <p className="text-xs text-ink/45">{formatDate(user.lastActive)}</p>
              </div>
              <div className="flex items-center gap-2">
                {onMessage && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-11 w-11 px-0"
                    onClick={() => onMessage(user)}
                    aria-label={`Enviar mensagem para ${user.name || user.email}`}
                    title={`Enviar mensagem para ${user.name || user.email}`}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                  </Button>
                )}
                {onSelect && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-11 w-11 px-0"
                    onClick={() => onSelect(user)}
                    aria-label={`Ver insights de ${user.name || user.email}`}
                    title={`Ver insights de ${user.name || user.email}`}
                  >
                    <Sparkles size={16} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          </article>
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
  onSave: () => void | Promise<void>;
  saving: boolean;
  error: string;
}) {
  const initialDraftRef = useRef(draft);
  const titleRef = useRef<HTMLInputElement>(null);
  const discardCancelRef = useRef<HTMLButtonElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current);
  const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10';

  const requestClose = () => {
    if (saving) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <Overlay
        open
        onClose={requestClose}
        title={draft.id ? 'Editar artigo' : 'Publicar artigo'}
        description="Revise os dados e o conteúdo antes de salvar. Nenhuma alteração é enviada automaticamente."
        size="xl"
        panelClassName="md:max-w-3xl"
        busy={saving}
        initialFocusRef={titleRef}
        bodyClassName="space-y-5"
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void onSave()} loading={saving} disabled={!isDirty}>
              <Check size={15} aria-hidden="true" /> {saving ? 'Salvando...' : draft.id ? 'Salvar alterações' : 'Publicar artigo'}
            </Button>
          </div>
        )}
      >
        <p role="status" aria-live="polite" className={`text-sm font-semibold ${isDirty ? 'text-amber-700' : 'text-ink/50'}`}>
          {saving ? 'Salvando alterações...' : isDirty ? 'Há alterações não salvas.' : 'Nenhuma alteração pendente.'}
        </p>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FormField label="Título" htmlFor="article-title" required hint="Mínimo de 3 caracteres.">
            <input
              ref={titleRef}
              id="article-title"
              value={draft.title}
              maxLength={160}
              required
              disabled={saving}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              className={inputClass}
              placeholder="Ex.: Como identificar a fome emocional"
            />
          </FormField>
          <FormField label="Tipo" htmlFor="article-type">
            <input
              id="article-type"
              list="article-type-options"
              value={draft.type}
              maxLength={60}
              disabled={saving}
              onChange={(event) => onChange({ ...draft, type: event.target.value })}
              className={inputClass}
              placeholder="Leitura, Guia, Receita"
            />
          </FormField>
          <datalist id="article-type-options">
            <option value="Leitura" />
            <option value="Guia" />
            <option value="Exercício" />
            <option value="Receita" />
          </datalist>
        </div>

        <FormField label="Resumo" htmlFor="article-summary" required hint="Mínimo de 10 caracteres. Aparece nos cards da biblioteca.">
          <textarea
            id="article-summary"
            value={draft.summary}
            maxLength={600}
            required
            disabled={saving}
            onChange={(event) => onChange({ ...draft, summary: event.target.value })}
            className={`${inputClass} min-h-24 resize-none`}
            placeholder="Um resumo curto que aparece nos cards da biblioteca."
          />
        </FormField>

        <fieldset className="min-w-0" disabled={saving}>
          <legend className="mb-2 text-sm font-semibold text-ink">Conteúdo do artigo</legend>
          <RichTextEditor
            key={draft.id || 'new-article'}
            value={draft.contentHtml}
            disabled={saving}
            onChange={(html) => onChange({ ...draft, contentHtml: html })}
          />
          <p className="mt-2 text-xs leading-relaxed text-ink/50">
            Use títulos, listas, citações, links e imagens por URL. Ao salvar, o servidor remove tags e URLs inseguras; por isso, a publicação pode ficar diferente do editor.
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FormField label="Imagem de capa (URL)" htmlFor="article-image" optional>
            <input
              id="article-image"
              type="url"
              inputMode="url"
              value={draft.image}
              disabled={saving}
              onChange={(event) => onChange({ ...draft, image: event.target.value })}
              className={inputClass}
              placeholder="https://..."
            />
          </FormField>
          <FormField label="Duração" htmlFor="article-duration">
            <input
              id="article-duration"
              value={draft.duration}
              maxLength={24}
              disabled={saving}
              onChange={(event) => onChange({ ...draft, duration: event.target.value })}
              className={inputClass}
              placeholder="4 min"
            />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Fonte" htmlFor="article-source-label" optional>
            <input
              id="article-source-label"
              value={draft.sourceLabel}
              maxLength={160}
              disabled={saving}
              onChange={(event) => onChange({ ...draft, sourceLabel: event.target.value })}
              className={inputClass}
              placeholder="Ex.: Sociedade Brasileira de Nutrição"
            />
          </FormField>
          <FormField label="Link da fonte" htmlFor="article-source-url" optional>
            <input
              id="article-source-url"
              type="url"
              inputMode="url"
              value={draft.sourceUrl}
              disabled={saving}
              onChange={(event) => onChange({ ...draft, sourceUrl: event.target.value })}
              className={inputClass}
              placeholder="https://..."
            />
          </FormField>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line bg-white px-4 py-3">
          <span>
            <span className="block text-sm font-bold text-ink">Publicado na biblioteca</span>
            <span className="block text-xs text-ink/50">Desmarque para manter o artigo em rascunho.</span>
          </span>
          <input
            type="checkbox"
            checked={draft.published}
            disabled={saving}
            onChange={(event) => onChange({ ...draft, published: event.target.checked })}
            className="h-6 w-6 shrink-0 accent-accent"
          />
        </label>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm font-semibold text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
          </p>
        )}
      </Overlay>

      <Overlay
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Descartar alterações?"
        description="As mudanças neste artigo não foram salvas e serão perdidas."
        size="sm"
        initialFocusRef={discardCancelRef}
        footer={(
          <div className="grid grid-cols-2 gap-3">
            <Button ref={discardCancelRef} variant="secondary" onClick={() => setConfirmDiscard(false)}>Continuar editando</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              Descartar
            </Button>
          </div>
        )}
      >
        <p className="text-sm leading-relaxed text-ink/60">Salve antes de fechar se quiser manter as alterações.</p>
      </Overlay>
    </>
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
  const [deleteError, setDeleteError] = useState('');
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
  const savingArticleRef = useRef(false);
  const removingArticleRef = useRef(false);
  const loggingOutRef = useRef(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

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
    if (status !== 'ready' || (tab !== 'users' && tab !== 'challenge')) return;
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
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);
    try {
      await adminApi('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão no servidor.', 'error');
      loggingOutRef.current = false;
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
    loggingOutRef.current = false;
    setLoggingOut(false);
  };

  const handleSaveArticle = async () => {
    if (!draft || savingArticleRef.current) return;
    savingArticleRef.current = true;
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
      savingArticleRef.current = false;
      setSavingArticle(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!deletingArticle || removingArticleRef.current) return;
    removingArticleRef.current = true;
    setRemovingArticle(true);
    setDeleteError('');
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
      const message = error instanceof Error ? error.message : 'Não foi possível remover o artigo.';
      setDeleteError(message);
      toast(message, 'error');
    } finally {
      removingArticleRef.current = false;
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

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % ADMIN_TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + ADMIN_TABS.length) % ADMIN_TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = ADMIN_TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(ADMIN_TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="min-h-screen w-full bg-paper pb-safe">
      <header className="border-b border-line bg-white">
        <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10">
                <img src={iconApp} alt="" className="h-7 w-7 object-contain" />
              </span>
              <div>
                <p className="font-outfit text-xs font-semibold text-accent">Área administrativa</p>
                <h1 className="font-display text-lg font-semibold leading-tight text-ink">Painel Nutricional</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <Button
                variant="secondary"
                size="sm"
                className="h-11 w-11 px-0"
                onClick={onExit}
                aria-label="Voltar ao site"
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-11 w-11 px-0"
                onClick={handleLogout}
                loading={loggingOut}
                aria-label="Sair do painel"
              >
                {loggingOut ? <span className="sr-only">Saindo</span> : <LogOut size={17} aria-hidden="true" />}
              </Button>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Seções do painel administrativo"
            aria-orientation="horizontal"
            className="flex w-full items-center gap-2 overflow-x-auto pb-1 xl:w-auto xl:flex-1 xl:justify-center"
          >
            {ADMIN_TABS.map((item, index) => (
              <Button
                key={item.id}
                ref={(node) => { tabRefs.current[index] = node; }}
                id={`admin-tab-${item.id}`}
                role="tab"
                variant={tab === item.id ? 'primary' : 'secondary'}
                size="sm"
                className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                aria-selected={tab === item.id}
                aria-controls={`admin-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {item.icon} {item.label}
              </Button>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {sessionLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-2 text-xs font-bold text-ink/50">
                <Clock size={14} aria-hidden="true" /> Sessão até {sessionLabel}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={onExit}>Ver site</Button>
            <Button variant="secondary" size="sm" onClick={handleLogout} loading={loggingOut}>
              <LogOut size={14} aria-hidden="true" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="w-full px-4 pt-6 sm:px-8">
        <div
          id="admin-panel-overview"
          role="tabpanel"
          aria-labelledby="admin-tab-overview"
          hidden={tab !== 'overview'}
          tabIndex={tab === 'overview' ? 0 : -1}
        >
        {tab === 'overview' && (
          <div className="space-y-6">
            {overviewError ? (
              <StateView
                status="error"
                title="Não foi possível carregar o painel"
                description={overviewError}
                action={(
                  <Button variant="secondary" size="sm" onClick={() => void loadOverview()}>
                    <RefreshCw size={15} aria-hidden="true" /> Tentar novamente
                  </Button>
                )}
              />
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
                        <p className="font-outfit text-xs font-semibold text-accent">Últimas atividades</p>
                        <h2 className="font-display text-xl font-semibold text-ink">Pacientes recentes</h2>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTab('users')}>
                        Ver todos <ChevronRight size={15} aria-hidden="true" />
                      </Button>
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
                    <p className="font-outfit text-xs font-semibold text-accent">Resumo clínico</p>
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
                            <div className="flex items-center justify-between text-xs font-semibold text-ink/60">
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
                      <p className="text-xs leading-relaxed text-ink/50">
                        Dados carregados pelo servidor com chave de serviço. Nenhuma credencial fica exposta no navegador.
                      </p>
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        )}
        </div>

        <div
          id="admin-panel-agenda"
          role="tabpanel"
          aria-labelledby="admin-tab-agenda"
          hidden={tab !== 'agenda'}
          tabIndex={tab === 'agenda' ? 0 : -1}
        >
        {tab === 'agenda' && (
          <AgendaPanel
            toast={toast}
            onOpenInsights={(userId) => setInsightsUserId(userId)}
            onOpenChat={openConversation}
          />
        )}
        </div>

        <div
          id="admin-panel-messages"
          role="tabpanel"
          aria-labelledby="admin-tab-messages"
          hidden={tab !== 'messages'}
          tabIndex={tab === 'messages' ? 0 : -1}
        >
        {tab === 'messages' && (
          <MessagesPanel
            toast={toast}
            focusUser={messagesFocusUser}
            onFocusHandled={() => setMessagesFocusUser(null)}
            onOpenInsights={(userId) => setInsightsUserId(userId)}
          />
        )}
        </div>

        <div
          id="admin-panel-users"
          role="tabpanel"
          aria-labelledby="admin-tab-users"
          hidden={tab !== 'users'}
          tabIndex={tab === 'users' ? 0 : -1}
        >
        {tab === 'users' && (
          <div className="space-y-4">
            {stats ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Total', value: stats.total },
                  { label: 'Onboarding', value: stats.onboarded },
                  { label: 'Pendentes', value: stats.pending },
                  { label: 'IMC médio', value: stats.averageImc ?? '—' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-line bg-white px-4 py-3">
                    <p className="text-xs font-bold text-ink/50">{item.label}</p>
                    <p className="mt-0.5 font-display text-xl font-semibold text-ink">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : usersLoading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-line bg-white px-4 py-3">
                    <Skeleton className="h-2.5 w-12" />
                    <Skeleton className="mt-2 h-6 w-10" />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <FormField label="Buscar pacientes" htmlFor="admin-user-search" className="w-full lg:max-w-sm">
                  <input
                    id="admin-user-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Nome ou e-mail"
                    className="min-h-11 w-full rounded-full border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
                  />
                </FormField>

                <div className="flex flex-wrap items-end gap-2">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'onboarded', label: 'Ativos' },
                    { id: 'pending', label: 'Pendentes' },
                    { id: 'imc', label: 'Com IMC' },
                  ].map((item) => (
                    <Button
                      key={item.id}
                      variant="secondary"
                      size="sm"
                      className={filter === item.id ? 'border-accent bg-accent/10 text-accent' : ''}
                      onClick={() => setFilter(item.id as typeof filter)}
                      aria-pressed={filter === item.id}
                    >
                      {item.label}
                    </Button>
                  ))}
                  <FormField label="Ordenar" htmlFor="admin-user-sort" className="w-40">
                    <select
                      id="admin-user-sort"
                      value={sort}
                      onChange={(event) => setSort(event.target.value as typeof sort)}
                      className="min-h-11 w-full rounded-full border border-line bg-white px-3 text-sm font-bold text-ink/65 outline-none focus:border-accent"
                    >
                      <option value="recent">Mais recentes</option>
                      <option value="name">Nome A-Z</option>
                      <option value="imc">Maior IMC</option>
                    </select>
                  </FormField>
                </div>
              </div>
            </div>

            {usersError ? (
              <StateView
                status="error"
                title="Não foi possível carregar os usuários"
                description={usersError}
                action={(
                  <Button variant="secondary" size="sm" onClick={() => setReloadToken((current) => current + 1)}>
                    <RefreshCw size={15} aria-hidden="true" /> Recarregar
                  </Button>
                )}
              />
            ) : (
              <UsersTable
                users={users}
                loading={usersLoading}
                onSelect={(user) => setInsightsUserId(user.id)}
                onMessage={(user) => openConversation({ id: user.id, name: user.name, email: user.email })}
              />
            )}

            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-xs font-medium text-ink/55">
                {pagination.total
                  ? `Mostrando ${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} de ${pagination.total}`
                  : 'Nenhum resultado'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={pagination.page <= 1 || usersLoading}
                >
                  <ChevronLeft size={15} aria-hidden="true" /> Anterior
                </Button>
                <span className="inline-flex min-h-11 items-center rounded-full bg-accent/10 px-3 text-xs font-bold text-accent">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                  disabled={pagination.page >= pagination.totalPages || usersLoading}
                >
                  Próxima <ChevronRight size={15} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>

        <div
          id="admin-panel-challenge"
          role="tabpanel"
          aria-labelledby="admin-tab-challenge"
          hidden={tab !== 'challenge'}
          tabIndex={tab === 'challenge' ? 0 : -1}
        >
        {tab === 'challenge' && (
          <div className="space-y-4">
            <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <p className="font-outfit text-xs font-semibold text-accent">Desafio de 21 dias</p>
              <h2 className="font-display text-xl font-semibold text-ink">Acompanhamento da jornada</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink/55">
                Registros enviados pelo aplicativo. Um dia é concluído com pelo menos 3 das 4 atividades; pontos e conquistas são simbólicos e não avaliam a pessoa.
              </p>

              {usersError ? (
                <div className="mt-4">
                  <StateView
                    status="error"
                    title="Não foi possível carregar o desafio"
                    description={usersError}
                    action={(
                      <Button variant="secondary" size="sm" onClick={() => setReloadToken((current) => current + 1)}>
                        <RefreshCw size={15} aria-hidden="true" /> Tentar novamente
                      </Button>
                    )}
                  />
                </div>
              ) : (
                <>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead className="text-xs uppercase tracking-wide text-ink/50">
                        <tr>
                          <th className="pb-2">Participante</th>
                          <th className="pb-2">Início</th>
                          <th className="pb-2">Registrados</th>
                          <th className="pb-2">Concluídos</th>
                          <th className="pb-2">Sementes</th>
                          <th className="pb-2">Último dia</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {usersLoading ? (
                          Array.from({ length: 5 }).map((_, index) => (
                            <tr key={index} className="border-t border-line/70">
                              {Array.from({ length: 7 }).map((__, cell) => (
                                <td key={cell} className="py-3"><Skeleton className="h-4 w-full" /></td>
                              ))}
                            </tr>
                          ))
                        ) : users.filter((user) => user.challenge).length ? (
                          users.filter((user) => user.challenge).map((user) => (
                            <tr key={user.id} className="border-t border-line/70">
                              <td className="py-2.5 font-bold text-ink">
                                {user.name || user.email || 'Participante'}
                                <span className="block text-xs font-medium text-ink/50">{user.email}</span>
                              </td>
                              <td className="py-2.5 text-ink/60">{formatDate(user.challenge?.startedAt)}</td>
                              <td className="py-2.5 text-ink/60">{user.challenge?.days ?? 0}/21</td>
                              <td className="py-2.5 font-bold text-accent">{user.challenge?.completed ?? 0}</td>
                              <td className="py-2.5 text-ink/60">{user.challenge?.points ?? 0}</td>
                              <td className="py-2.5 text-ink/60">{user.challenge?.lastDate || '—'}</td>
                              <td className="py-2.5">
                                <Button variant="ghost" size="sm" onClick={() => setInsightsUserId(user.id)}>Insights</Button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-3">
                              <StateView status="empty" title="Nenhum participante nesta página" description="Ajuste os filtros ou avance para outra página." compact />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex flex-col items-start justify-between gap-3 text-xs font-bold text-ink/55 sm:flex-row sm:items-center">
                    <span>Página {pagination.page} de {pagination.totalPages}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={pagination.page <= 1 || usersLoading}
                      >Anterior</Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                        disabled={pagination.page >= pagination.totalPages || usersLoading}
                      >Próxima</Button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
        </div>

        <div
          id="admin-panel-articles"
          role="tabpanel"
          aria-labelledby="admin-tab-articles"
          hidden={tab !== 'articles'}
          tabIndex={tab === 'articles' ? 0 : -1}
        >
        {tab === 'articles' && (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-white p-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-outfit text-xs font-semibold text-accent">Biblioteca</p>
                <h2 className="font-display text-xl font-semibold text-ink">Conteúdos publicados</h2>
                <p className="mt-0.5 text-sm text-ink/50">
                  {articles.length} artigo{articles.length === 1 ? '' : 's'} no servidor
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => void loadArticles()} loading={articlesLoading}>
                  <RefreshCw size={15} aria-hidden="true" /> Atualizar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setArticleFormError('');
                    setDraft(emptyDraft());
                  }}
                >
                  <Plus size={15} aria-hidden="true" /> Novo artigo
                </Button>
              </div>
            </div>

            {articlesError ? (
              <StateView
                status="error"
                title="Não foi possível carregar os artigos"
                description={articlesError}
                action={(
                  <Button variant="secondary" size="sm" onClick={() => void loadArticles()}>
                    <RefreshCw size={15} aria-hidden="true" /> Tentar novamente
                  </Button>
                )}
              />
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
              <StateView
                status="empty"
                title="Nenhum artigo cadastrado"
                description="Crie o primeiro conteúdo da biblioteca."
                action={(
                  <Button
                    size="sm"
                    onClick={() => {
                      setArticleFormError('');
                      setDraft(emptyDraft());
                    }}
                  >
                    <Plus size={15} aria-hidden="true" /> Criar artigo
                  </Button>
                )}
              />
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
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-accent">
                          {article.type || 'Leitura'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          article.published === false ? STATUS_TONES.pending : STATUS_TONES.confirmed
                        }`}>
                          {article.published === false ? 'Rascunho' : 'Publicado'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-ink">{article.title}</h3>
                      <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-ink/50">{article.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/50">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} /> {article.duration || '4 min'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={11} /> {formatDate(article.updated_at || article.created_at)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setArticleFormError('');
                            setDraft(draftFromArticle(article));
                          }}
                        >
                          <Edit2 size={15} aria-hidden="true" /> Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setDeleteError('');
                            setDeletingArticle(article);
                          }}
                        >
                          <Trash2 size={15} aria-hidden="true" /> Excluir
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

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
        <Overlay
          open
          onClose={() => {
            if (!removingArticle) {
              setDeletingArticle(null);
              setDeleteError('');
            }
          }}
          title="Excluir artigo?"
          description={`"${deletingArticle.title}" será removido da biblioteca. Essa ação não pode ser desfeita.`}
          size="sm"
          busy={removingArticle}
          initialFocusRef={deleteCancelRef}
          footer={(
            <div className="grid grid-cols-2 gap-3">
              <Button
                ref={deleteCancelRef}
                variant="secondary"
                onClick={() => {
                  setDeletingArticle(null);
                  setDeleteError('');
                }}
                disabled={removingArticle}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => void handleDeleteArticle()} loading={removingArticle}>
                <Trash2 size={15} aria-hidden="true" /> {removingArticle ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          )}
        >
          {deleteError && (
            <StateView status="error" title="Não foi possível excluir" description={deleteError} compact />
          )}
        </Overlay>
      )}
    </div>
  );
}
