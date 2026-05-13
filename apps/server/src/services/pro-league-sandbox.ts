/**
 * Pro League sandbox / test match service — Lot 2.C.2.
 *
 * Permet à un admin de lancer un match Pro League depuis l'admin
 * sans impact ELO / standings / paris / wallet / Hall of Fame /
 * drift baseline. Les matchs créés ici portent `isTest=true` (Lot
 * 2.C.1) et sont filtrés par les services agrégateurs (Lot 2.C.3).
 *
 * Pourquoi un service séparé du sim-runner
 * ----------------------------------------
 * Le sim-runner (`pro-league-sim-runner.ts`) gère les matchs déjà
 * scheduled par le scheduler (round-robin). Il choisit l'engineVer,
 * dérive le seed du `matchId`, etc. Pour le sandbox on veut :
 *   - choisir librement homeTeamId / awayTeamId (pas forcément un
 *     pairing du round-robin)
 *   - optionnellement override le seed (pour reproduire un bug)
 *   - optionnellement choisir le driver (`hybrid` / `full` quand
 *     Lot 3.B.1 introduira le toggle)
 *   - simuler immédiatement (pas attendre le tick du runner)
 *   - retourner directement l'id pour que l'UI redirige vers le
 *     replay
 *
 * Persistance
 * -----------
 * Tous les sandbox matchs vivent dans la **dernière saison active**
 * (`status='in_progress'`), dans un round dédié `roundNumber=0`
 * réservé au sandbox. Cette convention garde les FK intactes (un
 * match doit toujours appartenir à un round + une saison) sans
 * créer un modèle séparé. Le filtre `isTest=true` (Lot 2.C.1) suffit
 * à exclure ces matchs des stats.
 *
 * Idempotence du round sandbox
 * ----------------------------
 * Le round `roundNumber=0` est créé à la demande (`upsert` sur
 * la contrainte composite `[seasonId, roundNumber]` du schema).
 * Les sandbox matchs accumulent dans ce même round.
 */

import { ENGINE_VER as CURRENT_ENGINE_VER } from "@bb/sim-engine";

import { prisma } from "../prisma";
import { isValidDriverKind } from "./pro-league-driver-resolver";
import { simulateProMatch } from "./pro-league-sim-runner";

const SANDBOX_ROUND_NUMBER = 0;

export interface CreateTestMatchInput {
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  /** Override seed for reproducibility (optional, default = derived from cuid). */
  readonly seed?: number;
  /**
   * Lot 3.B.1 — override optionnel du driver de simulation. Si fourni,
   * persisté dans `ProLeagueMatch.driverKindOverride` ; le sim-runner
   * utilisera cette valeur plutôt que le default de la saison. Permet
   * à l'admin de tester un match en `full` driver sans changer la
   * saison entière (ou inversement de re-jouer un match en `hybrid`
   * après bug `full`).
   */
  readonly driverKind?: "hybrid" | "full";
}

export interface CreateTestMatchResult {
  readonly matchId: string;
  readonly seasonId: string;
  readonly engineVer: string;
}

/**
 * Trouve la saison active la plus récente. Les matchs sandbox vivent
 * dans la même saison que les matchs prod (mais sont marqués
 * `isTest=true` pour exclusion des stats).
 *
 * Throw si aucune saison active n'existe — évite de créer des sandbox
 * matchs orphelins.
 */
async function findLatestActiveSeason(): Promise<{
  id: string;
  engineVer: string;
}> {
  const season = await prisma.proLeagueSeason.findFirst({
    where: { status: "in_progress" },
    orderBy: { year: "desc" },
    select: { id: true, engineVer: true },
  });
  if (!season) {
    throw new Error(
      "Aucune saison Pro League active — créez d'abord une saison via le scheduler avant de lancer un sandbox match.",
    );
  }
  return { id: season.id as string, engineVer: season.engineVer as string };
}

/**
 * Récupère ou crée le round sandbox (`roundNumber=0`) de la saison
 * fournie. Idempotent grâce à la contrainte unique `[seasonId,
 * roundNumber]` côté schema.
 */
async function ensureSandboxRound(seasonId: string): Promise<string> {
  const existing = await prisma.proLeagueRound.findUnique({
    where: {
      seasonId_roundNumber: {
        seasonId,
        roundNumber: SANDBOX_ROUND_NUMBER,
      },
    },
    select: { id: true },
  });
  if (existing) return existing.id as string;

  const created = await prisma.proLeagueRound.create({
    data: {
      seasonId,
      roundNumber: SANDBOX_ROUND_NUMBER,
      status: "completed",
    },
    select: { id: true },
  });
  return created.id as string;
}

/**
 * Crée un sandbox match (`isTest=true`) entre deux équipes Pro
 * League, le simule immédiatement, et retourne le matchId pour que
 * l'UI puisse rediriger vers le replay.
 *
 * Erreur explicite si :
 *   - homeTeamId === awayTeamId
 *   - une team n'existe pas
 *   - aucune saison active
 *
 * Side-effects :
 *   - upsert d'un round sandbox (`roundNumber=0`)
 *   - INSERT d'un ProLeagueMatch avec status='scheduled', isTest=true
 *   - simulateProMatch synchrone (durée ~50ms en hybrid)
 */
export async function createTestMatch(
  input: CreateTestMatchInput,
): Promise<CreateTestMatchResult> {
  if (input.homeTeamId === input.awayTeamId) {
    throw new Error("homeTeamId et awayTeamId doivent être distincts");
  }

  // L'UI admin envoie les slugs (PRO_LEAGUE_TEAMS[i].id = slug, ex.
  // "kc-soaring-hawks"). On resout le slug → id Prisma (cuid) pour
  // l'insertion dans ProLeagueMatch (FK vers ProTeam.id).
  const teams = (await prisma.proTeam.findMany({
    where: { slug: { in: [input.homeTeamId, input.awayTeamId] } },
    select: { id: true, slug: true },
  })) as Array<{ id: string; slug: string }>;
  if (teams.length !== 2) {
    const found = new Set(teams.map((t) => t.slug));
    const missing = [input.homeTeamId, input.awayTeamId].filter(
      (slug) => !found.has(slug),
    );
    throw new Error(`Teams introuvables : ${missing.join(", ")}`);
  }
  const homeTeam = teams.find((t) => t.slug === input.homeTeamId)!;
  const awayTeam = teams.find((t) => t.slug === input.awayTeamId)!;

  const season = await findLatestActiveSeason();
  const roundId = await ensureSandboxRound(season.id);

  // Lot 3.B.1 — propage l'override driverKind si valide ; sinon
  // null = la saison fournit le default. Validation defense-in-depth
  // au cas où la couche route oublie le check Zod.
  const driverKindOverride =
    input.driverKind && isValidDriverKind(input.driverKind)
      ? input.driverKind
      : null;

  const created = await prisma.proLeagueMatch.create({
    data: {
      seasonId: season.id,
      roundId,
      // FK vers ProTeam.id (cuid), pas le slug.
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      status: "scheduled",
      scheduledAt: new Date(),
      isTest: true,
      driverKindOverride,
    },
    select: { id: true },
  });
  const matchId = created.id as string;

  // Simulate immediately. Le sim-runner observe les métriques
  // Prometheus comme un match prod (Lot 2.A.3). Les guards (Lot
  // 2.C.3) excluent ces matchs des agrégateurs.
  await simulateProMatch(matchId);

  return {
    matchId,
    seasonId: season.id,
    engineVer: season.engineVer || CURRENT_ENGINE_VER,
  };
}

export interface TestMatchSummary {
  readonly id: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly status: string;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: string | null;
  readonly engineVer: string | null;
  readonly createdAt: string;
  readonly simulatedAt: string | null;
}

/**
 * Liste les N derniers sandbox matchs lancés (UI admin Lot 2.C.4).
 * Ordre décroissant sur `createdAt`. Limite par défaut 20, max 100.
 */
export async function listTestMatches(
  limit = 20,
): Promise<TestMatchSummary[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await prisma.proLeagueMatch.findMany({
    where: { isTest: true },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      status: true,
      scoreHome: true,
      scoreAway: true,
      outcome: true,
      engineVer: true,
      createdAt: true,
      simulatedAt: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });
  type Row = (typeof rows)[number];
  return (rows as Row[]).map((row) => ({
    id: row.id as string,
    homeTeamId: row.homeTeamId as string,
    awayTeamId: row.awayTeamId as string,
    homeTeamName: (row.homeTeam.name as string) ?? "",
    awayTeamName: (row.awayTeam.name as string) ?? "",
    status: row.status as string,
    scoreHome: row.scoreHome as number | null,
    scoreAway: row.scoreAway as number | null,
    outcome: row.outcome as string | null,
    engineVer: row.engineVer as string | null,
    createdAt: (row.createdAt as Date).toISOString(),
    simulatedAt: row.simulatedAt
      ? (row.simulatedAt as Date).toISOString()
      : null,
  }));
}

export interface ResimulateTestMatchInput {
  readonly matchId: string;
  /** Optional driver override for the re-simulation. */
  readonly driverKind?: "hybrid" | "full";
}

export interface ResimulateTestMatchResult {
  readonly matchId: string;
  readonly engineVer: string;
  readonly driverKind: string | null;
}

/**
 * Re-simulate an existing sandbox match. Wipes the previous Replay,
 * resets the match to `scheduled` (so `simulateProMatch` will run),
 * optionally overrides the driver, then triggers a fresh simulation.
 *
 * Refuse explicit si `isTest !== true` — on ne re-simule pas un match
 * de prod (would corrupt standings / ELO / bets).
 */
export async function resimulateTestMatch(
  input: ResimulateTestMatchInput,
): Promise<ResimulateTestMatchResult> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: input.matchId },
    select: { id: true, isTest: true, season: { select: { engineVer: true } } },
  });
  if (!match) {
    throw new Error(`ProLeagueMatch '${input.matchId}' introuvable`);
  }
  if (match.isTest !== true) {
    throw new Error(
      `ProLeagueMatch '${input.matchId}' n'est pas un test match (isTest=false) — re-simulation refusée`,
    );
  }

  const driverKindOverride =
    input.driverKind && isValidDriverKind(input.driverKind)
      ? input.driverKind
      : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    await tx.replay.deleteMany({ where: { matchId: input.matchId } });
    await tx.proLeagueMatch.update({
      where: { id: input.matchId },
      data: {
        status: "scheduled",
        simulatedAt: null,
        completedAt: null,
        replayId: null,
        scoreHome: null,
        scoreAway: null,
        outcome: null,
        touchdownCount: null,
        casualtyCount: null,
        turnoverCount: null,
        nuffleCount: null,
        engineVer: null,
        driverKindOverride,
      },
    });
  });

  await simulateProMatch(input.matchId);

  return {
    matchId: input.matchId,
    engineVer: (match.season.engineVer as string) || CURRENT_ENGINE_VER,
    driverKind: driverKindOverride,
  };
}
