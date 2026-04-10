import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlayerDetails from '../PlayerDetails';
import type { Player } from '@bb/game-engine';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
    number: 7,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: ['block', 'dodge'],
    pm: 6,
    ...overrides,
  };
}

describe('PlayerDetails', () => {
  it('should render player name and stats', () => {
    const player = makePlayer();
    render(<PlayerDetails player={player} onClose={vi.fn()} />);

    expect(screen.getByText('Test Player')).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.getByText('Lineman')).toBeInTheDocument();
  });

  it('should render skills as badges', () => {
    const player = makePlayer({ skills: ['block', 'dodge'] });
    render(<PlayerDetails player={player} onClose={vi.fn()} />);

    expect(screen.getByText('block')).toBeInTheDocument();
    expect(screen.getByText('dodge')).toBeInTheDocument();
  });

  it('should not render star player rule section for normal players', () => {
    const player = makePlayer({ skills: ['block', 'dodge'] });
    render(<PlayerDetails player={player} onClose={vi.fn()} />);

    expect(screen.queryByText(/Règle spéciale/i)).not.toBeInTheDocument();
  });

  it('should render star player rule section when player has a special rule', () => {
    const player = makePlayer({
      id: 'akhorne-1',
      name: 'Akhorne The Squirrel',
      skills: ['dodge', 'frenzy', 'blind-rage'],
    });
    render(<PlayerDetails player={player} onClose={vi.fn()} />);

    expect(screen.getByText(/Règle spéciale/i)).toBeInTheDocument();
    expect(screen.getByText('Rage Aveugle')).toBeInTheDocument();
  });

  it('should show rule as available when not used', () => {
    const player = makePlayer({
      id: 'anqi-1',
      name: 'Anqi Panqi',
      skills: ['block', 'grab', 'coup-sauvage'],
    });
    render(
      <PlayerDetails
        player={player}
        onClose={vi.fn()}
        usedStarPlayerRules={{}}
      />,
    );

    expect(screen.getByText('Coup Sauvage')).toBeInTheDocument();
    expect(screen.getByText(/Disponible/i)).toBeInTheDocument();
  });

  it('should show rule as used when tracked in usedStarPlayerRules', () => {
    const player = makePlayer({
      id: 'anqi-1',
      name: 'Anqi Panqi',
      skills: ['block', 'grab', 'coup-sauvage'],
    });
    render(
      <PlayerDetails
        player={player}
        onClose={vi.fn()}
        usedStarPlayerRules={{ 'anqi-1:coup-sauvage': true }}
      />,
    );

    expect(screen.getByText('Coup Sauvage')).toBeInTheDocument();
    expect(screen.getByText(/Utilisée/i)).toBeInTheDocument();
  });

  it('should show rule description', () => {
    const player = makePlayer({
      id: 'zug-1',
      name: 'Mighty Zug',
      skills: ['block', 'mighty-blow', 'casse-os'],
    });
    render(<PlayerDetails player={player} onClose={vi.fn()} />);

    expect(screen.getByText('Casse-Os')).toBeInTheDocument();
    // The description should be visible
    expect(screen.getByText(/une fois par match/i)).toBeInTheDocument();
  });

  it('should filter star rules out of regular skills badges', () => {
    const player = makePlayer({
      id: 'zug-1',
      name: 'Mighty Zug',
      skills: ['block', 'mighty-blow', 'casse-os'],
    });
    render(<PlayerDetails player={player} onClose={vi.fn()} />);

    // Regular skills should still show as badges
    expect(screen.getByText('block')).toBeInTheDocument();
    expect(screen.getByText('mighty-blow')).toBeInTheDocument();
    // Star rule slug should NOT appear as a regular skill badge
    const skillBadges = screen.queryAllByText('casse-os');
    expect(skillBadges.length).toBe(0);
  });

  it('should render null when player is null', () => {
    const { container } = render(<PlayerDetails player={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
