"use client";

/**
 * Garde-fou « modifications non sauvegardées ».
 *
 * Les écrans d'édition accumulent des changements en local et ne les
 * persistent qu'au clic sur « Enregistrer ». Quitter la page en cours de
 * route (onglet fermé, retour arrière, lien interne) les perdait
 * silencieusement.
 *
 * Deux sorties sont couvertes :
 *  - fermeture / rechargement de l'onglet, via `beforeunload` (le
 *    navigateur affiche SA propre boîte de dialogue, le message est ignoré) ;
 *  - clic sur un lien interne, intercepté en phase de capture avant que le
 *    routeur ne prenne la main.
 *
 * Le App Router de Next.js n'expose aucun événement de navigation
 * annulable : l'interception au clic est le seul point d'accroche pour les
 * liens, d'où la capture au niveau du document. Le retour arrière du
 * navigateur reste non intercepté : le seul moyen serait d'empiler une
 * entrée d'historique sentinelle, qui décale durablement le bouton
 * « précédent » de l'utilisateur — un bug garanti pour couvrir un cas de
 * bord.
 */

import { useEffect } from "react";

/** Message proposé avant de quitter (les navigateurs modernes l'ignorent). */
export const UNSAVED_CHANGES_MESSAGE =
  "Des modifications ne sont pas enregistrées. Quitter cette page les perdra définitivement.";

/**
 * Un clic sur cet élément déclenche-t-il une navigation interne qu'il faut
 * intercepter ? Les clics « enrichis » (nouvel onglet, téléchargement,
 * ancre interne, cible externe) laissent la page en place : on n'y touche
 * pas.
 */
export function navigationTargetFor(
  event: MouseEvent,
): HTMLAnchorElement | null {
  if (event.defaultPrevented) return null;
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const target = event.target as Element | null;
  const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
  if (!anchor) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return null;
  // Un protocole non navigable (mailto:, tel:) ne quitte pas la page.
  if (/^(mailto|tel|sms|javascript):/i.test(href)) return null;
  return anchor;
}

export interface UnsavedChangesOptions {
  /** Y a-t-il des modifications non enregistrées ? */
  readonly when: boolean;
  /** Message de la confirmation interne. */
  readonly message?: string;
  /**
   * Demande la confirmation. Injectable pour les tests ; par défaut la
   * boîte de dialogue native.
   */
  readonly confirmLeave?: (message: string) => boolean;
}

/**
 * Avertit avant de quitter la page tant que `when` est vrai. À appeler
 * inconditionnellement (règle des Hooks) : c'est `when` qui arme la garde.
 */
export function useUnsavedChanges({
  when,
  message = UNSAVED_CHANGES_MESSAGE,
  confirmLeave,
}: UnsavedChangesOptions): void {
  useEffect(() => {
    if (!when) return;
    if (typeof window === "undefined") return;

    const ask = confirmLeave ?? ((m: string) => window.confirm(m));

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Compat : Chrome exige encore `returnValue` pour armer la boîte.
      event.returnValue = message;
      return message;
    };

    const onClickCapture = (event: MouseEvent) => {
      const anchor = navigationTargetFor(event);
      if (!anchor) return;
      const href = anchor.getAttribute("href") as string;
      // Un lien vers la page courante ne fait rien perdre.
      if (href === window.location.pathname) return;
      if (!ask(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [when, message, confirmLeave]);
}
