"use client";
import { useFeatureFlagContext } from "../contexts/FeatureFlagContext";

/**
 * Retourne `true` si le feature flag identifié par `key` est actif pour
 * l'utilisateur courant (global ou override utilisateur).
 *
 * Doit être appelé à l'intérieur d'un `<FeatureFlagProvider>`.
 */
export function useFeatureFlag(key: string): boolean {
  const { flags } = useFeatureFlagContext();
  return flags.has(key);
}
