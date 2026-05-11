"use client";

/**
 * Sprint O — Lot O.D : boutons de partage sociaux.
 *
 * Reutilisable sur :
 *   - `/pro-league/matches/[id]` : "Partage ce match"
 *   - `/pro-league/gazette/[date]` : "Partage cette edition"
 *   - Plus tard : page joueur / equipe.
 *
 * 3 boutons :
 *   - **Twitter / X** : intent URL avec texte + URL + hashtags.
 *   - **Discord** : copy URL au clipboard (pas d'intent natif, le user
 *     paste). Feedback toast "Lien copie pour Discord".
 *   - **Copy link** : pareil, copy + feedback.
 *
 * Pas d'autres reseaux pour l'instant (Reddit/Bluesky restent
 * shareables par copy link de toute facon).
 */

import { useState } from "react";

interface ShareButtonsProps {
  /** URL canonique a partager (absolu, ex: `https://nufflearena.fr/pro-league/matches/abc`). */
  readonly url: string;
  /** Texte d'accroche (sera prefixed au tweet). */
  readonly text: string;
  /** Hashtags facultatifs (sans #, ex: `["bloodbowl", "nufflearena"]`). */
  readonly hashtags?: readonly string[];
  /** Variante d'affichage : "row" (default, ligne) ou "compact" (icones seuls). */
  readonly layout?: "row" | "compact";
}

function buildTwitterIntent(props: ShareButtonsProps): string {
  const params = new URLSearchParams({
    text: props.text,
    url: props.url,
  });
  if (props.hashtags && props.hashtags.length > 0) {
    params.set("hashtags", props.hashtags.join(","));
  }
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // ignore — fallback below
  }
  // Fallback : textarea + execCommand (deprecated mais utile sur
  // contextes non-secure / vieux navigateurs).
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ShareButtons({
  url,
  text,
  hashtags,
  layout = "row",
}: ShareButtonsProps): JSX.Element {
  const [feedback, setFeedback] = useState<string | null>(null);

  const flashFeedback = (msg: string): void => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const onCopy = async (kind: "copy" | "discord"): Promise<void> => {
    const ok = await copyToClipboard(url);
    if (ok) {
      flashFeedback(
        kind === "discord" ? "Lien copié — colle-le dans Discord" : "Lien copié",
      );
    } else {
      flashFeedback("Impossible de copier — copie manuellement l'URL");
    }
  };

  const isCompact = layout === "compact";
  const wrapClass = isCompact
    ? "inline-flex items-center gap-2"
    : "flex flex-wrap items-center gap-2";
  const btnBase =
    "inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition hover:bg-slate-800";

  return (
    <div data-testid="share-buttons" className={wrapClass}>
      <a
        data-testid="share-twitter"
        href={buildTwitterIntent({ url, text, hashtags })}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btnBase} border-sky-700 text-sky-300 hover:text-sky-200`}
        title="Partager sur X / Twitter"
      >
        <span aria-hidden="true">𝕏</span>
        {!isCompact && <span>Tweet</span>}
      </a>
      <button
        type="button"
        data-testid="share-discord"
        onClick={() => void onCopy("discord")}
        className={`${btnBase} border-indigo-700 text-indigo-300 hover:text-indigo-200`}
        title="Copier l'URL pour Discord"
      >
        <span aria-hidden="true">💬</span>
        {!isCompact && <span>Discord</span>}
      </button>
      <button
        type="button"
        data-testid="share-copy"
        onClick={() => void onCopy("copy")}
        className={`${btnBase} border-slate-700 text-slate-300 hover:text-slate-200`}
        title="Copier l'URL"
      >
        <span aria-hidden="true">🔗</span>
        {!isCompact && <span>Copier</span>}
      </button>
      {feedback && (
        <span
          data-testid="share-feedback"
          role="status"
          className="text-xs text-emerald-300"
        >
          ✓ {feedback}
        </span>
      )}
    </div>
  );
}
