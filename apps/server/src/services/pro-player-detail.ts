/**
 * Pro player detail — Lot G.
 *
 * Service qui agrège les données nécessaires à la page
 * `/pro-league/teams/:slug/players/:playerId` :
 *
 *   - identité (name, position, team meta)
 *   - stats courantes (ma/st/ag/pa/av) avec les bonus
 *   - skills acquis
 *   - status (active / injured / dead / retired)
 *   - niggling count
 *   - progression (level, spp, nextLevelSpp, tv)
 *   - career counters (TD/CAS/COMP/MVP totals)
 *   - skill access pools (G/A/S/P/M par catégorie)
 *
 * Pas de per-match SPP delta dans ce premier jet — il faudrait miner les
 * replays par playerId, hors scope du lot. La page utilise les career
 * counters cumulés sur `ProTeamRoster`.
 */

import { prisma } from "../prisma";
import {
  POSITION_SKILL_ACCESS,
  type SkillCategory,
} from "./pro-position-skill-access";
import { nextLevelSpp } from "./pro-league-team";
import { levelForSpp } from "./pro-roster-level-up";

export class ProPlayerNotFoundError extends Error {
  constructor(playerId: string) {
    super(`ProTeamRoster id='${playerId}' introuvable`);
    this.name = "ProPlayerNotFoundError";
  }
}

export interface ProPlayerStats {
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
}

export interface ProPlayerStatBonuses {
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number;
  readonly av: number;
}

export interface ProPlayerProgression {
  readonly level: number;
  readonly spp: number;
  readonly nextLevelSpp: number | null;
  readonly tv: number;
}

export interface ProPlayerCareer {
  readonly tdCount: number;
  readonly casCount: number;
  readonly compCount: number;
  readonly mvpCount: number;
}

export interface ProPlayerSkillAccess {
  readonly primary: readonly SkillCategory[];
  readonly secondary: readonly SkillCategory[];
}

export interface ProPlayerTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly race: string;
  readonly primaryColor: string | null;
}

export interface ProPlayerDetail {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly status: string;
  readonly form: number;
  readonly niggling: number;
  readonly skills: readonly string[];
  readonly stats: ProPlayerStats;
  readonly statBonuses: ProPlayerStatBonuses;
  readonly progression: ProPlayerProgression;
  readonly career: ProPlayerCareer;
  readonly skillAccess: ProPlayerSkillAccess;
  readonly team: ProPlayerTeam;
}

function parseSkills(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

export async function getProPlayerDetail(
  playerId: string,
): Promise<ProPlayerDetail> {
  const row = (await prisma.proTeamRoster.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      name: true,
      position: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
      skills: true,
      status: true,
      form: true,
      niggling: true,
      spp: true,
      level: true,
      tvCached: true,
      tdCount: true,
      casCount: true,
      compCount: true,
      mvpCount: true,
      maBonus: true,
      stBonus: true,
      agBonus: true,
      paBonus: true,
      avBonus: true,
      team: {
        select: {
          slug: true,
          name: true,
          city: true,
          race: true,
          primaryColor: true,
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  if (!row) {
    throw new ProPlayerNotFoundError(playerId);
  }
  const spp = (row.spp as number | null) ?? 0;
  const level = Math.max((row.level as number | null) ?? 1, levelForSpp(spp));
  const access =
    POSITION_SKILL_ACCESS[row.position as string] ??
    POSITION_SKILL_ACCESS.Lineman;
  return {
    id: row.id as string,
    name: row.name as string,
    position: row.position as string,
    status: (row.status as string) ?? "active",
    form: (row.form as number) ?? 50,
    niggling: (row.niggling as number) ?? 0,
    skills: parseSkills(row.skills),
    stats: {
      ma: row.ma as number,
      st: row.st as number,
      ag: row.ag as number,
      pa: (row.pa as number | null) ?? null,
      av: row.av as number,
    },
    statBonuses: {
      ma: (row.maBonus as number | null) ?? 0,
      st: (row.stBonus as number | null) ?? 0,
      ag: (row.agBonus as number | null) ?? 0,
      pa: (row.paBonus as number | null) ?? 0,
      av: (row.avBonus as number | null) ?? 0,
    },
    progression: {
      level,
      spp,
      nextLevelSpp: nextLevelSpp(spp),
      tv: (row.tvCached as number | null) ?? 50000,
    },
    career: {
      tdCount: (row.tdCount as number | null) ?? 0,
      casCount: (row.casCount as number | null) ?? 0,
      compCount: (row.compCount as number | null) ?? 0,
      mvpCount: (row.mvpCount as number | null) ?? 0,
    },
    skillAccess: {
      primary: access.primary,
      secondary: access.secondary,
    },
    team: {
      slug: row.team.slug as string,
      name: row.team.name as string,
      city: row.team.city as string,
      race: row.team.race as string,
      primaryColor: (row.team.primaryColor as string | null) ?? null,
    },
  };
}
