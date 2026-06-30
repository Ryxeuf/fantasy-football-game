import type { PrismaClient } from "@prisma/client";

/**
 * SPP (Star Player Points) values per action, following BB3 Season 2/3 rules:
 * - Touchdown: 3 SPP
 * - Casualty: 2 SPP
 * - Completion (pass): 1 SPP
 * - Interception: 1 SPP
 * - MVP: 4 SPP
 */
export const SPP_VALUES = {
  touchdown: 3,
  casualty: 2,
  completion: 1,
  interception: 1,
  mvp: 4,
} as const;

/**
 * L2.B.8 — Sprint Ligues v2 PR6 : override "Bagarreurs Brutaux".
 * En Jeu en Ligue uniquement, une equipe avec la regle speciale
 * `bagarreurs_brutaux` gagne 3 PSP (au lieu de 2) par Elimination
 * et 2 PSP (au lieu de 3) par Touchdown.
 */
const BAGARREURS_BRUTAUX_OVERRIDE = {
  touchdown: 2,
  casualty: 3,
} as const;

export interface PlayerMatchStats {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvp: boolean;
}

/**
 * FR18 — variante agregee (sur une saison) des stats SPP : `mvps` est un
 * compteur (vs le booleen par-match de `PlayerMatchStats`). Permet de
 * recalculer les PSP gagnes sur une saison entiere depuis les agregats
 * d'events + le nombre de titres de MVP.
 */
export interface PlayerAggregateStats {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvps: number;
}

export interface GameStateForSPP {
  matchStats: Record<string, PlayerMatchStats>;
  players: Array<{
    id: string;
    team: string;
    number: number;
  }>;
}

/**
 * L2.B.8 — Per-team SPP modifier. `bagarreursBrutaux=true` implique
 * que la team a la regle speciale et que le match est en Jeu en
 * Ligue (les modifs ne s'appliquent qu'en ligue, pas en match
 * amical).
 */
export interface TeamSPPModifier {
  readonly bagarreursBrutaux: boolean;
}

/**
 * L2.B.8 — Contexte SPP pour un match. `isLeagueMatch=false` desactive
 * tous les overrides (les regles s'appliquent uniquement en ligue
 * d'apres les regles BB officielles). Pour un match amical / cup, on
 * ignore `teamA/B.bagarreursBrutaux` meme si la regle est presente.
 */
export interface LeagueSPPContext {
  readonly isLeagueMatch: boolean;
  readonly teamA: TeamSPPModifier;
  readonly teamB: TeamSPPModifier;
}

const NEUTRAL_MODIFIER: TeamSPPModifier = { bagarreursBrutaux: false };
const NEUTRAL_CONTEXT: LeagueSPPContext = {
  isLeagueMatch: false,
  teamA: NEUTRAL_MODIFIER,
  teamB: NEUTRAL_MODIFIER,
};

/**
 * Calculate SPP earned by a player from their match stats. Applies
 * the per-team override `modifier` (default neutral = vanilla rules).
 */
export function calculatePlayerSPP(
  stats: PlayerMatchStats,
  modifier: TeamSPPModifier = NEUTRAL_MODIFIER,
): number {
  const useBagarreurs = modifier.bagarreursBrutaux;
  const tdValue = useBagarreurs
    ? BAGARREURS_BRUTAUX_OVERRIDE.touchdown
    : SPP_VALUES.touchdown;
  const casValue = useBagarreurs
    ? BAGARREURS_BRUTAUX_OVERRIDE.casualty
    : SPP_VALUES.casualty;
  return (
    stats.touchdowns * tdValue +
    stats.casualties * casValue +
    stats.completions * SPP_VALUES.completion +
    stats.interceptions * SPP_VALUES.interception +
    (stats.mvp ? SPP_VALUES.mvp : 0)
  );
}

/**
 * L2.B.8 — Helper qui charge `Roster.specialRules` (CSV de slugs)
 * pour les rosters de deux teams, et construit un `LeagueSPPContext`
 * exploitable par `persistMatchSPP`. Si la lecture echoue (ex:
 * SQLite test client sans modele Roster), on retourne le contexte
 * neutre (vanilla rules).
 */
export async function loadLeagueSPPContext(
  prisma: PrismaClient,
  args: {
    isLeagueMatch: boolean;
    teamARoster: string;
    teamBRoster: string;
  },
): Promise<LeagueSPPContext> {
  if (!args.isLeagueMatch) return NEUTRAL_CONTEXT;
  try {
    const rosters = await prisma.roster.findMany({
      where: { slug: { in: [args.teamARoster, args.teamBRoster] } },
      select: { slug: true, specialRules: true },
    });
    const bySlug = new Map(rosters.map((r) => [r.slug, r.specialRules ?? ""]));
    return {
      isLeagueMatch: true,
      teamA: rosterToModifier(bySlug.get(args.teamARoster) ?? ""),
      teamB: rosterToModifier(bySlug.get(args.teamBRoster) ?? ""),
    };
  } catch {
    return NEUTRAL_CONTEXT;
  }
}

/**
 * FR18 — PSP gagnes sur une periode (saison) a partir d'agregats. Reutilise
 * exactement les memes valeurs et le meme override "Bagarreurs Brutaux" que
 * `calculatePlayerSPP` (source unique `SPP_VALUES`), avec un compteur de MVP
 * (×4 PSP chacun) au lieu d'un booleen par-match.
 */
export function calculateAggregateSPP(
  stats: PlayerAggregateStats,
  modifier: TeamSPPModifier = NEUTRAL_MODIFIER,
): number {
  const useBagarreurs = modifier.bagarreursBrutaux;
  const tdValue = useBagarreurs
    ? BAGARREURS_BRUTAUX_OVERRIDE.touchdown
    : SPP_VALUES.touchdown;
  const casValue = useBagarreurs
    ? BAGARREURS_BRUTAUX_OVERRIDE.casualty
    : SPP_VALUES.casualty;
  return (
    stats.touchdowns * tdValue +
    stats.casualties * casValue +
    stats.completions * SPP_VALUES.completion +
    stats.interceptions * SPP_VALUES.interception +
    stats.mvps * SPP_VALUES.mvp
  );
}

/**
 * Convertit la chaine `Roster.specialRules` (CSV/whitespace de slugs) en
 * modificateur SPP d'equipe. Exporte pour FR18 (calcul des PSP de saison
 * par joueur selon la regle de son roster).
 */
export function rosterToModifier(specialRulesText: string): TeamSPPModifier {
  if (!specialRulesText) return NEUTRAL_MODIFIER;
  // Tolerant parsing : split on `,` (CSV) ou tout whitespace pour
  // accommoder les formats existants en base. Trim + lowercase.
  const parts = specialRulesText
    .split(/[,\s]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return {
    bagarreursBrutaux: parts.includes("bagarreurs_brutaux"),
  };
}

/**
 * Persist SPP earned during a match to the database TeamPlayer records.
 *
 * Maps game engine player IDs (e.g. "A7", "B3") to database TeamPlayer records
 * via team assignment + jersey number, then increments their career stats.
 *
 * @param prisma - Prisma client instance
 * @param gameState - The completed game state containing matchStats and players
 * @param teamAId - Database ID of team A
 * @param teamBId - Database ID of team B
 * @returns Number of players updated
 */
export async function persistMatchSPP(
  prisma: PrismaClient,
  gameState: GameStateForSPP,
  teamAId: string,
  teamBId: string,
  /**
   * L2.B.8 — Contexte SPP de match. Default = neutre (vanilla rules)
   * pour preserver la retro-compat avec tous les call-sites
   * existants (matchs amicaux, cups, AI practice). Le caller passe
   * un contexte non-neutre uniquement pour les matchs de ligue
   * dont une equipe a la regle "Bagarreurs Brutaux".
   */
  context: LeagueSPPContext = NEUTRAL_CONTEXT,
): Promise<number> {
  const { matchStats, players } = gameState;

  if (!matchStats || Object.keys(matchStats).length === 0) {
    return 0;
  }

  // Load all TeamPlayer records for both teams
  const [teamAPlayers, teamBPlayers] = await Promise.all([
    prisma.teamPlayer.findMany({
      where: { teamId: teamAId },
      select: { id: true, number: true },
    }),
    prisma.teamPlayer.findMany({
      where: { teamId: teamBId },
      select: { id: true, number: true },
    }),
  ]);

  // Build lookup: game engine player ID -> database TeamPlayer ID
  // + side ('A' or 'B') so we can apply the per-team modifier.
  const playerIdMap = new Map<string, { dbId: string; side: "A" | "B" }>();
  for (const dbPlayer of teamAPlayers) {
    playerIdMap.set(`A${dbPlayer.number}`, { dbId: dbPlayer.id, side: "A" });
  }
  for (const dbPlayer of teamBPlayers) {
    playerIdMap.set(`B${dbPlayer.number}`, { dbId: dbPlayer.id, side: "B" });
  }

  // Build one update per player: increment matchesPlayed + SPP stats if any
  const updates: Promise<unknown>[] = [];

  for (const gamePlayer of players) {
    const found = playerIdMap.get(gamePlayer.id);
    if (!found) continue;
    const { dbId: dbPlayerId, side } = found;
    const modifier = side === "A" ? context.teamA : context.teamB;

    const stats = matchStats[gamePlayer.id];
    const earnedSPP = stats ? calculatePlayerSPP(stats, modifier) : 0;

    updates.push(
      prisma.teamPlayer.update({
        where: { id: dbPlayerId },
        data: {
          matchesPlayed: { increment: 1 },
          // Clear missNextMatch flag — player has served their suspension by participating
          missNextMatch: false,
          ...(stats
            ? {
                spp: { increment: earnedSPP },
                totalTouchdowns: { increment: stats.touchdowns },
                totalCasualties: { increment: stats.casualties },
                totalCompletions: { increment: stats.completions },
                totalInterceptions: { increment: stats.interceptions },
                totalMvpAwards: { increment: stats.mvp ? 1 : 0 },
              }
            : {}),
        },
      }),
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates as any);
  }

  return updates.length;
}
