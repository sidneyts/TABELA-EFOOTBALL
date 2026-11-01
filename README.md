# ⚽ Tabela eFootball League - Sistema Dinâmico de Campeonato

Sistema web completo para gerenciar campeonatos de pontos corridos entre amigos no eFootball, com suporte a **inscrição dinâmica de jogadores**, **geração automática de rodadas (Turno e Returno / Ida e Volta)**, pontuação oficial e atualização em tempo real.

---

## 👥 Jogadores e Formato do Torneio
- **Jogadores Iniciais:** **Sidney**, **Miguel**, **Gabriel** e **Pedro**
- **Inscrição de Novos Jogadores:** Aba dedicada para cadastrar novos amigos ou remover participantes.
- **Ajuste Automático:** O sistema recalcula automaticamente a grade de jogos com turno (ida) e returno (volta) para que todos joguem contra todos com mandos de campo balanceados.
- **Sistema de Pontuação Oficial:**
  - 🥇 **Vitória:** 3 pontos
  - 🤝 **Empate:** 1 ponto para cada jogador
  - ❌ **Derrota:** 0 pontos
- **Campeão:** O 1º colocado ao final de todas as rodadas (ou com garantia matemática antecipada) recebe o banner dourado com animação de confetes! 🎉

### 📊 Critérios de Desempate
1. Maior número de pontos (**PTS**)
2. Maior número de vitórias (**V**)
3. Maior saldo de gols (**SG = GP - GC**)
4. Maior número de gols marcados / pró (**GP**)
5. Menor número de gols sofridos (**GC**)
6. Confronto direto entre os jogadores empatados

---

## 🎮 Funcionalidades Principais

### 1. Aba "Tabela & Jogos"
- **Classificação Completa em Tempo Real:** Posição, Jogador, Pontos (PTS), Jogos (J), Vitórias (V), Empates (E), Derrotas (D), Gols Pró (GP), Gols Sofridos (GC), Saldo (SG), Aproveitamento (%) e Forma Recente (V, E, D).
- **Cards de Partidas com Controles Rápidos:** Botões de `+` e `−` para toque rápido no celular ou digitação numérica direta.
- **Filtro de Rodadas:** Alterne facilmente entre *Todas as Rodadas*, *Turno (Ida)* e *Returno (Volta)*.
- **Estatísticas Rápidas:** Total de gols, média de gols por jogo, melhor ataque e melhor defesa.
- **Copiar para WhatsApp:** Botão que formata a classificação com emojis e medalhas pronta para colar no grupo.

### 2. Aba "Inscrever Jogadores"
- **Adicionar Jogador:** Digite o nome do amigo e adicione ao campeonato. O sistema avisa se houver jogos em andamento antes de recalcular.
- **Remover Jogador:** Remova participantes com confirmação visual em pop-up dedicado (mantendo o mínimo de 3 participantes).
- **Resumo Dinâmico:** Mostra em tempo real a quantidade de jogadores inscritos, total de rodadas e total de partidas geradas.

### 3. Pop-ups e Notificações Dedicados
- Interface 100% customizada sem usar `alert()` ou `confirm()`. Modais modernos com backdrop blur e sistema de toasts flutuantes.

### 4. Salvamento Automático
- Todos os dados ficam salvos automaticamente no `localStorage` do navegador.

---

## 🚀 Como Executar
Basta dar um duplo clique no arquivo `index.html` ou abri-lo em qualquer navegador web.
