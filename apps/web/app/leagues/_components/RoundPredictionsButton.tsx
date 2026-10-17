"use client";
import Link from "next/link";
import { dynamicRoute } from "../../lib/typed-route";
import type { RoundPredictionLink } from "./prediction-rounds";

const PREDICTION_BUTTON_STYLES: Readonly<
  Record<RoundPredictionLink["state"], string>
> = {
  todo: "border-nuffle-gold bg-nuffle-gold text-white hover:bg-nuffle-gold/90",
  done: "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  open: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  closed: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
};

/**
 * Bouton 🔮 d'une journée (ligue) ou d'une ronde (coupe) : mène aux
 * pronostics de CETTE journée. Son libellé dit ce qui attend le lecteur (à
 * pronostiquer, fait, résultats) — le détail ne s'affiche pas dans le
 * calendrier.
 */
export function RoundPredictionsButton({
  link,
  testId,
}: {
  link: RoundPredictionLink;
  testId: string;
}) {
  return (
    <Link
      href={dynamicRoute(link.href)}
      data-testid={testId}
      data-state={link.state}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium ${PREDICTION_BUTTON_STYLES[link.state]}`}
    >
      <span aria-hidden>🔮</span> {link.label}
    </Link>
  );
}
