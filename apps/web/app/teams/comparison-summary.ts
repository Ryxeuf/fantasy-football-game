/**
 * Génère un court résumé comparatif (2-3 phrases) entre deux rosters, en
 * français ou en anglais. 100 % pur et déterministe (testable sans backend) :
 * c'est le « contenu réellement comparatif » qui empêche les pages
 * `/teams/comparer/[matchup]` d'être du contenu mince.
 */

import {
  DIFFICULTY_LABELS,
  DIFFICULTY_RANK,
  PLAYSTYLE_LABELS,
  type Difficulty,
  type Lang,
  type PlayStyle,
} from "./roster-meta";

export interface SummaryTeam {
  readonly name: string;
  readonly tier: string;
  readonly difficulty: Difficulty;
  readonly playStyle: PlayStyle;
}

const TIER_RANK: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };

function tierRank(tier: string): number {
  return TIER_RANK[tier] ?? 99;
}

export function buildComparisonSummary(
  a: SummaryTeam,
  b: SummaryTeam,
  lang: Lang = "fr",
): string {
  const sentences: string[] = [];
  const ra = tierRank(a.tier);
  const rb = tierRank(b.tier);

  if (lang === "en") {
    // Tier
    if (ra === rb) {
      sentences.push(
        `${a.name} and ${b.name} both sit in Tier ${a.tier}, so they are considered competitively close.`,
      );
    } else {
      const [stronger, weaker] = ra < rb ? [a, b] : [b, a];
      sentences.push(
        `${stronger.name} (Tier ${stronger.tier}) is generally rated more competitive than ${weaker.name} (Tier ${weaker.tier}).`,
      );
    }
    // Style
    if (a.playStyle === b.playStyle) {
      sentences.push(
        `Both teams favour a ${PLAYSTYLE_LABELS.en[a.playStyle].toLowerCase()} game.`,
      );
    } else {
      sentences.push(
        `${a.name} leans towards a ${PLAYSTYLE_LABELS.en[a.playStyle].toLowerCase()} game, whereas ${b.name} relies on a ${PLAYSTYLE_LABELS.en[b.playStyle].toLowerCase()} approach.`,
      );
    }
    // Difficulty
    const da = DIFFICULTY_RANK[a.difficulty];
    const db = DIFFICULTY_RANK[b.difficulty];
    if (da === db) {
      sentences.push(
        `They sit at a similar skill ceiling (${DIFFICULTY_LABELS.en[a.difficulty].toLowerCase()}).`,
      );
    } else {
      const [easier, harder] = da < db ? [a, b] : [b, a];
      sentences.push(
        `${easier.name} is friendlier to newcomers, while ${harder.name} rewards more experienced coaches.`,
      );
    }
    return sentences.join(" ");
  }

  // Français
  if (ra === rb) {
    sentences.push(
      `${a.name} et ${b.name} appartiennent toutes deux au Tier ${a.tier}, ce qui les place à un niveau de compétitivité proche.`,
    );
  } else {
    const [stronger, weaker] = ra < rb ? [a, b] : [b, a];
    sentences.push(
      `${stronger.name} (Tier ${stronger.tier}) est généralement jugée plus compétitive que ${weaker.name} (Tier ${weaker.tier}).`,
    );
  }
  if (a.playStyle === b.playStyle) {
    sentences.push(
      `Les deux équipes privilégient un jeu ${PLAYSTYLE_LABELS.fr[a.playStyle].toLowerCase()}.`,
    );
  } else {
    sentences.push(
      `${a.name} privilégie un jeu ${PLAYSTYLE_LABELS.fr[a.playStyle].toLowerCase()}, là où ${b.name} mise sur un jeu ${PLAYSTYLE_LABELS.fr[b.playStyle].toLowerCase()}.`,
    );
  }
  const da = DIFFICULTY_RANK[a.difficulty];
  const db = DIFFICULTY_RANK[b.difficulty];
  if (da === db) {
    sentences.push(
      `Elles demandent une maîtrise comparable (${DIFFICULTY_LABELS.fr[a.difficulty].toLowerCase()}).`,
    );
  } else {
    const [easier, harder] = da < db ? [a, b] : [b, a];
    sentences.push(
      `${easier.name} est plus accessible aux débutants, tandis que ${harder.name} récompense les coachs expérimentés.`,
    );
  }
  return sentences.join(" ");
}
