"use client";
/**
 * Admin — création d'un règlement de tournoi. Le formulaire partagé gère
 * l'état ; cette page gère l'appel API et la redirection vers l'édition.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendJSON, type TournamentRulesetFormValues } from "../api";
import { TournamentRulesetForm } from "../_components/TournamentRulesetForm";

export default function NewTournamentRulesetPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: TournamentRulesetFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await sendJSON<{ tournamentRuleset: { id: string } }>(
        "POST",
        "/admin/tournament-rulesets",
        values,
      );
      router.push(
        `/admin/data/tournament-rulesets/${data.tournamentRuleset.id}/edit`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/data/tournament-rulesets"
          className="text-sm text-nuffle-bronze hover:underline"
        >
          ← Règlements de tournoi
        </Link>
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mt-2 mb-1">
          🏆 Nouveau règlement de tournoi
        </h1>
      </div>
      <TournamentRulesetForm
        mode="create"
        submitting={submitting}
        error={error}
        submitLabel={submitting ? "Création…" : "Créer le règlement"}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
