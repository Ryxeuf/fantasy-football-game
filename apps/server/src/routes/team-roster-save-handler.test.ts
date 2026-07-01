import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    teamPlayer: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/team-lock-status', () => ({
  isTeamRosterFrozen: vi.fn().mockResolvedValue(false),
  TEAM_ENGAGED_MESSAGE: 'ENGAGEE',
}));

vi.mock('../utils/roster-helpers', () => ({
  getRosterFromDb: vi.fn(),
}));

vi.mock('../services/roster-staff-config', () => ({
  resolveStaffConfigBySlug: vi.fn(),
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn().mockResolvedValue({ teamValue: 0, currentValue: 0 }),
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../prisma';
import { getRosterFromDb } from '../utils/roster-helpers';
import { resolveStaffConfigBySlug } from '../services/roster-staff-config';
import { isTeamRosterFrozen } from '../services/team-lock-status';
import { handleSaveRoster } from './team-roster-save-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  team: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  teamPlayer: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockRoster = getRosterFromDb as ReturnType<typeof vi.fn>;
const mockStaff = resolveStaffConfigBySlug as ReturnType<typeof vi.fn>;
const mockFrozen = isTeamRosterFrozen as ReturnType<typeof vi.fn>;

function createRes() {
  const res: Partial<Response> & { statusCode?: number; payload?: unknown } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((payload: unknown) => {
    res.payload = payload;
    return res as Response;
  });
  return res as Response & { statusCode?: number; payload?: unknown };
}

function createReq(body: unknown, id = 'team-1'): AuthenticatedRequest {
  return {
    body,
    params: { id },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
  } as unknown as AuthenticatedRequest;
}

const LINEMAN = {
  slug: 'skaven_lineman',
  displayName: 'Lineman',
  cost: 50,
  min: 0,
  max: 16,
  ma: 7,
  st: 3,
  ag: 3,
  pa: 4,
  av: 8,
  skills: '',
};

const ROSTER_DEF = { name: 'Skaven', positions: [LINEMAN] };
const NO_COST_STAFF = {
  rerollCost: 0,
  cheerleaderCost: 0,
  assistantCost: 0,
  apothecaryCost: 0,
  apothecaryAllowed: true,
  dedicatedFanCost: 0,
};

function teamWith(playerCount: number, initialBudget = 1000) {
  return {
    id: 'team-1',
    ownerId: 'user-1',
    roster: 'skaven',
    ruleset: 'season_3',
    format: 'bb11',
    initialBudget,
    rerolls: 0,
    cheerleaders: 0,
    assistants: 0,
    apothecary: false,
    dedicatedFans: 1,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p-${i}`,
      position: 'skaven_lineman',
    })),
    starPlayers: [],
  };
}

function linemen(count: number, withIds: boolean) {
  return Array.from({ length: count }, (_, i) => ({
    ...(withIds ? { id: `p-${i}` } : {}),
    position: 'skaven_lineman',
    name: `Lineman ${i + 1}`,
    number: i + 1,
  }));
}

describe('handleSaveRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrozen.mockResolvedValue(false);
    mockRoster.mockResolvedValue(ROSTER_DEF);
    mockStaff.mockResolvedValue(NO_COST_STAFF);
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    const res = createRes();
    await handleSaveRoster(createReq({ players: linemen(11, true) }), res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when the team is ENGAGED', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(teamWith(11));
    mockFrozen.mockResolvedValue(true);
    const res = createRes();
    await handleSaveRoster(createReq({ players: linemen(11, true) }), res);
    expect(res.statusCode).toBe(403);
    expect(res.payload).toMatchObject({ success: false });
  });

  it('returns 400 when below the format minimum (11 for bb11)', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(teamWith(11));
    const res = createRes();
    await handleSaveRoster(createReq({ players: linemen(10, true) }), res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining('11'),
    });
  });

  it('returns 400 when duplicate numbers', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(teamWith(11));
    const dup = linemen(11, true);
    dup[1]!.number = dup[0]!.number;
    const res = createRes();
    await handleSaveRoster(createReq({ players: dup }), res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining('numeros'),
    });
  });

  it('returns 400 when budget exceeded', async () => {
    // 11 linemen * 50k = 550k > 100k budget.
    mockPrisma.team.findFirst.mockResolvedValue(teamWith(11, 100));
    const res = createRes();
    await handleSaveRoster(createReq({ players: linemen(11, true) }), res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining('Budget'),
    });
  });

  it('returns 400 when a provided id does not belong to the team', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(teamWith(11));
    const players = linemen(11, true);
    players[0]!.id = 'ghost';
    const res = createRes();
    await handleSaveRoster(createReq({ players }), res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining('ghost'),
    });
  });

  it('applies the diff (delete removed, create new, update kept) and saves', async () => {
    // Existant : 12 linemen p-0..p-11. Cible : garder p-0..p-9 (10) + 1 nouveau
    // => supprime p-10 et p-11, cree 1, met a jour 10.
    mockPrisma.team.findFirst.mockResolvedValue(teamWith(12));
    const target = [
      ...linemen(10, true), // p-0..p-9 conserves
      { position: 'skaven_lineman', name: 'Recrue', number: 11 }, // nouveau
    ];
    const updated = { id: 'team-1', players: [] };
    mockPrisma.team.findUnique.mockResolvedValue(updated);

    const res = createRes();
    await handleSaveRoster(createReq({ name: 'Rats', players: target }), res);

    expect(res.statusCode).toBe(200);
    // 2 suppressions (p-10, p-11).
    expect(mockPrisma.teamPlayer.delete).toHaveBeenCalledTimes(2);
    expect(mockPrisma.teamPlayer.delete).toHaveBeenCalledWith({
      where: { id: 'p-10' },
    });
    expect(mockPrisma.teamPlayer.delete).toHaveBeenCalledWith({
      where: { id: 'p-11' },
    });
    // 1 creation avec stats derivees du poste.
    expect(mockPrisma.teamPlayer.create).toHaveBeenCalledTimes(1);
    // 10 mises a jour (nom/numero).
    expect(mockPrisma.teamPlayer.update).toHaveBeenCalledTimes(10);
    // Transaction + recalcul TV.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(res.payload).toMatchObject({ success: true, data: { team: updated } });
  });
});
