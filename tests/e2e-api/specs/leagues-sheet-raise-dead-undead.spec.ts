/**
 * E2E API — Maîtres de la Non-vie : « Relever le Mort » sur la feuille de
 * match, du décès de l'adversaire au recrutement GRATUIT, sur une vraie base
 * (SQLite, vrai serveur, deux coachs, le nécromant étant aussi commissaire).
 *
 * Retour testeur (Discord) : la règle n'existait pas — un coach mort-vivant
 * qui tuait un adversaire devait « gérer avec un achat de joueur lineman à
 * 0 ». Chaque étape verrouille un point de la règle :
 *
 *  - la feuille ne propose « Relever le Mort » QU'au porteur de la règle, avec
 *    ses deux Trois-quarts (Squelette, Zombie), et aucune victime tant que
 *    personne n'est mort ;
 *  - un adversaire tué devient relevable ; un vivant, un poste hors fiche et
 *    le coach adverse sont refusés ; le relevé rejoint la feuille en réserve,
 *    au numéro suivant, avec le nom du mort ;
 *  - il joue : un TD lui crédite 3 PSP, la feuille sert son tirage « Hasard »
 *    et son évolution stagée est acceptée ;
 *  - recruté à l'étape EMBAUCHES : Zombie au roster, compétence tirée, sans
 *    Solitaire, ZÉRO pièce d'or débitée même si le coach saisit un montant,
 *    entrée d'évolution tracée « appliquée » — et le mort adverse reste mort.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { get, post, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

const ZOMBIE = "undead_trois_quart_zombie";
const SKELETON = "undead_trois_quart_squelette";

interface SheetRaisedDead {
  id: string;
  number: number;
  name: string;
  position: string;
  positionName: string;
  skills: string;
  cost: number;
  victimId: string;
}
interface SheetSide {
  teamId: string;
  players: Array<{ id: string; number: number; name: string }>;
  raiseDead?: {
    victims: Array<{ id: string; name: string }>;
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
  /** Côté des Morts-Vivants. */
  side: Side;
  otherSide: Side;
  /** Coach mort-vivant, aussi commissaire de la ligue. */
  necroToken: string;
  humanToken: string;
  undeadTeamId: string;
  humanTeamId: string;
}

/** Une ligue à deux équipes : Morts-Vivants contre Skavens (Force 3). */
async function setupUndeadVsSkaven(prefix: string): Promise<Scenario> {
  const necro = await seedAndLogin(
    `${prefix}-necro@undead.test`,
    "pwd",
    "necro",
  );
  const human = await seedAndLogin(`${prefix}-rat@undead.test`, "pwd", "rat");
  const undeadTeam = await createTeam(
    necro.userId,
    `${prefix} Champs Funestes`,
    "undead",
  );
  const skavenTeam = await createTeam(human.userId, `${prefix} Rats`, "skaven");

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", necro.token, {
      name: `${prefix} Nécro League`,
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      necro.token,
      { name: "S1" },
    ),
  );
  await post(`/leagues/seasons/${season.id}/join`, necro.token, {
    teamId: undeadTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/join`, human.token, {
    teamId: skavenTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/start`, necro.token, {});

  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(
      `/leagues/seasons/${season.id}`,
      necro.token,
    ),
  );
  const pairing = detail.season.rounds[0].pairings[0];
  const side: Side =
    pairing.homeParticipant.team.id === undeadTeam.teamId ? "home" : "away";
  return {
    url: sheetUrl(pairing.id),
    side,
    otherSide: side === "home" ? "away" : "home",
    necroToken: necro.token,
    humanToken: human.token,
    undeadTeamId: undeadTeam.teamId,
    humanTeamId: skavenTeam.teamId,
  };
}

describe("E2E API — Maîtres de la Non-vie : Relever le Mort, du décès au recrutement gratuit", () => {
  let s: Scenario;
  let victim: { id: string; number: number; name: string };
  let raised: SheetRaisedDead;
  let candidates: string[] = [];

  const readSheet = async (): Promise<SheetResponse> =>
    unwrap(await get<{ data: SheetResponse }>(s.url, s.necroToken));
  const undeadSide = (sheet: SheetResponse): SheetSide =>
    s.side === "home" ? sheet.teams.home! : sheet.teams.away!;
  const skavenSide = (sheet: SheetResponse): SheetSide =>
    s.side === "home" ? sheet.teams.away! : sheet.teams.home!;

  beforeAll(async () => {
    await resetDb();
    s = await setupUndeadVsSkaven("raise-dead");
    await post(s.url, s.necroToken, {});
  });

  it("la feuille ne propose « Relever le Mort » qu'aux Morts-Vivants, avec leurs deux Trois-quarts et aucune victime", async () => {
    const opened = await readSheet();
    const undead = undeadSide(opened);
    expect(undead.raiseDead, "règle attendue côté Morts-Vivants").toBeTruthy();
    expect(undead.raiseDead!.victims).toEqual([]);
    expect(undead.raiseDead!.positions.map((p) => p.slug)).toEqual([
      SKELETON,
      ZOMBIE,
    ]);
    expect(undead.raiseDead!.choice).toBeNull();
    expect(undead.raiseDead!.canHire).toBe(true);
    expect(undead.raisedDead).toBeNull();
    // Les Skavens n'ont pas la règle.
    expect(skavenSide(opened).raiseDead).toBeUndefined();
  });

  it("un adversaire tué devient relevable ; vivant, poste hors fiche et coach adverse sont refusés ; le relevé rejoint la feuille en Zombie", async () => {
    const before = await readSheet();
    const necroPlayer = undeadSide(before).players[0];
    victim = skavenSide(before).players[0];
    const alive = skavenSide(before).players[1];

    const kill = await rawPost(`${s.url}/events`, s.necroToken, {
      kind: "casualty",
      team: s.side,
      actorPlayerId: necroPlayer.id,
      targetPlayerId: victim.id,
      injurySeverity: "dead",
    });
    expect(kill.status, await bodyOf(kill)).toBe(201);

    const afterKill = await readSheet();
    expect(undeadSide(afterKill).raiseDead!.victims.map((v) => v.id)).toEqual([
      victim.id,
    ]);

    const raiseUrl = `${s.url}/raise-dead`;
    // Un poste qui n'est pas un Trois-quart de la fiche.
    const badPosition = await rawPatch(raiseUrl, s.necroToken, {
      side: s.side,
      victimId: victim.id,
      position: "undead_momie",
    });
    expect(badPosition.status).toBe(400);
    // Un adversaire bien vivant.
    const aliveVictim = await rawPatch(raiseUrl, s.necroToken, {
      side: s.side,
      victimId: alive.id,
    });
    expect(aliveVictim.status).toBe(400);
    // Le coach skaven ne relève pas pour l'autre camp… ni pour le sien.
    const wrongCoach = await rawPatch(raiseUrl, s.humanToken, {
      side: s.side,
      victimId: victim.id,
    });
    expect(wrongCoach.status).toBe(403);
    const noRule = await rawPatch(raiseUrl, s.humanToken, {
      side: s.otherSide,
      victimId: necroPlayer.id,
    });
    expect(noRule.status).toBe(409);

    const raise = await rawPatch(raiseUrl, s.necroToken, {
      side: s.side,
      victimId: victim.id,
      position: ZOMBIE,
    });
    expect(raise.status, await bodyOf(raise)).toBe(200);

    const sheet = await readSheet();
    const undead = undeadSide(sheet);
    expect(undead.raiseDead!.choice).toEqual({
      victimId: victim.id,
      position: ZOMBIE,
    });
    raised = undead.raisedDead!;
    expect(raised).toBeTruthy();
    expect(raised).toMatchObject({
      id: `raised-${s.side}-1`,
      // 11 joueurs au roster : le relevé prend le n°12.
      number: 12,
      name: victim.name,
      position: ZOMBIE,
      positionName: "Mort relevé (Trois-quart Zombie)",
      cost: 40_000,
      victimId: victim.id,
    });
    // Compétences du poste (lues en base), SANS Solitaire.
    const skills = raised.skills.split(",");
    expect(skills).toContain("regeneration");
    expect(skills.some((sk) => sk.startsWith("loner"))).toBe(false);
  });

  it("le relevé joue : un TD lui crédite 3 PSP et la feuille sert son tirage « Hasard »", async () => {
    const td = await rawPost(`${s.url}/events`, s.necroToken, {
      kind: "touchdown",
      team: s.side,
      actorPlayerId: raised.id,
    });
    expect(td.status, await bodyOf(td)).toBe(201);
    const sheet = await readSheet();
    expect(sheet.computedSpp[raised.id]).toBe(3);

    const rollUrl = `${s.url}/journeymen/${raised.id}/roll-random-primary`;
    const res = await rawPost(rollUrl, s.necroToken, { category: "G" });
    expect(res.status, await bodyOf(res)).toBe(200);
    const roll = unwrap(
      (await res.json()) as { data: { candidates: string[] } },
    );
    candidates = roll.candidates;
    // Deux compétences distinctes, hors de celles du poste (Régénération).
    expect(candidates).toHaveLength(2);
    expect(new Set(candidates).size).toBe(2);
    for (const slug of candidates) {
      expect(slug.length).toBeGreaterThan(0);
      expect(raised.skills.split(",")).not.toContain(slug);
    }
    // Déterministe : relancer redonne la même paire.
    const again = unwrap(
      (await (
        await rawPost(rollUrl, s.necroToken, { category: "G" })
      ).json()) as {
        data: { candidates: string[] };
      },
    );
    expect(again.candidates).toEqual(candidates);
    // Agilité n'est pas Principale pour un Trois-quart Zombie (G,K).
    const wrongCategory = await rawPost(rollUrl, s.necroToken, {
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
    const res = await rawPatch(`${s.url}/post-match`, s.necroToken, {
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

  it("recruté GRATUITEMENT à l'étape EMBAUCHES : Zombie au roster, compétence tirée, rien de débité, le mort reste mort", async () => {
    // Le coach saisit un montant : le serveur l'ignore, le relevé est gratuit.
    const purchase = await rawPatch(`${s.url}/post-match`, s.necroToken, {
      [sideKey(s.side, "winnings") + "Manual"]: 100_000,
      [sideKey(s.side, "purchases")]: [
        { kind: "raised_dead", name: "", cost: 40_000 },
      ],
    });
    expect(purchase.status, await bodyOf(purchase)).toBe(200);

    const before = unwrap(
      await get<{ data: TeamDetailDTO }>(
        `/team/${s.undeadTeamId}`,
        s.necroToken,
      ),
    ).team;

    await post(`${s.url}/submit`, s.necroToken, {});
    await post(`${s.url}/submit`, s.humanToken, {});
    await post(`${s.url}/validate`, s.necroToken, {});

    const team = unwrap(
      await get<{ data: TeamDetailDTO }>(
        `/team/${s.undeadTeamId}`,
        s.necroToken,
      ),
    ).team;
    expect(team.players).toHaveLength(before.players.length + 1);
    const hired = team.players.find((p) => p.name === victim.name);
    expect(hired, "le mort relevé doit avoir rejoint le roster").toBeTruthy();
    expect(hired!.position).toBe(ZOMBIE);
    const skills = hired!.skills.split(",");
    expect(skills).toContain(candidates[0]);
    expect(skills).toContain("regeneration");
    expect(skills.some((sk) => sk.startsWith("loner"))).toBe(false);
    // 3 PSP du TD − 3 PSP du tirage « Hasard ».
    expect(hired!.spp).toBe(0);
    // Gains crédités, ZÉRO débit pour le relevé — malgré les 40 000 saisis.
    expect(team.treasury).toBe(before.treasury + 100_000);

    // Le Skaven tué reste mort : relever le mort ne le ressuscite pas.
    const skaven = unwrap(
      await get<{ data: TeamDetailDTO }>(
        `/team/${s.humanTeamId}`,
        s.humanToken,
      ),
    ).team;
    const dead = skaven.players.find((p) => p.id === victim.id);
    if (dead) expect(dead.dead).toBe(true);

    // L'entrée d'évolution du relevé est tracée « appliquée » (3 PSP).
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
