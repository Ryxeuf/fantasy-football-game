"use client";

/**
 * HTML d'un article, assaini une SECONDE fois dans le navigateur (le serveur
 * l'a déjà fait à l'écriture). DOMPurify est chargé à la demande, côté client
 * seulement : les pages du blog chargent leurs données après le montage, rien
 * n'est perdu au rendu serveur, et `jsdom` n'entre pas dans le bundle SSR.
 */

import { useEffect, useState } from "react";

interface SafeHtmlProps {
  readonly html: string;
  readonly className?: string;
}

export default function SafeHtml({ html, className }: SafeHtmlProps) {
  const [clean, setClean] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    import("isomorphic-dompurify")
      .then((mod) => {
        if (!alive) return;
        const purify = mod.default;
        setClean(purify.sanitize(html, { ADD_ATTR: ["target"] }));
      })
      .catch(() => {
        if (alive) setClean("");
      });
    return () => {
      alive = false;
    };
  }, [html]);

  if (clean === null) {
    return <div className={className} aria-busy="true" />;
  }
  return (
    <div
      className={className}
      data-testid="blog-post-content"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
