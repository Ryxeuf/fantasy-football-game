/**
 * Édition avancée d'une équipe déjà créée : pool de PSP et annulation
 * d'améliorations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn(), update: vi.fn() },
    teamPlayer: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    cupParticipant: { findFirst: vi.fn() },
  },
}));

vi.mock('./team-lock-status', () => ({
  isTeamRosterFrozen: vi.fn(),
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(),
}));

import { prisma } from '../prisma';
import { isTeamRosterFrozen } from './team-lock-status';
import {
  advancementCostFor,
  assertTournamentAllowsAdvancement,
  getTeamPspPoolState,
  packForTeam,
  removePlayerAdvancement,
  setStartingPspPool,
  TeamAdvancementError,
} from './team-advancement-editing';

const teamFindFirst = prisma.team.findFirst as unknown as ReturnType<typeof vi.fn>;
const teamUpdate = prisma.team.update as unknown as ReturnType<typeof vi.fn>;
const playerFindMany = prisma.teamPlayer.findMany as unknown as ReturnType<typeof vi.fn>;
const playerFindFirst = prisma.teamPlayer.findFirst as unknown as ReturnType<typeof vi.fn>;
const playerFindUnique = prisma.teamPlayer.findUnique as unknown as ReturnType<typeof vi.fn>;
const playerUpdate = prisma.teamPlayer.update as unknown as ReturnType<typeof vi.fn>;
const cupFindFirst = prisma.cupParticipant.findFirst as unknown as ReturnType<typeof vi.fn>;
const frozen = isTeamRosterFrozen as unknown as ReturnType<typeof vi.fn>;

const TEAM = {
  id: 'T1',
  roster: 'human',
  startingPspPool: 20,
  tournamentRuleset: null as string | null,
};

beforeEach(() => {
  vi.resetAllMocks();
  teamFindFirst.mockResolvedValue({ ...TEAM });
  cupFindFirst.mockResolvedValue(null);
  frozen.mockResolvedValue(false);
  playerFindMany.mockResolvedValue([]);
  teamUpdate.mockResolvedValue({});
  playerUpdate.mockResolvedValue({});
  playerFindUnique.mockResolvedValue({ id: 'P1' });
});

describe('getTeamPspPoolState', () => {
  it('somme les PSP dépensés sur le pool et renvoie le reste', async () => {
    playerFindMany.mockResolvedValue([
      {
        advancements: JSON.stringify([
          { type: 'primary', pspCost: 6, fundedBy: 'pool' },
        ]),
      },
      {
        advancements: JSON.stringify([
          { type: 'secondary', pspCost: 10, fundedBy: 'pool' },
        ]),
      },
    ]);

    const state = await getTeamPspPoolState('T1', 'U1');
    expect(state).toMatchObject({ pool: 20, spent: 16, remaining: 4, locked: false });
  });

  it('ignore les améliorations payées sur les SPP du joueur', async () => {
    playerFindMany.mockResolvedValue([
      {
        advancements: JSON.stringify([
          { type: 'primary', pspCost: 6, fundedBy: 'player' },
        ]),
      },
    ]);
    expect((await getTeamPspPoolState('T1', 'U1')).spent).toBe(0);
  });

  it('signale un pool verrouillé quand l’équipe est inscrite en coupe', async () => {
    cupFindFirst.mockResolvedValue({ id: 'C1' });
    expect((await getTeamPspPoolState('T1', 'U1')).locked).toBe(true);
  });

  it('404 si l’équipe n’appartient pas au coach', async () => {
    teamFindFirst.mockResolvedValue(null);
    await expect(getTeamPspPoolState('T1', 'U2')).rejects.toMatchObject({
      code: 'team-not-found',
    });
  });
});

describe('setStartingPspPool', () => {
  it('enregistre le nouveau pool', async () => {
    const state = await setStartingPspPool('T1', 'U1', 30);
    expect(teamUpdate).toHaveBeenCalledWith({
      where: { id: 'T1' },
      data: { startingPspPool: 30 },
    });
    expect(state).toMatchObject({ pool: 30, spent: 0, remaining: 30 });
  });

  it('refuse de descendre sous les PSP déjà dépensés', async () => {
    playerFindMany.mockResolvedValue([
      {
        advancements: JSON.stringify([
          { type: 'primary', pspCost: 6, fundedBy: 'pool' },
        ]),
      },
    ]);
    await expect(setStartingPspPool('T1', 'U1', 4)).rejects.toMatchObject({
      code: 'pool-below-spent',
    });
    expect(teamUpdate).not.toHaveBeenCalled();
  });

  it('refuse une équipe engagée en compétition', async () => {
    frozen.mockResolvedValue(true);
    await expect(setStartingPspPool('T1', 'U1', 30)).rejects.toMatchObject({
      code: 'team-frozen',
    });
  });

  it('refuse un pool imposé par une coupe', async () => {
    cupFindFirst.mockResolvedValue({ id: 'C1' });
    await expect(setStartingPspPool('T1', 'U1', 30)).rejects.toMatchObject({
      code: 'pool-locked',
    });
  });

  it('refuse une valeur hors bornes', async () => {
    await expect(setStartingPspPool('T1', 'U1', 201)).rejects.toMatchObject({
      code: 'pool-out-of-range',
    });
    await expect(setStartingPspPool('T1', 'U1', -1)).rejects.toMatchObject({
      code: 'pool-out-of-range',
    });
  });
});

describe('removePlayerAdvancement', () => {
  it('retire la compétence acquise et rend les PSP au pool', async () => {
    playerFindFirst.mockResolvedValue({
      id: 'P1',
      skills: 'block,dodge',
      advancements: JSON.stringify([
        { type: 'primary', skillSlug: 'dodge', pspCost: 6, fundedBy: 'pool' },
      ]),
      spp: 0,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
    });

    const res = await removePlayerAdvancement({
      teamId: 'T1',
      ownerId: 'U1',
      playerId: 'P1',
      index: 0,
    });

    expect(res.refunded).toBe(6);
    expect(res.refundedTo).toBe('pool');
    const data = playerUpdate.mock.calls[0][0].data;
    expect(data.skills).toBe('block');
    expect(JSON.parse(data.advancements)).toEqual([]);
    // Financée par le pool => aucun SPP rendu au joueur.
    expect(data.spp).toBeUndefined();
  });

  it('rend les SPP au joueur quand il les avait payés', async () => {
    playerFindFirst.mockResolvedValue({
      id: 'P1',
      skills: 'block,dodge',
      advancements: JSON.stringify([
        { type: 'primary', skillSlug: 'dodge', pspCost: 6, fundedBy: 'player' },
      ]),
      spp: 0,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
    });

    const res = await removePlayerAdvancement({
      teamId: 'T1',
      ownerId: 'U1',
      playerId: 'P1',
      index: 0,
    });

    expect(res.refundedTo).toBe('player');
    expect(playerUpdate.mock.calls[0][0].data.spp).toEqual({ increment: 6 });
  });

  it('rend la caractéristique améliorée', async () => {
    playerFindFirst.mockResolvedValue({
      id: 'P1',
      skills: 'block',
      advancements: JSON.stringify([
        { type: 'characteristic', stat: 'ma', pspCost: 14, fundedBy: 'pool' },
      ]),
      spp: 0,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
    });

    await removePlayerAdvancement({
      teamId: 'T1',
      ownerId: 'U1',
      playerId: 'P1',
      index: 0,
    });

    const data = playerUpdate.mock.calls[0][0].data;
    expect(data.ma).toBe(6);
    expect(data.skills).toBeUndefined();
  });

  it('ne retire qu’UNE occurrence quand le poste possède déjà la compétence', async () => {
    // Cas tordu : le poste a « block » de base et l'amélioration a rajouté le
    // même slug. Retirer les deux dépouillerait le joueur d'une compétence
    // qu'il n'a jamais achetée.
    playerFindFirst.mockResolvedValue({
      id: 'P1',
      skills: 'block,block',
      advancements: JSON.stringify([
        { type: 'primary', skillSlug: 'block', pspCost: 6, fundedBy: 'pool' },
      ]),
      spp: 0,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
    });

    await removePlayerAdvancement({
      teamId: 'T1',
      ownerId: 'U1',
      playerId: 'P1',
      index: 0,
    });
    expect(playerUpdate.mock.calls[0][0].data.skills).toBe('block');
  });

  it('utilise le barème standard pour une amélioration historique sans coût', async () => {
    playerFindFirst.mockResolvedValue({
      id: 'P1',
      skills: 'block,dodge,sprint',
      advancements: JSON.stringify([
        { type: 'primary', skillSlug: 'dodge' },
        { type: 'primary', skillSlug: 'sprint' },
      ]),
      spp: 0,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
    });

    // 2e primaire au barème standard = 8 PSP.
    const res = await removePlayerAdvancement({
      teamId: 'T1',
      ownerId: 'U1',
      playerId: 'P1',
      index: 1,
    });
    expect(res.refunded).toBe(8);
  });

  it('refuse une équipe engagée', async () => {
    frozen.mockResolvedValue(true);
    await expect(
      removePlayerAdvancement({
        teamId: 'T1',
        ownerId: 'U1',
        playerId: 'P1',
        index: 0,
      }),
    ).rejects.toMatchObject({ code: 'team-frozen' });
  });

  it('404 sur un index hors bornes', async () => {
    playerFindFirst.mockResolvedValue({
      id: 'P1',
      skills: '',
      advancements: '[]',
      spp: 0,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
    });
    await expect(
      removePlayerAdvancement({
        teamId: 'T1',
        ownerId: 'U1',
        playerId: 'P1',
        index: 0,
      }),
    ).rejects.toMatchObject({ code: 'advancement-not-found' });
  });
});

describe('advancementCostFor', () => {
  it('applique le barème standard sans règlement', () => {
    expect(advancementCostFor(null, 0, 'primary')).toBe(6);
    expect(advancementCostFor(null, 1, 'primary')).toBe(8);
    expect(advancementCostFor(null, 0, 'secondary')).toBe(10);
  });

  it('applique le barème du règlement de tournoi', () => {
    const pack = packForTeam('naf_world_cup_2027');
    expect(pack).not.toBeNull();
    expect(advancementCostFor(pack, 0, 'primary')).toBe(
      pack!.skillCosts.firstPrimary,
    );
    expect(advancementCostFor(pack, 1, 'secondary')).toBe(
      pack!.skillCosts.secondSecondary,
    );
  });

  it('retombe sur le barème standard pour les types qu’un règlement ne cote pas', () => {
    const pack = packForTeam('naf_world_cup_2027');
    expect(advancementCostFor(pack, 0, 'characteristic')).toBe(14);
    expect(advancementCostFor(pack, 0, 'random-primary')).toBe(3);
  });
});

describe('assertTournamentAllowsAdvancement', () => {
  it('ne fait rien sans règlement', async () => {
    await expect(
      assertTournamentAllowsAdvancement({
        teamId: 'T1',
        roster: 'human',
        playerId: 'P1',
        pack: null,
        type: 'characteristic',
      }),
    ).resolves.toBeUndefined();
  });

  it('interdit les améliorations de caractéristique sous règlement', async () => {
    await expect(
      assertTournamentAllowsAdvancement({
        teamId: 'T1',
        roster: 'human',
        playerId: 'P1',
        pack: packForTeam('naf_world_cup_2027'),
        type: 'characteristic',
      }),
    ).rejects.toBeInstanceOf(TeamAdvancementError);
  });

  it('interdit une 3e compétence sur le même joueur', async () => {
    playerFindMany.mockResolvedValue([
      {
        id: 'P1',
        advancements: JSON.stringify([{ type: 'primary' }, { type: 'primary' }]),
      },
    ]);
    await expect(
      assertTournamentAllowsAdvancement({
        teamId: 'T1',
        roster: 'human',
        playerId: 'P1',
        pack: packForTeam('naf_world_cup_2027'),
        type: 'primary',
      }),
    ).rejects.toMatchObject({ code: 'tournament-rules' });
  });
});
