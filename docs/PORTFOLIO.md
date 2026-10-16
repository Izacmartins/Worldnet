# Arquitetura da versão de portfólio

## Execução e dados

Vite compila arquivos estáticos; Three.js desenha a cidade. `index.html` e `3d.html` carregam `src/world3d/main.js`. `legacy.html` mantém a entrada Phaser original em um bundle separado, sem baixá-lo ao iniciar o 3D. Nenhuma requisição do núcleo atual usa `/api`, SQLite, Docker ou um proxy de busca.

- `portfolio-catalog.js`: 32 registros editoriais com endereços públicos reais, categorias e termos de pesquisa. É um diretório selecionado previamente; não é ranking de popularidade nem resultado de consulta remota. Não atribui cores ou logos oficiais.
- `browser-providers.js`: adapters de consultas HTTPS sem autenticação a GitHub, Open Library, Wikimedia Commons e Wikipédia. HTML recebido é convertido em texto e inserido com `textContent`; URLs são validadas. Nenhum token está no bundle.
- `search-client.js`: armazenamento, alocação de lotes, consulta, limite de concorrência, cache e importação/exportação. `browser-world.js` mantém busca e alocação independentes do renderizador.
- `world3d/model.js`, `simulation.js`, `input.js`: descritores, movimento e colisão independentes dos objetos Three.js. `objects.js`, `chunks.js`, `media.js`, `runtime.js`: geometria, streaming, recursos GPU e câmera.

IndexedDB `worldnet-portfolio-v1` contém `resources` (até 1.500 recursos, seus metadados/fontes e coordenadas) e `queries` (40 consultas, TTL 30 minutos). Bancos de protótipos anteriores são preservados sem misturar endereços do servidor. Cada origem/perfil do navegador tem um mundo independente. Nomes de canais e vídeos de um mesmo domínio não se confundem. Endereços seguem uma espiral próxima da Central, com parques reservados. Atualizar metadados não muda um lote existente; não há realocação por popularidade.

JSON de exportação versão 1 conserva os registros. Importação valida o formato e URLs, desconsidera IDs/coordenadas fornecidos, preserva posições existentes e aloca lotes livres para novos registros. Arquivos inválidos são recusados antes de gravar. Importações que excedam a capacidade informam o número efetivamente aplicado. Não importar conteúdo em HTML nem executar scripts do arquivo.

## Fontes e limites

| Filtro | Fonte remota | O que não é prometido |
| --- | --- | --- |
| Tudo | As quatro fontes abaixo, mais o catálogo/cache | Cobertura de toda a internet |
| Canais | Nenhuma; catálogo editorial e links salvos | Busca geral do YouTube ou metadados de qualquer canal |
| Projetos | `api.github.com/search/repositories` | Resultados privados, cobertura ilimitada ou ausência de rate limit |
| Livros | `openlibrary.org/search.json` | Texto integral ou disponibilidade gratuita da obra |
| Imagens | `commons.wikimedia.org/w/api.php` | Licença única para todos os arquivos |
| Artigos | `pt.wikipedia.org/w/api.php` | Busca geral de notícias ou sites |
| Sites | Nenhuma; catálogo editorial e links salvos | Índice de todos os domínios |
| Vídeos | Nenhuma; endereços salvos | Busca por nome ou reprodução embutida universal |

O texto é enviado somente após uma ação de pesquisa, para as fontes compatíveis com o filtro. Cada adapter solicita até oito resultados, com até três consultas em paralelo e timeout de 6,5 segundos por fonte. Uma consulta em **Tudo** pode ocupar duas ondas; os resultados locais já são clicáveis durante a espera. Cancelar/fechar aborta a consulta. Falhas, 403 e 429 aparecem como indisponibilidade/limite; não há proxy público, rotação de IP, scraping bloqueado ou contorno de CORS/robots. O cache de consultas evita repetir pedidos bem-sucedidos; falhas completas não geram sucesso fabricado.

Resultados externos não determinam identidade oficial. GitHub fornece descrições/estatísticas e avatares de proprietários; Open Library fornece títulos/autores/capas; Commons fornece miniaturas, descrição, créditos e licença; Wikipédia fornece título e trecho. Atribuição e o endereço original são acessíveis no painel. Registrar um link não verifica sua existência nem preenche conteúdo imaginado.

## Representação e recursos

Projetos são volumes tecnológicos, livros usam corpos editoriais, imagens têm galerias e canais têm estúdios. Categorias do catálogo também geram mercados, campi e torres. Níveis 1/2/3 conservam a separação entre URL sem metadados, informações disponíveis e evidência de identidade; não são popularidade. Sem cores oficiais verificadas, a paleta é decorativa.

Painéis de texto e imagens são meshes no mundo, sujeitos a profundidade/oclusão. O menu de detalhes complementa os painéis e oferece a fonte; não substitui a geometria da cidade. Não há autoplay, download de vídeo, interiores ou interpretação irrestrita de páginas arbitrárias.

Chunks entram em raio 2 e saem após raio 3, com full/lite e no máximo duas criações por quadro. Objetos repetidos usam InstancedMesh; frustum culling é nativo. Geometrias/materiais são compartilhados e os recursos específicos de cada chunk são descartados ao sair. Sombras de uma luz, sem pós-processamento, só são atualizadas quando geometria/personagem mudam.

`MediaPool` carrega duas imagens por vez, apenas em chunks próximos com detalhe completo, reutiliza até 20 entradas sem referência e reduz imagens para no máximo 512 px antes de enviá-las à GPU. Somente hosts dos provedores de mídia são usados (`avatars.githubusercontent.com`, `covers.openlibrary.org`, `upload.wikimedia.org`, `thumb.wikimedia.org`). Falha de CORS preserva a placa textual. Imagens não são obrigatórias para andar, pesquisar ou teleportar. O modo econômico automático reduz DPR para 0,75 e desativa sombras após lentidão sustentada.

Não há service worker nesta versão. Após carregar a página, uma falha de rede mantém o catálogo e dados locais utilizáveis; reabrir/recarregar o site completamente sem conexão depende do cache HTTP do navegador. Os dados sobrevivem à recarga quando o IndexedDB é permitido, mas não são backup permanente: exporte-os antes de limpar dados do navegador.
