/**
 * Numéro NAF du coach (`User.nafNumber`), vérifié automatiquement auprès de
 * l'annuaire public (`naf-verification`).
 *
 * - Trouvé (même numéro) : numéro + date de vérification + nom NAF OFFICIEL
 *   (`nafName`, celui que la NAF affiche).
 * - Introuvable : refus (`naf_not_found`), rien n'est enregistré.
 * - Annuaire injoignable ou illisible : le numéro est enregistré « en
 *   attente de vérification » (`nafVerifiedAt = null`) ; le coach retente.
 * - Un numéro n'appartient qu'à un compte (`@unique`) : `naf_number_taken`.
 *
 * Effacer le numéro efface sa vérification, jamais `nafName` (que le coach a
 * pu saisir lui-même via `PATCH /user/naf`).
 */

import { prisma } from "../prisma";
import {
  verifyNafNumber,
  nafCoachPageUrl,
  type NafFetcher,
} from "./naf-verification";

export type NafNumberErrorCode =
  | "naf_not_found"
  | "naf_number_taken"
  | "naf_number_missing";

export class NafNumberError extends Error {
  constructor(
    public readonly code: NafNumberErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NafNumberError";
  }
}

export interface UserNafView {
  readonly nafNumber: number | null;
  readonly nafName: string | null;
  readonly nafVerifiedAt: Date | null;
  /** `true` si la dernière vérification a trouvé la fiche coach. */
  readonly verified: boolean;
  /** Fiche coach publique sur thenaf.net (null sans numéro). */
  readonly nafCoachUrl: string | null;
}

const NAF_SELECT = {
  nafNumber: true,
  nafName: true,
  nafVerifiedAt: true,
} as const;

interface NafRow {
  readonly nafNumber: number | null;
  readonly nafName: string | null;
  readonly nafVerifiedAt: Date | null;
}

function toView(row: NafRow): UserNafView {
  return {
    nafNumber: row.nafNumber,
    nafName: row.nafName,
    nafVerifiedAt: row.nafVerifiedAt,
    verified: row.nafNumber !== null && row.nafVerifiedAt !== null,
    nafCoachUrl: row.nafNumber !== null ? nafCoachPageUrl(row.nafNumber) : null,
  };
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "P2002"
  );
}

const TAKEN = () =>
  new NafNumberError(
    "naf_number_taken",
    "Ce numéro NAF est déjà associé à un autre compte",
  );
const NOT_FOUND = () =>
  new NafNumberError("naf_not_found", "Numéro introuvable sur thenaf.net");

async function writeNaf(
  userId: string,
  data: Partial<{ nafNumber: number | null; nafName: string; nafVerifiedAt: Date | null }>,
): Promise<UserNafView> {
  try {
    const row = await prisma.user.update({
      where: { id: userId },
      data,
      select: NAF_SELECT,
    });
    return toView(row);
  } catch (e: unknown) {
    // Course entre deux comptes sur le même numéro : la contrainte tranche.
    if (isUniqueViolation(e)) throw TAKEN();
    throw e;
  }
}

/** Enregistre (et vérifie) le numéro NAF du coach ; `null` l'efface. */
export async function setUserNafNumber(
  userId: string,
  nafNumber: number | null,
  fetcher?: NafFetcher,
): Promise<UserNafView> {
  if (nafNumber === null) {
    return writeNaf(userId, { nafNumber: null, nafVerifiedAt: null });
  }

  const owner = await prisma.user.findUnique({
    where: { nafNumber },
    select: { id: true },
  });
  if (owner && owner.id !== userId) throw TAKEN();

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: NAF_SELECT,
  });

  const result = await verifyNafNumber(nafNumber, fetcher);
  if (result.status === "not_found") throw NOT_FOUND();
  if (result.status === "verified") {
    return writeNaf(userId, {
      nafNumber,
      nafName: result.nafName,
      nafVerifiedAt: new Date(),
    });
  }
  // Annuaire injoignable : en attente. Re-saisir le MÊME numéro déjà
  // vérifié ne fait pas perdre sa vérification à cause d'une panne NAF.
  const keepVerification =
    current?.nafNumber === nafNumber ? (current?.nafVerifiedAt ?? null) : null;
  return writeNaf(userId, { nafNumber, nafVerifiedAt: keepVerification });
}

/** Retente la vérification du numéro déjà enregistré. */
export async function retryUserNafVerification(
  userId: string,
  fetcher?: NafFetcher,
): Promise<UserNafView> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: NAF_SELECT,
  });
  if (!current || current.nafNumber === null) {
    throw new NafNumberError("naf_number_missing", "Aucun numéro NAF enregistré");
  }
  const result = await verifyNafNumber(current.nafNumber, fetcher);
  if (result.status === "verified") {
    return writeNaf(userId, {
      nafName: result.nafName,
      nafVerifiedAt: new Date(),
    });
  }
  if (result.status === "not_found") {
    // Le numéro a disparu de l'annuaire : il n'est plus vérifié.
    await writeNaf(userId, { nafVerifiedAt: null });
    throw NOT_FOUND();
  }
  return toView(current);
}
