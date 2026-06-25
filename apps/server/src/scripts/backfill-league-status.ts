/**
 * Backfill ponctuel — recale `League.status` sur l'etat reel de ses saisons.
 *
 * Contexte : historiquement `League.status` restait fige a "draft" car aucun
 * chemin (hors force-status admin) ne le faisait avancer. Le correctif
 * (`league-scheduler.advanceLeagueStatus`) ne s'applique qu'aux actions
 * futures (ouverture des inscriptions / demarrage de saison). Ce script
 * rattrape les ligues deja actives mais toujours affichees « Brouillon ».
 *
 * Regle de recalage (forward-only, calquee sur `advanceLeagueStatus`) :
 *   - une saison `in_progress` => ligue au moins `in_progress`
 *   - sinon une saison `scheduled` => ligue au moins `open`
 *   - sinon (que des saisons `draft` / aucune saison) => on ne touche pas
 *
 * `completed` et `archived` sont hors echelle : pilotes manuellement par
 * l'admin, jamais retrogrades ni ecrases ici.
 *
 * Usage :
 *   tsx src/scripts/backfill-league-status.ts            # applique
 *   tsx src/scripts/backfill-league-status.ts --dry-run  # simule seulement
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

const FORWARD_RANK: Record<string, number> = {
  draft: 0,
  open: 1,
  in_progress: 2,
};

/** Statut cible derive de l'etat des saisons, ou null si rien a faire. */
function targetFromSeasons(
  seasonStatuses: readonly string[],
): "open" | "in_progress" | null {
  if (seasonStatuses.includes("in_progress")) return "in_progress";
  if (seasonStatuses.includes("scheduled")) return "open";
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  serverLog.log(
    `🔧 Backfill League.status${dryRun ? " (DRY-RUN)" : ""} — recalage sur les saisons…\n`,
  );

  // On ne traite que les ligues encore dans l'echelle "avant" (draft/open).
  // in_progress est deja correct ; completed/archived sont admin-only.
  const leagues = await prisma.league.findMany({
    where: { status: { in: ["draft", "open"] } },
    select: {
      id: true,
      name: true,
      status: true,
      seasons: { select: { status: true } },
    },
  });

  serverLog.log(`📊 Ligues candidates (draft/open) : ${leagues.length}\n`);

  let updated = 0;
  for (const league of leagues) {
    const target = targetFromSeasons(
      league.seasons.map((s: { status: string }) => s.status),
    );
    if (!target) continue;
    // Forward-only : ne jamais retrograder.
    if (FORWARD_RANK[league.status] >= FORWARD_RANK[target]) continue;

    serverLog.log(
      `  • ${league.name} (${league.id}) : ${league.status} → ${target}`,
    );
    if (!dryRun) {
      await prisma.league.update({
        where: { id: league.id },
        data: { status: target },
      });
    }
    updated += 1;
  }

  serverLog.log(
    `\n✅ ${dryRun ? "À mettre à jour" : "Mises à jour"} : ${updated} / ${leagues.length} ligue(s).`,
  );
}

main()
  .catch((e) => {
    serverLog.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
