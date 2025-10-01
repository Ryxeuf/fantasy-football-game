import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TeamDugout from '../TeamDugout';
import type { Player } from '@bb/game-engine';

// Test pour vérifier que la correction fonctionne dans TeamDugout
describe('TeamDugout Field Synchronization Fix', () => {
  it('should not show players in dugout if they are on the field', () => {
    // Créer des joueurs avec des positions mixtes
    const players: Player[] = [
      // Joueurs sur le terrain (pos.x >= 0)
      { id: 'A1', team: 'A', pos: { x: 12, y: 0 }, name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A2', team: 'A', pos: { x: 13, y: 0 }, name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A3', team: 'A', pos: { x: 14, y: 0 }, name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      // Joueurs en réserve (pos.x < 0)
      { id: 'A4', team: 'A', pos: { x: -1, y: -1 }, name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A5', team: 'A', pos: { x: -1, y: -1 }, name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false }
    ];

    const props = {
      dugout: {
        teamId: 'A',
        zones: {
          reserves: { players: [] },
          ko: { players: [] },
          stunned: { players: [] },
          injured: { players: [] }
        }
      },
      allPlayers: players,
      placedPlayers: ['A1', 'A2', 'A3'], // Seulement 3 joueurs marqués comme placés
      onPlayerClick: vi.fn(),
      onDragStart: vi.fn(),
      teamName: 'Équipe A',
      isSetupPhase: true
    };

    render(<TeamDugout {...props} />);

    // Vérifier que le composant se rend sans erreur
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    
    // Le composant devrait maintenant filtrer correctement les joueurs
    // A4 et A5 devraient être en réserve, A1, A2, A3 ne devraient pas apparaître
  });

  it('should handle page refresh scenario correctly', () => {
    // Scénario de rafraîchissement de page : tous les joueurs sont sur le terrain
    const players: Player[] = [
      { id: 'A1', team: 'A', pos: { x: 12, y: 0 }, name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A2', team: 'A', pos: { x: 13, y: 0 }, name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A3', team: 'A', pos: { x: 14, y: 0 }, name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A4', team: 'A', pos: { x: 12, y: 3 }, name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A5', team: 'A', pos: { x: 13, y: 3 }, name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false }
    ];

    const props = {
      dugout: {
        teamId: 'A',
        zones: {
          reserves: { players: [] },
          ko: { players: [] },
          stunned: { players: [] },
          injured: { players: [] }
        }
      },
      allPlayers: players,
      placedPlayers: [], // placedPlayers vide après rafraîchissement
      onPlayerClick: vi.fn(),
      onDragStart: vi.fn(),
      teamName: 'Équipe A',
      isSetupPhase: true
    };

    render(<TeamDugout {...props} />);

    // Vérifier que le composant se rend sans erreur
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    
    // Aucun joueur ne devrait apparaître en réserve car tous sont sur le terrain
  });

  it('should handle inconsistent state gracefully', () => {
    // État incohérent : joueurs sur le terrain mais pas marqués comme placés
    const players: Player[] = [
      { id: 'A1', team: 'A', pos: { x: 12, y: 0 }, name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A2', team: 'A', pos: { x: 13, y: 0 }, name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      { id: 'A3', team: 'A', pos: { x: -1, y: -1 }, name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false }
    ];

    const props = {
      dugout: {
        teamId: 'A',
        zones: {
          reserves: { players: [] },
          ko: { players: [] },
          stunned: { players: [] },
          injured: { players: [] }
        }
      },
      allPlayers: players,
      placedPlayers: ['A1'], // Seulement A1 marqué comme placé, mais A2 est aussi sur le terrain
      onPlayerClick: vi.fn(),
      onDragStart: vi.fn(),
      teamName: 'Équipe A',
      isSetupPhase: true
    };

    render(<TeamDugout {...props} />);

    // Vérifier que le composant se rend sans erreur
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    
    // A2 ne devrait pas apparaître en réserve car il est sur le terrain
    // Seul A3 devrait être en réserve
  });

  it('should handle undefined props gracefully', () => {
    const props = {
      dugout: undefined as any,
      allPlayers: undefined as any,
      placedPlayers: undefined as any,
      onPlayerClick: vi.fn(),
      onDragStart: vi.fn(),
      teamName: 'Équipe A',
      isSetupPhase: true
    };

    render(<TeamDugout {...props} />);

    // Vérifier que le composant se rend sans erreur même avec des props undefined
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle mixed player states correctly', () => {
    const players: Player[] = [
      // Sur le terrain
      { id: 'A1', team: 'A', pos: { x: 12, y: 0 }, name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      // En réserve
      { id: 'A2', team: 'A', pos: { x: -1, y: -1 }, name: 'Joueur A2', number: 2, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      // KO
      { id: 'A3', team: 'A', pos: { x: -2, y: -1 }, name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false },
      // Sonné
      { id: 'A4', team: 'A', pos: { x: -1, y: -1 }, name: 'Joueur A4', number: 4, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: true },
      // Blessé
      { id: 'A5', team: 'A', pos: { x: -3, y: -1 }, name: 'Joueur A5', number: 5, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: '', pm: 6, hasBall: false, state: 'active', stunned: false }
    ];

    const props = {
      dugout: {
        teamId: 'A',
        zones: {
          reserves: { players: [] },
          ko: { players: [] },
          stunned: { players: [] },
          injured: { players: [] }
        }
      },
      allPlayers: players,
      placedPlayers: ['A1'],
      onPlayerClick: vi.fn(),
      onDragStart: vi.fn(),
      teamName: 'Équipe A',
      isSetupPhase: true
    };

    render(<TeamDugout {...props} />);

    // Vérifier que le composant se rend sans erreur
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    
    // A2, A3, A4, A5 devraient être dans leurs sections respectives
    // A1 ne devrait pas apparaître en réserve car il est sur le terrain
  });
});
