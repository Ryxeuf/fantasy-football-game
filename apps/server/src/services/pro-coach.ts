/**
 * Lot 4 « évolution persistée » — le COACH IA d'une ProTeam (I/O Prisma).
 *
 *  - `ensureProCoach(teamId)` : create-if-missing depuis le profil de race
 *    (`PRO_LEAGUE_TEAM_BY_ID`) — aucune ligne n'existe avant le premier
 *    match, aucun backfill (`prisma/migrations/` est gitignoré).
 *  - `getCoachProfile(teamId)` : le profil VIVANT, relu tolérant.
 *  - `applyPostMatchAdaptation(...)` : intègre les drives d'un match
 *    (`adaptCoachProfile`, borné à `anchor ± bande`), persiste le profil
 *    et une ligne append-only `ProCoachMemory` avec les raisons.
 *  - `updateCoachByAdmin` / `resetCoach` : la console admin pose l'ANCRE
 *    (un réglage admin redéfinit la base autour de laquelle le coach bouge).
 *
 * Les erreurs d'adaptation ne doivent jamais faire échouer un match déjà
 * persisté : le runner appelle `applyPostMatchAdaptation` dans un
 * `try/catch` (même posture que les hooks post-settlement).
 */

import {
  EMPTY_COACH_MEMORY,
  PRO_LEAGUE_TEAM_BY_ID,
  adaptCoachProfile,
  parseTacticalProfile,
  type CoachMemory,
  type DriveRecord,
  type ProfileChange,
  type TacticalProfile,
} from "@bb/sim-engine";

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

import {
  coachNameFor,
  describePhilosophy,
  parseStoredChanges,
  parseStoredMemory,
  parseStoredProfile,
  summarizeEvolution,
} from "./pro-coach-profile";

export class ProCoachError extends Error {
  constructor(
    public readonly code: "team-not-found",
    message: string,
  ) {
    super(message);
    this.name = "ProCoachError";
  }
}

interface ProCoachRow {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly philosophy: string;
  readonly profile: unknown;
  readonly anchorProfile: unknown;
  readonly memory: unknown;
  readonly experience: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProCoachView {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly philosophy: string;
  readonly profile: TacticalProfile;
  readonly anchorProfile: TacticalProfile;
  readonly memory: CoachMemory;
  readonly experience: number;
  readonly updatedAt: Date;
}

export interface ProCoachMemoryView {
  readonly id: string;
  readonly matchId: string | null;
  readonly summary: string;
  readonly changes: readonly ProfileChange[];
  readonly createdAt: Date;
}

/** Profil de race d'une équipe (ancre par défaut) ; neutre si slug inconnu. */
export function raceProfileFor(slug: string): TacticalProfile {
  const pro = PRO_LEAGUE_TEAM_BY_ID[slug];
  return pro ? parseTacticalProfile(pro.tactics) : parseTacticalProfile({});
}

function toView(row: ProCoachRow): ProCoachView {
  const anchorProfile = parseStoredProfile(row.anchorProfile);
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    philosophy: row.philosophy,
    profile: parseStoredProfile(row.profile, anchorProfile),
    anchorProfile,
    memory: parseStoredMemory(row.memory),
    experience: row.experience,
    updatedAt: row.updatedAt,
  };
}

/** Le coach de l'équipe, créé à la demande depuis le profil de race. */
export async function ensureProCoach(teamId: string): Promise<ProCoachView> {
  const existing = (await prisma.proCoach.findUnique({
    where: { teamId },
  })) as ProCoachRow | null;
  if (existing) return toView(existing);

  const team = (await prisma.proTeam.findUnique({
    where: { id: teamId },
    select: { id: true, slug: true },
  })) as { id: string; slug: string } | null;
  if (!team) throw new ProCoachError("team-not-found", `ProTeam '${teamId}' introuvable`);

  const profile = raceProfileFor(team.slug);
  const created = (await prisma.proCoach.create({
    data: {
      teamId,
      name: coachNameFor(team.slug),
      philosophy: describePhilosophy(profile),
      profile,
      anchorProfile: profile,
      memory: EMPTY_COACH_MEMORY,
      experience: 0,
    },
  })) as ProCoachRow;
  return toView(created);
}

/** Profil VIVANT à passer au simulateur. */
export async function getCoachProfile(teamId: string): Promise<TacticalProfile> {
  return (await ensureProCoach(teamId)).profile;
}

export async function getProCoachByTeamId(teamId: string): Promise<ProCoachView | null> {
  const row = (await prisma.proCoach.findUnique({ where: { teamId } })) as ProCoachRow | null;
  return row ? toView(row) : null;
}

export async function listCoachMemory(
  coachId: string,
  limit = 20,
): Promise<readonly ProCoachMemoryView[]> {
  const rows = (await prisma.proCoachMemory.findMany({
    where: { coachId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, limit)),
    select: { id: true, matchId: true, summary: true, changes: true, createdAt: true },
  })) as ReadonlyArray<{ id: string; matchId: string | null; summary: string; changes: unknown; createdAt: Date }>;
  return rows.map((r) => ({
    id: r.id,
    matchId: r.matchId,
    summary: r.summary,
    changes: parseStoredChanges(r.changes),
    createdAt: r.createdAt,
  }));
}

export interface PostMatchAdaptationInput {
  readonly teamId: string;
  readonly matchId: string;
  /** Drives du match pour CETTE équipe (déjà filtrés par côté). */
  readonly drives: readonly DriveRecord[];
}

export interface PostMatchAdaptationResult {
  readonly coachId: string;
  readonly changes: readonly ProfileChange[];
  readonly summary: string;
}

/** Intègre un match dans le profil du coach et journalise l'évolution. */
export async function applyPostMatchAdaptation(
  input: PostMatchAdaptationInput,
): Promise<PostMatchAdaptationResult> {
  const coach = await ensureProCoach(input.teamId);
  const out = adaptCoachProfile({
    profile: coach.profile,
    anchor: coach.anchorProfile,
    memory: coach.memory,
    drives: input.drives,
  });
  const summary = summarizeEvolution(input.drives, out.changes);
  await prisma.$transaction([
    prisma.proCoach.update({
      where: { id: coach.id },
      data: {
        profile: out.profile,
        memory: out.memory,
        experience: { increment: 1 },
      },
    }),
    prisma.proCoachMemory.create({
      data: {
        coachId: coach.id,
        matchId: input.matchId,
        drives: input.drives,
        changes: out.changes,
        profileBefore: coach.profile,
        profileAfter: out.profile,
        summary,
      },
    }),
  ]);
  return { coachId: coach.id, changes: out.changes, summary };
}

export interface CoachAdminPatch {
  readonly name?: string;
  readonly philosophy?: string;
  /** Partiel : les paramètres fournis redéfinissent l'ANCRE et le profil. */
  readonly profile?: Partial<TacticalProfile>;
}

/** Réglage admin : pose l'ancre (et y ramène le profil vivant). */
export async function updateCoachByAdmin(
  teamId: string,
  patch: CoachAdminPatch,
): Promise<ProCoachView> {
  const coach = await ensureProCoach(teamId);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.philosophy !== undefined) data.philosophy = patch.philosophy;
  if (patch.profile !== undefined) {
    const anchor = parseTacticalProfile({ ...coach.anchorProfile, ...patch.profile });
    data.anchorProfile = anchor;
    data.profile = anchor;
    if (patch.philosophy === undefined) data.philosophy = describePhilosophy(anchor);
  }
  const updated = (await prisma.proCoach.update({
    where: { id: coach.id },
    data,
  })) as ProCoachRow;
  return toView(updated);
}

/** Reset admin : profil et ancre reviennent au profil de race, mémoire vidée. */
export async function resetCoach(teamId: string): Promise<ProCoachView> {
  const coach = await ensureProCoach(teamId);
  const team = (await prisma.proTeam.findUnique({
    where: { id: teamId },
    select: { slug: true },
  })) as { slug: string } | null;
  if (!team) throw new ProCoachError("team-not-found", `ProTeam '${teamId}' introuvable`);
  const profile = raceProfileFor(team.slug);
  const [updated] = await prisma.$transaction([
    prisma.proCoach.update({
      where: { id: coach.id },
      data: {
        profile,
        anchorProfile: profile,
        philosophy: describePhilosophy(profile),
        memory: EMPTY_COACH_MEMORY,
        experience: 0,
      },
    }),
    prisma.proCoachMemory.create({
      data: {
        coachId: coach.id,
        matchId: null,
        drives: [],
        changes: [],
        profileBefore: coach.profile,
        profileAfter: profile,
        summary: "Réinitialisation par l'admin : retour au profil de race.",
      },
    }),
  ]);
  return toView(updated as ProCoachRow);
}

export interface PostMatchEvolutionInput {
  readonly matchId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly drives: readonly DriveRecord[];
}

/**
 * Évolution des DEUX coachs après un match, best-effort : chaque côté est
 * isolé, un échec est journalisé et ne remonte jamais.
 */
export async function applyPostMatchEvolution(input: PostMatchEvolutionInput): Promise<void> {
  const sides: ReadonlyArray<readonly ["A" | "B", string]> = [
    ["A", input.homeTeamId],
    ["B", input.awayTeamId],
  ];
  for (const [side, teamId] of sides) {
    try {
      await applyPostMatchAdaptation({
        teamId,
        matchId: input.matchId,
        drives: input.drives.filter((d) => d.team === side),
      });
    } catch (e) {
      serverLog.error(`[pro-coach] adaptation failed for team ${teamId} (match ${input.matchId})`, e);
    }
  }
}
