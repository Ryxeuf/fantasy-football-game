/**
 * Service "report du lineup precedent" (carry-over).
 *
 * Permet a un coach de reutiliser son lineup de la semaine n-1 (ou la
 * derniere semaine ou il avait setLineup une lineup) plutot que de
 * tout reconfigurer chaque semaine.
 *
 * Deux usages :
 *   1. `findPreviousLineupSummary({ entryId, currentWeekId })` — vue
 *      read-only, expose au GET /:entryId/lineup pour permettre a
 *      l'UI de proposer la bannierre "Reporter votre lineup W{n}".
 *   2. `carryOverLineupFromPreviousWeek({ entryId, currentWeekId })` —
 *      applique le report : trouve la lineup precedente, filtre les
 *      joueurs ayant quitte le roster (mercato, trade), recalibre
 *      captain/vice si necessaire, persiste via setLineup. Refuse si
 *      la lineup courante est deja locked ou si trop de joueurs ont
 *      quitte le roster (rendant la lineup non-valide).
 *
 * "Semaine precedente" = NflWeek du meme NflSeason avec le plus grand
 * weekNumber strictement inferieur au weekNumber courant, parmi les
 * weeks pour lesquelles cette entry a une lineup persistee.
 *
 * Pas de dependance vers le settle / scoring — ce module est read-only
 * sur les autres etats du systeme.
 */

import { prisma } from "../prisma";
import {
  DEFAULT_STARTERS_COUNT,
  NflFantasyLineupError,
  setLineup,
  type LineupWithStarters,
} from "./nfl-fantasy-lineup";

interface NflWeekRef {
  readonly id: string;
  readonly weekNumber: number;
}

interface StarterSnapshot {
  readonly playerId: string;
  readonly bbPosition: string;
  readonly isCaptain: boolean;
  readonly isViceCaptain: boolean;
}

export interface PreviousLineupSummary {
  /** weekId de la lineup precedente. */
  readonly weekId: string;
  /** weekNumber (ex: 1 pour "2025:W1"). */
  readonly weekNumber: number;
  /** Nombre de starters dans la lineup precedente. */
  readonly startersCount: number;
  /** True si tous les starters sont encore sur le roster courant. */
  readonly allPlayersOnRoster: boolean;
  /** Nb de starters qui ne sont plus sur le roster. */
  readonly missingPlayers: number;
}

/**
 * Cherche la lineup la plus recente que cette entry a deja set sur une
 * semaine anterieure (meme saison que `currentWeekId`). Retourne null
 * si aucune lineup precedente n'existe (ex: c'est la W1 du championnat).
 */
export async function findPreviousLineup(opts: {
  entryId: string;
  currentWeekId: string;
}): Promise<{
  lineup: LineupWithStarters;
  weekId: string;
  weekNumber: number;
} | null> {
  const currentWeek = await prisma.nflWeek.findUnique({
    where: { id: opts.currentWeekId },
    select: { seasonId: true, weekNumber: true },
  });
  if (!currentWeek) return null;

  // Toutes les weeks anterieures de la meme saison, triees desc
  const previousWeeks: ReadonlyArray<NflWeekRef> = await prisma.nflWeek.findMany(
    {
      where: {
        seasonId: currentWeek.seasonId,
        weekNumber: { lt: currentWeek.weekNumber },
      },
      select: { id: true, weekNumber: true },
      orderBy: { weekNumber: "desc" },
    },
  );
  if (previousWeeks.length === 0) return null;

  const weekNumberById = new Map<string, number>(
    previousWeeks.map((w) => [w.id, w.weekNumber] as const),
  );

  // Toutes les lineups de cette entry pour ces weeks (une seule query
  // batchee). On prend ensuite la plus recente cote weekNumber.
  const lineups = await prisma.nflFantasyLineup.findMany({
    where: {
      entryId: opts.entryId,
      weekId: { in: previousWeeks.map((w) => w.id) },
    },
    include: { starters: true },
  });
  if (lineups.length === 0) return null;

  const sorted = [...lineups].sort(
    (a, b) =>
      (weekNumberById.get(b.weekId) ?? 0) -
      (weekNumberById.get(a.weekId) ?? 0),
  );
  const top = sorted[0];
  return {
    lineup: top,
    weekId: top.weekId,
    weekNumber: weekNumberById.get(top.weekId) ?? 0,
  };
}

/**
 * Vue summary destinee au GET /lineup pour qu'une UI puisse afficher
 * une bannierre "Reporter votre lineup de la W{n}". Inclut un compte
 * des joueurs qui ne sont plus sur le roster (info pour l'UI : si tu
 * reportes, voici ce que tu vas perdre).
 */
export async function findPreviousLineupSummary(opts: {
  entryId: string;
  currentWeekId: string;
}): Promise<PreviousLineupSummary | null> {
  const previous = await findPreviousLineup(opts);
  if (!previous) return null;

  // Verifier l'overlap avec le roster courant
  const rosterRows: ReadonlyArray<{ playerId: string }> =
    await prisma.nflFantasyRoster.findMany({
      where: { entryId: opts.entryId },
      select: { playerId: true },
    });
  const onRoster = new Set(rosterRows.map((r) => r.playerId));
  const missing = previous.lineup.starters.filter(
    (s) => !onRoster.has(s.playerId),
  ).length;

  return {
    weekId: previous.weekId,
    weekNumber: previous.weekNumber,
    startersCount: previous.lineup.starters.length,
    allPlayersOnRoster: missing === 0,
    missingPlayers: missing,
  };
}

/**
 * Applique le carry-over : trouve la lineup precedente, filtre les
 * joueurs absents du roster courant, recalibre captain/vice si
 * necessaire, persiste via setLineup pour la `currentWeekId`.
 *
 * Si la lineup courante est deja lockee, propagation de
 * LINEUP_LOCKED via setLineup. Si pas de lineup precedente,
 * NO_PREVIOUS_LINEUP. Si trop de joueurs manquent (le total survivant
 * < DEFAULT_STARTERS_COUNT), ROSTER_TOO_DIVERGENT.
 */
export async function carryOverLineupFromPreviousWeek(opts: {
  entryId: string;
  currentWeekId: string;
}): Promise<LineupWithStarters> {
  const currentWeek = await prisma.nflWeek.findUnique({
    where: { id: opts.currentWeekId },
    select: { id: true },
  });
  if (!currentWeek) {
    throw new NflFantasyLineupError(
      "WEEK_NOT_FOUND",
      `Week ${opts.currentWeekId} introuvable`,
    );
  }

  const previous = await findPreviousLineup(opts);
  if (!previous) {
    throw new NflFantasyLineupError(
      "NO_PREVIOUS_LINEUP",
      `Aucun lineup precedent pour l'entry ${opts.entryId} dans la saison courante`,
    );
  }

  // Filtre les joueurs encore sur le roster
  const rosterRows: ReadonlyArray<{ playerId: string }> =
    await prisma.nflFantasyRoster.findMany({
      where: { entryId: opts.entryId },
      select: { playerId: true },
    });
  const onRoster = new Set(rosterRows.map((r) => r.playerId));

  const survivingStarters: StarterSnapshot[] = previous.lineup.starters
    .filter((s) => onRoster.has(s.playerId))
    .map((s) => ({
      playerId: s.playerId,
      bbPosition: s.bbPosition,
      isCaptain: s.isCaptain,
      isViceCaptain: s.isViceCaptain,
    }));

  if (survivingStarters.length < DEFAULT_STARTERS_COUNT) {
    throw new NflFantasyLineupError(
      "ROSTER_TOO_DIVERGENT",
      `Seulement ${survivingStarters.length} joueurs encore sur le roster (besoin de ${DEFAULT_STARTERS_COUNT}). Compose un nouveau lineup manuellement.`,
    );
  }

  // Si le roster a plus que 11 survivants (ex: lineup precedente plus
  // grande, ou pas de filtrage initial), on prend les 11 premiers en
  // gardant l'ordre original.
  const starters = survivingStarters.slice(0, DEFAULT_STARTERS_COUNT);

  // Recalibre captain : preserver l'ancien s'il survit, sinon premier
  // starter. Vice : preserver s'il survit ET different du captain,
  // sinon null (laisser le coach choisir).
  const captainInList = starters.find((s) => s.isCaptain);
  const captainId = captainInList?.playerId ?? starters[0].playerId;
  const viceInList = starters.find(
    (s) => s.isViceCaptain && s.playerId !== captainId,
  );
  const viceCaptainId = viceInList?.playerId ?? null;

  return setLineup({
    entryId: opts.entryId,
    weekId: opts.currentWeekId,
    starters: starters.map((s) => ({
      playerId: s.playerId,
      bbPosition: s.bbPosition,
    })),
    captainId,
    viceCaptainId,
  });
}
