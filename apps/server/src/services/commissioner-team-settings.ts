/**
 * Reglages d'equipe editables par le commissaire de ligue : STAFF
 * (relances, cheerleaders, assistants, apothicaire, fans devoues) et
 * LIGUE REGIONALE.
 *
 * Complement de `commissioner-team-edit.ts`, qui ne couvrait que la
 * tresorerie et les joueurs. Un commissaire qui corrige une equipe apres
 * coup avait donc besoin du coach pour tout ce qui n'est pas un joueur :
 * une relance oubliee au build ou une Ligue regionale choisie par erreur
 * (immuable cote coach, cf. `team-regional-league.ts`) n'etaient pas
 * rattrapables.
 *
 * Garde-fous, identiques au module frere :
 *   - l'autorisation (commissaire de la ligue) est verifiee cote route ;
 *   - `ensureTeamInLeague` refuse une equipe hors du perimetre de la ligue ;
 *   - chaque mutation est journalisee dans `AuditLog` via `appendAudit`.
 *
 * Le staff est borne par la config REELLE du roster x format
 * (`RosterStaffConfig`, editable en admin) : les memes plafonds que ceux
 * opposes au coach sur `PUT /team/:id/info`. Le debit de tresorerie est
 * OPTIONNEL (`chargeTreasury`) : une correction de saisie ne doit pas
 * facturer une relance que le coach avait deja payee.
 */

import { prisma } from "../prisma";
import {
  allowsRegionalLeagueChoice,
  defaultStaffConfig,
  DEFAULT_RULESET,
  getRegionalLeagueBySlug,
  getRegionalLeagueOptions,
  getTournamentRuleset,
  favouredOfLabel,
  isFavouredOfSlug,
  isGameFormat,
  resolveTeamRegionalRules,
  type GameFormat,
  type RosterStaffConfig,
  type Ruleset,
} from "@bb/game-engine";
import { appendAudit, ensureTeamInLeague } from "./commissioner-team-edit";
import { effectiveRegionalRules } from "./roster-regional-rules";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import { updateTeamValues } from "../utils/team-values";
import {
  captureTeamState,
  type TeamAuditPrismaLike,
} from "./team-audit";
import { serverLog } from "../utils/server-log";

export class CommissionerSettingsError extends Error {
  constructor(
    public readonly code:
      | "team_not_found"
      | "no_change"
      | "staff_out_of_bounds"
      | "apothecary_not_allowed"
      | "insufficient_treasury"
      | "regional_choice_unavailable"
      | "invalid_regional_league",
    message: string,
  ) {
    super(message);
    this.name = "CommissionerSettingsError";
  }
}

/** Staff d'une equipe, tel que stocke sur `Team`. */
export interface TeamStaff {
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
}

const STAFF_KEYS = [
  "rerolls",
  "cheerleaders",
  "assistants",
  "apothecary",
  "dedicatedFans",
] as const;

/**
 * Cout (po) du passage de `before` a `after`. Positif = l'equipe achete,
 * negatif = elle revend (remboursement au meme prix, choix assume : le
 * commissaire corrige une saisie, il ne fait pas commerce).
 *
 * 100 % pur — teste sans Prisma.
 */
export function staffCostDelta(
  before: TeamStaff,
  after: TeamStaff,
  config: RosterStaffConfig,
): number {
  const apothecaryDelta =
    (after.apothecary ? 1 : 0) - (before.apothecary ? 1 : 0);
  return (
    (after.rerolls - before.rerolls) * config.rerollCost +
    (after.cheerleaders - before.cheerleaders) * config.cheerleaderCost +
    (after.assistants - before.assistants) * config.assistantCost +
    (after.dedicatedFans - before.dedicatedFans) * config.dedicatedFanCost +
    apothecaryDelta * config.apothecaryCost
  );
}

/**
 * Verifie le staff demande contre les plafonds resolus. Retourne le message
 * d'erreur a remonter, ou `null` si tout est legal. Pur.
 */
export function validateStaff(
  staff: TeamStaff,
  config: RosterStaffConfig,
): { code: "staff_out_of_bounds" | "apothecary_not_allowed"; message: string } | null {
  const caps: ReadonlyArray<{
    value: number;
    min: number;
    max: number;
    label: string;
  }> = [
    { value: staff.rerolls, min: 0, max: config.maxRerolls, label: "relances" },
    {
      value: staff.cheerleaders,
      min: 0,
      max: config.maxCheerleaders,
      label: "cheerleaders",
    },
    {
      value: staff.assistants,
      min: 0,
      max: config.maxAssistants,
      label: "assistants",
    },
    {
      value: staff.dedicatedFans,
      min: 1,
      max: config.maxDedicatedFans,
      label: "fans dévoués",
    },
  ];
  for (const cap of caps) {
    if (!Number.isInteger(cap.value) || cap.value < cap.min || cap.value > cap.max) {
      return {
        code: "staff_out_of_bounds",
        message: `Le nombre de ${cap.label} doit être entre ${cap.min} et ${cap.max} pour cette équipe`,
      };
    }
  }
  if (staff.apothecary && !config.apothecaryAllowed) {
    return {
      code: "apothecary_not_allowed",
      message: "Cette équipe n'a pas droit à l'apothicaire",
    };
  }
  return null;
}

interface TeamRow {
  id: string;
  name: string;
  roster: string;
  ruleset: string | null;
  format: string | null;
  tournamentRuleset: string | null;
  regionalLeague: string | null;
  treasury: number;
  teamValue: number;
  currentValue: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
}

const TEAM_SELECT = {
  id: true,
  name: true,
  roster: true,
  ruleset: true,
  format: true,
  tournamentRuleset: true,
  regionalLeague: true,
  treasury: true,
  teamValue: true,
  currentValue: true,
  rerolls: true,
  cheerleaders: true,
  assistants: true,
  apothecary: true,
  dedicatedFans: true,
} as const;

async function loadTeam(teamId: string): Promise<TeamRow> {
  const team = (await prisma.team.findUnique({
    where: { id: teamId },
    select: TEAM_SELECT,
  })) as TeamRow | null;
  if (!team) {
    throw new CommissionerSettingsError(
      "team_not_found",
      `Équipe introuvable: ${teamId}`,
    );
  }
  return team;
}

function staffOf(team: TeamRow): TeamStaff {
  return {
    rerolls: team.rerolls,
    cheerleaders: team.cheerleaders,
    assistants: team.assistants,
    apothecary: team.apothecary,
    dedicatedFans: team.dedicatedFans,
  };
}

async function resolveStaffConfig(team: TeamRow): Promise<RosterStaffConfig> {
  const format: GameFormat = isGameFormat(team.format ?? "") 
    ? (team.format as GameFormat)
    : "bb11";
  try {
    return await resolveStaffConfigBySlug(
      team.roster,
      (team.ruleset ?? DEFAULT_RULESET) as Ruleset,
      format,
    );
  } catch {
    // Table absente (mirroir sqlite de test) : defaut du moteur.
    return defaultStaffConfig(team.roster, format);
  }
}

/** Ligues declarees par le roster (colonne editable, repli catalogue). */
async function declaredRegionalRules(team: TeamRow): Promise<string[]> {
  const ruleset = (team.ruleset ?? DEFAULT_RULESET) as Ruleset;
  let raw: unknown = null;
  try {
    const row = (await prisma.roster.findFirst({
      where: { slug: team.roster, ruleset: ruleset as never },
      select: { regionalRules: true },
    })) as { regionalRules: unknown } | null;
    raw = row?.regionalRules ?? null;
  } catch {
    // Roster introuvable / modele absent : repli sur le catalogue moteur.
  }
  return effectiveRegionalRules(raw, team.roster, ruleset).rules;
}

export interface RegionalLeagueOptionView {
  readonly slug: string;
  readonly label: string;
  readonly description: string | null;
  /** Alignements (« Favori de… ») apportes par ce choix, en clair. */
  readonly grants: readonly string[];
}

export interface TeamSettingsView {
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly roster: string;
    readonly ruleset: string;
    readonly format: string;
    readonly treasury: number;
    readonly teamValue: number;
    readonly currentValue: number;
    readonly tournamentRuleset: string | null;
    readonly tournamentRulesetLabel: string | null;
  };
  readonly staff: TeamStaff;
  readonly staffConfig: RosterStaffConfig;
  readonly regionalLeague: {
    readonly current: string | null;
    readonly currentLabel: string | null;
    /** `false` quand un règlement de tournoi neutralise l'axe régional. */
    readonly applicable: boolean;
    readonly options: readonly RegionalLeagueOptionView[];
  };
  /** Star Players deja recrutes (impactes par un changement de Ligue). */
  readonly starPlayers: readonly string[];
}

/**
 * Libelle en clair d'un alignement apporte par une Ligue. Les slugs
 * « favoured_of_* » ont un libelle FR dans le moteur ; les autres sont
 * rendus tels quels plutot que d'inventer une traduction.
 */
function grantLabel(slug: string): string {
  return isFavouredOfSlug(slug) ? favouredOfLabel(slug) : slug;
}

/** Star Players recrutes par l'equipe (best-effort : liste vide si modele absent). */
async function hiredStarPlayerSlugs(teamId: string): Promise<string[]> {
  try {
    const rows = (await prisma.teamStarPlayer.findMany({
      where: { teamId },
      select: { starPlayerSlug: true },
    })) as Array<{ starPlayerSlug: string }>;
    return rows.map((r) => r.starPlayerSlug);
  } catch {
    return [];
  }
}

/**
 * Etat complet des reglages d'equipe : valeurs courantes, plafonds et
 * couts du staff, Ligue regionale courante et choix ouverts.
 */
export async function getTeamSettings(input: {
  leagueId: string;
  teamId: string;
}): Promise<TeamSettingsView> {
  await ensureTeamInLeague(input);
  const team = await loadTeam(input.teamId);
  const ruleset = (team.ruleset ?? DEFAULT_RULESET) as Ruleset;
  const pack = getTournamentRuleset(team.tournamentRuleset);
  const [staffConfig, declared, starPlayers] = await Promise.all([
    resolveStaffConfig(team),
    declaredRegionalRules(team),
    hiredStarPlayerSlugs(team.id),
  ]);

  const applicable = allowsRegionalLeagueChoice(pack);
  const options = applicable
    ? getRegionalLeagueOptions(team.roster, ruleset, declared).map((o) => ({
        slug: o.slug,
        label: getRegionalLeagueBySlug(o.slug)?.nameFr ?? o.slug,
        description: getRegionalLeagueBySlug(o.slug)?.description ?? null,
        grants: o.grants.map(grantLabel),
      }))
    : [];

  return {
    team: {
      id: team.id,
      name: team.name,
      roster: team.roster,
      ruleset,
      format: team.format ?? "bb11",
      treasury: team.treasury,
      teamValue: team.teamValue,
      currentValue: team.currentValue,
      tournamentRuleset: team.tournamentRuleset,
      tournamentRulesetLabel: pack?.shortLabel ?? null,
    },
    staff: staffOf(team),
    staffConfig,
    regionalLeague: {
      current: team.regionalLeague,
      currentLabel: team.regionalLeague
        ? (getRegionalLeagueBySlug(team.regionalLeague)?.nameFr ??
          team.regionalLeague)
        : null,
      applicable,
      options,
    },
    starPlayers,
  };
}

export interface UpdateStaffInput {
  readonly leagueId: string;
  readonly teamId: string;
  readonly staff: Partial<TeamStaff>;
  /** Debiter/crediter la tresorerie du differentiel de cout. */
  readonly chargeTreasury?: boolean;
  readonly byCommissionerId: string;
  readonly reason?: string;
}

export interface UpdateStaffResult {
  readonly staff: TeamStaff;
  readonly treasury: number;
  readonly teamValue: number;
  readonly currentValue: number;
  /** Cout applique a la tresorerie (0 si `chargeTreasury` est faux). */
  readonly charged: number;
  /** Cout theorique du differentiel, meme non facture. */
  readonly cost: number;
}

/**
 * Met a jour le staff d'une equipe. Les champs absents du body restent
 * inchanges. Recalcule VE/VEA (le staff compte dans la valeur d'equipe).
 */
export async function updateTeamStaff(
  input: UpdateStaffInput,
): Promise<UpdateStaffResult> {
  await ensureTeamInLeague(input);
  const team = await loadTeam(input.teamId);
  const before = staffOf(team);
  const after: TeamStaff = { ...before, ...input.staff };

  if (STAFF_KEYS.every((k) => before[k] === after[k])) {
    throw new CommissionerSettingsError(
      "no_change",
      "Aucun changement de staff demandé",
    );
  }

  const config = await resolveStaffConfig(team);
  const invalid = validateStaff(after, config);
  if (invalid) {
    throw new CommissionerSettingsError(invalid.code, invalid.message);
  }

  const cost = staffCostDelta(before, after, config);
  const charged = input.chargeTreasury ? cost : 0;
  const treasury = team.treasury - charged;
  if (treasury < 0) {
    throw new CommissionerSettingsError(
      "insufficient_treasury",
      `Trésorerie insuffisante : ${(cost / 1000).toLocaleString("fr-FR")} k po nécessaires, ${(team.treasury / 1000).toLocaleString("fr-FR")} k po disponibles`,
    );
  }

  const beforeSnapshot = await captureTeamState(
    prisma as unknown as TeamAuditPrismaLike,
    input.teamId,
  );
  await prisma.team.update({
    where: { id: input.teamId },
    data: { ...after, treasury },
  });

  let values = { teamValue: team.teamValue, currentValue: team.currentValue };
  try {
    values = await updateTeamValues(prisma, input.teamId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(`[commissioner-settings] recalcul VE/VEA échoué: ${msg}`);
  }

  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    beforeSnapshot,
    action: "update_staff",
    beforeState: { ...before, treasury: team.treasury },
    afterState: { ...after, treasury, charged },
    reason: input.reason ?? null,
  });

  return { staff: after, treasury, charged, cost, ...values };
}

export interface UpdateRegionalLeagueInput {
  readonly leagueId: string;
  readonly teamId: string;
  /** Slug de Ligue, ou `null` pour repasser en « aucun choix enregistré ». */
  readonly regionalLeague: string | null;
  readonly byCommissionerId: string;
  readonly reason?: string;
}

export interface UpdateRegionalLeagueResult {
  readonly regionalLeague: string | null;
  readonly label: string | null;
  /** Star Players recrutes qui ne sont plus eligibles apres le changement. */
  readonly orphanedStarPlayers: readonly string[];
}

/**
 * Change la Ligue regionale d'une equipe. Immuable pour le coach (elle
 * conditionne des recrutements deja faits), elle reste corrigeable par le
 * commissaire — avec un avertissement sur les Star Players devenus
 * ineligibles, laisses en place : c'est au commissaire d'arbitrer.
 */
export async function updateTeamRegionalLeague(
  input: UpdateRegionalLeagueInput,
): Promise<UpdateRegionalLeagueResult> {
  await ensureTeamInLeague(input);
  const team = await loadTeam(input.teamId);
  const ruleset = (team.ruleset ?? DEFAULT_RULESET) as Ruleset;
  const pack = getTournamentRuleset(team.tournamentRuleset);

  if (!allowsRegionalLeagueChoice(pack)) {
    throw new CommissionerSettingsError(
      "regional_choice_unavailable",
      "Le règlement de tournoi de cette équipe neutralise l'axe régional",
    );
  }

  const wanted = input.regionalLeague?.trim() || null;
  const declared = await declaredRegionalRules(team);
  const options = getRegionalLeagueOptions(team.roster, ruleset, declared);
  if (wanted && !options.some((o) => o.slug === wanted)) {
    throw new CommissionerSettingsError(
      "invalid_regional_league",
      `Ligue régionale invalide pour ce roster. Choix possibles : ${options
        .map((o) => getRegionalLeagueBySlug(o.slug)?.nameFr ?? o.slug)
        .join(", ")}`,
    );
  }
  if (wanted === team.regionalLeague) {
    throw new CommissionerSettingsError(
      "no_change",
      "Cette équipe est déjà dans cette Ligue régionale",
    );
  }

  const regionalBeforeSnapshot = await captureTeamState(
    prisma as unknown as TeamAuditPrismaLike,
    input.teamId,
  );
  await prisma.team.update({
    where: { id: input.teamId },
    data: { regionalLeague: wanted },
  });

  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    beforeSnapshot: regionalBeforeSnapshot,
    action: "update_regional_league",
    beforeState: { regionalLeague: team.regionalLeague },
    afterState: { regionalLeague: wanted },
    reason: input.reason ?? null,
  });

  return {
    regionalLeague: wanted,
    label: wanted
      ? (getRegionalLeagueBySlug(wanted)?.nameFr ?? wanted)
      : null,
    orphanedStarPlayers: await orphanedStarPlayers(team, ruleset, declared, wanted),
  };
}

/**
 * Star Players deja recrutes qui ne seraient plus recrutables sous la
 * nouvelle Ligue. Best-effort : liste vide si le catalogue n'est pas
 * interrogeable (mirroir sqlite de test).
 */
async function orphanedStarPlayers(
  team: TeamRow,
  ruleset: Ruleset,
  declared: readonly string[],
  chosen: string | null,
): Promise<string[]> {
  const hired = await hiredStarPlayerSlugs(team.id);
  if (hired.length === 0) return [];
  try {
    const { getAvailableStarPlayersDb } = await import(
      "../utils/star-player-repository"
    );
    const rules = resolveTeamRegionalRules(
      team.roster,
      ruleset,
      chosen,
      declared,
    );
    const available = await getAvailableStarPlayersDb(
      team.roster,
      rules,
      ruleset,
    );
    const slugs = new Set(available.map((sp) => sp.slug));
    return hired.filter((slug) => !slugs.has(slug));
  } catch {
    return [];
  }
}
