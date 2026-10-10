import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  ALLOWED_INDUCEMENT_OPTIONS,
  AllowedInducementsField,
  toggleAllowedInducement,
} from "./AllowedInducementsField";

describe("toggleAllowedInducement", () => {
  it("coche puis décoche sans muter la liste d'origine", () => {
    const base = ["bribe"];
    expect(toggleAllowedInducement(base, "team_mascot")).toEqual([
      "bribe",
      "team_mascot",
    ]);
    expect(toggleAllowedInducement(base, "bribe")).toEqual([]);
    expect(base).toEqual(["bribe"]);
  });
});

describe("AllowedInducementsField", () => {
  it("propose le catalogue sans les Star Players", () => {
    expect(ALLOWED_INDUCEMENT_OPTIONS.some((o) => o.slug === "star_player")).toBe(false);
    expect(ALLOWED_INDUCEMENT_OPTIONS.some((o) => o.slug === "team_mascot")).toBe(true);
  });

  it("reflète la valeur et renvoie la liste basculée", () => {
    const onChange = vi.fn();
    render(
      <AllowedInducementsField testId="f" value={["bribe"]} onChange={onChange} />,
    );
    const bribe = within(screen.getByTestId("f-bribe")).getByRole("checkbox") as HTMLInputElement;
    const mascot = within(screen.getByTestId("f-team_mascot")).getByRole(
      "checkbox",
    ) as HTMLInputElement;
    expect(bribe.checked).toBe(true);
    expect(mascot.checked).toBe(false);

    fireEvent.click(mascot);
    expect(onChange).toHaveBeenLastCalledWith(["bribe", "team_mascot"]);
    fireEvent.click(bribe);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("se désactive en bloc", () => {
    render(
      <AllowedInducementsField testId="f" value={[]} onChange={vi.fn()} disabled />,
    );
    expect((screen.getByTestId("f") as HTMLFieldSetElement).disabled).toBe(true);
  });
});
