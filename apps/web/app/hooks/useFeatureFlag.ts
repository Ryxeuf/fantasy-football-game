"use client";
import {
  useFeatureFlagContext,
  useOptionalFeatureFlagContext,
} from "../contexts/FeatureFlagContext";

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

/**
 * Comme `useFeatureFlag`, mais `false` hors `FeatureFlagProvider` (au lieu
 * de lever) : un gate reste FERMÉ faute de contexte, jamais ouvert.
 */
export function useFeatureFlagOrOff(key: string): boolean {
  const ctx = useOptionalFeatureFlagContext();
  return ctx?.flags.has(key) ?? false;
}
