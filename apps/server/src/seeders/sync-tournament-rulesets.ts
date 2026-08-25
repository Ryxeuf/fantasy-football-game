/**
 * Amorçage des règlements de tournoi en base depuis le registre du moteur.
 *
 * Le registre `@bb/game-engine` reste la référence transcrite du pack
 * officiel ; la base en est la copie ÉDITABLE. Le seed crée donc les lignes
 * manquantes mais ne réécrit JAMAIS une ligne existante : une correction
 * saisie en admin ne doit pas être écrasée au prochain déploiement.
 *
 * `force: true` (action admin « réinitialiser depuis le moteur ») remet
 * explicitement une ligne à la valeur du registre.
 */

import { TOURNAMENT_RULESETS } from "@bb/game-engine";
import { prisma } from "../prisma";
import { serializeDefinition } from "../schemas/tournament-ruleset.schemas";
import { invalidateTournamentRulesetCache } from "../services/tournament-ruleset-repository";

export interface SyncTournamentRulesetsOptions {
  /** `false` (défaut) = dry-run : aucun écrit, on renvoie ce qui serait fait. */
  readonly write?: boolean;
  /** Réécrit les lignes existantes depuis le registre du moteur. */
  readonly force?: boolean;
  /** Limite l'opération à un slug. */
  readonly slug?: string;
}

export interface SyncTournamentRulesetsResult {
  readonly write: boolean;
  /** Slugs créés depuis le registre. */
  readonly created: readonly string[];
  /** Slugs réécrits (uniquement avec `force`). */
  readonly updated: readonly string[];
  /** Slugs déjà en base et laissés tels quels. */
  readonly skipped: readonly string[];
}

export async function syncTournamentRulesets(
  options: SyncTournamentRulesetsOptions = {},
): Promise<SyncTournamentRulesetsResult> {
  const write = options.write === true;
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  const entries = Object.entries(TOURNAMENT_RULESETS).filter(
    ([slug]) => !options.slug || slug === options.slug,
  );

  for (const [slug, definition] of entries) {
    const existing = await prisma.tournamentRuleset.findUnique({
      where: { slug },
      select: { id: true },
    });

    // `serializeDefinition` remet Infinity → null : la définition passe en
    // JSON sans perte, et se reparse à l'identique.
    const data = serializeDefinition(definition) as unknown as object;

    if (!existing) {
      created.push(slug);
      if (write) {
        await prisma.tournamentRuleset.create({
          data: { slug, enabled: true, definition: data },
        });
      }
      continue;
    }
    if (options.force) {
      updated.push(slug);
      if (write) {
        await prisma.tournamentRuleset.update({
          where: { slug },
          data: { definition: data },
        });
      }
      continue;
    }
    skipped.push(slug);
  }

  if (write && (created.length > 0 || updated.length > 0)) {
    invalidateTournamentRulesetCache();
  }

  return { write, created, updated, skipped };
}
