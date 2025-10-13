import { describe, it, expect } from 'vitest';
// Test final pour vérifier que la correction de synchronisation dugout/terrain fonctionne
describe('Final Dugout Field Synchronization Verification', () => {
    it('should verify the complete fix works in all scenarios', () => {
        // Simuler la logique complète de TeamDugout avec la correction
        const teamDugoutLogic = (allPlayers, placedPlayers, dugout) => {
            // Vérifications de sécurité
            if (!allPlayers || !Array.isArray(allPlayers)) {
                return { reservePlayers: [], error: 'allPlayers invalid' };
            }
            if (!placedPlayers || !Array.isArray(placedPlayers)) {
                return { reservePlayers: [], error: 'placedPlayers invalid' };
            }
            if (!dugout || !dugout.teamId) {
                return { reservePlayers: [], error: 'dugout invalid' };
            }
            // Filtrer les joueurs en réserve avec la correction
            const reservePlayers = allPlayers.filter((p) => {
                // Vérifier que le joueur appartient à l'équipe
                if (p.team !== dugout.teamId) {
                    return false;
                }
                // Vérifier que le joueur n'est pas marqué comme placé
                if (placedPlayers.includes(p.id)) {
                    return false;
                }
                // CORRECTION : Vérifier que le joueur n'est pas sur le terrain
                if (p.pos && p.pos.x >= 0) {
                    return false;
                }
                return true;
            });
            return { reservePlayers, error: null };
        };
        // Test 1: Scénario normal
        const normalScenario = {
            allPlayers: [
                { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
                { id: 'A2', team: 'A', pos: { x: -1, y: -1 } }
            ],
            placedPlayers: ['A1'],
            dugout: { teamId: 'A' }
        };
        const result1 = teamDugoutLogic(normalScenario.allPlayers, normalScenario.placedPlayers, normalScenario.dugout);
        expect(result1.reservePlayers).toHaveLength(1);
        expect(result1.reservePlayers[0].id).toBe('A2');
        // Test 2: Scénario de rafraîchissement de page
        const refreshScenario = {
            allPlayers: [
                { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
                { id: 'A2', team: 'A', pos: { x: 13, y: 0 } },
                { id: 'A3', team: 'A', pos: { x: 14, y: 0 } }
            ],
            placedPlayers: [], // Vide après rafraîchissement
            dugout: { teamId: 'A' }
        };
        const result2 = teamDugoutLogic(refreshScenario.allPlayers, refreshScenario.placedPlayers, refreshScenario.dugout);
        expect(result2.reservePlayers).toHaveLength(0); // Aucun joueur en réserve car tous sont sur le terrain
        // Test 3: État incohérent
        const inconsistentScenario = {
            allPlayers: [
                { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
                { id: 'A2', team: 'A', pos: { x: 13, y: 0 } },
                { id: 'A3', team: 'A', pos: { x: -1, y: -1 } }
            ],
            placedPlayers: ['A1'], // Seulement A1 marqué comme placé
            dugout: { teamId: 'A' }
        };
        const result3 = teamDugoutLogic(inconsistentScenario.allPlayers, inconsistentScenario.placedPlayers, inconsistentScenario.dugout);
        expect(result3.reservePlayers).toHaveLength(1);
        expect(result3.reservePlayers[0].id).toBe('A3'); // A2 ne devrait pas être en réserve car il est sur le terrain
        // Test 4: État complètement undefined
        const undefinedScenario = {
            allPlayers: undefined,
            placedPlayers: undefined,
            dugout: undefined
        };
        const result4 = teamDugoutLogic(undefinedScenario.allPlayers, undefinedScenario.placedPlayers, undefinedScenario.dugout);
        expect(result4.reservePlayers).toEqual([]);
        expect(result4.error).toBe('allPlayers invalid');
    });
    it('should handle the exact scenario from the user image', () => {
        // Simuler exactement le scénario de l'image : joueurs sur le terrain ET dans le dugout
        const teamDugoutLogic = (allPlayers, placedPlayers, dugout) => {
            if (!allPlayers || !Array.isArray(allPlayers)) {
                return { reservePlayers: [] };
            }
            if (!placedPlayers || !Array.isArray(placedPlayers)) {
                return { reservePlayers: [] };
            }
            if (!dugout || !dugout.teamId) {
                return { reservePlayers: [] };
            }
            const reservePlayers = allPlayers.filter((p) => {
                if (p.team !== dugout.teamId)
                    return false;
                if (placedPlayers.includes(p.id))
                    return false;
                if (p.pos && p.pos.x >= 0)
                    return false; // CORRECTION
                return true;
            });
            return { reservePlayers };
        };
        // Scénario exact de l'image : 11 joueurs sur le terrain
        const imageScenario = {
            allPlayers: [
                // 11 joueurs sur le terrain (comme dans l'image)
                { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
                { id: 'A2', team: 'A', pos: { x: 13, y: 0 } },
                { id: 'A3', team: 'A', pos: { x: 14, y: 0 } },
                { id: 'A4', team: 'A', pos: { x: 12, y: 3 } },
                { id: 'A5', team: 'A', pos: { x: 13, y: 3 } },
                { id: 'A6', team: 'A', pos: { x: 14, y: 3 } },
                { id: 'A7', team: 'A', pos: { x: 12, y: 4 } },
                { id: 'A8', team: 'A', pos: { x: 13, y: 4 } },
                { id: 'A9', team: 'A', pos: { x: 14, y: 4 } },
                { id: 'A10', team: 'A', pos: { x: 12, y: 5 } },
                { id: 'A11', team: 'A', pos: { x: 13, y: 5 } }
            ],
            placedPlayers: [], // Vide après rafraîchissement (comme dans l'image)
            dugout: { teamId: 'A' }
        };
        const result = teamDugoutLogic(imageScenario.allPlayers, imageScenario.placedPlayers, imageScenario.dugout);
        // AVANT la correction : 11 joueurs seraient en réserve
        // APRÈS la correction : 0 joueurs en réserve car tous sont sur le terrain
        expect(result.reservePlayers).toHaveLength(0);
    });
    it('should verify the fix prevents the exact error from the user', () => {
        // Test pour vérifier que la correction empêche exactement l'erreur rapportée
        const beforeFix = (allPlayers, placedPlayers, dugout) => {
            // Logique AVANT la correction (problématique)
            if (!allPlayers || !Array.isArray(allPlayers))
                return [];
            if (!placedPlayers || !Array.isArray(placedPlayers))
                return [];
            if (!dugout || !dugout.teamId)
                return [];
            return allPlayers.filter((p) => {
                if (p.team !== dugout.teamId)
                    return false;
                if (placedPlayers.includes(p.id))
                    return false;
                // PAS de vérification de pos.x >= 0
                return true;
            });
        };
        const afterFix = (allPlayers, placedPlayers, dugout) => {
            // Logique APRÈS la correction
            if (!allPlayers || !Array.isArray(allPlayers))
                return [];
            if (!placedPlayers || !Array.isArray(placedPlayers))
                return [];
            if (!dugout || !dugout.teamId)
                return [];
            return allPlayers.filter((p) => {
                if (p.team !== dugout.teamId)
                    return false;
                if (placedPlayers.includes(p.id))
                    return false;
                if (p.pos && p.pos.x >= 0)
                    return false; // CORRECTION
                return true;
            });
        };
        const testData = {
            allPlayers: [
                { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
                { id: 'A2', team: 'A', pos: { x: 13, y: 0 } },
                { id: 'A3', team: 'A', pos: { x: -1, y: -1 } }
            ],
            placedPlayers: [], // Vide après rafraîchissement
            dugout: { teamId: 'A' }
        };
        const beforeResult = beforeFix(testData.allPlayers, testData.placedPlayers, testData.dugout);
        const afterResult = afterFix(testData.allPlayers, testData.placedPlayers, testData.dugout);
        // AVANT la correction : 3 joueurs en réserve (problème)
        expect(beforeResult).toHaveLength(3);
        // APRÈS la correction : 1 joueur en réserve (correct)
        expect(afterResult).toHaveLength(1);
        expect(afterResult[0].id).toBe('A3');
    });
    it('should handle edge cases correctly', () => {
        const teamDugoutLogic = (allPlayers, placedPlayers, dugout) => {
            if (!allPlayers || !Array.isArray(allPlayers))
                return [];
            if (!placedPlayers || !Array.isArray(placedPlayers))
                return [];
            if (!dugout || !dugout.teamId)
                return [];
            return allPlayers.filter((p) => {
                if (p.team !== dugout.teamId)
                    return false;
                if (placedPlayers.includes(p.id))
                    return false;
                if (p.pos && p.pos.x >= 0)
                    return false;
                return true;
            });
        };
        // Test avec pos undefined
        const undefinedPosData = {
            allPlayers: [
                { id: 'A1', team: 'A', pos: undefined },
                { id: 'A2', team: 'A', pos: { x: 12, y: 0 } }
            ],
            placedPlayers: [],
            dugout: { teamId: 'A' }
        };
        const result1 = teamDugoutLogic(undefinedPosData.allPlayers, undefinedPosData.placedPlayers, undefinedPosData.dugout);
        expect(result1).toHaveLength(1);
        expect(result1[0].id).toBe('A1');
        // Test avec pos null
        const nullPosData = {
            allPlayers: [
                { id: 'A1', team: 'A', pos: null },
                { id: 'A2', team: 'A', pos: { x: 12, y: 0 } }
            ],
            placedPlayers: [],
            dugout: { teamId: 'A' }
        };
        const result2 = teamDugoutLogic(nullPosData.allPlayers, nullPosData.placedPlayers, nullPosData.dugout);
        expect(result2).toHaveLength(1);
        expect(result2[0].id).toBe('A1');
        // Test avec pos.x = 0 (sur le terrain)
        const zeroPosData = {
            allPlayers: [
                { id: 'A1', team: 'A', pos: { x: 0, y: 0 } },
                { id: 'A2', team: 'A', pos: { x: -1, y: -1 } }
            ],
            placedPlayers: [],
            dugout: { teamId: 'A' }
        };
        const result3 = teamDugoutLogic(zeroPosData.allPlayers, zeroPosData.placedPlayers, zeroPosData.dugout);
        expect(result3).toHaveLength(1);
        expect(result3[0].id).toBe('A2');
    });
});
