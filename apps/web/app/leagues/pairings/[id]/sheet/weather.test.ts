import { describe, it, expect } from "vitest";
import {
  changingWeatherKickoffs,
  resolveSheetWeather,
  weatherHintForEventKind,
} from "./weather";

const TABLES = [
  {
    id: "classique",
    name: "Classique",
    results: [
      { roll: 3, condition: "Très ensoleillé", description: "-1 PA." },
      { roll: 4, condition: "Conditions parfaites", description: "Idéal." },
      { roll: 5, condition: "Conditions parfaites", description: "Idéal." },
      { roll: 11, condition: "Pluie battante", description: "-1 AG." },
      { roll: 12, condition: "Blizzard", description: "Rush -1." },
      { roll: 2, condition: "Chaleur écrasante", description: "D3 en Réserve." },
    ],
  },
];

describe("resolveSheetWeather", () => {
  it("rend null tant qu'aucune condition n'est saisie", () => {
    expect(resolveSheetWeather(TABLES, "classique", "")).toBeNull();
    expect(resolveSheetWeather(TABLES, null, null)).toBeNull();
  });

  it("résout table, description, jets et effets", () => {
    const w = resolveSheetWeather(TABLES, "classique", "Pluie battante");
    expect(w).toMatchObject({
      tableName: "Classique",
      condition: "Pluie battante",
      description: "-1 AG.",
      rolls: [11],
    });
    expect(w?.effects).toEqual([
      "-1 aux tests d'Agilité (réception, ramassage)",
    ]);
  });

  it("liste tous les jets d'une condition partagée, sans effet de jeu", () => {
    const w = resolveSheetWeather(TABLES, "classique", "Conditions parfaites");
    expect(w?.rolls).toEqual([4, 5]);
    expect(w?.effects).toEqual([]);
  });

  it("Blizzard : Rush et portée de passe", () => {
    const w = resolveSheetWeather(TABLES, "classique", "Blizzard");
    expect(w?.effects).toEqual([
      "-1 aux Rush (Foncer)",
      "Passes Rapides et Courtes uniquement",
    ]);
  });

  it("Chaleur écrasante : joueurs en Réserve", () => {
    const w = resolveSheetWeather(TABLES, "classique", "Chaleur écrasante");
    expect(w?.effects).toEqual([
      "D3 joueurs aléatoires par équipe en Réserve à la fin de chaque drive",
    ]);
  });

  it("garde une condition hors catalogue lisible, sans effet déduit", () => {
    const w = resolveSheetWeather(TABLES, "disparue", "Pluie battante");
    expect(w).toMatchObject({
      tableName: "disparue",
      condition: "Pluie battante",
      description: null,
      effects: [],
    });
  });
});

describe("weatherHintForEventKind", () => {
  const sunny = resolveSheetWeather(TABLES, "classique", "Très ensoleillé");
  const rain = resolveSheetWeather(TABLES, "classique", "Pluie battante");
  const blizzard = resolveSheetWeather(TABLES, "classique", "Blizzard");
  const perfect = resolveSheetWeather(TABLES, "classique", "Conditions parfaites");

  it("rappelle le malus de passe sur une passe ou une interception", () => {
    expect(weatherHintForEventKind(sunny, "pass_complete")).toBe(
      "Météo « Très ensoleillé » : -1 à la passe.",
    );
    expect(weatherHintForEventKind(rain, "interception")).toBe(
      "Météo « Pluie battante » : -1 à la réception.",
    );
    expect(weatherHintForEventKind(blizzard, "pass_complete")).toContain(
      "passes rapides et courtes uniquement",
    );
  });

  it("cible le lancer et l'atterrissage d'un coéquipier", () => {
    expect(weatherHintForEventKind(sunny, "team_throw")).toContain("-1 au lancer");
    expect(weatherHintForEventKind(rain, "ttm_landing")).toContain(
      "-1 à la réception du ballon",
    );
  });

  it("se tait quand la météo ne touche pas l'évènement", () => {
    expect(weatherHintForEventKind(sunny, "touchdown")).toBeNull();
    expect(weatherHintForEventKind(perfect, "pass_complete")).toBeNull();
    expect(weatherHintForEventKind(null, "pass_complete")).toBeNull();
  });
});

describe("changingWeatherKickoffs", () => {
  it("ne retient que les coups d'envoi « Météo capricieuse »", () => {
    const events = [
      { id: "a", kind: "kickoff", meta: { kickoffEvent: "changing-weather" } },
      { id: "b", kind: "kickoff", meta: { kickoffEvent: "blitz" } },
      { id: "c", kind: "touchdown", meta: { kickoffEvent: "changing-weather" } },
      { id: "d", kind: "kickoff", meta: null },
    ];
    expect(changingWeatherKickoffs(events).map((e) => e.id)).toEqual(["a"]);
  });
});
