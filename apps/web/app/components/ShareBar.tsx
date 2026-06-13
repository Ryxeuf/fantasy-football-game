"use client";

import { useState } from "react";

/**
 * Barre de partage réutilisable (boucle d'acquisition #3).
 *
 * Copie de lien + partage X / Facebook / Reddit / Bluesky. Utilisée sur
 * la page publique d'un roster et sur les pages catalogue d'équipes.
 */

interface ShareBarProps {
  /** URL publique à partager (absolue de préférence). */
  readonly url: string;
  /** Texte d'accroche pré-rempli pour les réseaux. */
  readonly title: string;
  readonly className?: string;
  readonly copiedLabel?: string;
  readonly copyLabel?: string;
}

const PILL =
  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-subtitle font-semibold transition-all hover:-translate-y-0.5";

export default function ShareBar({
  url,
  title,
  className,
  copiedLabel = "Lien copié !",
  copyLabel = "Copier le lien",
}: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;

  const networks: ReadonlyArray<{ name: string; href: string }> = [
    { name: "X", href: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { name: "Reddit", href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}` },
    { name: "Bluesky", href: `https://bsky.app/intent/compose?text=${enc(`${title} ${url}`)}` },
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback navigateurs sans Clipboard API / hors HTTPS.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className ?? ""}`}>
      <button
        type="button"
        onClick={copyLink}
        className={`${PILL} bg-[#1B1610] text-nuffle-gold ring-1 ring-nuffle-gold/50 shadow-[0_4px_12px_rgba(27,22,16,0.3)]`}
      >
        <span aria-hidden="true">{copied ? "✓" : "🔗"}</span>
        {copied ? copiedLabel : copyLabel}
      </button>
      {networks.map((n) => (
        <a
          key={n.name}
          href={n.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${PILL} border border-nuffle-bronze/30 bg-[#FBF7EC] text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite hover:bg-nuffle-gold/10`}
        >
          {n.name}
        </a>
      ))}
    </div>
  );
}
