# Worldnet · portfólio 3D

Uma cidade navegável em que sites, canais, projetos, livros, imagens e artigos ocupam lugares próprios. **A versão padrão é um site estático: todo o aplicativo executa no navegador de cada visitante.** Não exige servidor Node, Docker, login, chave de API ou créditos em produção.

## Desenvolver no VS Code

Abra a pasta que contém `package.json`. Use Node 24.12+ e o terminal integrado:

```sh
npm ci
npm run dev
```

No PowerShell que bloqueia `npm.ps1`, use `npm.cmd ci` e `npm.cmd run dev`, sem mudar a política de segurança. O endereço que o Vite informa abre diretamente a cidade 3D. Node/npm são ferramentas **do desenvolvedor**; visitantes só precisam abrir o site em um navegador com WebGL2.

## O que a experiência faz

- Abre com 32 endereços reais de um catálogo editorial, incluindo NASA, Manual do Mundo, Curso em Vídeo e Veritasium. Canais do catálogo são encontrados por nome e têm construções separadas.
- Pesquisa projetos públicos no GitHub, livros na Open Library, imagens no Wikimedia Commons e artigos na Wikipédia diretamente pelo navegador, mediante consulta explícita. Filtros selecionam as fontes. A origem e a disponibilidade aparecem nos resultados.
- Cada resultado recebido ocupa um lote permanente da cidade do visitante. Construções variam por tipo/categoria; placas mostram título, descrição, fonte e créditos disponíveis. Imagens reais são carregadas em painéis 3D próximos, respeitando CORS. Vídeos não são reproduzidos automaticamente.
- WASD/setas, arraste, câmera elevada com órbita/zoom, colisões, teleporte, temas claro/escuro e interface responsiva. No celular, arraste para andar e use os botões para girar a câmera.
- IndexedDB conserva lugares e cache de consultas. Cada navegador tem seu próprio mundo; exportação/importação JSON permite transportar os lugares. Sem armazenamento, funciona em memória e informa a limitação.

**Não é um índice completo da internet nem uma busca geral de Google/YouTube.** Canais fora do catálogo e vídeos podem ser adicionados por URL, sem afirmar metadados que não foram obtidos. Sites externos podem negar chamadas, limitar frequência ou ficar indisponíveis; a busca local permanece utilizável. O aplicativo não contorna essas restrições.

## Publicar

```sh
npm run build
```

Publique **o conteúdo de `dist/`** em um serviço de hospedagem estática. Caminhos relativos funcionam em subpastas, incluindo GitHub Pages. O arquivo inicial é `index.html`; `3d.html` continua como alias. `legacy.html` preserva o protótipo 2D como referência, sem carregá-lo na entrada principal.

Veja [publicação no GitHub Pages](docs/GITHUB-PAGES.md) e [arquitetura e fontes](docs/PORTFOLIO.md). `npm run build:pages` é um alias compatível para o mesmo aplicativo, sem um modo limitado separado.

## Validar

```sh
npm test
npm run build
npm run test:pages
```

O teste de navegador requer Chromium (`CHROMIUM_PATH` pode selecionar o executável). Ele serve apenas `dist/` sob `/Worldnet/`, sem backend, e cobre fluxo de busca, fontes indisponíveis, persistência, visitantes isolados, controles, importação/exportação, temas, memória GPU, viewport móvel e recuperação WebGL. Usa fixtures declaradas para testar as fontes sem depender da rede.

Com `npm run dev` ativo, `npm run test:live` consulta fontes reais. `npm run test:perf3d` mede o núcleo em condições de software; os resultados não certificam FPS em GPUs físicas. Consulte [validação desta versão](docs/VALIDACAO-PORTFOLIO.md).

## Código anterior

O serviço experimental Node/SQLite/SearXNG foi preservado em `server/` e `scripts/` para referência. Ele **não é chamado nem exigido** pela experiência atual. [BUSCA.md](docs/BUSCA.md), [CIDADE-3D.md](docs/CIDADE-3D.md) e [LEIA-ME.md](LEIA-ME.md) documentam etapas anteriores; os documentos desta versão e este README descrevem o funcionamento atual.
