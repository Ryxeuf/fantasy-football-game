"use client";

import { useCallback, useEffect, useState } from "react";
import { PhaseTabs } from "./components/PhaseTabs";
import { SheetContent } from "./components/SheetContent";
import { SheetPanel } from "./components/SheetPanel";
import { StepCard } from "./components/StepCard";
import type { PhaseId } from "./data/sequences";
import { PHASES, TURN_ACTIONS, getPhase } from "./data/sequences";
import { SHEETS, getSheet } from "./data/sheets";
import { useChecklist } from "./useChecklist";

/** Nom du paramètre de requête qui ouvre une fiche (lien partageable). */
export const SHEET_PARAM = "fiche";

export function AideDeJeuClient(): JSX.Element {
  const [phaseId, setPhaseId] = useState<PhaseId>("avant");
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);

  const preMatch = useChecklist("pre-match");
  const postMatch = useChecklist("post-match");
  const turn = useChecklist("turn");

  const phase = getPhase(phaseId) ?? PHASES[0];
  const openSheet = openSheetId ? getSheet(openSheetId) : undefined;

  /**
   * L'URL porte la fiche ouverte, mais on la pousse avec `history` plutôt
   * qu'avec le routeur Next : un `router.push` re-rendrait l'arbre serveur
   * pour un simple changement de query et ferait clignoter une page
   * entièrement statique. Effet voulu : le bouton retour du téléphone
   * ferme le panneau au lieu de quitter la page.
   */
  const open = useCallback((sheetId: string) => {
    if (!getSheet(sheetId)) return;
    setOpenSheetId(sheetId);
    const url = new URL(window.location.href);
    url.searchParams.set(SHEET_PARAM, sheetId);
    window.history.pushState({ [SHEET_PARAM]: sheetId }, "", url);
  }, []);

  const close = useCallback(() => {
    setOpenSheetId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has(SHEET_PARAM)) {
      url.searchParams.delete(SHEET_PARAM);
      window.history.pushState({}, "", url);
    }
  }, []);

  /**
   * `?fiche=` est lu au montage, jamais pendant le rendu : la page est
   * servie statiquement et le premier rendu client doit lui être
   * identique, sinon Next signale une erreur d'hydratation. Un lien
   * partagé ouvre donc son panneau juste après l'hydratation.
   */
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get(SHEET_PARAM);
    if (id && getSheet(id)) setOpenSheetId(id);
  }, []);

  useEffect(() => {
    const onPopState = (): void => {
      const id = new URL(window.location.href).searchParams.get(SHEET_PARAM);
      setOpenSheetId(id && getSheet(id) ? id : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const checklist =
    phaseId === "avant" ? preMatch : phaseId === "apres" ? postMatch : null;
  const done = phase.checkable
    ? phase.steps.filter((s) => checklist?.isChecked(s.id)).length
    : 0;

  return (
    <div className="pb-24 sm:pb-8">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-nuffle-bronze/25 bg-gradient-to-br from-nuffle-anthracite to-[#2c2620] px-5 py-7 sm:px-10 sm:py-11 sm:text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-nuffle-gold/70 to-transparent"
        />
        <p className="font-subtitle text-[0.65rem] font-bold uppercase tracking-[0.25em] text-nuffle-gold">
          Blood Bowl 2025 · Saison 3
        </p>
        <h1 className="mt-2.5 font-heading text-3xl font-bold leading-tight text-nuffle-ivory sm:text-5xl">
          Aide de jeu
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-nuffle-ivory/75 sm:mx-auto sm:max-w-xl sm:text-base">
          Le déroulé complet d&apos;une partie, étape par étape. Les tables
          restent à portée de pouce, sans quitter la page.
        </p>
      </header>

      {/* Accès direct aux fiches */}
      <section className="mt-5" aria-labelledby="acces-rapide">
        <h2
          id="acces-rapide"
          className="mb-2 font-subtitle text-[0.65rem] font-bold uppercase tracking-[0.2em] text-nuffle-bronze"
        >
          Toutes les tables
        </h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {SHEETS.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => open(sheet.id)}
              data-testid={`sheet-chip-${sheet.id}`}
              className="flex h-11 flex-none items-center gap-2 rounded-full border border-nuffle-bronze/20 bg-white px-3.5 text-[0.8rem] font-semibold text-nuffle-anthracite shadow-sm transition-colors hover:border-nuffle-gold/60"
            >
              <span className="font-score text-sm leading-none text-nuffle-gold">
                {sheet.dice}
              </span>
              {sheet.title}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-5 sm:mt-7">
        <PhaseTabs active={phaseId} onSelect={setPhaseId} />
      </div>

      {/* Phase courante */}
      <section className="mt-5" aria-live="polite">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2.5 font-heading text-2xl font-bold text-nuffle-anthracite">
              <span aria-hidden className="h-5 w-1.5 flex-none rounded-full bg-nuffle-gold" />
              {phase.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-nuffle-anthracite/65">
              {phase.intro}
            </p>
          </div>
          {phase.checkable && checklist && (
            <div className="flex flex-none flex-col items-end gap-1.5">
              <span className="font-score text-lg leading-none text-nuffle-bronze">
                {done} / {phase.steps.length}
              </span>
              <button
                type="button"
                onClick={checklist.reset}
                className="text-[0.7rem] font-semibold text-nuffle-anthracite/45 underline-offset-2 hover:text-nuffle-red hover:underline"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </div>

        <ol className="mt-4 space-y-2.5">
          {phase.steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              index={index}
              checked={phase.checkable ? checklist?.isChecked(step.id) : undefined}
              onToggle={
                phase.checkable && checklist
                  ? () => checklist.toggle(step.id)
                  : undefined
              }
              onOpenSheet={open}
            />
          ))}
        </ol>
      </section>

      {/* Checklist du tour — seulement pendant le match. */}
      {phaseId === "pendant" && (
        <section className="mt-6" aria-labelledby="actions-du-tour">
          <div className="flex items-end justify-between gap-3">
            <h2
              id="actions-du-tour"
              className="flex items-center gap-2.5 font-heading text-xl font-bold text-nuffle-anthracite"
            >
              <span aria-hidden className="h-4 w-1.5 flex-none rounded-full bg-nuffle-gold" />
              Mon tour en cours
            </h2>
            <button
              type="button"
              onClick={turn.reset}
              className="text-[0.7rem] font-semibold text-nuffle-anthracite/45 underline-offset-2 hover:text-nuffle-red hover:underline"
            >
              Nouveau tour
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-nuffle-anthracite/65">
            Cochez au fur et à mesure : chacune n&apos;est jouable qu&apos;une
            fois par tour d&apos;équipe.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {TURN_ACTIONS.map((action) => {
              const used = turn.isChecked(action.id);
              return (
                <li key={action.id}>
                  <button
                    type="button"
                    onClick={() => turn.toggle(action.id)}
                    aria-pressed={used}
                    data-testid={`turn-action-${action.id}`}
                    className={`flex min-h-[3rem] w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                      used
                        ? "border-nuffle-bronze/20 bg-nuffle-ivory/60 text-nuffle-anthracite/45 line-through"
                        : "border-nuffle-bronze/20 bg-white text-nuffle-anthracite shadow-sm"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 flex-none items-center justify-center rounded-md ${
                        used ? "bg-nuffle-gold" : "border-[1.5px] border-nuffle-bronze/45"
                      }`}
                    >
                      {used && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth={3.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m5 13 4 4 10-10" />
                        </svg>
                      )}
                    </span>
                    {action.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {openSheet && (
        <SheetPanel
          title={openSheet.title}
          dice={openSheet.dice}
          hint={openSheet.hint}
          onClose={close}
        >
          <SheetContent sheet={openSheet} />
        </SheetPanel>
      )}
    </div>
  );
}
