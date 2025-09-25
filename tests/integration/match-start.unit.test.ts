import { describe, it, expect, vi } from 'vitest';

// Mock léger du moteur pour rendre makeRNG déterministe sans dépendance réelle
vi.mock('@bb/game-engine', () => ({
  makeRNG: (seed: string) => {
    let t = 0;
    return () => {
      // alterne entre <0.5 et >0.5 selon la longueur de seed
      const v = ((seed.length + (t++)) % 2 === 0) ? 0.1 : 0.9;
      return v;
    };
  },
  setupPreMatchWithTeams: (teamAData: any[], teamBData: any[], teamAName: string, teamBName: string) => ({
    width: 26,
    height: 15,
    players: [],
    ball: undefined,
    currentPlayer: 'A',
    turn: 0,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts: { teamA: { teamId: 'A', zones: { reserves: { players: [] } } }, teamB: { teamId: 'B', zones: { reserves: { players: [] } } } },
    playerActions: new Map(),
    teamBlitzCount: new Map(),
    half: 0,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: teamAName, teamB: teamBName },
    gameLog: [{ type: 'info', message: `Phase pré-match - ${teamAName} vs ${teamBName} - Les joueurs sont en réserves` }],
  }),
}));

import { acceptAndMaybeStartMatch } from '../../apps/server/src/services/match-start';

function makePrismaMock(opts: {
  seed: string;
  usersAccepted?: string[];
  selections?: Array<{ userId: string; teamId: string }>;
}) {
  const turns: any[] = (opts.usersAccepted || []).map((u, i) => ({ matchId: 'm1', number: i + 1, payload: { type: 'accept', userId: u } }));
  return {
    match: {
      findUnique: async (_: any) => ({ id: 'm1', status: 'pending', seed: opts.seed }),
      update: async (_: any) => ({}),
    },
    teamSelection: {
      findFirst: async (_: any) => ({ id: 'sel', userId: _.where.userId, matchId: _.where.matchId }),
      findMany: async (_: any) => (opts.selections || [ { userId: 'u1', teamId: 't1' }, { userId: 'u2', teamId: 't2' } ]),
    },
    turn: {
      findMany: async (_: any) => turns,
      count: async (_: any) => turns.length,
      create: async (args: any) => { turns.push(args.data); return args.data; },
    },
    team: {
      findUnique: async (_: any) => ({
        id: _.where.id,
        name: `Team ${_.where.id}`,
        players: [
          { id: 'p1', name: 'Player 1', position: 'Lineman', number: 1, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: '' },
          { id: 'p2', name: 'Player 2', position: 'Blitzer', number: 2, ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: 'Block' },
        ]
      }),
    },
    teamPlayer: {
      findMany: async (_: any) => [],
    },
  };
}

describe('acceptAndMaybeStartMatch (unitaire, sans DB)', () => {
  it('attend le deuxième joueur si un seul accepte', async () => {
    const prisma = makePrismaMock({ seed: 's', usersAccepted: ['u1'] });
    const r = await acceptAndMaybeStartMatch(prisma as any, { matchId: 'm1', userId: 'u1' });
    expect(r.ok).toBe(true);
    expect(r.status === 'waiting_other_player' || r.status === 'waiting_other_accept').toBe(true);
  });

  it('démarre quand deux coachs distincts avec équipes différentes ont accepté', async () => {
    const prisma = makePrismaMock({ seed: 'seed-xyz', usersAccepted: ['u1'], selections: [ { userId: 'u1', teamId: 't1' }, { userId: 'u2', teamId: 't2' } ] });
    // accept u2
    const r = await acceptAndMaybeStartMatch(prisma as any, { matchId: 'm1', userId: 'u2' });
    expect(r.ok).toBe(true);
    expect(r.status).toBe('prematch');
    expect(r.kickingUserId).toBeTruthy();
    expect(r.receivingUserId).toBeTruthy();
  });

  it('refuse si même coach', async () => {
    const prisma = makePrismaMock({ seed: 's', usersAccepted: ['u1'], selections: [ { userId: 'u1', teamId: 't1' }, { userId: 'u1', teamId: 't2' } ] });
    const r = await acceptAndMaybeStartMatch(prisma as any, { matchId: 'm1', userId: 'u1' });
    expect(r.ok).toBe(false);
  });
});


