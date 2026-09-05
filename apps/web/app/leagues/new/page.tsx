"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { LEAGUE_FLAG } from "../../lib/featureFlagKeys";
import { LeagueForm, type LeagueFormValues } from "../_components/LeagueForm";
import { uploadPendingCompetitionDocuments } from "../../lib/competition-documents";
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
  // Documents officiels choisis avant la creation : la ligue n'ayant pas
  // encore d'id, ils sont deposes juste apres le POST.
  const [pendingDocuments, setPendingDocuments] = useState<File[]>([]);
  // Ligue deja creee dont seul le depot des documents a echoue. Sans cet
  // etat, re-soumettre le formulaire creerait une SECONDE ligue : on rejoue
  // alors uniquement l'upload.
  const [createdLeagueId, setCreatedLeagueId] = useState<string | null>(null);

  /**
   * Depose les documents mis de cote. Renvoie `true` quand tout est passe ;
   * sinon signale les echecs et laisse l'utilisateur reessayer.
   */
  const uploadDocuments = useCallback(
    async (leagueId: string): Promise<boolean> => {
      if (pendingDocuments.length === 0) return true;
      const failures = await uploadPendingCompetitionDocuments(
        "leagues",
        leagueId,
        pendingDocuments,
      );
      if (failures.length === 0) return true;
      setError(
        `Ligue créée, mais certains documents n'ont pas pu être déposés : ${failures.join(" — ")}`,
      );
      return false;
    },
    [pendingDocuments],
  );

  const handleSubmit = useCallback(
    async (values: LeagueFormValues) => {
      setSubmitting(true);
      setError(null);
      // Reprise apres un echec de depot : la ligue existe deja, on ne
      // re-poste PAS /leagues (sinon doublon).
      if (createdLeagueId) {
        if (!(await uploadDocuments(createdLeagueId))) {
          setSubmitting(false);
          return;
        }
        router.push(`/leagues/${createdLeagueId}`);
        return;
      }
      try {
        const created = await apiRequest<CreatedLeague>("/leagues", {
          method: "POST",
          body: JSON.stringify({
            name: values.name.trim(),
            description: values.description.trim() || null,
            ruleset: values.ruleset,
            tournamentRuleset: values.tournamentRuleset,
            isPublic: values.isPublic,
            maxParticipants: values.maxParticipants,
            allowedRosters:
              values.allowedRosters.length > 0 ? values.allowedRosters : null,
            allowedInducements:
              values.allowedInducements.length > 0
                ? values.allowedInducements
                : null,
            winPoints: values.winPoints,
            drawPoints: values.drawPoints,
            lossPoints: values.lossPoints,
            forfeitPoints: values.forfeitPoints,
            bonusPointsConfig: serializeBonusRules(values.bonusPointsConfig),
          }),
        });
        // Depot des documents officiels choisis avant la creation. Un echec
        // ici ne doit pas annuler la ligue (deja creee) : on le signale, on
        // memorise son id et la prochaine soumission ne rejoue que l'upload.
        if (!(await uploadDocuments(created.id))) {
          setCreatedLeagueId(created.id);
          setSubmitting(false);
          return;
        }
        router.push(`/leagues/${created.id}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t.leagues.formSubmitError);
        setSubmitting(false);
      }
    },
    [router, t.leagues.formSubmitError, uploadDocuments, createdLeagueId],
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

      {createdLeagueId ? (
        <p
          data-testid="new-league-created-notice"
          className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3"
        >
          La ligue a bien été créée. Réessayez le dépôt, ou{" "}
          <Link
            href={`/leagues/${createdLeagueId}`}
            className="underline font-medium"
          >
            ouvrez sa fiche
          </Link>{" "}
          pour ajouter les documents plus tard.
        </p>
      ) : null}

      <LeagueForm
        mode="create"
        submitting={submitting}
        error={error}
        cancelHref="/leagues"
        onSubmit={handleSubmit}
        pendingDocuments={pendingDocuments}
        onPendingDocumentsChange={setPendingDocuments}
      />
    </div>
  );
}
