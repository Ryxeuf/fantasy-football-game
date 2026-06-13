"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BlockDie, type BlockDieFace } from "./NuffleArt";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Lanceur de dés de blocage interactif pour le hero.
 *
 * Pur front : aucun appel réseau. Reprend les illustrations `BlockDie`
 * pour rester homogène. Tire selon la distribution officielle du dé de
 * blocage Blood Bowl (6 faces : 1 Joueur à terre, 2 Repoussé, 1 Tous à
 * terre, 1 Hésitation, 1 POW). Respecte `prefers-reduced-motion`.
 */

// Distribution officielle des 6 faces du dé de blocage.
const POOL: readonly BlockDieFace[] = ["down", "push", "push", "bothdown", "stumble", "pow"];

const FACE_LABELS: Record<"fr" | "en", Record<BlockDieFace, string>> = {
  fr: {
    down: "Joueur à terre",
    push: "Repoussé",
    bothdown: "Tous à terre",
    stumble: "Hésitation",
    pow: "POW !",
  },
  en: {
    down: "Player Down",
    push: "Push Back",
    bothdown: "Both Down",
    stumble: "Stumble",
    pow: "POW!",
  },
};

function rollFace(): BlockDieFace {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const COUNT = 3;

export default function BlockDiceRoller() {
  const { language, t } = useLanguage();
  const lang = language === "en" ? "en" : "fr";
  const [faces, setFaces] = useState<BlockDieFace[]>(["push", "pow", "stumble"]);
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

  const labels = FACE_LABELS[lang];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`flex items-center gap-2.5 ${rolling ? "animate-pulse" : ""}`}>
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
        <span className={rolling ? "inline-block animate-spin" : "inline-block"} aria-hidden="true">⚄</span>
        {t.home.diceRollerCta}
      </button>

      <p className="min-h-[1.25rem] text-center text-xs font-subtitle text-nuffle-bronze/80" aria-live="polite">
        {rolled && !rolling
          ? faces.map((f) => labels[f]).join(" · ")
          : t.home.diceRollerHint}
      </p>
    </div>
  );
}
