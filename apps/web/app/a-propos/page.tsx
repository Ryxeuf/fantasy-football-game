/**
 * Page "A propos" / About (Q.15 — Sprint 23).
 *
 * Server component : recupere les chiffres reels (rosters, star players,
 * skills, tutoriels) au build et compose le contenu via le builder pur
 * `buildAboutContent`. Page publique citable conçue pour les LLM (GEO).
 */
import {
  TEAM_ROSTERS_BY_RULESET,
  STAR_PLAYERS_BY_RULESET,
  listTutorialScripts,
  SKILLS_DEFINITIONS,
} from "@bb/game-engine";
import { buildAboutContent } from "./about-content";
import AboutClient from "./AboutClient";

export const dynamic = "force-static";

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

export default function AboutPage() {
  const counts = {
    rosterCount: countRosters(),
    starPlayerCount: countStarPlayers(),
    skillCount: countSkills(),
    tutorialCount: listTutorialScripts().length,
  };

  const contentFr = buildAboutContent({ ...counts, foundingYear: 2025, language: "fr" });
  const contentEn = buildAboutContent({ ...counts, foundingYear: 2025, language: "en" });

  return <AboutClient contentFr={contentFr} contentEn={contentEn} />;
}
