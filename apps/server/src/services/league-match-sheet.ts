/**
 * Lot G — Service de feuille de match v2.
 *
 * Gere le cycle de vie collaboratif d'une feuille de match :
 *   draft -> submitted_home/away -> both_submitted -> validated
 *   (-> invalidated dans la fenetre de correction).
 *
 * Responsabilites G.1 (ce fichier) :
 *   - createMatchSheet (lazy, a l'ouverture de la feuille) ;
 *   - addEvent / removeEvent (journal) ;
 *   - updatePreMatch (meteo, popularite, inducements, prieres) ;
 *   - submitByCoach / unsubmitByCoach (saisie joueur) ;
 *   - validateByCommissioner (fige le score derive ; l'application des
 *     effets sur le classement est branchee en G.2).
 *
 * L'autorisation fine (coach home/away vs commissaire) est resolue ici
 * en lisant le pairing : owner des teams home/away + creator de la ligue.
 * Le summarizer pur (`league-match-summary`) derive score + blesses.
 */

import { prisma } from "../prisma";
import {
  summarizeMatchSheet,
  isMatchEventKind,
  computeMatchWinnings,
  computeStalledTeams,
  type MatchEventInput,
  type MatchSummary,
  type InjurySeverity,
} from "./league-match-summary";
import {
  recordOfflineLeagueResult,
  OFFLINE_MATCH_MODE,
  type OfflinePlayerStatInput,
  type OfflineInjuryInput,
  type OfflineInjuryType,
} from "./league-offline-result";
import {
  parsePurchases,
  type OfflinePurchaseInput,
} from "./league-offline-purchases";
import { calculatePlayerSPP, loadLeagueSPPContext } from "./spp-tracking";
import {
  reverseOfflineLeagueResult,
  type ReverseOfflineSkipReason,
} from "./league-offline-edit";
import {
  buildHateCandidates,
  buildSheetKeywordMap,
  parseHateRolls,
  type HateInjuryInput,
  type HateRoll,
} from "./league-hate-trait";
import {
  buildJourneymanHire,
  deriveJourneymen,
  deriveMatchJourneymen,
  isJourneymanId,
  journeymenChoiceInput,
  linemanPositionsForRoster,
  type JourneymanSourcePosition,
  parseJourneymenChoice,
  parseJourneymenChoices,
  type JourneymanPositionOption,
  type SheetJourneyman,
} from "./league-sheet-journeymen";
import {
  applyPrayerSppBonuses,
  computePrayerSppBonuses,
} from "./league-sheet-prayer-spp";
import {
  buildPurchaseOptions,
  countByPosition,
  EMPTY_PURCHASE_OPTIONS,
  type PurchaseOptions,
} from "./league-sheet-purchase-options";
import {
  deriveSheetStarPlayers,
  isSyntheticSheetPlayerId,
  syntheticSheetPlayerSide,
  type SheetStarPlayer,
} from "./league-sheet-star-players";
import { recordForfeit } from "./league-forfeit";
import { sendLeagueMatchValidationPush } from "./push-notifications";
import { captureRosterSnapshot } from "./cup-roster-snapshot";
import {
  resolveSpecialRulesForTeam,
  updateTeamValues,
} from "../utils/team-values";
import { getEliteSkillSlugs } from "./elite-skills";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import { loadInducementCatalogue } from "./inducement-repository";
import { loadAdvancementSchedule } from "./advancement-schedule-repository";
import {
  parseStagedAdvancements,
  applyStagedAdvancements,
  reverseAppliedAdvancements,
  type StagedAdvancement,
} from "./league-sheet-advancements";
import { serverLog } from "../utils/server-log";
import {
  WEATHER_TYPES,
  INDUCEMENT_CATALOGUE,
  canPurchaseInducement,
  type InducementContext,
  getNextAdvancementPspCost,
  surchargeForAdvancement,
  type AdvancementSchedule,
  calculatePettyCash,
  getInducementCost,
  getInducementMaxQuantity,
  getSpecialRulesForTeam,
  resolveTeamRegionalRules,
  DEFAULT_RULESET,
  APOTHECARY_FORBIDDEN_ROSTERS,
  getTeamColors,
  getFormatConstraints,
  isGameFormat,
  TEAM_ROSTERS,
  type AllowedRoster,
  type GameFormat,
  type Ruleset,
  type TournamentRulesetDefinition,
} from "@bb/game-engine";
import {
  applyPackInducementRules,
  effectiveInducementAllowlist,
} from "./tournament-inducements";
import { getTournamentRulesetDefinition } from "./tournament-ruleset-repository";
import { getAvailableStarPlayersDb } from "../utils/star-player-repository";
import {
  getDeclaredRegionalRules,
  getRosterFromDb,
} from "../utils/roster-helpers";

/**
 * Postes du roster lus EN BASE (`Position`), a injecter dans la derivation
 * des journaliers. Le catalogue compile ne doit plus arbitrer ni leur prix
 * (base de la VEA de match, donc de la cagnotte) ni leur slug (un slug
 * renomme rendait le journalier « paye mais jamais materialise »).
 *
 * Tolerant : base injoignable ou roster absent => `null`, donc repli sur le
 * catalogue, la feuille reste servie.
 */
async function loadJourneymanPositions(teams: {
  home: MatchSheetTeam | null;
  away: MatchSheetTeam | null;
}): Promise<{
  home: readonly JourneymanSourcePosition[] | null;
  away: readonly JourneymanSourcePosition[] | null;
}> {
  const [home, away] = await Promise.all([
    teams.home
      ? journeymanPositionsFor(teams.home.roster, teams.home.ruleset)
      : Promise.resolve(null),
    teams.away
      ? journeymanPositionsFor(teams.away.roster, teams.away.ruleset)
      : Promise.resolve(null),
  ]);
  return { home, away };
}

async function journeymanPositionsFor(
  roster: string,
  ruleset: string | null | undefined,
): Promise<readonly JourneymanSourcePosition[] | null> {
  try {
    const payload = await getRosterFromDb(
      roster,
      "fr",
      (ruleset as Ruleset) ?? DEFAULT_RULESET,
    );
    return payload?.positions ?? null;
  } catch {
    return null;
  }
}

/** Colonnes de la feuille dont dependent les journaliers d'un cote. */
interface SheetJourneymenColumns {
  rosterSnapshotHome?: unknown;
  rosterSnapshotAway?: unknown;
  journeymenHome?: unknown;
  journeymenAway?: unknown;
}

/**
 * Journaliers de la VERSION DU MATCH d'un cote de la feuille : roster fige
 * (ou live tant que la feuille ne l'est pas), choix de postes stockes et
 * postes lus en base. UNE seule derivation pour tous les chemins qui
 * doivent reconnaitre un journalier (appartenance d'une evolution stagee,
 * tirage aleatoire, recrutement) : deux derivations divergentes feraient
 * refuser cote serveur un journalier que la feuille affiche pourtant.
 */
function deriveSideJourneymen(
  team: MatchSheetTeam,
  side: "home" | "away",
  sheet: SheetJourneymenColumns,
  positions: readonly JourneymanSourcePosition[] | null | undefined,
): SheetJourneyman[] {
  return deriveMatchJourneymen({
    side,
    roster: team.roster,
    ruleset: team.ruleset,
    players: team.players,
    ...journeymenChoiceInput(
      side === "home" ? sheet.journeymenHome : sheet.journeymenAway,
    ),
    positions,
    frozenRosterSnapshot:
      side === "home" ? sheet.rosterSnapshotHome : sheet.rosterSnapshotAway,
  });
}

export type MatchSheetStatus =
  | "draft"
  | "submitted_home"
  | "submitted_away"
  | "both_submitted"
  | "validated"
  | "invalidated";

export class MatchSheetError extends Error {
  constructor(
    public readonly code:
      | "pairing_not_found"
      | "sheet_not_found"
      | "forbidden"
      | "not_a_participant"
      | "already_validated"
      | "not_validated"
      | "invalid_status"
      | "invalid_event"
      | "event_not_found"
      | "invalidation_window_closed"
      | "invalidation_failed"
      | "inducement_over_budget"
      | "inducement_not_allowed"
      | "advancement_wrong_side"
      | "advancement_invalid_player",
    message: string,
  ) {
    super(message);
    this.name = "MatchSheetError";
  }
}

export type CoachSide = "home" | "away";

interface PairingContext {
  pairingId: string;
  leagueId: string;
  leagueName: string;
  creatorId: string;
  homeOwnerId: string;
  awayOwnerId: string;
}

/**
 * Resout le contexte d'autorisation d'un pairing : ligue, commissaire,
 * owners des deux equipes. Source unique pour tous les checks de role.
 */
async function loadPairingContext(pairingId: string): Promise<PairingContext> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      round: {
        select: {
          season: {
            select: {
              league: { select: { id: true, name: true, creatorId: true } },
            },
          },
        },
      },
      homeParticipant: { select: { team: { select: { ownerId: true } } } },
      awayParticipant: { select: { team: { select: { ownerId: true } } } },
    },
  })) as {
    id: string;
    round: {
      season: { league: { id: string; name: string; creatorId: string } };
    };
    homeParticipant: { team: { ownerId: string } } | null;
    awayParticipant: { team: { ownerId: string } } | null;
  } | null;

  if (!pairing) {
    throw new MatchSheetError(
      "pairing_not_found",
      `Pairing introuvable: ${pairingId}`,
    );
  }
  const league = pairing.round.season.league;
  return {
    pairingId: pairing.id,
    leagueId: league.id,
    leagueName: league.name ?? "",
    creatorId: league.creatorId,
    homeOwnerId: pairing.homeParticipant?.team.ownerId ?? "",
    awayOwnerId: pairing.awayParticipant?.team.ownerId ?? "",
  };
}

/** Determine le cote (home/away) d'un coach, ou null s'il n'est pas joueur. */
function coachSide(ctx: PairingContext, userId: string): CoachSide | null {
  if (userId === ctx.homeOwnerId) return "home";
  if (userId === ctx.awayOwnerId) return "away";
  return null;
}

function isCommissioner(ctx: PairingContext, userId: string): boolean {
  return userId === ctx.creatorId;
}

/**
 * Fige l'ÉTAT COMPLET des DEUX équipes au DÉMARRAGE de la feuille : joueurs
 * (avec compétences, caractéristiques et PSP), staff (relances, pom-pom
 * girls, assistants, apothicaire), VE/VEA, trésorerie et fans dévoués — plus
 * les journaliers alignés. C'est la « version du match » : tout ce qui suit
 * (gains, évolutions, achats, licenciements) fait bouger le roster live mais
 * ne doit JAMAIS rétro-modifier la feuille.
 *
 * Stocké dans `rosterSnapshotHome/Away` (RosterSnapshot sérialisé, cf.
 * `cup-roster-snapshot`). Best-effort : un échec ne bloque pas l'ouverture,
 * et le gel est alors rattrapé à la première lecture ou soumission.
 */
async function captureSideSnapshot(
  team: MatchSheetTeam | null,
  side: "home" | "away",
  journeymenChoiceRaw: unknown,
  /** Valeurs déjà figées à préserver (regel d'une feuille legacy). */
  preserved: ReturnType<typeof parseFrozenTeamValues> = null,
): Promise<string | null> {
  if (!team?.teamId) return null;
  // VE/VEA fraîches AVANT capture : la VEA exclut les joueurs absents
  // (missNextMatch) et la valeur stockée peut être obsolète (blessure
  // appliquée sans recalcul). Best-effort : en cas d'échec, la capture
  // part des valeurs stockées.
  try {
    await updateTeamValues(prisma, team.teamId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(
      `[league-match-sheet] refresh VE/VEA avant capture échoué (${side}): ${msg}`,
    );
  }
  // Les joueurs absents (missNextMatch) ne participent pas au match : ils
  // sont exclus de la « version du match » figée.
  const snap = await captureRosterSnapshot(team.teamId, {
    excludeMissNextMatch: true,
  });
  if (!snap) return null;
  const base = {
    ...snap,
    teamValue: preserved?.teamValue ?? snap.teamValue,
    currentValue: preserved?.currentValue ?? snap.currentValue,
    treasury: preserved?.treasury ?? snap.treasury,
    dedicatedFans: preserved?.dedicatedFans ?? snap.dedicatedFans,
    rerolls: preserved?.rerolls ?? snap.rerolls,
    cheerleaders: preserved?.cheerleaders ?? snap.cheerleaders,
    assistants: preserved?.assistants ?? snap.assistants,
    apothecary: preserved?.apothecary ?? snap.apothecary,
  };
  const journeymen = deriveJourneymen({
    side,
    roster: team.roster,
    ruleset: team.ruleset,
    players: team.players,
    ...journeymenChoiceInput(journeymenChoiceRaw),
    positions: await journeymanPositionsFor(team.roster, team.ruleset),
  });
  if (journeymen.length === 0) return JSON.stringify(base);
  // Règle BB : les journaliers alignés comptent dans la VEA du match
  // (CTV des coups de pouce) — leur valeur est figée avec l'en-tête.
  const journeymenValue = journeymen.reduce((sum, j) => sum + j.cost, 0);
  return JSON.stringify({
    ...base,
    currentValue: base.currentValue + journeymenValue,
    players: [
      ...base.players,
      ...journeymen.map((j) => ({
        name: j.name,
        position: j.positionName,
        number: j.number,
        ma: j.stats.ma,
        st: j.stats.st,
        ag: j.stats.ag,
        pa: j.stats.pa,
        av: j.stats.av,
        skills: j.skills,
        spp: 0,
        advancements: "[]",
      })),
    ],
  });
}

/**
 * Gèle les deux côtés d'une feuille. `sheet` porte l'état déjà figé : un
 * côté déjà gelé COMPLET est laissé tel quel ; un gel « en-tête seul »
 * (feuilles antérieures) est complété en préservant ses valeurs.
 * Retourne les colonnes à écrire (vide = rien à faire).
 */
async function captureMatchSnapshots(
  pairingId: string,
  sheet: {
    rosterSnapshotHome?: unknown;
    rosterSnapshotAway?: unknown;
    journeymenHome?: unknown;
    journeymenAway?: unknown;
  },
): Promise<Record<string, string>> {
  const data: Record<string, string> = {};
  try {
    const needs = (raw: unknown): boolean => !raw || isHeaderOnlySnapshot(raw);
    const needsHome = needs(sheet.rosterSnapshotHome);
    const needsAway = needs(sheet.rosterSnapshotAway);
    if (!needsHome && !needsAway) return data;
    const teams = await loadSheetTeams(pairingId);
    if (needsHome) {
      const json = await captureSideSnapshot(
        teams.home,
        "home",
        sheet.journeymenHome,
        parseFrozenTeamValues(sheet.rosterSnapshotHome),
      );
      if (json) data.rosterSnapshotHome = json;
    }
    if (needsAway) {
      const json = await captureSideSnapshot(
        teams.away,
        "away",
        sheet.journeymenAway,
        parseFrozenTeamValues(sheet.rosterSnapshotAway),
      );
      if (json) data.rosterSnapshotAway = json;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(`[league-match-sheet] gel de la feuille échoué: ${msg}`);
    return {};
  }
  return data;
}

/**
 * Snapshot « en-tête seul » posé au démarrage des feuilles ANTÉRIEURES au
 * gel complet : les valeurs (VE/VEA/trésorerie/fans) sont figées mais le
 * roster et les journaliers ne sont PAS bakés dedans. Il est complété (en
 * préservant ses valeurs) à la première occasion.
 */
function isHeaderOnlySnapshot(raw: unknown): boolean {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return false;
    }
  }
  if (!obj || typeof obj !== "object") return false;
  return (obj as { headerOnly?: unknown }).headerOnly === true;
}

/**
 * Crée (ou retourne) la feuille de match d'un pairing. Idempotent :
 * si elle existe deja, on la retourne. Accessible aux 2 coachs + au
 * commissaire. À la création, l'ÉTAT COMPLET des deux équipes est figé
 * (joueurs, staff, VE/VEA, trésorerie, fans) : la feuille garde la
 * « version du match » du DÉMARRAGE de la rencontre.
 */
export async function createMatchSheet(input: {
  pairingId: string;
  userId: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  if (!side && !isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError(
      "not_a_participant",
      "Seuls les 2 coachs et le commissaire peuvent ouvrir la feuille",
    );
  }
  const existing = await prisma.leagueMatchSheet.findUnique({
    where: { pairingId: input.pairingId },
  });
  if (existing) return existing;

  const created = await prisma.leagueMatchSheet.create({
    data: { pairingId: input.pairingId, status: "draft" },
  });

  // Gel complet au démarrage (best-effort) : roster, staff, VE/VEA,
  // trésoreries et fans sont figés dès l'ouverture de la feuille.
  const snapshots = await captureMatchSnapshots(input.pairingId, created);
  if (Object.keys(snapshots).length > 0) {
    try {
      return await prisma.leagueMatchSheet.update({
        where: { id: created.id },
        data: snapshots,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(
        `[league-match-sheet] écriture du gel de démarrage échouée: ${msg}`,
      );
    }
  }
  return created;
}

async function loadSheetOrThrow(pairingId: string) {
  const sheet = await prisma.leagueMatchSheet.findUnique({
    where: { pairingId },
  });
  if (!sheet) {
    throw new MatchSheetError(
      "sheet_not_found",
      "Feuille de match inexistante (ouvrez-la d'abord)",
    );
  }
  return sheet;
}

function ensureEditable(status: string): void {
  if (status === "validated") {
    throw new MatchSheetError(
      "already_validated",
      "Feuille validee : editez via invalidation (commissaire)",
    );
  }
}

/** Ajoute un evenement au journal. Coachs + commissaire, avant validation. */
export async function addEvent(input: {
  pairingId: string;
  userId: string;
  event: MatchEventInput & {
    meta?: Record<string, unknown> | null;
    /** Mi-temps (1|2) — fusionnee dans meta.half. */
    half?: number | null;
    /** Tour (1..16) — fusionne dans meta.turn. */
    turn?: number | null;
  };
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  if (!side && !isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError("forbidden", "Action reservee aux participants");
  }
  if (!isMatchEventKind(input.event.kind)) {
    throw new MatchSheetError(
      "invalid_event",
      `Type d'evenement invalide: ${String(input.event.kind)}`,
    );
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  ensureEditable(sheet.status);

  // Mi-temps / tour : portes via meta (pas de colonne dediee). On fusionne
  // les champs explicites half/turn dans meta sans ecraser un meta fourni.
  const baseMeta =
    input.event.meta && typeof input.event.meta === "object"
      ? { ...input.event.meta }
      : {};
  if (input.event.half != null) baseMeta.half = input.event.half;
  if (input.event.turn != null) baseMeta.turn = input.event.turn;
  const meta = Object.keys(baseMeta).length > 0 ? baseMeta : undefined;

  return prisma.leagueMatchEvent.create({
    data: {
      matchSheetId: sheet.id,
      kind: input.event.kind,
      team: input.event.team ?? null,
      actorPlayerId: input.event.actorPlayerId ?? null,
      targetPlayerId: input.event.targetPlayerId ?? null,
      causeDetail: input.event.causeDetail ?? null,
      injurySeverity: (input.event.injurySeverity as string | null) ?? null,
      meta: meta as object | undefined,
    },
  });
}

/** Supprime un evenement (correction de saisie). */
export async function removeEvent(input: {
  pairingId: string;
  userId: string;
  eventId: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  if (!coachSide(ctx, input.userId) && !isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError("forbidden", "Action reservee aux participants");
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  ensureEditable(sheet.status);

  const ev = await prisma.leagueMatchEvent.findUnique({
    where: { id: input.eventId },
    select: { id: true, matchSheetId: true },
  });
  if (!ev || ev.matchSheetId !== sheet.id) {
    throw new MatchSheetError("event_not_found", "Evenement introuvable");
  }
  await prisma.leagueMatchEvent.delete({ where: { id: input.eventId } });
  return { deleted: true };
}

export interface PreMatchPayload {
  weatherTable?: string | null;
  weather?: string | null;
  popularityHome?: number | null;
  popularityAway?: number | null;
  forfeitSide?: "home" | "away" | null;
  tossWinner?: "home" | "away" | null;
  tossChoice?: "kick" | "receive" | null;
  inducementsHome?: unknown;
  inducementsAway?: unknown;
  prayersHome?: unknown;
  prayersAway?: unknown;
  /**
   * Journaliers — poste de lineman choisi (slug) pour TOUS les journaliers
   * du cote, null = defaut. Forme historique, conservee pour les clients
   * qui ne connaissent pas le choix par rang.
   */
  journeymenChoiceHome?: string | null;
  journeymenChoiceAway?: string | null;
  /**
   * Journaliers — poste de CHAQUE journalier, par rang (`[i]` = journalier
   * `i`). `null` sur un rang = repli sur le choix global puis sur le
   * lineman de base. Prioritaire sur `journeymenChoiceHome/Away`.
   */
  journeymenChoicesHome?: readonly (string | null)[] | null;
  journeymenChoicesAway?: readonly (string | null)[] | null;
}

/** Met a jour les infos d'avant-match. */
export async function updatePreMatch(input: {
  pairingId: string;
  userId: string;
  payload: PreMatchPayload;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  if (!coachSide(ctx, input.userId) && !isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError("forbidden", "Action reservee aux participants");
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  ensureEditable(sheet.status);

  const p = input.payload;

  // Coups de pouce : on borne la depense au budget officiel (petty cash +
  // tresorerie). Le petty cash depend des 2 CTV -> on charge les equipes et
  // calcule le budget une seule fois si une selection est presente. Les
  // CTV/tresoreries sont figees au debut du match si le roster l'est deja.
  if (p.inducementsHome !== undefined || p.inducementsAway !== undefined) {
    const teamsLive = await loadSheetTeams(input.pairingId);
    const snapForBudget = sheet as {
      rosterSnapshotHome?: unknown;
      rosterSnapshotAway?: unknown;
      journeymenHome?: unknown;
      journeymenAway?: unknown;
    };
    // CTV du match = valeurs figées (ou live) + journaliers si la feuille
    // n'est pas encore figée (les snapshots portent déjà les journaliers).
    const journeymanPositions = await loadJourneymanPositions(teamsLive);
    const teams = {
      home: withJourneymenValue(
        withFrozenTeamValues(teamsLive.home, snapForBudget.rosterSnapshotHome),
        "home",
        snapForBudget,
        journeymanPositions.home,
      ),
      away: withJourneymenValue(
        withFrozenTeamValues(teamsLive.away, snapForBudget.rosterSnapshotAway),
        "away",
        snapForBudget,
        journeymanPositions.away,
      ),
    };
    // A55 — le budget de l'underdog inclut la dépense adverse : on évalue
    // les deux sélections (payload prioritaire, sinon valeur déjà stockée).
    const sheetInd = sheet as {
      inducementsHome?: unknown;
      inducementsAway?: unknown;
    };
    const spentHome = sumGold(
      p.inducementsHome !== undefined
        ? p.inducementsHome
        : sheetInd.inducementsHome,
    );
    const spentAway = sumGold(
      p.inducementsAway !== undefined
        ? p.inducementsAway
        : sheetInd.inducementsAway,
    );
    const { budget } = await buildMatchSheetReference(teams, null, {
      home: spentHome,
      away: spentAway,
    });
    // FR17 — enforcement à la soumission : aucun coup de pouce hors allowlist
    // ligue. Les Star Players (slug "star_player") sont exemptés (ils
    // dépendent des rosters / règles régionales, pas de l'allowlist).
    const { allowlist, pack } = await loadLeagueInducementRules(
      input.pairingId,
    );
    // Le règlement pose une liste FERMÉE : elle borne l'allowlist de ligue.
    const effectiveAllowlist = effectiveInducementAllowlist(allowlist, pack);
    assertInducementsAllowed(p.inducementsHome, effectiveAllowlist, "domicile");
    assertInducementsAllowed(
      p.inducementsAway,
      effectiveAllowlist,
      "extérieur",
    );
    if (p.inducementsHome !== undefined) {
      const spent = sumGold(p.inducementsHome);
      if (spent > budget.home.maxBudget) {
        throw new MatchSheetError(
          "inducement_over_budget",
          `Budget de coups de pouce dépassé (domicile) : ${spent.toLocaleString("fr-FR")} po pour un budget de ${budget.home.maxBudget.toLocaleString("fr-FR")} po (petty cash ${budget.home.pettyCash.toLocaleString("fr-FR")} + trésorerie ${budget.home.treasury.toLocaleString("fr-FR")}).`,
        );
      }
    }
    if (p.inducementsAway !== undefined) {
      const spent = sumGold(p.inducementsAway);
      if (spent > budget.away.maxBudget) {
        throw new MatchSheetError(
          "inducement_over_budget",
          `Budget de coups de pouce dépassé (extérieur) : ${spent.toLocaleString("fr-FR")} po pour un budget de ${budget.away.maxBudget.toLocaleString("fr-FR")} po (petty cash ${budget.away.pettyCash.toLocaleString("fr-FR")} + trésorerie ${budget.away.treasury.toLocaleString("fr-FR")}).`,
        );
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (p.weatherTable !== undefined) data.weatherTable = p.weatherTable;
  if (p.weather !== undefined) data.weather = p.weather;
  if (p.forfeitSide !== undefined) data.forfeitSide = p.forfeitSide;
  if (p.tossWinner !== undefined) data.tossWinner = p.tossWinner;
  if (p.tossChoice !== undefined) data.tossChoice = p.tossChoice;
  if (p.popularityHome !== undefined) data.popularityHome = p.popularityHome;
  if (p.popularityAway !== undefined) data.popularityAway = p.popularityAway;
  // A63 — gains auto : (pop dom + pop ext) × 10k / 2 + 10k par TD de
  // l'equipe. La popularite change ici, les TD via les events : on
  // recalcule les deux gains avec l'etat courant (override manuel
  // toujours possible cote post-match).
  if (p.popularityHome !== undefined || p.popularityAway !== undefined) {
    const events = ((await prisma.leagueMatchEvent.findMany({
      where: { matchSheetId: sheet.id },
      orderBy: { occurredAt: "asc" },
    })) ?? []) as MatchEventInput[];
    const summary = summarizeMatchSheet(events);
    const stalled = computeStalledTeams(events);
    const winnings = computeMatchWinnings({
      popularityHome:
        p.popularityHome !== undefined
          ? p.popularityHome
          : ((sheet as { popularityHome?: number | null }).popularityHome ??
            null),
      popularityAway:
        p.popularityAway !== undefined
          ? p.popularityAway
          : ((sheet as { popularityAway?: number | null }).popularityAway ??
            null),
      scoreHome: summary.scoreHome,
      scoreAway: summary.scoreAway,
      stalledHome: stalled.home,
      stalledAway: stalled.away,
    });
    data.winningsHome = winnings.home;
    data.winningsAway = winnings.away;
  }
  if (p.inducementsHome !== undefined)
    data.inducementsHome = p.inducementsHome ?? undefined;
  if (p.inducementsAway !== undefined)
    data.inducementsAway = p.inducementsAway ?? undefined;
  if (p.prayersHome !== undefined)
    data.prayersHome = p.prayersHome ?? undefined;
  if (p.prayersAway !== undefined)
    data.prayersAway = p.prayersAway ?? undefined;
  // Journaliers : postes de lineman choisis. La colonne porte les deux
  // formes — `{ position }` (choix global, historique) et `{ positions }`
  // (choix par rang). Un PATCH qui ne touche qu'une des deux PRESERVE
  // l'autre : sans ca, choisir le poste du 2e journalier effacerait le
  // choix global deja pose (et inversement).
  const mergeJourneymenChoice = (
    current: unknown,
    position: string | null | undefined,
    positions: readonly (string | null)[] | null | undefined,
  ): { position?: string; positions?: (string | null)[] } | null => {
    const previous = parseJourneymenChoices(current);
    const nextPosition = position !== undefined ? position : previous.position;
    const nextPositions =
      positions !== undefined ? (positions ?? []) : previous.positions;
    const merged: { position?: string; positions?: (string | null)[] } = {};
    if (nextPosition) merged.position = nextPosition;
    if (nextPositions.some((slug) => slug !== null)) {
      merged.positions = [...nextPositions];
    }
    return Object.keys(merged).length > 0 ? merged : null;
  };
  if (
    p.journeymenChoiceHome !== undefined ||
    p.journeymenChoicesHome !== undefined
  ) {
    data.journeymenHome = mergeJourneymenChoice(
      (sheet as { journeymenHome?: unknown }).journeymenHome,
      p.journeymenChoiceHome,
      p.journeymenChoicesHome,
    );
  }
  if (
    p.journeymenChoiceAway !== undefined ||
    p.journeymenChoicesAway !== undefined
  ) {
    data.journeymenAway = mergeJourneymenChoice(
      (sheet as { journeymenAway?: unknown }).journeymenAway,
      p.journeymenChoiceAway,
      p.journeymenChoicesAway,
    );
  }

  return prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data,
  });
}

export interface PostMatchPayload {
  /** Override manuel du gain de tresorerie (prioritaire sur l'auto). */
  winningsHomeManual?: number | null;
  winningsAwayManual?: number | null;
  /** Variation de fans devoues (-1/0/+1 typiquement, clampe a la validation). */
  dedicatedFansDeltaHome?: number | null;
  dedicatedFansDeltaAway?: number | null;
  /** Bonus au classement (points) accorde par le commissaire. */
  rankingBonusHome?: number | null;
  rankingBonusAway?: number | null;
  /** SPP bonus "Nuffle" par joueur : [{ playerId, spp }]. */
  sppBonus?: unknown;
  /** Erreurs couteuses : [{ playerId?, cost, reason }]. */
  costlyErrorsHome?: unknown;
  costlyErrorsAway?: unknown;
  /** Achats post-match : [{ kind, name, cost }]. */
  purchasesHome?: unknown;
  purchasesAway?: unknown;
  /** Joueurs du match (MVP) : [playerId]. */
  motmPlayerIds?: readonly string[];
  /** Licenciements de fin de match : [teamPlayerId]. */
  firedPlayerIds?: readonly string[] | null;
  /**
   * Évolutions stagées par coach (appliquées aux rosters uniquement à
   * la validation commissaire). Un coach ne peut saisir que son côté.
   */
  advancementsHome?: readonly StagedAdvancement[] | null;
  advancementsAway?: readonly StagedAdvancement[] | null;
}

/**
 * Polish — Met a jour les infos d'apres-match (override tresorerie,
 * fans, erreurs couteuses, achats, MVP). Coachs + commissaire, avant
 * validation.
 */
export async function updatePostMatch(input: {
  pairingId: string;
  userId: string;
  payload: PostMatchPayload;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  const commissioner = isCommissioner(ctx, input.userId);
  if (!side && !commissioner) {
    throw new MatchSheetError("forbidden", "Action reservee aux participants");
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  ensureEditable(sheet.status);

  const p = input.payload;

  // Évolutions stagées : chaque coach ne saisit QUE son côté (le
  // commissaire peut corriger les deux) et chaque playerId doit
  // appartenir à l'équipe du côté visé.
  if (p.advancementsHome !== undefined || p.advancementsAway !== undefined) {
    if (p.advancementsHome !== undefined && !commissioner && side !== "home") {
      throw new MatchSheetError(
        "advancement_wrong_side",
        "Chaque coach ne peut saisir que les évolutions de sa propre équipe",
      );
    }
    if (p.advancementsAway !== undefined && !commissioner && side !== "away") {
      throw new MatchSheetError(
        "advancement_wrong_side",
        "Chaque coach ne peut saisir que les évolutions de sa propre équipe",
      );
    }
    const teams = await loadSheetTeams(input.pairingId);
    // Un JOURNALIER joue le match et peut prendre une évolution à l'étape 3
    // (matérialisée s'il est recruté) : il appartient au côté qui l'aligne,
    // sans avoir de ligne TeamPlayer. On le reconnaît par la même
    // dérivation que celle qui l'affiche sur la feuille — sinon l'API
    // refusait « Joueur journeyman-away-1 hors de l'équipe extérieur ».
    const stagesJourneyman = [
      ...(p.advancementsHome ?? []),
      ...(p.advancementsAway ?? []),
    ].some((e) => isJourneymanId(e.playerId));
    const journeymanPositions = stagesJourneyman
      ? await loadJourneymanPositions(teams)
      : { home: null, away: null };
    const sheetColumns = sheet as SheetJourneymenColumns;
    const assertOwnership = (
      entries: readonly StagedAdvancement[] | null | undefined,
      team: MatchSheetTeam | null,
      side: "home" | "away",
      label: string,
    ): void => {
      if (!entries || entries.length === 0) return;
      const ids = new Set((team?.players ?? []).map((pl) => pl.id));
      if (team && stagesJourneyman) {
        for (const j of deriveSideJourneymen(
          team,
          side,
          sheetColumns,
          side === "home" ? journeymanPositions.home : journeymanPositions.away,
        )) {
          ids.add(j.id);
        }
      }
      for (const e of entries) {
        if (!ids.has(e.playerId)) {
          throw new MatchSheetError(
            "advancement_invalid_player",
            `Joueur ${e.playerId} hors de l'équipe ${label}`,
          );
        }
      }
    };
    assertOwnership(p.advancementsHome, teams.home, "home", "domicile");
    assertOwnership(p.advancementsAway, teams.away, "away", "extérieur");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (p.winningsHomeManual !== undefined)
    data.winningsHomeManual = p.winningsHomeManual;
  if (p.winningsAwayManual !== undefined)
    data.winningsAwayManual = p.winningsAwayManual;
  if (p.dedicatedFansDeltaHome !== undefined)
    data.dedicatedFansDeltaHome = p.dedicatedFansDeltaHome;
  if (p.dedicatedFansDeltaAway !== undefined)
    data.dedicatedFansDeltaAway = p.dedicatedFansDeltaAway;
  if (p.rankingBonusHome !== undefined)
    data.rankingBonusHome = p.rankingBonusHome;
  if (p.rankingBonusAway !== undefined)
    data.rankingBonusAway = p.rankingBonusAway;
  if (p.sppBonus !== undefined) data.sppBonus = p.sppBonus ?? undefined;
  if (p.costlyErrorsHome !== undefined)
    data.costlyErrorsHome = p.costlyErrorsHome ?? undefined;
  if (p.costlyErrorsAway !== undefined)
    data.costlyErrorsAway = p.costlyErrorsAway ?? undefined;
  if (p.purchasesHome !== undefined)
    data.purchasesHome = p.purchasesHome ?? undefined;
  if (p.purchasesAway !== undefined)
    data.purchasesAway = p.purchasesAway ?? undefined;
  if (p.motmPlayerIds !== undefined) data.motmPlayerIds = [...p.motmPlayerIds];
  if (p.firedPlayerIds !== undefined)
    data.firedPlayerIds = [...(p.firedPlayerIds ?? [])];
  if (p.advancementsHome !== undefined)
    data.advancementsHome = [...(p.advancementsHome ?? [])];
  if (p.advancementsAway !== undefined)
    data.advancementsAway = [...(p.advancementsAway ?? [])];

  return prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data,
  });
}

function nextStatusOnSubmit(
  current: string,
  side: CoachSide,
): MatchSheetStatus {
  // home submit
  if (side === "home") {
    if (current === "submitted_away") return "both_submitted";
    return "submitted_home";
  }
  // away submit
  if (current === "submitted_home") return "both_submitted";
  return "submitted_away";
}

/**
 * Un coach valide sa saisie. Met a jour `submittedByHomeAt/AwayAt` et
 * transitionne le status. Quand les 2 ont valide -> `both_submitted`
 * (le commissaire sera notifie en G.H/Lot H).
 */
export async function submitByCoach(input: {
  pairingId: string;
  userId: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  if (!side) {
    throw new MatchSheetError(
      "not_a_participant",
      "Seuls les 2 coachs peuvent soumettre leur saisie",
    );
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  if (sheet.status === "validated") {
    throw new MatchSheetError("already_validated", "Feuille deja validee");
  }

  // Filet de sécurité : le gel complet est normalement posé à la CRÉATION
  // de la feuille. Une feuille antérieure au gel complet (ou dont la
  // capture avait échoué) est rattrapée ici, en préservant les valeurs
  // déjà figées. Best-effort : un échec ne bloque pas la soumission.
  const snapshotData = await captureMatchSnapshots(
    input.pairingId,
    sheet as {
      rosterSnapshotHome?: unknown;
      rosterSnapshotAway?: unknown;
      journeymenHome?: unknown;
      journeymenAway?: unknown;
    },
  );

  const next = nextStatusOnSubmit(sheet.status, side);
  const updated = await prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: next,
      ...(side === "home"
        ? { submittedByHomeAt: new Date() }
        : { submittedByAwayAt: new Date() }),
      ...snapshotData,
    },
  });

  // Lot H — quand les 2 coachs ont soumis, alerte le commissaire
  // (fire-and-forget, non-bloquant). On a deja `ctx` (creator + teams).
  if (next === "both_submitted") {
    notifyCommissionerSheetReady(ctx).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(
        `[league-match-sheet] notify commissioner failed: ${msg}`,
      );
    });
  }

  return updated;
}

/**
 * Lot H — Resout les noms d'equipe et declenche le push commissaire.
 * Isole pour rester testable / non-bloquant.
 */
async function notifyCommissionerSheetReady(
  ctx: PairingContext,
): Promise<void> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: ctx.pairingId },
    select: {
      homeParticipant: { select: { team: { select: { name: true } } } },
      awayParticipant: { select: { team: { select: { name: true } } } },
    },
  })) as {
    homeParticipant: { team: { name: string } } | null;
    awayParticipant: { team: { name: string } } | null;
  } | null;
  sendLeagueMatchValidationPush({
    commissionerUserId: ctx.creatorId,
    leagueId: ctx.leagueId,
    pairingId: ctx.pairingId,
    homeTeamName: pairing?.homeParticipant?.team.name ?? "?",
    awayTeamName: pairing?.awayParticipant?.team.name ?? "?",
  });
}

/** Un coach retire sa soumission (revient en arriere). */
export async function unsubmitByCoach(input: {
  pairingId: string;
  userId: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  if (!side) {
    throw new MatchSheetError("not_a_participant", "Reserve aux coachs");
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  if (sheet.status === "validated") {
    throw new MatchSheetError("already_validated", "Feuille deja validee");
  }

  // Determine le status apres retrait : si l'autre coach a soumis,
  // on retombe sur son submitted_*, sinon draft.
  const homeStill = side === "home" ? false : sheet.submittedByHomeAt != null;
  const awayStill = side === "away" ? false : sheet.submittedByAwayAt != null;
  const next: MatchSheetStatus = homeStill
    ? "submitted_home"
    : awayStill
      ? "submitted_away"
      : "draft";

  return prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: next,
      ...(side === "home"
        ? { submittedByHomeAt: null }
        : { submittedByAwayAt: null }),
    },
  });
}

/**
 * Lot G.2 — Mappe la severite du summarizer vers le type de blessure
 * du pipeline offline. `badly_hurt` n'a pas d'effet durable (BB) ⇒
 * non mappe. `stat_loss` necessite la carac visee : on la lit dans
 * `meta.stat` (ma/st/ag/pa/av), sinon la blessure est ignoree.
 */
function mapInjurySeverity(
  severity: InjurySeverity,
  metaStat: string | null,
): OfflineInjuryType | null {
  switch (severity) {
    case "mng":
      return "mng";
    case "niggling":
      return "niggling";
    case "dead":
      return "dead";
    case "stat_loss": {
      const stat = (metaStat ?? "").toLowerCase();
      if (
        stat === "ma" ||
        stat === "st" ||
        stat === "ag" ||
        stat === "pa" ||
        stat === "av"
      ) {
        return stat as OfflineInjuryType;
      }
      return null;
    }
    case "badly_hurt":
    default:
      return null;
  }
}

/**
 * Lot G.2 — Construit l'input du pipeline offline a partir du summary
 * derive + des champs de la feuille (winnings override, fans, MVP).
 * Pur (testable). Les statLines portent deja le `side` ; le pipeline
 * offline resout l'equipe via le teamPlayerId.
 */
/**
 * Somme tolerante des couts (or) d'une liste JSON `[{ cost, qty? }]`
 * (coups de pouce / erreurs couteuses / achats). Accepte array natif (PG)
 * ou string serialisee (sqlite mirror). Ignore les entrees illisibles.
 */
function sumGold(raw: unknown): number {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return 0;
    }
  }
  if (!Array.isArray(arr)) return 0;
  let total = 0;
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const cost = (entry as { cost?: unknown }).cost;
    const qty = (entry as { qty?: unknown }).qty;
    const c = typeof cost === "number" && Number.isFinite(cost) ? cost : 0;
    const q =
      typeof qty === "number" && Number.isFinite(qty) && qty > 0 ? qty : 1;
    total += Math.max(0, Math.floor(c)) * q;
  }
  return total;
}

/**
 * Joueurs de la feuille porteurs d'un slug de POSTE : le roster réel plus
 * les journaliers alignés (dérivés du même catalogue de positions). Sert à
 * résoudre leurs Mots-clés pour l'acquisition de Haine (X).
 */
function collectPositionedSheetPlayers(
  team: MatchSheetTeam | null,
  side: "home" | "away",
  journeymenChoiceRaw: unknown,
  positions?: readonly JourneymanSourcePosition[] | null,
  frozenRosterSnapshot?: unknown,
): Array<{ id: string; position: string }> {
  if (!team) return [];
  const out = team.players.map((p) => ({ id: p.id, position: p.position }));
  for (const j of deriveMatchJourneymen({
    side,
    roster: team.roster,
    ruleset: team.ruleset,
    players: team.players,
    ...journeymenChoiceInput(journeymenChoiceRaw),
    positions,
    frozenRosterSnapshot,
  })) {
    out.push({ id: j.id, position: j.position });
  }
  return out;
}

export function buildOfflineInputFromSummary(
  pairingId: string,
  summary: MatchSummary,
  sheet: {
    motmPlayerIds?: unknown;
    /** Polish — gain auto calcule (depuis popularite). */
    winningsHome?: number | null;
    winningsAway?: number | null;
    /** Override manuel commissaire (prioritaire). */
    winningsHomeManual?: number | null;
    winningsAwayManual?: number | null;
    dedicatedFansDeltaHome?: number | null;
    dedicatedFansDeltaAway?: number | null;
    /** Bonus au classement (points) commissaire. */
    rankingBonusHome?: number | null;
    rankingBonusAway?: number | null;
    /** SPP bonus "Nuffle" par joueur : [{ playerId, spp }]. */
    sppBonus?: unknown;
    /** Prieres a Nuffle achetees en coup de pouce (D16). */
    prayersHome?: unknown;
    prayersAway?: unknown;
    /** Depenses post/avant-match (debit treasury). */
    inducementsHome?: unknown;
    inducementsAway?: unknown;
    costlyErrorsHome?: unknown;
    costlyErrorsAway?: unknown;
    purchasesHome?: unknown;
    purchasesAway?: unknown;
    /** Licenciements de fin de match : [teamPlayerId]. */
    firedPlayerIds?: unknown;
  },
  eventsForMeta: ReadonlyArray<MatchEventInput & { meta?: unknown }>,
  /**
   * Petty cash recu par chaque equipe (regles BB). Les coups de pouce sont
   * d'abord payes avec le petty cash : seul l'excedent debite la tresorerie.
   * Defaut 0/0 (retro-compat) : tout le cout des coups de pouce debite alors
   * la tresorerie comme avant.
   */
  pettyCash: { home: number; away: number } = { home: 0, away: 0 },
  /**
   * Haine (X) — CSV de Mots-cles par id de joueur de la feuille (roster
   * reel, journaliers, Star Players engages). Vide => aucun candidat, la
   * validation se comporte comme avant.
   */
  keywordsByPlayerId: ReadonlyMap<string, string> = new Map(),
) {
  const motm = parseStringArray(sheet.motmPlayerIds);
  const motmSet = new Set(motm);

  // Les journaliers ET les Star Players engagés sont des joueurs
  // SYNTHETIQUES de la feuille (aucune ligne TeamPlayer) : leurs
  // stats/blessures/bonus restent visibles sur la feuille mais ne doivent
  // PAS partir en persistance post-match (updates Prisma sur des ids
  // inexistants).
  const playerStats: OfflinePlayerStatInput[] = summary.playerStats
    .filter((p) => !isSyntheticSheetPlayerId(p.playerId))
    .map((p) => ({
      teamPlayerId: p.playerId,
      touchdowns: p.touchdowns,
      casualties: p.casualtiesInflicted,
      completions: p.completions,
      interceptions: p.interceptions,
      ttmLandings: p.ttmLandings,
      mvp: motmSet.has(p.playerId),
    }));

  // Les MVP sans stat-line (joueur primé sans event) doivent quand meme
  // recevoir le flag mvp -> on les ajoute.
  for (const id of motm) {
    if (isSyntheticSheetPlayerId(id)) continue;
    if (!playerStats.some((p) => p.teamPlayerId === id)) {
      playerStats.push({ teamPlayerId: id, mvp: true });
    }
  }

  // Map stat de blessure via meta de l'event source (best-effort : on
  // associe par targetPlayerId+severity au 1er event matchant).
  const injuries: OfflineInjuryInput[] = [];
  // Haine (X) : victime + auteur de la sortie, avant filtrage du type de
  // blessure (fait par `buildHateCandidates`).
  const hateInjuries: HateInjuryInput[] = [];
  for (const inj of summary.injuries) {
    if (isSyntheticSheetPlayerId(inj.playerId)) continue;
    // A62 — la victime d'un other_elim est portee par actorPlayerId
    // (auto-elimination sans cible) : on matche acteur OU cible.
    const src = eventsForMeta.find(
      (e) =>
        (e.targetPlayerId === inj.playerId ||
          e.actorPlayerId === inj.playerId) &&
        (e.injurySeverity as string | null) === inj.severity,
    );
    const metaStat =
      src && src.meta && typeof src.meta === "object"
        ? (((src.meta as Record<string, unknown>).stat as string | undefined) ??
          null)
        : null;
    const type = mapInjurySeverity(inj.severity, metaStat);
    if (type) {
      injuries.push({ teamPlayerId: inj.playerId, type });
      // L'auteur PEUT etre synthetique (journalier, Star Player) : se
      // faire sortir par un Star Player donne un ennemi comme un autre.
      hateInjuries.push({
        victimPlayerId: inj.playerId,
        causerPlayerId: inj.causedByPlayerId ?? null,
        injuryType: type,
      });
    }
  }

  return {
    pairingId,
    scoreHome: summary.scoreHome,
    scoreAway: summary.scoreAway,
    casualtiesHome: summary.casualtiesHome,
    casualtiesAway: summary.casualtiesAway,
    playerStats,
    // Polish — override manuel prioritaire, sinon gain auto-calcule.
    winningsHome: sheet.winningsHomeManual ?? sheet.winningsHome ?? undefined,
    winningsAway: sheet.winningsAwayManual ?? sheet.winningsAway ?? undefined,
    // Depenses = coups de pouce + erreurs couteuses + achats -> debit treasury.
    // Les coups de pouce sont d'abord couverts par le petty cash : seul
    // l'excedent debite la tresorerie (regle officielle BB).
    treasuryDebitHome:
      Math.max(0, sumGold(sheet.inducementsHome) - pettyCash.home) +
      sumGold(sheet.costlyErrorsHome) +
      sumGold(sheet.purchasesHome),
    treasuryDebitAway:
      Math.max(0, sumGold(sheet.inducementsAway) - pettyCash.away) +
      sumGold(sheet.costlyErrorsAway) +
      sumGold(sheet.purchasesAway),
    dedicatedFansDeltaHome: sheet.dedicatedFansDeltaHome ?? undefined,
    dedicatedFansDeltaAway: sheet.dedicatedFansDeltaAway ?? undefined,
    rankingBonusHome: sheet.rankingBonusHome ?? undefined,
    rankingBonusAway: sheet.rankingBonusAway ?? undefined,
    // SPP bonus persistes = saisie manuelle du commissaire + PSP dus aux
    // Prieres a Nuffle. Les deux passent par le meme canal, donc par la
    // meme reversion a l'invalidation. Les joueurs SYNTHETIQUES (journaliers,
    // Star Players) en sont exclus : ils n'ont pas de ligne TeamPlayer — les
    // PSP d'un journalier ne comptent qu'a son recrutement, via
    // `computeSheetSpp`, qui applique les memes prieres.
    sppBonus: [
      ...parseSppBonus(sheet.sppBonus),
      ...computePrayerSppBonuses({
        summary,
        prayersHome: sheet.prayersHome,
        prayersAway: sheet.prayersAway,
      }).map((b) => ({ teamPlayerId: b.playerId, spp: b.spp })),
    ].filter((b) => !isSyntheticSheetPlayerId(b.teamPlayerId)),
    injuries,
    // Achats -> materialisation roster (le debit treasury est deja porte
    // par treasuryDebit ci-dessus : pas de double-debit).
    purchasesHome: parsePurchases(sheet.purchasesHome),
    purchasesAway: parsePurchases(sheet.purchasesAway),
    // Licenciements -> firedAt (retire du roster actif, reversible).
    firedPlayerIds: parseStringArray(sheet.firedPlayerIds).filter(
      (id) => !isSyntheticSheetPlayerId(id),
    ),
    // Haine (X) : le D6 est jete a l'application (cf. league-hate-trait).
    hateCandidates: buildHateCandidates({
      injuries: hateInjuries,
      keywordsByPlayerId,
    }),
  };
}

/**
 * Parse tolerant du SPP bonus stocke (array PG / string sqlite) :
 * [{ playerId, spp }] -> [{ teamPlayerId, spp }].
 */
function parseSppBonus(
  raw: unknown,
): Array<{ teamPlayerId: string; spp: number }> {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: Array<{ teamPlayerId: string; spp: number }> = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const id = (e as { playerId?: unknown }).playerId;
    const spp = (e as { spp?: unknown }).spp;
    if (
      typeof id === "string" &&
      typeof spp === "number" &&
      Number.isFinite(spp)
    ) {
      out.push({ teamPlayerId: id, spp: Math.floor(spp) });
    }
  }
  return out;
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Le commissaire valide la feuille.
 *
 * Lot G.2 — Applique les effets via `recordOfflineLeagueResult`
 * (classement W/D/L + points + bonus Lot E, SPP + level-up, blessures
 * durables, tresorerie, fans devoues, pairing -> played). Le pipeline
 * est idempotent : si le match a deja ete compte (skip), on marque
 * quand meme la feuille validee.
 *
 * Si l'application des effets echoue (throw), la feuille reste en
 * `both_submitted` et l'erreur est propagee — pas de validation
 * partielle.
 */
/**
 * Étape 4 de la séquence BB (EMBAUCHES) — matérialise les recrutements de
 * journaliers saisis sur la feuille.
 *
 * La saisie du coach ne porte que l'id synthétique du journalier : le
 * serveur redérive le journalier (poste, compétences, stats), ses PSP
 * officiels du match et l'évolution stagée pour lui à l'étape 3, puis
 * calcule le prix (coût du poste + surcoût de l'évolution) et l'état du
 * TeamPlayer à créer. Un id inconnu, un journalier absent ou un doublon
 * sont ignorés (l'achat retombe en « dépense diverse » : la trésorerie est
 * débitée, aucun joueur créé).
 */
function enrichJourneymanPurchases(input: {
  purchases: readonly OfflinePurchaseInput[];
  side: "home" | "away";
  team: MatchSheetTeam | null;
  choiceRaw: unknown;
  staged: readonly StagedAdvancement[];
  computedSpp: Record<string, number>;
  positions?: readonly JourneymanSourcePosition[] | null;
  /** Slugs Elite du ruleset : +10 000 po de valeur par competence Elite. */
  eliteSlugs?: ReadonlySet<string>;
  /**
   * Lot 6.2 — barème de l'édition de l'équipe (coût PSP et surcoût de VE de
   * l'évolution du journalier). Absent ⇒ barème compilé.
   */
  schedule?: AdvancementSchedule;
  /** Roster figé de ce côté : les journaliers RECRUTABLES sont ceux du match. */
  frozenRosterSnapshot?: unknown;
}): OfflinePurchaseInput[] {
  const { purchases, side, team, staged, computedSpp } = input;
  if (!purchases.some((p) => p.kind === "journeyman")) return [...purchases];
  const journeymen = team
    ? deriveMatchJourneymen({
        side,
        roster: team.roster,
        ruleset: team.ruleset,
        players: team.players,
        ...journeymenChoiceInput(input.choiceRaw),
        positions: input.positions,
        frozenRosterSnapshot: input.frozenRosterSnapshot,
      })
    : [];
  const byId = new Map(journeymen.map((j) => [j.id, j]));
  const hired = new Set<string>();

  return purchases.map((p) => {
    if (p.kind !== "journeyman") return p;
    const journeyman = p.journeymanId ? byId.get(p.journeymanId) : undefined;
    if (!journeyman || hired.has(journeyman.id)) {
      serverLog.warn(
        `[league-match-sheet] recrutement de journalier ignoré (${side}) : id="${p.journeymanId ?? ""}"`,
      );
      return { ...p, kind: "other" as const };
    }
    hired.add(journeyman.id);
    const entry = staged.find((e) => e.playerId === journeyman.id);
    const hire = buildJourneymanHire({
      journeyman,
      earnedSpp: computedSpp[journeyman.id] ?? 0,
      advancement: entry
        ? {
            type: entry.type,
            skillSlug: entry.skillSlug,
            stat: entry.stat,
            d8: entry.d8,
            // Un journalier n'a jamais d'avancement : 1er palier.
            pspCost: getNextAdvancementPspCost(0, entry.type, input.schedule),
            // `isElite` etait omis : les 10 000 po de surcout d'une
            // competence Elite manquaient au prix de recrutement du
            // journalier (donc a la VE de l'equipe et au debit).
            valueSurcharge: surchargeForAdvancement(
              {
                type: entry.type,
                stat: entry.stat ?? undefined,
                isElite:
                  !!entry.skillSlug &&
                  (input.eliteSlugs?.has(entry.skillSlug) ?? false),
              },
              input.schedule,
            ),
          }
        : null,
    });
    return {
      ...p,
      cost: hire.cost,
      position: journeyman.position,
      name: p.name || journeyman.name,
      spp: hire.spp,
      skills: hire.skills,
      advancements: hire.advancements,
      stats: hire.stats,
    };
  });
}

export async function validateByCommissioner(input: {
  pairingId: string;
  userId: string;
}): Promise<{
  sheet: unknown;
  summary: MatchSummary;
  effects: { applied: boolean; reason?: string };
  /**
   * Haine (X) — jets d'après-match de cette validation. Le D6 est lancé
   * SERVEUR : sans ce retour, le commissaire ne saurait jamais qu'il a eu
   * lieu. Vide quand aucune sortie ne remplit les conditions.
   */
  hateRolls: readonly HateRoll[];
}> {
  const ctx = await loadPairingContext(input.pairingId);
  if (!isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError(
      "forbidden",
      "Seul le commissaire peut valider la feuille",
    );
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  if (sheet.status === "validated") {
    throw new MatchSheetError("already_validated", "Feuille deja validee");
  }

  const events = (await prisma.leagueMatchEvent.findMany({
    where: { matchSheetId: sheet.id },
    orderBy: { occurredAt: "asc" },
  })) as Array<MatchEventInput & { meta?: unknown }>;
  // Les PSP d'une Élimination sur Action Spéciale ne vont qu'aux joueurs
  // ayant Innovateur Violent : le summarizer a besoin de leurs ids.
  const teamsForBudgetLive = await loadSheetTeams(input.pairingId);
  const summary = summarizeMatchSheet(events, {
    violentInnovators: collectViolentInnovators(teamsForBudgetLive),
  });

  // Forfait declare a l'avant-match : on route vers recordForfeit (le cote
  // adverse gagne 2-0, bareme forfeit) au lieu de la saisie normale. Pas de
  // SPP/tresorerie : un match forfait n'a pas de stats.
  const forfeitSide = (sheet as { forfeitSide?: string | null }).forfeitSide;
  if (forfeitSide === "home" || forfeitSide === "away") {
    const ff = await recordForfeit({
      pairingId: input.pairingId,
      side: forfeitSide,
    });
    const updatedFf = await prisma.leagueMatchSheet.update({
      where: { id: sheet.id },
      data: {
        status: "validated",
        validatedAt: new Date(),
        validatedById: input.userId,
        scoreHome: forfeitSide === "home" ? 0 : 2,
        scoreAway: forfeitSide === "away" ? 0 : 2,
      },
    });
    return {
      sheet: updatedFf,
      summary,
      effects: { applied: "recorded" in ff && ff.recorded },
      // Un forfait n'a ni sortie ni blessure : aucun jet de Haine.
      hateRolls: [],
    };
  }

  // Petty cash par equipe (regles BB) : sert a ne debiter la tresorerie que
  // de l'excedent de coups de pouce au-dela du petty cash recu. A55 — la
  // cagnotte de l'underdog inclut la depense adverse. Les CTV/tresoreries
  // utilisees sont FIGEES au debut du match (snapshot 1re soumission).
  const sheetSnapForBudget = sheet as {
    rosterSnapshotHome?: unknown;
    rosterSnapshotAway?: unknown;
  };
  const sheetJourneymenForBudget = sheet as {
    rosterSnapshotHome?: unknown;
    rosterSnapshotAway?: unknown;
    journeymenHome?: unknown;
    journeymenAway?: unknown;
  };
  const journeymanPositions = await loadJourneymanPositions(teamsForBudgetLive);
  const teamsForBudget = {
    home: withJourneymenValue(
      withFrozenTeamValues(
        teamsForBudgetLive.home,
        sheetSnapForBudget.rosterSnapshotHome,
      ),
      "home",
      sheetJourneymenForBudget,
      journeymanPositions.home,
    ),
    away: withJourneymenValue(
      withFrozenTeamValues(
        teamsForBudgetLive.away,
        sheetSnapForBudget.rosterSnapshotAway,
      ),
      "away",
      sheetJourneymenForBudget,
      journeymanPositions.away,
    ),
  };
  const sheetIndForBudget = sheet as {
    inducementsHome?: unknown;
    inducementsAway?: unknown;
  };
  const { budget } = await buildMatchSheetReference(teamsForBudget, null, {
    home: sumGold(sheetIndForBudget.inducementsHome),
    away: sumGold(sheetIndForBudget.inducementsAway),
  });

  // A63 — les gains auto dependent du score final (10k/TD) et du bonus
  // « sans temporisation » (+10k si aucun event stalling pour l'equipe) :
  // on les recalcule a la validation avec le summary derive des events,
  // plutot que de faire confiance a la valeur stockee au pre-match.
  const sheetPop = sheet as {
    popularityHome?: number | null;
    popularityAway?: number | null;
  };
  const stalledAtValidation = computeStalledTeams(events);
  const autoWinnings = computeMatchWinnings({
    popularityHome: sheetPop.popularityHome ?? null,
    popularityAway: sheetPop.popularityAway ?? null,
    scoreHome: summary.scoreHome,
    scoreAway: summary.scoreAway,
    stalledHome: stalledAtValidation.home,
    stalledAway: stalledAtValidation.away,
  });

  // Haine (X) — mots-cles des joueurs POUVANT avoir cause une sortie :
  // roster reel, journaliers alignes et Star Players engages. Best-effort :
  // une resolution en echec ne fait perdre que l'acquisition du trait.
  let keywordsByPlayerId: ReadonlyMap<string, string> = new Map();
  try {
    keywordsByPlayerId = await buildSheetKeywordMap({
      positionedPlayers: [
        ...collectPositionedSheetPlayers(
          teamsForBudget.home,
          "home",
          sheetJourneymenForBudget.journeymenHome,
          journeymanPositions.home,
          sheetSnapForBudget.rosterSnapshotHome,
        ),
        ...collectPositionedSheetPlayers(
          teamsForBudget.away,
          "away",
          sheetJourneymenForBudget.journeymenAway,
          journeymanPositions.away,
          sheetSnapForBudget.rosterSnapshotAway,
        ),
      ],
      starPlayerIds: [
        ...(await deriveSheetStarPlayers({
          side: "home",
          inducements: sheetIndForBudget.inducementsHome,
          ruleset: teamsForBudget.home?.ruleset,
        })),
        ...(await deriveSheetStarPlayers({
          side: "away",
          inducements: sheetIndForBudget.inducementsAway,
          ruleset: teamsForBudget.away?.ruleset,
        })),
      ].map((sp) => sp.id),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(
      `[league-match-sheet] resolution des mots-cles (Haine) echouee: ${msg}`,
    );
  }

  // Applique les effets (peut throw -> on ne valide pas).
  const offlineInput = buildOfflineInputFromSummary(
    input.pairingId,
    summary,
    {
      ...(sheet as Record<string, unknown>),
      winningsHome: autoWinnings.home,
      winningsAway: autoWinnings.away,
    } as {
      motmPlayerIds?: unknown;
      winningsHome?: number | null;
      winningsAway?: number | null;
      winningsHomeManual?: number | null;
      winningsAwayManual?: number | null;
      dedicatedFansDeltaHome?: number | null;
      dedicatedFansDeltaAway?: number | null;
      rankingBonusHome?: number | null;
      rankingBonusAway?: number | null;
      sppBonus?: unknown;
      // Prieres a Nuffle : « Passe Parfaite » et « Reception Etourdissante »
      // creditent des PSP a la validation, via `sppBonus`.
      prayersHome?: unknown;
      prayersAway?: unknown;
      inducementsHome?: unknown;
      inducementsAway?: unknown;
      costlyErrorsHome?: unknown;
      costlyErrorsAway?: unknown;
      purchasesHome?: unknown;
      purchasesAway?: unknown;
      firedPlayerIds?: unknown;
    },
    events,
    { home: budget.home.pettyCash, away: budget.away.pettyCash },
    keywordsByPlayerId,
  );

  // Évolutions stagées par les coachs pendant la saisie. Séquence BB de
  // fin de match (livre p.68) : elles s'appliquent à l'ÉTAPE 3, donc
  // APRÈS l'attribution des PSP/blessures et AVANT les embauches de
  // l'étape 4 — une compétence gagnée ici change le prix de recrutement
  // d'un journalier et la VE de l'équipe au moment des achats.
  // `recordOfflineLeagueResult` déclenche le hook au bon moment ; les
  // entrées sont réécrites enrichies ({ applied, cost } / { applied:
  // false, skipReason }) — trace pour l'UI + support du reversal à
  // l'invalidation. Tolérant : une entrée refusée (PSP insuffisants,
  // accès, candidats du tirage…) ne bloque pas la validation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const advData: any = {};
  const sheetAdv = sheet as {
    advancementsHome?: unknown;
    advancementsAway?: unknown;
  };
  const stagedHome = parseStagedAdvancements(sheetAdv.advancementsHome);
  const stagedAway = parseStagedAdvancements(sheetAdv.advancementsAway);
  // Un JOURNALIER n'a pas de ligne TeamPlayer : son évolution ne peut pas
  // passer par `applyStagedAdvancements`. Elle est matérialisée à l'étape 4
  // s'il est RECRUTÉ (cf. `enrichJourneymanPurchases`), sinon perdue avec
  // lui — il quitte l'équipe à la fin du match.
  const rosterStaged = (entries: readonly StagedAdvancement[]) =>
    entries.filter((e) => !isSyntheticSheetPlayerId(e.playerId));
  const applyAdvancements = async (): Promise<void> => {
    const rosterHome = rosterStaged(stagedHome);
    const rosterAway = rosterStaged(stagedAway);
    if (rosterHome.length > 0 && teamsForBudget.home?.teamId) {
      advData.advancementsHome = await applyStagedAdvancements({
        teamId: teamsForBudget.home.teamId,
        entries: rosterHome,
      });
    }
    if (rosterAway.length > 0 && teamsForBudget.away?.teamId) {
      advData.advancementsAway = await applyStagedAdvancements({
        teamId: teamsForBudget.away.teamId,
        entries: rosterAway,
      });
    }
  };

  // Étape 4 — EMBAUCHES : un journalier recruté est matérialisé avec ce
  // qu'il a gagné au match (PSP + évolution de l'étape 3, qui renchérit son
  // prix). Le serveur redérive tout (PSP officiels, coût du poste) : la
  // saisie du coach ne porte que l'id du journalier.
  const sheetPrayers = sheet as {
    prayersHome?: unknown;
    prayersAway?: unknown;
  };
  const computedSppForHire = await computeSheetSpp({
    summary,
    motmPlayerIds: (sheet as { motmPlayerIds?: unknown }).motmPlayerIds,
    teams: teamsForBudget,
    prayersHome: sheetPrayers.prayersHome,
    prayersAway: sheetPrayers.prayersAway,
  });
  const sheetJourneymenChoice = sheet as {
    journeymenHome?: unknown;
    journeymenAway?: unknown;
  };
  const eliteSlugsForHire = await getEliteSkillSlugs(
    prisma,
    teamsForBudget.home?.ruleset ?? teamsForBudget.away?.ruleset ?? null,
  );
  // Lot 6.2 — barème de l'édition de CHAQUE équipe : le prix d'un journalier
  // recruté inclut le surcoût de VE de son évolution, qui n'est pas le même
  // en Saison 2 et en Saison 3.
  const [scheduleHome, scheduleAway] = await Promise.all([
    loadAdvancementSchedule(
      (teamsForBudget.home?.ruleset as Ruleset) ?? undefined,
    ),
    loadAdvancementSchedule(
      (teamsForBudget.away?.ruleset as Ruleset) ?? undefined,
    ),
  ]);
  const enrichedPurchases = {
    home: enrichJourneymanPurchases({
      purchases: offlineInput.purchasesHome,
      side: "home",
      team: teamsForBudget.home,
      choiceRaw: sheetJourneymenChoice.journeymenHome,
      staged: stagedHome,
      computedSpp: computedSppForHire,
      positions: journeymanPositions.home,
      eliteSlugs: eliteSlugsForHire,
      schedule: scheduleHome,
      frozenRosterSnapshot: sheetSnapForBudget.rosterSnapshotHome,
    }),
    away: enrichJourneymanPurchases({
      purchases: offlineInput.purchasesAway,
      side: "away",
      team: teamsForBudget.away,
      choiceRaw: sheetJourneymenChoice.journeymenAway,
      staged: stagedAway,
      computedSpp: computedSppForHire,
      positions: journeymanPositions.away,
      eliteSlugs: eliteSlugsForHire,
      schedule: scheduleAway,
      frozenRosterSnapshot: sheetSnapForBudget.rosterSnapshotAway,
    }),
  };

  const outcome = await recordOfflineLeagueResult({
    ...offlineInput,
    purchasesHome: enrichedPurchases.home,
    purchasesAway: enrichedPurchases.away,
    ...(rosterStaged(stagedHome).length > 0 ||
    rosterStaged(stagedAway).length > 0
      ? { applyAdvancements }
      : {}),
  });

  let effects: { applied: boolean; reason?: string };
  let hateRolls: readonly HateRoll[] = [];
  if ("recorded" in outcome && outcome.recorded) {
    effects = { applied: true };
    hateRolls = outcome.hateRolls;
  } else if ("skipped" in outcome) {
    // already-scored / not-terminal-eligible : effets deja en place.
    effects = { applied: false, reason: outcome.reason };
    serverLog.info(
      `[league-match-sheet] validate: offline skipped (${outcome.reason}) pairing=${input.pairingId}`,
    );
  } else {
    effects = { applied: false };
  }

  const updated = await prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: "validated",
      validatedAt: new Date(),
      validatedById: input.userId,
      scoreHome: summary.scoreHome,
      scoreAway: summary.scoreAway,
      ...advData,
    },
  });
  return { sheet: updated, summary, effects, hateRolls };
}

/**
 * Polish — Determine si la feuille validee peut encore etre invalidee.
 *
 * Regle : invalidation autorisee TANT QUE les 2 equipes n'ont pas
 * chacune rejoue un autre match (pairing `played`/`forfeit_*` a un
 * round ULTERIEUR). Des que les DEUX equipes ont enchaine, la fenetre
 * se ferme (le classement aval depend de ce resultat).
 *
 * Retourne `{ ok: true }` ou `{ ok: false, reason }`.
 */
export async function canInvalidateMatchSheet(input: {
  pairingId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: input.pairingId },
    select: {
      id: true,
      homeParticipantId: true,
      awayParticipantId: true,
      round: { select: { seasonId: true, roundNumber: true } },
    },
  })) as {
    id: string;
    homeParticipantId: string;
    awayParticipantId: string;
    round: { seasonId: string; roundNumber: number };
  } | null;
  if (!pairing) return { ok: false, reason: "pairing_not_found" };

  const TERMINAL_PLAYED = ["played", "forfeit_home", "forfeit_away"];
  const laterPlayedFor = async (participantId: string): Promise<number> =>
    prisma.leaguePairing.count({
      where: {
        id: { not: pairing.id },
        status: { in: TERMINAL_PLAYED },
        round: {
          seasonId: pairing.round.seasonId,
          roundNumber: { gt: pairing.round.roundNumber },
        },
        OR: [
          { homeParticipantId: participantId },
          { awayParticipantId: participantId },
        ],
      },
    });

  const [homeLater, awayLater] = await Promise.all([
    laterPlayedFor(pairing.homeParticipantId),
    laterPlayedFor(pairing.awayParticipantId),
  ]);

  // Fenetre fermee uniquement si LES DEUX equipes ont rejoue.
  if (homeLater > 0 && awayLater > 0) {
    return { ok: false, reason: "both_teams_played_later" };
  }
  return { ok: true };
}

/**
 * Polish — Invalide une feuille validee (commissaire). Reverse les
 * effets via `reverseOfflineLeagueResult` (classement/SPP/treso/fans)
 * puis repasse la feuille en `invalidated` pour permettre une
 * correction. Respecte la fenetre `canInvalidateMatchSheet`.
 */
/**
 * Explication lisible d'un refus de reversion. Le commissaire voyait un
 * code brut (« Reversion impossible: playoffs-generated ») sans savoir ce
 * qu'il pouvait y faire.
 */
function reversionRefusalMessage(reason: ReverseOfflineSkipReason): string {
  switch (reason) {
    case "season-completed":
      return "la saison est cloturee, son classement final est fige";
    case "playoffs-generated":
      return "les playoffs sont generes : le classement de la phase reguliere est fige (un match DE playoff, lui, reste invalidable)";
    case "playoff-round-advanced":
      return "le tour suivant du bracket a deja demarre : invalidez-le d'abord";
    case "advancement-consumed":
      return "un joueur a deja depense les PSP de ce match";
    case "purchase-consumed":
      return "un joueur achete apres ce match a deja joue ou progresse";
    case "match-missing":
    case "not-offline-match":
    case "not-scored":
    case "snapshot-missing":
    case "pairing-missing":
      return "le resultat enregistre est introuvable ou incomplet";
  }
}

export async function invalidateMatchSheet(input: {
  pairingId: string;
  userId: string;
  reason?: string;
  /**
   * Deblocage `advancement-consumed` : retire aussi les evolutions
   * consommees APRES ce match (PSP rembourses, competence/carac
   * retiree) au lieu de refuser l'invalidation. Opt-in explicite du
   * commissaire, confirme cote UI.
   */
  removeConsumedAdvancements?: boolean;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  if (!isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError(
      "forbidden",
      "Seul le commissaire peut invalider la feuille",
    );
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  if (sheet.status !== "validated") {
    throw new MatchSheetError(
      "not_validated",
      "Seule une feuille validee peut etre invalidee",
    );
  }

  const window = await canInvalidateMatchSheet({ pairingId: input.pairingId });
  if (!window.ok) {
    throw new MatchSheetError(
      "invalidation_window_closed",
      "Fenetre de correction fermee : les 2 equipes ont deja rejoue",
    );
  }

  // Retrouve le Match offline synthetique du pairing pour le reverser.
  const match = (await prisma.match.findFirst({
    where: { leaguePairingId: input.pairingId, leagueScoredAt: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })) as { id: string } | null;

  const sheetAdv = sheet as {
    advancementsHome?: unknown;
    advancementsAway?: unknown;
  };
  const stagedHome = parseStagedAdvancements(sheetAdv.advancementsHome);
  const stagedAway = parseStagedAdvancements(sheetAdv.advancementsAway);

  // Evolutions appliquees PAR CETTE FEUILLE (elles seront reversees
  // juste apres) : le garde-fou `advancement-consumed` de la reversion
  // les deduit du compte courant, sinon toute feuille validee avec une
  // evolution choisie serait a jamais non-invalidable.
  const sheetAppliedAdvancements = new Map<string, number>();
  for (const entry of [...stagedHome, ...stagedAway]) {
    if (entry.applied !== true) continue;
    sheetAppliedAdvancements.set(
      entry.playerId,
      (sheetAppliedAdvancements.get(entry.playerId) ?? 0) + 1,
    );
  }

  if (match) {
    const reversed = await reverseOfflineLeagueResult(match.id, {
      sheetAppliedAdvancements,
      removeConsumedAdvancements: input.removeConsumedAdvancements === true,
    });
    if ("skipped" in reversed) {
      // Reversion impossible (mort, saison cloturee, playoffs...) :
      // on refuse l'invalidation pour ne pas laisser un etat incoherent.
      // Le code brut reste dans le message : l'UI s'en sert pour proposer
      // le deblocage `advancement-consumed` (cf. invalidate-consumed.ts).
      throw new MatchSheetError(
        "invalidation_failed",
        `Reversion impossible: ${reversed.reason} — ${reversionRefusalMessage(reversed.reason)}`,
      );
    }
  }

  // Reverse les évolutions appliquées à la validation (PSP remboursés,
  // compétence/carac retirée, VE décrémentée) et nettoie les marqueurs
  // `applied` pour qu'une re-validation ré-applique proprement.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const advData: any = {};
  if (stagedHome.length > 0 || stagedAway.length > 0) {
    const teams = await loadSheetTeams(input.pairingId);
    if (stagedHome.length > 0 && teams.home?.teamId) {
      advData.advancementsHome = await reverseAppliedAdvancements({
        teamId: teams.home.teamId,
        entries: stagedHome,
      });
    }
    if (stagedAway.length > 0 && teams.away?.teamId) {
      advData.advancementsAway = await reverseAppliedAdvancements({
        teamId: teams.away.teamId,
        entries: stagedAway,
      });
    }
  }

  const updated = await prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: "invalidated",
      invalidatedAt: new Date(),
      invalidationReason: input.reason ?? null,
      ...advData,
    },
  });
  serverLog.info(
    `[league-match-sheet] invalidated pairing=${input.pairingId} by=${input.userId}`,
  );
  return { sheet: updated };
}

/**
 * Lot H — Liste des feuilles de match en attente de validation pour
 * un commissaire (status `both_submitted`). Source de la cloche de
 * notification + page "Matchs a valider".
 *
 * Filtre les pairings dont la ligue a `creatorId === userId`. Une
 * seule requete Prisma (nested filter), ordonnee par anciennete.
 */
export async function listPendingValidationsForCommissioner(
  userId: string,
): Promise<
  Array<{
    pairingId: string;
    matchSheetId: string;
    leagueId: string;
    leagueName: string;
    seasonId: string;
    seasonName: string;
    roundNumber: number;
    homeTeamName: string;
    awayTeamName: string;
    bothSubmittedAt: Date | null;
  }>
> {
  const sheets = (await prisma.leagueMatchSheet.findMany({
    where: {
      status: "both_submitted",
      pairing: {
        round: { season: { league: { creatorId: userId } } },
      },
    },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      pairingId: true,
      submittedByHomeAt: true,
      submittedByAwayAt: true,
      pairing: {
        select: {
          round: {
            select: {
              roundNumber: true,
              season: {
                select: {
                  id: true,
                  name: true,
                  league: { select: { id: true, name: true } },
                },
              },
            },
          },
          homeParticipant: { select: { team: { select: { name: true } } } },
          awayParticipant: { select: { team: { select: { name: true } } } },
        },
      },
    },
  })) as Array<{
    id: string;
    pairingId: string;
    submittedByHomeAt: Date | null;
    submittedByAwayAt: Date | null;
    pairing: {
      round: {
        roundNumber: number;
        season: {
          id: string;
          name: string;
          league: { id: string; name: string };
        };
      };
      homeParticipant: { team: { name: string } } | null;
      awayParticipant: { team: { name: string } } | null;
    };
  }>;

  return sheets.map((s) => {
    const home = s.submittedByHomeAt?.getTime() ?? 0;
    const away = s.submittedByAwayAt?.getTime() ?? 0;
    const bothMs = Math.max(home, away);
    return {
      pairingId: s.pairingId,
      matchSheetId: s.id,
      leagueId: s.pairing.round.season.league.id,
      leagueName: s.pairing.round.season.league.name,
      seasonId: s.pairing.round.season.id,
      seasonName: s.pairing.round.season.name,
      roundNumber: s.pairing.round.roundNumber,
      homeTeamName: s.pairing.homeParticipant?.team.name ?? "?",
      awayTeamName: s.pairing.awayParticipant?.team.name ?? "?",
      bothSubmittedAt: bothMs > 0 ? new Date(bothMs) : null,
    };
  });
}

/**
 * Lecture de la feuille + summary derive (pour l'UI). Accessible aux
 * 2 coachs + commissaire. Le summary est recalcule a chaque read
 * (cheap, pur) pour refleter l'etat courant des events.
 */
export interface MatchSheetPlayer {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  /** Slug technique de la position (ex: "gnome_belluaire_gnome"). */
  readonly position: string;
  /** Nom d'affichage lisible de la position (ex: "Belluaire Gnome"). */
  readonly positionName: string;
  readonly dead: boolean;
  readonly missNextMatch: boolean;
  /** SPP courant + level brut (pour surfacer les level-up en attente). */
  readonly spp: number;
  /** Compétences actuelles (CSV de slugs) — staging des évolutions. */
  readonly skills: string | null;
  /** Nombre d'avancements déjà pris (coût du prochain palier). */
  readonly advancementsTaken: number;
  /** Caractéristiques courantes (fiche joueur du staging). */
  readonly stats: {
    readonly ma: number;
    readonly st: number;
    readonly ag: number;
    readonly pa: number | null;
    readonly av: number;
  };
  /** Image uploadée par le coach (null => initiales côté UI). */
  readonly imageUrl: string | null;
}

export interface MatchSheetTeam {
  readonly teamId: string;
  readonly name: string;
  readonly roster: string;
  /** Logo uploade par le coach (null => logo derive du roster cote UI). */
  readonly logoUrl: string | null;
  /** Ruleset de l'équipe (catalogue de compétences du staging). */
  readonly ruleset: string;
  /** Format de l'equipe (bb11, sevens...) : plafond d'effectif a l'embauche. */
  readonly format: string;
  /** Libelle de la race (ex: "Skavens"), resolu depuis le roster slug. */
  readonly raceName: string;
  /** Nom du coach (owner de l'equipe). */
  readonly coachName: string;
  /** VE — Valeur d'Equipe. */
  readonly teamValue: number;
  /** VEA — Valeur d'Equipe Actuelle (= CTV pour le calcul du petty cash). */
  readonly currentValue: number;
  /** Tresorerie (cagnotte) en po. */
  readonly treasury: number;
  /**
   * Ligue regionale choisie a la creation (slug). Conditionne les Star
   * Players recrutables et les Coups de Pouce accessibles. `null` = aucun
   * choix enregistre (equipe anterieure a la regle) : union historique des
   * regles regionales du roster.
   */
  readonly regionalLeague: string | null;
  /**
   * Fans devoues de l'equipe (1-6). Sert a afficher la formule officielle
   * du facteur de popularite (1D3 + fans devoues) et la regle post-match
   * de variation des fans (D6 vs fans).
   */
  readonly dedicatedFans: number;
  /**
   * Staff de l'équipe FIGÉ au début du match (relances, pom-pom girls,
   * assistants, apothicaire). Comme la VE/VEA et la trésorerie, il est lu
   * dans le snapshot de la feuille dès qu'il existe.
   */
  readonly staff: {
    readonly rerolls: number;
    readonly cheerleaders: number;
    readonly assistants: number;
    readonly apothecary: boolean;
  };
  readonly players: readonly MatchSheetPlayer[];
  /**
   * Journaliers derives (equipe a moins de 11 joueurs disponibles).
   * Renseignes par getMatchSheet (necessite le choix stocke sur la
   * feuille) ; vides sinon.
   */
  readonly journeymen?: readonly SheetJourneyman[];
  /** Postes de lineman offerts au choix du coach (>= 12 max). */
  readonly journeymenOptions?: readonly JourneymanPositionOption[];
  /** Choix GLOBAL courant ({ position } sur la feuille), null = defaut. */
  readonly journeymenChoice?: string | null;
  /**
   * Poste EFFECTIF de chaque journalier, dans l'ordre de `journeymen`.
   * C'est ce que l'UI pre-selectionne dans le picker de chaque journalier.
   */
  readonly journeymenChoices?: readonly string[];
  /**
   * Star Players ENGAGÉS en coup de pouce sur cette feuille. Ils jouent le
   * match : proposés comme acteurs / cibles d'évènement, exclus de la
   * persistance post-match. Renseignés par getMatchSheet.
   */
  readonly starPlayersHired?: readonly SheetStarPlayer[];
}

/** Libelle de race depuis un roster slug (fallback : le slug brut). */
function raceNameForRoster(roster: string): string {
  const def = (TEAM_ROSTERS as Record<string, { name?: string }>)[roster];
  return def?.name ?? roster;
}

/**
 * Map slug de position -> nom d'affichage pour un roster donne (ex:
 * "gnome_belluaire_gnome" -> "Belluaire Gnome"). Permet d'afficher des
 * libelles lisibles dans les pickers de l'UI plutot que le slug technique.
 * Fallback : le slug lui-meme si le roster/position est introuvable.
 */
function positionNamesForRoster(roster: string): Map<string, string> {
  const def = (
    TEAM_ROSTERS as Record<
      string,
      { positions?: ReadonlyArray<{ slug: string; displayName: string }> }
    >
  )[roster];
  const map = new Map<string, string>();
  for (const p of def?.positions ?? []) {
    map.set(p.slug, p.displayName);
  }
  return map;
}

/**
 * Charge les 2 equipes d'un pairing + leurs joueurs (pour alimenter les
 * pickers de l'UI : joueur du match, acteur/cible d'un event…). Les joueurs
 * morts sont inclus mais flagges (`dead`) pour l'affichage.
 */
async function loadSheetTeams(
  pairingId: string,
): Promise<{ home: MatchSheetTeam | null; away: MatchSheetTeam | null }> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      homeParticipant: { select: { teamId: true } },
      awayParticipant: { select: { teamId: true } },
    },
  })) as {
    homeParticipant: { teamId: string } | null;
    awayParticipant: { teamId: string } | null;
  } | null;

  const teamIds = [
    pairing?.homeParticipant?.teamId,
    pairing?.awayParticipant?.teamId,
  ].filter((id): id is string => Boolean(id));

  if (teamIds.length === 0) return { home: null, away: null };

  const teams = (await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: {
      id: true,
      name: true,
      roster: true,
      logoUrl: true,
      ruleset: true,
      // Plafond d'effectif de l'equipe (BB11 16, Sevens 11) : borne les
      // postes proposes a l'embauche d'apres-match.
      format: true,
      teamValue: true,
      currentValue: true,
      treasury: true,
      dedicatedFans: true,
      regionalLeague: true,
      rerolls: true,
      cheerleaders: true,
      assistants: true,
      apothecary: true,
      owner: { select: { coachName: true } },
      players: {
        // Les joueurs licencies (firedAt) ne font plus partie du roster
        // actif : on les exclut des pickers (comme un retrait definitif). Les
        // MORTS restent inclus (flagges `dead`, filtres cote UI) alors qu'ils
        // portent eux aussi `firedAt` depuis que la mort sort du roster : ils
        // figurent aux evenements de la feuille qui les a tues, dont les
        // libelles seraient sinon reduits a des ids bruts.
        where: { OR: [{ firedAt: null }, { dead: true }] },
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          name: true,
          position: true,
          dead: true,
          missNextMatch: true,
          spp: true,
          // Staging des évolutions (fiche joueur + coût du prochain palier).
          skills: true,
          advancements: true,
          ma: true,
          st: true,
          ag: true,
          pa: true,
          av: true,
          imageUrl: true,
        },
      },
    },
  })) as Array<{
    id: string;
    name: string;
    roster: string;
    logoUrl?: string | null;
    ruleset?: string | null;
    format?: string | null;
    teamValue?: number | null;
    currentValue?: number | null;
    treasury?: number | null;
    dedicatedFans?: number | null;
    regionalLeague?: string | null;
    rerolls?: number | null;
    cheerleaders?: number | null;
    assistants?: number | null;
    apothecary?: boolean | null;
    owner?: { coachName?: string | null } | null;
    players: Array<{
      id: string;
      number: number;
      name: string;
      position: string;
      dead: boolean;
      missNextMatch: boolean;
      spp: number;
      skills: string | null;
      advancements: string | null;
      ma: number;
      st: number;
      ag: number;
      pa: number | null;
      av: number;
      imageUrl?: string | null;
    }>;
  }>;

  const countAdvancements = (raw: string | null): number => {
    try {
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const byId = new Map(teams.map((t) => [t.id, t]));
  const toTeam = (teamId?: string): MatchSheetTeam | null => {
    if (!teamId) return null;
    const t = byId.get(teamId);
    if (!t) return null;
    const positionNames = positionNamesForRoster(t.roster);
    return {
      teamId: t.id,
      name: t.name,
      roster: t.roster,
      logoUrl: t.logoUrl ?? null,
      ruleset: t.ruleset ?? "season_3",
      format: t.format ?? "bb11",
      raceName: raceNameForRoster(t.roster),
      coachName: t.owner?.coachName ?? "",
      teamValue: t.teamValue ?? 0,
      currentValue: t.currentValue ?? 0,
      treasury: t.treasury ?? 0,
      regionalLeague: t.regionalLeague ?? null,
      // Defaut BB : toute equipe demarre avec 1 fan devoue.
      dedicatedFans: t.dedicatedFans ?? 1,
      staff: {
        rerolls: t.rerolls ?? 0,
        cheerleaders: t.cheerleaders ?? 0,
        assistants: t.assistants ?? 0,
        apothecary: t.apothecary ?? false,
      },
      players: t.players.map((p) => ({
        id: p.id,
        number: p.number,
        name: p.name,
        position: p.position,
        dead: p.dead,
        missNextMatch: p.missNextMatch,
        spp: p.spp,
        skills: p.skills,
        advancementsTaken: countAdvancements(p.advancements),
        stats: { ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av },
        positionName: positionNames.get(p.position) ?? p.position,
        imageUrl: p.imageUrl ?? null,
      })),
    };
  };
  return {
    home: toTeam(pairing?.homeParticipant?.teamId),
    away: toTeam(pairing?.awayParticipant?.teamId),
  };
}

/**
 * Valeurs d'en-tête d'équipe FIGÉES au début du match, lues depuis le
 * snapshot de roster (1re soumission). Une fois le snapshot posé, la
 * feuille affiche (et budgète) les valeurs du match — les valeurs live
 * bougent ensuite (gains, évolutions, licenciements) et ne doivent plus
 * changer l'en-tête ni les budgets de coups de pouce.
 */
function parseFrozenTeamValues(raw: unknown): {
  teamValue?: number;
  currentValue?: number;
  treasury?: number;
  dedicatedFans?: number;
  rerolls?: number;
  cheerleaders?: number;
  assistants?: number;
  apothecary?: boolean;
} | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  return {
    teamValue: num(o.teamValue),
    currentValue: num(o.currentValue),
    treasury: num(o.treasury),
    dedicatedFans: num(o.dedicatedFans),
    rerolls: num(o.rerolls),
    cheerleaders: num(o.cheerleaders),
    assistants: num(o.assistants),
    apothecary: typeof o.apothecary === "boolean" ? o.apothecary : undefined,
  };
}

/**
 * Ids des joueurs (des 2 équipes) ayant la compétence « Innovateur
 * Violent ». Le summarizer ne crédite les PSP d'une Élimination sur
 * Action Spéciale (`special_elim`) qu'à ces joueurs (règle BB S3).
 */
export function collectViolentInnovators(teams: {
  home: MatchSheetTeam | null;
  away: MatchSheetTeam | null;
}): Set<string> {
  const out = new Set<string>();
  for (const team of [teams.home, teams.away]) {
    for (const p of team?.players ?? []) {
      const slugs = (p.skills ?? "")
        .split(",")
        .map((sk) => sk.trim().toLowerCase());
      if (
        slugs.includes("violent-innovator") ||
        slugs.includes("violent_innovator")
      ) {
        out.add(p.id);
      }
    }
  }
  return out;
}

/** Applique les valeurs figées du snapshot sur une équipe chargée live. */
function withFrozenTeamValues(
  team: MatchSheetTeam | null,
  raw: unknown,
): MatchSheetTeam | null {
  if (!team) return null;
  const frozen = parseFrozenTeamValues(raw);
  if (!frozen) return team;
  return {
    ...team,
    teamValue: frozen.teamValue ?? team.teamValue,
    currentValue: frozen.currentValue ?? team.currentValue,
    treasury: frozen.treasury ?? team.treasury,
    dedicatedFans: frozen.dedicatedFans ?? team.dedicatedFans,
    staff: {
      rerolls: frozen.rerolls ?? team.staff.rerolls,
      cheerleaders: frozen.cheerleaders ?? team.staff.cheerleaders,
      assistants: frozen.assistants ?? team.staff.assistants,
      apothecary: frozen.apothecary ?? team.staff.apothecary,
    },
  };
}

/**
 * CTV « du match » : règle BB, les journaliers alignés comptent dans la
 * VEA de la feuille (affichage + petty cash des coups de pouce). Quand
 * l'en-tête est FIGÉ (rosterSnapshot présent), la valeur figée porte
 * déjà les journaliers (bake à la capture) — on ne retouche rien. Pour
 * une feuille encore en saisie, on ajoute la valeur des journaliers
 * dérivés du roster live.
 */
function withJourneymenValue(
  team: MatchSheetTeam | null,
  side: "home" | "away",
  sheet: {
    rosterSnapshotHome?: unknown;
    rosterSnapshotAway?: unknown;
    journeymenHome?: unknown;
    journeymenAway?: unknown;
  },
  positions?: readonly JourneymanSourcePosition[] | null,
): MatchSheetTeam | null {
  if (!team) return null;
  const frozen =
    side === "home" ? sheet.rosterSnapshotHome : sheet.rosterSnapshotAway;
  // Un gel « en-tête seul » (démarrage) ne bake PAS les journaliers : on
  // les ajoute en live, comme pour une feuille non figée. Seul le snapshot
  // E11 complet (1re soumission) les porte déjà.
  if (frozen && !isHeaderOnlySnapshot(frozen)) return team;
  const journeymen = deriveJourneymen({
    side,
    roster: team.roster,
    ruleset: team.ruleset,
    players: team.players,
    ...journeymenChoiceInput(
      side === "home" ? sheet.journeymenHome : sheet.journeymenAway,
    ),
    positions,
  });
  if (journeymen.length === 0) return team;
  const journeymenValue = journeymen.reduce((s, j) => s + j.cost, 0);
  return { ...team, currentValue: team.currentValue + journeymenValue };
}

/** Une condition meteo d'une table (resultat 2..12). */
export interface MatchSheetWeatherResult {
  readonly roll: number;
  readonly condition: string;
  readonly description: string;
}

export interface MatchSheetWeatherTable {
  readonly id: string;
  readonly name: string;
  readonly results: readonly MatchSheetWeatherResult[];
}

/** Entree du catalogue officiel de coups de pouce (hors star players). */
export interface MatchSheetInducementOption {
  readonly slug: string;
  readonly name: string;
  readonly cost: number;
  readonly maxQuantity: number;
  readonly description: string;
  /** A53 — prix variable (ex: Mercenaires) : le coach saisit le coût. */
  readonly variableCost?: boolean;
}

export interface MatchSheetStarPlayerOption {
  readonly slug: string;
  readonly name: string;
  readonly cost: number;
  readonly specialRule?: string;
}

/** Couleurs (hex) d'une equipe, derivees du roster. */
export interface MatchSheetTeamColors {
  readonly primary: string;
  readonly secondary: string;
}

/** Budget d'inducements d'une equipe (regles officielles BB). */
export interface MatchSheetTeamBudget {
  /** CTV = Valeur d'Equipe Actuelle. */
  readonly ctv: number;
  readonly treasury: number;
  /** Petty cash recu (difference de CTV si equipe la moins chere). */
  readonly pettyCash: number;
  /** Budget total dépensable = petty cash + tresorerie. */
  readonly maxBudget: number;
}

/**
 * Donnees de reference (catalogues) attachees a la feuille pour piloter
 * les selecteurs cote UI : tables meteo, catalogue de coups de pouce,
 * star players disponibles par equipe, et budget d'inducements par equipe.
 */
export interface MatchSheetReference {
  readonly weatherTables: readonly MatchSheetWeatherTable[];
  /** Coups de pouce accessibles PAR EQUIPE (filtres + cout selon le roster). */
  readonly inducements: {
    readonly home: readonly MatchSheetInducementOption[];
    readonly away: readonly MatchSheetInducementOption[];
  };
  readonly starPlayers: {
    readonly home: readonly MatchSheetStarPlayerOption[];
    readonly away: readonly MatchSheetStarPlayerOption[];
  };
  readonly budget: {
    readonly home: MatchSheetTeamBudget;
    readonly away: MatchSheetTeamBudget;
  };
  /**
   * Ce que chaque equipe peut ACHETER a l'etape 4 (embauches), et a quel
   * prix : postes du roster avec leur quota, staff avec ses plafonds. Le
   * coach saisissait auparavant un poste libre et un montant libre.
   */
  readonly purchases: {
    readonly home: PurchaseOptions;
    readonly away: PurchaseOptions;
  };
  readonly colors: {
    readonly home: MatchSheetTeamColors;
    readonly away: MatchSheetTeamColors;
  };
}

/** Mappe les tables meteo du moteur vers la forme plate consommee par l'UI. */
function buildWeatherTables(): MatchSheetWeatherTable[] {
  return WEATHER_TYPES.map((t) => ({
    id: t.id,
    name: t.name,
    results: Object.entries(t.table)
      .map(([roll, c]) => ({
        roll: Number(roll),
        condition: c.condition,
        description: c.description,
      }))
      .sort((a, b) => a.roll - b.roll),
  }));
}

/**
 * Catalogue de coups de pouce ACCESSIBLES a une equipe : on filtre selon
 * `canPurchase` (apothicaire itinerant / Igor selon l'acces apothicaire du
 * roster) et on resout le cout effectif (rabais regional). `star_player`
 * est traite a part. Suit les regles officielles d'acces par equipe.
 */
async function inducementOptionsFor(
  roster: string,
  // Ruleset REEL de l'équipe : `DEFAULT_RULESET` était forcé ici, donc les
  // Ligues et remises d'une équipe Saison 2 étaient arbitrées sur la table
  // Saison 3 (S8 de l'audit).
  ruleset: Ruleset,
  // FR17 — allowlist de coups de pouce au niveau ligue. `null` = tous
  // autorisés (défaut). Les Star Players ne sont jamais filtrés ici.
  allowedInducements: string[] | null = null,
  // Ligue régionale CHOISIE par l'équipe : c'est elle (et l'alignement
  // qu'elle apporte) qui ouvre les Coups de Pouce régionaux, pas l'union
  // des Ligues du roster. `null` = équipe sans choix enregistré.
  regionalLeague: string | null = null,
  // Règlement de tournoi de la ligue : liste FERMÉE de coups de pouce, avec
  // ses prix et quantités (ils priment sur le catalogue du moteur).
  pack: TournamentRulesetDefinition | null = null,
): Promise<MatchSheetInducementOption[]> {
  // Acces apothicaire et regles speciales lus EN BASE
  // (`RosterStaffConfig.apothecaryAllowed`, `Roster.specialRules`) : ils
  // arbitrent le prix, la quantite et la disponibilite des coups de pouce,
  // donc le debit de tresorerie post-match (S9 de l'audit). Les tables
  // compilees `APOTHECARY_FORBIDDEN_ROSTERS` / `getSpecialRulesForTeam` ne
  // sont plus que le repli, porte par les resolveurs eux-memes.
  const [declaredRules, staffConfig, specialRules, catalogue] =
    await Promise.all([
      getDeclaredRegionalRules(roster, ruleset),
      // Le Jeu en Ligue se joue en BB11 : la config staff est declaree par
      // couple roster x format et la feuille de ligue n'a pas d'autre format.
      resolveStaffConfigBySlug(roster, ruleset, "bb11"),
      resolveSpecialRulesForTeam(prisma, roster, ruleset),
      // Lot 6.1 — prix, plafonds et conditions servis par la base.
      loadInducementCatalogue(ruleset),
    ]);
  const ctx: InducementContext = {
    teamId: "A" as const,
    regionalRules: resolveTeamRegionalRules(
      roster,
      ruleset,
      regionalLeague,
      // Ligues DÉCLARÉES par le roster (`Roster.regionalRules`) : sans elles
      // la résolution retombe sur la table compilée et une Ligue éditée en
      // admin ne changeait ni les remises ni l'offre de stars.
      declaredRules,
    ),
    hasApothecary: staffConfig.apothecaryAllowed,
    rosterSlug: roster,
    // A53 — les restrictions/remises officielles dépendent des règles
    // spéciales d'équipe (Maîtres de la Non-vie, Chantage et Corruption…).
    specialRules: [...specialRules],
    ruleset,
    catalogue,
  };
  const effective = effectiveInducementAllowlist(allowedInducements, pack);
  const allow = effective ? new Set(effective) : null;
  // Lot 6.1 — catalogue servi par la base (`Inducement`), repli compilé.
  const options = (ctx.catalogue ?? INDUCEMENT_CATALOGUE)
    .filter((d) => d.slug !== "star_player")
    .filter((d) => canPurchaseInducement(d, ctx))
    .filter((d) => allow === null || allow.has(d.slug))
    .map((d) => ({
      slug: d.slug,
      name: d.displayNameFr,
      cost: getInducementCost(d.slug, ctx),
      maxQuantity: getInducementMaxQuantity(d.slug, ctx),
      description: d.description,
      ...(d.variableCost ? { variableCost: true } : {}),
    }));
  // Prix, quantités et précisions du règlement priment sur le catalogue.
  return applyPackInducementRules(
    options,
    pack,
  ) as MatchSheetInducementOption[];
}

/** Couleur 24 bits -> hex CSS (#rrggbb). */
function colorHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function colorsFor(roster: string | undefined): MatchSheetTeamColors {
  const c = getTeamColors(roster);
  return { primary: colorHex(c.primary), secondary: colorHex(c.secondary) };
}

/**
 * Ids des joueurs TUES pendant le match saisi. Ils sont encore au roster
 * (la validation n'a pas eu lieu) mais ne comptent plus dans l'effectif :
 * le livre les retire en premier, avant les embauches.
 */
function deadThisMatch(summary: MatchSummary): ReadonlySet<string> {
  const out = new Set<string>();
  for (const inj of summary.injuries) {
    if (inj.severity === "dead") out.add(inj.playerId);
  }
  return out;
}

/**
 * Postes et staff achetables par une equipe a l'etape 4 (embauches), avec
 * leur prix. Best-effort : une resolution en echec rend un catalogue vide,
 * l'UI retombe alors sur la saisie libre plutot que de bloquer la feuille.
 *
 * Les compteurs partent du roster ACTIF, MOINS les joueurs tues pendant CE
 * match : le livre (p.68) retire un mort AVANT toute autre action
 * d'apres-match, sa place est donc libre pour le recrutement de l'etape 4.
 * Ces morts-la ne sont pas encore persistes (la validation vient apres) :
 * sans eux, l'equipe qui vient de perdre son 16e joueur ne pourrait pas le
 * remplacer — exactement le cas que la regle vise.
 */
async function purchaseOptionsFor(
  team: MatchSheetTeam | null,
  deadThisMatch: ReadonlySet<string> = new Set(),
): Promise<PurchaseOptions> {
  if (!team) return EMPTY_PURCHASE_OPTIONS;
  try {
    const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const format: GameFormat = isGameFormat(team.format) ? team.format : "bb11";
    const [rosterData, staff] = await Promise.all([
      getRosterFromDb(team.roster as AllowedRoster, "fr", ruleset),
      resolveStaffConfigBySlug(team.roster, ruleset, format),
    ]);
    if (!rosterData) return EMPTY_PURCHASE_OPTIONS;

    const active = team.players.filter(
      (p) => !p.dead && !deadThisMatch.has(p.id),
    );
    return buildPurchaseOptions({
      positions: rosterData.positions.map((p) => ({
        slug: p.slug,
        displayName: p.displayName,
        cost: p.cost,
        max: p.max,
      })),
      staff,
      team: {
        countsByPosition: countByPosition(active),
        playerCount: active.length,
        maxPlayers: getFormatConstraints(format).maxPlayers,
        rerolls: team.staff.rerolls,
        cheerleaders: team.staff.cheerleaders,
        assistants: team.staff.assistants,
        apothecary: team.staff.apothecary,
        dedicatedFans: team.dedicatedFans ?? 0,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.warn(
      `[league-match-sheet] catalogue d'achats indisponible (${team.roster}): ${msg}`,
    );
    return EMPTY_PURCHASE_OPTIONS;
  }
}

async function starPlayersFor(
  roster: string,
  ruleset: Ruleset,
  regionalLeague: string | null = null,
): Promise<MatchSheetStarPlayerOption[]> {
  // Bug latent corrige : appelait auparavant sans le ruleset reel de
  // l'equipe (toujours DEFAULT_RULESET statique). Depuis le choix de Ligue
  // regionale, l'offre suit la Ligue retenue par l'equipe.
  const regionalRules =
    resolveTeamRegionalRules(
      roster,
      ruleset,
      regionalLeague,
      await getDeclaredRegionalRules(roster, ruleset),
    ) ?? [];
  const starPlayers = await getAvailableStarPlayersDb(
    roster,
    regionalRules,
    ruleset,
  );
  return starPlayers.map((s) => ({
    slug: s.slug,
    name: s.displayName,
    cost: s.cost,
    ...(s.specialRule ? { specialRule: s.specialRule } : {}),
  }));
}

/**
 * Règles de coups de pouce applicables au match (via pairing → round →
 * saison → ligue) :
 *  - FR17 — l'allowlist de la ligue (`null` = tous autorisés) ;
 *  - le RÈGLEMENT DE TOURNOI de la ligue, qui pose sa propre liste fermée
 *    avec ses prix et quantités (NAF WC 2027).
 *
 * Tolérant : JSON invalide, ligue absente ou lecture en échec → aucune
 * restriction, la feuille de match reste servie.
 */
async function loadLeagueInducementRules(pairingId: string): Promise<{
  allowlist: string[] | null;
  pack: TournamentRulesetDefinition | null;
}> {
  try {
    const row = (await prisma.leaguePairing.findUnique({
      where: { id: pairingId },
      select: {
        round: {
          select: {
            season: {
              select: {
                league: {
                  select: {
                    allowedInducements: true,
                    tournamentRuleset: true,
                  },
                },
              },
            },
          },
        },
      },
    })) as {
      round?: {
        season?: {
          league?: {
            allowedInducements?: string | null;
            tournamentRuleset?: string | null;
          };
        };
      };
    } | null;
    const league = row?.round?.season?.league;
    const pack = await getTournamentRulesetDefinition(
      league?.tournamentRuleset ?? null,
    );
    const raw = league?.allowedInducements ?? null;
    if (!raw) return { allowlist: null, pack };
    const parsed: unknown = JSON.parse(raw);
    const allowlist =
      Array.isArray(parsed) && parsed.every((v) => typeof v === "string")
        ? (parsed as string[])
        : null;
    return { allowlist, pack };
  } catch {
    return { allowlist: null, pack: null };
  }
}

/**
 * FR17 — rejette toute sélection de coup de pouce hors `allowlist` (sauf les
 * Star Players, slug "star_player"). No-op si `allowlist` est null (tous
 * autorisés) ou si la sélection est absente.
 */
function assertInducementsAllowed(
  selection: unknown,
  allowlist: string[] | null,
  sideLabel: string,
): void {
  if (allowlist === null || !Array.isArray(selection)) return;
  const allow = new Set(allowlist);
  for (const raw of selection) {
    const slug = (raw as { slug?: unknown }).slug;
    if (typeof slug !== "string") continue;
    if (slug === "star_player") continue; // exempté (dépend du roster)
    if (!allow.has(slug)) {
      throw new MatchSheetError(
        "inducement_not_allowed",
        `Coup de pouce non autorisé par la ligue (${sideLabel}) : "${slug}".`,
      );
    }
  }
}

/**
 * Construit le bloc de reference (catalogues + budgets) pour une feuille.
 * Le petty cash suit les regles BB : l'equipe a la CTV la plus basse recoit
 * la difference, puis chaque equipe peut puiser dans sa tresorerie.
 */
/**
 * FR14 — montant (po) que l'équipe la plus faible peut investir en plus de la
 * cagnotte (différence de VEA) pour acheter des coups de pouce, en Jeu en Ligue.
 */
export const LEAGUE_UNDERDOG_INDUCEMENT_BONUS = 50000;

export async function buildMatchSheetReference(
  teams: {
    home: MatchSheetTeam | null;
    away: MatchSheetTeam | null;
  },
  // FR17 — coups de pouce autorisés par la ligue (null = tous).
  allowedInducements: string[] | null = null,
  // A55 — dépenses de coups de pouce déjà engagées : la dépense de la plus
  // forte équipe augmente d'autant la cagnotte de l'underdog.
  spent: { home: number; away: number } = { home: 0, away: 0 },
  // Règlement de tournoi de la ligue (liste fermée + prix imposés).
  pack: TournamentRulesetDefinition | null = null,
  // Joueurs tués pendant CE match (pas encore persistés) : leur place est
  // libre pour l'embauche de l'étape 4.
  deadThisMatch: ReadonlySet<string> = new Set(),
): Promise<MatchSheetReference> {
  const homeCtv = teams.home?.currentValue ?? 0;
  const awayCtv = teams.away?.currentValue ?? 0;
  const homeTreasury = teams.home?.treasury ?? 0;
  const awayTreasury = teams.away?.treasury ?? 0;

  const petty = calculatePettyCash({
    ctvTeamA: homeCtv,
    ctvTeamB: awayCtv,
    treasuryTeamA: homeTreasury,
    treasuryTeamB: awayTreasury,
    // FR14/A55 — règle de ligue : l'équipe la plus faible peut investir
    // jusqu'à 50 000 po de SA trésorerie (selon disponibilité) au-delà de la
    // différence de VEA + des dépenses adverses.
    underdogBonus: LEAGUE_UNDERDOG_INDUCEMENT_BONUS,
    spentTeamA: spent.home,
    spentTeamB: spent.away,
  });

  const [purchasesHome, purchasesAway] = await Promise.all([
    purchaseOptionsFor(teams.home, deadThisMatch),
    purchaseOptionsFor(teams.away, deadThisMatch),
  ]);

  return {
    weatherTables: buildWeatherTables(),
    purchases: { home: purchasesHome, away: purchasesAway },
    inducements: {
      home: teams.home
        ? await inducementOptionsFor(
            teams.home.roster,
            (teams.home.ruleset as Ruleset) ?? DEFAULT_RULESET,
            allowedInducements,
            teams.home.regionalLeague,
            pack,
          )
        : [],
      away: teams.away
        ? await inducementOptionsFor(
            teams.away.roster,
            (teams.away.ruleset as Ruleset) ?? DEFAULT_RULESET,
            allowedInducements,
            teams.away.regionalLeague,
            pack,
          )
        : [],
    },
    starPlayers: {
      home: teams.home
        ? await starPlayersFor(
            teams.home.roster,
            teams.home.ruleset as Ruleset,
            teams.home.regionalLeague,
          )
        : [],
      away: teams.away
        ? await starPlayersFor(
            teams.away.roster,
            teams.away.ruleset as Ruleset,
            teams.away.regionalLeague,
          )
        : [],
    },
    colors: {
      home: colorsFor(teams.home?.roster),
      away: colorsFor(teams.away?.roster),
    },
    budget: {
      home: {
        ctv: homeCtv,
        treasury: homeTreasury,
        pettyCash: petty.teamA.pettyCash,
        maxBudget: petty.teamA.maxBudget,
      },
      away: {
        ctv: awayCtv,
        treasury: awayTreasury,
        pettyCash: petty.teamB.pettyCash,
        maxBudget: petty.teamB.maxBudget,
      },
    },
  };
}

/**
 * PSP gagnes sur CE match, par joueur (roster, journaliers et Star Players
 * engages compris). Meme calcul cote lecture et cote validation : bareme
 * officiel + modificateur d'equipe (Bagarreurs Brutaux) selon le roster.
 *
 * Les Joueurs du Match SANS aucune stat n'ont pas de stat-line dans le
 * summary : ils sont ajoutes explicitement (leur cote est resolu depuis le
 * roster) pour que leur palier d'evolution soit propose DES la saisie.
 */
async function computeSheetSpp(input: {
  summary: MatchSummary;
  motmPlayerIds: unknown;
  teams: { home: MatchSheetTeam | null; away: MatchSheetTeam | null };
  /** Prieres a Nuffle saisies (colonnes `prayersHome/Away` de la feuille). */
  prayersHome?: unknown;
  prayersAway?: unknown;
}): Promise<Record<string, number>> {
  const { summary, teams } = input;
  const motm = new Set(parseStringArray(input.motmPlayerIds));
  const sppContext = await loadLeagueSPPContext(prisma, {
    isLeagueMatch: true,
    teamARoster: teams.home?.roster ?? "",
    teamBRoster: teams.away?.roster ?? "",
  });
  const out: Record<string, number> = {};
  for (const s of summary.playerStats) {
    const modifier = s.side === "home" ? sppContext.teamA : sppContext.teamB;
    out[s.playerId] = calculatePlayerSPP(
      {
        touchdowns: s.touchdowns,
        casualties: s.casualtiesInflicted,
        completions: s.completions,
        interceptions: s.interceptions,
        ttmLandings: s.ttmLandings,
        mvp: motm.has(s.playerId),
      },
      modifier,
    );
  }
  for (const id of motm) {
    if (out[id] !== undefined) continue;
    // Un JOURNALIER (ou un Star Player engagé) n'a pas de ligne dans
    // `players` : son côté se lit dans son id. Sans ça, un journalier
    // désigné Joueur du Match sans autre stat n'avait AUCUN PSP — il
    // manquait aux paliers d'évolution et son recrutement partait de 0.
    const side = teams.home?.players.some((p) => p.id === id)
      ? "home"
      : teams.away?.players.some((p) => p.id === id)
        ? "away"
        : syntheticSheetPlayerSide(id);
    if (!side) continue;
    out[id] = calculatePlayerSPP(
      {
        touchdowns: 0,
        casualties: 0,
        completions: 0,
        interceptions: 0,
        ttmLandings: 0,
        mvp: true,
      },
      side === "home" ? sppContext.teamA : sppContext.teamB,
    );
  }
  // Prieres a Nuffle : « Passe Parfaite » (Reussite a 2 PSP) et « Reception
  // Etourdissante » (1 PSP au receptionneur). Le receptionneur n'a sinon
  // AUCUN PSP — c'est le lanceur qui marque la Reussite — donc sa saisie
  // sur l'evenement de passe restait sans effet.
  return applyPrayerSppBonuses(
    out,
    computePrayerSppBonuses({
      summary,
      prayersHome: input.prayersHome,
      prayersAway: input.prayersAway,
    }),
  );
}

/**
 * Haine (X) — jets d'après-match persistés pour ce pairing.
 *
 * Lus depuis le snapshot du Match offline (`offlineResultInput.hateRolls`),
 * seul endroit où ils vivent : le récap reste donc affichable à CHAQUE
 * ouverture de la feuille validée, pas seulement dans la réponse ponctuelle
 * de la validation. Best-effort — un échec de lecture masque le récap, il ne
 * casse pas la feuille.
 */
async function loadHateRollsForPairing(pairingId: string): Promise<HateRoll[]> {
  try {
    const match = (await prisma.match.findFirst({
      where: { leaguePairingId: pairingId, mode: OFFLINE_MATCH_MODE },
      select: { offlineResultInput: true },
    })) as { offlineResultInput: unknown } | null;
    if (!match?.offlineResultInput) return [];
    let snapshot: unknown = match.offlineResultInput;
    if (typeof snapshot === "string") {
      try {
        snapshot = JSON.parse(snapshot);
      } catch {
        return [];
      }
    }
    if (!snapshot || typeof snapshot !== "object") return [];
    const snap = snapshot as { hateRolls?: unknown; hateGranted?: unknown };
    return parseHateRolls(snap.hateRolls, snap.hateGranted);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.warn(
      `[league-match-sheet] lecture des jets de Haine echouee pairing=${pairingId}: ${msg}`,
    );
    return [];
  }
}

export async function getMatchSheet(input: {
  pairingId: string;
  userId: string;
}): Promise<{
  sheet: unknown;
  summary: MatchSummary;
  /** Ligue du pairing : permet à l'UI un lien retour vers la page de la ligue. */
  leagueId: string;
  leagueName: string;
  viewerRole: "home" | "away" | "commissioner" | "none";
  /**
   * Équipe possédée par le viewer parmi les deux du match, INDÉPENDAMMENT de
   * `viewerRole`. Un commissaire qui participe aussi avec une équipe a
   * `viewerRole="commissioner"` mais `viewerTeamId` renseigné, ce qui permet
   * à l'UI d'afficher l'éditeur d'évolutions de SON équipe (sinon masqué).
   */
  viewerTeamId: string | null;
  teams: { home: MatchSheetTeam | null; away: MatchSheetTeam | null };
  reference: MatchSheetReference;
  /** SPP autoritaire par teamPlayerId (calcul officiel + modificateur d'équipe). */
  computedSpp: Record<string, number>;
  /**
   * Haine (X) — jets d'après-match déjà joués sur ce match. Toujours `[]`
   * tant que la feuille n'est pas validée : le D6 est lancé à la validation.
   */
  hateRolls: readonly HateRoll[];
}> {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  const commissioner = isCommissioner(ctx, input.userId);
  const sheet = await prisma.leagueMatchSheet.findUnique({
    where: { pairingId: input.pairingId },
    include: { events: { orderBy: { occurredAt: "asc" } } },
  });
  if (!sheet) {
    throw new MatchSheetError("sheet_not_found", "Feuille inexistante");
  }
  const events = ((sheet as { events?: MatchEventInput[] }).events ??
    []) as MatchEventInput[];
  const sheetSnapRaw = sheet as {
    rosterSnapshotHome?: unknown;
    rosterSnapshotAway?: unknown;
    journeymenHome?: unknown;
    journeymenAway?: unknown;
  };
  // Filet de sécurité (feuilles antérieures au gel de démarrage, ou dont
  // la capture avait échoué) : on gèle à la PREMIÈRE lecture plutôt que
  // d'attendre la 1re soumission — sinon la feuille afficherait des
  // valeurs live qui bougent d'une consultation à l'autre.
  if (
    sheet.status !== "validated" &&
    (!sheetSnapRaw.rosterSnapshotHome ||
      isHeaderOnlySnapshot(sheetSnapRaw.rosterSnapshotHome) ||
      !sheetSnapRaw.rosterSnapshotAway ||
      isHeaderOnlySnapshot(sheetSnapRaw.rosterSnapshotAway))
  ) {
    const backfill = await captureMatchSnapshots(input.pairingId, sheetSnapRaw);
    if (Object.keys(backfill).length > 0) {
      try {
        await prisma.leagueMatchSheet.update({
          where: { id: sheet.id },
          data: backfill,
        });
        Object.assign(sheetSnapRaw, backfill);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown";
        serverLog.error(
          `[league-match-sheet] rattrapage du gel à la lecture échoué: ${msg}`,
        );
      }
    }
  }
  const teamsLive = await loadSheetTeams(input.pairingId);
  // Feuille pas encore figée : rafraîchit VE/VEA (la VEA exclut les
  // joueurs absents) — la valeur stockée peut être obsolète (blessure
  // appliquée sans recalcul). Self-healing, best-effort.
  const refreshSide = async (
    team: MatchSheetTeam | null,
    frozen: unknown,
  ): Promise<MatchSheetTeam | null> => {
    if (!team?.teamId || frozen) return team;
    try {
      const fresh = await updateTeamValues(prisma, team.teamId);
      return {
        ...team,
        teamValue: fresh.teamValue,
        currentValue: fresh.currentValue,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(`[league-match-sheet] refresh VE/VEA échoué: ${msg}`);
      return team;
    }
  };
  const teamsFresh = {
    home: await refreshSide(teamsLive.home, sheetSnapRaw.rosterSnapshotHome),
    away: await refreshSide(teamsLive.away, sheetSnapRaw.rosterSnapshotAway),
  };
  // Postes du roster lus en base : ils arbitrent le prix et le slug des
  // journaliers (donc la VEA du match et le recrutement post-match).
  const journeymanPositions = await loadJourneymanPositions(teamsFresh);
  // CTV du match : + valeur des journaliers alignés (déjà comptée dans
  // les en-têtes figés, ajoutée en live pour une feuille en saisie).
  const teams = {
    home: withJourneymenValue(
      withFrozenTeamValues(teamsFresh.home, sheetSnapRaw.rosterSnapshotHome),
      "home",
      sheetSnapRaw,
      journeymanPositions.home,
    ),
    away: withJourneymenValue(
      withFrozenTeamValues(teamsFresh.away, sheetSnapRaw.rosterSnapshotAway),
      "away",
      sheetSnapRaw,
      journeymanPositions.away,
    ),
  };
  const summary = summarizeMatchSheet(events, {
    violentInnovators: collectViolentInnovators(teamsLive),
  });

  // SPP autoritaire par joueur : meme calcul que celui applique a la
  // validation (calculatePlayerSPP + modificateur d'equipe selon le roster).
  const sheetPrayersForSpp = sheet as {
    prayersHome?: unknown;
    prayersAway?: unknown;
  };
  const computedSpp = await computeSheetSpp({
    summary,
    motmPlayerIds: (sheet as { motmPlayerIds?: unknown }).motmPlayerIds,
    teams,
    prayersHome: sheetPrayersForSpp.prayersHome,
    prayersAway: sheetPrayersForSpp.prayersAway,
  });

  const { allowlist: allowedInducements, pack: inducementPack } =
    await loadLeagueInducementRules(input.pairingId);

  // Journaliers de la VERSION DU MATCH : derives du roster FIGE (la feuille
  // fait foi des le coup d'envoi), du roster courant tant qu'elle ne l'est
  // pas. Ils alimentent les pickers d'events et le roster affiche. Repartir
  // du roster live montrait, une fois le match valide, des journaliers qui
  // n'ont jamais joue cette rencontre : les morts et les blessures « rate le
  // prochain match » que la feuille venait d'appliquer faisaient chuter le
  // nombre de joueurs disponibles — un contingent pour le match SUIVANT.
  const sheetJourneymen = sheet as {
    journeymenHome?: unknown;
    journeymenAway?: unknown;
  };
  const withJourneymen = (
    team: MatchSheetTeam | null,
    side: "home" | "away",
  ): MatchSheetTeam | null => {
    if (!team) return null;
    const choice = parseJourneymenChoices(
      side === "home"
        ? sheetJourneymen.journeymenHome
        : sheetJourneymen.journeymenAway,
    );
    const positions =
      side === "home" ? journeymanPositions.home : journeymanPositions.away;
    const journeymen = deriveMatchJourneymen({
      side,
      roster: team.roster,
      ruleset: team.ruleset,
      players: team.players,
      chosenPosition: choice.position,
      chosenPositions: choice.positions,
      positions,
      frozenRosterSnapshot:
        side === "home"
          ? sheetSnapRaw.rosterSnapshotHome
          : sheetSnapRaw.rosterSnapshotAway,
    });
    return {
      ...team,
      journeymen,
      journeymenOptions: linemanPositionsForRoster(
        team.roster,
        team.ruleset,
        positions,
      ),
      journeymenChoice: choice.position,
      // Choix EFFECTIF de chaque journalier (le poste réellement dérivé),
      // et pas seulement ce que la feuille a stocké : l'UI peut ainsi
      // pré-sélectionner le bon poste même quand le rang n'a pas de choix
      // propre et retombe sur le défaut.
      journeymenChoices: journeymen.map((j) => j.position),
    };
  };
  // Star Players engagés en coup de pouce : ils JOUENT le match, donc ils
  // doivent apparaître dans les pickers d'acteur / de cible d'évènement.
  const sheetInducements = sheet as {
    inducementsHome?: unknown;
    inducementsAway?: unknown;
  };
  const withStarPlayers = async (
    team: MatchSheetTeam | null,
    side: "home" | "away",
  ): Promise<MatchSheetTeam | null> => {
    if (!team) return null;
    const starPlayersHired = await deriveSheetStarPlayers({
      side,
      inducements:
        side === "home"
          ? sheetInducements.inducementsHome
          : sheetInducements.inducementsAway,
      ruleset: team.ruleset,
    });
    return starPlayersHired.length > 0 ? { ...team, starPlayersHired } : team;
  };
  const teamsWithJourneymen = {
    home: await withStarPlayers(withJourneymen(teams.home, "home"), "home"),
    away: await withStarPlayers(withJourneymen(teams.away, "away"), "away"),
  };

  // A63 — expose des gains auto toujours frais : la partie TD et le bonus
  // « sans temporisation » dependent des events, qui peuvent changer apres
  // le pre-match (valeur stockee stale).
  const sheetPopularity = sheet as {
    popularityHome?: number | null;
    popularityAway?: number | null;
  };
  const stalledForRead = computeStalledTeams(events);
  const autoWinnings = computeMatchWinnings({
    popularityHome: sheetPopularity.popularityHome ?? null,
    popularityAway: sheetPopularity.popularityAway ?? null,
    scoreHome: summary.scoreHome,
    scoreAway: summary.scoreAway,
    stalledHome: stalledForRead.home,
    stalledAway: stalledForRead.away,
  });

  return {
    sheet: {
      ...(sheet as Record<string, unknown>),
      winningsHome: autoWinnings.home,
      winningsAway: autoWinnings.away,
    } as typeof sheet,
    summary,
    leagueId: ctx.leagueId,
    leagueName: ctx.leagueName,
    teams: teamsWithJourneymen,
    reference: await buildMatchSheetReference(
      teams,
      allowedInducements,
      { home: 0, away: 0 },
      inducementPack,
      deadThisMatch(summary),
    ),
    computedSpp,
    viewerRole: commissioner
      ? "commissioner"
      : side === "home"
        ? "home"
        : side === "away"
          ? "away"
          : "none",
    // Dérivé de `side` (ownerId), pas de `viewerRole` : un commissaire-coach
    // conserve ainsi l'accès aux évolutions de son équipe.
    viewerTeamId:
      side === "home"
        ? (teams.home?.teamId ?? null)
        : side === "away"
          ? (teams.away?.teamId ?? null)
          : null,
    // Le D6 de Haine est lance a la validation : rien a montrer avant.
    hateRolls:
      sheet.status === "validated"
        ? await loadHateRollsForPairing(input.pairingId)
        : [],
  };
}
