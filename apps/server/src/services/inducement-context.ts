/**
 * Contexte de Coups de Pouce d'une équipe, résolu EN BASE.
 *
 * Le match en ligne et le match local construisaient leur `InducementContext`
 * avec `regionalRules: []` codé en dur et sans `specialRules`. Conséquences
 * (S10 de l'audit) :
 *   - toutes les remises officielles perdues (Pots-de-vin 100 k au lieu de
 *     50 k, Arbitre partial 120 k au lieu de 80 k, Chef cuistot 300 k au lieu
 *     de 100 k chez les Halflings) ;
 *   - plafonds majorés ignorés (Pots-de-vin 0-6) ;
 *   - coups de pouce conditionnels (`mortuary_assistant`, `plague_doctor`,
 *     `riotous_rookies`) refusés à TOUTES les équipes ;
 *   - `Team.regionalLeague` totalement ignoré.
 *
 * Le catalogue de Star Players engageables est lui aussi résolu ici
 * (`StarPlayer` en base, filtré par les règles régionales effectives) : c'était
 * la dernière donnée de catalogue lue en dur dans le runtime du moteur, et un
 * `StarPlayer.cost` corrigé en admin changeait la feuille de ligue mais pas le
 * match en ligne (S11).
 *
 * Tolérant de bout en bout : une lecture en échec dégrade vers le repli
 * catalogue plutôt que de faire échouer la phase de coups de pouce.
 */

import {
  DEFAULT_RULESET,
  resolveTeamRegionalRules,
  type InducementContext,
  type Ruleset,
  type TeamId,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { getDeclaredRegionalRules } from "../utils/roster-helpers";
import { resolveSpecialRulesForTeam } from "../utils/team-values";
import { getAvailableStarPlayersDb } from "../utils/star-player-repository";
import { serverLog } from "../utils/server-log";

export interface BuildInducementContextInput {
  readonly teamId: TeamId;
  readonly rosterSlug: string;
  /** Ruleset de l'équipe (`Team.ruleset`). */
  readonly ruleset?: string | null;
  /** Ligue régionale CHOISIE par l'équipe (`Team.regionalLeague`). */
  readonly regionalLeague?: string | null;
  readonly hasApothecary: boolean;
}

export async function buildInducementContext(
  input: BuildInducementContextInput,
): Promise<InducementContext> {
  const ruleset = (input.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const roster = input.rosterSlug;

  const base: InducementContext = {
    teamId: input.teamId,
    regionalRules: [],
    hasApothecary: input.hasApothecary,
    rosterSlug: roster,
    ruleset,
  };
  if (!roster) return base;

  try {
    const [declaredRules, specialRules] = await Promise.all([
      getDeclaredRegionalRules(roster, ruleset),
      resolveSpecialRulesForTeam(prisma, roster, ruleset),
    ]);
    const regionalRules = resolveTeamRegionalRules(
      roster,
      ruleset,
      input.regionalLeague ?? null,
      declaredRules,
    );
    // Le catalogue de stars est optionnel : sans lui le moteur retombe sur
    // sa table compilée, ce qui reste mieux qu'un contexte vide.
    let starPlayers: ReadonlyArray<{ slug: string; cost: number }> | undefined;
    try {
      starPlayers = (
        await getAvailableStarPlayersDb(roster, regionalRules, ruleset)
      ).map((s) => ({ slug: s.slug, cost: s.cost }));
    } catch (e: unknown) {
      serverLog.error(
        `[inducements] catalogue Star Players indisponible pour ${roster}`,
        e,
      );
    }

    return {
      ...base,
      regionalRules,
      specialRules: [...specialRules],
      ...(starPlayers ? { starPlayers } : {}),
    };
  } catch (e: unknown) {
    serverLog.error(
      `[inducements] contexte non résolu pour ${roster} — repli catalogue`,
      e,
    );
    return base;
  }
}
