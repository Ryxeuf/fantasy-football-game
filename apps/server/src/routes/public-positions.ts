/**
 * Route publique pour récupérer les positions
 * Accessible sans authentification
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { resolveRuleset, DEFAULT_RULESET } from "../utils/ruleset-helpers";
import { memoizeAsync } from "../utils/memoize-async";

const router = Router();

const POSITIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const POSITIONS_LIST_NS = "public-positions-list";
const POSITIONS_DETAIL_NS = "public-positions-detail";

interface TransformedPosition {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
  rosterSlug: string;
  rosterName: string;
}

async function loadPositionList(
  lang: string,
  ruleset: string,
  rosterSlug?: string,
): Promise<{ positions: TransformedPosition[]; ruleset: string }> {
  const isEnglish = lang === "en";
  const where: any = { roster: { ruleset } };
  if (rosterSlug) {
    where.roster = { slug: rosterSlug, ruleset };
  }
  const positions = await prisma.position.findMany({
    where,
    include: {
      roster: { select: { slug: true, name: true, nameEn: true } },
      skills: { include: { skill: true } },
    },
    orderBy: [{ roster: { name: "asc" } }, { displayName: "asc" }],
  });
  const transformed = positions.map((position: any) =>
    transformPosition(position, isEnglish),
  );
  return { positions: transformed, ruleset };
}

async function loadPositionDetail(
  slug: string,
  lang: string,
  ruleset: string,
): Promise<{ position: TransformedPosition; ruleset: string } | null> {
  const isEnglish = lang === "en";
  const position = await prisma.position.findFirst({
    where: { slug, roster: { ruleset } },
    include: {
      roster: { select: { slug: true, name: true, nameEn: true } },
      skills: { include: { skill: true } },
    },
  });
  if (position) {
    return { position: transformPosition(position, isEnglish), ruleset };
  }
  if (ruleset !== DEFAULT_RULESET) {
    const fallback = await prisma.position.findFirst({
      where: { slug, roster: { ruleset: DEFAULT_RULESET } },
      include: {
        roster: { select: { slug: true, name: true, nameEn: true } },
        skills: { include: { skill: true } },
      },
    });
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
 * Obtenir la liste des positions (optionnellement filtrées par roster)
 * Query param: ?lang=en ou ?lang=fr (par défaut: fr)
 */
router.get("/positions", async (req, res) => {
  try {
    const lang = (req.query.lang as string) || "fr";
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
    const rosterSlug =
      typeof req.query.rosterSlug === "string" ? req.query.rosterSlug : "";
    const payload = await memoizeAsync(
      POSITIONS_LIST_NS,
      `${lang}::${ruleset}::${rosterSlug}`,
      POSITIONS_CACHE_TTL_MS,
      () => loadPositionList(lang, ruleset, rosterSlug || undefined),
    );
    res.json(payload);
  } catch (error: any) {
    console.error("Erreur lors de la récupération des positions:", error);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

/**
 * GET /api/positions/:slug
 * Obtenir une position par son slug
 * Query param: ?lang=en ou ?lang=fr (par défaut: fr)
 */
router.get("/positions/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const lang = (req.query.lang as string) || "fr";
    const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
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
  } catch (error: any) {
    console.error("Erreur lors de la récupération de la position:", error);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

function transformPosition(
  position: any,
  isEnglish: boolean,
): TransformedPosition {
  return {
    slug: position.slug,
    displayName: position.displayName,
    cost: position.cost,
    min: position.min,
    max: position.max,
    ma: position.ma,
    st: position.st,
    ag: position.ag,
    pa: position.pa,
    av: position.av,
    skills: position.skills.map((ps: any) => ps.skill.slug).join(","),
    rosterSlug: position.roster.slug,
    rosterName: isEnglish ? position.roster.nameEn : position.roster.name,
  };
}

export default router;
