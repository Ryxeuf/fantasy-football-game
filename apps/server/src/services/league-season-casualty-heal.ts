/**
 * Rattrapage AUTOMATIQUE des sorties d'une saison de ligue.
 *
 * `eliminationEarnsSpp` a changé la définition d'une sortie, mais un correctif
 * de CALCUL ne corrige pas un compteur PERSISTÉ : une feuille validée sous
 * l'ancienne règle a écrit ses sorties dans `LeagueParticipant.casualtiesFor/
 * Against` (colonnes Sor+/Sor-), dans les points bonus du pairing, dans
 * `TeamPlayer.totalCasualties` et dans les PSP. La feuille se relit avec la
 * règle courante et annonce « 4 sorties + 1 agression » ; le classement, lui,
 * garde le « 5 » d'alors.
 *
 * `league-sheet-casualty-resync` sait déjà réparer une feuille (deltas
 * seulement, idempotent, journalisé). Il ne lui manquait qu'un DÉCLENCHEUR :
 * il n'était branché que sur un script d'opérateur, donc sur les bases où
 * quelqu'un pense à le lancer. Ce module le déclenche à la LECTURE du
 * classement — même posture que les autres recomputes paresseux du repo
 * (« l'utilisateur paie le recompute en ouvrant la page »), sans cron.
 *
 * La fenêtre n'est pas temporelle mais VERSIONNÉE : la qualification d'une
 * sortie a changé une fois. `LeagueMatchSheet.casualtyRuleVersion` dit sous
 * quelle version la feuille a été validée ; `null` (feuille antérieure à la
 * colonne, donc antérieure à la règle) la désigne au rattrapage. Après le
 * passage, le balayage est une requête qui ne ramène rien.
 *
 * BEST-EFFORT de bout en bout : un rattrapage en échec ne doit jamais
 * empêcher de servir un classement.
 */

import { prisma } from "../prisma";
import { CASUALTY_RULE_VERSION } from "./league-match-summary";
import {
  resyncValidatedSheetCasualties,
  type CasualtyResyncSkipReason,
} from "./league-sheet-casualty-resync";
import { runAsAuditJob } from "../utils/audit-context";
import { serverLog } from "../utils/server-log";

/**
 * Refus que RIEN ne changera : la feuille est marquée quand même, sinon elle
 * serait retentée à chaque consultation du classement sans jamais bouger.
 * `sheet-not-validated` en est absent À DESSEIN — une feuille invalidée peut
 * être revalidée, et c'est la validation qui posera alors le marqueur.
 */
const TERMINAL_SKIPS: ReadonlySet<CasualtyResyncSkipReason> = new Set([
  "pairing-missing",
  "not-a-league",
  "snapshot-missing",
  "participant-missing",
  "season-completed",
]);

export interface SeasonCasualtyHealReport {
  /** Feuilles validées de la saison portant un marqueur périmé. */
  readonly scanned: number;
  /** Feuilles dont au moins un compteur a bougé. */
  readonly repaired: number;
  /** Feuilles marquées comme traitées (réparées, à jour, ou refusées). */
  readonly marked: number;
}

const EMPTY_REPORT: SeasonCasualtyHealReport = {
  scanned: 0,
  repaired: 0,
  marked: 0,
};

/** Feuilles validées de la saison qui n'ont pas encore vu la règle courante. */
async function findStaleSheets(
  seasonId: string,
): Promise<Array<{ id: string; pairingId: string }>> {
  const rows = (await prisma.leagueMatchSheet.findMany({
    where: {
      status: "validated",
      pairing: { round: { seasonId } },
      OR: [
        { casualtyRuleVersion: null },
        { casualtyRuleVersion: { lt: CASUALTY_RULE_VERSION } },
      ],
    },
    select: { id: true, pairingId: true },
    orderBy: { validatedAt: "asc" },
  })) as Array<{ id: string; pairingId: string | null }>;
  return rows.filter(
    (r): r is { id: string; pairingId: string } =>
      typeof r.pairingId === "string" && r.pairingId.length > 0,
  );
}

/** Pose le marqueur : cette feuille ne sera plus revisitée. */
async function markSheet(sheetId: string): Promise<boolean> {
  try {
    await prisma.leagueMatchSheet.update({
      where: { id: sheetId },
      data: { casualtyRuleVersion: CASUALTY_RULE_VERSION },
    });
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.warn(
      `[league-season-casualty-heal] marquage impossible sheet=${sheetId}: ${msg}`,
    );
    return false;
  }
}

/**
 * Rattrape les feuilles validées d'une saison dont les sorties ont été
 * persistées sous l'ancienne règle. Idempotent : une saison déjà passée ne
 * coûte qu'une requête sans résultat.
 *
 * Ne lève JAMAIS — l'appelant est une lecture de classement.
 */
export async function healSeasonCasualties(
  seasonId: string,
): Promise<SeasonCasualtyHealReport> {
  let stale: Array<{ id: string; pairingId: string }>;
  try {
    stale = await findStaleSheets(seasonId);
  } catch (e: unknown) {
    // Modèle/colonne indisponibles (miroir SQLite d'un test, base pas encore
    // poussée) : on sert le classement tel quel plutôt que de le refuser.
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.warn(
      `[league-season-casualty-heal] balayage impossible season=${seasonId}: ${msg}`,
    );
    return EMPTY_REPORT;
  }
  if (stale.length === 0) return EMPTY_REPORT;

  let repaired = 0;
  let marked = 0;
  for (const sheet of stale) {
    try {
      // Le journal d'équipe attribue le rattrapage au job, pas au lecteur du
      // classement : c'est la règle qui corrige, pas le coach qui consulte.
      const outcome = await runAsAuditJob(
        "league.sheet.casualty_resync",
        () => resyncValidatedSheetCasualties(sheet.pairingId, { apply: true }),
      );
      if (outcome.skipped && !TERMINAL_SKIPS.has(outcome.reason)) continue;
      if (!outcome.skipped && outcome.plan.changed) {
        repaired += 1;
        serverLog.info(
          `[league-season-casualty-heal] sorties rattrapées pairing=${sheet.pairingId} ` +
            `${outcome.plan.casualties.before.home}/${outcome.plan.casualties.before.away}` +
            ` -> ${outcome.plan.casualties.after.home}/${outcome.plan.casualties.after.away}`,
        );
      }
      if (await markSheet(sheet.id)) marked += 1;
    } catch (e: unknown) {
      // Une feuille en échec ne bloque ni les suivantes ni le classement :
      // elle reste non marquée et sera retentée à la prochaine lecture.
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(
        `[league-season-casualty-heal] rattrapage échoué pairing=${sheet.pairingId}: ${msg}`,
      );
    }
  }
  return { scanned: stale.length, repaired, marked };
}
