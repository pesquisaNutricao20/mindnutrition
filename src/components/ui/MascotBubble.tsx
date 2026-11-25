import { useEffect, useState } from 'react';
import { Check, Send, Sparkles, X } from 'lucide-react';
import mascoteEyesOpen from '../../assets/mascote_eyes_open.png';
import mascoteEyesClosed from '../../assets/mascote_eyes_closed.png';
import type { UserProfile } from '../../types';

interface MascotBubbleProps {
  userProfile: UserProfile;
  onMoodShared: (mood: string) => void;
}

const quickMoods = ['Calmo(a)', 'Alegre', 'Ansioso(a)', 'Cansado(a)', 'Estressado(a)'];

export const MascotBubble = ({ userProfile, onMoodShared }: MascotBubbleProps) => {
  const [moodInputOpen, setMoodInputOpen] = useState(false);
  const [currentMood, setCurrentMood] = useState('');
  const [pendingMood, setPendingMood] = useState<string | null>(null);
  const [eyesOpen, setEyesOpen] = useState(true);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyesOpen(false);
      setTimeout(() => setEyesOpen(true), 100);
    }, 1800 + Math.random() * 1500);
    return () => clearInterval(blinkInterval);
  }, []);

  // O humor escolhido fica marcado até o fim do dia: deriva do checkIn de hoje.
  const todayLabel = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const todaysMood = [...(userProfile.checkIns || [])]
    .reverse()
    .find((entry) => entry.date === todayLabel)?.mood || '';

  const confirmMood = () => {
    const mood = (pendingMood || '').trim();
    if (mood) onMoodShared(mood);
    setPendingMood(null);
    setMoodInputOpen(false);
    setCurrentMood('');
  };

  const firstName = (userProfile.name || 'você').trim().split(/\s+/)[0];

  return (
    <div className="bg-accent/10 border border-accent/20 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden group">
      <div className="flex flex-col items-start gap-4 relative z-10 sm:flex-row sm:items-center sm:gap-6">
        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-inner shrink-0 overflow-hidden sm:w-24 sm:h-24">
          <img
            src={eyesOpen ? mascoteEyesOpen : mascoteEyesClosed}
            alt="Mascote Mind Nutrition"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="w-full flex-1">
          <div className="flex items-center gap-2">
            <h4 className="label-sm text-accent">Mascote Nutri</h4>
            <Sparkles size={13} className="text-accent" />
          </div>
          <p className="serif-body text-xl text-ink mt-1">
            "Oi, {firstName}! Como você está se sentindo hoje?"
          </p>
          {todaysMood && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-[11px] font-bold text-accent">
              <Check size={12} /> Hoje: {todaysMood}
            </span>
          )}
          {!moodInputOpen ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {quickMoods.map((m) => {
                const marked = todaysMood === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPendingMood(m)}
                    aria-pressed={marked}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors shadow-2xs border ${marked ? 'bg-accent text-paper border-accent' : 'bg-white text-ink/75 border-line hover:border-accent hover:bg-accent/10 hover:text-accent'}`}
                  >
                    {m}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setMoodInputOpen(true)}
                className="text-xs font-bold bg-accent text-paper px-3.5 py-1.5 rounded-full hover:bg-accent/90 transition-colors shadow-xs"
              >
                Escrever outro...
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={currentMood}
                onChange={(e) => setCurrentMood(e.target.value)}
                placeholder="Como você está agora?"
                className="min-w-0 flex-1 px-4 py-2 text-sm rounded-full border border-line focus:border-accent focus:bg-white focus:outline-none"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && currentMood.trim()) setPendingMood(currentMood.trim()); }}
              />
              <button
                type="button"
                onClick={() => { if (currentMood.trim()) setPendingMood(currentMood.trim()); }}
                className="bg-accent text-paper p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-accent/90 shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {pendingMood && (
        <div className="modal-shell fixed inset-0 z-50 flex">
          <div className="modal-backdrop absolute inset-0" onClick={() => setPendingMood(null)} />
          <div className="modal-panel relative w-full md:max-w-sm bg-paper shadow-2xl border border-line z-10 self-center mx-auto rounded-[2rem] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="label-sm text-accent">Mascote Nutri</span>
                <h3 className="font-display text-2xl mt-1">Confirmar humor</h3>
              </div>
              <button type="button" onClick={() => setPendingMood(null)} className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-ink/50 hover:bg-white" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink/70">
              Registrar <b>“{pendingMood}”</b> como o que você está sentindo hoje? A seleção fica marcada até o fim do dia e você pode trocar quando quiser.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setPendingMood(null)} className="flex-1 py-3.5 rounded-full border border-line text-sm font-bold text-ink/60 hover:bg-white">Cancelar</button>
              <button type="button" onClick={confirmMood} className="flex-1 py-3.5 rounded-full bg-accent text-paper text-sm font-bold shadow-md hover:bg-accent/90">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
