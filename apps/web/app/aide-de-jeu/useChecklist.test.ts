import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChecklist } from "./useChecklist";

describe("useChecklist", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("part d'une liste vide", () => {
    const { result } = renderHook(() => useChecklist("pre-match"));
    expect(result.current.checked.size).toBe(0);
  });

  it("coche puis décoche une entrée", () => {
    const { result } = renderHook(() => useChecklist("pre-match"));

    act(() => result.current.toggle("meteo"));
    expect(result.current.isChecked("meteo")).toBe(true);

    act(() => result.current.toggle("meteo"));
    expect(result.current.isChecked("meteo")).toBe(false);
  });

  it("relit les coches d'une visite précédente", () => {
    window.localStorage.setItem(
      "nuffle_aide_de_jeu:pre-match",
      JSON.stringify(["meteo", "prieres"]),
    );

    const { result } = renderHook(() => useChecklist("pre-match"));
    expect(result.current.isChecked("meteo")).toBe(true);
    expect(result.current.isChecked("prieres")).toBe(true);
  });

  it("isole les listes les unes des autres", () => {
    const pre = renderHook(() => useChecklist("pre-match"));
    act(() => pre.result.current.toggle("meteo"));

    const turn = renderHook(() => useChecklist("turn"));
    expect(turn.result.current.isChecked("meteo")).toBe(false);
  });

  it("vide la liste sur reset", () => {
    const { result } = renderHook(() => useChecklist("pre-match"));
    act(() => result.current.toggle("meteo"));
    act(() => result.current.reset());

    expect(result.current.checked.size).toBe(0);
    expect(window.localStorage.getItem("nuffle_aide_de_jeu:pre-match")).toBe("[]");
  });

  it("ignore une valeur stockée corrompue", () => {
    window.localStorage.setItem("nuffle_aide_de_jeu:pre-match", "{pas du json");
    const { result } = renderHook(() => useChecklist("pre-match"));
    expect(result.current.checked.size).toBe(0);
  });

  it("reste utilisable quand le stockage local est inaccessible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() => useChecklist("pre-match"));
    expect(result.current.checked.size).toBe(0);

    act(() => result.current.toggle("meteo"));
    expect(result.current.isChecked("meteo")).toBe(true);
  });
});
