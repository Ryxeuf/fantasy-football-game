/**
 * Scènes capturées : un rendu par correction livrée.
 *
 * Chaque scène monte le VRAI composant de `apps/web` avec des props
 * représentatives. Rien n'est réimplémenté ici : si le composant change, la
 * capture change — c'est tout l'intérêt.
 */

import * as React from "react";
import {
  InvalidateControl,
  JourneymenPanel,
  PlayerSelect,
  PostMatchPanel,
  purchaseOptionLabel,
  type SheetTeam,
  type PostMatchValues,
} from "../../apps/web/app/leagues/pairings/[id]/sheet/_components/MatchSheetPanels";
import PlayerStatusTags from "../../apps/web/app/me/teams/[id]/edit/PlayerStatusTags";
import SkillTooltip from "../../apps/web/app/me/teams/components/SkillTooltip";
import { LanguageProvider } from "../../apps/web/app/contexts/LanguageContext";
import { displayedRegionalLeagues } from "../../apps/web/app/me/teams/[id]/regional-leagues";
import { eventKindHint } from "../../apps/web/app/leagues/pairings/[id]/sheet/event-fields";

/**
 * Une preuve d'exécution : la sortie VERBATIM d'une commande de test,
 * capturée au moment de la génération. Contrairement aux scènes d'UI, elle
 * atteste d'un comportement serveur qui n'a pas de surface visuelle propre.
 */
export interface Evidence {
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  /** Commande et arguments, exécutés depuis `cwd` (relatif au dépôt). */
  readonly cwd: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  /** Ne garder que les lignes utiles (le reste est du bruit de démarrage). */
  readonly keep: (line: string) => boolean;
}

/** Lignes de résultat de vitest : arborescence de tests et totaux. */
function isVitestResultLine(line: string): boolean {
  return /^\s*(✓|×|❯|Test Files|Tests|Duration|Start at)/.test(line);
}

export const EVIDENCE: readonly Evidence[] = [
  {
    id: "a158-preuve-tests-playoff",
    title: "A158 — Preuve d'exécution : bracket et invalidation de play-off",
    caption:
      "Sortie verbatim du spec e2e-api (SQLite, parcours réel 4 équipes). Sans le correctif, « la finale est creee… » échoue : la création du tour suivant butait sur la contrainte unique (seasonId, roundNumber).",
    cwd: "tests/e2e-api",
    command: "npx",
    args: [
      "vitest",
      "run",
      "--config",
      "vitest.config.ts",
      "specs/leagues-playoff-invalidation.spec.ts",
    ],
    env: {
      TEST_SQLITE: "1",
      TEST_DATABASE_URL: "file:memdb-shots-po?mode=memory&cache=shared",
      API_PORT: "18120",
      JWT_SECRET: "screenshot-jwt-secret",
      MATCH_SECRET: "screenshot-match-secret",
      FEATURE_FLAGS_FORCE_ENABLED: "true",
    },
    keep: isVitestResultLine,
  },
  {
    id: "e45-preuve-tests-psp-reception",
    title: "E45 / A138 / A156 / A157 — Preuve d'exécution : corrections FDM",
    caption:
      "Sortie verbatim du spec e2e-api : PSP du réceptionneur persisté au roster, Star Player acteur d'évènement, journalier recruté sans Solitaire, état des joueurs servi par l'API.",
    cwd: "tests/e2e-api",
    command: "npx",
    args: [
      "vitest",
      "run",
      "--config",
      "vitest.config.ts",
      "specs/leagues-sheet-fdm-corrections.spec.ts",
    ],
    env: {
      TEST_SQLITE: "1",
      TEST_DATABASE_URL: "file:memdb-shots-fdm?mode=memory&cache=shared",
      API_PORT: "18121",
      JWT_SECRET: "screenshot-jwt-secret",
      MATCH_SECRET: "screenshot-match-secret",
      FEATURE_FLAGS_FORCE_ENABLED: "true",
    },
    keep: isVitestResultLine,
  },
];

export interface Scene {
  /** Nom du fichier PNG (sans extension). */
  readonly id: string;
  /** Titre affiché au-dessus de la capture. */
  readonly title: string;
  /** Sous-titre : ce que la capture démontre. */
  readonly caption: string;
  /** Largeur du viewport, en px. */
  readonly width: number;
  readonly render: () => React.ReactElement;
}

// ─────────────────────────────── FIXTURES ───────────────────────────────

const ORC_TEAM: SheetTeam = {
  teamId: "team-orc",
  name: "Gouffre Noir",
  roster: "orc",
  raceName: "Orques",
  coachName: "Grashnak",
  teamValue: 1_150_000,
  currentValue: 1_090_000,
  treasury: 120_000,
  dedicatedFans: 4,
  staff: { rerolls: 2, cheerleaders: 1, assistants: 1, apothecary: true },
  players: [
    {
      id: "p1",
      number: 1,
      name: "Ugrok",
      position: "orc_blitzer_orque",
      positionName: "Blitzer Orque",
      dead: false,
      missNextMatch: false,
      spp: 12,
    },
    {
      id: "p2",
      number: 2,
      name: "Bargh",
      position: "orc_trois_quart_orque",
      positionName: "Trois-quart Orque",
      dead: false,
      missNextMatch: false,
      spp: 4,
    },
    {
      id: "p3",
      number: 3,
      name: "Zogrim",
      position: "orc_lanceur_orque",
      positionName: "Lanceur Orque",
      dead: false,
      missNextMatch: true,
      spp: 7,
    },
    {
      id: "p4",
      number: 4,
      name: "Krunk",
      position: "orc_trois_quart_orque",
      positionName: "Trois-quart Orque",
      dead: true,
      missNextMatch: false,
      spp: 2,
    },
  ],
  journeymen: [
    {
      id: "journeyman-home-1",
      number: 12,
      name: "Journalier 1",
      position: "orc_trois_quart_orque",
      positionName: "Journalier (Trois-quart Orque)",
    },
    {
      id: "journeyman-home-2",
      number: 13,
      name: "Journalier 2",
      position: "orc_trois_quart_gobelin",
      positionName: "Journalier (Trois-quart Gobelin)",
    },
    {
      id: "journeyman-home-3",
      number: 14,
      name: "Journalier 3",
      position: "orc_trois_quart_orque",
      positionName: "Journalier (Trois-quart Orque)",
    },
  ],
  journeymenOptions: [
    { slug: "orc_trois_quart_orque", name: "Trois-quart Orque" },
    { slug: "orc_trois_quart_gobelin", name: "Trois-quart Gobelin" },
  ],
  journeymenChoice: null,
  journeymenChoices: [
    "orc_trois_quart_orque",
    "orc_trois_quart_gobelin",
    "orc_trois_quart_orque",
  ],
  starPlayersHired: [
    {
      id: "star-home-varag_ghoulchewer",
      number: 81,
      name: "Varag Croqueur-de-Goules",
      position: "star_player",
      positionName: "Star Player",
      slug: "varag_ghoulchewer",
    },
  ],
};

const ELF_TEAM: SheetTeam = {
  teamId: "team-elf",
  name: "Lames d'Émeraude",
  roster: "elven_union",
  raceName: "Union Elfique",
  coachName: "Ithilwen",
  teamValue: 1_060_000,
  currentValue: 1_060_000,
  treasury: 40_000,
  dedicatedFans: 3,
  staff: { rerolls: 3, cheerleaders: 2, assistants: 0, apothecary: true },
  players: [
    {
      id: "e1",
      number: 1,
      name: "Faeryl",
      position: "elven_union_trois_quart_elfe",
      positionName: "Trois-quart Elfe",
      dead: false,
      missNextMatch: false,
      spp: 9,
    },
    {
      id: "e2",
      number: 2,
      name: "Nalthis",
      position: "elven_union_receveur_elfe",
      positionName: "Receveur Elfe",
      dead: false,
      missNextMatch: false,
      spp: 6,
    },
  ],
};

const EMPTY_POST: PostMatchValues = {
  winningsHomeManual: null,
  winningsAwayManual: null,
  dedicatedFansDeltaHome: 0,
  dedicatedFansDeltaAway: 0,
  rankingBonusHome: null,
  rankingBonusAway: null,
  sppBonus: [],
  motmPlayerIds: [],
  costlyErrorsHome: [],
  costlyErrorsAway: [],
  purchasesHome: [
    {
      kind: "journeyman",
      name: "Journalier 2",
      cost: 60_000,
      journeymanId: "journeyman-home-2",
    },
  ],
  purchasesAway: [],
  firedPlayerIds: [],
};

/** Encadré neutre : les composants sont rendus tels quels. */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 bg-slate-100 p-4">{children}</div>;
}

/** Rangée de roster telle que « Gérer mon équipe » la rend. */
function RosterRow({
  name,
  position,
  player,
  playerId,
}: {
  name: string;
  position: string;
  player: React.ComponentProps<typeof PlayerStatusTags>["player"];
  playerId: string;
}) {
  return (
    <tr className="border-b">
      <td className="px-4 py-3 text-sm text-gray-700">{playerId}</td>
      <td className="px-4 py-3">
        <div className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
          {name}
        </div>
        <PlayerStatusTags player={player} playerId={playerId} className="mt-1" />
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-700">{position}</td>
    </tr>
  );
}

/**
 * Catalogue d'embauche d'une équipe Haut Elfe, tel que le sert
 * `reference.purchases` : quotas consommés, prix en po, relance déjà
 * DOUBLÉE (règle de l'achat après création de l'équipe).
 */
const HIGH_ELF_PURCHASES = {
  positions: [
    {
      slug: "he_trois_quart",
      name: "Trois-quart Haut Elfe",
      cost: 60_000,
      currentCount: 6,
      maxCount: 16,
      canAdd: true,
    },
    {
      slug: "he_lanceur",
      name: "Lanceur Haut Elfe",
      cost: 85_000,
      currentCount: 0,
      maxCount: 2,
      canAdd: true,
    },
    {
      slug: "he_blitzeur",
      name: "Blitzeur Haut Elfe",
      cost: 100_000,
      currentCount: 2,
      maxCount: 2,
      canAdd: false,
    },
  ],
  staff: [
    {
      kind: "reroll" as const,
      name: "Relance d'équipe",
      cost: 100_000,
      currentCount: 2,
      maxCount: 8,
      canAdd: true,
    },
    {
      kind: "assistant" as const,
      name: "Assistant",
      cost: 10_000,
      currentCount: 1,
      maxCount: 6,
      canAdd: true,
    },
    {
      kind: "cheerleader" as const,
      name: "Pom-pom girl",
      cost: 10_000,
      currentCount: 0,
      maxCount: 12,
      canAdd: true,
    },
    {
      kind: "apothecary" as const,
      name: "Apothicaire",
      cost: 50_000,
      currentCount: 0,
      maxCount: 1,
      canAdd: true,
    },
    {
      kind: "dedicated_fan" as const,
      name: "Fan dévoué",
      cost: 10_000,
      currentCount: 3,
      maxCount: 6,
      canAdd: true,
    },
  ],
};

/** Les trois Ligues du roster Nordique — l'équipe n'en a retenu qu'une. */
const NORSE_LEAGUES = [
  { slug: "norse_league", name: "Ligue Nordique" },
  { slug: "chaos_clash", name: "Clash du Chaos" },
  { slug: "old_world_classic", name: "Old World Classic" },
];

// ──────────────────────────────── SCÈNES ────────────────────────────────

export const SCENES: readonly Scene[] = [
  {
    id: "e37-journaliers-choix-par-journalier",
    title: "E37 — Poste choisi pour CHAQUE journalier",
    caption:
      "Roster Orques : chaque journalier a son propre sélecteur, entre Trois-quart Orque et Trois-quart Gobelin. Le poste effectif est présélectionné.",
    width: 720,
    render: () => (
      <Frame>
        <JourneymenPanel
          team={ORC_TEAM}
          side="home"
          editable
          onChoose={() => {}}
        />
      </Frame>
    ),
  },
  {
    id: "a156-star-player-picker-evenement",
    title: "A156 — Star Player proposé comme acteur d'évènement",
    caption:
      "Le picker d'acteur liste le roster, les journaliers alignés ET le Star Player engagé en coup de pouce (⭐).",
    width: 520,
    render: () => (
      <Frame>
        <label className="block text-xs">
          Acteur
          <PlayerSelect
            team={ORC_TEAM}
            value="star-home-varag_ghoulchewer"
            onChange={() => {}}
            testId="event-actor"
          />
        </label>
        <p className="text-[11px] text-slate-500">
          Liste déroulante ouverte ci-dessous (rendu statique des options).
        </p>
        <ul className="rounded border bg-white p-2 text-sm">
          <li className="px-1 py-0.5">N°1 Ugrok — Blitzer Orque</li>
          <li className="px-1 py-0.5">N°2 Bargh — Trois-quart Orque</li>
          <li className="px-1 py-0.5">
            N°12 Journalier 1 — Journalier (Trois-quart Orque)
          </li>
          <li className="px-1 py-0.5">
            N°13 Journalier 2 — Journalier (Trois-quart Gobelin)
          </li>
          <li className="rounded bg-amber-50 px-1 py-0.5 font-semibold">
            ⭐ Varag Croqueur-de-Goules — Star Player
          </li>
        </ul>
      </Frame>
    ),
  },
  {
    id: "a157-tags-etat-gerer-mon-equipe",
    title: "A157 — Étiquettes Mort / Absent / BP dans « Gérer mon équipe »",
    caption:
      "Le coach voit qui est réellement disponible avant de préparer son équipe.",
    width: 720,
    render: () => (
      <Frame>
        <table className="w-full rounded-lg bg-white text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">N°</th>
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Poste</th>
            </tr>
          </thead>
          <tbody>
            <RosterRow
              playerId="1"
              name="Ugrok"
              position="Blitzer Orque"
              player={{}}
            />
            <RosterRow
              playerId="3"
              name="Zogrim"
              position="Lanceur Orque"
              player={{ missNextMatch: true, nigglingInjuries: 2 }}
            />
            <RosterRow
              playerId="4"
              name="Krunk"
              position="Trois-quart Orque"
              player={{ dead: true }}
            />
            <RosterRow
              playerId="5"
              name="Grumlok"
              position="Trois-quart Orque"
              player={{ nigglingInjuries: 1, maReduction: 1, agReduction: 1 }}
            />
          </tbody>
        </table>
      </Frame>
    ),
  },
  {
    id: "e41-sequence-apres-match",
    title: "E41 — Séquence d'après-match dans l'ordre du livre",
    caption:
      "1 résultats et gains · 2 fans dévoués · 3 amélioration de joueurs · 4 embauches PUIS renvois · 5 erreurs coûteuses. A138 : le journalier du match est recrutable à l'étape 4.",
    width: 620,
    render: () => (
      <Frame>
        <PostMatchPanel
          initial={EMPTY_POST}
          home={ORC_TEAM}
          away={ELF_TEAM}
          onSave={async () => {}}
          computedSpp={{ p1: 5, p2: 1, "journeyman-home-2": 3 }}
          autoWinnings={{ home: 70_000, away: 50_000 }}
          journeymanHireCost={() => 60_000}
          onGoToAdvancements={() => {}}
        />
      </Frame>
    ),
  },
  {
    id: "e45-psp-reception-etourdissante",
    title: "E45 — Le réceptionneur gagne 1 PSP (Réception Étourdissante)",
    caption:
      "Étape 3 — Prière n°11 achetée en coup de pouce : le lanceur Ugrok marque sa Réussite (+1) ET le réceptionneur Bargh est crédité (+1). Sans la prière, Bargh n'apparaît pas dans la liste.",
    width: 560,
    render: () => (
      <Frame>
        <div className="rounded border bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Avec la Prière « Réception Étourdissante »
          </p>
          {/* Panneau réduit à l'équipe concernée et vidé des achats : ce
              qui compte ici est l'étape 3, où le réceptionneur apparaît. */}
          <PostMatchPanel
            initial={{ ...EMPTY_POST, purchasesHome: [] }}
            home={{
              ...ORC_TEAM,
              journeymen: [],
              starPlayersHired: [],
              players: ORC_TEAM.players.slice(0, 2),
            }}
            away={null}
            onSave={async () => {}}
            computedSpp={{ p1: 1, p2: 1 }}
          />
        </div>
      </Frame>
    ),
  },
  {
    id: "a158-invalidation-playoff",
    title: "A158 — Invalidation d'un match de play-off",
    caption:
      "Le commissaire dispose du contrôle d'invalidation sur un match de play-off : la reversion n'est plus refusée par « playoffs-generated ».",
    width: 560,
    render: () => (
      <Frame>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-nuffle-bronze">
            Demi-finale — feuille validée
          </h3>
          <InvalidateControl
            canInvalidate
            deadCount={1}
            firedCount={0}
            onInvalidate={async () => {}}
          />
        </div>
      </Frame>
    ),
  },
  {
    id: "e46-e47-catalogue-achats",
    title: "E46/E47 — Postes disponibles et prix automatique à l'embauche",
    caption:
      "Étape 4 : le picker liste les postes DU ROSTER avec leur quota (le Blitzeur 2/2 est proposé grisé, « complet »), et le prix se remplit au choix. La relance suit la règle BB de l'achat après création : 50 000 po à la construction, 100 000 po ici.",
    width: 720,
    render: () => (
      <Frame>
        {/* Un <select> fermé ne montre pas ses options : on rend ici les
            MÊMES libellés, via la fonction qu'utilise le composant. */}
        <div className="rounded border bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Contenu du sélecteur « poste » (catalogue Haut Elfe)
          </p>
          <ul className="space-y-0.5 text-sm">
            {HIGH_ELF_PURCHASES.positions.map((p) => (
              <li
                key={p.slug}
                className={`rounded px-1 py-0.5 ${
                  p.canAdd ? "" : "bg-slate-100 text-slate-400"
                }`}
              >
                {purchaseOptionLabel(p)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Sélecteur « type de staff »
          </p>
          <ul className="space-y-0.5 text-sm">
            {HIGH_ELF_PURCHASES.staff
              .filter((s) => s.kind !== "reroll")
              .map((s) => (
                <li key={s.kind} className="rounded px-1 py-0.5">
                  {purchaseOptionLabel(s)}
                </li>
              ))}
          </ul>
        </div>
        <PostMatchPanel
          initial={{
            ...EMPTY_POST,
            purchasesHome: [
              { kind: "player", name: "", cost: 0 },
              { kind: "reroll", name: "", cost: 100_000 },
            ],
          }}
          home={{
            ...ORC_TEAM,
            journeymen: [],
            starPlayersHired: [],
            players: ORC_TEAM.players.slice(0, 2),
          }}
          away={null}
          onSave={async () => {}}
          purchaseOptions={{ home: HIGH_ELF_PURCHASES }}
        />
      </Frame>
    ),
  },
  {
    id: "a160-trait-haine-en-francais",
    title: "A160 — Le trait Haine s'affiche en français",
    caption:
      "Les variantes de Haine sont créées à la volée à la validation d'une feuille : un catalogue déjà chargé ne les connaît pas. Le badge retombait sur le slug brut (`hate-orque`) ; il rend désormais « Haine (Orque) », accent compris.",
    width: 520,
    render: () => (
      <Frame>
        <div className="rounded-lg border bg-white p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
            Compétences
          </p>
          {/* Le composant lit la langue du contexte : sans provider, il
              lève. Le défaut du provider est le français. */}
          <LanguageProvider>
            <SkillTooltip skillsString="hate-orque,hate-homme-lezard,hate-dwarf" />
          </LanguageProvider>
        </div>
      </Frame>
    ),
  },
  {
    id: "a159-ligue-retenue-seule",
    title: "A159 — Le roster n'affiche que la Ligue retenue",
    caption:
      "Une équipe ne retient qu'UNE Ligue régionale à sa création, et elle seule débloque ses Star Players et ses Coups de Pouce. Les autres Ligues du roster, autrefois affichées barrées, ne la concernent pas.",
    width: 640,
    render: () => (
      <Frame>
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="border-b bg-gray-50 px-6 py-3">
            <h2 className="text-base font-semibold">Ligues</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-3">
              {displayedRegionalLeagues(NORSE_LEAGUES, "chaos_clash").map(
                (league) => (
                  <span
                    key={league.slug}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700"
                  >
                    {league.name}
                  </span>
                ),
              )}
            </div>
            <p className="mt-3 text-xs text-gray-600">
              Ligue régionale : <strong>Clash du Chaos</strong>
            </p>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    id: "e30-psp-elimination-action-speciale",
    title: "E30 — Ce que rapporte une Élimination sur Action Spéciale",
    caption:
      "La règle est appliquée depuis toujours côté serveur, mais rien ne la disait : le coach saisissait une sortie et ne voyait rien arriver dans les PSP estimés. Le rappel est désormais sous le sélecteur.",
    width: 520,
    render: () => (
      <Frame>
        <label className="block text-xs">
          Type d&apos;évènement
          <select
            defaultValue="special_elim"
            className="mt-1 block w-full rounded border px-2 py-2 text-sm"
          >
            <option value="special_elim">Élimination sur Action Spéciale</option>
          </select>
          <span className="mt-1 block text-[11px] font-normal text-slate-500">
            {eventKindHint("special_elim")}
          </span>
        </label>
      </Frame>
    ),
  },
];
