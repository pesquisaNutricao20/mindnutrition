// Receitas adaptadas do portfólio editorial MIND NUTRITION (edição 2026).
// Tempos e rendimentos são estimativas: conferir em teste culinário antes de publicar.

export interface Recipe {
  id: string;
  title: string;
  category: string;
  time: string;
  servings: string;
  profile: string;
  ingredients: string[];
  steps: string[];
  sourceLabel: string;
  sourceUrl: string;
  image: string;
}

export const RECIPE_CATEGORIES = [
  'Café & lanches',
  'Refeições principais',
  'Acompanhamentos',
  'Aproveitamento integral',
] as const;

const SOURCES = {
  'safra-frutas': 'https://prefeitura.sp.gov.br/web/saude/w/safra-do-m%C3%AAs-veja-as-frutas-da-%C3%A9poca-e-receitas-pr%C3%A1ticas-e-saud%C3%A1veis',
  'safra-vegetais': 'https://prefeitura.sp.gov.br/web/saude/w/safra-do-m%C3%AAs-confira-os-benef%C3%ADcios-dos-vegetais-da-%C3%A9poca-e-receitas-praticas-e-saudaveis',
  'safra-outubro': 'https://www2.prefeitura.sp.gov.br/web/saude/w/safra-de-outubro-como-incentivar-o-consumo-de-frutas-verduras-e-legumes-entre-crian%C3%A7as',
  curitiba: 'https://www.curitiba.pr.gov.br/noticias/semana-da-economia-dos-armazens-da-familia-de-curitiba-e-regiao-tem-feijao-grao-de-bico-e-lentilha-mais-baratos/73621',
  into: 'https://fortalecer.into.saude.gov.br/pagina_ReceitasIrma.aspx',
  fundepar: 'https://www.fundepar.pr.gov.br/sites/fundepar/arquivos_restritos/files/documento/2026-05/livro_de_receitas_1a_e_2a_remessa.pdf',
  'safra-agosto': 'https://prefeitura.sp.gov.br/web/saude/w/alimentos-da-safra-de-agosto-mais-sabor-qualidade-nutricional-e-variedade-no-prato',
  'safra-abobora': 'https://prefeitura.sp.gov.br/web/saude/w/safra-do-m%C3%AAs-confira-os-benef%C3%ADcios-dos-vegetais-da-%C3%A9poca-e-receitas-praticas-e-saudaveis-1',
  'safra-maio': 'https://prefeitura.sp.gov.br/web/saude/w/alimentos-da-safra-de-maio-contribuem-para-uma-alimenta%C3%A7%C3%A3o-saud%C3%A1vel',
  ceasa: 'https://www.ceasa.pr.gov.br/Pagina/Educacao-Alimentar-e-Nutricional-Receitas',
  codeagro: 'https://www.bibliotecajuridica.sp.gov.br/aprenda-a-aproveitar-os-alimentos-com-sabor-e-saude/',
};

// Fotos reais (Unsplash, licença livre) escolhidas por compatibilidade com cada título.
const RECIPE_IMAGES: Record<string, string> = {
  'MN-001': 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&q=80&w=800',
  'MN-002': 'https://images.unsplash.com/photo-1593986799230-f9755e668580?auto=format&fit=crop&q=80&w=800',
  'MN-003': 'https://images.unsplash.com/photo-1635425699968-23809763da3c?auto=format&fit=crop&q=80&w=800',
  'MN-004': 'https://images.unsplash.com/photo-1633205772834-c0b9943c5a54?auto=format&fit=crop&q=80&w=800',
  'MN-005': 'https://images.unsplash.com/photo-1788601405384-c749fb2147f9?auto=format&fit=crop&q=80&w=800',
  'MN-006': 'https://images.unsplash.com/photo-1771074168450-11e3f8b7aa53?auto=format&fit=crop&q=80&w=800',
  'MN-007': 'https://images.unsplash.com/photo-1789990664839-8dbbb04521fc?auto=format&fit=crop&q=80&w=800',
  'MN-008': 'https://images.unsplash.com/photo-1756652242315-a700af040e0e?auto=format&fit=crop&q=80&w=800',
  'MN-009': 'https://images.unsplash.com/photo-1757489345059-31d51e241a3e?auto=format&fit=crop&q=80&w=800',
  'MN-010': 'https://images.unsplash.com/photo-1697318694764-35d43b08a1bc?auto=format&fit=crop&q=80&w=800',
  'MN-011': 'https://images.unsplash.com/photo-1761315414257-e402bedaa43e?auto=format&fit=crop&q=80&w=800',
  'MN-012': 'https://images.unsplash.com/photo-1536329711767-2ad681b7bf9b?auto=format&fit=crop&q=80&w=800',
  'MN-013': 'https://images.unsplash.com/photo-1767065887793-f68f736ea9d6?auto=format&fit=crop&q=80&w=800',
  'MN-014': 'https://images.unsplash.com/photo-1740993384870-0793845268e6?auto=format&fit=crop&q=80&w=800',
  'MN-015': 'https://images.unsplash.com/photo-1771573042838-8b3adf17562e?auto=format&fit=crop&q=80&w=800',
  'MN-016': 'https://images.unsplash.com/photo-1553536645-f83758b55d23?auto=format&fit=crop&q=80&w=800',
  'MN-017': 'https://images.unsplash.com/photo-1559852925-6a5a7125525b?auto=format&fit=crop&q=80&w=800',
  'MN-018': 'https://images.unsplash.com/photo-1778851182989-ea3f9d2d280b?auto=format&fit=crop&q=80&w=800',
  'MN-019': 'https://images.unsplash.com/photo-1645453014403-4ad5170a386c?auto=format&fit=crop&q=80&w=800',
  'MN-020': 'https://images.unsplash.com/photo-1786521642875-74b8a2d42fca?auto=format&fit=crop&q=80&w=800',
};

const RAW_RECIPES: Recipe[] = [
  {
    id: 'MN-001', title: 'Panqueca de banana e aveia', category: 'Café & lanches', time: '15 min*', servings: '2 porções*', profile: 'Vegetariana',
    ingredients: ['1 banana madura', '1 ovo', '2 colheres (sopa) de aveia em flocos finos', 'Canela em pó, se desejar'],
    steps: ['Amasse a banana com um garfo.', 'Adicione o ovo e a aveia; misture até formar massa uniforme.', 'Distribua pequenas porções em frigideira antiaderente levemente untada e doure ambos os lados.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra do mês', sourceUrl: SOURCES['safra-frutas'], image: '',
  },
  {
    id: 'MN-002', title: 'Bolinho de batata-doce e aveia', category: 'Café & lanches', time: '25 min*', servings: '5 porções*', profile: 'Vegetariana',
    ingredients: ['1 xícara de batata-doce cozida e amassada', '1 ovo', '2 colheres (sopa) de aveia ou farinha de mandioca', '1 pitada de sal', 'Um fio de óleo para untar'],
    steps: ['Misture batata-doce, ovo, aveia e sal até obter massa moldável.', 'Forme bolinhos pequenos.', 'Asse em assadeira levemente untada até firmar e dourar, ou prepare em frigideira antiaderente.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra do mês', sourceUrl: SOURCES['safra-vegetais'], image: '',
  },
  {
    id: 'MN-003', title: 'Bolinho assado de abóbora', category: 'Café & lanches', time: '30 min*', servings: '6 porções*', profile: 'Vegetariana',
    ingredients: ['1 xícara de abóbora cozida e amassada', '1 ovo', '1/2 xícara de aveia', '1 colher (sopa) de óleo', 'Salsinha, cebolinha ou ervas a gosto'],
    steps: ['Misture abóbora, ovo, aveia, óleo e ervas.', 'Coloque porções da massa em forminhas untadas.', 'Asse em forno preaquecido a 180°C até firmar e dourar levemente.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra de outubro', sourceUrl: SOURCES['safra-outubro'], image: '',
  },
  {
    id: 'MN-004', title: 'Torta caseira de espinafre', category: 'Café & lanches', time: '50 min*', servings: '8 porções*', profile: 'Vegetariana',
    ingredients: ['1 maço de espinafre lavado e picado', '1/2 cebola picada e 1 dente de alho amassado', '1 xícara de farinha de trigo ou aveia', '1 xícara de leite ou água', '2 ovos', '2 colheres (sopa) de óleo', '1 colher (chá) de fermento químico', 'Sal em pequena quantidade'],
    steps: ['Refogue cebola e alho, junte o espinafre e cozinhe até murchar; reserve.', 'Bata os ovos, a farinha, o leite ou água e o óleo. Incorpore o fermento por último.', 'Em forma untada, coloque metade da massa, o espinafre e o restante da massa.', 'Asse a 180°C por 35–40 minutos ou até a massa estar cozida.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra do mês', sourceUrl: SOURCES['safra-vegetais'], image: '',
  },
  {
    id: 'MN-005', title: 'Hambúrguer de lentilha e cenoura', category: 'Refeições principais', time: '35 min*', servings: '4 porções', profile: 'Vegana',
    ingredients: ['1 xícara de lentilha cozida e escorrida', '1/2 cebola pequena picada', '2 dentes de alho picados', '1 cenoura média ralada', '1/2 xícara de aveia em flocos', '2 colheres (sopa) de farinha de trigo', '1 colher (chá) de cominho', 'Páprica, sal, pimenta e azeite para grelhar'],
    steps: ['Refogue cebola e alho em um pouco de azeite.', 'Misture os temperos com a lentilha, a cenoura, a aveia e a farinha. Amasse até dar liga.', 'Modele quatro hambúrgueres e doure em frigideira antiaderente por 4–5 minutos de cada lado.'],
    sourceLabel: 'Prefeitura Municipal de Curitiba — Armazéns da Família', sourceUrl: SOURCES.curitiba, image: '',
  },
  {
    id: 'MN-006', title: 'Arroz colorido com grão-de-bico', category: 'Refeições principais', time: '35 min*', servings: '5 porções*', profile: 'Vegana',
    ingredients: ['1 xícara de arroz branco ou integral', '1 1/2 xícara de grão-de-bico cozido', '1 cebola média e 2 dentes de alho picados', '1 tomate picado', '1/2 pimentão vermelho e 1/2 verde picados', '1 cenoura em cubos pequenos', '2 colheres (sopa) de azeite', 'Cerca de 2 xícaras de água para arroz branco', 'Sal, ervas e especiarias a gosto'],
    steps: ['Refogue cebola e alho no óleo; junte pimentões, tomate e cenoura.', 'Acrescente o arroz, misture por um minuto e adicione o grão-de-bico.', 'Cubra com a água adequada ao tipo de arroz e cozinhe em fogo baixo até os grãos amaciarem.', 'Desligue, deixe descansar tampado e finalize com cheiro-verde.'],
    sourceLabel: 'Prefeitura Municipal de Curitiba — Armazéns da Família', sourceUrl: SOURCES.curitiba, image: '',
  },
  {
    id: 'MN-007', title: 'Salada de grão-de-bico com cenoura', category: 'Refeições principais', time: '35 min*', servings: '8 porções', profile: 'Vegana',
    ingredients: ['1 xícara de grão-de-bico seco hidratado e cozido', '1 cenoura em rodelas cozida', '1 talo de salsão picado', '4 colheres (sopa) de salsinha', '1 cebola pequena', '4 colheres (sopa) de água', '2 colheres (sopa) de azeite', '3 colheres (sopa) de vinagre', '2 colheres (sopa) de mostarda', 'Sal em pequena quantidade'],
    steps: ['Deixe o grão-de-bico de molho de um dia para o outro, descarte a água e cozinhe até amaciar.', 'Cozinhe a cenoura e escorra.', 'Bata ou misture cebola, água, azeite, vinagre, mostarda e sal.', 'Junte grão-de-bico, cenoura, salsão e salsinha e regue com o molho.'],
    sourceLabel: 'INTO — Fortalecer, receitas da Turma do Valente', sourceUrl: SOURCES.into, image: '',
  },
  {
    id: 'MN-008', title: 'Frango gratinado com legumes', category: 'Refeições principais', time: '55 min*', servings: '10 porções', profile: 'Com carne',
    ingredients: ['2 xícaras de frango cozido e desfiado', '2 xícaras de batata em cubos', '1 xícara de cenoura em cubos', '1 xícara de brócolis', '1 xícara de couve-flor', '1/2 xícara de milho verde', '1 colher (sopa) de óleo e 1 dente de alho', '3 colheres (sopa) de farinha de trigo', '3 xícaras de leite', 'Até 1/2 xícara de queijo ralado, opcional'],
    steps: ['Cozinhe batata e cenoura até começarem a amaciar; junte brócolis e couve-flor nos minutos finais.', 'Refogue o alho no óleo, junte a farinha e adicione o leite aos poucos, mexendo até formar molho cremoso.', 'Misture frango, milho e legumes ao molho e tempere.', 'Transfira para refratário, acrescente queijo se desejar e leve ao forno até gratinar.'],
    sourceLabel: 'FUNDEPAR — Inspirações culinárias 2026, p. 48', sourceUrl: SOURCES.fundepar, image: '',
  },
  {
    id: 'MN-009', title: 'Purê de abóbora com alho e cheiro-verde', category: 'Acompanhamentos', time: '30 min', servings: '4 porções*', profile: 'Vegetariana (vegana com água)',
    ingredients: ['500 g de abóbora japonesa ou paulista picada', '1 colher (sopa) de azeite', '1 dente de alho', '1/2 cebola picada', '2 colheres (sopa) de leite ou água do cozimento', 'Cheiro-verde e sal em pequena quantidade'],
    steps: ['Cozinhe a abóbora até ficar macia e amasse com um garfo.', 'Refogue alho e cebola no azeite.', 'Acrescente a abóbora e o leite ou a água; mexa até ficar cremoso.', 'Finalize com cheiro-verde.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra de agosto', sourceUrl: SOURCES['safra-agosto'], image: '',
  },
  {
    id: 'MN-010', title: 'Salada de brócolis com abacate', category: 'Acompanhamentos', time: '15 min', servings: '3 porções*', profile: 'Vegana',
    ingredients: ['1 xícara de brócolis cozido no vapor', '1/2 abacate pequeno em cubos', '1 cenoura ralada', 'Folhas de agrião ou alface a gosto', 'Suco de 1/2 limão', '1 colher (sopa) de azeite', 'Sal em pequena quantidade'],
    steps: ['Higienize as verduras e prepare o brócolis e a cenoura.', 'Misture folhas, brócolis e cenoura em uma tigela.', 'Acrescente abacate e tempere com limão, azeite e um pouco de sal.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra de agosto', sourceUrl: SOURCES['safra-agosto'], image: '',
  },
  {
    id: 'MN-011', title: 'Legumes assados com ervas', category: 'Acompanhamentos', time: '40 min*', servings: '5 porções*', profile: 'Vegana',
    ingredients: ['1 cenoura', '1 abobrinha', '1 pedaço de abóbora', '1 batata-doce média', '1 colher (sopa) de azeite', 'Alecrim, orégano ou ervas frescas a gosto'],
    steps: ['Lave e corte os legumes em pedaços de tamanho semelhante.', 'Misture com um pouco de azeite e ervas.', 'Asse em forno médio até ficarem macios e levemente dourados, virando quando necessário.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra de outubro', sourceUrl: SOURCES['safra-outubro'], image: '',
  },
  {
    id: 'MN-012', title: 'Abóbora rústica assada com casca', category: 'Acompanhamentos', time: '45 min*', servings: '5 porções*', profile: 'Vegana',
    ingredients: ['1 kg de abóbora japonesa bem higienizada, em lâminas', '6 dentes de alho', '2 colheres (sopa) de azeite', 'Alecrim, sal e pimenta-do-reino a gosto'],
    steps: ['Lave a abóbora, remova as sementes e corte em lâminas com a casca.', 'Disponha em uma forma com alho, azeite e alecrim.', 'Asse a 180–200°C até a polpa ficar macia e a superfície dourada.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Abóbora assada', sourceUrl: SOURCES['safra-abobora'], image: '',
  },
  {
    id: 'MN-013', title: 'Bolo de banana com casca e aveia', category: 'Aproveitamento integral', time: '40 min*', servings: '8 porções*', profile: 'Vegetariana',
    ingredients: ['3 bananas maduras com cascas íntegras e bem higienizadas', '2 ovos', '1 xícara de aveia ou farinha de arroz', 'Canela, opcional', '1 colher (sopa) de fermento químico'],
    steps: ['Higienize bem as bananas e corte a polpa e as cascas em pedaços pequenos.', 'Processe as cascas com os ovos até triturar bem; junte polpa e aveia.', 'Misture o fermento, coloque em forma untada e asse em forno médio por cerca de 30 minutos.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra de maio', sourceUrl: SOURCES['safra-maio'], image: '',
  },
  {
    id: 'MN-014', title: 'Chips assados de casca de abóbora', category: 'Aproveitamento integral', time: '30 min*', servings: '3 porções*', profile: 'Vegana',
    ingredients: ['Cascas comestíveis de abóbora, bem lavadas', '1 fio de óleo', 'Sal em pequena quantidade, opcional'],
    steps: ['Corte as cascas em tiras finas e uniformes.', 'Distribua em assadeira sem sobrepor, acrescente um fio de óleo e tempere.', 'Asse até secarem e ficarem crocantes, mexendo na metade do tempo.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra de maio', sourceUrl: SOURCES['safra-maio'], image: '',
  },
  {
    id: 'MN-015', title: 'Refogado de talos de espinafre', category: 'Aproveitamento integral', time: '15 min*', servings: '3 porções*', profile: 'Vegana',
    ingredients: ['Talos de 1 maço de espinafre bem higienizados e picados', '1 dente de alho', '1 colher (chá) de azeite ou óleo', 'Sal em pequena quantidade, opcional', 'Um pouco de água, se necessário'],
    steps: ['Refogue o alho no óleo.', 'Adicione os talos e cozinhe, mexendo, até amaciarem.', 'Se necessário, acrescente um pouco de água para terminar o cozimento.'],
    sourceLabel: 'Secretaria Municipal da Saúde de São Paulo — Safra de maio', sourceUrl: SOURCES['safra-maio'], image: '',
  },
  {
    id: 'MN-016', title: 'Farofa de folhas e talos', category: 'Aproveitamento integral', time: '20 min*', servings: '6 porções*', profile: 'Vegana',
    ingredients: ['2 xícaras de folhas e talos comestíveis higienizados e picados', '1/2 cebola picada', '1 copo de farinha de milho', '1 copo de farelo de aveia', '2 colheres (sopa) de óleo', 'Sal em pequena quantidade'],
    steps: ['Aqueça o óleo e refogue a cebola.', 'Acrescente folhas e talos e cozinhe até ficarem macios.', 'Adicione a farinha de milho e o farelo, mexendo para incorporar os sabores. Ajuste o sal.'],
    sourceLabel: 'CEASA-PR — Educação alimentar e nutricional', sourceUrl: SOURCES.ceasa, image: '',
  },
  {
    id: 'MN-017', title: 'Arroz com talos de hortaliças', category: 'Aproveitamento integral', time: '30 min*', servings: '4 porções*', profile: 'Vegana',
    ingredients: ['1 xícara de arroz', '1 xícara de talos comestíveis picados (couve, brócolis ou couve-flor)', '1/2 cebola', '1 dente de alho', '1 colher (chá) de óleo', 'Cerca de 2 xícaras de água para arroz branco', 'Sal em pequena quantidade'],
    steps: ['Refogue cebola, alho e talos em uma panela.', 'Acrescente o arroz e misture por um minuto.', 'Adicione água e cozinhe, semitampado, até o arroz ficar macio.'],
    sourceLabel: 'CEASA-PR — Educação alimentar e nutricional', sourceUrl: SOURCES.ceasa, image: '',
  },
  {
    id: 'MN-018', title: 'Polenta com folhas verdes', category: 'Aproveitamento integral', time: '30 min*', servings: '4 porções*', profile: 'Vegana',
    ingredients: ['1 xícara de fubá', '1 xícara de folhas comestíveis picadas', '1/2 cebola pequena picada', '1 dente de alho', '1 colher (chá) de óleo', 'Cerca de 4 xícaras de água', 'Sal em pequena quantidade'],
    steps: ['Refogue alho e cebola; acrescente as folhas higienizadas e picadas.', 'Coloque a água na panela e deixe aquecer.', 'Dissolva o fubá em água fria e acrescente devagar, mexendo sempre.', 'Cozinhe em fogo baixo até o fubá estar completamente cozido e a polenta cremosa.'],
    sourceLabel: 'CEASA-PR — Educação alimentar e nutricional', sourceUrl: SOURCES.ceasa, image: '',
  },
  {
    id: 'MN-019', title: 'Couve-flor gratinada com folhas', category: 'Aproveitamento integral', time: '60 min*', servings: '12 porções pequenas', profile: 'Vegetariana',
    ingredients: ['1 couve-flor pequena (cerca de 400 g)', '2 xícaras de folhas de couve-flor picadas', '1/2 cebola pequena', '1 dente de alho', '1 colher (sopa) de óleo', '2 colheres (sopa) de farinha de trigo', '1 xícara de leite', '1 xícara de água', '2 colheres (sopa) de queijo parmesão ralado'],
    steps: ['Cozinhe os floretes no vapor até amaciarem.', 'Refogue cebola, alho e folhas picadas no óleo.', 'Misture farinha, leite e água; despeje sobre o refogado e mexa até engrossar.', 'Disponha a couve-flor no refratário, cubra com o creme, polvilhe queijo e leve ao forno para gratinar.'],
    sourceLabel: 'Governo do Estado de São Paulo / CODEAGRO', sourceUrl: SOURCES.codeagro, image: '',
  },
  {
    id: 'MN-020', title: 'Panqueca verde de talos e folhas', category: 'Aproveitamento integral', time: '35 min*', servings: '5 porções*', profile: 'Vegetariana',
    ingredients: ['Massa: 1 xícara de talos comestíveis picados', 'Massa: 1 xícara de leite, 2 ovos e 7 colheres (sopa) de farinha de trigo', 'Massa: 1 colher (chá) de óleo', 'Recheio: 2 xícaras de folhas comestíveis picadas', 'Recheio: 1/2 cebola picada e 1 colher (chá) de óleo'],
    steps: ['Bata no liquidificador os talos higienizados, o leite, os ovos, a farinha e o óleo.', 'Em frigideira antiaderente, prepare discos finos com pequenas porções de massa.', 'Refogue cebola e folhas até amaciarem, ajustando o sal.', 'Recheie as panquecas e sirva.'],
    sourceLabel: 'CEASA-PR — Educação alimentar e nutricional', sourceUrl: SOURCES.ceasa, image: '',
  },
];

export const DEFAULT_RECIPES: Recipe[] = RAW_RECIPES.map((recipe) => ({
  ...recipe,
  image: RECIPE_IMAGES[recipe.id] || recipe.image,
}));

const escapeHtml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Converte para o mesmo formato dos artigos, reaproveitando o leitor da biblioteca.
export function recipeToArticle(recipe: Recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    type: 'Receita',
    category: recipe.category,
    duration: recipe.time,
    image: recipe.image,
    summary: `${recipe.category} · ${recipe.profile} · ${recipe.servings}`,
    contentHtml: [
      `<p><b>Categoria:</b> ${escapeHtml(recipe.category)} · <b>Perfil:</b> ${escapeHtml(recipe.profile)} · <b>Rendimento:</b> ${escapeHtml(recipe.servings)} · <b>Tempo:</b> ${escapeHtml(recipe.time)}</p>`,
      '<p><b>Ingredientes</b></p>',
      `<ul>${recipe.ingredients.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
      '<p><b>Modo de preparo</b></p>',
      `<ol>${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`,
      `<p>Tempos e rendimentos com asterisco são estimativas. Conferir higienização, alergênicos e ponto de cocção em teste culinário.</p>`,
    ].join(''),
    sourceLabel: recipe.sourceLabel,
    sourceUrl: recipe.sourceUrl,
  };
}
