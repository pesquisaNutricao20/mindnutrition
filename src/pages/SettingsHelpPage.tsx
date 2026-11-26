import { Heart, Mail } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import type { Page } from '../types';

export function SettingsHelpPage({
  onNavigate
}: {
  onNavigate: (page: Page) => void;
}) {
  return (
    <PageContainer variant="narrow" hasTopbar={false} className="space-y-6">
      <PageHeader
        title="Ajuda & contato"
        subtitle="Fale com a equipe para tirar dúvidas sobre o app e sua jornada."
        back={{ label: 'Voltar ao perfil', onClick: () => onNavigate('profile') }}
      />
      <section className="space-y-5 rounded-[2rem] border border-line bg-white p-6 shadow-sm" aria-labelledby="help-team-title">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Heart size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 id="help-team-title" className="text-base font-bold text-ink">Equipe Mind Nutrition</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">Estamos à disposição para tirar dúvidas e acolher você.</p>
          </div>
        </div>
        <div className="space-y-3">
          <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-accent">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><FaWhatsapp size={18} aria-hidden="true" /></div>
            <div className="min-w-0">
              <span className="block text-sm font-bold text-ink">WhatsApp da equipe</span>
              <span className="mt-0.5 block text-xs text-ink/60">(11) 99999-9999</span>
            </div>
          </a>
          <a href="mailto:contato@mindnutrition.app" className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-accent">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-secondary/15 text-accent-secondary"><Mail size={16} aria-hidden="true" /></div>
            <div className="min-w-0">
              <span className="block text-sm font-bold text-ink">E-mail de suporte</span>
              <span className="mt-0.5 block break-all text-xs text-ink/60">contato@mindnutrition.app</span>
            </div>
          </a>
        </div>
      </section>
    </PageContainer>
  );
}
