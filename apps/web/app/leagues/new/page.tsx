"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { LEAGUE_FLAG } from "../../lib/featureFlagKeys";
import { LeagueForm, type LeagueFormValues } from "../_components/LeagueForm";
import { serializeBonusRules } from "../_components/bonus-rules";

// Formulaire de creation de ligue. Gate par le feature flag unique
// `league` : tant qu'il n'est pas active, on redirige vers la liste
// pour eviter d'exposer la fonctionnalite avant son lancement
// officiel. La verite de la creation reste serveur (Zod
// `createLeagueSchema` + service `createLeague`) ; ce composant
// duplique simplement les bornes pour un feedback utilisateur immediat.
// Le rendu du formulaire est mutualise avec l'edition via `LeagueForm`.

interface CreatedLeague {
  id: string;
}

export default function NewLeaguePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const flagEnabled = useFeatureFlag(LEAGUE_FLAG);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (values: LeagueFormValues) => {
      setSubmitting(true);
      setError(null);
      try {
        const created = await apiRequest<CreatedLeague>("/leagues", {
          method: "POST",
          body: JSON.stringify({
            name: values.name.trim(),
            description: values.description.trim() || null,
            ruleset: values.ruleset,
            isPublic: values.isPublic,
            maxParticipants: values.maxParticipants,
            allowedRosters:
              values.allowedRosters.length > 0 ? values.allowedRosters : null,
            winPoints: values.winPoints,
            drawPoints: values.drawPoints,
            lossPoints: values.lossPoints,
            forfeitPoints: values.forfeitPoints,
            bonusPointsConfig: serializeBonusRules(values.bonusPointsConfig),
          }),
        });
        router.push(`/leagues/${created.id}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t.leagues.formSubmitError);
        setSubmitting(false);
      }
    },
    [router, t.leagues.formSubmitError],
  );

  // Gate cosmetique cote client (cf. LeagueGate). Sans le flag, on ne
  // rend rien (le useEffect du flag redirige vers /leagues).
  if (!flagEnabled) {
    return null;
  }

  return (
    <div
      data-testid="new-league-page"
      className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-6"
    >
      <div>
        <Link
          href="/leagues"
          className="text-sm text-gray-600 hover:text-gray-800 inline-flex items-center gap-1"
        >
          ← {t.leagues.backToLeagues}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite mt-2">
          {t.leagues.createLeagueTitle}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t.leagues.createLeagueDescription}
        </p>
      </div>

      <LeagueForm
        mode="create"
        submitting={submitting}
        error={error}
        cancelHref="/leagues"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
