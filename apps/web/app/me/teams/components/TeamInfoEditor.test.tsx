/**
 * Panneau « Staff de l'équipe » de la page d'édition.
 *
 * Régression couverte : les coûts et les plafonds étaient écrits en dur
 * (10k cheerleaders / 10k assistants / 50k apothicaire / 10k fans, 0-8 /
 * 0-12 / 0-6 / 1-6) au lieu d'être lus dans la config du roster × format
 * exposée par le serveur (`staffConfig`). Le format Sevens et les rosters
 * sans apothicaire affichaient donc de fausses valeurs.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamInfoEditor from "./TeamInfoEditor";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { defaultStaffConfig } from "@bb/game-engine";

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({ team: {} }),
}));

/** `toLocaleString("fr-FR")` sépare les milliers avec U+202F : on normalise. */
function normalize(text: string | null | undefined): string {
  return (text ?? "").replace(/[  ]/g, " ");
}

const BASE_INFO = {
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: false,
  dedicatedFans: 3,
  roster: "orc",
};

function renderEditor(props: Partial<Parameters<typeof TeamInfoEditor>[0]> = {}) {
  return render(
    <LanguageProvider>
      <TeamInfoEditor
        teamId="team-1"
        initialInfo={BASE_INFO}
        onUpdate={() => {}}
        roster="orc"
        {...props}
      />
    </LanguageProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe("TeamInfoEditor — coûts issus de la config du roster", () => {
  it("affiche les coûts unitaires de la config fournie (et pas 10k en dur)", () => {
    const staffConfig = {
      ...defaultStaffConfig("orc", "bb11"),
      cheerleaderCost: 20_000,
      assistantCost: 20_000,
      apothecaryCost: 80_000,
      dedicatedFanCost: 20_000,
    };
    renderEditor({ staffConfig });

    const info = normalize(screen.getByTestId("staff-cost-info").textContent);
    expect(info).toContain("Cheerleaders : 20 000 po");
    expect(info).toContain("Assistants : 20 000 po");
    expect(info).toContain("Apothicaire : 80 000 po");
    expect(info).toContain("Fans dévoués : 20 000 po");
  });

  it("le fan dévoué bb11 vaut 5 000 po (et non 10 000 po)", () => {
    renderEditor({ format: "bb11" });
    const info = normalize(screen.getByTestId("staff-cost-info").textContent);
    expect(info).toContain("Fans dévoués : 5 000 po");
    expect(info).not.toContain("Fans dévoués : 10 000 po");
  });

  it("dérive la config du format quand le serveur n'en fournit pas (Sevens)", () => {
    renderEditor({ format: "sevens" });
    const sevens = defaultStaffConfig("orc", "sevens");
    const info = normalize(screen.getByTestId("staff-cost-info").textContent);
    // Sevens : relance ×2, staff 20k, apothicaire 80k, 6 relances max.
    expect(info).toContain(
      `Relances : ${normalize(sevens.rerollCost.toLocaleString("fr-FR"))} po`,
    );
    expect(info).toContain(`max ${sevens.maxRerolls}`);
    expect(info).toContain("Cheerleaders : 20 000 po");
  });

  it("calcule le coût staff avec les coûts de la config", () => {
    const staffConfig = {
      ...defaultStaffConfig("orc", "bb11"),
      rerollCost: 60_000,
      dedicatedFanCost: 5_000,
    };
    renderEditor({ staffConfig });
    // 2 relances × 60k + 2 fans achetés × 5k = 130k
    expect(normalize(screen.getByTestId("staff-total-cost").textContent)).toBe(
      "130K po",
    );
  });
});

describe("TeamInfoEditor — plafonds", () => {
  it("borne les steppers sur les plafonds de la config", () => {
    const staffConfig = {
      ...defaultStaffConfig("orc", "sevens"),
      maxAssistants: 3,
    };
    renderEditor({ staffConfig, initialInfo: { ...BASE_INFO, assistants: 3 } });

    expect(
      (screen.getByTestId("staff-assistants-inc") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      normalize(screen.getByTestId("staff-cost-info").textContent),
    ).toContain("Assistants : 20 000 po chacun (max 3)");
  });

  it("ramène une valeur au-dessus du plafond sur le plafond", () => {
    const staffConfig = {
      ...defaultStaffConfig("orc", "bb11"),
      maxRerolls: 6,
    };
    renderEditor({ staffConfig, initialInfo: { ...BASE_INFO, rerolls: 8 } });
    expect(screen.getByTestId("staff-rerolls-value").textContent).toBe("6");
  });

  it("les fans dévoués ne descendent pas sous 1", () => {
    renderEditor({ initialInfo: { ...BASE_INFO, dedicatedFans: 1 } });
    expect(
      (screen.getByTestId("staff-dedicated-fans-dec") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("TeamInfoEditor — apothicaire", () => {
  it("désactive l'apothicaire quand le roster n'y a pas droit", () => {
    const staffConfig = {
      ...defaultStaffConfig("orc", "bb11"),
      apothecaryAllowed: false,
    };
    renderEditor({
      staffConfig,
      initialInfo: { ...BASE_INFO, apothecary: true },
    });

    const toggle = screen.getByTestId("staff-apothecary") as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    // Le toggle est aussi remis à false : la valeur envoyée reste légale.
    expect(toggle.checked).toBe(false);
    expect(screen.getByTestId("apothecary-forbidden-roster")).toBeTruthy();
    expect(
      normalize(screen.getByTestId("staff-cost-info").textContent),
    ).toContain("Apothicaire : indisponible pour ce roster");
  });
});

describe("TeamInfoEditor — budget restant", () => {
  const BUDGET_PROPS = {
    staffConfig: { ...defaultStaffConfig("orc", "bb11"), rerollCost: 60_000 },
    initialBudgetK: 1_000,
    playersCost: 800_000,
    starPlayersCost: 20_000,
  };

  it("déduit les joueurs, les Star Players et le staff du budget initial", () => {
    renderEditor(BUDGET_PROPS);

    expect(normalize(screen.getByTestId("staff-players-cost").textContent)).toBe(
      "820K po",
    );
    // 1000k - 820k - (2×60k relances + 2×5k fans) = 50k
    expect(
      normalize(screen.getByTestId("staff-remaining-budget").textContent),
    ).toBe("50K po");
  });

  it("réagit à un changement de staff", () => {
    renderEditor(BUDGET_PROPS);

    fireEvent.click(screen.getByTestId("staff-cheerleaders-inc"));
    // 50k - 10k = 40k
    expect(
      normalize(screen.getByTestId("staff-remaining-budget").textContent),
    ).toBe("40K po");
  });
});
