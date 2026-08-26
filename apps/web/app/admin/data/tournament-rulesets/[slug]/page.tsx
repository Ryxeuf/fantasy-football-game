"use client";

/**
 * Console admin — édition d'un règlement de tournoi.
 *
 * Le slug est verrouillé : il est référencé par les équipes et compétitions
 * déjà créées. Tout le reste est éditable, section par section.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import RulesetEditor from "../_components/RulesetEditor";
import { useEliteSkills, useStarPlayers } from "../_lib/catalogs";
import {
  getRuleset,
  updateRuleset,
  type EditableDefinition,
} from "../_lib/client";

export default function EditTournamentRulesetPage() {
  const params = useParams();
  const slug = String(params?.slug ?? "");
  const [detail, setDetail] = useState<{
    definition: EditableDefinition;
    enabled: boolean;
    source: "db" | "engine";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getRuleset(slug)
      .then((d) =>
        setDetail({
          definition: d.definition,
          enabled: d.enabled,
          source: d.source,
        }),
      )
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Erreur de chargement"),
      );
  }, [slug]);

  const eliteCatalog = useEliteSkills(detail?.definition.edition ?? "season_3");
  const starCatalog = useStarPlayers(detail?.definition.edition ?? "season_3");

  const save = useCallback(
    async (definition: EditableDefinition, enabled: boolean) => {
      await updateRuleset(slug, definition, enabled);
    },
    [slug],
  );

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <Link
        href={"/admin/data/tournament-rulesets" as Route}
        className="text-sm text-indigo-600 hover:underline"
      >
        ← Règlements de tournoi
      </Link>
      <h1 className="mt-2 text-xl font-bold text-gray-900 sm:text-2xl">
        {detail?.definition.nameFr ?? slug}
      </h1>

      {detail?.source === "engine" && (
        <p
          data-testid="ruleset-source-hint"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Ce règlement est encore servi par le registre du code. Le premier
          enregistrement crée la ligne en base : c&apos;est elle qui sera
          servie ensuite.
        </p>
      )}

      {error && (
        <p
          role="alert"
          data-testid="ruleset-load-error"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {detail ? (
        <div className="mt-4">
          <RulesetEditor
            initial={detail.definition}
            initialEnabled={detail.enabled}
            slugLocked
            eliteCatalog={eliteCatalog}
            starCatalog={starCatalog}
            onSave={save}
            saveLabel="Enregistrer"
          />
        </div>
      ) : (
        !error && <p className="mt-6 text-sm text-gray-500">Chargement…</p>
      )}
    </div>
  );
}
