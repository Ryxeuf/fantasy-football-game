/**
 * Verrouillage des lineups AU COUP D'ENVOI de chaque match.
 *
 * Le verrou global (`lockLineups`, dimanche 17h UTC) arrivait apres les
 * matchs du jeudi (et du mercredi, vendredi, samedi selon les weeks) : un
 * coach pouvait aligner — ou nommer capitaine — un joueur dont le match
 * etait deja joue et la ligne de stats connue.
 *
 * Regle : un joueur dont le match a commence est GELE pour la week. Son
 * role dans le lineup (capitaine, vice, titulaire, hors lineup) ne peut
 * plus changer : ni ajout, ni retrait, ni promotion, ni retrogradation.
 * Les joueurs dont le match n'a pas commence restent libres jusqu'a leur
 * propre coup d'envoi. Le verrou du dimanche reste en filet de securite.
 *
 * Le coup d'envoi vient de `NflGame.kickoffAt`, alimente a l'avance par
 * le calendrier nflverse (`nflverseScheduleTick`). Un joueur sans match
 * connu cette week (bye) n'est jamais gele.
 */

import { prisma } from "../prisma";

// ────────────────────────────────────────────────────────────────────
// Pur
// ────────────────────────────────────────────────────────────────────

export type LineupRole = "captain" | "vice" | "starter" | "bench";

export interface LineupSnapshot {
  readonly starterIds: ReadonlyArray<string>;
  readonly captainId: string | null;
  readonly viceCaptainId: string | null;
}

export interface FrozenLineupChange {
  readonly playerId: string;
  readonly from: LineupRole;
  readonly to: LineupRole;
}

export interface GameClock {
  readonly kickoffAt: Date;
  /** "scheduled" | "in_progress" | "final" */
  readonly status: string;
}

/**
 * Un match a commence si son coup d'envoi est passe, ou si une source
 * (ESPN, nflverse) l'a deja vu en cours / termine — garde-fou contre un
 * coup d'envoi avance par la NFL et pas encore resynchronise. Pur.
 */
export function hasGameStarted(game: GameClock | undefined, now: Date): boolean {
  if (!game) return false;
  if (game.status !== "scheduled") return true;
  return game.kickoffAt.getTime() <= now.getTime();
}

/** Role d'un joueur dans un lineup (null = pas encore de lineup). Pur. */
export function lineupRole(
  lineup: LineupSnapshot | null,
  playerId: string,
): LineupRole {
  if (!lineup) return "bench";
  if (lineup.captainId === playerId) return "captain";
  if (lineup.viceCaptainId === playerId) return "vice";
  return lineup.starterIds.includes(playerId) ? "starter" : "bench";
}

/**
 * Changements qui touchent un joueur gele. Vide = lineup acceptable.
 * Ordre stable : celui des joueurs du lineup precedent puis du nouveau.
 * Pur.
 */
export function findFrozenLineupChanges(opts: {
  readonly previous: LineupSnapshot | null;
  readonly next: LineupSnapshot;
  readonly startedPlayerIds: ReadonlySet<string>;
}): FrozenLineupChange[] {
  const candidates = new Set<string>([
    ...(opts.previous?.starterIds ?? []),
    ...opts.next.starterIds,
  ]);
  const out: FrozenLineupChange[] = [];
  for (const playerId of candidates) {
    if (!opts.startedPlayerIds.has(playerId)) continue;
    const from = lineupRole(opts.previous, playerId);
    const to = lineupRole(opts.next, playerId);
    if (from !== to) out.push({ playerId, from, to });
  }
  return out;
}

const ROLE_LABEL_FR: Readonly<Record<LineupRole, string>> = {
  captain: "capitaine",
  vice: "vice-capitaine",
  starter: "titulaire",
  bench: "hors lineup",
};

/** Message lisible pour l'erreur API. Pur. */
export function describeFrozenChanges(
  changes: ReadonlyArray<FrozenLineupChange>,
  labelOf: (playerId: string) => string = (id) => id,
): string {
  const parts = changes.map(
    (c) => `${labelOf(c.playerId)} (${ROLE_LABEL_FR[c.from]} -> ${ROLE_LABEL_FR[c.to]})`,
  );
  return `Match deja commence, role fige pour la semaine : ${parts.join(", ")}`;
}

// ────────────────────────────────────────────────────────────────────
// Lecture DB
// ────────────────────────────────────────────────────────────────────

export interface PlayerKickoff {
  readonly kickoffAt: Date;
  readonly started: boolean;
}

/**
 * Coup d'envoi du match de chaque joueur pour une week (via l'equipe
 * actuelle du joueur). Les joueurs sans match (bye, equipe inconnue) sont
 * absents de la Map. 2 requetes, quel que soit le nombre de joueurs.
 */
export async function loadPlayerKickoffs(opts: {
  readonly weekId: string;
  readonly playerIds: ReadonlyArray<string>;
  readonly now: Date;
}): Promise<Map<string, PlayerKickoff>> {
  const out = new Map<string, PlayerKickoff>();
  if (opts.playerIds.length === 0) return out;

  const players: ReadonlyArray<{ id: string; teamCode: string | null }> =
    await prisma.nflPlayer.findMany({
      where: { id: { in: [...opts.playerIds] } },
      select: { id: true, teamCode: true },
    });
  const teamCodes = [
    ...new Set(players.map((p) => p.teamCode).filter((c): c is string => !!c)),
  ];
  if (teamCodes.length === 0) return out;

  const games: ReadonlyArray<{
    homeTeam: string;
    awayTeam: string;
    kickoffAt: Date;
    status: string;
  }> = await prisma.nflGame.findMany({
    where: {
      weekId: opts.weekId,
      OR: [{ homeTeam: { in: teamCodes } }, { awayTeam: { in: teamCodes } }],
    },
    select: { homeTeam: true, awayTeam: true, kickoffAt: true, status: true },
  });
  const gameByTeam = new Map<string, GameClock>();
  for (const g of games) {
    gameByTeam.set(g.homeTeam, g);
    gameByTeam.set(g.awayTeam, g);
  }

  for (const p of players) {
    const game = p.teamCode ? gameByTeam.get(p.teamCode) : undefined;
    if (!game) continue;
    out.set(p.id, {
      kickoffAt: game.kickoffAt,
      started: hasGameStarted(game, opts.now),
    });
  }
  return out;
}

/** Vue API : coup d'envoi ISO + gel, par joueur du roster. */
export type RosterKickoffs = Record<string, { kickoffAt: string; started: boolean }>;

/**
 * Coups d'envoi des joueurs du roster d'une entry pour une week, pour que
 * l'ecran de lineup grise les joueurs geles AVANT que l'API ne refuse.
 */
export async function getRosterKickoffs(opts: {
  readonly entryId: string;
  readonly weekId: string;
  readonly now: Date;
}): Promise<RosterKickoffs> {
  const roster: ReadonlyArray<{ playerId: string }> =
    await prisma.nflFantasyRoster.findMany({
      where: { entryId: opts.entryId },
      select: { playerId: true },
    });
  const kickoffs = await loadPlayerKickoffs({
    weekId: opts.weekId,
    playerIds: roster.map((r) => r.playerId),
    now: opts.now,
  });
  const out: RosterKickoffs = {};
  for (const [playerId, k] of kickoffs) {
    out[playerId] = { kickoffAt: k.kickoffAt.toISOString(), started: k.started };
  }
  return out;
}
