import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  const handleConfirm = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await onConfirm();
      if (result === false) {
        setError('Não foi possível concluir a ação. Tente novamente.');
        return;
      }
      onClose();
    } catch {
      setError('Não foi possível concluir a ação. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      busy={saving}
      initialFocusRef={cancelRef}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="danger" onClick={handleConfirm} loading={saving}>{confirmLabel}</Button>
        </div>
      }
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger"><Trash2 size={21} aria-hidden="true" /></div>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-danger/5 p-3 text-sm leading-relaxed text-danger">{error}</p>}
    </Overlay>
  );
}
