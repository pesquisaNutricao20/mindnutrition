import React, { useState, useRef } from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { calculateNutritionalNeeds, withProfileCompletionState } from '../lib/profile';
import type { UserProfile } from '../types';

export function DiagnosisPage({
  userProfile,
  step,
  setStep,
  onComplete,
  onBack,
  onOpenHungerModal
}: {
  userProfile: UserProfile;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  onComplete: (profile: UserProfile) => void | Promise<void>;
  onBack: () => void;
  onOpenHungerModal: () => void;
}) {
  const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'age' | 'height' | 'weight', string>>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const steps = [
    { id: 'name', title: "Como prefere ser chamado?", subtitle: "Sua identidade é essencial para nós.", type: 'input', field: 'name', placeholder: 'Seu nome ou apelido' },
    { id: 'gender', title: "Como você se identifica?", subtitle: "Escolha a opção que melhor representa você.", type: 'options', field: 'gender', options: ["Mulher", "Homem", "Não Binário(a)", "Outro", "Prefiro não informar"] },
    {
      id: 'basics', title: "Sobre sua rotina", subtitle: "Esses dados ajudam a personalizar seu cuidado com gentileza.", type: 'basic', options: [
        { label: "Sedentário (pouco ou nenhum exercício)", value: 1.2 },
        { label: "Levemente ativo (exercício leve 1-3 dias/sem)", value: 1.375 },
        { label: "Moderadamente ativo (exercício 3-5 dias/sem)", value: 1.55 },
        { label: "Muito ativo (exercício pesado 6-7 dias/sem)", value: 1.725 }
      ]
    },
    { id: 'emotions', title: "Como você se sente ultimamente?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'initialEmotions', options: ["Estressado(a)", "Frustrado(a)", "Deprimido(a)", "Solitário(a)", "Ansioso(a)", "Raivoso(a)", "Alegre", "Animado(a)", "Calmo(a)", "Outro"] },
    { id: 'comorbidities', title: "Você possui alguma condição de saúde?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'comorbidities', options: ["Não possuo nenhuma condição", "Sou diabético(a)", "Sou hipertenso(a)", "Tenho alterações da tireoide", "Tenho transtornos emocionais", "Outro"] },
    { id: 'triggers', title: "Quais emoções você costuma sentir antes de comer sem fome física?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'triggers', options: ["Tédio", "Cansaço", "Raiva", "Tristeza", "Ansiedade", "Alegria", "Outro"], hasHelpGuide: true },
    { id: 'foods', title: "Quando sente vontade de comer por causa das suas emoções, quais alimentos procura?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'foods', options: ["Doces", "Salgados", "Massas", "Salgadinhos", "Fast food", "Outro"] },
    { id: 'objectives', title: "Qual é o seu principal objetivo com este aplicativo?", subtitle: "Marque uma ou mais opções.", type: 'multiselect', field: 'objectives', options: ["Emagrecimento consciente", "Melhorar a relação com a comida", "Ganho de peso", "Hipertrofia", "Cuidar da minha saúde", "Outro"] },
    { id: 'measurements', title: "Suas medidas iniciais", subtitle: "Para personalizar suas necessidades com acolhimento.", type: 'measurements' }
  ];

  const current = steps[step] || steps[0];

  const handleNext = async () => {
    if (submittingRef.current) return;
    const errors: Partial<Record<'name' | 'age' | 'height' | 'weight', string>> = {};
    setFormError('');
    if (current.type === 'input' && !tempProfile.name?.trim()) {
      errors.name = 'Por favor, informe seu nome.';
    }
    if (current.type === 'basic' && (!tempProfile.age || tempProfile.age < 10 || tempProfile.age > 120)) {
      errors.age = 'Informe uma idade válida para continuar.';
    }
    if (current.type === 'measurements') {
      const initialWeight = tempProfile.weightEvolution?.[0]?.value || 0;
      if (tempProfile.height < 80 || tempProfile.height > 250) errors.height = 'Informe uma altura entre 80 e 250 cm.';
      if (initialWeight < 20 || initialWeight > 350) errors.weight = 'Informe um peso entre 20 e 350 kg.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    if (current.type === 'measurements') {
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const initialWeight = tempProfile.weightEvolution?.[0]?.value || 0;
        const result = calculateNutritionalNeeds(
          initialWeight,
          tempProfile.height,
          tempProfile.age || 25,
          tempProfile.gender || 'Feminino',
          tempProfile.activityLevel || 1.2,
          tempProfile.objectives
        );
        const finalProfile = withProfileCompletionState({ ...tempProfile, ...result });
        await onComplete(finalProfile);
      } catch {
        setFormError('Não foi possível concluir o diagnóstico. Tente novamente.');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    if (step < steps.length - 1) setStep(s => s + 1);
  };

  return (
    <>
    <PageContainer
      variant="narrow"
      noPadding
      hasTopbar={false}
      className="space-y-6 px-4 sm:px-8 md:px-12 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:pt-12 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] md:pb-12"
    >
      <PageHeader
        title={current.title}
        subtitle={current.subtitle}
        eyebrow={`Etapa ${step + 1} de ${steps.length}`}
        back={{ label: step > 0 ? 'Voltar à etapa anterior' : 'Sair do diagnóstico', onClick: onBack }}
        actions={current.hasHelpGuide ? (
          <button
            type="button"
            onClick={onOpenHungerModal}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/20"
          >
            <HelpCircle size={14} /> Entender fome
          </button>
        ) : undefined}
      />

      <div
        role="progressbar"
        aria-label="Progresso do diagnóstico"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Etapa ${step + 1} de ${steps.length}`}
        className="grid grid-cols-9 gap-1.5"
      >
        {steps.map((item, index) => (
          <span key={item.id} className={`h-2 rounded-full ${index <= step ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>

      <form id="diagnosis-form" onSubmit={event => { event.preventDefault(); void handleNext(); }}>
        {formError && <p role="alert" className="rounded-2xl bg-danger/5 p-3 text-sm font-semibold text-danger">{formError}</p>}

        {current.type === 'input' && (
          <FormField
            label="Nome ou apelido"
            htmlFor="diagnosis-name"
            required
            error={fieldErrors.name}
            hint="Você poderá alterar isso depois no seu perfil."
          >
            <input
              id="diagnosis-name"
              type="text"
              placeholder={current.placeholder}
              className="input-field min-h-14 text-lg"
              value={tempProfile.name}
              maxLength={80}
              autoComplete="name"
              autoFocus
              onChange={(e) => {
                setTempProfile({ ...tempProfile, name: e.target.value });
                setFieldErrors(previous => ({ ...previous, name: undefined }));
              }}
            />
          </FormField>
        )}

        {current.type === 'options' && (
          <fieldset className="space-y-3">
            <legend className="sr-only">{current.title}</legend>
            {(current.options as string[] | undefined)?.map((opt: string) => {
              const isOther = opt === 'Outro';
              const isSelected = tempProfile[current.field as keyof UserProfile] === opt || (isOther && String(tempProfile[current.field as keyof UserProfile]).startsWith('Outro:'));
              return (
                <div key={opt} className="space-y-2">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (isOther) {
                        setTempProfile({ ...tempProfile, [current.field!]: 'Outro: ' });
                      } else {
                        setTempProfile({ ...tempProfile, [current.field!]: opt });
                        setTimeout(() => setStep(value => value + 1), 120);
                      }
                    }}
                    className={`w-full min-h-14 p-5 text-left border-2 rounded-2xl font-bold text-base sm:text-lg transition-all ${isSelected ? 'border-accent bg-accent/10 text-accent shadow-xs' : 'border-line hover:border-accent hover:bg-accent/5'}`}
                  >
                    {opt}
                  </button>
                  {isOther && isSelected && (
                    <FormField label="Como você se identifica?" htmlFor="diagnosis-gender-other">
                      <input
                        id="diagnosis-gender-other"
                        type="text"
                        placeholder="Especifique..."
                        className="input-field min-h-12"
                        value={String(tempProfile[current.field as keyof UserProfile]).replace(/^Outro:\s*/, '')}
                        onChange={(e) => setTempProfile({ ...tempProfile, [current.field!]: `Outro: ${e.target.value}` })}
                        autoFocus
                      />
                    </FormField>
                  )}
                </div>
              );
            })}
          </fieldset>
        )}

        {current.type === 'basic' && (
          <div className="space-y-6">
            <FormField label="Qual é a sua idade?" htmlFor="diagnosis-age" required error={fieldErrors.age}>
              <input
                id="diagnosis-age"
                type="number"
                min="10"
                max="120"
                inputMode="numeric"
                placeholder="Ex: 28"
                className="input-field min-h-14 text-lg font-bold"
                value={tempProfile.age || ''}
                onChange={(e) => {
                  setTempProfile({ ...tempProfile, age: parseFloat(e.target.value) || 0 });
                  setFieldErrors(previous => ({ ...previous, age: undefined }));
                }}
              />
            </FormField>
            <fieldset>
              <legend className="label-sm mb-3 text-accent">Como é sua rotina de atividade física?</legend>
              <div className="grid gap-2">
                {(current.options as Array<{ label: string; value: number }> | undefined)?.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={tempProfile.activityLevel === opt.value}
                    onClick={() => setTempProfile({ ...tempProfile, activityLevel: opt.value })}
                    className={`w-full min-h-12 rounded-2xl border-2 p-4 text-left text-sm font-medium transition-colors ${tempProfile.activityLevel === opt.value ? 'border-accent bg-accent/10 text-accent shadow-xs' : 'border-line hover:border-accent'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {current.type === 'multiselect' && (
          <fieldset className="space-y-6">
            <legend className="sr-only">{current.title} Marque uma ou mais opções.</legend>
            <div className="grid gap-3">
              {(current.options as string[] | undefined)?.map((opt: string) => {
                const isOther = opt.startsWith('Outro');
                const arr = (tempProfile[current.field as keyof UserProfile] as string[]) || [];
                const selected = arr.includes(opt) || (isOther && arr.some(i => i.startsWith('Outro')));

                return (
                  <div key={opt}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        if (isOther) {
                          if (selected) {
                            setTempProfile({ ...tempProfile, [current.field!]: arr.filter(i => !i.startsWith('Outro')) });
                          } else {
                            setTempProfile({ ...tempProfile, [current.field!]: [...arr, 'Outro: '] });
                          }
                        } else {
                          const nextArr = selected ? arr.filter(i => i !== opt) : [...arr, opt];
                          setTempProfile({ ...tempProfile, [current.field!]: nextArr });
                        }
                      }}
                      className={`w-full min-h-14 p-4 sm:p-5 text-left border-2 rounded-2xl font-bold text-base transition-all ${selected ? 'border-accent bg-accent text-paper shadow-sm' : 'border-line hover:border-accent bg-white/70'}`}
                    >
                      {opt}
                    </button>
                    {isOther && selected && (
                      <div className="mt-2">
                        <label htmlFor={`diagnosis-${current.id}-other`} className="mb-1.5 block text-sm font-semibold text-ink">Descreva sua resposta</label>
                        <input
                          id={`diagnosis-${current.id}-other`}
                          type="text"
                          autoFocus
                          placeholder="Descreva aqui..."
                          className="input-field min-h-12"
                          value={arr.find(i => i.startsWith('Outro'))?.replace(/^Outro[s]?:\s*/, '') || ''}
                          onChange={(e) => {
                            const newArr = arr.filter(i => !i.startsWith('Outro'));
                            newArr.push('Outro: ' + e.target.value);
                            setTempProfile({ ...tempProfile, [current.field!]: newArr });
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        {current.type === 'measurements' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Altura (cm)" htmlFor="diagnosis-height" required error={fieldErrors.height}>
                <input
                  id="diagnosis-height"
                  type="number"
                  min="80"
                  max="250"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ex: 170"
                  className="input-field min-h-14 text-lg font-bold"
                  value={tempProfile.height || ''}
                  onChange={(e) => {
                    setTempProfile({ ...tempProfile, height: parseFloat(e.target.value) || 0 });
                    setFieldErrors(previous => ({ ...previous, height: undefined }));
                  }}
                />
              </FormField>
              <FormField label="Peso atual (kg)" htmlFor="diagnosis-weight" required error={fieldErrors.weight}>
                <input
                  id="diagnosis-weight"
                  type="number"
                  min="20"
                  max="350"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ex: 70.5"
                  className="input-field min-h-14 text-lg font-bold"
                  value={tempProfile.weightEvolution?.[0]?.value || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    setTempProfile({ ...tempProfile, weightEvolution: [{ date, value: val }] });
                    setFieldErrors(previous => ({ ...previous, weight: undefined }));
                  }}
                />
              </FormField>
            </div>

            <div className="p-4 bg-accent/10 border border-accent/20 rounded-2xl flex gap-3 items-center">
              <Sparkles className="text-accent shrink-0" size={22} />
              <p className="text-xs font-medium text-ink/75 leading-relaxed">
                Sua altura e peso nos ajudam a calibrar estimativas de energia de forma acolhedora e privativa.
              </p>
            </div>
          </div>
        )}

        <div className="hidden pt-2 md:block">
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {current.type === 'measurements' ? 'Finalizar e acessar meu espaço' : current.type === 'multiselect' ? 'Confirmar escolhas' : 'Continuar'}
          </Button>
        </div>
      </form>
    </PageContainer>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:hidden">
      <Button type="submit" form="diagnosis-form" size="lg" fullWidth loading={submitting}>
        {current.type === 'measurements' ? 'Finalizar e acessar meu espaço' : current.type === 'multiselect' ? 'Confirmar escolhas' : 'Continuar'}
      </Button>
    </div>
    </>
  );
}
