# ⚽ Tabela eFootball League - Tempo Real na Nuvem

Sistema web completo para gerenciar campeonatos de pontos corridos entre amigos no eFootball, com **sincronização em tempo real (Realtime)** via Google Firebase Firestore, **inscrição dinâmica de jogadores**, **geração automática de rodadas (Ida e Volta)** e layout responsivo ultra-amplo.

---

## ⚡ Sincronização em Tempo Real (Multi-usuário)
- Conectado diretamente ao **Google Firebase Firestore**.
- Qualquer placar preenchido ou jogador adicionado é sincronizado **instantaneamente** na tela de todos os amigos conectados (celular ou computador).
- Indicador visual no topo do site:
  - 🟢 **Ao vivo • Tempo Real**: Conexão ativa com a nuvem.
  - 🔄 **Sincronizando...**: Salvando alterações.
  - 🔴 **Offline**: Modo local caso a internet caia (com sincronização automática ao restabelecer).

---

## 👥 Jogadores e Formato do Torneio
- **Participantes Iniciais:** **Sidney**, **Miguel**, **Gabriel** e **Pedro**
- **Inscrição de Novos Jogadores:** Aba dedicada para cadastrar novos amigos ou remover participantes.
- **Ajuste Automático:** O sistema recalcula a grade de jogos com turno (ida) e returno (volta) de forma equilibrada.
- **Sistema de Pontuação Oficial:**
  - 🥇 **Vitória:** 3 pontos
  - 🤝 **Empate:** 1 ponto para cada jogador
  - ❌ **Derrota:** 0 pontos
- **Campeão:** O 1º colocado ao final de todas as rodadas recebe o banner dourado com animação de confetes! 🎉

### 📊 Critérios de Desempate
1. Maior número de pontos (**PTS**)
2. Maior número de vitórias (**V**)
3. Maior saldo de gols (**SG = GP - GC**)
4. Maior número de gols marcados / pró (**GP**)
5. Menor número de gols sofridos (**GC**)
6. Confronto direto entre os jogadores empatados

---

## 🎮 Interface e Visual
- **Layout Expandido (1480px):** Espaço amplo para acomodar os nomes dos jogadores sem cortes nas partidas.
- **Cards de Confrontos Otimizados:** Espaçamento generoso entre os times, placares claros e botões rápidos de `+` e `−`.
- **Pop-ups Dedicados:** Modais modernos de confirmação e toasts flutuantes (sem utilizar `alert()` ou `confirm()`).
- **Exportação para WhatsApp:** Cópia formatada da classificação com medalhas e emojis pronta para colar no grupo.
