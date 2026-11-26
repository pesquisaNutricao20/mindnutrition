import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Overlay } from '../ui/Overlay';

interface SleepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hours: number, quality: 'Ruim' | 'Regular' | 'Bom' | 'Excelente', notes?: string) => void | Promise<void>;
}

export const SleepModal = ({ isOpen, onClose, onSave }: SleepModalProps) => {
  const [hours, setHours] = useState(7.5);
  const [quality, setQuality] = useState<'Ruim' | 'Regular' | 'Bom' | 'Excelente'>('Bom');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (hours < 3 || hours > 12) {
      setError('Informe um valor entre 3 e 12 horas.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(hours, quality, notes);
      onClose();
    } catch {
      setError('Não foi possível salvar agora. Os valores continuam aqui; tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      title="Como foi seu descanso?"
      description="Uma boa noite de sono regula a grelina e leptina, facilitando escolhas alimentares mais equilibradas."
      size="lg"
      busy={saving}
      footer={<Button fullWidth type="submit" form="sleep-form" loading={saving}>Registrar Sono</Button>}
    >
      <form id="sleep-form" onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Horas dormidas" htmlFor="sleep-hours" hint="Escolha um valor entre 3 e 12 horas." error={error}>
          <input
            id="sleep-hours"
            type="range"
            min="3"
            max="12"
            step="0.5"
            value={hours}
            onChange={(event) => { setHours(parseFloat(event.target.value)); setError(''); }}
            disabled={saving}
            aria-valuetext={`${hours} horas`}
            className="w-full accent-accent h-2 bg-line rounded-lg cursor-pointer"
          />
        </FormField>
        <div className="flex items-center justify-between rounded-2xl bg-accent/5 px-4 py-3">
          <span className="text-sm font-semibold text-ink/70">Tempo registrado</span>
          <output htmlFor="sleep-hours" className="text-xl font-bold text-accent">{hours}h</output>
        </div>
        <fieldset disabled={saving}>
          <legend className="mb-2 text-sm font-semibold text-ink">Qualidade do sono</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['Ruim', 'Regular', 'Bom', 'Excelente'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setQuality(option)}
                aria-pressed={quality === option}
                className={`min-h-11 rounded-2xl text-xs font-bold border text-center transition-colors ${quality === option ? 'bg-accent text-paper border-accent shadow-xs' : 'bg-white text-ink/65 border-line'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <FormField label="Observações" htmlFor="sleep-notes" optional>
          <input
            id="sleep-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={250}
            disabled={saving}
            placeholder="Ex: Acordei durante a noite, tomei café tarde..."
            className="w-full min-h-12 px-4 py-3 rounded-2xl bg-white border border-line text-sm font-medium disabled:opacity-60"
          />
        </FormField>
      </form>
    </Overlay>
  );
};
