"use client";

/**
 * Éditeur commissaire d'une équipe engagée en ligue.
 *
 * Refonte UX : la version précédente empilait dans une seule colonne la
 * trésorerie puis TOUS les contrôles de TOUS les joueurs (identité, PSP,
 * compétence, caractéristique), sans recherche, sans confirmation visible
 * et sans accès au staff ni à la Ligue régionale. Ici : un dialogue en
 * onglets (effectif / staff & trésorerie / Ligue régionale), une barre de
 * recherche, des lignes de joueur repliées et un retour explicite après
 * chaque action.
 *
 * Toutes les actions restent journalisées (AuditLog) côté serveur.
 */

import { useEffect, useRef, useState } from "react";
import { RosterTab } from "./RosterTab";
import { formatGold } from "./roster-helpers";
import { useCommissionerTeam } from "./useCommissionerTeam";

type TabKey = "roster";

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "roster", label: "Effectif" },
];

interface Props {
  leagueId: string;
  teamId: string;
  teamName: string;
  open: boolean;
  /**
   * Autorise la suppression de joueurs (uniquement avant le démarrage de
   * la saison, tant qu'aucun match n'a été joué). Le backend ré-applique
   * cette garde ; ce flag ne fait que masquer le bouton côté UI.
   * Exception : un joueur MORT reste retirable à tout moment (retrait
   * doux sans licenciement), indépendamment de ce flag.
   */
  canRemovePlayers?: boolean;
  onClose: () => void;
  /** Rappelé après une modification (pour rafraîchir la saison au besoin). */
  onChanged?: () => void;
}

export function CommissionerTeamEditor({
  leagueId,
  teamId,
  teamName,
  open,
  canRemovePlayers = false,
  onClose,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<TabKey>("roster");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const state = useCommissionerTeam({ leagueId, teamId, open, onChanged });

  // Échap ferme le dialogue : un modal plein écran sans sortie clavier
  // était un piège pour la navigation au clavier.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const { roster, settings, catalog, loading, busy, error, flash, run } = state;
  const working = busy || loading;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="commissioner-editor-title"
        data-testid="commissioner-team-editor"
        className="bg-white w-full sm:rounded-xl shadow-2xl max-w-4xl h-[100dvh] sm:h-[88vh] flex flex-col outline-none"
      >
        <header className="flex items-start gap-3 px-4 py-3 border-b border-gray-200">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Édition commissaire
            </p>
            <h3
              id="commissioner-editor-title"
              className="text-lg font-semibold text-nuffle-anthracite truncate"
            >
              {teamName}
            </h3>
            <p className="text-xs text-gray-500">
              {settings ? (
                <>
                  {settings.team.roster} ·{" "}
                  <span className="font-mono">
                    {formatGold(settings.team.treasury)}
                  </span>{" "}
                  · VE {formatGold(settings.team.teamValue)}
                  {settings.team.tournamentRulesetLabel
                    ? ` · ${settings.team.tournamentRulesetLabel}`
                    : ""}
                </>
              ) : roster ? (
                <>
                  {roster.team.roster} ·{" "}
                  <span className="font-mono">
                    {formatGold(roster.team.treasury)}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto shrink-0 w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        <nav
          className="flex gap-1 px-3 pt-2 border-b border-gray-200"
          aria-label="Sections de l'édition"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              data-testid={`editor-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm rounded-t-md border-b-2 -mb-px ${
                tab === t.key
                  ? "border-nuffle-gold text-nuffle-anthracite font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
              {t.key === "roster" && roster
                ? ` (${roster.players.length})`
                : ""}
            </button>
          ))}
          {working ? (
            <span
              data-testid="editor-busy"
              className="ml-auto self-center text-xs text-gray-500"
            >
              {busy ? "Enregistrement…" : "Actualisation…"}
            </span>
          ) : null}
        </nav>

        <div className="px-4 pt-2 space-y-1.5">
          {error ? (
            <p
              role="alert"
              data-testid="editor-error"
              className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5"
            >
              {error}
            </p>
          ) : null}
          {flash ? (
            <p
              role="status"
              data-testid="editor-flash"
              className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1.5"
            >
              ✓ {flash}
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Seul le PREMIER chargement masque le contenu : un rechargement
              post-mutation ne doit pas démonter l'onglet courant (il
              effacerait les brouillons et les avertissements affichés). */}
          {!roster ? (
            <p className="text-sm text-gray-500">
              {loading ? "Chargement…" : "Aucune donnée."}
            </p>
          ) : (
            <RosterTab
              leagueId={leagueId}
              teamId={teamId}
              players={roster.players}
              accessByPosition={roster.accessByPosition ?? {}}
              catalog={catalog}
              busy={working}
              canRemovePlayers={canRemovePlayers}
              run={run}
            />
          )}
        </div>

        <footer className="flex items-center gap-2 px-4 py-2 border-t border-gray-200 bg-gray-50 sm:rounded-b-xl">
          <p className="text-[11px] text-gray-500">
            Chaque modification est enregistrée immédiatement et journalisée.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-3 py-1 rounded border border-gray-300 text-sm text-gray-700 hover:bg-white"
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}
