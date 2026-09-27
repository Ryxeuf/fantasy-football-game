/**
 * Adaptateur de la FEUILLE DE MATCH (ligue ou coupe) : réponse de
 * `GET /leagues/pairings/:id/sheet` → feuille de rencontre imprimable.
 *
 * Tout ce qui est déjà saisi sur le site est reporté (avant-match,
 * évènements, compteurs par joueur, JDM) ; une feuille vierge donne une
 * feuille vierge. PUR : la page passe sa réponse telle quelle.
 */

import { getSkillDisplayNames } from "../../../me/teams/skills-data";
import type {
  MatchSheetDocument,
  PdfSheetEvent,
  PdfSheetInducement,
  PdfSheetPlayer,
  PdfSheetPlayerTally,
  PdfSheetTeam,
} from "../types";
import { compressWeatherResults, kickoffTableRows, prayersTableRows } from "../reference";
import { defaultRosterName, type RosterNameResolver } from "./common";
import { KICKOFF_EVENTS, LEGACY_KICKOFF_EVENT_IDS } from "@bb/game-engine";

// ─── Formes d'entrée (sous-ensemble de la réponse API) ──────────────────────

interface SheetStats {
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
}

export interface SheetPdfPlayer {
  id: string;
  number: number;
  name: string;
  position: string;
  positionName?: string;
  dead?: boolean;
  missNextMatch?: boolean;
  spp?: number;
  skills?: string | null;
  stats?: SheetStats;
}

export interface SheetPdfTeam {
  name: string;
  roster: string;
  raceName?: string;
  coachName: string;
  teamValue: number;
  currentValue: number;
  treasury: number;
  dedicatedFans?: number;
  staff?: { rerolls: number; cheerleaders: number; assistants: number; apothecary: boolean };
  players: SheetPdfPlayer[];
  journeymen?: SheetPdfPlayer[];
  starPlayersHired?: SheetPdfPlayer[];
  raisedDead?: SheetPdfPlayer | null;
}

export interface SheetPdfEvent {
  kind: string;
  team: "home" | "away" | null;
  actorPlayerId: string | null;
  targetPlayerId: string | null;
  causeDetail: string | null;
  injurySeverity: string | null;
  meta?: { half?: number; turn?: number; stat?: string; kickoffEvent?: string } | null;
}

export interface SheetPdfInput {
  sheet: {
    status: string;
    events?: SheetPdfEvent[];
    weatherTable?: string | null;
    weather?: string | null;
    tossWinner?: "home" | "away" | null;
    tossChoice?: "kick" | "receive" | null;
    popularityHome?: number | null;
    popularityAway?: number | null;
    motmPlayerIds?: string[] | string | null;
    inducementsHome?: unknown;
    inducementsAway?: unknown;
    prayersHome?: unknown;
    prayersAway?: unknown;
  };
  summary?: {
    scoreHome: number;
    scoreAway: number;
    injuries: Array<{ playerId: string; severity: string }>;
    playerStats: Array<{
      playerId: string;
      touchdowns: number;
      casualtiesInflicted: number;
      completions: number;
      interceptions: number;
    }>;
  } | null;
  competitionKind?: "league" | "cup";
  competitionRules?: {
    sppEnabled?: boolean;
    economyEnabled?: boolean;
    advancementsEnabled?: boolean;
    purchasesEnabled?: boolean;
    firingsEnabled?: boolean;
  };
  leagueName?: string;
  teams: { home: SheetPdfTeam | null; away: SheetPdfTeam | null };
  reference?: {
    weatherTables?: Array<{ id: string; name: string; results: Array<{ roll: number; condition: string }> }>;
  } | null;
  computedSpp?: Record<string, number>;
}

export interface SheetPdfContext {
  now?: Date;
  /** « Journée 5 », « Ronde 3 » — quand l'écran le connaît. */
  roundLabel?: string | null;
  scheduledLabel?: string | null;
  rosterName?: RosterNameResolver;
}

// ─── Libellés ────────────────────────────────────────────────────────────────

export const EVENT_KIND_CODES: Record<string, string> = {
  kickoff: "CE",
  touchdown: "TD",
  casualty: "SOR",
  pass_complete: "PAS",
  interception: "INT",
  aggression: "AGR",
  expulsion: "EXP",
  crowd_surge: "SP",
  stalling: "TEM",
  team_throw: "LAN",
  ttm_landing: "ATT",
  special_elim: "ASP",
  other_elim: "AEL",
};

export const INJURY_CODES: Record<string, string> = {
  badly_hurt: "C",
  mng: "A",
  niggling: "BP",
  stat_loss: "S",
  dead: "M",
};

const STAT_CODES: Record<string, string> = { ma: "M", st: "F", ag: "AG", pa: "CP", av: "AR" };

function kickoffName(id: string | undefined): string | null {
  if (!id) return null;
  const resolved = LEGACY_KICKOFF_EVENT_IDS[id] ?? id;
  const found = Object.entries(KICKOFF_EVENTS).find(([, ev]) => ev.id === resolved);
  return found ? `${found[0]} - ${found[1].nameFr}` : id;
}

function parseArray(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseInducements(raw: unknown): PdfSheetInducement[] {
  return parseArray(raw).map((i) => ({
    name: typeof i.name === "string" && i.name ? i.name : String(i.slug ?? "Coup de pouce"),
    qty: typeof i.qty === "number" && i.qty > 0 ? i.qty : 1,
    cost: typeof i.cost === "number" ? i.cost : 0,
  }));
}

function parsePrayerRolls(raw: unknown): string[] {
  return parseArray(raw)
    .map((e) => e.roll)
    .filter((r): r is number => typeof r === "number" && r >= 1 && r <= 16)
    .map(String);
}

function parseIds(raw: string[] | string | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === "string");
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((s): s is string => typeof s === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Joueurs ─────────────────────────────────────────────────────────────────

function skillsLabel(csv: string | null | undefined): string {
  if (!csv) return "";
  return getSkillDisplayNames(csv).join(", ");
}

/** Compteurs d'un joueur relus dans le résumé ET les évènements. */
function buildTallies(input: SheetPdfInput): Map<string, PdfSheetPlayerTally> {
  const tallies = new Map<string, PdfSheetPlayerTally>();
  const get = (id: string) => {
    const t = tallies.get(id) ?? {};
    tallies.set(id, t);
    return t;
  };
  const inc = (id: string | null, key: keyof PdfSheetPlayerTally) => {
    if (!id) return;
    const t = get(id);
    (t as Record<string, number>)[key] = ((t[key] as number | undefined) ?? 0) + 1;
  };
  for (const s of input.summary?.playerStats ?? []) {
    const t = get(s.playerId);
    if (s.touchdowns) t.td = s.touchdowns;
    if (s.completions) t.pass = s.completions;
    if (s.interceptions) t.int = s.interceptions;
    if (s.casualtiesInflicted) t.cas = s.casualtiesInflicted;
  }
  for (const e of input.sheet.events ?? []) {
    if (e.kind === "pass_complete") inc(e.targetPlayerId, "rec");
    if (e.kind === "aggression") inc(e.actorPlayerId, "agg");
    if (e.kind === "team_throw") inc(e.actorPlayerId, "ttm");
    if (e.kind === "ttm_landing") inc(e.actorPlayerId, "land");
    if (e.kind === "expulsion") inc(e.actorPlayerId, "exp");
  }
  for (const inj of input.summary?.injuries ?? []) {
    get(inj.playerId).injury = INJURY_CODES[inj.severity] ?? inj.severity;
  }
  for (const id of parseIds(input.sheet.motmPlayerIds)) get(id).motm = true;
  // PSP du match : seulement une fois la saisie entamée (sinon tout est 0).
  if ((input.sheet.events ?? []).length > 0) {
    for (const [id, spp] of Object.entries(input.computedSpp ?? {})) {
      if (spp > 0) get(id).spp = spp;
    }
  }
  return tallies;
}

function toPdfPlayer(
  p: SheetPdfPlayer,
  tallies: Map<string, PdfSheetPlayerTally>,
  note: string | null,
  withSpp: boolean,
): PdfSheetPlayer {
  const absent = p.missNextMatch === true;
  return {
    number: p.number,
    name: p.name,
    position: p.positionName ?? p.position,
    stats: p.stats ?? null,
    skills: skillsLabel(p.skills),
    spp: withSpp && typeof p.spp === "number" ? p.spp : null,
    note: absent ? "Absent : blessé" : note,
    unavailable: absent,
    tally: tallies.get(p.id) ?? null,
  };
}

function sheetTeam(
  team: SheetPdfTeam,
  tallies: Map<string, PdfSheetPlayerTally>,
  withSpp: boolean,
  rosterName: RosterNameResolver,
): PdfSheetTeam {
  const roster = [...team.players]
    .filter((p) => !p.dead)
    .sort((a, b) => a.number - b.number)
    .map((p) => toPdfPlayer(p, tallies, null, withSpp));
  const extras = [
    ...(team.journeymen ?? []).map((p) => toPdfPlayer(p, tallies, "Journalier", false)),
    ...(team.starPlayersHired ?? []).map((p) => toPdfPlayer(p, tallies, "Star Player", false)),
    ...(team.raisedDead ? [toPdfPlayer(team.raisedDead, tallies, "Relevé", false)] : []),
  ];
  return {
    team: {
      name: team.name,
      coach: team.coachName || null,
      rosterName: team.raceName || rosterName(team.roster),
    },
    teamValue: team.teamValue,
    currentValue: team.currentValue,
    treasury: team.treasury,
    dedicatedFans: team.dedicatedFans ?? null,
    staff: team.staff ?? null,
    players: [...roster, ...extras],
  };
}

// ─── Journal ─────────────────────────────────────────────────────────────────

function playerLabels(input: SheetPdfInput): Map<string, string> {
  const labels = new Map<string, string>();
  for (const team of [input.teams.home, input.teams.away]) {
    if (!team) continue;
    const all = [
      ...team.players,
      ...(team.journeymen ?? []),
      ...(team.starPlayersHired ?? []),
      ...(team.raisedDead ? [team.raisedDead] : []),
    ];
    for (const p of all) labels.set(p.id, `n°${p.number}`);
  }
  return labels;
}

function toPdfEvents(input: SheetPdfInput): PdfSheetEvent[] {
  const labels = playerLabels(input);
  const who = (id: string | null) => (id ? labels.get(id) ?? "?" : null);
  return (input.sheet.events ?? []).map((e) => {
    const injury = e.injurySeverity ? INJURY_CODES[e.injurySeverity] ?? e.injurySeverity : null;
    const stat = e.meta?.stat ? STAT_CODES[e.meta.stat] ?? e.meta.stat : null;
    const detail =
      e.kind === "kickoff"
        ? kickoffName(e.meta?.kickoffEvent)
        : [stat ? `Séquelle ${stat}` : null, e.causeDetail].filter(Boolean).join(" - ") || null;
    return {
      half: e.meta?.half ?? null,
      turn: e.meta?.turn ?? null,
      side: e.team,
      kind: EVENT_KIND_CODES[e.kind] ?? e.kind,
      actor: who(e.actorPlayerId),
      target: who(e.targetPlayerId),
      injury: injury && stat ? `${injury} (${stat})` : injury,
      detail,
    };
  });
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

const EMPTY_TEAM: SheetPdfTeam = {
  name: "Équipe inconnue",
  roster: "",
  coachName: "",
  teamValue: 0,
  currentValue: 0,
  treasury: 0,
  players: [],
};

export function matchSheetToPdf(input: SheetPdfInput, ctx: SheetPdfContext = {}): MatchSheetDocument {
  const rosterName = ctx.rosterName ?? defaultRosterName;
  const isCup = input.competitionKind === "cup";
  const r = input.competitionRules ?? {};
  // Sans règles servies (serveur antérieur) : une ligue applique tout.
  const rules = {
    spp: r.sppEnabled ?? !isCup,
    economy: r.economyEnabled ?? !isCup,
    advancements: r.advancementsEnabled ?? !isCup,
    purchases: r.purchasesEnabled ?? !isCup,
    firings: r.firingsEnabled ?? !isCup,
  };
  const tallies = buildTallies(input);
  const home = sheetTeam(input.teams.home ?? EMPTY_TEAM, tallies, rules.spp, rosterName);
  const away = sheetTeam(input.teams.away ?? EMPTY_TEAM, tallies, rules.spp, rosterName);

  const tables = input.reference?.weatherTables ?? [];
  const table = tables.find((t) => t.id === input.sheet.weatherTable) ?? tables[0] ?? null;
  const events = toPdfEvents(input);
  const started = events.length > 0 || input.sheet.status === "validated";

  const motmIds = new Set(parseIds(input.sheet.motmPlayerIds));
  const motmFor = (team: SheetPdfTeam | null) =>
    (team?.players ?? [])
      .concat(team?.journeymen ?? [], team?.starPlayersHired ?? [])
      .filter((p) => motmIds.has(p.id))
      .map((p) => String(p.number));

  return {
    meta: {
      competitionName: input.leagueName ?? (isCup ? "Coupe" : "Ligue"),
      competitionKind: isCup ? "cup" : "league",
      seasonName: null,
      generatedAt: ctx.now ?? new Date(),
    },
    roundLabel: ctx.roundLabel ?? "Rencontre",
    scheduledLabel: ctx.scheduledLabel ?? null,
    home,
    away,
    rules,
    kickoffTable: kickoffTableRows(),
    weatherTable: table ? { name: table.name, results: compressWeatherResults(table.results) } : null,
    prayersTable: prayersTableRows(),
    prefill: {
      weatherTable: table?.name ?? null,
      weather: input.sheet.weather ?? null,
      tossWinner: input.sheet.tossWinner ?? null,
      tossChoice: input.sheet.tossChoice ?? null,
      popularityHome: input.sheet.popularityHome ?? null,
      popularityAway: input.sheet.popularityAway ?? null,
      inducementsHome: parseInducements(input.sheet.inducementsHome),
      inducementsAway: parseInducements(input.sheet.inducementsAway),
      prayersHome: parsePrayerRolls(input.sheet.prayersHome),
      prayersAway: parsePrayerRolls(input.sheet.prayersAway),
      score: started && input.summary ? { home: input.summary.scoreHome, away: input.summary.scoreAway } : null,
      events,
      motm: { home: motmFor(input.teams.home), away: motmFor(input.teams.away) },
    },
  };
}
