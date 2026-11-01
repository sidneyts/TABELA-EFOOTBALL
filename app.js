/**
 * eFootball League Manager
 * Campeonato de Pontos Corridos | Turno e Returno (Ida e Volta)
 * Sistema Dinâmico de Inscrição e Ajuste Automático de Rodadas
 */

// Chaves de armazenamento local
const STORAGE_PLAYERS_KEY = 'efootball_league_players_v2';
const STORAGE_MATCHES_KEY = 'efootball_league_matches_v2';

// Lista de jogadores padrão inicial
const INITIAL_PLAYERS = ['Sidney', 'Miguel', 'Gabriel', 'Pedro'];

// Jogos reais das rodadas 1 e 2 (caso os jogadores sejam exatamente os 4 originais)
const DEFAULT_MATCHES_4 = [
  // TURNO (Ida)
  { id: 1, round: 1, phase: 'turno', home: 'Miguel', away: 'Pedro', homeScore: 1, awayScore: 2 },
  { id: 2, round: 1, phase: 'turno', home: 'Gabriel', away: 'Sidney', homeScore: 0, awayScore: 4 },

  { id: 3, round: 2, phase: 'turno', home: 'Gabriel', away: 'Pedro', homeScore: 0, awayScore: 0 },
  { id: 4, round: 2, phase: 'turno', home: 'Miguel', away: 'Sidney', homeScore: 2, awayScore: 2 },

  { id: 5, round: 3, phase: 'turno', home: 'Sidney', away: 'Pedro', homeScore: null, awayScore: null },
  { id: 6, round: 3, phase: 'turno', home: 'Miguel', away: 'Gabriel', homeScore: null, awayScore: null },

  // RETURNO (Volta - Mandos Invertidos)
  { id: 7, round: 4, phase: 'returno', home: 'Pedro', away: 'Miguel', homeScore: null, awayScore: null },
  { id: 8, round: 4, phase: 'returno', home: 'Sidney', away: 'Gabriel', homeScore: null, awayScore: null },

  { id: 9, round: 5, phase: 'returno', home: 'Pedro', away: 'Gabriel', homeScore: null, awayScore: null },
  { id: 10, round: 5, phase: 'returno', home: 'Sidney', away: 'Miguel', homeScore: null, awayScore: null },

  { id: 11, round: 6, phase: 'returno', home: 'Pedro', away: 'Sidney', homeScore: null, awayScore: null },
  { id: 12, round: 6, phase: 'returno', home: 'Gabriel', away: 'Miguel', homeScore: null, awayScore: null }
];

// Estado global da aplicação
let players = [];
let matches = [];
let currentFilter = 'all'; // 'all', 'turno', 'returno'
let activeTab = 'tournament'; // 'tournament', 'players'
let hasCelebrated = false;

/* ==========================================================================
   Inicialização e Carregamento de Dados
   ========================================================================== */
function init() {
  loadData();
  setupEventListeners();
  renderApp();
}

function loadData() {
  // Carrega jogadores
  const storedPlayers = localStorage.getItem(STORAGE_PLAYERS_KEY);
  if (storedPlayers) {
    try {
      const parsed = JSON.parse(storedPlayers);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        players = parsed;
      } else {
        players = [...INITIAL_PLAYERS];
      }
    } catch (e) {
      players = [...INITIAL_PLAYERS];
    }
  } else {
    players = [...INITIAL_PLAYERS];
  }

  // Carrega partidas
  const storedMatches = localStorage.getItem(STORAGE_MATCHES_KEY);
  if (storedMatches) {
    try {
      const parsedMatches = JSON.parse(storedMatches);
      if (Array.isArray(parsedMatches) && parsedMatches.length > 0) {
        matches = parsedMatches;
      } else {
        initDefaultSchedule();
      }
    } catch (e) {
      initDefaultSchedule();
    }
  } else {
    initDefaultSchedule();
  }

  saveData();
}

function initDefaultSchedule() {
  if (isExactOriginalFour(players)) {
    matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES_4));
  } else {
    matches = generateRoundRobinSchedule(players);
  }
}

function isExactOriginalFour(list) {
  if (list.length !== 4) return false;
  return INITIAL_PLAYERS.every(p => list.includes(p));
}

function saveData() {
  localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(players));
  localStorage.setItem(STORAGE_MATCHES_KEY, JSON.stringify(matches));
}

/* ==========================================================================
   Algoritmo Canônico Round-Robin (Todos Contra Todos Ida e Volta)
   ========================================================================== */
function generateRoundRobinSchedule(playerList) {
  const n = playerList.length;
  if (n < 2) return [];

  // Se a quantidade de jogadores for ímpar, adiciona dummy 'BYE' (Folga)
  const isOdd = n % 2 !== 0;
  const list = isOdd ? [...playerList, '__BYE__'] : [...playerList];
  const totalTeams = list.length;
  const roundsInHalf = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;

  const firstLegRounds = [];
  let currentTeams = [...list];

  // Gera o Turno (Ida) usando o método circular
  for (let round = 0; round < roundsInHalf; round++) {
    const roundMatches = [];

    for (let i = 0; i < matchesPerRound; i++) {
      const teamA = currentTeams[i];
      const teamB = currentTeams[totalTeams - 1 - i];

      // Pula a folga se houver
      if (teamA === '__BYE__' || teamB === '__BYE__') {
        continue;
      }

      // Alterna o mando do primeiro par para equilibrar jogos dentro e fora
      if (i === 0 && round % 2 === 1) {
        roundMatches.push({ home: teamB, away: teamA });
      } else {
        roundMatches.push({ home: teamA, away: teamB });
      }
    }

    firstLegRounds.push(roundMatches);

    // Gira todos os elementos exceto o primeiro (índice 0 fixo)
    const fixed = currentTeams[0];
    const rest = currentTeams.slice(1);
    const last = rest.pop();
    rest.unshift(last);
    currentTeams = [fixed, ...rest];
  }

  // Monta a lista completa com Turno e Returno
  const allMatches = [];
  let matchId = 1;

  // Turno de Ida
  firstLegRounds.forEach((roundMatches, rIdx) => {
    const roundNum = rIdx + 1;
    roundMatches.forEach(m => {
      allMatches.push({
        id: matchId++,
        round: roundNum,
        phase: 'turno',
        home: m.home,
        away: m.away,
        homeScore: null,
        awayScore: null
      });
    });
  });

  // Returno de Volta (Inverte mandos de campo)
  firstLegRounds.forEach((roundMatches, rIdx) => {
    const roundNum = roundsInHalf + rIdx + 1;
    roundMatches.forEach(m => {
      allMatches.push({
        id: matchId++,
        round: roundNum,
        phase: 'returno',
        home: m.away, // Invertido
        away: m.home, // Invertido
        homeScore: null,
        awayScore: null
      });
    });
  });

  return allMatches;
}

/* ==========================================================================
   Cálculo da Tabela de Classificação
   ========================================================================== */
function calculateStandings() {
  const stats = {};
  players.forEach(player => {
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
      form: []
    };
  });

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
      home.pts += 3;
      home.v += 1;
      away.d += 1;
      home.form.push('V');
      away.form.push('D');
    } else if (hs < as) {
      away.pts += 3;
      away.v += 1;
      home.d += 1;
      away.form.push('V');
      home.form.push('D');
    } else {
      home.pts += 1;
      away.pts += 1;
      home.e += 1;
      away.e += 1;
      home.form.push('E');
      away.form.push('E');
    }
  });

  Object.values(stats).forEach(p => {
    p.sg = p.gp - p.gc;
    const maxPossiblePts = p.j * 3;
    p.pct = maxPossiblePts > 0 ? ((p.pts / maxPossiblePts) * 100).toFixed(1) : '0.0';
  });

  const standingsList = Object.values(stats);

  standingsList.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.v !== a.v) return b.v - a.v;
    if (b.sg !== a.sg) return b.sg - a.sg;
    if (b.gp !== a.gp) return b.gp - a.gp;
    if (a.gc !== b.gc) return a.gc - b.gc;

    const headToHead = calculateHeadToHead(a.name, b.name);
    if (headToHead !== 0) return headToHead;

    return a.name.localeCompare(b.name);
  });

  return standingsList;
}

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
  if (sgA !== 0) return -sgA;
  return 0;
}

/* ==========================================================================
   Renderização Geral da Aplicação
   ========================================================================== */
function renderApp() {
  updateHeaderInfo();
  const standings = calculateStandings();
  renderStandingsTable(standings);
  renderStats(standings);
  renderMatches();
  renderPlayersManager();
  checkChampionStatus(standings);
}

function updateHeaderInfo() {
  const subtitle = document.getElementById('headerSubtitle');
  const countBadge = document.getElementById('playersCountBadge');
  const roundsTotal = calculateTotalRounds();

  if (subtitle) {
    subtitle.textContent = `${players.length} Jogadores • ${roundsTotal} Rodadas (Turno e Returno) • Vitória = 3 pts | Empate = 1 pt`;
  }
  if (countBadge) {
    countBadge.textContent = players.length;
  }
}

function calculateTotalRounds() {
  if (matches.length === 0) return 0;
  return Math.max(...matches.map(m => m.round), 0);
}

function renderStandingsTable(standings) {
  const tbody = document.getElementById('standingsBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  standings.forEach((player, index) => {
    const pos = index + 1;
    const tr = document.createElement('tr');
    const posBadgeClass = pos <= 3 ? `pos-${pos}` : '';

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
  const playedMatches = matches.filter(m => m.homeScore !== null && m.awayScore !== null);
  const totalPlayed = playedMatches.length;
  const totalMatches = matches.length;

  const progressText = document.getElementById('tournamentProgressText');
  const progressBar = document.getElementById('tournamentProgressBar');
  if (progressText && progressBar) {
    progressText.textContent = `${totalPlayed} / ${totalMatches} Jogos`;
    const pct = totalMatches > 0 ? Math.round((totalPlayed / totalMatches) * 100) : 0;
    progressBar.style.width = `${pct}%`;
  }

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

  const totalRounds = calculateTotalRounds();
  const rounds = [];
  for (let r = 1; r <= totalRounds; r++) rounds.push(r);

  const halfRounds = Math.floor(totalRounds / 2);

  // Atualiza texto dos botões de filtro de rodadas
  const roundTabs = document.getElementById('roundTabs');
  if (roundTabs) {
    const allBtn = roundTabs.querySelector('[data-filter="all"]');
    if (allBtn) allBtn.textContent = `Todas (${totalRounds})`;
  }

  rounds.forEach(roundNum => {
    const roundMatches = matches.filter(m => m.round === roundNum);
    if (roundMatches.length === 0) return;

    const phase = roundNum <= halfRounds ? 'turno' : 'returno';

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

  saveData();
  updateMatchCardVisual(matchId);
  refreshLeaderboard();
}

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

  const homeInput = card.querySelector(`.score-input[data-team="home"]`);
  const awayInput = card.querySelector(`.score-input[data-team="away"]`);
  if (homeInput && document.activeElement !== homeInput) {
    homeInput.value = match.homeScore !== null ? match.homeScore : '';
  }
  if (awayInput && document.activeElement !== awayInput) {
    awayInput.value = match.awayScore !== null ? match.awayScore : '';
  }
}

function refreshLeaderboard() {
  const standings = calculateStandings();
  renderStandingsTable(standings);
  renderStats(standings);
  checkChampionStatus(standings);
}

window.adjustScore = function(matchId, team, delta) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

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

  saveData();
  updateMatchCardVisual(matchId);
  refreshLeaderboard();
};

window.clearMatchScore = function(matchId) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  match.homeScore = null;
  match.awayScore = null;

  saveData();
  updateMatchCardVisual(matchId);
  refreshLeaderboard();
  showToast(`Placar do jogo ${match.home} x ${match.away} foi zerado.`, 'info');
};

/* ==========================================================================
   Gerenciamento e Inscrição de Jogadores (Aba Dinâmica)
   ========================================================================== */
function renderPlayersManager() {
  const grid = document.getElementById('playersListGrid');
  const summaryCount = document.getElementById('summaryPlayersCount');
  const summaryRounds = document.getElementById('summaryRoundsCount');
  const summaryMatches = document.getElementById('summaryMatchesCount');

  const totalRounds = calculateTotalRounds();

  if (summaryCount) summaryCount.textContent = players.length;
  if (summaryRounds) summaryRounds.textContent = totalRounds;
  if (summaryMatches) summaryMatches.textContent = matches.length;

  if (!grid) return;

  grid.innerHTML = '';

  players.forEach((playerName, index) => {
    const card = document.createElement('div');
    card.className = 'player-item-card';

    const initial = playerName.charAt(0).toUpperCase();

    // Contagem de jogos agendados para este jogador
    const playerMatchesCount = matches.filter(m => m.home === playerName || m.away === playerName).length;

    card.innerHTML = `
      <div class="player-card-left">
        <div class="player-card-avatar">${initial}</div>
        <div class="player-card-info">
          <span class="player-card-name" title="${playerName}">${playerName}</span>
          <span class="player-card-sub">${playerMatchesCount} partidas agendadas</span>
        </div>
      </div>
      <button 
        type="button" 
        class="btn-remove-player" 
        onclick="confirmRemovePlayer('${playerName}')" 
        title="Remover ${playerName} do torneio"
      >
        🗑️
      </button>
    `;

    grid.appendChild(card);
  });
}

/**
 * Adiciona um novo jogador ao campeonato
 */
function handleAddPlayer() {
  const input = document.getElementById('inputPlayerName');
  if (!input) return;

  const rawName = input.value.trim();

  // Validação 1: Nome vazio
  if (!rawName) {
    showToast('Por favor, digite o nome do jogador para inscrever.', 'warning');
    input.focus();
    return;
  }

  // Validação 2: Limite de caracteres
  if (rawName.length > 20) {
    showToast('O nome do jogador deve ter no máximo 20 caracteres.', 'warning');
    return;
  }

  // Validação 3: Nome duplicado (case-insensitive)
  const isDuplicate = players.some(p => p.toLowerCase() === rawName.toLowerCase());
  if (isDuplicate) {
    showToast(`O jogador "${rawName}" já está inscrito no campeonato!`, 'warning');
    input.focus();
    return;
  }

  // Validação 4: Máximo de jogadores
  if (players.length >= 16) {
    showToast('Limite máximo de 16 participantes atingido!', 'warning');
    return;
  }

  // Se já houver jogos disputados no torneio, solicita confirmação via Pop-up dedicado
  const playedCount = matches.filter(m => m.homeScore !== null && m.awayScore !== null).length;

  if (playedCount > 0) {
    openConfirmModal({
      title: 'Ajustar Campeonato com Novo Jogador?',
      message: `O campeonato já tem ${playedCount} partidas com resultado registrado. Adicionar "${rawName}" irá gerar uma nova grade equilibrada de rodadas (ida e volta) e zerar a tabela. Deseja continuar?`,
      icon: '➕',
      confirmText: 'Sim, adicionar e ajustar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        executeAddPlayer(rawName);
        input.value = '';
      }
    });
  } else {
    executeAddPlayer(rawName);
    input.value = '';
  }
}

function executeAddPlayer(playerName) {
  players.push(playerName);
  matches = generateRoundRobinSchedule(players);
  saveData();
  hasCelebrated = false;
  renderApp();
  showToast(`Jogador "${playerName}" inscrito! Grade de jogos recalculada automaticamente.`, 'success');
}

/**
 * Confirmação de remoção de jogador (Modal Dedicado, SEM confirm())
 */
window.confirmRemovePlayer = function(playerName) {
  // Mínimo de 3 jogadores
  if (players.length <= 3) {
    showToast('O campeonato precisa de no mínimo 3 jogadores inscritos.', 'warning');
    return;
  }

  openConfirmModal({
    title: `Remover ${playerName}?`,
    message: `Tem certeza de que deseja remover "${playerName}" do campeonato? A grade de confrontos e a tabela serão recalculadas automaticamente.`,
    icon: '⚠️',
    confirmText: 'Sim, remover',
    cancelText: 'Cancelar',
    onConfirm: () => {
      players = players.filter(p => p !== playerName);

      // Se voltar a ser exatamente os 4 originais, usa o calendário oficial
      if (isExactOriginalFour(players)) {
        matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES_4));
      } else {
        matches = generateRoundRobinSchedule(players);
      }

      saveData();
      hasCelebrated = false;
      renderApp();
      showToast(`Jogador "${playerName}" removido. Campeonato reajustado!`, 'info');
    }
  });
};

/* ==========================================================================
   Verificação de Campeão & Celebração
   ========================================================================== */
function checkChampionStatus(standings) {
  const banner = document.getElementById('championBanner');
  const championNameElem = document.getElementById('championName');
  const championDetailsElem = document.getElementById('championDetails');

  if (!banner || !championNameElem || !championDetailsElem) return;

  const totalPlayed = matches.filter(m => m.homeScore !== null && m.awayScore !== null).length;
  const isFinished = matches.length > 0 && totalPlayed === matches.length;

  if (standings.length < 2) {
    banner.classList.add('hidden');
    return;
  }

  const leader = standings[0];
  const runnerUp = standings[1];

  let isChampionConfirmed = false;
  let reason = '';

  const totalRounds = calculateTotalRounds();

  if (isFinished) {
    isChampionConfirmed = true;
    reason = `Campeão incontestável! Todas as ${totalRounds} rodadas foram concluídas com ${leader.pts} pontos.`;
  } else if (leader.j > 0) {
    const totalMatchesPerPlayer = (players.length - 1) * 2;
    const matchesRemainingRunnerUp = Math.max(0, totalMatchesPerPlayer - runnerUp.j);
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
  const totalRounds = calculateTotalRounds();

  let text = `🏆 *TABELA DO CAMPEONATO eFOOTBALL* ⚽\n`;
  text += `👥 ${players.length} Jogadores • ${totalRounds} Rodadas (Ida e Volta)\n`;
  text += `📅 Progresso: ${playedMatches}/${matches.length} jogos realizados\n\n`;

  const medals = ['🥇', '🥈', '🥉'];

  standings.forEach((p, idx) => {
    const medal = medals[idx] || `${idx + 1}º`;
    const sgFormatted = p.sg > 0 ? `+${p.sg}` : `${p.sg}`;
    text += `${medal} *${p.name}* — ${p.pts} pts\n`;
    text += `   ${p.j}J | ${p.v}V ${p.e}E ${p.d}D | GP: ${p.gp} | GC: ${p.gc} | SG: ${sgFormatted}\n`;
  });

  if (standings.length > 0) {
    const leader = standings[0];
    text += `\n👑 *Líder atual:* ${leader.name} (${leader.pts} pts)\n`;
  }
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

  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };
}

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

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

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
  // Navegação entre abas principais
  const tabTournament = document.getElementById('navTabTournament');
  const tabPlayers = document.getElementById('navTabPlayers');
  const viewTournament = document.getElementById('viewTournament');
  const viewPlayers = document.getElementById('viewPlayers');

  if (tabTournament && tabPlayers && viewTournament && viewPlayers) {
    tabTournament.addEventListener('click', () => {
      tabTournament.classList.add('active');
      tabPlayers.classList.remove('active');
      viewTournament.classList.remove('hidden');
      viewPlayers.classList.add('hidden');
      activeTab = 'tournament';
    });

    tabPlayers.addEventListener('click', () => {
      tabPlayers.classList.add('active');
      tabTournament.classList.remove('active');
      viewPlayers.classList.remove('hidden');
      viewTournament.classList.add('hidden');
      activeTab = 'players';
    });
  }

  // Formulário de Adicionar Jogador
  const btnAdd = document.getElementById('btnAddPlayer');
  const inputPlayer = document.getElementById('inputPlayerName');

  if (btnAdd) {
    btnAdd.addEventListener('click', handleAddPlayer);
  }

  if (inputPlayer) {
    inputPlayer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddPlayer();
      }
    });
  }

  // Botão de Zerar Torneio
  const btnReset = document.getElementById('btnResetTournament');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      openConfirmModal({
        title: 'Zerar todo o Campeonato?',
        message: 'Todos os placares preenchidos e a classificação serão redefinidos para o início. Deseja continuar?',
        icon: '⚠️',
        confirmText: 'Sim, zerar tudo',
        cancelText: 'Cancelar',
        onConfirm: () => {
          if (isExactOriginalFour(players)) {
            matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES_4));
          } else {
            matches = generateRoundRobinSchedule(players);
          }
          saveData();
          hasCelebrated = false;
          renderApp();
          showToast('Campeonato zerado com sucesso!', 'success');
        }
      });
    });
  }

  // Botão de Copiar para WhatsApp
  const btnShare = document.getElementById('btnShareWhatsApp');
  if (btnShare) {
    btnShare.addEventListener('click', copyStandingsForWhatsApp);
  }

  // Botão de Soltar Confetes
  const btnCelebration = document.getElementById('btnCelebration');
  if (btnCelebration) {
    btnCelebration.addEventListener('click', () => {
      triggerConfetti();
      showToast('🎉 Parabéns ao campeão!', 'success');
    });
  }

  // Filtro de Rodadas (Todas / Turno / Returno)
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

document.addEventListener('DOMContentLoaded', init);
