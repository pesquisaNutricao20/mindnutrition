import { useState } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { ConfirmationModal } from '../components/shared/ConfirmationModal';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import type { Page } from '../types';

export function PrivacySettingsPage({
  currentUserId,
  onDeleteData,
  onNavigate
}: {
  currentUserId: string | null;
  onDeleteData: () => void | boolean | Promise<void | boolean>;
  onNavigate: (page: Page) => void;
}) {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  return (
    <PageContainer variant="narrow" hasTopbar={false} className="space-y-6">
      <PageHeader
        title="Privacidade"
        subtitle="Entenda onde seus dados ficam salvos e como removê-los."
        back={{ label: 'Voltar ao perfil', onClick: () => onNavigate('profile') }}
      />
      <section className="space-y-5 rounded-[2rem] border border-line bg-white p-6 shadow-sm" aria-labelledby="privacy-storage-title">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-4">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h3 id="privacy-storage-title" className="text-base font-bold text-ink">
              {currentUserId ? 'Sincronização da conta' : 'Armazenamento neste aparelho'}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink/65">
              {currentUserId
                ? 'Seu perfil é salvo neste aparelho e o app tenta sincronizá-lo com o servidor quando há uma sessão ativa. Se a conexão falhar, o registro local continua disponível.'
                : 'Seu perfil fica salvo neste aparelho. A sincronização com o servidor fica indisponível até que você entre novamente.'}
            </p>
          </div>
        </div>
        <div className="space-y-3 border-t border-line pt-5">
          <h3 className="text-base font-bold text-ink">Apagar dados</h3>
          <p className="text-sm leading-relaxed text-ink/65">Remove perfil, refeições, diário, sono e medidas{currentUserId ? ' da conta sincronizada' : ' deste aparelho'}. Esta ação não pode ser desfeita.</p>
          <Button variant="danger" fullWidth onClick={() => setShowDeleteConfirmation(true)}>
            <Trash2 size={16} aria-hidden="true" /> Apagar dados
          </Button>
        </div>
      </section>
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Apagar todos os dados?"
        description={currentUserId
          ? 'Seu perfil, refeições, diário, sono e medidas serão removidos da conta e deste aparelho. Esta ação não pode ser desfeita.'
          : 'Seu perfil, refeições, diário, sono e medidas serão removidos deste aparelho. Esta ação não pode ser desfeita.'}
        confirmLabel="Apagar dados"
        onConfirm={onDeleteData}
        onClose={() => setShowDeleteConfirmation(false)}
      />
    </PageContainer>
  );
}
