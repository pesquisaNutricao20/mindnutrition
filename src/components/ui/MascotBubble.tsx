import { useId, useRef, useState } from 'react';
import { Check, Send, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { FlyingMascotSprite } from './FlyingMascotSprite';
import { Overlay } from './Overlay';
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
  const moodInputId = useId();
  const cancelMoodButtonRef = useRef<HTMLButtonElement>(null);
  const moodInputTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreMoodInputTriggerRef = useRef(false);

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
    if (restoreMoodInputTriggerRef.current) {
      window.requestAnimationFrame(() => moodInputTriggerRef.current?.focus());
    }
    restoreMoodInputTriggerRef.current = false;
  };

  const submitMoodInput = () => {
    const mood = currentMood.trim();
    if (!mood) return;
    restoreMoodInputTriggerRef.current = true;
    setPendingMood(mood);
  };

  const firstName = (userProfile.name || 'você').trim().split(/\s+/)[0];

  return (
    <div className="bg-accent/10 border border-accent/20 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden group">
      <div className="flex flex-col items-start gap-4 relative z-10 sm:flex-row sm:items-center sm:gap-6">
        <div className="h-20 w-20 shrink-0 sm:h-24 sm:w-24">
          <FlyingMascotSprite alt="Mascote Nutri" animation="idle" className="h-full w-full" />
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
                    className={`inline-flex min-h-11 min-w-11 items-center justify-center text-xs font-bold px-3 py-1.5 rounded-full transition-colors shadow-2xs border ${marked ? 'bg-accent text-paper border-accent' : 'bg-white text-ink/75 border-line hover:border-accent hover:bg-accent/10 hover:text-accent'}`}
                  >
                    {m}
                  </button>
                );
              })}
              <button
                ref={moodInputTriggerRef}
                type="button"
                onClick={() => setMoodInputOpen(true)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-xs font-bold bg-accent text-paper px-3.5 py-1.5 rounded-full hover:bg-accent/90 transition-colors shadow-xs"
              >
                Escrever outro...
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <label htmlFor={moodInputId} className="sr-only">Como você está se sentindo hoje?</label>
              <input
                id={moodInputId}
                type="text"
                value={currentMood}
                onChange={(e) => setCurrentMood(e.target.value)}
                placeholder="Como você está agora?"
                className="min-h-11 min-w-0 flex-1 px-4 py-2 text-sm rounded-full border border-line focus:border-accent focus:bg-white focus:outline-none"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') submitMoodInput(); }}
              />
              <button
                type="button"
                onClick={submitMoodInput}
                aria-label="Enviar humor"
                className="bg-accent text-paper p-2 w-11 h-11 min-h-11 min-w-11 flex items-center justify-center rounded-full hover:bg-accent/90 shrink-0"
              >
                <Send size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      <Overlay
        open={Boolean(pendingMood)}
        onClose={() => setPendingMood(null)}
        title={(
          <>
            <span className="label-sm block text-accent">Mascote Nutri</span>
            <span className="mt-1 block font-display text-2xl font-normal normal-case">Confirmar humor</span>
          </>
        )}
        description={(
          <span className="text-ink/70">
            Registrar <b>“{pendingMood}”</b> como o que você está sentindo hoje? A seleção fica marcada até o fim do dia e você pode trocar quando quiser.
          </span>
        )}
        size="sm"
        initialFocusRef={cancelMoodButtonRef}
      >
        <div className="grid grid-cols-2 gap-3">
          <Button ref={cancelMoodButtonRef} variant="secondary" fullWidth onClick={() => setPendingMood(null)}>
            Cancelar
          </Button>
          <Button fullWidth onClick={confirmMood}>
            Confirmar
          </Button>
        </div>
      </Overlay>
    </div>
  );
};
