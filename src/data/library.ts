import { Coffee, Heart, Leaf, Moon, Sparkles } from 'lucide-react';

export const getReadingDuration = (article: { summary?: string; content?: string[] }) => {
  const words = [article.summary || '', ...(article.content || [])]
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min`;
};

export const DEFAULT_LIBRARY_ARTICLES = [
  {
    id: 'fome-fisica-emocional',
    title: 'Fome Física vs Fome Emocional',
    duration: '4 min',
    icon: Heart,
    type: 'Consciência Alimentar',
    image: 'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=800',
    summary: 'Aprenda a diferenciar os sinais do seu corpo e acolher suas vontades com gentileza.',
    content: [
      'A fome fisiológica caracteriza-se pela necessidade biológica de ingestão de alimentos para manutenção das demandas energéticas e nutricionais do organismo, apresentando-se geralmente de maneira gradual e sendo reduzida após a ingestão alimentar.',
      'A fome emocional refere-se ao comportamento de comer desencadeado ou influenciado por estados emocionais, como ansiedade, tristeza, estresse, frustração ou tédio, podendo acontecer independentemente da necessidade energética e estar associado à busca por alimentos específicos e mais palatáveis.',
      'Observar a origem da sua vontade de comer não serve para você se julgar ou se restringir. Serve para dar ao corpo exatamente o que ele precisa: alimento nutritivo quando há fome biológica, ou descanso, acolhimento e carinho quando há uma necessidade emocional.'
    ],
    sourceLabel: 'Prof. Wanderleia da Consolação Paiva'
  },
  {
    id: 'mindful-eating-pausa',
    title: 'Mindful Eating: A Arte da Pausa',
    duration: '3 min',
    icon: Leaf,
    type: 'Prática Consciente',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800',
    summary: 'Como três respirações profundas antes da refeição transformam sua digestão e saciedade.',
    content: [
      'Comer no piloto automático, olhando telas ou sob pressa, impede o cérebro de registrar os sinais naturais de saciedade emitidos pelo estômago e pelo trato gastrointestinal.',
      'Fazer uma breve pausa de 30 segundos antes da primeira garfada: observar as cores, os aromas e agradecer pelo prato ativa o sistema nervoso parassimpático, preparando as enzimas digestivas.',
      'Comer devagar e saborear cada textura traz satisfação genuína com quantidades confortáveis de comida.'
    ],
    sourceLabel: 'Abordagem Mind Nutrition'
  },
  {
    id: 'sono-ultraprocessados',
    title: 'Comida de tirar o sono',
    duration: '3 min',
    icon: Moon,
    type: 'Sono e alimentação',
    image: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800',
    summary: 'Como ultraprocessados, cafeína e refeições pesadas podem atrapalhar suas noites.',
    content: [
      'Os ultraprocessados podem interferir no funcionamento de hormônios como a melatonina, aumentar a inflamação e tornar a digestão mais lenta - fatores que podem incomodar na hora de dormir.',
      'Refrigerantes e energéticos, doces e sobremesas, além de lanches tipo fast food, estão entre os exemplos citados por reunirem cafeína, açúcar, gordura e sal em níveis que podem prejudicar o relaxamento e o sono profundo.',
      'Em vez de buscar perfeição, observe com curiosidade: o que você costuma comer e beber nas horas que antecedem o sono? Pequenos ajustes na rotina podem ser um bom ponto de partida.'
    ],
    sourceLabel: 'Hospital Alemão Oswaldo Cruz',
    sourceUrl: 'https://www.hospitaloswaldocruz.org.br/imprensa/hospital-na-midia/comida-de-tirar-o-sono-como-os-ultraprocessados-prejudicam-as-suas-noites/'
  },
  {
    id: 'sono-comportamento-alimentar',
    title: 'Sono, apetite e escolhas alimentares',
    duration: '5 min',
    icon: Coffee,
    type: 'Ciência do sono',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
    summary: 'Entenda a relação entre menos sono, sinais de fome e escolhas alimentares.',
    content: [
      'A privação de sono pode aumentar a grelina, hormônio associado à fome, e reduzir a leptina, relacionada à saciedade. Essa combinação tende a intensificar o apetite.',
      'Alterações no sono também podem influenciar o comportamento alimentar, favorecendo escolhas mais frequentes de alimentos doces e de maior densidade energética em momentos de cansaço.',
      'Esse conhecimento não é motivo para culpa: ele ajuda a entender que sono, alimentação e emoções fazem parte da mesma rotina de cuidado.'
    ],
    sourceLabel: 'Padrões de sono, comportamento alimentar e o risco de doenças não transmissíveis',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10255419/'
  },
  {
    id: 'autocompaixao-alimentacao',
    title: 'Autocompaixão contra o ciclo de dietas',
    duration: '4 min',
    icon: Sparkles,
    type: 'Cuidado Emocional',
    image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=800',
    summary: 'Por que a autocrítica piora a compulsão e como a gentileza restaura o equilíbrio.',
    content: [
      'Dietas restritivas e regras extremas geram estresse mental. Quando um deslize acontece, a autocrítica frequente desencadeia a sensação de fracasso e novos episódios de exagero.',
      'A autocompaixão consiste em tratar a si mesmo com a mesma bondade que você ofereceria a um amigo querido em um momento difícil.',
      'Cada dia e cada refeição são uma nova oportunidade para recomeçar com calma e carinho com seu corpo.'
    ],
    sourceLabel: 'Dr. Kristin Neff - Mindful Self-Compassion'
  }
];
