# Worldnet Search — primeiro incremento

O ZIP v1.2 foi importado para este checkout. A versão de auditoria foi preservada em uma pasta separada. Este documento descreve o primeiro incremento de busca na cidade Phaser. A entrada alternativa com geometria 3D está documentada em [CIDADE-3D.md](CIDADE-3D.md).

## Executar

Requer Node **24.12 ou superior** com SQLite FTS5, npm e navegador com WebGL/Canvas. Sem chave de API, assinatura ou créditos.

```sh
npm ci
npm run dev
```

O comando inicia a API na porta 8787 (somente loopback) e Vite na 5173. Vite encaminha `/api` à API. As flags do Node preservam a verificação TLS e utilizam os proxies e certificados confiáveis do ambiente.

Para busca ampla, Docker é opcional:

```sh
npm run search:up
# Copie .env.example para .env somente se ainda não houver .env.
# Defina SEARXNG_URL=http://127.0.0.1:8888 no ambiente ou no .env.
npm run dev
```

`search:up` usa uma imagem oficial fixada por digest, cria segredo aleatório apenas em `data/searxng/settings.yml`, preserva configuração existente e publica SearXNG apenas em loopback. Não remove containers de outros checkouts. Os conectores iniciais são DuckDuckGo e Wikipédia, sem chave paga. Sua disponibilidade e condições de uso continuam sendo limitações externas. Não há rotação de proxies nem contorno de CAPTCHA.

O container executa com o UID/GID do usuário para preservar a propriedade dos arquivos. Em Linux, usa o bundle confiável de CAs do host; `WORLDNET_CA_FILE` pode indicar outro bundle válido. Docker Desktop/caminhos Windows e rootless Docker ainda não foram testados. O teste neste ambiente usou Docker 28.4.0 em Linux.

Para servir o build pelo backend:

```sh
npm run build
npm start
```

`API_PORT`, `API_HOST`, `WORLDNET_DB` e `SEARXNG_URL` são opcionais. O padrão da API é loopback; para produção pública, colocar atrás de um reverse proxy HTTPS e revisar limites/autenticação. Não publicar a porta interna do SearXNG diretamente. Os limites atuais são para um piloto; não substituem proteção distribuída contra abuso.

## O que funciona

- `/api/search?q=...`: consulta índice textual SQLite e fontes configuradas, com cache por uma hora, respostas parciais e prazo de cinco segundos para cada fonte.
- Wikipédia: resultados de artigos por título/trecho real. Sem SearXNG, não é busca geral da web.
- SearXNG: adapter JSON para uma instância própria; habilita busca mais ampla conforme os conectores disponíveis. Resultado sem fonte disponível não é fabricado.
- Links diretos: registra um recurso sem visitar páginas arbitrárias no backend. Sem metadados, mostra endereço e aviso de identificação não confirmada. Registrar um link não verifica a existência do recurso.
- YouTube: normaliza `watch`, `youtu.be`, `shorts`, `live` e `embed` para o mesmo ID de vídeo. Canais `@handle`, `/channel/UC...`, `/c/...` e `/user/...` têm entidades próprias. Para vídeos, tenta oEmbed público para título, miniatura e relação com o canal; sem sucesso conserva apenas o endereço. Canais por handle não têm confirmação automática de título/avatar, e aliases entre handle e ID UC ainda não são reconciliados.
- Um lugar por recurso, não apenas por domínio; dois canais do YouTube não são fundidos. Vídeo e canal têm relações quando o oEmbed as informa. Um registro do site-pai também é persistido.
- Coordenadas de recursos são alocadas uma vez no servidor, em distrito separado do catálogo legado. Busca e enriquecimento não movem recursos existentes. Popularidade não é usada para realocá-los neste incremento.
- A cidade recebe resultados reais, mostra seu tipo/origem, teleporta até o conteúdo e permite abrir o endereço original. O cartão do recurso usa seus próprios dados, não uma busca temática atribuída a ele. Temas e controles continuam disponíveis.
- IndexedDB guarda os recursos visitados e permite fallback local; a autoridade dos endereços é o SQLite do servidor. O navegador carrega inicialmente os primeiros 200 registros do servidor e incorpora os demais ao pesquisar. Não materializa todo o índice na cena.

## Persistência e identidade

`data/worldnet.sqlite` contém registros serializáveis, coordenadas únicas, índice FTS5 de título/descrição/domínio/URL e cache de consultas. Preservar esse banco (incluindo WAL em uso, ou um backup consistente com o processo parado) mantém o mundo comum entre visitantes. `data/` e `.env` não entram no Git. O piloto não tem login, dados privados, exclusão administrativa ou backup automático.

IDs de vídeo são canônicos; IDs de canal baseados em URL são provisórios. A normalização remove fragmentos/tracking conhecido sem descartar parâmetros funcionais de páginas gerais. Os dados carregam fonte, estado de metadados e datas. Um nome como “Canal @NASA” pode ser apenas apresentação do caminho da URL: não é um título confirmado por uma fonte.

O catálogo legado de domínios e as antigas descobertas ainda usam suas regras anteriores de posicionamento. A estabilidade nova vale para os recursos do registro SQLite. A conversão integral dos endereços legados é outra etapa.

O teste no Chromium identificou framebuffers 0×0 durante transições de layout. A configuração de escala agora mantém o backing store com pelo menos 1×1, sem alterar o tamanho normal da janela. O smoke test verifica erros JavaScript e também oculta/restaura o canvas para cobrir esse caso. A captura usa renderização por software SwiftShader; não é benchmark de hardware real.

## Limites deste incremento

Não é crawler geral nem índice completo da internet. Indexa os títulos e trechos recebidos, não corpos integrais de páginas. Não há scraping de YouTube, extração indiscriminada, IA pesada ou API comercial. O campo categoria de canal/vídeo é inferido pelo tipo de URL; cores permanecem decorativas.

A aplicação limita quatro buscas externas concorrentes (duas fontes por busca na configuração inicial), 30 pesquisas por minuto por conexão de origem e 20 mil registros no piloto. Há deduplicação de consultas idênticas em andamento e cache de até 500 consultas. Os subsistemas de mídia legados ainda não compartilham esse scheduler. O limite de quatro é de buscas, não de requisições HTTP totais.

Os resultados que chegam de fontes diferentes são deduplicados por ID e mantêm ordenação local/por fonte. Fusão de ranking global, qualidade em português, rotas semânticas, hierarquia visual de canais e renderização 3D são etapas seguintes. Vídeos não iniciam automaticamente.

## Validar

```sh
npm test
npm run build
# Com npm run dev ativo e Chromium instalado:
npm run test:browser
```

`CHROMIUM_PATH` seleciona o binário e `WORLDNET_TEST_URL` muda o endereço do teste. O teste de navegador registra dois links reais conhecidos de canais como registros sem metadados; não simula uma descoberta remota bem-sucedida. Usa `/src/main.js` para diagnósticos, portanto exige o servidor de desenvolvimento, não apenas `npm start`. Gera screenshots e JSON em `test-results/`.

Os testes de providers usam fixtures explicitamente controladas. Exercitam normalização, persistência após reabrir o banco, FTS, cache, deduplicação, falhas parciais, oEmbed, API HTTP e colisão/teleporte. O teste Chromium verifica canais distintos, pesquisa/teleporte, teclado, mouse, fechamento de interfaces, temas, recarga e viewport estreito. É um smoke test, não medição de FPS ou equivalência com dispositivos modestos.

## Rede neste ambiente

SearXNG instalado e respondendo JSON em HTTP 200. Consultas às fontes de busca foram recusadas pelo proxy (403). A aplicação expõe falhas parciais e continua com o índice/link direto. Liberar domínios e repetir consultas reais antes de afirmar que a busca ampla foi validada.

Destinos: `pt.wikipedia.org`, `en.wikipedia.org`, `html.duckduckgo.com`, `duckduckgo.com`; oEmbed/miniaturas: `www.youtube.com`, `youtube.com`, `i.ytimg.com`; módulos de mídia legados: `www.wikidata.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `en.wikinews.org`. Downloads do catálogo e dependências já estão nos presets existentes. Favicons de outros sites continuam dependendo da política de rede e CORS de cada domínio. Não liberar `*` apenas para obter ícones.

## Licenças

O conector usa SearXNG como serviço separado (AGPL-3.0); manter avisos e disponibilizar código correspondente às modificações aplicáveis ao distribuir/oferecer uma versão modificada. Phaser e Vite mantêm suas licenças. Playwright Core é dependência apenas de desenvolvimento. Conteúdo, trechos e imagens continuam sujeitos às condições e atribuições de suas fontes. Este projeto não atribui identidade oficial com base apenas em URL ou cor decorativa.
