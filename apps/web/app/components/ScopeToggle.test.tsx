import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";

const replaceMock = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/leagues",
  useSearchParams: () => new URLSearchParams(search),
}));

import ScopeToggle from "./ScopeToggle";
import ViewerRoleBadges from "./ViewerRoleBadges";
import {
  parseCompetitionScope,
  viewerRoleBadges,
  withCompetitionScope,
} from "../lib/competition-scope";

function renderIn(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

beforeEach(() => {
  vi.resetAllMocks();
  search = "";
});

describe("competition-scope (pur)", () => {
  it("parse : absent ou inconnu ⇒ toutes", () => {
    expect(parseCompetitionScope(null)).toBe("all");
    expect(parseCompetitionScope("friends")).toBe("all");
    expect(parseCompetitionScope("mine")).toBe("mine");
  });

  it("écrit ?scope=mine en conservant les autres paramètres, retire le défaut", () => {
    expect(withCompetitionScope("status=open", "mine")).toBe(
      "?status=open&scope=mine",
    );
    expect(withCompetitionScope("status=open&scope=mine", "all")).toBe(
      "?status=open",
    );
    expect(withCompetitionScope("scope=mine", "all")).toBe("");
  });

  it("badges selon viewerRoles, champ absent toléré", () => {
    expect(viewerRoleBadges(undefined)).toEqual([]);
    expect(viewerRoleBadges(null)).toEqual([]);
    expect(
      viewerRoleBadges({ commissioner: true, participant: "active", teams: [] }),
    ).toEqual(["commissioner", "active"]);
    expect(
      viewerRoleBadges({ commissioner: false, participant: null, teams: [] }),
    ).toEqual([]);
  });
});

describe("ScopeToggle", () => {
  it("« Toutes » sélectionné par défaut", () => {
    renderIn(<ScopeToggle />);
    expect(
      screen.getByTestId("scope-toggle-all").getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByTestId("scope-toggle-mine").getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("lien partagé ?scope=mine : « Les miennes » sélectionné", () => {
    search = "scope=mine";
    renderIn(<ScopeToggle />);
    expect(
      screen.getByTestId("scope-toggle-mine").getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("met l'URL à jour sans défiler", () => {
    search = "status=open";
    renderIn(<ScopeToggle />);
    fireEvent.click(screen.getByTestId("scope-toggle-mine"));
    expect(replaceMock).toHaveBeenCalledWith(
      "/leagues?status=open&scope=mine",
      { scroll: false },
    );
  });

  it("re-cliquer l'option active ne fait rien", () => {
    renderIn(<ScopeToggle />);
    fireEvent.click(screen.getByTestId("scope-toggle-all"));
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("ViewerRoleBadges", () => {
  it.each([
    [{ commissioner: true, participant: null, teams: [] }, ["commissioner"]],
    [{ commissioner: false, participant: "active", teams: [] }, ["active"]],
    [{ commissioner: false, participant: "withdrawn", teams: [] }, ["withdrawn"]],
    [{ commissioner: false, participant: "former", teams: [] }, ["former"]],
  ] as const)("%j", (roles, expected) => {
    renderIn(<ViewerRoleBadges roles={roles} />);
    for (const b of expected) {
      expect(screen.getByTestId(`viewer-role-${b}`)).toBeTruthy();
    }
  });

  it("libellé du commissaire", () => {
    renderIn(
      <ViewerRoleBadges
        roles={{ commissioner: true, participant: null, teams: [] }}
      />,
    );
    expect(screen.getByTestId("viewer-role-commissioner").textContent).toMatch(
      /Commissaire/,
    );
  });

  it("champ absent : rien", () => {
    const { container } = renderIn(<ViewerRoleBadges roles={undefined} />);
    expect(container.textContent).toBe("");
  });
});
