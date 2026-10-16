# Validação do núcleo 3D

Execução em 16/10/2026, Linux, Node 24.19.0. Navegador Chromium 154.0.8037.57, ANGLE/SwiftShader em renderização por software. Não houve teste em GPU física, Firefox ou celular real.

## Resultado funcional

- `npm test`: 35 aprovados, zero falhas/ignorados. Inclui arquitetura procedural, endereços persistentes, colisões de volumes, deslizamento, teleporte negativo/distante e velocidade.
- `npm run build`: sucesso, duas entradas HTML. Chunk exclusivo 3D de 553,09 kB (143,37 kB gzip), mais módulo compartilhado de 25,77 kB (11,17 kB gzip). Chunk legado 2D de 1.531,89 kB (358,42 kB gzip). Alerta de chunks grandes mantido visível; a entrada 3D não importa Phaser.
- `npm run test:3d`: aprovado. Verificou geometria 3D, dois canais em lugares distintos, teleporte, WASD/setas/mouse, câmera orbitável, interação/foco, temas, viagens entre distritos, recarga persistente, layout 390×844, perda/recuperação real de contexto WebGL e ocultar/restaurar canvas. Zero erros JavaScript. Três viagens repetidas verificaram descarte e limite de texturas/geometrias; não é teste de duração longa ou dez viagens.
- `npm run test:browser`: regressão 2D aprovada após inclusão do link para a nova entrada, incluindo layout estreito.
- Produção em porta separada: /3d.html, JavaScript de entrada, módulo compartilhado e CSS responderam HTTP 200.
- Consulta real via API por “astronomia”: 10 resultados da Wikipédia, SearXNG indisponível. Os artigos foram persistidos; não são fixtures. No navegador, a pesquisa levou ao prédio de **Astronomia**, com fonte Wikipédia, endereço https://pt.wikipedia.org/wiki/Astronomia e teleporte sem colisão. Zero erros JavaScript nesse fluxo. Metadados e link, sem afirmar que o corpo inteiro do artigo já está fisicamente renderizado.

Clique 3D na estação física também foi verificado por Raycaster: abriu a pesquisa sem usar o botão HTML.

## Medições reproduzíveis

`npm run test:perf3d`, sequencial, cena central com 25 chunks, predominantemente parques e a Central. A medição é de cena ociosa, não de percurso por uma cidade lotada. Cada condição aqueceu por 5 s e observou mais 6 s; a janela de métricas considera até 180 frames e pode incluir parte do aquecimento. Tempos de entrada usam servidor Vite já ativo e aquecido; não representam download de produção por rede móvel.

| Condição | Entrada com 25 chunks | FPS | p95 frame | Draw calls | Triângulos | Heap JS |
| --- | --- | --- | --- | --- | --- | --- |
| desktop-software | 919 ms | 16.7 | 100.1 ms | 63 | 4220 | 8.5 MiB |
| desktop-cpu4x | 754 ms | 15.1 | 133.4 ms | 63 | 4220 | 8.4 MiB |
| mobile-software | 432 ms | 39.3 | 50.0 ms | 37 | 2444 | 8.7 MiB |

As três condições ativaram o modo econômico (DPR 0,75, sem sombras), sem erros JavaScript. A condição CPU4x usa limitação do Chromium; “mobile” significa viewport, não dispositivo físico. Texturas: 4; geometrias: 5 nessa cena. O heap depende da disponibilidade da API do Chromium e não contabiliza toda a memória de GPU.

A meta de 30 FPS/p95 ≤33,3 ms em modo econômico **não foi atingida no desktop por software**. O viewport móvel superou 30 FPS médios, mas p95 também ficou acima da meta. Não declarar otimização concluída nem extrapolar esses números para hardware real. Próxima validação: percurso em GPU integrada física, carga de conteúdo mais densa, resolução adaptativa progressiva e perfil de GPU antes de adicionar efeitos.

## Correções encontradas pelo teste

- Fechamento nativo de diálogos dispara evento assíncrono: limpar teclas nesse evento apagava uma tecla nova. O foco agora é restaurado sem apagar ações posteriores ao fechamento; Escape e botões também restauram foco imediatamente.
- A instrumentação inicialmente importava o módulo sem o parâmetro de versão do Vite e criava outra aplicação. Os testes agora leem a instância carregada pelo HTML. Capturas preliminares anteriores a essa correção não são usadas como benchmark.
- Atualizar somente datas de recursos não invalida mais toda a cena de chunks.

## Pendências

SearXNG precisa de diagnóstico/liberação das fontes antes de validar busca geral. Logos e imagens/vídeos remotos ainda não foram integrados às superfícies 3D; placas exibem metadados disponíveis. Interiores, movimento vertical, gestos de câmera multitoque, agrupamento semântico e validação prolongada de memória também estão pendentes. O catálogo legado pode falhar e seus endereços não têm a mesma persistência do registro de recursos. A versão 2D continua disponível como alternativa; esta entrega é um núcleo 3D experimental, não a migração completa de todos os critérios originais.

O rascunho de inicialização do ambiente foi atualizado para incluir execução e validação das duas entradas. Salvar o rascunho não publicou a nova versão do ambiente.
