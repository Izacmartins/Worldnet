# Worldnet — núcleo 3D experimental

Esta é uma entrada alternativa em `/3d.html`. A entrada `/` continua usando Phaser para permitir comparação e evitar substituir o renderizador antes da validação completa. O novo mundo é renderizado por Three.js, não por CSS, fachadas desenhadas ou imagens de uma cidade.

## Execução

Requer Node 24.12+, npm e navegador com WebGL2. Os comandos do motor de busca permanecem os mesmos:

```sh
npm ci
npm run search:up  # opcional, para a instância própria do SearXNG
npm run dev
```

Abra a entrada `3d.html` no servidor do projeto. A versão 2D e a 3D compartilham a API de busca, o SQLite e o cache de recursos em IndexedDB. O build inclui ambas as páginas; `npm run build` e `npm start` também servem `/3d.html`.

WASD/setas movem em relação à câmera. Segurar o botão esquerdo no chão guia o personagem. Arrastar com botão direito ou Shift gira a câmera elevada; a roda altera a distância. E/F abre informações do lugar atual, `/` abre a busca e Escape fecha diálogos. Clicar perto em um prédio ou painel abre suas informações; clicar na Central abre a pesquisa. A UI fica no DOM; edifícios, placas e suportes fazem parte da cena 3D.

## Implementação

- `src/world3d/model.js`: descritores determinísticos e registro de endereços, sem objetos Three. Categorias/sementes existentes são reutilizadas. Recursos preservam as coordenadas SQLite, convertendo células lógicas para 32 × 24 metros.
- `simulation.js`: estado independente, personagem no chão, raio de colisão e resolução por eixo. Colisores vêm dos mesmos volumes que originam os prédios, incluindo painéis. Não há gravidade, salto, interiores ou superfícies com desnível; não se trata de uma simulação física completa. Uma futura navegação vertical poderá exigir um controlador/física como Rapier.
- `input.js`: ações de teclado e mouse, limpeza de teclas na perda de foco e separação dos controles de câmera. Fechar um diálogo não deve limpar teclas novas que chegaram depois do fechamento.
- `objects.js`: geometria volumétrica para corpos, anexos, coberturas, janelas, árvores, placas e personagem. Variações incluem pavilhão comercial, corpos editoriais, pátio comunitário, estúdio, telão, torre e terraços. Peças repetidas usam InstancedMesh e geometria/material compartilhados.
- `chunks.js`: carrega raio de duas células, retém até raio três para evitar recriação na fronteira. Cria no máximo dois chunks por quadro, com orçamento desejado de 4 ms (uma criação indivisível ainda pode ultrapassá-lo). Níveis full/lite suprimem janelas/placas distantes; objetos mantêm frustum culling nativo. Recursos GPU próprios são descartados ao descarregar.
- `runtime.js`: PerspectiveCamera elevada, luz hemisférica e uma direcional, sombras de 1024 limitadas a região próxima, fog, redimensionamento e ciclo WebGL. Após lentidão sustentada, reduz resolução para DPR 0,75 e desativa sombras; nunca remove colisões, busca ou controle. Não há pós-processamento.
- `main.js`: menus, busca, seleção de destino, teleporte seguro e informações com origem. Não usa o renderizador como banco de dados.

Uma origem móvel é recalculada por célula: simulação e persistência conservam coordenadas globais, enquanto cena, câmera e luz usam coordenadas próximas de zero. Isso evita deslocar a autoridade dos endereços e reduz problemas de precisão em regiões distantes.

O avatar tem cerca de 2 m com a cabeça; edifícios ficam entre aproximadamente 5 e 17 m. A câmera continua em terceira pessoa, elevada. Cores sem fonte são decorativas; dados URL-only continuam identificados e no nível 1. Texturas locais CanvasTexture contêm títulos e origem reais, ou a apresentação literal do endereço. A caixa do edifício tem volume, laterais, cobertura e sombras; a placa é uma superfície física integrada a essa geometria.

## Escopo e limites

O núcleo já conecta recursos individuais (incluindo canais e vídeos) à sua representação 3D. Não interpreta visualmente todo o conteúdo da internet. Miniaturas remotas, logos oficiais em texturas, reprodução de vídeos, rotas semânticas, bairros temáticos e hierarquias visuais de canais ainda não foram migrados. As placas desta etapa exibem metadados disponíveis, sem fabricar imagens, manchetes, preços ou autoria.

O catálogo de ranking continua sendo uma fonte externa. Se ele não carregar, a Central e os recursos do índice local continuam acessíveis; os demais lotes são parques/áreas vazias. Não preencher o mundo com nomes ou dados fictícios para esconder falhas de rede. Coordenadas do catálogo legado podem mudar com suas atualizações; a persistência forte desta etapa vale para os recursos registrados no SQLite.

O celular recebe layout responsivo e arraste para caminhar; a rotação usa botão direito/Shift no desktop. Gestos de rotação multitoque e validação em aparelho físico ainda estão pendentes. Não há garantia de acessibilidade completa apenas por haver menus HTML.

## Verificação e desempenho

```sh
npm test
npm run build
npm run test:3d      # com servidor dev ativo e Chromium instalado
npm run test:browser # regressão da entrada 2D
```

O teste 3D usa links conhecidos para registrar canais sem alegar descoberta remota, verifica teleporte, interação, movimento, órbita, temas, recarga, viagens distantes, limites de recursos, viewport estreito e perda/recuperação real de contexto WebGL quando a extensão do navegador permite. Screenshots e JSON são gerados em `test-results/`. Ele consulta a instância exata do módulo carregado pelo HTML, incluindo o parâmetro de versão do Vite, para não criar um segundo renderizador durante a instrumentação.

O diagnóstico na ajuda mostra FPS, p95 de frame, draw calls, triângulos, chunks e texturas. `inspect3D()` também expõe contagens de criação/descarte e heap quando o navegador oferece essa métrica. A janela de FPS/p95 corresponde aos últimos 180 frames; o heap não representa toda a memória GPU. Resultados medidos nesta máquina devem ser lidos no relatório de validação, sem equivaler renderização por software a uma GPU física.

Metas para validação posterior em GPU integrada real, 1280×720: 60 FPS no modo normal, ao menos 30 no modo econômico, p95 ≤33,3 ms no modo econômico, até 200 draw calls e 200 mil triângulos. Após dez viagens repetidas, texturas/geometrias devem estabilizar, sem crescimento persistente. Essas são metas, não certificação de desempenho já atingida em todas as máquinas. O orçamento de heap inicial é 200 MB; medir em sessão longa e dispositivos modestos ainda é necessário.

A liberação das fontes de busca continua uma configuração de rede independente do 3D. Instalar Three.js não resolve bloqueios 403 do proxy e não amplia automaticamente a cobertura do índice.
