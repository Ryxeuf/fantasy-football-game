/**
 * Service de statistiques publiques pour la home (preuve sociale + GEO).
 *
 * Regroupe en un seul round-trip parallèle :
 *  - les compteurs « catalogue » (rosters officiels, Star Players,
 *    compétences) filtrés sur l'édition courante (Saison 3) ;
 *  - les compteurs « activité » (équipes créées par les coachs, comptes
 *    coachs, matchs suivis sur table).
 *
 * Le client est typé de façon structurelle (et non `PrismaClient`) afin
 * de pouvoir tester le service avec un faux léger, sans base de données.
 */

const CURRENT_RULESET = "season_3";

export interface PublicStats {
  /** Rosters officiels de l'édition courante (Saison 3). */
  rosters: number;
  /** Star Players de l'édition courante. */
  starPlayers: number;
  /** Compétences, mutations et traits de l'édition courante. */
  skills: number;
  /** Équipes créées par les coachs (activité). */
  teamsCreated: number;
  /** Comptes coachs (activité). */
  coaches: number;
  /** Matchs sur table suivis (activité). */
  matchesTracked: number;
}

interface CountArgs {
  where?: { ruleset?: string };
}

/** Sous-ensemble structurel de PrismaClient : juste les `.count()` utiles. */
export interface StatsCountClient {
  roster: { count(args?: CountArgs): Promise<number> };
  starPlayer: { count(args?: CountArgs): Promise<number> };
  skill: { count(args?: CountArgs): Promise<number> };
  team: { count(args?: CountArgs): Promise<number> };
  user: { count(args?: CountArgs): Promise<number> };
  localMatch: { count(args?: CountArgs): Promise<number> };
}

export async function gatherPublicStats(db: StatsCountClient): Promise<PublicStats> {
  const ruleset = { where: { ruleset: CURRENT_RULESET } };
  const [rosters, starPlayers, skills, teamsCreated, coaches, matchesTracked] =
    await Promise.all([
      db.roster.count(ruleset),
      db.starPlayer.count(ruleset),
      db.skill.count(ruleset),
      db.team.count(),
      db.user.count(),
      db.localMatch.count(),
    ]);

  return { rosters, starPlayers, skills, teamsCreated, coaches, matchesTracked };
}
