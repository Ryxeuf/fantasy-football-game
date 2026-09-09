"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../../contexts/LanguageContext";
import { MatchdayExport } from "./MatchdayExport";
import { RoundFollowupButton } from "./RoundFollowupButton";
import { PairingBonusBreakdown } from "./PairingBonusBreakdown";
import MatchCard, {
  type MatchCardStatus,
  type MatchCardTeam,
} from "../../components/competition/MatchCard";
import TeamRosterLink from "./TeamRosterLink";
import { PairingScheduleEditor } from "./PairingScheduleEditor";
import { putPoolFirst } from "./pool-order";
import { CollapseToggle } from "../../components/CollapseToggle";
import {
  canSchedulePairing,
  formatPlannedDate,
  isPairingPlanned,
} from "./pairing-status";
import type {
  LeagueRoundDetail,
  LeaguePairingDetail,
  LeaguePairingTeamDetail,
} from "./types";

// Sprint Ligues v2 PR2 — calendrier interactif (ligue 100% physique).
// Une carte par journée ; chaque rencontre est une `MatchCard` (les deux
// équipes autour d'un cartouche de score, statut et actions dessous). La
// saisie d'un resultat se fait via la FEUILLE DE MATCH : les 2 coachs
// impliques (et le commissaire) y accedent par un lien. Les forfaits /
// annulations affichent uniquement un badge.

interface SeasonCalendarProps {
  rounds: LeagueRoundDetail[];
  /** userId du coach connecte (null si non authentifie). */
  currentUserId: string | null;
  /** Vrai si le user est commissaire (acces feuille sur tous les matchs). */
  canRecordResult?: boolean;
  /** FR5 — nom de poule par id (vide => pas de groupement par poule). */
  poolNamesById?: Record<string, string>;
  /** FR5 — poule d'un participant par id (pour grouper les pairings). */
  poolIdByParticipantId?: Record<string, string | null>;
  /** Ligue de consultation : rend les noms d'equipe cliquables (roster). */
  leagueId?: string | null;
  /** Consultation des rosters autorisee (commissaire ou coach inscrit). */
  canViewRosters?: boolean;
  /**
   * Rappele apres la pose d'une date previsionnelle (rechargement de la
   * saison). Sans callback, l'editeur de date n'est pas propose.
   */
  onPairingChanged?: () => void;
  /** Poule du coach connecte : affichee en premier dans chaque journee. */
  preferredPoolId?: string | null;
  /**
   * Commissaire de la ligue : seul à voir le bouton « Relancer » d'une
   * journée (le serveur re-tranche, cf. `sendRoundFollowups`).
   */
  isCommissioner?: boolean;
}

interface PoolGroup {
  poolId: string | null;
  poolName: string | null;
  pairings: LeaguePairingDetail[];
}

/**
 * FR5 — regroupe les pairings d'une journée par poule (via la poule du
 * participant à domicile). Retourne `null` si aucun groupement n'est
 * pertinent (pas de poules, ou une seule poule effective).
 *
 * Les poules sont triées par nom, sauf `preferredPoolId` (la poule du
 * coach connecté) qui passe en tête.
 */
export function groupPairingsByPool(
  pairings: LeaguePairingDetail[],
  poolNamesById: Record<string, string>,
  poolIdByParticipantId: Record<string, string | null>,
  preferredPoolId: string | null = null,
): PoolGroup[] | null {
  if (Object.keys(poolNamesById).length === 0) return null;
  const groups = new Map<string | null, PoolGroup>();
  for (const pairing of pairings) {
    const poolId = poolIdByParticipantId[pairing.homeParticipant.id] ?? null;
    const existing = groups.get(poolId);
    if (existing) {
      existing.pairings.push(pairing);
    } else {
      groups.set(poolId, {
        poolId,
        poolName: poolId ? poolNamesById[poolId] ?? null : null,
        pairings: [pairing],
      });
    }
  }
  // Pas de découpage utile si tous les pairings tombent dans une seule poule.
  if (groups.size <= 1) return null;
  const sorted = Array.from(groups.values()).sort((a, b) =>
    (a.poolName ?? "￿").localeCompare(b.poolName ?? "￿"),
  );
  return putPoolFirst(sorted, (g) => g.poolId, preferredPoolId);
}

/**
 * Feuille saisie par les coachs mais pas encore validée par le
 * commissaire : le statut du pairing reste « Programmé » (il ne bascule
 * qu'à la validation), ce qui ne dit rien au coach qui vient de saisir.
 * On expose donc un libellé dédié, dérivé du `status` de la feuille.
 *
 * Retourne `null` quand il n'y a rien à signaler (pas de feuille,
 * brouillon, déjà validée ou invalidée).
 */
export function matchSheetPendingLabel(
  sheetStatus: string | null | undefined,
): string | null {
  switch (sheetStatus) {
    case "both_submitted":
      return "En attente validation";
    // Un seul des deux coachs a validé sa saisie : la feuille attend
    // toujours le commissaire, mais elle n'est pas encore complète.
    case "submitted_home":
    case "submitted_away":
      return "En attente validation (1/2)";
    default:
      return null;
  }
}

/**
 * Resultat a afficher sur la ligne d'un pairing, une fois la feuille
 * validee par le commissaire : le score prime sur le libelle de statut
 * (« Joue » n'apprend rien a qui consulte la journee).
 *
 * Source unique : le score snapshote sur la feuille a la validation. Un
 * pairing joue en ligne (sans feuille) n'a pas de score exploitable ici,
 * on garde alors le badge de statut.
 */
export function pairingScoreLabel(
  pairing: Pick<LeaguePairingDetail, "matchSheet">,
): string | null {
  const sheet = pairing.matchSheet;
  if (!sheet || sheet.status !== "validated") return null;
  const { scoreHome, scoreAway } = sheet;
  if (typeof scoreHome !== "number" || typeof scoreAway !== "number") {
    return null;
  }
  return `${scoreHome} – ${scoreAway}`;
}

/**
 * « Prevu le … » : une rencontre a jouer dont les coachs (ou le
 * commissaire) ont pose la date. Remplace le libelle « A jouer ».
 */
export function pairingPlannedLabel(
  pairing: Pick<LeaguePairingDetail, "status" | "scheduledAt">,
  template: string,
  language: string,
): string | null {
  if (!isPairingPlanned(pairing)) return null;
  const date = formatPlannedDate(pairing.scheduledAt, language);
  if (!date) return null;
  return template.replace("{{date}}", date);
}

/** Statuts de pairing qui ne bougeront plus (joue, forfait, annule). */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "played",
  "forfeit_home",
  "forfeit_away",
  "cancelled",
]);

/** Avancement d'une journee : rencontres terminees / total. */
export function roundProgress(round: Pick<LeagueRoundDetail, "pairings">): {
  played: number;
  total: number;
} {
  const pairings = round.pairings ?? [];
  return {
    played: pairings.filter((p) => TERMINAL_STATUSES.has(p.status)).length,
    total: pairings.length,
  };
}

/**
 * Statut AFFICHE d'une journee. En base, une journee reste `pending` tant
 * qu'elle n'est pas complete (la feuille de match ne la fait pas passer
 * `in_progress`) : des qu'une rencontre est terminee, on la montre « En
 * cours » plutot que « A venir » a cote de « 1/4 joues ».
 */
export function effectiveRoundStatus(
  round: Pick<LeagueRoundDetail, "status" | "pairings">,
): string {
  if (round.status === "completed") return "completed";
  const { played } = roundProgress(round);
  if (played > 0) return "in_progress";
  return round.status;
}

export type CalendarFilter = "all" | "upcoming" | "played";

/** Filtre des journees : « a jouer » = pas encore completee. */
export function filterRounds(
  rounds: LeagueRoundDetail[],
  filter: CalendarFilter,
): LeagueRoundDetail[] {
  if (filter === "all") return rounds;
  return rounds.filter((r) =>
    filter === "played" ? r.status === "completed" : r.status !== "completed",
  );
}

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

const ROUND_ACCENT: Record<string, string> = {
  pending: "border-l-gray-300",
  in_progress: "border-l-amber-400",
  completed: "border-l-emerald-500",
};

const ROUND_CHIP: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
};

export function SeasonCalendar({
  rounds,
  currentUserId,
  canRecordResult,
  poolNamesById = {},
  poolIdByParticipantId = {},
  leagueId = null,
  canViewRosters = false,
  onPairingChanged,
  preferredPoolId = null,
  isCommissioner = false,
}: SeasonCalendarProps) {
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState<CalendarFilter>("all");
  // Journées repliées, par id. Un Set d'EXCEPTIONS plutôt qu'un état par
  // journée : le calendrier arrive déplié, et une journée ajoutée ensuite
  // (nouvelle journée du commissaire) l'est aussi, sans initialisation.
  const [collapsedRounds, setCollapsedRounds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleRound = useCallback((roundId: string) => {
    setCollapsedRounds((prev) => {
      const next = new Set(prev);
      if (!next.delete(roundId)) next.add(roundId);
      return next;
    });
  }, []);

  const statusLabels: Record<string, string> = {
    pending: t.leagues.roundStatusPending,
    in_progress: t.leagues.roundStatusInProgress,
    completed: t.leagues.roundStatusCompleted,
  };

  const counts = useMemo(
    () => ({
      all: rounds.length,
      upcoming: filterRounds(rounds, "upcoming").length,
      played: filterRounds(rounds, "played").length,
    }),
    [rounds],
  );
  const visibleRounds = useMemo(
    () => filterRounds(rounds, filter),
    [rounds, filter],
  );

  if (rounds.length === 0) {
    return (
      <div
        data-testid="league-rounds-empty"
        className="text-sm text-gray-500 py-4"
      >
        {t.leagues.calendarEmpty}
      </div>
    );
  }

  const filters: Array<{ key: CalendarFilter; label: string }> = [
    { key: "all", label: t.leagues.calendarFilterAll },
    { key: "upcoming", label: t.leagues.calendarFilterUpcoming },
    { key: "played", label: t.leagues.calendarFilterPlayed },
  ];

  // « Tout replier » tant qu'au moins une journée VISIBLE est dépliée :
  // le bouton propose toujours l'action qui change quelque chose.
  const anyExpanded = visibleRounds.some((r) => !collapsedRounds.has(r.id));
  const toggleAll = () => {
    setCollapsedRounds(
      anyExpanded ? new Set(visibleRounds.map((r) => r.id)) : new Set(),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
      {rounds.length > 1 ? (
        <div
          data-testid="calendar-filters"
          role="tablist"
          className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs"
        >
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              data-testid={`calendar-filter-${f.key}`}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                filter === f.key
                  ? "bg-white text-nuffle-anthracite shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {f.label}
              <span className="ml-1 tabular-nums text-gray-400">
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      ) : null}
        {visibleRounds.length > 0 ? (
          <button
            type="button"
            data-testid="calendar-toggle-all"
            onClick={toggleAll}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            {anyExpanded ? t.leagues.collapseAll : t.leagues.expandAll}
          </button>
        ) : null}
      </div>

      {visibleRounds.length === 0 ? (
        <div
          data-testid="league-rounds-filter-empty"
          className="text-sm text-gray-500 py-2"
        >
          {t.leagues.calendarFilterEmpty}
        </div>
      ) : null}

      <ul
        data-testid="league-rounds"
        className="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        {visibleRounds.map((round) => {
          const start = formatDate(round.startDate, language);
          const end = formatDate(round.endDate, language);
          const label =
            round.name ?? `${t.leagues.roundLabel} ${round.roundNumber}`;
          const roundStatus = effectiveRoundStatus(round);
          const statusLabel = statusLabels[roundStatus] ?? roundStatus;
          const pairings = round.pairings ?? [];
          const progress = roundProgress(round);
          const expanded = !collapsedRounds.has(round.id);
          const progressPct =
            progress.total > 0
              ? Math.round((progress.played / progress.total) * 100)
              : 0;
          const groups = groupPairingsByPool(
            pairings,
            poolNamesById,
            poolIdByParticipantId,
            preferredPoolId,
          );
          const renderPairing = (pairing: LeaguePairingDetail) => (
            <PairingRow
              key={pairing.id}
              pairing={pairing}
              currentUserId={currentUserId}
              canRecordResult={canRecordResult}
              leagueId={leagueId}
              canViewRosters={canViewRosters}
              onPairingChanged={onPairingChanged}
            />
          );
          return (
            <li
              key={round.id}
              id={`journee-${round.roundNumber}`}
              data-testid={`league-round-${round.id}`}
              className={`overflow-hidden rounded-2xl border border-gray-200 border-l-4 bg-white shadow-sm ${
                ROUND_ACCENT[roundStatus] ?? "border-l-gray-300"
              }`}
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CollapseToggle
                    open={expanded}
                    onToggle={() => toggleRound(round.id)}
                    label={`${
                      expanded
                        ? t.leagues.collapseSection
                        : t.leagues.expandSection
                    } — ${label}`}
                    controls={`league-round-${round.id}-body`}
                    testId={`league-round-toggle-${round.id}`}
                  />
                  <span
                    className="inline-flex h-10 min-w-[2.75rem] items-center justify-center rounded-lg bg-nuffle-anthracite px-2 font-score text-xl tracking-wider text-white"
                    aria-hidden="true"
                  >
                    J{round.roundNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate font-semibold text-nuffle-anthracite">
                        {label}
                      </h4>
                      <span
                        data-testid={`league-round-status-${round.id}`}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          ROUND_CHIP[roundStatus] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                      {start || end ? (
                        <span>
                          📅 {start ?? "?"}
                          {end ? ` → ${end}` : ""}
                        </span>
                      ) : null}
                      {progress.total > 0 ? (
                        <span
                          data-testid={`league-round-progress-${round.id}`}
                          className="tabular-nums"
                        >
                          {t.leagues.calendarProgress
                            .replace("{{played}}", String(progress.played))
                            .replace("{{total}}", String(progress.total))}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {progress.total > 0 ? (
                    <div
                      className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 sm:block"
                      role="progressbar"
                      aria-valuenow={progress.played}
                      aria-valuemin={0}
                      aria-valuemax={progress.total}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width]"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  ) : null}
                  {isCommissioner ? (
                    <RoundFollowupButton
                      roundId={round.id}
                      roundNumber={round.roundNumber}
                    />
                  ) : null}
                  <MatchdayExport
                    round={round}
                    statusLabel={(p) =>
                      pairingScoreLabel(p) ??
                      matchSheetPendingLabel(p.matchSheet?.status) ??
                      pairingPlannedLabel(
                        p,
                        t.leagues.pairingStatusPlanned,
                        language,
                      ) ??
                      pairingStatusBadge(p.status, t).label
                    }
                  />
                </div>
              </header>

              <div
                id={`league-round-${round.id}-body`}
                hidden={!expanded}
                className="space-y-3 p-3 sm:p-4"
              >
                {pairings.length === 0 ? (
                  <div
                    data-testid={`league-round-${round.id}-pairings-empty`}
                    className="text-xs text-gray-500"
                  >
                    {t.leagues.pairingsEmpty}
                  </div>
                ) : !groups ? (
                  <ul className="space-y-3">{pairings.map(renderPairing)}</ul>
                ) : (
                  groups.map((group) => (
                    <div
                      key={group.poolId ?? "__unassigned__"}
                      data-testid={`round-pool-${round.id}-${group.poolId ?? "none"}`}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                          {group.poolName ?? t.leagues.pairingUnassignedPool}
                        </span>
                        {group.poolId && group.poolId === preferredPoolId ? (
                          <span className="text-[11px] font-medium text-nuffle-bronze">
                            {t.leagues.myPoolBadge}
                          </span>
                        ) : null}
                      </div>
                      <ul className="space-y-3">
                        {group.pairings.map(renderPairing)}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface PairingRowProps {
  pairing: LeaguePairingDetail;
  currentUserId: string | null;
  canRecordResult?: boolean;
  leagueId?: string | null;
  canViewRosters?: boolean;
  onPairingChanged?: () => void;
}

function toCardTeam(
  participant: LeaguePairingTeamDetail,
  side: "home" | "away",
  leagueId: string | null | undefined,
  canViewRosters: boolean | undefined,
): MatchCardTeam {
  const team = participant.team;
  return {
    name: team.name,
    roster: team.roster,
    logoUrl: team.logoUrl ?? null,
    coachName: team.owner?.coachName ?? null,
    testId: `pairing-team-${side}`,
    coachTestId: `pairing-coach-${side}`,
    // Le nom mene au roster : meme page que le bouton « Voir le roster »
    // de la liste des participants.
    renderName: (name) => (
      <TeamRosterLink
        leagueId={leagueId}
        teamId={participant.teamId}
        canViewRoster={canViewRosters}
        testIdSuffix={`pairing-${side}-${participant.teamId}`}
      >
        {name}
      </TeamRosterLink>
    ),
  };
}

function PairingRow({
  pairing,
  currentUserId,
  canRecordResult,
  leagueId,
  canViewRosters,
  onPairingChanged,
}: PairingRowProps) {
  const { t, language } = useLanguage();

  const isInvolved =
    currentUserId !== null &&
    (pairing.homeParticipant.team.ownerId === currentUserId ||
      pairing.awayParticipant.team.ownerId === currentUserId);
  // Acces a la feuille de match : les 2 coachs impliques + le commissaire.
  const canOpenSheet = Boolean(canRecordResult) || isInvolved;
  const cancelled = pairing.status === "cancelled";
  // Libelle selon que le match est deja joue ou non.
  const played =
    pairing.status === "played" ||
    pairing.status === "forfeit_home" ||
    pairing.status === "forfeit_away";

  const statusBadge = pairingStatusBadge(pairing.status, t);
  // La feuille en attente de validation prime sur le statut du pairing
  // (qui reste « Programmé » jusqu'à la validation du commissaire).
  const pendingLabel = matchSheetPendingLabel(pairing.matchSheet?.status);
  // Une fois validée, c'est le score qui s'affiche, pas « Joué ».
  const scoreLabel = pairingScoreLabel(pairing);
  // Date convenue par les coachs : « Prévu le … » remplace « À jouer ».
  const plannedLabel = pairingPlannedLabel(
    pairing,
    t.leagues.pairingStatusPlanned,
    language,
  );
  const canSchedule =
    !!onPairingChanged &&
    canSchedulePairing({
      pairing,
      currentUserId,
      isCommissioner: Boolean(canRecordResult),
    });

  // Un seul badge de statut : validation en attente > date prevue > statut.
  // Le score, lui, vit dans le cartouche central.
  const status: MatchCardStatus | null = pendingLabel
    ? {
        label: pendingLabel,
        tone: "pending",
        testId: `pairing-sheet-pending-${pairing.id}`,
        title:
          "Feuille de match saisie par les coachs, en attente de validation par le commissaire",
      }
    : plannedLabel
      ? {
          label: plannedLabel,
          tone: "planned",
          testId: `pairing-planned-${pairing.id}`,
          title: t.leagues.pairingScheduleLabel,
        }
      : scoreLabel
        ? {
            label: t.leagues.pairingStatusValidated,
            tone: "played",
            testId: `pairing-validated-${pairing.id}`,
            title: "Résultat validé par le commissaire",
          }
        : {
            label: statusBadge.label,
            tone: statusBadge.tone,
            testId: `pairing-status-${pairing.id}`,
          };

  return (
    <MatchCard
      testId={`league-pairing-${pairing.id}`}
      home={toCardTeam(pairing.homeParticipant, "home", leagueId, canViewRosters)}
      away={toCardTeam(pairing.awayParticipant, "away", leagueId, canViewRosters)}
      scoreLabel={scoreLabel}
      scoreTestId={scoreLabel ? `pairing-score-${pairing.id}` : undefined}
      status={status}
      highlighted={isInvolved}
      highlightLabel={t.leagues.myMatchBadge}
      actions={
        <>
          {canSchedule ? (
            <PairingScheduleEditor
              pairingId={pairing.id}
              scheduledAt={pairing.scheduledAt}
              onChanged={onPairingChanged as () => void}
            />
          ) : null}
          {canOpenSheet && !cancelled ? (
            <Link
              href={`/leagues/pairings/${pairing.id}/sheet`}
              data-testid={`pairing-sheet-${pairing.id}`}
              className="text-xs px-2 py-1 rounded border border-nuffle-gold text-nuffle-anthracite font-medium hover:bg-nuffle-gold/10"
            >
              {played ? t.leagues.pairingSheetView : t.leagues.pairingSheetOpen}
            </Link>
          ) : null}
        </>
      }
    >
      <PairingBonusBreakdown
        pairingId={pairing.id}
        status={pairing.status}
        homeName={pairing.homeParticipant.team.name}
        awayName={pairing.awayParticipant.team.name}
        bonusPointsHome={pairing.bonusPointsHome}
        bonusPointsAway={pairing.bonusPointsAway}
        bonusBreakdown={pairing.bonusBreakdown}
      />
    </MatchCard>
  );
}

function pairingStatusBadge(
  status: string,
  t: ReturnType<typeof useLanguage>["t"],
): { label: string; tone: MatchCardStatus["tone"] } {
  switch (status) {
    case "scheduled":
      return { label: t.leagues.pairingStatusScheduled, tone: "neutral" };
    case "in_progress":
      return { label: t.leagues.pairingStatusInProgress, tone: "live" };
    case "played":
      return { label: t.leagues.pairingStatusPlayed, tone: "played" };
    case "forfeit_home":
    case "forfeit_away":
      return { label: t.leagues.pairingStatusForfeit, tone: "forfeit" };
    case "cancelled":
      return { label: t.leagues.pairingStatusCancelled, tone: "cancelled" };
    default:
      return { label: status, tone: "neutral" };
  }
}
