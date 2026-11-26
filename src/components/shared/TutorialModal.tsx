import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal = ({ isOpen, onClose }: TutorialModalProps) => (
  <Overlay
    open={isOpen}
    onClose={onClose}
    title="Como Funciona o Mind Nutrition?"
    description="Três passos para observar sua alimentação com mais presença e gentileza."
    size="lg"
    footer={<Button fullWidth onClick={onClose}>Começar a Explorar</Button>}
  >
    <div className="space-y-4">
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">1</div>
        <div>
          <h3 className="font-bold text-sm">Pausa & Observação Pré-Refeição</h3>
          <p className="text-xs text-ink/65 mt-1">Antes de comer, reserve 30 segundos para avaliar sua fome de 0 a 10 e reconhecer suas emoções.</p>
        </div>
      </div>
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">2</div>
        <div>
          <h3 className="font-bold text-sm">Registro Gentil da Refeição</h3>
          <p className="text-xs text-ink/65 mt-1">Tire fotos, anote sabores e texturas sem foco em calorias ou regras rígidas.</p>
        </div>
      </div>
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-line">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 font-bold">3</div>
        <div>
          <h3 className="font-bold text-sm">Saciedade & Autoconhecimento</h3>
          <p className="text-xs text-ink/65 mt-1">Após comer, avalie seu nível de satisfação (0 a 5) e veja seus padrões no painel de Insights.</p>
        </div>
      </div>
    </div>
  </Overlay>
);
