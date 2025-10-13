import { ExtendedGameState, PreMatchState } from './game-state';
import { createLogEntry } from '../utils/logging';

/**
 * Démarre la séquence de pré-match complète
 * @param state - État initial du jeu
 * @returns État avec phase fans démarrée
 */
export function startPreMatchSequence(state: ExtendedGameState): ExtendedGameState {
  if (state.half !== 0 || state.preMatch.phase !== 'idle') return state;

  const logEntry = createLogEntry(
    'info',
    `Début de la séquence de pré-match - ${state.teamNames.teamA} vs ${state.teamNames.teamB}`
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'fans',
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Calcule le Fan Factor pour les deux équipes
 * @param state - État en phase fans
 * @param rng - Générateur de nombres aléatoires
 * @param dedicatedFansA - Nombre de fans dévoués équipe A
 * @param dedicatedFansB - Nombre de fans dévoués équipe B
 * @returns État avec Fan Factor calculé
 */
export function calculateFanFactor(
  state: ExtendedGameState,
  rng: () => number,
  dedicatedFansA: number,
  dedicatedFansB: number
): ExtendedGameState {
  if (state.preMatch.phase !== 'fans') return state;

  const d3A = Math.floor(rng() * 3) + 1;
  const d3B = Math.floor(rng() * 3) + 1;
  
  const fanFactorA = d3A + dedicatedFansA;
  const fanFactorB = d3B + dedicatedFansB;

  const logEntry = createLogEntry(
    'action',
    `Fan Factor calculé - ${state.teamNames.teamA}: ${fanFactorA} (D3:${d3A} + Fans:${dedicatedFansA}), ${state.teamNames.teamB}: ${fanFactorB} (D3:${d3B} + Fans:${dedicatedFansB})`
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'weather',
      fanFactor: {
        teamA: { d3: d3A, dedicatedFans: dedicatedFansA, total: fanFactorA },
        teamB: { d3: d3B, dedicatedFans: dedicatedFansB, total: fanFactorB },
      },
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Détermine la météo
 * @param state - État en phase weather
 * @param rng - Générateur de nombres aléatoires
 * @returns État avec météo déterminée
 */
export function determineWeather(state: ExtendedGameState, rng: () => number): ExtendedGameState {
  if (state.preMatch.phase !== 'weather') return state;

  const dice1 = Math.floor(rng() * 6) + 1;
  const dice2 = Math.floor(rng() * 6) + 1;
  const total = dice1 + dice2;

  const weatherTable: { [key: number]: { condition: string; description: string } } = {
    2: { condition: 'Sweltering Heat', description: 'Certains joueurs s\'évanouissent dans la chaleur insupportable ! D3 joueurs aléatoires de chaque équipe sont placés en Réserve à la fin de chaque drive.' },
    3: { condition: 'Very Sunny', description: 'Un jour glorieux, mais le ciel clair et le soleil brillant interfèrent avec le jeu de passe ! -1 modificateur pour tous les tests de Passing Ability.' },
    4: { condition: 'Perfect Conditions', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
    5: { condition: 'Perfect Conditions', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
    6: { condition: 'Perfect Conditions', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
    7: { condition: 'Perfect Conditions', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
    8: { condition: 'Perfect Conditions', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
    9: { condition: 'Perfect Conditions', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
    10: { condition: 'Perfect Conditions', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
    11: { condition: 'Pouring Rain', description: 'Une pluie torrentielle laisse les joueurs trempés et le ballon très glissant ! -1 modificateur pour tous les tests d\'Agilité pour attraper ou ramasser le ballon.' },
    12: { condition: 'Blizzard', description: 'Des conditions glaciales et de fortes chutes de neige rendent le terrain dangereux. -1 modificateur pour tous les Rush supplémentaires. Seuls les passes Rapides et Courtes sont possibles.' },
  };

  const weatherData = weatherTable[total];

  const logEntry = createLogEntry(
    'action',
    `Météo déterminée: ${dice1}+${dice2}=${total} - ${weatherData.condition}: ${weatherData.description}`
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'journeymen',
      weather: {
        dice1,
        dice2,
        total,
        condition: weatherData.condition,
        description: weatherData.description,
      },
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Ajoute des joueurs de passage si nécessaire
 * @param state - État en phase journeymen
 * @param teamARequired - Nombre de joueurs requis pour l'équipe A
 * @param teamBRequired - Nombre de joueurs requis pour l'équipe B
 * @returns État avec joueurs de passage ajoutés
 */
export function addJourneymen(
  state: ExtendedGameState,
  teamARequired: number,
  teamBRequired: number
): ExtendedGameState {
  if (state.preMatch.phase !== 'journeymen') return state;

  const teamAPlayers = state.players.filter(p => p.team === 'A');
  const teamBPlayers = state.players.filter(p => p.team === 'B');

  const teamAJourneymen = Math.max(0, teamARequired - teamAPlayers.length);
  const teamBJourneymen = Math.max(0, teamBRequired - teamBPlayers.length);

  const newPlayers = [...state.players];
  const journeymenA: string[] = [];
  const journeymenB: string[] = [];

  // Ajouter les joueurs de passage pour l'équipe A
  for (let i = 0; i < teamAJourneymen; i++) {
    const journeymanId = `JA${i + 1}`;
    newPlayers.push({
      id: journeymanId,
      team: 'A',
      name: `Joueur de passage A${i + 1}`,
      number: teamAPlayers.length + i + 1,
      position: 'Lineman',
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: ['Loner (4+)'],
      pm: 6,
      hasBall: false,
      state: 'active',
      stunned: false,
      pos: { x: -1, y: -1 },
    });
    journeymenA.push(journeymanId);
  }

  // Ajouter les joueurs de passage pour l'équipe B
  for (let i = 0; i < teamBJourneymen; i++) {
    const journeymanId = `JB${i + 1}`;
    newPlayers.push({
      id: journeymanId,
      team: 'B',
      name: `Joueur de passage B${i + 1}`,
      number: teamBPlayers.length + i + 1,
      position: 'Lineman',
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: ['Loner (4+)'],
      pm: 6,
      hasBall: false,
      state: 'active',
      stunned: false,
      pos: { x: -1, y: -1 },
    });
    journeymenB.push(journeymanId);
  }

  const logEntry = createLogEntry(
    'action',
    `Joueurs de passage ajoutés - ${state.teamNames.teamA}: ${teamAJourneymen}, ${state.teamNames.teamB}: ${teamBJourneymen}`
  );

  return {
    ...state,
    players: newPlayers,
    preMatch: {
      ...state.preMatch,
      phase: 'inducements',
      journeymen: {
        teamA: { count: teamAJourneymen, players: journeymenA },
        teamB: { count: teamBJourneymen, players: journeymenB },
      },
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Traite les incitations (simplifié pour l'instant)
 * @param state - État en phase inducements
 * @param teamAPettyCash - Petty Cash équipe A
 * @param teamATreasurySpent - Treasury dépensé équipe A
 * @param teamBPettyCash - Petty Cash équipe B
 * @param teamBTreasurySpent - Treasury dépensé équipe B
 * @returns État avec incitations traitées
 */
export function processInducements(
  state: ExtendedGameState,
  teamAPettyCash: number,
  teamATreasurySpent: number,
  teamBPettyCash: number,
  teamBTreasurySpent: number
): ExtendedGameState {
  if (state.preMatch.phase !== 'inducements') return state;

  const logEntry = createLogEntry(
    'action',
    `Incitations traitées - ${state.teamNames.teamA}: Petty Cash ${teamAPettyCash}, Treasury ${teamATreasurySpent} | ${state.teamNames.teamB}: Petty Cash ${teamBPettyCash}, Treasury ${teamBTreasurySpent}`
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'prayers',
      inducements: {
        teamA: { pettyCash: teamAPettyCash, treasurySpent: teamATreasurySpent, items: [] },
        teamB: { pettyCash: teamBPettyCash, treasurySpent: teamBTreasurySpent, items: [] },
      },
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Traite les prières à Nuffle pour l'équipe désavantagée
 * @param state - État en phase prayers
 * @param rng - Générateur de nombres aléatoires
 * @param ctvDifference - Différence de CTV entre les équipes
 * @returns État avec prières traitées
 */
export function processPrayersToNuffle(
  state: ExtendedGameState,
  rng: () => number,
  ctvDifference: number
): ExtendedGameState {
  if (state.preMatch.phase !== 'prayers') return state;

  const underdogTeam = ctvDifference > 0 ? 'B' : 'A';
  const rollsCount = Math.floor(Math.abs(ctvDifference) / 50000);
  
  const rolls: { dice: number; result: string; description: string }[] = [];
  
  for (let i = 0; i < rollsCount; i++) {
    const dice = Math.floor(rng() * 16) + 1;
    const result = `Prayer ${dice}`;
    const description = `Effet de prière ${dice} pour l'équipe ${underdogTeam}`;
    rolls.push({ dice, result, description });
  }

  const logEntry = createLogEntry(
    'action',
    `Prières à Nuffle - Équipe désavantagée: ${underdogTeam}, Différence CTV: ${ctvDifference}, Rolls: ${rollsCount}`
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'kicking-team',
      prayers: {
        underdogTeam,
        ctvDifference,
        rolls,
      },
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Détermine l'équipe qui frappe (toss)
 * @param state - État en phase kicking-team
 * @param rng - Générateur de nombres aléatoires
 * @returns État avec équipe qui frappe déterminée
 */
export function determineKickingTeam(state: ExtendedGameState, rng: () => number): ExtendedGameState {
  if (state.preMatch.phase !== 'kicking-team') return state;

  const toss = Math.floor(rng() * 2);
  const kickingTeam = toss === 0 ? 'A' : 'B';
  const receivingTeam = kickingTeam === 'A' ? 'B' : 'A';

  const logEntry = createLogEntry(
    'action',
    `Toss effectué: ${toss === 0 ? 'Pile' : 'Face'} - ${state.teamNames[kickingTeam === 'A' ? 'teamA' : 'teamB']} frappe, ${state.teamNames[receivingTeam === 'A' ? 'teamA' : 'teamB']} reçoit`
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'setup',
      kickingTeam,
      receivingTeam,
    },
    gameLog: [...state.gameLog, logEntry],
  };
}
