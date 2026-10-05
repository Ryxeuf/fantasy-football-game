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
import { DiceSkinProvider, getDiceSkin } from "@bb/ui/dice";
import { apiRequest } from "../lib/api-client";
import { getAuthToken } from "../lib/auth-storage";
import { DICE_THEMES_FLAG } from "../lib/featureFlagKeys";
import { useFeatureFlagOrOff } from "../hooks/useFeatureFlag";
import { DEFAULT_DICE_THEME_ID, getDiceThemeRenderer } from "../components/dice/themes/registry";
import type { DiceThemeRenderer } from "../components/dice/types";

export type DiceThemeCollection = "classic" | "team";

/** Une entrée de la boutique, servie par le serveur (prix et vente font foi). */
export interface DiceThemeOption {
  readonly id: string;
  readonly collection: DiceThemeCollection;
  readonly name: { readonly fr: string; readonly en: string };
  readonly description: { readonly fr: string; readonly en: string };
  readonly priceCrowns: number | null;
  readonly owned: boolean;
  /** En vente et non possédé (indépendant du solde). */
  readonly forSale: boolean;
}

/** Réponse de `GET|PUT /dice-themes/me` (cf. services/dice-theme-preference). */
export interface DiceThemePreferenceResponse {
  readonly themeId: string;
  readonly defaultThemeId: string;
  readonly themes: readonly DiceThemeOption[];
}

/** Réponse de `POST /dice-themes/:id/purchase` : la préférence + le solde. */
export interface DiceThemePurchaseResponse extends DiceThemePreferenceResponse {
  readonly balance: number;
}

export interface DiceThemeContextValue {
  /** Faux quand le flag est OFF : sélecteur masqué, dé original. */
  readonly enabled: boolean;
  readonly loading: boolean;
  /** Vrai si le dernier chargement de la boutique a échoué (dé original servi). */
  readonly error: boolean;
  /** Recharge la préférence et la boutique (après une erreur). */
  readonly refresh: () => Promise<void>;
  /** Thème EFFECTIF (toujours un thème rendable). */
  readonly themeId: string;
  readonly renderer: DiceThemeRenderer;
  /** Boutique servie par le serveur (vide tant que non chargée). */
  readonly themes: readonly DiceThemeOption[];
  /** Thèmes possédés, servis par le serveur. */
  readonly ownedThemeIds: ReadonlySet<string>;
  readonly selectTheme: (themeId: string) => Promise<void>;
  /** Achète puis équipe ; renvoie le nouveau solde de Crowns. */
  readonly purchaseTheme: (themeId: string) => Promise<number>;
}

const DEFAULT_VALUE: DiceThemeContextValue = {
  enabled: false,
  loading: false,
  error: false,
  refresh: async () => {},
  themeId: DEFAULT_DICE_THEME_ID,
  renderer: getDiceThemeRenderer(DEFAULT_DICE_THEME_ID),
  themes: [],
  ownedThemeIds: new Set([DEFAULT_DICE_THEME_ID]),
  selectTheme: async () => {},
  purchaseTheme: async () => 0,
};

const DiceThemeContext = createContext<DiceThemeContextValue | null>(null);

/**
 * Résout le thème de dés du coach connecté et le sert à toutes les icônes de
 * dés du site (`BlockDieIcon`, `D6Icon`, `NumberDieIcon`) ET aux composants
 * du match en ligne de `@bb/ui` (popups, journal, dé animé du plateau), via
 * `DiceSkinProvider`.
 *
 * Flag OFF, ou visiteur anonyme : dé ORIGINAL (or & charbon), AUCUNE
 * requête. Une erreur réseau retombe aussi sur le défaut — un dé se dessine
 * toujours.
 */
export function DiceThemeProvider({ children }: { children: ReactNode }) {
  const enabled = useFeatureFlagOrOff(DICE_THEMES_FLAG);
  const [pref, setPref] = useState<DiceThemePreferenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      if (!enabled || !getAuthToken()) {
        setPref(null);
        setError(false);
        return;
      }
      setLoading(true);
      try {
        const res = await apiRequest<DiceThemePreferenceResponse>("/dice-themes/me");
        if (!isCancelled()) {
          setPref(res);
          setError(false);
        }
      } catch {
        if (!isCancelled()) {
          setPref(null);
          setError(true);
        }
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [enabled],
  );

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

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

  const purchaseTheme = useCallback(
    async (themeId: string) => {
      if (!enabled) return 0;
      const res = await apiRequest<DiceThemePurchaseResponse>(
        `/dice-themes/${encodeURIComponent(themeId)}/purchase`,
        { method: "POST" },
      );
      const { balance, ...preference } = res;
      setPref(preference);
      return balance;
    },
    [enabled],
  );

  const value = useMemo<DiceThemeContextValue>(() => {
    const served = enabled && pref ? pref.themeId : DEFAULT_DICE_THEME_ID;
    const renderer = getDiceThemeRenderer(served);
    const themes = enabled && pref ? pref.themes : [];
    const owned =
      enabled && pref
        ? new Set(pref.themes.filter((t) => t.owned).map((t) => t.id))
        : new Set([DEFAULT_DICE_THEME_ID]);
    return {
      enabled,
      loading,
      error: enabled && error,
      refresh,
      // L'id annoncé est celui qu'on DESSINE : un id servi mais inconnu du
      // web (déploiement serveur en avance) retombe sur le rendu par défaut.
      themeId: renderer.id,
      renderer,
      themes,
      ownedThemeIds: owned,
      selectTheme,
      purchaseTheme,
    };
  }, [enabled, loading, error, refresh, pref, selectTheme, purchaseTheme]);

  return (
    <DiceThemeContext.Provider value={value}>
      <DiceSkinProvider skin={getDiceSkin(value.themeId)}>{children}</DiceSkinProvider>
    </DiceThemeContext.Provider>
  );
}

/** Thème de dés courant ; dé original (no-op) hors provider. */
export function useDiceTheme(): DiceThemeContextValue {
  return useContext(DiceThemeContext) ?? DEFAULT_VALUE;
}
