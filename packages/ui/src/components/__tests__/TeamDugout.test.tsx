import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TeamDugout from '../TeamDugout';
import type { Player } from '@bb/game-engine';

// Helper pour créer des joueurs de test
const createTestPlayers = (team: string, count: number): Player[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${team}${i + 1}`,
    team,
    pos: { x: -1, y: -1 },
    name: `Joueur ${team}${i + 1}`,
    number: i + 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 3,
    av: 8,
    skills: '',
    pm: 6,
    hasBall: false,
    state: 'active',
    stunned: false
  }));
};

describe('TeamDugout Safety Tests', () => {
  const defaultProps = {
    dugout: {
      teamId: 'A',
      zones: {
        reserves: { players: [] },
        ko: { players: [] },
        stunned: { players: [] },
        injured: { players: [] }
      }
    },
    allPlayers: createTestPlayers('A', 11),
    placedPlayers: [],
    onPlayerClick: vi.fn(),
    onDragStart: vi.fn(),
    teamName: 'Équipe A',
    isSetupPhase: false
  };

  it('should render without crashing with minimal props', () => {
    render(<TeamDugout {...defaultProps} />);
    
    // Le composant devrait rendre sans erreur
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle undefined allPlayers gracefully', () => {
    const props = { ...defaultProps, allPlayers: undefined as any };
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle null allPlayers gracefully', () => {
    const props = { ...defaultProps, allPlayers: null as any };
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle empty allPlayers array', () => {
    const props = { ...defaultProps, allPlayers: [] };
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle undefined placedPlayers gracefully', () => {
    const props = { ...defaultProps, placedPlayers: undefined as any };
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle null placedPlayers gracefully', () => {
    const props = { ...defaultProps, placedPlayers: null as any };
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle undefined dugout gracefully', () => {
    const props = { ...defaultProps, dugout: undefined as any };
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle null dugout gracefully', () => {
    const props = { ...defaultProps, dugout: null as any };
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle partial dugout gracefully', () => {
    const props = {
      ...defaultProps,
      dugout: {
        teamId: 'A',
        zones: {
          reserves: { players: [] },
          ko: undefined as any,
          stunned: { players: [] },
          injured: undefined as any
        }
      }
    };
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle setup phase correctly', () => {
    const props = { ...defaultProps, isSetupPhase: true };
    render(<TeamDugout {...props} />);
    
    // Le composant devrait rendre sans erreur en phase setup
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle players with different states', () => {
    const players = [
      ...createTestPlayers('A', 5),
      ...createTestPlayers('A', 3).map(p => ({ ...p, pos: { x: -2, y: -1 } })), // KO
      ...createTestPlayers('A', 2).map(p => ({ ...p, stunned: true })), // Stunned
      ...createTestPlayers('A', 1).map(p => ({ ...p, pos: { x: -3, y: -1 } })) // Casualty
    ];
    
    const props = { ...defaultProps, allPlayers: players };
    render(<TeamDugout {...props} />);
    
    // Le composant devrait rendre sans erreur avec différents états de joueurs
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle callbacks correctly', () => {
    const mockOnPlayerClick = vi.fn();
    const mockOnDragStart = vi.fn();
    
    const props = {
      ...defaultProps,
      onPlayerClick: mockOnPlayerClick,
      onDragStart: mockOnDragStart
    };
    
    render(<TeamDugout {...props} />);
    
    // Le composant devrait rendre sans erreur avec les callbacks
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });

  it('should handle team B correctly', () => {
    const props = {
      ...defaultProps,
      dugout: {
        teamId: 'B',
        zones: {
          reserves: { players: [] },
          ko: { players: [] },
          stunned: { players: [] },
          injured: { players: [] }
        }
      },
      allPlayers: createTestPlayers('B', 11),
      teamName: 'Équipe B'
    };
    
    render(<TeamDugout {...props} />);
    
    // Le composant devrait rendre sans erreur pour l'équipe B
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle completely undefined props gracefully', () => {
    const props = {
      dugout: undefined as any,
      allPlayers: undefined as any,
      placedPlayers: undefined as any,
      onPlayerClick: undefined as any,
      onDragStart: undefined as any,
      teamName: undefined as any,
      isSetupPhase: undefined as any
    };
    
    render(<TeamDugout {...props} />);
    
    // Le composant ne devrait pas planter même avec des props complètement undefined
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
  });
});
