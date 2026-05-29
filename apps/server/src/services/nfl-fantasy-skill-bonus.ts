/**
 * Bonus SPP appliques aux skills Blood Bowl d'un joueur NFL Fantasy.
 *
 * Contexte
 * --------
 * Apres `computeSpp()` (cf. `@bb/nfl-mapper`), un joueur a un set
 * d'events TD/CP/DP/CAS/MALUS. Si le joueur possede des skills BB
 * (ex: `pass`, `block`, `sure-hands`, dérivés via `nfl-bb-derivation`),
 * on ajoute un bonus thematique par skill — toujours capé pour éviter
 * qu'un super match unique ne snowball.
 *
 * Pur, deterministe, replay-friendly. Aucun I/O.
 *
 * Architecture
 * ------------
 * Chaque SkillRule expose :
 *   - `match` (event → boolean) pour les patterns "+1 par event de type X"
 *   - OU `evaluate` (events[] → number) pour les patterns globaux
 *     (ex: safe-throw = passing TD AND aucune INT)
 *   - `aggregate` ("per-event" cape la somme | "any" cape a 1 binaire)
 *   - `cap` plafond SPP par match
 *   - `minMatches` (defaut 1) seuil minimal (ex: frenzy = 2 CAS)
 *
 * Le catalogue `NFL_FANTASY_SKILL_EFFECTS` (exporte) decrit chaque
 * effet pour l'UI (page regles + page carriere). MAJ obligatoire en
 * meme temps que le rule (cf. memoire nuffle-rules-pages-sync).
 *
 * Les skills sans effet de scoring (Trait, Scelerates, beaucoup
 * d'Agilite/Strength purement BB) ne sont volontairement pas
 * referencees ici — la page carriere les filtre via la presence dans
 * ce catalogue.
 */

import type { SppEvent } from "@bb/nfl-mapper";

export interface SkillBonusEvent {
  readonly skill: string;
  readonly count: number;
  readonly spp: number;
  readonly reason: string;
}

export interface SkillBonusResult {
  readonly bonusEvents: readonly SkillBonusEvent[];
  readonly totalBonusSpp: number;
}

interface SkillRule {
  readonly cap: number;
  readonly aggregate?: "per-event" | "any";
  readonly reasonLabel: string;
  /** Seuil minimal pour declencher le bonus (defaut 1). */
  readonly minMatches?: number;
  /** Matcher event-par-event (somme des counts). */
  readonly match?: (e: SppEvent) => boolean;
  /** Evaluation globale sur la liste d'events (cas avec AND/NOT). */
  readonly evaluate?: (events: readonly SppEvent[]) => number;
}

const REASON_PASSING_TD = /passing TD/i;
const REASON_PASSING_YARDS = /passing yards/i;
const REASON_RECEIVING_TD = /receiving TD/i;
const REASON_RECEPTIONS = /receptions/i;
const REASON_RUSHING_TD = /rushing TD(?! \(QB run\))/i;
const REASON_RUSHING_TD_QB = /rushing TD \(QB run\)/i;
const REASON_RUSHING_YD_50 = /rushing yards .* >=50/i;
const REASON_RUSHING_YD_75 = /rushing yards .* >=75/i;
const REASON_RUSHING_YD_100 = /rushing yards .* >=100/i;
const REASON_RECV_YD_100 = /recv yards .* >=100/i;
const REASON_RECV_YD_150 = /recv yards .* >=150/i;
const REASON_FUMBLE = /fumble lost/i;
const REASON_DROP = /drop/i;
const REASON_INT_THROWN = /INT thrown/i;
const REASON_INT_DEFENSIVE = /\b\d+\s+INT\b(?! thrown)/i;
const REASON_SACK_CAS = /sack\(s\) -> CAS/i;
const REASON_QB_HITS = /QB hits/i;
const REASON_PD = /\bPD\b/;
const REASON_TFL = /TFL/i;
const REASON_FORCED_FUMBLE = /forced fumble/i;
const REASON_FUMBLE_RECOVERY = /fumble recovery/i;
const REASON_PARTICIPATION_OL = /participation/i;
const REASON_TEAM_RUSH = /team rush/i;
const REASON_TEAM_RATING = /team rating/i;
const REASON_TEAM_SACKS_ALLOWED_LOW = /team sacks allowed.* <2/i;
const REASON_DEFENSIVE_TD = /defensive TD/i;
const REASON_TACKLES_10 = /tackles >=10/i;

const SKILL_BONUS_RULES: ReadonlyMap<string, SkillRule> = new Map<
  string,
  SkillRule
>([
  // ── Passing ────────────────────────────────────────────────────
  [
    "pass",
    {
      cap: 3,
      match: (e) => e.type === "TD" && REASON_PASSING_TD.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "passing TD",
    },
  ],
  [
    "accurate",
    {
      cap: 2,
      match: (e) => e.type === "CP" && REASON_PASSING_YARDS.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "CP de passing yards",
    },
  ],
  [
    "cannoneer",
    {
      cap: 1,
      // 4 CP from yards = >=300 yd passes (cap 4 = 4 * 75)
      evaluate: (events) => {
        const maxYardsCp = events
          .filter((e) => e.type === "CP" && REASON_PASSING_YARDS.test(e.reason))
          .reduce((acc, e) => acc + e.count, 0);
        return maxYardsCp >= 4 ? 1 : 0;
      },
      aggregate: "any",
      reasonLabel: "big-arm game (>=300 yd)",
    },
  ],
  [
    "strong-arm",
    {
      cap: 1,
      evaluate: (events) => {
        const yardsCp = events
          .filter((e) => e.type === "CP" && REASON_PASSING_YARDS.test(e.reason))
          .reduce((acc, e) => acc + e.count, 0);
        return yardsCp >= 3 ? 1 : 0; // >=225 yd
      },
      aggregate: "any",
      reasonLabel: "fort passeur (>=225 yd)",
    },
  ],
  [
    "running-pass",
    {
      cap: 1,
      // Necessite passing TD AND rushing TD (QB run)
      evaluate: (events) => {
        const hasPassTd = events.some(
          (e) => e.type === "TD" && REASON_PASSING_TD.test(e.reason),
        );
        const hasQbRunTd = events.some(
          (e) => e.type === "TD" && REASON_RUSHING_TD_QB.test(e.reason),
        );
        return hasPassTd && hasQbRunTd ? 1 : 0;
      },
      aggregate: "any",
      reasonLabel: "passing + rushing TD",
    },
  ],
  [
    "safe-throw",
    {
      cap: 1,
      // Passing TD AND aucune INT thrown
      evaluate: (events) => {
        const hasPassTd = events.some(
          (e) => e.type === "TD" && REASON_PASSING_TD.test(e.reason),
        );
        const hasInt = events.some(
          (e) => e.type === "MALUS" && REASON_INT_THROWN.test(e.reason),
        );
        return hasPassTd && !hasInt ? 1 : 0;
      },
      aggregate: "any",
      reasonLabel: "passing TD sans INT",
    },
  ],
  [
    "nerves-of-steel",
    {
      cap: 1,
      // Au moins 1 passing TD (resilience sous pression NFL approximee)
      match: (e) => e.type === "TD" && REASON_PASSING_TD.test(e.reason),
      aggregate: "any",
      reasonLabel: "TD sous pression",
    },
  ],
  // ── Rushing ────────────────────────────────────────────────────
  [
    "sprint",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_RUSHING_YD_100.test(e.reason),
      aggregate: "any",
      reasonLabel: "100+ yards rushing",
    },
  ],
  [
    "sure-feet",
    {
      cap: 1,
      // Rushing yards >=75 AND aucun fumble lost
      evaluate: (events) => {
        const hasRush = events.some(
          (e) => e.type === "CP" && REASON_RUSHING_YD_75.test(e.reason),
        );
        const hasFumble = events.some(
          (e) => e.type === "MALUS" && REASON_FUMBLE.test(e.reason),
        );
        return hasRush && !hasFumble ? 1 : 0;
      },
      aggregate: "any",
      reasonLabel: "course propre 75+ yd",
    },
  ],
  [
    "break-tackle",
    {
      cap: 2,
      match: (e) => e.type === "TD" && REASON_RUSHING_TD.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "rushing TD",
    },
  ],
  [
    "juggernaut",
    {
      cap: 1,
      // Au moins 1 rushing TD AND au moins 1 CAS
      evaluate: (events) => {
        const hasRushTd = events.some(
          (e) => e.type === "TD" && REASON_RUSHING_TD.test(e.reason),
        );
        const hasCas = events.some((e) => e.type === "CAS");
        return hasRushTd && hasCas ? 1 : 0;
      },
      aggregate: "any",
      reasonLabel: "rushing TD + CAS",
    },
  ],
  [
    "horns",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_RUSHING_YD_50.test(e.reason),
      aggregate: "any",
      reasonLabel: "rushing breakaway (50+)",
    },
  ],
  // ── Receiving ──────────────────────────────────────────────────
  [
    "catch",
    {
      cap: 1,
      match: (e) => e.type === "TD" && REASON_RECEIVING_TD.test(e.reason),
      aggregate: "any",
      reasonLabel: "receiving TD",
    },
  ],
  [
    "extra-arms",
    {
      cap: 2,
      match: (e) => e.type === "CP" && REASON_RECEPTIONS.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "CP de receptions",
    },
  ],
  [
    "monstrous-mouth",
    {
      cap: 2,
      match: (e) => e.type === "CP" && REASON_RECEPTIONS.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "CP de receptions",
    },
  ],
  [
    "big-hand",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_RECEPTIONS.test(e.reason),
      aggregate: "any",
      reasonLabel: "au moins 1 reception",
    },
  ],
  [
    "diving-catch",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_RECV_YD_100.test(e.reason),
      aggregate: "any",
      reasonLabel: "receiving 100+ yd",
    },
  ],
  [
    "very-long-legs",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_RECV_YD_150.test(e.reason),
      aggregate: "any",
      reasonLabel: "receiving 150+ yd",
    },
  ],
  [
    "safe-pair-of-hands",
    {
      cap: 2,
      match: (e) => e.type === "MALUS" && REASON_DROP.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "drop compense",
    },
  ],
  [
    "sure-hands",
    {
      cap: 2,
      match: (e) => e.type === "MALUS" && REASON_FUMBLE.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "fumble compense",
    },
  ],
  // ── Defensive ─────────────────────────────────────────────────
  [
    "block",
    {
      cap: 3,
      match: (e) => e.type === "CAS",
      aggregate: "per-event",
      reasonLabel: "CAS (block)",
    },
  ],
  [
    "claws",
    {
      cap: 3,
      match: (e) => e.type === "CAS",
      aggregate: "per-event",
      reasonLabel: "CAS (claws)",
    },
  ],
  [
    "arm-bar",
    {
      cap: 2,
      match: (e) => e.type === "CAS",
      aggregate: "per-event",
      reasonLabel: "CAS (arm-bar)",
    },
  ],
  [
    "wrestle",
    {
      cap: 1,
      match: (e) => e.type === "CAS",
      aggregate: "any",
      reasonLabel: "au moins 1 CAS",
    },
  ],
  [
    "pile-driver",
    {
      cap: 2,
      match: (e) => e.type === "CAS" && REASON_SACK_CAS.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "sack -> CAS",
    },
  ],
  [
    "frenzy",
    {
      cap: 1,
      match: (e) => e.type === "CAS",
      aggregate: "any",
      minMatches: 2,
      reasonLabel: "CAS multiple",
    },
  ],
  [
    "multiple-block",
    {
      cap: 1,
      // >=2 QB hits CAS (proxy 'frappes multiples')
      evaluate: (events) => {
        const hitCas = events
          .filter((e) => e.type === "CAS" && REASON_QB_HITS.test(e.reason))
          .reduce((acc, e) => acc + e.count, 0);
        return hitCas >= 1 ? 1 : 0;
      },
      aggregate: "any",
      reasonLabel: "frappes multiples (QB hits)",
    },
  ],
  [
    "dodge",
    {
      cap: 2,
      match: (e) => e.type === "DP" && REASON_INT_DEFENSIVE.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "INT",
    },
  ],
  [
    "defensive",
    {
      cap: 1,
      match: (e) => e.type === "DP" && REASON_INT_DEFENSIVE.test(e.reason),
      aggregate: "any",
      reasonLabel: "INT",
    },
  ],
  [
    "tackle",
    {
      cap: 1,
      match: (e) => e.type === "DP" && REASON_FORCED_FUMBLE.test(e.reason),
      aggregate: "any",
      reasonLabel: "forced fumble",
    },
  ],
  [
    "strip-ball",
    {
      cap: 2,
      match: (e) => e.type === "DP" && REASON_FORCED_FUMBLE.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "forced fumble",
    },
  ],
  [
    "prehensile-tail",
    {
      cap: 1,
      match: (e) => e.type === "DP" && REASON_FORCED_FUMBLE.test(e.reason),
      aggregate: "any",
      reasonLabel: "forced fumble",
    },
  ],
  [
    "tentacles",
    {
      cap: 1,
      match: (e) => e.type === "DP" && REASON_FORCED_FUMBLE.test(e.reason),
      aggregate: "any",
      reasonLabel: "forced fumble",
    },
  ],
  [
    "shadowing",
    {
      cap: 2,
      match: (e) => e.type === "CP" && REASON_PD.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "pass breakup",
    },
  ],
  [
    "side-step",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_PD.test(e.reason),
      aggregate: "any",
      reasonLabel: "pass breakup",
    },
  ],
  [
    "diving-tackle",
    {
      cap: 1,
      match: (e) => e.type === "CAS" && REASON_TACKLES_10.test(e.reason),
      aggregate: "any",
      reasonLabel: "10+ tackles",
    },
  ],
  [
    "fend",
    {
      cap: 1,
      // Forced fumble suivi (proxy : a la fois FF et fumble recovery)
      evaluate: (events) => {
        const hasFF = events.some(
          (e) => e.type === "DP" && REASON_FORCED_FUMBLE.test(e.reason),
        );
        const hasRecovery = events.some(
          (e) => e.type === "DP" && REASON_FUMBLE_RECOVERY.test(e.reason),
        );
        return hasFF && hasRecovery ? 1 : 0;
      },
      aggregate: "any",
      reasonLabel: "FF + recovery",
    },
  ],
  [
    "ball-and-chain",
    {
      cap: 1,
      match: (e) => e.type === "TD" && REASON_DEFENSIVE_TD.test(e.reason),
      aggregate: "any",
      reasonLabel: "defensive TD",
    },
  ],
  [
    "kick-team-mate",
    {
      cap: 1,
      // Defensive TD = pick-six / fumble return
      match: (e) => e.type === "TD" && REASON_DEFENSIVE_TD.test(e.reason),
      aggregate: "any",
      reasonLabel: "defensive TD",
    },
  ],
  // ── Lineman / OL ───────────────────────────────────────────────
  [
    "guard",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_TEAM_RUSH.test(e.reason),
      aggregate: "any",
      reasonLabel: "team run protege (>150 yd)",
    },
  ],
  [
    "stand-firm",
    {
      cap: 1,
      match: (e) =>
        e.type === "CP" && REASON_TEAM_SACKS_ALLOWED_LOW.test(e.reason),
      aggregate: "any",
      reasonLabel: "team sacks allowed <2",
    },
  ],
  [
    "brawler",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_TEAM_RATING.test(e.reason),
      aggregate: "any",
      reasonLabel: "team rating >100",
    },
  ],
  [
    "thick-skull",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_PARTICIPATION_OL.test(e.reason),
      aggregate: "any",
      reasonLabel: "participation OL",
    },
  ],
  // ── Bonus mixtes ────────────────────────────────────────────────
  [
    "leader",
    {
      cap: 1,
      // Au moins 1 TD (toutes provenances) — leadership offensif
      match: (e) => e.type === "TD",
      aggregate: "any",
      reasonLabel: "TD (leadership offensif)",
    },
  ],
  [
    "block-and-tackle",
    {
      cap: 1,
      // Hybride : 1 CAS ET 1 DP forced fumble
      evaluate: (events) => {
        const hasCas = events.some((e) => e.type === "CAS");
        const hasFf = events.some(
          (e) => e.type === "DP" && REASON_FORCED_FUMBLE.test(e.reason),
        );
        return hasCas && hasFf ? 1 : 0;
      },
      aggregate: "any",
      reasonLabel: "CAS + forced fumble",
    },
  ],
  [
    "tfl-specialist",
    {
      cap: 1,
      match: (e) => e.type === "CP" && REASON_TFL.test(e.reason),
      aggregate: "any",
      reasonLabel: "TFL 2+",
    },
  ],
]);

const MIGHTY_BLOW_RULE: SkillRule = {
  cap: 3,
  match: (e) => e.type === "CAS",
  aggregate: "per-event",
  reasonLabel: "CAS (mighty-blow)",
};

function resolveRule(skillSlug: string): SkillRule | null {
  const direct = SKILL_BONUS_RULES.get(skillSlug);
  if (direct) return direct;
  if (skillSlug.startsWith("mighty-blow")) return MIGHTY_BLOW_RULE;
  return null;
}

// ────────────────────────────────────────────────────────────────────
// Catalogue d'effets (UI : page regles + page carriere)
// ────────────────────────────────────────────────────────────────────

export type SkillFamily =
  | "passing"
  | "rushing"
  | "receiving"
  | "defensive"
  | "lineman"
  | "general";

export interface NflFantasySkillEffect {
  readonly slug: string;
  /** Effet en francais (court, pour tooltip / liste). */
  readonly effectFr: string;
  /** Cap maximal de bonus SPP par match. */
  readonly cap: number;
  /** Famille de trigger (pour les filtres UI). */
  readonly family: SkillFamily;
}

export const NFL_FANTASY_SKILL_EFFECTS: ReadonlyArray<NflFantasySkillEffect> = [
  // Passing
  { slug: "pass", effectFr: "+1 SPP par passing TD", cap: 3, family: "passing" },
  { slug: "accurate", effectFr: "+1 SPP par CP de passing yards (palier de 75)", cap: 2, family: "passing" },
  { slug: "cannoneer", effectFr: "+1 SPP si passing yards ≥ 300 yd", cap: 1, family: "passing" },
  { slug: "strong-arm", effectFr: "+1 SPP si passing yards ≥ 225 yd", cap: 1, family: "passing" },
  { slug: "running-pass", effectFr: "+1 SPP si passing TD ET rushing TD du QB", cap: 1, family: "passing" },
  { slug: "safe-throw", effectFr: "+1 SPP si passing TD ET aucune INT lancée", cap: 1, family: "passing" },
  { slug: "nerves-of-steel", effectFr: "+1 SPP si au moins 1 passing TD (résilience)", cap: 1, family: "passing" },
  // Rushing
  { slug: "sprint", effectFr: "+1 SPP si rushing yards ≥ 100 yd", cap: 1, family: "rushing" },
  { slug: "sure-feet", effectFr: "+1 SPP si rushing yards ≥ 75 ET aucun fumble", cap: 1, family: "rushing" },
  { slug: "break-tackle", effectFr: "+1 SPP par rushing TD (hors QB)", cap: 2, family: "rushing" },
  { slug: "juggernaut", effectFr: "+1 SPP si rushing TD ET au moins 1 CAS", cap: 1, family: "rushing" },
  { slug: "horns", effectFr: "+1 SPP si rushing yards ≥ 50 yd", cap: 1, family: "rushing" },
  // Receiving
  { slug: "catch", effectFr: "+1 SPP si au moins 1 receiving TD", cap: 1, family: "receiving" },
  { slug: "extra-arms", effectFr: "+1 SPP par CP de réception (cap 2)", cap: 2, family: "receiving" },
  { slug: "monstrous-mouth", effectFr: "+1 SPP par CP de réception (cap 2)", cap: 2, family: "receiving" },
  { slug: "big-hand", effectFr: "+1 SPP si au moins 1 réception", cap: 1, family: "receiving" },
  { slug: "diving-catch", effectFr: "+1 SPP si receiving yards ≥ 100 yd", cap: 1, family: "receiving" },
  { slug: "very-long-legs", effectFr: "+1 SPP si receiving yards ≥ 150 yd", cap: 1, family: "receiving" },
  { slug: "safe-pair-of-hands", effectFr: "+1 SPP par drop compensé", cap: 2, family: "receiving" },
  { slug: "sure-hands", effectFr: "+1 SPP par fumble compensé", cap: 2, family: "receiving" },
  // Defensive
  { slug: "block", effectFr: "+1 SPP par CAS (sacks)", cap: 3, family: "defensive" },
  { slug: "claws", effectFr: "+1 SPP par CAS (ignorance armure)", cap: 3, family: "defensive" },
  { slug: "arm-bar", effectFr: "+1 SPP par CAS", cap: 2, family: "defensive" },
  { slug: "wrestle", effectFr: "+1 SPP si au moins 1 CAS", cap: 1, family: "defensive" },
  { slug: "pile-driver", effectFr: "+1 SPP par CAS issu d'un sack", cap: 2, family: "defensive" },
  { slug: "frenzy", effectFr: "+1 SPP si ≥ 2 CAS dans le match", cap: 1, family: "defensive" },
  { slug: "multiple-block", effectFr: "+1 SPP si CAS issu de QB hits multiples", cap: 1, family: "defensive" },
  { slug: "mighty-blow-1", effectFr: "+1 SPP par CAS (toutes variantes +1/+2/+3)", cap: 3, family: "defensive" },
  { slug: "dodge", effectFr: "+1 SPP par INT défensive", cap: 2, family: "defensive" },
  { slug: "defensive", effectFr: "+1 SPP si au moins 1 INT", cap: 1, family: "defensive" },
  { slug: "tackle", effectFr: "+1 SPP si au moins 1 forced fumble", cap: 1, family: "defensive" },
  { slug: "strip-ball", effectFr: "+1 SPP par forced fumble", cap: 2, family: "defensive" },
  { slug: "prehensile-tail", effectFr: "+1 SPP si au moins 1 forced fumble", cap: 1, family: "defensive" },
  { slug: "tentacles", effectFr: "+1 SPP si au moins 1 forced fumble", cap: 1, family: "defensive" },
  { slug: "shadowing", effectFr: "+1 SPP par pass breakup", cap: 2, family: "defensive" },
  { slug: "side-step", effectFr: "+1 SPP si au moins 1 pass breakup", cap: 1, family: "defensive" },
  { slug: "diving-tackle", effectFr: "+1 SPP si ≥ 10 tackles dans le match", cap: 1, family: "defensive" },
  { slug: "fend", effectFr: "+1 SPP si forced fumble ET recovery dans le match", cap: 1, family: "defensive" },
  { slug: "ball-and-chain", effectFr: "+1 SPP si TD défensif (pick-six / fumble return)", cap: 1, family: "defensive" },
  { slug: "kick-team-mate", effectFr: "+1 SPP si TD défensif", cap: 1, family: "defensive" },
  { slug: "block-and-tackle", effectFr: "+1 SPP si CAS ET forced fumble dans le match", cap: 1, family: "defensive" },
  { slug: "tfl-specialist", effectFr: "+1 SPP si tackles for loss ≥ 2", cap: 1, family: "defensive" },
  // Lineman
  { slug: "guard", effectFr: "+1 SPP si team rushing yards > 150 yd", cap: 1, family: "lineman" },
  { slug: "stand-firm", effectFr: "+1 SPP si team sacks allowed < 2", cap: 1, family: "lineman" },
  { slug: "brawler", effectFr: "+1 SPP si team passer rating > 100", cap: 1, family: "lineman" },
  { slug: "thick-skull", effectFr: "+1 SPP par participation OL (fallback no-team-context)", cap: 1, family: "lineman" },
  // General
  { slug: "leader", effectFr: "+1 SPP si au moins 1 TD (offensif, toutes natures)", cap: 1, family: "general" },
];

export const NFL_FANTASY_SKILL_EFFECTS_BY_SLUG: ReadonlyMap<
  string,
  NflFantasySkillEffect
> = new Map(NFL_FANTASY_SKILL_EFFECTS.map((e) => [e.slug, e] as const));

/**
 * Retourne l'effet d'une skill si elle a un impact SPP, null sinon.
 * Gere les mighty-blow variantes (mighty-blow-2, mighty-blow-3 → meme
 * description que mighty-blow-1).
 */
export function getSkillEffect(slug: string): NflFantasySkillEffect | null {
  const direct = NFL_FANTASY_SKILL_EFFECTS_BY_SLUG.get(slug);
  if (direct) return direct;
  if (slug.startsWith("mighty-blow")) {
    return NFL_FANTASY_SKILL_EFFECTS_BY_SLUG.get("mighty-blow-1") ?? null;
  }
  return null;
}

/**
 * Calcule le nombre brut de matches pour un rule, en utilisant
 * `evaluate` si fourni, sinon `match` event-par-event.
 */
function countMatches(
  rule: SkillRule,
  events: readonly SppEvent[],
): number {
  if (rule.evaluate) return rule.evaluate(events);
  if (rule.match) {
    let matched = 0;
    for (const e of events) {
      if (rule.match(e)) matched += e.count;
    }
    return matched;
  }
  return 0;
}

/**
 * Pour `aggregate: "per-event"` → bonus = min(matched, cap).
 * Pour `aggregate: "any"`       → bonus = 1 si matched >= minMatches.
 *
 * `minMatches` permet d'exiger un seuil avant declenchement (ex: frenzy
 * demande au moins 2 CAS).
 */
function applyRule(
  skillSlug: string,
  rule: SkillRule,
  events: readonly SppEvent[],
): SkillBonusEvent | null {
  const matched = countMatches(rule, events);
  const minMatches = rule.minMatches ?? 1;
  if (matched < minMatches) return null;

  const count = rule.aggregate === "per-event" ? Math.min(matched, rule.cap) : 1;
  return {
    skill: skillSlug,
    count,
    spp: count,
    reason: `+${count} SPP via ${skillSlug} (${rule.reasonLabel})`,
  };
}

/**
 * Calcule les bonus SPP que les skills BB du joueur ajoutent aux
 * events de scoring déjà calculés par `computeSpp()`.
 *
 * @param events Events SPP du match (issus de `NflGameStat.sppBreakdown`).
 * @param bbSkills Skills BB du joueur (`NflPlayer.bbSkills`).
 * @returns Bonus events + total SPP additionnel.
 */
export function applySkillBonuses(opts: {
  events: readonly SppEvent[];
  bbSkills: readonly string[];
}): SkillBonusResult {
  if (opts.events.length === 0 || opts.bbSkills.length === 0) {
    return { bonusEvents: [], totalBonusSpp: 0 };
  }
  const seen = new Set<string>();
  const bonusEvents: SkillBonusEvent[] = [];
  let total = 0;
  for (const skillSlug of opts.bbSkills) {
    if (seen.has(skillSlug)) continue;
    seen.add(skillSlug);
    const rule = resolveRule(skillSlug);
    if (!rule) continue;
    const bonus = applyRule(skillSlug, rule, opts.events);
    if (bonus) {
      bonusEvents.push(bonus);
      total += bonus.spp;
    }
  }
  return { bonusEvents, totalBonusSpp: total };
}

/**
 * Parser tolerant (PG natif vs sqlite serialise) pour extraire les
 * events d'un `sppBreakdown` lu en DB. Retourne `[]` si non parsable.
 */
export function parseSppEvents(raw: unknown): readonly SppEvent[] {
  if (!raw) return [];
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (typeof candidate !== "object" || candidate === null) return [];
  const obj = candidate as { events?: unknown };
  if (!Array.isArray(obj.events)) return [];
  const out: SppEvent[] = [];
  for (const e of obj.events) {
    if (typeof e !== "object" || e === null) continue;
    const ev = e as Partial<SppEvent>;
    if (
      typeof ev.type === "string" &&
      typeof ev.count === "number" &&
      typeof ev.spp === "number" &&
      typeof ev.reason === "string"
    ) {
      out.push(ev as SppEvent);
    }
  }
  return out;
}

/**
 * Parser tolerant pour `bbSkills` (Json — array natif PG ou string
 * serialisee sqlite, null/undefined autorisé).
 */
export function parseBbSkills(raw: unknown): readonly string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}
