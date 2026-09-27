/**
 * Adaptateurs LIGUE : réponses de l'API (`/leagues/...`) → modèles de vue
 * des exports PDF. PURS : aucun fetch, aucune traduction dynamique — ce qui
 * les rend testables sans DOM et garde les PDF identiques d'un écran à
 * l'autre.
 */

import type {
  LeaguePairingDetail,
  LeagueRoundDetail,
  PoolStandings,
  StandingRow,
} from "../../../leagues/[id]/types";
import { LEAGUE_TIE_BREAK_LABELS } from "../../../leagues/_components/standings-order";
import type {
  BracketDocument,
  CalendarDocument,
  LeaderboardsDocument,
  MatchdayDocument,
  PdfAward,
  PdfColumn,
  PdfFixture,
  PdfFixtureGroup,
  PdfLeaderCategory,
  PdfMeta,
  PdfRound,
  PdfStandingsTable,
  StandingsDocument,
  StatsDocument,
} from "../types";
import {
  STAGE_ORDER,
  bracketStageLabel,
  decimalFr,
  defaultRosterName,
  diffCell,
  formatPdfDate,
  formatPdfPeriod,
  stageOfSlot,
  teamRef,
  type RosterNameResolver,
} from "./common";

export interface LeaguePdfContext {
  leagueName: string;
  seasonName?: string | null;
  now?: Date;
  rosterName?: RosterNameResolver;
}

export function leagueMeta(ctx: LeaguePdfContext): PdfMeta {
  return {
    competitionName: ctx.leagueName,
    competitionKind: "league",
    seasonName: ctx.seasonName ?? null,
    generatedAt: ctx.now ?? new Date(),
  };
}

// ─── Rencontres ──────────────────────────────────────────────────────────────

const ROUND_STATUS: Record<string, string> = {
  pending: "À venir",
  in_progress: "En cours",
  completed: "Terminée",
};

/** Score validé de la feuille (source unique du résultat), sinon `null`. */
export function leaguePairingScore(
  p: Pick<LeaguePairingDetail, "matchSheet">,
): { home: number; away: number } | null {
  const s = p.matchSheet;
  if (!s || s.status !== "validated") return null;
  if (typeof s.scoreHome !== "number" || typeof s.scoreAway !== "number") return null;
  return { home: s.scoreHome, away: s.scoreAway };
}

const PENDING_SHEET = new Set(["submitted_home", "submitted_away", "both_submitted"]);

export function leaguePairingStatusLabel(p: LeaguePairingDetail): string {
  switch (p.status) {
    case "played":
      return "Jouée";
    case "forfeit_home":
      return "Forfait domicile";
    case "forfeit_away":
      return "Forfait extérieur";
    case "cancelled":
      return "Annulée";
    default:
      break;
  }
  if (p.matchSheet && PENDING_SHEET.has(String(p.matchSheet.status))) {
    return "Validation en attente";
  }
  return p.status === "in_progress" ? "En cours" : "À jouer";
}

function pairingToFixture(p: LeaguePairingDetail, rosterName: RosterNameResolver): PdfFixture {
  const side = (s: LeaguePairingDetail["homeParticipant"]) =>
    teamRef(s.team, s.team.owner?.coachName, rosterName);
  const placeholder = p.homeParticipant.id === p.awayParticipant.id;
  return {
    home: side(p.homeParticipant),
    away: placeholder ? null : side(p.awayParticipant),
    placeholder,
    statusLabel: leaguePairingStatusLabel(p),
    score: leaguePairingScore(p),
    scheduledLabel: p.status === "scheduled" ? formatPdfDate(p.scheduledAt) : null,
  };
}

export interface PoolIndex {
  /** participantId → poolId */
  poolIdByParticipantId: Readonly<Record<string, string | null>>;
  /** poolId → nom */
  poolNamesById: Readonly<Record<string, string>>;
  /** Ordre d'affichage des poules (ids). */
  poolOrder?: readonly string[];
}

/**
 * Regroupe les rencontres par poule (celle de l'équipe à domicile). Une
 * seule poule représentée — ou aucune — donne un groupe à plat : un bandeau
 * de poule n'apprendrait rien.
 */
function groupFixtures(
  pairings: readonly LeaguePairingDetail[],
  pools: PoolIndex | null,
  rosterName: RosterNameResolver,
): PdfFixtureGroup[] {
  if (!pools) return [{ label: null, fixtures: pairings.map((p) => pairingToFixture(p, rosterName)) }];
  const buckets = new Map<string | null, LeaguePairingDetail[]>();
  for (const p of pairings) {
    const poolId = pools.poolIdByParticipantId[p.homeParticipant.id] ?? null;
    const list = buckets.get(poolId) ?? [];
    list.push(p);
    buckets.set(poolId, list);
  }
  const named = [...buckets.keys()].filter((k) => k && pools.poolNamesById[k]);
  if (named.length <= 1) {
    return [{ label: null, fixtures: pairings.map((p) => pairingToFixture(p, rosterName)) }];
  }
  const order = pools.poolOrder ?? Object.keys(pools.poolNamesById);
  const keys = [...buckets.keys()].sort((a, b) => {
    const ia = a === null ? Infinity : order.indexOf(a);
    const ib = b === null ? Infinity : order.indexOf(b);
    return ia - ib;
  });
  return keys.map((k) => ({
    label: k ? pools.poolNamesById[k] ?? "Sans poule" : "Sans poule",
    fixtures: (buckets.get(k) ?? []).map((p) => pairingToFixture(p, rosterName)),
  }));
}

export function leagueRoundToPdf(
  round: LeagueRoundDetail & { bracketSlot?: string | null },
  pools: PoolIndex | null,
  rosterName: RosterNameResolver = defaultRosterName,
): PdfRound {
  // Un tour de bracket se nomme par son stade, pas par un numéro de journée.
  const stage = stageOfSlot(round.bracketSlot);
  const base = stage ? `Play-offs - ${bracketStageLabel(stage)}` : `Journée ${round.roundNumber}`;
  return {
    title: `${base}${round.name ? ` - ${round.name}` : ""}`,
    subtitle: formatPdfPeriod(round.startDate, round.endDate),
    statusLabel: ROUND_STATUS[round.status] ?? null,
    groups: groupFixtures(round.pairings ?? [], pools, rosterName),
  };
}

/**
 * La « prochaine journée » : la première qui n'est pas terminée ; à défaut
 * (saison bouclée), la dernière.
 */
export function selectNextLeagueRound<T extends LeagueRoundDetail>(rounds: readonly T[]): T | null {
  const sorted = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  return sorted.find((r) => r.status !== "completed") ?? sorted[sorted.length - 1] ?? null;
}

export function leagueMatchdayToPdf(
  round: LeagueRoundDetail,
  pools: PoolIndex | null,
  ctx: LeaguePdfContext,
): MatchdayDocument {
  return { meta: leagueMeta(ctx), round: leagueRoundToPdf(round, pools, ctx.rosterName) };
}

export function leagueCalendarToPdf(
  rounds: readonly LeagueRoundDetail[],
  pools: PoolIndex | null,
  ctx: LeaguePdfContext,
): CalendarDocument {
  return {
    meta: leagueMeta(ctx),
    rounds: [...rounds]
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((r) => leagueRoundToPdf(r, pools, ctx.rosterName)),
  };
}

// ─── Classement ──────────────────────────────────────────────────────────────

export const LEAGUE_STANDINGS_COLUMNS: PdfColumn[] = [
  { label: "Pts", legend: "Points", emphasis: true },
  { label: "Bo", legend: "Points bonus" },
  { label: "MJ", legend: "Matchs joués" },
  { label: "V", legend: "Victoires" },
  { label: "N", legend: "Nuls" },
  { label: "D", legend: "Défaites" },
  { label: "For", legend: "Points retirés (forfaits)" },
  { label: "TD+", legend: "Touchdowns marqués" },
  { label: "TD-", legend: "Touchdowns encaissés" },
  { label: "Diff", legend: "Différence de TD" },
  { label: "Sor+", legend: "Sorties infligées" },
  { label: "Sor-", legend: "Sorties subies" },
  { label: "DSor", legend: "Différence de sorties" },
];

function standingCells(r: StandingRow): Array<string | number> {
  const casDiff = r.casualtyDifference ?? r.casualtiesFor - r.casualtiesAgainst;
  return [
    r.points,
    r.bonusPoints ?? 0,
    r.played,
    r.wins,
    r.draws,
    r.losses,
    r.forfeitPoints ?? 0,
    r.touchdownsFor,
    r.touchdownsAgainst,
    diffCell(r.touchdownDifference),
    r.casualtiesFor,
    r.casualtiesAgainst,
    diffCell(casDiff),
  ];
}

function standingsTable(
  title: string | null,
  qualifies: number,
  rows: readonly StandingRow[],
  rosterName: RosterNameResolver,
): PdfStandingsTable {
  return {
    title,
    qualifies,
    columns: LEAGUE_STANDINGS_COLUMNS,
    rows: rows.map((r) => ({
      team: teamRef({ name: r.teamName, roster: r.roster }, r.coachName, rosterName),
      cells: standingCells(r),
      muted: r.status === "withdrawn",
    })),
  };
}

export interface LeagueScoring {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
}

export function leagueScoringNote(s: LeagueScoring): string {
  return `Victoire ${s.winPoints} - Nul ${s.drawPoints} - Défaite ${s.lossPoints} - Forfait ${s.forfeitPoints}`;
}

export function leagueTieBreakNote(rules: readonly string[] | null | undefined): string | null {
  if (!rules || rules.length === 0) return null;
  return rules.map((slug) => LEAGUE_TIE_BREAK_LABELS[slug] ?? slug).join(" > ");
}

/**
 * Classement par poule quand la saison en a (dans l'ordre des poules),
 * sinon le classement général.
 */
export function leagueStandingsToPdf(
  input: {
    standings: readonly StandingRow[];
    pools?: readonly PoolStandings[];
    scoring?: LeagueScoring | null;
    tieBreakRules?: readonly string[] | null;
  },
  ctx: LeaguePdfContext,
): StandingsDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const pools = [...(input.pools ?? [])]
    .filter((p) => p.standings.length > 0)
    .sort((a, b) => a.poolOrder - b.poolOrder);
  const tables =
    pools.length > 0
      ? pools.map((p) => standingsTable(p.poolName, p.qualifiesForPlayoffs, p.standings, rosterName))
      : [standingsTable(null, 0, input.standings, rosterName)];
  return {
    meta: leagueMeta(ctx),
    tables,
    scoringNote: input.scoring ? leagueScoringNote(input.scoring) : null,
    tieBreakNote: leagueTieBreakNote(input.tieBreakRules),
  };
}

// ─── Tops ────────────────────────────────────────────────────────────────────

export interface LeaguePlayerStatRow {
  rank: number;
  playerName: string;
  position: string;
  teamName: string;
  value: number;
}

export interface LeagueTeamStatRow {
  rank: number;
  teamName: string;
  roster: string;
  coachName: string | null;
  value: number;
}

function categoriesOf<Row>(
  catalogue: { categories: Array<{ key: string; label: string; description: string }> } & Record<string, unknown>,
  toRow: (r: Row) => PdfLeaderCategory["rows"][number],
): PdfLeaderCategory[] {
  return catalogue.categories.map((c) => {
    const rows = catalogue[c.key];
    return {
      label: c.label,
      description: c.description,
      rows: Array.isArray(rows) ? (rows as Row[]).map(toRow) : [],
    };
  });
}

export function leagueLeaderboardsToPdf(
  input: {
    players?: ({ categories: Array<{ key: string; label: string; description: string }> } & Record<string, unknown>) | null;
    teams?: ({ categories: Array<{ key: string; label: string; description: string }> } & Record<string, unknown>) | null;
  },
  ctx: LeaguePdfContext,
): LeaderboardsDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const sections: LeaderboardsDocument["sections"] = [];
  if (input.players) {
    sections.push({
      title: "Joueurs",
      categories: categoriesOf<LeaguePlayerStatRow>(input.players, (r) => ({
        rank: r.rank,
        name: r.playerName,
        detail: [r.position, r.teamName].filter(Boolean).join(" - "),
        value: r.value,
      })),
    });
  }
  if (input.teams) {
    sections.push({
      title: "Équipes",
      categories: categoriesOf<LeagueTeamStatRow>(input.teams, (r) => ({
        rank: r.rank,
        name: r.teamName,
        detail: [rosterName(r.roster), r.coachName ? `coach ${r.coachName}` : null]
          .filter(Boolean)
          .join(" - "),
        value: r.value,
      })),
    });
  }
  return { meta: leagueMeta(ctx), sections };
}

// ─── Play-offs ───────────────────────────────────────────────────────────────

export interface LeagueBracketInput {
  playoffSize: number;
  playoffsPublished?: boolean;
  rounds: Array<{
    roundNumber: number;
    bracketSlot: string | null;
    pairings: LeaguePairingDetail[];
  }>;
}

/** Vainqueur d'une rencontre validée (`null` si nulle ou non jouée). */
function winnerOf(p: LeaguePairingDetail): "home" | "away" | null {
  if (p.status === "forfeit_home") return "away";
  if (p.status === "forfeit_away") return "home";
  const s = leaguePairingScore(p);
  if (!s || s.home === s.away) return null;
  return s.home > s.away ? "home" : "away";
}

export function leagueBracketToPdf(input: LeagueBracketInput, ctx: LeaguePdfContext): BracketDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const stages = STAGE_ORDER.map((stage) => {
    const rounds = input.rounds
      .filter((r) => stageOfSlot(r.bracketSlot) === stage)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    return {
      label: bracketStageLabel(stage),
      fixtures: rounds.flatMap((r) => r.pairings.map((p) => pairingToFixture(p, rosterName))),
      rounds,
    };
  }).filter((s) => s.fixtures.length > 0);

  const finalRound = stages.find((s) => s.label === bracketStageLabel("final"))?.rounds[0];
  const finalPairing = finalRound?.pairings[0];
  const w = finalPairing ? winnerOf(finalPairing) : null;
  const champion =
    finalPairing && w
      ? teamRef(
          (w === "home" ? finalPairing.homeParticipant : finalPairing.awayParticipant).team,
          (w === "home" ? finalPairing.homeParticipant : finalPairing.awayParticipant).team.owner?.coachName,
          rosterName,
        )
      : null;

  const notes = [
    input.playoffSize > 0 ? `Bracket à ${input.playoffSize}` : null,
    input.playoffsPublished === false ? "provisoire (non publié)" : null,
  ].filter(Boolean);
  return {
    meta: leagueMeta(ctx),
    stages: stages.map(({ label, fixtures }) => ({ label, fixtures })),
    champion,
    note: notes.length ? notes.join(" - ") : null,
  };
}

// ─── Statistiques ────────────────────────────────────────────────────────────

export const LEAGUE_TEAM_STAT_COLUMNS: PdfColumn[] = [
  { label: "MJ", legend: "Matchs joués" },
  { label: "TD+", legend: "Touchdowns marqués", emphasis: true },
  { label: "TD-", legend: "Touchdowns encaissés" },
  { label: "Sor+", legend: "Sorties infligées", emphasis: true },
  { label: "Sor-", legend: "Sorties subies" },
  { label: "Pas", legend: "Passes réussies" },
  { label: "Int", legend: "Interceptions" },
  { label: "Agr", legend: "Agressions" },
  { label: "SP", legend: "Sorties par le public" },
  { label: "Exclu", legend: "Expulsions subies" },
];

export interface LeagueAwardEntry {
  teamName: string;
  coachName?: string | null;
  value: number;
}

const AWARD_SPECS: Array<{ key: string; label: string; description: string; coach?: boolean; suffix?: string }> = [
  { key: "mostWins", label: "Plus de victoires", description: "Équipes les plus titrées" },
  { key: "topScorer", label: "Top Scorer", description: "Plus de touchdowns marqués" },
  { key: "bestDefense", label: "Meilleure défense", description: "Moins de touchdowns encaissés" },
  { key: "basher", label: "Basher", description: "Plus de sorties infligées" },
  { key: "martyrs", label: "Les Martyrs", description: "Plus de sorties subies" },
  { key: "cleanestSheet", label: "Indestructibles", description: "Moins de sorties subies" },
  { key: "oracle", label: "Oracle", description: "Meilleur pronostiqueur (coachs)", coach: true, suffix: " pts" },
];

export function leagueAwardsToPdf(awards: Record<string, LeagueAwardEntry[] | undefined> | null | undefined): PdfAward[] {
  if (!awards) return [];
  return AWARD_SPECS.flatMap((spec) => {
    const list = awards[spec.key];
    if (!list || list.length === 0) return [];
    const winners = list
      .map((e) => (spec.coach && e.coachName ? e.coachName : e.teamName))
      .join(", ");
    return [{ label: spec.label, description: spec.description, winners, value: `${list[0].value}${spec.suffix ?? ""}` }];
  });
}

/** Totaux par équipe triés par points de classement, puis chiffres clés. */
export function leagueStatsToPdf(
  input: { standings: readonly StandingRow[]; awards?: Record<string, LeagueAwardEntry[] | undefined> | null },
  ctx: LeaguePdfContext,
): StatsDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const rows = input.standings;
  const sum = (f: (r: StandingRow) => number | undefined) => rows.reduce((n, r) => n + (f(r) ?? 0), 0);
  const matches = Math.round(sum((r) => r.played) / 2);
  const tds = sum((r) => r.touchdownsFor);
  return {
    meta: leagueMeta(ctx),
    keyFigures: [
      { label: "Rencontres jouées", value: matches },
      { label: "Touchdowns", value: tds },
      { label: "TD par match", value: matches > 0 ? decimalFr(tds / matches) : "-" },
      { label: "Sorties", value: sum((r) => r.casualtiesFor) },
      { label: "Passes réussies", value: sum((r) => r.passes) },
      { label: "Agressions", value: sum((r) => r.aggressions) },
    ],
    awards: leagueAwardsToPdf(input.awards),
    teamTable: {
      title: null,
      qualifies: 0,
      columns: LEAGUE_TEAM_STAT_COLUMNS,
      rows: rows.map((r) => ({
        team: teamRef({ name: r.teamName, roster: r.roster }, r.coachName, rosterName),
        muted: r.status === "withdrawn",
        cells: [
          r.played,
          r.touchdownsFor,
          r.touchdownsAgainst,
          r.casualtiesFor,
          r.casualtiesAgainst,
          r.passes ?? 0,
          r.interceptions ?? 0,
          r.aggressions ?? 0,
          r.crowdSurges ?? 0,
          r.expulsions ?? 0,
        ],
      })),
    },
  };
}

