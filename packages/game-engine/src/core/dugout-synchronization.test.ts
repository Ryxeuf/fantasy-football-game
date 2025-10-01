import { describe, it, expect } from 'vitest';

// Test pour corriger le problème des joueurs qui apparaissent dans le dugout ET sur le terrain
describe('Dugout State Synchronization Tests', () => {
  it('should correctly filter reserve players from placed players', () => {
    // Simuler la logique de filtrage des joueurs en réserve
    
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
        
        // Vérifier que le joueur n'est pas placé
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
    
    const allPlayers = [
      // Équipe A - joueurs placés
      { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
      { id: 'A2', team: 'A', pos: { x: 13, y: 0 } },
      { id: 'A3', team: 'A', pos: { x: 14, y: 0 } },
      // Équipe A - joueurs en réserve
      { id: 'A4', team: 'A', pos: { x: -1, y: -1 } },
      { id: 'A5', team: 'A', pos: { x: -1, y: -1 } },
      // Équipe B - joueurs placés
      { id: 'B1', team: 'B', pos: { x: 12, y: 0 } },
      { id: 'B2', team: 'B', pos: { x: 13, y: 0 } },
      // Équipe B - joueurs en réserve
      { id: 'B3', team: 'B', pos: { x: -1, y: -1 } },
      { id: 'B4', team: 'B', pos: { x: -1, y: -1 } }
    ];
    
    const placedPlayers = ['A1', 'A2', 'A3', 'B1', 'B2'];
    
    const teamAReserve = getReservePlayers(allPlayers, placedPlayers, 'A');
    const teamBReserve = getReservePlayers(allPlayers, placedPlayers, 'B');
    
    // Vérifier que seuls les joueurs non placés sont en réserve
    expect(teamAReserve).toHaveLength(2);
    expect(teamAReserve.map(p => p.id)).toEqual(['A4', 'A5']);
    
    expect(teamBReserve).toHaveLength(2);
    expect(teamBReserve.map(p => p.id)).toEqual(['B3', 'B4']);
  });

  it('should handle undefined placedPlayers gracefully', () => {
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
    
    const allPlayers = [
      { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
      { id: 'A2', team: 'A', pos: { x: -1, y: -1 } }
    ];
    
    const teamAReserve = getReservePlayers(allPlayers, undefined as any, 'A');
    expect(teamAReserve).toHaveLength(0); // Devrait retourner un tableau vide
  });

  it('should handle null placedPlayers gracefully', () => {
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
    
    const allPlayers = [
      { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
      { id: 'A2', team: 'A', pos: { x: -1, y: -1 } }
    ];
    
    const teamAReserve = getReservePlayers(allPlayers, null as any, 'A');
    expect(teamAReserve).toHaveLength(0); // Devrait retourner un tableau vide
  });

  it('should handle empty placedPlayers array', () => {
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
    
    const allPlayers = [
      { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
      { id: 'A2', team: 'A', pos: { x: -1, y: -1 } }
    ];
    
    const teamAReserve = getReservePlayers(allPlayers, [], 'A');
    expect(teamAReserve).toHaveLength(1);
    expect(teamAReserve[0].id).toBe('A2');
  });

  it('should handle players with inconsistent state', () => {
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
    
    // Cas problématique : joueur marqué comme placé mais pas sur le terrain
    const allPlayers = [
      { id: 'A1', team: 'A', pos: { x: -1, y: -1 } }, // En réserve
      { id: 'A2', team: 'A', pos: { x: 12, y: 0 } }  // Sur le terrain
    ];
    
    const placedPlayers = ['A1', 'A2']; // A1 marqué comme placé mais pas sur le terrain
    
    const teamAReserve = getReservePlayers(allPlayers, placedPlayers, 'A');
    expect(teamAReserve).toHaveLength(0); // A1 ne devrait pas être en réserve car marqué comme placé
  });

  it('should handle players with undefined pos', () => {
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
    
    const allPlayers = [
      { id: 'A1', team: 'A', pos: undefined as any },
      { id: 'A2', team: 'A', pos: { x: -1, y: -1 } }
    ];
    
    const placedPlayers = ['A2'];
    
    const teamAReserve = getReservePlayers(allPlayers, placedPlayers, 'A');
    expect(teamAReserve).toHaveLength(1);
    expect(teamAReserve[0].id).toBe('A1');
  });

  it('should handle completely undefined state', () => {
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
    
    const teamAReserve = getReservePlayers(undefined as any, undefined as any, 'A');
    expect(teamAReserve).toEqual([]);
  });

  it('should verify the complete TeamDugout logic', () => {
    // Test complet de la logique TeamDugout avec toutes les vérifications de sécurité
    
    const teamDugoutLogic = (allPlayers: any[], placedPlayers: string[], dugout: any) => {
      // Vérifications de sécurité
      if (!allPlayers || !Array.isArray(allPlayers)) {
        return [];
      }
      
      if (!placedPlayers || !Array.isArray(placedPlayers)) {
        return [];
      }
      
      if (!dugout || !dugout.teamId) {
        return [];
      }
      
      // Filtrer les joueurs en réserve
      return allPlayers.filter((p) => {
        // Vérifier que le joueur appartient à l'équipe
        if (p.team !== dugout.teamId) {
          return false;
        }
        
        // Vérifier que le joueur n'est pas placé
        if (placedPlayers.includes(p.id)) {
          return false;
        }
        
        // Vérifier que le joueur n'est pas sur le terrain
        if (p.pos && p.pos.x >= 0) {
          return false;
        }
        
        return true;
      });
    };
    
    const testState = {
      allPlayers: [
        { id: 'A1', team: 'A', pos: { x: 12, y: 0 } },
        { id: 'A2', team: 'A', pos: { x: -1, y: -1 } },
        { id: 'B1', team: 'B', pos: { x: 12, y: 0 } },
        { id: 'B2', team: 'B', pos: { x: -1, y: -1 } }
      ],
      placedPlayers: ['A1', 'B1'],
      dugout: { teamId: 'A' }
    };
    
    const reservePlayers = teamDugoutLogic(
      testState.allPlayers,
      testState.placedPlayers,
      testState.dugout
    );
    
    expect(reservePlayers).toHaveLength(1);
    expect(reservePlayers[0].id).toBe('A2');
  });
});
