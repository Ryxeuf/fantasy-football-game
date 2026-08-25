"use client";

/**
 * Chargement + mutations de l'editeur commissaire.
 *
 * Un seul endroit connait les appels reseau : le roster, les reglages
 * (staff + Ligue regionale) et le catalogue de competences. Les panneaux
 * ne recoivent que des donnees et un `run()` qui journalise le resultat
 * (message de succes ou d'erreur) et recharge ce qu'il faut.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../../lib/api-client";
import type {
  RosterResponse,
  SkillCatalogItem,
  TeamSettings,
} from "./types";

/** Duree d'affichage d'un message de succes (ms). */
const FLASH_MS = 4000;

export interface CommissionerTeamState {
  readonly roster: RosterResponse | null;
  readonly settings: TeamSettings | null;
  readonly catalog: readonly SkillCatalogItem[];
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly flash: string | null;
  /** Efface le bandeau d'erreur courant. */
  readonly clearError: () => void;
  /**
   * Execute une mutation : affiche `successMessage` en cas de succes,
   * l'erreur sinon, puis recharge les donnees. Renvoie le resultat de
   * l'appel, ou `null` si la mutation a echoue.
   */
  readonly run: <T>(
    call: () => Promise<T>,
    successMessage: string,
  ) => Promise<T | null>;
  readonly reload: () => Promise<void>;
}

export function useCommissionerTeam(input: {
  leagueId: string;
  teamId: string;
  open: boolean;
  onChanged?: () => void;
}): CommissionerTeamState {
  const { leagueId, teamId, open, onChanged } = input;
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Les reglages sont optionnels pour l'affichage du roster : un
      // serveur anterieur a cette route ne doit pas casser l'editeur.
      const [rosterRes, settingsRes] = await Promise.all([
        apiRequest<RosterResponse>(
          `/leagues/${leagueId}/teams/${teamId}/roster`,
        ),
        apiRequest<TeamSettings>(
          `/leagues/${leagueId}/teams/${teamId}/settings`,
        ).catch(() => null),
      ]);
      setRoster(rosterRes);
      // Validation de forme a la frontiere : un serveur anterieur a la
      // route /settings (404 -> null) ou une reponse inattendue laisse les
      // onglets staff / Ligue regionale indisponibles plutot que de casser
      // l'editeur entier.
      setSettings(settingsRes?.team ? settingsRes : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [leagueId, teamId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Catalogue de competences : depend du ruleset de l'equipe.
  const ruleset = roster?.team.ruleset ?? null;
  useEffect(() => {
    if (!open || !roster) return;
    apiRequest<{ skills: SkillCatalogItem[] }>(
      `/api/skills?ruleset=${encodeURIComponent(ruleset ?? "season_3")}`,
    )
      .then((r) => setCatalog(r.skills ?? []))
      .catch(() => setCatalog([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ruleset]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const showFlash = useCallback((message: string) => {
    setFlash(message);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  const run = useCallback(
    async <T,>(call: () => Promise<T>, successMessage: string) => {
      setBusy(true);
      setError(null);
      try {
        const out = await call();
        await load();
        onChanged?.();
        showFlash(successMessage);
        return out;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load, onChanged, showFlash],
  );

  return {
    roster,
    settings,
    catalog,
    loading,
    busy,
    error,
    flash,
    clearError: useCallback(() => setError(null), []),
    run,
    reload: load,
  };
}
