"use client";
/**
 * Bracket de play-offs d'une coupe.
 *
 * Même écran que celui de la ligue (`leagues/[id]/PlayoffBracketView`) : tant
 * qu'aucun bracket n'existe, le commissaire voit un panneau de lancement ;
 * une fois généré, tout le monde voit les tours en colonnes — à condition
 * qu'il soit PUBLIÉ, c'est le serveur qui tranche (il sert `rounds: []` aux
 * autres).
 *
 * Les dérivations (tours, têtes courantes, édition possible) vivent dans
 * `playoff-bracket.ts`, pur et testé sans DOM.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { dynamicRoute } from "../../lib/typed-route";
import TeamLogo from "../../components/TeamLogo";
import {
  canEditSeeds,
  currentSeeds,
  groupRoundsByStage,
  type BracketStage,
} from "./playoff-bracket";

export interface CupBracketTeam {
  id: string;
  name: string;
  roster: string;
  logoUrl: string | null;
  coachName: string | null;
}

export interface CupBracketRound {
  id: string;
  roundNumber: number;
  slot: string;
  name: string | null;
  status: string;
  pairingId: string | null;
  pairingStatus: string | null;
  placeholder: boolean;
  homeTeam: CupBracketTeam | null;
  awayTeam: CupBracketTeam | null;
  localMatch: { id: string; status: string } | null;
  scoreLabel: string | null;
}

export interface CupBracketResponse {
  cupId: string;
  playoffSize: number;
  playoffsPublished: boolean | null;
  regularRoundsComplete: boolean;
  poolQualification: {
    totalQualified: number;
    playoffSize: number;
    consistent: boolean;
  };
  rounds: CupBracketRound[];
}

/** Équipe inscrite, proposée comme tête de série. */
export interface CupBracketEligibleTeam {
  id: string;
  name: string;
}

interface Props {
  readonly cupId: string;
  readonly isCommissioner: boolean;
  readonly eligibleTeams: readonly CupBracketEligibleTeam[];
  readonly onChanged?: () => void;
}

export default function CupPlayoffBracketView({
  cupId,
  isCommissioner,
  eligibleTeams,
  onChanged,
}: Props) {
  const { t } = useLanguage();
  const [data, setData] = useState<CupBracketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cupId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiRequest<CupBracketResponse>(`/cup/${cupId}/playoffs`));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [cupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load();
    onChanged?.();
  }, [load, onChanged]);

  const stages = useMemo(
    () => (data ? groupRoundsByStage(data.rounds) : []),
    [data],
  );

  if (loading) {
    return (
      <p data-testid="cup-playoffs-loading" className="text-sm text-gray-500">
        {t.cups.playoffsLoading}
      </p>
    );
  }
  if (error) {
    return (
      <p data-testid="cup-playoffs-error" className="text-sm text-red-600">
        {error}
      </p>
    );
  }
  if (!data) return null;

  // Pas encore de bracket : panneau de lancement pour le commissaire, rien
  // pour les autres (une coupe sans play-off ne doit pas annoncer un vide).
  if (data.rounds.length === 0) {
    if (!isCommissioner) return null;
    return <LaunchPanel cupId={cupId} data={data} onChanged={refresh} />;
  }

  const published = data.playoffsPublished !== false;

  return (
    <section data-testid="cup-playoffs" className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">
        {t.cups.playoffsTitle}
      </h2>

      {isCommissioner ? (
        <PublishToggle
          cupId={cupId}
          published={published}
          onChanged={refresh}
        />
      ) : null}

      {isCommissioner && canEditSeeds(data.rounds) ? (
        <SeedsEditor
          cupId={cupId}
          size={data.playoffSize}
          eligibleTeams={eligibleTeams}
          seeds={currentSeeds(data.rounds, data.playoffSize)}
          onSaved={refresh}
        />
      ) : null}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <div
            key={stage.stage}
            data-testid={`cup-playoff-stage-${stage.stage}`}
            className="flex-shrink-0 w-64 space-y-2"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              {stageTitle(stage.stage, t)}
            </h3>
            {stage.rounds.map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

type Translations = ReturnType<typeof useLanguage>["t"];

function stageTitle(stage: BracketStage, t: Translations): string {
  return stage === "qf"
    ? t.cups.playoffsStageQuarter
    : stage === "sf"
      ? t.cups.playoffsStageSemi
      : t.cups.playoffsStageFinal;
}

function RoundCard({ round }: { readonly round: CupBracketRound }) {
  const { t } = useLanguage();
  const tbd = t.cups.playoffsTbd;
  return (
    <div
      data-testid={`cup-playoff-round-${round.slot}`}
      className={`rounded-md border p-2 text-sm space-y-1 ${
        round.placeholder
          ? "border-dashed border-gray-300 bg-gray-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-gray-500">
          {round.name ?? round.slot}
        </span>
        {round.scoreLabel ? (
          <span
            data-testid={`cup-playoff-score-${round.slot}`}
            className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800"
          >
            {round.scoreLabel}
          </span>
        ) : null}
      </div>
      <SideRow team={round.homeTeam} side="home" tbd={tbd} placeholder={false} />
      <div className="text-center text-xs text-gray-400">vs</div>
      <SideRow
        team={round.awayTeam}
        side="away"
        tbd={tbd}
        placeholder={round.placeholder}
      />
      {round.localMatch ? (
        <Link
          href={dynamicRoute(`/local-matches/${round.localMatch.id}`)}
          data-testid={`cup-playoff-match-${round.slot}`}
          className="mt-1 block text-center text-xs text-blue-600 hover:underline"
        >
          {round.localMatch.status === "completed"
            ? t.cups.playoffsViewMatch
            : t.cups.playoffsResumeMatch}
        </Link>
      ) : null}
    </div>
  );
}

function SideRow({
  team,
  side,
  tbd,
  placeholder,
}: {
  readonly team: CupBracketTeam | null;
  readonly side: "home" | "away";
  readonly tbd: string;
  readonly placeholder: boolean;
}) {
  if (!team || placeholder) {
    return (
      <div
        data-testid={`cup-bracket-side-${side}`}
        className="flex items-center gap-2 rounded bg-gray-100 px-2 py-1 text-xs italic text-gray-400"
      >
        {tbd}
      </div>
    );
  }
  return (
    <div
      data-testid={`cup-bracket-side-${side}`}
      className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1"
    >
      <TeamLogo
        slug={team.roster}
        logoUrl={team.logoUrl}
        size={24}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-nuffle-anthracite">{team.name}</span>
        {team.coachName ? (
          <span className="ml-1 text-xs text-gray-500">({team.coachName})</span>
        ) : null}
      </span>
    </div>
  );
}

function PublishToggle({
  cupId,
  published,
  onChanged,
}: {
  readonly cupId: string;
  readonly published: boolean;
  readonly onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/cup/${cupId}/playoffs/publish`, {
        method: "PATCH",
        body: JSON.stringify({ published: !published }),
      });
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [cupId, published, onChanged]);

  return (
    <div
      data-testid="cup-playoffs-publish"
      className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        published
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
    >
      <span data-testid="cup-playoffs-publish-state">
        {published ? t.cups.playoffsPublished : t.cups.playoffsUnpublished}
      </span>
      <button
        type="button"
        data-testid="cup-playoffs-publish-toggle"
        onClick={toggle}
        disabled={busy}
        className="rounded-md border border-nuffle-gold bg-white px-3 py-1 text-sm font-medium text-nuffle-bronze hover:bg-nuffle-gold/10 disabled:opacity-50"
      >
        {published ? t.cups.playoffsUnpublish : t.cups.playoffsPublish}
      </button>
      {error ? <span className="text-red-600">{error}</span> : null}
    </div>
  );
}

function SeedsEditor({
  cupId,
  size,
  eligibleTeams,
  seeds,
  onSaved,
}: {
  readonly cupId: string;
  readonly size: number;
  readonly eligibleTeams: readonly CupBracketEligibleTeam[];
  readonly seeds: readonly string[];
  readonly onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setDraft(Array.from({ length: size }, (_, i) => seeds[i] ?? ""));
    setError(null);
  }, [seeds, size]);

  const submit = useCallback(async () => {
    if (draft.some((s) => s.length === 0)) {
      setError(t.cups.playoffsSeedsIncomplete.replace("{size}", String(size)));
      return;
    }
    if (new Set(draft).size !== draft.length) {
      setError(t.cups.playoffsSeedsDuplicate);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/cup/${cupId}/playoffs/seeds`, {
        method: "PATCH",
        body: JSON.stringify({ teamIds: draft }),
      });
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [cupId, draft, onSaved, size, t.cups]);

  if (!open) {
    return (
      <button
        type="button"
        data-testid="cup-playoffs-edit-seeds"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="self-start rounded-md border border-nuffle-gold bg-white px-3 py-1.5 text-sm font-medium text-nuffle-bronze hover:bg-nuffle-gold/10"
      >
        {t.cups.playoffsEditSeeds}
      </button>
    );
  }

  return (
    <div
      data-testid="cup-playoffs-seeds-editor"
      className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-3"
    >
      <div className="text-sm font-medium text-amber-900">
        {t.cups.playoffsSeedsTitle.replace("{size}", String(size))}
      </div>
      {error ? (
        <p
          data-testid="cup-playoffs-seeds-error"
          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
        >
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {draft.map((value, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            <span className="w-16 shrink-0 text-xs text-gray-500">
              {t.cups.playoffsSeedLabel.replace("{n}", String(idx + 1))}
            </span>
            <select
              data-testid={`cup-playoff-seed-${idx}`}
              value={value}
              disabled={busy}
              onChange={(e) =>
                setDraft((prev) => {
                  const next = [...prev];
                  next[idx] = e.target.value;
                  return next;
                })
              }
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">{t.cups.playoffsSeedPick}</option>
              {eligibleTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="cup-playoffs-save-seeds"
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-white hover:bg-nuffle-gold/90 disabled:opacity-50"
        >
          {t.cups.playoffsSaveSeeds}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {t.cups.playoffsCancel}
        </button>
      </div>
    </div>
  );
}

function LaunchPanel({
  cupId,
  data,
  onChanged,
}: {
  readonly cupId: string;
  readonly data: CupBracketResponse;
  readonly onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [size, setSize] = useState(data.playoffSize);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeSize = useCallback(
    async (next: number) => {
      setBusy(true);
      setError(null);
      try {
        await apiRequest(`/cup/${cupId}`, {
          method: "PATCH",
          body: JSON.stringify({ playoffSize: next }),
        });
        setSize(next);
        onChanged();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setBusy(false);
      }
    },
    [cupId, onChanged],
  );

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/cup/${cupId}/playoffs/start`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [cupId, force, onChanged]);

  const pool = data.poolQualification;

  return (
    <section data-testid="cup-playoffs-launch" className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">
        {t.cups.playoffsTitle}
      </h2>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        {t.cups.playoffsSize}
        <select
          data-testid="cup-playoff-size"
          value={size}
          disabled={busy}
          onChange={(e) => changeSize(Number(e.target.value))}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value={0}>{t.cups.playoffsSizeNone}</option>
          <option value={2}>{t.cups.playoffsSizeFinal}</option>
          <option value={4}>{t.cups.playoffsSizeSemi}</option>
          <option value={8}>{t.cups.playoffsSizeQuarter}</option>
        </select>
      </label>

      <ul className="space-y-1 text-sm text-gray-600">
        <li data-testid="cup-playoffs-regular-state">
          {data.regularRoundsComplete
            ? t.cups.playoffsRegularComplete
            : t.cups.playoffsRegularOpen}
        </li>
        {pool.totalQualified > 0 ? (
          <li data-testid="cup-playoffs-pool-state">
            {t.cups.playoffsPoolState
              .replace("{total}", String(pool.totalQualified))
              .replace("{size}", String(pool.playoffSize))}{" "}
            —{" "}
            {pool.consistent
              ? t.cups.playoffsPoolConsistent
              : t.cups.playoffsPoolInconsistent}
          </li>
        ) : null}
      </ul>

      {!data.regularRoundsComplete ? (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            data-testid="cup-playoffs-force"
            checked={force}
            disabled={busy}
            onChange={(e) => setForce(e.target.checked)}
          />
          {t.cups.playoffsForceClose}
        </label>
      ) : null}

      <button
        type="button"
        data-testid="cup-playoffs-start"
        onClick={start}
        disabled={busy || size === 0}
        className="rounded bg-nuffle-anthracite px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {t.cups.playoffsStart}
      </button>

      {error ? (
        <p data-testid="cup-playoffs-launch-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}
