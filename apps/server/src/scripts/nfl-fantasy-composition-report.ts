/**
 * Mini-rapport data — composition de lineup Nuffle Coach.
 *
 * Analyse les lineups DEJA settled (resultats reels) pour repondre a la
 * question de game design : "empiler des postes premium (receveurs /
 * passers / rushers) surperforme-t-il vraiment un lineup equilibre ?".
 *
 * Source de donnees : `NflFantasyLineupStarter.finalSpp` (SPP reel apres
 * multiplicateurs capitaine). Aucune recompute : on agrege le resultat de
 * production. Classification par archetype via @bb/nfl-mapper (poste NFL
 * d'abord, fallback poste BB pour les vieux snapshots sans nflPosition).
 *
 * Read-only : aucune ecriture en base.
 *
 * Lancement :
 *   pnpm --filter @bb/server exec tsx src/scripts/nfl-fantasy-composition-report.ts
 *   # ou en filtrant une saison :
 *   SEASON=2024 pnpm --filter @bb/server exec tsx src/scripts/nfl-fantasy-composition-report.ts
 *
 * DATABASE_URL doit pointer sur la base a analyser (Prisma le lit via env).
 */
import { PrismaClient } from "@prisma/client";
import {
  getArchetypeFromNflPosition,
  getArchetypeFromBbPosition,
  type CompositionArchetype as PlayerArchetype,
  type BbPosition,
} from "@bb/nfl-mapper";

const prisma = new PrismaClient();

/** Ordre d'affichage stable des archetypes. */
const ARCHETYPES: readonly PlayerArchetype[] = [
  "passer",
  "rusher",
  "receiver",
  "frontSeven",
  "secondary",
  "bigGuy",
  "lineman",
];

/** Archetypes consideres "premium" (forte production attendue). */
const PREMIUM: ReadonlySet<PlayerArchetype> = new Set<PlayerArchetype>([
  "passer",
  "rusher",
  "receiver",
]);

interface StarterRow {
  readonly nflPosition: string | null;
  readonly bbPosition: string;
  readonly finalSpp: number | null;
  /** Cle de regroupement par lineup (FK detectee au runtime). */
  readonly lineupKey: string;
}

function classify(nflPosition: string | null, bbPosition: string): PlayerArchetype {
  if (nflPosition && nflPosition.trim() !== "") {
    return getArchetypeFromNflPosition(nflPosition);
  }
  return getArchetypeFromBbPosition(bbPosition as BbPosition);
}

function pct(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Detecte la FK vers le lineup parent sur un enregistrement starter, sans
 * dependre du nom exact du champ (robuste aux variations de schema).
 */
function detectLineupKey(record: Record<string, unknown>): string | null {
  for (const key of Object.keys(record)) {
    if (key === "id") continue;
    if (/lineup.*id$/i.test(key)) {
      const v = record[key];
      if (typeof v === "string") return key;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const seasonEnv = process.env.SEASON ? Number(process.env.SEASON) : undefined;

  // Lecture des starters settled (finalSpp renseigne). Pas de `select` :
  // on recupere l'enregistrement complet pour pouvoir detecter la FK lineup
  // au runtime (et rester tolerant au nom exact du champ).
  const raw = (await prisma.nflFantasyLineupStarter.findMany({
    where: { finalSpp: { not: null } },
  })) as unknown as Array<Record<string, unknown>>;

  if (raw.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      "Aucun lineup settled trouve (NflFantasyLineupStarter.finalSpp tous nuls).\n" +
        "Lance ce script sur une base avec au moins une semaine settled.",
    );
    return;
  }

  const lineupKeyField = detectLineupKey(raw[0]);

  const rows: StarterRow[] = raw.map((r) => ({
    nflPosition: (r.nflPosition as string | null) ?? null,
    bbPosition: String(r.bbPosition ?? "Lineman"),
    finalSpp: (r.finalSpp as number | null) ?? null,
    lineupKey: lineupKeyField ? String(r[lineupKeyField] ?? "?") : "?",
  }));

  // ── Rapport 1 : distribution SPP par archetype ──────────────────────
  const byArch = new Map<PlayerArchetype, number[]>();
  for (const a of ARCHETYPES) byArch.set(a, []);
  let grandTotal = 0;
  for (const row of rows) {
    if (row.finalSpp === null) continue;
    const arch = classify(row.nflPosition, row.bbPosition);
    byArch.get(arch)!.push(row.finalSpp);
    grandTotal += row.finalSpp;
  }

  const lines: string[] = [];
  lines.push(`\n=== Rapport 1 — SPP reel par archetype (${rows.length} titularisations) ===`);
  if (seasonEnv) lines.push(`(note: filtre SEASON=${seasonEnv} non applique — voir TODO en bas)`);
  lines.push(
    "archetype".padEnd(12) +
      "n".padStart(7) +
      "moy".padStart(8) +
      "med".padStart(7) +
      "p10".padStart(7) +
      "p90".padStart(7) +
      "%SPP".padStart(8),
  );
  for (const a of ARCHETYPES) {
    const xs = byArch.get(a)!;
    if (xs.length === 0) continue;
    const sorted = [...xs].sort((x, y) => x - y);
    const sum = xs.reduce((p, c) => p + c, 0);
    lines.push(
      a.padEnd(12) +
        String(xs.length).padStart(7) +
        String(round1(mean(xs))).padStart(8) +
        String(pct(sorted, 50)).padStart(7) +
        String(pct(sorted, 10)).padStart(7) +
        String(pct(sorted, 90)).padStart(7) +
        (grandTotal > 0 ? `${Math.round((sum / grandTotal) * 100)}%` : "0%").padStart(8),
    );
  }

  // ── Rapport 2 : lineups equilibres vs stacks premium ────────────────
  if (lineupKeyField) {
    interface LineupAgg {
      total: number;
      premiumCount: number;
      fillerCount: number;
      starters: number;
    }
    const lineups = new Map<string, LineupAgg>();
    for (const row of rows) {
      if (row.finalSpp === null) continue;
      const agg = lineups.get(row.lineupKey) ?? {
        total: 0,
        premiumCount: 0,
        fillerCount: 0,
        starters: 0,
      };
      const arch = classify(row.nflPosition, row.bbPosition);
      agg.total += row.finalSpp;
      agg.starters += 1;
      if (PREMIUM.has(arch)) agg.premiumCount += 1;
      else agg.fillerCount += 1;
      lineups.set(row.lineupKey, agg);
    }

    // Bucket : "stack premium" = >= 8 postes premium sur 11 ; "equilibre"
    // = entre 4 et 7 ; "defensif/filler" = < 4. Seuils ajustables.
    const buckets = {
      "stack premium (>=8 prem.)": [] as number[],
      "equilibre (4-7 prem.)": [] as number[],
      "filler-lourd (<4 prem.)": [] as number[],
    };
    for (const agg of lineups.values()) {
      if (agg.premiumCount >= 8) buckets["stack premium (>=8 prem.)"].push(agg.total);
      else if (agg.premiumCount >= 4) buckets["equilibre (4-7 prem.)"].push(agg.total);
      else buckets["filler-lourd (<4 prem.)"].push(agg.total);
    }

    lines.push(`\n=== Rapport 2 — total SPP par type de lineup (${lineups.size} lineups settled) ===`);
    lines.push("type".padEnd(28) + "n".padStart(6) + "moy SPP".padStart(10) + "med SPP".padStart(10));
    for (const [label, xs] of Object.entries(buckets)) {
      if (xs.length === 0) continue;
      const sorted = [...xs].sort((a, b) => a - b);
      lines.push(
        label.padEnd(28) +
          String(xs.length).padStart(6) +
          String(round1(mean(xs))).padStart(10) +
          String(pct(sorted, 50)).padStart(10),
      );
    }
    lines.push(
      "\nLecture : si 'stack premium' >> 'equilibre' en moy SPP, le meta " +
        "favorise l'empilement -> un cap de composition au lineup se justifie.",
    );
  } else {
    lines.push(
      "\n(Rapport 2 ignore : FK lineup non detectee sur NflFantasyLineupStarter.)",
    );
  }

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[composition-report] echec:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
