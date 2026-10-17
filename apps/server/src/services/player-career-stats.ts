/**
 * Carrière d'un joueur, TOUTES compétitions confondues.
 *
 * Les compteurs de `TeamPlayer` (`matchesPlayed`, `totalTouchdowns`,
 * `totalCasualties`…) ne racontent pas toute la carrière :
 *
 *  - une feuille de COUPE validée n'écrit RIEN sur les équipes (règle de la
 *    compétition : PSP, blessures, or… rien ne persiste). Un joueur qui n'a
 *    joué que des coupes affichait donc « 0 match, 0 TD, 0 sortie » partout,
 *    carte joueur comprise ;
 *  - une feuille de LIGUE validée ne crédite un match qu'aux joueurs qui ont
 *    une ligne de stats (un évènement ou le titre de Joueur du Match). Un
 *    joueur aligné sans rien marquer n'avait pas joué.
 *
 * Plutôt que d'écrire des compteurs de plus — à rattraper sur tout
 * l'historique, et à défaire à chaque invalidation —, la carrière se DÉRIVE
 * à la lecture des feuilles validées et s'AJOUTE aux compteurs persistés :
 *
 *    carrière = compteurs TeamPlayer (ligue + en ligne)
 *             + matchs de ligue joués sans ligne de stats
 *             + tout ce que le joueur a fait en coupe
 *
 * Une feuille invalidée sort d'elle-même (filtre `status = validated`), un
 * historique antérieur est couvert sans backfill.
 *
 * Qui a joué ? La « version du match » figée à l'ouverture de la feuille
 * (`rosterSnapshotHome/Away`) liste les joueurs alignables — les absents
 * (« rate le prochain match ») en sont déjà exclus. Les snapshots récents
 * portent l'id de chaque joueur ; les anciens se résolvent par numéro + nom +
 * poste, uniquement quand la correspondance est unique. Tout joueur cité par
 * un évènement ou désigné Joueur du Match a joué, snapshot ou non. Une
 * feuille déclarée forfait n'a pas été jouée.
 *
 * Gestes de coupe : la traduction est CELLE de la matérialisation
 * (`sheetEventsToLocalMatchActions` + `cupActorGesture`), donc les mêmes
 * chiffres que les classements individuels de la coupe. Une sortie compte
 * au contact ; une agression qui sort sa cible n'en est pas une (règle des
 * sorties de la ligue : seule une élimination qui rapporte des PSP compte).
 *
 * Module PUR : le chargeur (`player-career-loader`) lit la base, ces
 * fonctions agrègent.
 */

import { cupActorGesture } from "./cup-player-stats";
import {
  sheetEventsToLocalMatchActions,
  type CupSheetEvent,
} from "./cup-sheet-actions";
import {
  summarizeMatchSheet,
  type MatchEventInput,
} from "./league-match-summary";

export interface CareerCounters {
  readonly matchesPlayed: number;
  readonly touchdowns: number;
  readonly casualties: number;
  readonly completions: number;
  readonly interceptions: number;
  readonly mvpAwards: number;
}

export const EMPTY_CAREER_COUNTERS: CareerCounters = {
  matchesPlayed: 0,
  touchdowns: 0,
  casualties: 0,
  completions: 0,
  interceptions: 0,
  mvpAwards: 0,
};

/** Joueur d'une équipe suivie (TOUS statuts : un mort a joué ses matchs). */
export interface CareerTeamPlayer {
  readonly id: string;
  readonly teamId: string;
  readonly number: number;
  readonly name: string;
  readonly position: string;
}

/** Feuille VALIDÉE, réduite à ce que la carrière lit. */
export interface CareerSheet {
  readonly kind: "league" | "cup";
  readonly homeTeamId: string | null;
  readonly awayTeamId: string | null;
  readonly forfeit: boolean;
  readonly motmPlayerIds: unknown;
  readonly rosterSnapshotHome: unknown;
  readonly rosterSnapshotAway: unknown;
  readonly events: readonly CupSheetEvent[];
  /**
   * Ligue : joueurs déjà crédités d'un match par la validation — les lignes
   * du snapshot `Match.offlineResultInput`. `null` = snapshot absent (feuille
   * antérieure) : on rejoue alors la règle de la validation sur le journal.
   */
  readonly persistedPlayerIds?: readonly string[] | null;
}

/** Ce que les feuilles ajoutent aux compteurs persistés d'un joueur. */
export interface CompetitionCareerAdjustment {
  /** Matchs de ligue joués sans ligne de stats, donc jamais comptés. */
  readonly leagueMatchesNotPersisted: number;
  /** La coupe ne persiste rien : tout vient d'ici. */
  readonly cup: CareerCounters;
}

export const EMPTY_ADJUSTMENT: CompetitionCareerAdjustment = {
  leagueMatchesNotPersisted: 0,
  cup: EMPTY_CAREER_COUNTERS,
};

/** Compteurs persistés d'un `TeamPlayer` (champs absents = 0). */
export interface PersistedCareer {
  readonly spp?: number | null;
  readonly matchesPlayed?: number | null;
  readonly totalTouchdowns?: number | null;
  readonly totalCasualties?: number | null;
  readonly totalCompletions?: number | null;
  readonly totalInterceptions?: number | null;
  readonly totalMvpAwards?: number | null;
}

/** Carrière servie aux écrans (carte, fiche, page carrière, mobile…). */
export interface PlayerCareerTotals extends CareerCounters {
  /** Solde de PSP du joueur (une coupe n'en rapporte pas). */
  readonly spp: number;
  /** Part de la coupe, pour le détail. */
  readonly cup: CareerCounters;
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  if (raw.trim() === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stringArray(raw: unknown): string[] {
  const value = parseJson(raw);
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/**
 * Ids des joueurs de la « version du match » d'un côté. Snapshot récent :
 * l'id du joueur. Snapshot antérieur : numéro + nom + poste, seulement si un
 * seul joueur de l'équipe correspond (les journaliers bakés, qui n'ont pas
 * de ligne `TeamPlayer` à ce poste, ne résolvent rien).
 */
export function resolveSnapshotPlayerIds(
  rawSnapshot: unknown,
  teamPlayers: readonly CareerTeamPlayer[],
): string[] {
  const snapshot = parseJson(rawSnapshot);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return [];
  }
  const entries = (snapshot as { players?: unknown }).players;
  if (!Array.isArray(entries)) return [];
  const byId = new Set(teamPlayers.map((p) => p.id));
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id === "string") {
      if (byId.has(e.id)) ids.push(e.id);
      continue;
    }
    const matches = teamPlayers.filter(
      (p) =>
        p.number === e.number && p.name === e.name && p.position === e.position,
    );
    if (matches.length === 1) ids.push(matches[0].id);
  }
  return ids;
}

/**
 * Joueurs d'un côté qui ont pris part à la rencontre : la version du match,
 * plus tout joueur de l'équipe cité par le journal (auteur OU cible — une
 * victime a joué) ou désigné Joueur du Match.
 */
export function sheetSideParticipants(input: {
  readonly snapshot: unknown;
  readonly events: readonly CupSheetEvent[];
  readonly motmPlayerIds: unknown;
  readonly teamPlayers: readonly CareerTeamPlayer[];
}): Set<string> {
  const own = new Set(input.teamPlayers.map((p) => p.id));
  const participants = new Set(
    resolveSnapshotPlayerIds(input.snapshot, input.teamPlayers),
  );
  const add = (id: string | null | undefined): void => {
    if (id && own.has(id)) participants.add(id);
  };
  for (const event of input.events) {
    add(event.actorPlayerId);
    add(event.targetPlayerId);
  }
  for (const id of stringArray(input.motmPlayerIds)) add(id);
  return participants;
}

/**
 * Joueurs crédités d'un match par la validation d'une feuille de LIGUE, lus
 * dans le snapshot `Match.offlineResultInput` (`input.playerStats`). `null`
 * quand le snapshot est absent ou illisible.
 */
export function persistedPlayerIdsFromOfflineSnapshot(
  raw: unknown,
): string[] | null {
  const snapshot = parseJson(raw);
  if (!snapshot || typeof snapshot !== "object") return null;
  const input = (snapshot as { input?: unknown }).input;
  if (!input || typeof input !== "object") return null;
  const lines = (input as { playerStats?: unknown }).playerStats;
  if (!Array.isArray(lines)) return null;
  return lines
    .map((line) =>
      line && typeof line === "object"
        ? (line as { teamPlayerId?: unknown }).teamPlayerId
        : null,
    )
    .filter((id): id is string => typeof id === "string");
}

/**
 * Repli d'une feuille de ligue sans snapshot : la validation crédite un match
 * aux joueurs qui ont une ligne de stats du résumé, plus les Joueurs du Match.
 */
function leaguePersistedFallback(sheet: CareerSheet): Set<string> {
  const summary = summarizeMatchSheet(
    sheet.events as ReadonlyArray<MatchEventInput>,
  );
  return new Set([
    ...summary.playerStats.map((line) => line.playerId),
    ...stringArray(sheet.motmPlayerIds),
  ]);
}

interface MutableCounters {
  matchesPlayed: number;
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvpAwards: number;
}

interface MutableAdjustment {
  leagueMatchesNotPersisted: number;
  cup: MutableCounters;
}

/**
 * Ce que les feuilles validées ajoutent à la carrière de chaque joueur des
 * équipes suivies (`players`). Un côté dont l'équipe n'est pas suivie est
 * ignoré : on ne lit que les joueurs qu'on nous a confiés.
 */
export function computeCompetitionCareerAdjustments(input: {
  readonly sheets: readonly CareerSheet[];
  readonly players: readonly CareerTeamPlayer[];
}): Map<string, CompetitionCareerAdjustment> {
  const playersByTeam = new Map<string, CareerTeamPlayer[]>();
  for (const p of input.players) {
    const list = playersByTeam.get(p.teamId) ?? [];
    list.push(p);
    playersByTeam.set(p.teamId, list);
  }

  const out = new Map<string, MutableAdjustment>();
  const adjustmentOf = (playerId: string): MutableAdjustment => {
    let adj = out.get(playerId);
    if (!adj) {
      adj = { leagueMatchesNotPersisted: 0, cup: { ...EMPTY_CAREER_COUNTERS } };
      out.set(playerId, adj);
    }
    return adj;
  };

  for (const sheet of input.sheets) {
    if (sheet.forfeit) continue;
    const sides = [
      { teamId: sheet.homeTeamId, snapshot: sheet.rosterSnapshotHome },
      { teamId: sheet.awayTeamId, snapshot: sheet.rosterSnapshotAway },
    ];
    const cupActions =
      sheet.kind === "cup"
        ? sheetEventsToLocalMatchActions(sheet.events, () => null)
        : [];
    const motm = new Set(stringArray(sheet.motmPlayerIds));
    const persisted =
      sheet.kind === "league"
        ? sheet.persistedPlayerIds
          ? new Set(sheet.persistedPlayerIds)
          : leaguePersistedFallback(sheet)
        : null;

    for (const side of sides) {
      const teamPlayers = side.teamId ? playersByTeam.get(side.teamId) : null;
      if (!teamPlayers || teamPlayers.length === 0) continue;
      const participants = sheetSideParticipants({
        snapshot: side.snapshot,
        events: sheet.events,
        motmPlayerIds: sheet.motmPlayerIds,
        teamPlayers,
      });

      if (persisted) {
        for (const id of participants) {
          if (!persisted.has(id)) adjustmentOf(id).leagueMatchesNotPersisted += 1;
        }
        continue;
      }

      for (const id of participants) {
        const cup = adjustmentOf(id).cup;
        cup.matchesPlayed += 1;
        if (motm.has(id)) cup.mvpAwards += 1;
      }
      const own = new Set(teamPlayers.map((p) => p.id));
      for (const action of cupActions) {
        if (!own.has(action.playerId)) continue;
        const cup = adjustmentOf(action.playerId).cup;
        const gesture = cupActorGesture(action);
        if (gesture === "touchdown") cup.touchdowns += 1;
        else if (gesture === "casualty") cup.casualties += 1;
        else if (gesture === "completion") cup.completions += 1;
        else if (gesture === "interception") cup.interceptions += 1;
      }
    }
  }
  return out;
}

/** Carrière affichée = compteurs persistés + apport des feuilles. */
export function applyCareerAdjustment(
  persisted: PersistedCareer,
  adjustment: CompetitionCareerAdjustment = EMPTY_ADJUSTMENT,
): PlayerCareerTotals {
  const cup = adjustment.cup;
  return {
    matchesPlayed:
      (persisted.matchesPlayed ?? 0) +
      adjustment.leagueMatchesNotPersisted +
      cup.matchesPlayed,
    touchdowns: (persisted.totalTouchdowns ?? 0) + cup.touchdowns,
    casualties: (persisted.totalCasualties ?? 0) + cup.casualties,
    completions: (persisted.totalCompletions ?? 0) + cup.completions,
    interceptions: (persisted.totalInterceptions ?? 0) + cup.interceptions,
    mvpAwards: (persisted.totalMvpAwards ?? 0) + cup.mvpAwards,
    spp: persisted.spp ?? 0,
    cup: { ...cup },
  };
}
