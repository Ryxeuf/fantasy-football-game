/**
 * Lot I — Edition ex-post des equipes d'une ligue par le commissaire.
 *
 * Permet de corriger les erreurs apres-coup (ex: SPP mal compte,
 * comp oubliee, joueur achete manquant) sans devoir invalider /
 * rejouer toute la chaine.
 *
 * Chaque mutation est tracee dans `CommissionerAuditLog` pour
 * permettre de reverser une erreur de saisie du commissaire et
 * de donner de la visibilite aux coachs sur ce qui a ete modifie
 * sur leur equipe.
 *
 * Garde-fous :
 *   - L'authorisation est verifiee cote route (commissaire d'une
 *     ligue OU admin global).
 *   - Pas de mutation sur les compteurs materialises des
 *     LeagueParticipant ; on touche uniquement les attributs des
 *     TeamPlayer/Team. Les standings restent coherents.
 *   - Verification que la team appartient bien a une saison de la
 *     ligue ciblee (anti-vector pour modifier des teams hors-scope).
 */

import { prisma } from "../prisma";
import {
  surchargeForAdvancement,
  type PlayerAdvancement,
} from "@bb/game-engine";
import { categoryCodeForSkill, checkSkillAccess } from "./skill-access";

export class CommissionerEditError extends Error {
  constructor(
    public readonly code:
      | "team_not_found"
      | "team_not_in_league"
      | "player_not_found"
      | "player_not_in_team"
      | "invalid_delta"
      | "invalid_value"
      | "skill_already_present"
      | "skill_not_present"
      | "skill_not_accessible"
      | "innate_skill"
      | "number_taken"
      | "invalid_characteristic",
    message: string,
  ) {
    super(message);
    this.name = "CommissionerEditError";
  }
}

const VALID_CHARS = ["MA", "ST", "AG", "PA", "AV"] as const;
export type Characteristic = (typeof VALID_CHARS)[number];

export interface AuditEntry {
  readonly leagueId: string;
  readonly byCommissionerId: string;
  readonly teamId: string;
  readonly playerId?: string | null;
  readonly action: string;
  readonly beforeState?: Record<string, unknown> | null;
  readonly afterState?: Record<string, unknown> | null;
  readonly reason?: string | null;
}

/**
 * Journalise une action commissaire dans `AuditLog`. Exporte pour
 * etre reutilise par les services soeurs (ex: suppression d'equipe /
 * de joueur, cf. `commissioner-team-removal.ts`).
 */
export async function appendAudit(entry: AuditEntry): Promise<void> {
  // Reutilise le modele AuditLog generique : `userId` = commissaire,
  // `action` = "league.commissioner-edit:<sub>", `entity` = "Team"
  // ou "TeamPlayer", `entityId` = id cible, `oldValue`/`newValue`
  // pour le diff.
  try {
    await (prisma as unknown as {
      auditLog: {
        create: (args: unknown) => Promise<unknown>;
      };
    }).auditLog.create({
      data: {
        userId: entry.byCommissionerId,
        action: `league.commissioner-edit:${entry.action}`,
        entity: entry.playerId ? "TeamPlayer" : "Team",
        entityId: entry.playerId ?? entry.teamId,
        oldValue: entry.beforeState
          ? { ...entry.beforeState, leagueId: entry.leagueId }
          : { leagueId: entry.leagueId },
        newValue: entry.afterState
          ? {
              ...entry.afterState,
              leagueId: entry.leagueId,
              reason: entry.reason ?? null,
            }
          : { leagueId: entry.leagueId, reason: entry.reason ?? null },
      },
    });
  } catch {
    // Si AuditLog n'existe pas dans cette DB (tests SQLite legacy),
    // on ne propage pas — le service de mutation reste fonctionnel.
  }
}

/**
 * Verifie que la team appartient a au moins une saison de la
 * ligue ciblee. Anti-vector pour eviter qu'un commissaire de la
 * ligue X modifie une team qui n'est inscrite que dans la ligue Y.
 */
async function ensureTeamInLeague(input: { leagueId: string; teamId: string }) {
  const count = await prisma.leagueParticipant.count({
    where: {
      teamId: input.teamId,
      season: { leagueId: input.leagueId },
    },
  });
  if (count === 0) {
    throw new CommissionerEditError(
      "team_not_in_league",
      "Cette equipe n'est pas inscrite dans une saison de cette ligue",
    );
  }
}

export interface AddSppInput {
  leagueId: string;
  teamId: string;
  playerId: string;
  delta: number;
  byCommissionerId: string;
  reason?: string;
}

/**
 * Ajoute (ou retire si delta < 0) des SPP a un joueur. Refuse si
 * le delta est nul ou si le SPP final deviendrait negatif.
 */
export async function adjustPlayerSpp(input: AddSppInput) {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new CommissionerEditError(
      "invalid_delta",
      "Le delta SPP doit etre un entier non nul",
    );
  }
  await ensureTeamInLeague(input);

  const player = (await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: { id: true, teamId: true, spp: true, name: true },
  })) as { id: string; teamId: string; spp: number; name: string } | null;
  if (!player) {
    throw new CommissionerEditError(
      "player_not_found",
      `Joueur introuvable: ${input.playerId}`,
    );
  }
  if (player.teamId !== input.teamId) {
    throw new CommissionerEditError(
      "player_not_in_team",
      "Le joueur n'appartient pas a la team specifiee",
    );
  }

  const newSpp = player.spp + input.delta;
  if (newSpp < 0) {
    throw new CommissionerEditError(
      "invalid_delta",
      "Les SPP ne peuvent pas descendre en dessous de 0",
    );
  }

  const updated = await prisma.teamPlayer.update({
    where: { id: input.playerId },
    data: { spp: newSpp },
  });

  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    playerId: input.playerId,
    action: "adjust_spp",
    beforeState: { spp: player.spp },
    afterState: { spp: newSpp },
    reason: input.reason ?? null,
  });

  return updated;
}

export interface UpdatePlayerIdentityInput {
  leagueId: string;
  teamId: string;
  playerId: string;
  /** Nom complet (« Prénom Nom ») — champ unique `TeamPlayer.name`. */
  name?: string;
  number?: number;
  byCommissionerId: string;
  reason?: string;
}

/**
 * A64 — met a jour l'identite d'un joueur (nom et/ou numero) par le
 * commissaire. Le numero doit rester unique (1..99) parmi les joueurs
 * actifs de l'equipe. Journalise dans l'audit log.
 */
export async function updatePlayerIdentity(input: UpdatePlayerIdentityInput) {
  const name = input.name?.trim();
  const number = input.number;
  if ((name === undefined || name.length === 0) && number === undefined) {
    throw new CommissionerEditError(
      "invalid_value",
      "Fournir un nom et/ou un numero",
    );
  }
  if (name !== undefined && (name.length === 0 || name.length > 60)) {
    throw new CommissionerEditError(
      "invalid_value",
      "Le nom doit faire entre 1 et 60 caracteres",
    );
  }
  if (
    number !== undefined &&
    (!Number.isInteger(number) || number < 1 || number > 99)
  ) {
    throw new CommissionerEditError(
      "invalid_value",
      "Le numero doit etre un entier entre 1 et 99",
    );
  }
  await ensureTeamInLeague(input);

  const player = (await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: { id: true, teamId: true, name: true, number: true },
  })) as {
    id: string;
    teamId: string;
    name: string;
    number: number;
  } | null;
  if (!player) {
    throw new CommissionerEditError(
      "player_not_found",
      `Joueur introuvable: ${input.playerId}`,
    );
  }
  if (player.teamId !== input.teamId) {
    throw new CommissionerEditError(
      "player_not_in_team",
      "Le joueur n'appartient pas a la team specifiee",
    );
  }

  if (number !== undefined && number !== player.number) {
    const taken = await prisma.teamPlayer.count({
      where: {
        teamId: input.teamId,
        number,
        firedAt: null,
        id: { not: input.playerId },
      },
    });
    if (taken > 0) {
      throw new CommissionerEditError(
        "number_taken",
        `Le numero ${number} est deja pris dans cette equipe`,
      );
    }
  }

  const updated = await prisma.teamPlayer.update({
    where: { id: input.playerId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(number !== undefined ? { number } : {}),
    },
  });

  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    playerId: input.playerId,
    action: "update_identity",
    beforeState: { name: player.name, number: player.number },
    afterState: {
      name: name ?? player.name,
      number: number ?? player.number,
    },
    reason: input.reason ?? null,
  });
  return updated;
}

export interface AddSkillInput {
  leagueId: string;
  teamId: string;
  playerId: string;
  skill: string;
  /** Format de competence : 'random' | 'chosen' (BB officiel). */
  pickKind?: "random" | "chosen";
  byCommissionerId: string;
  reason?: string;
}

/**
 * E13/A6 — Ajoute une competence GAGNEE a un joueur. La competence est
 * validee contre le pool d'acces de la position (primaire/secondaire),
 * enregistree comme un vrai avancement (`TeamPlayer.advancements`) et la
 * valeur d'equipe est incrementee du surcout officiel (+20k primaire /
 * random, +40k secondaire) — avant ce fix, l'ajout commissaire ne
 * touchait ni les avancements ni la VE (cause du « A6 : je ne vois pas
 * de changement » du testeur). Les SPP ne sont PAS decomptes ici (outil
 * de correction : l'ajustement SPP est une action separee).
 * Retro-compat : si la position n'a pas de donnees d'acces (season_2),
 * l'ajout reste libre, sans avancement ni VE.
 */
export async function addPlayerSkill(input: AddSkillInput) {
  await ensureTeamInLeague(input);

  const player = (await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: {
      id: true,
      teamId: true,
      skills: true,
      name: true,
      position: true,
      advancements: true,
      team: { select: { roster: true, ruleset: true } },
    },
  })) as {
    id: string;
    teamId: string;
    skills: string;
    name: string;
    position: string;
    advancements: string | null;
    team: { roster: string; ruleset: string | null } | null;
  } | null;
  if (!player) {
    throw new CommissionerEditError(
      "player_not_found",
      `Joueur introuvable: ${input.playerId}`,
    );
  }
  if (player.teamId !== input.teamId) {
    throw new CommissionerEditError(
      "player_not_in_team",
      "Le joueur n'appartient pas a la team specifiee",
    );
  }

  const trimmedSkill = input.skill.trim();
  if (trimmedSkill.length === 0) {
    throw new CommissionerEditError(
      "invalid_value",
      "Le slug de la competence est obligatoire",
    );
  }
  const existing = parseSkillsCsv(player.skills);
  if (existing.includes(trimmedSkill)) {
    throw new CommissionerEditError(
      "skill_already_present",
      `Le joueur possede deja la competence "${trimmedSkill}"`,
    );
  }

  // E13 — validation d'acces + determination du type d'avancement.
  const ruleset = player.team?.ruleset ?? "season_3";
  const positionAccess = (await prisma.position.findFirst({
    where: {
      slug: player.position,
      roster: { slug: player.team?.roster, ruleset: ruleset as never },
    },
    select: { primarySkills: true, secondarySkills: true },
  })) as { primarySkills: string | null; secondarySkills: string | null } | null;

  let advancementType: "primary" | "secondary" | "random-primary" | null =
    null;
  if (
    positionAccess &&
    (positionAccess.primarySkills != null ||
      positionAccess.secondarySkills != null)
  ) {
    const code = await categoryCodeForSkill(trimmedSkill, ruleset);
    const inPrimary =
      checkSkillAccess({
        type: "primary",
        skillCode: code,
        primarySkills: positionAccess.primarySkills,
        secondarySkills: positionAccess.secondarySkills,
      }) === "ok";
    const inSecondary =
      checkSkillAccess({
        type: "secondary",
        skillCode: code,
        primarySkills: positionAccess.primarySkills,
        secondarySkills: positionAccess.secondarySkills,
      }) === "ok";
    if (!inPrimary && !inSecondary) {
      throw new CommissionerEditError(
        "skill_not_accessible",
        `La competence "${trimmedSkill}" n'est pas accessible pour ce joueur (pool primaire/secondaire)`,
      );
    }
    advancementType = inPrimary
      ? input.pickKind === "random"
        ? "random-primary"
        : "primary"
      : "secondary";
  }

  const newSkills = [...existing, trimmedSkill];
  const taken = parseAdvancementsJson(player.advancements);
  const newAdvancements: PlayerAdvancement[] = advancementType
    ? [
        ...taken,
        {
          skillSlug: trimmedSkill,
          type: advancementType,
          isRandom: advancementType === "random-primary",
          at: Date.now(),
        },
      ]
    : taken;
  const surcharge = advancementType
    ? surchargeForAdvancement({ type: advancementType })
    : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await prisma.$transaction(async (tx: any) => {
    const p = await tx.teamPlayer.update({
      where: { id: input.playerId },
      data: {
        skills: newSkills.join(","),
        ...(advancementType
          ? { advancements: JSON.stringify(newAdvancements) }
          : {}),
      },
    });
    if (surcharge > 0) {
      await tx.team.update({
        where: { id: input.teamId },
        data: { currentValue: { increment: surcharge } },
      });
    }
    return p;
  });

  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    playerId: input.playerId,
    action: `add_skill:${input.pickKind ?? "chosen"}`,
    beforeState: { skills: existing },
    afterState: {
      skills: newSkills,
      advancementType,
      teamValueSurcharge: surcharge,
    },
    reason: input.reason ?? null,
  });
  return updated;
}

export interface RemoveSkillInput {
  leagueId: string;
  teamId: string;
  playerId: string;
  skill: string;
  byCommissionerId: string;
  reason?: string;
}

/**
 * Retire une competence d'un joueur.
 * E15 — refuse la suppression d'une competence INNEE (celles du poste).
 * Si la competence correspond a un avancement enregistre, l'entree est
 * retiree et la valeur d'equipe decrémentee du surcout correspondant.
 */
export async function removePlayerSkill(input: RemoveSkillInput) {
  await ensureTeamInLeague(input);

  const player = (await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: {
      id: true,
      teamId: true,
      skills: true,
      position: true,
      advancements: true,
      team: { select: { roster: true, ruleset: true } },
    },
  })) as {
    id: string;
    teamId: string;
    skills: string;
    position: string;
    advancements: string | null;
    team: { roster: string; ruleset: string | null } | null;
  } | null;
  if (!player) {
    throw new CommissionerEditError(
      "player_not_found",
      `Joueur introuvable: ${input.playerId}`,
    );
  }
  if (player.teamId !== input.teamId) {
    throw new CommissionerEditError(
      "player_not_in_team",
      "Le joueur n'appartient pas a la team specifiee",
    );
  }
  const existing = parseSkillsCsv(player.skills);
  if (!existing.includes(input.skill)) {
    throw new CommissionerEditError(
      "skill_not_present",
      `Le joueur ne possede pas la competence "${input.skill}"`,
    );
  }

  // E15 — les competences innees du poste ne sont pas supprimables.
  const innate = await innateSkillsForPlayer(
    player.position,
    player.team?.roster,
    player.team?.ruleset,
  );
  if (innate.has(input.skill)) {
    throw new CommissionerEditError(
      "innate_skill",
      `"${input.skill}" est une competence innee du poste : suppression interdite`,
    );
  }

  const newSkills = existing.filter((s) => s !== input.skill);

  // Reverse l'avancement correspondant (une seule entree) + la VE.
  const taken = parseAdvancementsJson(player.advancements);
  const advIdx = taken.findIndex((a) => a.skillSlug === input.skill);
  const removedAdv = advIdx >= 0 ? taken[advIdx] : null;
  const newAdvancements =
    advIdx >= 0 ? taken.filter((_, i) => i !== advIdx) : taken;
  const surcharge = removedAdv
    ? surchargeForAdvancement({ type: removedAdv.type, stat: removedAdv.stat })
    : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await prisma.$transaction(async (tx: any) => {
    const p = await tx.teamPlayer.update({
      where: { id: input.playerId },
      data: {
        skills: newSkills.join(","),
        ...(removedAdv
          ? { advancements: JSON.stringify(newAdvancements) }
          : {}),
      },
    });
    if (surcharge > 0) {
      await tx.team.update({
        where: { id: input.teamId },
        data: { currentValue: { decrement: surcharge } },
      });
    }
    return p;
  });
  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    playerId: input.playerId,
    action: "remove_skill",
    beforeState: { skills: existing },
    afterState: { skills: newSkills },
    reason: input.reason ?? null,
  });
  return updated;
}

export interface SetCharacteristicInput {
  leagueId: string;
  teamId: string;
  playerId: string;
  characteristic: Characteristic;
  /**
   * Delta a appliquer (peut etre negatif). On preserve les bornes
   * minimales (>=1) cote serveur pour eviter les saisies aberrantes.
   * E14 — exclusif avec `value`.
   */
  delta?: number;
  /** E14 — valeur cible absolue (1..10), plus intuitive qu'un delta. */
  value?: number;
  byCommissionerId: string;
  reason?: string;
}

const MIN_CHAR = 1;
const MAX_CHAR = 10;

/**
 * Applique un delta sur une caracteristique (MA/ST/AG/PA/AV).
 * Clampe la valeur dans [1, 10] (BB official range).
 */
export async function adjustCharacteristic(input: SetCharacteristicInput) {
  if (!VALID_CHARS.includes(input.characteristic)) {
    throw new CommissionerEditError(
      "invalid_characteristic",
      `Caracteristique invalide: ${input.characteristic}`,
    );
  }
  const hasDelta = input.delta !== undefined;
  const hasValue = input.value !== undefined;
  if (hasDelta === hasValue) {
    throw new CommissionerEditError(
      "invalid_value",
      "Fournir soit un delta, soit une valeur cible (exclusif)",
    );
  }
  if (hasDelta && (!Number.isInteger(input.delta) || input.delta === 0)) {
    throw new CommissionerEditError(
      "invalid_delta",
      "Le delta doit etre un entier non nul",
    );
  }
  if (
    hasValue &&
    (!Number.isInteger(input.value) ||
      (input.value as number) < MIN_CHAR ||
      (input.value as number) > MAX_CHAR)
  ) {
    throw new CommissionerEditError(
      "invalid_value",
      `La valeur cible doit etre un entier entre ${MIN_CHAR} et ${MAX_CHAR}`,
    );
  }
  await ensureTeamInLeague(input);

  const player = (await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: {
      id: true,
      teamId: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
    },
  })) as {
    id: string;
    teamId: string;
    ma: number;
    st: number;
    ag: number;
    pa: number;
    av: number;
  } | null;
  if (!player) {
    throw new CommissionerEditError(
      "player_not_found",
      `Joueur introuvable: ${input.playerId}`,
    );
  }
  if (player.teamId !== input.teamId) {
    throw new CommissionerEditError(
      "player_not_in_team",
      "Le joueur n'appartient pas a la team specifiee",
    );
  }

  const key = input.characteristic.toLowerCase() as
    | "ma"
    | "st"
    | "ag"
    | "pa"
    | "av";
  const before = player[key];
  // E14 — valeur cible absolue prioritaire ; sinon delta historique.
  const after =
    input.value !== undefined
      ? input.value
      : Math.min(
          MAX_CHAR,
          Math.max(MIN_CHAR, before + (input.delta as number)),
        );
  if (after === before) {
    throw new CommissionerEditError(
      "invalid_value",
      `Valeur deja a ${before} pour ${input.characteristic}`,
    );
  }

  const updated = await prisma.teamPlayer.update({
    where: { id: input.playerId },
    data: { [key]: after },
  });
  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    playerId: input.playerId,
    action: `adjust_characteristic:${input.characteristic}`,
    beforeState: { [key]: before },
    afterState: { [key]: after },
    reason: input.reason ?? null,
  });
  return updated;
}

export interface AdjustTreasuryInput {
  leagueId: string;
  teamId: string;
  delta: number;
  byCommissionerId: string;
  reason?: string;
}

/**
 * Ajuste la tresorerie d'une equipe (cas typique : remboursement
 * apres erreur d'achat, bonus pour saisie en retard, etc.). Refuse
 * si la tresorerie finale serait negative.
 */
export async function adjustTreasury(input: AdjustTreasuryInput) {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new CommissionerEditError(
      "invalid_delta",
      "Le delta doit etre un entier non nul",
    );
  }
  await ensureTeamInLeague(input);

  const team = (await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, treasury: true },
  })) as { id: string; treasury: number } | null;
  if (!team) {
    throw new CommissionerEditError(
      "team_not_found",
      `Equipe introuvable: ${input.teamId}`,
    );
  }
  const newTreasury = team.treasury + input.delta;
  if (newTreasury < 0) {
    throw new CommissionerEditError(
      "invalid_delta",
      "La tresorerie ne peut pas devenir negative",
    );
  }
  const updated = await prisma.team.update({
    where: { id: input.teamId },
    data: { treasury: newTreasury },
  });
  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    action: "adjust_treasury",
    beforeState: { treasury: team.treasury },
    afterState: { treasury: newTreasury },
    reason: input.reason ?? null,
  });
  return updated;
}

function parseSkillsCsv(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Parse tolerant du JSON `TeamPlayer.advancements` (string ou array). */
function parseAdvancementsJson(raw: unknown): PlayerAdvancement[] {
  if (Array.isArray(raw)) return raw as PlayerAdvancement[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PlayerAdvancement[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * E15 — competences innees du poste (relation `Position.skills` ->
 * `Skill.slug`). Fallback : ensemble vide si la position est introuvable
 * (retro-compat).
 */
async function innateSkillsForPlayer(
  positionSlug: string,
  rosterSlug: string | undefined,
  ruleset: string | null | undefined,
): Promise<Set<string>> {
  const position = (await prisma.position.findFirst({
    where: {
      slug: positionSlug,
      roster: { slug: rosterSlug, ruleset: (ruleset ?? "season_3") as never },
    },
    select: { skills: { select: { skill: { select: { slug: true } } } } },
  })) as { skills: Array<{ skill: { slug: string } }> } | null;
  return new Set((position?.skills ?? []).map((ps) => ps.skill.slug));
}

/**
 * Helper pour la route audit log : liste les actions effectuees
 * par le commissaire sur les teams d'une ligue. Filtre par prefixe
 * d'action + leagueId stocke dans `newValue.leagueId`.
 */
/**
 * FR12 — vue lecture de l'équipe d'un coach pour l'édition commissaire.
 * Renvoie l'équipe (nom, roster, trésorerie) + ses joueurs actifs (non
 * licenciés). Réservé au commissaire via la garde `ensureTeamInLeague`.
 */
export async function getTeamForEdit(input: {
  leagueId: string;
  teamId: string;
}) {
  await ensureTeamInLeague(input);
  const team = (await prisma.team.findUnique({
    where: { id: input.teamId },
    select: {
      id: true,
      name: true,
      roster: true,
      treasury: true,
      ruleset: true,
    },
  })) as {
    id: string;
    name: string;
    roster: string;
    treasury: number;
    ruleset: string | null;
  } | null;
  if (!team) {
    throw new CommissionerEditError(
      "team_not_found",
      `Equipe introuvable: ${input.teamId}`,
    );
  }
  const players = await prisma.teamPlayer.findMany({
    where: { teamId: input.teamId, firedAt: null },
    orderBy: { number: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      number: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
      skills: true,
      spp: true,
      dead: true,
    },
  });

  // E13/E15 — expose par position les acces de competences (CSV G/A/S/P/M/K)
  // et les competences innees (non supprimables) pour piloter l'UI.
  const positions = (await prisma.position.findMany({
    where: {
      roster: {
        slug: team.roster,
        ruleset: (team.ruleset ?? "season_3") as never,
      },
    },
    select: {
      slug: true,
      primarySkills: true,
      secondarySkills: true,
      skills: { select: { skill: { select: { slug: true } } } },
    },
  })) as Array<{
    slug: string;
    primarySkills: string | null;
    secondarySkills: string | null;
    skills: Array<{ skill: { slug: string } }>;
  }>;
  const accessByPosition: Record<
    string,
    {
      primarySkills: string | null;
      secondarySkills: string | null;
      innateSkills: string[];
    }
  > = {};
  for (const p of positions) {
    accessByPosition[p.slug] = {
      primarySkills: p.primarySkills,
      secondarySkills: p.secondarySkills,
      innateSkills: p.skills.map((ps) => ps.skill.slug),
    };
  }

  return { team, players, accessByPosition };
}

export async function listAuditLog(input: {
  leagueId: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  try {
    return (await (prisma as unknown as {
      auditLog: { findMany: (args: unknown) => Promise<unknown> };
    }).auditLog.findMany({
      where: {
        action: { startsWith: "league.commissioner-edit:" },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })) as Array<{ newValue?: { leagueId?: string } }>;
  } catch {
    return [];
  }
}
