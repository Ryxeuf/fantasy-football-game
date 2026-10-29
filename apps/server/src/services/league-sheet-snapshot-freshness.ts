/**
 * Fraîcheur du gel d'une feuille de match de LIGUE, et mise à jour.
 *
 * Le gel (« version du match ») est posé à l'ouverture de la feuille. Si une
 * autre feuille d'une des deux équipes est validée — ou invalidée — APRÈS ce
 * gel, l'état figé ne reflète plus l'équipe : c'est le cas d'une J+1 ouverte
 * avant la validation de la J, ou d'une J invalidée puis corrigée après
 * l'ouverture de la J+1 (retour testeur, oct. 2026). La feuille le signale,
 * et un coach ou le commissaire la met à jour (nouveau gel) tant que
 * personne n'a soumis.
 *
 * Aucune colonne nouvelle : chaque gel porte déjà son `capturedAt` (ms) ; un
 * gel qui n'en a pas (antérieur) se date par la création de la feuille, qui
 * était aussi l'heure du gel. Module PUR.
 */

import { roundLabel } from "./league-sheet-open-guard";

/** Changement d'une autre feuille de l'équipe, survenu après le gel. */
export interface SheetChangeAfterFreeze {
  readonly pairingId: string;
  readonly kind: "validated" | "invalidated";
  /** ISO 8601. */
  readonly at: string;
  readonly roundLabel: string;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
}

/** Une autre feuille de ligue de l'équipe, telle que la lit le service. */
export interface OtherTeamSheet {
  readonly pairingId: string;
  readonly validatedAt: Date | string | null;
  readonly invalidatedAt: Date | string | null;
  readonly roundNumber: number;
  readonly roundName: string | null;
  readonly homeTeamId: string;
  readonly homeTeamName: string;
  readonly awayTeamId: string;
  readonly awayTeamName: string;
}

function toTime(d: Date | string | number | null | undefined): number | null {
  if (d === null || d === undefined) return null;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

function parseObject(raw: unknown): Record<string, unknown> | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
}

/**
 * Instant du gel d'un côté (ms) : `capturedAt` du snapshot, sinon la
 * création de la feuille. `null` si le côté n'est pas gelé.
 */
export function snapshotCapturedAt(
  raw: unknown,
  sheetCreatedAt: Date | string | null | undefined,
): number | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  const captured = obj.capturedAt;
  if (typeof captured === "number" && Number.isFinite(captured)) return captured;
  return toTime(sheetCreatedAt);
}

/**
 * Dernier changement d'une autre feuille de `teamId` postérieur au gel, ou
 * `null` si le gel est à jour. Une feuille validée puis invalidée après le
 * gel compte pour son évènement le plus récent.
 */
export function staleSnapshotChange(input: {
  readonly capturedAt: number | null;
  readonly teamId: string;
  readonly currentPairingId: string;
  readonly sheets: readonly OtherTeamSheet[];
}): SheetChangeAfterFreeze | null {
  if (input.capturedAt === null) return null;
  let latest: SheetChangeAfterFreeze | null = null;
  let latestAt = -Infinity;
  for (const s of input.sheets) {
    if (s.pairingId === input.currentPairingId) continue;
    if (s.homeTeamId !== input.teamId && s.awayTeamId !== input.teamId) {
      continue;
    }
    const events: Array<["validated" | "invalidated", number | null]> = [
      ["validated", toTime(s.validatedAt)],
      ["invalidated", toTime(s.invalidatedAt)],
    ];
    for (const [kind, at] of events) {
      if (at === null || at <= input.capturedAt || at <= latestAt) continue;
      latestAt = at;
      latest = {
        pairingId: s.pairingId,
        kind,
        at: new Date(at).toISOString(),
        roundLabel: roundLabel(s.roundNumber, s.roundName),
        homeTeamName: s.homeTeamName,
        awayTeamName: s.awayTeamName,
      };
    }
  }
  return latest;
}

/** Un joueur référencé par la saisie, absent du nouveau gel. */
export interface OrphanSheetPlayer {
  readonly id: string;
  readonly label: string;
}

/** Joueurs (id + libellé) d'un gel, journaliers compris. */
export function snapshotPlayers(
  raw: unknown,
): ReadonlyMap<string, string> {
  const obj = parseObject(raw);
  const out = new Map<string, string>();
  const players = Array.isArray(obj?.players) ? obj.players : [];
  for (const p of players) {
    if (!p || typeof p !== "object") continue;
    const { id, number, name } = p as {
      id?: unknown;
      number?: unknown;
      name?: unknown;
    };
    if (typeof id !== "string" || id === "") continue;
    const num = typeof number === "number" ? `n°${number} ` : "";
    out.set(id, `${num}${typeof name === "string" ? name : id}`.trim());
  }
  return out;
}

/**
 * Joueurs que la saisie cite et que le nouveau gel ne connaît plus (mort ou
 * licencié entre-temps, journalier devenu inutile). Mettre la feuille à jour
 * les rendrait introuvables : la saisie doit d'abord être corrigée. Un id
 * absent de l'ANCIEN gel (Star Player engagé, joueur relevé) n'est pas un
 * joueur du roster : il n'est pas concerné.
 */
export function orphanSheetPlayers(input: {
  readonly referencedIds: Iterable<string>;
  readonly before: ReadonlyMap<string, string>;
  readonly after: ReadonlyMap<string, string>;
}): OrphanSheetPlayer[] {
  const out: OrphanSheetPlayer[] = [];
  const seen = new Set<string>();
  for (const id of input.referencedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const label = input.before.get(id);
    if (label === undefined || input.after.has(id)) continue;
    out.push({ id, label });
  }
  return out;
}

/** Colonnes de la feuille qui citent des joueurs (formes brutes PG / SQLite). */
export interface SheetPlayerReferences {
  readonly motmPlayerIds?: unknown;
  readonly firedPlayerIds?: unknown;
  readonly advancementsHome?: unknown;
  readonly advancementsAway?: unknown;
  readonly sppBonus?: unknown;
  readonly prayersHome?: unknown;
  readonly prayersAway?: unknown;
  readonly purchasesHome?: unknown;
  readonly purchasesAway?: unknown;
}

function parseArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fieldOf(entry: unknown, key: string): string | null {
  if (!entry || typeof entry !== "object") return null;
  const v = (entry as Record<string, unknown>)[key];
  return typeof v === "string" && v !== "" ? v : null;
}

/**
 * Tous les joueurs que la saisie cite : acteurs et cibles d'évènements,
 * Joueurs du Match, licenciements, évolutions, PSP accordés, prières et
 * journaliers recrutés.
 */
export function referencedSheetPlayerIds(
  sheet: SheetPlayerReferences,
  events: ReadonlyArray<{
    readonly actorPlayerId?: string | null;
    readonly targetPlayerId?: string | null;
  }>,
): Set<string> {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (typeof id === "string" && id !== "") ids.add(id);
  };
  for (const ev of events) {
    add(ev.actorPlayerId);
    add(ev.targetPlayerId);
  }
  for (const raw of [sheet.motmPlayerIds, sheet.firedPlayerIds]) {
    for (const id of parseArray(raw)) add(typeof id === "string" ? id : null);
  }
  for (const raw of [
    sheet.advancementsHome,
    sheet.advancementsAway,
    sheet.sppBonus,
    sheet.prayersHome,
    sheet.prayersAway,
  ]) {
    for (const entry of parseArray(raw)) add(fieldOf(entry, "playerId"));
  }
  for (const raw of [sheet.purchasesHome, sheet.purchasesAway]) {
    for (const entry of parseArray(raw)) add(fieldOf(entry, "journeymanId"));
  }
  return ids;
}
