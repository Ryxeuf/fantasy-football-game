"use client";

/**
 * Porte d'entrée de l'onboarding "Crée ton équipe en 60 secondes".
 *
 * Historique : Lot O.B.3 affichait ici un modal welcome à 3 CTAs. Il est
 * désormais remplacé par l'assistant guidé `FirstTeamWizard` (3 étapes :
 * race → nom → confirmation) qui amène directement le coach à sa première
 * équipe. Les anciens CTAs secondaires (tutoriel, Pro League) sont conservés
 * dans le pied de l'assistant.
 *
 * Ce composant ne fait que la décision d'affichage (coach sans équipe, pas
 * déjà skippé) et la persistance du skip ; toute l'UI vit dans le wizard.
 *
 * Conditions d'affichage (cf. `shouldShowOnboarding`) :
 *   - données chargées (`teamsCount` connu, le parent ne monte qu'après load) ;
 *   - `teamsCount === 0` ;
 *   - pas de flag localStorage `onboarding_first_team_dismissed_v1`.
 */

import { useEffect, useState } from "react";
import FirstTeamWizard from "./onboarding/FirstTeamWizard";
import {
  ONBOARDING_DISMISS_KEY,
  shouldShowOnboarding,
} from "./onboarding/onboarding-logic";

interface OnboardingModalProps {
  /**
   * Date ISO de création du compte. Conservé pour rétro-compat de l'appel
   * parent ; la décision d'affichage ne dépend plus de l'âge du compte.
   */
  readonly userCreatedAt?: string | null;
  /** Nombre d'équipes du coach. Assistant seulement si 0. */
  readonly teamsCount: number;
}

export default function OnboardingModal({
  teamsCount,
}: OnboardingModalProps): JSX.Element | null {
  // On part de "dismissed" pour éviter tout flash avant lecture du storage.
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1");
    setMounted(true);
  }, []);

  const handleDismiss = (): void => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
    }
    setDismissed(true);
  };

  const show = shouldShowOnboarding({
    teamsCount,
    dismissed,
    loaded: mounted,
  });

  if (!show) return null;

  return <FirstTeamWizard onDismiss={handleDismiss} />;
}
