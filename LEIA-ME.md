# Worldnet City v1.2 — Conteúdo verdadeiro dentro do mundo

Esta versão corrige um erro da v1.1: as mini-abas mostravam apenas ilustrações.
Agora há janelas físicas ancoradas na cidade que tentam carregar **conteúdo de
fontes públicas** e exibi-lo diretamente no cenário.

## Instalação no Windows

1. Extraia o ZIP para uma pasta nova.
2. Abra a pasta no VS Code.
3. Execute no terminal:

   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```

4. Acesse o endereço local indicado, geralmente `http://localhost:5173/`.

## Conteúdo visível no mapa

- **Imagens:** miniaturas reais relacionadas ao assunto, buscadas no Wikimedia Commons.
  Se não houver resultado, o sistema tenta as miniaturas de artigos da Wikipédia.
- **Vídeos:** miniaturas de vídeos públicos relacionados encontradas no Commons.
  Nada começa a tocar automaticamente.
- **Notícias:** manchetes publicadas no Wikinews, com fonte e data quando disponível.
- **Leituras:** títulos de artigos reais da Wikipédia.
- **Sobre um site:** título, domínio e descrição fornecidos pelo catálogo.
- **Lojas e comunidades:** informações disponíveis sobre o site, sem inventar
  produtos, anúncios ou mensagens.

As referências Wikimedia mostradas perto de um edifício são **relacionadas ao
assunto do site**, não necessariamente publicadas por ele. O Worldnet ainda não
pode ler livremente o conteúdo de qualquer domínio; navegadores impõem CORS.

## Desempenho

- No máximo 4 janelas físicas visíveis em telas grandes e 2 em telas menores.
- No máximo 2 consultas de conteúdo externo simultâneas.
- Consultas somente para conteúdo próximo e janelas recicladas ao caminhar.
- Cache em IndexedDB (notícias até uma hora, demais conteúdos até 24 horas).
- Imagens carregadas sob demanda; sem reprodução automática de vídeo.
- Se a fonte bloquear ou não tiver resultados, a janela informa claramente.

## Interação

As mini-abas já mostram o conteúdo no mapa. Clique em uma delas para abrir
seu explorador completo. Os controles WASD, pesquisa, teleporte, colisões e
temas dark/light foram preservados.

## Validação

Execute `npm test`. As consultas de fontes externas usadas nos testes do
navegador foram **simuladas** para verificar a apresentação e os controles.
A disponibilidade das fontes reais depende da rede do usuário.
