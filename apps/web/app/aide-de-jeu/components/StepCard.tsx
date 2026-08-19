"use client";

import Link from "next/link";
import type { Step } from "../data/sequences";
import { getSheet } from "../data/sheets";

interface StepCardProps {
  readonly step: Step;
  readonly index: number;
  /** `undefined` quand la phase n'est pas cochable. */
  readonly checked?: boolean;
  readonly onToggle?: () => void;
  readonly onOpenSheet: (sheetId: string) => void;
}

export function StepCard({
  step,
  index,
  checked,
  onToggle,
  onOpenSheet,
}: StepCardProps): JSX.Element {
  const checkable = onToggle !== undefined;
  const danger = step.tone === "danger";

  return (
    <li
      data-testid={`step-${step.id}`}
      className={`rounded-2xl border p-4 shadow-sm transition-opacity ${
        danger
          ? "border-nuffle-red/35 bg-nuffle-red/5"
          : "border-nuffle-bronze/20 bg-white"
      } ${checked ? "opacity-60" : ""}`}
    >
      <div className="flex gap-3">
        {checkable ? (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={checked}
            aria-label={`${checked ? "Décocher" : "Cocher"} « ${step.title} »`}
            className={`mt-0.5 flex h-11 w-11 -ml-1.5 -mt-1.5 flex-none items-center justify-center rounded-xl transition-colors ${
              checked ? "text-white" : "text-nuffle-bronze"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                checked
                  ? "bg-nuffle-gold text-white"
                  : "border border-nuffle-bronze/30 bg-white font-score text-base text-nuffle-bronze"
              }`}
            >
              {checked ? (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m5 13 4 4 10-10" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
          </button>
        ) : (
          <span
            aria-hidden
            className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg font-score text-base ${
              danger
                ? "bg-nuffle-red/10 text-nuffle-red"
                : "border border-nuffle-bronze/25 text-nuffle-bronze"
            }`}
          >
            {index + 1}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3
            className={`font-heading text-base font-bold ${
              danger ? "text-nuffle-red" : "text-nuffle-anthracite"
            } ${checked ? "line-through decoration-nuffle-anthracite/30" : ""}`}
          >
            {step.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-nuffle-anthracite/70">
            {step.summary}
          </p>

          {step.bullets && (
            <ul className="mt-2.5 space-y-1.5 pl-4">
              {step.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="list-disc text-sm leading-relaxed text-nuffle-anthracite/75 marker:text-nuffle-gold"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          {(step.sheets?.length || step.chapterSlug) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {step.sheets?.map((sheetId) => {
                const sheet = getSheet(sheetId);
                if (!sheet) return null;
                return (
                  <button
                    key={sheetId}
                    type="button"
                    onClick={() => onOpenSheet(sheetId)}
                    className="flex h-11 items-center gap-2 rounded-full border border-nuffle-bronze/25 bg-nuffle-ivory/60 px-3.5 text-[0.8rem] font-semibold text-nuffle-bronze transition-colors hover:border-nuffle-gold/60 hover:text-nuffle-anthracite"
                  >
                    <span className="font-score text-sm leading-none text-nuffle-gold">
                      {sheet.dice}
                    </span>
                    {sheet.title}
                  </button>
                );
              })}
              {step.chapterSlug && (
                <Link
                  href={`/compendium/${step.chapterSlug}`}
                  className="flex h-11 items-center rounded-full px-3 text-[0.8rem] font-semibold text-nuffle-anthracite/50 underline-offset-2 transition-colors hover:text-nuffle-gold hover:underline"
                >
                  Règle complète
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
