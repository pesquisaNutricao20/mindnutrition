import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Overlay } from '../ui/Overlay';

interface DailyDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string, mood?: string) => void | Promise<void>;
}

export const DailyDiaryModal = ({ isOpen, onClose, onSave }: DailyDiaryModalProps) => {
  const [diaryText, setDiaryText] = useState('');
  const [diaryMood, setDiaryMood] = useState('Calmo(a)');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (diaryText.trim().length < 3) {
      setError('Escreva pelo menos 3 caracteres para salvar sua anotação.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(diaryText, diaryMood);
      setDiaryText('');
      onClose();
    } catch {
      setError('Não foi possível salvar agora. Sua anotação continua aqui; tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      title="Anotações & Reflexões do Dia"
      description="Escreva situações, sentimentos ou acontecimentos que influenciaram suas escolhas e sua alimentação hoje."
      size="lg"
      busy={saving}
      footer={<Button fullWidth type="submit" form="daily-diary-form" loading={saving}>Salvar no Diário</Button>}
    >
      <form id="daily-diary-form" onSubmit={handleSubmit} className="space-y-5">
        <FormField
          label="Como foi seu dia?"
          htmlFor="diary-text"
          required
          hint="Mínimo de 3 caracteres. Este espaço é só seu."
          error={error}
        >
          <textarea
            id="diary-text"
            value={diaryText}
            onChange={(event) => { setDiaryText(event.target.value); if (error) setError(''); }}
            maxLength={1200}
            disabled={saving}
            placeholder="Sentiu ansiedade no trabalho? Celebrou algo especial? Descreva livremente..."
            className="w-full h-36 p-4 rounded-2xl bg-white border border-line text-sm resize-none font-medium disabled:opacity-60"
          />
        </FormField>
        <fieldset disabled={saving}>
          <legend className="mb-2 text-sm font-semibold text-ink">Sentimento predominante</legend>
          <div className="flex flex-wrap gap-2">
            {['Calmo(a)', 'Alegre', 'Ansioso(a)', 'Estressado(a)', 'Cansado(a)', 'Grato(a)'].map(mood => (
              <button
                key={mood}
                type="button"
                onClick={() => setDiaryMood(mood)}
                aria-pressed={diaryMood === mood}
                className={`min-h-11 px-4 rounded-full text-xs font-bold border transition-colors ${diaryMood === mood ? 'bg-accent text-paper border-accent' : 'bg-white text-ink/65 border-line'}`}
              >
                {mood}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Overlay>
  );
};
