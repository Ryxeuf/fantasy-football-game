"use client";

/**
 * Onglet « Staff & trésorerie ».
 *
 * Le staff (relances, cheerleaders, assistants, apothicaire, fans dévoués)
 * n'était pas éditable par le commissaire : une relance oubliée au build
 * imposait de passer par le coach. Chaque ligne affiche son plafond réel
 * (résolu roster × format côté serveur) et son coût unitaire ; le
 * différentiel n'est débité de la trésorerie que si on le demande.
 */

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api-client";
import { formatGold, formatGoldDelta, staffCostDelta } from "./roster-helpers";
import type { StaffConfig, TeamSettings, TeamStaff } from "./types";

interface Props {
  leagueId: string;
  teamId: string;
  settings: TeamSettings;
  busy: boolean;
  run: <T>(call: () => Promise<T>, successMessage: string) => Promise<T | null>;
}

interface CounterSpec {
  key: "rerolls" | "cheerleaders" | "assistants" | "dedicatedFans";
  label: string;
  min: number;
  max: (c: StaffConfig) => number;
  cost: (c: StaffConfig) => number;
}

const COUNTERS: readonly CounterSpec[] = [
  {
    key: "rerolls",
    label: "Relances",
    min: 0,
    max: (c) => c.maxRerolls,
    cost: (c) => c.rerollCost,
  },
  {
    key: "cheerleaders",
    label: "Cheerleaders",
    min: 0,
    max: (c) => c.maxCheerleaders,
    cost: (c) => c.cheerleaderCost,
  },
  {
    key: "assistants",
    label: "Assistants",
    min: 0,
    max: (c) => c.maxAssistants,
    cost: (c) => c.assistantCost,
  },
  {
    key: "dedicatedFans",
    label: "Fans dévoués",
    min: 1,
    max: (c) => c.maxDedicatedFans,
    cost: (c) => c.dedicatedFanCost,
  },
];

export function StaffTab({ leagueId, teamId, settings, busy, run }: Props) {
  const { staff, staffConfig } = settings;
  const [draft, setDraft] = useState<TeamStaff>(staff);
  const [charge, setCharge] = useState(false);

  // Le rechargement post-mutation ré-aligne le brouillon sur le serveur.
  // Dépendances primitives : un rechargement qui ne change AUCUNE valeur
  // (action d'un autre panneau) ne doit pas effacer une saisie en cours.
  useEffect(() => {
    setDraft(staff);
    setCharge(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    staff.rerolls,
    staff.cheerleaders,
    staff.assistants,
    staff.apothecary,
    staff.dedicatedFans,
  ]);

  const dirty =
    draft.rerolls !== staff.rerolls ||
    draft.cheerleaders !== staff.cheerleaders ||
    draft.assistants !== staff.assistants ||
    draft.apothecary !== staff.apothecary ||
    draft.dedicatedFans !== staff.dedicatedFans;
  const cost = staffCostDelta(staff, draft, staffConfig);

  return (
    <div className="space-y-4">
      <TreasuryPanel
        leagueId={leagueId}
        teamId={teamId}
        settings={settings}
        busy={busy}
        run={run}
      />

      <section
        data-testid="staff-panel"
        className="rounded-lg border border-gray-200"
      >
        <header className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h4 className="text-sm font-semibold text-nuffle-anthracite">
            Staff
          </h4>
          <p className="text-xs text-gray-500">
            Plafonds du roster {settings.team.roster} en{" "}
            {settings.team.format === "sevens" ? "Sevens" : "Blood Bowl à 11"}.
          </p>
        </header>

        <div className="divide-y divide-gray-100">
          {COUNTERS.map((spec) => (
            <Counter
              key={spec.key}
              label={spec.label}
              value={draft[spec.key]}
              current={staff[spec.key]}
              min={spec.min}
              max={spec.max(staffConfig)}
              unitCost={spec.cost(staffConfig)}
              disabled={busy}
              testId={`staff-${spec.key}`}
              onChange={(v) => setDraft((d) => ({ ...d, [spec.key]: v }))}
            />
          ))}

          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="text-sm text-nuffle-anthracite w-32">
              Apothicaire
            </span>
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={draft.apothecary}
                disabled={busy || !staffConfig.apothecaryAllowed}
                data-testid="staff-apothecary"
                onChange={(e) =>
                  setDraft((d) => ({ ...d, apothecary: e.target.checked }))
                }
              />
              {staffConfig.apothecaryAllowed
                ? "Présent"
                : "Interdit pour ce roster"}
            </label>
            <span className="ml-auto text-xs text-gray-500">
              {formatGold(staffConfig.apothecaryCost)}
            </span>
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-3 px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <span
            data-testid="staff-cost"
            className={`text-sm font-medium ${
              cost > 0 ? "text-red-700" : cost < 0 ? "text-green-700" : "text-gray-500"
            }`}
          >
            {dirty ? `Coût : ${formatGoldDelta(cost)}` : "Aucun changement"}
          </span>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={charge}
              disabled={busy || !dirty}
              data-testid="staff-charge-treasury"
              onChange={(e) => setCharge(e.target.checked)}
            />
            Répercuter sur la trésorerie
          </label>
          <div className="ml-auto flex items-center gap-2">
            {dirty ? (
              <button
                type="button"
                onClick={() => setDraft(staff)}
                disabled={busy}
                className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-600 hover:bg-white disabled:opacity-50"
              >
                Réinitialiser
              </button>
            ) : null}
            <button
              type="button"
              data-testid="staff-save"
              disabled={busy || !dirty}
              onClick={() =>
                run(
                  () =>
                    apiRequest(`/leagues/${leagueId}/teams/${teamId}/staff`, {
                      method: "PATCH",
                      body: JSON.stringify({ ...draft, chargeTreasury: charge }),
                    }),
                  "Staff mis à jour",
                )
              }
              className="px-3 py-1 rounded bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
            >
              Enregistrer le staff
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Counter({
  label,
  value,
  current,
  min,
  max,
  unitCost,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  current: number;
  min: number;
  max: number;
  unitCost: number;
  disabled: boolean;
  testId: string;
  onChange: (value: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="text-sm text-nuffle-anthracite w-32">{label}</span>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label={`Retirer un(e) ${label}`}
          data-testid={`${testId}-minus`}
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - 1))}
          className="w-7 h-7 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          aria-label={label}
          data-testid={testId}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="w-14 border border-gray-300 rounded px-1.5 py-1 text-sm text-center"
        />
        <button
          type="button"
          aria-label={`Ajouter un(e) ${label}`}
          data-testid={`${testId}-plus`}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + 1))}
          className="w-7 h-7 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        >
          +
        </button>
      </div>
      {value !== current ? (
        <span className="text-xs text-nuffle-bronze">
          (actuel : {current})
        </span>
      ) : null}
      <span className="ml-auto text-xs text-gray-500">
        max {max} · {formatGold(unitCost)} l&apos;unité
      </span>
    </div>
  );
}

const TREASURY_PRESETS = [-50_000, -10_000, 10_000, 50_000] as const;

function TreasuryPanel({
  leagueId,
  teamId,
  settings,
  busy,
  run,
}: {
  leagueId: string;
  teamId: string;
  settings: TeamSettings;
  busy: boolean;
  run: <T>(call: () => Promise<T>, successMessage: string) => Promise<T | null>;
}) {
  const [delta, setDelta] = useState(0);
  const projected = settings.team.treasury + delta;

  return (
    <section
      data-testid="treasury-panel"
      className="rounded-lg border border-gray-200"
    >
      <header className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg flex flex-wrap items-baseline gap-2">
        <h4 className="text-sm font-semibold text-nuffle-anthracite">
          Trésorerie
        </h4>
        <span className="font-mono text-sm text-nuffle-bronze">
          {formatGold(settings.team.treasury)}
        </span>
        <span className="ml-auto text-xs text-gray-500">
          VE {formatGold(settings.team.teamValue)} · VEA{" "}
          {formatGold(settings.team.currentValue)}
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-xs">
        {TREASURY_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onClick={() => setDelta((v) => v + n)}
            className="px-1.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
          >
            {formatGoldDelta(n)}
          </button>
        ))}
        <input
          type="number"
          step={1000}
          value={delta}
          disabled={busy}
          aria-label="Ajustement de trésorerie"
          onChange={(e) => setDelta(Number(e.target.value))}
          className="w-28 border border-gray-300 rounded px-2 py-1"
        />
        {delta !== 0 ? (
          <span
            data-testid="treasury-projection"
            className={projected < 0 ? "text-red-700" : "text-gray-600"}
          >
            → {formatGold(projected)}
          </span>
        ) : null}
        <button
          type="button"
          data-testid="treasury-adjust"
          disabled={busy || delta === 0 || projected < 0}
          onClick={() =>
            run(
              () =>
                apiRequest(`/leagues/${leagueId}/teams/${teamId}/treasury`, {
                  method: "PATCH",
                  body: JSON.stringify({ delta }),
                }),
              "Trésorerie mise à jour",
            ).then((ok) => {
              if (ok) setDelta(0);
            })
          }
          className="ml-auto px-3 py-1 rounded bg-nuffle-gold text-white font-medium disabled:opacity-50"
        >
          Appliquer
        </button>
      </div>
    </section>
  );
}
