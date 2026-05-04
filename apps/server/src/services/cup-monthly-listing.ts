/**
 * S27.1b — Listing des Nuffle Cup mensuelles.
 *
 * Service public consomme par `GET /cup/monthly` (alimente le futur
 * bracket visuel `/cups/{slug}` et le calendrier "cup du mois"). Les
 * cups privees (sans `monthlyYear`/`monthlyMonth` defini) sont
 * exclues car ce service ne sert que les editions canoniques.
 *
 * Contrats :
 *  - `year` et `month` sont optionnels mais valides quand fournis
 *    (couple non obligatoire — on peut filtrer juste sur l'annee).
 *  - Pagination par defaut : limit=50 / offset=0, plafond limit=100.
 *  - Tri : `monthlyYear DESC, monthlyMonth DESC` (recents en haut).
 */

import { prisma } from "../prisma";

export interface ListMonthlyCupsInput {
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
}

export interface MonthlyCupRow {
  id: string;
  name: string;
  monthlyYear: number | null;
  monthlyMonth: number | null;
  status: string;
  isPublic: boolean;
}

export interface ListMonthlyCupsResult {
  items: MonthlyCupRow[];
  total: number;
  limit: number;
  offset: number;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export async function listMonthlyCups(
  input: ListMonthlyCupsInput,
): Promise<ListMonthlyCupsResult> {
  if (input.year !== undefined && !isPositiveInteger(input.year)) {
    throw new Error("year doit etre un entier strictement positif");
  }
  if (input.month !== undefined) {
    if (
      !Number.isInteger(input.month) ||
      input.month < 1 ||
      input.month > 12
    ) {
      throw new Error("month doit etre un entier dans [1,12]");
    }
  }

  const where: Record<string, unknown> = {
    monthlyYear: input.year !== undefined ? input.year : { not: null },
    monthlyMonth: input.month !== undefined ? input.month : { not: null },
  };

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const [items, total] = await Promise.all([
    (prisma as unknown as {
      cup: { findMany: (args: unknown) => Promise<MonthlyCupRow[]> };
    }).cup.findMany({
      where,
      orderBy: [
        { monthlyYear: "desc" },
        { monthlyMonth: "desc" },
      ],
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        monthlyYear: true,
        monthlyMonth: true,
        status: true,
        isPublic: true,
      },
    }),
    (prisma as unknown as {
      cup: { count: (args: unknown) => Promise<number> };
    }).cup.count({ where }),
  ]);

  return { items, total, limit, offset };
}
