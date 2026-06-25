"use client";

import { useState } from "react";

// Refonte mobile-first — panneaux de saisie d'une feuille de match de
// ligue physique. Sections AVANT-MATCH / FIN DU MATCH calquees sur la
// feuille de match officielle Blood Bowl. Composants presentational :
// ils gerent un etat local seede par `initial` et appellent `onSave`
// (la page parent fait l'appel API). Responsive : 1 colonne mobile ->
// 2 colonnes home/away des `sm`.

const WINNINGS_PER_POPULARITY = 10_000;

const WEATHER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "sweltering_heat", label: "Chaleur accablante" },
  { value: "very_sunny", label: "Très ensoleillé" },
  { value: "perfect", label: "Conditions idéales" },
  { value: "pouring_rain", label: "Averse" },
  { value: "blizzard", label: "Blizzard" },
];

export interface SheetPlayer {
  id: string;
  number: number;
  name: string;
  position: string;
  dead: boolean;
  missNextMatch: boolean;
  spp: number;
}

export interface SheetTeam {
  teamId: string;
  name: string;
  roster: string;
  players: SheetPlayer[];
}

function playerLabel(p: SheetPlayer): string {
  const flags = p.dead ? " ☠" : p.missNextMatch ? " (blessé)" : "";
  return `N°${p.number} ${p.name} — ${p.position}${flags}`;
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
  name: string;
  cost: number;
  qty: number;
}

export interface PreMatchValues {
  weatherTable: string;
  weather: string;
  forfeitSide: "home" | "away" | null;
  popularityHome: number | null;
  popularityAway: number | null;
  inducementsHome: Inducement[];
  inducementsAway: Inducement[];
}

const WEATHER_TABLES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "classique", label: "Classique" },
  { value: "stade_couvert", label: "Stade couvert" },
];

function sumInducements(list: Inducement[]): number {
  return list.reduce(
    (acc, i) => acc + Math.max(0, i.cost) * Math.max(1, i.qty),
    0,
  );
}

function InducementEditor({
  list,
  onChange,
  disabled,
  testId,
}: {
  list: Inducement[];
  onChange: (l: Inducement[]) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const update = (i: number, patch: Partial<Inducement>) =>
    onChange(list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div data-testid={testId} className="space-y-2">
      <div className="text-xs font-medium text-slate-600">Coups de pouce</div>
      {list.length === 0 && (
        <p className="text-xs text-slate-400">Aucune prime de match.</p>
      )}
      {list.map((it, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <input
            value={it.name}
            onChange={(e) => update(i, { name: e.target.value })}
            disabled={disabled}
            placeholder="Nom"
            className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
          />
          <input
            type="number"
            min={0}
            value={it.cost}
            onChange={(e) => update(i, { cost: Number(e.target.value) || 0 })}
            disabled={disabled}
            placeholder="Coût (po)"
            className="w-24 rounded border px-2 py-1 text-sm"
          />
          <input
            type="number"
            min={1}
            value={it.qty}
            onChange={(e) => update(i, { qty: Number(e.target.value) || 1 })}
            disabled={disabled}
            title="Quantité"
            className="w-14 rounded border px-2 py-1 text-sm"
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
          onClick={() => onChange([...list, { name: "", cost: 0, qty: 1 }])}
          className="text-xs font-medium text-blue-600"
        >
          + coup de pouce
        </button>
      )}
      <div className="text-[11px] text-slate-500">
        Cash investi : {sumInducements(list).toLocaleString("fr-FR")} po
      </div>
    </div>
  );
}

export function PreMatchPanel({
  initial,
  homeName,
  awayName,
  disabled,
  onSave,
}: {
  initial: PreMatchValues;
  homeName: string;
  awayName: string;
  disabled?: boolean;
  onSave: (v: PreMatchValues) => Promise<void>;
}) {
  const [weatherTable, setWeatherTable] = useState(initial.weatherTable);
  const [weather, setWeather] = useState(initial.weather);
  const [forfeitSide, setForfeitSide] = useState<"home" | "away" | "">(
    initial.forfeitSide ?? "",
  );
  const [popH, setPopH] = useState<string>(
    initial.popularityHome?.toString() ?? "",
  );
  const [popA, setPopA] = useState<string>(
    initial.popularityAway?.toString() ?? "",
  );
  const [indH, setIndH] = useState<Inducement[]>(initial.inducementsHome);
  const [indA, setIndA] = useState<Inducement[]>(initial.inducementsAway);
  const [busy, setBusy] = useState(false);

  const winningsH = (Number(popH) || 0) * WINNINGS_PER_POPULARITY;
  const winningsA = (Number(popA) || 0) * WINNINGS_PER_POPULARITY;

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        weatherTable,
        weather,
        forfeitSide: forfeitSide === "" ? null : forfeitSide,
        popularityHome: popH === "" ? null : Number(popH),
        popularityAway: popA === "" ? null : Number(popA),
        inducementsHome: indH,
        inducementsAway: indA,
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
    },
    {
      side: "away" as const,
      name: awayName,
      pop: popA,
      setPop: setPopA,
      winnings: winningsA,
      ind: indA,
      setInd: setIndA,
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

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          Table météo
          <select
            value={weatherTable}
            onChange={(e) => setWeatherTable(e.target.value)}
            disabled={disabled}
            data-testid="weather-table-select"
            className="mt-1 block w-full rounded border px-2 py-2 text-sm"
          >
            {WEATHER_TABLES.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          Météo initiale
          <select
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            disabled={disabled}
            data-testid="weather-select"
            className="mt-1 block w-full rounded border px-2 py-2 text-sm"
          >
            {WEATHER_OPTIONS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          Déclarer forfait
          <select
            value={forfeitSide}
            onChange={(e) =>
              setForfeitSide(e.target.value as "home" | "away" | "")
            }
            disabled={disabled}
            data-testid="forfeit-select"
            className="mt-1 block w-full rounded border px-2 py-2 text-sm"
          >
            <option value="">Aucun</option>
            <option value="home">{homeName} forfait</option>
            <option value="away">{awayName} forfait</option>
          </select>
        </label>
      </div>

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
                Gains auto : {c.winnings.toLocaleString("fr-FR")} po
              </span>
            </label>
            <InducementEditor
              list={c.ind}
              onChange={c.setInd}
              disabled={disabled}
              testId={`inducements-${c.side}`}
            />
          </div>
        ))}
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          data-testid="save-pre-match"
          className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Enregistrer l&apos;avant-match
        </button>
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
  { value: "other", label: "Autre" },
];

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

/** Positions distinctes deja fieldees par l'equipe (suggestions d'achat joueur). */
function teamPositions(team: SheetTeam | null): string[] {
  if (!team) return [];
  return Array.from(new Set(team.players.map((p) => p.position))).sort();
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
              {positions.map((slug) => (
                <option key={slug} value={slug}>
                  {slug}
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
          <input
            value={it.name}
            onChange={(e) => update(i, { name: e.target.value })}
            disabled={disabled}
            placeholder="Nom"
            className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
          />
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
}: {
  initial: PostMatchValues;
  home: SheetTeam | null;
  away: SheetTeam | null;
  disabled?: boolean;
  onSave: (v: PostMatchValues) => Promise<void>;
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
            </div>

            <div className="text-xs">
              <div className="mb-1 font-medium text-slate-600">
                Erreurs coûteuses
              </div>
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
  onInvalidate,
}: {
  canInvalidate: boolean;
  reasonClosed?: string;
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
    <div className="flex flex-wrap items-center gap-2" data-testid="invalidate-control">
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
  );
}
