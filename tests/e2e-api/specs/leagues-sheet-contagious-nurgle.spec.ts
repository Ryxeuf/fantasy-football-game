/**
 * E2E API — Trait « Contagieux » (Nurgle) : la seconde source de joueur
 * relevé, du blocage mortel au recrutement AU PRIX DU POSTE, sur une vraie
 * base (SQLite, vrai serveur, deux coachs, le porteur de peste étant aussi
 * commissaire).
 *
 * Suite de « Relever le Mort » (Maîtres de la Non-vie) : même mécanique, autre
 * déclencheur, autre prix. Chaque étape verrouille un point de la règle :
 *
 *  - la feuille ne propose « Contagieux » QU'aux Nurgle (chaque Pourri porte
 *    le Trait), avec leur seul Trois-quart, et aucune victime tant que
 *    personne n'est mort ;
 *  - une agression mortelle ne contamine PAS ; un blocage mortel d'un Pourri
 *    oui. La victime de l'agression, le coach adverse et l'équipe sans règle
 *    sont refusés ; le Contaminé rejoint la feuille en réserve, au numéro
 *    suivant, avec le nom du mort et le prix du poste ;
 *  - il joue : un TD lui crédite 2 PSP et une sortie 3 (Bagarreurs Brutaux,
 *    en Ligue), la feuille sert son tirage « Hasard » et son évolution stagée
 *    est acceptée ;
 *  - recruté à l'étape EMBAUCHES « de la même manière que les Joueurs
 *    Journaliers » : Pourri au roster, compétence tirée, sans Solitaire, le
 *    prix du poste PLUS le surcoût de l'évolution débités même si le coach a
 *    saisi 0 — et les morts adverses restent morts.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { get, post, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

const ROTTER = "nurgle_trois_quart_putrescent";
/** Prix du Trois-Quart Putrescent (fixture `/__test/seed-rosters`). */
const ROTTER_COST = 40_000;
/**
 * Surcoût de VE d'une compétence principale au hasard (Saison 3, barème
 * compilé `SURCHARGE_PER_ADVANCEMENT` du moteur : +20 000 po, comme une
 * principale choisie).
 */
const RANDOM_PRIMARY_SURCHARGE = 20_000;

interface SheetRaisedDead {
  id: string;
  number: number;
  name: string;
  position: string;
  positionName: string;
  skills: string;
  cost: number;
  victimId: string;
  source: string;
  hireCost: number;
}
interface SheetSide {
  teamId: string;
  players: Array<{ id: string; number: number; name: string }>;
  raiseDead?: {
    sources: string[];
    victims: Array<{ id: string; name: string; source: string }>;
    positions: Array<{ slug: string; name: string }>;
    choice: { victimId: string; position: string | null } | null;
    canHire: boolean;
  };
  raisedDead?: SheetRaisedDead | null;
}
interface SheetResponse {
  sheet: {
    status: string;
    advancementsHome?: unknown;
    advancementsAway?: unknown;
  };
  teams: { home: SheetSide | null; away: SheetSide | null };
  computedSpp: Record<string, number>;
}
interface SeasonDetailDTO {
  season: {
    rounds: Array<{
      pairings: Array<{
        id: string;
        homeParticipant: { team: { id: string; ownerId: string } };
        awayParticipant: { team: { id: string; ownerId: string } };
      }>;
    }>;
  };
}
interface TeamDetailDTO {
  team: {
    treasury: number;
    players: Array<{
      id: string;
      name: string;
      position: string;
      spp: number;
      skills: string;
      dead?: boolean;
    }>;
  };
}

type Side = "home" | "away";
const sideKey = (side: Side, base: string): string =>
  `${base}${side === "home" ? "Home" : "Away"}`;
const sheetUrl = (pairingId: string) => `/leagues/pairings/${pairingId}/sheet`;

async function bodyOf(res: Response): Promise<string> {
  try {
    return JSON.stringify(await res.clone().json());
  } catch {
    return res.statusText;
  }
}

function parseList(raw: unknown): Array<Record<string, unknown>> {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(parsed)
    ? (parsed as Array<Record<string, unknown>>)
    : [];
}

interface Scenario {
  url: string;
  /** Côté des Nurgle. */
  side: Side;
  otherSide: Side;
  /** Coach nurgle, aussi commissaire de la ligue. */
  plagueToken: string;
  ratToken: string;
  nurgleTeamId: string;
  skavenTeamId: string;
}

/** Une ligue à deux équipes : Nurgle contre Skavens (Force 3, sans Trait). */
async function setupNurgleVsSkaven(prefix: string): Promise<Scenario> {
  const plague = await seedAndLogin(
    `${prefix}-plague@nurgle.test`,
    "pwd",
    "plague",
  );
  const rat = await seedAndLogin(`${prefix}-rat@nurgle.test`, "pwd", "rat");
  const nurgleTeam = await createTeam(
    plague.userId,
    `${prefix} Pustules`,
    "nurgle",
  );
  const skavenTeam = await createTeam(rat.userId, `${prefix} Rats`, "skaven");

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", plague.token, {
      name: `${prefix} Peste League`,
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      plague.token,
      { name: "S1" },
    ),
  );
  await post(`/leagues/seasons/${season.id}/join`, plague.token, {
    teamId: nurgleTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/join`, rat.token, {
    teamId: skavenTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/start`, plague.token, {});

  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(
      `/leagues/seasons/${season.id}`,
      plague.token,
    ),
  );
  const pairing = detail.season.rounds[0].pairings[0];
  const side: Side =
    pairing.homeParticipant.team.id === nurgleTeam.teamId ? "home" : "away";
  return {
    url: sheetUrl(pairing.id),
    side,
    otherSide: side === "home" ? "away" : "home",
    plagueToken: plague.token,
    ratToken: rat.token,
    nurgleTeamId: nurgleTeam.teamId,
    skavenTeamId: skavenTeam.teamId,
  };
}

describe("E2E API — Trait Contagieux : du blocage mortel au recrutement au prix du poste", () => {
  let s: Scenario;
  let victim: { id: string; number: number; name: string };
  let fouled: { id: string; number: number; name: string };
  let raised: SheetRaisedDead;
  let candidates: string[] = [];

  const readSheet = async (): Promise<SheetResponse> =>
    unwrap(await get<{ data: SheetResponse }>(s.url, s.plagueToken));
  const nurgleSide = (sheet: SheetResponse): SheetSide =>
    s.side === "home" ? sheet.teams.home! : sheet.teams.away!;
  const skavenSide = (sheet: SheetResponse): SheetSide =>
    s.side === "home" ? sheet.teams.away! : sheet.teams.home!;

  beforeAll(async () => {
    await resetDb();
    s = await setupNurgleVsSkaven("contagious");
    await post(s.url, s.plagueToken, {});
  });

  it("la feuille ne propose « Contagieux » qu'aux Nurgle, avec leur seul Trois-quart et aucune victime", async () => {
    const opened = await readSheet();
    const nurgle = nurgleSide(opened);
    expect(nurgle.raiseDead, "règle attendue côté Nurgle").toBeTruthy();
    expect(nurgle.raiseDead!.sources).toEqual(["plague_ridden"]);
    expect(nurgle.raiseDead!.victims).toEqual([]);
    expect(nurgle.raiseDead!.positions.map((p) => p.slug)).toEqual([ROTTER]);
    expect(nurgle.raiseDead!.choice).toBeNull();
    expect(nurgle.raiseDead!.canHire).toBe(true);
    expect(nurgle.raisedDead).toBeNull();
    // Les Skavens n'ont ni la règle spéciale ni le Trait.
    expect(skavenSide(opened).raiseDead).toBeUndefined();
  });

  it("une agression mortelle ne contamine pas ; un blocage mortel d'un Pourri oui — et le Contaminé rejoint la feuille au prix du poste", async () => {
    const before = await readSheet();
    const rotter = nurgleSide(before).players[0];
    victim = skavenSide(before).players[0];
    fouled = skavenSide(before).players[1];

    // Agression qui tue : la victime est bien morte, mais pas contaminable.
    const foul = await rawPost(`${s.url}/events`, s.plagueToken, {
      kind: "aggression",
      team: s.side,
      actorPlayerId: rotter.id,
      targetPlayerId: fouled.id,
      injurySeverity: "dead",
    });
    expect(foul.status, await bodyOf(foul)).toBe(201);
    expect(nurgleSide(await readSheet()).raiseDead!.victims).toEqual([]);

    // Blocage qui tue : contaminable.
    const kill = await rawPost(`${s.url}/events`, s.plagueToken, {
      kind: "casualty",
      team: s.side,
      actorPlayerId: rotter.id,
      targetPlayerId: victim.id,
      injurySeverity: "dead",
    });
    expect(kill.status, await bodyOf(kill)).toBe(201);
    const afterKill = await readSheet();
    expect(nurgleSide(afterKill).raiseDead!.victims).toEqual([
      expect.objectContaining({ id: victim.id, source: "plague_ridden" }),
    ]);

    const raiseUrl = `${s.url}/raise-dead`;
    // La victime de l'agression n'est pas relevable.
    const fromFoul = await rawPatch(raiseUrl, s.plagueToken, {
      side: s.side,
      victimId: fouled.id,
    });
    expect(fromFoul.status).toBe(400);
    // Le coach skaven ne relève pas pour l'autre camp… ni pour le sien.
    const wrongCoach = await rawPatch(raiseUrl, s.ratToken, {
      side: s.side,
      victimId: victim.id,
    });
    expect(wrongCoach.status).toBe(403);
    const noRule = await rawPatch(raiseUrl, s.ratToken, {
      side: s.otherSide,
      victimId: rotter.id,
    });
    expect(noRule.status).toBe(409);

    const raise = await rawPatch(raiseUrl, s.plagueToken, {
      side: s.side,
      victimId: victim.id,
    });
    expect(raise.status, await bodyOf(raise)).toBe(200);

    const sheet = await readSheet();
    const nurgle = nurgleSide(sheet);
    expect(nurgle.raiseDead!.choice).toEqual({
      victimId: victim.id,
      position: null,
    });
    raised = nurgle.raisedDead!;
    expect(raised).toBeTruthy();
    expect(raised).toMatchObject({
      id: `raised-${s.side}-1`,
      // 11 joueurs au roster : le Contaminé prend le n°12.
      number: 12,
      name: victim.name,
      position: ROTTER,
      positionName: "Contaminé (Trois-Quart Putrescent)",
      cost: ROTTER_COST,
      victimId: victim.id,
      source: "plague_ridden",
      // « De la même manière que les Joueurs Journaliers » : il se paie.
      hireCost: ROTTER_COST,
    });
    // Compétences du poste (lues en base), SANS Solitaire.
    const skills = raised.skills.split(",");
    expect(skills).toContain("contagieux");
    expect(skills).toContain("decay");
    expect(skills.some((sk) => sk.startsWith("loner"))).toBe(false);
  });

  it("le Contaminé joue : TD à 2 PSP et sortie à 3 (Bagarreurs Brutaux), et la feuille sert son tirage « Hasard »", async () => {
    const td = await rawPost(`${s.url}/events`, s.plagueToken, {
      kind: "touchdown",
      team: s.side,
      actorPlayerId: raised.id,
    });
    expect(td.status, await bodyOf(td)).toBe(201);
    // Nurgle porte « Bagarreurs Brutaux » : en Ligue, un TD ne vaut que 2 PSP
    // (et une sortie 3) — le barème du CÔTÉ s'applique au Contaminé.
    expect((await readSheet()).computedSpp[raised.id]).toBe(2);

    // Le Contaminé (Trait Contagieux lui aussi) blesse un troisième Skaven :
    // 3 PSP de plus, de quoi payer un tirage « Hasard » (3 PSP).
    const bruised = skavenSide(await readSheet()).players[2];
    const cas = await rawPost(`${s.url}/events`, s.plagueToken, {
      kind: "casualty",
      team: s.side,
      actorPlayerId: raised.id,
      targetPlayerId: bruised.id,
      injurySeverity: "badly_hurt",
    });
    expect(cas.status, await bodyOf(cas)).toBe(201);
    const sheet = await readSheet();
    expect(sheet.computedSpp[raised.id]).toBe(5);

    const rollUrl = `${s.url}/journeymen/${raised.id}/roll-random-primary`;
    const res = await rawPost(rollUrl, s.plagueToken, { category: "G" });
    expect(res.status, await bodyOf(res)).toBe(200);
    const roll = unwrap(
      (await res.json()) as { data: { candidates: string[] } },
    );
    candidates = roll.candidates;
    expect(candidates).toHaveLength(2);
    expect(new Set(candidates).size).toBe(2);
    for (const slug of candidates) {
      expect(slug.length).toBeGreaterThan(0);
      expect(raised.skills.split(",")).not.toContain(slug);
    }
    // Déterministe : relancer redonne la même paire.
    const again = unwrap(
      (await (
        await rawPost(rollUrl, s.plagueToken, { category: "G" })
      ).json()) as {
        data: { candidates: string[] };
      },
    );
    expect(again.candidates).toEqual(candidates);
    // Agilité n'est pas Principale pour un Trois-Quart Putrescent (G,M).
    const wrongCategory = await rawPost(rollUrl, s.plagueToken, {
      category: "A",
    });
    expect(wrongCategory.status).toBe(400);
  });

  it("son évolution stagée est acceptée par le PATCH d'après-match", async () => {
    const staged = {
      playerId: raised.id,
      type: "random-primary",
      category: "G",
      skillSlug: candidates[0],
    };
    const res = await rawPatch(`${s.url}/post-match`, s.plagueToken, {
      [sideKey(s.side, "advancements")]: [staged],
    });
    expect(res.status, await bodyOf(res)).toBe(200);
    const sheet = await readSheet();
    const entries = parseList(
      sheet.sheet[sideKey(s.side, "advancements") as "advancementsHome"],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject(staged);
  });

  it("recruté AU PRIX DU POSTE à l'étape EMBAUCHES : Pourri au roster, compétence tirée, poste + surcoût débités malgré un 0 saisi, les morts restent morts", async () => {
    // Le coach saisit 0 : le serveur applique le prix du journalier.
    const purchase = await rawPatch(`${s.url}/post-match`, s.plagueToken, {
      [sideKey(s.side, "winnings") + "Manual"]: 100_000,
      [sideKey(s.side, "purchases")]: [
        { kind: "raised_dead", name: "", cost: 0 },
      ],
    });
    expect(purchase.status, await bodyOf(purchase)).toBe(200);

    const before = unwrap(
      await get<{ data: TeamDetailDTO }>(
        `/team/${s.nurgleTeamId}`,
        s.plagueToken,
      ),
    ).team;

    await post(`${s.url}/submit`, s.plagueToken, {});
    await post(`${s.url}/submit`, s.ratToken, {});
    await post(`${s.url}/validate`, s.plagueToken, {});

    const team = unwrap(
      await get<{ data: TeamDetailDTO }>(
        `/team/${s.nurgleTeamId}`,
        s.plagueToken,
      ),
    ).team;
    expect(team.players).toHaveLength(before.players.length + 1);
    const hired = team.players.find((p) => p.name === victim.name);
    expect(hired, "le Contaminé doit avoir rejoint le roster").toBeTruthy();
    expect(hired!.position).toBe(ROTTER);
    const skills = hired!.skills.split(",");
    expect(skills).toContain(candidates[0]);
    expect(skills).toContain("contagieux");
    expect(skills).toContain("decay");
    expect(skills.some((sk) => sk.startsWith("loner"))).toBe(false);
    // 5 PSP (TD 2 + sortie 3, Bagarreurs Brutaux) − 3 PSP du tirage « Hasard ».
    expect(hired!.spp).toBe(2);
    // Gains crédités, le poste ET le surcoût de l'évolution débités — malgré
    // le 0 saisi par le coach.
    expect(team.treasury).toBe(
      before.treasury + 100_000 - (ROTTER_COST + RANDOM_PRIMARY_SURCHARGE),
    );

    // Les Skavens tués restent morts : contaminer ne ressuscite personne.
    const skaven = unwrap(
      await get<{ data: TeamDetailDTO }>(`/team/${s.skavenTeamId}`, s.ratToken),
    ).team;
    for (const id of [victim.id, fouled.id]) {
      const dead = skaven.players.find((p) => p.id === id);
      if (dead) expect(dead.dead).toBe(true);
    }

    // L'entrée d'évolution du Contaminé est tracée « appliquée » (3 PSP).
    const validated = await readSheet();
    expect(validated.sheet.status).toBe("validated");
    const entries = parseList(
      validated.sheet[sideKey(s.side, "advancements") as "advancementsHome"],
    );
    expect(entries[0]).toMatchObject({
      playerId: raised.id,
      skillSlug: candidates[0],
      applied: true,
      cost: 3,
    });
  });
});
