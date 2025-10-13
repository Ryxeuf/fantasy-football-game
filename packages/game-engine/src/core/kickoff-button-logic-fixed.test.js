import { describe, it, expect } from 'vitest';
import { createInitialGameState, enterSetupPhase, placePlayerInSetup } from '../game-state';
describe('Kickoff Button Logic', () => {
    it('doit permettre le kick-off si les deux équipes ont placé leurs joueurs', () => {
        // Créer un état initial avec les deux équipes
        const initialState = createInitialGameState({
            teamA: 'Équipe A',
            teamB: 'Équipe B',
            players: [
                // Équipe A - 11 joueurs
                { id: 'A1', team: 'A', name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A2', team: 'A', name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A3', team: 'A', name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A4', team: 'A', name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A5', team: 'A', name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A6', team: 'A', name: 'Joueur A6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A7', team: 'A', name: 'Joueur A7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A8', team: 'A', name: 'Joueur A8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A9', team: 'A', name: 'Joueur A9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A10', team: 'A', name: 'Joueur A10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A11', team: 'A', name: 'Joueur A11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                // Équipe B - 11 joueurs
                { id: 'B1', team: 'B', name: 'Joueur B1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B2', team: 'B', name: 'Joueur B2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B3', team: 'B', name: 'Joueur B3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B4', team: 'B', name: 'Joueur B4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B5', team: 'B', name: 'Joueur B5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B6', team: 'B', name: 'Joueur B6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B7', team: 'B', name: 'Joueur B7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B8', team: 'B', name: 'Joueur B8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B9', team: 'B', name: 'Joueur B9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B10', team: 'B', name: 'Joueur B10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B11', team: 'B', name: 'Joueur B11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
            ]
        });
        let currentState = initialState;
        // Commencer avec l'équipe A
        currentState = enterSetupPhase(currentState, 'A');
        expect(currentState.preMatch.currentCoach).toBe('A');
        expect(currentState.preMatch.phase).toBe('setup');
        const teamAPlayers = currentState.players.filter(p => p.team === 'A');
        const teamBPlayers = currentState.players.filter(p => p.team === 'B');
        // Placer tous les joueurs de l'équipe A (positions légales x=1..12)
        for (let i = 0; i < 3; i++) {
            // 3 joueurs sur la LOS (x=12)
            const result = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 12, y: 3 + i });
            currentState = result.state;
        }
        for (let i = 3; i < 11; i++) {
            // 8 autres joueurs ailleurs
            const result = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 1 + (i - 3), y: 6 });
            currentState = result.state;
        }
        // Passer à l'équipe B
        currentState = enterSetupPhase(currentState, 'B');
        console.log('After enterSetupPhase for B:', {
            phase: currentState.preMatch.phase,
            currentCoach: currentState.preMatch.currentCoach,
            placedPlayers: currentState.preMatch.placedPlayers.length,
            legalPositions: currentState.preMatch.legalSetupPositions.length
        });
        // Placer tous les joueurs de l'équipe B (positions légales x=13..24)
        for (let i = 0; i < 3; i++) {
            // 3 joueurs sur la LOS (x=13)
            const result = placePlayerInSetup(currentState, teamBPlayers[i].id, { x: 13, y: 3 + i });
            console.log(`Placing B${i + 1} on LOS:`, result.success ? 'SUCCESS' : 'FAILED');
            currentState = result.state;
        }
        for (let i = 3; i < 11; i++) {
            // 8 autres joueurs ailleurs
            const result = placePlayerInSetup(currentState, teamBPlayers[i].id, { x: 14 + (i - 3), y: 6 });
            console.log(`Placing B${i + 1} elsewhere:`, result.success ? 'SUCCESS' : 'FAILED');
            currentState = result.state;
        }
        // Vérifier que les deux équipes ont placé leurs 11 joueurs
        const teamAPlayersOnField = currentState.players.filter(p => p.team === 'A' && p.pos.x >= 0).length;
        const teamBPlayersOnField = currentState.players.filter(p => p.team === 'B' && p.pos.x >= 0).length;
        expect(teamAPlayersOnField).toBe(11);
        expect(teamBPlayersOnField).toBe(11);
        // Le bouton kick-off devrait apparaître
        const shouldShowKickoffButton = teamAPlayersOnField === 11 && teamBPlayersOnField === 11;
        expect(shouldShowKickoffButton).toBe(true);
    });
    it('ne doit pas permettre le kick-off si une équipe a placé moins de 11 joueurs', () => {
        const initialState = createInitialGameState({
            teamA: 'Équipe A',
            teamB: 'Équipe B',
            players: [
                // Équipe A - 11 joueurs
                { id: 'A1', team: 'A', name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A2', team: 'A', name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A3', team: 'A', name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A4', team: 'A', name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A5', team: 'A', name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A6', team: 'A', name: 'Joueur A6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A7', team: 'A', name: 'Joueur A7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A8', team: 'A', name: 'Joueur A8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A9', team: 'A', name: 'Joueur A9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A10', team: 'A', name: 'Joueur A10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'A11', team: 'A', name: 'Joueur A11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                // Équipe B - 11 joueurs
                { id: 'B1', team: 'B', name: 'Joueur B1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B2', team: 'B', name: 'Joueur B2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B3', team: 'B', name: 'Joueur B3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B4', team: 'B', name: 'Joueur B4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B5', team: 'B', name: 'Joueur B5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B6', team: 'B', name: 'Joueur B6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B7', team: 'B', name: 'Joueur B7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B8', team: 'B', name: 'Joueur B8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B9', team: 'B', name: 'Joueur B9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B10', team: 'B', name: 'Joueur B10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
                { id: 'B11', team: 'B', name: 'Joueur B11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
            ]
        });
        let currentState = initialState;
        // Commencer avec l'équipe A
        currentState = enterSetupPhase(currentState, 'A');
        const teamAPlayers = currentState.players.filter(p => p.team === 'A');
        const teamBPlayers = currentState.players.filter(p => p.team === 'B');
        // Placer seulement 10 joueurs de l'équipe A (pas tous)
        for (let i = 0; i < 10; i++) {
            const result = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 12, y: 3 + i });
            currentState = result.state;
        }
        // Passer à l'équipe B
        currentState = enterSetupPhase(currentState, 'B');
        // Placer tous les joueurs de l'équipe B
        for (let i = 0; i < 11; i++) {
            const result = placePlayerInSetup(currentState, teamBPlayers[i].id, { x: 13, y: 3 + i });
            currentState = result.state;
        }
        // Vérifier que l'équipe A a seulement 10 joueurs et l'équipe B a 11
        const teamAPlayersOnField = currentState.players.filter(p => p.team === 'A' && p.pos.x >= 0).length;
        const teamBPlayersOnField = currentState.players.filter(p => p.team === 'B' && p.pos.x >= 0).length;
        expect(teamAPlayersOnField).toBe(10);
        expect(teamBPlayersOnField).toBe(11);
        // Le bouton kick-off ne devrait PAS apparaître
        const shouldShowKickoffButton = teamAPlayersOnField === 11 && teamBPlayersOnField === 11;
        expect(shouldShowKickoffButton).toBe(false);
    });
});
