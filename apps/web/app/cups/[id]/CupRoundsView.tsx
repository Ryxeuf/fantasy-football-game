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
import { matchSheetHref } from "../../lib/competition-links";
import {
  availableTeams,
  CUP_ROUND_SYSTEMS,
  hasDuplicateTeam,
  toManualPairingsPayload,
  type CupRoundSystem,
  type ManualPairingDraft,
} from "./manual-round";
import { dynamicRoute } from "../../lib/typed-route";
import { groupCupRoundByPool } from "./round-pools";

/**
 * Rondes d'une coupe : génération par le commissaire (tirage au sort, ronde
 * suisse ou saisie manuelle), rencontres en `MatchCard` (même présentation
 * que les journées de ligue), feuille de match identique à celle des ligues,
 * date prévisionnelle, annulation.
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
  /** `regular` | `playoff`. Optionnel : API antérieure au bracket. */
  kind?: string;
  /** Slot de bracket (`qf1`, `sf2`, `final`). `null` hors play-off. */
  bracketSlot?: string | null;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  pairings: CupPairingView[];
}

/** Équipe inscrite, pour composer une ronde à la main. */
export interface CupRoundParticipant {
  id: string;
  name: string;
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
  /** Inscrits, requis pour la saisie manuelle. Absent = mode indisponible. */
  participants?: readonly CupRoundParticipant[];
  /**
   * `{ poolId → nom }`. Vide (défaut) = coupe sans poule : les rencontres
   * s'affichent à plat, comme avant.
   */
  poolNamesById?: Readonly<Record<string, string>>;
  /** `{ teamId → poolId }` des inscrits. */
  poolIdByTeamId?: Readonly<Record<string, string | null>>;
  /** Poule du coach connecté : remontée en tête de chaque ronde. */
  preferredPoolId?: string | null;
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
  participants = [],
  poolNamesById = {},
  poolIdByTeamId = {},
  preferredPoolId = null,
  onChanged,
}: CupRoundsViewProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Défaut : tirage au sort tant qu'aucune ronde n'existe (le classement est
  // vide, une « suisse » s'y réduirait à l'ordre alphabétique), suisse ensuite.
  const [system, setSystem] = useState<CupRoundSystem>("random");
  const [manual, setManual] = useState<readonly ManualPairingDraft[]>([]);
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

  const manualDuplicate = hasDuplicateTeam(manual);
  const manualReady = manual.length > 0 && !manualDuplicate;
  const generateBlockedByManual = system === "manual" && !manualReady;

  const generate = () =>
    run("generate", async () => {
      await apiRequest(`/cup/${cupId}/rounds`, {
        method: "POST",
        body: JSON.stringify({
          system,
          ...(system === "manual"
            ? { pairings: toManualPairingsPayload(manual) }
            : {}),
        }),
      });
      setManual([]);
    });
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

  const systemLabel = (value: CupRoundSystem): string =>
    value === "random"
      ? t.cups.roundSystemRandom
      : value === "manual"
        ? t.cups.roundSystemManual
        : t.cups.roundSystemSwiss;
  const systemHint = (value: CupRoundSystem): string =>
    value === "random"
      ? t.cups.roundSystemRandomHint
      : value === "manual"
        ? t.cups.roundSystemManualHint
        : t.cups.roundSystemSwissHint;
  // `bracket` n'est pas un mode d'appariement PROPOSÉ : il est posé par le
  // lancement des play-offs. Sans son libellé, une ronde de bracket
  // s'annonçait « Suisse » (le repli du ternaire).
  const systemBadge = (value: string): string =>
    value === "random"
      ? t.cups.roundSystemBadgeRandom
      : value === "manual"
        ? t.cups.roundSystemBadgeManual
        : value === "bracket"
          ? t.cups.roundSystemBadgeBracket
          : t.cups.roundSystemBadgeSwiss;

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
              disabled={!canGenerate || generateBlockedByManual || busy !== null}
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

      {isCommissioner && canGenerate ? (
        <div
          data-testid="cup-round-system"
          className="rounded-lg border border-gray-200 bg-gray-50/70 p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t.cups.roundSystemLabel}
            </span>
            {CUP_ROUND_SYSTEMS.map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
                  system === value
                    ? "border-nuffle-gold bg-nuffle-gold/10 text-nuffle-anthracite"
                    : "border-gray-300 text-gray-600 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="cup-round-system"
                  className="sr-only"
                  value={value}
                  checked={system === value}
                  data-testid={`cup-round-system-${value}`}
                  onChange={() => setSystem(value)}
                />
                {systemLabel(value)}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">{systemHint(system)}</p>
          {system === "manual" ? (
            <ManualRoundEditor
              participants={participants}
              pairings={manual}
              onChange={setManual}
              duplicate={manualDuplicate}
            />
          ) : null}
        </div>
      ) : null}

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
            const groups = groupCupRoundByPool(
              round,
              poolNamesById,
              poolIdByTeamId,
              preferredPoolId,
            );
            const renderPairing = (pairing: CupPairingView) => (
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
            );
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
                          data-testid={`cup-round-system-badge-${round.id}`}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                        >
                          {systemBadge(round.system)}
                        </span>
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
                <div className="space-y-3 p-3 sm:p-4">
                  {groups === null ? (
                    <ul className="space-y-3">
                      {round.pairings.map(renderPairing)}
                    </ul>
                  ) : (
                    groups.map((group) => (
                      <div
                        key={group.poolId ?? "__unassigned__"}
                        data-testid={`cup-round-pool-${round.id}-${group.poolId ?? "none"}`}
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                            {group.poolName ?? t.cups.poolsUnassigned}
                          </span>
                          {group.poolId && group.poolId === preferredPoolId ? (
                            <span
                              data-testid={`cup-round-my-pool-${round.id}`}
                              className="text-[11px] font-medium text-nuffle-bronze"
                            >
                              {t.cups.myPoolBadge}
                            </span>
                          ) : null}
                        </div>
                        <ul className="space-y-3">
                          {group.items.map(renderPairing)}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
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
  // La feuille est le chemin NORMAL de saisie d'un résultat de coupe : elle
  // est la même qu'en ligue, et reste consultable une fois validée.
  const canOpenSheet = (involved || isCommissioner) && !isBye;

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
          {canOpenSheet ? (
            <Link
              href={dynamicRoute(matchSheetHref("cup", pairing.id))}
              data-testid={`cup-pairing-sheet-${pairing.id}`}
              title={t.cups.sheetOpenHint}
              className="text-xs px-2 py-1 rounded bg-nuffle-anthracite text-white font-medium hover:bg-nuffle-anthracite/90"
            >
              📝 {t.cups.sheetOpen}
            </Link>
          ) : null}
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

/**
 * Composition d'une ronde à la main. Chaque ligne est une rencontre ; la
 * liste « Extérieur » propose « — Exempte — » pour déclarer l'équipe qui ne
 * joue pas. Les équipes déjà engagées disparaissent des autres listes :
 * c'est ce qui empêche, à la saisie, la faute que le serveur refuserait.
 */
function ManualRoundEditor({
  participants,
  pairings,
  onChange,
  duplicate,
}: {
  participants: readonly CupRoundParticipant[];
  pairings: readonly ManualPairingDraft[];
  onChange: (next: readonly ManualPairingDraft[]) => void;
  duplicate: boolean;
}) {
  const { t } = useLanguage();
  const update = (index: number, patch: Partial<ManualPairingDraft>) =>
    onChange(pairings.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  return (
    <div data-testid="cup-manual-editor" className="mt-3 space-y-2">
      {pairings.map((pairing, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t.cups.manualHome}
            data-testid={`cup-manual-home-${index}`}
            value={pairing.homeTeamId}
            onChange={(e) => update(index, { homeTeamId: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{t.cups.manualPick}</option>
            {availableTeams(participants, pairings, pairing.homeTeamId).map(
              (team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ),
            )}
          </select>
          <span className="text-xs text-gray-400">vs</span>
          <select
            aria-label={t.cups.manualAway}
            data-testid={`cup-manual-away-${index}`}
            value={pairing.awayTeamId ?? ""}
            onChange={(e) =>
              update(index, { awayTeamId: e.target.value || null })
            }
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{t.cups.manualByeOption}</option>
            {availableTeams(participants, pairings, pairing.awayTeamId).map(
              (team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ),
            )}
          </select>
          <button
            type="button"
            data-testid={`cup-manual-remove-${index}`}
            onClick={() => onChange(pairings.filter((_, i) => i !== index))}
            className="text-xs text-red-600 hover:underline"
          >
            {t.cups.manualRemovePairing}
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="cup-manual-add"
          onClick={() =>
            onChange([...pairings, { homeTeamId: "", awayTeamId: "" }])
          }
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white"
        >
          + {t.cups.manualAddPairing}
        </button>
        {pairings.length === 0 ? (
          <span data-testid="cup-manual-empty" className="text-xs text-gray-500">
            {t.cups.manualEmpty}
          </span>
        ) : null}
        {duplicate ? (
          <span
            data-testid="cup-manual-duplicate"
            className="text-xs font-medium text-red-600"
          >
            {t.cups.manualDuplicate}
          </span>
        ) : null}
      </div>
    </div>
  );
}
