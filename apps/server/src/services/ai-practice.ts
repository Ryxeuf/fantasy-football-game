/**
 * N.4 — Mode pratique contre IA : service serveur.
 *
 * Responsabilites :
 *  - garantir qu'un utilisateur systeme "AI" existe (proprietaire des equipes IA) ;
 *  - provisionner une equipe IA depuis un roster prioritaire
 *    (via `getRosterFromDb`, avec les 11 joueurs "min" des postes disponibles) ;
 *  - creer un `LocalMatch` marque `aiOpponent = true`.
 *
 * L'IA adversaire est contrainte a la whitelist N.4b
 * (`AI_OPPONENT_ALLOWED_ROSTERS` — 5 equipes prioritaires).
 */

import { randomBytes } from "crypto";
import {
  isAIOpponentRosterAllowed,
  pickAIOpponentRoster,
  makeRNG,
  type AIDifficulty,
  type AIOpponentRoster,
} from "@bb/game-engine";
import { getRosterFromDb } from "../utils/roster-helpers";

/** Email / id contextuel de l'utilisateur systeme IA. */
const AI_SYSTEM_EMAIL = "ai-opponent@system.bloobowl.local";
const AI_SYSTEM_COACH_NAME = "AI Coach";

export type AITeamSide = "A" | "B";

export interface CreatePracticeMatchParams {
  readonly creatorId: string;
  readonly userTeamId: string;
  readonly difficulty: AIDifficulty;
  /** Roster IA impose (optionnel). Si omis, un roster est choisi via RNG seede. */
  readonly aiRosterSlug?: string;
  /** Cote controle par l'utilisateur ('A' par defaut, l'IA prenant l'autre cote). */
  readonly userSide?: AITeamSide;
  /** Seed optionnelle pour la selection reproductible du roster IA. */
  readonly seed?: string;
}

export interface CreatePracticeMatchResult {
  readonly localMatchId: string;
  readonly aiTeamId: string;
  readonly aiRoster: AIOpponentRoster;
  readonly aiTeamSide: AITeamSide;
}

type PrismaLike = {
  user: {
    findUnique: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
  };
  team: {
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  };
  teamPlayer: {
    createMany: (args: any) => Promise<any>;
  };
  localMatch: {
    create: (args: any) => Promise<any>;
  };
};

/**
 * Garantit l'existence de l'utilisateur systeme IA, proprietaire des equipes IA.
 * Idempotent : reutilise l'existant si deja cree.
 */
export async function ensureAISystemUser(prisma: PrismaLike): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({ where: { email: AI_SYSTEM_EMAIL } });
  if (existing) return { id: existing.id };
  const passwordHash = randomBytes(24).toString("hex");
  const user = await prisma.user.upsert({
    where: { email: AI_SYSTEM_EMAIL },
    update: {},
    create: {
      email: AI_SYSTEM_EMAIL,
      passwordHash,
      name: AI_SYSTEM_COACH_NAME,
      coachName: AI_SYSTEM_COACH_NAME,
      role: "ai",
      roles: ["ai"],
    },
  });
  return { id: user.id };
}

export interface SpawnAITeamParams {
  readonly prisma: PrismaLike;
  readonly ownerId: string;
  readonly rosterSlug: AIOpponentRoster;
  readonly teamName?: string;
}

/**
 * Cree une equipe IA avec au moins 11 joueurs derives des postes "min" du roster.
 * Si le total des min est < 11, on complete en piochant dans les postes restants.
 */
export async function spawnAITeam(params: SpawnAITeamParams): Promise<{ id: string }> {
  const { prisma, ownerId, rosterSlug, teamName } = params;
  const roster = await getRosterFromDb(rosterSlug, "fr");
  if (!roster) {
    throw new Error(`Roster IA introuvable en base: ${rosterSlug}`);
  }

  const players: Array<{
    name: string;
    position: string;
    number: number;
    ma: number;
    st: number;
    ag: number;
    pa: number;
    av: number;
    skills: string;
  }> = [];

  // Remplir d'abord les minimums obligatoires.
  let jerseyNumber = 1;
  for (const position of roster.positions) {
    const minCount = Math.max(0, position.min ?? 0);
    for (let i = 0; i < minCount; i += 1) {
      if (jerseyNumber > 16) break;
      players.push({
        name: `${position.displayName} ${i + 1}`,
        position: position.slug,
        number: jerseyNumber++,
        ma: position.ma,
        st: position.st,
        ag: position.ag,
        pa: position.pa,
        av: position.av,
        skills: position.skills ?? "",
      });
    }
    if (jerseyNumber > 16) break;
  }

  // Completer jusqu'a 11 joueurs avec le premier poste disposant de "max" > count actuel.
  while (players.length < 11 && jerseyNumber <= 16) {
    let added = false;
    for (const position of roster.positions) {
      const alreadyInPos = players.filter(p => p.position === position.slug).length;
      const maxCount = position.max ?? 0;
      if (alreadyInPos >= maxCount) continue;
      players.push({
        name: `${position.displayName} ${alreadyInPos + 1}`,
        position: position.slug,
        number: jerseyNumber++,
        ma: position.ma,
        st: position.st,
        ag: position.ag,
        pa: position.pa,
        av: position.av,
        skills: position.skills ?? "",
      });
      added = true;
      if (players.length >= 11) break;
    }
    if (!added) break;
  }

  // Filet de sauvetage : Lineman generique si la DB ne fournit pas assez de postes.
  while (players.length < 11) {
    players.push({
      name: `Lineman ${players.length + 1}`,
      position: "Lineman",
      number: jerseyNumber++,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "",
    });
  }

  const finalTeamValue = roster.budget ?? 1_000_000;
  const finalName = teamName ?? `${roster.name} (IA)`;
  const team = await prisma.team.create({
    data: {
      ownerId,
      name: finalName,
      roster: rosterSlug,
      teamValue: finalTeamValue,
      initialBudget: finalTeamValue,
      treasury: 0,
      rerolls: 0,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 1,
      currentValue: finalTeamValue,
    },
  });

  await prisma.teamPlayer.createMany({
    data: players.map(p => ({ ...p, teamId: team.id })),
  });

  return { id: team.id };
}

/**
 * Cree un `LocalMatch` en mode pratique contre IA.
 * Provisionne l'utilisateur systeme IA et une equipe adversaire a la volee.
 */
export async function createPracticeMatch(
  prisma: PrismaLike,
  params: CreatePracticeMatchParams,
): Promise<CreatePracticeMatchResult> {
  const { creatorId, userTeamId, difficulty } = params;
  if (!userTeamId) {
    throw new Error("userTeamId est requis");
  }

  const userTeam = await prisma.team.findUnique({ where: { id: userTeamId } });
  if (!userTeam) {
    throw new Error("Equipe utilisateur introuvable");
  }
  if (userTeam.ownerId !== creatorId) {
    throw new Error("Vous devez etre proprietaire de l'equipe utilisateur");
  }

  let aiRosterSlug: AIOpponentRoster | null = null;
  if (params.aiRosterSlug) {
    if (!isAIOpponentRosterAllowed(params.aiRosterSlug)) {
      throw new Error(`Roster IA non autorise: ${params.aiRosterSlug}`);
    }
    aiRosterSlug = params.aiRosterSlug;
  } else {
    const seed = params.seed ?? `ai-practice-${creatorId}-${Date.now()}`;
    const rng = makeRNG(seed);
    const exclude = isAIOpponentRosterAllowed(userTeam.roster) ? [userTeam.roster] : [];
    aiRosterSlug = pickAIOpponentRoster({ rng, exclude });
  }

  if (!aiRosterSlug) {
    throw new Error("Impossible de selectionner un roster IA");
  }

  const aiUser = await ensureAISystemUser(prisma);
  const aiTeam = await spawnAITeam({
    prisma,
    ownerId: aiUser.id,
    rosterSlug: aiRosterSlug,
  });

  const userSide: AITeamSide = params.userSide ?? "A";
  const aiTeamSide: AITeamSide = userSide === "A" ? "B" : "A";
  const teamAId = userSide === "A" ? userTeamId : aiTeam.id;
  const teamBId = userSide === "A" ? aiTeam.id : userTeamId;

  const localMatch = await prisma.localMatch.create({
    data: {
      name: `Practice vs AI (${difficulty})`,
      creatorId,
      teamAId,
      teamBId,
      status: "pending",
      isPublic: false,
      aiOpponent: true,
      aiDifficulty: difficulty,
      aiTeamSide,
      // Le createur controle son cote ; l'IA "valide" automatiquement son cote.
      teamAOwnerValidated: userSide === "A",
      teamBOwnerValidated: userSide === "B",
    },
  });

  return {
    localMatchId: localMatch.id,
    aiTeamId: aiTeam.id,
    aiRoster: aiRosterSlug,
    aiTeamSide,
  };
}
