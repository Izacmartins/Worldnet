# Testar no GitHub Pages

O Pages hospeda somente a parte estática. Para uma prévia gratuita, este projeto oferece `npm run build:pages`. A versão completa com Node/SQLite/SearXNG continua usando `npm run build` e precisa de um servidor que execute esses serviços.

## Prévia estática

- Câmera 3D, movimento, colisões, chunks e temas funcionam no navegador.
- A busca trabalha apenas no catálogo local da prévia e em links adicionados pelo visitante. O aviso **PRÉVIA LOCAL** permanece visível. Não são resultados de uma pesquisa na internet.
- O catálogo inicial contém dois endereços de canais (sem confirmar seus metadados) e o título/link público de Astronomia na Wikipédia, previamente verificado. Não há produtos, notícias, imagens ou vídeos inventados.
- Recursos e endereços adicionados são guardados no IndexedDB do visitante, em banco separado do ambiente com backend. Esse modo não mantém um mundo compartilhado entre todos os visitantes.
- O código não tenta chamar `/api` no Pages. Ranking e módulos de mídia legados ainda podem consultar suas fontes públicas diretamente quando CORS/rede permitem.
- Assets e navegação usam caminhos relativos, incluindo quando o site fica em `/Worldnet/`.

```sh
npm ci
npm run build:pages
npm run test:pages
```

O teste usa Chromium e um servidor estático sob `/Worldnet/`, sem API. Verifica busca local, teleporte, cadastro de link, persistência, navegação 2D/3D, viewport estreito e ausência de chamadas `/api`.

## Publicação

A branch `gh-pages` deve conter o conteúdo de `dist/`, mais `.nojekyll`. Nunca enviar `.env`, banco de dados ou `node_modules`. Para atualizar a prévia, gerar novamente o build de Pages e atualizar essa branch.

No repositório GitHub, entrar em **Settings → Pages → Build and deployment** e selecionar **Deploy from a branch**, branch **gh-pages**, pasta **/(root)**, depois **Save**. A página de configurações apresenta a URL real e o estado da publicação. Acrescentar `/3d.html` para abrir a cidade 3D diretamente.

GitHub Pages é gratuito para repositórios públicos. Em repositórios privados, a disponibilidade depende do plano/conta. Este projeto não muda a visibilidade do repositório automaticamente. Tornar código privado público exige decisão explícita do proprietário.

Nesta sessão, a consulta à administração de Pages foi recusada pela integração (HTTP 403). Enviar uma branch pelo Git não habilita o site sozinho; o proprietário precisa configurar Pages ou fornecer acesso apropriado. Nenhum token deve ser enviado pelo chat.
