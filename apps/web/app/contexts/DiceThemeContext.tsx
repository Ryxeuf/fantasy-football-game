"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "../lib/api-client";
import { getAuthToken } from "../lib/auth-storage";
import { DICE_THEMES_FLAG } from "../lib/featureFlagKeys";
import { useFeatureFlagOrOff } from "../hooks/useFeatureFlag";
import { DEFAULT_DICE_THEME_ID } from "../components/dice/themes/catalogue";
import { getDiceThemeRenderer } from "../components/dice/themes/registry";
import type { DiceThemeRenderer } from "../components/dice/types";

/** Réponse de `GET|PUT /dice-themes/me` (cf. services/dice-theme-preference). */
export interface DiceThemePreferenceResponse {
  readonly themeId: string;
  readonly defaultThemeId: string;
  readonly themes: ReadonlyArray<{
    readonly id: string;
    readonly priceCrowns: number | null;
    readonly owned: boolean;
  }>;
}

export interface DiceThemeContextValue {
  /** Faux quand le flag est OFF : sélecteur masqué, thème par défaut. */
  readonly enabled: boolean;
  readonly loading: boolean;
  /** Thème EFFECTIF (toujours un thème rendable). */
  readonly themeId: string;
  readonly renderer: DiceThemeRenderer;
  /** Thèmes possédés, servis par le serveur (vide tant que non chargé). */
  readonly ownedThemeIds: ReadonlySet<string>;
  readonly selectTheme: (themeId: string) => Promise<void>;
}

const DEFAULT_VALUE: DiceThemeContextValue = {
  enabled: false,
  loading: false,
  themeId: DEFAULT_DICE_THEME_ID,
  renderer: getDiceThemeRenderer(DEFAULT_DICE_THEME_ID),
  ownedThemeIds: new Set([DEFAULT_DICE_THEME_ID]),
  selectTheme: async () => {},
};

const DiceThemeContext = createContext<DiceThemeContextValue | null>(null);

/**
 * Résout le thème de dés du coach connecté et le sert à toutes les icônes
 * de dés (`BlockDieIcon`, `D6Icon`).
 *
 * Flag OFF, ou visiteur anonyme : thème par défaut, AUCUNE requête. Une
 * erreur réseau retombe aussi sur le défaut — un dé se dessine toujours.
 */
export function DiceThemeProvider({ children }: { children: ReactNode }) {
  const enabled = useFeatureFlagOrOff(DICE_THEMES_FLAG);
  const [pref, setPref] = useState<DiceThemePreferenceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !getAuthToken()) {
      setPref(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiRequest<DiceThemePreferenceResponse>("/dice-themes/me")
      .then((res) => {
        if (!cancelled) setPref(res);
      })
      .catch(() => {
        if (!cancelled) setPref(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const selectTheme = useCallback(
    async (themeId: string) => {
      if (!enabled) return;
      const res = await apiRequest<DiceThemePreferenceResponse>(
        "/dice-themes/me",
        { method: "PUT", body: JSON.stringify({ themeId }) },
      );
      setPref(res);
    },
    [enabled],
  );

  const value = useMemo<DiceThemeContextValue>(() => {
    const themeId = enabled && pref ? pref.themeId : DEFAULT_DICE_THEME_ID;
    const renderer = getDiceThemeRenderer(themeId);
    const owned =
      enabled && pref
        ? new Set(pref.themes.filter((t) => t.owned).map((t) => t.id))
        : new Set([DEFAULT_DICE_THEME_ID]);
    return {
      enabled,
      loading,
      // L'id annoncé est celui qu'on DESSINE : un id servi mais inconnu du
      // web (déploiement serveur en avance) retombe sur le rendu par défaut.
      themeId: renderer.id,
      renderer,
      ownedThemeIds: owned,
      selectTheme,
    };
  }, [enabled, loading, pref, selectTheme]);

  return (
    <DiceThemeContext.Provider value={value}>{children}</DiceThemeContext.Provider>
  );
}

/** Thème de dés courant ; thème par défaut (no-op) hors provider. */
export function useDiceTheme(): DiceThemeContextValue {
  return useContext(DiceThemeContext) ?? DEFAULT_VALUE;
}
