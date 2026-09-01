"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockDie, type BlockDieFace } from "./NuffleArt";
import { BLOCK_DIE_FACES, BLOCK_DIE_FACE_LABELS } from "./block-dice-faces";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Lanceur de dés de blocage interactif pour le hero.
 *
 * Pur front : aucun appel réseau. Reprend les illustrations `BlockDie`
 * pour rester homogène. Tire dans `BLOCK_DIE_FACES`, miroir de la table
 * du moteur (`@bb/game-engine`) : six faces pour cinq icônes, dont deux
 * `Repoussé`. Respecte `prefers-reduced-motion`.
 */

function rollFace(): BlockDieFace {
  return BLOCK_DIE_FACES[Math.floor(Math.random() * BLOCK_DIE_FACES.length)];
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const COUNT = 3;

export default function BlockDiceRoller() {
  const { language, t } = useLanguage();
  const lang = language === "en" ? "en" : "fr";
  const [faces, setFaces] = useState<BlockDieFace[]>([
    "push",
    "pow",
    "stumble",
  ]);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const roll = useCallback(() => {
    if (rolling) return;
    clearTimers();
    const settle = () => {
      setFaces(Array.from({ length: COUNT }, rollFace));
      setRolling(false);
      setRolled(true);
    };
    if (prefersReducedMotion()) {
      settle();
      return;
    }
    setRolling(true);
    intervalRef.current = setInterval(() => {
      setFaces(Array.from({ length: COUNT }, rollFace));
    }, 80);
    timeoutRef.current = setTimeout(() => {
      clearTimers();
      settle();
    }, 640);
  }, [rolling, clearTimers]);

  const labels = BLOCK_DIE_FACE_LABELS[lang];
  const settled = rolled && !rolling;

  /**
   * Un blocage ne retient qu'UN dé : on détaille donc l'effet du meilleur
   * résultat pour l'attaquant plutôt que d'empiler trois explications.
   */
  const highlighted = useMemo(() => {
    const best = [...faces].sort(
      (a, b) => labels[b].attackerRank - labels[a].attackerRank,
    )[0];
    return best;
  }, [faces, labels]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`flex items-center gap-2.5 ${rolling ? "animate-pulse" : ""}`}
      >
        {faces.map((face, i) => (
          <BlockDie
            key={i}
            face={face}
            className={`drop-shadow-lg transition-transform ${
              i === 1 ? "w-16 sm:w-[4.5rem] -translate-y-1.5" : "w-14 sm:w-16"
            } ${rolling ? "scale-95" : ""}`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={roll}
        disabled={rolling}
        className="inline-flex items-center gap-2 rounded-full bg-[#1B1610] px-5 py-2 text-sm font-subtitle font-bold uppercase tracking-wide text-nuffle-gold ring-1 ring-nuffle-gold/50 shadow-[0_6px_16px_rgba(27,22,16,0.35)] transition-all hover:bg-[#241c12] hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
      >
        <span
          className={rolling ? "inline-block animate-spin" : "inline-block"}
          aria-hidden="true"
        >
          ⚄
        </span>
        {t.home.diceRollerCta}
      </button>

      <div className="min-h-[3.5rem] max-w-[22rem]" aria-live="polite">
        {settled ? (
          <>
            <p className="text-center text-xs font-subtitle font-bold uppercase tracking-wide text-nuffle-bronze">
              {faces.map((f) => labels[f].name).join(" · ")}
            </p>
            <p className="mt-1 text-center text-[11px] leading-snug font-body text-nuffle-bronze/80">
              <span className="font-semibold">{labels[highlighted].name}</span>
              {" — "}
              {labels[highlighted].effect}
            </p>
          </>
        ) : (
          <p className="text-center text-xs font-subtitle text-nuffle-bronze/80">
            {t.home.diceRollerHint}
          </p>
        )}
      </div>
    </div>
  );
}
