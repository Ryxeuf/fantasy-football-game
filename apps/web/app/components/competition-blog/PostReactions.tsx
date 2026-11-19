"use client";

/**
 * Barre de réactions d'un article (catalogue fixe). Un membre bascule une
 * réaction d'un clic ; un lecteur voit les compteurs sans bouton actif.
 */

import { useState } from "react";
import {
  REACTIONS,
  toggleReaction,
  type BlogCompetition,
  type ReactionKind,
  type ReactionSummary,
} from "../../lib/competition-blog";

interface PostReactionsProps {
  readonly competition: BlogCompetition;
  readonly postId: string;
  readonly initial: ReactionSummary;
  readonly canReact: boolean;
}

export default function PostReactions({
  competition,
  postId,
  initial,
  canReact,
}: PostReactionsProps) {
  const [summary, setSummary] = useState<ReactionSummary>(initial);
  const [pending, setPending] = useState<ReactionKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onToggle = async (kind: ReactionKind) => {
    if (!canReact || pending) return;
    setPending(kind);
    setError(null);
    try {
      const on = !summary.mine.includes(kind);
      setSummary(await toggleReaction(competition, postId, kind, on));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Réaction impossible");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-1" data-testid="post-reactions">
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map(({ kind, emoji, label }) => {
          const mine = summary.mine.includes(kind);
          const count = summary.counts[kind] ?? 0;
          if (!canReact && count === 0) return null;
          return (
            <button
              key={kind}
              type="button"
              title={label}
              aria-label={`${label} (${count})`}
              aria-pressed={mine}
              disabled={!canReact || pending !== null}
              onClick={() => onToggle(kind)}
              data-testid={`post-reaction-${kind}`}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${
                mine
                  ? "border-nuffle-gold bg-nuffle-gold/20 text-nuffle-bronze"
                  : "border-gray-300 bg-white text-gray-700"
              } ${canReact ? "hover:bg-gray-100" : "cursor-default"} disabled:opacity-70`}
            >
              <span aria-hidden="true">{emoji}</span>
              <span>{count}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
