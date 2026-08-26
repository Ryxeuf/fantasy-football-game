/**
 * Route publique des règlements de tournoi.
 *
 * Le web ne lit plus le registre `@bb/game-engine` : le builder d'équipe, le
 * formulaire de ligue et les fiches consomment CETTE liste, donc les
 * définitions éditées en admin. Les fonctions pures du moteur (barèmes,
 * quotas, validation de plan) continuent de s'appliquer côté client — elles
 * prennent la définition en argument.
 *
 * Lecture seule et sans authentification : le contenu d'un règlement est
 * public (il est affiché dans le builder et sur les fiches de compétition).
 */

import { Router } from "express";
import { serializeDefinition } from "../schemas/tournament-ruleset.schemas";
import { listTournamentRulesets } from "../services/tournament-ruleset-repository";
import { serverLog } from "../utils/server-log";

const router = Router();

/**
 * `GET /api/tournament-rulesets`
 *  - `?slug=` : un seul règlement, désactivés compris (une équipe déjà créée
 *    doit pouvoir afficher le sien) ;
 *  - sinon : les règlements proposables à la création.
 */
router.get("/tournament-rulesets", async (req, res) => {
  try {
    const slug = typeof req.query.slug === "string" ? req.query.slug : null;
    const resolved = await listTournamentRulesets({
      includeDisabled: Boolean(slug),
    });
    const wanted = slug ? resolved.filter((r) => r.slug === slug) : resolved;
    res.json({
      rulesets: wanted.map((r) => ({
        slug: r.slug,
        enabled: r.enabled,
        // `Infinity` ne passe pas en JSON : la borne ouverte part en `null`,
        // le client la relit avec la même convention.
        definition: serializeDefinition(r.definition),
      })),
    });
  } catch (e: unknown) {
    serverLog.error("[public-tournament-rulesets] liste", e);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
