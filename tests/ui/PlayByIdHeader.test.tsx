import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PlayByIdPage from '../../apps/web/app/play/[id]/page';

// Mock du module auth-client pour forcer l'API_BASE
vi.mock('../../apps/web/app/auth-client', () => ({
  API_BASE: 'http://localhost:8201',
}));

// Mock complet du paquet @bb/ui pour éviter Pixi et ne garder que le scoreboard minimal
vi.mock('@bb/ui', () => ({
  PlayerDetails: () => null,
  DiceResultPopup: () => null,
  ActionPickerPopup: () => null,
  GameBoardWithDugouts: () => null,
  GameScoreboard: ({ state, leftTeamName, rightTeamName }: any) => (
    <div>
      <div data-testid="left-name">{leftTeamName || state.teamNames.teamA}</div>
      <div data-testid="right-name">{rightTeamName || state.teamNames.teamB}</div>
      <div data-testid="score">{state.score.teamA}-{state.score.teamB}</div>
      <div data-testid="turn">T{state.turn} H{state.half}</div>
    </div>
  ),
}));

// Mock fetch + localStorage
const originalFetch = global.fetch;

describe('Play/[id] header hydration', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = vi.fn(async (url: string, init?: any) => {
      if (url.endsWith('/match/details')) {
        // endpoint avec X-Match-Token
        if (init?.headers?.['X-Match-Token']) {
          return new Response(JSON.stringify({
            matchId: 'match-1',
            local: { teamName: 'Skavens', coachName: 'Alice' },
            visitor: { teamName: 'Hommes-Lézards', coachName: 'Bob' },
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'x-match-token requis' }), { status: 401 });
      }
      if (url.includes('/match/cmfy5qrjm0000qpazp4o4vzpi/summary')) {
        // endpoint auth avec Authorization
        if (init?.headers?.Authorization) {
          return new Response(JSON.stringify({
            id: 'cmfy5qrjm0000qpazp4o4vzpi',
            teams: {
              local: { name: 'Skavens', coach: 'Alice' },
              visitor: { name: 'Hommes-Lézards', coach: 'Bob' },
            },
            score: { teamA: 1, teamB: 0 },
            half: 1,
            turn: 3,
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 });
      }
      if (url.endsWith('/auth/me')) {
        if (init?.headers?.Authorization) {
          return new Response(JSON.stringify({ user: { name: 'Alice', email: 'alice@example.com' } }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 });
      }
      return new Response('{}', { status: 404 });
    });

    // @ts-ignore
    global.localStorage = {
      store: new Map<string, string>(),
      getItem(key: string) { return this.store.get(key) || null; },
      setItem(key: string, value: string) { this.store.set(key, value); },
      removeItem(key: string) { this.store.delete(key); },
      clear() { this.store.clear(); },
      key(i: number) { return Array.from(this.store.keys())[i] || null; },
      get length() { return this.store.size; },
    } as any;

    // Poser tokens simulés
    localStorage.setItem('match_token', 'dummy');
    localStorage.setItem('auth_token', 'Bearer dummy');
  });

  afterEach(() => {
    // @ts-ignore
    global.fetch = originalFetch;
  });

  it('affiche les valeurs du serveur (score/turn/half/noms) et non la démo', async () => {
    render(React.createElement(PlayByIdPage as any, { params: { id: 'cmfy5qrjm0000qpazp4o4vzpi' } }));

    await waitFor(() => expect(screen.getByTestId('left-name').textContent).toContain('Skavens'));
    await waitFor(() => expect(screen.getByTestId('right-name').textContent).toContain('Hommes-Lézards'));
    await waitFor(() => expect(screen.getByTestId('score').textContent).toBe('1-0'));
    await waitFor(() => expect(screen.getByTestId('turn').textContent).toBe('T3 H1'));
  });
});


