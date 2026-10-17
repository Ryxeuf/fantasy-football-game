import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";
import SpecialRulesBadges from "./SpecialRulesBadges";

function renderBadges(withLabel: boolean) {
  return render(
    <LanguageProvider>
      <SpecialRulesBadges rules={[]} withLabel={withLabel} />
    </LanguageProvider>,
  );
}

describe("SpecialRulesBadges — aucune règle", () => {
  it("garde son libellé quand il est demandé", () => {
    const { container } = renderBadges(true);
    expect(container.textContent).toBe("Règles spéciales :Aucune");
  });

  it("reste un simple « Aucune » sans libellé", () => {
    const { container } = renderBadges(false);
    expect(container.textContent).toBe("Aucune");
    expect(screen.queryByText("Règles spéciales :")).toBeNull();
  });
});
