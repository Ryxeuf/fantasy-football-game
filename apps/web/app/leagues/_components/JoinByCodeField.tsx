"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

// Point d'entrée SECONDAIRE pour rejoindre une ligue : saisie manuelle du
// code d'invitation. Le point d'entrée principal reste le lien reçu par
// e-mail. À la validation, on redirige vers la page d'acceptation publique
// /leagues/invitations/:code (qui gère connexion + choix d'équipe).

function extractCode(raw: string): string {
  const trimmed = raw.trim();
  // Tolère le collage d'une URL complète : on récupère le dernier segment.
  const match = trimmed.match(/invitations\/([^/?#\s]+)/);
  if (match) return match[1];
  return trimmed;
}

export function JoinByCodeField() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const submit = useCallback(() => {
    const c = extractCode(code);
    if (!c) return;
    router.push(`/leagues/invitations/${encodeURIComponent(c)}`);
  }, [code, router]);

  return (
    <div
      className="flex flex-wrap items-end gap-2"
      data-testid="join-by-code-field"
    >
      <div>
        <label
          htmlFor="join-code-input"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Rejoindre avec un code d&apos;invitation
        </label>
        <input
          id="join-code-input"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Colle ton code ou le lien reçu"
          className="w-72 max-w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          data-testid="join-code-input"
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!code.trim()}
        className="rounded-md bg-nuffle-gold px-4 py-2 text-sm font-medium text-white hover:bg-nuffle-gold/90 disabled:opacity-50"
        data-testid="join-code-submit"
      >
        Rejoindre
      </button>
    </div>
  );
}
