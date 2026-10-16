# Worldnet

Representação espacial de sites e conteúdos públicos. Este checkout parte do protótipo v1.2 e adiciona um serviço de busca gratuito com registro persistente de recursos individuais.

Requer Node 24.12+. Execute `npm ci` e `npm run dev`. Docker é opcional para SearXNG próprio (`npm run search:up`). Nenhuma API paga ou sistema de créditos é necessário.

Leia [execução da busca](docs/BUSCA.md) e [núcleo 3D experimental](docs/CIDADE-3D.md). O arquivo LEIA-ME.md descreve a versão original. A entrada `/` preserva Phaser 2D e oferece o botão **3D ↗**; `/3d.html` usa Three.js com câmera elevada, colisões e chunks.

Validação: `npm test`, `npm run build` e, com o servidor de desenvolvimento ativo e Chromium instalado, `npm run test:browser`, `npm run test:3d` e `npm run test:perf3d`.

Para testar apenas a parte visual no GitHub Pages, veja [a prévia estática e a configuração do Pages](docs/GITHUB-PAGES.md). Use `npm run build:pages`; esse modo sinaliza busca local e não executa o backend.
