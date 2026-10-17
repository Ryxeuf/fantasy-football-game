/**
 * Ce qu'une fiche de roster en LECTURE SEULE affiche en plus des joueurs :
 * nom de la race, libellé de chaque poste, valeur d'un joueur, règles
 * spéciales et Ligue régionale retenue.
 *
 * Partagé par la fiche de roster d'une LIGUE (`GET /leagues/:id/teams/:teamId/
 * roster-view`) et celle d'une COUPE (`GET /cup/:id/teams/:teamId/roster-view`) :
 * une seule résolution, sinon les deux fiches annonceraient des valeurs ou des
 * libellés différents pour la même équipe.
 */

import {
  getPositionBySlug,
  TEAM_ROSTERS,
  getPlayerCost,
  calculateAdvancementsSurcharge,
  DEFAULT_RULESET,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { getEliteSkillSlugs } from "./elite-skills";
import { resolvePositionMetaForTeam } from "../utils/team-values";
import { loadAdvancementSchedule } from "./advancement-schedule-repository";
import { getRosterFromDb } from "../utils/roster-helpers";
import { loadTeamRulesCatalogue } from "./team-rules-catalogue";
import { displayedRegionalLeagues } from "./roster-regional-rules";
import {
  resolveRegionalLeagues,
  resolveSpecialRules,
} from "../routes/public-rosters";

export interface RosterViewMeta {
  /** Nom de la race (`Roster.name` en base, repli catalogue). */
  readonly raceName: string;
  /** Libellé lisible d'un poste (base, repli catalogue, repli slug). */
  positionName(slug: string): string;
  /**
   * Valeur d'un joueur en po : coût du poste + surcoût des améliorations —
   * même règle que la VE d'équipe (`utils/team-values`).
   */
  playerValue(position: string, advancementsJson: string | null): number;
  readonly specialRules: ReturnType<typeof resolveSpecialRules>;
  /** A159 — seule la Ligue RETENUE par l'équipe (toutes sans choix). */
  readonly regionalLeagues: ReturnType<typeof resolveRegionalLeagues>;
}

export async function loadRosterViewMeta(input: {
  readonly roster: string;
  readonly ruleset: string | null | undefined;
  readonly regionalLeague: string | null;
}): Promise<RosterViewMeta> {
  const teamRuleset = (input.ruleset ?? DEFAULT_RULESET) as Ruleset;
  // Le coût de base vient de `Position.cost` (base), pas du catalogue
  // compilé : sinon la « valeur du joueur » affichée diverge de la VE
  // persistée sur `Team.teamValue`, déjà calculée en base (M1).
  const eliteSlugs = await getEliteSkillSlugs(prisma, teamRuleset);
  const positionMeta = await resolvePositionMetaForTeam(
    prisma,
    input.roster,
    teamRuleset,
  );
  // Lot 6.2 — barème de l'édition de l'équipe (repli compilé).
  const advancementSchedule = await loadAdvancementSchedule(teamRuleset);
  const playerValue = (position: string, advancementsJson: string | null) => {
    const base =
      positionMeta.get(position)?.cost ??
      getPlayerCost(position, input.roster, teamRuleset);
    let surcharge = 0;
    try {
      const parsed = JSON.parse(advancementsJson || "[]");
      if (Array.isArray(parsed)) {
        surcharge = calculateAdvancementsSurcharge(
          parsed.map(
            (a: { type?: string; stat?: string; skillSlug?: string }) => ({
              type: a?.type as never,
              stat: a?.stat as never,
              isElite:
                typeof a?.skillSlug === "string" && eliteSlugs.has(a.skillSlug),
            }),
          ),
          // Lot 6.2 — surcoûts au barème de l'édition de l'équipe.
          advancementSchedule,
        );
      }
    } catch {
      // Advancements illisibles : on s'en tient au coût de base.
    }
    return base + surcharge;
  };

  // Libellés de poste servis par la base (`Position.displayName`) : le
  // catalogue compilé affichait des noms périmés, ou le slug brut pour un
  // poste créé en admin (M1).
  const rosterPayload = await getRosterFromDb(
    input.roster,
    "fr",
    teamRuleset,
  ).catch(() => null);
  const positionNames = new Map(
    (rosterPayload?.positions ?? []).map((pos) => [pos.slug, pos.displayName]),
  );
  const raceName =
    rosterPayload?.name ??
    (TEAM_ROSTERS as Record<string, { name?: string }>)[input.roster]?.name ??
    input.roster;

  // A11 — règles spéciales + type de ligue (certaines impactent les PSP, ex.
  // Bagarreurs Brutaux). Résolution identique aux pages équipe publiques.
  const ruleset = (input.ruleset ?? "season_3") as Ruleset;
  const rosterRow = (await prisma.roster.findFirst({
    where: { slug: input.roster, ruleset: ruleset as never },
    select: { specialRules: true, regionalRules: true },
  })) as { specialRules: unknown; regionalRules: unknown } | null;
  // Lot 6.5 — libellés servis par la base (`TeamSpecialRule`,
  // `RegionalLeague`), repli sur le catalogue compilé.
  const rulesCatalogue = await loadTeamRulesCatalogue(ruleset);
  const specialRules = resolveSpecialRules(
    rosterRow?.specialRules ?? null,
    false,
    rulesCatalogue,
  );
  // A159 — le ROSTER ouvre plusieurs Ligues, mais l'ÉQUIPE n'en retient
  // qu'une à sa création : seule celle-ci est servie (toutes pour une
  // équipe antérieure à la règle, ou si le choix a quitté le catalogue).
  const rosterLeagues = resolveRegionalLeagues(
    rosterRow?.regionalRules ?? null,
    input.roster,
    ruleset,
    false,
    rulesCatalogue,
  );

  return {
    raceName,
    positionName: (slug) =>
      positionNames.get(slug) ?? getPositionBySlug(slug)?.displayName ?? slug,
    playerValue,
    specialRules,
    regionalLeagues: displayedRegionalLeagues(
      rosterLeagues,
      input.regionalLeague,
    ),
  };
}
