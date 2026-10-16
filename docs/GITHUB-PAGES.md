# Worldnet no GitHub Pages

A versão 1.3 é estática e funciona individualmente no navegador de cada visitante. Não é necessário hospedar API, banco de dados ou SearXNG. Consultas remotas são diretas às fontes públicas compatíveis; não é uma busca geral de toda a web.

```sh
npm ci
npm run build
npm run test:pages
```

O build usa caminhos relativos e abre a cidade 3D em `index.html`. `3d.html` é um alias; `legacy.html` guarda o protótipo 2D. `npm run build:pages` produz o mesmo aplicativo. Não há mais a prévia separada que só consultava três endereços.

A branch `gh-pages` recebe **somente o conteúdo de `dist/`**, mais `.nojekyll`. Não enviar `.env`, `data/` ou `node_modules/`. Ao atualizar o código, gerar o build e atualizar essa branch também; não basta enviar as fontes.

No GitHub, entrar em **Settings → Pages → Build and deployment**. Selecionar **Deploy from a branch → gh-pages → /(root) → Save**. O GitHub apresenta a URL real e o estado da publicação. Configurar o site depende das permissões da conta. Enviar a branch não ativa o Pages sozinho.

GitHub Pages é gratuito em repositórios públicos. A disponibilidade em repositórios privados depende do plano/conta. Este projeto não torna o repositório público automaticamente.

Depois da publicação, abrir a URL em uma janela anônima: a cidade deve iniciar com 32 lugares. Pesquisar `NASA` no filtro **Canais**, visitar o edifício e usar **E** para ver sua origem. Pesquisar `astronomy` em **Projetos**, **Livros** ou **Imagens** consulta fontes reais quando disponíveis. Colar um link registra o endereço sem inventar metadados. Os dados de uma janela anônima não são compartilhados com outros visitantes.
