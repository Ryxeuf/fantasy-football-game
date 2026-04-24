import type { KofiWebhookPayload } from "../schemas/kofi.schemas";
import { amountToCents } from "../schemas/kofi.schemas";

/**
 * Période de grâce (jours) accordée au-delà du cycle mensuel Ko-fi avant
 * d'expirer le statut de supporter. Couvre les retards de prélèvement.
 */
export const SUPPORTER_GRACE_DAYS = 5;
/** Durée d'un cycle Ko-fi "monthly" (jours) + grâce. */
export const SUPPORTER_ACTIVE_WINDOW_DAYS = 30 + SUPPORTER_GRACE_DAYS;

/**
 * Regex matchant un code de liaison Ko-fi dans le champ message.
 * Format : `KFI-` suivi de 6 caractères alphanumériques (base32 Crockford).
 * Case-insensitive.
 */
export const KOFI_LINK_CODE_REGEX = /\bKFI-[0-9A-HJKMNP-TV-Z]{6}\b/i;

/** Génère un nouveau code de liaison unique (non-collision à vérifier en DB). */
export function generateKofiLinkCode(
  rng: () => number = Math.random,
): string {
  // Alphabet Crockford base32 moins les caractères ambigus (I, L, O, U).
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return `KFI-${suffix}`;
}

/** Extrait un code de liaison Ko-fi valide d'un texte libre. null si absent. */
export function extractKofiLinkCode(
  message: string | null | undefined,
): string | null {
  if (!message) return null;
  const match = KOFI_LINK_CODE_REGEX.exec(message);
  return match ? match[0].toUpperCase() : null;
}

/** Canonicalise un email pour le matching : trim + lowercase. */
export function normaliseEmail(
  email: string | null | undefined,
): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export type MatchedVia = "code" | "email" | "discord" | "manual";

export interface MatchCandidate {
  id: string;
  email: string;
  kofiLinkCode: string | null;
  discordUserId: string | null;
}

export interface MatchResult {
  userId: string;
  matchedVia: MatchedVia;
}

/**
 * Tente d'associer un payload Ko-fi à un utilisateur parmi les candidats.
 * Priorité : code (haute confiance) > email (confiance moyenne) > discord
 * (confiance moyenne, suppose que User.discordUserId a été renseigné par
 * le titulaire du compte).
 */
export function matchKofiPayloadToUser(
  payload: Pick<KofiWebhookPayload, "message" | "email" | "discord_userid">,
  candidates: ReadonlyArray<MatchCandidate>,
): MatchResult | null {
  const code = extractKofiLinkCode(payload.message);
  if (code) {
    // Une fois qu'un code est présent dans le message, c'est une revendication
    // explicite pour un compte précis. Si le code ne matche aucun candidat on
    // laisse la transaction orpheline plutôt que de rabattre sur l'email et
    // risquer d'attacher à un tiers.
    const byCode = candidates.find(
      (c) => c.kofiLinkCode && c.kofiLinkCode.toUpperCase() === code,
    );
    return byCode ? { userId: byCode.id, matchedVia: "code" } : null;
  }

  const email = normaliseEmail(payload.email);
  if (email) {
    const byEmail = candidates.find(
      (c) => c.email.toLowerCase() === email,
    );
    if (byEmail) {
      return { userId: byEmail.id, matchedVia: "email" };
    }
  }

  const discordId = payload.discord_userid?.trim();
  if (discordId) {
    const byDiscord = candidates.find((c) => c.discordUserId === discordId);
    if (byDiscord) {
      return { userId: byDiscord.id, matchedVia: "discord" };
    }
  }

  return null;
}

export interface SupporterSnapshot {
  supporterTier: string | null;
  supporterActiveUntil: Date | null;
  /** Devise ISO (ex: "USD", "EUR") du don courant. */
  currency: string;
  /** Centimes à ajouter au compteur de la devise correspondante. */
  amountCentsDelta: number;
}

/**
 * Calcule la mise à jour à appliquer sur l'utilisateur après un événement Ko-fi.
 * - Abonnement → étend `supporterActiveUntil` à `now + window` et fixe le tier.
 * - Don simple / shop order → expose juste les centimes à ajouter à la devise.
 * - `amount` négatif est refusé par `amountToCents` en amont.
 */
export function computeSupporterUpdate(
  payload: Pick<
    KofiWebhookPayload,
    "amount" | "currency" | "is_subscription_payment" | "tier_name"
  >,
  now: Date = new Date(),
): SupporterSnapshot {
  const cents = amountToCents(payload.amount);

  if (payload.is_subscription_payment) {
    const activeUntil = new Date(
      now.getTime() + SUPPORTER_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    return {
      supporterTier: payload.tier_name ?? "Supporter",
      supporterActiveUntil: activeUntil,
      currency: payload.currency,
      amountCentsDelta: cents,
    };
  }

  return {
    supporterTier: null,
    supporterActiveUntil: null,
    currency: payload.currency,
    amountCentsDelta: cents,
  };
}

/**
 * Détermine si un utilisateur doit afficher le badge "Supporter".
 * Override admin (`patreon`) OU abonnement actif non expiré.
 */
export function isSupporter(
  user: {
    patreon: boolean;
    supporterActiveUntil: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (user.patreon) return true;
  if (!user.supporterActiveUntil) return false;
  return user.supporterActiveUntil.getTime() > now.getTime();
}

/**
 * Agrège un ensemble de `KofiTransaction` déjà rattachées à l'utilisateur
 * pour recalculer l'état supporter complet. Utilisé par le claim orphelin
 * au login et par le cron d'expiration.
 */
export interface AggregatableKofiTransaction {
  isSubscriptionPayment: boolean;
  tierName: string | null;
  amountCents: number;
  currency: string;
  receivedAt: Date;
}

export interface SupporterAggregate {
  supporterTier: string | null;
  supporterActiveUntil: Date | null;
  /** Map devise → total centimes accumulés. Pas de conversion entre devises. */
  totalDonatedCentsByCurrency: Record<string, number>;
}

export function aggregateSupporterState(
  transactions: ReadonlyArray<AggregatableKofiTransaction>,
  now: Date = new Date(),
): SupporterAggregate {
  const totalsByCurrency: Record<string, number> = {};
  let bestActiveUntil: Date | null = null;
  let bestTier: string | null = null;

  for (const tx of transactions) {
    totalsByCurrency[tx.currency] =
      (totalsByCurrency[tx.currency] ?? 0) + tx.amountCents;

    if (!tx.isSubscriptionPayment) continue;

    const activeUntil = new Date(
      tx.receivedAt.getTime() +
        SUPPORTER_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    if (activeUntil.getTime() <= now.getTime()) continue;

    if (!bestActiveUntil || activeUntil > bestActiveUntil) {
      bestActiveUntil = activeUntil;
      bestTier = tx.tierName ?? "Supporter";
    }
  }

  return {
    supporterTier: bestTier,
    supporterActiveUntil: bestActiveUntil,
    totalDonatedCentsByCurrency: totalsByCurrency,
  };
}
