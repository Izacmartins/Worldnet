# Validação do incremento de busca (histórico)

- Node 24.19.0, npm 11.9.0, Docker 28.4.0, Chromium/SwiftShader em Linux.
- `npm ci`: sucesso com lockfile; 18 pacotes instalados.
- `npm test`: 30 testes aprovados, zero falhas/ignorados. Inclui SQLite reaberto, FTS5, normalização/deduplicação, cache, fontes parciais, oEmbed simulado, API HTTP e teleporte/colisão.
- `npm run build`: sucesso; JavaScript 1.556,96 kB (369,09 kB gzip). Alerta de bundle grande mantido visível. A otimização do renderer legado ainda é necessária.
- `npm start` testado em porta separada: HTML e /api/health HTTP 200; registros sobrevivem ao reinício da API.
- SearXNG próprio instalado por digest, JSON habilitado, endpoint HTTP 200; `npm run search:up` repetido sem recriar configurações ou perder dados.
- Busca externa real por “astronomia”: fontes indisponíveis. DuckDuckGo/Wikimedia receberam recusa do proxy, incluindo 403 confirmado. O registro de vídeo por URL tentou oEmbed real, retornando URL-only e aviso de metadados indisponíveis, sem título inventado.
- Testes de providers com respostas bem-sucedidas são fixtures, não evidência de disponibilidade das fontes públicas.
- `npm run test:browser`: aprovado na execução final, incluindo ocultar/restaurar o canvas. O smoke test Chromium usa URLs conhecidas de dois canais, verifica lugares separados, teleporte, colisão, WASD, mouse, setas após fechar conteúdo, temas, recarga, viewport móvel e ausência de erros JS. Resultados detalhados e screenshots ficam em test-results/ (fora do Git).
- Durante o desenvolvimento o teste encontrou framebuffers de tamanho zero em transições de layout; corrigido com configuração mínima suportada do Phaser, preservando as verificações de erro.
- FPS, relevância de busca ampla, GPU física, Firefox e hospedagem pública não foram validados. Renderização continua 2D; coleta geral de páginas e migração 3D não fazem parte deste incremento.
- Rascunho do ambiente salvo com install_script, start_skill, variável SEARXNG_URL e 11 destinos adicionais de rede. Salvar o rascunho não aplicou permissões ao runtime e não publicou o ambiente.

A validação do núcleo 3D e o estado atual da consulta real estão em [VALIDACAO-3D.md](VALIDACAO-3D.md).
