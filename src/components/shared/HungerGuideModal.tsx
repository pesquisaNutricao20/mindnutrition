import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

export const HUNGER_DEFINITIONS = {
  fisica: {
    title: 'Fome fisiológica (Física)',
    description: 'A fome fisiológica caracteriza-se pela necessidade biológica de ingestão de alimentos para manutenção das demandas energéticas e nutricionais do organismo, apresentando-se geralmente de maneira gradual e sendo reduzida após a ingestão alimentar.',
    signals: [
      'Aparece gradualmente ao longo do tempo',
      'Estômago vazio, sensação física de abertura ou ronco',
      'Aceita diferentes opções de alimentos saudáveis',
      'Reduzida e satisfeita após a ingestão alimentar',
      'Sensação de saciedade sem sentimento de culpa'
    ]
  },
  emocional: {
    title: 'Fome emocional',
    description: 'A fome emocional refere-se ao comportamento de comer desencadeado ou influenciado por estados emocionais, como ansiedade, tristeza, estresse, frustração ou tédio, podendo acontecer independentemente da necessidade energética e estar associado à busca por alimentos específicos e mais palatáveis.',
    signals: [
      'Surge de repente com sensação de urgência',
      'Busca por alimentos específicos e muito palatáveis (doces, massas, salgados)',
      'Desencadeada por sentimentos (ansiedade, estresse, tédio, solidão)',
      'Pode persistir mesmo após o estômago estar cheio',
      'Frequentemente acompanhada por culpa ou arrependimento'
    ]
  }
};

interface HungerGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HungerGuideModal = ({ isOpen, onClose }: HungerGuideModalProps) => (
  <Overlay
    open={isOpen}
    onClose={onClose}
    title="Fome Física x Fome Emocional"
    description="Escute os sinais do seu corpo com carinho. Use estas orientações para identificar sua real necessidade no momento."
    size="lg"
    footer={<Button fullWidth onClick={onClose}>Entendi, obrigado(a)</Button>}
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-3xl border border-accent/25 bg-accent/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full bg-accent inline-block" />
          <h3 className="font-bold text-accent text-base sm:text-lg">{HUNGER_DEFINITIONS.fisica.title}</h3>
        </div>
        <p className="text-xs sm:text-sm text-ink/80 leading-relaxed italic mb-3">
          "{HUNGER_DEFINITIONS.fisica.description}"
        </p>
        <ul className="space-y-1.5 text-xs text-ink/70">
          {HUNGER_DEFINITIONS.fisica.signals.map((signal, index) => (
            <li key={index} className="flex items-start gap-1.5">• <span>{signal}</span></li>
          ))}
        </ul>
      </section>
      <section className="rounded-3xl border border-accent-secondary/30 bg-accent-secondary/10 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full bg-accent-secondary inline-block" />
          <h3 className="font-bold text-accent-secondary text-base sm:text-lg">{HUNGER_DEFINITIONS.emocional.title}</h3>
        </div>
        <p className="text-xs sm:text-sm text-ink/80 leading-relaxed italic mb-3">
          "{HUNGER_DEFINITIONS.emocional.description}"
        </p>
        <ul className="space-y-1.5 text-xs text-ink/70">
          {HUNGER_DEFINITIONS.emocional.signals.map((signal, index) => (
            <li key={index} className="flex items-start gap-1.5">• <span>{signal}</span></li>
          ))}
        </ul>
      </section>
    </div>
  </Overlay>
);
