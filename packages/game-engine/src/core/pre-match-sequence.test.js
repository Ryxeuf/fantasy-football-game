import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams } from './game-state';
import { startPreMatchSequence, calculateFanFactor, determineWeather, addJourneymen, processInducements, processPrayersToNuffle, determineKickingTeam, } from './pre-match-sequence';
describe('Pre-Match Sequence Complete', () => {
    it('should execute complete pre-match sequence', () => {
        // Créer un état initial avec des équipes simples
        const initialState = setupPreMatchWithTeams([
            { name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], [
            { name: 'Joueur B1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], 'Orcs de Fer', 'Elfes Sombres');
        let state = initialState;
        // === PHASE 1: Démarrage de la séquence ===
        state = startPreMatchSequence(state);
        expect(state.preMatch.phase).toBe('fans');
        expect(state.gameLog[state.gameLog.length - 1].message).toContain('Début de la séquence de pré-match');
        // === PHASE 2: Fan Factor ===
        const mockRng = () => 0.5; // D3 = 2 pour les deux équipes
        state = calculateFanFactor(state, mockRng, 3, 2); // 3 fans dévoués équipe A, 2 équipe B
        expect(state.preMatch.phase).toBe('weather');
        expect(state.preMatch.fanFactor?.teamA.total).toBe(5); // 2 + 3
        expect(state.preMatch.fanFactor?.teamB.total).toBe(4); // 2 + 2
        // === PHASE 3: Météo ===
        const weatherRng = () => 0.3; // D6 = 2 pour les deux dés
        state = determineWeather(state, weatherRng);
        expect(state.preMatch.phase).toBe('journeymen');
        expect(state.preMatch.weather?.total).toBe(4); // 2 + 2
        expect(state.preMatch.weather?.condition).toBe('Perfect Conditions');
        // === PHASE 4: Joueurs de passage ===
        state = addJourneymen(state, 11, 11); // Les deux équipes ont besoin de 11 joueurs
        expect(state.preMatch.phase).toBe('inducements');
        expect(state.preMatch.journeymen?.teamA.count).toBe(1); // 11 - 10 = 1 joueur de passage
        expect(state.preMatch.journeymen?.teamB.count).toBe(0); // 11 - 11 = 0 joueur de passage
        // Vérifier qu'un joueur de passage a été ajouté à l'équipe A
        const journeymanA = state.players.find(p => p.id === 'JA1');
        expect(journeymanA).toBeDefined();
        expect(journeymanA?.skills).toContain('Loner (4+)');
        // === PHASE 5: Incitations ===
        state = processInducements(state, 50000, 0, 0, 0); // Équipe A a 50k petty cash
        expect(state.preMatch.phase).toBe('prayers');
        expect(state.preMatch.inducements?.teamA.pettyCash).toBe(50000);
        // === PHASE 6: Prières à Nuffle ===
        state = processPrayersToNuffle(state, mockRng, 50000); // Différence de 50k CTV
        expect(state.preMatch.phase).toBe('kicking-team');
        expect(state.preMatch.prayers?.underdogTeam).toBe('B');
        expect(state.preMatch.prayers?.rolls).toHaveLength(1); // 50000 / 50000 = 1 roll
        // === PHASE 7: Détermination de l'équipe qui frappe ===
        const tossRng = () => 0.2; // Toss = 0 (Pile)
        state = determineKickingTeam(state, tossRng);
        expect(state.preMatch.phase).toBe('setup');
        expect(state.preMatch.kickingTeam).toBe('A');
        expect(state.preMatch.receivingTeam).toBe('B');
        // Vérifier que toutes les phases ont été traitées
        expect(state.preMatch.fanFactor).toBeDefined();
        expect(state.preMatch.weather).toBeDefined();
        expect(state.preMatch.journeymen).toBeDefined();
        expect(state.preMatch.inducements).toBeDefined();
        expect(state.preMatch.prayers).toBeDefined();
        expect(state.preMatch.kickingTeam).toBeDefined();
        expect(state.preMatch.receivingTeam).toBeDefined();
    });
    it('should handle different weather conditions', () => {
        const initialState = setupPreMatchWithTeams([], [], 'Équipe A', 'Équipe B');
        let state = initialState;
        state = startPreMatchSequence(state);
        state = calculateFanFactor(state, () => 0.5, 1, 1);
        // Test météo extrême (2D6 = 2)
        const extremeWeatherRng = () => 0.1; // D6 = 1 pour les deux dés
        state = determineWeather(state, extremeWeatherRng);
        expect(state.preMatch.weather?.total).toBe(2);
        expect(state.preMatch.weather?.condition).toBe('Sweltering Heat');
        // Test météo parfaite (2D6 = 7)
        state.preMatch.phase = 'weather';
        const perfectWeatherRng = () => 0.5; // D6 = 4 et 4
        state = determineWeather(state, perfectWeatherRng);
        expect(state.preMatch.weather?.total).toBe(8);
        expect(state.preMatch.weather?.condition).toBe('Perfect Conditions');
        // Test blizzard (2D6 = 12)
        state.preMatch.phase = 'weather';
        const blizzardRng = () => 0.9; // D6 = 6 et 6
        state = determineWeather(state, blizzardRng);
        expect(state.preMatch.weather?.total).toBe(12);
        expect(state.preMatch.weather?.condition).toBe('Blizzard');
    });
    it('should handle journeymen correctly', () => {
        const initialState = setupPreMatchWithTeams([
            { name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur A8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], [
            { name: 'Joueur B1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B7', number: 7, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
            { name: 'Joueur B11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
        ], 'Équipe A', 'Équipe B');
        let state = initialState;
        state = startPreMatchSequence(state);
        state = calculateFanFactor(state, () => 0.5, 1, 1);
        state = determineWeather(state, () => 0.5);
        // Ajouter des joueurs de passage
        state = addJourneymen(state, 11, 11);
        expect(state.preMatch.journeymen?.teamA.count).toBe(3); // 11 - 8 = 3 joueurs de passage
        expect(state.preMatch.journeymen?.teamB.count).toBe(0); // 11 - 11 = 0 joueur de passage
        // Vérifier que les joueurs de passage ont été ajoutés
        const journeymenA = state.players.filter(p => p.team === 'A' && p.id.startsWith('JA'));
        expect(journeymenA).toHaveLength(3);
        // Vérifier que tous les joueurs de passage ont le trait Loner (4+)
        journeymenA.forEach(journeyman => {
            expect(journeyman.skills).toContain('Loner (4+)');
            expect(journeyman.position).toBe('Lineman');
        });
    });
    it('should handle prayers to Nuffle with different CTV differences', () => {
        const initialState = setupPreMatchWithTeams([], [], 'Équipe A', 'Équipe B');
        let state = initialState;
        state = startPreMatchSequence(state);
        state = calculateFanFactor(state, () => 0.5, 1, 1);
        state = determineWeather(state, () => 0.5);
        state = addJourneymen(state, 11, 11);
        state = processInducements(state, 0, 0, 0, 0);
        // Test avec différence de 100k CTV (2 rolls)
        state = processPrayersToNuffle(state, () => 0.5, 100000);
        expect(state.preMatch.prayers?.rolls).toHaveLength(2); // 100000 / 50000 = 2 rolls
        expect(state.preMatch.prayers?.underdogTeam).toBe('B');
        // Test avec différence de 25k CTV (0 rolls)
        state.preMatch.phase = 'prayers';
        state = processPrayersToNuffle(state, () => 0.5, 25000);
        expect(state.preMatch.prayers?.rolls).toHaveLength(0); // 25000 / 50000 = 0 rolls (floor)
    });
    it('should determine kicking team correctly', () => {
        const initialState = setupPreMatchWithTeams([], [], 'Équipe A', 'Équipe B');
        let state = initialState;
        state = startPreMatchSequence(state);
        state = calculateFanFactor(state, () => 0.5, 1, 1);
        state = determineWeather(state, () => 0.5);
        state = addJourneymen(state, 11, 11);
        state = processInducements(state, 0, 0, 0, 0);
        state = processPrayersToNuffle(state, () => 0.5, 0);
        // Test avec toss = 0 (Pile)
        state = determineKickingTeam(state, () => 0.2);
        expect(state.preMatch.kickingTeam).toBe('A');
        expect(state.preMatch.receivingTeam).toBe('B');
        // Test avec toss = 1 (Face)
        state.preMatch.phase = 'kicking-team';
        state = determineKickingTeam(state, () => 0.8);
        expect(state.preMatch.kickingTeam).toBe('B');
        expect(state.preMatch.receivingTeam).toBe('A');
    });
});
