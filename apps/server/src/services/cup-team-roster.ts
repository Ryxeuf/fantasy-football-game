/**
 * Fiche de roster d'une équipe INSCRITE à une coupe (lecture seule).
 *
 * Une coupe se joue en résurrection : chaque rencontre rejoue le roster
 * D'INSCRIPTION (`CupParticipant.rosterSnapshot`), tel quel. C'est donc lui
 * que la fiche montre — pas l'équipe en direct, qui a pu vivre ailleurs
 * depuis (ligue, autre coupe). Un participant historique sans snapshot
 * retombe sur l'équipe en direct, et la fiche le dit (`source: "live"`).
 *
 * Les statistiques sont celles de la COUPE : dérivées des matchs complétés
 * (feuilles validées matérialisées en `LocalMatch`), avec la même définition
 * des gestes que les classements individuels (`cupActorGesture`).
 *
 * `buildCupRosterView` est PUR ; `loadCupTeamRosterView` fait les lectures.
 */

import { getStarPlayerBySlug, type Ruleset } from "@bb/game-engine";
import { prisma } from "../prisma";
import {
  captureRosterSnapshot,
  parseRosterSnapshot,
  type RosterSnapshot,
} from "./cup-roster-snapshot";
import { cupActorGesture, type CupPlayerActionLike } from "./cup-player-stats";
import { loadRosterViewMeta, type RosterViewMeta } from "./team-roster-view";

export class CupTeamRosterError extends Error {
  constructor(
    public readonly code: "cup_not_found" | "team_not_in_cup",
    message: string,
  ) {
    super(message);
    this.name = "CupTeamRosterError";
  }
}

/** Gestes comptés en coupe, par joueur. */
export interface CupPlayerTallies {
  readonly touchdowns: number;
  /** Éliminations au contact (blocage / blitz). */
  readonly casualties: number;
  /** Agressions, sorties ou non (colonne « Agr. » de la ligue). */
  readonly aggressions: number;
  readonly completions: number;
  readonly interceptions: number;
}

const ZERO: CupPlayerTallies = {
  touchdowns: 0,
  casualties: 0,
  aggressions: 0,
  completions: 0,
  interceptions: 0,
};

/** Match complété de la coupe, réduit à ce que la fiche lit. */
export interface CupRosterMatch {
  readonly teamAId: string;
  readonly teamBId: string | null;
  readonly actions: readonly CupPlayerActionLike[];
}

export interface CupTeamTallies {
  /** Rencontres jouées par l'équipe dans la coupe. */
  readonly matchesPlayed: number;
  /** Par id de joueur (`TeamPlayer.id`, ou `star:<slug>` pour un Star Player). */
  readonly byKey: ReadonlyMap<string, CupPlayerTallies>;
  /** Repli par nom, pour un snapshot antérieur aux ids de joueur. */
  readonly byName: ReadonlyMap<string, CupPlayerTallies>;
}

/**
 * Clé d'un acteur de feuille : l'id du joueur, ou `star:<slug>` pour un Star
 * Player — son id synthétique porte le CÔTÉ (`star-home-<slug>`), qui change
 * d'une rencontre à l'autre.
 */
export function cupActorKey(playerId: string): string {
  const star = /^star-(?:home|away)-(.+)$/.exec(playerId);
  return star ? `star:${star[1]}` : playerId;
}

function add(
  map: Map<string, CupPlayerTallies>,
  key: string,
  patch: Partial<CupPlayerTallies>,
): void {
  const cur = map.get(key) ?? ZERO;
  map.set(key, {
    touchdowns: cur.touchdowns + (patch.touchdowns ?? 0),
    casualties: cur.casualties + (patch.casualties ?? 0),
    aggressions: cur.aggressions + (patch.aggressions ?? 0),
    completions: cur.completions + (patch.completions ?? 0),
    interceptions: cur.interceptions + (patch.interceptions ?? 0),
  });
}

/** Gestes de l'équipe `teamId` sur l'ensemble des matchs complétés de la coupe. */
export function cupTeamTallies(
  teamId: string,
  matches: readonly CupRosterMatch[],
): CupTeamTallies {
  const byKey = new Map<string, CupPlayerTallies>();
  const byName = new Map<string, CupPlayerTallies>();
  let matchesPlayed = 0;
  for (const match of matches) {
    const side =
      match.teamAId === teamId ? "A" : match.teamBId === teamId ? "B" : null;
    if (!side) continue;
    matchesPlayed += 1;
    for (const action of match.actions) {
      if (action.playerTeam !== side || !action.playerId) continue;
      const gesture = cupActorGesture(action);
      const patch: Partial<CupPlayerTallies> = {
        touchdowns: gesture === "touchdown" ? 1 : 0,
        casualties: gesture === "casualty" ? 1 : 0,
        completions: gesture === "completion" ? 1 : 0,
        interceptions: gesture === "interception" ? 1 : 0,
        aggressions: action.actionType === "aggression" ? 1 : 0,
      };
      add(byKey, cupActorKey(action.playerId), patch);
      if (action.playerName) add(byName, action.playerName, patch);
    }
  }
  return { matchesPlayed, byKey, byName };
}

export interface CupRosterPlayerView {
  readonly id: string;
  readonly name: string;
  readonly number: number | null;
  readonly position: string;
  readonly positionName: string;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: string;
  readonly spp: number;
  readonly dead: false;
  readonly value: number;
  /** Mention : « Star Player » pour un Star Player du roster d'inscription. */
  readonly note: string | null;
  readonly matchesPlayed: number;
  readonly totalTouchdowns: number;
  readonly totalCasualties: number;
  readonly totalCompletions: number;
  readonly totalInterceptions: number;
  readonly aggressions: number;
}

export interface CupRosterView {
  readonly cup: { readonly id: string; readonly name: string };
  /** `registration` = roster d'inscription ; `live` = repli équipe en direct. */
  readonly source: "registration" | "live";
  /** Date d'inscription figée (ms epoch), `null` en repli. */
  readonly registeredAt: number | null;
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly roster: string;
    readonly ruleset: string;
    readonly raceName: string;
    readonly coachName: string | null;
    readonly logoUrl: string | null;
    readonly teamValue: number;
    readonly currentValue: number;
    readonly rerolls: number;
    readonly cheerleaders: number;
    readonly assistants: number;
    readonly apothecary: boolean;
    readonly dedicatedFans: number;
    readonly specialRules: RosterViewMeta["specialRules"];
    readonly regionalLeagues: RosterViewMeta["regionalLeagues"];
    readonly regionalLeague: string | null;
    /** Rencontres jouées dans la coupe. */
    readonly cupMatchesPlayed: number;
  };
  readonly players: readonly CupRosterPlayerView[];
  /** Coups de pouce achetés à la création (coupe en `build`). */
  readonly inducements: ReadonlyArray<{
    readonly name: string;
    readonly quantity: number;
    readonly unitCost: number;
  }>;
}

export interface BuildCupRosterViewInput {
  readonly cup: { readonly id: string; readonly name: string };
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly roster: string;
    readonly ruleset: string;
    readonly coachName: string | null;
    readonly logoUrl: string | null;
    readonly regionalLeague: string | null;
  };
  readonly snapshot: RosterSnapshot;
  readonly source: "registration" | "live";
  readonly tallies: CupTeamTallies;
  readonly meta: Pick<
    RosterViewMeta,
    "raceName" | "positionName" | "playerValue" | "specialRules" | "regionalLeagues"
  >;
}

/** Assemble la fiche (PUR). */
export function buildCupRosterView(input: BuildCupRosterViewInput): CupRosterView {
  const { snapshot, tallies, meta } = input;
  const statsOf = (key: string | undefined, name: string): CupPlayerTallies =>
    (key ? tallies.byKey.get(key) : undefined) ?? tallies.byName.get(name) ?? ZERO;
  const toRow = (
    base: Omit<
      CupRosterPlayerView,
      | "matchesPlayed"
      | "totalTouchdowns"
      | "totalCasualties"
      | "totalCompletions"
      | "totalInterceptions"
      | "aggressions"
    >,
    stats: CupPlayerTallies,
  ): CupRosterPlayerView => ({
    ...base,
    // Résurrection : le roster d'inscription joue chaque rencontre de l'équipe.
    matchesPlayed: tallies.matchesPlayed,
    totalTouchdowns: stats.touchdowns,
    totalCasualties: stats.casualties,
    totalCompletions: stats.completions,
    totalInterceptions: stats.interceptions,
    aggressions: stats.aggressions,
  });

  const players = [...snapshot.players]
    .sort((a, b) => a.number - b.number)
    .map((p) =>
      toRow(
        {
          id: p.id ?? `snapshot-${p.number}`,
          name: p.name,
          number: p.number,
          position: p.position,
          positionName: meta.positionName(p.position),
          ma: p.ma,
          st: p.st,
          ag: p.ag,
          pa: p.pa,
          av: p.av,
          skills: p.skills,
          spp: p.spp,
          dead: false,
          value: meta.playerValue(p.position, p.advancements),
          note: null,
        },
        statsOf(p.id, p.name),
      ),
    );

  const stars = snapshot.starPlayers.map((sp) => {
    const def = getStarPlayerBySlug(sp.starPlayerSlug, input.team.ruleset as Ruleset);
    const name = def?.displayName ?? sp.starPlayerSlug;
    return toRow(
      {
        id: `star:${sp.starPlayerSlug}`,
        name,
        number: null,
        position: sp.starPlayerSlug,
        positionName: "Star Player",
        ma: def?.ma ?? 0,
        st: def?.st ?? 0,
        ag: def?.ag ?? 0,
        pa: def?.pa ?? null,
        av: def?.av ?? 0,
        skills: def?.skills ?? "",
        spp: 0,
        dead: false,
        value: sp.cost,
        note: "Star Player",
      },
      statsOf(`star:${sp.starPlayerSlug}`, name),
    );
  });

  return {
    cup: input.cup,
    source: input.source,
    registeredAt: input.source === "registration" ? snapshot.capturedAt : null,
    team: {
      ...input.team,
      raceName: meta.raceName,
      teamValue: snapshot.teamValue,
      currentValue: snapshot.currentValue,
      rerolls: snapshot.rerolls,
      cheerleaders: snapshot.cheerleaders,
      assistants: snapshot.assistants,
      apothecary: snapshot.apothecary,
      dedicatedFans: snapshot.dedicatedFans,
      specialRules: meta.specialRules,
      regionalLeagues: meta.regionalLeagues,
      cupMatchesPlayed: tallies.matchesPlayed,
    },
    players: [...players, ...stars],
    inducements: (snapshot.inducements ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitCost: i.unitCost,
    })),
  };
}

/**
 * Charge la fiche de roster d'une équipe inscrite à une coupe. Lève
 * `CupTeamRosterError` si la coupe n'existe pas ou si l'équipe n'y est pas
 * inscrite (404 côté route : rien à consulter).
 */
export async function loadCupTeamRosterView(input: {
  readonly cupId: string;
  readonly teamId: string;
}): Promise<CupRosterView> {
  const cup = (await prisma.cup.findUnique({
    where: { id: input.cupId },
    select: { id: true, name: true },
  })) as { id: string; name: string } | null;
  if (!cup) throw new CupTeamRosterError("cup_not_found", "Coupe introuvable");

  const participant = (await prisma.cupParticipant.findFirst({
    where: { cupId: input.cupId, teamId: input.teamId },
    select: {
      rosterSnapshot: true,
      team: {
        select: {
          id: true,
          name: true,
          roster: true,
          ruleset: true,
          logoUrl: true,
          regionalLeague: true,
          owner: { select: { coachName: true } },
        },
      },
    },
  })) as {
    rosterSnapshot: unknown;
    team: {
      id: string;
      name: string;
      roster: string;
      ruleset: string;
      logoUrl: string | null;
      regionalLeague: string | null;
      owner: { coachName: string | null } | null;
    };
  } | null;
  if (!participant) {
    throw new CupTeamRosterError(
      "team_not_in_cup",
      "Équipe non inscrite à cette coupe",
    );
  }

  const registered = parseRosterSnapshot(participant.rosterSnapshot);
  const snapshot = registered ?? (await captureRosterSnapshot(input.teamId));
  if (!snapshot) {
    throw new CupTeamRosterError(
      "team_not_in_cup",
      "Équipe non inscrite à cette coupe",
    );
  }

  const matches = (await prisma.localMatch.findMany({
    where: {
      cupId: input.cupId,
      status: "completed",
      OR: [{ teamAId: input.teamId }, { teamBId: input.teamId }],
    },
    select: {
      teamAId: true,
      teamBId: true,
      actions: {
        select: {
          actionType: true,
          playerTeam: true,
          playerId: true,
          playerName: true,
          armorBroken: true,
          opponentState: true,
          opponentId: true,
          opponentName: true,
        },
      },
    },
  })) as unknown as CupRosterMatch[];

  const team = participant.team;
  const meta = await loadRosterViewMeta({
    roster: snapshot.roster || team.roster,
    ruleset: snapshot.ruleset || team.ruleset,
    regionalLeague: team.regionalLeague ?? null,
  });

  return buildCupRosterView({
    cup,
    team: {
      id: team.id,
      name: team.name,
      roster: team.roster,
      ruleset: team.ruleset,
      coachName: team.owner?.coachName ?? null,
      logoUrl: team.logoUrl ?? null,
      regionalLeague: team.regionalLeague ?? null,
    },
    snapshot,
    source: registered ? "registration" : "live",
    tallies: cupTeamTallies(input.teamId, matches),
    meta,
  });
}
