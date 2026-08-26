/**
 * Routes admin — recherche TRANSVERSALE du journal d'équipe.
 *
 *  - `GET /admin/team-journal`        — page filtrée, enrichie (équipe, coach)
 *  - `GET /admin/team-journal/stats`  — agrégats sur le même périmètre
 *  - `GET /admin/team-journal/export` — même périmètre en CSV ou NDJSON
 *  - `GET /admin/team-journal/facets` — valeurs de filtres réellement présentes
 *
 * Les trois premières partagent EXACTEMENT les mêmes filtres : on affine à
 * l'écran, on lit les agrégats, puis on exporte ce qu'on voit — sans avoir à
 * ré-exprimer la requête dans une autre syntaxe.
 *
 * Réservé aux admins (`authUser` + `adminOnly`) : le journal porte l'IP des
 * acteurs et croise les données de tous les coachs.
 */

import { Router } from "express";

import { prisma } from "../prisma";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validateQuery } from "../middleware/validate";
import {
  adminTeamJournalExportQuerySchema,
  adminTeamJournalQuerySchema,
  adminTeamJournalStatsQuerySchema,
  type AdminTeamJournalExportQuery,
  type AdminTeamJournalQuery,
  type AdminTeamJournalStatsQuery,
} from "../schemas/admin-team-journal.schemas";
import {
  detectProviderCapabilities,
  searchTeamAuditEvents,
  summarizeAuditActivity,
  toCsv,
  toNdjson,
  type TeamAuditSearchFilters,
} from "../services/team-audit-search";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";

const router = Router();

router.use(authUser, adminOnly);

/**
 * Projette la query validée en filtres de service. Extrait et exporté pour
 * être testé sans Express : c'est le point où une option d'UI devient une
 * clause de recherche.
 */
export function toSearchFilters(
  query:
    | AdminTeamJournalQuery
    | AdminTeamJournalExportQuery
    | AdminTeamJournalStatsQuery,
): TeamAuditSearchFilters {
  return {
    teamId: query.teamId ?? null,
    teamSearch: query.teamSearch ?? null,
    ownerId: query.ownerId ?? null,
    actorUserId: query.actorUserId ?? null,
    action: query.action ?? null,
    actionPrefix: query.actionPrefix ?? null,
    actorRole: query.actorRole ?? null,
    source: query.source ?? null,
    entity: query.entity ?? null,
    entityId: query.entityId ?? null,
    correlationId: query.correlationId ?? null,
    since: query.since ?? null,
    until: query.until ?? null,
    onlyEconomic: query.onlyEconomic,
    onlyFailed: query.onlyFailed,
    onlyImpersonated: query.onlyImpersonated,
    minAbsTreasuryDelta: query.minAbsTreasuryDelta ?? null,
    minAbsTeamValueDelta: query.minAbsTeamValueDelta ?? null,
    q: query.q ?? null,
    deep: query.deep,
    ...("limit" in query ? { limit: query.limit, offset: query.offset } : {}),
    ...("order" in query ? { order: query.order } : {}),
  };
}

/**
 * Horodatage compact pour un nom de fichier d'export
 * (`2026-08-26T19-30-00`). Pas de `:` : illégal sous Windows.
 */
export function exportFilename(format: "csv" | "ndjson", now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
  return `journal-equipes-${stamp}.${format}`;
}

/** `GET /admin/team-journal` */
router.get(
  "/",
  validateQuery(adminTeamJournalQuerySchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const query = req.query as unknown as AdminTeamJournalQuery;
      const page = await searchTeamAuditEvents(
        prisma as never,
        toSearchFilters(query),
        detectProviderCapabilities(),
      );
      sendSuccess(res, page);
    } catch (e: unknown) {
      serverLog.error("[admin-team-journal] recherche impossible", e);
      sendError(res, "Erreur serveur", 500);
    }
  },
);

/** `GET /admin/team-journal/stats` */
router.get(
  "/stats",
  validateQuery(adminTeamJournalStatsQuerySchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const query = req.query as unknown as AdminTeamJournalStatsQuery;
      const summary = await summarizeAuditActivity(
        prisma as never,
        toSearchFilters(query),
        detectProviderCapabilities(),
        query.topN,
      );
      sendSuccess(res, summary);
    } catch (e: unknown) {
      serverLog.error("[admin-team-journal] agrégats impossibles", e);
      sendError(res, "Erreur serveur", 500);
    }
  },
);

/**
 * `GET /admin/team-journal/export`
 *
 * Sert un fichier (pas une enveloppe `ApiResponse`) : la sortie est destinée
 * à un tableur ou à un script, pas au client de l'application.
 */
router.get(
  "/export",
  validateQuery(adminTeamJournalExportQuerySchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const query = req.query as unknown as AdminTeamJournalExportQuery;
      const page = await searchTeamAuditEvents(
        prisma as never,
        toSearchFilters(query),
        detectProviderCapabilities(),
      );

      const filename = exportFilename(query.format, new Date());
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      // Le total non tronqué est utile au consommateur : il sait s'il a
      // tout, ou s'il doit resserrer ses filtres / paginer.
      res.setHeader("X-Total-Count", String(page.total));
      res.setHeader("X-Returned-Count", String(page.entries.length));

      if (query.format === "ndjson") {
        res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        res.send(toNdjson(page.entries));
        return;
      }
      // BOM UTF-8 : sans lui, Excel lit « Trésorerie » en Latin-1.
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(`﻿${toCsv(page.entries)}`);
    } catch (e: unknown) {
      serverLog.error("[admin-team-journal] export impossible", e);
      sendError(res, "Erreur serveur", 500);
    }
  },
);

/**
 * `GET /admin/team-journal/facets`
 *
 * Valeurs de filtre RÉELLEMENT présentes en base (slugs d'action, rôles,
 * sources). Évite de proposer une liste codée en dur qui divergerait dès
 * qu'un nouveau flux est instrumenté.
 */
router.get("/facets", async (_req: AuthenticatedRequest, res) => {
  try {
    const client = prisma as unknown as {
      teamAuditEvent: {
        groupBy: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      };
    };
    const [actions, roles, sources] = await Promise.all([
      client.teamAuditEvent.groupBy({
        by: ["action"],
        _count: { _all: true },
      }),
      client.teamAuditEvent.groupBy({
        by: ["actorRole"],
        _count: { _all: true },
      }),
      client.teamAuditEvent.groupBy({
        by: ["source"],
        _count: { _all: true },
      }),
    ]);

    const project = (rows: Array<Record<string, unknown>>, field: string) =>
      rows
        .map((r) => ({
          value: String(r[field] ?? ""),
          count: Number(
            (r._count as { _all?: number } | undefined)?._all ?? 0,
          ),
        }))
        .filter((r) => r.value.length > 0)
        .sort((a, b) => a.value.localeCompare(b.value));

    sendSuccess(res, {
      actions: project(actions, "action"),
      actorRoles: project(roles, "actorRole"),
      sources: project(sources, "source"),
    });
  } catch (e: unknown) {
    serverLog.error("[admin-team-journal] facettes impossibles", e);
    sendError(res, "Erreur serveur", 500);
  }
});

export default router;
