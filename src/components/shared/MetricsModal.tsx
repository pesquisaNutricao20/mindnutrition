import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { UserProfile } from '../../types';
import { calculateNutritionalNeeds } from '../../lib/profile';
import { getLatestMetricValue, parseDateForSorting, sortMetricsChronologically } from '../../lib/metrics';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Overlay } from '../ui/Overlay';
import { ConfirmationModal } from './ConfirmationModal';

type MetricKey = 'weight' | 'height' | 'waist' | 'arm' | 'abdomen' | 'hip';
type MetricEvolutionKey = 'weightEvolution' | 'waistEvolution' | 'armEvolution' | 'abdomenEvolution' | 'hipEvolution';

export function MetricsModal({
  isOpen,
  onClose,
  userProfile,
  onSaveProfile,
  toast,
}: {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
  toast: any;
}) {
  const emptyMetrics = () => ({
    weight: getLatestMetricValue(userProfile.weightEvolution) || 0,
    height: userProfile.height || 0,
    waist: getLatestMetricValue(userProfile.waistEvolution) || 0,
    arm: getLatestMetricValue(userProfile.armEvolution) || 0,
    abdomen: getLatestMetricValue(userProfile.abdomenEvolution) || 0,
    hip: getLatestMetricValue(userProfile.hipEvolution) || 0,
  });
  const [newMetrics, setNewMetrics] = useState(emptyMetrics);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<MetricKey, string>>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ key: MetricEvolutionKey; date: string; label: string } | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setNewMetrics(emptyMetrics());
      setFieldErrors({});
      setFormError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userProfile]);

  const metricFields = [
    { key: 'weight', label: 'Peso', unit: 'kg', max: 350, hint: 'Registre em condições parecidas para comparar a evolução.' },
    { key: 'height', label: 'Altura', unit: 'cm', max: 250, hint: 'Usada junto com o peso para calcular o IMC.' },
    { key: 'waist', label: 'Cintura', unit: 'cm', max: 250, hint: 'Use uma fita flexível, sem apertar a pele.' },
    { key: 'abdomen', label: 'Abdômen', unit: 'cm', max: 250, hint: 'Meça de pé, ao final de uma expiração confortável.' },
    { key: 'hip', label: 'Quadril', unit: 'cm', max: 250, hint: 'Passe a fita pela região mais larga do quadril.' },
    { key: 'arm', label: 'Braço', unit: 'cm', max: 100, hint: 'Opcional: meça o braço relaxado, no ponto médio.' },
  ] as const;

  const metricHistory = metricFields
    .filter(field => field.key !== 'height')
    .flatMap(field => {
      const key = `${field.key}Evolution` as MetricEvolutionKey;
      return (userProfile[key] || []).map(item => ({ ...item, label: field.label, unit: field.unit, key }));
    })
    .sort((a, b) => parseDateForSorting(b.date) - parseDateForSorting(a.date))
    .slice(0, 8);

  const handleSaveMetrics = async () => {
    if (savingRef.current) return;
    const errors: Partial<Record<MetricKey, string>> = {};
    for (const field of metricFields) {
      const value = newMetrics[field.key];
      if (!Number.isFinite(value) || value < 0) errors[field.key] = 'Informe um valor maior ou igual a zero.';
      else if (value > field.max) errors[field.key] = `O valor máximo é ${field.max} ${field.unit}.`;
      else if (field.key === 'height' && value > 0 && value < 80) errors[field.key] = 'A altura deve ter pelo menos 80 cm.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError('Revise os campos indicados antes de salvar.');
      return;
    }
    if (!Object.values(newMetrics).some(value => value > 0)) {
      setFormError('Informe ao menos uma medida para salvar.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError('');
    try {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const recordedAt = now.toISOString();
      const updatedProfile = { ...userProfile };

      const updateEvolution = (key: MetricEvolutionKey, value: number) => {
        if (value <= 0) return;
        const arr = (updatedProfile[key] as any[]) || [];
        const existingForDate = arr.findIndex(item => {
          const itemTime = parseDateForSorting(item.date, item.recordedAt);
          if (!itemTime) return false;
          const itemDay = new Date(itemTime);
          return itemDay.getFullYear() === now.getFullYear()
            && itemDay.getMonth() === now.getMonth()
            && itemDay.getDate() === now.getDate();
        });
        const next = existingForDate >= 0
          ? arr.map((item, index) => index === existingForDate ? { ...item, date, value, recordedAt } : item)
          : [...arr, { date, value, recordedAt }];
        (updatedProfile[key] as any) = sortMetricsChronologically(next);
      };

      updateEvolution('weightEvolution', newMetrics.weight);
      updateEvolution('waistEvolution', newMetrics.waist);
      updateEvolution('armEvolution', newMetrics.arm);
      updateEvolution('abdomenEvolution', newMetrics.abdomen);
      updateEvolution('hipEvolution', newMetrics.hip);
      if (newMetrics.height > 0) updatedProfile.height = newMetrics.height;

      const latestWeight = getLatestMetricValue(updatedProfile.weightEvolution);
      if (updatedProfile.height && latestWeight) {
        Object.assign(updatedProfile, calculateNutritionalNeeds(
          latestWeight,
          updatedProfile.height,
          updatedProfile.age || 25,
          updatedProfile.gender || 'Feminino',
          updatedProfile.activityLevel || 1.2,
          updatedProfile.objectives || []
        ));
      }

      await onSaveProfile(updatedProfile);
      onClose();
      toast('Métricas corporais atualizadas!', 'success');
    } catch {
      setFormError('Não foi possível salvar as medidas. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const removeMetricRecord = async (key: MetricEvolutionKey, date: string) => {
    const next = { ...userProfile, [key]: (userProfile[key] || []).filter(item => item.date !== date) };
    const latestWeight = getLatestMetricValue(next.weightEvolution);
    if (next.height && latestWeight) {
      Object.assign(next, calculateNutritionalNeeds(latestWeight, next.height, next.age || 25, next.gender || 'Feminino', next.activityLevel || 1.2, next.objectives || []));
    }
    await onSaveProfile(next);
    toast('Registro removido. Você pode inserir a medida correta.', 'success');
  };

  return (
    <>
      <Overlay
        open={isOpen}
        onClose={onClose}
        title="Atualizar medidas"
        description="Peso, altura e medidas opcionais. Preencha apenas o que desejar."
        size="lg"
        busy={saving}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="metrics-form" loading={saving}>Salvar medidas</Button>
          </div>
        }
      >
        <form id="metrics-form" onSubmit={event => { event.preventDefault(); void handleSaveMetrics(); }}>
          {formError && <p role="alert" className="mb-4 rounded-2xl bg-danger/5 p-3 text-sm leading-relaxed text-danger">{formError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {metricFields.map((field) => (
              <FormField
                key={field.key}
                htmlFor={`metric-${field.key}`}
                label={`${field.label} (${field.unit})`}
                optional
                hint={field.hint}
                error={fieldErrors[field.key]}
                className="rounded-2xl bg-white border border-line p-4"
              >
                <input
                  id={`metric-${field.key}`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max={field.max}
                  value={newMetrics[field.key] || ''}
                  onChange={e => {
                    setNewMetrics({ ...newMetrics, [field.key]: parseFloat(e.target.value) || 0 });
                    setFieldErrors(previous => ({ ...previous, [field.key]: undefined }));
                  }}
                  placeholder="0"
                  className="min-h-12 w-full rounded-xl border border-line bg-paper px-3 py-2 text-xl font-bold text-ink outline-none focus:border-accent"
                />
              </FormField>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3"><span className="font-bold text-sm">Registros recentes</span><span className="text-xs font-bold text-ink/55">Corrija ou apague</span></div>
            {metricHistory.length ? <div className="mt-3 space-y-2">{metricHistory.map(item => (
              <div key={`${item.key}-${item.date}`} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                <span className="text-xs font-medium"><b>{item.label}:</b> {item.value} {item.unit} · {item.date}</span>
                <button type="button" onClick={() => setPendingDelete({ key: item.key, date: item.date, label: item.label })} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger/10" title="Apagar registro" aria-label={`Apagar registro de ${item.label} de ${item.date}`}><Trash2 size={16} /></button>
              </div>
            ))}</div> : <p className="mt-2 text-xs text-ink/55">Nenhuma medida salva ainda.</p>}
          </div>
        </form>
      </Overlay>
      <ConfirmationModal
        isOpen={Boolean(pendingDelete)}
        title="Excluir registro?"
        description={`O registro de ${pendingDelete?.label || 'medida'} será removido deste aparelho e da sua conta.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!pendingDelete) return false;
          await removeMetricRecord(pendingDelete.key, pendingDelete.date);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
