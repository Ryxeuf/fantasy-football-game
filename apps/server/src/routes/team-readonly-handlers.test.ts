/**
 * S27.8.22 — Smoke tests pour les 4 handlers de lecture seule extraits
 * depuis `routes/team.ts` vers `routes/team-readonly-handlers.ts`.
 *
 * Garantit :
 *  - les 4 handlers sont exportes depuis le nouveau module
 *  - les 4 handlers sont re-exportes depuis `team.ts` (compat tests
 *    d'integration existants dans `team.test.ts`)
 *  - les gates de defense (`Roster inconnu`, etc.) repondent toujours
 *
 * Les tests metier complets restent dans `team.test.ts` (1267 tests).
 * Ici on ne fait que verifier que l'extraction n'a pas casse le
 * cablage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: {
      findMany: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    },
  },
}));

vi.mock('../utils/roster-helpers', () => ({
  getRosterFromDb: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../services/team-name-generator', () => ({
  generateTeamName: vi.fn(() => 'Generated Name'),
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  handleGenerateTeamName,
  handleListAvailableTeams,
  handleListMyTeams,
  handleGetRoster,
} from './team-readonly-handlers';
import type { AuthenticatedRequest } from '../middleware/authUser';

function createRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    payload?: unknown;
  } = {};
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

function createReq(
  overrides: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('S27.8.22 — team-readonly-handlers exports', () => {
  it('exposes the 4 named handlers', () => {
    expect(typeof handleGenerateTeamName).toBe('function');
    expect(typeof handleListAvailableTeams).toBe('function');
    expect(typeof handleListMyTeams).toBe('function');
    expect(typeof handleGetRoster).toBe('function');
  });

  it('re-exports the 4 handlers from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleGenerateTeamName).toBe('function');
    expect(typeof mod.handleListAvailableTeams).toBe('function');
    expect(typeof mod.handleListMyTeams).toBe('function');
    expect(typeof mod.handleGetRoster).toBe('function');
  });
});

describe('handleGenerateTeamName — defaults & passthrough', () => {
  it('defaults roster to "generic" when not provided', () => {
    const req = createReq({ query: {} });
    const res = createRes();
    handleGenerateTeamName(req, res);
    expect(res.payload).toMatchObject({
      data: { name: 'Generated Name', roster: 'generic' },
    });
  });

  it('passes roster from query', () => {
    const req = createReq({ query: { roster: 'orc' } });
    const res = createRes();
    handleGenerateTeamName(req, res);
    expect(res.payload).toMatchObject({
      data: { name: 'Generated Name', roster: 'orc' },
    });
  });
});

describe('handleGetRoster — defensive gates', () => {
  it('returns 404 when roster id is unknown', async () => {
    const req = createReq({ params: { id: 'unknown-roster' } });
    const res = createRes();
    await handleGetRoster(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when roster not found in DB', async () => {
    const req = createReq({ params: { id: 'skaven' } });
    const res = createRes();
    await handleGetRoster(req, res);
    expect(res.statusCode).toBe(404);
  });
});
