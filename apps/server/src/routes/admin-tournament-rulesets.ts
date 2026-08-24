/**
 * Routes admin des règlements de tournoi (« rules packs ») :
 * lister / créer / modifier / archiver-désarchiver / seeder.
 *
 * - Auth : `authUser` + `adminOnly` au niveau du routeur.
 * - Enveloppe : `sendSuccess` / `sendError` (routeur récent).
 * - Chaque écriture : audit (`tournamentRuleset.*`) + invalidation du cache
 *   des endpoints publics `/api/tournament-rulesets[/:slug]`.
 * - Le slug est IMMUABLE après création (référencé par
 *   Team/League/Cup.tournamentRuleset) ; pas de hard delete → archivage
 *   soft (`archivedAt`), idempotent, réversible.
 */

import { Router, type Response } from "express";
import { TEAM_ROSTERS_BY_RULESET, type TournamentRulesetDefinition } from "@bb/game-engine";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  safeRecordAdminActionFromRequest,
  type RecordAdminActionInput,
} from "../services/audit-log";
import {
  createTournamentRulesetSchema,
  updateTournamentRulesetSchema,
  type CreateTournamentRulesetBody,
  type UpdateTournamentRulesetBody,
} from "../schemas/admin-tournament-rulesets.schemas";
import {
  listTournamentRulesetSummaries,
  parseTournamentRulesetRow,
  serializeDefinitionForDb,
  type TournamentRulesetRow,
} from "../services/tournament-ruleset-repository";
import { seedTournamentRulesets } from "../scripts/seed-tournament-rulesets";
import { invalidateTournamentRulesetCaches } from "./public-tournament-rulesets";

const router = Router();
router.use(authUser, adminOnly);

async function safeAudit(
  req: AuthenticatedRequest,
  partial: Omit<RecordAdminActionInput, "userId" | "ipAddress" | "userAgent">,
): Promise<void> {
  await safeRecordAdminActionFromRequest(prisma, req, partial);
}

/** Corps validé (tranches null = ∞) → définition moteur. */
function bodyToDefinition(body: CreateTournamentRulesetBody): TournamentRulesetDefinition {
  return {
    slug: body.slug,
    nameFr: body.nameFr,
    nameEn: body.nameEn,
    shortLabel: body.shortLabel,
    version: body.version,
    edition: body.edition,
    format: body.format,
    descriptionFr: body.descriptionFr ?? "",
    resurrection: body.resurrection,
    minRegularPlayersBeforeStars: body.minRegularPlayersBeforeStars,
    rosterRules: body.rosterRules,
    skillCosts: body.skillCosts,
    eliteSkills: body.eliteSkills,
    bannedStarPlayers: body.bannedStarPlayers,
    starPlayerSppTax: body.starPlayerSppTax.map((b) => ({
      maxTotalCostK: b.maxTotalCostK ?? Number.POSITIVE_INFINITY,
      spp: b.spp,
    })),
    allowedInducements: body.allowedInducements,
    scoring: body.scoring,
  };
}

/**
 * Validation sémantique (au-delà des formes Zod) sur la définition
 * RÉSULTANTE : rosters connus de l'édition choisie, tranches de taxe
 * strictement croissantes avec l'ouverte (∞) en dernier.
 */
function semanticError(def: TournamentRulesetDefinition): string | null {
  const known = new Set(
    Object.keys(TEAM_ROSTERS_BY_RULESET[def.edition] ?? {}),
  );
  const unknown = Object.keys(def.rosterRules).filter((s) => !known.has(s));
  if (unknown.length > 0) {
    return `Rosters inconnus pour l'édition ${def.edition} : ${unknown.join(", ")}`;
  }
  const tax = def.starPlayerSppTax;
  for (let i = 0; i < tax.length; i += 1) {
    const bracket = tax[i];
    if (!Number.isFinite(bracket.maxTotalCostK) && i !== tax.length - 1) {
      return "La tranche de taxe ouverte (∞) doit être la dernière";
    }
    if (
      i > 0 &&
      Number.isFinite(bracket.maxTotalCostK) &&
      bracket.maxTotalCostK <= tax[i - 1].maxTotalCostK
    ) {
      return "Les tranches de taxe doivent être strictement croissantes";
    }
  }
  return null;
}

function rowToAdminPayload(row: TournamentRulesetRow & {
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const def = parseTournamentRulesetRow(row);
  if (!def) return null;
  return {
    id: row.id,
    ...def,
    archived: row.archivedAt !== null,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

/** GET / — liste admin (archivés inclus, entrées statiques non seedées incluses). */
router.get("/", async (_req: AuthenticatedRequest, res) => {
  try {
    const tournamentRulesets = await listTournamentRulesetSummaries({
      includeArchived: true,
    });
    sendSuccess(res, { tournamentRulesets });
  } catch (e) {
    serverLog.error("[admin-tournament-rulesets] list:", e);
    sendError(res, "Erreur serveur", 500);
  }
});

/** GET /:id — détail complet (formulaire d'édition). */
router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const row = (await prisma.tournamentRuleset.findUnique({
      where: { id: req.params.id },
    })) as (TournamentRulesetRow & { createdAt: Date; updatedAt: Date }) | null;
    if (!row) {
      sendError(res, "Règlement de tournoi introuvable", 404);
      return;
    }
    const payload = rowToAdminPayload(row);
    if (!payload) {
      sendError(res, "Règlement illisible (données corrompues)", 500);
      return;
    }
    sendSuccess(res, { tournamentRuleset: payload });
  } catch (e) {
    serverLog.error("[admin-tournament-rulesets] get:", e);
    sendError(res, "Erreur serveur", 500);
  }
});

/** POST / — création (slug unique, immuable ensuite). */
router.post(
  "/",
  validate(createTournamentRulesetSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body: CreateTournamentRulesetBody = req.body;
      const def = bodyToDefinition(body);
      const semantic = semanticError(def);
      if (semantic) {
        sendError(res, semantic, 400);
        return;
      }
      const existing = await prisma.tournamentRuleset.findUnique({
        where: { slug: def.slug },
        select: { id: true },
      });
      if (existing) {
        sendError(res, `Le slug ${def.slug} existe déjà`, 409);
        return;
      }
      const created = (await prisma.tournamentRuleset.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: serializeDefinitionForDb(def) as any,
      })) as TournamentRulesetRow & { createdAt: Date; updatedAt: Date };
      await safeAudit(req, {
        action: "tournamentRuleset.create",
        entity: "TournamentRuleset",
        entityId: created.id,
        newValue: body,
      });
      invalidateTournamentRulesetCaches();
      sendSuccess(res, { tournamentRuleset: rowToAdminPayload(created) }, 201);
    } catch (e) {
      serverLog.error("[admin-tournament-rulesets] create:", e);
      sendError(res, "Erreur serveur", 500);
    }
  },
);

/** PUT /:id — édition (le slug ne change JAMAIS ; champs fournis remplacés). */
router.put(
  "/:id",
  validate(updateTournamentRulesetSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body: UpdateTournamentRulesetBody = req.body;
      const row = (await prisma.tournamentRuleset.findUnique({
        where: { id: req.params.id },
      })) as TournamentRulesetRow | null;
      if (!row) {
        sendError(res, "Règlement de tournoi introuvable", 404);
        return;
      }
      const current = parseTournamentRulesetRow(row);
      if (!current) {
        sendError(res, "Règlement illisible (données corrompues)", 500);
        return;
      }
      // Définition résultante = existant écrasé par les champs fournis.
      const next: TournamentRulesetDefinition = {
        ...current,
        ...(body.nameFr !== undefined ? { nameFr: body.nameFr } : {}),
        ...(body.nameEn !== undefined ? { nameEn: body.nameEn } : {}),
        ...(body.shortLabel !== undefined ? { shortLabel: body.shortLabel } : {}),
        ...(body.version !== undefined ? { version: body.version } : {}),
        ...(body.edition !== undefined ? { edition: body.edition } : {}),
        ...(body.format !== undefined ? { format: body.format } : {}),
        ...(body.descriptionFr !== undefined
          ? { descriptionFr: body.descriptionFr ?? "" }
          : {}),
        ...(body.resurrection !== undefined
          ? { resurrection: body.resurrection }
          : {}),
        ...(body.minRegularPlayersBeforeStars !== undefined
          ? { minRegularPlayersBeforeStars: body.minRegularPlayersBeforeStars }
          : {}),
        ...(body.rosterRules !== undefined
          ? { rosterRules: body.rosterRules }
          : {}),
        ...(body.skillCosts !== undefined ? { skillCosts: body.skillCosts } : {}),
        ...(body.eliteSkills !== undefined
          ? { eliteSkills: body.eliteSkills }
          : {}),
        ...(body.bannedStarPlayers !== undefined
          ? { bannedStarPlayers: body.bannedStarPlayers }
          : {}),
        ...(body.starPlayerSppTax !== undefined
          ? {
              starPlayerSppTax: body.starPlayerSppTax.map((b) => ({
                maxTotalCostK: b.maxTotalCostK ?? Number.POSITIVE_INFINITY,
                spp: b.spp,
              })),
            }
          : {}),
        ...(body.allowedInducements !== undefined
          ? { allowedInducements: body.allowedInducements }
          : {}),
        ...(body.scoring !== undefined ? { scoring: body.scoring } : {}),
      };
      const semantic = semanticError(next);
      if (semantic) {
        sendError(res, semantic, 400);
        return;
      }
      const { slug: _slug, ...data } = serializeDefinitionForDb(next);
      const updated = (await prisma.tournamentRuleset.update({
        where: { id: row.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
      })) as TournamentRulesetRow & { createdAt: Date; updatedAt: Date };
      await safeAudit(req, {
        action: "tournamentRuleset.update",
        entity: "TournamentRuleset",
        entityId: row.id,
        oldValue: current,
        newValue: body,
      });
      invalidateTournamentRulesetCaches();
      sendSuccess(res, { tournamentRuleset: rowToAdminPayload(updated) });
    } catch (e) {
      serverLog.error("[admin-tournament-rulesets] update:", e);
      sendError(res, "Erreur serveur", 500);
    }
  },
);

/** Archive / désarchive (idempotents, réversibles). */
async function setArchived(
  req: AuthenticatedRequest,
  res: Response,
  archived: boolean,
): Promise<void> {
  try {
    const row = (await prisma.tournamentRuleset.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, archivedAt: true },
    })) as { id: string; slug: string; archivedAt: Date | null } | null;
    if (!row) {
      sendError(res, "Règlement de tournoi introuvable", 404);
      return;
    }
    const alreadyInState = archived
      ? row.archivedAt !== null
      : row.archivedAt === null;
    if (alreadyInState) {
      sendSuccess(res, { id: row.id, slug: row.slug, archived, changed: false });
      return;
    }
    await prisma.tournamentRuleset.update({
      where: { id: row.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await safeAudit(req, {
      action: archived
        ? "tournamentRuleset.archive"
        : "tournamentRuleset.unarchive",
      entity: "TournamentRuleset",
      entityId: row.id,
      newValue: { slug: row.slug, archived },
    });
    invalidateTournamentRulesetCaches();
    serverLog.info(
      `[admin-tournament-rulesets] ${row.slug} ${archived ? "archivé" : "désarchivé"} by user=${req.user?.id}`,
    );
    sendSuccess(res, { id: row.id, slug: row.slug, archived, changed: true });
  } catch (e) {
    serverLog.error("[admin-tournament-rulesets] archive:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.post("/:id/archive", (req: AuthenticatedRequest, res) =>
  setArchived(req, res, true),
);
router.post("/:id/unarchive", (req: AuthenticatedRequest, res) =>
  setArchived(req, res, false),
);

/**
 * POST /seed — matérialise en base les règlements du registre statique
 * absents (create-only, n'écrase jamais une ligne existante). Permet
 * d'éditer un pack livré en code (ex : NAF World Cup 2027).
 */
router.post("/seed", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await seedTournamentRulesets();
    await safeAudit(req, {
      action: "tournamentRuleset.seed",
      entity: "TournamentRuleset",
      newValue: result,
    });
    invalidateTournamentRulesetCaches();
    sendSuccess(res, result);
  } catch (e) {
    serverLog.error("[admin-tournament-rulesets] seed:", e);
    sendError(res, "Erreur serveur", 500);
  }
});

export default router;
