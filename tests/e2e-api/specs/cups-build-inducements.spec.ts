/**
 * E2E API — coups de pouce achetés À LA CRÉATION d'une équipe de coupe, de
 * bout en bout sur une vraie base.
 *
 * Coupe NAF World Cup 2027 (règlement ⇒ mode `build` imposé). Deux coachs y
 * construisent une équipe gobeline :
 *
 *   1. le catalogue de build est celui du RÈGLEMENT, avec la remise d'équipe
 *      (Pots-de-vin à 50 000 po pour Chantage et Corruption) ;
 *   2. le build les facture sur le budget d'or, aux prix du serveur, et l'or
 *      non dépensé est PERDU (trésorerie 0) ;
 *   3. la feuille de la rencontre propose le Star Player recruté à la
 *      création, rappelle les coups de pouce figés à l'inscription et
 *      REFUSE toute sélection d'avant-match ;
 *   4. la validation n'écrit rien sur les équipes (coupe en résurrection).
 *
 * Fixtures `/__test/seed-rosters` : roster `goblin` (Chantage et Corruption
 * EN BASE) et Star Player `scrappa_sorehead`, que le règlement ne bannit pas.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, type Coach } from "../helpers/factories";

const NAF = "naf_world_cup_2027";
const SCRAPPA = "scrappa_sorehead";

interface BuildCatalogue {
  allowed: boolean;
  cupMode: string | null;
  inducements: Array<{ slug: string; cost: number; maxQuantity: number }>;
}
interface BuildResponse {
  team: { id: string };
  breakdown: { inducements: number; starPlayers: number };
  cupId: string | null;
}
interface TeamDetail {
  team: {
    id: string;
    treasury: number;
    teamValue: number;
    inducements: Array<{ slug: string; quantity: number; unitCost: number }>;
    budgetSummary: { inducementsCost: number; totalSpent: number };
    players: Array<{ id: string; spp: number; dead: boolean }>;
  };
}
interface SheetPlayer {
  id: string;
  name: string;
  registered?: boolean;
}
interface SheetTeam {
  teamId: string;
  players: SheetPlayer[];
  starPlayersHired?: SheetPlayer[];
  registeredInducements?: Array<{ slug: string; quantity: number; unitCost: number }>;
}
interface SheetResponse {
  sheet: { id: string; status: string };
  competitionKind?: string;
  competitionRules?: { inducementMode?: string };
  reference?: { inducements?: unknown[]; budget?: { home: number; away: number } };
  teams: { home: SheetTeam | null; away: SheetTeam | null };
}
interface CupDTO {
  cup: {
    id: string;
    rulesConfig?: { inducementMode?: string; allowedInducements?: string[] | null };
    rounds: Array<{
      pairings: Array<{
        id: string;
        homeTeam: { id: string; ownerId: string };
        awayTeam: { id: string; ownerId: string } | null;
      }>;
    }>;
  };
}

function buildBody(name: string, cupId: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    roster: "goblin",
    ruleset: "season_3",
    format: "bb11",
    cupId,
    // Les Gobelins choisissent leur Ligue régionale à la création.
    regionalLeague: "badlands_brawl",
    choices: [{ key: "goblin_gobelin", count: 11 }],
    ...extra,
  };
}

async function setupNafCup() {
  const commish = await seedAndLogin("naf-a@cupbuild.test", "pwd", "NAF A");
  const rival = await seedAndLogin("naf-b@cupbuild.test", "pwd", "NAF B");
  const created = await post<{ cup: { id: string } }>("/cup", commish.token, {
    name: "Coupe NAF",
    ruleset: "season_3",
    format: "bb11",
    tournamentRuleset: NAF,
    // Demander « aucun » sous règlement ne change rien : `build` est imposé.
    inducementMode: "none",
  });
  return { cupId: created.cup.id, commish, rival };
}

async function buildFor(
  coach: Pick<Coach, "token">,
  cupId: string,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<BuildResponse> {
  return unwrap(
    await post<{ data: BuildResponse }>("/team/build", coach.token, buildBody(name, cupId, extra)),
  );
}

describe("E2E API — coups de pouce achetés à la création (coupe à règlement)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("sert le catalogue du règlement, remise d'équipe comprise", async () => {
    const { cupId, commish } = await setupNafCup();

    const cup = (await get<CupDTO>(`/cup/${cupId}`, commish.token)).cup;
    expect(cup.rulesConfig?.inducementMode).toBe("build");

    const catalogue = unwrap(
      await get<{ data: BuildCatalogue }>(
        `/team/build-inducements?roster=goblin&ruleset=season_3&regionalLeague=badlands_brawl&cupId=${cupId}`,
        commish.token,
      ),
    );
    expect(catalogue.allowed).toBe(true);
    expect(catalogue.cupMode).toBe("build");
    const bySlug = new Map(catalogue.inducements.map((i) => [i.slug, i]));
    // Liste FERMÉE du règlement, aux prix du règlement.
    expect(bySlug.get("team_mascot")?.cost).toBe(25_000);
    expect(bySlug.get("bloodweiser_kegs")?.cost).toBe(50_000);
    // Chantage et Corruption : la remise du règlement s'applique.
    expect(bySlug.get("bribe")?.cost).toBe(50_000);
    expect(bySlug.has("weather_mage")).toBe(false);
  });

  it("facture au build, fige à l'inscription, rappelle sur la feuille sans achat d'avant-match", async () => {
    const { cupId, commish, rival } = await setupNafCup();

    // Un prix envoyé par le client est ignoré : le serveur tarife.
    const built = await buildFor(commish, cupId, "Les Chapardeurs", {
      starPlayers: [SCRAPPA],
      inducements: [
        { slug: "bribe", quantity: 2, cost: 0 },
        { slug: "team_mascot", quantity: 1 },
      ],
    });
    expect(built.cupId).toBe(cupId);
    expect(built.breakdown.inducements).toBe(125);

    const rivalTeam = await buildFor(rival, cupId, "Les Fouineurs");

    // La fiche d'équipe : coups de pouce nommés, comptés dans la dépense,
    // et l'or non dépensé perdu (règlement).
    const detail = unwrap(
      await get<{ data: TeamDetail }>(`/team/${built.team.id}`, commish.token),
    ).team;
    expect(
      detail.inducements.map(({ slug, quantity, unitCost }) => ({ slug, quantity, unitCost })),
    ).toEqual(
      expect.arrayContaining([
        { slug: "bribe", quantity: 2, unitCost: 50_000 },
        { slug: "team_mascot", quantity: 1, unitCost: 25_000 },
      ]),
    );
    expect(detail.budgetSummary.inducementsCost).toBe(125_000);
    expect(detail.treasury).toBe(0);

    await post(`/cup/${cupId}/validate`, commish.token, {});
    await post(`/cup/${cupId}/rounds`, commish.token, { system: "random" });
    const cup = (await get<CupDTO>(`/cup/${cupId}`, commish.token)).cup;
    const pairing = cup.rounds[0].pairings.find((p) => p.awayTeam !== null)!;
    const tokenByOwner = new Map([
      [commish.userId, commish.token],
      [rival.userId, rival.token],
    ]);
    const homeToken = tokenByOwner.get(pairing.homeTeam.ownerId)!;
    const awayToken = tokenByOwner.get(pairing.awayTeam!.ownerId)!;
    const base = `/cup/pairings/${pairing.id}/sheet`;

    await post(base, homeToken, {});
    const sheet = unwrap(await get<{ data: SheetResponse }>(base, homeToken));
    expect(sheet.competitionKind).toBe("cup");
    expect(sheet.competitionRules?.inducementMode).toBe("build");

    const sides = [sheet.teams.home!, sheet.teams.away!];
    const mine = sides.find((t) => t.teamId === built.team.id)!;
    const theirs = sides.find((t) => t.teamId === rivalTeam.team.id)!;

    // Le Star Player recruté à la création est proposé, marqué « inscrit ».
    const star = (mine.starPlayersHired ?? []).find((p) => p.id.endsWith(SCRAPPA));
    expect(star).toBeTruthy();
    expect(star?.registered).toBe(true);

    // Les coups de pouce figés à l'inscription sont rappelés.
    expect(
      (mine.registeredInducements ?? []).map(({ slug, quantity }) => ({ slug, quantity })),
    ).toEqual(
      expect.arrayContaining([
        { slug: "bribe", quantity: 2 },
        { slug: "team_mascot", quantity: 1 },
      ]),
    );
    expect(theirs.registeredInducements ?? []).toEqual([]);

    // Rien ne s'achète en avant-match : la sélection est refusée…
    const refused = await rawPatch(`${base}/pre-match`, homeToken, {
      inducementsHome: [{ slug: "team_mascot", quantity: 1 }],
    });
    expect(refused.status).toBe(400);
    // …mais un avant-match sans coup de pouce passe.
    const accepted = await rawPatch(`${base}/pre-match`, homeToken, {
      popularityHome: 3,
      inducementsHome: [],
    });
    expect(accepted.status).toBe(200);

    // Validation : la coupe n'écrit rien sur les équipes.
    await post(`${base}/submit`, homeToken, {});
    await post(`${base}/submit`, awayToken, {});
    const validated = unwrap(
      await post<{ data: { sheet: { status: string } } }>(`${base}/validate`, commish.token, {}),
    );
    expect(validated.sheet.status).toBe("validated");

    const after = unwrap(
      await get<{ data: TeamDetail }>(`/team/${built.team.id}`, commish.token),
    ).team;
    expect(after.treasury).toBe(detail.treasury);
    expect(after.inducements).toEqual(detail.inducements);
    expect(after.players.map((p) => p.spp)).toEqual(detail.players.map((p) => p.spp));
  });

  it("refuse au build un coup de pouce hors règlement ou au-delà de son plafond", async () => {
    const { cupId, commish } = await setupNafCup();

    const outside = await rawPost(
      "/team/build",
      commish.token,
      buildBody("Hors liste", cupId, {
        inducements: [{ slug: "weather_mage", quantity: 1 }],
      }),
    );
    expect(outside.status).toBe(400);

    const tooMany = await rawPost(
      "/team/build",
      commish.token,
      buildBody("Trop de fûts", cupId, {
        inducements: [{ slug: "bloodweiser_kegs", quantity: 3 }],
      }),
    );
    expect(tooMany.status).toBe(400);
  });
});
