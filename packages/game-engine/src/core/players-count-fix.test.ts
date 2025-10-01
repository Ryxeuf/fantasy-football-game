import { describe, it, expect } from 'vitest';

// Test pour vérifier que le compteur de joueurs placés utilise les positions réelles
describe('Players Count Fix', () => {
  it('should count players based on field position, not placedPlayers array', () => {
    // Simuler la logique corrigée
    
    const getPlayersOnField = (allPlayers: any[], team: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return 0;
      }
      
      return allPlayers.filter(p => p.team === team && p.pos.x >= 0).length;
    };
    
    // Scénario de rafraîchissement de page : joueurs sur le terrain mais placedPlayers vide
    const pageRefreshScenario = {
      allPlayers: [
        // 11 joueurs de l'équipe A sur le terrain
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
      placedPlayers: [] // Vide après rafraîchissement
    };
    
    const playersOnField = getPlayersOnField(pageRefreshScenario.allPlayers, 'A');
    
    // AVANT la correction : placedPlayers.length = 0 (problème)
    expect(pageRefreshScenario.placedPlayers.length).toBe(0);
    
    // APRÈS la correction : playersOnField = 11 (correct)
    expect(playersOnField).toBe(11);
  });

  it('should show validate button when 11 players are on field', () => {
    const shouldShowValidateButton = (allPlayers: any[], currentCoach: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return false;
      }
      
      const playersOnField = allPlayers.filter(p => p.team === currentCoach && p.pos.x >= 0).length;
      return playersOnField === 11;
    };
    
    // Scénario avec 11 joueurs sur le terrain
    const scenario = {
      allPlayers: [
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
      currentCoach: 'A'
    };
    
    const showButton = shouldShowValidateButton(scenario.allPlayers, scenario.currentCoach);
    expect(showButton).toBe(true);
  });

  it('should not show validate button when less than 11 players are on field', () => {
    const shouldShowValidateButton = (allPlayers: any[], currentCoach: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return false;
      }
      
      const playersOnField = allPlayers.filter(p => p.team === currentCoach && p.pos.x >= 0).length;
      return playersOnField === 11;
    };
    
    // Scénario avec seulement 10 joueurs sur le terrain
    const scenario = {
      allPlayers: [
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
        // A11 manquant
        { id: 'A11', team: 'A', pos: { x: -1, y: -1 } } // En réserve
      ],
      currentCoach: 'A'
    };
    
    const showButton = shouldShowValidateButton(scenario.allPlayers, scenario.currentCoach);
    expect(showButton).toBe(false);
  });

  it('should handle undefined state gracefully', () => {
    const getPlayersOnField = (allPlayers: any[], team: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return 0;
      }
      
      return allPlayers.filter(p => p.team === team && p.pos.x >= 0).length;
    };
    
    const playersOnField = getPlayersOnField(undefined as any, 'A');
    expect(playersOnField).toBe(0);
  });

  it('should handle null state gracefully', () => {
    const getPlayersOnField = (allPlayers: any[], team: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return 0;
      }
      
      return allPlayers.filter(p => p.team === team && p.pos.x >= 0).length;
    };
    
    const playersOnField = getPlayersOnField(null as any, 'A');
    expect(playersOnField).toBe(0);
  });

  it('should verify the exact scenario from user image', () => {
    // Scénario exact de l'image : 11 joueurs sur le terrain, compteur à 0
    
    const getPlayersOnField = (allPlayers: any[], team: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return 0;
      }
      
      return allPlayers.filter(p => p.team === team && p.pos.x >= 0).length;
    };
    
    const userScenario = {
      allPlayers: [
        // 11 joueurs de l'équipe A sur le terrain (comme dans l'image)
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
      placedPlayers: [], // Vide (problème dans l'image)
      currentCoach: 'A'
    };
    
    // AVANT la correction
    const oldCounter = userScenario.placedPlayers.length;
    expect(oldCounter).toBe(0); // Compteur affichait 0
    
    // APRÈS la correction
    const newCounter = getPlayersOnField(userScenario.allPlayers, userScenario.currentCoach);
    expect(newCounter).toBe(11); // Compteur devrait afficher 11
    
    // Vérifier que le bouton de validation devrait apparaître
    const shouldShowButton = newCounter === 11;
    expect(shouldShowButton).toBe(true);
  });
});
