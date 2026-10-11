"use client";

/**
 * Coups de pouce d'une coupe (création, édition) : le régime — `build`
 * imposé et grisé sous règlement de tournoi, absent en Sept — et la LISTE du
 * commissaire, qui fait foi règlement compris.
 *
 * Les cases partent de la liste par défaut (celle du règlement, sinon tout le
 * catalogue) : décocher interdit, cocher un coup de pouce que le règlement ne
 * liste pas l'ajoute au prix du catalogue. `allowed = null` veut dire « liste
 * par défaut » ; la normalisation à l'enregistrement est celle de
 * `normalizeCupAllowedInducements`.
 */

import {
  ALLOWED_INDUCEMENT_OPTIONS,
  AllowedInducementsField,
} from "../components/AllowedInducementsField";
import {
  CUP_INDUCEMENT_MODE_COPY,
  cupInducementModeChoices,
  defaultCupInducementSlugs,
  effectiveCupInducementSlugs,
  normalizeCupAllowedInducements,
  packInducementSlugs,
  showsAllowedInducements,
  type CupInducementMode,
  type CupInducementModeContext,
  type PackInducementRule,
} from "./inducement-mode";

const CATALOGUE_SLUGS = ALLOWED_INDUCEMENT_OPTIONS.map((o) => o.slug);

export interface CupInducementModeFieldProps {
  readonly value: CupInducementMode;
  readonly onChange: (mode: CupInducementMode) => void;
  /** Liste du commissaire, `null` = liste par défaut. */
  readonly allowed: readonly string[] | null;
  readonly onAllowedChange: (next: string[] | null) => void;
  readonly context: CupInducementModeContext;
  /** Nom court du règlement imposé, pour le dire. */
  readonly rulesetLabel?: string | null;
  /** Coups de pouce du règlement (prix compris), s'il y en a un. */
  readonly packInducements?: readonly PackInducementRule[] | null;
  readonly disabled?: boolean;
}

function formatK(po: number): string {
  return `${Math.round(po / 1000)}k`;
}

export function CupInducementModeField({
  value,
  onChange,
  allowed,
  onAllowedChange,
  context,
  rulesetLabel,
  packInducements,
  disabled = false,
}: CupInducementModeFieldProps) {
  const { modes, locked } = cupInducementModeChoices(context);
  const packSlugs = context.hasTournamentRuleset
    ? (packInducementSlugs(packInducements) ?? [])
    : null;
  const defaults = defaultCupInducementSlugs(packSlugs, CATALOGUE_SLUGS);
  const checked = effectiveCupInducementSlugs(allowed, defaults);
  const customised = normalizeCupAllowedInducements(allowed, defaults) !== null;
  const badges = packInducements
    ? Object.fromEntries(
        packInducements.map((r) => [
          r.slug,
          `${rulesetLabel ?? "Règlement"} · ${formatK(r.cost)}`,
        ]),
      )
    : undefined;

  return (
    <div className="space-y-3" data-testid="cup-inducement-mode-field">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-gray-800">
          Coups de pouce
        </legend>
        {locked ? (
          <p className="text-xs text-amber-800" data-testid="cup-inducement-mode-locked">
            Imposé par le règlement{rulesetLabel ? ` ${rulesetLabel}` : ""} :
            achat à la création, aux prix du règlement.
          </p>
        ) : null}
        {modes.map((mode) => (
          <label
            key={mode}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-2 text-sm"
          >
            <input
              type="radio"
              name="cupInducementMode"
              value={mode}
              checked={value === mode}
              onChange={() => onChange(mode)}
              disabled={disabled || locked}
              data-testid={`cup-inducement-mode-${mode}`}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-gray-900">
                {CUP_INDUCEMENT_MODE_COPY[mode].title}
              </span>
              <span className="block text-xs text-gray-600">
                {CUP_INDUCEMENT_MODE_COPY[mode].description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {showsAllowedInducements(value) &&
      context.hasTournamentRuleset &&
      !packInducements ? (
        <p className="text-xs text-gray-500">Chargement de la liste du règlement…</p>
      ) : showsAllowedInducements(value) ? (
        <div className="space-y-1">
          <AllowedInducementsField
            testId="cup-allowed-inducements"
            legend="Coups de pouce autorisés par la coupe"
            value={checked}
            onChange={(next) => onAllowedChange(next)}
            disabled={disabled}
            badges={badges}
            hint={
              packSlugs
                ? `Cochés : la liste du règlement${rulesetLabel ? ` ${rulesetLabel}` : ""}, à ses prix. Décochez pour interdire ; cochez un coup de pouce que le règlement ne liste pas pour l'ajouter, au prix du catalogue.`
                : "Cochés : tout le catalogue. Décochez ce que la coupe interdit. Les Star Players ne sont pas concernés."
            }
          />
          {checked.length === 0 ? (
            <p data-testid="cup-allowed-inducements-empty" className="text-xs text-amber-800">
              Aucun coup de pouce coché : la coupe n&apos;en vendra aucun.
            </p>
          ) : null}
          {customised ? (
            <button
              type="button"
              data-testid="cup-allowed-inducements-reset"
              onClick={() => onAllowedChange(null)}
              disabled={disabled}
              className="text-xs text-nuffle-bronze hover:underline disabled:opacity-50"
            >
              {packSlugs ? "Revenir à la liste du règlement" : "Tout réautoriser"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
