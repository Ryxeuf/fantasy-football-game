/**
 * Route publique pour récupérer les positions
 * Accessible sans authentification
 */

import { Router } from "express";
import { getPositionNameEn } from "@bb/game-engine";
import { prisma } from "../prisma";
import { resolveRuleset, DEFAULT_RULESET } from "../utils/ruleset-helpers";
import { memoizeAsync } from "../utils/memoize-async";
import { serverLog } from "../utils/server-log";
import { validateQuery, validateParams } from "../middleware/validate";
import {
  positionsListQuerySchema,
  positionDetailQuerySchema,
  positionSlugParamSchema,
  type PositionsListQuery,
  type PositionDetailQuery,
  type PositionSlugParam,
} from "../schemas/public-positions.schemas";

const router = Router();

const POSITIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const POSITIONS_LIST_NS = "public-positions-list";
const POSITIONS_DETAIL_NS = "public-positions-detail";

const POSITION_INCLUDE = {
  roster: { select: { slug: true, name: true, nameEn: true } },
  skills: { include: { skill: true } },
} as const;

/**
 * Forme typee d'une position telle que chargee avec ses relations. Le client
 * `prisma` est typed `any` dans ce repo (cf. `../prisma`) : on type donc
 * explicitement la ligne pour eliminer les `any` du handler.
 */
interface PositionRow {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  primarySkills: string | null;
  secondarySkills: string | null;
  roster: { slug: string; name: string; nameEn: string };
  skills: ReadonlyArray<{ skill: { slug: string } }>;
}

interface TransformedPosition {
  slug: string;
  displayName: string;
  /** Nom anglais officiel (null si non renseigné → repli FR côté client). */
  displayNameEn: string | null;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  primarySkills: string | null;
  secondarySkills: string | null;
  rosterSlug: string;
  rosterName: string;
}

async function loadPositionList(
  lang: string,
  ruleset: string,
  rosterSlug?: string,
): Promise<{ positions: TransformedPosition[]; ruleset: string }> {
  const isEnglish = lang === "en";
  const where = rosterSlug
    ? { roster: { slug: rosterSlug, ruleset } }
    : { roster: { ruleset } };
  const positions = (await prisma.position.findMany({
    where,
    include: POSITION_INCLUDE,
    orderBy: [{ roster: { name: "asc" } }, { displayName: "asc" }],
  })) as PositionRow[];
  return {
    positions: positions.map((p) => transformPosition(p, isEnglish)),
    ruleset,
  };
}

async function loadPositionDetail(
  slug: string,
  lang: string,
  ruleset: string,
): Promise<{ position: TransformedPosition; ruleset: string } | null> {
  const isEnglish = lang === "en";
  const position = (await prisma.position.findFirst({
    where: { slug, roster: { ruleset } },
    include: POSITION_INCLUDE,
  })) as PositionRow | null;
  if (position) {
    return { position: transformPosition(position, isEnglish), ruleset };
  }
  if (ruleset !== DEFAULT_RULESET) {
    const fallback = (await prisma.position.findFirst({
      where: { slug, roster: { ruleset: DEFAULT_RULESET } },
      include: POSITION_INCLUDE,
    })) as PositionRow | null;
    if (fallback) {
      return {
        position: transformPosition(fallback, isEnglish),
        ruleset: DEFAULT_RULESET,
      };
    }
  }
  return null;
}

/**
 * GET /api/positions
 * Liste des positions (optionnellement filtrées par roster).
 * Query : ?lang=en|fr (def. fr), ?ruleset=season_2|season_3, ?rosterSlug=skaven
 */
router.get(
  "/positions",
  validateQuery(positionsListQuerySchema),
  async (req, res) => {
    try {
      const query = req.query as unknown as PositionsListQuery;
      const lang = query.lang ?? "fr";
      const ruleset = resolveRuleset(query.ruleset);
      const rosterSlug = query.rosterSlug ?? "";
      const payload = await memoizeAsync(
        POSITIONS_LIST_NS,
        `${lang}::${ruleset}::${rosterSlug}`,
        POSITIONS_CACHE_TTL_MS,
        () => loadPositionList(lang, ruleset, rosterSlug || undefined),
      );
      res.json(payload);
    } catch (error: unknown) {
      serverLog.error("Erreur lors de la récupération des positions:", error);
      res.setHeader("Cache-Control", "no-store");
      const message = error instanceof Error ? error.message : "Erreur serveur";
      res.status(500).json({ error: message });
    }
  },
);

/**
 * GET /api/positions/:slug
 * Une position par son slug (avec repli sur l'édition par défaut).
 */
router.get(
  "/positions/:slug",
  validateParams(positionSlugParamSchema),
  validateQuery(positionDetailQuerySchema),
  async (req, res) => {
    try {
      const { slug } = req.params as unknown as PositionSlugParam;
      const query = req.query as unknown as PositionDetailQuery;
      const lang = query.lang ?? "fr";
      const ruleset = resolveRuleset(query.ruleset);
      const payload = await memoizeAsync(
        POSITIONS_DETAIL_NS,
        `${slug}::${lang}::${ruleset}`,
        POSITIONS_CACHE_TTL_MS,
        () => loadPositionDetail(slug, lang, ruleset),
      );
      if (!payload) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).json({ error: "Position non trouvée" });
      }
      res.json(payload);
    } catch (error: unknown) {
      serverLog.error("Erreur lors de la récupération de la position:", error);
      res.setHeader("Cache-Control", "no-store");
      const message = error instanceof Error ? error.message : "Erreur serveur";
      res.status(500).json({ error: message });
    }
  },
);

function transformPosition(
  position: PositionRow,
  isEnglish: boolean,
): TransformedPosition {
  return {
    slug: position.slug,
    displayName: position.displayName,
    displayNameEn: getPositionNameEn(position.slug) ?? null,
    cost: position.cost,
    min: position.min,
    max: position.max,
    ma: position.ma,
    st: position.st,
    ag: position.ag,
    pa: position.pa,
    av: position.av,
    skills: position.skills.map((ps) => ps.skill.slug).join(","),
    primarySkills: position.primarySkills ?? null,
    secondarySkills: position.secondarySkills ?? null,
    rosterSlug: position.roster.slug,
    rosterName: isEnglish ? position.roster.nameEn : position.roster.name,
  };
}

export default router;
