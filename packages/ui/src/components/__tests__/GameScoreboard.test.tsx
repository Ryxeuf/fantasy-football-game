import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import GameScoreboard from '../GameScoreboard';
import type { GameState } from '@bb/game-engine';

// Helper pour créer un état de jeu minimal
const createMinimalGameState = (overrides: Partial<GameState> = {}): GameState => ({
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

describe('GameScoreboard', () => {
  it('should render without crashing with minimal state', () => {
    const state = createMinimalGameState();
    render(<GameScoreboard state={state} />);

    // "Équipe A" appears in both active team area and score badge
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1); // Score
  });

  it('should handle undefined teamNames gracefully', () => {
    const state = createMinimalGameState({ teamNames: undefined as any });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter et afficher les fallbacks
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle null teamNames gracefully', () => {
    const state = createMinimalGameState({ teamNames: null as any });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter et afficher les fallbacks
    expect(screen.getByText('Équipe A')).toBeInTheDocument();
    expect(screen.getByText('Équipe B')).toBeInTheDocument();
  });

  it('should handle undefined score gracefully', () => {
    const state = createMinimalGameState({ score: undefined as any });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter et afficher 0 comme score
    expect(screen.getAllByText('0')).toHaveLength(2); // Deux scores à 0
  });

  it('should handle null score gracefully', () => {
    const state = createMinimalGameState({ score: null as any });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter et afficher 0 comme score
    expect(screen.getAllByText('0')).toHaveLength(2); // Deux scores à 0
  });

  it('should handle undefined gameLog gracefully', () => {
    const state = createMinimalGameState({ gameLog: undefined as any });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Blood Bowl Fantasy Football')).toBeInTheDocument();
  });

  it('should handle null gameLog gracefully', () => {
    const state = createMinimalGameState({ gameLog: null as any });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Blood Bowl Fantasy Football')).toBeInTheDocument();
  });

  it('should handle undefined players gracefully', () => {
    const state = createMinimalGameState({ players: undefined as any });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Blood Bowl Fantasy Football')).toBeInTheDocument();
  });

  it('should display userName as link when provided', () => {
    const state = createMinimalGameState();
    render(<GameScoreboard state={state} userName="TestUser" />);
    
    const userLink = screen.getByText('TestUser');
    expect(userLink).toBeInTheDocument();
    expect(userLink.closest('a')).toHaveAttribute('href', '/me');
  });

  it('should display default text when no userName', () => {
    const state = createMinimalGameState();
    render(<GameScoreboard state={state} />);
    
    expect(screen.getByText('Blood Bowl Fantasy Football')).toBeInTheDocument();
  });

  it('should handle partial teamNames', () => {
    const state = createMinimalGameState({
      teamNames: {
        teamA: 'Équipe A',
        teamB: undefined as any
      }
    });
    render(<GameScoreboard state={state} />);

    // Le composant ne devrait pas planter
    // "Équipe A" appears in active team and score badge areas
    expect(screen.getAllByText('Équipe A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Équipe B').length).toBeGreaterThanOrEqual(1); // Fallback
  });

  it('should handle partial score', () => {
    const state = createMinimalGameState({
      score: {
        teamA: 1,
        teamB: undefined as any
      }
    });
    render(<GameScoreboard state={state} />);

    // Le composant ne devrait pas planter
    // '1' appears in score, half, and turn areas
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1); // Fallback pour teamB
  });

  it('should handle empty gameLog array', () => {
    const state = createMinimalGameState({ gameLog: [] });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Blood Bowl Fantasy Football')).toBeInTheDocument();
  });

  it('should handle gameLog with score entries', () => {
    const state = createMinimalGameState({
      gameLog: [
        { id: '1', type: 'move', message: 'Test move' },
        { id: '2', type: 'score', message: 'Touchdown!' }
      ]
    });
    render(<GameScoreboard state={state} />);
    
    // Le composant ne devrait pas planter
    expect(screen.getByText('Blood Bowl Fantasy Football')).toBeInTheDocument();
  });

  it('should handle completely undefined state gracefully', () => {
    const state = undefined as any;
    render(<GameScoreboard state={state} />);

    // Le composant ne devrait pas planter même avec un état complètement undefined
    // Quand state est undefined, le composant affiche le message de chargement
    expect(screen.getByText('Chargement de la partie...')).toBeInTheDocument();
  });

  it('should handle state with only required properties', () => {
    const state = {
      currentPlayer: 'A',
      players: [],
      teamNames: { teamA: 'Team Alpha', teamB: 'Team Beta' },
      score: { teamA: 0, teamB: 0 },
      gameLog: [],
      half: 1,
      turn: 1,
      isTurnover: false,
      selectedPlayerId: null,
    } as any;
    render(<GameScoreboard state={state} />);

    // Le composant ne devrait pas planter
    // Team names appear in both active team and score badge areas
    expect(screen.getAllByText('Team Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Team Beta').length).toBeGreaterThanOrEqual(1);
  });

  it('should display custom team names when provided as props', () => {
    const state = createMinimalGameState();
    render(
      <GameScoreboard 
        state={state} 
        leftTeamName="Custom Team A" 
        rightTeamName="Custom Team B" 
      />
    );
    
    expect(screen.getByText('Custom Team A')).toBeInTheDocument();
    expect(screen.getByText('Custom Team B')).toBeInTheDocument();
  });

  it('should handle onEndTurn callback when provided', () => {
    const state = createMinimalGameState({ half: 1 });
    const mockOnEndTurn = vi.fn();
    render(<GameScoreboard state={state} onEndTurn={mockOnEndTurn} />);

    // Le composant devrait rendre sans erreur
    expect(screen.getByText('Blood Bowl Fantasy Football')).toBeInTheDocument();
  });

  describe('Connection status indicator', () => {
    it('should show "Connecté" with green dot when wsConnected is true', () => {
      const state = createMinimalGameState();
      render(<GameScoreboard state={state} wsConnected={true} />);

      expect(screen.getByText('Connecté')).toBeInTheDocument();
      const indicator = screen.getByTestId('ws-status-dot');
      expect(indicator.className).toContain('bg-green-400');
    });

    it('should show reconnecting state with attempt number', () => {
      const state = createMinimalGameState();
      render(
        <GameScoreboard
          state={state}
          wsConnected={false}
          wsReconnecting={true}
          wsReconnectAttempt={3}
        />
      );

      expect(screen.getByText('Reconnexion... (3)')).toBeInTheDocument();
      const indicator = screen.getByTestId('ws-status-dot');
      expect(indicator.className).toContain('bg-amber-400');
      expect(indicator.className).toContain('animate-pulse');
    });

    it('should show "Hors ligne" with red dot when disconnected', () => {
      const state = createMinimalGameState();
      render(
        <GameScoreboard
          state={state}
          wsConnected={false}
          wsReconnecting={false}
        />
      );

      expect(screen.getByText('Hors ligne')).toBeInTheDocument();
      const indicator = screen.getByTestId('ws-status-dot');
      expect(indicator.className).toContain('bg-red-500');
    });

    it('should not render connection indicator when wsConnected is undefined', () => {
      const state = createMinimalGameState();
      render(<GameScoreboard state={state} />);

      expect(screen.queryByTestId('ws-status-dot')).not.toBeInTheDocument();
    });
  });
});
