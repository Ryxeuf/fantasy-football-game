/**
 * S27.3.4 — Helpers d'affichage purs pour les matchs du lobby.
 *
 * Pas de dependance React Native : 100% testables.
 * Les helpers acceptent une fonction `t` injectee (signature compatible
 * avec `lib/i18n.ts` et `useTranslation().t`) pour rester independants
 * de la locale active.
 */

import type { Locale, TranslationKey } from "../i18n";

export type TFn = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  active: "lobby.status.active",
  pending: "lobby.status.pending",
  prematch: "lobby.status.prematch",
  "prematch-setup": "lobby.status.prematchSetup",
  ended: "lobby.status.ended",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22C55E",
  pending: "#EAB308",
  prematch: "#3B82F6",
  "prematch-setup": "#3B82F6",
  ended: "#6B7280",
};

const STATUS_FALLBACK_COLOR = "#9CA3AF";

export function getStatusLabel(status: string, t: TFn): string {
  const key = STATUS_LABEL_KEYS[status];
  if (!key) return status;
  return t(key);
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_FALLBACK_COLOR;
}

const LOCALE_TAG: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
};

export function formatMatchDate(
  dateStr: string | null | undefined,
  locale: Locale,
): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LOCALE_TAG[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRoundLabel(half: number, turn: number, t: TFn): string {
  return t("lobby.roundLabel", { half, turn });
}
