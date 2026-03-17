import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import GameBoardWithDugouts from '../GameBoardWithDugouts';
import type { GameState } from '@bb/game-engine';

// Mock PixiBoard to avoid WebGL renderer issues in jsdom
vi.mock('../../board/PixiBoard', () => ({
  default: () => <div data-testid="pixi-board">MockPixiBoard</div>,
}));

// Helper pour créer un état de jeu minimal compatible avec GameState
const createMinimalGameState = (overrides: Partial<GameState> = {}): GameState => ({
  width: 26,
  height: 15,
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
  playerActions: {},
  teamBlitzCount: {},
  teamFoulCount: {},
  gamePhase: 'playing',
  teamRerolls: { teamA: 0, teamB: 0 },
  rerollUsedThisTurn: false,
  matchStats: {},
  dugouts: {
    teamA: {
      teamId: 'A',
      zones: {
        reserves: { id: 'res-a', name: 'Reserves', color: 'green', icon: 'R', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
        stunned: { id: 'stu-a', name: 'Stunned', color: 'yellow', icon: 'S', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
        knockedOut: { id: 'ko-a', name: 'KO', color: 'orange', icon: 'K', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
        casualty: { id: 'cas-a', name: 'Casualty', color: 'red', icon: 'C', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
        sentOff: { id: 'so-a', name: 'Sent Off', color: 'black', icon: 'X', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
      }
    },
    teamB: {
      teamId: 'B',
      zones: {
        reserves: { id: 'res-b', name: 'Reserves', color: 'green', icon: 'R', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
        stunned: { id: 'stu-b', name: 'Stunned', color: 'yellow', icon: 'S', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
        knockedOut: { id: 'ko-b', name: 'KO', color: 'orange', icon: 'K', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
        casualty: { id: 'cas-b', name: 'Casualty', color: 'red', icon: 'C', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
        sentOff: { id: 'so-b', name: 'Sent Off', color: 'black', icon: 'X', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
      }
    }
  },
  ...overrides
} as GameState);

describe('GameBoardWithDugouts', () => {
  const defaultProps = {
    state: createMinimalGameState(),
    placedPlayers: [],
    onPlayerClick: vi.fn(),
    onDragStart: vi.fn(),
    onCellClick: vi.fn(),
    isSetupPhase: false,
    selectedForRepositioning: null
  };

  it('should render without crashing with minimal state', () => {
    render(<GameBoardWithDugouts {...defaultProps} />);

    // Team names appear in toggle buttons and TeamDugout components
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle undefined dugouts gracefully', () => {
    const state = createMinimalGameState({ dugouts: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Toggle buttons still show team names from teamNames
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle null dugouts gracefully', () => {
    const state = createMinimalGameState({ dugouts: null as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Toggle buttons still show team names from teamNames
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle undefined teamNames gracefully', () => {
    const state = createMinimalGameState({ teamNames: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Fallback team names (without accents) from toggle buttons and TeamDugout
    expect(screen.getAllByText('Equipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Equipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle null teamNames gracefully', () => {
    const state = createMinimalGameState({ teamNames: null as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Fallback team names (without accents) from toggle buttons and TeamDugout
    expect(screen.getAllByText('Equipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Equipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle undefined players gracefully', () => {
    const state = createMinimalGameState({ players: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle partial dugouts', () => {
    const state = createMinimalGameState({
      dugouts: {
        teamA: {
          teamId: 'A',
          zones: {
            reserves: { id: 'res-a', name: 'Reserves', color: 'green', icon: 'R', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
            stunned: { id: 'stu-a', name: 'Stunned', color: 'yellow', icon: 'S', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
            knockedOut: { id: 'ko-a', name: 'KO', color: 'orange', icon: 'K', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
            casualty: { id: 'cas-a', name: 'Casualty', color: 'red', icon: 'C', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
            sentOff: { id: 'so-a', name: 'Sent Off', color: 'black', icon: 'X', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 1, height: 1 } },
          }
        },
        teamB: undefined as any
      }
    } as any);
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle partial teamNames', () => {
    const state = createMinimalGameState({
      teamNames: {
        teamA: 'Équipe A',
        teamB: undefined as any
      }
    });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    // teamB falls back to "Equipe B" (without accent) in toggle buttons
    expect(screen.getAllByText('Equipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle completely undefined state gracefully', () => {
    const state = undefined as any;
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Quand state est undefined, le composant affiche un message de chargement
    expect(screen.getByText('Chargement du terrain...')).toBeInTheDocument();
  });

  it('should handle setup phase correctly', () => {
    render(<GameBoardWithDugouts {...defaultProps} isSetupPhase={true} />);

    // Le composant devrait rendre sans erreur en phase setup
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle selectedForRepositioning', () => {
    render(<GameBoardWithDugouts {...defaultProps} selectedForRepositioning="A1" />);

    // Le composant devrait rendre sans erreur avec un joueur sélectionné
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle placedPlayers array', () => {
    const placedPlayers = ['A1', 'A2', 'B1'];
    render(<GameBoardWithDugouts {...defaultProps} placedPlayers={placedPlayers} />);

    // Le composant devrait rendre sans erreur avec des joueurs placés
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty placedPlayers array', () => {
    render(<GameBoardWithDugouts {...defaultProps} placedPlayers={[]} />);

    // Le composant devrait rendre sans erreur avec un tableau vide
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });
});
