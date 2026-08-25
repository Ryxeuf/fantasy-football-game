"use client";

/**
 * Panneau d'edition d'UN joueur, deplie depuis sa ligne d'effectif.
 *
 * Trois blocs lisibles au lieu d'une barre de champs : identite,
 * caracteristiques (les 5 valeurs sont affichees et editables d'un coup,
 * plus de select « quelle carac ? »), progression (PSP + competences).
 */

import { useState } from "react";
import { apiRequest } from "../../../lib/api-client";
import {
  CHARS,
  CHAR_LABELS,
  SKILL_CATEGORY_LABEL,
  accessibleSkills,
  charValueOf,
  skillsOf,
  type CharKind,
} from "./roster-helpers";
import type { EditPlayer, PositionAccess, SkillCatalogItem } from "./types";

const SPP_PRESETS = [-3, -1, 1, 3, 5] as const;

interface Props {
  leagueId: string;
  teamId: string;
  player: EditPlayer;
  busy: boolean;
  access?: PositionAccess;
  catalog: readonly SkillCatalogItem[];
  skillName: (slug: string) => string;
  run: <T>(call: () => Promise<T>, successMessage: string) => Promise<T | null>;
}

export function PlayerEditPanel({
  leagueId,
  teamId,
  player,
  busy,
  access,
  catalog,
  skillName,
  run,
}: Props) {
  const base = `/leagues/${leagueId}/teams/${teamId}/players/${player.id}`;
  const skills = skillsOf(player);
  const innate = new Set(access?.innateSkills ?? []);
  const options = accessibleSkills(catalog, access, skills);

  const [name, setName] = useState(player.name);
  const [number, setNumber] = useState(String(player.number));
  const [sppDelta, setSppDelta] = useState(0);
  const [newSkill, setNewSkill] = useState("");

  const numberValue = Number(number);
  const identityDirty =
    name.trim() !== player.name || numberValue !== player.number;
  const identityValid =
    name.trim().length > 0 &&
    Number.isInteger(numberValue) &&
    numberValue >= 1 &&
    numberValue <= 99;

  return (
    <div className="border-t border-gray-200 bg-gray-50/70 px-3 py-3 space-y-3 rounded-b-lg">
      {/* Identité */}
      <section className="space-y-1">
        <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Identité
        </h5>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            <span className="block mb-0.5">Numéro</span>
            <input
              type="number"
              min={1}
              max={99}
              value={number}
              disabled={busy}
              onChange={(e) => setNumber(e.target.value)}
              data-testid={`identity-number-${player.id}`}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 flex-1 min-w-[10rem]">
            <span className="block mb-0.5">Nom</span>
            <input
              type="text"
              value={name}
              maxLength={60}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              data-testid={`identity-name-${player.id}`}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Prénom Nom"
            />
          </label>
          <button
            type="button"
            data-testid={`identity-save-${player.id}`}
            disabled={busy || !identityDirty || !identityValid}
            onClick={() =>
              run(
                () =>
                  apiRequest(`${base}/identity`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      name: name.trim(),
                      number: numberValue,
                    }),
                  }),
                "Identité enregistrée",
              )
            }
            className="px-3 py-1 rounded bg-nuffle-gold text-white text-xs font-medium disabled:opacity-50"
          >
            Enregistrer
          </button>
          {identityDirty ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setName(player.name);
                setNumber(String(player.number));
              }}
              className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-600 hover:bg-white"
            >
              Annuler
            </button>
          ) : null}
        </div>
      </section>

      {/* Caractéristiques */}
      <section className="space-y-1">
        <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Caractéristiques
        </h5>
        <div className="flex flex-wrap gap-2">
          {CHARS.map((kind) => (
            <CharField
              key={kind}
              kind={kind}
              player={player}
              busy={busy}
              onApply={(value) =>
                run(
                  () =>
                    apiRequest(`${base}/characteristic`, {
                      method: "PATCH",
                      body: JSON.stringify({ characteristic: kind, value }),
                    }),
                  `${CHAR_LABELS[kind]} mis à jour`,
                )
              }
            />
          ))}
        </div>
      </section>

      {/* Progression : PSP + compétences */}
      <section className="space-y-1.5">
        <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Progression
        </h5>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-600">
            PSP actuels : <strong>{player.spp}</strong>
          </span>
          {SPP_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => setSppDelta((v) => v + n)}
              className="px-1.5 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              {n > 0 ? `+${n}` : n}
            </button>
          ))}
          <input
            type="number"
            value={sppDelta}
            disabled={busy}
            aria-label="Ajustement de PSP"
            onChange={(e) => setSppDelta(Number(e.target.value))}
            className="w-16 border border-gray-300 rounded px-1.5 py-0.5"
          />
          <button
            type="button"
            data-testid={`spp-apply-${player.id}`}
            disabled={busy || sppDelta === 0}
            onClick={() =>
              run(
                () =>
                  apiRequest(`${base}/spp`, {
                    method: "POST",
                    body: JSON.stringify({ delta: sppDelta }),
                  }),
                `PSP ajustés (${sppDelta > 0 ? "+" : ""}${sppDelta})`,
              ).then((ok) => {
                if (ok) setSppDelta(0);
              })
            }
            className="px-2 py-0.5 rounded bg-nuffle-anthracite text-white disabled:opacity-50"
          >
            Appliquer
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {skills.length === 0 ? (
            <span className="text-xs text-gray-400">Aucune compétence</span>
          ) : (
            skills.map((skill) => (
              <span
                key={skill}
                className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 ${
                  innate.has(skill)
                    ? "bg-gray-200 text-gray-600"
                    : "bg-blue-50 text-blue-800"
                }`}
                title={
                  innate.has(skill)
                    ? "Compétence innée du poste (non retirable)"
                    : undefined
                }
              >
                {skillName(skill)}
                {!innate.has(skill) ? (
                  <button
                    type="button"
                    aria-label={`Retirer ${skillName(skill)}`}
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          apiRequest(`${base}/skills`, {
                            method: "DELETE",
                            body: JSON.stringify({ skill }),
                          }),
                        `${skillName(skill)} retirée`,
                      )
                    }
                    className="text-blue-500 hover:text-red-600 disabled:opacity-50"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {access && catalog.length > 0 ? (
            <select
              value={newSkill}
              disabled={busy}
              aria-label="Compétence à ajouter"
              onChange={(e) => setNewSkill(e.target.value)}
              data-testid={`skill-select-${player.id}`}
              className="max-w-56 border border-gray-300 rounded px-1.5 py-1 bg-white"
            >
              <option value="">Ajouter une compétence…</option>
              <optgroup label="Accès primaire">
                {options
                  .filter((o) => o.primary)
                  .map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.nameFr} ({SKILL_CATEGORY_LABEL[o.code] ?? o.code})
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Accès secondaire">
                {options
                  .filter((o) => !o.primary)
                  .map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.nameFr} ({SKILL_CATEGORY_LABEL[o.code] ?? o.code})
                    </option>
                  ))}
              </optgroup>
            </select>
          ) : (
            <input
              type="text"
              value={newSkill}
              disabled={busy}
              aria-label="Compétence à ajouter"
              placeholder="block"
              onChange={(e) => setNewSkill(e.target.value)}
              className="w-32 border border-gray-300 rounded px-1.5 py-1"
            />
          )}
          <button
            type="button"
            data-testid={`skill-add-${player.id}`}
            disabled={busy || newSkill.trim().length === 0}
            onClick={() =>
              run(
                () =>
                  apiRequest(`${base}/skills`, {
                    method: "POST",
                    body: JSON.stringify({ skill: newSkill.trim() }),
                  }),
                "Compétence ajoutée",
              ).then((ok) => {
                if (ok) setNewSkill("");
              })
            }
            className="px-2 py-1 rounded bg-nuffle-anthracite text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Une caracteristique : valeur courante pre-remplie, appliquee en valeur
 * ABSOLUE (l'API accepte `value`). Le bouton n'apparait qu'une fois la
 * valeur changee — pas de champ « OK » toujours actif qui ne fait rien.
 */
function CharField({
  kind,
  player,
  busy,
  onApply,
}: {
  kind: CharKind;
  player: EditPlayer;
  busy: boolean;
  onApply: (value: number) => void;
}) {
  const current = charValueOf(player, kind);
  const [value, setValue] = useState(current === null ? "" : String(current));
  const parsed = Number(value);
  const dirty = value !== "" && parsed !== current;
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 10;

  return (
    <label
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 bg-white ${
        dirty ? "border-nuffle-gold" : "border-gray-300"
      }`}
    >
      <span className="text-xs font-semibold text-gray-500">
        {CHAR_LABELS[kind]}
      </span>
      <input
        type="number"
        min={1}
        max={10}
        value={value}
        disabled={busy}
        aria-label={`Caractéristique ${CHAR_LABELS[kind]}`}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`char-value-${kind}-${player.id}`}
        className="w-12 border border-gray-200 rounded px-1 py-0.5 text-sm"
      />
      {dirty ? (
        <button
          type="button"
          data-testid={`char-apply-${kind}-${player.id}`}
          disabled={busy || !valid}
          onClick={() => onApply(parsed)}
          className="text-xs px-1.5 py-0.5 rounded bg-nuffle-gold text-white disabled:opacity-50"
        >
          OK
        </button>
      ) : null}
    </label>
  );
}
