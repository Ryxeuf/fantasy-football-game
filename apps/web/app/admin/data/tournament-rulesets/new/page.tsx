"use client";

/**
 * Console admin — création d'un règlement de tournoi.
 *
 * Partir d'une page blanche pour un pack de tournoi n'a pas de sens : on
 * propose donc de dupliquer un règlement existant (tiers et barèmes compris)
 * ou de démarrer sur un squelette minimal, puis on ouvre le même éditeur que
 * pour une modification.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import RulesetEditor from "../_components/RulesetEditor";
import { useEliteSkills, useStarPlayers } from "../_lib/catalogs";
import {
  createRuleset,
  getRuleset,
  listRulesets,
  type EditableDefinition,
  type RulesetSummary,
} from "../_lib/client";

/** Squelette : le minimum pour un règlement valide, à compléter. */
function blankDefinition(): EditableDefinition {
  return {
    slug: "",
    nameFr: "",
    nameEn: "",
    shortLabel: "",
    version: "V1",
    edition: "season_3",
    format: "bb11",
    descriptionFr: "",
    resurrection: false,
    minRegularPlayersBeforeStars: 0,
    rosterRules: {},
    skillCosts: {
      firstPrimary: 6,
      firstSecondary: 10,
      secondPrimary: 8,
      secondSecondary: 12,
      eliteSurcharge: 0,
    },
    eliteSkills: [],
    bannedStarPlayers: [],
    starPlayerSppTax: [],
    allowedInducements: [],
    scoring: { win: 3, draw: 1, loss: 0, concession: -1 },
  };
}

export default function NewTournamentRulesetPage() {
  const router = useRouter();
  const [existing, setExisting] = useState<RulesetSummary[]>([]);
  const [draft, setDraft] = useState<EditableDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRulesets()
      .then((r) => setExisting(r.rulesets))
      .catch(() => setExisting([]));
  }, []);

  const eliteCatalog = useEliteSkills(draft?.edition ?? "season_3");
  const starCatalog = useStarPlayers(draft?.edition ?? "season_3");

  const startFrom = async (slug: string) => {
    try {
      const d = await getRuleset(slug);
      setDraft({
        ...d.definition,
        // Slug et libellés à reprendre : on ne duplique pas une identité.
        slug: "",
        nameFr: `${d.definition.nameFr} (copie)`,
        shortLabel: `${d.definition.shortLabel} (copie)`,
      });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    }
  };

  const save = useCallback(
    async (definition: EditableDefinition, enabled: boolean) => {
      const created = await createRuleset(definition, enabled);
      router.push(
        `/admin/data/tournament-rulesets/${created.slug}` as Route,
      );
    },
    [router],
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
        Nouveau règlement
      </h1>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {draft === null ? (
        <div
          className="mt-6 space-y-4"
          data-testid="ruleset-new-start"
        >
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">
              Partir d&apos;un règlement existant
            </h2>
            <p className="mt-0.5 text-xs text-gray-600">
              Reprend tiers, barèmes, interdits et coups de pouce. Le slug et
              les libellés restent à définir.
            </p>
            <ul className="mt-3 space-y-2">
              {existing.map((r) => (
                <li key={r.slug}>
                  <button
                    type="button"
                    onClick={() => startFrom(r.slug)}
                    data-testid={`start-from-${r.slug}`}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-indigo-400 hover:bg-indigo-50/60"
                  >
                    <span className="font-medium text-gray-900">
                      {r.nameFr}
                    </span>{" "}
                    <span className="text-xs text-gray-500">
                      {r.version} · {r.rosterCount} rosters
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <button
            type="button"
            onClick={() => setDraft(blankDefinition())}
            data-testid="start-blank"
            className="w-full rounded-2xl border border-dashed border-gray-300 px-3 py-4 text-sm font-medium text-gray-700 hover:border-indigo-400 hover:bg-indigo-50/40"
          >
            Partir d&apos;un squelette vierge
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <RulesetEditor
            initial={draft}
            initialEnabled
            slugLocked={false}
            eliteCatalog={eliteCatalog}
            starCatalog={starCatalog}
            onSave={save}
            saveLabel="Créer le règlement"
          />
        </div>
      )}
    </div>
  );
}
