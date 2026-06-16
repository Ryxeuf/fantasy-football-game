/**
 * Achat d'un skill BB via les SPP carriere NFL Fantasy.
 *
 * Boucle complete :
 *   NFL stats reelles -> SPP semaine (via `nfl-fantasy-scoring`)
 *   -> sppCareer cumules (via `nfl-fantasy-player-career`)
 *   -> achat skill BB ici (via pool d'acces de la `Position` derivee)
 *   -> bonus de scoring (via `nfl-fantasy-skill-bonus`).
 *
 * Reutilise :
 *   - `getPositionSlugFor(race, bbPosition)` (nfl-bb-derivation) pour
 *     identifier la Position S3 du joueur.
 *   - `Position.primarySkills / secondarySkills` (DB) qui contiennent
 *     le pool d'acces canonique BB Season 3 (cf. skill-access feature).
 *   - `categoryCodeForSkill` + `checkSkillAccess` (skill-access).
 *
 * Couts V1 : 6 SPP chosen primaire / 12 SPP chosen secondaire.
 * Cap V1 : 6 skills unlocked (les bbSkills de depart ne comptent pas).
 */

import { prisma } from "../prisma";
import type { BbPosition, BbRace } from "@bb/nfl-mapper";

import {
  categoryCodeForSkill,
  checkSkillAccess,
  dbCategoryToCode,
  parseAccessCsv,
  type AdvancementAccessType,
  type SkillCategoryCode,
} from "./skill-access";
import { getPositionSlugFor } from "./nfl-bb-derivation";
import { getSkillEffect, parseBbSkills } from "./nfl-fantasy-skill-bonus";

export type SkillUnlockErrorCode =
  | "CAREER_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "POSITION_NOT_MAPPED"
  | "POSITION_NOT_FOUND"
  | "POSITION_HAS_NO_ACCESS"
  | "SKILL_NOT_FOUND"
  | "SKILL_ALREADY_OWNED"
  | "SKILL_NOT_IN_POOL"
  | "NOT_ENOUGH_SPP"
  | "SKILL_CAP_REACHED";

export class SkillUnlockError extends Error {
  constructor(
    public readonly code: SkillUnlockErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SkillUnlockError";
  }
}

/** Couts en SPP, alignes sur les couts BB chosen. */
export const SKILL_UNLOCK_COSTS = {
  primary: 6,
  secondary: 12,
} as const;

/** Cap V1 : 6 skills unlocked (additionnels aux starters). */
export const UNLOCK_CAP = 6;

const RULESET_S3 = "season_3";

export interface UnlockSkillOpts {
  readonly entryId: string;
  readonly playerId: string;
  readonly skillSlug: string;
  /** `primary` ou `secondary` — defini par le pool ou le slug appartient.
   *  Choisi cote UI : a 6 SPP / 12 SPP. */
  readonly accessType: Extract<AdvancementAccessType, "primary" | "secondary">;
}

export interface UnlockSkillResult {
  readonly entryId: string;
  readonly playerId: string;
  readonly skillSlug: string;
  readonly cost: number;
  readonly sppCareer: number;
  readonly sppSpent: number;
  readonly sppAvailable: number;
  readonly skillsUnlocked: readonly string[];
}

/**
 * Verifie le pool, le cout et l'unicite, puis persiste l'achat
 * atomiquement (transaction Prisma). Retourne le state career mis a
 * jour.
 *
 * Toutes les erreurs metier sont des `SkillUnlockError` typees, le
 * caller mappe `code` -> HTTP via `sendNflError` ou pattern equivalent.
 */
export async function unlockSkill(
  opts: UnlockSkillOpts,
): Promise<UnlockSkillResult> {
  const career = await prisma.nflFantasyPlayerCareer.findUnique({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
    select: {
      sppCareer: true,
      sppSpent: true,
      skillsUnlocked: true,
    },
  });
  if (!career) {
    throw new SkillUnlockError(
      "CAREER_NOT_FOUND",
      `Carriere absente pour ${opts.entryId}/${opts.playerId}`,
    );
  }
  const unlocked = parseBbSkills(career.skillsUnlocked);
  if (unlocked.length >= UNLOCK_CAP) {
    throw new SkillUnlockError(
      "SKILL_CAP_REACHED",
      `Cap ${UNLOCK_CAP} skills atteint`,
    );
  }
  if (unlocked.includes(opts.skillSlug)) {
    throw new SkillUnlockError(
      "SKILL_ALREADY_OWNED",
      `Skill ${opts.skillSlug} deja unlocked`,
    );
  }

  const player = await prisma.nflPlayer.findUnique({
    where: { id: opts.playerId },
    select: {
      bbPosition: true,
      bbSkills: true,
      teamCode: true,
      team: { select: { bbRace: true } },
    },
  });
  if (!player) {
    throw new SkillUnlockError(
      "PLAYER_NOT_FOUND",
      `NflPlayer ${opts.playerId} introuvable`,
    );
  }
  const starters = parseBbSkills(player.bbSkills);
  if (starters.includes(opts.skillSlug)) {
    throw new SkillUnlockError(
      "SKILL_ALREADY_OWNED",
      `Skill ${opts.skillSlug} fait partie des skills de depart`,
    );
  }

  const race = (player.team?.bbRace ?? null) as BbRace | null;
  if (!race) {
    throw new SkillUnlockError(
      "POSITION_NOT_MAPPED",
      `Race manquante (joueur sans equipe / FA)`,
    );
  }
  const slug = getPositionSlugFor(race, player.bbPosition as BbPosition);
  if (!slug) {
    throw new SkillUnlockError(
      "POSITION_NOT_MAPPED",
      `Pas de Position S3 pour ${race}/${player.bbPosition}`,
    );
  }
  // Position n'a pas de champ `ruleset` direct -- il est porte par le
  // Roster parent (cf. @@unique([slug, ruleset]) sur Roster). On filtre
  // via la relation.
  const position = await prisma.position.findFirst({
    where: { slug, roster: { ruleset: RULESET_S3 as never } },
    select: { primarySkills: true, secondarySkills: true },
  });
  if (!position) {
    throw new SkillUnlockError(
      "POSITION_NOT_FOUND",
      `Position ${slug} introuvable en DB`,
    );
  }

  const skillCode = await categoryCodeForSkill(opts.skillSlug, RULESET_S3);
  if (!skillCode) {
    throw new SkillUnlockError(
      "SKILL_NOT_FOUND",
      `Skill ${opts.skillSlug} introuvable / categorie non pickable`,
    );
  }
  const access = checkSkillAccess({
    type: opts.accessType,
    skillCode,
    primarySkills: position.primarySkills,
    secondarySkills: position.secondarySkills,
  });
  if (access === "no-data") {
    throw new SkillUnlockError(
      "POSITION_HAS_NO_ACCESS",
      `Pool d'acces non renseigne pour ${slug}`,
    );
  }
  if (access === "out-of-pool") {
    throw new SkillUnlockError(
      "SKILL_NOT_IN_POOL",
      `Skill ${opts.skillSlug} (${skillCode}) hors pool ${opts.accessType} de ${slug}`,
    );
  }

  const cost = SKILL_UNLOCK_COSTS[opts.accessType];
  const sppAvailable = career.sppCareer - career.sppSpent;
  if (sppAvailable < cost) {
    throw new SkillUnlockError(
      "NOT_ENOUGH_SPP",
      `${sppAvailable} SPP dispo, ${cost} requis`,
    );
  }

  const newUnlocked = [...unlocked, opts.skillSlug];
  const updated = await prisma.nflFantasyPlayerCareer.update({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
    data: {
      sppSpent: { increment: cost },
      skillsUnlocked: newUnlocked,
    },
    select: {
      sppCareer: true,
      sppSpent: true,
      skillsUnlocked: true,
    },
  });

  return {
    entryId: opts.entryId,
    playerId: opts.playerId,
    skillSlug: opts.skillSlug,
    cost,
    sppCareer: updated.sppCareer,
    sppSpent: updated.sppSpent,
    sppAvailable: updated.sppCareer - updated.sppSpent,
    skillsUnlocked: parseBbSkills(updated.skillsUnlocked),
  };
}

// ────────────────────────────────────────────────────────────────────
// Skill access view (read-only) — pour peupler la UI d'achat
// ────────────────────────────────────────────────────────────────────

export interface SkillAccessView {
  readonly positionSlug: string;
  readonly race: BbRace;
  readonly bbPosition: BbPosition;
  readonly primarySkills: string | null;
  readonly secondarySkills: string | null;
  readonly costs: typeof SKILL_UNLOCK_COSTS;
  readonly cap: number;
  readonly startingSkills: readonly string[];
}

// Code -> nom DB (`Skill.category`), reverse map de DB_CATEGORY_TO_CODE.
const CODE_TO_DB_CATEGORY: Readonly<Record<SkillCategoryCode, string>> = {
  G: "General",
  A: "Agility",
  S: "Strength",
  P: "Passing",
  M: "Mutation",
  K: "Scélérates",
};

export interface AvailableSkill {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly category: string;
  /**
   * Description en FR de l'effet SPP. Null si la skill n'a pas d'effet
   * mesurable sur le scoring NFL Fantasy. La UI filtre sur ce champ
   * pour ne proposer que les skills qui changent quelque chose.
   */
  readonly effectFr: string | null;
  /** Cap SPP par match. Null si pas d'effet. */
  readonly effectCap: number | null;
}

export interface AvailableSkillsForCareer {
  readonly primary: readonly AvailableSkill[];
  readonly secondary: readonly AvailableSkill[];
  readonly cap: number;
  readonly remaining: number;
  readonly costs: typeof SKILL_UNLOCK_COSTS;
  readonly sppAvailable: number;
}

/**
 * Liste les skills concretement achetables par le joueur, separes en
 * primary/secondary. Exclut les skills de depart (`NflPlayer.bbSkills`)
 * et ceux deja unlocked. Le caller (UI) n'a plus qu'a presenter le
 * pool et appeler `unlockSkill` au clic.
 *
 * Retourne `null` si pas mappe (cas a cacher dans la UI).
 */
export async function listAvailableSkillsForCareer(opts: {
  entryId: string;
  playerId: string;
}): Promise<AvailableSkillsForCareer | null> {
  const access = await getSkillAccessView(opts.playerId);
  if (!access) return null;
  const career = await prisma.nflFantasyPlayerCareer.findUnique({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
    select: { sppCareer: true, sppSpent: true, skillsUnlocked: true },
  });
  const unlocked = career ? parseBbSkills(career.skillsUnlocked) : [];
  const sppAvailable = career ? career.sppCareer - career.sppSpent : 0;
  const excluded = new Set<string>([...access.startingSkills, ...unlocked]);

  const primaryCodes = parseAccessCsv(access.primarySkills);
  const secondaryCodes = parseAccessCsv(access.secondarySkills);
  const allCodes = new Set<SkillCategoryCode>([
    ...primaryCodes,
    ...secondaryCodes,
  ]);
  if (allCodes.size === 0) {
    return {
      primary: [],
      secondary: [],
      cap: UNLOCK_CAP,
      remaining: Math.max(0, UNLOCK_CAP - unlocked.length),
      costs: SKILL_UNLOCK_COSTS,
      sppAvailable,
    };
  }

  const dbCategories = Array.from(allCodes).map((c) => CODE_TO_DB_CATEGORY[c]);
  const rows = await prisma.skill.findMany({
    where: {
      ruleset: RULESET_S3 as never,
      category: { in: dbCategories },
    },
    select: {
      slug: true,
      nameFr: true,
      nameEn: true,
      category: true,
    },
    orderBy: [{ category: "asc" }, { nameFr: "asc" }],
  });

  const primary: AvailableSkill[] = [];
  const secondary: AvailableSkill[] = [];
  for (const r of rows) {
    if (excluded.has(r.slug)) continue;
    const code = dbCategoryToCode(r.category);
    if (!code) continue;
    const effect = getSkillEffect(r.slug);
    const enriched: AvailableSkill = {
      ...r,
      effectFr: effect?.effectFr ?? null,
      effectCap: effect?.cap ?? null,
    };
    if (primaryCodes.has(code)) primary.push(enriched);
    else if (secondaryCodes.has(code)) secondary.push(enriched);
  }

  return {
    primary,
    secondary,
    cap: UNLOCK_CAP,
    remaining: Math.max(0, UNLOCK_CAP - unlocked.length),
    costs: SKILL_UNLOCK_COSTS,
    sppAvailable,
  };
}

/**
 * Resume du pool d'acces du joueur (lecture). Retourne `null` si la
 * combinaison (race, bbPosition) n'est pas mappee (donc UI doit
 * cacher la section achat).
 */
export async function getSkillAccessView(
  playerId: string,
): Promise<SkillAccessView | null> {
  const player = await prisma.nflPlayer.findUnique({
    where: { id: playerId },
    select: {
      bbPosition: true,
      bbSkills: true,
      team: { select: { bbRace: true } },
    },
  });
  if (!player) return null;
  const race = (player.team?.bbRace ?? null) as BbRace | null;
  if (!race) return null;
  const bbPosition = player.bbPosition as BbPosition;
  const slug = getPositionSlugFor(race, bbPosition);
  if (!slug) return null;
  // Position n'a pas de champ `ruleset` direct -- il est porte par le
  // Roster parent (cf. @@unique([slug, ruleset]) sur Roster). On filtre
  // via la relation.
  const position = await prisma.position.findFirst({
    where: { slug, roster: { ruleset: RULESET_S3 as never } },
    select: { primarySkills: true, secondarySkills: true },
  });
  if (!position) return null;
  return {
    positionSlug: slug,
    race,
    bbPosition,
    primarySkills: position.primarySkills,
    secondarySkills: position.secondarySkills,
    costs: SKILL_UNLOCK_COSTS,
    cap: UNLOCK_CAP,
    startingSkills: parseBbSkills(player.bbSkills),
  };
}
