/**
 * eFootball League Manager
 * 4 Jogadores | 6 Rodadas (Turno e Returno) | Pontos Corridos
 * Jogadores: Sidney, Miguel, Gabriel, Pedro
 */

// Jogadores oficiais do campeonato
const PLAYERS = ['Sidney', 'Miguel', 'Gabriel', 'Pedro'];

// Definição das 6 Rodadas (Turno: 1-3 | Returno: 4-6)
// Atualizado com os jogos e resultados reais das Rodadas 1 e 2
const DEFAULT_MATCHES = [
  // TURNO (Ida)
  // Rodada 1 (Realizada)
  { id: 1, round: 1, phase: 'turno', home: 'Miguel', away: 'Pedro', homeScore: 1, awayScore: 2 },
  { id: 2, round: 1, phase: 'turno', home: 'Gabriel', away: 'Sidney', homeScore: 0, awayScore: 4 },

  // Rodada 2 (Realizada)
  { id: 3, round: 2, phase: 'turno', home: 'Gabriel', away: 'Pedro', homeScore: 0, awayScore: 0 },
  { id: 4, round: 2, phase: 'turno', home: 'Miguel', away: 'Sidney', homeScore: 2, awayScore: 2 },

  // Rodada 3 (Próxima para completar o Turno de Ida)
  { id: 5, round: 3, phase: 'turno', home: 'Sidney', away: 'Pedro', homeScore: null, awayScore: null },
  { id: 6, round: 3, phase: 'turno', home: 'Miguel', away: 'Gabriel', homeScore: null, awayScore: null },

  // RETURNO (Volta - Mandos Invertidos)
  // Rodada 4 (Volta da R1)
  { id: 7, round: 4, phase: 'returno', home: 'Pedro', away: 'Miguel', homeScore: null, awayScore: null },
  { id: 8, round: 4, phase: 'returno', home: 'Sidney', away: 'Gabriel', homeScore: null, awayScore: null },

  // Rodada 5 (Volta da R2)
  { id: 9, round: 5, phase: 'returno', home: 'Pedro', away: 'Gabriel', homeScore: null, awayScore: null },
  { id: 10, round: 5, phase: 'returno', home: 'Sidney', away: 'Miguel', homeScore: null, awayScore: null },

  // Rodada 6 (Volta da R3)
  { id: 11, round: 6, phase: 'returno', home: 'Pedro', away: 'Sidney', homeScore: null, awayScore: null },
  { id: 12, round: 6, phase: 'returno', home: 'Gabriel', away: 'Miguel', homeScore: null, awayScore: null }
];

const STORAGE_KEY = 'efootball_league_matches_v2';

// Estado global da aplicação
let matches = [];
let currentFilter = 'all'; // 'all', 'turno', 'returno'

/* ==========================================================================
   Inicialização e Carregamento de Dados
   ========================================================================== */
function init() {
  loadMatches();
  setupEventListeners();
  renderApp();
}

function loadMatches() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      matches = JSON.parse(stored);
      // Garante consistência de IDs e jogadores caso algo mude
      if (!Array.isArray(matches) || matches.length !== DEFAULT_MATCHES.length) {
        matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES));
        saveMatches();
      }
    } catch (e) {
      matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES));
      saveMatches();
    }
  } else {
    matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES));
    saveMatches();
  }
}

function saveMatches() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
}

/* ==========================================================================
   Cálculo da Tabela de Classificação
   ========================================================================== */
function calculateStandings() {
  // Inicializa estatísticas para cada jogador
  const stats = {};
  PLAYERS.forEach(player => {
    stats[player] = {
      name: player,
      pts: 0,
      j: 0,
      v: 0,
      e: 0,
      d: 0,
      gp: 0,
      gc: 0,
      sg: 0,
      pct: 0,
      form: [] // Array com resultados 'V', 'E', 'D' em ordem cronológica
    };
  });

  // Percorre as partidas e acumula os dados dos jogos finalizados
  matches.forEach(m => {
    const isPlayed = m.homeScore !== null && m.awayScore !== null && !isNaN(m.homeScore) && !isNaN(m.awayScore);
    if (!isPlayed) return;

    const hs = parseInt(m.homeScore, 10);
    const as = parseInt(m.awayScore, 10);

    const home = stats[m.home];
    const away = stats[m.away];

    if (!home || !away) return;

    home.j += 1;
    away.j += 1;
    home.gp += hs;
    home.gc += as;
    away.gp += as;
    away.gc += hs;

    if (hs > as) {
      // Vitória do Mandante
      home.pts += 3;
      home.v += 1;
      away.d += 1;
      home.form.push('V');
      away.form.push('D');
    } else if (hs < as) {
      // Vitória do Visitante
      away.pts += 3;
      away.v += 1;
      home.d += 1;
      away.form.push('V');
      home.form.push('D');
    } else {
      // Empate
      home.pts += 1;
      away.pts += 1;
      home.e += 1;
      away.e += 1;
      home.form.push('E');
      away.form.push('E');
    }
  });

  // Calcula Saldo e Aproveitamento
  Object.values(stats).forEach(p => {
    p.sg = p.gp - p.gc;
    const maxPossiblePts = p.j * 3;
    p.pct = maxPossiblePts > 0 ? ((p.pts / maxPossiblePts) * 100).toFixed(1) : '0.0';
  });

  // Converte para array e ordena pelos critérios de desempate
  const standingsList = Object.values(stats);

  standingsList.sort((a, b) => {
    // 1º Critério: Maior Pontuação (PTS)
    if (b.pts !== a.pts) return b.pts - a.pts;

    // 2º Critério: Mais Vitórias (V)
    if (b.v !== a.v) return b.v - a.v;

    // 3º Critério: Maior Saldo de Gols (SG)
    if (b.sg !== a.sg) return b.sg - a.sg;

    // 4º Critério: Mais Gols Marcados (GP)
    if (b.gp !== a.gp) return b.gp - a.gp;

    // 5º Critério: Menos Gols Sofridos (GC)
    if (a.gc !== b.gc) return a.gc - b.gc;

    // 6º Critério: Confronto Direto
    const headToHead = calculateHeadToHead(a.name, b.name);
    if (headToHead !== 0) return headToHead;

    // Fallback: Ordem alfabética
    return a.name.localeCompare(b.name);
  });

  return standingsList;
}

/**
 * Confronto direto entre dois jogadores
 * Retorna negativo se 'a' leva vantagem, positivo se 'b' leva vantagem, 0 se empate
 */
function calculateHeadToHead(playerA, playerB) {
  let ptsA = 0;
  let ptsB = 0;
  let sgA = 0;

  matches.forEach(m => {
    const isPlayed = m.homeScore !== null && m.awayScore !== null;
    if (!isPlayed) return;

    if ((m.home === playerA && m.away === playerB) || (m.home === playerB && m.away === playerA)) {
      const scoreA = m.home === playerA ? m.homeScore : m.awayScore;
      const scoreB = m.home === playerA ? m.awayScore : m.homeScore;

      sgA += (scoreA - scoreB);

      if (scoreA > scoreB) {
        ptsA += 3;
      } else if (scoreA < scoreB) {
        ptsB += 3;
      } else {
        ptsA += 1;
        ptsB += 1;
      }
    }
  });

  if (ptsB !== ptsA) return ptsB - ptsA;
  if (sgA !== 0) return -sgA; // Se sgA for positivo, A é melhor (retorna < 0)
  return 0;
}

/* ==========================================================================
   Renderização dos Componentes
   ========================================================================== */
function renderApp() {
  const standings = calculateStandings();
  renderStandingsTable(standings);
  renderStats(standings);
  renderMatches();
  checkChampionStatus(standings);
}

function renderStandingsTable(standings) {
  const tbody = document.getElementById('standingsBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  standings.forEach((player, index) => {
    const pos = index + 1;
    const tr = document.createElement('tr');

    // Badge de posição
    const posBadgeClass = pos <= 3 ? `pos-${pos}` : '';

    // Forma recente (últimos 5 jogos)
    const recentForm = player.form.slice(-5);
    let formBadgesHtml = '';
    if (recentForm.length === 0) {
      formBadgesHtml = '<span class="form-badge form-empty">-</span>';
    } else {
      formBadgesHtml = recentForm.map(res => {
        const cls = res === 'V' ? 'form-w' : res === 'E' ? 'form-d' : 'form-l';
        return `<span class="form-badge ${cls}" title="${res === 'V' ? 'Vitória' : res === 'E' ? 'Empate' : 'Derrota'}">${res}</span>`;
      }).join('');
    }

    // Avatar com inicial
    const initial = player.name.charAt(0).toUpperCase();

    tr.innerHTML = `
      <td class="pos-cell">
        <span class="pos-badge ${posBadgeClass}">${pos}</span>
      </td>
      <td>
        <div class="player-cell">
          <div class="player-avatar">${initial}</div>
          <span class="player-name-text">${player.name}</span>
        </div>
      </td>
      <td class="pts-cell">${player.pts}</td>
      <td>${player.j}</td>
      <td>${player.v}</td>
      <td>${player.e}</td>
      <td>${player.d}</td>
      <td>${player.gp}</td>
      <td>${player.gc}</td>
      <td>${player.sg > 0 ? '+' + player.sg : player.sg}</td>
      <td>${player.pct}%</td>
      <td>
        <div class="form-badges-container">
          ${formBadgesHtml}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function renderStats(standings) {
  // Jogos concluídos
  const playedMatches = matches.filter(m => m.homeScore !== null && m.awayScore !== null);
  const totalPlayed = playedMatches.length;
  const totalMatches = matches.length; // 12

  // Atualiza barra de progresso
  const progressText = document.getElementById('tournamentProgressText');
  const progressBar = document.getElementById('tournamentProgressBar');
  if (progressText && progressBar) {
    progressText.textContent = `${totalPlayed} / ${totalMatches} Jogos`;
    const pct = Math.round((totalPlayed / totalMatches) * 100);
    progressBar.style.width = `${pct}%`;
  }

  // Total de Gols
  let totalGoals = 0;
  playedMatches.forEach(m => {
    totalGoals += (m.homeScore + m.awayScore);
  });

  const statTotalGoals = document.getElementById('statTotalGoals');
  const statAvgGoals = document.getElementById('statAvgGoals');
  if (statTotalGoals) statTotalGoals.textContent = totalGoals;
  if (statAvgGoals) {
    const avg = totalPlayed > 0 ? (totalGoals / totalPlayed).toFixed(2) : '0.0';
    statAvgGoals.textContent = avg;
  }

  // Melhor Ataque (Mais Gols Pró)
  let bestAttackPlayer = '-';
  let maxGP = 0;
  standings.forEach(p => {
    if (p.gp > maxGP) {
      maxGP = p.gp;
      bestAttackPlayer = p.name;
    }
  });

  const statBestAttack = document.getElementById('statBestAttack');
  const statBestAttackGoals = document.getElementById('statBestAttackGoals');
  if (statBestAttack && statBestAttackGoals) {
    statBestAttack.textContent = maxGP > 0 ? bestAttackPlayer : '-';
    statBestAttackGoals.textContent = `${maxGP} gols marcados`;
  }

  // Melhor Defesa (Menos Gols Sofridos, com pelo menos 1 jogo disputado)
  let bestDefensePlayer = '-';
  let minGC = 9999;
  const activePlayers = standings.filter(p => p.j > 0);
  if (activePlayers.length > 0) {
    activePlayers.forEach(p => {
      if (p.gc < minGC) {
        minGC = p.gc;
        bestDefensePlayer = p.name;
      }
    });
  }

  const statBestDefense = document.getElementById('statBestDefense');
  const statBestDefenseGoals = document.getElementById('statBestDefenseGoals');
  if (statBestDefense && statBestDefenseGoals) {
    if (activePlayers.length > 0 && minGC !== 9999) {
      statBestDefense.textContent = bestDefensePlayer;
      statBestDefenseGoals.textContent = `${minGC} gols sofridos`;
    } else {
      statBestDefense.textContent = '-';
      statBestDefenseGoals.textContent = '0 gols sofridos';
    }
  }
}

function renderMatches() {
  const container = document.getElementById('roundsContainer');
  if (!container) return;

  container.innerHTML = '';

  // Agrupa partidas por rodada (1 a 6)
  const rounds = [1, 2, 3, 4, 5, 6];

  rounds.forEach(roundNum => {
    const roundMatches = matches.filter(m => m.round === roundNum);
    if (roundMatches.length === 0) return;

    const phase = roundNum <= 3 ? 'turno' : 'returno';

    // Aplica filtro de abas (all, turno, returno)
    if (currentFilter !== 'all' && currentFilter !== phase) {
      return;
    }

    const roundCard = document.createElement('div');
    roundCard.className = 'round-card';

    const phaseLabel = phase === 'turno' ? 'Turno (Ida)' : 'Returno (Volta)';
    const phaseTagClass = phase === 'turno' ? 'tag-turno' : 'tag-returno';

    let matchesHtml = '';
    roundMatches.forEach(m => {
      const isPlayed = m.homeScore !== null && m.awayScore !== null;
      let statusClass = '';
      let statusText = 'Não iniciada';
      let homeWinnerClass = '';
      let awayWinnerClass = '';

      if (isPlayed) {
        if (m.homeScore > m.awayScore) {
          statusClass = 'winner-home played';
          homeWinnerClass = 'team-is-winner';
          statusText = `Vitória do ${m.home}`;
        } else if (m.homeScore < m.awayScore) {
          statusClass = 'winner-away played';
          awayWinnerClass = 'team-is-winner';
          statusText = `Vitória do ${m.away}`;
        } else {
          statusClass = 'draw played';
          statusText = 'Empate';
        }
      }

      const homeVal = m.homeScore !== null ? m.homeScore : '';
      const awayVal = m.awayScore !== null ? m.awayScore : '';

      matchesHtml += `
        <div class="match-item ${statusClass}" data-match-id="${m.id}">
          <div class="match-row">
            <!-- Time Mandante -->
            <div class="team-box team-home ${homeWinnerClass}">
              <span class="team-name" title="${m.home}">${m.home}</span>
            </div>

            <!-- Placar & Controles -->
            <div class="score-box-wrapper">
              <div class="score-control">
                <button type="button" class="score-btn" onclick="adjustScore(${m.id}, 'home', -1)" title="Diminuir gol">−</button>
                <input
                  type="number"
                  min="0"
                  max="99"
                  class="score-input"
                  data-match-id="${m.id}"
                  data-team="home"
                  placeholder="-"
                  value="${homeVal}"
                />
                <button type="button" class="score-btn" onclick="adjustScore(${m.id}, 'home', 1)" title="Aumentar gol">+</button>
              </div>

              <span class="score-vs-divider">x</span>

              <div class="score-control">
                <button type="button" class="score-btn" onclick="adjustScore(${m.id}, 'away', -1)" title="Diminuir gol">−</button>
                <input
                  type="number"
                  min="0"
                  max="99"
                  class="score-input"
                  data-match-id="${m.id}"
                  data-team="away"
                  placeholder="-"
                  value="${awayVal}"
                />
                <button type="button" class="score-btn" onclick="adjustScore(${m.id}, 'away', 1)" title="Aumentar gol">+</button>
              </div>
            </div>

            <!-- Time Visitante -->
            <div class="team-box team-away ${awayWinnerClass}">
              <span class="team-name" title="${m.away}">${m.away}</span>
            </div>
          </div>

          <div class="match-status-bar">
            <span class="match-status-text ${isPlayed ? 'status-finished' : ''}">
              ${isPlayed ? '✓ ' + statusText : '• ' + statusText}
            </span>
            ${isPlayed ? `
              <button type="button" class="btn-clear-match" onclick="clearMatchScore(${m.id})" title="Limpar placar deste jogo">
                Limpar
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    roundCard.innerHTML = `
      <div class="round-card-header">
        <h3 class="round-title">
          <span>Rodada ${roundNum}</span>
        </h3>
        <span class="round-phase-tag ${phaseTagClass}">${phaseLabel}</span>
      </div>
      <div class="round-matches-list">
        ${matchesHtml}
      </div>
    `;

    container.appendChild(roundCard);
  });

  // Vincula eventos de digitação direta nos inputs de placar
  attachScoreInputEvents();
}

function attachScoreInputEvents() {
  const inputs = document.querySelectorAll('.score-input');
  inputs.forEach(input => {
    input.addEventListener('input', handleScoreDirectInput);
  });
}

function handleScoreDirectInput(e) {
  const input = e.target;
  const matchId = parseInt(input.dataset.matchId, 10);
  const team = input.dataset.team;
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  const rawVal = input.value.trim();

  if (rawVal === '') {
    if (team === 'home') match.homeScore = null;
    else match.awayScore = null;
  } else {
    let parsed = parseInt(rawVal, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    if (parsed > 99) parsed = 99;

    input.value = parsed;

    if (team === 'home') {
      match.homeScore = parsed;
      if (match.awayScore === null) match.awayScore = 0;
    } else {
      match.awayScore = parsed;
      if (match.homeScore === null) match.homeScore = 0;
    }
  }

  saveMatches();
  updateMatchCardVisual(matchId);
  refreshLeaderboard();
}

/**
 * Atualiza visualmente o card de um jogo específico sem destruir os inputs
 */
function updateMatchCardVisual(matchId) {
  const match = matches.find(m => m.id === matchId);
  const card = document.querySelector(`.match-item[data-match-id="${matchId}"]`);
  if (!match || !card) return;

  const isPlayed = match.homeScore !== null && match.awayScore !== null;
  card.className = `match-item ${isPlayed ? 'played' : ''}`;

  const homeBox = card.querySelector('.team-home');
  const awayBox = card.querySelector('.team-away');
  const statusTextElem = card.querySelector('.match-status-text');
  const statusBar = card.querySelector('.match-status-bar');

  if (homeBox) homeBox.classList.remove('team-is-winner');
  if (awayBox) awayBox.classList.remove('team-is-winner');

  let statusText = '• Não iniciada';
  if (isPlayed) {
    if (match.homeScore > match.awayScore) {
      card.classList.add('winner-home');
      if (homeBox) homeBox.classList.add('team-is-winner');
      statusText = `✓ Vitória do ${match.home}`;
    } else if (match.homeScore < match.awayScore) {
      card.classList.add('winner-away');
      if (awayBox) awayBox.classList.add('team-is-winner');
      statusText = `✓ Vitória do ${match.away}`;
    } else {
      card.classList.add('draw');
      statusText = '✓ Empate';
    }
  }

  if (statusTextElem) {
    statusTextElem.textContent = statusText;
    statusTextElem.className = `match-status-text ${isPlayed ? 'status-finished' : ''}`;
  }

  if (statusBar) {
    let clearBtn = card.querySelector('.btn-clear-match');
    if (isPlayed) {
      if (!clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'btn-clear-match';
        clearBtn.textContent = 'Limpar';
        clearBtn.title = 'Limpar placar deste jogo';
        clearBtn.onclick = () => clearMatchScore(matchId);
        statusBar.appendChild(clearBtn);
      }
    } else if (clearBtn) {
      clearBtn.remove();
    }
  }

  // Sincroniza valores nos inputs quando a alteração não foi por digitação ativa
  const homeInput = card.querySelector(`.score-input[data-team="home"]`);
  const awayInput = card.querySelector(`.score-input[data-team="away"]`);
  if (homeInput && document.activeElement !== homeInput) {
    homeInput.value = match.homeScore !== null ? match.homeScore : '';
  }
  if (awayInput && document.activeElement !== awayInput) {
    awayInput.value = match.awayScore !== null ? match.awayScore : '';
  }
}

/**
 * Atualiza tabela, estatísticas e status de campeão
 */
function refreshLeaderboard() {
  const standings = calculateStandings();
  renderStandingsTable(standings);
  renderStats(standings);
  checkChampionStatus(standings);
}

/**
 * Incrementa ou decrementa o placar com os botões + e -
 */
window.adjustScore = function(matchId, team, delta) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  // Se ambos forem nulos ao começar a pontuar, inicializa com 0
  if (match.homeScore === null && match.awayScore === null) {
    match.homeScore = 0;
    match.awayScore = 0;
  } else {
    if (match.homeScore === null) match.homeScore = 0;
    if (match.awayScore === null) match.awayScore = 0;
  }

  if (team === 'home') {
    let newScore = match.homeScore + delta;
    if (newScore < 0) newScore = 0;
    if (newScore > 99) newScore = 99;
    match.homeScore = newScore;
  } else {
    let newScore = match.awayScore + delta;
    if (newScore < 0) newScore = 0;
    if (newScore > 99) newScore = 99;
    match.awayScore = newScore;
  }

  saveMatches();
  updateMatchCardVisual(matchId);
  refreshLeaderboard();
};

/**
 * Limpa o resultado de um jogo individual
 */
window.clearMatchScore = function(matchId) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  match.homeScore = null;
  match.awayScore = null;

  saveMatches();
  updateMatchCardVisual(matchId);
  refreshLeaderboard();
  showToast(`Placar do jogo ${match.home} x ${match.away} foi zerado.`, 'info');
};

/* ==========================================================================
   Verificação de Campeão & Celebração
   ========================================================================== */
let hasCelebrated = false;

function checkChampionStatus(standings) {
  const banner = document.getElementById('championBanner');
  const championNameElem = document.getElementById('championName');
  const championDetailsElem = document.getElementById('championDetails');

  if (!banner || !championNameElem || !championDetailsElem) return;

  const totalPlayed = matches.filter(m => m.homeScore !== null && m.awayScore !== null).length;
  const isFinished = totalPlayed === matches.length;

  // Verifica se o líder já é matematicamente campeão
  const leader = standings[0];
  const runnerUp = standings[1];

  let isChampionConfirmed = false;
  let reason = '';

  if (isFinished) {
    isChampionConfirmed = true;
    reason = `Campeão incontestável! Todas as 6 rodadas foram concluídas com ${leader.pts} pontos.`;
  } else if (leader.j > 0) {
    // Jogos restantes de cada um
    const matchesRemainingRunnerUp = 6 - runnerUp.j;
    const maxPossiblePtsRunnerUp = runnerUp.pts + (matchesRemainingRunnerUp * 3);

    if (leader.pts > maxPossiblePtsRunnerUp) {
      isChampionConfirmed = true;
      reason = `Campeão antecipado! O 2º colocado não consegue mais alcançar os ${leader.pts} pontos do líder.`;
    }
  }

  if (isChampionConfirmed) {
    banner.classList.remove('hidden');
    championNameElem.textContent = leader.name.toUpperCase();
    championDetailsElem.textContent = reason;

    if (!hasCelebrated && typeof confetti === 'function') {
      hasCelebrated = true;
      triggerConfetti();
    }
  } else {
    banner.classList.add('hidden');
    hasCelebrated = false;
  }
}

function triggerConfetti() {
  if (typeof confetti !== 'function') return;

  const duration = 3.5 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#00f0ff', '#ff0077', '#ffd700', '#00e676']
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#00f0ff', '#ff0077', '#ffd700', '#00e676']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

/* ==========================================================================
   Compartilhamento no WhatsApp
   ========================================================================== */
function copyStandingsForWhatsApp() {
  const standings = calculateStandings();
  const playedMatches = matches.filter(m => m.homeScore !== null && m.awayScore !== null).length;

  let text = `🏆 *TABELA DO CAMPEONATO eFOOTBALL* ⚽\n`;
  text += `📅 Progresso: ${playedMatches}/12 jogos realizados\n\n`;

  const medals = ['🥇', '🥈', '🥉', '🎮'];

  standings.forEach((p, idx) => {
    const medal = medals[idx] || `${idx + 1}º`;
    const sgFormatted = p.sg > 0 ? `+${p.sg}` : `${p.sg}`;
    text += `${medal} *${p.name}* — ${p.pts} pts\n`;
    text += `   ${p.j}J | ${p.v}V ${p.e}E ${p.d}D | GP: ${p.gp} | GC: ${p.gc} | SG: ${sgFormatted}\n`;
  });

  const leader = standings[0];
  text += `\n👑 *Líder atual:* ${leader.name} (${leader.pts} pts)\n`;
  text += `⚡ Atualizado em tempo real na Tabela eFootball.`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Classificação copiada para a área de transferência! Só colar no WhatsApp.', 'success');
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('Classificação copiada com sucesso!', 'success');
  } catch (err) {
    showToast('Não foi possível copiar automaticamente.', 'warning');
  }
  document.body.removeChild(textArea);
}

/* ==========================================================================
   Pop-ups Dedicados (Seguindo a regra: NUNCA USAR alert() ou confirm())
   ========================================================================== */

/**
 * Modal customizado dedicado para confirmação
 */
function openConfirmModal({ title, message, icon = '⚠️', confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm }) {
  const modal = document.getElementById('customModal');
  const titleElem = document.getElementById('modalTitle');
  const msgElem = document.getElementById('modalMessage');
  const iconElem = document.getElementById('modalIcon');
  const btnConfirm = document.getElementById('modalBtnConfirm');
  const btnCancel = document.getElementById('modalBtnCancel');

  if (!modal) return;

  titleElem.textContent = title;
  msgElem.textContent = message;
  iconElem.textContent = icon;
  btnConfirm.textContent = confirmText;
  btnCancel.textContent = cancelText;

  modal.classList.remove('hidden');

  // Remove listeners anteriores clonando os nós
  const newBtnConfirm = btnConfirm.cloneNode(true);
  const newBtnCancel = btnCancel.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

  function closeModal() {
    modal.classList.add('hidden');
  }

  newBtnCancel.addEventListener('click', closeModal);

  newBtnConfirm.addEventListener('click', () => {
    closeModal();
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  });

  // Fechar ao clicar fora do box
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };
}

/**
 * Notificação Flutuante / Toast Dedicado
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    danger: '❌'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '🔔'}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Animação de entrada
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Remoção automática
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

/* ==========================================================================
   Configuração de Eventos
   ========================================================================== */
function setupEventListeners() {
  // Botão de Zerar Torneio (Abre Pop-up dedicado de confirmação, SEM confirm())
  const btnReset = document.getElementById('btnResetTournament');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      openConfirmModal({
        title: 'Zerar todo o Campeonato?',
        message: 'Todos os 12 placares preenchidos e a classificação serão redefinidos para o início. Esta ação não pode ser desfeita.',
        icon: '⚠️',
        confirmText: 'Sim, zerar tudo',
        cancelText: 'Cancelar',
        onConfirm: () => {
          matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES));
          saveMatches();
          hasCelebrated = false;
          renderApp();
          showToast('Campeonato zerado com sucesso! Pronto para nova disputa.', 'success');
        }
      });
    });
  }

  // Botão de Copiar para WhatsApp
  const btnShare = document.getElementById('btnShareWhatsApp');
  if (btnShare) {
    btnShare.addEventListener('click', copyStandingsForWhatsApp);
  }

  // Botão de Soltar Confetes no Banner
  const btnCelebration = document.getElementById('btnCelebration');
  if (btnCelebration) {
    btnCelebration.addEventListener('click', () => {
      triggerConfetti();
      showToast('🎉 Parabéns ao campeão!', 'success');
    });
  }

  // Abas de Filtro de Rodadas
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      const clicked = e.currentTarget;
      clicked.classList.add('active');
      currentFilter = clicked.dataset.filter;
      renderMatches();
    });
  });
}

// Inicia o app quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
