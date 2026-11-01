# ⚽ Tabela eFootball League - 4 Jogadores

Sistema web completo para gerenciar campeonato de pontos corridos entre amigos no eFootball, com 4 jogadores, 6 rodadas (turno de ida e returno de volta), pontuação oficial e atualização em tempo real.

---

## 👥 Jogadores Oficiais
- **Sidney**
- **Miguel**
- **Gabriel**
- **Pedro**

---

## 🏆 Regras e Pontuação
- **Vitória:** 3 pontos
- **Empate:** 1 ponto para cada jogador
- **Derrota:** 0 pontos
- **Campeão:** O jogador que terminar no 1º lugar após as 6 rodadas. Caso algum jogador garanta o título matematicamente com antecedência, o sistema já coroa o campeão com banner e efeito de confetes!

### 📊 Critérios de Desempate
1. Maior número de pontos (**PTS**)
2. Maior número de vitórias (**V**)
3. Maior saldo de gols (**SG = GP - GC**)
4. Maior número de gols marcados / pró (**GP**)
5. Menor número de gols sofridos (**GC**)
6. Confronto direto entre os jogadores empatados

---

## 📅 Estrutura das 6 Rodadas (Turno e Returno)

### 🔄 Turno (Ida)
- **Rodada 1:**
  - Sidney x Pedro
  - Miguel x Gabriel
- **Rodada 2:**
  - Pedro x Gabriel
  - Sidney x Miguel
- **Rodada 3:**
  - Miguel x Pedro
  - Gabriel x Sidney

### 🔁 Returno (Volta - Mandos Invertidos)
- **Rodada 4:**
  - Pedro x Sidney
  - Gabriel x Miguel
- **Rodada 5:**
  - Gabriel x Pedro
  - Miguel x Sidney
- **Rodada 6:**
  - Pedro x Miguel
  - Sidney x Gabriel

*Total: 12 partidas. Cada jogador disputa exatamente 6 partidas (3 em casa e 3 fora).*

---

## 🚀 Como Executar o Projeto

Basta abrir o arquivo `index.html` em qualquer navegador web (Google Chrome, Microsoft Edge, Firefox, Safari, etc.):

- Dê um **duplo clique** no arquivo `index.html`; ou
- Arraste o arquivo `index.html` para a janela do seu navegador.

---

## ✨ Recursos do Site
1. **Preenchimento intuitivo dos placares:**
   - Botões de **`+`** e **`−`** para adicionar ou subtrair gols com um toque no celular ou clique do mouse.
   - Digitação direta no teclado numérico.
   - Botão para limpar o placar de um confronto individual.
2. **Atualização em Tempo Real:**
   - A tabela calcula automaticamente Pontos, Jogos, Vitórias, Empates, Derrotas, Gols Pró, Gols Contra, Saldo, Aproveitamento (%) e Forma Recente (V, E, D).
3. **Persistência Automática:**
   - Todos os placares e dados ficam salvos automaticamente no `localStorage` do navegador. Você pode fechar o navegador e voltar que nada se perde.
4. **Pop-ups Dedicados (Sem alerts ou confirms nativos):**
   - Modal moderno de confirmação para ações críticas (como zerar o torneio).
   - Sistema de Toasts flutuantes para avisos e notificações.
5. **Copiar para WhatsApp:**
   - Botão no cabeçalho que formata a tabela com emojis, medalhas e pontos pronta para enviar no grupo dos amigos.
6. **Estatísticas do Torneio:**
   - Total de gols marcados, média de gols por partida, melhor ataque e melhor defesa.

