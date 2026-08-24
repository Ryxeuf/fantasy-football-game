/**
 * Routes publiques des règlements de tournoi (« rules packs »).
 * Accessibles sans authentification — consommées par le builder web, les
 * formulaires de création de ligue/coupe et la résolution des labels de
 * badges. Source : base (éditable admin) fusionnée avec le registre
 * statique @bb/game-engine (fallback env non seedé), via
 * `services/tournament-ruleset-repository`.
 *
 * NB sérialisation : les tranches de taxe ouvertes (`maxTotalCostK:
 * Infinity` côté moteur) sortent en JSON comme `null` — même convention
 * que le stockage DB ; le client web reconvertit null → Infinity.
 */

import { Router } from "express";
import {
  getTournamentRulesetRecord,
  listTournamentRulesetSummaries,
} from "../services/tournament-ruleset-repository";
import { memoizeAsync, invalidateMemoNamespace } from "../utils/memoize-async";
import { serverLog } from "../utils/server-log";

const router = Router();

// Aligné sur public-rosters : 5 min en prod, toujours frais hors prod.
const CACHE_TTL_MS = process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;
const LIST_NS = "public-tournament-rulesets-list";
const DETAIL_NS = "public-tournament-rulesets-detail";

/**
 * Vide le cache mémoire des endpoints publics des règlements. À appeler
 * après toute écriture admin (create/update/archive) pour que
 * `/api/tournament-rulesets[/:slug]` resserve des données fraîches sans
 * attendre l'expiration du TTL.
 */
export function invalidateTournamentRulesetCaches(): void {
  invalidateMemoNamespace(LIST_NS);
  invalidateMemoNamespace(DETAIL_NS);
}

/**
 * GET /api/tournament-rulesets
 * Liste des règlements sélectionnables (non archivés) : résumés légers
 * pour les listes déroulantes et la résolution de labels.
 */
router.get("/tournament-rulesets", async (_req, res) => {
  try {
    const payload = await memoizeAsync(LIST_NS, "all", CACHE_TTL_MS, async () => {
      const summaries = await listTournamentRulesetSummaries();
      return {
        tournamentRulesets: summaries.map((s) => ({
          slug: s.slug,
          nameFr: s.nameFr,
          nameEn: s.nameEn,
          shortLabel: s.shortLabel,
          version: s.version,
          edition: s.edition,
          format: s.format,
          resurrection: s.resurrection,
        })),
      };
    });
    res.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    serverLog.error(
      "Erreur lors de la récupération des règlements de tournoi:",
      error,
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/tournament-rulesets/:slug
 * Définition complète d'un règlement (règles par roster, barème, bannis…).
 * Les règlements ARCHIVÉS sont résolus aussi (flag `archived`) : les
 * entités qui les référencent doivent pouvoir afficher leurs règles.
 */
router.get("/tournament-rulesets/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const payload = await memoizeAsync(DETAIL_NS, slug, CACHE_TTL_MS, async () => {
      const record = await getTournamentRulesetRecord(slug);
      if (!record) return null;
      return {
        tournamentRuleset: { ...record.def, archived: record.archived },
      };
    });
    if (!payload) {
      res.status(404).json({ error: "Règlement de tournoi introuvable" });
      return;
    }
    res.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    serverLog.error(
      "Erreur lors de la récupération du règlement de tournoi:",
      error,
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: message });
  }
});

export default router;
