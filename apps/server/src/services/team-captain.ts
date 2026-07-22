/**
 * Règle spéciale d'équipe "Capitaine" (Blood Bowl Saison 3) — désignation
 * et cycle de vie côté serveur.
 *
 * Règle : à la création d'une équipe dont le roster possède la règle
 * spéciale `capitaine`, le coach peut désigner n'importe quel joueur de sa
 * liste (sauf un Gros Bras) comme capitaine. Le capitaine gagne
 * immédiatement la compétence Pro SANS augmenter la valeur d'équipe (Pro
 * est injectée dans `TeamPlayer.skills`, jamais dans `advancements` — la
 * VE ne compte que coût de poste + surcharges d'advancements). Le
 * capitaine ne peut être licencié que s'il a subi une blessure réduisant
 * une caractéristique. S'il meurt (ou est licencié) en ligue, le coach
 * peut désigner un nouveau capitaine.
 *
 * Invariant : au plus UN joueur avec `isCaptain = true` par équipe. Un
 * capitaine mort/licencié garde son flag (trace historique + message UI
 * "désignez un successeur") jusqu'à la désignation du remplaçant, qui
 * nettoie tous les autres flags de l'équipe.
 *
 * Les effets en match (relance gratuite sur 6 naturel, alignement
 * obligatoire) vivent dans `@bb/game-engine` (`mechanics/captain.ts`) via
 * le flag propagé par `services/match-start.ts`.
 */

import {
  DEFAULT_RULESET,
  getSpecialRulesForTeam,
  isBigGuy,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { getRosterFromDb } from "../utils/roster-helpers";
import { isTeamRosterFrozen } from "./team-lock-status";

export const CAPTAIN_RULE_SLUG = "capitaine";
export const PRO_SKILL_SLUG = "pro";

export type CaptainErrorCode =
  | "team_not_found"
  | "no_captain_rule"
  | "player_not_found"
  | "player_inactive"
  | "player_big_guy"
  | "captain_already_active";

export class CaptainError extends Error {
  constructor(
    public readonly code: CaptainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CaptainError";
  }
}

interface TeamPlayerRow {
  id: string;
  name: string;
  number: number;
  position: string;
  skills: string;
  dead: boolean;
  firedAt: Date | null;
  isCaptain: boolean;
  maReduction: number;
  stReduction: number;
  agReduction: number;
  paReduction: number;
  avReduction: number;
  advancements: string;
}

const PLAYER_SELECT = {
  id: true,
  name: true,
  number: true,
  position: true,
  skills: true,
  dead: true,
  firedAt: true,
  isCaptain: true,
  maReduction: true,
  stReduction: true,
  agReduction: true,
  paReduction: true,
  avReduction: true,
  advancements: true,
} as const;

/** Parse tolérant du CSV de compétences d'un TeamPlayer. */
export function parseSkillsCsv(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Le roster de l'équipe possède-t-il la règle spéciale "Capitaine" ?
 * DB en priorité (éditable côté admin), fallback sur les données
 * statiques du game-engine si le roster n'est pas (encore) seedé.
 */
export async function teamHasCaptainRule(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): Promise<boolean> {
  const dbRoster = await getRosterFromDb(rosterSlug, "fr", ruleset).catch(
    () => null,
  );
  if (dbRoster) {
    return dbRoster.specialRules.some((r) => r.slug === CAPTAIN_RULE_SLUG);
  }
  return getSpecialRulesForTeam(rosterSlug, ruleset).includes(
    CAPTAIN_RULE_SLUG,
  );
}

/** Un Gros Bras (Solitaire) ne peut pas être désigné capitaine. */
export function isBigGuyPlayer(skillsCsv: string): boolean {
  return isBigGuy({ skills: skillsCsv });
}

/**
 * Le capitaine ne peut être licencié que s'il a subi une blessure ayant
 * réduit une de ses caractéristiques. (Un joueur non-capitaine est
 * toujours licenciable.)
 */
export function canFirePlayer(player: {
  isCaptain: boolean;
  maReduction: number;
  stReduction: number;
  agReduction: number;
  paReduction: number;
  avReduction: number;
}): boolean {
  if (!player.isCaptain) return true;
  return (
    player.maReduction > 0 ||
    player.stReduction > 0 ||
    player.agReduction > 0 ||
    player.paReduction > 0 ||
    player.avReduction > 0
  );
}

function isActivePlayer(p: Pick<TeamPlayerRow, "dead" | "firedAt">): boolean {
  return !p.dead && p.firedAt === null;
}

/** L'advancement "pro" a-t-il été acheté (level-up) par ce joueur ? */
function hasProAdvancement(advancementsJson: string): boolean {
  try {
    const parsed = JSON.parse(advancementsJson || "[]");
    return (
      Array.isArray(parsed) &&
      parsed.some(
        (a) =>
          a && typeof a === "object" && (a as { skillSlug?: unknown }).skillSlug === PRO_SKILL_SLUG,
      )
    );
  } catch {
    return false;
  }
}

export interface CaptainPlayerView {
  readonly id: string;
  readonly name: string;
  readonly number: number;
  readonly position: string;
}

export interface CaptainStatus {
  readonly hasCaptainRule: boolean;
  /** Capitaine actif (vivant et non licencié), ou null. */
  readonly captain: CaptainPlayerView | null;
  /**
   * Capitaine perdu : le joueur porte encore le flag mais est mort ou
   * licencié — le coach doit désigner un successeur. Null sinon.
   */
  readonly lostCaptain: (CaptainPlayerView & {
    readonly dead: boolean;
    readonly fired: boolean;
  }) | null;
  /** Le coach peut-il désigner (ou changer, en brouillon) le capitaine ? */
  readonly canDesignate: boolean;
  /** Roster figé (équipe engagée) ou brouillon librement éditable. */
  readonly frozen: boolean;
  /** Joueurs désignables (actifs, hors Gros Bras, hors capitaine actuel). */
  readonly eligiblePlayers: readonly CaptainPlayerView[];
}

function toView(p: TeamPlayerRow): CaptainPlayerView {
  return { id: p.id, name: p.name, number: p.number, position: p.position };
}

async function loadTeamWithPlayers(teamId: string, userId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId, deletedAt: null },
    select: { id: true, roster: true, ruleset: true },
  });
  if (!team) {
    throw new CaptainError("team_not_found", "Equipe introuvable");
  }
  const players = (await prisma.teamPlayer.findMany({
    where: { teamId },
    orderBy: { number: "asc" },
    select: PLAYER_SELECT,
  })) as TeamPlayerRow[];
  return { team, players };
}

/**
 * Statut capitaine d'une équipe pour l'UI : règle présente, capitaine
 * actuel/perdu, joueurs éligibles, droit de désignation.
 */
export async function getCaptainStatus(
  teamId: string,
  userId: string,
): Promise<CaptainStatus> {
  const { team, players } = await loadTeamWithPlayers(teamId, userId);

  const hasRule = await teamHasCaptainRule(
    team.roster,
    (team.ruleset as Ruleset) ?? DEFAULT_RULESET,
  );
  if (!hasRule) {
    return {
      hasCaptainRule: false,
      captain: null,
      lostCaptain: null,
      canDesignate: false,
      frozen: false,
      eligiblePlayers: [],
    };
  }

  const frozen = await isTeamRosterFrozen(teamId);
  const flagged = players.filter((p) => p.isCaptain);
  const activeCaptain = flagged.find(isActivePlayer) ?? null;
  const lost = !activeCaptain
    ? (flagged.find((p) => !isActivePlayer(p)) ?? null)
    : null;

  // Désignation possible : pas de capitaine actif (création ou successeur
  // après mort/licenciement), OU équipe encore en brouillon (changement
  // libre tant que la liste n'est pas engagée).
  const canDesignate = !activeCaptain || !frozen;

  const eligiblePlayers = canDesignate
    ? players
        .filter(isActivePlayer)
        .filter((p) => !isBigGuyPlayer(p.skills))
        .filter((p) => p.id !== activeCaptain?.id)
        .map(toView)
    : [];

  return {
    hasCaptainRule: true,
    captain: activeCaptain ? toView(activeCaptain) : null,
    lostCaptain: lost
      ? { ...toView(lost), dead: lost.dead, fired: lost.firedAt !== null }
      : null,
    canDesignate,
    frozen,
    eligiblePlayers,
  };
}

export interface DesignateCaptainResult {
  readonly captain: CaptainPlayerView & { readonly skills: string };
  /** Pro vient d'être ajoutée à ce joueur (false si déjà connue). */
  readonly proGranted: boolean;
}

/**
 * Désigne `playerId` capitaine de l'équipe `teamId`.
 *
 * Validations : règle présente sur le roster, joueur actif (ni mort ni
 * licencié), pas un Gros Bras. Si un capitaine actif existe déjà :
 * autorisé uniquement en brouillon (équipe non engagée) — en ligue, la
 * re-désignation n'est possible que si le capitaine est mort/licencié.
 *
 * Effets : flag `isCaptain` posé (et retiré de tout autre joueur de
 * l'équipe), compétence Pro ajoutée à `skills` si absente — sans passer
 * par `advancements`, donc sans augmenter la valeur d'équipe. En
 * brouillon, l'ancien capitaine perd Pro si elle lui venait de la
 * désignation (ni compétence de base du poste, ni advancement acheté).
 */
export async function designateCaptain(
  teamId: string,
  userId: string,
  playerId: string,
): Promise<DesignateCaptainResult> {
  const { team, players } = await loadTeamWithPlayers(teamId, userId);

  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const hasRule = await teamHasCaptainRule(team.roster, ruleset);
  if (!hasRule) {
    throw new CaptainError(
      "no_captain_rule",
      `Le roster ${team.roster} ne possède pas la règle spéciale Capitaine`,
    );
  }

  const player = players.find((p) => p.id === playerId);
  if (!player) {
    throw new CaptainError("player_not_found", "Joueur introuvable");
  }
  if (!isActivePlayer(player)) {
    throw new CaptainError(
      "player_inactive",
      "Ce joueur est mort ou licencié et ne peut pas être capitaine",
    );
  }
  if (isBigGuyPlayer(player.skills)) {
    throw new CaptainError(
      "player_big_guy",
      "Un Gros Bras ne peut pas être désigné capitaine",
    );
  }

  const activeCaptain = players.find((p) => p.isCaptain && isActivePlayer(p));
  if (activeCaptain && activeCaptain.id === playerId) {
    // Idempotent : déjà capitaine.
    return {
      captain: { ...toView(player), skills: player.skills },
      proGranted: false,
    };
  }
  if (activeCaptain) {
    const frozen = await isTeamRosterFrozen(teamId);
    if (frozen) {
      throw new CaptainError(
        "captain_already_active",
        "Un capitaine est déjà désigné. Il ne peut être remplacé que s'il meurt ou est licencié.",
      );
    }
  }

  const currentSkills = parseSkillsCsv(player.skills);
  const proGranted = !currentSkills.includes(PRO_SKILL_SLUG);
  const newSkills = proGranted
    ? [...currentSkills, PRO_SKILL_SLUG].join(",")
    : player.skills;

  // Brouillon : l'ancien capitaine perd Pro si elle lui venait uniquement
  // de la désignation (pas une compétence de base du poste, pas un
  // advancement acheté).
  let demote: { id: string; skills: string } | null = null;
  if (activeCaptain) {
    const oldSkills = parseSkillsCsv(activeCaptain.skills);
    if (
      oldSkills.includes(PRO_SKILL_SLUG) &&
      !hasProAdvancement(activeCaptain.advancements)
    ) {
      const baseSkills = await getPositionBaseSkills(
        team.roster,
        ruleset,
        activeCaptain.position,
      );
      if (baseSkills !== null && !baseSkills.includes(PRO_SKILL_SLUG)) {
        demote = {
          id: activeCaptain.id,
          skills: oldSkills.filter((s) => s !== PRO_SKILL_SLUG).join(","),
        };
      }
    }
  }

  await prisma.$transaction([
    // Unicité : retire le flag de tout autre joueur (capitaine actif en
    // brouillon, ou capitaine mort/licencié dont on désigne le successeur).
    prisma.teamPlayer.updateMany({
      where: { teamId, isCaptain: true, id: { not: playerId } },
      data: { isCaptain: false },
    }),
    ...(demote
      ? [
          prisma.teamPlayer.update({
            where: { id: demote.id },
            data: { skills: demote.skills },
          }),
        ]
      : []),
    prisma.teamPlayer.update({
      where: { id: playerId },
      data: { isCaptain: true, skills: newSkills },
    }),
  ]);

  return {
    captain: { ...toView(player), skills: newSkills },
    proGranted,
  };
}

/**
 * Compétences de base du poste (CSV → array) pour le roster/ruleset, ou
 * `null` si le poste est introuvable (dans ce cas on ne retire PAS Pro —
 * choix conservateur pour ne jamais effacer une compétence légitime).
 */
async function getPositionBaseSkills(
  rosterSlug: string,
  ruleset: Ruleset,
  positionSlug: string,
): Promise<string[] | null> {
  const roster = await getRosterFromDb(rosterSlug, "fr", ruleset).catch(
    () => null,
  );
  const position = roster?.positions.find((p) => p.slug === positionSlug);
  if (!position) return null;
  return parseSkillsCsv(position.skills);
}
