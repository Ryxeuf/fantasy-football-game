import { describe, it, expect } from 'vitest';

// Test spécifique pour corriger le problème des joueurs qui apparaissent sur le terrain ET dans le dugout
describe('Dugout Field Synchronization Fix', () => {
  it('should not show players in dugout if they are on the field', () => {
    // Simuler la logique corrigée de TeamDugout
    
    const getReservePlayers = (allPlayers: any[], placedPlayers: string[], teamId: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return [];
      }
      
      if (!placedPlayers || !Array.isArray(placedPlayers)) {
        return [];
      }
      
      return allPlayers.filter((p) => {
        // Vérifier que le joueur appartient à l'équipe
        if (p.team !== teamId) {
          return false;
        }
        
        // Vérifier que le joueur n'est pas marqué comme placé
        if (placedPlayers.includes(p.id)) {
          return false;
        }
        
        // Vérifier que le joueur n'est pas sur le terrain (pos.x >= 0)
        if (p.pos && p.pos.x >= 0) {
          return false;
        }
        
        return true;
      });
    };
    
    // Cas problématique : joueurs sur le terrain mais aussi dans le dugout
    const problematicState = {
      allPlayers: [
        // Joueurs sur le terrain (pos.x >= 0)
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
        { id: 'A11', team: 'A', pos: { x: 13, y: 5 } },
        // Joueurs en réserve (pos.x < 0)
        { id: 'A12', team: 'A', pos: { x: -1, y: -1 } },
        { id: 'A13', team: 'A', pos: { x: -1, y: -1 } }
      ],
      placedPlayers: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11']
    };
    
    const reservePlayers = getReservePlayers(
      problematicState.allPlayers,
      problematicState.placedPlayers,
      'A'
    );
    
    // Vérifier que seuls les joueurs vraiment en réserve sont affichés
    expect(reservePlayers).toHaveLength(2);
    expect(reservePlayers.map(p => p.id)).toEqual(['A12', 'A13']);
    
    // Vérifier qu'aucun joueur sur le terrain n'apparaît en réserve
    const playersOnField = reservePlayers.filter(p => p.pos && p.pos.x >= 0);
    expect(playersOnField).toHaveLength(0);
  });

  it('should handle inconsistent placedPlayers state', () => {
    const getReservePlayers = (allPlayers: any[], placedPlayers: string[], teamId: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return [];
      }
      
      if (!placedPlayers || !Array.isArray(placedPlayers)) {
        return [];
      }
      
      return allPlayers.filter((p) => {
        if (p.team !== teamId) {
          return false;
        }
        
        if (placedPlayers.includes(p.id)) {
          return false;
        }
        
        if (p.pos && p.pos.x >= 0) {
          return false;
        }
        
        return true;
      });
    };
    
    // Cas où placedPlayers est incohérent avec les positions réelles
    const inconsistentState = {
      allPlayers: [
        { id: 'A1', team: 'A', pos: { x: 12, y: 0 } }, // Sur le terrain
        { id: 'A2', team: 'A', pos: { x: 13, y: 0 } }, // Sur le terrain
        { id: 'A3', team: 'A', pos: { x: -1, y: -1 } } // En réserve
      ],
      placedPlayers: ['A1'] // Seulement A1 marqué comme placé, mais A2 est aussi sur le terrain
    };
    
    const reservePlayers = getReservePlayers(
      inconsistentState.allPlayers,
      inconsistentState.placedPlayers,
      'A'
    );
    
    // A2 ne devrait pas apparaître en réserve car il est sur le terrain
    expect(reservePlayers).toHaveLength(1);
    expect(reservePlayers[0].id).toBe('A3');
  });

  it('should handle page refresh scenario', () => {
    const getReservePlayers = (allPlayers: any[], placedPlayers: string[], teamId: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return [];
      }
      
      if (!placedPlayers || !Array.isArray(placedPlayers)) {
        return [];
      }
      
      return allPlayers.filter((p) => {
        if (p.team !== teamId) {
          return false;
        }
        
        if (placedPlayers.includes(p.id)) {
          return false;
        }
        
        if (p.pos && p.pos.x >= 0) {
          return false;
        }
        
        return true;
      });
    };
    
    // Scénario de rafraîchissement de page : état du serveur vs état local
    const pageRefreshState = {
      allPlayers: [
        // Tous les joueurs sont sur le terrain selon l'état du serveur
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
      placedPlayers: [] // placedPlayers vide après rafraîchissement
    };
    
    const reservePlayers = getReservePlayers(
      pageRefreshState.allPlayers,
      pageRefreshState.placedPlayers,
      'A'
    );
    
    // Aucun joueur ne devrait apparaître en réserve car tous sont sur le terrain
    expect(reservePlayers).toHaveLength(0);
  });

  it('should handle mixed player states correctly', () => {
    const getReservePlayers = (allPlayers: any[], placedPlayers: string[], teamId: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return [];
      }
      
      if (!placedPlayers || !Array.isArray(placedPlayers)) {
        return [];
      }
      
      return allPlayers.filter((p) => {
        if (p.team !== teamId) {
          return false;
        }
        
        if (placedPlayers.includes(p.id)) {
          return false;
        }
        
        if (p.pos && p.pos.x >= 0) {
          return false;
        }
        
        return true;
      });
    };
    
    // État mixte : joueurs sur le terrain, en réserve, KO, sonnés
    const mixedState = {
      allPlayers: [
        // Sur le terrain
        { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
        { id: 'A2', team: 'A', pos: { x: 13, y: 0 } },
        // En réserve
        { id: 'A3', team: 'A', pos: { x: -1, y: -1 } },
        // KO
        { id: 'A4', team: 'A', pos: { x: -2, y: -1 } },
        // Sonné
        { id: 'A5', team: 'A', pos: { x: -1, y: -1 }, stunned: true },
        // Blessé
        { id: 'A6', team: 'A', pos: { x: -3, y: -1 } }
      ],
      placedPlayers: ['A1', 'A2']
    };
    
    const reservePlayers = getReservePlayers(
      mixedState.allPlayers,
      mixedState.placedPlayers,
      'A'
    );
    
    // A3, A4, A5, A6 devraient être en réserve car ils ne sont pas sur le terrain
    expect(reservePlayers).toHaveLength(4);
    expect(reservePlayers.map(p => p.id)).toEqual(['A3', 'A4', 'A5', 'A6']);
  });

  it('should verify the fix works with undefined pos', () => {
    const getReservePlayers = (allPlayers: any[], placedPlayers: string[], teamId: string) => {
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return [];
      }
      
      if (!placedPlayers || !Array.isArray(placedPlayers)) {
        return [];
      }
      
      return allPlayers.filter((p) => {
        if (p.team !== teamId) {
          return false;
        }
        
        if (placedPlayers.includes(p.id)) {
          return false;
        }
        
        if (p.pos && p.pos.x >= 0) {
          return false;
        }
        
        return true;
      });
    };
    
    // Test avec pos undefined
    const undefinedPosState = {
      allPlayers: [
        { id: 'A1', team: 'A', pos: undefined as any },
        { id: 'A2', team: 'A', pos: { x: 12, y: 0 } }
      ],
      placedPlayers: ['A2']
    };
    
    const reservePlayers = getReservePlayers(
      undefinedPosState.allPlayers,
      undefinedPosState.placedPlayers,
      'A'
    );
    
    // A1 devrait être en réserve car pos est undefined (donc pas sur le terrain)
    expect(reservePlayers).toHaveLength(1);
    expect(reservePlayers[0].id).toBe('A1');
  });
});
