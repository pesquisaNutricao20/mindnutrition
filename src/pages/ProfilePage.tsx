import { useState } from 'react';
import { Activity, Camera, Edit2, HelpCircle, Info, Lock, LogOut, MessageCircle, PenTool } from 'lucide-react';
import { ConfirmationModal } from '../components/shared/ConfirmationModal';
import { MetricsModal } from '../components/shared/MetricsModal';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/ui/PageContainer';
import { ProfileAvatar } from '../components/ui/ProfileAvatar';
import { calculateNutritionalNeeds, getImcInterpretation } from '../lib/profile';
import type { Page, UserProfile } from '../types';

export function ProfilePageComponent({
  userProfile,
  onNavigate,
  onOpenDiary,
  onSaveProfile,
  onOpenCare,
  onOpenHungerGuide,
  onLogout,
  toast
}: {
  userProfile: UserProfile;
  onNavigate: (page: Page) => void;
  onOpenDiary: () => void;
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
  onOpenCare: (tab: 'chat' | 'appointments') => void;
  onOpenHungerGuide: () => void;
  onLogout: () => void | Promise<void>;
  toast: any;
}) {
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const latestWeight = userProfile.weightEvolution?.[userProfile.weightEvolution.length - 1]?.value;
  const latestWaist = userProfile.waistEvolution?.[userProfile.waistEvolution.length - 1]?.value;
  const latestHip = userProfile.hipEvolution?.[userProfile.hipEvolution.length - 1]?.value;
  const liveNeeds = latestWeight && userProfile.height
    ? calculateNutritionalNeeds(
      latestWeight,
      userProfile.height,
      userProfile.age || 25,
      userProfile.gender || 'Feminino',
      userProfile.activityLevel || 1.2,
      userProfile.objectives || []
    )
    : null;
  const currentImc = userProfile.imc ?? liveNeeds?.imc ?? null;
  const imcInterpretation = getImcInterpretation(currentImc);
  const currentTmb = userProfile.tmb ?? liveNeeds?.tmb ?? null;

  const profileActions = [
    { label: 'Editar Dados', icon: Edit2, page: 'settings-account' },
    { label: 'Privacidade', icon: Lock, page: 'settings-privacy' },
    { label: 'Ajuda & Contato', icon: HelpCircle, page: 'settings-help' },
  ];

  return (
    <PageContainer variant="wide" className="max-w-4xl space-y-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-sm md:p-8">
        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <div className="relative shrink-0">
            <ProfileAvatar photo={userProfile.photo} size="xl" className="border-4 border-paper shadow-xl" />
            <button
              type="button"
              onClick={() => onNavigate('settings-account')}
              aria-label="Alterar foto e dados do perfil"
              className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white bg-accent text-paper shadow-lg"
            >
              <Camera size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <span className="label-sm text-accent">Perfil Pessoal</span>
            <h2 className="section-title mt-1">{userProfile.name || 'Seu Perfil'}</h2>
            <p className="mt-1 text-xs font-medium text-ink/55 sm:text-sm">{userProfile.email || 'E-mail do perfil não informado'}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
              <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold">Gênero: {userProfile.gender || 'Não informado'}</span>
              <span className="px-3 py-1 rounded-full bg-paper border border-line text-ink/70 text-xs font-bold">Idade: {userProfile.age ? `${userProfile.age} anos` : 'Não informada'}</span>
              {(userProfile.objectives || []).slice(0, 2).map((item) => (
                <span key={item} className="px-3 py-1 rounded-full bg-accent-secondary/15 text-accent-secondary text-xs font-bold">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="profile-metrics-title">
        <h3 id="profile-metrics-title" className="label-sm mb-3 text-accent">Suas métricas</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 bg-white p-4 rounded-2xl border border-line sm:col-span-1">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-accent">IMC atual</span><button type="button" onClick={() => toast('IMC é uma relação entre peso e altura usada como triagem. Ele não diagnostica saúde e precisa ser interpretado no seu contexto.', 'info')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent text-xs font-bold text-accent" aria-label="Entender IMC"><Info size={15} aria-hidden="true" /></button></div>
          <div className="mt-2 flex items-end justify-between gap-3"><span className="text-3xl font-display">{currentImc ?? '--'}</span><span className={`text-right text-xs font-bold ${imcInterpretation.tone}`}>{imcInterpretation.label}</span></div>
          <p className="mt-2 text-xs leading-relaxed text-ink/55">{imcInterpretation.description}</p>
        </div>
        <div className="col-span-2 bg-white p-4 rounded-2xl border border-line sm:col-span-1">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-accent-secondary">TMB estimada</span><button type="button" onClick={() => toast('TMB é a energia mínima que seu corpo usa em repouso para funções vitais. É uma estimativa, não uma meta alimentar isolada.', 'info')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent-secondary text-xs font-bold text-accent-secondary" aria-label="Entender TMB"><Info size={15} aria-hidden="true" /></button></div>
          <div className="mt-2 text-3xl font-display">{currentTmb ?? '--'}<span className="ml-1 text-sm font-sans font-bold text-ink/55">kcal/dia</span></div>
          <p className="mt-2 text-xs leading-relaxed text-ink/55">Energia estimada em repouso, antes da atividade do dia.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-line text-center">
          <span className="block text-xs font-bold text-ink/55">Peso</span>
          <span className="text-2xl font-display">{latestWeight ? `${latestWeight} kg` : '--'}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-line text-center">
          <span className="block text-xs font-bold text-ink/55">Altura</span>
          <span className="text-2xl font-display">{userProfile.height ? `${userProfile.height} cm` : '--'}</span>
        </div>
        </div>
      </section>

      <section aria-labelledby="profile-journey-title">
        <h3 id="profile-journey-title" className="label-sm mb-3 text-accent">Sua jornada</h3>
        <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => onOpenCare('chat')}
          className="sm:hidden"
        >
          <MessageCircle size={15} aria-hidden="true" /> Abrir conversa
        </Button>
        <Button variant="secondary" onClick={onOpenHungerGuide}>
          <HelpCircle size={15} aria-hidden="true" /> Fome Física x Emocional
        </Button>
        <Button onClick={() => setShowMetricsModal(true)}>
          <Activity size={15} aria-hidden="true" /> Atualizar métricas
        </Button>
      </div>
      </section>

      {/* Diário do Usuário */}
      {(userProfile.dailyNotes && userProfile.dailyNotes.length > 0) && (
        <div className="bg-white border border-line p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <PenTool size={18} className="text-accent" /> Anotações do Diário ({userProfile.dailyNotes.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={onOpenDiary} className="shrink-0">
              <PenTool size={14} aria-hidden="true" /> Nova anotação
            </Button>
          </div>
          <div className="space-y-3">
            {userProfile.dailyNotes.map((note) => (
              <div key={note.id} className="p-4 rounded-2xl bg-paper border border-line/60">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-accent">{note.date} · Humor: {note.mood || 'Neutro'}</span>
                </div>
                <p className="text-xs sm:text-sm text-ink/80 font-medium">"{note.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <section aria-labelledby="profile-settings-title">
        <h3 id="profile-settings-title" className="label-sm mb-3 text-accent">Configurações</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {profileActions.map((item) => (
            <button key={item.label} type="button" onClick={() => onNavigate(item.page as Page)} className="min-h-24 rounded-3xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-accent hover:bg-accent/5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-ink/5 text-ink/70">
                <item.icon size={18} aria-hidden="true" />
              </div>
              <span className="text-xs font-bold sm:text-sm">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col items-center gap-3 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toast('Mind Nutrition v1.2 - Desenvolvido com carinho para seu bem-estar alimentar.', 'info', 4000)}
        >
          <HelpCircle size={15} aria-hidden="true" /> Sobre o Mind Nutrition
        </Button>
        <Button variant="danger" fullWidth onClick={() => setShowExitConfirmation(true)}>
          <LogOut size={16} aria-hidden="true" /> Sair
        </Button>
      </div>
      <ConfirmationModal
        isOpen={showExitConfirmation}
        title="Sair da conta?"
        description="Você precisará entrar novamente. Os dados sincronizados continuam na sua conta e os dados locais deste aparelho serão apagados."
        confirmLabel="Sair"
        onConfirm={onLogout}
        onClose={() => setShowExitConfirmation(false)}
      />
      <MetricsModal
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
        userProfile={userProfile}
        onSaveProfile={onSaveProfile}
        toast={toast}
      />
    </PageContainer>
  );
}
