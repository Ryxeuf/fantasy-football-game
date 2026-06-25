/**
 * S27.8.27 — Smoke tests pour `handleBuildTeam` extrait depuis
 * `routes/team.ts` vers `routes/team-build-handler.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    // resolveStaffConfigBySlug : roster introuvable (undefined) → fallback
    // sur defaultStaffConfig(slug, format) = valeurs historiques bb11.
    roster: { findUnique: vi.fn() },
    rosterStaffConfig: { findUnique: vi.fn() },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { handleBuildTeam } from './team-build-handler';
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

describe('S27.8.27 — team-build-handler exports', () => {
  it('exposes handleBuildTeam', () => {
    expect(typeof handleBuildTeam).toBe('function');
  });

  it('re-exports handleBuildTeam from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleBuildTeam).toBe('function');
  });
});

describe('handleBuildTeam — defensive gates', () => {
  it('returns 400 when roster is not allowed', async () => {
    const req = createReq({
      body: { name: 'Test', roster: 'unknown_roster', choices: [] },
    });
    const res = createRes();
    await handleBuildTeam(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('handleBuildTeam — apothecary roster gating (retour A30)', () => {
  it.each(['undead', 'necromantic_horror', 'tomb_kings', 'nurgle'])(
    'refuse l\'apothicaire (422) à la création pour le roster mort-vivant %s',
    async (roster) => {
      const req = createReq({
        body: { name: 'Test', roster, choices: [], apothecary: true },
      });
      const res = createRes();
      await handleBuildTeam(req, res);
      expect(res.statusCode).toBe(422);
      expect((res as { payload?: { error?: string } }).payload?.error).toMatch(
        /apothicaire/i,
      );
    },
  );

  it('n\'interfère pas quand apothecary=false pour un roster mort-vivant', async () => {
    const req = createReq({
      body: { name: 'Test', roster: 'undead', choices: [], apothecary: false },
    });
    const res = createRes();
    await handleBuildTeam(req, res);
    // Le guard apothicaire ne doit pas se déclencher : on dépasse 422
    // (la suite échouera plus loin faute de mock DB, mais jamais en 422).
    expect(res.statusCode).not.toBe(422);
  });
});
