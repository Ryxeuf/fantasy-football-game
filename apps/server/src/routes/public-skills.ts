/**
 * Route publique pour récupérer les compétences
 * Accessible sans authentification
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { resolveRuleset } from "../utils/ruleset-helpers";
import { memoizeAsync } from "../utils/memoize-async";
import { serverLog } from "../utils/server-log";

const router = Router();

const SKILLS_CACHE_TTL_MS = 5 * 60 * 1000;
const SKILLS_NS = "public-skills";

interface SkillRow {
  id: string;
  slug: string;
  ruleset: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
}

async function loadSkills(
  ruleset: string,
  category?: string,
): Promise<{ skills: SkillRow[] }> {
  const where: Record<string, unknown> = { ruleset };
  if (category) where.category = category;
  const skills = await prisma.skill.findMany({
    where,
    orderBy: [{ category: "asc" }, { nameFr: "asc" }],
    select: {
      id: true,
      slug: true,
      ruleset: true,
      nameFr: true,
      nameEn: true,
      description: true,
      descriptionEn: true,
      category: true,
    },
  });
  return { skills: skills as SkillRow[] };
}

router.get("/skills", async (req, res) => {
  try {
    const { category, search, ruleset } = req.query;
    const rs = resolveRuleset(ruleset as string | undefined);
    // `search` hits the DB with an OR across five columns — rarely cacheable
    // and easy to explode into unbounded cache keys. Bypass memoization when
    // present; serve cached list otherwise.
    if (search) {
      const where: any = { ruleset: rs };
      if (category) where.category = category;
      where.OR = [
        { slug: { contains: search as string, mode: "insensitive" } },
        { nameFr: { contains: search as string, mode: "insensitive" } },
        { nameEn: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        { descriptionEn: { contains: search as string, mode: "insensitive" } },
      ];
      const skills = await prisma.skill.findMany({
        where,
        orderBy: [{ category: "asc" }, { nameFr: "asc" }],
        select: {
          id: true,
          slug: true,
          ruleset: true,
          nameFr: true,
          nameEn: true,
          description: true,
          descriptionEn: true,
          category: true,
        },
      });
      res.json({ skills });
      return;
    }

    const cat = typeof category === "string" ? category : "";
    const payload = await memoizeAsync(
      SKILLS_NS,
      `${rs}::${cat}`,
      SKILLS_CACHE_TTL_MS,
      () => loadSkills(rs, cat || undefined),
    );
    res.json(payload);
  } catch (error: any) {
    serverLog.error(
      "Erreur lors de la récupération des compétences publiques:",
      error,
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

export default router;
