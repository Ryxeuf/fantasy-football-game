/**
 * Page "A propos" / About (Q.15 — Sprint 23).
 *
 * Server component : recupere les chiffres reels (rosters, star players,
 * skills, tutoriels) et compose le contenu via le builder pur
 * `buildAboutContent`. Page publique citable conçue pour les LLM (GEO).
 *
 * Audit statique vs base — lot 5 (W14) : ces chiffres étaient comptés sur les
 * catalogues COMPILÉS, alors que l'API sert le contenu réel de la base. Une
 * équipe ou une compétence ajoutée en admin ne changeait pas une page pourtant
 * indexée et citée. On compte donc côté API, avec les catalogues en repli
 * quand elle est injoignable (build sans backend).
 */
import {
  TEAM_ROSTERS_BY_RULESET,
  STAR_PLAYERS_BY_RULESET,
  listTutorialScripts,
  SKILLS_DEFINITIONS,
} from "@bb/game-engine";
import { getServerApiBase, safeServerJson } from "../lib/serverApi";
import { buildAboutContent } from "./about-content";
import AboutClient from "./AboutClient";

// ISR plutôt que statique au build : les chiffres suivent la base sans
// redéploiement.
export const revalidate = 3600;

function countSkills(): number {
  return SKILLS_DEFINITIONS.length;
}

function countRosters(): number {
  const all = new Set<string>();
  for (const rulesetKey of Object.keys(
    TEAM_ROSTERS_BY_RULESET,
  ) as Array<keyof typeof TEAM_ROSTERS_BY_RULESET>) {
    for (const slug of Object.keys(TEAM_ROSTERS_BY_RULESET[rulesetKey])) {
      all.add(slug);
    }
  }
  return all.size;
}

function countStarPlayers(): number {
  const all = new Set<string>();
  for (const rulesetKey of Object.keys(
    STAR_PLAYERS_BY_RULESET,
  ) as Array<keyof typeof STAR_PLAYERS_BY_RULESET>) {
    for (const slug of Object.keys(STAR_PLAYERS_BY_RULESET[rulesetKey])) {
      all.add(slug);
    }
  }
  return all.size;
}

/**
 * Nombre d'entrées distinctes servies par l'API sur les deux éditions.
 * `null` si l'API ne répond pas — l'appelant retombe alors sur le catalogue.
 */
async function countFromApi(
  path: (ruleset: string) => string,
  pick: (payload: any) => unknown[] | undefined,
): Promise<number | null> {
  const base = getServerApiBase();
  const slugs = new Set<string>();
  let answered = false;
  for (const ruleset of ["season_2", "season_3"]) {
    const payload = await safeServerJson<any>(`${base}${path(ruleset)}`, {
      next: { revalidate: 3600, tags: ["rosters"] },
    });
    const rows = pick(payload);
    if (!rows) continue;
    answered = true;
    for (const row of rows) {
      const slug = (row as { slug?: unknown })?.slug;
      if (typeof slug === "string") slugs.add(slug);
    }
  }
  return answered ? slugs.size : null;
}

export default async function AboutPage() {
  const [rosterCount, starPlayerCount, skillCount] = await Promise.all([
    countFromApi(
      (r) => `/api/rosters?lang=fr&ruleset=${r}`,
      (p) => p?.rosters,
    ),
    countFromApi(
      (r) => `/star-players?ruleset=${r}`,
      (p) => p?.data,
    ),
    countFromApi((r) => `/api/skills?ruleset=${r}`, (p) => p?.skills),
  ]);

  const counts = {
    rosterCount: rosterCount ?? countRosters(),
    starPlayerCount: starPlayerCount ?? countStarPlayers(),
    skillCount: skillCount ?? countSkills(),
    tutorialCount: listTutorialScripts().length,
  };

  const contentFr = buildAboutContent({ ...counts, foundingYear: 2025, language: "fr" });
  const contentEn = buildAboutContent({ ...counts, foundingYear: 2025, language: "en" });

  return <AboutClient contentFr={contentFr} contentEn={contentEn} />;
}
