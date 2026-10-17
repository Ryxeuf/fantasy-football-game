/**
 * Carrière d'un joueur TOUTES compétitions, telle que l'affichent la carte
 * joueur, la page carrière, l'export PDF du roster et la console admin.
 *
 * Le serveur la calcule (`services/player-career-stats`) : compteurs de
 * `TeamPlayer` + tout ce que le joueur a fait en COUPE (une feuille de coupe
 * n'écrit rien sur les équipes) + ses matchs de LIGUE joués sans évènement.
 * Ce module ne fait que la LIRE, avec repli sur les compteurs bruts face à
 * un serveur antérieur (cf. « Backwards-compat sur champs API ajoutés »).
 *
 * PUR : testable sans DOM ni réseau.
 */

export interface CareerCounters {
  readonly matchesPlayed: number;
  readonly touchdowns: number;
  readonly casualties: number;
  readonly completions: number;
  readonly interceptions: number;
  readonly mvpAwards: number;
}

export interface PlayerCareer extends CareerCounters {
  /** Solde de PSP du joueur (une coupe n'en rapporte pas). */
  readonly spp: number;
  /** Part de la coupe, quand le serveur la sert. */
  readonly cup?: CareerCounters;
}

/** Compteurs bruts d'un `TeamPlayer` (payload `/team/:id`, `/admin/teams/:id`). */
export interface RawPlayerCounters {
  readonly id?: string;
  readonly spp?: number | null;
  readonly matchesPlayed?: number | null;
  readonly totalTouchdowns?: number | null;
  readonly totalCasualties?: number | null;
  readonly totalCompletions?: number | null;
  readonly totalInterceptions?: number | null;
  readonly totalMvpAwards?: number | null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readCounters(raw: unknown): CareerCounters | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.matchesPlayed !== "number") return null;
  return {
    matchesPlayed: count(r.matchesPlayed),
    touchdowns: count(r.touchdowns),
    casualties: count(r.casualties),
    completions: count(r.completions),
    interceptions: count(r.interceptions),
    mvpAwards: count(r.mvpAwards),
  };
}

/** Carrière servie par le serveur, sinon les compteurs bruts du joueur. */
export function resolvePlayerCareer(
  player: RawPlayerCounters,
  served?: Record<string, unknown> | null,
): PlayerCareer {
  const entry = player.id && served ? served[player.id] : undefined;
  const counters = readCounters(entry);
  if (counters) {
    const e = entry as Record<string, unknown>;
    const cup = readCounters(e.cup);
    return {
      ...counters,
      spp: typeof e.spp === "number" ? e.spp : count(player.spp),
      ...(cup ? { cup } : {}),
    };
  }
  return {
    matchesPlayed: count(player.matchesPlayed),
    touchdowns: count(player.totalTouchdowns),
    casualties: count(player.totalCasualties),
    completions: count(player.totalCompletions),
    interceptions: count(player.totalInterceptions),
    mvpAwards: count(player.totalMvpAwards),
    spp: count(player.spp),
  };
}
