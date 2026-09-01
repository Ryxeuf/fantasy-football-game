/**
 * Édition avancée d'une équipe déjà créée : pool de PSP et annulation
 * d'améliorations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    teamPlayer: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    cupParticipant: { findFirst: vi.fn() },
    // Le règlement de tournoi est résolu par le repository (base d'abord).
    // Table vide ⇒ repli sur le registre du moteur, sans bruit d'erreur.
    tournamentRuleset: { findMany: vi.fn(() => Promise.resolve([])) },
    // Compétences Élite (`Skill.isElite`) : le pack NAF facture un surcoût
    // Élite sans republier la liste, il retombe donc sur celle de l'édition.
    skill: { findMany: vi.fn(() => Promise.resolve([])) },
  },
}));

vi.mock('./team-lock-status', () => ({
  isTeamBuildLocked: vi.fn(),
  TEAM_BUILD_LOCKED_MESSAGE: 'entree en jeu',
}));

vi.mock('./team-budget-summary', () => ({
  buildTeamBudgetSummary: vi.fn(),
  syncDraftTreasury: vi.fn(),
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(),
}));

import { prisma } from '../prisma';
import { isTeamBuildLocked } from './team-lock-status';
import {
  buildTeamBudgetSummary,
  syncDraftTreasury,
} from './team-budget-summary';
import {
  advancementCostFor,
  assertTournamentAllowsAdvancement,
  eliteSkillsForPack,
  getTeamPspPoolState,
  packForTeam,
  removePlayerAdvancement,
  setInitialBudget,
  setStartingPspPool,
  TeamAdvancementError,
} from './team-advancement-editing';

const teamFindFirst = prisma.team.findFirst as unknown as ReturnType<typeof vi.fn>;
const teamUpdate = prisma.team.update as unknown as ReturnType<typeof vi.fn>;
const teamFindUnique = prisma.team.findUnique as unknown as ReturnType<typeof vi.fn>;
const playerFindMany = prisma.teamPlayer.findMany as unknown as ReturnType<typeof vi.fn>;
const playerFindFirst = prisma.teamPlayer.findFirst as unknown as ReturnType<typeof vi.fn>;
const playerFindUnique = prisma.teamPlayer.findUnique as unknown as ReturnType<typeof vi.fn>;
const playerUpdate = prisma.teamPlayer.update as unknown as ReturnType<typeof vi.fn>;
const cupFindFirst = prisma.cupParticipant.findFirst as unknown as ReturnType<typeof vi.fn>;
const skillFindMany = prisma.skill.findMany as unknown as ReturnType<typeof vi.fn>;
const frozen = isTeamBuildLocked as unknown as ReturnType<typeof vi.fn>;
const budgetSummary = buildTeamBudgetSummary as unknown as ReturnType<typeof vi.fn>;
const syncTreasury = syncDraftTreasury as unknown as ReturnType<typeof vi.fn>;

const TEAM = {
  id: 'T1',
  roster: 'human',
  startingPspPool: 20,
  initialBudget: 1000,
  tournamentRuleset: null as string | null,
};

beforeEach(() => {
  vi.resetAllMocks();
  teamFindFirst.mockResolvedValue({ ...TEAM });
  cupFindFirst.mockResolvedValue(null);
  frozen.mockResolvedValue(false);
  playerFindMany.mockResolvedValue([]);
  skillFindMany.mockResolvedValue([]);
  teamUpdate.mockResolvedValue({});
  playerUpdate.mockResolvedValue({});
  playerFindUnique.mockResolvedValue({ id: 'P1' });
  teamFindUnique.mockResolvedValue({ ...TEAM, players: [], starPlayers: [] });
  budgetSummary.mockResolvedValue({ totalSpent: 0 });
  syncTreasury.mockResolvedValue(0);
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

  it('applique le barème du règlement de tournoi', async () => {
    const pack = await packForTeam('naf_world_cup_2027');
    expect(pack).not.toBeNull();
    expect(advancementCostFor(pack, 0, 'primary')).toBe(
      pack!.skillCosts.firstPrimary,
    );
    expect(advancementCostFor(pack, 1, 'secondary')).toBe(
      pack!.skillCosts.secondSecondary,
    );
  });

  it('retombe sur le barème standard pour les types qu’un règlement ne cote pas', async () => {
    const pack = await packForTeam('naf_world_cup_2027');
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
        pack: await packForTeam('naf_world_cup_2027'),
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
        pack: await packForTeam('naf_world_cup_2027'),
        type: 'primary',
      }),
    ).rejects.toMatchObject({ code: 'tournament-rules' });
  });
});

/**
 * Rattrapage à la LECTURE des améliorations écrites avant que le coût payé
 * (`pspCost`) ne soit persisté.
 *
 * `prisma/migrations/` est gitignoré (prod = `db push`) : aucun backfill
 * n'est possible sur ces lignes. Sous un règlement de tournoi, le repli au
 * barème standard les sous-compte — cas prod, équipe Ogre NAF World Cup
 * 2027 : 54 PSP annoncés dépensés sur un pool de 66, donc 12 PSP fantômes
 * réputés disponibles alors que le pool était vide.
 */
describe('fallbackPspCostForTeam — équipes construites avant `pspCost`', () => {
  /** Compétences du roster Ogre remonté, sans coût persisté. */
  const OGRE_PICKS = [
    {
      advancements: JSON.stringify([
        { type: 'primary', skillSlug: 'guard' },
        { type: 'secondary', skillSlug: 'block' },
      ]),
    },
    ...Array.from({ length: 4 }, () => ({
      advancements: JSON.stringify([{ type: 'primary', skillSlug: 'guard' }]),
    })),
    { advancements: JSON.stringify([{ type: 'primary', skillSlug: 'brawler' }]) },
    {
      advancements: JSON.stringify([
        { type: 'primary', skillSlug: 'dirty-player' },
      ]),
    },
  ];

  function ogreTeam(overrides: Record<string, unknown> = {}) {
    return {
      id: 'T-OGRE',
      roster: 'ogre',
      ruleset: 'season_3',
      startingPspPool: 66,
      tournamentRuleset: 'naf_world_cup_2027',
      ...overrides,
    };
  }

  /**
   * Garde et Blocage sont Élite en Saison 3. Le pack NAF facture +2 PSP par
   * compétence Élite sans republier la liste : elle vient donc de
   * l'édition (`Skill.isElite`). C'est TOUT l'écart 54 → 66.
   */
  function eliteSkills(...slugs: string[]) {
    skillFindMany.mockResolvedValue(slugs.map((slug) => ({ slug })));
  }

  it('re-applique le barème du règlement : 66 PSP dépensés, 0 disponible', async () => {
    teamFindFirst.mockResolvedValue(ogreTeam());
    playerFindMany.mockResolvedValue(OGRE_PICKS);
    eliteSkills('guard', 'block');

    const state = await getTeamPspPoolState('T-OGRE', 'U1');

    expect(state.pool).toBe(66);
    // 54 avant le correctif : le barème standard ignorait le surcoût Élite
    // et les paliers du pack.
    expect(state.spent).toBe(66);
    expect(state.remaining).toBe(0);
  });

  it('retombe sur le barème standard sans règlement de tournoi', async () => {
    teamFindFirst.mockResolvedValue(
      ogreTeam({ tournamentRuleset: null, startingPspPool: 100 }),
    );
    playerFindMany.mockResolvedValue(OGRE_PICKS);
    eliteSkills('guard', 'block');

    const state = await getTeamPspPoolState('T-OGRE', 'U1');

    // Barème BB2025 indexé par rang : (6 + 12) + 4 × 6 + 6 + 6 = 54.
    expect(state.spent).toBe(54);
  });

  it("refuse tout réglage du pool : le règlement l'impose", async () => {
    teamFindFirst.mockResolvedValue(ogreTeam());
    playerFindMany.mockResolvedValue(OGRE_PICKS);
    eliteSkills('guard', 'block');

    // Le pool d'un tournoi officiel est publié par son règlement : le
    // proposer réglable revenait à s'offrir des PSP hors barème.
    await expect(setStartingPspPool('T-OGRE', 'U1', 60)).rejects.toMatchObject({
      code: 'pool-locked',
    });
    expect(teamUpdate).not.toHaveBeenCalled();
  });

  it("annonce le pool et le budget verrouillés par le règlement", async () => {
    teamFindFirst.mockResolvedValue(ogreTeam());
    playerFindMany.mockResolvedValue(OGRE_PICKS);
    eliteSkills('guard', 'block');

    const state = await getTeamPspPoolState('T-OGRE', 'U1');

    expect(state).toMatchObject({
      locked: true,
      lockedBy: 'tournament',
      budgetLocked: true,
      budgetLockedBy: 'tournament',
    });
  });

  it('préfère le coût persisté au barème de repli', async () => {
    teamFindFirst.mockResolvedValue(ogreTeam({ startingPspPool: 40 }));
    playerFindMany.mockResolvedValue([
      {
        advancements: JSON.stringify([
          // Coût réellement payé, plus cher que tout barème dérivable.
          { type: 'primary', skillSlug: 'guard', pspCost: 30, fundedBy: 'pool' },
        ]),
      },
    ]);

    const state = await getTeamPspPoolState('T-OGRE', 'U1');

    expect(state.spent).toBe(30);
    expect(state.remaining).toBe(10);
  });

  it('ne compte pas au pool une amélioration gagnée en match', async () => {
    teamFindFirst.mockResolvedValue(ogreTeam({ startingPspPool: 40 }));
    playerFindMany.mockResolvedValue([
      {
        advancements: JSON.stringify([
          { type: 'primary', skillSlug: 'guard', pspCost: 8, fundedBy: 'pool' },
          { type: 'primary', skillSlug: 'block', pspCost: 8, fundedBy: 'player' },
        ]),
      },
    ]);

    const state = await getTeamPspPoolState('T-OGRE', 'U1');

    expect(state.spent).toBe(8);
  });
});

/**
 * Surcoût Élite d'un règlement de tournoi à l'achat d'APRÈS-création.
 *
 * Le build résolvait les compétences Élite (liste du pack, sinon celles de
 * l'édition) et facturait le surcoût ; `advancementCostFor` ne le faisait
 * pas. La MÊME compétence coûtait donc 8 PSP à la construction et 6 le
 * lendemain, sur la même équipe et le même pool.
 */
describe('advancementCostFor — surcoût Élite du règlement', () => {
  it('facture le surcoût quand la liste Élite est fournie', async () => {
    const pack = await packForTeam('naf_world_cup_2027');
    expect(pack).not.toBeNull();

    const elite = new Set(['guard']);
    // 1re primaire : 6 de base + 2 de surcoût Élite.
    expect(advancementCostFor(pack, 0, 'primary', 'guard', undefined, elite)).toBe(8);
    // Compétence non Élite : pas de surcoût.
    expect(
      advancementCostFor(pack, 0, 'primary', 'brawler', undefined, elite),
    ).toBe(6);
    // 1re secondaire Élite : 10 + 2.
    expect(
      advancementCostFor(pack, 0, 'secondary', 'guard', undefined, elite),
    ).toBe(12);
    // 2e primaire Élite : 8 + 2.
    expect(advancementCostFor(pack, 1, 'primary', 'guard', undefined, elite)).toBe(10);
  });

  it('résout les Élite de l\'édition quand le règlement n\'en publie pas', async () => {
    const pack = await packForTeam('naf_world_cup_2027');
    // Le pack NAF facture un surcoût Élite SANS republier la liste.
    expect(pack?.eliteSkills).toEqual([]);
    skillFindMany.mockResolvedValue([{ slug: 'guard' }, { slug: 'block' }]);

    const elite = await eliteSkillsForPack(pack, 'season_3');

    expect(elite?.has('guard')).toBe(true);
    expect(elite?.has('brawler')).toBe(false);
    expect(advancementCostFor(pack, 0, 'primary', 'guard', undefined, elite)).toBe(8);
  });

  it('ne résout rien hors règlement de tournoi', async () => {
    await expect(eliteSkillsForPack(null, 'season_3')).resolves.toBeUndefined();
    // Barème standard : 6 PSP pour une 1re primaire, Élite ou non.
    expect(advancementCostFor(null, 0, 'primary', 'guard')).toBe(6);
  });

  it('laisse les caractéristiques au barème standard', async () => {
    const pack = await packForTeam('naf_world_cup_2027');
    // Un règlement n'a de barème que pour les compétences au choix.
    expect(advancementCostFor(pack, 0, 'characteristic')).toBe(14);
  });
});


/**
 * Gel « entrée en jeu » vs bypass admin.
 *
 * Bug corrigé : `/available-positions` annonçait le roster déverrouillé à un
 * admin (bypass) tandis que ces deux endpoints appelaient le gel en direct.
 * La console ouvrait donc la page puis rendait 409 au premier clic.
 */
describe('bypass admin', () => {
  beforeEach(() => {
    teamFindFirst.mockResolvedValue({ ...TEAM });
    frozen.mockResolvedValue(true);
  });

  it('règle le pool malgré le gel et lit hors périmètre propriétaire', async () => {
    await setStartingPspPool('T1', 'ADMIN', 30, { isAdmin: true });
    expect(teamUpdate).toHaveBeenCalledWith({
      where: { id: 'T1' },
      data: { startingPspPool: 30 },
    });
    // `ownerId` retiré du filtre : un admin agit sur n'importe quelle équipe.
    expect(teamFindFirst.mock.calls[0][0].where).toEqual({
      id: 'T1',
      deletedAt: null,
    });
  });

  it('annule une amélioration malgré le gel', async () => {
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
      ownerId: 'ADMIN',
      playerId: 'P1',
      index: 0,
      isAdmin: true,
    });
    expect(res.refunded).toBe(6);
  });
});

describe('setInitialBudget', () => {
  beforeEach(() => {
    teamFindFirst.mockResolvedValue({ ...TEAM });
    frozen.mockResolvedValue(false);
  });

  it('enregistre le budget et resynchronise la trésorerie du brouillon', async () => {
    const state = await setInitialBudget('T1', 'U1', 1200);
    expect(teamUpdate).toHaveBeenCalledWith({
      where: { id: 'T1' },
      data: { initialBudget: 1200 },
    });
    // Le reliquat EST la trésorerie d'une équipe en brouillon : sans ce
    // recalcul, remonter le budget n'aurait crédité personne.
    expect(syncTreasury).toHaveBeenCalled();
    expect(state.initialBudget).toBe(1000); // relu depuis le mock de lecture
  });

  it('refuse un budget hors bornes', async () => {
    await expect(setInitialBudget('T1', 'U1', 99)).rejects.toMatchObject({
      code: 'budget-out-of-range',
    });
    await expect(setInitialBudget('T1', 'U1', 2001)).rejects.toMatchObject({
      code: 'budget-out-of-range',
    });
    expect(teamUpdate).not.toHaveBeenCalled();
  });

  it("refuse de descendre sous l'or déjà engagé", async () => {
    budgetSummary.mockResolvedValue({ totalSpent: 950_000 });
    await expect(setInitialBudget('T1', 'U1', 900)).rejects.toMatchObject({
      code: 'budget-below-spent',
    });
    expect(teamUpdate).not.toHaveBeenCalled();
  });

  it('refuse un budget imposé par une coupe', async () => {
    cupFindFirst.mockResolvedValue({ id: 'CP1' });
    await expect(setInitialBudget('T1', 'U1', 1200)).rejects.toMatchObject({
      code: 'budget-locked',
    });
  });

  it('refuse une équipe entrée en jeu', async () => {
    frozen.mockResolvedValue(true);
    await expect(setInitialBudget('T1', 'U1', 1200)).rejects.toMatchObject({
      code: 'team-frozen',
    });
  });
});
