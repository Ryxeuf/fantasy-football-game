import { describe, it, expect } from "vitest";
import {
  allowedCategoriesFor,
  parseAccessCsv,
  CATEGORY_BY_CODE,
} from "./skill-access";

describe("parseAccessCsv", () => {
  it("accepte la forme CSV et la forme concaténée", () => {
    expect(parseAccessCsv("G,S")).toEqual(["G", "S"]);
    expect(parseAccessCsv("GS")).toEqual(["G", "S"]);
  });

  it("replie l'alias F (Force) sur S et dédoublonne", () => {
    expect(parseAccessCsv("F,S,G")).toEqual(["G", "S"]);
  });

  it("ignore les lettres inconnues et rend l'ordre canonique", () => {
    expect(parseAccessCsv("MZ A")).toEqual(["A", "M"]);
  });

  it("vide ou nul -> aucun code", () => {
    expect(parseAccessCsv("")).toEqual([]);
    expect(parseAccessCsv(null)).toEqual([]);
    expect(parseAccessCsv(undefined)).toEqual([]);
  });
});

describe("allowedCategoriesFor", () => {
  const SAURUS = { primarySkills: "S", secondarySkills: "G" };

  it("rend les catégories DB du pool demandé", () => {
    expect(allowedCategoriesFor(SAURUS, "primary")).toEqual(["Strength"]);
    expect(allowedCategoriesFor(SAURUS, "secondary")).toEqual(["General"]);
  });

  it("traite random-primary comme primary", () => {
    expect(allowedCategoriesFor(SAURUS, "random-primary")).toEqual([
      "Strength",
    ]);
  });

  it("expose la Sournoiserie (K), absente du catalogue compilé", () => {
    expect(allowedCategoriesFor({ primarySkills: "K" }, "primary")).toEqual([
      CATEGORY_BY_CODE.K,
    ]);
  });

  it("accès non renseigné -> null (repli catalogue côté appelant)", () => {
    expect(
      allowedCategoriesFor({ primarySkills: null, secondarySkills: null }, "primary"),
    ).toBeNull();
    expect(allowedCategoriesFor(null, "primary")).toBeNull();
    expect(allowedCategoriesFor(undefined, "secondary")).toBeNull();
  });

  it("pool vide renseigné -> [] (et non null)", () => {
    expect(
      allowedCategoriesFor({ primarySkills: "", secondarySkills: "G" }, "primary"),
    ).toEqual([]);
  });
});
