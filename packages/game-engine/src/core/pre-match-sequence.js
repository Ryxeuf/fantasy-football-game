import { createLogEntry } from '../utils/logging';
import { getWeatherCondition } from './weather-types';
/**
 * Démarre la séquence de pré-match complète
 * @param state - État initial du jeu
 * @returns État avec phase fans démarrée
 */
export function startPreMatchSequence(state) {
    if (state.half !== 0 || state.preMatch.phase !== 'idle')
        return state;
    const logEntry = createLogEntry('info', `Début de la séquence de pré-match - ${state.teamNames.teamA} vs ${state.teamNames.teamB}`);
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
 * @param manualD3A - Valeur D3 manuelle pour l'équipe A (optionnel, 1-3)
 * @param manualD3B - Valeur D3 manuelle pour l'équipe B (optionnel, 1-3)
 * @returns État avec Fan Factor calculé
 */
export function calculateFanFactor(state, rng, dedicatedFansA, dedicatedFansB, manualD3A, manualD3B) {
    if (state.preMatch.phase !== 'fans')
        return state;
    const d3A = manualD3A !== undefined ? manualD3A : Math.floor(rng() * 3) + 1;
    const d3B = manualD3B !== undefined ? manualD3B : Math.floor(rng() * 3) + 1;
    // Validation des valeurs D3
    if (d3A < 1 || d3A > 3 || d3B < 1 || d3B > 3) {
        return state; // Valeur invalide, on ne modifie pas l'état
    }
    const fanFactorA = d3A + dedicatedFansA;
    const fanFactorB = d3B + dedicatedFansB;
    const logEntry = createLogEntry('action', `Fan Factor calculé - ${state.teamNames.teamA}: ${fanFactorA} (D3:${d3A} + Fans:${dedicatedFansA}), ${state.teamNames.teamB}: ${fanFactorB} (D3:${d3B} + Fans:${dedicatedFansB})`);
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
 * @param weatherType - Type de météo choisi (classique, printaniere, etc.)
 * @param manualTotal - Valeur totale manuelle (optionnel, 2-12)
 * @returns État avec météo déterminée
 */
export function determineWeather(state, rng, weatherType = "classique", manualTotal) {
    if (state.preMatch.phase !== 'weather')
        return state;
    let total;
    if (manualTotal !== undefined) {
        // Utiliser la valeur totale manuelle
        total = manualTotal;
        if (total < 2 || total > 12) {
            return state; // Valeur invalide
        }
    }
    else {
        // Génération aléatoire (2D6)
        const dice1 = Math.floor(rng() * 6) + 1;
        const dice2 = Math.floor(rng() * 6) + 1;
        total = dice1 + dice2;
    }
    const weatherData = getWeatherCondition(weatherType, total);
    if (!weatherData) {
        return state; // Type de météo invalide ou total hors limites
    }
    const logEntry = createLogEntry('action', `Météo déterminée (${weatherType}): 2D6=${total} - ${weatherData.condition}: ${weatherData.description}`);
    return {
        ...state,
        preMatch: {
            ...state.preMatch,
            phase: 'journeymen',
            weatherType,
            weather: {
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
export function addJourneymen(state, teamARequired, teamBRequired) {
    if (state.preMatch.phase !== 'journeymen')
        return state;
    const teamAPlayers = state.players.filter(p => p.team === 'A');
    const teamBPlayers = state.players.filter(p => p.team === 'B');
    const teamAJourneymen = Math.max(0, teamARequired - teamAPlayers.length);
    const teamBJourneymen = Math.max(0, teamBRequired - teamBPlayers.length);
    const newPlayers = [...state.players];
    const journeymenA = [];
    const journeymenB = [];
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
    const logEntry = createLogEntry('action', `Joueurs de passage ajoutés - ${state.teamNames.teamA}: ${teamAJourneymen}, ${state.teamNames.teamB}: ${teamBJourneymen}`);
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
export function processInducements(state, teamAPettyCash, teamATreasurySpent, teamBPettyCash, teamBTreasurySpent) {
    if (state.preMatch.phase !== 'inducements')
        return state;
    const logEntry = createLogEntry('action', `Incitations traitées - ${state.teamNames.teamA}: Petty Cash ${teamAPettyCash}, Treasury ${teamATreasurySpent} | ${state.teamNames.teamB}: Petty Cash ${teamBPettyCash}, Treasury ${teamBTreasurySpent}`);
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
export function processPrayersToNuffle(state, rng, ctvDifference) {
    if (state.preMatch.phase !== 'prayers')
        return state;
    const underdogTeam = ctvDifference > 0 ? 'B' : 'A';
    const rollsCount = Math.floor(Math.abs(ctvDifference) / 50000);
    const rolls = [];
    for (let i = 0; i < rollsCount; i++) {
        const dice = Math.floor(rng() * 16) + 1;
        const result = `Prayer ${dice}`;
        const description = `Effet de prière ${dice} pour l'équipe ${underdogTeam}`;
        rolls.push({ dice, result, description });
    }
    const logEntry = createLogEntry('action', `Prières à Nuffle - Équipe désavantagée: ${underdogTeam}, Différence CTV: ${ctvDifference}, Rolls: ${rollsCount}`);
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
export function determineKickingTeam(state, rng) {
    if (state.preMatch.phase !== 'kicking-team')
        return state;
    const toss = Math.floor(rng() * 2);
    const kickingTeam = toss === 0 ? 'A' : 'B';
    const receivingTeam = kickingTeam === 'A' ? 'B' : 'A';
    const logEntry = createLogEntry('action', `Toss effectué: ${toss === 0 ? 'Pile' : 'Face'} - ${state.teamNames[kickingTeam === 'A' ? 'teamA' : 'teamB']} frappe, ${state.teamNames[receivingTeam === 'A' ? 'teamA' : 'teamB']} reçoit`);
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
