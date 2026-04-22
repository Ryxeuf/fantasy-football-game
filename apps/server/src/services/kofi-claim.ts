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

  const orphans = await prisma.kofiTransaction.findMany({
    where: { userId: null, email },
    select: { id: true },
  });

  if (orphans.length === 0) {
    return { claimed: 0 };
  }

  const orphanIds = orphans.map((o: { id: string }) => o.id);

  await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.kofiTransaction.updateMany({
      where: { id: { in: orphanIds } },
      data: { userId, matchedVia: "email" },
    });

    // Recompute supporter state from ALL transactions (fresh + past).
    const allTx = await tx.kofiTransaction.findMany({
      where: { userId },
      select: {
        isSubscriptionPayment: true,
        tierName: true,
        amountCents: true,
        receivedAt: true,
      },
    });

    const aggregate = aggregateSupporterState(allTx);

    await tx.user.update({
      where: { id: userId },
      data: {
        supporterTier: aggregate.supporterTier,
        supporterActiveUntil: aggregate.supporterActiveUntil,
        totalDonatedCents: aggregate.totalDonatedCentsDelta,
      },
    });
  });

  return { claimed: orphans.length };
}
