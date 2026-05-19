import { prisma } from "../prisma";
import {
  aggregateSupporterState,
  generateKofiLinkCode,
  normaliseEmail,
} from "./kofi";

/**
 * Alloue un `kofiLinkCode` unique à un utilisateur s'il n'en a pas encore.
 * Utilisé à l'inscription et comme fallback défensif au login.
 * Nb collisions attendues ≈ 0 (32^6 ≈ 10^9), mais on boucle jusqu'à succès.
 */
export async function ensureKofiLinkCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { kofiLinkCode: true },
  });
  if (existing?.kofiLinkCode) return existing.kofiLinkCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateKofiLinkCode();
    const clash = await prisma.user.findUnique({
      where: { kofiLinkCode: candidate },
      select: { id: true },
    });
    if (clash) continue;
    await prisma.user.update({
      where: { id: userId },
      data: { kofiLinkCode: candidate },
    });
    return candidate;
  }
  throw new Error("Could not generate a unique kofiLinkCode after 5 attempts");
}

/**
 * Tente de rattacher toute `KofiTransaction` orpheline à un utilisateur qui
 * vient de s'inscrire ou de se connecter.
 *
 * Stratégie :
 * - Match par email (lowercased). Le code ne s'applique pas ici : si un
 *   donateur a utilisé un code, il a été matché en temps réel dans le webhook.
 * - Après rattachement, on recalcule le supporterTier / supporterActiveUntil
 *   à partir de TOUTES les transactions de l'utilisateur (pas seulement les
 *   nouvelles) pour absorber les désyncs d'un éventuel claim manuel.
 */
export async function claimOrphanKofiTransactions(
  userId: string,
  userEmail: string,
): Promise<{ claimed: number }> {
  const email = normaliseEmail(userEmail);
  if (!email) return { claimed: 0 };

  // BUG fix audit round 8 (CRITICAL/race) : avant, le `findMany`
  // orphan etait fait HORS transaction, puis `updateMany({ id: { in } })`
  // sans filter `userId: null`. Si deux logins concurrents pour le
  // meme email (e.g. account-merge case, ou admin re-assignment), le
  // 2e claim pouvait re-assigner les memes tx (qui appartiennent deja
  // au 1er user) → supporter state mis-attributed.
  // Fix : tout dans la $transaction, et updateMany WHERE conditionnel
  // `{ userId: null, email }` → garantit qu'on ne touche que les vrais
  // orphans au moment du commit.
  let claimed = 0;
  await prisma.$transaction(async (tx: typeof prisma) => {
    // Audit round 8 : findMany DANS la tx pour cohérence.
    const orphans = await tx.kofiTransaction.findMany({
      where: { userId: null, email },
      select: { id: true },
    });
    if (orphans.length === 0) return;
    const orphanIds = orphans.map((o: { id: string }) => o.id);

    // WHERE conditionnel : userId: null + email pour re-verifier que
    // les rows ne sont pas deja claimed par un autre login concurrent.
    const updateResult = await tx.kofiTransaction.updateMany({
      where: { id: { in: orphanIds }, userId: null, email },
      data: { userId, matchedVia: "email" },
    });
    claimed = updateResult.count;
    if (claimed === 0) return;

    // Recompute supporter state from ALL transactions (fresh + past).
    const allTx = await tx.kofiTransaction.findMany({
      where: { userId },
      select: {
        isSubscriptionPayment: true,
        tierName: true,
        amountCents: true,
        currency: true,
        receivedAt: true,
      },
    });

    const aggregate = aggregateSupporterState(allTx);

    await tx.user.update({
      where: { id: userId },
      data: {
        supporterTier: aggregate.supporterTier,
        supporterActiveUntil: aggregate.supporterActiveUntil,
        totalDonatedCentsByCurrency:
          aggregate.totalDonatedCentsByCurrency as never,
      },
    });
  });

  return { claimed };
}
