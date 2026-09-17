# Galeria de telas do MindNutrition

Página estática independente. Mova **a pasta inteira** para qualquer outro local e abra `index.html` no navegador. Não precisa de Node, React, instalação ou servidor. Também pode ser publicada em hospedagem estática.

## Adicionar suas telas

1. Coloque as imagens diretamente em `fotos/` (PNG, JPG, JPEG, WEBP, GIF, AVIF, BMP ou SVG).
2. No PowerShell, dentro desta pasta, execute `powershell -ExecutionPolicy Bypass -File .\atualizar-fotos.ps1`.
3. Abra ou recarregue `index.html`.

O comando aplica a política somente ao processo que executa o script local. Não altera configurações permanentes. O script apenas lê nomes e atualiza `fotos/indice.js`; não modifica suas imagens. Use prefixos `01-`, `02-`, etc. para controlar a ordem. A lista é ordenada por nome.

Uma página estática não consegue listar uma pasta automaticamente ao ser aberta com `file://`. Por isso existe o catálogo `indice.js`. Ele viaja junto com a pasta e dispensa o PowerShell na visualização, inclusive em outro sistema operacional.

## Alternativa manual e legendas

Edite `fotos/indice.js` com os nomes reais:

```js
window.GALERIA_FOTOS = [
  { arquivo: '01-inicio.png', titulo: 'Início', descricao: 'Visão geral do aplicativo.' },
  { arquivo: '02-diario.png', titulo: 'Diário' },
  '03-perfil.jpg'
];
```

Os nomes acima são apenas exemplos; nenhuma tela fictícia foi incluída. Strings usam o nome do arquivo como título, sem extensão e com hífens/underscores substituídos por espaços. Objetos permitem personalizar título e descrição. Se rodar o atualizador novamente, ele substitui o catálogo, incluindo legendas manuais; nesse caso, guarde sua edição antes. O atualizador lê apenas a pasta fotos, sem subpastas; o catálogo manual aceita caminhos relativos de subpastas.

## Organização

- `index.html`: estrutura e visualizador de imagens.
- `style.css`: tema Oceano Azul e layouts de celular, tablet e desktop.
- `script.js`: galeria, imagens ampliadas, navegação e tratamento de falhas.
- `fotos/`: imagens e catálogo `indice.js`.
- `assets/logo.png`: cópia independente da marca do projeto.
- `atualizar-fotos.ps1`: atualizador opcional do catálogo para Windows.

Todos os caminhos dos arquivos são relativos. As fontes Basic e Inter são carregadas do Google Fonts, como no projeto original. Sem internet, a página continua funcionando com Arial/sans-serif; imagens, logo, estilos e comportamentos não dependem da conexão.

## Navegação

Selecione uma tela para ampliar. Use os botões ou as setas do teclado para trocar de imagem e Escape para fechar. “Ampliar” mostra a imagem em tamanho natural e permite rolagem; “Ajustar à tela” restaura o encaixe. “Abrir original” abre o arquivo de imagem em outra aba. A galeria não recorta as telas e adapta a apresentação a imagens verticais e horizontais.

Imagens ausentes recebem uma mensagem de erro. Sem imagens no catálogo, aparece o estado vazio. O diálogo mantém o foco de teclado e devolve-o à tela selecionada ao fechar. Animações respeitam a preferência por movimento reduzido.
