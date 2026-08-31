/**
 * `repairBuildAdvancementPsp` — reprise des SPP fantômes du build et gel du
 * coût réellement payé sur les améliorations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findMany: vi.fn() },
    teamPlayer: { update: vi.fn() },
    skill: { findMany: vi.fn() },
    tournamentRuleset: { findMany: vi.fn() },
  },
}));

vi.mock('../services/team-lock-status', () => ({
  isTeamRosterFrozen: vi.fn(),
}));

import { prisma } from '../prisma';
import { isTeamRosterFrozen } from '../services/team-lock-status';
import { repairBuildAdvancementPsp } from './repair-build-advancement-psp';

type MockFn = ReturnType<typeof vi.fn>;
const teamFindMany = prisma.team.findMany as unknown as MockFn;
const playerUpdate = prisma.teamPlayer.update as unknown as MockFn;
const skillFindMany = prisma.skill.findMany as unknown as MockFn;
const rulesetFindMany = prisma.tournamentRuleset.findMany as unknown as MockFn;
const frozen = isTeamRosterFrozen as unknown as MockFn;

beforeEach(() => {
  vi.resetAllMocks();
  frozen.mockResolvedValue(false);
  playerUpdate.mockResolvedValue({});
  rulesetFindMany.mockResolvedValue([]);
  // Garde et Blocage sont Élite : le pack NAF facture +2 PSP chacune.
  skillFindMany.mockResolvedValue([{ slug: 'guard' }, { slug: 'block' }]);
});

function ogreTeam(players: unknown[]) {
  return [
    {
      id: 'T-OGRE',
      name: 'Cerfs violents',
      ruleset: 'season_3',
      tournamentRuleset: 'naf_world_cup_2027',
      players,
    },
  ];
}

/** Le dernier `advancements` écrit pour un joueur. */
function writtenFor(playerId: string): Array<Record<string, unknown>> {
  const call = playerUpdate.mock.calls.find((c) => c[0].where.id === playerId);
  return JSON.parse(call?.[0]?.data?.advancements ?? '[]');
}

describe('repairBuildAdvancementPsp', () => {
  it('fige le coût du règlement et reprend les SPP fantômes', async () => {
    // Ogre à 2 compétences Élite : facturé 8 + 14 = 22 par le pack, mais
    // débité 6 + 12 = 18 au barème standard ⇒ 4 SPP fantômes.
    teamFindMany.mockResolvedValue(
      ogreTeam([
        {
          id: 'P1',
          name: 'Brutus',
          spp: 4,
          advancements: JSON.stringify([
            { type: 'primary', skillSlug: 'guard' },
            { type: 'secondary', skillSlug: 'block' },
          ]),
        },
      ]),
    );

    const res = await repairBuildAdvancementPsp(true);

    expect(res).toMatchObject({
      repairedTeams: 1,
      repairedPlayers: 1,
      sppReclaimed: 4,
    });
    expect(writtenFor('P1')).toEqual([
      expect.objectContaining({ pspCost: 8, fundedBy: 'pool' }),
      expect.objectContaining({ pspCost: 14, fundedBy: 'pool' }),
    ]);
    expect(playerUpdate.mock.calls[0][0].data.spp).toEqual({ decrement: 4 });
  });

  it("ne reprend jamais plus de SPP que le joueur n'en a", async () => {
    teamFindMany.mockResolvedValue(
      ogreTeam([
        {
          id: 'P1',
          name: 'Brutus',
          // Un coach a déjà dépensé une partie du résidu ailleurs.
          spp: 1,
          advancements: JSON.stringify([
            { type: 'primary', skillSlug: 'guard' },
            { type: 'secondary', skillSlug: 'block' },
          ]),
        },
      ]),
    );

    const res = await repairBuildAdvancementPsp(true);

    expect(res.sppReclaimed).toBe(1);
    expect(playerUpdate.mock.calls[0][0].data.spp).toEqual({ decrement: 1 });
  });

  it("ne touche pas un joueur dont tous les coûts sont déjà persistés", async () => {
    teamFindMany.mockResolvedValue(
      ogreTeam([
        {
          id: 'P1',
          name: 'Deja bon',
          spp: 0,
          advancements: JSON.stringify([
            { type: 'primary', skillSlug: 'guard', pspCost: 8, fundedBy: 'pool' },
          ]),
        },
      ]),
    );

    const res = await repairBuildAdvancementPsp(true);

    expect(res.repairedPlayers).toBe(0);
    expect(playerUpdate).not.toHaveBeenCalled();
  });

  it('ignore une équipe dont le roster est figé', async () => {
    frozen.mockResolvedValue(true);
    teamFindMany.mockResolvedValue(
      ogreTeam([
        {
          id: 'P1',
          name: 'Brutus',
          spp: 4,
          advancements: JSON.stringify([
            { type: 'primary', skillSlug: 'guard' },
          ]),
        },
      ]),
    );

    const res = await repairBuildAdvancementPsp(true);

    expect(res.repairedTeams).toBe(0);
    expect(playerUpdate).not.toHaveBeenCalled();
  });

  it("ne reprend rien pour une amélioration gagnée en match", async () => {
    teamFindMany.mockResolvedValue(
      ogreTeam([
        {
          id: 'P1',
          name: 'Joueur de ligue',
          spp: 12,
          advancements: JSON.stringify([
            { type: 'primary', skillSlug: 'guard', fundedBy: 'player' },
          ]),
        },
      ]),
    );

    const res = await repairBuildAdvancementPsp(true);

    // Le coût est figé (traçabilité) mais les SPP du joueur sont à lui.
    expect(res.sppReclaimed).toBe(0);
    expect(playerUpdate.mock.calls[0][0].data.spp).toBeUndefined();
    expect(writtenFor('P1')).toEqual([
      expect.objectContaining({ fundedBy: 'player' }),
    ]);
  });

  it("n'écrit rien en simulation", async () => {
    teamFindMany.mockResolvedValue(
      ogreTeam([
        {
          id: 'P1',
          name: 'Brutus',
          spp: 4,
          advancements: JSON.stringify([
            { type: 'primary', skillSlug: 'guard' },
            { type: 'secondary', skillSlug: 'block' },
          ]),
        },
      ]),
    );

    const res = await repairBuildAdvancementPsp(false);

    expect(res.repairedPlayers).toBe(1);
    expect(res.sppReclaimed).toBe(4);
    expect(playerUpdate).not.toHaveBeenCalled();
  });

  it("reconstitue les 12 SPP fantômes de l'équipe remontée", async () => {
    const players = [
      {
        id: 'P1',
        name: 'Brutus',
        spp: 4,
        advancements: JSON.stringify([
          { type: 'primary', skillSlug: 'guard' },
          { type: 'secondary', skillSlug: 'block' },
        ]),
      },
      ...['P2', 'P3', 'P4', 'P5'].map((id) => ({
        id,
        name: id,
        spp: 2,
        advancements: JSON.stringify([{ type: 'primary', skillSlug: 'guard' }]),
      })),
      {
        id: 'P6',
        name: 'Norbert',
        spp: 0,
        advancements: JSON.stringify([
          { type: 'primary', skillSlug: 'brawler' },
        ]),
      },
      {
        id: 'P7',
        name: 'Ficelle',
        spp: 0,
        advancements: JSON.stringify([
          { type: 'primary', skillSlug: 'dirty-player' },
        ]),
      },
    ];
    teamFindMany.mockResolvedValue(ogreTeam(players));

    const res = await repairBuildAdvancementPsp(true);

    // 4 (Brutus) + 4 × 2 = 12 : exactement l'écart 66 − 54.
    expect(res.sppReclaimed).toBe(12);
    expect(res.repairedPlayers).toBe(7);
    // Les compétences non Élite ne laissaient aucun résidu.
    const norbert = playerUpdate.mock.calls.find((c) => c[0].where.id === 'P6');
    expect(norbert?.[0].data.spp).toBeUndefined();
  });
});
