"use client";

/**
 * Sprint Q lot Q.B.1 — Section MVP vote sur la page match.
 *
 * Affiche les top SPP candidats + bouton vote (auth requise) + tally
 * temps reel. Fenetre 24h post-match (cote serveur).
 */

import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../../lib/api-client";

interface MvpCandidate {
  rosterId: string;
  name: string;
  position: string;
  teamSlug: string;
  teamName: string;
  sppGained: number;
  tdCount: number;
  casCount: number;
  mvpCount: number;
}

interface TallyEntry {
  rosterId: string;
  count: number;
}

interface VoteTally {
  matchId: string;
  totalVotes: number;
  entries: TallyEntry[];
  winnerRosterId: string | null;
  windowClosesAt: string | null;
}

interface MvpVoteSectionProps {
  readonly matchId: string;
}

export function MvpVoteSection({ matchId }: MvpVoteSectionProps): JSX.Element {
  const [candidates, setCandidates] = useState<MvpCandidate[] | null>(null);
  const [tally, setTally] = useState<VoteTally | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  async function load(): Promise<void> {
    setError(null);
    try {
      const [c, t] = await Promise.all([
        apiRequest<{ candidates: MvpCandidate[] }>(
          `/pro-league/matches/${matchId}/mvp-candidates`,
        ),
        apiRequest<VoteTally>(
          `/pro-league/matches/${matchId}/mvp-tally`,
        ),
      ]);
      setCandidates(Array.isArray(c?.candidates) ? c.candidates : []);
      setTally(t);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "fetch error");
    }
  }

  useEffect(() => {
    load();
  }, [matchId]);

  async function vote(rosterId: string): Promise<void> {
    setSubmitting(rosterId);
    setSubmitError(null);
    setSubmitMessage(null);
    try {
      await apiRequest(`/pro-league/matches/${matchId}/mvp-vote`, {
        method: "POST",
        body: JSON.stringify({ votedRosterId: rosterId }),
        headers: { "Content-Type": "application/json" },
      });
      setSubmitMessage("Vote enregistre.");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof ApiClientError ? e.message : "vote error";
      setSubmitError(msg);
    } finally {
      setSubmitting(null);
    }
  }

  if (error) {
    return (
      <section className="mt-6" data-testid="mvp-error">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Player of the Match
        </h2>
        <p className="text-sm text-rose-400">{error}</p>
      </section>
    );
  }

  if (candidates === null || tally === null) {
    return (
      <section className="mt-6" data-testid="mvp-loading">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Player of the Match
        </h2>
        <p className="text-sm text-slate-500">Chargement…</p>
      </section>
    );
  }

  if (candidates.length === 0) {
    return (
      <section className="mt-6" data-testid="mvp-empty">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Player of the Match
        </h2>
        <p className="text-sm text-slate-500">
          Aucun candidat — le replay du match n&apos;est pas disponible.
        </p>
      </section>
    );
  }

  const tallyByRoster = new Map<string, number>(
    tally.entries.map((e) => [e.rosterId, e.count]),
  );
  const windowOpen =
    tally.windowClosesAt !== null &&
    new Date(tally.windowClosesAt).getTime() > Date.now();

  return (
    <section
      className="mt-6 rounded-lg border border-slate-700 bg-slate-900 p-4"
      data-testid="mvp-section"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase text-slate-400">
          Player of the Match
        </h2>
        <span
          className="text-xs text-slate-500"
          data-testid="mvp-total-votes"
        >
          {tally.totalVotes} vote{tally.totalVotes > 1 ? "s" : ""}
          {windowOpen ? " · ouvert 24h" : " · ferme"}
        </span>
      </div>

      {submitError && (
        <div
          className="mb-2 rounded border border-rose-700 bg-rose-950 px-2 py-1 text-xs text-rose-200"
          data-testid="mvp-submit-error"
        >
          {submitError}
        </div>
      )}

      {submitMessage && (
        <div
          className="mb-2 rounded border border-emerald-700 bg-emerald-950 px-2 py-1 text-xs text-emerald-200"
          data-testid="mvp-submit-message"
        >
          {submitMessage}
        </div>
      )}

      <ul
        className="space-y-1.5"
        data-testid="mvp-candidates"
      >
        {candidates.map((c, idx) => {
          const voteCount = tallyByRoster.get(c.rosterId) ?? 0;
          const isWinner = tally.winnerRosterId === c.rosterId;
          return (
            <li
              key={c.rosterId}
              className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-2 py-2"
              data-testid={`mvp-candidate-${c.rosterId}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-amber-300">
                    #{idx + 1}
                  </span>
                  <span className="font-semibold text-slate-100">
                    {c.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {c.position} · {c.teamName}
                  </span>
                  {isWinner && (
                    <span className="rounded bg-amber-700/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                      ⭐ MVP
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {c.sppGained} SPP · {c.tdCount} TD · {c.casCount} CAS
                  {c.mvpCount > 0 ? ` · ${c.mvpCount} MVP-event` : ""}
                </div>
              </div>
              <div className="ml-3 flex items-center gap-2">
                <span
                  className="font-mono text-sm text-slate-300"
                  data-testid={`mvp-count-${c.rosterId}`}
                >
                  {voteCount}
                </span>
                <button
                  type="button"
                  onClick={() => vote(c.rosterId)}
                  disabled={!windowOpen || submitting !== null}
                  className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid={`mvp-vote-${c.rosterId}`}
                >
                  Voter
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
