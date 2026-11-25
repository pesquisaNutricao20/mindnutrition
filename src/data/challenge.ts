// Roteiro do Desafio de 21 Dias — proposta interna Mind Nutrition / NutConsciente.
// Missões e limiares são propostas de produto para discussão, não resultados validados.

export interface Mission {
  day: number;
  week: number;
  title: string;
  activity: string;
}

const RAW_MISSIONS: [string, string][] = [
  ['Meu ponto de partida', 'Registrar uma refeição e responder: o que quero compreender melhor sobre minha alimentação?'],
  ['Reconhecendo minha fome', 'Observar os sinais físicos de fome antes de uma refeição, sem tentar modificá-los.'],
  ['Alimentação e emoções', 'Reconhecer uma emoção presente antes ou depois de comer.'],
  ['Onde e como eu como?', 'Perceber local, companhia, ritmo da refeição e possíveis distrações.'],
  ['Conhecendo meu sono', 'Descrever como acordou e perceber a disposição ao longo do dia.'],
  ['As cores da alimentação', 'Registrar uma refeição por foto ou descrição e observar a variedade, sem atribuir nota.'],
  ['Minha primeira descoberta', 'Revisar a semana e escrever uma observação que chamou a atenção.'],
  ['Meus gatilhos', 'Reconhecer uma situação que alterou a vontade de comer, sem julgar a resposta.'],
  ['Uma pausa consciente', 'Fazer uma breve pausa antes de comer e observar fome, pensamentos e emoções.'],
  ['Depois da refeição', 'Observar sensações físicas e emocionais após uma refeição.'],
  ['Sabores e sensações', 'Durante uma refeição, prestar atenção em aromas, sabores e texturas.'],
  ['Sono e disposição', 'Comparar o descanso percebido com o humor e a disposição do dia.'],
  ['Acolhendo emoções', 'Experimentar um cuidado possível diante de uma emoção difícil, se desejar.'],
  ['Conectando os pontos', 'Revisar registros e identificar hipóteses de padrões, sem concluir causalidade.'],
  ['Minha primeira meta', 'Definir uma meta pequena, pessoal e viável de autocuidado.'],
  ['Refeição consciente', 'Praticar atenção aos sinais do corpo durante parte de uma refeição.'],
  ['Gentileza comigo', 'Perceber uma autocrítica alimentar e formular uma resposta acolhedora.'],
  ['Cuidando do descanso', 'Planejar uma pequena ação que possa favorecer uma rotina de sono.'],
  ['Meu plano de cuidado', 'Escolher uma estratégia possível diante de situações emocionalmente difíceis.'],
  ['Comer com flexibilidade', 'Refletir sobre convivência, prazer, necessidades e liberdade alimentar.'],
  ['Minha jornada continua', 'Revisar descobertas e decidir quais práticas deseja manter.'],
];

export const CHALLENGE_MISSIONS: Mission[] = RAW_MISSIONS.map(([title, activity], index) => ({
  day: index + 1,
  week: Math.floor(index / 7) + 1,
  title,
  activity,
}));

export const WEEK_BADGES = [
  { week: 1, name: 'Explorador Consciente', stage: 'Broto no jardim' },
  { week: 2, name: 'Explorador das Emoções', stage: 'Planta jovem' },
  { week: 3, name: 'Cultivador de Hábitos', stage: 'Jardim florescendo' },
];

export const CHALLENGE_ACTIVITIES = [
  { key: 'meal', label: 'Refeição', hint: 'Descreva ou registre uma refeição' },
  { key: 'sleep', label: 'Sono', hint: 'Observe seu descanso' },
  { key: 'mood', label: 'Humor e emoções', hint: 'Nomeie como se sente' },
  { key: 'mission', label: 'Missão do dia', hint: 'Pratique a proposta do dia' },
] as const;

export type ChallengeActivityKey = typeof CHALLENGE_ACTIVITIES[number]['key'];

export function dayPoints(day: Partial<Record<ChallengeActivityKey, boolean>>): number {
  return CHALLENGE_ACTIVITIES.reduce((sum, activity) => sum + (day[activity.key] ? 10 : 0), 0);
}

export function isDayComplete(day: Partial<Record<ChallengeActivityKey, boolean>>): boolean {
  return dayPoints(day) >= 30;
}

export function gardenStage(completedDays: number): string {
  if (completedDays >= 15) return 'Jardim florescendo';
  if (completedDays >= 10) return 'Planta jovem';
  if (completedDays >= 4) return 'Broto';
  if (completedDays >= 1) return 'Semente germinando';
  return 'Semente';
}

export function challengeFeedback(day: Partial<Record<ChallengeActivityKey, boolean>>): string {
  if (!day.mood && !day.meal && !day.sleep && !day.mission) {
    return 'Você pode continuar de onde parou. Cada registro é uma nova oportunidade de observar seus hábitos.';
  }
  if (day.mission) {
    return 'Você reservou um momento para perceber suas experiências. Essa observação já faz parte da sua jornada.';
  }
  if (day.meal) {
    return 'Registrar uma refeição já é um ato de atenção. Não existem respostas certas ou erradas.';
  }
  return 'Observar o corpo e o descanso também é cuidar. Você pode completar o que quiser, sem pressa.';
}
