"use client";

import { useState } from "react";
import {
  EXPENSIVE_MISTAKE_LABELS_FR,
  EXPENSIVE_MISTAKES_THRESHOLD,
  expensiveMistakeLoss,
  expensiveMistakeOutcome,
  type ExpensiveMistakeOutcome,
  PRAYERS_TABLE,
} from "@bb/game-engine";

// Refonte mobile-first — panneaux de saisie d'une feuille de match de
// ligue physique. Sections AVANT-MATCH / FIN DU MATCH calquees sur la
// feuille de match officielle Blood Bowl. Composants presentational :
// ils gerent un etat local seede par `initial` et appellent `onSave`
// (la page parent fait l'appel API). Responsive : 1 colonne mobile ->
// 2 colonnes home/away des `sm`.

const WINNINGS_PER_POPULARITY = 10_000;

/** Formate un montant en po (1 200 000 -> "1 200 k"). */
export function formatGold(po: number): string {
  if (Math.abs(po) >= 1_000) {
    return `${Math.round(po / 1_000).toLocaleString("fr-FR")} k`;
  }
  return `${po.toLocaleString("fr-FR")} po`;
}

export interface SheetPlayer {
  id: string;
  number: number;
  name: string;
  /** Slug technique de la position (ex: "gnome_belluaire_gnome"). */
  position: string;
  /** Nom d'affichage lisible (ex: "Belluaire Gnome"). Fallback : slug. */
  positionName?: string;
  dead: boolean;
  missNextMatch: boolean;
  spp: number;
  /** Compétences actuelles (CSV de slugs) — staging des évolutions. */
  skills?: string | null;
  /** Nombre d'avancements déjà pris (coût du prochain palier). */
  advancementsTaken?: number;
  /** Caractéristiques courantes (fiche joueur du staging). */
  stats?: {
    ma: number;
    st: number;
    ag: number;
    pa: number | null;
    av: number;
  };
}

/** Nom de position lisible d'un joueur (fallback : slug technique). */
function playerPositionName(p: SheetPlayer): string {
  return p.positionName ?? p.position;
}

export interface SheetTeam {
  teamId: string;
  name: string;
  roster: string;
  /** Ruleset de l'équipe (catalogue de compétences du staging). */
  ruleset?: string;
  raceName: string;
  coachName: string;
  teamValue: number;
  currentValue: number;
  treasury: number;
  players: SheetPlayer[];
}

// ───────────────────────────── DONNÉES DE RÉFÉRENCE ──────────────────────────
// Catalogues fournis par le serveur (cf. getMatchSheet) : tables météo,
// coups de pouce officiels, star players par équipe, budgets par équipe.

export interface WeatherResult {
  roll: number;
  condition: string;
  description: string;
}
export interface WeatherTable {
  id: string;
  name: string;
  results: WeatherResult[];
}
export interface InducementOption {
  slug: string;
  name: string;
  cost: number;
  maxQuantity: number;
  description: string;
  /** A53 — prix variable (ex: Mercenaires) : coût saisi par le coach. */
  variableCost?: boolean;
}
export interface StarPlayerOption {
  slug: string;
  name: string;
  cost: number;
  specialRule?: string;
}
export interface TeamBudget {
  ctv: number;
  treasury: number;
  pettyCash: number;
  maxBudget: number;
}
export interface TeamColors {
  primary: string;
  secondary: string;
}
export interface MatchSheetReference {
  weatherTables: WeatherTable[];
  inducements: { home: InducementOption[]; away: InducementOption[] };
  starPlayers: { home: StarPlayerOption[]; away: StarPlayerOption[] };
  budget: { home: TeamBudget; away: TeamBudget };
  colors: { home: TeamColors; away: TeamColors };
}

/** Badge race + coach affiché sous le nom d'équipe (RÉSUMÉ). */
export function TeamIdentityBadges({
  team,
  align = "left",
}: {
  team: SheetTeam | null;
  align?: "left" | "right";
}) {
  if (!team) return null;
  return (
    <div
      className={`mt-1 flex flex-wrap items-center gap-1 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {team.raceName && (
        <span className="inline-flex items-center rounded-full bg-nuffle-gold/15 px-2 py-0.5 text-[11px] font-semibold text-nuffle-anthracite ring-1 ring-inset ring-nuffle-gold/40">
          {team.raceName}
        </span>
      )}
      {team.coachName && (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          <span aria-hidden>🎲</span>
          {team.coachName}
        </span>
      )}
    </div>
  );
}

/** Bandeau TV (VE/VEA) + trésorerie d'une équipe. */
export function TeamValueStrip({
  team,
  align = "left",
}: {
  team: SheetTeam | null;
  align?: "left" | "right";
}) {
  if (!team) return null;
  return (
    <div
      className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      <span title="Valeur d'Équipe Actuelle">
        TV <strong className="text-slate-700">{formatGold(team.currentValue)}</strong>
      </span>
      <span title="Trésorerie (cagnotte)">
        Cagnotte{" "}
        <strong className="text-slate-700">{formatGold(team.treasury)}</strong>
      </span>
    </div>
  );
}

function playerLabel(p: SheetPlayer): string {
  const flags = p.dead ? " ☠" : p.missNextMatch ? " (blessé)" : "";
  return `N°${p.number} ${p.name} — ${playerPositionName(p)}${flags}`;
}

/** Picker de joueur d'une equipe (dropdown). Valeur = teamPlayerId. */
export function PlayerSelect({
  team,
  value,
  onChange,
  disabled,
  allowEmpty = true,
  testId,
}: {
  team: SheetTeam | null;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  testId?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !team}
      data-testid={testId}
      className="block w-full rounded border px-2 py-2 text-sm"
    >
      {allowEmpty && <option value="">— joueur —</option>}
      {team?.players.map((p) => (
        <option key={p.id} value={p.id}>
          {playerLabel(p)}
        </option>
      ))}
    </select>
  );
}

// ────────────────────────────── AVANT-MATCH ──────────────────────────────

export interface Inducement {
  /** Slug catalogue (ex: "bribe") ou "star_player". */
  slug: string;
  /** Libellé affichable (nom FR du coup de pouce ou nom du star player). */
  name: string;
  cost: number;
  qty: number;
  /** Pour slug="star_player" : slug du star player choisi. */
  starPlayerSlug?: string;
}

/** Prière à Nuffle obtenue au D16 (coup de pouce 0-3, 10 000 po pièce). */
export interface PrayerEntry {
  roll: number;
  /** Id de la prière dans la table du moteur (dérivable du jet). */
  prayerId?: string;
}

export interface PreMatchValues {
  weatherTable: string;
  weather: string;
  forfeitSide: "home" | "away" | null;
  /** Côté ayant gagné le toss d'avant-match. */
  tossWinner: "home" | "away" | null;
  /** Choix du vainqueur : engager (donner le coup d'envoi) ou recevoir. */
  tossChoice: "kick" | "receive" | null;
  popularityHome: number | null;
  popularityAway: number | null;
  inducementsHome: Inducement[];
  inducementsAway: Inducement[];
  prayersHome: PrayerEntry[];
  prayersAway: PrayerEntry[];
}

function sumInducements(list: Inducement[]): number {
  return list.reduce(
    (acc, i) => acc + Math.max(0, i.cost) * Math.max(1, i.qty),
    0,
  );
}

/** Nombre max de Prières à Nuffle par équipe (coup de pouce 0-3). */
const MAX_PRAYERS = 3;

/**
 * FR16 — éditeur des Prières à Nuffle : enregistre les résultats du D16
 * (jets faits autour de la table, doublons relancés donc interdits ici)
 * à partir de la table du moteur (`PRAYERS_TABLE`, D16 → nom + effet).
 */
function PrayersEditor({
  list,
  onChange,
  disabled,
  testId,
}: {
  list: PrayerEntry[];
  onChange: (l: PrayerEntry[]) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const usedRolls = new Set(list.map((e) => e.roll));
  const addable = Object.entries(PRAYERS_TABLE).filter(
    ([roll]) => !usedRolls.has(Number(roll)),
  );
  return (
    <div data-testid={testId} className="text-xs">
      <div className="mb-1 font-medium text-slate-600">
        Prières à Nuffle{" "}
        <span className="font-normal text-slate-400">
          (coup de pouce 0-3, D16 par prière achetée)
        </span>
      </div>
      <div className="space-y-1.5">
        {list.map((entry, i) => {
          const prayer = PRAYERS_TABLE[entry.roll];
          return (
            <div
              key={entry.roll}
              className="flex items-start gap-1.5 rounded border border-violet-200 bg-violet-50/60 p-1.5"
              data-testid={testId ? `${testId}-entry-${entry.roll}` : undefined}
            >
              <span className="shrink-0 rounded bg-violet-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {entry.roll}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-violet-900">
                  {prayer?.nameFr ?? `Prière ${entry.roll}`}
                </span>
                {prayer ? (
                  <span className="block text-[11px] text-slate-600">
                    {prayer.descriptionFr ?? prayer.description}
                  </span>
                ) : null}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(list.filter((_, idx) => idx !== i))}
                  className="px-1 text-sm text-red-600"
                  aria-label="retirer la prière"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {!disabled && list.length < MAX_PRAYERS && (
          <select
            value=""
            onChange={(e) => {
              const roll = Number(e.target.value);
              if (!roll) return;
              onChange([
                ...list,
                { roll, prayerId: PRAYERS_TABLE[roll]?.id },
              ]);
            }}
            data-testid={testId ? `${testId}-add` : undefined}
            className="w-full rounded border px-2 py-1.5 text-xs"
          >
            <option value="">+ résultat du D16…</option>
            {addable.map(([roll, prayer]) => (
              <option key={roll} value={roll}>
                {roll} — {prayer.nameFr}
              </option>
            ))}
          </select>
        )}
        {!disabled && list.length >= MAX_PRAYERS && (
          <p className="text-[11px] text-slate-400">
            Maximum de {MAX_PRAYERS} prières atteint.
          </p>
        )}
      </div>
    </div>
  );
}

/** Trouve la table météo sélectionnée (ou undefined). */
function findWeatherTable(
  tables: WeatherTable[],
  id: string,
): WeatherTable | undefined {
  return tables.find((t) => t.id === id);
}

/**
 * Sélecteur de coups de pouce piloté par le catalogue officiel :
 * un menu déroulant (coups de pouce + star players de l'équipe) ajoute des
 * lignes au coût auto-rempli. La quantité est bornée par `maxQuantity`. Le
 * total est confronté au budget (petty cash + trésorerie).
 */
function InducementEditor({
  list,
  onChange,
  disabled,
  testId,
  catalogue,
  starPlayers,
  budget,
}: {
  list: Inducement[];
  onChange: (l: Inducement[]) => void;
  disabled?: boolean;
  testId?: string;
  catalogue: InducementOption[];
  starPlayers: StarPlayerOption[];
  budget: TeamBudget;
}) {
  const [pick, setPick] = useState("");

  const optBySlug = new Map(catalogue.map((o) => [o.slug, o]));
  const starBySlug = new Map(starPlayers.map((s) => [s.slug, s]));

  const total = sumInducements(list);
  const remaining = budget.maxBudget - total;
  const overBudget = remaining < 0;

  const update = (i: number, patch: Partial<Inducement>) =>
    onChange(list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const addPick = (value: string) => {
    if (!value) return;
    if (value.startsWith("star:")) {
      const slug = value.slice(5);
      const sp = starBySlug.get(slug);
      if (sp) {
        onChange([
          ...list,
          {
            slug: "star_player",
            starPlayerSlug: sp.slug,
            name: sp.name,
            cost: sp.cost,
            qty: 1,
          },
        ]);
      }
    } else {
      const opt = optBySlug.get(value);
      if (opt) {
        onChange([
          ...list,
          { slug: opt.slug, name: opt.name, cost: opt.cost, qty: 1 },
        ]);
      }
    }
    setPick("");
  };

  return (
    <div data-testid={testId} className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-600">Coups de pouce</div>
        <div className="text-[11px] text-slate-500">
          Budget {formatGold(budget.maxBudget)}
        </div>
      </div>

      {/* Jauge de budget. */}
      <div className="space-y-0.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full ${overBudget ? "bg-red-500" : "bg-emerald-500"}`}
            style={{
              width: `${Math.min(100, budget.maxBudget > 0 ? (total / budget.maxBudget) * 100 : total > 0 ? 100 : 0)}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>
            Petty cash {formatGold(budget.pettyCash)} + cagnotte{" "}
            {formatGold(budget.treasury)}
          </span>
          <span
            className={overBudget ? "font-semibold text-red-600" : ""}
            data-testid={`${testId}-remaining`}
          >
            {overBudget
              ? `Dépassé de ${formatGold(-remaining)}`
              : `Reste ${formatGold(remaining)}`}
          </span>
        </div>
      </div>

      {list.length === 0 && (
        <p className="text-xs text-slate-400">Aucun coup de pouce.</p>
      )}
      {list.map((it, i) => {
        const opt = optBySlug.get(it.slug);
        const maxQty = it.slug === "star_player" ? 1 : (opt?.maxQuantity ?? 1);
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-1.5 rounded border bg-white px-2 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm" title={opt?.description}>
              {it.name}
              {it.slug === "star_player" && (
                <span className="ml-1 text-[10px] font-semibold text-nuffle-gold">
                  ★
                </span>
              )}
            </span>
            {maxQty > 1 ? (
              <input
                type="number"
                min={1}
                max={maxQty}
                value={it.qty}
                onChange={(e) =>
                  update(i, {
                    qty: Math.max(
                      1,
                      Math.min(maxQty, Number(e.target.value) || 1),
                    ),
                  })
                }
                disabled={disabled}
                title={`Quantité (max ${maxQty})`}
                className="w-14 rounded border px-2 py-1 text-sm"
              />
            ) : (
              <span className="w-8 text-center text-xs text-slate-400">×1</span>
            )}
            {/* A53 — prix variable (Mercenaires) : coût unitaire saisi. */}
            {opt?.variableCost ? (
              <input
                type="number"
                min={0}
                step={5000}
                value={it.cost}
                onChange={(e) =>
                  update(i, { cost: Math.max(0, Number(e.target.value) || 0) })
                }
                disabled={disabled}
                title="Coût unitaire (po) — prix variable"
                data-testid={`${testId}-cost-${i}`}
                className="w-24 rounded border px-2 py-1 text-sm tabular-nums"
              />
            ) : null}
            <span className="w-20 text-right text-xs tabular-nums text-slate-600">
              {formatGold(it.cost * it.qty)}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(list.filter((_, idx) => idx !== i))}
                className="px-1.5 text-sm text-red-600"
                aria-label="retirer"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {!disabled && (
        <select
          value={pick}
          onChange={(e) => addPick(e.target.value)}
          data-testid={`${testId}-add`}
          className="block w-full rounded border border-dashed px-2 py-1.5 text-sm text-slate-600"
        >
          <option value="">+ Ajouter un coup de pouce…</option>
          <optgroup label="Coups de pouce">
            {catalogue.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name} — {formatGold(o.cost)}
              </option>
            ))}
          </optgroup>
          {starPlayers.length > 0 && (
            <optgroup label="Joueurs Star">
              {starPlayers.map((s) => (
                <option key={s.slug} value={`star:${s.slug}`}>
                  ★ {s.name} — {formatGold(s.cost)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      )}
    </div>
  );
}

export function PreMatchPanel({
  initial,
  homeName,
  awayName,
  disabled,
  onSave,
  reference,
}: {
  initial: PreMatchValues;
  homeName: string;
  awayName: string;
  disabled?: boolean;
  onSave: (v: PreMatchValues) => Promise<void>;
  reference: MatchSheetReference;
}) {
  const [weatherTable, setWeatherTable] = useState(initial.weatherTable);
  const [weather, setWeather] = useState(initial.weather);
  const [forfeitSide, setForfeitSide] = useState<"home" | "away" | "">(
    initial.forfeitSide ?? "",
  );
  const [tossWinner, setTossWinner] = useState<"home" | "away" | "">(
    initial.tossWinner ?? "",
  );
  const [tossChoice, setTossChoice] = useState<"kick" | "receive" | "">(
    initial.tossChoice ?? "",
  );
  const [popH, setPopH] = useState<string>(
    initial.popularityHome?.toString() ?? "",
  );
  const [popA, setPopA] = useState<string>(
    initial.popularityAway?.toString() ?? "",
  );
  const [indH, setIndH] = useState<Inducement[]>(initial.inducementsHome);
  const [indA, setIndA] = useState<Inducement[]>(initial.inducementsAway);
  const [prH, setPrH] = useState<PrayerEntry[]>(initial.prayersHome);
  const [prA, setPrA] = useState<PrayerEntry[]>(initial.prayersAway);
  const [busy, setBusy] = useState(false);

  // A63 — formule officielle : chaque équipe reçoit la moyenne des deux
  // facteurs de popularité × 10k ; les +10k/TD s'ajoutent en cours de
  // match (gains auto recalculés côté serveur).
  const sharedWinnings = Math.floor(
    (((Number(popH) || 0) + (Number(popA) || 0)) * WINNINGS_PER_POPULARITY) /
      2,
  );
  const winningsH = sharedWinnings;
  const winningsA = sharedWinnings;

  const tables = reference.weatherTables;
  const selectedTable = findWeatherTable(tables, weatherTable);
  // La météo dépend de la table : on liste les conditions de la table choisie.
  const weatherResults = selectedTable?.results ?? [];
  const selectedWeather = weatherResults.find((r) => r.condition === weather);

  // A55 — le budget de l'underdog (pettyCash > 0) augmente de la dépense
  // adverse (règle officielle : la CTV de la plus forte inclut ses achats).
  const spentH = sumInducements(indH);
  const spentA = sumInducements(indA);
  const effectiveMaxHome =
    reference.budget.home.maxBudget +
    (reference.budget.home.pettyCash > 0 ? spentA : 0);
  const effectiveMaxAway =
    reference.budget.away.maxBudget +
    (reference.budget.away.pettyCash > 0 ? spentH : 0);
  const overHome = spentH > effectiveMaxHome;
  const overAway = spentA > effectiveMaxAway;
  const overBudget = overHome || overAway;

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        weatherTable,
        weather,
        forfeitSide: forfeitSide === "" ? null : forfeitSide,
        tossWinner: tossWinner === "" ? null : tossWinner,
        tossChoice:
          tossWinner === "" || tossChoice === "" ? null : tossChoice,
        popularityHome: popH === "" ? null : Number(popH),
        popularityAway: popA === "" ? null : Number(popA),
        inducementsHome: indH,
        inducementsAway: indA,
        prayersHome: prH,
        prayersAway: prA,
      });
    } finally {
      setBusy(false);
    }
  };

  const sides = [
    {
      side: "home" as const,
      name: homeName,
      pop: popH,
      setPop: setPopH,
      winnings: winningsH,
      ind: indH,
      setInd: setIndH,
      prayers: prH,
      setPrayers: setPrH,
      catalogue: reference.inducements.home,
      stars: reference.starPlayers.home,
      budget: { ...reference.budget.home, maxBudget: effectiveMaxHome },
    },
    {
      side: "away" as const,
      name: awayName,
      pop: popA,
      setPop: setPopA,
      winnings: winningsA,
      ind: indA,
      setInd: setIndA,
      prayers: prA,
      setPrayers: setPrA,
      catalogue: reference.inducements.away,
      stars: reference.starPlayers.away,
      budget: { ...reference.budget.away, maxBudget: effectiveMaxAway },
    },
  ];

  return (
    <section
      data-testid="pre-match-panel"
      className="rounded-lg border bg-white p-4"
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-nuffle-bronze">
        Avant-match
      </h2>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          Table météo
          <select
            value={weatherTable}
            onChange={(e) => {
              setWeatherTable(e.target.value);
              setWeather(""); // la météo dépend de la table -> on réinitialise
            }}
            disabled={disabled}
            data-testid="weather-table-select"
            className="mt-1 block w-full rounded border px-2 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {/* Valeur héritée hors catalogue (ancienne saisie). */}
            {weatherTable && !selectedTable && (
              <option value={weatherTable}>{weatherTable}</option>
            )}
          </select>
        </label>
        <label className="block text-xs">
          Météo (2D6)
          <select
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            disabled={disabled || weatherResults.length === 0}
            data-testid="weather-select"
            className="mt-1 block w-full rounded border px-2 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">
              {weatherResults.length === 0 ? "— Table d'abord —" : "—"}
            </option>
            {weatherResults.map((r) => (
              <option key={r.roll} value={r.condition}>
                {r.roll} — {r.condition}
              </option>
            ))}
            {weather && !selectedWeather && (
              <option value={weather}>{weather}</option>
            )}
          </select>
        </label>
      </div>

      {/* Toss d'avant-match : vainqueur + choix (engager ou recevoir). */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          Toss gagné par
          <select
            value={tossWinner}
            onChange={(e) => {
              const v = e.target.value as "home" | "away" | "";
              setTossWinner(v);
              // Le choix appartient au vainqueur : sans vainqueur, pas de choix.
              if (v === "") setTossChoice("");
            }}
            disabled={disabled}
            data-testid="toss-winner-select"
            className="mt-1 block w-full rounded border px-2 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="home">{homeName}</option>
            <option value="away">{awayName}</option>
          </select>
        </label>
        <label className="block text-xs">
          Choix du vainqueur
          <select
            value={tossChoice}
            onChange={(e) =>
              setTossChoice(e.target.value as "kick" | "receive" | "")
            }
            disabled={disabled || tossWinner === ""}
            data-testid="toss-choice-select"
            className="mt-1 block w-full rounded border px-2 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">
              {tossWinner === "" ? "— Vainqueur d'abord —" : "—"}
            </option>
            <option value="kick">Donne le coup d&apos;envoi (engage)</option>
            <option value="receive">Reçoit le coup d&apos;envoi</option>
          </select>
        </label>
      </div>

      {/* Équipe qui engage, déduite du toss (informatif). */}
      {tossWinner !== "" && tossChoice !== "" && (
        <div
          data-testid="toss-kicking-team"
          className="mb-3 rounded border-l-4 border-nuffle-gold bg-nuffle-gold/5 px-3 py-2 text-xs text-slate-700"
        >
          <span className="font-semibold text-nuffle-anthracite">
            {(tossChoice === "kick") === (tossWinner === "home")
              ? homeName
              : awayName}
          </span>{" "}
          donne le coup d&apos;envoi.
        </div>
      )}

      {/* Conséquences (informatives) de la météo sélectionnée. */}
      {selectedWeather && (
        <div
          data-testid="weather-consequence"
          className="mb-3 rounded border-l-4 border-nuffle-gold bg-nuffle-gold/5 px-3 py-2 text-xs text-slate-700"
        >
          <span className="font-semibold text-nuffle-anthracite">
            {selectedWeather.condition}
          </span>{" "}
          — {selectedWeather.description}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sides.map((c) => (
          <div
            key={c.side}
            className="space-y-3 rounded border bg-slate-50/60 p-3"
          >
            <div className="text-sm font-semibold text-nuffle-anthracite">
              {c.name}
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-red-700">
              <input
                type="checkbox"
                checked={forfeitSide === c.side}
                onChange={(e) =>
                  setForfeitSide(e.target.checked ? c.side : "")
                }
                disabled={disabled}
                data-testid={`forfeit-${c.side}`}
                className="h-4 w-4 rounded border-slate-300"
              />
              Déclarer forfait
            </label>
            <label className="block text-xs">
              Facteur de popularité (1D3 + 5)
              <input
                type="number"
                min={0}
                max={20}
                value={c.pop}
                onChange={(e) => c.setPop(e.target.value)}
                disabled={disabled}
                data-testid={`popularity-${c.side}`}
                className="mt-1 block w-24 rounded border px-2 py-2 text-sm"
              />
              <span className="mt-0.5 block text-[11px] text-slate-500">
                Gains auto : {c.winnings.toLocaleString("fr-FR")} po (+10 000
                po par TD marqué)
              </span>
            </label>
            <InducementEditor
              list={c.ind}
              onChange={c.setInd}
              disabled={disabled}
              testId={`inducements-${c.side}`}
              catalogue={c.catalogue}
              starPlayers={c.stars}
              budget={c.budget}
            />
            <PrayersEditor
              list={c.prayers}
              onChange={c.setPrayers}
              disabled={disabled}
              testId={`prayers-${c.side}`}
            />
          </div>
        ))}
      </div>

      {!disabled && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy || overBudget}
            data-testid="save-pre-match"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Enregistrer l&apos;avant-match
          </button>
          {overBudget && (
            <span className="text-xs font-medium text-red-600">
              Budget de coups de pouce dépassé.
            </span>
          )}
        </div>
      )}
    </section>
  );
}

// ────────────────────────────── FIN DU MATCH ──────────────────────────────

export interface CostlyError {
  cost: number;
  reason?: string;
}
export type StaffKind =
  | "assistant"
  | "cheerleader"
  | "apothecary"
  | "dedicated_fan";

export interface Purchase {
  kind: "player" | "reroll" | "staff" | "other";
  name: string;
  cost: number;
  /** Pour `kind:'player'` : slug de position (sinon resolu par cout serveur). */
  position?: string;
  /** Pour `kind:'staff'` : sous-type de staff materialise. */
  staff?: StaffKind;
}

const STAFF_KINDS: ReadonlyArray<{ value: StaffKind; label: string }> = [
  { value: "assistant", label: "Assistant" },
  { value: "cheerleader", label: "Pom-pom girl" },
  { value: "apothecary", label: "Apothicaire" },
  { value: "dedicated_fan", label: "Fan dévoué" },
];

export interface SppBonusEntry {
  playerId: string;
  spp: number;
}

export interface PostMatchValues {
  winningsHomeManual: number | null;
  winningsAwayManual: number | null;
  dedicatedFansDeltaHome: number;
  dedicatedFansDeltaAway: number;
  rankingBonusHome: number | null;
  rankingBonusAway: number | null;
  sppBonus: SppBonusEntry[];
  motmPlayerIds: string[];
  costlyErrorsHome: CostlyError[];
  costlyErrorsAway: CostlyError[];
  purchasesHome: Purchase[];
  purchasesAway: Purchase[];
  /** Licenciements de fin de match : [teamPlayerId] (des 2 equipes). */
  firedPlayerIds: string[];
}

/** Editeur de licenciements d'une equipe : liste de pickers joueur. */
function FiredEditor({
  team,
  ids,
  onChange,
  disabled,
  testId,
}: {
  team: SheetTeam | null;
  ids: string[];
  onChange: (l: string[]) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const update = (i: number, v: string) =>
    onChange(ids.map((it, idx) => (idx === i ? v : it)));
  return (
    <div data-testid={testId} className="space-y-1.5">
      {ids.map((id, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <PlayerSelect
              team={team}
              value={id}
              onChange={(v) => update(i, v)}
              disabled={disabled}
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(ids.filter((_, idx) => idx !== i))}
              className="px-1.5 text-sm text-red-600"
              aria-label="retirer"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...ids, ""])}
          className="text-xs font-medium text-blue-600"
        >
          + licenciement
        </button>
      )}
    </div>
  );
}

/** Editeur de SPP bonus "Nuffle" pour une equipe (picker joueur + spp). */
function SppBonusEditor({
  team,
  entries,
  onChange,
  disabled,
  testId,
}: {
  team: SheetTeam | null;
  entries: SppBonusEntry[];
  onChange: (l: SppBonusEntry[]) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const update = (i: number, patch: Partial<SppBonusEntry>) =>
    onChange(entries.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <div data-testid={testId} className="space-y-1.5">
      {entries.map((it, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <PlayerSelect
              team={team}
              value={it.playerId}
              onChange={(id) => update(i, { playerId: id })}
              disabled={disabled}
            />
          </div>
          <input
            type="number"
            min={0}
            value={it.spp}
            onChange={(e) => update(i, { spp: Number(e.target.value) || 0 })}
            disabled={disabled}
            placeholder="SPP"
            className="w-16 rounded border px-2 py-1 text-sm"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
              className="px-1.5 text-sm text-red-600"
              aria-label="retirer"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...entries, { playerId: "", spp: 0 }])}
          className="text-xs font-medium text-blue-600"
        >
          + SPP bonus
        </button>
      )}
    </div>
  );
}

const PURCHASE_KINDS: ReadonlyArray<{
  value: Purchase["kind"];
  label: string;
}> = [
  { value: "player", label: "Joueur" },
  { value: "reroll", label: "Relance" },
  { value: "staff", label: "Staff" },
  { value: "other", label: "Dépense diverse" },
];

/**
 * Le champ « Nom » n'a un sens que pour un joueur recruté (son nom) ou une
 * dépense diverse (son libellé). Pour une relance il est ignoré par le
 * serveur, et pour le staff le sous-type vient déjà du select « type… ».
 */
function purchaseHasNameField(kind: Purchase["kind"]): boolean {
  return kind === "player" || kind === "other";
}

/** Placeholder du champ « Nom » selon le type d'achat. */
function purchaseNamePlaceholder(kind: Purchase["kind"]): string {
  return kind === "other" ? "Libellé (ex: ajustement)" : "Nom du joueur";
}

function CostlyErrorEditor({
  list,
  onChange,
  disabled,
  testId,
}: {
  list: CostlyError[];
  onChange: (l: CostlyError[]) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const update = (i: number, patch: Partial<CostlyError>) =>
    onChange(list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <div data-testid={testId} className="space-y-1.5">
      {list.map((it, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <input
            value={it.reason ?? ""}
            onChange={(e) => update(i, { reason: e.target.value })}
            disabled={disabled}
            placeholder="Raison (ex: Crise évitée)"
            className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
          />
          <input
            type="number"
            min={0}
            value={it.cost}
            onChange={(e) => update(i, { cost: Number(e.target.value) || 0 })}
            disabled={disabled}
            placeholder="po perdus"
            className="w-24 rounded border px-2 py-1 text-sm"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(list.filter((_, idx) => idx !== i))}
              className="px-1.5 text-sm text-red-600"
              aria-label="retirer"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...list, { cost: 0, reason: "" }])}
          className="text-xs font-medium text-blue-600"
        >
          + erreur coûteuse
        </button>
      )}
    </div>
  );
}

/**
 * FR16 — assistant « Erreurs Coûteuses » : à partir de la trésorerie
 * estimée à cette étape de la séquence d'après-match (trésorerie +
 * gains − achats), propose le résultat du tableau officiel pour le jet
 * de D6 fait autour de la table, calcule la perte (D3/2D6 saisis si le
 * résultat l'exige) et pré-remplit une ligne d'erreur coûteuse.
 */
function ExpensiveMistakeHelper({
  treasuryAtStep,
  onAdd,
  disabled,
  testId,
}: {
  treasuryAtStep: number;
  onAdd: (entry: CostlyError) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const [d6, setD6] = useState<string>("");
  const [d3, setD3] = useState<string>("");
  const [twoD6, setTwoD6] = useState<string>("");

  if (disabled) return null;
  if (treasuryAtStep < EXPENSIVE_MISTAKES_THRESHOLD) {
    return (
      <p className="text-[11px] text-slate-500" data-testid={testId}>
        Trésorerie estimée à cette étape :{" "}
        {treasuryAtStep.toLocaleString("fr-FR")} po — sous 100 000 po, pas
        de jet d&apos;Erreurs Coûteuses.
      </p>
    );
  }

  const outcome: ExpensiveMistakeOutcome | null =
    d6 === "" ? null : expensiveMistakeOutcome(treasuryAtStep, Number(d6));
  const needsD3 = outcome === "minor_incident";
  const needsTwoD6 = outcome === "catastrophe";
  let loss: number | null = null;
  if (outcome) {
    try {
      loss = expensiveMistakeLoss(treasuryAtStep, outcome, {
        d3: d3 === "" ? undefined : Number(d3),
        twoD6: twoD6 === "" ? undefined : Number(twoD6),
      });
    } catch {
      loss = null; // dé complémentaire pas encore saisi
    }
  }

  return (
    <div
      data-testid={testId}
      className="space-y-1.5 rounded border border-amber-200 bg-amber-50/60 p-2"
    >
      <p className="text-[11px] text-amber-800">
        Trésorerie estimée à cette étape :{" "}
        <strong>{treasuryAtStep.toLocaleString("fr-FR")} po</strong> — jet
        d&apos;Erreurs Coûteuses requis (≥ 100 000 po).
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <label>
          D6
          <select
            value={d6}
            onChange={(e) => setD6(e.target.value)}
            data-testid={testId ? `${testId}-d6` : undefined}
            className="ml-1 rounded border px-1.5 py-1"
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {outcome ? (
          <span
            className="font-medium text-amber-900"
            data-testid={testId ? `${testId}-outcome` : undefined}
          >
            → {EXPENSIVE_MISTAKE_LABELS_FR[outcome]}
          </span>
        ) : null}
        {needsD3 ? (
          <label>
            D3
            <select
              value={d3}
              onChange={(e) => setD3(e.target.value)}
              data-testid={testId ? `${testId}-d3` : undefined}
              className="ml-1 rounded border px-1.5 py-1"
            >
              <option value="">—</option>
              {[1, 2, 3].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {needsTwoD6 ? (
          <label>
            2D6
            <input
              type="number"
              min={2}
              max={12}
              value={twoD6}
              onChange={(e) => setTwoD6(e.target.value)}
              data-testid={testId ? `${testId}-2d6` : undefined}
              className="ml-1 w-14 rounded border px-1.5 py-1"
            />
          </label>
        ) : null}
      </div>
      {outcome && loss !== null ? (
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] text-amber-900"
            data-testid={testId ? `${testId}-loss` : undefined}
          >
            Perte : {loss.toLocaleString("fr-FR")} po
          </span>
          <button
            type="button"
            onClick={() => {
              onAdd({
                cost: loss ?? 0,
                reason: EXPENSIVE_MISTAKE_LABELS_FR[outcome],
              });
              setD6("");
              setD3("");
              setTwoD6("");
            }}
            data-testid={testId ? `${testId}-add` : undefined}
            className="rounded bg-amber-600 px-2 py-1 text-[11px] font-medium text-white"
          >
            Ajouter la perte
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Positions distinctes deja fieldees par l'equipe (suggestions d'achat
 * joueur), avec leur nom d'affichage lisible. `slug` = valeur technique
 * envoyee au serveur ; `name` = libelle montre au coach.
 */
function teamPositions(
  team: SheetTeam | null,
): ReadonlyArray<{ slug: string; name: string }> {
  if (!team) return [];
  const bySlug = new Map<string, string>();
  for (const p of team.players) {
    if (!bySlug.has(p.position)) bySlug.set(p.position, playerPositionName(p));
  }
  return Array.from(bySlug, ([slug, name]) => ({ slug, name })).sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );
}

function PurchaseEditor({
  list,
  onChange,
  disabled,
  testId,
  team,
}: {
  list: Purchase[];
  onChange: (l: Purchase[]) => void;
  disabled?: boolean;
  testId?: string;
  team: SheetTeam | null;
}) {
  const update = (i: number, patch: Partial<Purchase>) =>
    onChange(list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const positions = teamPositions(team);
  return (
    <div data-testid={testId} className="space-y-1.5">
      {list.map((it, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <select
            value={it.kind}
            onChange={(e) =>
              update(i, { kind: e.target.value as Purchase["kind"] })
            }
            disabled={disabled}
            className="rounded border px-1.5 py-1 text-sm"
          >
            {PURCHASE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          {/* Joueur : poste a recruter (sinon le serveur resout par cout). */}
          {it.kind === "player" && (
            <select
              value={it.position ?? ""}
              onChange={(e) =>
                update(i, { position: e.target.value || undefined })
              }
              disabled={disabled}
              aria-label="poste"
              className="rounded border px-1.5 py-1 text-sm"
            >
              <option value="">poste (auto)</option>
              {positions.map((pos) => (
                <option key={pos.slug} value={pos.slug}>
                  {pos.name}
                </option>
              ))}
            </select>
          )}
          {/* Staff : sous-type materialise. */}
          {it.kind === "staff" && (
            <select
              value={it.staff ?? ""}
              onChange={(e) =>
                update(i, {
                  staff: (e.target.value || undefined) as
                    | StaffKind
                    | undefined,
                })
              }
              disabled={disabled}
              aria-label="type de staff"
              className="rounded border px-1.5 py-1 text-sm"
            >
              <option value="">type…</option>
              {STAFF_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          )}
          {purchaseHasNameField(it.kind) ? (
            <input
              value={it.name}
              onChange={(e) => update(i, { name: e.target.value })}
              disabled={disabled}
              placeholder={purchaseNamePlaceholder(it.kind)}
              className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
            />
          ) : (
            <span className="flex-1" />
          )}
          <input
            type="number"
            min={0}
            value={it.cost}
            onChange={(e) => update(i, { cost: Number(e.target.value) || 0 })}
            disabled={disabled}
            placeholder="Coût (po)"
            className="w-24 rounded border px-2 py-1 text-sm"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(list.filter((_, idx) => idx !== i))}
              className="px-1.5 text-sm text-red-600"
              aria-label="retirer"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() =>
            onChange([...list, { kind: "player", name: "", cost: 0 }])
          }
          className="text-xs font-medium text-blue-600"
        >
          + achat
        </button>
      )}
    </div>
  );
}

export function PostMatchPanel({
  initial,
  home,
  away,
  disabled,
  onSave,
  computedSpp = {},
  autoWinnings,
}: {
  initial: PostMatchValues;
  home: SheetTeam | null;
  away: SheetTeam | null;
  disabled?: boolean;
  onSave: (v: PostMatchValues) => Promise<void>;
  /** SPP autoritaire par teamPlayerId (calcul officiel serveur). */
  computedSpp?: Record<string, number>;
  /** Gains auto-calculés (depuis la popularité) par côté, en po. */
  autoWinnings?: { home: number; away: number };
}) {
  const [winH, setWinH] = useState<string>(
    initial.winningsHomeManual?.toString() ?? "",
  );
  const [winA, setWinA] = useState<string>(
    initial.winningsAwayManual?.toString() ?? "",
  );
  const [fansH, setFansH] = useState(initial.dedicatedFansDeltaHome);
  const [fansA, setFansA] = useState(initial.dedicatedFansDeltaAway);
  const [motm, setMotm] = useState<string[]>(initial.motmPlayerIds);
  const [ceH, setCeH] = useState<CostlyError[]>(initial.costlyErrorsHome);
  const [ceA, setCeA] = useState<CostlyError[]>(initial.costlyErrorsAway);
  const [buyH, setBuyH] = useState<Purchase[]>(initial.purchasesHome);
  const [buyA, setBuyA] = useState<Purchase[]>(initial.purchasesAway);
  // Licenciements : un sous-etat par equipe (filtre par appartenance), fusionne
  // au save (API = liste plate des teamPlayerId).
  const [firedH, setFiredH] = useState<string[]>(
    initial.firedPlayerIds.filter((id) =>
      home?.players.some((p) => p.id === id),
    ),
  );
  const [firedA, setFiredA] = useState<string[]>(
    initial.firedPlayerIds.filter((id) =>
      away?.players.some((p) => p.id === id),
    ),
  );
  const [rbH, setRbH] = useState<string>(
    initial.rankingBonusHome?.toString() ?? "",
  );
  const [rbA, setRbA] = useState<string>(
    initial.rankingBonusAway?.toString() ?? "",
  );
  // SPP bonus : un sous-etat par equipe, fusionne au save (API = liste plate).
  const [sppH, setSppH] = useState<SppBonusEntry[]>(
    initial.sppBonus.filter((b) =>
      home?.players.some((p) => p.id === b.playerId),
    ),
  );
  const [sppA, setSppA] = useState<SppBonusEntry[]>(
    initial.sppBonus.filter((b) =>
      away?.players.some((p) => p.id === b.playerId),
    ),
  );
  const [busy, setBusy] = useState(false);

  // MVP : 1 joueur par equipe (les ids des 2 cotes coexistent dans motm).
  const motmHome = home?.players.find((p) => motm.includes(p.id))?.id ?? "";
  const motmAway = away?.players.find((p) => motm.includes(p.id))?.id ?? "";
  const setMotmSide = (side: "home" | "away", id: string) => {
    const otherSide = side === "home" ? away : home;
    const keepOther = motm.filter((m) =>
      otherSide?.players.some((p) => p.id === m),
    );
    setMotm(id ? [...keepOther, id] : keepOther);
  };

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        winningsHomeManual: winH === "" ? null : Number(winH),
        winningsAwayManual: winA === "" ? null : Number(winA),
        dedicatedFansDeltaHome: fansH,
        dedicatedFansDeltaAway: fansA,
        rankingBonusHome: rbH === "" ? null : Number(rbH),
        rankingBonusAway: rbA === "" ? null : Number(rbA),
        sppBonus: [...sppH, ...sppA].filter((b) => b.playerId && b.spp),
        motmPlayerIds: motm,
        costlyErrorsHome: ceH,
        costlyErrorsAway: ceA,
        purchasesHome: buyH,
        purchasesAway: buyA,
        firedPlayerIds: [...firedH, ...firedA].filter((id) => id),
      });
    } finally {
      setBusy(false);
    }
  };

  const sides = [
    {
      side: "home" as const,
      team: home,
      name: home?.name ?? "Domicile",
      win: winH,
      setWin: setWinH,
      fans: fansH,
      setFans: setFansH,
      motmVal: motmHome,
      ce: ceH,
      setCe: setCeH,
      buy: buyH,
      setBuy: setBuyH,
      rb: rbH,
      setRb: setRbH,
      spp: sppH,
      setSpp: setSppH,
      fired: firedH,
      setFired: setFiredH,
    },
    {
      side: "away" as const,
      team: away,
      name: away?.name ?? "Extérieur",
      win: winA,
      setWin: setWinA,
      fans: fansA,
      setFans: setFansA,
      motmVal: motmAway,
      ce: ceA,
      setCe: setCeA,
      buy: buyA,
      setBuy: setBuyA,
      rb: rbA,
      setRb: setRbA,
      spp: sppA,
      setSpp: setSppA,
      fired: firedA,
      setFired: setFiredA,
    },
  ];

  return (
    <section
      data-testid="post-match-panel"
      className="rounded-lg border bg-white p-4"
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-nuffle-bronze">
        Fin du match
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sides.map((c) => (
          <div
            key={c.side}
            className="space-y-3 rounded border bg-slate-50/60 p-3"
          >
            <div className="text-sm font-semibold text-nuffle-anthracite">
              {c.name}
            </div>

            <label className="block text-xs">
              Joueur du match
              <PlayerSelect
                team={c.team}
                value={c.motmVal}
                onChange={(id) => setMotmSide(c.side, id)}
                disabled={disabled}
                testId={`motm-${c.side}`}
              />
            </label>

            <label className="block text-xs">
              Gains (override, sinon auto)
              <input
                type="number"
                min={0}
                value={c.win}
                onChange={(e) => c.setWin(e.target.value)}
                disabled={disabled}
                placeholder="auto"
                data-testid={`winnings-${c.side}`}
                className="mt-1 block w-full rounded border px-2 py-2 text-sm"
              />
              {autoWinnings ? (
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Gains auto :{" "}
                  {(c.side === "home"
                    ? autoWinnings.home
                    : autoWinnings.away
                  ).toLocaleString("fr-FR")}{" "}
                  po
                </span>
              ) : null}
            </label>

            <label className="block text-xs">
              Fans dévoués
              <select
                value={c.fans}
                onChange={(e) => c.setFans(Number(e.target.value))}
                disabled={disabled}
                data-testid={`fans-${c.side}`}
                className="mt-1 block w-full rounded border px-2 py-2 text-sm"
              >
                <option value={-1}>-1</option>
                <option value={0}>0</option>
                <option value={1}>+1</option>
              </select>
            </label>

            <label className="block text-xs">
              Bonus au classement (points)
              <input
                type="number"
                value={c.rb}
                onChange={(e) => c.setRb(e.target.value)}
                disabled={disabled}
                placeholder="0"
                data-testid={`ranking-bonus-${c.side}`}
                className="mt-1 block w-full rounded border px-2 py-2 text-sm"
              />
            </label>

            {/* SPP estimés (auto, depuis les évènements + MVP). Read-only :
                le calcul officiel est appliqué à la validation. */}
            {(() => {
              const players = (c.team?.players ?? []).filter(
                (p) => (computedSpp[p.id] ?? 0) > 0,
              );
              if (players.length === 0) return null;
              const total = players.reduce(
                (acc, p) => acc + (computedSpp[p.id] ?? 0),
                0,
              );
              return (
                <div
                  className="rounded border border-emerald-200 bg-emerald-50/60 p-2 text-xs"
                  data-testid={`auto-spp-${c.side}`}
                >
                  <div className="mb-1 font-medium text-emerald-800">
                    SPP estimés (auto) · +{total}
                  </div>
                  <ul className="space-y-0.5 text-emerald-900/80">
                    {players.map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span className="truncate">
                          N°{p.number} {p.name}
                        </span>
                        <span className="tabular-nums">
                          +{computedSpp[p.id]}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[10px] text-emerald-700/70">
                    Appliqué au roster à la validation du commissaire.
                  </p>
                </div>
              );
            })()}

            <div className="text-xs">
              <div className="mb-1 font-medium text-slate-600">
                SPP bonus (Nuffle)
              </div>
              <SppBonusEditor
                team={c.team}
                entries={c.spp}
                onChange={c.setSpp}
                disabled={disabled}
                testId={`spp-bonus-${c.side}`}
              />
            </div>

            <div className="text-xs">
              <div className="mb-1 font-medium text-slate-600">Achats</div>
              <PurchaseEditor
                list={c.buy}
                onChange={c.setBuy}
                disabled={disabled}
                testId={`purchases-${c.side}`}
                team={c.team}
              />
              <p className="mt-1 text-[10px] text-slate-500">
                « Dépense diverse » débite seulement la trésorerie (aucun
                joueur/relance/staff créé).
              </p>
            </div>

            <div className="text-xs">
              <div className="mb-1 font-medium text-slate-600">
                Erreurs coûteuses
              </div>
              <ExpensiveMistakeHelper
                treasuryAtStep={
                  (c.team?.treasury ?? 0) +
                  (c.win !== ""
                    ? Number(c.win) || 0
                    : ((c.side === "home"
                        ? autoWinnings?.home
                        : autoWinnings?.away) ?? 0)) -
                  c.buy.reduce((sum, p) => sum + (p.cost || 0), 0)
                }
                onAdd={(entry) => c.setCe([...c.ce, entry])}
                disabled={disabled}
                testId={`expensive-mistake-${c.side}`}
              />
              <CostlyErrorEditor
                list={c.ce}
                onChange={c.setCe}
                disabled={disabled}
                testId={`costly-${c.side}`}
              />
            </div>

            <div className="text-xs">
              <div className="mb-1 font-medium text-slate-600">
                Licenciements
              </div>
              <FiredEditor
                team={c.team}
                ids={c.fired}
                onChange={c.setFired}
                disabled={disabled}
                testId={`fired-${c.side}`}
              />
            </div>
          </div>
        ))}
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          data-testid="save-post-match"
          className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Enregistrer la fin de match
        </button>
      )}
    </section>
  );
}

// ────────────────────────────── INVALIDATION ──────────────────────────────

export function InvalidateControl({
  canInvalidate,
  reasonClosed,
  deadCount = 0,
  onInvalidate,
}: {
  canInvalidate: boolean;
  reasonClosed?: string;
  /** Nb de joueurs tués dans ce match : l'invalidation les ressuscitera. */
  deadCount?: number;
  onInvalidate: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canInvalidate) {
    return (
      <p className="text-xs text-slate-500" data-testid="invalidate-closed">
        Invalidation impossible
        {reasonClosed === "both_teams_played_later"
          ? " : les 2 equipes ont deja rejoue."
          : "."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="invalidate-control">
      {deadCount > 0 && (
        <p
          className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900"
          data-testid="invalidate-dead-warning"
        >
          ⚠️ {deadCount} joueur{deadCount > 1 ? "s" : ""} tué
          {deadCount > 1 ? "s" : ""} dans ce match{" "}
          {deadCount > 1 ? "seront ressuscités" : "sera ressuscité"} (statut «
          mort » annulé) si vous invalidez la feuille.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif (optionnel)"
          className="rounded border px-2 py-1 text-sm"
        />
        <button
          type="button"
          className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            if (
              deadCount > 0 &&
              !window.confirm(
                `Invalider ce match ressuscitera ${deadCount} joueur(s) tué(s) (leur mort sera annulée). Confirmer ?`,
              )
            ) {
              return;
            }
            setBusy(true);
            try {
              await onInvalidate(reason);
            } finally {
              setBusy(false);
            }
          }}
          data-testid="invalidate-sheet"
        >
          Invalider le match
        </button>
      </div>
    </div>
  );
}
