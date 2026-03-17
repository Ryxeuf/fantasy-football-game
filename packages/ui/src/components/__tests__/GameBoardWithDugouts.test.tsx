import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { ExtendedGameState } from '@bb/game-engine';

// Mock PixiBoard to avoid WebGL renderer issues in jsdom
vi.mock('../../board/PixiBoard', () => ({
  default: () => <div data-testid="mock-pixi-board">Mock Board</div>,
}));

import GameBoardWithDugouts from '../GameBoardWithDugouts';

// Helper pour créer un dugout zone minimal
const createDugoutZone = (overrides = {}) => ({
  id: '',
  name: '',
  color: '',
  icon: '',
  maxCapacity: 16,
  players: [],
  position: { x: 0, y: 0, width: 0, height: 0 },
  ...overrides,
});

// Helper pour créer un TeamDugout minimal
const createTeamDugout = (teamId: 'A' | 'B') => ({
  teamId,
  zones: {
    reserves: createDugoutZone({ id: `${teamId}-reserves`, name: 'Reserves' }),
    stunned: createDugoutZone({ id: `${teamId}-stunned`, name: 'Stunned' }),
    knockedOut: createDugoutZone({ id: `${teamId}-ko`, name: 'KO' }),
    casualty: createDugoutZone({ id: `${teamId}-casualty`, name: 'Casualty' }),
    sentOff: createDugoutZone({ id: `${teamId}-sentoff`, name: 'Sent Off' }),
  },
});

// Helper pour créer un état de jeu étendu minimal
const createExtendedGameState = (overrides: Partial<ExtendedGameState> = {}): ExtendedGameState => ({
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
  ball: undefined,
  lastDiceResult: undefined,
  playerActions: {},
  teamBlitzCount: {},
  teamFoulCount: {},
  gamePhase: 'playing',
  teamRerolls: { teamA: 3, teamB: 3 },
  rerollUsedThisTurn: false,
  matchStats: {},
  dugouts: {
    teamA: createTeamDugout('A'),
    teamB: createTeamDugout('B'),
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
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle undefined dugouts gracefully', () => {
    const state = createExtendedGameState({ dugouts: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle null dugouts gracefully', () => {
    const state = createExtendedGameState({ dugouts: null as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle undefined teamNames gracefully', () => {
    const state = createExtendedGameState({ teamNames: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter - fallback uses "Equipe" without accent
    expect(screen.getAllByText('Equipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Equipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle null teamNames gracefully', () => {
    const state = createExtendedGameState({ teamNames: null as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter - fallback uses "Equipe" without accent
    expect(screen.getAllByText('Equipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Equipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle undefined players gracefully', () => {
    const state = createExtendedGameState({ players: undefined as any });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle partial dugouts', () => {
    const state = createExtendedGameState({
      dugouts: {
        teamA: createTeamDugout('A'),
        teamB: undefined as any
      }
    });
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // Le composant ne devrait pas planter
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Equipe B').length).toBeGreaterThanOrEqual(1); // Fallback without accent
  });

  it('should handle completely undefined state gracefully', () => {
    const state = undefined as any;
    render(<GameBoardWithDugouts {...defaultProps} state={state} />);

    // When state is undefined, the component shows a loading message
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
