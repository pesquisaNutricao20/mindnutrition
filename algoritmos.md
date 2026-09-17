# Algoritmos e indicadores do Mind Nutrition

Este documento descreve os cálculos encontrados no código em 9 de setembro de 2026: consciência geral, radar, classificação da fome, gráficos, medidas corporais e indicadores auxiliares. Registra a implementação existente, incluindo valores padrão e limitações; não constitui validação científica das fórmulas autorais.

O símbolo **%** nos indicadores de consciência, humor, energia, contexto e constância representa uma pontuação. Não corresponde a probabilidade, percentual de saúde ou medida clínica de consciência alimentar.

## 1. Fontes e mapa da implementação

A maior parte dos cálculos está em [App.tsx]. As estruturas estão em [types.ts]

| Resultado | Função ou trecho |
|---|---|
| IMC, TMB e necessidade energética | calculateNutritionalNeeds |
| Rótulo de IMC | getImcInterpretation |
| Conversões, médias e limites | toNumberOrNull, averageNumbers, clampNumber, normalizeText |
| Datas e último valor corporal | parseDateForSorting, sortMetricsChronologically, getLatestMetricValue, sanitizeProfileDefaults |
| Emoções | getMoodScore, isEmotionallyChargedMood, getInitialMoodBaseline |
| Classificação da fome | normalizeMealType, inferMealType |
| Pontuação do perfil | calculateProfileInsightScore |
| Pontuação das refeições | calculateMealAwarenessScore, calculateAwarenessScore |
| Consciência geral e cobertura | buildIntegratedInsight, getAwarenessNarrative |
| Radar | buildRadarData |
| Referência de peso | getWeightGoal |
| Relação cintura-quadril | buildRcqData; definida, sem chamada encontrada |
| Séries dos gráficos | ProgressPageComponent |
| Tempo de leitura | getReadingDuration |

## 2. Convenções e dados de entrada

~~~text
limitar(x, mínimo, máximo) = min(máximo, max(mínimo, x))
limitar(x) = limitar(x, 0, 100)
arred(x) = Math.round(x)
média(valores) = soma dos números finitos / quantidade de números finitos
~~~

**averageNumbers** ignora null, undefined, NaN, infinitos e valores que não sejam números. Retorna null se nenhum número for válido. **clampNumber** limita a faixa, mas não transforma NaN em zero.

**toNumberOrNull** aceita números finitos ou strings numéricas não vazias convertidas por Number. Retorna null para os demais casos. Não converte vírgula decimal: "7,5" não se torna 7.5. Também não valida faixa.

**normalizeText** remove acentos por NFD, converte para minúsculas e retira espaços nas extremidades. Não resolve sinônimos nem remove parênteses.

### 2.1 Campos e valores iniciais das refeições

Os cálculos consultam preHunger, postHunger, satisfaction, preMood, postMood, mood, notes, photos, image, type, inferredType e date.

No formulário consultado:

- preHunger começa em 5 e postHunger em null; não há controle ativo para editar essas intensidades no fluxo atual.
- hungerType começa em Física e pode ser escolhido entre Física e Emocional.
- preMood e postMood começam em Neutro.
- satisfaction começa em 4 e pode ser selecionada entre 0 e 5.
- Ao salvar, type e inferredType recebem a escolha hungerType. Apesar do nome, inferredType não é calculado nesse momento.
- mood recebe postMood || preMood. Como postMood já começa em Neutro, essa opção pode prevalecer mesmo sem uma escolha explícita.
- hungerDelta recebe postHunger − preHunger, ou null se postHunger for null.

As fórmulas de queda da fome usam a diferença oposta: **pré − pós**. Valores padrão podem gerar pontuação sem preenchimento explícito. Dados antigos/importados com ambas as intensidades ativam ramos que o formulário atual normalmente não ativa.

## 3. Pontuação das emoções

### 3.1 Tabela de getMoodScore

A busca é exata após normalização:

| Chaves reconhecidas | Pontos |
|---|---:|
| euforia | 90 |
| alegria, animado, animada | 84 |
| calmo, calma, calmo(a) | 76 |
| neutro | 60 |
| cansado, cansado(a) | 40 |
| ansioso, ansiosa, ansioso(a), ansiedade | 36 |
| tenso | 34 |
| estresse, estressado, estressada, estressado(a) | 32 |
| solitario, solitaria, solitario(a) | 32 |
| frustracao, frustrado(a), triste | 30 |
| raivoso, raivosa, raivoso(a) | 28 |
| deprimido, deprimida, deprimido(a) | 25 |
| culpa | 24 |
| Outra chave | null |

**isEmotionallyChargedMood** retorna verdadeiro quando a pontuação é reconhecida e menor ou igual a 40.

Opções da interface como **Alegre**, **Grato(a)** e **Animado(a)** não têm correspondência exata nessa tabela. Não recebem automaticamente os pontos de alegria/animado: podem ser ignoradas pela média do radar ou receber o substituto 58 no diário.

Os valores são constantes do software, não uma escala psicológica validada.

### 3.2 Humor inicial

getInitialMoodBaseline procura o humor do último elemento de checkIns. Se o texto existir, retorna getMoodScore desse texto, mesmo quando a resposta é null. Somente se não existir texto calcula a média das pontuações de initialEmotions.

## 4. Classificação de fome

normalizeMealType procura "fisica" ou "fisiologica" no texto normalizado; depois "emocional". Sem correspondência, retorna Não classificada.

inferMealType começa pelo tipo normalizado de **inferredType || type**. Não lê hungerType diretamente.

Sem números de fome/satisfação e sem texto de humor, retorna o tipo existente reconhecido ou, na ausência dele, **Física**.

Se houver sinais, soma dois acumuladores:

| Condição | Físicos | Emocionais |
|---|---:|---:|
| Fome pré ≥ 6 | +3 | 0 |
| Fome pré = 5 | +1 | 0 |
| Fome pré ≤ 3 | 0 | +2 |
| Fome pré − fome pós ≥ 2 | +2 | 0 |
| Fome pós ≥ fome pré e fome pré ≤ 4 | 0 | +2 |
| Condição anterior falsa e fome pós > fome pré | 0 | +1 |
| Satisfação ≥ 4 | +1 | 0 |
| Satisfação ≤ 2 | 0 | +1 |
| Algum humor reconhecido com pontuação ≤ 40 | 0 | +2, uma única vez |
| Tipo existente Física | +1 | 0 |
| Tipo existente Emocional | 0 | +1 |

Condições numéricas exigem os campos necessários convertíveis. As três condições de fome pré são alternativas, não cumulativas.

~~~text
se físicos >= 3 e físicos >= emocionais:
    Física
senão, se emocionais >= 3 e emocionais > físicos:
    Emocional
senão:
    tipo existente reconhecido; na ausência dele, Física
~~~

Empates com pelo menos três pontos físicos favorecem Física. A função termina sempre em Física ou Emocional; a categoria Não classificada está prevista no tipo/gráfico, mas não é produzida pelo retorno final atual.

A classificação nos Insights pode divergir da escolha salva. Exemplo: escolha Emocional, pré 8, pós 3, satisfação 4 e humor neutro → seis pontos físicos e um emocional → Física. Trata-se de inferência heurística, não diagnóstico da origem da fome.

## 5. Pontuação de preenchimento do perfil

calculateProfileInsightScore verifica 11 sinais booleanos:

1. Nome ou e-mail.
2. Idade positiva.
3. Altura positiva.
4. Peso positivo e finito obtido por getLatestMetricValue.
5. Gênero preenchido.
6. Atividade positiva e, adicionalmente, idade, gênero ou objetivos preenchidos.
7. Pelo menos um objetivo.
8. Pelo menos uma emoção inicial.
9. Pelo menos um gatilho.
10. Pelo menos um check-in.
11. Cintura e quadril positivos e finitos, sem exigir mesma data.

~~~text
c = quantidade de sinais satisfeitos

Perfil = 0                                  se c <= 1
Perfil = limitar(arred(78 × c / 11), 0, 78)   caso contrário
~~~

O teto é **78**, não 100. Dois sinais → 14; seis → 43; onze → 78. O cálculo mede preenchimento, não qualidade ou veracidade das respostas.

**isProfileComplete**, usado na navegação, é outra regra: exige identidade e ao menos uma destas alternativas: marcador de conclusão, altura e último peso preenchidos, ou algum IMC/TMB/NET legado. Um cadastro liberado para navegação não necessariamente tem Perfil 78.

## 6. Consciência das refeições

### 6.1 Completude por refeição

calculateMealAwarenessScore soma:

| Informação | Pontos |
|---|---:|
| Fome pré e pós convertíveis | 25 |
| Apenas uma fome convertível | 12 |
| Algum humor pré, pós ou geral preenchido | 22 |
| Satisfação convertível, inclusive zero | 20 |
| Anotação não vazia após trim | 23 |
| Sem anotação, mas com foto | 8 |
| inferMealType diferente de Não classificada | 10 |

Notas e fotos não acumulam entre si. Se photos for array, somente seu comprimento é consultado; image só é usada se photos não for array. Array vazio com image preenchida não soma os pontos de foto nessa função.

O humor conta por presença, mesmo sem chave reconhecida na tabela numérica. A classificação padrão faz com que os dez pontos sejam obtidos inclusive por registros sem informação suficiente.

### 6.2 Ajuste pela variação da fome

Somente quando pré e pós são convertíveis:

~~~text
Δ = fomePré − fomePós
s = satisfaction || 3
Regulação = limitar(50 + 12 × Δ + 8 × (s − 3))
PontuaçãoBruta = 0.75 × Completude + 0.25 × Regulação
~~~

Sem ambas as fomes, PontuaçãoBruta = Completude.

~~~text
Refeição = limitar(arred(PontuaçãoBruta))
~~~

**satisfaction || 3 substitui zero por 3**, embora zero seja resposta válida. Zero ainda soma os 20 pontos de completude, mas não é preservado nesse ajuste.

Exemplos:

- Registro vazio: 10 pontos pela classificação padrão.
- Pré 5, pós ausente, humor Neutro, satisfação 4, sem notas/foto: 12 + 22 + 20 + 10 = **64**.
- Mesmo caso com anotação: 64 + 23 = **87**.
- Pré 7, pós 3, satisfação 4, humor e anotação: completude 100; regulação limitada a 100; resultado **100**.

### 6.3 Componente Refeições

calculateAwarenessScore calcula a média das notas de **todas** as refeições recebidas, arredonda e limita em 0–100. Não há peso por recência, filtro semanal ou mínimo de registros.

Sem refeições, a função retorna Perfil. Entretanto, buildIntegratedInsight só inclui o componente Refeições quando há refeições; esse fallback não duplica o componente Perfil na média integrada.

## 7. Consciência geral integrada

### 7.1 Componentes e pesos

| Componente | Peso nominal | Condição de inclusão |
|---|---:|---|
| Refeições | 45 | Array de refeições não vazio |
| Sono | 25 | sleepLogs não vazio |
| Diário | 15 | dailyNotes não vazio |
| Perfil | 15 | Pontuação Perfil > 0 |

### 7.2 Componente Sono

~~~text
Duração = limitar(100 − 18 × abs(horas − 8), 25, 100)
Qualidade = { Ruim: 30, Regular: 55, Bom: 78, Excelente: 95 }
SonoIndividual = 0.55 × Duração + 0.45 × Qualidade
Sono = arred(média(SonoIndividual de todos os registros) || 0)
~~~

A distância de oito horas é penalizada simetricamente: sete e nove horas produzem Duração 82. Piso 25 e referência 8h são fixos, sem personalização por idade/contexto.

Exemplos: 8h/Bom → arred(55 + 35.1) = **90**; 8h/Excelente → arred(55 + 42.75) = **98**. O máximo com categorias válidas é 98 após arredondamento.

A média usa todo o array. Resultados NaN, por exemplo de qualidade desconhecida, são ignorados pela média. Um array não vazio só com resultados inválidos ainda inclui Sono com valor zero e peso 25.

### 7.3 Componente Diário

~~~text
HumorIndividual = getMoodScore(mood) ?? 58
DetalheIndividual = limitar(2.2 × tamanho(texto.trim()), 25, 100)
HumorMédio = média(HumorIndividual) || 58
DetalheMédio = média(DetalheIndividual) || 25
Diário = arred(0.55 × HumorMédio + 0.45 × DetalheMédio)
~~~

Usa todas as anotações com peso igual. Tamanho é String.length do JavaScript, não número de palavras. A partir de 46 unidades de comprimento após trim, detalhe atinge 100; o piso é 25.

O comprimento não avalia profundidade ou qualidade da reflexão. Humor desconhecido com texto de pelo menos 46 caracteres simples → arred(0.55 × 58 + 45) = **77**.

### 7.4 Média ponderada e cobertura

Para valores vᵢ e pesos pᵢ dos componentes incluídos:

~~~text
W = soma(pᵢ)
ConsciênciaGeral = arred(soma(vᵢ × pᵢ) / W), se W > 0
ConsciênciaGeral = 0, se W = 0
Cobertura = arred((W / 100) × 100) = W
~~~

Exemplo ilustrativo, apenas Refeições 64 e Perfil 78:

~~~text
W = 45 + 15 = 60
ConsciênciaGeral = arred((64 × 45 + 78 × 15) / 60) = 68
Cobertura = 60%
~~~

Cobertura mede presença dos **grupos**, não número de registros ou validade da leitura. Uma refeição já disponibiliza peso 45. Ausência de grupo remove seu peso do denominador; adicionar um grupo com nota menor pode diminuir a média.

Não existe clamp final em buildIntegratedInsight; a faixa depende dos componentes. Com valores usuais e todos os quatro grupos presentes, o teto arredondado é **95**: arred((100 × 45 + 98 × 25 + 95 × 15 + 78 × 15) / 100) = arred(95.45). Isso decorre dos tetos de Perfil 78, Sono 98 e Diário 95 (máximo obtido com a tabela atual).

### 7.5 Narrativas

getAwarenessNarrative escolhe o texto, sem alterar a pontuação:

| Faixa inteira | Tema do texto |
|---|---|
| 0–29 | Iniciar registros de refeições, sono ou reflexão |
| 30–49 | Reunir sinais e manter registros |
| 50–69 | Construção da consciência e observação de tendências |
| 70–84 | Conexão entre contexto, fome e saciedade |
| 85 ou mais | Registros consistentes e contextualizados |

O último ramo não testa teto 100. Esses intervalos são regras de apresentação, não pontos de corte clínicos.

## 8. Radar de seis eixos

buildRadarData recebe como awarenessScore a **consciência geral integrada**. Os outros eixos são calculados separadamente, não sendo os quatro componentes ponderados dessa média.

### 8.1 Saciedade

Ordem de preferência:

1. Média de satisfaction × 20, considerando valores convertíveis.
2. Sem essa média: média de limitar(55 + 10 × (pré − pós)), para pares válidos.
3. Sem ambas: 52 se Perfil > 0; caso contrário, zero.

Arredonda o resultado. O ramo satisfaction × 20 não tem clamp: dados externos fora de 0–5 podem sair da faixa 0–100. Zero é preservado porque o fallback usa ??.

### 8.2 Consciência

~~~text
ConsciênciaDoRadar = ConsciênciaGeralIntegrada
~~~

### 8.3 Energia

~~~text
se profile.tmb e profile.net forem truthy:
    Energia = limitar(48 + 22 × (NET / TMB), 35, 92)
senão, se activityLevel for truthy:
    Energia = limitar(45 + 32 × ((activityLevel − 1.2) / 0.525), 38, 82)
senão:
    Energia = 48 se Perfil > 0; caso contrário 0
~~~

Arredonda o resultado. Usa valores armazenados no perfil ou fator de atividade; **não mede calorias consumidas, gasto observado ou disposição relatada no sono**. Objetivos alteram NET e podem alterar esse eixo.

### 8.4 Humor

1. Reúne postMood, preMood e mood de todas as refeições e calcula a média das pontuações reconhecidas.
2. Sem média, usa getInitialMoodBaseline.
3. Sem referência inicial, usa 55 se Perfil > 0; caso contrário, zero.
4. Limita em 0–100 e arredonda.

Cada campo é uma observação: uma refeição pode contribuir três vezes. Como mood costuma copiar postMood, o humor pós pode contar duas vezes. O eixo não usa diretamente os humores do diário.

### 8.5 Constância

d = número de datas locais distintas e válidas de refeições; n = total de refeições.

~~~text
se n > 0:
    Constância = arred(limitar(16 × d + 4 × min(n, 8), 20, 100))
senão:
    Constância = 32 se Perfil > 0; caso contrário 0
~~~

Datas são obtidas por new Date(meal.date).toLocaleDateString('pt-BR'). Uma refeição em um dia → 20; cinco refeições em cinco dias → 100.

Não mede sequência de dias, adesão semanal ou regularidade recente; não diminui por longos intervalos sem registros. Refeições sem data válida entram em n, mas não em d.

### 8.6 Contexto

~~~text
Contexto = calculateProfileInsightScore(profile)
~~~

Teto 78. Não é análise semântica das anotações.

### 8.7 Constantes e condição de exibição

O array inclui A (valor calculado), B (referência fixa) e fullMark: 100.

| Eixo | B |
|---|---:|
| Saciedade | 85 |
| Consciência | 88 |
| Energia | 82 |
| Humor | 82 |
| Constância | 80 |
| Contexto | 86 |

Somente **A** é desenhado pelo Radar atual. B não é série exibida; fullMark não é explicitamente conectado a um eixo radial de domínio fixo. Não afirmar que essas constantes são metas validadas ou que o código fixa visualmente o domínio radial em 0–100.

O radar aparece quando há altura e peso, Perfil > 0 ou refeições. Apenas sono/diário podem gerar consciência geral sem liberar esse gráfico.

## 9. IMC, TMB e necessidade energética

### 9.1 Fórmula executada

calculateNutritionalNeeds retorna apenas imc, tmb e net:

~~~text
Se peso, altura ou idade forem falsy: retornar { imc: 0, tmb: 0, net: 0 }

alturaM = alturaCm / 100
IMC = pesoKg / alturaM²
Base = 10 × pesoKg + 6.25 × alturaCm − 5 × idadeAnos
TMB = Base + 5     se gender for exatamente 'Masculino' ou 'Homem'
TMB = Base − 161   em todos os demais casos
NET = TMB × (activityLevel || 1.2)

Se objetivos incluem 'Emagrecimento consciente': NET -= 400
Se incluem 'Hipertrofia' ou 'Ganho de peso': NET += 400

Retornar IMC com uma casa decimal e TMB/NET arredondadas para inteiro.
~~~

Peso em kg, altura em cm, idade em anos; TMB e NET são estimativas em kcal/dia. Os coeficientes correspondem à fórmula de Mifflin–St Jeor. A denominação anterior “Harris-Benedict revisada (Mifflin-St Jeor)” misturava equações distintas.

Detalhes:

- Perda e ganho são dois if independentes: objetivos conflitantes anulam −400 e +400.
- Hipertrofia junto com Ganho de peso adiciona 400 uma vez, não 800.
- O ramo −161 também recebe gênero não binário, outro, não informado ou string não reconhecida; não há equação específica dessas opções.
- Algumas chamadas usam idade 25, gênero Feminino e atividade 1.2 quando faltam valores. São substitutos, não dados coletados.
- Não há validação clínica ou limite positivo da saída nessa função.

### 9.2 Fatores oferecidos no cadastro

| Opção | Fator |
|---|---:|
| Sedentário | 1.2 |
| Levemente ativo | 1.375 |
| Moderadamente ativo | 1.55 |
| Muito ativo | 1.725 |

O fator 1.9 não está entre as opções atuais. A função aceita o número recebido sem restringi-lo a essa lista.

### 9.3 Interpretação textual do IMC

| Condição | Rótulo executado |
|---|---|
| IMC falsy, incluindo zero/ausência | Sem dados |
| IMC < 18.5 | Abaixo da faixa de referência |
| 18.5 ≤ IMC < 25 | Faixa de referência |
| 25 ≤ IMC < 30 | Acima da faixa de referência |
| IMC ≥ 30 | Faixa elevada de referência |

Não há graus I/II/III ou ajuste de faixas por idade nessa função. A tabela documenta o software, não recomenda avaliação clínica por essas faixas para todo público.

### 9.4 Macronutrientes

Não foi encontrado cálculo de proteínas, gorduras e carboidratos em gramas ou percentuais. O exemplo anterior foi removido porque não correspondia à função implementada.

## 10. Datas e atualização de medidas

### 10.1 Ordenação

parseDateForSorting:

- Vazio → 0.
- Hoje → Date.now().
- dd/mm → dia/mês no ano atual.
- dd/mm/aa → 2000 + aa; ano completo é preservado.
- Outros formatos → new Date(texto).getTime(); inválido → 0.

sortMetricsChronologically ordena uma cópia de forma crescente. sanitizeProfileDefaults substitui Hoje pelo rótulo local dd/mm e ordena as séries.

Rótulos sem ano podem confundir registros de anos diferentes. O construtor de Date pode normalizar valores de dia/mês fora da faixa; não é validação calendárica estrita.

### 10.2 Último valor

getLatestMetricValue percorre uma cópia invertida e escolhe o primeiro valor positivo e finito. **Não ordena internamente**. “Último” depende da ordem do array. Algumas telas leem diretamente o último elemento, sem essa filtragem.

### 10.3 Gravação, substituição e remoção

Ao salvar, usa dd/mm local. Para cada medida positiva, procura a primeira entrada com essa string de data; substitui o valor se encontrada, senão adiciona; depois ordena.

Evita nova duplicata no fluxo usual, mas não remove todas as duplicatas preexistentes. Remover por data exclui todas as entradas daquela série com a string correspondente.

O recálculo nutricional depende de peso/altura disponíveis. Remover o último peso não limpa automaticamente IMC/TMB/NET no trecho de remoção. Cartões priorizam valores armazenados usando ??; valores antigos ou zero podem prevalecer sobre valores derivados.

## 11. Gráficos e contagens

### 11.1 Evolução do peso

- Fonte: weightEvolution ordenada cronologicamente.
- Cada ponto é um valor informado; não há média móvel, regressão ou previsão.
- Area com type="monotone" suaviza o desenho, sem criar medições.
- Domínio solicitado no eixo Y: mínimo −1, máximo +1.
- Com um ponto, há referência vertical e preenchimento transparente; com mais pontos, curva preenchida.
- Array vazio produz mensagem de ausência de dados.

### 11.2 Linha de referência de peso

getWeightGoal usa o último peso positivo p:

~~~text
Sem p: null
Se objetivo Emagrecimento consciente: p × 0.95, com uma casa decimal
Senão, se Hipertrofia ou Ganho de peso: p × 1.05, com uma casa decimal
Senão: primeiro peso positivo do array, se diferente de p; caso contrário null
~~~

Perda tem prioridade em objetivos conflitantes, diferentemente da NET. A linha muda com o último peso; não é uma meta fixa inicial ou meta clínica individualizada.

### 11.3 Evolução do IMC

~~~text
IMCᵢ = arredondarUmaCasa(pesoᵢ / (alturaAtualCm / 100)²)
~~~

Sem altura, gera zero; pontos não positivos são removidos. Toda a curva usa **altura atual**, sem histórico de altura. Alterar a altura recalcula o histórico.

Área monotônica; domínio solicitado Y: mínimo −0.5, máximo +0.5; linha horizontal fixa em 24.9. O cartão prioriza userProfile.imc e recorre ao último ponto somente quando o valor salvo é null/undefined.

### 11.4 Fontes de Fome

Aplica inferMealType a todas as refeições:

~~~text
nF = quantidade Física
nE = quantidade Emocional
nU = max(nTotal − nF − nE, 0)
percentualCategoria = arred(100 × quantidade / nTotal)
~~~

Pizza usa contagens; legenda mostra contagens/percentuais. Categorias zeradas são ocultadas. Sem refeições, não há divisão. Percentuais arredondados separadamente podem não somar 100. Pelo fallback do classificador atual, nU normalmente é zero por construção.

### 11.5 Oscilação Semanal

Para cada dia d, de domingo (0) a sábado (6):

~~~text
subconjunto = refeições em que new Date(date || Date.now()).getDay() = d
físico[d] = contagem Física no subconjunto
emocional[d] = contagem Emocional no subconjunto
~~~

Barras empilhadas agregam **todo o histórico por dia da semana**, não só a semana atual ou os últimos sete dias. Não calculam variação percentual, média diária ou correlação.

Data ausente usa o dia atual; data presente inválida não pertence a nenhum dia. getDay utiliza o fuso local do navegador.

### 11.6 Evolução do sono

~~~text
sleepTrendData = sleepLogs.slice(0, 7).reverse()
~~~

Novos registros são inseridos no início. No fluxo habitual, aparecem até sete registros mais recentemente inseridos em ordem invertida. Não há ordenação por data nem agregação da mesma noite.

X = data ou "Registro n"; Y = horas. Domínio solicitado 0–12, marcas 0/4/8/12 e linha de referência 8h. Qualidade aparece no tooltip, sem alterar altura do ponto. A consciência usa todo o histórico de sono, não essa fatia.

### 11.7 Circunferências e histórico combinado

O histórico visível reúne peso, cintura, abdômen e quadril, acrescenta rótulo/unidade, ordena decrescentemente e mostra oito entradas. Não calcula média ou variação percentual.

armEvolution possui estrutura e atualização, mas braço não está na lista atual metricFields do histórico. Não foi encontrado gráfico próprio ativo de cintura, abdômen, quadril ou braço nos Insights.

### 11.8 Relação cintura-quadril

buildRcqData está definida, **sem chamada encontrada**:

~~~text
Para cada cintura c na data t:
    q = quadril com a mesma string de data, se truthy;
        caso contrário, último quadril positivo e finito
    RCQ = arredondarDuasCasas(c / q), se c > 0 e q existir; senão zero
Remover resultados não positivos e ordenar por data.
~~~

Unidades devem coincidir; a razão é adimensional. O fallback pode combinar medidas de datas diferentes. Não há classificação de risco nem série RCQ atualmente exibida.

### 11.9 Tamanho dos gráficos

ChartFrame observa o contêiner com ResizeObserver e eventos de resize, agenda leitura com requestAnimationFrame e calcula:

~~~text
largura = floor(larguraDoContêiner)
altura = max(floor(alturaDoContêiner), alturaMínima)
~~~

Renderiza o gráfico somente quando ambas são positivas. Modifica apresentação, não indicadores.

## 12. Resumo de inteligência artificial

generateAiSummary envia perfil, refeições, consciência, cobertura e valores dos componentes para /api/ai-insight. A resposta textual não recalcula nem substitui os indicadores determinísticos.

### 12.1 Seleção e limpeza

As duas implementações do servidor usam:

| Grupo | Seleção |
|---|---|
| Refeições | slice(-30) |
| Diário | slice(-5) |
| Sono | slice(-7) |
| Peso, cintura, abdômen, quadril | slice(-4) por série |
| Objetivos | Até quatro, limitados a 40 caracteres cada |

Não há ordenação antes dos cortes. Como refeições/diário/sono novos entram no início, **slice(-N) pode selecionar os mais antigos**, não os mais recentes. Medidas ordenadas crescentemente tendem a fornecer os últimos pontos.

cleanText comprime espaços e quebras de linha, aplica trim e corta. Limites de caracteres: datas/categoria 24; humor/qualidade 32; nota de refeição 140; diário 220. As entradas de medidas são repassadas sem limpeza campo a campo.

~~~text
inícioDaFaixaEtária = floor(Number(idade) / 10) × 10
fimDaFaixaEtária = inícioDaFaixaEtária + 9
~~~

Exemplo: 27 → 20-29. Nome, e-mail, fotos e identificadores principais ficam fora dos campos explícitos preparados para o modelo. Isso não garante anonimização: textos livres podem conter identificadores; signals é repassado sem seleção interna de campos.

### 12.2 Diferenças de campos

O servidor procura hunger e satiety, enquanto o formulário salva preHunger, postHunger e satisfaction. Não há conversão desses campos no preparador. Assim, pode omitir sinais presentes na refeição.

Categoria usa hungerType || type || mealType, sem chamar inferMealType. O modelo pode receber a escolha original enquanto o gráfico utiliza a reclassificação.

O servidor também usa Number diretamente: null e string vazia podem virar zero, diferentemente da conversão toNumberOrNull no cliente.

### 12.3 Configuração e limites

- Chamada HTTP para OpenRouter.
- Modelo configurado: minimax/minimax-m3:free.
- temperature = 0.45; max_tokens = 420.
- Prompt pede abertura acolhedora, três observações breves e sugestão final; orienta não diagnosticar, prescrever dieta ou inventar dados.
- Resposta limpa e limitada a 2.200 caracteres. A limpeza também remove quebras de linha.
- Cinco solicitações por IP em janela móvel de dez minutos, guardada em memória por instância. Solicitações admitidas que falham posteriormente continuam contando.

Esses dados documentam a configuração, não confirmam disponibilidade do modelo ou execução de chamadas. As restrições do prompt não são um validador semântico. Não foram encontrados testes de correlação, regressão ou causalidade para as relações descritas no resumo.

## 13. Outros cálculos auxiliares

### 13.1 Tempo de leitura

getReadingDuration junta resumo e conteúdo, separa por espaços em branco e conta palavras:

~~~text
minutos = max(1, ceil(palavras / 200))
~~~

Conteúdo vazio também produz 1 min. É estimativa, não tempo observado. O marcador Lido é salvo ao fechar o artigo, sem verificação de leitura integral.

### 13.2 Progresso do cadastro

~~~text
progresso = 100 × (índiceDaEtapa + 1) / quantidadeDeEtapas
~~~

Há nove etapas no cadastro consultado; índice começa em zero. Essa barra não é Perfil nem Consciência Geral.

### 13.3 Requisitos de senha

Quatro condições: comprimento ≥ 8; presença de [A-Z]; dígito; caractere fora de [A-Za-z\d].

~~~text
pontuação = númeroDeCondiçõesAtendidas
progresso = 100 × pontuação / 4
forte = todasAsCondiçõesAtendidas
~~~

Resultados 0/25/50/75/100%. Não é cálculo de entropia da senha.

### 13.4 Odômetro de fome

HungerOdometer define:

~~~text
x = limitar(clientX − esquerdaDoContêiner, 0, largura)
valor = arred(10 × x / largura)
posiçãoDoMarcador = valor × 10%
~~~

Não há proteção explícita contra largura zero nessa função. O componente tem rótulos Física/Emocional, mas não foi encontrado em uso no formulário atual, que utiliza botões.

### 13.5 Fotografias

readValidatedImages limita a seis imagens por refeição e 12 × 1024 × 1024 bytes por arquivo. A verificação aceita MIME iniciado em image/; MIME vazio não é rejeitado apenas por essa condição.

compressImage, com limites padrão 1200 × 1200 e qualidade JPEG 0.82:

~~~text
Se excede alguma dimensão e largura > altura:
    novaAltura = arred(altura × 1200 / largura)
    novaLargura = 1200
Senão, se excede alguma dimensão:
    novaLargura = arred(largura × 1200 / altura)
    novaAltura = 1200
Senão: manter dimensões.
~~~

Desenha em canvas e tenta exportar JPEG. Em falhas tratadas, retorna o original. Não reconhece alimentos, não calcula calorias e não analisa cores nutricionais.

### 13.6 Validações que afetam a entrada

As validações não são uniformes em todos os fluxos:

- Cadastro inicial: idade 10–120, altura 80–250 cm e peso inicial 20–350 kg.
- Atualização de medidas: exige algum valor positivo; rejeita peso >350, braço >100 e cintura/abdômen/quadril >250; só grava valores positivos. Não reproduz o mínimo de 20 kg do cadastro nessa função.
- Diário: formulário exige ao menos três caracteres após trim e limita a entrada a 1.200.
- Refeição: notas limitadas a 1.000 caracteres; satisfação 0–5.
- Sono: controle oferece 3–12 horas em passos de 0.5, iniciado em 7.5h/Bom.

Essas regras de formulário não comprovam que dados externos/legados satisfaçam os mesmos limites, nem que todas as fórmulas tenham validação interna.

## 14. Limitações para interpretação e relato acadêmico

1. Pesos, pontos por humor, faixas narrativas, referência de oito horas e valores substitutos são escolhas do software; não foi identificada validação científica desses índices no código.
2. Consciência mistura preenchimento, respostas, duração de sono e comprimento de texto. Não demonstra mudança real de hábitos.
3. Valores iniciais e classificação padrão Física geram pontos sem informação explicitamente fornecida.
4. Classificação nos gráficos pode divergir da escolha salva e da categoria enviada à IA.
5. Cobertura mede grupos presentes, não suficiência, qualidade ou quantidade de observações.
6. Radar combina observações e valores substitutos; seus eixos não são escalas clínicas independentes.
7. Janelas diferem: consciência usa todos os registros; sono visual usa sete entradas; semanal acumula todo o histórico; IA usa finais dos arrays.
8. Datas sem ano, ordem dos arrays, métricas armazenadas e altura atual aplicada ao histórico influenciam resultados.
9. RCQ e odômetro estão definidos sem uso encontrado; macronutrientes e análise nutricional de fotografias não foram encontrados como cálculos implementados.

Esta atualização documenta o código existente. Não modifica seus algoritmos, parâmetros ou telas.
