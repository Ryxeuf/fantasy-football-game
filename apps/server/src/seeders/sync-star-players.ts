/**
 * Sync Star Players CIBLÉ et idempotent, exposé comme service réutilisable.
 *
 * Source de vérité : `packages/game-engine/src/rosters/star-players.ts`
 * (base Saison 2 + `SEASON_THREE_STAR_PLAYER_OVERRIDES` alignés carte par
 * carte sur le PDF GW « Star Players! (Legends) » 2025).
 *
 * Depuis la PR #957, la table `StarPlayer` est la source de vérité du
 * recrutement ET de l'affichage public : le seed initial est volontairement
 * non destructif (create-if-missing) pour ne pas écraser les édits admin.
 * Conséquence : corriger le catalogue du game-engine ne change RIEN en base.
 * Ce service est le véhicule qui applique le code à la base.
 *
 * Ce qu'il fait, par (slug, ruleset) :
 *  0. crée les lignes `Skill` manquantes référencées par les star players
 *     (sinon le lien serait silencieusement perdu — ex. `hate-dwarf`) ;
 *  1. UPSERT les champs de RÈGLES : cost, ma/st/ag/pa/av, specialRule ;
 *  2. relink `StarPlayerSkill` (deleteMany + recréation depuis le code) ;
 *  3. relink `StarPlayerHirableBy` (idem, avec résolution roster/règle) ;
 *  4. renseigne `keywords` UNIQUEMENT s'il est vide en base.
 *
 * Ce qu'il ne fait JAMAIS :
 *  - toucher `displayName`, `imageUrl`, `isMegaStar` d'une ligne existante
 *    (champs de présentation, potentiellement édités en admin) ;
 *  - supprimer une ligne `StarPlayer` (aucun DELETE en masse) ;
 *  - créer un doublon quand la base porte un slug historique différent du
 *    code : voir `SLUG_ALIASES`.
 *
 * `write: false` (défaut) = DRY-RUN : aucune écriture, le résultat décrit
 * champ par champ ce qui SERAIT fait. C'est aussi le script de contrôle
 * (« 0 écart » attendu après application).
 *
 * Rollback : chaque changement remonte sa valeur `from`, ce qui permet de
 * reconstituer l'état antérieur (le CLI sait en écrire un instantané JSON).
 *
 * Exposé via : `apps/server/src/scripts/sync-star-players.ts` (CLI conteneur).
 */

import { prisma } from "../prisma";
import {
  STAR_PLAYERS_BY_RULESET,
  type StarPlayerDefinition,
} from "../../../../packages/game-engine/src/rosters/star-players";
import {
  TEAM_ROSTERS_BY_RULESET,
  RULESETS,
  type Ruleset,
} from "../../../../packages/game-engine/src/rosters/positions";
import { SKILLS_DEFINITIONS } from "../../../../packages/game-engine/src/skills/index";

/**
 * Slugs historiques portés par la base pour des fiches dont le code utilise
 * un slug plus court. Sans cette table, le sync créerait un doublon au lieu
 * de corriger la fiche existante (et l'URL publique changerait).
 */
const SLUG_ALIASES: Readonly<Record<string, readonly string[]>> = {
  grombrindal: ["grombrindal_the_white_dwarf"],
  gretchen_wachter: ["gretchen_wachter_the_blood_bowl_widow"],
};

/** Champs de règles synchronisés inconditionnellement sur une ligne existante. */
const RULE_FIELDS = [
  "cost",
  "ma",
  "st",
  "ag",
  "pa",
  "av",
  "specialRule",
] as const;
type RuleField = (typeof RULE_FIELDS)[number];

export interface SyncStarPlayersOptions {
  /** Applique réellement les écritures. `false` (défaut) = dry-run. */
  readonly write?: boolean;
  /**
   * Ruleset ciblé. Défaut `season_3` : le lot « Legends 2025 » ne concerne
   * que la Saison 3, la Saison 2 ne doit pas bouger. Passer `all` pour tous.
   */
  readonly ruleset?: string;
  /** Filtre sur un slug de star player (ex: "grombrindal"). Vide = tous. */
  readonly slug?: string;
}

export interface FieldChange {
  readonly field: string;
  readonly from: unknown;
  readonly to: unknown;
}

export interface SyncedStarPlayer {
  readonly slug: string;
  /** Slug réellement trouvé en base (peut être un alias historique). */
  readonly dbSlug: string;
  readonly ruleset: string;
  readonly displayName: string;
  readonly action: "create" | "update" | "unchanged";
  readonly changes: readonly FieldChange[];
}

export interface CreatedSkill {
  readonly ruleset: string;
  readonly slug: string;
  readonly nameFr: string;
  readonly excludedFromSelection: boolean;
}

export interface MissingSkillLink {
  readonly ruleset: string;
  readonly starPlayerSlug: string;
  readonly skillSlug: string;
}

export interface SyncStarPlayersResult {
  readonly write: boolean;
  /** Star players créés. */
  readonly created: number;
  /** Star players dont au moins un champ / lien a changé. */
  readonly updated: number;
  /** Star players déjà conformes au code. */
  readonly unchanged: number;
  readonly players: readonly SyncedStarPlayer[];
  readonly createdSkills: readonly CreatedSkill[];
  readonly missingSkills: readonly MissingSkillLink[];
}

function parseCsv(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = [...new Set(a)].sort();
  const sb = [...new Set(b)].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

/**
 * Slugs de compétences utilisés par au moins une Position du code. Tout slug
 * hors de cet ensemble est une variante réservée aux star players : à la
 * création, on la marque `excludedFromSelection` pour qu'elle ne devienne pas
 * choisissable à l'évolution d'un joueur normal.
 */
function positionSkillSlugs(ruleset: Ruleset): ReadonlySet<string> {
  const out = new Set<string>();
  const rosterMap = TEAM_ROSTERS_BY_RULESET[ruleset];
  if (!rosterMap) return out;
  for (const rosterDef of Object.values(rosterMap)) {
    for (const position of rosterDef.positions) {
      for (const slug of parseCsv(position.skills)) out.add(slug);
    }
  }
  return out;
}

/** Ligne StarPlayer telle que relue par le sync (scalaires + liens). */
interface ExistingRow {
  readonly id: string;
  readonly slug: string;
  readonly keywords: string | null;
  readonly skills: readonly { readonly skill: { readonly slug: string } }[];
  readonly hirableBy: readonly { readonly rule: string }[];
  readonly [key: string]: unknown;
}

/** Retrouve la ligne StarPlayer du code, en tolérant un slug historique. */
async function findExistingRow(
  slug: string,
  ruleset: Ruleset,
): Promise<ExistingRow | null> {
  const candidates = [slug, ...(SLUG_ALIASES[slug] ?? [])];
  for (const candidate of candidates) {
    const row = await prisma.starPlayer.findFirst({
      where: { slug: candidate, ruleset: ruleset as never },
      include: {
        skills: { include: { skill: { select: { slug: true } } } },
        hirableBy: { include: { roster: { select: { slug: true } } } },
      },
    });
    if (row) return row as unknown as ExistingRow;
  }
  return null;
}

/**
 * Applique le catalogue du game-engine à la table StarPlayer.
 * En dry-run (`write: false`), n'écrit rien mais renvoie le diff détaillé.
 */
export async function syncStarPlayers(
  options: SyncStarPlayersOptions = {},
): Promise<SyncStarPlayersResult> {
  const write = options.write === true;
  const players: SyncedStarPlayer[] = [];
  const createdSkills: CreatedSkill[] = [];
  const missingSkills: MissingSkillLink[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  const requested = options.ruleset ?? "season_3";
  const rulesets = (RULESETS as readonly Ruleset[]).filter((r) =>
    requested === "all" ? true : r === requested,
  );

  for (const ruleset of rulesets) {
    const catalogue = STAR_PLAYERS_BY_RULESET[ruleset];
    if (!catalogue) continue;

    const defs = Object.values(catalogue).filter(
      (d) => !options.slug || d.slug === options.slug,
    );

    // 0) Les lignes Skill référencées doivent exister, sinon le lien saute.
    const referenced = new Set<string>();
    for (const def of defs) for (const s of parseCsv(def.skills)) referenced.add(s);
    const positionSlugs = positionSkillSlugs(ruleset);
    for (const skillSlug of referenced) {
      const existing = await prisma.skill.findUnique({
        where: { slug_ruleset: { slug: skillSlug, ruleset: ruleset as never } },
        select: { id: true },
      });
      if (existing) continue;
      const definition = SKILLS_DEFINITIONS.find((s) => s.slug === skillSlug);
      if (!definition) continue; // remonté plus bas comme lien manquant
      const excludedFromSelection = !positionSlugs.has(skillSlug);
      createdSkills.push({
        ruleset,
        slug: skillSlug,
        nameFr: definition.nameFr,
        excludedFromSelection,
      });
      if (write) {
        await prisma.skill.create({
          data: {
            slug: definition.slug,
            ruleset: ruleset as never,
            nameFr: definition.nameFr,
            nameEn: definition.nameEn,
            description: definition.description,
            descriptionEn: definition.descriptionEn ?? null,
            category: definition.category,
            isPassive: definition.isPassive ?? false,
            isModified: definition.isModified ?? false,
            excludedFromSelection,
          },
        });
      }
    }

    for (const def of defs) {
      const result = await syncOne(def, ruleset, write, missingSkills);
      players.push(result);
      if (result.action === "create") created++;
      else if (result.action === "update") updated++;
      else unchanged++;
    }
  }

  return {
    write,
    created,
    updated,
    unchanged,
    players,
    createdSkills,
    missingSkills,
  };
}

async function syncOne(
  def: StarPlayerDefinition,
  ruleset: Ruleset,
  write: boolean,
  missingSkills: MissingSkillLink[],
): Promise<SyncedStarPlayer> {
  const existing = await findExistingRow(def.slug, ruleset);
  const desiredSkills = parseCsv(def.skills);
  const desiredRules = [...new Set(def.hirableBy)];

  if (!existing) {
    if (write) {
      const row = await prisma.starPlayer.create({
        data: {
          slug: def.slug,
          ruleset: ruleset as never,
          displayName: def.displayName,
          cost: def.cost,
          ma: def.ma,
          st: def.st,
          ag: def.ag,
          pa: def.pa ?? null,
          av: def.av,
          keywords: def.keywords ?? null,
          specialRule: def.specialRule ?? null,
          imageUrl: def.imageUrl ?? null,
          isMegaStar: def.isMegaStar ?? false,
        },
      });
      await linkSkills(row.id, def, ruleset, desiredSkills, missingSkills);
      await linkHirableBy(row.id, ruleset, desiredRules);
    }
    return {
      slug: def.slug,
      dbSlug: def.slug,
      ruleset,
      displayName: def.displayName,
      action: "create",
      changes: [],
    };
  }

  const changes: FieldChange[] = [];
  const data: Record<string, unknown> = {};

  const desiredValues: Record<RuleField, unknown> = {
    cost: def.cost,
    ma: def.ma,
    st: def.st,
    ag: def.ag,
    pa: def.pa ?? null,
    av: def.av,
    specialRule: def.specialRule ?? null,
  };
  for (const field of RULE_FIELDS) {
    const from = existing[field] ?? null;
    const to = desiredValues[field] ?? null;
    if (from !== to) {
      changes.push({ field, from, to });
      data[field] = to;
    }
  }

  // `keywords` : complété seulement s'il est vide en base (une curation admin
  // reste prioritaire sur la table du game-engine).
  const currentKeywords = existing.keywords ?? null;
  if (
    (currentKeywords === null || currentKeywords.trim() === "") &&
    def.keywords
  ) {
    changes.push({ field: "keywords", from: currentKeywords, to: def.keywords });
    data.keywords = def.keywords;
  }

  const currentSkills = (existing.skills ?? []).map((s) => s.skill.slug);
  const skillsChanged = !sameSet(currentSkills, desiredSkills);
  if (skillsChanged) {
    changes.push({
      field: "skills",
      from: [...currentSkills].sort().join(","),
      to: [...desiredSkills].sort().join(","),
    });
  }

  const currentRules = (existing.hirableBy ?? []).map((h) => h.rule);
  const rulesChanged = !sameSet(currentRules, desiredRules);
  if (rulesChanged) {
    changes.push({
      field: "hirableBy",
      from: [...currentRules].sort().join(","),
      to: [...desiredRules].sort().join(","),
    });
  }

  if (write) {
    if (Object.keys(data).length > 0) {
      await prisma.starPlayer.update({ where: { id: existing.id }, data });
    }
    if (skillsChanged) {
      await linkSkills(existing.id, def, ruleset, desiredSkills, missingSkills);
    }
    if (rulesChanged) {
      await linkHirableBy(existing.id, ruleset, desiredRules);
    }
  } else if (skillsChanged) {
    // Dry-run : on signale quand même les slugs absents de la table Skill.
    for (const skillSlug of desiredSkills) {
      const skill = await prisma.skill.findUnique({
        where: { slug_ruleset: { slug: skillSlug, ruleset: ruleset as never } },
        select: { id: true },
      });
      if (!skill && !SKILLS_DEFINITIONS.some((s) => s.slug === skillSlug)) {
        missingSkills.push({
          ruleset,
          starPlayerSlug: def.slug,
          skillSlug,
        });
      }
    }
  }

  return {
    slug: def.slug,
    dbSlug: existing.slug,
    ruleset,
    displayName: def.displayName,
    action: changes.length > 0 ? "update" : "unchanged",
    changes,
  };
}

/** Remplace intégralement les liens de compétences (idempotent). */
async function linkSkills(
  starPlayerId: string,
  def: StarPlayerDefinition,
  ruleset: Ruleset,
  desiredSkills: readonly string[],
  missingSkills: MissingSkillLink[],
): Promise<void> {
  await prisma.starPlayerSkill.deleteMany({ where: { starPlayerId } });
  for (const skillSlug of desiredSkills) {
    const skill = await prisma.skill.findUnique({
      where: { slug_ruleset: { slug: skillSlug, ruleset: ruleset as never } },
      select: { id: true },
    });
    if (!skill) {
      missingSkills.push({ ruleset, starPlayerSlug: def.slug, skillSlug });
      continue;
    }
    await prisma.starPlayerSkill.create({
      data: { starPlayerId, skillId: skill.id },
    });
  }
}

/** Remplace intégralement les règles régionales (idempotent). */
async function linkHirableBy(
  starPlayerId: string,
  ruleset: Ruleset,
  desiredRules: readonly string[],
): Promise<void> {
  await prisma.starPlayerHirableBy.deleteMany({ where: { starPlayerId } });
  for (const rule of desiredRules) {
    // "all" n'est jamais rattaché à un roster ; sinon on tente une résolution
    // par slug de roster, avec repli sur une règle régionale libre.
    const roster =
      rule === "all"
        ? null
        : await prisma.roster.findUnique({
            where: { slug_ruleset: { slug: rule, ruleset: ruleset as never } },
            select: { id: true },
          });
    await prisma.starPlayerHirableBy.create({
      data: { starPlayerId, rule, rosterId: roster?.id ?? null },
    });
  }
}
