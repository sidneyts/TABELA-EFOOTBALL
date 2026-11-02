/**
 * eFootball League Manager
 * Campeonato de Pontos Corridos | Turno e Returno (Ida e Volta)
 * Sincronização em Tempo Real na Nuvem com Google Firebase Firestore
 */

// Configuração Oficial do Firebase (Projeto banco-futebol)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDVwG8asau-f1ZHgIotOTC91d5Gt4l_B3U",
  authDomain: "banco-futebol.firebaseapp.com",
  projectId: "banco-futebol",
  storageBucket: "banco-futebol.firebasestorage.app",
  messagingSenderId: "346507976544",
  appId: "1:346507976544:web:33d450493cf503f7b24805"
};

// Chaves de armazenamento local (Cache e fallback offline)
const STORAGE_PLAYERS_KEY = 'efootball_league_players_v2';
const STORAGE_MATCHES_KEY = 'efootball_league_matches_v2';
const STORAGE_USER_KEY = 'efootball_current_user_v1';
const STORAGE_HISTORY_KEY = 'efootball_league_history_v1';
const STORAGE_KNOCKOUT_KEY = 'efootball_knockout_v1';
const STORAGE_PHOTOS_KEY = 'efootball_player_photos_v1';
const STORAGE_ACTIVE_TAB_KEY = 'efootball_active_tab_v1';
const STORAGE_LIKES_KEY = 'efootball_likes_count_v1';

// Lista de jogadores inicial
const INITIAL_PLAYERS = ['Sidney', 'Miguel', 'Gabriel', 'Pedro'];

// Jogos padrão (todas as partidas zeradas prontas para novo campeonato)
const DEFAULT_MATCHES_4 = [
  // TURNO (Ida)
  { id: 1, round: 1, phase: 'turno', home: 'Miguel', away: 'Pedro', homeScore: null, awayScore: null },
  { id: 2, round: 1, phase: 'turno', home: 'Gabriel', away: 'Sidney', homeScore: null, awayScore: null },

  { id: 3, round: 2, phase: 'turno', home: 'Gabriel', away: 'Pedro', homeScore: null, awayScore: null },
  { id: 4, round: 2, phase: 'turno', home: 'Miguel', away: 'Sidney', homeScore: null, awayScore: null },

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
let tournamentHistory = [];
let playerPhotos = {}; // { [playerName]: base64DataUrl }
let pendingNewPlayerPhoto = null;
let photoUploadTargetPlayer = null;
let knockoutState = { format: 'two_legs', displayMode: 'photo_name', ties: [] };
let currentUser = '';
let lastUpdatedBy = '';
let currentFilter = 'all'; // 'all', 'turno', 'returno'
let activeTab = 'tournament'; // 'tournament', 'knockout', 'history', 'players'
let lastCompetitionTab = 'tournament'; // 'tournament' ou 'knockout'
let hasCelebrated = false;
let hasCelebratedKnockout = false;
let pendingSaveMode = 'league'; // 'league' ou 'knockout'
let preRemovalMatchesBackup = null;
let preRemovalPlayersBackup = null;

// Contador de Curtidas com Limite de 1 clique/segundo
let totalLikes = 0;
let lastLikeTimestamp = 0;
const LIKE_COOLDOWN_MS = 1000;
let likeCooldownTimer = null;

// Instâncias do Firebase
let db = null;
let tournamentDocRef = null;
let isCloudConnected = false;
let cloudSyncTimeout = null;

/* ==========================================================================
   Inicialização e Carregamento de Dados
   ========================================================================== */
function init() {
  loadLocalBackup();
  setupEventListeners();
  switchMainTab(activeTab || 'tournament');
  renderApp();
  initFirebaseRealtime();

  // Se o usuário ainda não escolheu seu nome neste navegador, abre o pop-up dedicado de identificação
  if (!currentUser && typeof document !== 'undefined' && document.getElementById) {
    setTimeout(() => {
      openUserProfileModal();
    }, 400);
  }
}

function loadData() {
  loadLocalBackup();
}

function loadLocalBackup() {
  const storedUser = localStorage.getItem(STORAGE_USER_KEY);
  if (storedUser) {
    currentUser = storedUser.trim();
  }
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

  const storedHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
  if (storedHistory) {
    try {
      const parsedHistory = JSON.parse(storedHistory);
      if (Array.isArray(parsedHistory)) {
        tournamentHistory = parsedHistory;
      }
    } catch (e) {
      tournamentHistory = [];
    }
  }

  const storedKnockout = localStorage.getItem(STORAGE_KNOCKOUT_KEY);
  if (storedKnockout) {
    try {
      const parsedKO = JSON.parse(storedKnockout);
      if (parsedKO && Array.isArray(parsedKO.ties)) {
        knockoutState = normalizeKnockoutState(parsedKO);
      }
    } catch (e) {
      knockoutState = { format: 'two_legs', displayMode: 'photo_name', ties: [] };
    }
  }

  const storedPhotos = localStorage.getItem(STORAGE_PHOTOS_KEY);
  if (storedPhotos) {
    try {
      const parsedPhotos = JSON.parse(storedPhotos);
      if (parsedPhotos && typeof parsedPhotos === 'object') {
        playerPhotos = parsedPhotos;
      }
    } catch (e) {
      playerPhotos = {};
    }
  }

  const storedTab = localStorage.getItem(STORAGE_ACTIVE_TAB_KEY);
  if (storedTab && ['tournament', 'knockout', 'history', 'players'].includes(storedTab)) {
    activeTab = storedTab;
    if (storedTab === 'tournament' || storedTab === 'knockout') {
      lastCompetitionTab = storedTab;
    }
  }

  const storedLikes = localStorage.getItem(STORAGE_LIKES_KEY);
  if (storedLikes) {
    const parsedLikes = parseInt(storedLikes, 10);
    if (!isNaN(parsedLikes)) {
      totalLikes = parsedLikes;
    }
  }
}

function normalizeKnockoutState(ko) {
  if (!ko || !Array.isArray(ko.ties)) {
    return { format: 'two_legs', displayMode: 'photo_name', ties: [] };
  }
  let fmt = ko.format || 'two_legs';
  // Se o sorteio anterior foi salvo antes de existir o campo penHome, garante suporte a 2 jogos + pênaltis
  if (ko.ties.length > 0 && !('penHome' in ko.ties[0])) {
    fmt = 'two_legs';
  }
  const disp = ko.displayMode || 'photo_name';
  const normalizedTies = ko.ties.map(t => ({
    ...t,
    leg1Home: t.leg1Home !== undefined ? t.leg1Home : null,
    leg1Away: t.leg1Away !== undefined ? t.leg1Away : null,
    leg2Home: t.leg2Home !== undefined ? t.leg2Home : null,
    leg2Away: t.leg2Away !== undefined ? t.leg2Away : null,
    penHome: t.penHome !== undefined ? t.penHome : null,
    penAway: t.penAway !== undefined ? t.penAway : null,
    showPenalties: Boolean(t.showPenalties)
  }));
  return {
    format: fmt,
    displayMode: disp,
    ties: normalizedTies
  };
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

function saveLocalBackup() {
  localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(players));
  localStorage.setItem(STORAGE_MATCHES_KEY, JSON.stringify(matches));
  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(tournamentHistory));
  localStorage.setItem(STORAGE_KNOCKOUT_KEY, JSON.stringify(knockoutState));
  localStorage.setItem(STORAGE_PHOTOS_KEY, JSON.stringify(playerPhotos));
  localStorage.setItem(STORAGE_LIKES_KEY, totalLikes.toString());
}

/* ==========================================================================
   Sincronização em Tempo Real na Nuvem (Firebase Firestore)
   ========================================================================== */
function initFirebaseRealtime() {
  updateSyncStatus('syncing', 'Conectando à nuvem...');

  if (typeof firebase === 'undefined' || !firebase.initializeApp) {
    console.warn('Firebase SDK não carregado. Operando em modo offline.');
    updateSyncStatus('offline', 'Modo Offline (Local)');
    return;
  }

  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    tournamentDocRef = db.collection('efootball').doc('torneio_principal');

    // Escuta em tempo real (onSnapshot dispara instantaneamente para todos os dispositivos)
    tournamentDocRef.onSnapshot((doc) => {
      isCloudConnected = true;

      if (doc.exists) {
        const cloudData = doc.data();

        let shouldReRender = false;

        if (Array.isArray(cloudData.players) && cloudData.players.length >= 2) {
          if (JSON.stringify(cloudData.players) !== JSON.stringify(players)) {
            players = cloudData.players;
            shouldReRender = true;
          }
        }

        if (Array.isArray(cloudData.matches)) {
          if (JSON.stringify(cloudData.matches) !== JSON.stringify(matches)) {
            matches = cloudData.matches;
            shouldReRender = true;
          }
        }

        if (Array.isArray(cloudData.history)) {
          if (JSON.stringify(cloudData.history) !== JSON.stringify(tournamentHistory)) {
            tournamentHistory = cloudData.history;
            shouldReRender = true;
          }
        }

        if (cloudData.knockout && Array.isArray(cloudData.knockout.ties)) {
          const normalizedCloudKO = normalizeKnockoutState(cloudData.knockout);
          if (JSON.stringify(normalizedCloudKO) !== JSON.stringify(knockoutState)) {
            knockoutState = normalizedCloudKO;
            shouldReRender = true;
          }
        }

        if (cloudData.playerPhotos && typeof cloudData.playerPhotos === 'object') {
          if (JSON.stringify(cloudData.playerPhotos) !== JSON.stringify(playerPhotos)) {
            playerPhotos = cloudData.playerPhotos;
            shouldReRender = true;
          }
        }

        if (typeof cloudData.likes === 'number') {
          totalLikes = cloudData.likes;
          updateLikeDisplay();
        }

        if (cloudData.lastUpdatedBy) {
          lastUpdatedBy = cloudData.lastUpdatedBy;
        }

        saveLocalBackup();

        if (shouldReRender) {
          const activeInput = document.activeElement;
          const isTyping = activeInput && activeInput.classList && (
            activeInput.classList.contains('score-input') ||
            activeInput.classList.contains('ko-score-input')
          );

          if (!isTyping) {
            renderApp();
          } else {
            refreshLeaderboard();
          }
        }

        const statusMsg = lastUpdatedBy
          ? `Ao vivo • Atualizado por ${lastUpdatedBy}`
          : 'Ao vivo • Tempo Real';
        updateSyncStatus('online', statusMsg);
      } else {
        syncToCloud(true);
        updateSyncStatus('online', 'Ao vivo • Tempo Real');
      }
    }, (error) => {
      console.error('Erro no listener realtime:', error);
      isCloudConnected = false;
      updateSyncStatus('offline', 'Offline (Reconectando...)');
    });

  } catch (err) {
    console.error('Erro ao conectar ao Firebase:', err);
    updateSyncStatus('offline', 'Offline (Salvo local)');
  }
}

/**
 * Envia alterações para a nuvem em tempo real (com debounce suave para digitação)
 */
function syncToCloud(immediate = false) {
  saveLocalBackup();

  if (!tournamentDocRef || !isCloudConnected) return;

  if (cloudSyncTimeout) {
    clearTimeout(cloudSyncTimeout);
  }

  const sendData = () => {
    updateSyncStatus('syncing', 'Sincronizando...');
    const payload = {
      players: players,
      matches: matches,
      history: tournamentHistory,
      knockout: knockoutState,
      playerPhotos: playerPhotos,
      likes: totalLikes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (currentUser) {
      payload.lastUpdatedBy = currentUser;
      lastUpdatedBy = currentUser;
    }

    tournamentDocRef.set(payload, { merge: true })
    .then(() => {
      const statusMsg = lastUpdatedBy
        ? `Ao vivo • Atualizado por ${lastUpdatedBy}`
        : 'Ao vivo • Tempo Real';
      updateSyncStatus('online', statusMsg);
    })
    .catch((err) => {
      console.error('Erro ao salvar no Firestore:', err);
      updateSyncStatus('offline', 'Falha ao sincronizar');
    });
  };

  if (immediate) {
    sendData();
  } else {
    cloudSyncTimeout = setTimeout(sendData, 300);
  }
}

function updateSyncStatus(status, text) {
  const badge = document.getElementById('cloudSyncBadge');
  const dot = badge ? badge.querySelector('.sync-dot') : null;
  const label = document.getElementById('cloudSyncText');

  if (badge && dot && label) {
    badge.className = `cloud-sync-badge ${status}`;
    dot.className = `sync-dot ${status}`;
    label.textContent = text;
  }
}

/* ==========================================================================
   Algoritmo Canônico Round-Robin (Ida e Volta)
   ========================================================================== */
function generateRoundRobinSchedule(playerList) {
  const n = playerList.length;
  if (n < 2) return [];

  const isOdd = n % 2 !== 0;
  const list = isOdd ? [...playerList, '__BYE__'] : [...playerList];
  const totalTeams = list.length;
  const roundsInHalf = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;

  const firstLegRounds = [];
  let currentTeams = [...list];

  for (let round = 0; round < roundsInHalf; round++) {
    const roundMatches = [];

    for (let i = 0; i < matchesPerRound; i++) {
      const teamA = currentTeams[i];
      const teamB = currentTeams[totalTeams - 1 - i];

      if (teamA === '__BYE__' || teamB === '__BYE__') {
        continue;
      }

      if (i === 0 && round % 2 === 1) {
        roundMatches.push({ home: teamB, away: teamA });
      } else {
        roundMatches.push({ home: teamA, away: teamB });
      }
    }

    firstLegRounds.push(roundMatches);

    const fixed = currentTeams[0];
    const rest = currentTeams.slice(1);
    const last = rest.pop();
    rest.unshift(last);
    currentTeams = [fixed, ...rest];
  }

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

  // Returno de Volta (Mandos Invertidos)
  firstLegRounds.forEach((roundMatches, rIdx) => {
    const roundNum = roundsInHalf + rIdx + 1;
    roundMatches.forEach(m => {
      allMatches.push({
        id: matchId++,
        round: roundNum,
        phase: 'returno',
        home: m.away,
        away: m.home,
        homeScore: null,
        awayScore: null
      });
    });
  });

  return allMatches;
}

/* ==========================================================================
   Sorteio da Ordem das Rodadas e Jogos (Modo Pontos Corridos)
   ========================================================================== */
function handleShuffleLeagueSchedule() {
  if (players.length < 2) {
    showToast('É necessário ter pelo menos 2 jogadores para sortear a ordem dos jogos.', 'warning');
    return;
  }

  const hasPlayedMatches = matches.some(m => m.homeScore !== null && m.awayScore !== null && !isNaN(m.homeScore) && !isNaN(m.awayScore));

  if (hasPlayedMatches) {
    openConfirmModal({
      title: 'Sortear Ordem dos Jogos?',
      message: 'Já existem partidas com placar registrado. Ao sortear uma nova ordem para os jogos, todos os confrontos serão reorganizados e os placares atuais serão reiniciados. Deseja prosseguir com o sorteio?',
      icon: '🎲',
      confirmText: 'Sim, sortear nova ordem',
      cancelText: 'Cancelar',
      onConfirm: () => {
        executeShuffleLeagueSchedule();
      }
    });
  } else {
    executeShuffleLeagueSchedule();
  }
}

function executeShuffleLeagueSchedule() {
  // Embaralha aleatoriamente a lista de jogadores para gerar nova distribuição de confrontos e rodadas
  const shuffledPlayers = shuffleArray(players);
  matches = generateRoundRobinSchedule(shuffledPlayers);
  hasCelebrated = false;

  renderApp();
  syncToCloud(true);
  showToast('🎲 Nova ordem dos confrontos e rodadas sorteada com sucesso!', 'success');
  triggerConfetti();
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
   Renderização dos Componentes
   ========================================================================== */
function renderApp() {
  updateHeaderInfo();
  const standings = calculateStandings();
  renderStandingsTable(standings);
  renderStats(standings);
  renderMatches();
  renderPlayersManager();
  renderKnockoutView();
  renderHistoryView();
  checkChampionStatus(standings);
}

function getPlayerPhotoUrl(playerName) {
  if (!playerName || !playerPhotos) return null;
  if (playerPhotos[playerName]) return playerPhotos[playerName];
  const foundKey = Object.keys(playerPhotos).find(k => k.toLowerCase() === playerName.toLowerCase());
  return foundKey ? playerPhotos[foundKey] : null;
}

function getPlayerAvatarInnerHtml(playerName) {
  if (!playerName || isPlaceholderTeam(playerName) || playerName === 'A definir') {
    return `<span class="avatar-question-mark">?</span>`;
  }
  if (playerName.startsWith('BYE')) {
    return `<span class="avatar-bye-tag">BYE</span>`;
  }
  const photo = getPlayerPhotoUrl(playerName);
  if (photo) {
    return `<img src="${photo}" alt="${playerName}" />`;
  }
  return playerName.charAt(0).toUpperCase();
}

function updateHeaderInfo() {
  const subtitle = document.getElementById('headerSubtitle');
  const countBadge = document.getElementById('playersCountBadge');
  const historyBadge = document.getElementById('historyCountBadge');
  const userNameEl = document.getElementById('headerUserName');
  const userAvatarEl = document.getElementById('headerUserAvatar');
  const roundsTotal = calculateTotalRounds();

  if (subtitle) {
    subtitle.textContent = `${players.length} Jogadores • ${roundsTotal} Rodadas (Turno e Returno) • Vitória = 3 pts | Empate = 1 pt`;
  }
  if (countBadge) {
    countBadge.textContent = players.length;
  }
  if (historyBadge) {
    historyBadge.textContent = tournamentHistory.length;
  }
  if (userNameEl && userAvatarEl) {
    if (currentUser) {
      userNameEl.textContent = currentUser;
      const uPhoto = getPlayerPhotoUrl(currentUser);
      if (uPhoto) {
        userAvatarEl.innerHTML = `<img src="${uPhoto}" alt="${currentUser}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else {
        userAvatarEl.textContent = currentUser.charAt(0).toUpperCase();
      }
    } else {
      userNameEl.textContent = 'Identificar-se';
      userAvatarEl.textContent = '👤';
    }
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
    const isMe = currentUser && player.name.toLowerCase() === currentUser.toLowerCase();
    if (isMe) {
      tr.classList.add('is-current-user-row');
    }
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

    const avatarInner = getPlayerAvatarInnerHtml(player.name);
    const youBadgeHtml = isMe ? '<span class="you-badge">VOCÊ</span>' : '';

    tr.innerHTML = `
      <td class="pos-cell">
        <span class="pos-badge ${posBadgeClass}">${pos}</span>
      </td>
      <td>
        <div class="player-cell" data-player-name="${player.name}" title="Clique com o botão direito para opções do jogador">
          <div class="player-avatar" style="overflow:hidden;">${avatarInner}</div>
          <span class="player-name-text">${player.name}${youBadgeHtml}</span>
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
      const isUserInMatch = currentUser && (
        m.home.toLowerCase() === currentUser.toLowerCase() ||
        m.away.toLowerCase() === currentUser.toLowerCase()
      );
      const userMatchClass = isUserInMatch ? 'is-user-match' : '';

      matchesHtml += `
        <div class="match-item ${statusClass} ${userMatchClass}" data-match-id="${m.id}">
          <div class="match-row">
            <!-- Time Mandante -->
            <div class="team-box team-home ${homeWinnerClass}" data-player-name="${m.home}" title="Clique com o botão direito para opções de ${m.home}">
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
            <div class="team-box team-away ${awayWinnerClass}" data-player-name="${m.away}" title="Clique com o botão direito para opções de ${m.away}">
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

  updateMatchCardVisual(matchId);
  refreshLeaderboard();
  syncToCloud(false); // Sincroniza na nuvem com debounce suave
}

function updateMatchCardVisual(matchId) {
  const match = matches.find(m => m.id === matchId);
  const card = document.querySelector(`.match-item[data-match-id="${matchId}"]`);
  if (!match || !card) return;

  const isPlayed = match.homeScore !== null && match.awayScore !== null;
  const isUserInMatch = currentUser && (
    match.home.toLowerCase() === currentUser.toLowerCase() ||
    match.away.toLowerCase() === currentUser.toLowerCase()
  );
  card.className = `match-item ${isPlayed ? 'played' : ''} ${isUserInMatch ? 'is-user-match' : ''}`;

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

  updateMatchCardVisual(matchId);
  refreshLeaderboard();
  syncToCloud(true); // Sincronização imediata nos cliques
};

window.clearMatchScore = function(matchId) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  match.homeScore = null;
  match.awayScore = null;

  renderApp();
  syncToCloud(true);
  showToast(`Placar do jogo ${match.home} x ${match.away} foi zerado.`, 'info');
};

/* ==========================================================================
   Gerenciamento e Inscrição de Jogadores
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

  players.forEach((playerName) => {
    const card = document.createElement('div');
    card.className = 'player-item-card';

    const avatarInner = getPlayerAvatarInnerHtml(playerName);
    const hasPhoto = Boolean(getPlayerPhotoUrl(playerName));
    const playerMatchesCount = matches.filter(m => m.home === playerName || m.away === playerName).length;

    card.innerHTML = `
      <div class="player-card-left">
        <div class="player-card-avatar" onclick="triggerPlayerPhotoUpload('${playerName}')" title="Clique para anexar ou trocar a foto de ${playerName}">
          ${avatarInner}
        </div>
        <div class="player-card-info">
          <span class="player-card-name" title="${playerName}">${playerName}</span>
          <span class="player-card-sub">${playerMatchesCount} jogos • ${hasPhoto ? '📸 Foto anexada' : 'Sem foto'}</span>
        </div>
      </div>
      <div class="player-card-actions">
        <button
          type="button"
          class="btn-photo-player"
          onclick="triggerPlayerPhotoUpload('${playerName}')"
          title="Anexar ou trocar foto de ${playerName}"
        >
          📷 ${hasPhoto ? 'Trocar' : 'Foto'}
        </button>
        <button 
          type="button" 
          class="btn-remove-player" 
          onclick="confirmRemovePlayer('${playerName}')" 
          title="Excluir oficialmente ${playerName} do sistema"
        >
          🗑️
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

window.triggerPlayerPhotoUpload = function(playerName) {
  if (!playerName || isPlaceholderTeam(playerName) || playerName.startsWith('BYE')) return;
  photoUploadTargetPlayer = playerName;
  const fileInput = document.getElementById('hiddenPhotoFileInput');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
};

function handlePhotoFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Selecione um arquivo de imagem válido (JPG, PNG, WEBP).', 'warning');
    return;
  }

  compressImageToDataURL(file, 160, 0.82, (dataUrl) => {
    if (!dataUrl) {
      showToast('Não foi possível processar a imagem.', 'danger');
      return;
    }

    if (photoUploadTargetPlayer === '__NEW__') {
      pendingNewPlayerPhoto = dataUrl;
      const previewImg = document.getElementById('newPlayerPhotoPreviewImg');
      const placeholder = document.getElementById('newPlayerPhotoPlaceholder');
      if (previewImg && placeholder) {
        previewImg.src = dataUrl;
        previewImg.classList.remove('hidden');
        placeholder.classList.add('hidden');
      }
      showToast('📸 Foto selecionada para o novo jogador!', 'info');
    } else if (photoUploadTargetPlayer) {
      playerPhotos[photoUploadTargetPlayer] = dataUrl;
      renderApp();
      syncToCloud(true);
      showToast(`📸 Foto de "${photoUploadTargetPlayer}" atualizada para todos!`, 'success');
    }
  });
}

function compressImageToDataURL(file, size = 160, quality = 0.82, callback) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Corte central quadrado (cover)
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;

      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      callback(compressed);
    };
    img.onerror = () => callback(null);
    img.src = ev.target.result;
  };
  reader.onerror = () => callback(null);
  reader.readAsDataURL(file);
}

function handleAddPlayer() {
  const input = document.getElementById('inputPlayerName');
  if (!input) return;

  const rawName = input.value.trim();

  if (!rawName) {
    showToast('Por favor, digite o nome do jogador para inscrever.', 'warning');
    input.focus();
    return;
  }

  if (rawName.length > 20) {
    showToast('O nome do jogador deve ter no máximo 20 caracteres.', 'warning');
    return;
  }

  const isDuplicate = players.some(p => p.toLowerCase() === rawName.toLowerCase());
  if (isDuplicate) {
    showToast(`O jogador "${rawName}" já está inscrito no campeonato!`, 'warning');
    input.focus();
    return;
  }

  if (players.length >= 16) {
    showToast('Limite máximo de 16 participantes atingido!', 'warning');
    return;
  }

  const playedCount = matches.filter(m => m.homeScore !== null && m.awayScore !== null).length;

  if (playedCount > 0) {
    openConfirmModal({
      title: 'Ajustar Campeonato com Novo Jogador?',
      message: `O campeonato já tem ${playedCount} partidas com resultado. Adicionar "${rawName}" irá gerar uma nova grade e atualizar em tempo real para todos. Deseja continuar?`,
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
  // Se for uma restauração do jogador recém-removido, recupera as partidas e placares originais!
  if (preRemovalMatchesBackup && preRemovalPlayersBackup && preRemovalPlayersBackup.includes(playerName) && preRemovalPlayersBackup.length === players.length + 1) {
    players = [...preRemovalPlayersBackup];
    matches = JSON.parse(JSON.stringify(preRemovalMatchesBackup));
    preRemovalMatchesBackup = null;
    preRemovalPlayersBackup = null;
  } else {
    if (!players.includes(playerName)) {
      players.push(playerName);
    }
    if (isExactOriginalFour(players)) {
      matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES_4));
    } else {
      matches = generateRoundRobinSchedule(players);
    }
  }

  if (pendingNewPlayerPhoto) {
    playerPhotos[playerName] = pendingNewPlayerPhoto;
    pendingNewPlayerPhoto = null;
    const previewImg = document.getElementById('newPlayerPhotoPreviewImg');
    const placeholder = document.getElementById('newPlayerPhotoPlaceholder');
    if (previewImg && placeholder) {
      previewImg.src = '';
      previewImg.classList.add('hidden');
      placeholder.classList.remove('hidden');
    }
  }

  hasCelebrated = false;
  renderApp();
  syncToCloud(true);
  showToast(`Jogador "${playerName}" inscrito! Atualizado em tempo real para todos.`, 'success');
}

window.confirmRemovePlayer = function(playerName) {
  if (players.length <= 3) {
    showToast('O sistema precisa manter no mínimo 3 jogadores cadastrados.', 'warning');
    return;
  }

  openConfirmModal({
    title: `Excluir Usuário Oficialmente?`,
    message: `Tem certeza de que deseja excluir definitivamente o jogador "${playerName}" do sistema? Esta ação é oficial e definitiva: o cadastro, a foto de perfil e os registros ativos deste usuário serão apagados do banco de dados.`,
    icon: '🗑️',
    confirmText: 'Sim, excluir oficialmente',
    cancelText: 'Cancelar',
    onConfirm: () => {
      // 1. Remove oficialmente da lista de jogadores do sistema
      players = players.filter(p => p !== playerName);

      // 2. Apaga a foto de perfil definitiva do usuário
      if (playerPhotos && playerPhotos[playerName]) {
        delete playerPhotos[playerName];
      }

      // 3. Remove de backups para que não fique como participante pendente de restauração rápida
      if (preRemovalPlayersBackup) {
        preRemovalPlayersBackup = preRemovalPlayersBackup.filter(p => p !== playerName);
      }

      // 4. Se o usuário atual logado for este excluído, desvincula a identificação
      if (currentUser && currentUser.toLowerCase() === playerName.toLowerCase()) {
        currentUser = null;
        localStorage.removeItem('efootball_current_user');
      }

      // 5. Recalcula as rodadas do campeonato ativo para os participantes restantes
      if (isExactOriginalFour(players)) {
        matches = JSON.parse(JSON.stringify(DEFAULT_MATCHES_4));
      } else {
        matches = generateRoundRobinSchedule(players);
      }

      // 6. Atualiza o Mata-Mata se o usuário excluído estava nele
      if (knockoutState && Array.isArray(knockoutState.ties)) {
        let koChanged = false;
        knockoutState.ties.forEach(t => {
          if (t.home === playerName) {
            t.home = 'BYE (Avança direto)';
            koChanged = true;
          }
          if (t.away === playerName) {
            t.away = 'BYE (Avança direto)';
            koChanged = true;
          }
        });
        if (koChanged) {
          propagateKnockoutBracket();
        }
      }

      hasCelebrated = false;
      renderApp();
      syncToCloud(true);
      showToast(`Usuário "${playerName}" foi excluído oficialmente do sistema!`, 'danger');
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
   Identificação do Usuário / Perfil Atual (Modal Dedicado)
   ========================================================================== */
function openUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  const grid = document.getElementById('quickSelectPlayersGrid');
  const input = document.getElementById('inputCustomUserName');

  if (!modal || !grid) return;

  grid.innerHTML = '';

  players.forEach(pName => {
    const isSelected = currentUser && currentUser.toLowerCase() === pName.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `quick-player-btn ${isSelected ? 'selected' : ''}`;
    btn.innerHTML = `
      <span class="quick-player-avatar">${pName.charAt(0).toUpperCase()}</span>
      <span>${pName}</span>
    `;
    btn.addEventListener('click', () => {
      setCurrentUserProfile(pName);
    });
    grid.appendChild(btn);
  });

  if (input) {
    input.value = currentUser || '';
  }

  modal.classList.remove('hidden');

  modal.onclick = (e) => {
    if (e.target === modal) {
      closeUserProfileModal();
    }
  };
}

function closeUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function setCurrentUserProfile(name) {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    showToast('Digite ou selecione um nome válido.', 'warning');
    return;
  }

  currentUser = cleanName;
  localStorage.setItem(STORAGE_USER_KEY, currentUser);

  closeUserProfileModal();
  renderApp();
  showToast(`👋 Conectado como "${currentUser}"! Seus jogos estão destacados.`, 'success');
}

function handleSaveCustomUserName() {
  const input = document.getElementById('inputCustomUserName');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    showToast('Digite seu nome no campo antes de confirmar.', 'warning');
    input.focus();
    return;
  }
  setCurrentUserProfile(val);
}

/* ==========================================================================
   Modo Mata-Mata (Sorteio Ao Vivo & Chaveamento Eliminatório)
   ========================================================================== */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function handleDrawKnockout() {
  if (players.length < 3) {
    showToast('É necessário ter pelo menos 3 jogadores inscritos para sortear o Mata-Mata.', 'warning');
    return;
  }

  const hasOngoingScores = knockoutState.ties && knockoutState.ties.some(
    t => t.leg1Home !== null || t.leg1Away !== null || t.leg2Home !== null || t.leg2Away !== null
  );

  if (hasOngoingScores) {
    openConfirmModal({
      title: 'Realizar Novo Sorteio do Mata-Mata?',
      message: 'Já existem confrontos ou placares preenchidos no Mata-Mata atual. Fazer um novo sorteio irá embaralhar os jogadores e zerar o chaveamento atual. Deseja sortear?',
      icon: '🎲',
      confirmText: 'Sim, sortear novamente',
      cancelText: 'Cancelar',
      onConfirm: () => {
        startKnockoutDrawAnimation();
      }
    });
  } else {
    startKnockoutDrawAnimation();
  }
}

function startKnockoutDrawAnimation() {
  const animArea = document.getElementById('drawAnimationArea');
  const shuffleNamesEl = document.getElementById('drawShuffleNames');
  const formatSelect = document.getElementById('selectKnockoutFormat');
  const selectedFormat = formatSelect ? formatSelect.value : 'two_legs';

  if (!animArea || !shuffleNamesEl) {
    executeKnockoutDraw(selectedFormat);
    return;
  }

  animArea.classList.remove('hidden');

  let steps = 0;
  const maxSteps = 14;
  const interval = setInterval(() => {
    const p1 = players[Math.floor(Math.random() * players.length)];
    let p2 = players[Math.floor(Math.random() * players.length)];
    if (p2 === p1 && players.length > 1) {
      p2 = players[(players.indexOf(p1) + 1) % players.length];
    }
    shuffleNamesEl.textContent = `${p1} × ${p2}`;
    steps++;

    if (steps >= maxSteps) {
      clearInterval(interval);
      animArea.classList.add('hidden');
      executeKnockoutDraw(selectedFormat);
    }
  }, 90);
}

function executeKnockoutDraw(format) {
  const shuffled = shuffleArray(players);
  const ties = [];
  const teamCount = shuffled.length;

  if (teamCount === 3) {
    // 3 Jogadores: P0 avança direto para a Final; P1 e P2 disputam a Semifinal única
    ties.push({
      id: 'sf1',
      stageId: 'semi',
      stageTitle: 'Semifinal',
      label: 'Semifinal Única',
      home: shuffled[1],
      away: shuffled[2],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'third',
      stageId: 'third',
      stageTitle: 'Disputa de 3º Lugar',
      label: '3º Lugar (Bronze)',
      home: 'Perdedor Semifinal',
      away: 'Medalha de Bronze',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'final',
      stageId: 'final',
      stageTitle: 'Grande Final 🏆',
      label: 'Grande Final',
      home: shuffled[0],
      away: 'Vencedor Semifinal',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });
  } else if (teamCount === 4) {
    // 4 Jogadores: Semifinais diretas (P0 vs P1 e P2 vs P3)
    ties.push({
      id: 'sf1',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 1',
      home: shuffled[0],
      away: shuffled[1],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf2',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 2',
      home: shuffled[2],
      away: shuffled[3],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'third',
      stageId: 'third',
      stageTitle: 'Disputa de 3º Lugar',
      label: '3º e 4º Lugar',
      home: 'Perdedor Semifinal 1',
      away: 'Perdedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'final',
      stageId: 'final',
      stageTitle: 'Grande Final 🏆',
      label: 'Grande Final',
      home: 'Vencedor Semifinal 1',
      away: 'Vencedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });
  } else if (teamCount === 5) {
    // 5 Jogadores: P0 e P1 disputam Semifinal 1; P2 avança direto para Semifinal 2;
    // P3 e P4 disputam o Playoff de Quartas (QF1). O vencedor de QF1 enfrenta P2 na Semifinal 2!
    ties.push({
      id: 'qf1',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas (Playoff)',
      home: shuffled[3],
      away: shuffled[4],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf1',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 1',
      home: shuffled[0],
      away: shuffled[1],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf2',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 2',
      home: shuffled[2],
      away: 'Vencedor Quartas',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'third',
      stageId: 'third',
      stageTitle: 'Disputa de 3º Lugar',
      label: '3º e 4º Lugar',
      home: 'Perdedor Semifinal 1',
      away: 'Perdedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'final',
      stageId: 'final',
      stageTitle: 'Grande Final 🏆',
      label: 'Grande Final',
      home: 'Vencedor Semifinal 1',
      away: 'Vencedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });
  } else if (teamCount === 6) {
    // 6 Jogadores: P0 vai para SF1 e P1 vai para SF2.
    // QF1: P2 vs P3 -> alimenta SF1.away
    // QF2: P4 vs P5 -> alimenta SF2.away
    ties.push({
      id: 'qf1',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 1',
      home: shuffled[2],
      away: shuffled[3],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'qf2',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 2',
      home: shuffled[4],
      away: shuffled[5],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf1',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 1',
      home: shuffled[0],
      away: 'Vencedor Quartas 1',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf2',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 2',
      home: shuffled[1],
      away: 'Vencedor Quartas 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'third',
      stageId: 'third',
      stageTitle: 'Disputa de 3º Lugar',
      label: '3º e 4º Lugar',
      home: 'Perdedor Semifinal 1',
      away: 'Perdedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'final',
      stageId: 'final',
      stageTitle: 'Grande Final 🏆',
      label: 'Grande Final',
      home: 'Vencedor Semifinal 1',
      away: 'Vencedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });
  } else if (teamCount === 7) {
    // 7 Jogadores: P0 avança para SF1.
    // QF1: P1 vs P2 -> alimenta SF1.away
    // QF2: P3 vs P4 -> alimenta SF2.home
    // QF3: P5 vs P6 -> alimenta SF2.away
    ties.push({
      id: 'qf1',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 1',
      home: shuffled[1],
      away: shuffled[2],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'qf2',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 2',
      home: shuffled[3],
      away: shuffled[4],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'qf3',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 3',
      home: shuffled[5],
      away: shuffled[6],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf1',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 1',
      home: shuffled[0],
      away: 'Vencedor Quartas 1',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf2',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 2',
      home: 'Vencedor Quartas 2',
      away: 'Vencedor Quartas 3',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'third',
      stageId: 'third',
      stageTitle: 'Disputa de 3º Lugar',
      label: '3º e 4º Lugar',
      home: 'Perdedor Semifinal 1',
      away: 'Perdedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'final',
      stageId: 'final',
      stageTitle: 'Grande Final 🏆',
      label: 'Grande Final',
      home: 'Vencedor Semifinal 1',
      away: 'Vencedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });
  } else {
    // 8 ou mais jogadores: 4 confrontos de Quartas de Final completos (QF1, QF2, QF3, QF4)
    ties.push({
      id: 'qf1',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 1',
      home: shuffled[0],
      away: shuffled[1],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'qf2',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 2',
      home: shuffled[2],
      away: shuffled[3],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'qf3',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 3',
      home: shuffled[4],
      away: shuffled[5],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'qf4',
      stageId: 'quarter',
      stageTitle: 'Quartas de Final',
      label: 'Quartas 4',
      home: shuffled[6],
      away: shuffled[7],
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf1',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 1',
      home: 'Vencedor Quartas 1',
      away: 'Vencedor Quartas 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'sf2',
      stageId: 'semi',
      stageTitle: 'Semifinais',
      label: 'Semifinal 2',
      home: 'Vencedor Quartas 3',
      away: 'Vencedor Quartas 4',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'third',
      stageId: 'third',
      stageTitle: 'Disputa de 3º Lugar',
      label: '3º e 4º Lugar',
      home: 'Perdedor Semifinal 1',
      away: 'Perdedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });

    ties.push({
      id: 'final',
      stageId: 'final',
      stageTitle: 'Grande Final 🏆',
      label: 'Grande Final',
      home: 'Vencedor Semifinal 1',
      away: 'Vencedor Semifinal 2',
      leg1Home: null,
      leg1Away: null,
      leg2Home: null,
      leg2Away: null,
      penHome: null,
      penAway: null,
      penaltyWinner: null,
      showPenalties: false
    });
  }

  knockoutState = {
    format: format || 'two_legs',
    displayMode: (knockoutState && knockoutState.displayMode) || 'photo_name',
    ties: ties
  };

  propagateKnockoutBracket();
  hasCelebratedKnockout = false;
  renderApp();
  syncToCloud(true);
  showToast('🎲 Sorteio do Mata-Mata realizado com sucesso!', 'success');
}

function isPlaceholderTeam(name) {
  if (!name) return true;
  return (
    name.startsWith('Vencedor ') ||
    name.startsWith('Perdedor ') ||
    name === 'A definir' ||
    name === '-' ||
    name === 'Medalha de Bronze' ||
    name.startsWith('BYE')
  );
}

/**
 * Retorna o formato efetivo do confronto:
 * Grande Final e Disputa de 3º Lugar são SEMPRE em Jogo Único ('single'),
 * mesmo quando as fases anteriores (Quartas/Semifinais) são Ida e Volta ('two_legs').
 */
function getEffectiveTieFormat(tie, globalFormat) {
  if (!tie) return globalFormat || 'two_legs';
  if (tie.stageId === 'final' || tie.stageId === 'third' || tie.id === 'final' || tie.id === 'third') {
    return 'single';
  }
  return globalFormat || 'two_legs';
}

function resolveTieOutcome(tie, format) {
  const effectiveFormat = getEffectiveTieFormat(tie, format);

  if (!tie || isPlaceholderTeam(tie.home) || isPlaceholderTeam(tie.away)) {
    return {
      winner: null,
      loser: null,
      isDrawPending: false,
      homeTotal: null,
      awayTotal: null,
      decidedByPenalties: false,
      penHome: null,
      penAway: null,
      allLegsPlayed: false
    };
  }

  const hasLeg1 = tie.leg1Home !== null && tie.leg1Away !== null && !isNaN(tie.leg1Home) && !isNaN(tie.leg1Away);
  if (!hasLeg1) {
    return { winner: null, loser: null, isDrawPending: false, homeTotal: null, awayTotal: null, decidedByPenalties: false, penHome: null, penAway: null, allLegsPlayed: false };
  }

  let homeTotal = parseInt(tie.leg1Home, 10);
  let awayTotal = parseInt(tie.leg1Away, 10);

  if (effectiveFormat === 'two_legs') {
    const hasLeg2 = tie.leg2Home !== null && tie.leg2Away !== null && !isNaN(tie.leg2Home) && !isNaN(tie.leg2Away);
    if (!hasLeg2) {
      return { winner: null, loser: null, isDrawPending: false, homeTotal, awayTotal, decidedByPenalties: false, penHome: null, penAway: null, allLegsPlayed: false };
    }
    homeTotal += parseInt(tie.leg2Home, 10);
    awayTotal += parseInt(tie.leg2Away, 10);
  }

  const hasPenScores =
    tie.penHome !== null && tie.penHome !== undefined &&
    tie.penAway !== null && tie.penAway !== undefined &&
    !isNaN(tie.penHome) && !isNaN(tie.penAway);

  // Se houver disputa de pênaltis preenchida (por empate nos jogos ou ativada manualmente)
  if (hasPenScores) {
    const ph = parseInt(tie.penHome, 10);
    const pa = parseInt(tie.penAway, 10);
    if (ph > pa) {
      return {
        winner: tie.home,
        loser: tie.away,
        isDrawPending: false,
        homeTotal,
        awayTotal,
        decidedByPenalties: true,
        penHome: ph,
        penAway: pa,
        allLegsPlayed: true
      };
    } else if (pa > ph) {
      return {
        winner: tie.away,
        loser: tie.home,
        isDrawPending: false,
        homeTotal,
        awayTotal,
        decidedByPenalties: true,
        penHome: ph,
        penAway: pa,
        allLegsPlayed: true
      };
    } else if (homeTotal === awayTotal || tie.showPenalties) {
      // Pênaltis ainda empatados (ex: 0 x 0 enquanto digita)
      return {
        winner: null,
        loser: null,
        isDrawPending: true,
        homeTotal,
        awayTotal,
        decidedByPenalties: false,
        penHome: ph,
        penAway: pa,
        allLegsPlayed: true
      };
    }
  }

  if (homeTotal > awayTotal) {
    return { winner: tie.home, loser: tie.away, isDrawPending: false, homeTotal, awayTotal, decidedByPenalties: false, penHome: null, penAway: null, allLegsPlayed: true };
  } else if (awayTotal > homeTotal) {
    return { winner: tie.away, loser: tie.home, isDrawPending: false, homeTotal, awayTotal, decidedByPenalties: false, penHome: null, penAway: null, allLegsPlayed: true };
  } else {
    // Empate nos dois jogos (ou no jogo único) -> abre campos da Disputa de Pênaltis
    if (tie.penaltyWinner === 'home') {
      return { winner: tie.home, loser: tie.away, isDrawPending: false, homeTotal, awayTotal, decidedByPenalties: true, penHome: null, penAway: null, allLegsPlayed: true };
    } else if (tie.penaltyWinner === 'away') {
      return { winner: tie.away, loser: tie.home, isDrawPending: false, homeTotal, awayTotal, decidedByPenalties: true, penHome: null, penAway: null, allLegsPlayed: true };
    }
    return { winner: null, loser: null, isDrawPending: true, homeTotal, awayTotal, decidedByPenalties: false, penHome: null, penAway: null, allLegsPlayed: true };
  }
}

function propagateKnockoutBracket() {
  if (!knockoutState || !Array.isArray(knockoutState.ties) || knockoutState.ties.length === 0) return;

  const fmt = knockoutState.format || 'two_legs';
  const findTie = (id) => knockoutState.ties.find(t => t.id === id);

  const qf1 = findTie('qf1');
  const qf2 = findTie('qf2');
  const qf3 = findTie('qf3');
  const qf4 = findTie('qf4');
  const sf1 = findTie('sf1');
  const sf2 = findTie('sf2');
  const finalTie = findTie('final');
  const third = findTie('third');

  // Propagação dinâmica das Quartas -> Semifinais
  if (sf1) {
    if (qf1 && qf2) {
      const r1 = resolveTieOutcome(qf1, fmt);
      const r2 = resolveTieOutcome(qf2, fmt);
      sf1.home = r1.winner || 'Vencedor Quartas 1';
      sf1.away = r2.winner || 'Vencedor Quartas 2';
    } else if (qf1 && sf1.away && sf1.away.startsWith('Vencedor')) {
      const r1 = resolveTieOutcome(qf1, fmt);
      sf1.away = r1.winner || 'Vencedor Quartas 1';
    }
  }

  if (sf2) {
    if (qf3 && qf4) {
      const r3 = resolveTieOutcome(qf3, fmt);
      const r4 = resolveTieOutcome(qf4, fmt);
      sf2.home = r3.winner || 'Vencedor Quartas 3';
      sf2.away = r4.winner || 'Vencedor Quartas 4';
    } else if (qf2 && qf3 && !qf4) {
      const r2 = resolveTieOutcome(qf2, fmt);
      const r3 = resolveTieOutcome(qf3, fmt);
      sf2.home = r2.winner || 'Vencedor Quartas 2';
      sf2.away = r3.winner || 'Vencedor Quartas 3';
    } else if (qf2 && !qf3 && !qf4 && sf2.away && sf2.away.startsWith('Vencedor')) {
      const r2 = resolveTieOutcome(qf2, fmt);
      sf2.away = r2.winner || 'Vencedor Quartas 2';
    } else if (qf1 && !qf2 && !qf3 && !qf4 && sf2.away && sf2.away.startsWith('Vencedor')) {
      // 5 Jogadores: QF1 alimenta SF2.away
      const r1 = resolveTieOutcome(qf1, fmt);
      sf2.away = r1.winner || 'Vencedor Quartas';
    }
  }

  // Propaga Semifinais -> Disputa de 3º Lugar e Grande Final
  if (sf1 && sf2) {
    const resSf1 = resolveTieOutcome(sf1, fmt);
    const resSf2 = resolveTieOutcome(sf2, fmt);

    if (finalTie) {
      finalTie.home = resSf1.winner || 'Vencedor Semifinal 1';
      finalTie.away = resSf2.winner || 'Vencedor Semifinal 2';
    }

    if (third) {
      third.home = resSf1.loser || 'Perdedor Semifinal 1';
      third.away = resSf2.loser || 'Perdedor Semifinal 2';
    }
  } else if (sf1 && !sf2) {
    // 3 Jogadores: sf1 vencedor avança para a final contra o cabeça de chave
    const resSf1 = resolveTieOutcome(sf1, fmt);
    if (finalTie) {
      finalTie.away = resSf1.winner || 'Vencedor Semifinal';
    }
    if (third) {
      third.home = resSf1.loser || 'Perdedor Semifinal';
      third.away = 'Medalha de Bronze';
    }
  }
}

function buildBracketNodeHtml(t, fmt, extraCardClass = '') {
  if (!t) return '';

  const tieFmt = getEffectiveTieFormat(t, fmt);
  const outcome = resolveTieOutcome(t, fmt);

  const isHomeWinner = outcome.winner && outcome.winner === t.home;
  const isAwayWinner = outcome.winner && outcome.winner === t.away;
  const isHomeLoser = outcome.winner && outcome.winner !== t.home;
  const isAwayLoser = outcome.winner && outcome.winner !== t.away;

  const homeCapsuleClass = isHomeWinner ? 'capsule-winner' : (isHomeLoser ? 'capsule-loser' : '');
  const awayCapsuleClass = isAwayWinner ? 'capsule-winner' : (isAwayLoser ? 'capsule-loser' : '');

  const l1h = t.leg1Home !== null && t.leg1Home !== undefined ? t.leg1Home : '';
  const l1a = t.leg1Away !== null && t.leg1Away !== undefined ? t.leg1Away : '';
  const l2h = t.leg2Home !== null && t.leg2Home !== undefined ? t.leg2Home : '';
  const l2a = t.leg2Away !== null && t.leg2Away !== undefined ? t.leg2Away : '';
  const ph = t.penHome !== null && t.penHome !== undefined ? t.penHome : '';
  const pa = t.penAway !== null && t.penAway !== undefined ? t.penAway : '';

  // Cálculo da soma (agregado) para exibição elegante ao lado dos dois placares
  let homeSumDisplay = '-';
  let awaySumDisplay = '-';
  if (outcome.homeTotal !== null && outcome.homeTotal !== undefined) {
    homeSumDisplay = outcome.homeTotal;
  } else if (l1h !== '' || l2h !== '') {
    homeSumDisplay = (l1h !== '' ? Number(l1h) : 0) + (l2h !== '' ? Number(l2h) : 0);
  }

  if (outcome.awayTotal !== null && outcome.awayTotal !== undefined) {
    awaySumDisplay = outcome.awayTotal;
  } else if (l1a !== '' || l2a !== '') {
    awaySumDisplay = (l1a !== '' ? Number(l1a) : 0) + (l2a !== '' ? Number(l2a) : 0);
  }

  const isRealTeams = !isPlaceholderTeam(t.home) && !isPlaceholderTeam(t.away) && !t.home.startsWith('BYE') && !t.away.startsWith('BYE');
  const showPenaltyCols = isRealTeams && (
    outcome.isDrawPending ||
    outcome.decidedByPenalties ||
    t.penHome !== null ||
    t.penAway !== null ||
    t.showPenalties
  );

  const homeAvatar = getPlayerAvatarInnerHtml(t.home);
  const awayAvatar = getPlayerAvatarInnerHtml(t.away);

  return `
    <div class="bracket-match-node ${extraCardClass}" data-tie-id="${t.id}">
      <!-- Linha do Jogador 1 (Cápsula + Placar(es) + Soma) -->
      <div class="bracket-player-row">
        <div
          class="bracket-player-capsule ${homeCapsuleClass}"
          data-player-name="${t.home}"
          title="Clique com o botão direito para opções de ${t.home}"
        >
          <div class="bracket-avatar-circle" onclick="triggerPlayerPhotoUpload('${t.home}')" title="Clique para trocar foto de ${t.home}">
            ${homeAvatar}
          </div>
          <span class="bracket-player-name">${t.home}</span>
        </div>

        <div class="bracket-score-block">
          ${tieFmt === 'two_legs' ? `
            <div class="ko-legs-stack">
              <input
                type="number"
                min="0"
                max="99"
                class="ko-score-input ko-mini-score-input"
                data-tie-id="${t.id}"
                data-field="leg1Home"
                placeholder="-"
                value="${l1h}"
                title="1º Jogo: ${t.home}"
              />
              <input
                type="number"
                min="0"
                max="99"
                class="ko-score-input ko-mini-score-input"
                data-tie-id="${t.id}"
                data-field="leg2Home"
                placeholder="-"
                value="${l2h}"
                title="2º Jogo: ${t.home}"
              />
            </div>
            <div class="ko-sum-total ${isHomeWinner ? 'sum-winner' : ''}" title="Soma dos dois jogos: ${homeSumDisplay}">
              ${homeSumDisplay}
            </div>
          ` : `
            <input
              type="number"
              min="0"
              max="99"
              class="ko-score-input ko-single-score-input ${isHomeWinner ? 'sum-winner' : ''}"
              data-tie-id="${t.id}"
              data-field="leg1Home"
              placeholder="-"
              value="${l1h}"
              title="Placar da Partida: ${t.home}"
            />
          `}
        </div>
      </div>

      <!-- Linha do Jogador 2 (Cápsula + Placar(es) + Soma) -->
      <div class="bracket-player-row">
        <div
          class="bracket-player-capsule ${awayCapsuleClass}"
          data-player-name="${t.away}"
          title="Clique com o botão direito para opções de ${t.away}"
        >
          <div class="bracket-avatar-circle" onclick="triggerPlayerPhotoUpload('${t.away}')" title="Clique para trocar foto de ${t.away}">
            ${awayAvatar}
          </div>
          <span class="bracket-player-name">${t.away}</span>
        </div>

        <div class="bracket-score-block">
          ${tieFmt === 'two_legs' ? `
            <div class="ko-legs-stack">
              <input
                type="number"
                min="0"
                max="99"
                class="ko-score-input ko-mini-score-input"
                data-tie-id="${t.id}"
                data-field="leg1Away"
                placeholder="-"
                value="${l1a}"
                title="1º Jogo: ${t.away}"
              />
              <input
                type="number"
                min="0"
                max="99"
                class="ko-score-input ko-mini-score-input"
                data-tie-id="${t.id}"
                data-field="leg2Away"
                placeholder="-"
                value="${l2a}"
                title="2º Jogo: ${t.away}"
              />
            </div>
            <div class="ko-sum-total ${isAwayWinner ? 'sum-winner' : ''}" title="Soma dos dois jogos: ${awaySumDisplay}">
              ${awaySumDisplay}
            </div>
          ` : `
            <input
              type="number"
              min="0"
              max="99"
              class="ko-score-input ko-single-score-input ${isAwayWinner ? 'sum-winner' : ''}"
              data-tie-id="${t.id}"
              data-field="leg1Away"
              placeholder="-"
              value="${l1a}"
              title="Placar da Partida: ${t.away}"
            />
          `}
        </div>
      </div>

      <!-- Barra Minimalista de Pênaltis (quando houver empate no agregado ou jogo único) -->
      ${showPenaltyCols ? `
        <div class="bracket-penalties-mini-bar">
          <span class="pen-mini-label">⚽ Pênaltis:</span>
          <input
            type="number"
            min="0"
            max="99"
            class="ko-score-input ko-pen-mini-input"
            data-tie-id="${t.id}"
            data-field="penHome"
            value="${ph}"
            placeholder="P1"
            title="Pênaltis de ${t.home}"
          />
          <span class="pen-mini-x">x</span>
          <input
            type="number"
            min="0"
            max="99"
            class="ko-score-input ko-pen-mini-input"
            data-tie-id="${t.id}"
            data-field="penAway"
            value="${pa}"
            placeholder="P2"
            title="Pênaltis de ${t.away}"
          />
          <button type="button" class="btn-clear-pen-mini" onclick="clearKnockoutPenalties('${t.id}')" title="Limpar Disputa de Pênaltis">✕</button>
        </div>
      ` : (isRealTeams && outcome.allLegsPlayed && outcome.isDrawPending) ? `
        <div class="bracket-penalties-mini-bar alert-draw">
          <button type="button" class="btn-trigger-pen-mini" onclick="toggleKnockoutPenalties('${t.id}')">
            ⚠️ Empate! Preencher Pênaltis
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderKnockoutView() {
  const container = document.getElementById('knockoutBracketContainer');
  const formatSelect = document.getElementById('selectKnockoutFormat');
  const koBanner = document.getElementById('knockoutChampionBanner');
  const koChampName = document.getElementById('knockoutChampionName');
  const koChampDetails = document.getElementById('knockoutChampionDetails');

  if (!container) return;

  if (formatSelect && knockoutState.format) {
    formatSelect.value = knockoutState.format;
  }

  // Atualiza estado do dropdown de modo de visualização (Foto + Nome | Só Foto | Só Nome)
  const displayMode = knockoutState.displayMode || 'photo_name';
  const displaySelect = document.getElementById('selectKnockoutDisplayMode');
  if (displaySelect) {
    displaySelect.value = displayMode;
  }

  propagateKnockoutBracket();

  if (!knockoutState.ties || knockoutState.ties.length === 0) {
    if (koBanner) koBanner.classList.add('hidden');
    container.innerHTML = `
      <div class="knockout-empty-state">
        <div class="knockout-empty-icon">🎲</div>
        <h3 class="knockout-empty-title">Nenhum Sorteio de Mata-Mata Ativo</h3>
        <p class="knockout-empty-desc">
          Clique no botão <strong>"Sortear Confrontos"</strong> acima para embaralhar os ${players.length} jogadores inscritos e montar o chaveamento no campo rumo à Grande Final!
        </p>
        <button type="button" class="btn btn-primary" onclick="handleDrawKnockout()">
          <span class="btn-icon">🎲</span>
          <span>Sortear Mata-Mata Agora</span>
        </button>
      </div>
    `;
    return;
  }

  const fmt = knockoutState.format || 'two_legs';
  const findTie = (id) => knockoutState.ties.find(t => t.id === id);

  // Verifica se a Grande Final tem campeão
  const finalTie = findTie('final');
  const finalOutcome = resolveTieOutcome(finalTie, fmt);

  if (koBanner && koChampName && koChampDetails) {
    if (finalOutcome && finalOutcome.winner) {
      koBanner.classList.remove('hidden');
      koChampName.textContent = finalOutcome.winner.toUpperCase();
      koChampDetails.textContent = `Conquistou a Grande Final contra ${finalOutcome.loser}!`;
      if (!hasCelebratedKnockout && typeof confetti === 'function') {
        hasCelebratedKnockout = true;
        triggerConfetti();
      }
    } else {
      koBanner.classList.add('hidden');
      hasCelebratedKnockout = false;
    }
  }

  const qf1 = findTie('qf1');
  const qf2 = findTie('qf2');
  const qf3 = findTie('qf3');
  const qf4 = findTie('qf4');
  const sf1 = findTie('sf1');
  const sf2 = findTie('sf2');
  const thirdTie = findTie('third');
  const hasQuarters = Boolean(qf1 || qf2 || qf3 || qf4);

  const stageSubLabel = fmt === 'two_legs' ? 'Ida e Volta (2 Jogos)' : 'Jogo Único';

  container.innerHTML = `
    <div class="pitch-bracket-arena fifa-bracket-arena display-mode-${displayMode}">
      <!-- Cabeçalho Oficial do Pôster de Chaveamento da Copa -->
      <div class="fifa-poster-header">
        <div class="fifa-poster-badge">🏆 CHAVEAMENTO OFICIAL 2026</div>
        <h2 class="fifa-poster-title">DOMUM WORLD CUP 2026™</h2>
      </div>

      <div class="pitch-bracket-tree ltr-tree">
        <!-- COLUNA 1: QUARTAS DE FINAL (se houver mais de 4 participantes) -->
        ${hasQuarters ? `
          <div class="bracket-col ltr-col col-quarter">
            <div class="bracket-stage-heading">
              Quartas de Final
              <span class="bracket-stage-subtag">${stageSubLabel}</span>
            </div>
            <div class="bracket-stage-content">
              ${qf1 && qf2 && qf3 && qf4 ? `
                <!-- 8 Participantes: 4 Jogos de Quartas completos -->
                <div class="bracket-pairing-block">
                  <div class="bracket-pairing-matches">
                    ${buildBracketNodeHtml(qf1, fmt)}
                    ${buildBracketNodeHtml(qf2, fmt)}
                  </div>
                  <svg class="bracket-pairing-fork-svg" viewBox="0 0 80 140" preserveAspectRatio="none">
                    <path d="M0,35 L40,35 L40,105 L0,105 M40,70 L80,70" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>

                <div class="bracket-pairing-block">
                  <div class="bracket-pairing-matches">
                    ${buildBracketNodeHtml(qf3, fmt)}
                    ${buildBracketNodeHtml(qf4, fmt)}
                  </div>
                  <svg class="bracket-pairing-fork-svg" viewBox="0 0 80 140" preserveAspectRatio="none">
                    <path d="M0,35 L40,35 L40,105 L0,105 M40,70 L80,70" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
              ` : qf1 && qf2 && qf3 && !qf4 ? `
                <!-- 7 Participantes: QF1 em cima, QF2 e QF3 embaixo -->
                <div class="bracket-pairing-block single-match-block">
                  <div class="bracket-pairing-matches">
                    ${buildBracketNodeHtml(qf1, fmt)}
                  </div>
                  <svg class="bracket-pairing-fork-svg single-lead-svg" viewBox="0 0 80 80" preserveAspectRatio="none">
                    <path d="M0,40 L80,40" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>

                <div class="bracket-pairing-block">
                  <div class="bracket-pairing-matches">
                    ${buildBracketNodeHtml(qf2, fmt)}
                    ${buildBracketNodeHtml(qf3, fmt)}
                  </div>
                  <svg class="bracket-pairing-fork-svg" viewBox="0 0 80 140" preserveAspectRatio="none">
                    <path d="M0,35 L40,35 L40,105 L0,105 M40,70 L80,70" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
              ` : qf1 && qf2 && !qf3 && !qf4 ? `
                <!-- 6 Participantes: QF1 em cima para SF1, QF2 embaixo para SF2 -->
                <div class="bracket-pairing-block single-match-block">
                  <div class="bracket-pairing-matches">
                    ${buildBracketNodeHtml(qf1, fmt)}
                  </div>
                  <svg class="bracket-pairing-fork-svg single-lead-svg" viewBox="0 0 80 80" preserveAspectRatio="none">
                    <path d="M0,40 L80,40" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>

                <div class="bracket-pairing-block single-match-block">
                  <div class="bracket-pairing-matches">
                    ${buildBracketNodeHtml(qf2, fmt)}
                  </div>
                  <svg class="bracket-pairing-fork-svg single-lead-svg" viewBox="0 0 80 80" preserveAspectRatio="none">
                    <path d="M0,40 L80,40" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>
              ` : `
                <!-- 5 Participantes: Topo com vaga direta na SF1, Embaixo Playoff QF1 levando à SF2 -->
                <div class="bracket-direct-pass-slot">
                  <div class="bracket-direct-badge">
                    <span class="badge-icon">⚡</span>
                    <span class="badge-text">Vaga Direta na Semifinal 1</span>
                  </div>
                  <div class="bracket-straight-lead-line"></div>
                </div>

                <div class="bracket-pairing-block single-match-block single-qf-bottom">
                  <div class="bracket-pairing-matches">
                    ${buildBracketNodeHtml(qf1, fmt)}
                  </div>
                  <svg class="bracket-pairing-fork-svg single-lead-svg" viewBox="0 0 80 80" preserveAspectRatio="none">
                    <path d="M0,40 L80,40" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>
              `}
            </div>
          </div>
        ` : ''}

        <!-- COLUNA 2: SEMIFINAIS -->
        <div class="bracket-col ltr-col col-semi">
          <div class="bracket-stage-heading">
            Semifinais
            <span class="bracket-stage-subtag">${stageSubLabel}</span>
          </div>
          <div class="bracket-stage-content">
            <div class="bracket-pairing-block semi-block">
              <div class="bracket-pairing-matches semi-matches">
                <div class="bracket-semi-slot">
                  ${buildBracketNodeHtml(sf1, fmt)}
                </div>
                <div class="bracket-semi-slot">
                  ${buildBracketNodeHtml(sf2, fmt)}
                </div>
              </div>
              <svg class="bracket-pairing-fork-svg semi-fork-svg" viewBox="0 0 90 280" preserveAspectRatio="none">
                <path d="M0,45 L45,45 L45,235 L0,235 M45,140 L90,140" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        <!-- COLUNA 3: FINAIS (Grande Final e Disputa de 3º Lugar) -->
        <div class="bracket-col ltr-col col-finals">
          <div class="bracket-stage-content finals-content">
            <!-- GRANDE FINAL -->
            <div class="bracket-final-wrap">
              <div class="bracket-stage-heading final-heading">
                🏆 GRANDE FINAL
                <span class="bracket-stage-subtag">Jogo Único</span>
              </div>
              <div class="bracket-final-card-row">
                ${buildBracketNodeHtml(finalTie, fmt, 'final-node-capsule')}
                <div class="bracket-final-lead-line"></div>
              </div>
            </div>

            <!-- 3º LUGAR (BRONZE FINAL) -->
            ${thirdTie ? `
              <div class="bracket-third-wrap">
                <div class="bracket-stage-heading bronze-heading">
                  🥉 3º LUGAR (Bronze)
                  <span class="bracket-stage-subtag">Jogo Único</span>
                </div>
                ${buildBracketNodeHtml(thirdTie, fmt, 'third-node-capsule')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- COLUNA 4: WORLD CHAMPION & TROFÉU -->
        <div class="bracket-col ltr-col col-champion">
          <div class="bracket-stage-content champion-content">
            <!-- Pódio do Campeão -->
            <div class="fifa-champion-podium">
              <div class="fifa-champion-crown">👑</div>
              <div class="fifa-champion-label">WORLD CHAMPION</div>
              <div class="fifa-champion-card ${finalOutcome && finalOutcome.winner ? 'has-champion' : 'pending-champion'}">
                <div class="fifa-champion-avatar">
                  ${finalOutcome && finalOutcome.winner ? getPlayerAvatarInnerHtml(finalOutcome.winner) : '<span class="avatar-question-mark">?</span>'}
                </div>
                <div class="fifa-champion-name">
                  ${finalOutcome && finalOutcome.winner ? finalOutcome.winner : 'A DEFINIR'}
                </div>
              </div>
            </div>

            <!-- Troféu Dourado FIFA 26 3D -->
            <div class="fifa-trophy-showcase">
              <div class="fifa-trophy-glow"></div>
              <div class="fifa-trophy-img-wrap">
                <svg class="fifa-trophy-svg" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="goldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#fffbeb"/>
                      <stop offset="25%" stop-color="#fde047"/>
                      <stop offset="50%" stop-color="#eab308"/>
                      <stop offset="75%" stop-color="#ca8a04"/>
                      <stop offset="100%" stop-color="#854d0e"/>
                    </linearGradient>
                    <linearGradient id="goldGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#713f12"/>
                      <stop offset="40%" stop-color="#eab308"/>
                      <stop offset="70%" stop-color="#fef08a"/>
                      <stop offset="100%" stop-color="#ca8a04"/>
                    </linearGradient>
                    <filter id="trophyShine" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#eab308" flood-opacity="0.6"/>
                    </filter>
                  </defs>
                  <circle cx="50" cy="28" r="18" fill="url(#goldGrad1)" filter="url(#trophyShine)" />
                  <path d="M38 24 C44 18, 56 18, 62 24 C58 32, 42 32, 38 24 Z" fill="#fef08a" opacity="0.7"/>
                  <path d="M42 34 C46 38, 54 38, 58 34" stroke="#854d0e" stroke-width="2" stroke-linecap="round"/>
                  <path d="M36 44 C34 32, 38 26, 44 26 C41 34, 43 45, 45 58 Z" fill="url(#goldGrad2)"/>
                  <path d="M64 44 C66 32, 62 26, 56 26 C59 34, 57 45, 55 58 Z" fill="url(#goldGrad2)"/>
                  <path d="M42 56 C38 68, 38 84, 43 96 L57 96 C62 84, 62 68, 58 56 Z" fill="url(#goldGrad1)" filter="url(#trophyShine)"/>
                  <path d="M44 65 C48 74, 54 74, 56 65" stroke="#713f12" stroke-width="2" stroke-linecap="round"/>
                  <path d="M43 82 C48 90, 53 90, 57 82" stroke="#713f12" stroke-width="2" stroke-linecap="round"/>
                  <rect x="36" y="96" width="28" height="6" rx="2" fill="#15803d" stroke="#166534" stroke-width="1"/>
                  <rect x="34" y="102" width="32" height="7" rx="2" fill="url(#goldGrad1)"/>
                  <rect x="32" y="109" width="36" height="6" rx="2" fill="#15803d" stroke="#166534" stroke-width="1"/>
                  <rect x="30" y="115" width="40" height="15" rx="3" fill="url(#goldGrad2)" filter="url(#trophyShine)"/>
                  <text x="50" y="125" font-size="5" font-weight="900" fill="#713f12" text-anchor="middle" letter-spacing="0.5">FIFA 26</text>
                </svg>
              </div>
              <div class="fifa-trophy-badge">
                <span class="fifa-26-bold">26</span>
                <span class="fifa-trophy-sub">DOMUM WORLD CUP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Eventos de digitação direta nos inputs do Mata-Mata
  const koInputs = container.querySelectorAll('.ko-score-input');
  koInputs.forEach(inp => {
    inp.addEventListener('input', handleKnockoutDirectInput);
  });
}

window.adjustKnockoutScore = function(tieId, field, delta) {
  const tie = knockoutState.ties.find(t => t.id === tieId);
  if (!tie) return;

  if (isPlaceholderTeam(tie.home) || isPlaceholderTeam(tie.away)) {
    showToast('Defina primeiro os vencedores da fase anterior!', 'warning');
    return;
  }

  if (field.startsWith('leg1')) {
    if (tie.leg1Home === null || tie.leg1Home === undefined) tie.leg1Home = 0;
    if (tie.leg1Away === null || tie.leg1Away === undefined) tie.leg1Away = 0;
  } else if (field.startsWith('leg2')) {
    if (tie.leg2Home === null || tie.leg2Home === undefined) tie.leg2Home = 0;
    if (tie.leg2Away === null || tie.leg2Away === undefined) tie.leg2Away = 0;
  } else if (field.startsWith('pen')) {
    if (tie.penHome === null || tie.penHome === undefined) tie.penHome = 0;
    if (tie.penAway === null || tie.penAway === undefined) tie.penAway = 0;
  }

  let nextVal = (tie[field] || 0) + delta;
  if (nextVal < 0) nextVal = 0;
  if (nextVal > 99) nextVal = 99;
  tie[field] = nextVal;
  tie.penaltyWinner = null;

  propagateKnockoutBracket();
  renderKnockoutView();
  syncToCloud(true);
};

function handleKnockoutDirectInput(e) {
  const input = e.target;
  const tieId = input.dataset.tieId;
  const field = input.dataset.field;
  const tie = knockoutState.ties.find(t => t.id === tieId);
  if (!tie) return;

  const raw = input.value.trim();
  if (raw === '') {
    tie[field] = null;
  } else {
    let val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 99) val = 99;
    tie[field] = val;
    if (field === 'leg1Home' && (tie.leg1Away === null || tie.leg1Away === undefined)) tie.leg1Away = 0;
    if (field === 'leg1Away' && (tie.leg1Home === null || tie.leg1Home === undefined)) tie.leg1Home = 0;
    if (field === 'leg2Home' && (tie.leg2Away === null || tie.leg2Away === undefined)) tie.leg2Away = 0;
    if (field === 'leg2Away' && (tie.leg2Home === null || tie.leg2Home === undefined)) tie.leg2Home = 0;
    if (field === 'penHome' && (tie.penAway === null || tie.penAway === undefined)) tie.penAway = 0;
    if (field === 'penAway' && (tie.penHome === null || tie.penHome === undefined)) tie.penHome = 0;
  }

  tie.penaltyWinner = null;
  propagateKnockoutBracket();
  renderKnockoutView();

  // Mantém o foco no campo que o usuário está digitando
  const container = document.getElementById('knockoutBracketContainer');
  if (container) {
    const newInput = container.querySelector(`.ko-score-input[data-tie-id="${tieId}"][data-field="${field}"]`);
    if (newInput) {
      newInput.focus();
    }
  }

  syncToCloud(false);
}

window.toggleKnockoutPenalties = function(tieId) {
  const tie = knockoutState.ties.find(t => t.id === tieId);
  if (!tie) return;
  tie.showPenalties = true;
  if (tie.penHome === null || tie.penHome === undefined) tie.penHome = 0;
  if (tie.penAway === null || tie.penAway === undefined) tie.penAway = 0;
  propagateKnockoutBracket();
  renderKnockoutView();
  syncToCloud(true);
};

window.clearKnockoutPenalties = function(tieId) {
  const tie = knockoutState.ties.find(t => t.id === tieId);
  if (!tie) return;
  tie.penHome = null;
  tie.penAway = null;
  tie.penaltyWinner = null;
  tie.showPenalties = false;
  propagateKnockoutBracket();
  renderKnockoutView();
  syncToCloud(true);
};

function copyKnockoutForWhatsApp() {
  if (!knockoutState.ties || knockoutState.ties.length === 0) {
    showToast('Realize primeiro o sorteio do Mata-Mata para copiar!', 'warning');
    return;
  }

  const fmt = knockoutState.format || 'two_legs';
  let text = `⚡ *CHAVEAMENTO MATA-MATA eFOOTBALL* 🏆\n\n`;

  knockoutState.ties.forEach(t => {
    const tieFmt = getEffectiveTieFormat(t, fmt);
    const out = resolveTieOutcome(t, fmt);
    const s1 = t.leg1Home !== null && t.leg1Away !== null ? `${t.leg1Home} x ${t.leg1Away}` : 'vs';
    const s2 = tieFmt === 'two_legs' && t.leg2Home !== null && t.leg2Away !== null ? ` (2º Jogo: ${t.leg2Home} x ${t.leg2Away})` : '';
    const sPen = out.decidedByPenalties && out.penHome !== null && out.penAway !== null
      ? ` [Pênaltis: ${out.penHome} x ${out.penAway}]`
      : '';
    const winTag = out.winner ? ` ➔ ✅ *${out.winner}*` : '';
    text += `🔹 *${t.label}:* ${t.home} ${s1} ${t.away}${s2}${sPen}${winTag}\n`;
  });

  const finalTie = knockoutState.ties.find(t => t.id === 'final');
  const finalOut = resolveTieOutcome(finalTie, fmt);
  if (finalOut && finalOut.winner) {
    text += `\n👑 *CAMPEÃO DO MATA-MATA:* ${finalOut.winner} 🏆\n`;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Chaveamento do Mata-Mata copiado para o WhatsApp!', 'success');
    }).catch(() => fallbackCopyText(text));
  } else {
    fallbackCopyText(text);
  }
}

/* ==========================================================================
   Histórico de Campeonatos & Sala de Troféus
   ========================================================================== */
function openSaveHistoryModal(mode = 'league') {
  pendingSaveMode = mode;
  const modal = document.getElementById('saveHistoryModal');
  const previewBox = document.getElementById('saveHistoryPreviewBox');
  const titleInput = document.getElementById('inputHistoryTitle');
  const chkReset = document.getElementById('chkResetAfterSave');

  if (!modal || !previewBox || !titleInput) return;

  const editionNum = tournamentHistory.length + 1;

  if (mode === 'knockout') {
    if (!knockoutState.ties || knockoutState.ties.length === 0) {
      showToast('Realize o sorteio e preencha o Mata-Mata antes de salvar no histórico.', 'warning');
      return;
    }
    const fmt = knockoutState.format || 'single';
    const finalTie = knockoutState.ties.find(t => t.id === 'final');
    const finalOut = resolveTieOutcome(finalTie, fmt);

    if (!finalOut.winner) {
      showToast('Defina o vencedor da Grande Final do Mata-Mata antes de salvar no histórico!', 'warning');
      return;
    }

    titleInput.value = `${editionNum}ª Copa Mata-Mata eFootball`;
    previewBox.innerHTML = `
      <div><strong>Modo:</strong> Copa Mata-Mata (${fmt === 'two_legs' ? 'Ida e Volta' : 'Jogo Único'})</div>
      <div><strong>🏆 Campeão:</strong> <span style="color: var(--accent-gold); font-weight: 800;">${finalOut.winner}</span></div>
      <div><strong>🥈 Vice-Campeão:</strong> ${finalOut.loser}</div>
    `;
  } else {
    const standings = calculateStandings();
    const playedCount = matches.filter(m => m.homeScore !== null && m.awayScore !== null).length;

    if (playedCount === 0) {
      showToast('Preencha pelo menos uma partida antes de salvar o campeonato no histórico!', 'warning');
      return;
    }

    const champion = standings[0];
    const runnerUp = standings[1] || { name: '-' };

    titleInput.value = `${editionNum}º Campeonato de Pontos Corridos`;
    previewBox.innerHTML = `
      <div><strong>Modo:</strong> Pontos Corridos (${playedCount}/${matches.length} jogos)</div>
      <div><strong>🏆 Campeão / Líder:</strong> <span style="color: var(--accent-gold); font-weight: 800;">${champion.name} (${champion.pts} pts)</span></div>
      <div><strong>🥈 Vice-Líder:</strong> ${runnerUp.name} (${runnerUp.pts || 0} pts)</div>
    `;
  }

  if (chkReset) chkReset.checked = false;
  modal.classList.remove('hidden');

  modal.onclick = (e) => {
    if (e.target === modal) closeSaveHistoryModal();
  };
}

function closeSaveHistoryModal() {
  const modal = document.getElementById('saveHistoryModal');
  if (modal) modal.classList.add('hidden');
}

function confirmSaveToHistory() {
  const titleInput = document.getElementById('inputHistoryTitle');
  const chkReset = document.getElementById('chkResetAfterSave');
  const customTitle = (titleInput && titleInput.value.trim()) || `${tournamentHistory.length + 1}º Torneio eFootball`;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (pendingSaveMode === 'knockout') {
    const fmt = knockoutState.format || 'single';
    const finalTie = knockoutState.ties.find(t => t.id === 'final');
    const finalOut = resolveTieOutcome(finalTie, fmt);
    const thirdTie = knockoutState.ties.find(t => t.id === 'third');
    const thirdOut = resolveTieOutcome(thirdTie, fmt);

    let totalGoals = 0;
    knockoutState.ties.forEach(t => {
      const tieFmt = getEffectiveTieFormat(t, fmt);
      if (t.leg1Home !== null && t.leg1Away !== null) totalGoals += (t.leg1Home + t.leg1Away);
      if (tieFmt === 'two_legs' && t.leg2Home !== null && t.leg2Away !== null) totalGoals += (t.leg2Home + t.leg2Away);
    });

    const record = {
      id: 'hist_' + Date.now(),
      title: customTitle,
      date: dateStr,
      mode: 'knockout',
      champion: finalOut.winner || '-',
      runnerUp: finalOut.loser || '-',
      thirdPlace: (thirdOut && thirdOut.winner) || '-',
      totalGoals: totalGoals,
      knockoutSnapshot: JSON.parse(JSON.stringify(knockoutState))
    };

    tournamentHistory.unshift(record);

    if (chkReset && chkReset.checked) {
      knockoutState = { format: fmt, ties: [] };
      hasCelebratedKnockout = false;
    }
  } else {
    const standings = calculateStandings();
    const playedMatches = matches.filter(m => m.homeScore !== null && m.awayScore !== null);
    let totalGoals = 0;
    playedMatches.forEach(m => {
      totalGoals += (m.homeScore + m.awayScore);
    });

    const champion = standings[0] || { name: '-', pts: 0 };
    const runnerUp = standings[1] || { name: '-', pts: 0 };
    const thirdPlace = standings[2] || { name: '-', pts: 0 };

    const record = {
      id: 'hist_' + Date.now(),
      title: customTitle,
      date: dateStr,
      mode: 'league',
      champion: champion.name,
      championPts: champion.pts,
      runnerUp: runnerUp.name,
      runnerUpPts: runnerUp.pts,
      thirdPlace: thirdPlace.name,
      totalGoals: totalGoals,
      matchesPlayed: `${playedMatches.length}/${matches.length}`,
      standingsSnapshot: JSON.parse(JSON.stringify(standings)),
      matchesSnapshot: JSON.parse(JSON.stringify(matches))
    };

    tournamentHistory.unshift(record);

    if (chkReset && chkReset.checked) {
      matches = generateRoundRobinSchedule(players);
      hasCelebrated = false;
    }
  }

  closeSaveHistoryModal();
  renderApp();
  syncToCloud(true);
  triggerConfetti();
  showToast(`🏅 "${customTitle}" salvo na Sala de Troféus!`, 'success');
}

function renderHistoryView() {
  const hallGrid = document.getElementById('hallOfFameGrid');
  const listContainer = document.getElementById('historyListContainer');
  const historyBadge = document.getElementById('historyCountBadge');

  if (historyBadge) {
    historyBadge.textContent = tournamentHistory.length;
  }

  if (!hallGrid || !listContainer) return;

  // Calcula contagem de títulos para cada jogador garantindo que NENHUM jogador histórico suma
  const allKnownHistoricalPlayers = new Set(players);
  INITIAL_PLAYERS.forEach(p => allKnownHistoricalPlayers.add(p));
  if (playerPhotos && typeof playerPhotos === 'object') {
    Object.keys(playerPhotos).forEach(name => {
      if (name && !name.startsWith('__')) allKnownHistoricalPlayers.add(name);
    });
  }
  tournamentHistory.forEach(h => {
    if (h.champion && h.champion !== '-' && !h.champion.startsWith('BYE')) allKnownHistoricalPlayers.add(h.champion);
    if (h.runnerUp && h.runnerUp !== '-' && !h.runnerUp.startsWith('BYE')) allKnownHistoricalPlayers.add(h.runnerUp);
    if (h.thirdPlace && h.thirdPlace !== '-' && !h.thirdPlace.startsWith('BYE')) allKnownHistoricalPlayers.add(h.thirdPlace);
    if (Array.isArray(h.standingsSnapshot)) {
      h.standingsSnapshot.forEach(p => {
        if (p.name && !p.name.startsWith('BYE')) allKnownHistoricalPlayers.add(p.name);
      });
    }
    if (Array.isArray(h.matchesSnapshot)) {
      h.matchesSnapshot.forEach(m => {
        if (m.home && !m.home.startsWith('BYE')) allKnownHistoricalPlayers.add(m.home);
        if (m.away && !m.away.startsWith('BYE')) allKnownHistoricalPlayers.add(m.away);
      });
    }
  });

  const trophyMap = {};
  allKnownHistoricalPlayers.forEach(p => {
    trophyMap[p] = { name: p, titles: 0, vices: 0 };
  });

  tournamentHistory.forEach(h => {
    if (h.champion && h.champion !== '-') {
      if (!trophyMap[h.champion]) {
        trophyMap[h.champion] = { name: h.champion, titles: 0, vices: 0 };
      }
      trophyMap[h.champion].titles += 1;
    }
    if (h.runnerUp && h.runnerUp !== '-' && !h.runnerUp.startsWith('BYE')) {
      if (!trophyMap[h.runnerUp]) {
        trophyMap[h.runnerUp] = { name: h.runnerUp, titles: 0, vices: 0 };
      }
      trophyMap[h.runnerUp].vices += 1;
    }
  });

  const ranking = Object.values(trophyMap).sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.vices !== a.vices) return b.vices - a.vices;
    return a.name.localeCompare(b.name);
  });

  hallGrid.innerHTML = '';
  const maxTitles = ranking.length > 0 ? ranking[0].titles : 0;

  ranking.forEach(r => {
    const isTop = r.titles > 0 && r.titles === maxTitles;
    const card = document.createElement('div');
    card.className = `trophy-player-card ${isTop ? 'top-champion' : ''}`;
    card.innerHTML = `
      <div class="trophy-count-circle" title="${r.titles} títulos conquistados">
        <span>🏆</span>
        <small style="font-size: 0.85rem;">${r.titles}</small>
      </div>
      <div class="trophy-player-info">
        <span class="trophy-player-name">${r.name}</span>
        <span class="trophy-player-sub">🥇 ${r.titles} ${r.titles === 1 ? 'Título' : 'Títulos'} • 🥈 ${r.vices} ${r.vices === 1 ? 'Vice' : 'Vices'}</span>
      </div>
    `;
    hallGrid.appendChild(card);
  });

  // Renderiza lista de campeonatos salvos
  if (tournamentHistory.length === 0) {
    listContainer.innerHTML = `
      <div class="knockout-empty-state">
        <div class="knockout-empty-icon">🏅</div>
        <h3 class="knockout-empty-title">Nenhum Campeonato Arquivado Ainda</h3>
        <p class="knockout-empty-desc">
          Quando terminar um campeonato de Pontos Corridos ou uma Copa Mata-Mata, clique em <strong>"Salvar no Histórico"</strong> para registrar o campeão e a tabela aqui para sempre!
        </p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = '';

  tournamentHistory.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item-card';

    const isKO = item.mode === 'knockout';
    const modeLabel = isKO ? '⚡ Mata-Mata' : '🏆 Pontos Corridos';
    const modeClass = isKO ? 'mode-knockout' : 'mode-league';

    card.innerHTML = `
      <div>
        <div class="history-card-top">
          <div>
            <h3 class="history-edition-title">${item.title}</h3>
            <div class="history-date-text">📅 Salvo em ${item.date}</div>
          </div>
          <span class="history-mode-badge ${modeClass}">${modeLabel}</span>
        </div>

        <div class="history-podium-box" style="margin-top: 12px;">
          <div class="podium-line">
            <span>🥇 Campeão:</span>
            <span class="podium-champion">👑 ${item.champion} ${item.championPts !== undefined ? `(${item.championPts} pts)` : ''}</span>
          </div>
          <div class="podium-line">
            <span>🥈 Vice-Campeão:</span>
            <strong>${item.runnerUp} ${item.runnerUpPts !== undefined ? `(${item.runnerUpPts} pts)` : ''}</strong>
          </div>
          <div class="podium-line">
            <span>⚽ Total de Gols:</span>
            <span>${item.totalGoals || 0} gols</span>
          </div>
        </div>
      </div>

      <div class="history-card-actions">
        <button type="button" class="btn btn-secondary" onclick="openHistoryDetailModal('${item.id}')">
          <span>🔍 Ver Detalhes</span>
        </button>
        <button type="button" class="btn-remove-player" onclick="confirmDeleteHistory('${item.id}')" title="Excluir este registro do histórico">
          🗑️
        </button>
      </div>
    `;

    listContainer.appendChild(card);
  });
}

window.openHistoryDetailModal = function(historyId) {
  const item = tournamentHistory.find(h => h.id === historyId);
  const modal = document.getElementById('historyDetailModal');
  const titleEl = document.getElementById('historyDetailTitle');
  const subEl = document.getElementById('historyDetailSubtitle');
  const bodyEl = document.getElementById('historyDetailBody');

  if (!item || !modal || !bodyEl) return;

  titleEl.textContent = item.title;
  subEl.textContent = `Concluído em ${item.date} • Campeão: ${item.champion}`;

  if (item.mode === 'knockout' && item.knockoutSnapshot) {
    const fmt = item.knockoutSnapshot.format || 'two_legs';
    let koHtml = '<div class="detail-matches-list">';
    (item.knockoutSnapshot.ties || []).forEach(t => {
      const tieFmt = getEffectiveTieFormat(t, fmt);
      const s1 = t.leg1Home !== null && t.leg1Away !== null ? `${t.leg1Home} x ${t.leg1Away}` : '-';
      const s2 = tieFmt === 'two_legs' && t.leg2Home !== null && t.leg2Away !== null ? ` (2º Jogo: ${t.leg2Home} x ${t.leg2Away})` : '';
      const sPen = t.penHome !== null && t.penHome !== undefined && t.penAway !== null && t.penAway !== undefined
        ? ` [Pên: ${t.penHome} x ${t.penAway}]`
        : '';
      koHtml += `
        <div class="detail-match-pill">
          <span><strong>${t.label}:</strong> ${t.home} vs ${t.away}</span>
          <strong style="color: var(--accent-cyan);">${s1}${s2}${sPen}</strong>
        </div>
      `;
    });
    koHtml += '</div>';
    bodyEl.innerHTML = koHtml;
  } else {
    let tableRows = '';
    (item.standingsSnapshot || []).forEach((p, idx) => {
      tableRows += `
        <tr>
          <td><strong>${idx + 1}º</strong></td>
          <td style="text-align:left; font-weight:700;">${p.name}</td>
          <td class="pts-cell">${p.pts}</td>
          <td>${p.j}</td>
          <td>${p.v}</td>
          <td>${p.e}</td>
          <td>${p.d}</td>
          <td>${p.gp}</td>
          <td>${p.gc}</td>
          <td>${p.sg > 0 ? '+' + p.sg : p.sg}</td>
        </tr>
      `;
    });

    let matchesPills = '';
    (item.matchesSnapshot || []).forEach(m => {
      const sc = m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} x ${m.awayScore}` : 'Não realizado';
      matchesPills += `
        <div class="detail-match-pill">
          <span>R${m.round}: ${m.home} × ${m.away}</span>
          <strong style="color: var(--accent-cyan);">${sc}</strong>
        </div>
      `;
    });

    bodyEl.innerHTML = `
      <div class="table-responsive" style="margin-bottom: 16px;">
        <table class="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th style="text-align:left;">Jogador</th>
              <th>PTS</th>
              <th>J</th>
              <th>V</th>
              <th>E</th>
              <th>D</th>
              <th>GP</th>
              <th>GC</th>
              <th>SG</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <h4 class="section-minor-title">Jogos Registrados</h4>
      <div class="detail-matches-list">${matchesPills}</div>
    `;
  }

  modal.classList.remove('hidden');
  modal.onclick = (e) => {
    if (e.target === modal) closeHistoryDetailModal();
  };
};

function closeHistoryDetailModal() {
  const modal = document.getElementById('historyDetailModal');
  if (modal) modal.classList.add('hidden');
}

window.confirmDeleteHistory = function(historyId) {
  const item = tournamentHistory.find(h => h.id === historyId);
  if (!item) return;

  openConfirmModal({
    title: 'Excluir Campeonato do Histórico?',
    message: `Tem certeza de que deseja remover "${item.title}" da Sala de Troféus?`,
    icon: '🗑️',
    confirmText: 'Sim, excluir',
    cancelText: 'Cancelar',
    onConfirm: () => {
      tournamentHistory = tournamentHistory.filter(h => h.id !== historyId);
      renderApp();
      syncToCloud(true);
      showToast('Registro removido do histórico.', 'info');
    }
  });
};

/* ==========================================================================
   Configuração de Eventos
   ========================================================================== */
function switchMainTab(targetView) {
  const navButtons = [
    { btn: document.getElementById('navTabTournament'), view: document.getElementById('viewTournament'), key: 'tournament' },
    { btn: document.getElementById('navTabKnockout'), view: document.getElementById('viewKnockout'), key: 'knockout' },
    { btn: document.getElementById('navTabHistory'), view: document.getElementById('viewHistory'), key: 'history' },
    { btn: document.getElementById('navTabPlayers'), view: document.getElementById('viewPlayers'), key: 'players' }
  ];

  if (targetView === 'tournament' || targetView === 'knockout') {
    lastCompetitionTab = targetView;
  }

  navButtons.forEach(item => {
    if (!item.btn || !item.view) return;
    if (item.key === targetView) {
      item.btn.classList.add('active');
      item.view.classList.remove('hidden');
    } else {
      item.btn.classList.remove('active');
      item.view.classList.add('hidden');
    }
  });

  // Destaca o botão do Menu Sanduíche quando o usuário está em Jogadores ou Histórico
  const btnHamburger = document.getElementById('btnHamburgerMenu');
  if (btnHamburger) {
    if (targetView === 'players' || targetView === 'history') {
      btnHamburger.classList.add('has-active-view');
    } else {
      btnHamburger.classList.remove('has-active-view');
    }
  }

  activeTab = targetView;
  localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, targetView);
  closeHamburgerDrawer();
}

window.returnToActiveCompetition = function() {
  switchMainTab(lastCompetitionTab || 'tournament');
};

function openHamburgerDrawer() {
  const drawer = document.getElementById('hamburgerDrawer');
  const backdrop = document.getElementById('hamburgerBackdrop');
  if (drawer) drawer.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');
}

function closeHamburgerDrawer() {
  const drawer = document.getElementById('hamburgerDrawer');
  const backdrop = document.getElementById('hamburgerBackdrop');
  if (drawer) drawer.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
}

/* ==========================================================================
   Botão Flutuante de Curtida na Lateral Direita (Máx. 1 clique por segundo)
   ========================================================================== */
function updateLikeDisplay() {
  const countEl = document.getElementById('floatingLikeCount');
  if (countEl) {
    countEl.textContent = totalLikes;
  }
}

function initFloatingLikeButton() {
  const btn = document.getElementById('btnFloatingLike');
  if (!btn) return;

  btn.addEventListener('click', handleFloatingLikeClick);
  updateLikeDisplay();
}

function handleFloatingLikeClick() {
  const now = Date.now();
  const timeSinceLastLike = now - lastLikeTimestamp;

  if (timeSinceLastLike < LIKE_COOLDOWN_MS) {
    // Cooldown de 1 segundo ativo: feedback sutil de espera
    const btn = document.getElementById('btnFloatingLike');
    if (btn) {
      btn.classList.remove('shake-cooldown');
      void btn.offsetWidth;
      btn.classList.add('shake-cooldown');
    }
    return;
  }

  lastLikeTimestamp = now;

  // Incremento local imediato
  totalLikes++;
  localStorage.setItem(STORAGE_LIKES_KEY, totalLikes.toString());
  updateLikeDisplay();

  // Efeitos visuais
  spawnLikeParticle();
  triggerLikeHeartBounce();
  startLikeCooldownTimer();

  // Sincronização atômica em tempo real com Firebase Firestore
  if (tournamentDocRef && isCloudConnected && typeof firebase !== 'undefined' && firebase.firestore) {
    tournamentDocRef.set({
      likes: firebase.firestore.FieldValue.increment(1)
    }, { merge: true }).catch(err => {
      console.warn('Erro ao sincronizar curtida no Firestore:', err);
    });
  }
}

function triggerLikeHeartBounce() {
  const btn = document.getElementById('btnFloatingLike');
  if (!btn) return;
  btn.classList.remove('heart-bounce');
  void btn.offsetWidth;
  btn.classList.add('heart-bounce');
  setTimeout(() => {
    btn.classList.remove('heart-bounce');
  }, 450);
}

function startLikeCooldownTimer() {
  const btn = document.getElementById('btnFloatingLike');
  const bar = document.getElementById('likeCooldownBar');
  if (btn) btn.classList.add('on-cooldown');

  if (bar) {
    bar.classList.remove('cooldown-active');
    bar.style.width = '100%';
    bar.style.transition = 'none';
    void bar.offsetWidth;
    bar.style.transition = 'width 1000ms linear';
    bar.style.width = '0%';
  }

  if (likeCooldownTimer) clearTimeout(likeCooldownTimer);
  likeCooldownTimer = setTimeout(() => {
    if (btn) btn.classList.remove('on-cooldown');
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = '0%';
    }
  }, LIKE_COOLDOWN_MS);
}

function spawnLikeParticle() {
  const area = document.getElementById('likeFloatingParticles');
  if (!area) return;

  const particle = document.createElement('div');
  particle.className = 'like-floating-particle';

  const emojis = ['❤️', '🔥', '⚽', '👏', '💖'];
  const chosenEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  particle.innerHTML = `<span>+1</span> <span>${chosenEmoji}</span>`;

  // Variação horizontal aleatória para efeito orgânico
  const randomX = Math.floor(Math.random() * 50) - 25;
  particle.style.left = `calc(50% + ${randomX}px)`;

  area.appendChild(particle);

  setTimeout(() => {
    if (particle && particle.parentNode) {
      particle.parentNode.removeChild(particle);
    }
  }, 1250);
}

/* ==========================================================================
   Menu de Contexto do Jogador (Botão Direito dentro da Partida/Tabela)
   & Modal Rápido de Adicionar Jogadores (Botão +)
   ========================================================================== */
let activeContextPlayer = null;

function openPlayerContextMenu(x, y, playerName) {
  if (!playerName || playerName.startsWith('BYE') || playerName.startsWith('Vencedor') || playerName.startsWith('Perdedor') || playerName === 'A definir') {
    return;
  }
  activeContextPlayer = playerName;

  const menu = document.getElementById('playerContextMenu');
  const nameEl = document.getElementById('contextMenuPlayerName');
  const avatarEl = document.getElementById('contextMenuAvatar');
  if (!menu || !nameEl || !avatarEl) return;

  nameEl.textContent = playerName;
  avatarEl.innerHTML = getPlayerAvatarInnerHtml(playerName);

  // Exibe o menu
  menu.classList.remove('hidden');

  // Garante que o menu não saia da tela
  const menuWidth = 230;
  const menuHeight = 180;
  const maxX = window.innerWidth - menuWidth - 12;
  const maxY = window.innerHeight - menuHeight - 12;
  const posX = Math.min(Math.max(10, x), Math.max(10, maxX));
  const posY = Math.min(Math.max(10, y), Math.max(10, maxY));

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
}

function closePlayerContextMenu() {
  const menu = document.getElementById('playerContextMenu');
  if (menu) menu.classList.add('hidden');
  activeContextPlayer = null;
}

function getUnenrolledPlayers() {
  const allKnown = new Set(INITIAL_PLAYERS);
  if (preRemovalPlayersBackup && Array.isArray(preRemovalPlayersBackup)) {
    preRemovalPlayersBackup.forEach(p => allKnown.add(p));
  }
  // Adiciona do cache de fotos
  if (playerPhotos && typeof playerPhotos === 'object') {
    Object.keys(playerPhotos).forEach(name => {
      if (name && !name.startsWith('__')) allKnown.add(name);
    });
  }
  // Adiciona do histórico de campeonatos
  if (Array.isArray(tournamentHistory)) {
    tournamentHistory.forEach(h => {
      if (h.champion && h.champion !== '-' && !h.champion.startsWith('BYE')) allKnown.add(h.champion);
      if (h.runnerUp && h.runnerUp !== '-' && !h.runnerUp.startsWith('BYE')) allKnown.add(h.runnerUp);
      if (h.thirdPlace && h.thirdPlace !== '-' && !h.thirdPlace.startsWith('BYE')) allKnown.add(h.thirdPlace);
      if (Array.isArray(h.standingsSnapshot)) {
        h.standingsSnapshot.forEach(p => {
          if (p.name && !p.name.startsWith('BYE')) allKnown.add(p.name);
        });
      }
      if (Array.isArray(h.matchesSnapshot)) {
        h.matchesSnapshot.forEach(m => {
          if (m.home && !m.home.startsWith('BYE')) allKnown.add(m.home);
          if (m.away && !m.away.startsWith('BYE')) allKnown.add(m.away);
        });
      }
    });
  }

  // Filtra apenas jogadores que NÃO estão atualmente na competição ativa
  const currentSet = new Set(players.map(p => p.toLowerCase()));
  return Array.from(allKnown).filter(name => !currentSet.has(name.toLowerCase()));
}

function openQuickAddPlayerModal() {
  const modal = document.getElementById('quickAddPlayerModal');
  const listEl = document.getElementById('quickAddAvailableList');
  const input = document.getElementById('inputQuickPlayerName');
  if (!modal || !listEl) return;

  if (input) input.value = '';

  const unenrolled = getUnenrolledPlayers();
  if (unenrolled.length === 0) {
    listEl.innerHTML = `
      <div class="quick-add-empty">
        Todos os jogadores anteriores já estão inscritos nesta competição.
      </div>
    `;
  } else {
    listEl.innerHTML = '';
    unenrolled.forEach(name => {
      const row = document.createElement('div');
      row.className = 'quick-add-player-row';
      row.innerHTML = `
        <div class="quick-add-player-info">
          <div class="quick-add-avatar">${getPlayerAvatarInnerHtml(name)}</div>
          <span class="quick-add-name">${name}</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="quickEnrollPlayer('${name}')">
          <span>➕ Adicionar de volta</span>
        </button>
      `;
      listEl.appendChild(row);
    });
  }

  modal.classList.remove('hidden');
  modal.onclick = (e) => {
    if (e.target === modal) closeQuickAddPlayerModal();
  };
}

function closeQuickAddPlayerModal() {
  const modal = document.getElementById('quickAddPlayerModal');
  if (modal) modal.classList.add('hidden');
}

window.quickEnrollPlayer = function(playerName) {
  if (players.includes(playerName)) {
    showToast(`"${playerName}" já está no campeonato.`, 'info');
    closeQuickAddPlayerModal();
    return;
  }

  // Se for restauração de jogador recém-removido, recupera os jogos e placares de volta imediatamente
  if (preRemovalMatchesBackup && preRemovalPlayersBackup && preRemovalPlayersBackup.includes(playerName)) {
    executeAddPlayer(playerName);
    closeQuickAddPlayerModal();
    showToast(`Partidas e placares de "${playerName}" restaurados com sucesso!`, 'success');
    return;
  }

  const playedCount = matches.filter(m => m.homeScore !== null && m.awayScore !== null).length;
  if (playedCount > 0) {
    openConfirmModal({
      title: 'Adicionar à Competição em Andamento?',
      message: `O campeonato já tem ${playedCount} partidas com resultado registrado. Adicionar "${playerName}" irá reorganizar as rodadas e reiniciar os placares. Deseja continuar?`,
      icon: '➕',
      confirmText: 'Sim, adicionar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        executeAddPlayer(playerName);
        closeQuickAddPlayerModal();
      }
    });
  } else {
    executeAddPlayer(playerName);
    closeQuickAddPlayerModal();
  }
};

function handleQuickAddNewPlayerSubmit() {
  const input = document.getElementById('inputQuickPlayerName');
  if (!input) return;
  const rawName = input.value.trim();
  if (!rawName) {
    showToast('Digite o nome do jogador para adicionar.', 'warning');
    input.focus();
    return;
  }

  if (players.some(p => p.toLowerCase() === rawName.toLowerCase())) {
    showToast(`O jogador "${rawName}" já está na competição!`, 'warning');
    input.focus();
    return;
  }

  if (players.length >= 16) {
    showToast('Limite máximo de 16 participantes atingido!', 'warning');
    return;
  }

  const playedCount = matches.filter(m => m.homeScore !== null && m.awayScore !== null).length;
  if (playedCount > 0) {
    openConfirmModal({
      title: 'Adicionar Novo Jogador à Competição?',
      message: `O campeonato já tem ${playedCount} partidas com resultado. Adicionar "${rawName}" irá gerar uma nova grade e atualizar em tempo real para todos. Deseja continuar?`,
      icon: '➕',
      confirmText: 'Sim, adicionar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        executeAddPlayer(rawName);
        input.value = '';
        closeQuickAddPlayerModal();
      }
    });
  } else {
    executeAddPlayer(rawName);
    input.value = '';
    closeQuickAddPlayerModal();
  }
}

function resetAllTournamentScores({ resetLeague = true, resetKnockout = true, clearKnockoutTies = false } = {}) {
  // 1. Zera placares da Liga (Pontos Corridos)
  if (resetLeague) {
    matches.forEach(m => {
      m.homeScore = null;
      m.awayScore = null;
    });
    preRemovalMatchesBackup = null;
    preRemovalPlayersBackup = null;
    hasCelebrated = false;
    const championBanner = document.getElementById('championBanner');
    if (championBanner) championBanner.classList.add('hidden');
  }

  // 2. Zera placares e fases do Mata-Mata
  if (resetKnockout && knockoutState && Array.isArray(knockoutState.ties)) {
    if (clearKnockoutTies) {
      knockoutState.ties = [];
    } else {
      const hasQuarters = knockoutState.ties.some(t => t.id && t.id.startsWith('qf'));

      knockoutState.ties.forEach(t => {
        t.leg1Home = null;
        t.leg1Away = null;
        t.leg2Home = null;
        t.leg2Away = null;
        t.penHome = null;
        t.penAway = null;
        t.penaltyWinner = null;
        t.showPenalties = false;

        if (t.stageId === 'semi') {
          if (t.id === 'sf1') {
            if (t.home && t.home.startsWith('Vencedor')) t.home = 'Vencedor Quartas 1';
            if (t.away && t.away.startsWith('Vencedor')) t.away = 'Vencedor Quartas 2';
          } else if (t.id === 'sf2') {
            if (t.home && t.home.startsWith('Vencedor')) t.home = 'Vencedor Quartas 3';
            if (t.away && t.away.startsWith('Vencedor')) t.away = (knockoutState.ties.some(q => q.id === 'qf3')) ? 'Vencedor Quartas 4' : 'Vencedor Quartas';
          }
        } else if (t.stageId === 'third') {
          t.home = 'Perdedor Semifinal 1';
          t.away = 'Perdedor Semifinal 2';
        } else if (t.stageId === 'final') {
          if (t.home && t.home.startsWith('Vencedor')) t.home = 'Vencedor Semifinal 1';
          if (t.away && t.away.startsWith('Vencedor')) t.away = 'Vencedor Semifinal 2';
        }
      });

      propagateKnockoutBracket();
    }

    hasCelebratedKnockout = false;
    const koBanner = document.getElementById('knockoutChampionBanner');
    if (koBanner) koBanner.classList.add('hidden');
  }

  renderApp();
  syncToCloud(true);
}

function setupEventListeners() {
  // Menu Sanduíche (Gaveta Lateral de Jogadores e Histórico)
  const btnHamburgerMenu = document.getElementById('btnHamburgerMenu');
  const btnCloseHamburger = document.getElementById('btnCloseHamburger');
  const hamburgerBackdrop = document.getElementById('hamburgerBackdrop');
  const drawerBtnBack = document.getElementById('drawerBtnBackToTournament');
  const drawerBtnUser = document.getElementById('drawerBtnUserProfile');
  const drawerBtnSave = document.getElementById('drawerBtnSaveHistory');

  if (btnHamburgerMenu) btnHamburgerMenu.addEventListener('click', openHamburgerDrawer);
  if (btnCloseHamburger) btnCloseHamburger.addEventListener('click', closeHamburgerDrawer);
  if (hamburgerBackdrop) hamburgerBackdrop.addEventListener('click', closeHamburgerDrawer);
  if (drawerBtnBack) {
    drawerBtnBack.addEventListener('click', () => {
      closeHamburgerDrawer();
      returnToActiveCompetition();
    });
  }
  if (drawerBtnUser) {
    drawerBtnUser.addEventListener('click', () => {
      closeHamburgerDrawer();
      openUserProfileModal();
    });
  }
  if (drawerBtnSave) {
    drawerBtnSave.addEventListener('click', () => {
      closeHamburgerDrawer();
      openSaveHistoryModal(lastCompetitionTab === 'knockout' ? 'knockout' : 'league');
    });
  }

  // Upload de Foto de Jogador
  const hiddenPhotoFileInput = document.getElementById('hiddenPhotoFileInput');
  const btnSelectNewPlayerPhoto = document.getElementById('btnSelectNewPlayerPhoto');

  if (hiddenPhotoFileInput) {
    hiddenPhotoFileInput.addEventListener('change', handlePhotoFileSelected);
  }
  if (btnSelectNewPlayerPhoto) {
    btnSelectNewPlayerPhoto.addEventListener('click', () => {
      photoUploadTargetPlayer = '__NEW__';
      if (hiddenPhotoFileInput) {
        hiddenPhotoFileInput.value = '';
        hiddenPhotoFileInput.click();
      }
    });
  }

  // Dropdown de Modo de Visualização do Mata-Mata (Foto + Nome | Só Foto | Só Nome)
  const selectKnockoutDisplayMode = document.getElementById('selectKnockoutDisplayMode');
  if (selectKnockoutDisplayMode) {
    selectKnockoutDisplayMode.addEventListener('change', (e) => {
      knockoutState.displayMode = e.target.value || 'photo_name';
      renderKnockoutView();
      syncToCloud(true);
    });
  }

  // Botão e Modal de Identificação do Usuário
  const btnUserProfile = document.getElementById('btnUserProfile');
  const btnCloseUserModal = document.getElementById('btnCloseUserModal');
  const btnSaveUserName = document.getElementById('btnSaveUserName');
  const inputCustomUserName = document.getElementById('inputCustomUserName');

  if (btnUserProfile) {
    btnUserProfile.addEventListener('click', openUserProfileModal);
  }
  if (btnCloseUserModal) {
    btnCloseUserModal.addEventListener('click', closeUserProfileModal);
  }
  if (btnSaveUserName) {
    btnSaveUserName.addEventListener('click', handleSaveCustomUserName);
  }
  if (inputCustomUserName) {
    inputCustomUserName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveCustomUserName();
      }
    });
  }

  // Navegação entre as 4 Abas Principais
  const tabTournament = document.getElementById('navTabTournament');
  const tabKnockout = document.getElementById('navTabKnockout');
  const tabHistory = document.getElementById('navTabHistory');
  const tabPlayers = document.getElementById('navTabPlayers');

  if (tabTournament) tabTournament.addEventListener('click', () => switchMainTab('tournament'));
  if (tabKnockout) tabKnockout.addEventListener('click', () => switchMainTab('knockout'));
  if (tabHistory) tabHistory.addEventListener('click', () => switchMainTab('history'));
  if (tabPlayers) tabPlayers.addEventListener('click', () => switchMainTab('players'));

  // Botões do Modo Mata-Mata
  const btnDrawKnockout = document.getElementById('btnDrawKnockout');
  const selectKnockoutFormat = document.getElementById('selectKnockoutFormat');
  const btnShareKnockoutWhatsApp = document.getElementById('btnShareKnockoutWhatsApp');
  const btnKnockoutCelebration = document.getElementById('btnKnockoutCelebration');

  if (btnDrawKnockout) {
    btnDrawKnockout.addEventListener('click', handleDrawKnockout);
  }
  if (selectKnockoutFormat) {
    selectKnockoutFormat.addEventListener('change', (e) => {
      knockoutState.format = e.target.value;
      propagateKnockoutBracket();
      renderKnockoutView();
      syncToCloud(true);
    });
  }
  if (btnShareKnockoutWhatsApp) {
    btnShareKnockoutWhatsApp.addEventListener('click', copyKnockoutForWhatsApp);
  }
  if (btnKnockoutCelebration) {
    btnKnockoutCelebration.addEventListener('click', () => {
      triggerConfetti();
      showToast('🎉 Parabéns ao Campeão do Mata-Mata!', 'success');
    });
  }

  // Botões e Modal de Histórico de Campeonatos
  const btnSaveLeagueHistory = document.getElementById('btnSaveLeagueHistory');
  const btnSaveBannerHistory = document.getElementById('btnSaveBannerHistory');
  const btnSaveKnockoutHistory = document.getElementById('btnSaveKnockoutHistory');
  const btnQuickSaveCurrent = document.getElementById('btnQuickSaveCurrent');
  const btnCancelSaveHistory = document.getElementById('btnCancelSaveHistory');
  const btnConfirmSaveHistory = document.getElementById('btnConfirmSaveHistory');
  const btnCloseHistoryDetail = document.getElementById('btnCloseHistoryDetail');

  if (btnSaveLeagueHistory) {
    btnSaveLeagueHistory.addEventListener('click', () => {
      openSaveHistoryModal(activeTab === 'knockout' ? 'knockout' : 'league');
    });
  }
  if (btnSaveBannerHistory) {
    btnSaveBannerHistory.addEventListener('click', () => openSaveHistoryModal('league'));
  }
  if (btnSaveKnockoutHistory) {
    btnSaveKnockoutHistory.addEventListener('click', () => openSaveHistoryModal('knockout'));
  }
  if (btnQuickSaveCurrent) {
    btnQuickSaveCurrent.addEventListener('click', () => openSaveHistoryModal('league'));
  }
  if (btnCancelSaveHistory) {
    btnCancelSaveHistory.addEventListener('click', closeSaveHistoryModal);
  }
  if (btnConfirmSaveHistory) {
    btnConfirmSaveHistory.addEventListener('click', confirmSaveToHistory);
  }
  if (btnCloseHistoryDetail) {
    btnCloseHistoryDetail.addEventListener('click', closeHistoryDetailModal);
  }

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

  const btnReset = document.getElementById('btnResetTournament');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      openConfirmModal({
        title: 'Zerar todo o Campeonato?',
        message: 'Todos os placares da Tabela de Pontos Corridos e do Chaveamento Mata-Mata serão zerados em tempo real para todos os participantes. (Dica: você pode salvar no Histórico antes de zerar!). Deseja continuar?',
        icon: '⚠️',
        confirmText: 'Sim, zerar tudo',
        cancelText: 'Cancelar',
        onConfirm: () => {
          resetAllTournamentScores({ resetLeague: true, resetKnockout: true, clearKnockoutTies: false });
          showToast('Campeonato, tabela e mata-mata zerados com sucesso!', 'success');
        }
      });
    });
  }

  // Botão dedicado para Zerar apenas o Mata-Mata
  const btnResetKo = document.getElementById('btnResetKnockout');
  if (btnResetKo) {
    btnResetKo.addEventListener('click', () => {
      openConfirmModal({
        title: 'Zerar Mata-Mata?',
        message: 'Todos os placares e vencedores do chaveamento do Mata-Mata serão limpos para reiniciar os confrontos em tempo real. Deseja continuar?',
        icon: '⚠️',
        confirmText: 'Sim, zerar mata-mata',
        cancelText: 'Cancelar',
        onConfirm: () => {
          resetAllTournamentScores({ resetLeague: false, resetKnockout: true, clearKnockoutTies: false });
          showToast('Placares do Mata-Mata zerados com sucesso!', 'success');
        }
      });
    });
  }

  // Botão de Sortear Ordem dos Jogos (Modo Pontos Corridos)
  const btnShuffleLeague = document.getElementById('btnShuffleLeagueSchedule');
  if (btnShuffleLeague) {
    btnShuffleLeague.addEventListener('click', handleShuffleLeagueSchedule);
  }

  const btnShare = document.getElementById('btnShareWhatsApp');
  if (btnShare) {
    btnShare.addEventListener('click', copyStandingsForWhatsApp);
  }

  const btnCelebration = document.getElementById('btnCelebration');
  if (btnCelebration) {
    btnCelebration.addEventListener('click', () => {
      triggerConfetti();
      showToast('🎉 Parabéns ao campeão!', 'success');
    });
  }

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

  // Context Menu Global Listeners (Botão direito ou toque longo)
  document.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('[data-player-name]');
    if (target) {
      const name = target.dataset.playerName;
      if (name && !name.startsWith('BYE') && !name.startsWith('Vencedor') && !name.startsWith('Perdedor') && name !== 'A definir') {
        e.preventDefault();
        openPlayerContextMenu(e.clientX, e.clientY, name);
      }
    }
  });

  // Suporte a Toque Longo no Mobile para abrir o menu do jogador
  let touchTimer = null;
  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('[data-player-name]');
    if (!target) return;
    const name = target.dataset.playerName;
    if (!name || name.startsWith('BYE') || name.startsWith('Vencedor') || name.startsWith('Perdedor') || name === 'A definir') return;
    touchTimer = setTimeout(() => {
      const touch = e.touches[0];
      if (touch) {
        openPlayerContextMenu(touch.clientX, touch.clientY, name);
      }
    }, 600);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (touchTimer) clearTimeout(touchTimer);
  });
  document.addEventListener('touchmove', () => {
    if (touchTimer) clearTimeout(touchTimer);
  });

  // Fecha menu de contexto ao clicar fora ou rolar
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#playerContextMenu')) {
      closePlayerContextMenu();
    }
  });
  window.addEventListener('scroll', closePlayerContextMenu, { passive: true });

  // Ações do Menu de Contexto
  const contextBtnRemove = document.getElementById('contextMenuBtnRemovePlayer');
  const contextBtnIdentify = document.getElementById('contextMenuBtnIdentify');
  const contextBtnPhoto = document.getElementById('contextMenuBtnChangePhoto');

  if (contextBtnRemove) {
    contextBtnRemove.addEventListener('click', () => {
      const p = activeContextPlayer;
      closePlayerContextMenu();
      if (p) confirmRemovePlayer(p);
    });
  }
  if (contextBtnIdentify) {
    contextBtnIdentify.addEventListener('click', () => {
      const p = activeContextPlayer;
      closePlayerContextMenu();
      if (p) setCurrentUserProfile(p);
    });
  }
  if (contextBtnPhoto) {
    contextBtnPhoto.addEventListener('click', () => {
      const p = activeContextPlayer;
      closePlayerContextMenu();
      if (p) triggerPlayerPhotoUpload(p);
    });
  }

  // Botões do Modal Rápido de Adicionar Jogadores (Botão +)
  const btnQuickAdd1 = document.getElementById('btnQuickAddPlayerModal');
  const btnQuickAdd2 = document.getElementById('btnMatchesAddPlayer');
  const btnCloseQuickAdd = document.getElementById('btnCloseQuickAddModal');
  const btnSubmitQuickAdd = document.getElementById('btnSubmitQuickAddPlayer');
  const inputQuickAdd = document.getElementById('inputQuickPlayerName');

  if (btnQuickAdd1) btnQuickAdd1.addEventListener('click', openQuickAddPlayerModal);
  if (btnQuickAdd2) btnQuickAdd2.addEventListener('click', openQuickAddPlayerModal);
  if (btnCloseQuickAdd) btnCloseQuickAdd.addEventListener('click', closeQuickAddPlayerModal);
  if (btnSubmitQuickAdd) btnSubmitQuickAdd.addEventListener('click', handleQuickAddNewPlayerSubmit);
  if (inputQuickAdd) {
    inputQuickAdd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickAddNewPlayerSubmit();
      }
    });
  }

  // Inicializa o botão flutuante de curtida na lateral direita
  initFloatingLikeButton();
}

document.addEventListener('DOMContentLoaded', init);
