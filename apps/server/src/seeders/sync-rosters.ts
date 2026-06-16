/**
 * Sync roster CIBLÉ et idempotent (positions only), exposé comme service
 * réutilisable.
 *
 * Source de vérité : `packages/game-engine/src/rosters/*`. Le code des rosters
 * est déployé dans l'image, mais les lignes `Position` en base ne sont
 * réécrites ni par le seed initial (qui ne joue qu'une fois) ni par
 * `reimportSeason3SkillAccess` (qui ne touche QUE `primary/secondarySkills`).
 * Ce service applique la totalité du code à la base :
 *
 *  1. PURGE les positions présentes en base mais absentes du code pour ce
 *     roster (slug orphelin — ex: un ancien "White Lion" → "Lion Blanc") ;
 *  2. UPSERT chaque position du code (nom, stats, coût, accès S3) ;
 *  3. relink les PositionSkill (deleteMany + recréation depuis le code).
 *
 * Sûr : `TeamPlayer.position` est une string (pas de FK vers Position) et
 * `PositionSkill` est en onDelete: Cascade → purger une Position ne casse
 * rien référentiellement. Les équipes déjà construites gardent leur snapshot.
 *
 * Les Rosters doivent déjà exister en base (créés par le seed initial) ; ce
 * service ne (re)crée pas les lignes Roster, il synchronise leurs positions.
 *
 * `write: false` (défaut) = DRY-RUN : aucune écriture, le résultat décrit ce
 * qui SERAIT fait (utile pour prévisualiser le diff avant d'appliquer).
 *
 * Exposé via :
 *   - POST /admin/utilities/sync-rosters (bouton admin, dry-run par défaut)
 *   - scripts/sync-rosters.ts (CLI conteneur)
 */

import { prisma } from "../prisma";
import {
  TEAM_ROSTERS_BY_RULESET,
  RULESETS,
  type Ruleset,
} from "../../../../packages/game-engine/src/rosters/positions";
import { SKILL_ACCESS_SEASON3 } from "../../../../packages/game-engine/src/rosters/skill-access-season3";

export interface SyncRostersOptions {
  /** Applique réellement les écritures. `false` (défaut) = dry-run. */
  readonly write?: boolean;
  /** Filtre sur un ruleset (ex: "season_3"). Vide = tous. */
  readonly ruleset?: string;
  /** Filtre sur un slug de roster (ex: "high_elf"). Vide = tous. */
  readonly roster?: string;
}

export interface SyncedPosition {
  readonly roster: string;
  readonly ruleset: string;
  readonly slug: string;
  readonly displayName: string;
  readonly action: "create" | "update";
}

export interface PrunedPosition {
  readonly roster: string;
  readonly ruleset: string;
  readonly slug: string;
  readonly displayName: string;
}

export interface MissingSkillLink {
  readonly ruleset: string;
  readonly positionSlug: string;
  readonly skillSlug: string;
}

export interface MissingRoster {
  readonly roster: string;
  readonly ruleset: string;
}

export interface SyncRostersResult {
  /** `true` si les écritures ont été appliquées (sinon dry-run). */
  readonly write: boolean;
  /** Nombre de positions upsert (create + update). */
  readonly upserted: number;
  /** Nombre de positions orphelines purgées. */
  readonly pruned: number;
  /** Nombre de liens de compétence (PositionSkill) recréés. */
  readonly skillLinks: number;
  readonly upsertedPositions: readonly SyncedPosition[];
  readonly prunedPositions: readonly PrunedPosition[];
  /** Compétences référencées par le code mais absentes de la table Skill. */
  readonly missingSkills: readonly MissingSkillLink[];
  /** Rosters référencés par le code mais absents en base (ignorés). */
  readonly missingRosters: readonly MissingRoster[];
}

/**
 * Synchronise les positions des rosters depuis le code vers la base.
 * En dry-run (`write: false`), ne fait aucune écriture mais renvoie le
 * détail de ce qui serait créé / mis à jour / purgé.
 */
export async function syncRosters(
  options: SyncRostersOptions = {},
): Promise<SyncRostersResult> {
  const write = options.write === true;

  let upserted = 0;
  let pruned = 0;
  let skillLinks = 0;
  const upsertedPositions: SyncedPosition[] = [];
  const prunedPositions: PrunedPosition[] = [];
  const missingSkills: MissingSkillLink[] = [];
  const missingRosters: MissingRoster[] = [];

  const rulesets = (RULESETS as readonly Ruleset[]).filter(
    (r) => !options.ruleset || r === options.ruleset,
  );

  for (const ruleset of rulesets) {
    const rosterMap = TEAM_ROSTERS_BY_RULESET[ruleset];
    if (!rosterMap) continue;

    for (const [rosterSlug, rosterDef] of Object.entries(rosterMap)) {
      if (options.roster && rosterSlug !== options.roster) continue;

      const roster = await prisma.roster.findUnique({
        where: { slug_ruleset: { slug: rosterSlug, ruleset } },
        select: { id: true },
      });
      if (!roster) {
        missingRosters.push({ roster: rosterSlug, ruleset });
        continue;
      }

      const codeSlugs = new Set(rosterDef.positions.map((p) => p.slug));

      // 1) PURGE des positions orphelines (slug en base ∉ code).
      const orphans = await prisma.position.findMany({
        where: { rosterId: roster.id, slug: { notIn: [...codeSlugs] } },
        select: { id: true, slug: true, displayName: true },
      });
      for (const o of orphans) {
        prunedPositions.push({
          roster: rosterSlug,
          ruleset,
          slug: o.slug,
          displayName: o.displayName,
        });
        if (write) {
          await prisma.position.delete({ where: { id: o.id } });
        }
        pruned++;
      }

      // 2) UPSERT des positions du code + relink skills.
      for (const def of rosterDef.positions) {
        const access =
          ruleset === "season_3" ? SKILL_ACCESS_SEASON3[def.slug] : undefined;
        const data = {
          rosterId: roster.id,
          slug: def.slug,
          displayName: def.displayName,
          cost: def.cost,
          min: def.min,
          max: def.max,
          ma: def.ma,
          st: def.st,
          ag: def.ag,
          // Frontière game-engine (sentinel 0 = pas de passe) → DB (null = "-").
          pa: def.pa === 0 ? null : def.pa,
          av: def.av,
          primarySkills: access ? access.primary : null,
          secondarySkills: access ? access.secondary : null,
        };

        const existing = await prisma.position.findFirst({
          where: { rosterId: roster.id, slug: def.slug },
          select: { id: true },
        });

        let positionId = existing?.id ?? null;
        if (write) {
          const pos = existing
            ? await prisma.position.update({ where: { id: existing.id }, data })
            : await prisma.position.create({ data });
          positionId = pos.id;
        }
        upsertedPositions.push({
          roster: rosterSlug,
          ruleset,
          slug: def.slug,
          displayName: def.displayName,
          action: existing ? "update" : "create",
        });
        upserted++;

        // 3) Relink PositionSkill (skills de base du code).
        const slugs = (def.skills ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (write && positionId) {
          await prisma.positionSkill.deleteMany({ where: { positionId } });
          for (const skillSlug of slugs) {
            const skill = await prisma.skill.findUnique({
              where: { slug_ruleset: { slug: skillSlug, ruleset } },
              select: { id: true },
            });
            if (!skill) {
              missingSkills.push({
                ruleset,
                positionSlug: def.slug,
                skillSlug,
              });
              continue;
            }
            await prisma.positionSkill.create({
              data: { positionId, skillId: skill.id },
            });
            skillLinks++;
          }
        } else {
          // Dry-run : on ne peut pas garantir l'existence des skills sans I/O
          // supplémentaire, on compte les liens théoriques du code.
          skillLinks += slugs.length;
        }
      }
    }
  }

  return {
    write,
    upserted,
    pruned,
    skillLinks,
    upsertedPositions,
    prunedPositions,
    missingSkills,
    missingRosters,
  };
}
