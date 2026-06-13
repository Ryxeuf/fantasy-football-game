"use client";

import { useState } from "react";
import { apiRequest } from "../../../lib/api-client";
import { useLanguage } from "../../../contexts/LanguageContext";
import ShareBar from "../../../components/ShareBar";

/**
 * Partage public opt-in d'une équipe (boucle d'acquisition #3).
 *
 * Toggle "rendre publique" → PATCH /team/:id/share. Quand actif, affiche
 * le lien public copiable + une barre de partage réseaux. Le lien
 * pointe vers la page publique /r/:token en lecture seule.
 */

interface TeamShareToggleProps {
  readonly teamId: string;
  readonly initialIsPublic?: boolean;
  readonly initialShareToken?: string | null;
}

export default function TeamShareToggle({
  teamId,
  initialIsPublic = false,
  initialShareToken = null,
}: TeamShareToggleProps) {
  const { language } = useLanguage();
  const en = language === "en";
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [token, setToken] = useState<string | null>(initialShareToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicUrl =
    token && typeof window !== "undefined" ? `${window.location.origin}/r/${token}` : "";

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ isPublic: boolean; shareToken: string | null }>(
        `/team/${teamId}/share`,
        { method: "PATCH", body: JSON.stringify({ enabled: !isPublic }) },
      );
      setIsPublic(res.isPublic);
      if (res.shareToken) setToken(res.shareToken);
    } catch {
      setError(en ? "Action failed, please retry." : "Échec de l'opération, réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-nuffle-bronze/30 bg-[#FBF7EC] p-4 sm:p-5 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading font-bold text-base sm:text-lg text-nuffle-anthracite flex items-center gap-2">
            <span aria-hidden="true">🔗</span>
            {en ? "Share this team" : "Partager cette équipe"}
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-nuffle-anthracite/70 font-body">
            {isPublic
              ? en
                ? "Anyone with the link can view this roster (read-only)."
                : "Toute personne avec le lien voit ce roster (lecture seule)."
              : en
                ? "Generate a public read-only link to your team."
                : "Génère un lien public en lecture seule de ton équipe."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-pressed={isPublic}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            isPublic ? "bg-nuffle-gold" : "bg-nuffle-bronze/30"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              isPublic ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-nuffle-red">{error}</p>}

      {isPublic && publicUrl && (
        <div className="mt-4 border-t border-nuffle-bronze/15 pt-4">
          <label className="text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze/70">
            {en ? "Public link" : "Lien public"}
          </label>
          <input
            readOnly
            value={publicUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1.5 w-full rounded-lg border border-nuffle-bronze/30 bg-white/60 px-3 py-2 text-sm text-nuffle-anthracite/80 font-body"
          />
          <div className="mt-3">
            <ShareBar
              url={publicUrl}
              title={en ? "Check out my Blood Bowl team on Nuffle Arena" : "Mon équipe Blood Bowl sur Nuffle Arena"}
              copyLabel={en ? "Copy link" : "Copier le lien"}
              copiedLabel={en ? "Link copied!" : "Lien copié !"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
