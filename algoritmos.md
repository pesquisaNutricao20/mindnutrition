# Algoritmos e Cálculos Nutricionais

Este documento descreve as fórmulas e algoritmos utilizados no sistema Mind Nutrition para calcular as necessidades nutricionais, diagnóstico e recomendações do usuário.

## 1. Índice de Massa Corporal (IMC)

O IMC é uma medida internacional usada para calcular se uma pessoa está no peso ideal.

Equação:
$$ IMC = \frac{Peso}{Altura^2} $$
Onde:
- $Peso$ está em quilogramas (kg)
- $Altura$ está em metros (m)

**Classificação do IMC:**
- Abaixo de 18,5: Abaixo do peso
- Entre 18,5 e 24,9: Peso normal
- Entre 25,0 e 29,9: Sobrepeso
- Entre 30,0 e 34,9: Obesidade Grau I
- Entre 35,0 e 39,9: Obesidade Grau II
- Acima de 40: Obesidade Grau III (Mórbida)

## 2. Taxa Metabólica Basal (TMB / RMC - Resting Metabolic Rate)

Utilizamos a Equação de Harris-Benedict revisada (Mifflin-St Jeor), que é considerada mais precisa para o cálculo da Taxa Metabólica Basal atual.

**Para Homens:**
$$ TMB = (10 \times Peso) + (6.25 \times Altura) - (5 \times Idade) + 5 $$

**Para Mulheres:**
$$ TMB = (10 \times Peso) + (6.25 \times Altura) - (5 \times Idade) - 161 $$

Onde:
- $Peso$ está em quilogramas (kg)
- $Altura$ está em centímetros (cm)
- $Idade$ está em anos

## 3. Necessidade Energética Total (NET)

A NET é calculada multiplicando a TMB pelo Fator de Atividade Física (FA) do usuário.

$$ NET = TMB \times FA $$

**Fatores de Atividade (FA):**
- **Sedentário** (pouco ou nenhum exercício): $1.2$
- **Levemente ativo** (exercício leve 1-3 dias/semana): $1.375$
- **Moderadamente ativo** (exercício moderado 3-5 dias/semana): $1.55$
- **Muito ativo** (exercício pesado 6-7 dias/semana): $1.725$
- **Extremamente ativo** (exercício muito pesado, trabalho braçal): $1.9$

## 4. Distribuição de Macronutrientes

Com base nos objetivos do usuário, distribuímos as calorias (NET) nos seguintes macronutrientes:
- 1 grama de Carboidrato = 4 kcal
- 1 grama de Proteína = 4 kcal
- 1 grama de Gordura = 9 kcal

**Para Emagrecimento Consciente:**
- Déficit calórico: $-300 \text{ a } -500 \text{ kcal}$ na NET
- Proteínas: $1.6 \text{ a } 2.0 \text{ g/kg}$
- Gorduras: $0.8 \text{ a } 1.0 \text{ g/kg}$
- Carboidratos: Restante das calorias

**Para Hipertrofia:**
- Superávit calórico: $+300 \text{ a } +500 \text{ kcal}$ na NET
- Proteínas: $1.8 \text{ a } 2.2 \text{ g/kg}$
- Gorduras: $1.0 \text{ g/kg}$
- Carboidratos: Restante das calorias

## Algoritmo Funcional (TypeScript)

```typescript
export function calculateNutritionalNeeds(
  weight: number, 
  heightCm: number, 
  age: number, 
  gender: 'M' | 'F', 
  activityLevel: number,
  goal: 'lose' | 'maintain' | 'gain'
) {
  // 1. Calcular IMC
  const heightM = heightCm / 100;
  const imc = weight / (heightM * heightM);

  // 2. Calcular TMB (Mifflin-St Jeor)
  let tmb = (10 * weight) + (6.25 * heightCm) - (5 * age);
  tmb = gender === 'M' ? tmb + 5 : tmb - 161;

  // 3. Calcular NET
  let net = tmb * activityLevel;

  // 4. Ajustar de acordo com o objetivo
  if (goal === 'lose') {
    net -= 400; // Déficit de 400 kcal
  } else if (goal === 'gain') {
    net += 400; // Superávit de 400 kcal
  }

  // 5. Calcular Macronutrientes (exemplo balanceado)
  const proteinGrams = weight * 1.8; // 1.8g/kg
  const fatGrams = weight * 0.9; // 0.9g/kg
  
  const proteinKcal = proteinGrams * 4;
  const fatKcal = fatGrams * 9;
  
  const carbKcal = net - (proteinKcal + fatKcal);
  const carbGrams = carbKcal / 4;

  return {
    imc: parseFloat(imc.toFixed(2)),
    tmb: Math.round(tmb),
    net: Math.round(net),
    macros: {
      protein: Math.round(proteinGrams),
      fat: Math.round(fatGrams),
      carbs: Math.round(carbGrams)
    }
  };
}
```

## 5. Consciência geral e Insights integrados

Os Insights não produzem diagnóstico, prescrição ou classificação clínica. Eles organizam os sinais registrados pelo usuário para facilitar a reflexão sobre rotina, fome, sono, emoções e medidas.

### Componentes e pesos

O índice é uma média ponderada apenas dos componentes que possuem dados válidos. Assim, a ausência de um diário ou registro de sono não reduz artificialmente a pontuação.

| Componente | Peso máximo | Sinais considerados |
| --- | ---: | --- |
| Refeições | 45% | Fome escolhida, saciedade, humor, anotações, fotos e consistência |
| Sono | 25% | Horas próximas de 8h e qualidade relatada |
| Diário | 15% | Humor relatado e detalhe da reflexão |
| Perfil | 15% | Identificação, medidas, objetivo e contexto inicial |

Para cada componente disponível, aplica-se:

$$ Consciência = \frac{\sum(valor_i \times peso_i)}{\sum(peso_i\ disponível)} $$

Também é exibida a cobertura dos sinais (soma dos pesos com dados). Isso deixa claro quando a leitura ainda é preliminar.

### Faixas de representação

- **0–29:** ponto de partida; o foco é criar registros mínimos sem julgamento.
- **30–49:** observação inicial; consistência torna os padrões mais claros.
- **50–69:** construção sólida; há sinais suficientes para comparar contexto e escolhas.
- **70–84:** boa conexão entre corpo, contexto e rotina.
- **85–100:** registros consistentes e contextualizados; manter a gentileza em dias difíceis continua sendo importante.

As frases exibidas na interface descrevem a faixa e nunca devem ser interpretadas como avaliação médica ou psicológica.

## 6. Integridade e validação dos dados

- Nome: 1 a 80 caracteres; textos livres possuem limite para evitar entradas acidentais excessivas.
- Idade: 10 a 120 anos; altura: 80 a 250 cm; peso: 20 a 350 kg.
- Circunferências corporais: valores positivos e limites plausíveis antes do salvamento.
- Uma medida por tipo e dia: um novo valor no mesmo dia corrige o registro existente, em vez de duplicá-lo.
- Registros de medidas, diário, sono e refeições podem ser removidos quando incorretos. A remoção atualiza a leitura dos Insights.
- Notificações: no máximo três simultâneas; mensagens idênticas não são empilhadas.

## 7. Resumo de IA conectado aos sinais

O resumo de IA é opcional e só é gerado quando a pessoa escolhe o botão nos Insights. O cliente envia os registros ao endpoint interno `/api/ai-insight`; o servidor reduz, anonimiza e limita os dados antes de chamar o modelo `minimax/minimax-m3:free` pela OpenRouter.

### Preparação do contexto

1. Selecionar no máximo 30 refeições recentes, 7 registros de sono, 5 entradas de diário e 4 medições por tipo.
2. Remover nome, e-mail, fotos e identificadores. Textos livres são compactados e truncados.
3. Organizar os sinais de fome, saciedade, humor, qualidade/horas de sono, diário, evolução corporal, objetivo e a pontuação determinística de consciência.
4. Pedir ao modelo uma abertura acolhedora e três observações breves sobre relações que apareçam nos dados.
5. Impedir diagnóstico, prescrição alimentar/calórica, culpa e invenção de dados. Quando a cobertura for baixa, o modelo deve explicitar a limitação e propor um registro simples.

A chave `OPEN_ROUTER_KEY` fica exclusivamente no processo do servidor. Ela nunca deve ser enviada ao navegador, incluída em variáveis `VITE_*`, commits ou logs.
