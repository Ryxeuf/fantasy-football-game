/**
 * S26 DoD — Telemetrie de progression du tutoriel onboarding.
 *
 * Mesure le KPI sprint 26 : "80% des nouveaux comptes finissent au
 * moins une lecon". On stocke un row TutorialCompletion par
 * (userId, lessonSlug) — l'API web ne tracke que la *fin* d'une lecon
 * (pas chaque etape) pour rester sobre cote DB.
 *
 * Idempotence : `recordTutorialCompletion` est un upsert. La page
 * tutoriel peut donc rejouer l'ecriture sans crainte.
 */

import { prisma } from "../prisma";

export interface TutorialCompletionRecord {
  id: string;
  userId: string;
  lessonSlug: string;
  completedAt: Date;
}

export interface TutorialCompletionRate {
  /** Nombre d'utilisateurs eligibles dans la fenetre (avec filtre optionnel). */
  eligibleUsers: number;
  /** Nombre d'utilisateurs distincts ayant termine au moins 1 lecon. */
  usersCompletedAtLeastOne: number;
  /** Ratio dans [0, 1]. 0 si `eligibleUsers === 0`. */
  ratio: number;
}

export interface GetTutorialCompletionRateOptions {
  /**
   * Si fourni, ne considere que les utilisateurs crees apres cette date
   * (cohorte recente, p.ex. "30 derniers jours"). Sans filtre on
   * mesure sur l'ensemble du parc.
   */
  since?: Date;
}

const tutorialCompletion = (prisma as unknown as {
  tutorialCompletion: {
    upsert: (args: unknown) => Promise<TutorialCompletionRecord>;
    findMany: (args: unknown) => Promise<Array<{ userId: string }>>;
  };
}).tutorialCompletion;

const userClient = prisma as unknown as {
  user: { count: (args?: unknown) => Promise<number> };
};

export async function recordTutorialCompletion(
  userId: string,
  lessonSlug: string,
): Promise<TutorialCompletionRecord> {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("userId requis (chaine non vide)");
  }
  const slug = typeof lessonSlug === "string" ? lessonSlug.trim() : "";
  if (slug.length === 0) {
    throw new Error("lessonSlug requis (chaine non vide)");
  }
  return tutorialCompletion.upsert({
    where: { userId_lessonSlug: { userId, lessonSlug: slug } },
    update: {},
    create: { userId, lessonSlug: slug },
  });
}

export async function getTutorialCompletionRate(
  opts: GetTutorialCompletionRateOptions = {},
): Promise<TutorialCompletionRate> {
  const sinceFilter = opts.since ? { createdAt: { gte: opts.since } } : {};
  const eligibleUsers = await userClient.user.count(
    opts.since ? { where: sinceFilter } : undefined,
  );

  if (eligibleUsers === 0) {
    return { eligibleUsers: 0, usersCompletedAtLeastOne: 0, ratio: 0 };
  }

  const completions = await tutorialCompletion.findMany({
    where: opts.since ? { user: sinceFilter } : {},
    select: { userId: true },
  });

  const distinct = new Set<string>();
  for (const c of completions) {
    if (typeof c.userId === "string" && c.userId.length > 0) {
      distinct.add(c.userId);
    }
  }
  const usersCompletedAtLeastOne = distinct.size;
  const ratio = usersCompletedAtLeastOne / eligibleUsers;
  return { eligibleUsers, usersCompletedAtLeastOne, ratio };
}
