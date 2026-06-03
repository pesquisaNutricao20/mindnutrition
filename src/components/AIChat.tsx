import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BsFlower1 } from 'react-icons/bs';
import { useToast } from './Toast';

// ---------- TypewriterText (local copy) ----------
function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i < text.length) {
      const t = setTimeout(() => { setDisplayed(p => p + text[i]); setI(i + 1); }, 22);
      return () => clearTimeout(t);
    } else if (onComplete) onComplete();
  }, [i, text, onComplete]);
  return <span>{displayed}</span>;
}

// ---------- Message Bubble ----------
interface MessageBubbleProps {
  sender: 'user' | 'bot';
  text: string;
  isLatest: boolean;
  isTyping: boolean;
  key?: React.Key;
}

function MessageBubble({ sender, text, isLatest, isTyping }: MessageBubbleProps) {
  const isUser = sender === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex gap-3 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-auto">
          <Bot size={16} className="text-accent" />
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center shrink-0 mt-auto text-xs font-bold text-ink/60">
          Eu
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[78%] px-5 py-4 rounded-3xl text-base font-medium leading-relaxed shadow-sm ${
          isUser
            ? 'bg-accent text-white rounded-br-md'
            : 'bg-white border border-line text-ink rounded-bl-md'
        }`}
        style={isUser ? { background: 'var(--accent)' } : {}}
      >
        {!isUser && isLatest && !isTyping ? (
          <TypewriterText text={text} />
        ) : (
          text
        )}
      </div>
    </motion.div>
  );
}

// ---------- Typing Indicator ----------
function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
        <Bot size={16} className="text-accent" />
      </div>
      <div className="bg-white border border-line rounded-3xl rounded-bl-md px-5 py-4 flex items-center gap-1.5 shadow-sm">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-ink/30"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ---------- Main AIChat Component ----------
interface AIChatProps {
  userName: string;
  onBack: () => void;
}

export function AIChat({ userName, onBack }: AIChatProps) {
  const { toast } = useToast();
  const [msg, setMsg] = useState('');
  const [typing, setTyping] = useState(false);
  const [history, setHistory] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    {
      sender: 'bot',
      text: `Olá ${userName || 'amigo'}! 🌿 Sou a Nutri AI do Serena Nutre. Estou aqui para analisar seus dados e oferecer conselhos gentis sobre sua alimentação. Como posso ajudar hoje?`,
    },
  ]);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, typing]);

  const BOT_REPLIES = [
    'Compreendo como se sente. Nossa oscilação emocional dessa semana mostra que a ansiedade pode ter afetado suas escolhas. Que tal tentarmos o exercício de respiração antes da próxima refeição? 🌿',
    'Baseado no seu padrão alimentar, percebo que você tende a buscar alimentos mais calóricos quando está sob estresse. Isso é muito comum. Vamos trabalhar isso juntos?',
    'Seus dados mostram uma evolução positiva! Continue registrando suas refeições com atenção às emoções antes e depois de comer. Isso é o coração da alimentação consciente. 💚',
    'Uma dica gentil: antes de comer, feche os olhos por 5 segundos e pergunte-se "de 0 a 10, qual é minha fome física agora?". Essa pausa pode transformar sua relação com a comida.',
  ];

  const handleSend = () => {
    if (!msg.trim() || typing) return;
    const userMessage = msg.trim();
    setHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
    setMsg('');
    setTyping(true);
    inputRef.current?.focus();

    setTimeout(() => {
      setTyping(false);
      const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
      setHistory(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 2000 + Math.random() * 1000);
  };

  const QUICK_REPLIES = ['Como estou me saindo?', 'Dica de hoje', 'Análise da semana', 'Exercício de respiração'];

  return (
    <div
      className="flex flex-col h-[100dvh] w-full max-w-4xl mx-auto"
      style={{ background: 'linear-gradient(180deg, var(--paper) 0%, #eef6f3 100%)' }}
    >
      {/* Header */}
      <header className="px-4 md:px-8 pt-4 pb-4 flex items-center gap-3 border-b border-line shrink-0 bg-paper/95 backdrop-blur-md z-20 shadow-sm">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors bg-white"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
              <Bot size={20} className="text-accent" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-paper" />
          </div>
          <div>
            <h2 className="font-bold text-base text-ink leading-tight">Nutri AI</h2>
            <p className="text-[11px] text-green-500 font-semibold">Online agora</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          IA Ativa
        </div>
      </header>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4 pb-6">
        {history.map((h, i) => (
          <MessageBubble
            key={i}
            sender={h.sender}
            text={h.text}
            isLatest={i === history.length - 1}
            isTyping={typing}
          />
        ))}
        {typing && <TypingIndicator />}
      </div>

      {/* Quick Replies */}
      <div className="px-4 md:px-8 pb-3 flex gap-2 overflow-x-auto scrollbar-none shrink-0">
        {QUICK_REPLIES.map(qr => (
          <button
            key={qr}
            onClick={() => { setMsg(qr); inputRef.current?.focus(); }}
            className="shrink-0 px-4 py-2 bg-white border border-line rounded-full text-xs font-semibold text-ink hover:border-accent hover:bg-accent/5 transition-all whitespace-nowrap shadow-sm"
          >
            {qr}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 md:px-8 py-3 pb-safe bg-paper/95 backdrop-blur-md border-t border-line">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Escreva sua mensagem..."
            className="flex-1 py-3.5 px-5 bg-white border border-line rounded-2xl shadow-sm focus:border-accent focus:outline-none text-base font-medium resize-none transition-all"
          />
          <motion.button
            onClick={handleSend}
            disabled={!msg.trim() || typing}
            whileTap={{ scale: 0.92 }}
            className="w-12 h-12 bg-accent text-white rounded-2xl flex items-center justify-center disabled:opacity-40 hover:bg-accent/90 transition-all shadow-lg shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            <Send size={18} className="translate-x-0.5" />
          </motion.button>
        </div>
        <p className="text-center text-[10px] text-ink/30 mt-2 font-medium">
          Serena Nutre AI • Respostas baseadas no seu perfil
        </p>
      </div>
    </div>
  );
}
