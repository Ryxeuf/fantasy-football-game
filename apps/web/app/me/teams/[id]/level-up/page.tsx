"use client";
/**
 * L2.B.4 — Sprint Ligues v2 PR5 : page level-up Jeu en Ligue.
 *
 * Enveloppe le composant partagé `AdvancementEditor` (liste des joueurs
 * avec un avancement en attente + picker + application). La même logique
 * est réutilisée dans l'onglet « Évolutions » de la feuille de match.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { AdvancementEditor } from "../../../../components/AdvancementEditor";
import { useLanguage } from "../../../../contexts/LanguageContext";

export default function LevelUpPage() {
  const { t } = useLanguage();
  const params = useParams();
  const teamId = typeof params.id === "string" ? params.id : "";

  return (
    <div
      data-testid="level-up-page"
      className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6"
    >
      <div>
        <Link
          href={`/me/teams/${teamId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
        >
          ← {t.teams.backToTeam ?? "Retour a l'equipe"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-nuffle-anthracite sm:text-3xl">
          {t.teams.levelUpTitle ?? "Ameliorations de joueurs"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t.teams.levelUpDescription ??
            "Les joueurs ayant assez de PSP peuvent prendre une nouvelle competence ou amelioration."}
        </p>
      </div>

      <AdvancementEditor teamId={teamId} />
    </div>
  );
}
