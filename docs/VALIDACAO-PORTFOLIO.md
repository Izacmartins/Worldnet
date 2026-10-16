# Validação · Worldnet 1.3

Executada em 16/10/2026, Node 24.19, Vite 6.4.4 e Chromium 154/Linux. Fontes do aplicativo padrão são estáticas; nenhum backend do Worldnet foi usado nos testes do build.

## Resultados funcionais

- `npm ci --cache /tmp/worldnet-npm-cache --no-audit --no-fund`: instalação com lockfile e verificação de integridade preservados. O cache global deste ambiente não era gravável; usar cache de tarefa resolveu a instalação. Metadados/checksums de Three, Vite e Phaser conferidos com o registro npm; nenhuma dependência foi atualizada para contornar erro.
- `npm test`: **43 testes passaram**, nenhum falhou/pulado. Incluem normalização de recursos, classificação, endereço estável, lotes, colisões, metadados, fontes e validação de importação. Testes legados do serviço Node também continuam passando, embora o site não o use.
- `npm run build`: passou. Entrada padrão 3D e assets relativos; alias `3d.html` e protótipo `legacy.html` separados. A página 3D não baixa o bundle Phaser. JS principal 567,77 kB (148,57 kB gzip), módulo compartilhado 37,08 kB (15,50 kB gzip), CSS 9,32 kB (2,65 kB gzip). O aviso de chunk acima de 500 kB continua: Three.js está no bundle principal; não é falha do build.
- `npm run test:pages`: **passou**, servindo apenas `dist/` sob `/Worldnet/`, sem proxy/API. Nenhuma chamada ao backend e nenhum erro JavaScript.

O teste do build usa respostas controladas explicitamente identificadas como fixtures. Verifica: início na cidade 3D, NASA por nome no catálogo, filtros/fontes, falha parcial e total de fontes, cache, links sem metadados inventados, teleporte, teclado após fechar painéis, arraste no chão, órbita, colisão, IndexedDB após recarga, exportação/importação, isolamento entre dois visitantes, armazenamento bloqueado com fallback em memória, temas, viewport estreito, alias em subpasta e perda/recuperação real de contexto WebGL.

As capturas desktop claro/escuro e mobile foram inspecionadas. Pesquisa e ajuda só ocupam o centro quando abertas; a cidade continua visível durante exploração. A tecla Escape fecha o painel em uma ação, incluindo quando o foco está no campo de busca.

Após três viagens de ida/volta para o mesmo conjunto de lugares: **13 texturas, 14 geometrias e 32 chunks** em cada amostra. Chunks descartados cresceram de **144 → 174 → 204**. Esse teste não detectou crescimento de recursos GPU após aquecimento, nem travamento funcional. Não equivale a um teste de memória de horas de duração.

Arquivos gerados localmente: `test-results/pages-smoke.json`, `portfolio-central.png`, `portfolio-light.png`, `portfolio-mobile.png` e `portfolio-mobile-search.png`. Não entram no Git.

## Fontes reais, separadas das fixtures

Com Vite ativo: `WORLDNET_TEST_URL=http://127.0.0.1:5174/ node --use-system-ca --use-env-proxy tests/live-sources.mjs --system-trust`.

| Fonte | Consulta de diagnóstico | Resultado real observado |
| --- | --- | --- |
| GitHub | astronomy | 8 projetos; primeiro `astropy/astropy` |
| Open Library | astronomy | 8 livros; também foi visitado `Astronomy`, obra `OL1942842W` |
| Wikimedia Commons | Milky Way | 6 imagens; visitado `Milky way in Elbrus.jpg` |
| Wikipédia | astronomia | 6 artigos; visitado `Astronomia` |

Também foram recebidos HTTP 200 de avatares GitHub, capas Open Library e miniaturas `thumb.wikimedia.org`, e imagens reais apareceram em superfícies da cena. O teste confirmou cabeçalhos CORS `*` ou a origem de teste. As respostas mudam com a fonte; não são uma ordem garantida para futuras consultas.

**Limite do ambiente:** o Chromium não confia no certificado do proxy desta nuvem. A tentativa de acesso HTTPS direto no Chromium falhou por certificado, sem desativar verificação. O parâmetro `--system-trust` usa o cliente Node com TLS verificado pelo certificado confiável do sistema, repassando aos testes os status, corpos e cabeçalhos CORS reais. Esse transporte só existe no teste e não integra o site, build ou hospedagem. Assim, houve validação de dados reais e da integração visual com os cabeçalhos reais, mas não certificação de HTTPS direto em um navegador doméstico. As fontes públicas suportam CORS na resposta observada; bloqueios e limites em outras redes permanecem possíveis.

## Desempenho medido

`WORLDNET_TEST_URL=http://127.0.0.1:5174 npm run test:perf3d`, com aquecimento e amostragem do cenário inicial. **SwiftShader é renderização por software**, não GPU física. Valores aproximados:

| Condição | Cena pronta | FPS médio da amostra | p95 | Heap JS | Draw calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop 1280×720 | 1,62 s | 9,8 | 183 ms | 10,9 MB | 63 |
| Desktop, CPU 4× mais lenta | 1,24 s | 8,7 | 233 ms | 10,9 MB | 63 |
| Viewport móvel 390×844 | 0,71 s | 26,5 | 67 ms | 9,6 MB | 36 |

Nenhum erro JavaScript; modo econômico ativou nas três condições. A cena inicial variou entre aproximadamente 5,8 e 8,6 mil triângulos. Heap JS não é memória total do processo/GPU. O teste foi em viewport móvel, não aparelho móvel físico.

Metas para GPU integrada física, ainda **não certificadas**: 60 FPS normal, pelo menos 30 FPS econômico, p95 ≤33,3 ms no econômico, até 200 draw calls, 200 mil triângulos e heap inicial abaixo de 200 MB. Os resultados de software ficaram abaixo da meta de FPS. Portanto esta entrega é uma experiência funcional de portfólio, sem declaração de migração completa de todos os requisitos originais ou fluidez universal.

## Publicação e limites do produto

Build e testes não ativam hospedagem. A branch `gh-pages` recebe os artefatos estáticos; o proprietário configura a hospedagem. Na verificação desta sessão, o repositório continuava privado, Pages desativado e sua visibilidade foi preservada.

Não há índice geral Google/YouTube, descoberta de qualquer canal por nome, reprodução de mídia universal, identidade oficial inferida, mundo compartilhado entre visitantes ou garantia de disponibilidade de serviços externos. Canais por nome pertencem ao catálogo editorial/local. Novos links são registrados como endereços informados. Esses limites aparecem na interface e na documentação.
