/**
 * Météo de la feuille de match, relue pendant la saisie des évènements.
 *
 * La météo se tire à l'AVANT-MATCH (table + résultat 2D6), mais ses effets
 * (−1 aux passes, −1 aux réceptions, joueurs en Réserve à chaque drive…)
 * jouent pendant tout le match : l'onglet « En cours » doit donc les
 * rappeler. Module pur (pas de fichier page : Next.js y interdit les
 * exports non conventionnels), testable sans DOM.
 */
import {
  getWeatherModifiers,
  LEGACY_KICKOFF_EVENT_IDS,
  type WeatherModifiers,
} from "@bb/game-engine";
import type { EventKind } from "./event-fields";

/** Forme servie par le serveur (`reference.weatherTables`). */
export interface SheetWeatherTable {
  id: string;
  name: string;
  results: ReadonlyArray<{
    roll: number;
    condition: string;
    description: string;
  }>;
}

export interface SheetWeatherView {
  /** Libellé de la table (« Classique »), ou l'id brut si inconnue. */
  tableName: string;
  condition: string;
  /** Texte de la règle ; `null` si la condition n'est plus au catalogue. */
  description: string | null;
  /** Jets 2D6 qui donnent cette condition (ex. [4..10] pour « parfaites »). */
  rolls: number[];
  /** Effets de jeu résumés en puces ; vide = aucun effet (conditions idéales). */
  effects: string[];
  modifiers: WeatherModifiers;
}

const PASS_RANGE_LABELS: Record<NonNullable<WeatherModifiers["maxPassRange"]>, string> = {
  quick: "Passes Rapides uniquement",
  short: "Passes Rapides et Courtes uniquement",
  long: "Pas de Longue Bombe",
  bomb: "",
};

/** Puces d'effets, dans l'ordre où elles pèsent sur la saisie. */
export function weatherEffectLabels(m: WeatherModifiers): string[] {
  const out: string[] = [];
  if (m.passingModifier) {
    out.push(`${m.passingModifier} aux tests de Capacité de Passe`);
  }
  if (m.agilityModifier) {
    out.push(`${m.agilityModifier} aux tests d'Agilité (réception, ramassage)`);
  }
  if (m.gfiModifier) out.push(`${m.gfiModifier} aux Rush (Foncer)`);
  if (m.maxPassRange && PASS_RANGE_LABELS[m.maxPassRange]) {
    out.push(PASS_RANGE_LABELS[m.maxPassRange]);
  }
  if (m.playersToReserves > 0) {
    out.push("D3 joueurs aléatoires par équipe en Réserve à la fin de chaque drive");
  }
  return out;
}

/**
 * Résout la météo saisie à l'avant-match. `null` tant qu'aucune condition
 * n'est choisie. Une condition absente du catalogue (feuille ancienne,
 * table renommée) reste affichée, sans description ni effets déduits.
 */
export function resolveSheetWeather(
  tables: ReadonlyArray<SheetWeatherTable>,
  tableId: string | null | undefined,
  condition: string | null | undefined,
): SheetWeatherView | null {
  if (!condition) return null;
  const table = tables.find((t) => t.id === tableId);
  const matches = table?.results.filter((r) => r.condition === condition) ?? [];
  const first = matches[0];
  const modifiers = getWeatherModifiers(
    first ? { condition: first.condition, description: first.description } : undefined,
  );
  return {
    tableName: table?.name ?? tableId ?? "",
    condition,
    description: first?.description ?? null,
    rolls: matches.map((r) => r.roll),
    effects: first ? weatherEffectLabels(modifiers) : [],
    modifiers,
  };
}

/**
 * Rappel ciblé pour le type d'évènement en cours de saisie : la météo
 * n'intéresse pas un touchdown, mais elle a pu faire rater (ou rendre
 * impossible) une passe.
 */
export function weatherHintForEventKind(
  weather: SheetWeatherView | null,
  kind: EventKind,
): string | null {
  if (!weather) return null;
  const m = weather.modifiers;
  const parts: string[] = [];
  if (kind === "pass_complete" || kind === "interception") {
    if (m.passingModifier) parts.push(`${m.passingModifier} à la passe`);
    if (m.agilityModifier) parts.push(`${m.agilityModifier} à la réception`);
    if (m.maxPassRange && PASS_RANGE_LABELS[m.maxPassRange]) {
      parts.push(PASS_RANGE_LABELS[m.maxPassRange].toLowerCase());
    }
  } else if (kind === "team_throw") {
    if (m.passingModifier) parts.push(`${m.passingModifier} au lancer`);
  } else if (kind === "ttm_landing") {
    if (m.agilityModifier) parts.push(`${m.agilityModifier} à la réception du ballon`);
  }
  if (parts.length === 0) return null;
  return `Météo « ${weather.condition} » : ${parts.join(", ")}.`;
}

interface KickoffLikeEvent {
  id: string;
  kind: string;
  meta?: { half?: number; turn?: number; kickoffEvent?: string } | null;
}

/**
 * Coups d'envoi « Météo capricieuse » saisis : la météo a été RELANCÉE en
 * cours de match. La feuille ne garde qu'une météo (celle de l'avant-match),
 * d'où l'invitation à la mettre à jour.
 */
export function changingWeatherKickoffs<E extends KickoffLikeEvent>(
  events: ReadonlyArray<E>,
): E[] {
  return events.filter((e) => {
    if (e.kind !== "kickoff" || !e.meta?.kickoffEvent) return false;
    const id = LEGACY_KICKOFF_EVENT_IDS[e.meta.kickoffEvent] ?? e.meta.kickoffEvent;
    return id === "changing-weather";
  });
}
