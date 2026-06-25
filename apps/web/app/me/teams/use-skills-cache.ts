"use client";
import { useEffect, useState } from "react";
import { getSkillDescriptionAsync } from "./skills-data";

/**
 * Précharge le cache des compétences (API `/api/skills`) au montage et force
 * un re-render du composant appelant dès qu'il est prêt.
 *
 * Pourquoi : `getSkillDescription` (synchrone) lit un cache de **module**
 * (`skillsCache`) rempli en asynchrone par `loadSkillsFromAPI`. Remplir une
 * variable de module ne déclenche aucun re-render React → les badges de
 * compétences restaient sur le fallback game-engine et ne se mettaient à jour
 * (vers les valeurs de l'API) qu'au **premier survol**, qui provoquait
 * fortuitement un re-render. Ce hook supprime ce comportement : il déclenche le
 * chargement et un re-render dès que le cache est chaud.
 *
 * La valeur de retour change à chaque chargement ; l'appelant n'a pas besoin de
 * l'utiliser — le simple changement d'état suffit à re-rendre.
 */
export function useSkillsCacheReady(language: "fr" | "en"): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Charge tout le référentiel de compétences (le warm sur un slug quelconque
    // remplit le cache complet), puis force un re-render.
    getSkillDescriptionAsync("block", language)
      .then(() => {
        if (!cancelled) setVersion((v) => v + 1);
      })
      .catch(() => {
        /* offline / API KO : on garde le fallback game-engine. */
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  return version;
}
