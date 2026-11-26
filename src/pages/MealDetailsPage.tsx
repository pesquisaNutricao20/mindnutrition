import React, { useState, useRef } from 'react';
import { Camera, Edit2, Loader2, Trash2, X } from 'lucide-react';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { ConfirmationModal } from '../components/shared/ConfirmationModal';
import { MealAiAnalysisCard } from '../components/shared/MealAiAnalysisCard';
import { MAX_MEAL_PHOTOS, readValidatedImages } from '../constants';
import { inferMealType } from '../lib/metrics';
import type { Page } from '../types';

export function MealDetailsPageComponent({
  selectedMeal,
  onNavigate,
  onUpdate,
  onDelete,
  toast,
}: {
  selectedMeal: any;
  onNavigate: (page: Page) => void;
  onUpdate: (meal: any) => void | Promise<void>;
  onDelete: () => void | boolean | Promise<void | boolean>;
  toast: any;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const savingRef = useRef(false);
  const loadingPhotosRef = useRef(false);
  const [title, setTitle] = useState(selectedMeal?.title || 'Refeição');
  const [notes, setNotes] = useState(selectedMeal?.notes || '');
  const [photos, setPhotos] = useState<string[]>(() => selectedMeal?.photos?.length ? selectedMeal.photos : (selectedMeal?.image ? [selectedMeal.image] : []));
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  if (!selectedMeal) return null;
  const mealType = inferMealType(selectedMeal);
  const mealPhotos = photos;
  const originalTitle = selectedMeal.title || 'Refeição';
  const originalNotes = selectedMeal.notes || '';
  const originalPhotos = selectedMeal.photos?.length ? selectedMeal.photos : (selectedMeal.image ? [selectedMeal.image] : []);
  const isDirty = title !== originalTitle || notes !== originalNotes || photos.join('|') !== originalPhotos.join('|');
  const satisfactionLabels = ['Nada satisfeito', 'Muito pouco', 'Pouco', 'Moderadamente', 'Satisfeito', 'Muito'];
  const hasSatisfaction = Number.isInteger(selectedMeal.satisfaction) && selectedMeal.satisfaction >= 0 && selectedMeal.satisfaction <= 5;

  const cancelEditing = () => {
    if (saving) return;
    setTitle(originalTitle);
    setNotes(originalNotes);
    setPhotos(originalPhotos);
    setSaveError('');
    setIsEditing(false);
  };

  const addMealPhotos = async (files: FileList | null) => {
    if (loadingPhotosRef.current) return;
    loadingPhotosRef.current = true;
    setLoadingPhotos(true);
    try {
      const result = await readValidatedImages(files, mealPhotos.length);
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      if (result.images.length) setPhotos(current => [...current, ...result.images]);
    } finally {
      loadingPhotosRef.current = false;
      setLoadingPhotos(false);
    }
  };

  const saveChanges = async () => {
    if (savingRef.current || !isDirty) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await onUpdate({ ...selectedMeal, title: title.trim() || 'Refeição', notes: notes.trim(), photos: mealPhotos, image: mealPhotos[0] || '' });
      setIsEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar a edição. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <PageContainer variant="narrow" hasTopbar={false} className="space-y-6">
      <PageHeader
        title={isEditing ? 'Editar refeição' : originalTitle}
        subtitle={`${selectedMeal.time || ''} · ${mealType}`}
        eyebrow="Detalhes da refeição"
        back={{ label: 'Voltar ao dashboard', onClick: () => { if (!saving) onNavigate('dashboard'); } }}
        actions={(
          <>
            <Button variant={isEditing ? 'secondary' : 'ghost'} size="sm" onClick={isEditing ? cancelEditing : () => setIsEditing(true)} disabled={saving}>
              {isEditing ? 'Cancelar' : <><Edit2 size={15} /> Editar</>}
            </Button>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirmation(true)} className="text-danger hover:bg-danger/10">
                <Trash2 size={15} /> Excluir
              </Button>
            )}
          </>
        )}
      />

      <div className="bg-white border border-line rounded-[2rem] overflow-hidden shadow-sm">
        {mealPhotos[0] ? (
          <div className="h-64 sm:h-80 w-full relative bg-accent/5">
            <img src={mealPhotos[0]} alt={selectedMeal.title} className="w-full h-full object-cover" />
            <div className="absolute top-4 right-4 bg-paper/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold shadow-md">
              {selectedMeal.time}
            </div>
          </div>
        ) : null}

        <div className="p-6 space-y-6">
          {isEditing && (
            <div className="space-y-5 rounded-2xl border border-line bg-paper p-4" aria-busy={saving || undefined}>
              <FormField label="Nome da refeição" htmlFor="edit-meal-title">
                <input id="edit-meal-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} disabled={saving} className="input-field font-bold" />
              </FormField>
              <FormField label="Anotações" htmlFor="edit-meal-notes" optional>
                <textarea id="edit-meal-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} disabled={saving} className="input-field min-h-24 resize-y" />
              </FormField>
              <fieldset>
                <legend className="label-sm text-accent">Fotos</legend>
                <p className="mt-1 text-xs text-ink/55">Até {MAX_MEAL_PHOTOS} fotos. Adicionar ou remover não inicia análise de IA.</p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {mealPhotos.map((photo, index) => (
                    <div key={`${photo.slice(0, 24)}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-white">
                      <img src={photo} alt={`Foto ${index + 1} da refeição`} className="h-full w-full object-cover" />
                      <button type="button" disabled={saving} onClick={() => setPhotos(current => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/80 text-paper disabled:opacity-50" aria-label={`Remover foto ${index + 1}`}><X size={14} /></button>
                    </div>
                  ))}
                  {mealPhotos.length < MAX_MEAL_PHOTOS && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-accent bg-accent/5 p-2 text-center text-xs font-bold text-accent hover:bg-accent/10">
                      {loadingPhotos ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
                      {loadingPhotos ? 'Carregando' : 'Adicionar'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={loadingPhotos || saving} className="sr-only" onChange={(event) => { void addMealPhotos(event.target.files); event.target.value = ''; }} />
                    </label>
                  )}
                </div>
              </fieldset>
              {saveError && <p role="alert" className="rounded-xl bg-danger/5 p-3 text-sm text-danger">{saveError}</p>}
              <Button fullWidth onClick={() => void saveChanges()} loading={saving} disabled={!isDirty}>Salvar edição</Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
              <span className="text-xs font-bold text-accent block">Tipo de fome</span>
              <span className="text-lg font-bold text-ink">{mealType}</span>
            </div>
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-xs font-bold text-ink/50 block">Satisfação física</span>
              <span className="text-lg font-bold text-ink">
                {hasSatisfaction ? `${selectedMeal.satisfaction}/5 (${satisfactionLabels[selectedMeal.satisfaction]})` : 'Não informada'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-xs font-bold text-ink/50 block">Humor antes / depois</span>
              <span className="text-sm font-bold text-ink">{selectedMeal.preMood || 'Neutro'} ➔ {selectedMeal.postMood || selectedMeal.mood || 'Neutro'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-paper border border-line">
              <span className="text-xs font-bold text-ink/50 block">Fome antes / depois</span>
              <span className="text-sm font-bold text-ink">{selectedMeal.preHunger ?? 5}/10{selectedMeal.postHunger !== null && selectedMeal.postHunger !== undefined ? ` ➔ ${selectedMeal.postHunger}/10` : ''}</span>
            </div>
          </div>

          {mealPhotos.length > 1 && (
            <div>
              <h4 className="font-bold text-sm mb-3">Outras Fotos</h4>
              <div className="grid grid-cols-3 gap-2">
                {mealPhotos.slice(1).map((p: string, idx: number) => (
                  <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-line">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedMeal.aiAnalysis && (
            <MealAiAnalysisCard
              analysis={selectedMeal.aiAnalysis}
              loading={false}
              error=""
              hasPhoto={Boolean(mealPhotos[0])}
              onAnalyze={() => undefined}
              showAction={false}
            />
          )}

          {notes && (
            <div className="p-5 bg-paper rounded-2xl border border-line">
              <span className="label-sm text-accent mb-1 block">Anotações</span>
              <p className="text-sm text-ink/80 italic font-medium">"{notes}"</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Excluir esta refeição?"
        description="A refeição, suas fotos e os sinais registrados serão removidos dos seus dados. Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={onDelete}
        onClose={() => setShowDeleteConfirmation(false)}
      />
    </PageContainer>
  );
}
