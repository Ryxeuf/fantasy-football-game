/**
 * Test pour vérifier que le bouton kick-off n'apparaît que quand les deux équipes ont placé leurs joueurs
 */
import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams, enterSetupPhase, placePlayerInSetup, } from './game-state';
// Helper pour créer des joueurs de test
function createTestPlayers(team, count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `${team}${i + 1}`,
        name: `Joueur ${team}${i + 1}`,
        number: i + 1,
        position: 'Lineman',
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: '',
        team: team,
    }));
}
describe('Kickoff Button Logic', () => {
    it('ne doit pas permettre le kick-off si seule une équipe a placé ses joueurs', () => {
        // Créer un état pré-match avec des équipes
        const teamAPlayers = createTestPlayers('A', 11);
        const teamBPlayers = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAPlayers, teamBPlayers, 'Équipe A', 'Équipe B');
        // Entrer en phase setup pour l'équipe A
        const setupState = enterSetupPhase(state, 'A');
        // Placer tous les joueurs de l'équipe A (positions légales x=1..12)
        // Placer quelques joueurs sur la LOS (x=12) et le reste ailleurs
        let currentState = setupState;
        for (let i = 0; i < 3; i++) {
            // 3 joueurs sur la LOS (x=12)
            currentState = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 12, y: 3 + i });
        }
        for (let i = 3; i < 11; i++) {
            // 8 autres joueurs ailleurs
            currentState = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 1 + (i - 3), y: 6 });
        }
        // Vérifier que l'équipe A a placé ses 11 joueurs
        const teamAPlayersOnField = currentState.players.filter(p => p.team === 'A' && p.pos.x >= 0).length;
        expect(teamAPlayersOnField).toBe(11);
        // Vérifier que l'équipe B n'a pas encore placé ses joueurs
        const teamBPlayersOnField = currentState.players.filter(p => p.team === 'B' && p.pos.x >= 0).length;
        expect(teamBPlayersOnField).toBe(0);
        // Le bouton kick-off ne devrait PAS apparaître
        const shouldShowKickoffButton = teamAPlayersOnField === 11 && teamBPlayersOnField === 11;
        expect(shouldShowKickoffButton).toBe(false);
    });
    it('doit permettre le kick-off si les deux équipes ont placé leurs joueurs', () => {
        // Créer un état pré-match avec des équipes
        const teamAPlayers = createTestPlayers('A', 11);
        const teamBPlayers = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAPlayers, teamBPlayers, 'Équipe A', 'Équipe B');
        // Entrer en phase setup pour l'équipe A
        let currentState = enterSetupPhase(state, 'A');
        // Placer tous les joueurs de l'équipe A (positions légales x=1..12)
        // Placer quelques joueurs sur la LOS (x=12) et le reste ailleurs
        for (let i = 0; i < 3; i++) {
            // 3 joueurs sur la LOS (x=12)
            currentState = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 12, y: 3 + i });
        }
        for (let i = 3; i < 11; i++) {
            // 8 autres joueurs ailleurs
            currentState = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 1 + (i - 3), y: 6 });
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
        // Placer quelques joueurs sur la LOS (x=13) et le reste ailleurs
        for (let i = 0; i < 3; i++) {
            // 3 joueurs sur la LOS (x=13)
            const result = placePlayerInSetup(currentState, teamBPlayers[i].id, { x: 13, y: 3 + i });
            console.log(`Placing B${i + 1} on LOS:`, result === currentState ? 'FAILED' : 'SUCCESS');
            currentState = result;
        }
        for (let i = 3; i < 11; i++) {
            // 8 autres joueurs ailleurs
            const result = placePlayerInSetup(currentState, teamBPlayers[i].id, { x: 14 + (i - 3), y: 6 });
            console.log(`Placing B${i + 1} elsewhere:`, result === currentState ? 'FAILED' : 'SUCCESS');
            currentState = result;
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
        // Créer un état pré-match avec des équipes
        const teamAPlayers = createTestPlayers('A', 11);
        const teamBPlayers = createTestPlayers('B', 11);
        const state = setupPreMatchWithTeams(teamAPlayers, teamBPlayers, 'Équipe A', 'Équipe B');
        // Entrer en phase setup pour l'équipe A
        let currentState = enterSetupPhase(state, 'A');
        // Placer seulement 10 joueurs de l'équipe A (positions légales x=1..12)
        // Placer quelques joueurs sur la LOS (x=12) et le reste ailleurs
        for (let i = 0; i < 3; i++) {
            // 3 joueurs sur la LOS (x=12)
            currentState = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 12, y: 3 + i });
        }
        for (let i = 3; i < 10; i++) {
            // 7 autres joueurs ailleurs
            currentState = placePlayerInSetup(currentState, teamAPlayers[i].id, { x: 1 + (i - 3), y: 6 });
        }
        // Passer à l'équipe B
        currentState = enterSetupPhase(currentState, 'B');
        // Placer tous les joueurs de l'équipe B (positions légales x=13..24)
        // Placer quelques joueurs sur la LOS (x=13) et le reste ailleurs
        for (let i = 0; i < 3; i++) {
            // 3 joueurs sur la LOS (x=13)
            currentState = placePlayerInSetup(currentState, teamBPlayers[i].id, { x: 13, y: 3 + i });
        }
        for (let i = 3; i < 11; i++) {
            // 8 autres joueurs ailleurs
            currentState = placePlayerInSetup(currentState, teamBPlayers[i].id, { x: 14 + (i - 3), y: 6 });
        }
        // Vérifier que l'équipe A a placé seulement 10 joueurs
        const teamAPlayersOnField = currentState.players.filter(p => p.team === 'A' && p.pos.x >= 0).length;
        const teamBPlayersOnField = currentState.players.filter(p => p.team === 'B' && p.pos.x >= 0).length;
        expect(teamAPlayersOnField).toBe(10);
        expect(teamBPlayersOnField).toBe(11);
        // Le bouton kick-off ne devrait PAS apparaître
        const shouldShowKickoffButton = teamAPlayersOnField === 11 && teamBPlayersOnField === 11;
        expect(shouldShowKickoffButton).toBe(false);
    });
});
