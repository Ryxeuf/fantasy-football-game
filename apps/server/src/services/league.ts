/**
 * L.1 — Service de ligue : League, LeagueSeason, LeagueParticipant,
 * LeagueRound.
 *
 * Fournit les operations de base utilisees par les routes API (L.3)
 * et le generateur de calendrier round-robin (L.4).
 *
 * Les regles metier validees ici :
 * - Un nom de ligue ne peut etre vide.
 * - `maxParticipants` doit etre >= 2 (un tournoi a besoin de >= 2 equipes).
 * - Le numero de saison est attribue automatiquement (1, 2, 3...).
 * - Les participants ne peuvent s'inscrire que sur une saison en status
 *   "draft" ou "scheduled", jamais sur une saison en cours ou terminee.
 * - Une equipe ne peut s'inscrire deux fois sur la meme saison.
 * - Les journees (rounds) sont numerotees a partir de 1.
 */

import { prisma } from "../prisma";
import { deriveSeasonEloFromGlobal } from "./season-elo";
import { isLeagueThemeSlug, type LeagueThemeSlug } from "./league-themes";

export type LeagueStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "completed"
  | "archived";

export type LeagueSeasonStatus =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "completed";

export type LeagueRoundStatus = "pending" | "in_progress" | "completed";

export type LeagueParticipantStatus = "active" | "withdrawn";

/**
 * L2.C.5 — Slugs autorises pour `tieBreakRules`. Re-exporte ici pour
 * que la couche route puisse les valider sans importer cycliquement.
 */
export interface CreateLeagueInput {
  creatorId: string;
  name: string;
  description?: string | null;
  ruleset?: "season_2" | "season_3";
  isPublic?: boolean;
  maxParticipants?: number;
  allowedRosters?: string[] | null;
  winPoints?: number;
  drawPoints?: number;
  lossPoints?: number;
  forfeitPoints?: number;
  /**
   * L2.C.5 — Ordre de departage personnalise. Tableau de slugs parmi
   * `TIE_BREAK_SLUGS`. null / undefined = ordre par defaut historique.
   */
  tieBreakRules?: readonly string[] | null;
  /**
   * Lot E — Points bonus configurables. Array de regles ou null.
   */
  bonusPointsConfig?: readonly unknown[] | null;
}

export interface CreateSeasonInput {
  leagueId: string;
  name: string;
  seasonNumber?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  /**
   * S26.6 — slug du theme saisonnier ("skaven_cup" | "nordic_challenge" |
   * "underworld_open"). Doit etre fourni en couple avec `themeYear`.
   * Si fourni mais inconnu, la creation est rejetee.
   */
  theme?: LeagueThemeSlug;
  /**
   * S26.6 — annee canonique (4 chiffres) du theme. Doit etre fournie
   * en couple avec `theme`.
   */
  themeYear?: number;
  /**
   * L2.C.3 — taille du bracket de playoffs en fin de saison
   * reguliere. 0 = pas de playoff (default). Valeurs supportees :
   * 0, 2, 4, 8.
   */
  playoffSize?: 0 | 2 | 4 | 8;
}

export interface AddParticipantInput {
  seasonId: string;
  teamId: string;
  /**
   * L.8 — valeur initiale explicite. Prioritaire sur le soft-reset.
   */
  initialElo?: number;
  /**
   * L.8 — si true, seed `seasonElo` en appliquant un soft-reset depuis
   * `User.eloRating` du proprietaire de l'equipe (compression vers 1000).
   * Ignore si `initialElo` est fourni.
   */
  carryOverFromGlobal?: boolean;
}

export interface CreateRoundInput {
  seasonId: string;
  roundNumber: number;
  name?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface ListLeaguesFilter {
  creatorId?: string;
  status?: LeagueStatus;
  publicOnly?: boolean;
  // S25.6 — pagination. Si non fournis, on retombe sur des defauts
  // raisonnables (50 / 0) pour eviter qu'un client legacy charge tout.
  limit?: number;
  offset?: number;
}

const DEFAULT_INITIAL_ELO = 1000;

function ensureNonEmptyName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error("Le nom de la ligue est obligatoire");
  }
}

function ensureValidMaxParticipants(maxParticipants: number): void {
  if (!Number.isInteger(maxParticipants) || maxParticipants < 2) {
    throw new Error(
      "maxParticipants doit etre un entier >= 2 (au moins deux participants)",
    );
  }
}

export async function createLeague(input: CreateLeagueInput) {
  ensureNonEmptyName(input.name);
  const maxParticipants = input.maxParticipants ?? 16;
  ensureValidMaxParticipants(maxParticipants);

  const allowedRosters =
    input.allowedRosters && input.allowedRosters.length > 0
      ? JSON.stringify(input.allowedRosters)
      : null;

  // L2.C.5 — valide les slugs cote serveur. Les slugs inconnus sont
  // filtres ; si plus rien ne reste, on stocke null (= ordre defaut).
  let tieBreakRules: string | null = null;
  if (input.tieBreakRules && input.tieBreakRules.length > 0) {
    const allowed = TIE_BREAK_SLUGS as readonly string[];
    const filtered = input.tieBreakRules.filter((s) => allowed.includes(s));
    tieBreakRules = filtered.length > 0 ? JSON.stringify(filtered) : null;
  }

  // Lot E — config bonus optionnelle a la creation.
  const bonusPointsConfig =
    input.bonusPointsConfig && input.bonusPointsConfig.length > 0
      ? (input.bonusPointsConfig as unknown[])
      : null;

  return prisma.league.create({
    data: {
      creatorId: input.creatorId,
      name: input.name.trim(),
      description: input.description ?? null,
      ruleset: input.ruleset ?? "season_3",
      isPublic: input.isPublic ?? true,
      maxParticipants,
      allowedRosters,
      winPoints: input.winPoints ?? 3,
      drawPoints: input.drawPoints ?? 1,
      lossPoints: input.lossPoints ?? 0,
      forfeitPoints: input.forfeitPoints ?? -1,
      tieBreakRules,
      bonusPointsConfig: bonusPointsConfig ?? undefined,
    },
  });
}

export async function createSeason(input: CreateSeasonInput) {
  const league = await prisma.league.findUnique({
    where: { id: input.leagueId },
  });
  if (!league) {
    throw new Error(`Ligue introuvable: ${input.leagueId}`);
  }

  ensureNonEmptyName(input.name);

  let seasonNumber: number;
  if (input.seasonNumber === undefined) {
    const latest = await prisma.leagueSeason.findFirst({
      where: { leagueId: input.leagueId },
      orderBy: { seasonNumber: "desc" },
      select: { seasonNumber: true },
    });
    seasonNumber = (latest?.seasonNumber ?? 0) + 1;
  } else {
    seasonNumber = input.seasonNumber;
  }

  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
    throw new Error("seasonNumber doit etre un entier >= 1");
  }

  // S26.6 — theme + themeYear : couple obligatoire si l'un est fourni.
  const hasTheme = input.theme !== undefined && input.theme !== null;
  const hasThemeYear =
    input.themeYear !== undefined && input.themeYear !== null;
  if (hasTheme && !hasThemeYear) {
    throw new Error(
      "themeYear est obligatoire quand theme est fourni (annee a 4 chiffres)",
    );
  }
  if (hasThemeYear && !hasTheme) {
    throw new Error(
      "theme est obligatoire quand themeYear est fourni (slug canonique)",
    );
  }
  let theme: LeagueThemeSlug | null = null;
  let themeYear: number | null = null;
  if (hasTheme && hasThemeYear) {
    if (!isLeagueThemeSlug(input.theme)) {
      throw new Error(
        `theme inconnu: ${String(input.theme)} (slugs valides: skaven_cup, nordic_challenge, underworld_open)`,
      );
    }
    if (
      !Number.isInteger(input.themeYear) ||
      (input.themeYear as number) <= 0
    ) {
      throw new Error(
        "themeYear doit etre un entier strictement positif (annee a 4 chiffres)",
      );
    }
    theme = input.theme as LeagueThemeSlug;
    themeYear = input.themeYear as number;
  }

  // L2.C.3 — playoffSize : default 0, valider valeurs autorisees.
  const playoffSize = input.playoffSize ?? 0;
  if (![0, 2, 4, 8].includes(playoffSize)) {
    throw new Error(
      `playoffSize non supporte: ${playoffSize} (valeurs autorisees: 0, 2, 4, 8)`,
    );
  }

  return prisma.leagueSeason.create({
    data: {
      leagueId: input.leagueId,
      seasonNumber,
      name: input.name.trim(),
      status: "draft",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      theme,
      themeYear,
      playoffSize,
    },
  });
}

export async function addParticipant(input: AddParticipantInput) {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
    include: {
      league: { select: { maxParticipants: true, allowedRosters: true } },
    },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${input.seasonId}`);
  }
  if (season.status !== "draft" && season.status !== "scheduled") {
    throw new Error(
      `Saison fermee aux inscriptions (status=${season.status}) — saison en cours ou terminee`,
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    include: { owner: { select: { eloRating: true } } },
  });
  if (!team) {
    throw new Error(`Equipe introuvable: ${input.teamId}`);
  }

  // L.9 — invariant metier de la ligue "Open 5 Teams" : une saison peut
  // restreindre les rosters autorises. On enforce la restriction ici
  // (source de verite) pour que les seeders, scripts admin et le handler
  // HTTP beneficient tous de la meme garantie.
  const allowed = parseAllowedRosters(
    (season as { league: { allowedRosters: string | null } }).league
      .allowedRosters ?? null,
  );
  const teamRoster = (team as { roster?: string }).roster;
  if (allowed && teamRoster && !allowed.includes(teamRoster)) {
    throw new Error(
      `Roster ${teamRoster} non autorise sur cette saison (autorises: ${allowed.join(", ")})`,
    );
  }

  const existing = await prisma.leagueParticipant.findUnique({
    where: {
      seasonId_teamId: { seasonId: input.seasonId, teamId: input.teamId },
    },
  });
  if (existing) {
    throw new Error("Cette equipe est deja inscrite sur la saison");
  }

  const currentCount = await prisma.leagueParticipant.count({
    where: { seasonId: input.seasonId },
  });
  const maxParticipants = season.league?.maxParticipants ?? 16;
  if (currentCount >= maxParticipants) {
    throw new Error(
      `La saison est complete (${currentCount}/${maxParticipants} participants)`,
    );
  }

  // L.8 — determination du seasonElo de depart. Priorite :
  //   1. initialElo (valeur explicite d'admin/test)
  //   2. soft-reset depuis l'ELO global si demande
  //   3. DEFAULT_INITIAL_ELO (1000) — reset dur, identique a aujourd'hui.
  let seasonElo = DEFAULT_INITIAL_ELO;
  if (typeof input.initialElo === "number") {
    seasonElo = input.initialElo;
  } else if (input.carryOverFromGlobal) {
    const ownerElo = (team as { owner?: { eloRating?: number } | null }).owner
      ?.eloRating;
    if (typeof ownerElo === "number") {
      seasonElo = deriveSeasonEloFromGlobal(ownerElo);
    }
  }

  return prisma.leagueParticipant.create({
    data: {
      seasonId: input.seasonId,
      teamId: input.teamId,
      seasonElo,
      status: "active",
    },
  });
}

export async function createRound(input: CreateRoundInput) {
  if (!Number.isInteger(input.roundNumber) || input.roundNumber < 1) {
    throw new Error("Le numero de round (journee) doit etre un entier positif");
  }

  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${input.seasonId}`);
  }

  return prisma.leagueRound.create({
    data: {
      seasonId: input.seasonId,
      roundNumber: input.roundNumber,
      name: input.name ?? null,
      status: "pending",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    },
  });
}

export async function listLeagues(filter: ListLeaguesFilter) {
  const where: Record<string, unknown> = {};
  if (filter.publicOnly !== false) {
    where.isPublic = true;
  }
  if (filter.creatorId) {
    where.creatorId = filter.creatorId;
  }
  if (filter.status) {
    where.status = filter.status;
  }
  // S25.6 — defaults raisonnables si limit/offset non fournis. Cap a 100
  // pour eviter qu'un caller passe une valeur exagerement grande.
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
  const offset = Math.max(filter.offset ?? 0, 0);
  const [items, total] = await Promise.all([
    prisma.league.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.league.count({ where }),
  ]);
  return { items, total, limit, offset };
}

/**
 * Parse `allowedRosters` JSON back to a string[] (or null when unrestricted).
 * Kept here so routes and scoring code share a single source of truth.
 */
export function parseAllowedRosters(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed as string[];
    }
    return null;
  } catch {
    return null;
  }
}

export interface StandingRow {
  participantId: string;
  teamId: string;
  teamName: string;
  roster: string;
  ownerId: string;
  coachName: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  touchdownDifference: number;
  casualtiesFor: number;
  casualtiesAgainst: number;
  seasonElo: number;
  status: LeagueParticipantStatus;
}

/**
 * Classement d'une saison (L.3 standings). Trie selon les regles de
 * departage configurees dans `League.tieBreakRules` (L2.C.5). Si null
 * ou invalide, retombe sur l'ordre historique :
 *   points DESC → diff TD DESC → TD pour DESC → ELO DESC → nom ASC.
 * Cette methode lit les compteurs materialises sur `LeagueParticipant`
 * (mis a jour par L.7 : integration match -> ligue).
 */
export async function computeSeasonStandings(
  seasonId: string,
): Promise<StandingRow[]> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      league: { select: { tieBreakRules: true } },
    },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${seasonId}`);
  }

  const participants = await prisma.leagueParticipant.findMany({
    where: { seasonId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          roster: true,
          owner: { select: { id: true, coachName: true } },
        },
      },
    },
  });

  type ParticipantRow = (typeof participants)[number];
  const rows: StandingRow[] = participants.map((p: ParticipantRow) => ({
    participantId: p.id,
    teamId: p.teamId,
    teamName: p.team.name,
    roster: p.team.roster,
    ownerId: p.team.owner.id,
    coachName: p.team.owner.coachName ?? null,
    played: p.wins + p.draws + p.losses,
    wins: p.wins,
    draws: p.draws,
    losses: p.losses,
    points: p.points,
    touchdownsFor: p.touchdownsFor,
    touchdownsAgainst: p.touchdownsAgainst,
    touchdownDifference: p.touchdownsFor - p.touchdownsAgainst,
    casualtiesFor: p.casualtiesFor,
    casualtiesAgainst: p.casualtiesAgainst,
    seasonElo: p.seasonElo,
    status: p.status as LeagueParticipantStatus,
  }));

  const tieBreakRules = parseTieBreakRules(
    (season as { league?: { tieBreakRules?: string | null } | null }).league
      ?.tieBreakRules ?? null,
  );
  rows.sort(makeStandingsComparator(tieBreakRules));

  return rows;
}

/**
 * L2.C.5 — Slugs supportes pour `League.tieBreakRules`.
 * "name" est toujours ASC ; les autres sont DESC. L'ordre dans le
 * tableau dicte la priorite de tri.
 */
export const TIE_BREAK_SLUGS = [
  "points",
  "td_diff",
  "td_for",
  "td_against",
  "cas_diff",
  "cas_for",
  "season_elo",
  "wins",
  "name",
] as const;

export type TieBreakSlug = (typeof TIE_BREAK_SLUGS)[number];

// L'ELO n'est plus un critere de classement par defaut : non pertinent pour
// une ligue fermee (cf. saisie offline). On le remplace par un departage
// sportif (diff CAS). Une ligue peut le reactiver via `tieBreakRules`.
const DEFAULT_TIE_BREAK_RULES: readonly TieBreakSlug[] = [
  "points",
  "td_diff",
  "td_for",
  "cas_diff",
  "name",
];

/**
 * Vrai si l'ELO saisonnier est un critere de classement effectif pour cette
 * ligue (present dans `tieBreakRules`). Pilote l'affichage de la colonne ELO :
 * masquee par defaut, "reactivable via reglages" en ajoutant `season_elo`.
 */
export function isSeasonEloRanked(raw: string | null): boolean {
  return parseTieBreakRules(raw).includes("season_elo");
}

/**
 * Parse le JSON `tieBreakRules`. Si null / corrompu / contient des
 * slugs inconnus, retombe sur l'ordre par defaut historique.
 * Le slug "name" est toujours pousse en derniere position si absent
 * (sentinel pour eviter les ties strictes).
 */
export function parseTieBreakRules(
  raw: string | null,
): readonly TieBreakSlug[] {
  if (!raw) return DEFAULT_TIE_BREAK_RULES;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_TIE_BREAK_RULES;
  }
  if (!Array.isArray(parsed)) return DEFAULT_TIE_BREAK_RULES;
  const valid: TieBreakSlug[] = [];
  for (const item of parsed) {
    if (
      typeof item === "string" &&
      (TIE_BREAK_SLUGS as readonly string[]).includes(item) &&
      !valid.includes(item as TieBreakSlug)
    ) {
      valid.push(item as TieBreakSlug);
    }
  }
  if (valid.length === 0) return DEFAULT_TIE_BREAK_RULES;
  // Garantit que "name" est present en sentinelle de queue.
  if (!valid.includes("name")) {
    valid.push("name");
  }
  return valid;
}

/**
 * Construit un comparator pour `Array.prototype.sort` a partir d'une
 * liste de slugs de tri. Pure : facilement testable sans Prisma.
 */
export function makeStandingsComparator(
  rules: readonly TieBreakSlug[],
): (a: StandingRow, b: StandingRow) => number {
  return (a, b) => {
    for (const slug of rules) {
      const cmp = compareBySlug(a, b, slug);
      if (cmp !== 0) return cmp;
    }
    return 0;
  };
}

function compareBySlug(
  a: StandingRow,
  b: StandingRow,
  slug: TieBreakSlug,
): number {
  switch (slug) {
    case "points":
      return b.points - a.points;
    case "td_diff":
      return b.touchdownDifference - a.touchdownDifference;
    case "td_for":
      return b.touchdownsFor - a.touchdownsFor;
    case "td_against":
      // Inverse : moins de TD encaisses = mieux.
      return a.touchdownsAgainst - b.touchdownsAgainst;
    case "cas_diff":
      return b.casualtiesFor - b.casualtiesAgainst -
        (a.casualtiesFor - a.casualtiesAgainst);
    case "cas_for":
      return b.casualtiesFor - a.casualtiesFor;
    case "season_elo":
      return b.seasonElo - a.seasonElo;
    case "wins":
      return b.wins - a.wins;
    case "name":
      return a.teamName.localeCompare(b.teamName);
  }
}

/**
 * S26.6b — Liste paginee des saisons d'un theme donne.
 * `theme` est obligatoire et valide via `isLeagueThemeSlug`.
 * `themeYear` filtre une edition precise (laisser absent pour toutes les
 * editions du theme, dans l'ordre `themeYear DESC, seasonNumber DESC`).
 *
 * Retour identique a `listLeagues` (items / total / limit / offset) pour
 * que les clients reutilisent la meme convention de pagination.
 */
export interface ListThemedSeasonsInput {
  theme: LeagueThemeSlug;
  themeYear?: number;
  limit?: number;
  offset?: number;
}

export async function listThemedSeasons(input: ListThemedSeasonsInput) {
  if (!isLeagueThemeSlug(input.theme)) {
    throw new Error(
      `theme inconnu: ${String(input.theme)} (slugs valides: skaven_cup, nordic_challenge, underworld_open)`,
    );
  }
  if (
    input.themeYear !== undefined &&
    (!Number.isInteger(input.themeYear) || input.themeYear <= 0)
  ) {
    throw new Error(
      "themeYear doit etre un entier strictement positif (annee a 4 chiffres)",
    );
  }
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const where: Record<string, unknown> = { theme: input.theme };
  if (input.themeYear !== undefined) {
    where.themeYear = input.themeYear;
  }

  const [items, total] = await Promise.all([
    prisma.leagueSeason.findMany({
      where,
      orderBy: [
        { themeYear: "desc" },
        { seasonNumber: "desc" },
      ],
      take: limit,
      skip: offset,
      include: {
        league: {
          select: { id: true, name: true, isPublic: true, ruleset: true },
        },
      },
    }),
    prisma.leagueSeason.count({ where }),
  ]);

  return { items, total, limit, offset };
}

/**
 * L2.D — Edition d'une ligue par son commissaire (createur).
 * Tous les champs sont optionnels : seuls ceux fournis sont modifies.
 * Les checks d'autorisation (createur) et de verrouillage (match deja
 * joue) sont faits par la couche route ; ce service applique uniquement
 * les validations metier de base + la persistance.
 */
export interface UpdateLeagueInput {
  name?: string;
  description?: string | null;
  ruleset?: "season_2" | "season_3";
  isPublic?: boolean;
  maxParticipants?: number;
  allowedRosters?: string[] | null;
  winPoints?: number;
  drawPoints?: number;
  lossPoints?: number;
  forfeitPoints?: number;
  tieBreakRules?: readonly string[] | null;
  /**
   * Lot E — Configuration des points bonus. Array de regles ou null
   * pour desactiver. Modifiable tant que la ligue n'a pas de match
   * score (cf. `hasLeagueScoredMatch`).
   */
  bonusPointsConfig?: readonly unknown[] | null;
}

/**
 * Vrai si au moins un match d'une saison de cette ligue a ete joue et
 * comptabilise (`Match.leagueScoredAt` non-null). C'est le verrou qui
 * fige les parametres de la ligue : une fois le premier resultat saisi,
 * le commissaire ne peut plus changer points/participants/etc.
 */
export async function hasLeagueScoredMatch(leagueId: string): Promise<boolean> {
  const count = await prisma.match.count({
    where: {
      leagueScoredAt: { not: null },
      leagueSeason: { is: { leagueId } },
    },
  });
  return count > 0;
}

export async function updateLeague(
  leagueId: string,
  input: UpdateLeagueInput,
) {
  if (input.name !== undefined) {
    ensureNonEmptyName(input.name);
  }
  if (input.maxParticipants !== undefined) {
    ensureValidMaxParticipants(input.maxParticipants);
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description;
  if (input.ruleset !== undefined) data.ruleset = input.ruleset;
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;
  if (input.maxParticipants !== undefined)
    data.maxParticipants = input.maxParticipants;
  if (input.allowedRosters !== undefined) {
    data.allowedRosters =
      input.allowedRosters && input.allowedRosters.length > 0
        ? JSON.stringify(input.allowedRosters)
        : null;
  }
  if (input.winPoints !== undefined) data.winPoints = input.winPoints;
  if (input.drawPoints !== undefined) data.drawPoints = input.drawPoints;
  if (input.lossPoints !== undefined) data.lossPoints = input.lossPoints;
  if (input.forfeitPoints !== undefined)
    data.forfeitPoints = input.forfeitPoints;
  if (input.tieBreakRules !== undefined) {
    let tieBreakRules: string | null = null;
    if (input.tieBreakRules && input.tieBreakRules.length > 0) {
      const allowed = TIE_BREAK_SLUGS as readonly string[];
      const filtered = input.tieBreakRules.filter((s) => allowed.includes(s));
      tieBreakRules = filtered.length > 0 ? JSON.stringify(filtered) : null;
    }
    data.tieBreakRules = tieBreakRules;
  }
  // Lot E — accepte la nouvelle config bonus. La validation des
  // regles individuelles est deleguee au service `league-bonus-points`
  // au runtime (parseBonusConfig retourne `null` si invalide). On
  // stocke ici une struct JSON arbitraire (les rules malformees
  // seront ignorees a la lecture).
  if (input.bonusPointsConfig !== undefined) {
    data.bonusPointsConfig =
      input.bonusPointsConfig && input.bonusPointsConfig.length > 0
        ? (input.bonusPointsConfig as unknown[])
        : null;
  }

  return prisma.league.update({ where: { id: leagueId }, data });
}

export async function getLeagueById(leagueId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      // Audit round 6 (CRITICAL/PII) : retire `email` du select public.
      creator: { select: { id: true, coachName: true } },
      seasons: { orderBy: { seasonNumber: "asc" } },
    },
  });
}

export async function getSeasonById(seasonId: string) {
  return prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    include: {
      league: true,
      // L2.A.10 — on inclut les pairings de chaque round pour que le
      // frontend puisse afficher "home vs away" et le bouton "Lancer le
      // match" sans faire un fetch supplementaire par round. Le `match`
      // (id + status) est joint pour permettre le routage direct vers
      // la partie en cours, et l'`ownerId` des deux teams permet a
      // `SeasonCalendar` de decider qui voit le bouton de lancement.
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          pairings: {
            orderBy: { createdAt: "asc" },
            include: {
              match: { select: { id: true, status: true, mode: true } },
              homeParticipant: {
                select: {
                  id: true,
                  teamId: true,
                  team: {
                    select: {
                      id: true,
                      name: true,
                      roster: true,
                      ownerId: true,
                    },
                  },
                },
              },
              awayParticipant: {
                select: {
                  id: true,
                  teamId: true,
                  team: {
                    select: {
                      id: true,
                      name: true,
                      roster: true,
                      ownerId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      participants: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              roster: true,
              owner: { select: { id: true, coachName: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Lot B — Erreur typee retournee par `withdrawParticipant` pour permettre
 * a la couche route de mapper proprement vers un status HTTP (404 / 409).
 */
export class LeagueWithdrawError extends Error {
  constructor(
    public readonly code:
      | "season_not_found"
      | "season_started"
      | "season_completed"
      | "not_registered",
    message: string,
  ) {
    super(message);
    this.name = "LeagueWithdrawError";
  }
}

/**
 * Withdraw une equipe d'une saison.
 *
 * Lot B — Le retrait n'est autorise que tant que la saison n'a pas
 * demarre (status `draft` ou `scheduled`). Une fois la saison
 * `in_progress`, le commissaire doit passer par la procedure de
 * forfait (`league-forfeit.ts`) qui preserve l'historique des
 * pairings deja generes.
 *
 * Un admin peut forcer le retrait via `force=true` (cas de
 * desistement tardif). Ce mode est uniquement appele depuis les
 * routes admin et doit etre audite cote route.
 */
export async function withdrawParticipant(input: {
  seasonId: string;
  teamId: string;
  /** Lot B — bypass admin pour retirer une equipe pendant `in_progress`. */
  force?: boolean;
}) {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new LeagueWithdrawError(
      "season_not_found",
      `Saison introuvable: ${input.seasonId}`,
    );
  }
  if (season.status === "completed") {
    throw new LeagueWithdrawError(
      "season_completed",
      "Saison terminee : impossible de retirer une equipe",
    );
  }
  if (
    !input.force &&
    season.status !== "draft" &&
    season.status !== "scheduled"
  ) {
    throw new LeagueWithdrawError(
      "season_started",
      "Saison demarree : utilisez la procedure de forfait pour retirer une equipe",
    );
  }

  const existing = await prisma.leagueParticipant.findUnique({
    where: {
      seasonId_teamId: { seasonId: input.seasonId, teamId: input.teamId },
    },
  });
  if (!existing) {
    throw new LeagueWithdrawError(
      "not_registered",
      "Cette equipe n'est pas inscrite sur la saison",
    );
  }

  return prisma.leagueParticipant.update({
    where: { id: existing.id },
    data: { status: "withdrawn" },
  });
}
