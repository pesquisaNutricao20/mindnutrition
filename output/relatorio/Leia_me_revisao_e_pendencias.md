# Revisão do relatório final PIBITI

A versão revisada usa o F01 como registro do planejamento e o relatório como descrição da execução. As regras de formatação usadas são as fornecidas na solicitação: Arial 11, margens de 2,5 cm, entrelinhas 1,5 e texto justificado. As instruções de submissão do F01 (Arial 12, outras margens, anonimização e outro limite de páginas) não foram aplicadas ao relatório final.

O PDF tem 12 páginas, contando folha de rosto, resumo e sumário. As três primeiras páginas são contadas sem número visível; a introdução começa na página 4. Os espaços de assinatura estão na página do resumo, identificados para os dois estudantes e a orientadora. As assinaturas não foram inseridas. Os modelos institucionais dos Anexos I e II não estavam entre os arquivos fornecidos; a estrutura foi feita com base nos itens descritos na solicitação.

**Os arquivos ainda são versões para completar, não versões prontas para submissão.** Os campos destacados precisam ser resolvidos antes de exportar e assinar a versão definitiva. O PDF foi composto e conferido separadamente. A conversão nativa do DOCX não pôde ser executada por ausência do conversor; confira a paginação no Word e atualize o sumário após preencher os campos. O sumário é estático.

## O que fazer com as seções 3 e 4

Manter as etapas na metodologia e apresentar seus produtos na seção de resultados:

| Metodologia | Resultados correspondentes |
|---|---|
| 3.1 Como a revisão foi conduzida | 4.1 Estudos incluídos, achados, limitações e implicações para o aplicativo |
| 3.2 Como os aplicativos foram localizados e avaliados | 4.2 Seleção, barreiras observadas e prioridades de funcionalidades |
| 3.3 Como o aplicativo foi desenvolvido | 4.3 Recursos efetivamente implementados |
| 3.4 Como ocorreram as avaliações | 4.4 Heurísticas, 4.5 testes individuais e 4.6 grupo focal |

Não é repetição apresentar as mesmas etapas nas duas seções: cada seção responde a uma pergunta diferente. A metodologia não substitui a apresentação de resultados.

## Resultados preenchidos a partir das planilhas

Fontes consultadas, sem alteração dos arquivos:

- [base-inicial-aplicativos](https://docs.google.com/spreadsheets/d/1lsyPUNtcITDL9Uh71Y-8dJII4RL1etSLVU7ReSJP3n8/edit).
- [Tabela_de_Funcionalidades](https://docs.google.com/spreadsheets/d/1wn7O_UwfzXXQdtttVZf_NsVXIUcx8QSolcC2YIcHf8E/edit).

Contagens feitas por linha com nome de aplicativo ou requisito preenchido; linhas vazias com valores predefinidos não foram contadas.

| Local na planilha | Contagem observada | Como interpretar |
|---|---:|---|
| base-incial-completa, A2:C126 | 125 | Ocorrências de busca, não aplicativos únicos |
| base-inicial-filtrada, A2:C70 | 69 | Entradas com duplicidades/links a conferir |
| aplicativos-excluidos, A2:F70 | 57 excluídas e 12 selecionadas | Triagem, apesar do nome da aba |
| aplicativos-incluidos, A2:O12 | 9 selecionadas e 2 excluídas | Detalhamento de 11 entradas identificadas |
| Tabela, A2:D30 | 29 | 15 obrigatórias, 10 não obrigatórias e 4 não prioritárias |

Pontos que impedem declarar um total definitivo de aplicativos únicos:

1. **Food Journal / Diário Alimentar:** o identificador `com.dailybits.foodjournal` aparece nas duas entradas da base filtrada, mas com decisões de exclusão e inclusão distintas na triagem. Verificar se é duplicidade, reavaliação ou troca de nome/versão.
2. **Contador de Calorias / Jejum Intermitente – Go Fasting:** compartilham `com.fatsecret.android`. Conferir o link antes de fundir entradas: um deles pode estar incorreto.
3. **K Fasting:** consta entre os 12 pré-selecionados, mas não entre os 11 detalhados; seu endereço é de busca da loja, não de identificação inequívoca de um aplicativo.
4. **Nutrition & Mindset Coach / Enlightenment Journal:** pré-selecionados na triagem e excluídos no detalhamento. Registrar claramente a decisão final e seu motivo; não contar apenas o nome da aba.
5. **Notas das lojas:** 0 e −1 foram usados para ausência de avaliação/indisponibilidade e entram nas médias existentes. Não utilizar essas médias como escores válidos. Registrar ausência como dado faltante e definir a regra de comparação. Não alterei as fórmulas.
6. **Selecionado não significa avaliado integralmente:** Kompanion tem anotação de compra necessária; Nutrition & Mindset Coach registra falha de login; Food Snapper All: Calorias limita os registros gratuitos.
7. **Critérios de inclusão:** esclarecer se eram requisitos cumulativos ou dimensões descritivas. Nootric aparece sem período gratuito, apesar de a legenda do critério 1 mencionar gratuidade/versão gratuita. A regra de seleção precisa explicar essa situação.

As frequências de exclusão foram calculadas nas 57 linhas classificadas como excluídas: critério 1 = 30; critério 2 = 6; critério 3 = 11; critério 4 = 8; critério 5 = 2; critério 6 = 8; critério 7 = 3. São marcações múltiplas, não grupos exclusivos. O relatório apresenta apenas as frequências mais relevantes e não trata a classificação da equipe como verificação independente da qualidade dos produtos.

## Pendências de conteúdo antes da entrega

- **Revisão científica:** os 7.045 registros e 15 estudos já constavam no resumo original e foram levados à seção 4.1. Ainda faltam a relação dos estudos, os achados, a síntese crítica e os números intermediários do fluxo. Não foi inventado um fluxograma PRISMA nem inferida a quantidade de duplicatas/exclusões pela simples diferença entre os totais.
- **Método da revisão:** especificar desenhos elegíveis no S do PICOS, estratégias completas, datas, revisores, resolução de discordâncias, avaliação de qualidade/risco de viés e síntese. O uso de Rayyan/PICOS e a citação de PRISMA não bastam para documentar uma revisão sistemática.
- **Alterações do F01:** justificar revisão integrativa versus sistemática, publicação a partir de 2015 versus ausência de limite inicial e uso do Google Scholar apenas no planejamento. Manter a descrição do que de fato ocorreu.
- **Mapeamento tecnológico:** a planilha de funcionalidades é uma matriz de requisitos do Mind Nutrition, não uma matriz comparativa de funcionalidades de cada concorrente. Ainda falta sintetizar essa comparação e identificar resultados de GitHub, se a busca foi executada.
- **Grupo focal:** informar número/perfil dos participantes e os resultados específicos. Não atribuir ao grupo focal achados das seis entrevistas individuais.
- **Avaliações:** identificar quem realizou a inspeção heurística, quantos avaliadores participaram, a escala de gravidade, a origem dos valores 4/5 e 3/5, a ordem dos testes e o método de análise dos registros. Essas notas não são SUS nem NPS.
- **Planejamento versus execução:** esclarecer se SUS, NPS e acompanhamento por três semanas foram aplicados. Caso não tenham sido, registrar a alteração e a justificativa. Explicar o recrutamento e a faixa de 20–67 anos frente aos 18–59 anos previstos. Não completei essas informações por inferência.
- **Aspectos éticos:** a declaração de aprovação e de assinatura do TCLE foi mantida conforme o relatório e a instrução expressa do usuário. Não acrescentei número de parecer ou CAAE e não realizei verificação independente da aprovação.
- **Implementação:** conferir quais requisitos estavam implementados na versão avaliada, quais tinham apenas previsão e quais foram retestados depois de correções. Delimitar recursos PWA/offline, notificações, indicadores algorítmicos, acessibilidade e privacidade ao que foi efetivamente implementado/testado. Não foi feita auditoria do código ou da aplicação nesta revisão documental.
- **Público-alvo:** a tabela de requisitos inclui adolescentes, adultos e idosos, enquanto o aplicativo no relatório é destinado a adultos. Uma intenção futura de atender adolescentes não comprova avaliação com esse público.
- **Escopo comportamental:** a planilha classifica foco principal no peso como não prioritário, mas o produto inclui peso, IMC e taxa metabólica basal. Não é uma contradição inevitável; explicar o papel secundário dessas medidas e não apresentar os indicadores autorais como escalas clínicas validadas.
- **Resultados e conclusões:** aceitação percebida e testes breves não demonstram eficácia, adesão continuada, mudança alimentar sustentada, redução de ultraprocessados, perda de peso ou benefício clínico. Essas extrapolações foram evitadas.
- **Apêndices:** retirei a chamada ao “Anexo I” da planilha que não estava anexada no relatório. Se incluírem material elaborado pela equipe, identificar como apêndice e citá-lo no texto. Conferir novamente o limite de páginas após inserir qualquer material.
- **Identificação:** foram preservados título oficial, nomes, período e data de entrega informados no DOCX. O F01 solicita três bolsas, mas o relatório identifica dois estudantes; isso não comprova erro, pois solicitação e concessão são situações diferentes. Conferir a equipe efetivamente vinculada sem inventar um terceiro nome.

## Referências e alterações editoriais

O título do artigo de Abeltino foi restituído ao original em inglês; PubMed foi substituído pelo nome do periódico Nutrition Reviews, com volume, número, páginas e DOI. O ano de 2025 foi mantido, pois corresponde ao fascículo indicado no [registro bibliográfico](https://pubmed.ncbi.nlm.nih.gov/38722240/).

A referência de Cunha, Ferreira e Freitas recebeu os três autores, volume, número, identificador de artigo e DOI, conforme os [dados da revista](https://rsdjournal.org/rsd/user/setLocale/es?source=%2Frsd%2Farticle%2Fview%2F37123). As citações no texto foram harmonizadas. O acesso direto ao endereço original retornou restrição; os metadados foram conferidos no registro da revista indexado na busca.

Na referência de Malta, a grafia da autora foi corrigida para Deborah Carvalho Malta; SciELO foi substituído por Revista Brasileira de Epidemiologia, com volume, identificador e DOI, conforme a [publicação](https://www.scielo.br/j/rbepid/a/LSsMjXjf3wsL89Z8z6jq9YD/?lang=pt).

Foi acrescentada a referência de [Page et al. sobre PRISMA 2020](https://www.bmj.com/content/372/bmj.n71), que estava ausente e indicada apenas por “Referência”. Anderson e Carmichael foram mantidos e citados no trecho sobre Kanban. Nielsen foi mantido com os dados bibliográficos fornecidos, sem inventar paginação do capítulo. As datas de acesso já existentes foram preservadas; a referência nova traz a data da consulta desta revisão.

Também foram corrigidos concordância, repetições, títulos e hierarquia das seções, distinção entre o nome do projeto e o nome do produto e conclusões excessivamente abrangentes. As referências saíram de uma tabela e passaram a uma lista ordenada alfabeticamente. O logotipo do aplicativo foi preservado e colocado na apresentação do produto, com título e fonte.

Antes de assinar, preencher os destaques, revisar as novas citações que serão necessárias para os 15 estudos, retirar as instruções de preenchimento, atualizar o sumário e gerar novamente o PDF final.
