import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { BsFlower1 } from 'react-icons/bs';
import mascoteEyesOpen from '../../assets/mascote_eyes_open.png';
import mascoteEyesClosed from '../../assets/mascote_eyes_closed.png';
import type { UserProfile } from '../../types';

interface MascotBubbleProps {
  userProfile: UserProfile;
  onShowToast: (message: string, type: 'info' | 'success' | 'error', duration?: number) => void;
}

export const MascotBubble = ({ userProfile, onShowToast }: MascotBubbleProps) => {
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

  const shareMood = () => {
    if (currentMood) {
      onShowToast('Obrigado por compartilhar! O Nutri guardou isso com carinho.', 'success');
      setMoodInputOpen(false);
      setCurrentMood('');
    }
  };

  return (
    <div className="bg-accent/10 border border-accent/20 p-6 rounded-[2.5rem] relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <BsFlower1 size={120} />
      </div>
      <div className="flex items-center gap-6 relative z-10">
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-inner shrink-0 overflow-hidden">
          <img
            src={eyesOpen ? mascoteEyesOpen : mascoteEyesClosed}
            alt="Mascote"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex-1">
          <h4 className="label-sm text-accent">Mascote Nutri</h4>
          <p className="serif-body text-xl text-ink mt-1">"Ei {userProfile.name || 'amigo'}, como está seu coração hoje? Você está se sentindo bem?"</p>
          {!moodInputOpen ? (
            <button onClick={() => setMoodInputOpen(true)} className="mt-3 text-xs font-bold bg-accent text-paper px-4 py-2 rounded-full hover:bg-accent/90 transition-colors shadow-sm">
              Responder
            </button>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                type="text" value={currentMood} onChange={(e) => setCurrentMood(e.target.value)}
                placeholder="Estou me sentindo..."
                className="flex-1 px-4 py-2 text-sm rounded-full border border-line focus:border-accent focus:outline-none" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') shareMood(); }}
              />
              <button
                onClick={shareMood}
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
