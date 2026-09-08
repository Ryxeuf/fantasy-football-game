"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import MatchCard, {
  type MatchCardStatus,
  type MatchCardTeam,
} from "../../components/competition/MatchCard";
import ScheduleEditor from "../../components/competition/ScheduleEditor";
import { formatPlannedDate } from "../../leagues/[id]/pairing-status";

/**
 * Rondes suisses d'une coupe : génération par le commissaire, rencontres
 * en `MatchCard` (même présentation que les journées de ligue), création
 * du match local par l'un des deux coachs, date prévisionnelle, annulation.
 */

export interface CupPairingTeamView {
  id: string;
  name: string;
  roster: string;
  logoUrl: string | null;
  ownerId: string;
  coachName: string | null;
}

export interface CupPairingView {
  id: string;
  tableNumber: number;
  status: string;
  scheduledAt: string | null;
  homeTeam: CupPairingTeamView;
  /** null = exempt. */
  awayTeam: CupPairingTeamView | null;
  localMatch: {
    id: string;
    status: string;
    teamAId: string;
    scoreTeamA: number | null;
    scoreTeamB: number | null;
  } | null;
}

export interface CupRoundView {
  id: string;
  roundNumber: number;
  name: string | null;
  system: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  pairings: CupPairingView[];
}

interface CupRoundsViewProps {
  cupId: string;
  /** "ouverte" | "en_cours" | "terminee" | "archivee" */
  cupStatus: string;
  rounds: CupRoundView[];
  /** Créateur de la coupe ou administrateur. */
  isCommissioner: boolean;
  /** Équipes du coach connecté inscrites à la coupe. */
  myTeamIds: string[];
  participantCount: number;
  /** Rappelé après toute mutation (rechargement de la coupe). */
  onChanged: () => void;
}

const OPEN_STATUSES: ReadonlySet<string> = new Set(["scheduled", "in_progress"]);
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["played", "bye", "cancelled"]);

/** Score « home – away » orienté selon le côté A du match local. */
export function cupPairingScoreLabel(pairing: CupPairingView): string | null {
  const m = pairing.localMatch;
  if (!m || m.status !== "completed") return null;
  if (typeof m.scoreTeamA !== "number" || typeof m.scoreTeamB !== "number") {
    return null;
  }
  const homeIsA = m.teamAId === pairing.homeTeam.id;
  const home = homeIsA ? m.scoreTeamA : m.scoreTeamB;
  const away = homeIsA ? m.scoreTeamB : m.scoreTeamA;
  return `${home} – ${away}`;
}

/** Une ronde est ouverte tant qu'une rencontre n'est ni jouée ni annulée. */
export function isRoundOpen(round: Pick<CupRoundView, "pairings">): boolean {
  return round.pairings.some((p) => OPEN_STATUSES.has(p.status));
}

function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
    template,
  );
}

export default function CupRoundsView({
  cupId,
  cupStatus,
  rounds,
  isCommissioner,
  myTeamIds,
  participantCount,
  onChanged,
}: CupRoundsViewProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = useMemo(() => new Set(myTeamIds), [myTeamIds]);

  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const lastOpen = lastRound ? isRoundOpen(lastRound) : false;
  const cupRunning = cupStatus === "en_cours";
  const canGenerate = isCommissioner && cupRunning && participantCount >= 2 && !lastOpen;
  const canDeleteLast =
    isCommissioner &&
    !!lastRound &&
    lastRound.pairings.every((p) => !p.localMatch && p.status !== "played");

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.cups.swissActionError);
    } finally {
      setBusy(null);
    }
  };

  const generate = () =>
    run("generate", () =>
      apiRequest(`/cup/${cupId}/rounds/swiss`, { method: "POST", body: "{}" }),
    );
  const deleteLast = () => {
    if (!lastRound) return;
    if (!confirm(fill(t.cups.swissConfirmDelete, { n: lastRound.roundNumber }))) return;
    void run("delete", () =>
      apiRequest(`/cup/${cupId}/rounds/last`, { method: "DELETE" }),
    );
  };
  const cancelPairing = (pairingId: string) => {
    if (!confirm(t.cups.swissConfirmCancel)) return;
    void run(`cancel-${pairingId}`, () =>
      apiRequest(`/cup/pairings/${pairingId}/cancel`, { method: "POST", body: "{}" }),
    );
  };
  const createMatch = (pairing: CupPairingView) => {
    const myTeam = mine.has(pairing.homeTeam.id)
      ? pairing.homeTeam
      : pairing.awayTeam && mine.has(pairing.awayTeam.id)
        ? pairing.awayTeam
        : null;
    const opponent = myTeam?.id === pairing.homeTeam.id ? pairing.awayTeam : pairing.homeTeam;
    if (!myTeam || !opponent) return;
    setBusy(`create-${pairing.id}`);
    setError(null);
    apiRequest<{ localMatch: { id: string } }>("/local-match", {
      method: "POST",
      body: JSON.stringify({
        teamAId: myTeam.id,
        teamBId: opponent.id,
        cupId,
        cupPairingId: pairing.id,
      }),
    })
      .then(({ localMatch }) => router.push(`/local-matches/${localMatch.id}`))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : t.cups.swissActionError);
        onChanged();
      })
      .finally(() => setBusy(null));
  };

  const roundStatusLabels: Record<string, string> = {
    pending: t.cups.swissRoundStatusPending,
    in_progress: t.cups.swissRoundStatusInProgress,
    completed: t.cups.swissRoundStatusCompleted,
  };
  const roundChip: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    in_progress: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
  };
  const roundAccent: Record<string, string> = {
    pending: "border-l-gray-300",
    in_progress: "border-l-amber-400",
    completed: "border-l-emerald-500",
  };

  return (
    <section data-testid="cup-rounds" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t.cups.swissTitle}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{t.cups.swissDescription}</p>
        </div>
        {isCommissioner ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="cup-swiss-generate"
              disabled={!canGenerate || busy !== null}
              onClick={generate}
              title={
                lastOpen && lastRound
                  ? fill(t.cups.swissGenerateBlocked, { n: lastRound.roundNumber })
                  : undefined
              }
              className="px-4 py-2 rounded-lg bg-nuffle-gold text-white text-sm font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
            >
              🎲 {fill(t.cups.swissGenerate, { n: (lastRound?.roundNumber ?? 0) + 1 })}
            </button>
            {canDeleteLast ? (
              <button
                type="button"
                data-testid="cup-swiss-delete-last"
                disabled={busy !== null}
                onClick={deleteLast}
                className="px-3 py-2 rounded-lg border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
              >
                {t.cups.swissDeleteLast}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isCommissioner && lastOpen && lastRound ? (
        <p data-testid="cup-swiss-blocked" className="text-xs text-gray-500">
          {fill(t.cups.swissGenerateBlocked, { n: lastRound.roundNumber })}
        </p>
      ) : null}

      {error ? (
        <div
          data-testid="cup-rounds-error"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {rounds.length === 0 ? (
        <p data-testid="cup-rounds-empty" className="text-sm text-gray-500">
          {t.cups.swissEmpty}
          {isCommissioner && !cupRunning ? ` ${t.cups.swissEmptyCommissioner}` : ""}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rounds.map((round) => {
            const total = round.pairings.filter((p) => p.status !== "bye").length;
            const played = round.pairings.filter(
              (p) => p.status !== "bye" && TERMINAL_STATUSES.has(p.status),
            ).length;
            const status =
              round.status === "completed"
                ? "completed"
                : played > 0 || round.pairings.some((p) => p.status === "in_progress")
                  ? "in_progress"
                  : round.status;
            return (
              <li
                key={round.id}
                data-testid={`cup-round-${round.id}`}
                className={`overflow-hidden rounded-2xl border border-gray-200 border-l-4 bg-white shadow-sm ${
                  roundAccent[status] ?? "border-l-gray-300"
                }`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-10 min-w-[2.75rem] items-center justify-center rounded-lg bg-nuffle-anthracite px-2 font-score text-xl tracking-wider text-white"
                      aria-hidden="true"
                    >
                      R{round.roundNumber}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-nuffle-anthracite">
                          {round.name ?? fill(t.cups.swissRoundLabel, { n: round.roundNumber })}
                        </h3>
                        <span
                          data-testid={`cup-round-status-${round.id}`}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            roundChip[status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {roundStatusLabels[status] ?? status}
                        </span>
                      </div>
                      {total > 0 ? (
                        <div
                          data-testid={`cup-round-progress-${round.id}`}
                          className="mt-0.5 text-xs tabular-nums text-gray-500"
                        >
                          {fill(t.cups.swissProgress, { played, total })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </header>
                <ul className="space-y-3 p-3 sm:p-4">
                  {round.pairings.map((pairing) => (
                    <CupPairingCard
                      key={pairing.id}
                      cupId={cupId}
                      pairing={pairing}
                      mine={mine}
                      isCommissioner={isCommissioner}
                      busy={busy}
                      language={language}
                      onCreateMatch={() => createMatch(pairing)}
                      onCancel={() => cancelPairing(pairing.id)}
                      onChanged={onChanged}
                    />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface CupPairingCardProps {
  cupId: string;
  pairing: CupPairingView;
  mine: ReadonlySet<string>;
  isCommissioner: boolean;
  busy: string | null;
  language: string;
  onCreateMatch: () => void;
  onCancel: () => void;
  onChanged: () => void;
}

function toCardTeam(team: CupPairingTeamView, side: "home" | "away"): MatchCardTeam {
  return {
    name: team.name,
    roster: team.roster,
    logoUrl: team.logoUrl,
    coachName: team.coachName,
    testId: `cup-pairing-team-${side}`,
    coachTestId: `cup-pairing-coach-${side}`,
  };
}

function CupPairingCard({
  cupId,
  pairing,
  mine,
  isCommissioner,
  busy,
  language,
  onCreateMatch,
  onCancel,
  onChanged,
}: CupPairingCardProps) {
  const { t } = useLanguage();
  const involved =
    mine.has(pairing.homeTeam.id) || (!!pairing.awayTeam && mine.has(pairing.awayTeam.id));
  const isBye = pairing.status === "bye" || pairing.awayTeam === null;
  const open = OPEN_STATUSES.has(pairing.status);
  const scoreLabel = cupPairingScoreLabel(pairing);
  const planned =
    pairing.status === "scheduled" ? formatPlannedDate(pairing.scheduledAt, language) : null;

  const status: MatchCardStatus = isBye
    ? { label: t.cups.swissStatusBye, tone: "neutral", testId: `cup-pairing-status-${pairing.id}` }
    : pairing.status === "played"
      ? { label: t.cups.swissStatusPlayed, tone: "played", testId: `cup-pairing-status-${pairing.id}` }
      : pairing.status === "cancelled"
        ? { label: t.cups.swissStatusCancelled, tone: "cancelled", testId: `cup-pairing-status-${pairing.id}` }
        : pairing.status === "in_progress"
          ? { label: t.cups.swissStatusInProgress, tone: "live", testId: `cup-pairing-status-${pairing.id}` }
          : planned
            ? {
                label: t.leagues.pairingStatusPlanned.replace("{{date}}", planned),
                tone: "planned",
                testId: `cup-pairing-planned-${pairing.id}`,
              }
            : { label: t.cups.swissStatusScheduled, tone: "neutral", testId: `cup-pairing-status-${pairing.id}` };

  const canCreate = involved && pairing.status === "scheduled" && !pairing.localMatch;
  const canSchedule = (involved || isCommissioner) && open && !isBye;
  const canCancel = isCommissioner && open && !isBye && !pairing.localMatch;

  return (
    <MatchCard
      testId={`cup-pairing-${pairing.id}`}
      home={toCardTeam(pairing.homeTeam, "home")}
      away={pairing.awayTeam ? toCardTeam(pairing.awayTeam, "away") : null}
      byeLabel={t.cups.swissByeLabel}
      scoreLabel={scoreLabel}
      scoreTestId={scoreLabel ? `cup-pairing-score-${pairing.id}` : undefined}
      status={status}
      highlighted={involved && !isBye}
      highlightLabel={t.leagues.myMatchBadge}
      meta={
        <span className="text-[11px] uppercase tracking-wide text-gray-400">
          {t.cups.swissTable.replace("{{n}}", String(pairing.tableNumber))}
        </span>
      }
      actions={
        <>
          {canCreate ? (
            <button
              type="button"
              data-testid={`cup-pairing-create-${pairing.id}`}
              disabled={busy !== null}
              onClick={onCreateMatch}
              className="text-xs px-2 py-1 rounded bg-nuffle-gold text-white font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
            >
              {t.cups.swissCreateMatch}
            </button>
          ) : null}
          {pairing.localMatch ? (
            <Link
              href={`/local-matches/${pairing.localMatch.id}`}
              data-testid={`cup-pairing-match-${pairing.id}`}
              className="text-xs px-2 py-1 rounded border border-nuffle-gold text-nuffle-anthracite font-medium hover:bg-nuffle-gold/10"
            >
              {t.cups.swissViewMatch}
            </Link>
          ) : null}
          {canSchedule ? (
            <ScheduleEditor
              id={pairing.id}
              endpoint={`/cup/pairings/${pairing.id}/schedule`}
              scheduledAt={pairing.scheduledAt}
              testIdBase="cup-pairing-schedule"
              onChanged={onChanged}
              labels={{
                label: t.leagues.pairingScheduleLabel,
                open: t.leagues.pairingScheduleButton,
                edit: t.leagues.pairingScheduleEdit,
                save: t.leagues.pairingScheduleSave,
                clear: t.leagues.pairingScheduleClear,
                cancel: t.leagues.pairingScheduleCancel,
                invalid: t.leagues.pairingScheduleInvalid,
                error: t.leagues.pairingScheduleError,
              }}
            />
          ) : null}
          {canCancel ? (
            <button
              type="button"
              data-testid={`cup-pairing-cancel-${pairing.id}`}
              disabled={busy !== null}
              onClick={onCancel}
              className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {t.cups.swissCancelPairing}
            </button>
          ) : null}
        </>
      }
    />
  );
}
