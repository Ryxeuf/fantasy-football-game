"use client";
import Link from "next/link";
import { useLanguage } from "../../contexts/LanguageContext";
import { MatchdayExport } from "./MatchdayExport";
import { PairingBonusBreakdown } from "./PairingBonusBreakdown";
import type {
  LeagueRoundDetail,
  LeaguePairingDetail,
  LeaguePairingTeamDetail,
} from "./types";

// Sprint Ligues v2 PR2 — calendrier interactif (ligue 100% physique).
// Affiche pour chaque round la liste des pairings (home vs away). La
// saisie d'un resultat se fait via la FEUILLE DE MATCH : les 2 coachs
// impliques (et le commissaire) y accedent par un lien. Les forfaits /
// annulations affichent uniquement un badge.

interface SeasonCalendarProps {
  rounds: LeagueRoundDetail[];
  /** userId du coach connecte (null si non authentifie). */
  currentUserId: string | null;
  /** Vrai si le user est commissaire (acces feuille sur tous les matchs). */
  canRecordResult?: boolean;
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

export function SeasonCalendar({
  rounds,
  currentUserId,
  canRecordResult,
}: SeasonCalendarProps) {
  const { t, language } = useLanguage();

  const statusLabels: Record<string, string> = {
    pending: t.leagues.roundStatusPending,
    in_progress: t.leagues.roundStatusInProgress,
    completed: t.leagues.roundStatusCompleted,
  };

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

  return (
    <ul
      data-testid="league-rounds"
      className="grid grid-cols-1 lg:grid-cols-2 gap-3"
    >
      {rounds.map((round) => {
        const start = formatDate(round.startDate, language);
        const end = formatDate(round.endDate, language);
        const label =
          round.name ?? `${t.leagues.roundLabel} ${round.roundNumber}`;
        const statusLabel = statusLabels[round.status] ?? round.status;
        const pairings = round.pairings ?? [];
        return (
          <li
            key={round.id}
            data-testid={`league-round-${round.id}`}
            className="border border-gray-200 rounded-md bg-white p-3 space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-nuffle-anthracite">
                  J{round.roundNumber} — {label}
                </div>
                {start || end ? (
                  <div className="text-xs text-gray-500">
                    {start ?? "?"}
                    {end ? ` → ${end}` : ""}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  {statusLabel}
                </span>
                <MatchdayExport
                  round={round}
                  statusLabel={(s) => pairingStatusBadge(s, t).label}
                />
              </div>
            </div>

            {pairings.length === 0 ? (
              <div
                data-testid={`league-round-${round.id}-pairings-empty`}
                className="text-xs text-gray-500"
              >
                {t.leagues.pairingsEmpty}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {pairings.map((pairing) => (
                  <PairingRow
                    key={pairing.id}
                    pairing={pairing}
                    currentUserId={currentUserId}
                    canRecordResult={canRecordResult}
                  />
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface PairingRowProps {
  pairing: LeaguePairingDetail;
  currentUserId: string | null;
  canRecordResult?: boolean;
}

function PairingRow({
  pairing,
  currentUserId,
  canRecordResult,
}: PairingRowProps) {
  const { t } = useLanguage();

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

  return (
    <li
      data-testid={`league-pairing-${pairing.id}`}
      className="flex items-center justify-between gap-2 text-sm border border-gray-100 rounded px-2 py-1.5 bg-gray-50/40"
    >
      <div className="flex-1 min-w-0">
        <div className="truncate">
          <TeamSpan team={pairing.homeParticipant} side="home" />
          <span className="mx-2 text-gray-400">vs</span>
          <TeamSpan team={pairing.awayParticipant} side="away" />
        </div>
        <PairingBonusBreakdown
          pairingId={pairing.id}
          status={pairing.status}
          homeName={pairing.homeParticipant.team.name}
          awayName={pairing.awayParticipant.team.name}
          bonusPointsHome={pairing.bonusPointsHome}
          bonusPointsAway={pairing.bonusPointsAway}
          bonusBreakdown={pairing.bonusBreakdown}
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
        {canOpenSheet && !cancelled ? (
          <Link
            href={`/leagues/pairings/${pairing.id}/sheet`}
            data-testid={`pairing-sheet-${pairing.id}`}
            className="text-xs px-2 py-1 rounded border border-nuffle-gold text-nuffle-anthracite font-medium hover:bg-nuffle-gold/10"
          >
            {played ? "Voir la feuille" : "Feuille de match"}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

interface TeamSpanProps {
  team: LeaguePairingTeamDetail;
  side: "home" | "away";
}

function TeamSpan({ team, side }: TeamSpanProps) {
  return (
    <span
      data-testid={`pairing-team-${side}`}
      className="font-medium text-nuffle-anthracite"
    >
      {team.team.name}
    </span>
  );
}

function pairingStatusBadge(
  status: string,
  t: ReturnType<typeof useLanguage>["t"],
): { label: string; className: string } {
  switch (status) {
    case "scheduled":
      return {
        label: t.leagues.pairingStatusScheduled,
        className: "bg-gray-200 text-gray-700",
      };
    case "in_progress":
      return {
        label: t.leagues.pairingStatusInProgress,
        className: "bg-amber-100 text-amber-800",
      };
    case "played":
      return {
        label: t.leagues.pairingStatusPlayed,
        className: "bg-emerald-100 text-emerald-800",
      };
    case "forfeit_home":
    case "forfeit_away":
      return {
        label: t.leagues.pairingStatusForfeit,
        className: "bg-red-100 text-red-800",
      };
    case "cancelled":
      return {
        label: t.leagues.pairingStatusCancelled,
        className: "bg-gray-100 text-gray-500",
      };
    default:
      return { label: status, className: "bg-gray-100 text-gray-700" };
  }
}
