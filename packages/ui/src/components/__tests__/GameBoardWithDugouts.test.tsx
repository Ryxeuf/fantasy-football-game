import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import GameBoardWithDugouts from '../GameBoardWithDugouts';
import type { ExtendedGameState } from '@bb/game-engine';

// Helper pour créer un état de jeu étendu minimal
const createExtendedGameState = (overrides: Partial<ExtendedGameState> = {}): ExtendedGameState => ({
  players: [],
  currentPlayer: 'A',
  selectedPlayerId: null,
  isTurnover: false,
  half: 1,
  turn: 1,
  teamNames: {
    teamA: 'Équipe A',
    teamB: 'Équipe B'
  },
  score: {
    teamA: 0,
    teamB: 0
  },
  gameLog: [],
  ball: null,
  lastDiceResult: undefined,
  playerActions: new Map(),
  teamBlitzCount: new Map(),
  dugouts: {
    teamA: {
      zones: {
        reserves: { players: [] },
        ko: { players: [] },
        stunned: { players: [] },
        injured: { players: [] }
      }
    },
    teamB: {
      zones: {
        reserves: { players: [] },
        ko: { players: [] },
        stunned: { players: [] },
        injured: { players: [] }
      }
    }
  },
  preMatch: {
    phase: 'idle',
    currentCoach: 'A',
    receivingTeam: 'A',
    kickingTeam: 'B',
    legalSetupPositions: [],
    placedPlayers: []
  },
  ...overrides
});

describe('GameBoardWithDugouts', () => {
  const defaultProps = {
    state: createExtendedGameState(),
    placedPlayers: [],
    onPlayerClick: vi.fn(),
    onDragStart: vi.fn(),
    onCellClick: vi.fn(),
    isSetupPhase: false,
    selectedForRepositioning: null
  };

  it('should render without crashing with minimal state', () => {
    render(<GameBoardWithDugouts {...defaultProps} />);
    
    // Le composant devrait rendre sans erreur
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle undefined dugouts gracefully', () => {
    const state = createExtendedGameState({ dugouts: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle null dugouts gracefully', () => {
    const state = createExtendedGameState({ dugouts: null as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle undefined teamNames gracefully', () => {
    const state = createExtendedGameState({ teamNames: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle null teamNames gracefully', () => {
    const state = createExtendedGameState({ teamNames: null as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle undefined players gracefully', () => {
    const state = createExtendedGameState({ players: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle partial dugouts', () => {
    const state = createExtendedGameState({
      dugouts: {
        teamA: {
          zones: {
            reserves: { players: [] },
            ko: { players: [] },
            stunned: { players: [] },
            injured: { players: [] }
          }
        },
        teamB: undefined as any
      }
    });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle partial teamNames', () => {
    const state = createExtendedGameState({
      teamNames: {
        teamA: 'Équipe A',
        teamB: undefined as any
      }
    });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle completely undefined state gracefully', () => {
    const state = undefined as any;
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);
    
    // Le composant ne devrait pas planter même avec un état complètement undefined
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle setup phase correctly', () => {
    render(<GameBoardWithDugouts {...defaultProps} isSetupPhase={true} />);
    
    // Le composant devrait rendre sans erreur en phase setup
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle selectedForRepositioning', () => {
    render(<GameBoardWithDugouts {...defaultProps} selectedForRepositioning="A1" />);
    
    // Le composant devrait rendre sans erreur avec un joueur sélectionné
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle callbacks correctly', () => {
    const mockOnPlayerClick = vi.fn();
    const mockOnDragStart = vi.fn();
    const mockOnCellClick = vi.fn();
    
    render(
      <GameBoardWithDugouts 
        {...defaultProps} 
        onPlayerClick={mockOnPlayerClick}
        onDragStart={mockOnDragStart}
        onCellClick={mockOnCellClick}
      />
    );
    
    // Le composant devrait rendre sans erreur avec les callbacks
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle placedPlayers array', () => {
    const placedPlayers = ['A1', 'A2', 'B1'];
    render(<GameBoardWithDugouts {...defaultProps} placedPlayers={placedPlayers} />);
    
    // Le composant devrait rendre sans erreur avec des joueurs placés
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle empty placedPlayers array', () => {
    render(<GameBoardWithDugouts {...defaultProps} placedPlayers={[]} />);
    
    // Le composant devrait rendre sans erreur avec un tableau vide
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });
});



