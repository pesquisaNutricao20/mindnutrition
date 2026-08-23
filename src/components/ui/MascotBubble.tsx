import { useEffect, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import mascoteEyesOpen from '../../assets/mascote_eyes_open.png';
import mascoteEyesClosed from '../../assets/mascote_eyes_closed.png';
import iconApp from '../../assets/logo/icon_app.png';
import type { UserProfile } from '../../types';

interface MascotBubbleProps {
  userProfile: UserProfile;
  onShowToast: (message: string, type: 'info' | 'success' | 'error', duration?: number) => void;
  onMoodShared: (mood: string) => void;
}

const quickMoods = ['Calmo(a)', 'Alegre', 'Ansioso(a)', 'Cansado(a)', 'Estressado(a)'];

export const MascotBubble = ({ userProfile, onShowToast, onMoodShared }: MascotBubbleProps) => {
  const [moodInputOpen, setMoodInputOpen] = useState(false);
  const [currentMood, setCurrentMood] = useState('');
  const [eyesOpen, setEyesOpen] = useState(true);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyesOpen(false);
      setTimeout(() => setEyesOpen(true), 100);
    }, 1800 + Math.random() * 1500);
    return () => clearInterval(blinkInterval);
  }, []);

  const shareMood = (moodText?: string) => {
    const finalMood = (moodText || currentMood).trim();
    if (finalMood) {
      onMoodShared(finalMood);
      onShowToast('Obrigada por compartilhar! Esse registro ajuda a compreender seus padrões alimentares com gentileza.', 'success');
      setMoodInputOpen(false);
      setCurrentMood('');
    }
  };

  const firstName = (userProfile.name || 'você').trim().split(/\s+/)[0];

  return (
    <div className="bg-accent/10 border border-accent/20 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden group">
      <div className="absolute top-2 right-2 p-2 opacity-10 pointer-events-none w-28 h-28">
        <img src={iconApp} alt="" className="w-full h-full object-contain" />
      </div>
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
          {!moodInputOpen ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {quickMoods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => shareMood(m)}
                  className="text-xs font-bold bg-white text-ink/75 border border-line px-3 py-1.5 rounded-full hover:border-accent hover:bg-accent/10 hover:text-accent transition-colors shadow-2xs"
                >
                  {m}
                </button>
              ))}
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
                onKeyDown={(e) => { if (e.key === 'Enter') shareMood(); }}
              />
              <button
                type="button"
                onClick={() => shareMood()}
                className="bg-accent text-paper p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-accent/90 shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

