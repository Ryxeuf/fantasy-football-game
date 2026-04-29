/**
 * S26.3 — Profil coach public sharable.
 *
 * Service `getCoachPublicProfile(slug)` qui resoud un slug d'URL en
 * profil public. Le slug est derive du `coachName` via
 * `coachSlugFrom` (S26.3a). En cas de collision (deux comptes
 * identiques apres normalisation), le plus ancien compte (createdAt
 * croissant) gagne — convention deterministe.
 *
 * Donnees publiques uniquement : pseudo, ELO, statut supporter,
 * date d'inscription. Pas d'email, pas de roles internes.
 *
 * RGPD : un futur opt-in `private profile` permettra a un coach de
 * cacher son profil public — applique au niveau du `where` Prisma
 * dans une slice ulterieure (S26.3c).
 */

import { prisma } from "../prisma";
import { coachSlugFrom } from "../utils/coach-slug";
import { ACHIEVEMENTS_CATALOG } from "./achievements";
import { isSupporter } from "./kofi";

export interface CoachPublicProfile {
  id: string;
  slug: string;
  coachName: string;
  eloRating: number;
  isSupporter: boolean;
  supporterTier: string | null;
  /** ISO 8601 timestamp of the User.createdAt. */
  memberSince: string;
}

export interface CoachShowcaseAchievement {
  slug: string;
  nameFr: string;
  nameEn: string;
  icon: string;
  category: string;
  /** ISO 8601 timestamp of when the user unlocked the achievement. */
  unlockedAt: string;
}

export interface CoachRecentTeam {
  id: string;
  name: string;
  roster: string;
  /** Current team value (Valeur d'Equipe Actuelle, in gold pieces). */
  currentValue: number;
  /** ISO 8601 timestamp of the team creation. */
  createdAt: string;
}

const DEFAULT_SHOWCASE_LIMIT = 6;
const DEFAULT_RECENT_TEAMS_LIMIT = 5;

interface CandidateUser {
  id: string;
  coachName: string;
  eloRating: number;
  patreon: boolean;
  supporterActiveUntil: Date | null;
  supporterTier: string | null;
  createdAt: Date;
}

export async function getCoachPublicProfile(
  slug: string,
  now: Date = new Date(),
): Promise<CoachPublicProfile | null> {
  const normalised = slug.trim();
  if (normalised.length === 0) return null;

  const candidates = (await (prisma as unknown as {
    user: {
      findMany: (args: unknown) => Promise<CandidateUser[]>;
    };
  }).user.findMany({
    where: { valid: true },
    select: {
      id: true,
      coachName: true,
      eloRating: true,
      patreon: true,
      supporterActiveUntil: true,
      supporterTier: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })) as CandidateUser[];

  const match = candidates.find(
    (u) => coachSlugFrom(u.coachName) === normalised,
  );
  if (!match) return null;

  return {
    id: match.id,
    slug: coachSlugFrom(match.coachName),
    coachName: match.coachName,
    eloRating: match.eloRating,
    isSupporter: isSupporter(
      {
        patreon: match.patreon,
        supporterActiveUntil: match.supporterActiveUntil,
      },
      now,
    ),
    supporterTier: match.supporterTier,
    memberSince: match.createdAt.toISOString(),
  };
}

/**
 * S26.3e — Vitrine succes pour `/coach/{slug}`.
 *
 * Renvoie les derniers achievements deverrouilles par l'utilisateur,
 * enrichis avec leur metadata catalogue (nom FR/EN, icone, categorie).
 * Les unlocks dont le slug n'existe plus dans le catalogue (succes
 * deprecie/renomme) sont silencieusement ignores — forward-compat.
 */
export async function getCoachShowcaseAchievements(
  userId: string,
  limit: number = DEFAULT_SHOWCASE_LIMIT,
): Promise<CoachShowcaseAchievement[]> {
  if (!userId) return [];

  const rows = (await (prisma as unknown as {
    userAchievement: {
      findMany: (args: unknown) => Promise<
        Array<{ slug: string; unlockedAt: Date }>
      >;
    };
  }).userAchievement.findMany({
    where: { userId },
    select: { slug: true, unlockedAt: true },
    orderBy: { unlockedAt: "desc" },
    take: limit,
  })) as Array<{ slug: string; unlockedAt: Date }>;

  const catalogBySlug = new Map(
    ACHIEVEMENTS_CATALOG.map((def) => [def.slug, def] as const),
  );

  const showcase: CoachShowcaseAchievement[] = [];
  for (const row of rows) {
    const def = catalogBySlug.get(row.slug);
    if (!def) continue;
    showcase.push({
      slug: def.slug,
      nameFr: def.nameFr,
      nameEn: def.nameEn,
      icon: def.icon,
      category: def.category,
      unlockedAt: row.unlockedAt.toISOString(),
    });
  }
  return showcase;
}

const DEFAULT_PUBLIC_SLUGS_LIMIT = 1000;

/**
 * S26.3g — Liste les slugs des profils coach publics (`/coach/{slug}`).
 *
 * Utilisee par le sitemap pour permettre l'indexation SEO des profils.
 * Borne par defaut a 1000 entrees pour eviter de generer un sitemap
 * geant — pourra evoluer en sitemap-index si la base depasse cette
 * limite. RGPD : opt-in `private profile` viendra dans une slice
 * ulterieure (S26.3 backlog).
 */
export async function listPublicCoachSlugs(
  limit: number = DEFAULT_PUBLIC_SLUGS_LIMIT,
): Promise<string[]> {
  const rows = (await (prisma as unknown as {
    user: {
      findMany: (args: unknown) => Promise<Array<{ coachName: string }>>;
    };
  }).user.findMany({
    where: { valid: true },
    select: { coachName: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  })) as Array<{ coachName: string }>;

  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of rows) {
    const slug = coachSlugFrom(row.coachName);
    if (slug.length === 0) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    result.push(slug);
  }
  return result;
}

/**
 * S26.3h — Equipes recentes du coach pour `/coach/{slug}`.
 *
 * Renvoie les dernieres equipes creees par l'utilisateur (id, nom,
 * roster, valeur actuelle, date de creation). Donnees deja publiques
 * via la liste `/teams` non-authentifiee — on les surface ici en
 * format compact pour le profil.
 */
export async function getCoachRecentTeams(
  userId: string,
  limit: number = DEFAULT_RECENT_TEAMS_LIMIT,
): Promise<CoachRecentTeam[]> {
  if (!userId) return [];

  const rows = (await (prisma as unknown as {
    team: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: string;
          name: string;
          roster: string;
          currentValue: number;
          createdAt: Date;
        }>
      >;
    };
  }).team.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      roster: true,
      currentValue: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })) as Array<{
    id: string;
    name: string;
    roster: string;
    currentValue: number;
    createdAt: Date;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    roster: row.roster,
    currentValue: row.currentValue,
    createdAt: row.createdAt.toISOString(),
  }));
}
