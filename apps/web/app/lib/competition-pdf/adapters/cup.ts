/**
 * Adaptateurs COUPE : `GET /cup/:id` (rondes, classements, podiums) et
 * `GET /cup/:id/playoffs` → modèles de vue des exports PDF. PURS.
 *
 * Mêmes documents que la ligue : seule la traduction change (une coupe
 * désigne ses équipes par `teamId`, ses rondes par numéro et système).
 */

import { CUP_TIE_BREAK_LABELS } from "../../../cups/[id]/tie-break-labels";
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
  stageOfSlot,
  teamRef,
  type RosterNameResolver,
} from "./common";

// ─── Formes d'entrée (sous-ensemble de la réponse API) ──────────────────────

export interface CupPdfTeam {
  id: string;
  name: string;
  roster: string;
  coachName: string | null;
}

export interface CupPdfPairing {
  id: string;
  tableNumber: number;
  status: string;
  scheduledAt: string | null;
  homeTeam: CupPdfTeam;
  awayTeam: CupPdfTeam | null;
  localMatch: {
    status: string;
    teamAId: string;
    scoreTeamA: number | null;
    scoreTeamB: number | null;
  } | null;
}

export interface CupPdfRound {
  roundNumber: number;
  name: string | null;
  system: string;
  kind?: string;
  bracketSlot?: string | null;
  status: string;
  scheduledAt: string | null;
  pairings: CupPdfPairing[];
}

export interface CupPdfStanding {
  teamId: string;
  teamName: string;
  roster: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  touchdownDiff: number;
  passes: number;
  blockCasualties: number;
  foulCasualties: number;
  totalPoints: number;
}

export interface CupPdfAwardEntry {
  teamName: string;
  roster: string;
  value: number;
}

export interface CupPdfInput {
  name: string;
  scoringConfig?: {
    winPoints: number;
    drawPoints: number;
    lossPoints: number;
    forfeitPoints: number;
    touchdownPoints: number;
    blockCasualtyPoints: number;
    foulCasualtyPoints: number;
    passPoints: number;
  };
  tieBreakRules?: string[];
  participants?: Array<{ id: string; owner?: { coachName: string | null } | null }>;
  standings?: CupPdfStanding[];
  poolStandings?: Array<{
    poolName: string;
    poolOrder: number;
    qualifiesForPlayoffs: number;
    standings: CupPdfStanding[];
  }>;
  pools?: Array<{ id: string; name: string; order: number }>;
  participantPools?: Readonly<Record<string, string | null>>;
  playoffSize?: number;
  rounds?: CupPdfRound[];
  actionAwards?: Record<string, CupPdfAwardEntry[] | undefined>;
  playerLeaderboards?: Record<string, Array<{ rank: number; playerName: string; teamName: string; value: number }>>;
  playerLeaderboardCategories?: Array<{ key: string; label: string; description: string }>;
}

export interface CupPdfContext {
  now?: Date;
  rosterName?: RosterNameResolver;
}

export function cupMeta(cup: Pick<CupPdfInput, "name">, ctx: CupPdfContext): PdfMeta {
  return {
    competitionName: cup.name,
    competitionKind: "cup",
    seasonName: null,
    generatedAt: ctx.now ?? new Date(),
  };
}

/** teamId → coach, relu dans les inscrits (le classement ne le porte pas). */
function coachIndex(cup: CupPdfInput): Map<string, string | null> {
  return new Map((cup.participants ?? []).map((p) => [p.id, p.owner?.coachName ?? null]));
}

// ─── Rencontres ──────────────────────────────────────────────────────────────

const SYSTEM_LABEL: Record<string, string> = {
  random: "Tirage au sort",
  swiss: "Système suisse",
  manual: "Appariement manuel",
  playoff: "Play-offs",
};

const PAIRING_STATUS: Record<string, string> = {
  scheduled: "À jouer",
  in_progress: "En cours",
  played: "Jouée",
  bye: "Exempt",
  cancelled: "Annulée",
  forfeit_home: "Forfait domicile",
  forfeit_away: "Forfait extérieur",
};

/** Score orienté domicile/extérieur (le match local a ses propres côtés A/B). */
export function cupPairingScore(p: CupPdfPairing): { home: number; away: number } | null {
  const m = p.localMatch;
  if (!m || m.status !== "completed") return null;
  if (typeof m.scoreTeamA !== "number" || typeof m.scoreTeamB !== "number") return null;
  const homeIsA = m.teamAId === p.homeTeam.id;
  return {
    home: homeIsA ? m.scoreTeamA : m.scoreTeamB,
    away: homeIsA ? m.scoreTeamB : m.scoreTeamA,
  };
}

function cupFixture(p: CupPdfPairing, rosterName: RosterNameResolver): PdfFixture {
  const ref = (t: CupPdfTeam) => teamRef(t, t.coachName, rosterName);
  return {
    home: ref(p.homeTeam),
    away: p.awayTeam ? ref(p.awayTeam) : null,
    statusLabel: PAIRING_STATUS[p.status] ?? p.status,
    score: cupPairingScore(p),
    scheduledLabel: p.status === "scheduled" ? formatPdfDate(p.scheduledAt) : null,
  };
}

function cupGroups(
  round: CupPdfRound,
  cup: CupPdfInput,
  rosterName: RosterNameResolver,
): PdfFixtureGroup[] {
  const pairings = [...round.pairings].sort((a, b) => a.tableNumber - b.tableNumber);
  const poolOf = cup.participantPools ?? {};
  const pools = [...(cup.pools ?? [])].sort((a, b) => a.order - b.order);
  // Une ronde de bracket ne se groupe jamais par poule.
  if (pools.length < 2 || stageOfSlot(round.bracketSlot)) {
    return [{ label: null, fixtures: pairings.map((p) => cupFixture(p, rosterName)) }];
  }
  const groups: PdfFixtureGroup[] = pools.map((pool) => ({
    label: pool.name,
    fixtures: pairings
      .filter((p) => poolOf[p.homeTeam.id] === pool.id)
      .map((p) => cupFixture(p, rosterName)),
  }));
  const orphans = pairings.filter((p) => !pools.some((pool) => poolOf[p.homeTeam.id] === pool.id));
  if (orphans.length) groups.push({ label: "Sans poule", fixtures: orphans.map((p) => cupFixture(p, rosterName)) });
  return groups.filter((g) => g.fixtures.length > 0);
}

export function cupRoundToPdf(round: CupPdfRound, cup: CupPdfInput, ctx: CupPdfContext = {}): PdfRound {
  const stage = stageOfSlot(round.bracketSlot);
  const base = stage ? `Play-offs - ${bracketStageLabel(stage)}` : `Ronde ${round.roundNumber}`;
  const subtitle = [
    stage ? null : SYSTEM_LABEL[round.system] ?? null,
    formatPdfDate(round.scheduledAt),
  ].filter(Boolean);
  return {
    title: `${base}${round.name ? ` - ${round.name}` : ""}`,
    subtitle: subtitle.length ? subtitle.join(" - ") : null,
    statusLabel: round.status === "completed" ? "Terminée" : round.status === "in_progress" ? "En cours" : null,
    groups: cupGroups(round, cup, ctx.rosterName ?? defaultRosterName),
  };
}

function sortedRounds(cup: CupPdfInput): CupPdfRound[] {
  return [...(cup.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber);
}

/** Première ronde encore ouverte, sinon la dernière. */
export function selectNextCupRound(cup: CupPdfInput): CupPdfRound | null {
  const rounds = sortedRounds(cup);
  return (
    rounds.find((r) => r.pairings.some((p) => p.status === "scheduled" || p.status === "in_progress")) ??
    rounds[rounds.length - 1] ??
    null
  );
}

export function cupMatchdayToPdf(cup: CupPdfInput, round: CupPdfRound, ctx: CupPdfContext = {}): MatchdayDocument {
  return { meta: cupMeta(cup, ctx), round: cupRoundToPdf(round, cup, ctx) };
}

export function cupCalendarToPdf(cup: CupPdfInput, ctx: CupPdfContext = {}): CalendarDocument {
  return { meta: cupMeta(cup, ctx), rounds: sortedRounds(cup).map((r) => cupRoundToPdf(r, cup, ctx)) };
}

// ─── Classement ──────────────────────────────────────────────────────────────

export const CUP_STANDINGS_COLUMNS: PdfColumn[] = [
  { label: "Pts", legend: "Points (résultat + actions)", emphasis: true },
  { label: "MJ", legend: "Matchs joués" },
  { label: "V", legend: "Victoires" },
  { label: "N", legend: "Nuls" },
  { label: "D", legend: "Défaites" },
  { label: "TD+", legend: "Touchdowns marqués" },
  { label: "TD-", legend: "Touchdowns encaissés" },
  { label: "Diff", legend: "Différence de TD" },
  { label: "Pas", legend: "Passes réussies" },
  { label: "Sor", legend: "Sorties sur blocage" },
  { label: "Agr", legend: "Sorties sur agression" },
];

function cupStandingsTable(
  title: string | null,
  qualifies: number,
  rows: readonly CupPdfStanding[],
  coaches: Map<string, string | null>,
  rosterName: RosterNameResolver,
): PdfStandingsTable {
  return {
    title,
    qualifies,
    columns: CUP_STANDINGS_COLUMNS,
    rows: rows.map((r) => ({
      team: teamRef({ name: r.teamName, roster: r.roster }, coaches.get(r.teamId), rosterName),
      cells: [
        r.totalPoints,
        r.matchesPlayed,
        r.wins,
        r.draws,
        r.losses,
        r.touchdownsFor,
        r.touchdownsAgainst,
        diffCell(r.touchdownDiff),
        r.passes,
        r.blockCasualties,
        r.foulCasualties,
      ],
    })),
  };
}

export function cupScoringNote(s: NonNullable<CupPdfInput["scoringConfig"]>): string {
  return [
    `Victoire ${s.winPoints}`,
    `Nul ${s.drawPoints}`,
    `Défaite ${s.lossPoints}`,
    `Forfait ${s.forfeitPoints}`,
    `TD ${s.touchdownPoints}`,
    `Sortie ${s.blockCasualtyPoints}`,
    `Agression ${s.foulCasualtyPoints}`,
    `Passe ${s.passPoints}`,
  ].join(" - ");
}

export function cupStandingsToPdf(cup: CupPdfInput, ctx: CupPdfContext = {}): StandingsDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const coaches = coachIndex(cup);
  const pools = [...(cup.poolStandings ?? [])]
    .filter((p) => p.standings.length > 0)
    .sort((a, b) => a.poolOrder - b.poolOrder);
  const tables =
    pools.length > 0
      ? pools.map((p) => cupStandingsTable(p.poolName, p.qualifiesForPlayoffs, p.standings, coaches, rosterName))
      : [cupStandingsTable(null, cup.playoffSize ?? 0, cup.standings ?? [], coaches, rosterName)];
  return {
    meta: cupMeta(cup, ctx),
    tables,
    scoringNote: cup.scoringConfig ? cupScoringNote(cup.scoringConfig) : null,
    tieBreakNote:
      cup.tieBreakRules && cup.tieBreakRules.length
        ? cup.tieBreakRules.map((s) => CUP_TIE_BREAK_LABELS[s] ?? s).join(" > ")
        : null,
  };
}

// ─── Tops & stats ────────────────────────────────────────────────────────────

/** Podiums d'équipes, dans l'ordre et avec les libellés de la page coupe. */
const CUP_AWARDS: Array<{ key: string; label: string; description: string }> = [
  { key: "topScorers", label: "Le Pichichi du TD", description: "Plus de touchdowns marqués" },
  { key: "bestDefense", label: "The Wall", description: "Moins de touchdowns encaissés" },
  { key: "bashers", label: "La BASH !", description: "Plus de sorties sur blocage" },
  { key: "shamePassers", label: "La Honte", description: "Moins de passes réussies" },
  { key: "foulExperts", label: "Crampons affûtés", description: "Plus de sorties sur agression" },
  { key: "indestructible", label: "Les Indestructibles", description: "Moins de sorties subies" },
  { key: "martyrs", label: "Les Martyrs", description: "Plus de sorties subies" },
  { key: "permeable", label: "Les Perméables", description: "Plus de touchdowns encaissés" },
];

export function cupLeaderboardsToPdf(cup: CupPdfInput, ctx: CupPdfContext = {}): LeaderboardsDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const players: PdfLeaderCategory[] = (cup.playerLeaderboardCategories ?? []).map((c) => ({
    label: c.label,
    description: c.description,
    rows: (cup.playerLeaderboards?.[c.key] ?? []).map((r) => ({
      rank: r.rank,
      name: r.playerName,
      detail: r.teamName,
      value: r.value,
    })),
  }));
  const teams: PdfLeaderCategory[] = CUP_AWARDS.flatMap((a) => {
    const list = cup.actionAwards?.[a.key];
    if (!list || list.length === 0) return [];
    // Rang « de compétition » : les ex-aequo partagent la place.
    let rank = 0;
    let prev: number | null = null;
    const rows = list.map((e, i) => {
      if (e.value !== prev) rank = i + 1;
      prev = e.value;
      return { rank, name: e.teamName, detail: rosterName(e.roster), value: e.value };
    });
    return [{ label: a.label, description: a.description, rows }];
  });
  const sections: LeaderboardsDocument["sections"] = [];
  if (players.length) sections.push({ title: "Joueurs", categories: players });
  if (teams.length) sections.push({ title: "Équipes", categories: teams });
  return { meta: cupMeta(cup, ctx), sections };
}

function cupAwards(cup: CupPdfInput): PdfAward[] {
  return CUP_AWARDS.flatMap((a) => {
    const list = cup.actionAwards?.[a.key];
    if (!list || list.length === 0) return [];
    const best = list[0].value;
    return [{
      label: a.label,
      description: a.description,
      winners: list.filter((e) => e.value === best).map((e) => e.teamName).join(", "),
      value: best,
    }];
  });
}

export function cupStatsToPdf(cup: CupPdfInput, ctx: CupPdfContext = {}): StatsDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const coaches = coachIndex(cup);
  const rows = cup.standings ?? [];
  const sum = (f: (r: CupPdfStanding) => number) => rows.reduce((n, r) => n + f(r), 0);
  const matches = Math.round(sum((r) => r.matchesPlayed) / 2);
  const tds = sum((r) => r.touchdownsFor);
  const table = cupStandingsTable(null, 0, rows, coaches, rosterName);
  return {
    meta: cupMeta(cup, ctx),
    keyFigures: [
      { label: "Rencontres jouées", value: matches },
      { label: "Touchdowns", value: tds },
      { label: "TD par match", value: matches > 0 ? decimalFr(tds / matches) : "-" },
      { label: "Sorties sur blocage", value: sum((r) => r.blockCasualties) },
      { label: "Sorties sur agression", value: sum((r) => r.foulCasualties) },
      { label: "Passes réussies", value: sum((r) => r.passes) },
    ],
    awards: cupAwards(cup),
    // Mêmes totaux que le classement, sans la colonne de points.
    teamTable: {
      ...table,
      columns: table.columns.slice(1),
      rows: table.rows.map((r) => ({ ...r, cells: r.cells.slice(1) })),
    },
  };
}

// ─── Play-offs ───────────────────────────────────────────────────────────────

export interface CupBracketInput {
  playoffSize: number;
  playoffsPublished: boolean | null;
  rounds: Array<{
    roundNumber: number;
    slot: string;
    placeholder: boolean;
    pairingStatus: string | null;
    homeTeam: CupPdfTeam | null;
    awayTeam: CupPdfTeam | null;
    scoreLabel: string | null;
  }>;
}

/** « 2 – 1 » → { home: 2, away: 1 } (score déjà orienté par le serveur). */
export function parseScoreLabel(label: string | null): { home: number; away: number } | null {
  if (!label) return null;
  const m = /(\d+)\s*[-–—]\s*(\d+)/.exec(label);
  return m ? { home: Number(m[1]), away: Number(m[2]) } : null;
}

export function cupBracketToPdf(
  cup: Pick<CupPdfInput, "name">,
  input: CupBracketInput,
  ctx: CupPdfContext = {},
): BracketDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const ref = (t: CupPdfTeam | null) => (t ? teamRef(t, t.coachName, rosterName) : null);
  const stages = STAGE_ORDER.map((stage) => ({
    label: bracketStageLabel(stage),
    fixtures: input.rounds
      .filter((r) => stageOfSlot(r.slot) === stage)
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((r) => ({
        home: ref(r.homeTeam),
        away: r.placeholder ? null : ref(r.awayTeam),
        placeholder: r.placeholder,
        statusLabel: PAIRING_STATUS[r.pairingStatus ?? ""] ?? "En attente",
        score: parseScoreLabel(r.scoreLabel),
      })),
  })).filter((s) => s.fixtures.length > 0);

  const final = stages.find((s) => s.label === bracketStageLabel("final"))?.fixtures[0];
  const champion =
    final?.score && final.score.home !== final.score.away
      ? final.score.home > final.score.away
        ? final.home
        : final.away
      : null;
  const notes = [
    input.playoffSize > 0 ? `Bracket à ${input.playoffSize}` : null,
    input.playoffsPublished === false ? "provisoire (non publié)" : null,
  ].filter(Boolean);
  return {
    meta: cupMeta(cup, ctx),
    stages,
    champion,
    note: notes.length ? notes.join(" - ") : null,
  };
}
