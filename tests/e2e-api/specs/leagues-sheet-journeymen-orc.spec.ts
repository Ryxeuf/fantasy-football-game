/**
 * E2E API — journaliers de la feuille de match, du choix du poste au
 * recrutement, sur un roster à DEUX Trois-quarts (Orques : Orque 0-16,
 * Gobelin 0-4) dont UN SEUL fournit un journalier (livre p.94 : Trois-quart
 * de quantité 0-16).
 *
 * Rejoue sur une vraie base (SQLite, vrai serveur, deux coachs et un
 * commissaire) la chaîne remontée par le log de validation — chaque étape
 * est l'anomalie ou l'évolution qu'elle verrouille :
 *
 *  - E37  : la feuille ne propose que le Trois-quart Orque ; un choix
 *           « Gobelin » posé par le coach est ignoré — ni la VEA figée ni le
 *           roster « version du match » ne bougent ;
 *  - A163 : le journalier marque un TD ; ses PSP sont crédités et il atteint
 *           le palier que l'onglet Évolutions propose (3 PSP) ;
 *  - A162 : le tirage « Compétence Principale au hasard » lui est servi par
 *           la feuille — 2 candidats de la table Générale, déterministe,
 *           Agilité (Secondaire) refusée, et réservé au coach de son côté ;
 *  - A161 : l'évolution stagée pour lui est ACCEPTÉE par le PATCH
 *           d'après-match (plus de « Joueur journeyman-… hors de l'équipe ») ;
 *  - A138 : recruté à l'étape EMBAUCHES, il rejoint le roster comme
 *           Trois-quart Orque, avec la compétence tirée, sans Solitaire, ses
 *           PSP débités du tirage — au prix 50 000 (poste) + 20 000
 *           (évolution) po, débité de la trésorerie même si le coach a laissé
 *           le montant à 0 — et l'entrée est tracée « appliquée » ;
 *  - la feuille reste INVALIDABLE malgré ce recrutement (retour testeur du
 *    2026-09-19 : « Reversion impossible: purchase-consumed ») — le
 *    journalier quitte le roster et la trésorerie revient à son état d'avant.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { get, post, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

const ORC_LINEMAN = "orc_trois_quart_orque";
const GOBLIN_LINEMAN = "orc_trois_quart_gobelin";
/** Table « Compétence Principale au hasard » — Générales (p.121). */
const GENERAL_TABLE = [
  "block",
  "dauntless",
  "fend",
  "frenzy",
  "kick",
  "pro",
  "surefoot",
  "strip-ball",
  "sure-hands",
  "tackle",
  "provocation",
  "wrestle",
];
/** Compétences d'Élite de la table Générale (surcoût de valeur en plus). */
const ELITE_GENERAL = new Set(["block"]);

interface SheetJourneyman {
  id: string;
  number: number;
  name: string;
  position: string;
  positionName: string;
  cost: number;
  skills: string;
  stats: { ma: number; st: number; ag: number; pa: number | null; av: number };
}
interface SheetSide {
  teamId: string;
  /** VEA figée à l'ouverture de la feuille (journaliers compris). */
  currentValue: number;
  players: Array<{ id: string; name: string }>;
  journeymen?: SheetJourneyman[];
  journeymenOptions?: Array<{ slug: string; name: string }>;
  journeymenChoices?: string[];
}
interface SheetResponse {
  sheet: {
    status: string;
    rosterSnapshotHome?: unknown;
    rosterSnapshotAway?: unknown;
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
      ma: number;
      st: number;
      ag: number;
      pa: number | null;
      av: number;
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

/** Joueurs du roster figé (objet natif PG ou chaîne JSON du miroir sqlite). */
function frozenPositions(raw: unknown): string[] {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const players = (parsed as { players?: unknown } | null)?.players;
  return Array.isArray(players)
    ? players.map((p) => String((p as { position?: unknown }).position ?? ""))
    : [];
}

function parseList(raw: unknown): Array<Record<string, unknown>> {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
}

interface Scenario {
  url: string;
  side: Side;
  /** Coach de l'équipe qui aligne les journaliers. */
  coachToken: string;
  /** Coach adverse sur ce match. */
  opponentToken: string;
  commissionerToken: string;
  teamId: string;
  otherSide: Side;
}

/**
 * Quatre équipes orques, une saison lancée ; au round 1, l'extérieur blesse
 * deux joueurs du domicile (« rate le prochain match »). Au round suivant,
 * cette équipe aligne donc DEUX journaliers — le roster d'une équipe engagée
 * étant verrouillé, c'est le seul chemin réel vers un effectif incomplet.
 */
async function setupOrcJourneymen(prefix: string): Promise<Scenario> {
  const coaches = await Promise.all(
    ["a", "b", "c", "d"].map(async (key) => {
      const user = await seedAndLogin(`${prefix}-${key}@orc.test`, "pwd", key);
      const team = await createTeam(user.userId, `${prefix} Orcs ${key}`, "orc");
      return { ...user, teamId: team.teamId };
    }),
  );
  const [alice] = coaches;
  const tokens = new Map(coaches.map((c) => [c.userId, c.token]));

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", alice.token, {
      name: `${prefix} Orc League`,
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      alice.token,
      { name: "S1" },
    ),
  );
  for (const c of coaches) {
    await post(`/leagues/seasons/${season.id}/join`, c.token, {
      teamId: c.teamId,
    });
  }
  await post(`/leagues/seasons/${season.id}/start`, alice.token, {});

  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(
      `/leagues/seasons/${season.id}`,
      alice.token,
    ),
  );
  const first = detail.season.rounds[0].pairings[0];
  const victimTeamId = first.homeParticipant.team.id;
  const victimToken = tokens.get(first.homeParticipant.team.ownerId)!;
  const firstAwayToken = tokens.get(first.awayParticipant.team.ownerId)!;

  // Round 1 : deux joueurs du domicile ratent le prochain match.
  const url1 = sheetUrl(first.id);
  await post(url1, victimToken, {});
  const opened = unwrap(await get<{ data: SheetResponse }>(url1, victimToken));
  for (const victim of opened.teams.home!.players.slice(0, 2)) {
    const res = await rawPost(`${url1}/events`, firstAwayToken, {
      kind: "casualty",
      team: "away",
      actorPlayerId: opened.teams.away!.players[0].id,
      targetPlayerId: victim.id,
      injurySeverity: "mng",
    });
    expect(res.status, await bodyOf(res)).toBe(201);
  }
  await post(`${url1}/submit`, victimToken, {});
  await post(`${url1}/submit`, firstAwayToken, {});
  await post(`${url1}/validate`, alice.token, {});

  // Round suivant de l'équipe blessée.
  const after = unwrap(
    await get<{ data: SeasonDetailDTO }>(
      `/leagues/seasons/${season.id}`,
      alice.token,
    ),
  );
  const next = after.season.rounds
    .flatMap((r) => r.pairings)
    .find(
      (p) =>
        p.id !== first.id &&
        (p.homeParticipant.team.id === victimTeamId ||
          p.awayParticipant.team.id === victimTeamId),
    );
  expect(next, "l'équipe blessée doit rejouer plus tard").toBeTruthy();
  const side: Side =
    next!.homeParticipant.team.id === victimTeamId ? "home" : "away";
  const opponentOwner =
    side === "home"
      ? next!.awayParticipant.team.ownerId
      : next!.homeParticipant.team.ownerId;
  return {
    url: sheetUrl(next!.id),
    side,
    otherSide: side === "home" ? "away" : "home",
    coachToken: victimToken,
    opponentToken: tokens.get(opponentOwner)!,
    commissionerToken: alice.token,
    teamId: victimTeamId,
  };
}

describe("E2E API — journalier orque : poste, PSP, tirage « Hasard », évolution, recrutement (E37 / A161-A163 / A138)", () => {
  let s: Scenario;
  let jm: SheetJourneyman;
  let candidates: string[] = [];
  /** Compétence retenue parmi les candidats (hors Élite : prix stable). */
  let picked = "";
  /** État de l'équipe AVANT la validation (pour la reversion). */
  let rosterSizeBefore = 0;
  let treasuryBefore = 0;
  let ctvBefore = 0;

  const readSheet = async (): Promise<SheetResponse> =>
    unwrap(await get<{ data: SheetResponse }>(s.url, s.coachToken));
  const mySide = (sheet: SheetResponse): SheetSide =>
    s.side === "home" ? sheet.teams.home! : sheet.teams.away!;

  beforeAll(async () => {
    await resetDb();
    s = await setupOrcJourneymen("orc-jm");
    // L'adversaire n'a pas joué sa journée 1 : rencontre reportée, que la
    // garde d'ouverture réserve au commissaire.
    await post(s.url, s.commissionerToken, { force: true });
  });

  it("E37 — le roster orque ne propose que son Trois-quart 0-16 ; un choix « Gobelin » est ignoré", async () => {
    const opened = await readSheet();
    const team = mySide(opened);
    expect(team.journeymen?.length, "2 journaliers attendus").toBe(2);
    // p.94 : le Trois-quart Gobelin (0-4) ne fournit pas de journalier.
    expect(team.journeymenOptions?.map((o) => o.slug)).toEqual([ORC_LINEMAN]);
    expect(team.journeymen!.map((j) => [j.position, j.cost])).toEqual([
      [ORC_LINEMAN, 50_000],
      [ORC_LINEMAN, 50_000],
    ]);
    const frozenBefore = frozenPositions(
      opened.sheet[sideKey(s.side, "rosterSnapshot") as "rosterSnapshotHome"],
    );
    expect(
      frozenBefore.filter((p) => p === "Journalier (Trois-quart Orque)"),
    ).toHaveLength(2);
    ctvBefore = team.currentValue;
    expect(ctvBefore).toBeGreaterThan(0);

    // Un client qui pose quand même le Gobelin (rang 0) n'obtient rien.
    const patched = await rawPatch(`${s.url}/pre-match`, s.coachToken, {
      [sideKey(s.side, "journeymenChoices")]: [GOBLIN_LINEMAN, null],
    });
    expect(patched.status, await bodyOf(patched)).toBe(200);

    const after = await readSheet();
    const teamAfter = mySide(after);
    expect(teamAfter.journeymenChoices).toEqual([ORC_LINEMAN, ORC_LINEMAN]);
    jm = teamAfter.journeymen![0];
    expect(jm.position).toBe(ORC_LINEMAN);
    expect(jm.positionName).toBe("Journalier (Trois-quart Orque)");
    expect(jm.cost).toBe(50_000);
    expect(jm.stats).toMatchObject({ ma: 5, st: 3, av: 10 });
    // Poste sans compétence de base : Solitaire seul (journalier).
    expect(jm.skills.split(",")).toEqual(["loner-4"]);
    // Ni la VEA figée ni le roster « version du match » ne bougent.
    expect(teamAfter.currentValue).toBe(ctvBefore);
    const frozenAfter = frozenPositions(
      after.sheet[sideKey(s.side, "rosterSnapshot") as "rosterSnapshotHome"],
    );
    expect(
      frozenAfter.filter((p) => p === "Journalier (Trois-quart Orque)"),
    ).toHaveLength(2);
    expect(
      frozenAfter.filter((p) => p === "Journalier (Trois-quart Gobelin)"),
    ).toHaveLength(0);
  });

  it("A163 — le journalier marque : ses PSP sont crédités, il atteint le palier d'évolution", async () => {
    const res = await rawPost(`${s.url}/events`, s.coachToken, {
      kind: "touchdown",
      team: s.side,
      actorPlayerId: jm.id,
    });
    expect(res.status, await bodyOf(res)).toBe(201);
    const sheet = await readSheet();
    // TD = 3 PSP : le coût du 1er palier « Hasard » (l'éditeur liste le
    // journalier dès que ses PSP du match atteignent ce palier).
    expect(sheet.computedSpp[jm.id]).toBe(3);
    expect(mySide(sheet).journeymen![0]).toMatchObject({
      id: jm.id,
      position: ORC_LINEMAN,
    });
  });

  it("A162 — la feuille sert le tirage « Compétence Principale au hasard » du journalier", async () => {
    const rollUrl = `${s.url}/journeymen/${jm.id}/roll-random-primary`;
    const res = await rawPost(rollUrl, s.coachToken, { category: "G" });
    expect(res.status, await bodyOf(res)).toBe(200);
    const roll = unwrap(
      (await res.json()) as {
        data: { rolled: boolean; category: string; candidates: string[] };
      },
    );
    candidates = roll.candidates;
    expect(roll.category).toBe("G");
    expect(candidates).toHaveLength(2);
    for (const slug of candidates) {
      expect(GENERAL_TABLE).toContain(slug);
    }
    picked = candidates.find((c) => !ELITE_GENERAL.has(c)) ?? candidates[0];
    expect(ELITE_GENERAL.has(picked)).toBe(false);

    // Déterministe : relancer redonne la même paire.
    const again = unwrap(
      (await (await rawPost(rollUrl, s.coachToken, { category: "G" })).json()) as {
        data: { candidates: string[] };
      },
    );
    expect(again.candidates).toEqual(candidates);

    // Agilité n'est pas Principale pour un Trois-quart Orque (G,S).
    const wrongCategory = await rawPost(rollUrl, s.coachToken, {
      category: "A",
    });
    expect(wrongCategory.status).toBe(400);

    // Le coach adverse ne tire pas pour les journaliers de l'autre côté.
    const wrongSide = await rawPost(rollUrl, s.opponentToken, {
      category: "G",
    });
    expect(wrongSide.status).toBeGreaterThanOrEqual(400);
  });

  it("A161 — l'évolution stagée pour le journalier est acceptée (plus de « hors de l'équipe »)", async () => {
    const staged = {
      playerId: jm.id,
      type: "random-primary",
      category: "G",
      skillSlug: picked,
    };
    const res = await rawPatch(`${s.url}/post-match`, s.coachToken, {
      [sideKey(s.side, "advancements")]: [staged],
    });
    expect(res.status, await bodyOf(res)).toBe(200);
    const sheet = await readSheet();
    const entries = parseList(
      sheet.sheet[sideKey(s.side, "advancements") as "advancementsHome"],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject(staged);

    // Un journalier de l'AUTRE côté reste refusé.
    const foreign = await rawPatch(`${s.url}/post-match`, s.coachToken, {
      [sideKey(s.side, "advancements")]: [
        { ...staged, playerId: `journeyman-${s.otherSide}-1` },
      ],
    });
    expect(foreign.status).toBeGreaterThanOrEqual(400);
  });

  it("A138 — recruté à l'étape EMBAUCHES : Trois-quart Orque, compétence tirée, sans Solitaire, au prix poste + évolution débité de la trésorerie", async () => {
    // Le coach laisse le montant à 0 : c'est le serveur qui fixe le prix.
    const purchase = await rawPatch(`${s.url}/post-match`, s.coachToken, {
      [sideKey(s.side, "winnings") + "Manual"]: 200_000,
      [sideKey(s.side, "purchases")]: [
        { kind: "journeyman", name: jm.name, cost: 0, journeymanId: jm.id },
      ],
    });
    expect(purchase.status, await bodyOf(purchase)).toBe(200);

    const before = unwrap(
      await get<{ data: TeamDetailDTO }>(`/team/${s.teamId}`, s.coachToken),
    ).team;
    rosterSizeBefore = before.players.length;
    treasuryBefore = before.treasury;

    await post(`${s.url}/submit`, s.coachToken, {});
    await post(`${s.url}/submit`, s.opponentToken, {});
    await post(`${s.url}/validate`, s.commissionerToken, {});

    const team = unwrap(
      await get<{ data: TeamDetailDTO }>(`/team/${s.teamId}`, s.coachToken),
    ).team;
    const hired = team.players.find((p) => p.name === jm.name);
    expect(hired, "le journalier doit avoir rejoint le roster").toBeTruthy();
    expect(hired!.position).toBe(ORC_LINEMAN);
    expect(hired).toMatchObject({ ma: 5, st: 3, av: 10 });
    const skills = hired!.skills.split(",");
    // Compétence tirée conservée, Solitaire retiré.
    expect(skills).toContain(picked);
    expect(skills.some((sk) => sk.startsWith("loner"))).toBe(false);
    // 3 PSP gagnés − 3 PSP du tirage « Hasard ».
    expect(hired!.spp).toBe(0);
    // Prix : 50 000 (Trois-quart Orque) + 20 000 (évolution) — débité même
    // si le coach a saisi 0 ; les 200 000 po de gains sont crédités.
    expect(team.treasury).toBe(before.treasury + 200_000 - 70_000);

    // L'entrée d'évolution du journalier est tracée « appliquée » (3 PSP).
    const validated = await readSheet();
    expect(validated.sheet.status).toBe("validated");
    const entries = parseList(
      validated.sheet[sideKey(s.side, "advancements") as "advancementsHome"],
    );
    expect(entries[0]).toMatchObject({
      playerId: jm.id,
      skillSlug: picked,
      applied: true,
      cost: 3,
    });
  });

  it("le commissaire peut INVALIDER la feuille malgré le recrutement du journalier : il quitte le roster, l'or revient", async () => {
    // Retour testeur (Discord, 2026-09-19) : le journalier recruté porte
    // 1 match joué et son évolution DU MATCH dès sa création — le garde-fou
    // les lisait comme un usage POSTÉRIEUR et refusait l'invalidation.
    const canInval = unwrap(
      await get<{ data: { ok: boolean } }>(
        `${s.url}/can-invalidate`,
        s.commissionerToken,
      ),
    );
    expect(canInval.ok).toBe(true);
    const inval = await rawPost(`${s.url}/invalidate`, s.commissionerToken, {
      reason: "E2E — journalier recruté",
    });
    expect(inval.status, await bodyOf(inval)).toBe(200);
    expect((await readSheet()).sheet.status).toBe("invalidated");

    const team = unwrap(
      await get<{ data: TeamDetailDTO }>(`/team/${s.teamId}`, s.coachToken),
    ).team;
    expect(team.players).toHaveLength(rosterSizeBefore);
    expect(team.players.find((p) => p.name === jm.name)).toBeUndefined();
    // Gains annulés, prix du recrutement rendu : retour exact.
    expect(team.treasury).toBe(treasuryBefore);
  });
});
