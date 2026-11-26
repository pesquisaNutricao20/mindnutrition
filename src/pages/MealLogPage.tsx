import React, { useState, useRef } from 'react';
import {
  Camera,
  Coffee,
  Frown,
  HelpCircle,
  Library,
  Loader2,
  Meh,
  ScanLine,
  Smile,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { PiHeartbeat } from 'react-icons/pi';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { FlyingMascotSprite } from '../components/ui/FlyingMascotSprite';
import { MealAiAnalysisCard, type MealAiAnalysis } from '../components/shared/MealAiAnalysisCard';
import { MAX_MEAL_PHOTOS, readValidatedImages } from '../constants';
import { authHeaders } from '../lib/portal';
import type { MealClassification } from '../lib/metrics';
import type { Page } from '../types';

export function MealLogPage({
  onSaveMeal,
  onNavigate,
  onOpenHungerModal,
  toast
}: {
  onSaveMeal: (meal: any) => void | Promise<void>;
  onNavigate: (page: Page) => void;
  onOpenHungerModal: () => void;
  toast: any;
}) {
  const [step, setStep] = useState<'pre' | 'meal' | 'post'>('pre');
  const [aiAnalysis, setAiAnalysis] = useState<MealAiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const savingRef = useRef(false);
  const analyzingRef = useRef(false);
  const [log, setLog] = useState<{
    title: string;
    preHunger: number;
    hungerType: MealClassification;
    preMood: string;
    postHunger: number | null;
    postMood: string;
    satisfaction: number;
    notes: string;
    photos: string[];
  }>({
    title: 'Refeição',
    preHunger: 5,
    hungerType: 'Física',
    preMood: 'Neutro',
    postHunger: null,
    postMood: 'Neutro',
    satisfaction: 4,
    notes: '',
    photos: []
  });

  const analyzeMealPhoto = async (image: string, description = '') => {
    if (!image || analyzingRef.current) return;
    analyzingRef.current = true;
    setIsAnalyzing(true);
    setAiAnalysisError('');
    try {
      const response = await fetch('/api/ai-meal-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ image, description }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.analysis) {
        throw new Error(result.message || 'Não foi possível analisar a foto agora.');
      }
      setAiAnalysis(result.analysis);
      toast('Análise da refeição concluída.', 'success');
    } catch (error) {
      setAiAnalysisError(error instanceof Error ? error.message : 'Não foi possível analisar a foto agora.');
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const handleMealPhotos = async (files: FileList | null) => {
    if (loadingPhotos) return;
    setLoadingPhotos(true);
    try {
      const result = await readValidatedImages(files, log.photos.length);
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      if (result.images.length) {
        setLog(prev => ({ ...prev, photos: [...prev.photos, ...result.images] }));
        toast('Foto adicionada! A análise será feita apenas se você solicitar.', 'success');
      }
    } finally {
      setLoadingPhotos(false);
    }
  };

  const saveMealRecord = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const inferredType = log.hungerType;
      const newMeal = {
        ...log,
        id: crypto.randomUUID(),
        title: log.title?.trim() || 'Refeição',
        date: new Date().toISOString(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: inferredType,
        inferredType,
        mood: log.postMood || log.preMood,
        hungerDelta: log.postHunger === null ? null : log.postHunger - log.preHunger,
        image: log.photos[0] || '',
        aiAnalysis: aiAnalysis ? { ...aiAnalysis, analyzedAt: new Date().toISOString() } : undefined,
      };
      await onSaveMeal(newMeal);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar a refeição. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const moods = [
    { label: 'Alegre', icon: Smile },
    { label: 'Calmo(a)', icon: Sun },
    { label: 'Neutro', icon: Meh },
    { label: 'Ansioso(a)', icon: PiHeartbeat },
    { label: 'Estressado(a)', icon: Zap },
    { label: 'Frustrado(a)', icon: Frown },
    { label: 'Triste', icon: Frown },
    { label: 'Cansado(a)', icon: Coffee }
  ];

  const satisfactionDescriptions: Record<number, string> = {
    0: 'Nada satisfeito',
    1: 'Muito pouco',
    2: 'Pouco',
    3: 'Moderadamente',
    4: 'Satisfeito',
    5: 'Muito'
  };

  const stepNumber = step === 'pre' ? 1 : step === 'meal' ? 2 : 3;
  const nextLabel = step === 'pre' ? 'Iniciar refeição' : step === 'meal' ? 'Ir para pós-refeição' : 'Salvar refeição';

  return (
    <>
      <PageContainer
        variant="narrow"
        noPadding
        className="space-y-6 px-4 sm:px-8 md:px-12 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:pt-12 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:pb-12"
      >
        <PageHeader
          title={step === 'pre' ? 'Antes da refeição' : step === 'meal' ? 'Durante a refeição' : 'Depois da refeição'}
          subtitle="Reserve um momento para perceber seus sinais."
          eyebrow={`Etapa ${stepNumber} de 3`}
          back={{
            label: step === 'pre' ? 'Voltar ao dashboard' : 'Voltar à etapa anterior',
            onClick: () => {
              if (saving) return;
              if (step === 'pre') onNavigate('dashboard');
              else setStep(step === 'meal' ? 'pre' : 'meal');
            },
          }}
          actions={step === 'pre' ? (
            <button type="button" onClick={onOpenHungerModal} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/20">
              <HelpCircle size={15} /> Entender a fome
            </button>
          ) : undefined}
        />
        <div role="progressbar" aria-label="Progresso do registro de refeição" aria-valuemin={1} aria-valuemax={3} aria-valuenow={stepNumber} aria-valuetext={`Etapa ${stepNumber} de 3`} className="grid grid-cols-3 gap-2">
          {(['Antes', 'Durante', 'Depois'] as const).map((label, index) => (
            <span key={label} className={`h-2 rounded-full ${index < stepNumber ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </div>

        <form
          id="meal-log-form"
          className="space-y-6"
          aria-busy={saving || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) return;
            if (step === 'pre') setStep('meal');
            else if (step === 'meal') setStep('post');
            else void saveMealRecord();
          }}
        >
        {/* STEP 1: PRÉ-REFEIÇÃO */}
        {step === 'pre' && (
          <>
            <fieldset className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <legend className="font-bold text-lg">De onde vem sua fome?</legend>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">Escolha o sinal que melhor representa este momento.</p>
              <div className="mx-auto mt-3 flex w-full max-w-xs flex-col items-center">
                <div className="h-20 w-20">
                  <FlyingMascotSprite alt="Mascote pensando" animation="thinking" className="h-full w-full" />
                </div>
                <span className="mt-1 text-center text-xs font-bold text-ink/45">Pausa breve: como seu corpo e suas emoções estão?</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(['Física', 'Emocional'] as MealClassification[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLog({ ...log, hungerType: type })}
                    aria-pressed={log.hungerType === type}
                    className={`min-h-12 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-colors ${log.hungerType === type ? 'border-accent bg-accent text-paper' : 'border-line bg-white text-ink/60 hover:border-accent'}`}
                  >
                    Fome {type}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <legend className="font-bold text-lg">Como você está se sentindo agora?</legend>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">Reconhecer suas emoções antes da refeição acalma a mente.</p>
              <div className="mood-grid mt-4">
                {moods.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setLog({ ...log, preMood: m.label })}
                    aria-pressed={log.preMood === m.label}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all ${log.preMood === m.label ? 'border-accent bg-accent/10 text-accent font-bold shadow-2xs' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}
                  >
                    <m.icon size={22} />
                    <span className="text-xs font-bold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {/* STEP 2: A REFEIÇÃO */}
        {step === 'meal' && (
          <>
            <div className="bg-white border border-line p-6 rounded-[2rem] shadow-sm">
              <FormField className="[&>label]:my-3" label="Nome da refeição" htmlFor="meal-title" hint="Use um nome curto para reconhecer este registro depois.">
                <input
                  id="meal-title"
                  type="text"
                  value={log.title}
                  maxLength={100}
                  onChange={(e) => setLog({ ...log, title: e.target.value })}
                  placeholder="Ex: Almoço com a família"
                  className="input-field text-lg font-bold"
                />
              </FormField>
            </div>

            <div className="meal-photo-actions w-full grid grid-cols-2 gap-4">
              <label className="aspect-video rounded-[2rem] border-2 border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center gap-2 text-accent hover:bg-accent/10 active:scale-95 transition-all cursor-pointer relative overflow-hidden">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  disabled={loadingPhotos}
                  className="absolute inset-0 cursor-pointer w-full h-full disabled:cursor-wait"
                  onChange={(e) => { void handleMealPhotos(e.target.files); e.target.value = ''; }}
                />
                <Camera size={28} />
                <span className="font-bold text-xs sm:text-sm">Tirar Foto</span>
              </label>

              <label className="aspect-video rounded-[2rem] border-2 border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center gap-2 text-accent hover:bg-accent/10 active:scale-95 transition-all cursor-pointer relative overflow-hidden">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={loadingPhotos}
                  className="absolute inset-0 cursor-pointer w-full h-full disabled:cursor-wait"
                  onChange={(e) => { void handleMealPhotos(e.target.files); e.target.value = ''; }}
                />
                <Library size={28} />
                <span className="font-bold text-xs sm:text-sm">Abrir Galeria</span>
              </label>
            </div>

            <div className="rounded-[2rem] border border-line bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm">Fotos da Refeição (Opcional)</h3>
                  <p className="text-xs text-ink/45">Até {MAX_MEAL_PHOTOS} fotos por refeição.</p>
                </div>
                <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full" aria-live="polite">{log.photos.length}/{MAX_MEAL_PHOTOS}</span>
              </div>
              {log.photos.length === 0 ? (
                <div className="h-20 rounded-2xl bg-ink/5 border border-dashed border-line flex items-center justify-center text-xs font-bold text-ink/35">
                  Nenhuma foto anexada
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {log.photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-line">
                      <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                      {isAnalyzing && index === 0 && (
                        <div className="ai-scan-overlay" aria-hidden="true">
                          <div className="ai-scan-grid" />
                          <div className="ai-scan-line" />
                          <span className="ai-scan-label"><ScanLine size={11} /> Analisando</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setLog(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
                          if (index === 0) {
                            setAiAnalysis(null);
                            setAiAnalysisError('');
                          }
                        }}
                        aria-label={`Remover foto ${index + 1}`}
                        className="absolute top-1 right-1 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-ink/80 text-paper"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <MealAiAnalysisCard
              analysis={aiAnalysis}
              loading={isAnalyzing}
              error={aiAnalysisError}
              hasPhoto={Boolean(log.photos[0])}
              onAnalyze={() => { if (log.photos[0]) void analyzeMealPhoto(log.photos[0], log.notes); }}
            />

            <div className="bg-white border border-line p-5 rounded-[2rem]">
              <FormField className="[&>label]:my-3" label="O que você está comendo?" htmlFor="meal-notes" hint="Descreva o prato, os sabores ou como está seu ritmo ao comer." optional>
                <textarea
                  id="meal-notes"
                  placeholder="Suas observações..."
                  className="input-field min-h-28 resize-y"
                  value={log.notes}
                  maxLength={1000}
                  onChange={e => setLog({ ...log, notes: e.target.value })}
                />
              </FormField>
            </div>
          </>
        )}

        {/* STEP 3: PÓS-REFEIÇÃO */}
        {step === 'post' && (
          <>
            <fieldset className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <legend className="font-bold text-lg">Como foi sua saciedade?</legend>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">Avalie o quanto esta refeição atendeu às suas necessidades físicas.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setLog({ ...log, satisfaction: val })}
                    aria-pressed={log.satisfaction === val}
                    className={`min-h-18 rounded-2xl border-2 p-3 text-left transition-all ${log.satisfaction === val ? 'bg-accent border-accent text-paper shadow-sm' : 'border-line bg-white hover:border-accent'}`}
                  >
                    <span className="block text-xl font-bold">{val}</span>
                    <span className="mt-0.5 block text-xs font-bold leading-tight">{satisfactionDescriptions[val]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mobile-card-padding bg-white border border-line p-6 sm:p-8 rounded-[2rem] shadow-sm">
              <legend className="font-bold text-lg">Seu humor após a refeição</legend>
              <div className="mood-grid mt-3">
                {moods.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setLog({ ...log, postMood: m.label })}
                    aria-pressed={log.postMood === m.label}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all ${log.postMood === m.label ? 'border-accent bg-accent/10 text-accent font-bold shadow-2xs' : 'border-transparent bg-ink/5 hover:bg-ink/10 text-ink/60'}`}
                  >
                    <m.icon size={22} />
                    <span className="text-xs font-bold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

          {saveError && <p role="alert" className="rounded-2xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger">{saveError}</p>}
          <div className="hidden md:block">
            <Button type="submit" size="lg" fullWidth loading={saving}>{nextLabel}</Button>
          </div>
        </form>
      </PageContainer>

      <div className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom,0px)] z-40 border-t border-line bg-paper px-4 py-3 md:hidden">
        <Button type="submit" form="meal-log-form" size="lg" fullWidth loading={saving}>{nextLabel}</Button>
      </div>
    </>
  );
}
