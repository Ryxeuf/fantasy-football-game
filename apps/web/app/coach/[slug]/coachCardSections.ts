import type {
  CoachEloSnapshot,
  CoachPublicProfile,
} from "./types";

export interface CoachCardSections {
  /** PDF document title — coach pseudo. */
  title: string;
  /** Subtitle line: ELO + slug + member-since (+ optional supporter mention). */
  subtitle: string;
  /** Rows for the achievements vitrine table: [nameFr, category, year]. */
  achievementRows: string[][];
  /** Rows for the recent teams summary table: [name, rosterDisplay, valueFr]. */
  recentTeamRows: string[][];
  /** ELO history one-liner (min / max / last / count) — null if no snapshots. */
  eloSummary: string | null;
  /** Suggested PDF filename (URL-safe slug). */
  fileName: string;
}

const ROSTER_DISPLAY: Record<string, string> = {
  skaven: "Skaven",
  human: "Human",
  orc: "Orc",
  dwarf: "Dwarf",
  chaos: "Chaos",
  undead: "Undead",
  wood_elf: "Wood Elf",
  dark_elf: "Dark Elf",
  high_elf: "High Elf",
  norse: "Norse",
  amazon: "Amazon",
  goblin: "Goblin",
  halfling: "Halfling",
  ogre: "Ogre",
  vampire: "Vampire",
  lizardmen: "Lizardmen",
  necromantic: "Necromantic Horror",
  underworld: "Underworld Denizens",
  black_orc: "Black Orc",
  imperial: "Imperial Nobility",
};

function rosterDisplay(slug: string): string {
  return ROSTER_DISPLAY[slug] ?? slug;
}

function yearOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return String(d.getUTCFullYear());
}

function formatGoldPieces(gp: number): string {
  return `${gp.toLocaleString("fr-FR")} po`;
}

/**
 * S26.3o — Pure data builder for the coach-card PDF export.
 *
 * Kept stricly pure (no jspdf import) so it can be unit-tested without
 * the heavy PDF runtime. The button component imports both this and
 * jspdf dynamically to keep the bundle slim.
 */
export function buildCoachCardSections(
  profile: CoachPublicProfile,
  snapshots: CoachEloSnapshot[],
): CoachCardSections {
  const supporterTag = profile.isSupporter
    ? ` - Supporter${profile.supporterTier ? ` ${profile.supporterTier}` : ""}`
    : "";
  // ELO masque (coach `hidden_admin`) ⇒ on remplace par "Non classe" dans le PDF.
  const eloLabel = profile.eloRating === null ? "Non classe" : `ELO ${profile.eloRating}`;
  const subtitle =
    `${eloLabel} - @${profile.slug} - Membre depuis ` +
    `${yearOf(profile.memberSince)}${supporterTag}`;

  const achievementRows = profile.achievements.map((a) => [
    a.nameFr,
    a.category,
    yearOf(a.unlockedAt),
  ]);

  const recentTeamRows = profile.recentTeams.map((t) => [
    t.name,
    rosterDisplay(t.roster),
    formatGoldPieces(t.currentValue),
  ]);

  let eloSummary: string | null = null;
  if (snapshots.length > 0) {
    const ratings = snapshots.map((s) => s.rating);
    const min = Math.min(...ratings);
    const max = Math.max(...ratings);
    const last = snapshots[snapshots.length - 1].rating;
    eloSummary = `Min ${min} - Max ${max} - Dernier ${last} - ${snapshots.length} match${snapshots.length > 1 ? "s" : ""}`;
  }

  return {
    title: profile.coachName,
    subtitle,
    achievementRows,
    recentTeamRows,
    eloSummary,
    fileName: `coach-${profile.slug}.pdf`,
  };
}
