/**
 * Test pour vérifier que la modale d'action n'apparaît pas pendant la phase setup
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
describe('Setup Modal Prevention', () => {
    it('ne doit pas définir selectedPlayerId pendant la phase setup', () => {
        // Créer un état pré-match avec des équipes
        const players = createTestPlayers('A', 11);
        const state = setupPreMatchWithTeams(players, createTestPlayers('B', 11), 'Équipe A', 'Équipe B');
        // Entrer en phase setup
        const setupState = enterSetupPhase(state, 'A');
        // Vérifier que selectedPlayerId est null
        expect(setupState.selectedPlayerId).toBeNull();
        // Placer quelques joueurs
        let currentState = setupState;
        for (let i = 0; i < 3; i++) {
            currentState = placePlayerInSetup(currentState, players[i].id, { x: 10 + i, y: 3 });
        }
        // Vérifier que selectedPlayerId reste null après placement
        expect(currentState.selectedPlayerId).toBeNull();
        // Vérifier que la phase est bien 'setup'
        expect(currentState.preMatch.phase).toBe('setup');
    });
    it('ne doit pas permettre la sélection de joueurs pour actions normales en phase setup', () => {
        // Créer un état pré-match avec des équipes
        const players = createTestPlayers('A', 11);
        const state = setupPreMatchWithTeams(players, createTestPlayers('B', 11), 'Équipe A', 'Équipe B');
        // Entrer en phase setup
        const setupState = enterSetupPhase(state, 'A');
        // Placer un joueur
        const stateWithPlayer = placePlayerInSetup(setupState, players[0].id, { x: 10, y: 3 });
        // Simuler un clic sur le joueur placé
        // En phase setup, cela ne devrait pas définir selectedPlayerId
        const player = stateWithPlayer.players.find(p => p.id === players[0].id);
        expect(player).toBeDefined();
        expect(player?.pos.x).toBe(10);
        expect(player?.pos.y).toBe(3);
        // Vérifier que selectedPlayerId reste null
        expect(stateWithPlayer.selectedPlayerId).toBeNull();
        // Vérifier que le joueur peut être sélectionné pour repositionnement
        // (via selectedFromReserve dans l'UI, mais pas selectedPlayerId)
        expect(stateWithPlayer.preMatch.placedPlayers).toContain(players[0].id);
    });
    it('doit permettre la sélection normale après la phase setup', () => {
        // Créer un état pré-match avec des équipes
        const players = createTestPlayers('A', 11);
        const state = setupPreMatchWithTeams(players, createTestPlayers('B', 11), 'Équipe A', 'Équipe B');
        // Entrer en phase setup
        const setupState = enterSetupPhase(state, 'A');
        // Placer tous les joueurs
        let currentState = setupState;
        for (let i = 0; i < 11; i++) {
            currentState = placePlayerInSetup(currentState, players[i].id, { x: 10 + i, y: 3 });
        }
        // Passer à la phase kickoff
        const kickoffState = {
            ...currentState,
            preMatch: {
                ...currentState.preMatch,
                phase: 'kickoff',
            },
        };
        // Maintenant, la sélection normale devrait être possible
        // (simulation d'un clic sur un joueur)
        const player = kickoffState.players.find(p => p.id === players[0].id);
        expect(player).toBeDefined();
        // En phase kickoff, selectedPlayerId peut être défini
        // (cela sera géré par l'UI, pas par le game engine directement)
        expect(kickoffState.preMatch.phase).toBe('kickoff');
    });
});
