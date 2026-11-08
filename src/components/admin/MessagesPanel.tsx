import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { AdminApiError, adminApi } from '../../lib/adminApi';
import { formatDateTime } from '../../lib/schedule';

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
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadList = async () => {
    setListError('');
    try {
      const data = await adminApi<{ conversations: Conversation[] }>('/api/admin/messages');
      setConversations(data.conversations || []);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        setListError('Sua sessão expirou. Entre novamente.');
        return;
      }
      setListError(error instanceof Error ? error.message : 'Não foi possível carregar as conversas.');
    } finally {
      setListLoading(false);
    }
  };

  const loadThread = async (userId: string, options: { silent?: boolean } = {}) => {
    if (!options.silent) setThreadLoading(true);
    setThreadError('');
    try {
      const data = await adminApi<{ messages: ChatMessage[]; user: FocusUser; unreadFromUser: number }>(
        `/api/admin/messages?userId=${encodeURIComponent(userId)}`,
      );
      setMessages(data.messages || []);
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
      if (!options.silent) {
        setThreadError(error instanceof Error ? error.message : 'Não foi possível carregar a conversa.');
      }
    } finally {
      if (!options.silent) setThreadLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadList();
    }, 25000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!focusUser) return;
    setSelected(focusUser);
    void loadThread(focusUser.id);
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

  const handleSend = async () => {
    const body = text.trim();
    if (!body || !selected?.id || sending) return;
    setSending(true);
    try {
      const result = await adminApi<{ message: ChatMessage }>('/api/admin/messages', {
        method: 'POST',
        body: JSON.stringify({ userId: selected.id, body }),
      });
      setMessages((current) => [...current, result.message]);
      setText('');
      toast('Mensagem enviada.', 'success');
      void loadList();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className={`${selected ? 'hidden lg:flex' : 'flex'} flex-col rounded-3xl border border-line bg-white p-4 shadow-sm`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="label-sm text-accent">Conversas</p>
            <h2 className="font-display text-lg font-semibold text-ink">Mensagens</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadList()}
            aria-label="Atualizar conversas"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink/50 transition hover:bg-paper"
          >
            <RefreshCw size={13} className={listLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-ink/45">
          Para iniciar uma conversa nova, abra um paciente em <strong className="text-ink/60">Usuários</strong> e toque em Mensagem.
        </p>

        <div className="chat-scroll mt-3 max-h-[62vh] space-y-1.5 overflow-y-auto pr-0.5">
          {listLoading && (
            <div className="flex items-center gap-2 p-3 text-xs font-semibold text-ink/45">
              <Loader2 size={14} className="animate-spin text-accent" /> Carregando conversas...
            </div>
          )}

          {!listLoading && listError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-[11px] font-semibold text-red-600">
              <p className="flex items-center gap-1.5"><AlertTriangle size={13} /> {listError}</p>
              <button type="button" onClick={() => void loadList()} className="mt-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-bold text-red-700 transition hover:bg-red-100">
                Tentar novamente
              </button>
            </div>
          )}

          {!listLoading && !listError && !conversations.length && (
            <div className="rounded-2xl border border-dashed border-line bg-paper/50 p-5 text-center">
              <MessageCircle size={22} className="mx-auto text-ink/25" />
              <p className="mt-2 text-xs font-bold text-ink/60">Nenhuma conversa ainda</p>
              <p className="mt-1 text-[10px] text-ink/40">Envie a primeira mensagem pela aba de usuários.</p>
            </div>
          )}

          {conversations.map((conversation) => {
            const isActive = selected?.id === conversation.userId;
            return (
              <button
                key={conversation.userId}
                type="button"
                onClick={() => {
                  setSelected({ id: conversation.userId, name: conversation.name, email: conversation.email });
                  void loadThread(conversation.userId);
                }}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  isActive ? 'border-accent/40 bg-accent/10' : 'border-line bg-white hover:bg-paper/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{conversation.name || 'Paciente'}</p>
                    <p className="truncate text-[10px] text-ink/45">{conversation.email || 'Sem e-mail'}</p>
                  </div>
                  {conversation.unreadFromUser > 0 && (
                    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-paper">
                      {conversation.unreadFromUser}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-ink/55">
                  {conversation.lastSender === 'nutritionist' ? 'Você: ' : ''}{conversation.lastMessage}
                </p>
                <p className="mt-1 text-[9px] font-semibold text-ink/35">{formatDateTime(conversation.lastAt)}</p>
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
            <p className="max-w-xs text-xs leading-relaxed text-ink/45">
              As mensagens são privadas entre você e cada paciente. Elas aparecem no app assim que forem enviadas.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-line bg-paper/50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setMessages([]);
                  }}
                  aria-label="Voltar para conversas"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink/50 transition hover:bg-white lg:hidden"
                >
                  <ArrowLeft size={14} />
                </button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <UserIcon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{selected.name || 'Paciente'}</p>
                  <p className="truncate text-[10px] text-ink/45">{selected.email || 'Sem e-mail'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {onOpenInsights && (
                  <button
                    type="button"
                    onClick={() => onOpenInsights(selected.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[10px] font-bold text-accent transition hover:bg-accent/5"
                  >
                    <Sparkles size={12} /> Insights
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void loadThread(selected.id)}
                  aria-label="Atualizar conversa"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink/50 transition hover:bg-white"
                >
                  <RefreshCw size={13} className={threadLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="chat-scroll flex-1 space-y-2.5 overflow-y-auto bg-paper/30 px-4 py-4" style={{ maxHeight: '56vh', minHeight: 280 }}>
              {threadLoading && !messages.length && (
                <p className="flex items-center gap-2 text-xs font-semibold text-ink/45">
                  <Loader2 size={14} className="animate-spin text-accent" /> Abrindo a conversa...
                </p>
              )}
              {threadError && (
                <p className="rounded-xl border border-red-100 bg-red-50 p-2.5 text-[11px] font-semibold text-red-600">{threadError}</p>
              )}
              {!threadLoading && !threadError && !messages.length && (
                <div className="rounded-2xl border border-dashed border-line bg-white/70 p-5 text-center text-xs text-ink/45">
                  Nenhuma mensagem por aqui ainda. Comece com um acolhimento e uma pergunta aberta.
                </div>
              )}
              {messages.map((message) => {
                const mine = message.sender === 'nutritionist';
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                      mine ? 'rounded-br-md bg-accent text-paper' : 'rounded-bl-md border border-line bg-white text-ink/80'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={`mt-1 text-[9px] font-semibold ${mine ? 'text-paper/70' : 'text-ink/35'}`}>
                        {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-line bg-white p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value.slice(0, 2000))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={2}
                  maxLength={2000}
                  placeholder="Escreva com acolhimento. Enter envia, Shift+Enter quebra a linha."
                  className="min-h-[46px] flex-1 resize-none rounded-2xl border border-line bg-paper px-3.5 py-2.5 text-xs text-ink outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !text.trim()}
                  aria-label="Enviar mensagem"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-paper shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <p className="mt-1 text-right text-[9px] font-semibold text-ink/30">{text.length}/2000</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
