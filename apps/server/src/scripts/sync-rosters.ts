/**
 * Sync roster CIBLÉ et idempotent (positions only).
 *
 * Contrairement à `seed.ts` (seed de DEV complet qui purge les skills,
 * crée user@example.com, des équipes/ligues démo et pose des overrides de
 * feature flags — DANGEREUX en prod), ce script ne touche QUE les tables
 * Roster / Position / PositionSkill, à partir de la source de vérité
 * `packages/game-engine/src/rosters/*`.
 *
 * Il :
 *  1. upsert chaque position définie dans le code (stats, coût, accès S3) ;
 *  2. PURGE les positions présentes en base mais absentes du code pour ce
 *     roster (slug orphelin — ex: un ancien "White Lion") ;
 *  3. relink les PositionSkill (deleteMany + recréation depuis le code).
 *
 * Sûr : `TeamPlayer.position` est une string (pas de FK vers Position) et
 * `PositionSkill` est en onDelete: Cascade → purger une Position ne casse
 * rien référentiellement. Les équipes déjà construites gardent leur snapshot.
 *
 * Les Rosters doivent déjà exister en base (créés par le seed initial) ; ce
 * script ne (re)crée pas les lignes Roster, il synchronise leurs positions.
 *
 * Usage (depuis apps/server, ou via le conteneur serveur) :
 *   tsx src/scripts/sync-rosters.ts                       # DRY-RUN (rapport)
 *   tsx src/scripts/sync-rosters.ts --write               # applique
 *   tsx src/scripts/sync-rosters.ts --ruleset=season_3 --roster=high_elf --write
 */

import { prisma } from "../prisma";
import {
  TEAM_ROSTERS_BY_RULESET,
  RULESETS,
  type Ruleset,
} from "../../../../packages/game-engine/src/rosters/positions";
import { SKILL_ACCESS_SEASON3 } from "../../../../packages/game-engine/src/rosters/skill-access-season3";

interface Args {
  write: boolean;
  ruleset?: string;
  roster?: string;
}

function parseArgs(argv: string[]): Args {
  const write = argv.includes("--write");
  const get = (k: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.split("=")[1] : undefined;
  };
  return { write, ruleset: get("ruleset"), roster: get("roster") };
}

async function syncRosters(args: Args): Promise<void> {
  const mode = args.write ? "WRITE" : "DRY-RUN";
  console.log(`🔄 Sync rosters (${mode})`);
  if (args.ruleset) console.log(`   filtre ruleset = ${args.ruleset}`);
  if (args.roster) console.log(`   filtre roster  = ${args.roster}`);

  let upserted = 0;
  let pruned = 0;
  let skillLinks = 0;

  const rulesets = (RULESETS as readonly Ruleset[]).filter(
    (r) => !args.ruleset || r === args.ruleset,
  );

  for (const ruleset of rulesets) {
    const rosterMap = TEAM_ROSTERS_BY_RULESET[ruleset];
    if (!rosterMap) continue;

    for (const [rosterSlug, rosterDef] of Object.entries(rosterMap)) {
      if (args.roster && rosterSlug !== args.roster) continue;

      const roster = await prisma.roster.findUnique({
        where: { slug_ruleset: { slug: rosterSlug, ruleset } },
        select: { id: true },
      });
      if (!roster) {
        console.warn(
          `⚠️  Roster ${rosterSlug} (${ruleset}) absent en base — ignoré (lancer le seed initial d'abord).`,
        );
        continue;
      }

      const codeSlugs = new Set(rosterDef.positions.map((p) => p.slug));

      // 1) PURGE des positions orphelines (slug en base ∉ code).
      const orphans = await prisma.position.findMany({
        where: { rosterId: roster.id, slug: { notIn: [...codeSlugs] } },
        select: { id: true, slug: true, displayName: true },
      });
      for (const o of orphans) {
        console.log(
          `   🗑️  prune ${rosterSlug}/${ruleset} : ${o.displayName} (${o.slug})`,
        );
        if (args.write) {
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
          pa: def.pa,
          av: def.av,
          primarySkills: access ? access.primary : null,
          secondarySkills: access ? access.secondary : null,
        };

        const existing = await prisma.position.findFirst({
          where: { rosterId: roster.id, slug: def.slug },
          select: { id: true },
        });

        let positionId = existing?.id ?? null;
        if (args.write) {
          const pos = existing
            ? await prisma.position.update({
                where: { id: existing.id },
                data,
              })
            : await prisma.position.create({ data });
          positionId = pos.id;
        }
        console.log(
          `   ✅ ${existing ? "update" : "create"} ${def.slug} → "${def.displayName}" (${def.cost}k)`,
        );
        upserted++;

        // 3) Relink PositionSkill (skills de base du code).
        const slugs = (def.skills ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (args.write && positionId) {
          await prisma.positionSkill.deleteMany({ where: { positionId } });
          for (const skillSlug of slugs) {
            const skill = await prisma.skill.findUnique({
              where: { slug_ruleset: { slug: skillSlug, ruleset } },
              select: { id: true },
            });
            if (!skill) {
              console.warn(
                `   ⚠️  skill ${skillSlug} introuvable (${ruleset}) pour ${def.slug}`,
              );
              continue;
            }
            await prisma.positionSkill.create({
              data: { positionId, skillId: skill.id },
            });
            skillLinks++;
          }
        } else {
          skillLinks += slugs.length;
        }
      }
    }
  }

  console.log(
    `\n${args.write ? "✅ Appliqué" : "ℹ️  Dry-run"} : ${upserted} positions upsert, ${pruned} purgées, ${skillLinks} liens de compétence.`,
  );
  if (!args.write) {
    console.log("   (Relancer avec --write pour appliquer.)");
  }
}

syncRosters(parseArgs(process.argv.slice(2)))
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ sync-rosters a échoué:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
