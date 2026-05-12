/**
 * Sprint R — Lot R.B.3 : statut supporter (ad-free + early access).
 *
 * Wraps le helper `isSupporter` (cf. kofi.ts) pour exposer un statut
 * structure consommable par l'UI :
 *   - isSupporter : boolean (override admin OR active Kofi/Patreon)
 *   - tier : "supporter" | "patron" | "founder" | null
 *   - activeUntil : ISO string ou null
 *   - source : "admin_override" | "kofi" | "patreon" | null
 *   - benefits : liste des benefices actuellement actives
 *
 * Architecture sink + payoff : le wallet payoff (Crowns daily, paris
 * gagnes) est equilibre par les sinks (HoF dedicate, tournois entry,
 * cosmetics futurs). Le supporter tier (3€/mois) debloque :
 *   - ad-free (pas de bannieres Google AdSense si ajoutees plus tard)
 *   - early replay access (-7j avant les free users) — a brancher
 *     dans le service replay quand pertinent
 *   - badge profil + flair Gazette commentaires
 *
 * `getSupporterStatus` est lu par l'endpoint `GET /me/supporter` et
 * par les middlewares qui filtrent les contenus premium.
 */

import { prisma } from "../prisma";
import { isSupporter } from "./kofi";

export type SupporterSource = "admin_override" | "kofi" | "patreon";

export interface SupporterBenefit {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface SupporterStatus {
  readonly isSupporter: boolean;
  readonly tier: string | null;
  readonly activeUntil: string | null;
  readonly source: SupporterSource | null;
  readonly benefits: readonly SupporterBenefit[];
}

export const SUPPORTER_BENEFITS: readonly SupporterBenefit[] = [
  {
    id: "ad_free",
    label: "Ad-free",
    description:
      "Aucune banniere publicitaire. Le site reste vierge de pub pour les supporters.",
  },
  {
    id: "early_replay",
    label: "Acces replays anticipe",
    description:
      "Replays archives accessibles jusqu'a 7 jours avant les free users.",
  },
  {
    id: "profile_badge",
    label: "Badge supporter",
    description: "Flair distinctif sur ton profil coach + dans la Gazette.",
  },
] as const;

const NO_STATUS: SupporterStatus = {
  isSupporter: false,
  tier: null,
  activeUntil: null,
  source: null,
  benefits: [],
};

/**
 * Determine le statut supporter d'un user. Retourne `NO_STATUS` si
 * pas d'actif ni d'override. Source detection :
 *   - `patreon=true` → "admin_override" (compte gift / dev / test)
 *   - sinon, supporterActiveUntil > now → "kofi" (seul payment provider
 *     pour l'instant ; "patreon" reserve a R.B.1)
 */
export async function getSupporterStatus(
  userId: string,
  now: Date = new Date(),
): Promise<SupporterStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      patreon: true,
      supporterTier: true,
      supporterActiveUntil: true,
    },
  });
  if (!user) return NO_STATUS;

  const active = isSupporter(
    {
      patreon: user.patreon as boolean,
      supporterActiveUntil: (user.supporterActiveUntil as Date | null) ?? null,
    },
    now,
  );
  if (!active) return NO_STATUS;

  const source: SupporterSource = (user.patreon as boolean)
    ? "admin_override"
    : "kofi";
  return {
    isSupporter: true,
    tier: (user.supporterTier as string | null) ?? null,
    activeUntil: user.supporterActiveUntil
      ? (user.supporterActiveUntil as Date).toISOString()
      : null,
    source,
    benefits: SUPPORTER_BENEFITS,
  };
}

/**
 * Helper concis pour les routes qui ne veulent que le boolean.
 */
export async function isUserSupporter(
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const status = await getSupporterStatus(userId, now);
  return status.isSupporter;
}
