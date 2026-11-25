import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { AdminApiError, adminApi } from '../../lib/adminApi';
import { formatDateTime } from '../../lib/schedule';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Skeleton } from '../ui/Skeleton';
import { StateView } from '../ui/StateView';

type Conversation = {
  userId: string;
  name: string;
  email: string;
  lastMessage: string;
  lastSender: 'user' | 'nutritionist';
  lastAt: string | null;
  unreadFromUser: number;
  messageCount: number;
};

type ChatMessage = {
  id: string;
  userId: string;
  sender: 'user' | 'nutritionist';
  body: string;
  createdAt: string | null;
  readAt: string | null;
};

type FocusUser = { id: string; name: string; email: string };

export function MessagesPanel({
  toast,
  focusUser,
  onFocusHandled,
  onOpenInsights,
}: {
  toast: (message: string, kind?: 'success' | 'error' | 'info') => void;
  focusUser?: FocusUser | null;
  onFocusHandled?: () => void;
  onOpenInsights?: (userId: string) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<FocusUser | null>(focusUser || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listRequestRef = useRef(0);
  const threadRequestRef = useRef(0);
  const sendingRef = useRef(false);
  const selectedIdRef = useRef<string | null>(selected?.id || null);
  const text = selected?.id ? drafts[selected.id] || '' : '';

  const loadList = async (options: { silent?: boolean } = {}) => {
    const requestId = ++listRequestRef.current;
    if (!options.silent) setListLoading(true);
    setListError('');
    try {
      const data = await adminApi<{ conversations: Conversation[] }>('/api/admin/messages');
      if (requestId !== listRequestRef.current) return;
      setConversations(data.conversations || []);
    } catch (error) {
      if (requestId !== listRequestRef.current) return;
      if (error instanceof AdminApiError && error.status === 401) {
        setListError('Sua sessão expirou. Entre novamente.');
        return;
      }
      setListError(error instanceof Error ? error.message : 'Não foi possível carregar as conversas.');
    } finally {
      if (requestId === listRequestRef.current) setListLoading(false);
    }
  };

  const loadThread = async (userId: string, options: { silent?: boolean } = {}) => {
    const requestId = ++threadRequestRef.current;
    if (!options.silent) setThreadLoading(true);
    setThreadError('');
    try {
      const data = await adminApi<{ messages: ChatMessage[]; user: FocusUser; unreadFromUser: number }>(
        `/api/admin/messages?userId=${encodeURIComponent(userId)}`,
      );
      if (requestId !== threadRequestRef.current || selectedIdRef.current !== userId) return;
      setMessages(data.messages || []);
      selectedIdRef.current = data.user?.id || userId;
      setSelected({ id: data.user?.id || userId, name: data.user?.name || '', email: data.user?.email || '' });
      if (data.unreadFromUser > 0) {
        await adminApi('/api/admin/messages', {
          method: 'PUT',
          body: JSON.stringify({ userId }),
        }).catch(() => undefined);
        setConversations((current) => current.map((item) => (
          item.userId === userId ? { ...item, unreadFromUser: 0 } : item
        )));
      }
    } catch (error) {
      if (!options.silent && requestId === threadRequestRef.current && selectedIdRef.current === userId) {
        setThreadError(error instanceof Error ? error.message : 'Não foi possível carregar a conversa.');
      }
    } finally {
      if (!options.silent && requestId === threadRequestRef.current) setThreadLoading(false);
    }
  };

  const selectConversation = (user: FocusUser) => {
    if (sendingRef.current) return;
    selectedIdRef.current = user.id;
    setSelected(user);
    setMessages([]);
    setThreadError('');
    setSendError('');
    void loadThread(user.id);
  };

  useEffect(() => {
    void loadList();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadList({ silent: true });
    }, 25000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!focusUser) return;
    selectConversation(focusUser);
    void loadList();
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusUser?.id]);

  useEffect(() => {
    if (!selected?.id) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadThread(selected.id, { silent: true });
    }, 9000);
    return () => window.clearInterval(timer);
  }, [selected?.id]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const updateDraft = (value: string) => {
    const userId = selected?.id;
    if (!userId || sendingRef.current) return;
    setDrafts((current) => ({ ...current, [userId]: value.slice(0, 2000) }));
    if (sendError) setSendError('');
  };

  const handleSend = async () => {
    const userId = selected?.id;
    const body = (userId ? drafts[userId] || '' : '').trim();
    if (!body || !userId || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    setAnnouncement('Enviando mensagem.');
    try {
      const result = await adminApi<{ message: ChatMessage }>('/api/admin/messages', {
        method: 'POST',
        body: JSON.stringify({ userId, body }),
      });
      threadRequestRef.current += 1;
      if (selectedIdRef.current === userId) {
        setMessages((current) => current.some((message) => message.id === result.message.id)
          ? current
          : [...current, result.message]);
        setAnnouncement('Mensagem enviada.');
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
      toast('Mensagem enviada.', 'success');
      void loadList({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
      setSendError(message);
      setAnnouncement(`Não foi possível enviar a mensagem. ${message}`);
      toast(message, 'error');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const closeConversation = () => {
    if (sendingRef.current) return;
    selectedIdRef.current = null;
    threadRequestRef.current += 1;
    setSelected(null);
    setMessages([]);
    setThreadError('');
    setSendError('');
    setAnnouncement('');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
      <section className={`${selected ? 'hidden lg:flex' : 'flex'} flex-col rounded-3xl border border-line bg-white p-4 shadow-sm`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-outfit text-xs font-semibold text-accent">Conversas</p>
            <h2 className="font-display text-lg font-semibold text-ink">Mensagens</h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-11 w-11 px-0"
            onClick={() => void loadList()}
            disabled={listLoading}
            aria-label="Atualizar conversas"
          >
            <RefreshCw size={16} className={listLoading ? 'animate-spin' : ''} aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-ink/50">
          Para iniciar uma conversa nova, abra um paciente em <strong className="text-ink/60">Usuários</strong> e toque em Mensagem.
        </p>

        <div className="chat-scroll mt-3 max-h-[62vh] space-y-1.5 overflow-y-auto pr-0.5">
          {listLoading && Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2.5 w-2/3" />
                </div>
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-2.5 w-full" />
              <Skeleton className="mt-1.5 h-2 w-24" />
            </div>
          ))}

          {!listLoading && listError && (
            <StateView
              status="error"
              compact
              title="Não foi possível carregar as conversas"
              description={listError}
              action={(
                <Button variant="secondary" size="sm" onClick={() => void loadList()}>
                  <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
                </Button>
              )}
            />
          )}

          {!listLoading && !listError && !conversations.length && (
            <StateView
              status="empty"
              compact
              title="Nenhuma conversa ainda"
              description="Envie a primeira mensagem pela aba de usuários."
            />
          )}

          {conversations.map((conversation) => {
            const isActive = selected?.id === conversation.userId;
            return (
              <button
                key={conversation.userId}
                type="button"
                onClick={() => selectConversation({ id: conversation.userId, name: conversation.name, email: conversation.email })}
                disabled={sending}
                aria-pressed={isActive}
                className={`w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive ? 'border-accent/40 bg-accent/10' : 'border-line bg-white hover:bg-paper/60'
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">{conversation.name || 'Paciente'}</span>
                    <span className="block truncate text-xs text-ink/50">{conversation.email || 'Sem e-mail'}</span>
                  </span>
                  {conversation.unreadFromUser > 0 && (
                    <span className="rounded-full bg-accent px-2 py-1 text-xs font-bold text-paper">
                      {conversation.unreadFromUser}
                    </span>
                  )}
                </span>
                <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink/55">
                  {conversation.lastSender === 'nutritionist' ? 'Você: ' : ''}{conversation.lastMessage}
                </span>
                <span className="mt-2 block text-xs font-semibold text-ink/45">{formatDateTime(conversation.lastAt)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`${selected ? 'flex' : 'hidden lg:flex'} min-h-[60vh] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-sm`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <MessageCircle size={24} />
            </span>
            <p className="text-sm font-bold text-ink">Selecione uma conversa</p>
            <p className="max-w-xs text-sm leading-relaxed text-ink/50">
              As mensagens são privadas entre você e cada paciente. Elas aparecem no app assim que forem enviadas.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-line bg-paper/50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-11 w-11 shrink-0 px-0 lg:hidden"
                  onClick={closeConversation}
                  disabled={sending}
                  aria-label="Voltar para conversas"
                >
                  <ArrowLeft size={17} aria-hidden="true" />
                </Button>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <UserIcon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{selected.name || 'Paciente'}</p>
                  <p className="truncate text-xs text-ink/50">{selected.email || 'Sem e-mail'}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onOpenInsights && (
                  <Button variant="secondary" size="sm" onClick={() => onOpenInsights(selected.id)}>
                    <Sparkles size={14} aria-hidden="true" /> Insights
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-11 w-11 px-0"
                  onClick={() => void loadThread(selected.id)}
                  disabled={threadLoading}
                  aria-label="Atualizar conversa"
                >
                  <RefreshCw size={16} className={threadLoading ? 'animate-spin' : ''} aria-hidden="true" />
                </Button>
              </div>
            </header>

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-atomic="false"
              aria-label={`Mensagens com ${selected.name || 'paciente'}`}
              className="chat-scroll flex-1 space-y-2.5 overflow-y-auto bg-paper/30 px-4 py-4"
              style={{ maxHeight: '56vh', minHeight: 280 }}
            >
              {threadLoading && !messages.length && [0, 1, 2, 3].map((index) => (
                <div key={index} className={`flex ${index % 2 ? 'justify-end' : 'justify-start'}`}>
                  <Skeleton className={`h-16 max-w-[85%] rounded-2xl ${index % 2 ? 'w-2/3 rounded-br-md' : 'w-3/4 rounded-bl-md'}`} />
                </div>
              ))}
              {threadError && (
                <StateView
                  status="error"
                  compact
                  title="Não foi possível carregar a conversa"
                  description={threadError}
                  action={(
                    <Button variant="secondary" size="sm" onClick={() => void loadThread(selected.id)}>
                      <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
                    </Button>
                  )}
                />
              )}
              {!threadLoading && !threadError && !messages.length && (
                <StateView
                  status="empty"
                  compact
                  title="Nenhuma mensagem por aqui ainda"
                  description="Comece com um acolhimento e uma pergunta aberta."
                />
              )}
              {messages.map((message) => {
                const mine = message.sender === 'nutritionist';
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                      mine ? 'rounded-br-md bg-accent text-paper' : 'rounded-bl-md border border-line bg-white text-ink/80'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={`mt-1 text-xs font-semibold ${mine ? 'text-paper/75' : 'text-ink/45'}`}>
                        {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-line bg-white p-3">
              <div className="flex items-end gap-2">
                <FormField
                  className="min-w-0 flex-1"
                  label="Mensagem"
                  htmlFor={`admin-message-${selected.id}`}
                  hint="Enter envia. Shift+Enter quebra a linha."
                  error={sendError}
                >
                  <textarea
                    value={text}
                    onChange={(event) => updateDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey && !sendingRef.current) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    rows={3}
                    maxLength={2000}
                    disabled={sending}
                    placeholder="Escreva com acolhimento"
                    className="min-h-[96px] w-full resize-none rounded-2xl border border-line bg-paper px-3.5 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
                  />
                </FormField>
                <Button
                  className="h-12 w-12 shrink-0 px-0"
                  onClick={() => void handleSend()}
                  disabled={!text.trim()}
                  loading={sending}
                  aria-label={sendError ? 'Tentar enviar mensagem novamente' : 'Enviar mensagem'}
                >
                  {sending ? <span className="sr-only">Enviando mensagem</span> : <Send size={18} aria-hidden="true" />}
                </Button>
              </div>
              <p className="mt-1 text-right text-xs font-semibold text-ink/45">{text.length}/2000</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
