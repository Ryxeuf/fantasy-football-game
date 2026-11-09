import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

import { apiRequest, ApiClientError } from "../../lib/api-client";
import NafNumberCard from "./NafNumberCard";
import {
  isValidNafNumberInput,
  nafCoachPageUrl,
  nafNumberStatus,
} from "./naf-number";

const mockedApi = vi.mocked(apiRequest);

const EMPTY = { nafNumber: null, nafName: null, nafVerifiedAt: null };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("naf-number (pur)", () => {
  it.each([
    ["", true],
    ["7221", true],
    [" 42 ", true],
    ["1234567", true],
    ["12345678", false],
    ["0", false],
    ["12a", false],
  ])("format %j ⇒ %s", (raw, ok) => {
    expect(isValidNafNumberInput(raw)).toBe(ok);
  });

  it("statut : aucun / vérifié / en attente", () => {
    expect(nafNumberStatus(EMPTY)).toBe("none");
    expect(
      nafNumberStatus({ nafNumber: 1, nafName: null, nafVerifiedAt: "2026-11-09T00:00:00Z" }),
    ).toBe("verified");
    expect(nafNumberStatus({ nafNumber: 1, nafName: null, nafVerifiedAt: null })).toBe("pending");
  });

  it("lien vers la fiche coach NAF", () => {
    expect(nafCoachPageUrl(7221)).toBe(
      "https://member.thenaf.net/index.php?module=NAF&type=coachpage&coach=7221",
    );
  });
});

describe("NafNumberCard", () => {
  it("enregistre un numéro trouvé : badge « Vérifié — nom NAF » et lien", async () => {
    mockedApi.mockResolvedValueOnce({
      nafNumber: 7221,
      nafName: "#5Renton",
      nafVerifiedAt: "2026-11-09T10:00:00Z",
      verified: true,
    });
    render(<NafNumberCard initial={EMPTY} />);

    fireEvent.change(screen.getByTestId("naf-number-input"), { target: { value: "7221" } });
    fireEvent.click(screen.getByTestId("naf-number-save"));

    await waitFor(() =>
      expect(screen.getByTestId("naf-number-verified").textContent).toContain(
        "Vérifié — #5Renton",
      ),
    );
    expect(mockedApi).toHaveBeenCalledWith("/user/naf-number", {
      method: "PUT",
      body: JSON.stringify({ nafNumber: "7221" }),
    });
    expect(screen.getByTestId("naf-number-link").getAttribute("href")).toContain("coach=7221");
  });

  it("NAF injoignable : « En attente de vérification » puis Réessayer", async () => {
    mockedApi
      .mockResolvedValueOnce({
        nafNumber: 7221,
        nafName: null,
        nafVerifiedAt: null,
        verified: false,
      })
      .mockResolvedValueOnce({
        nafNumber: 7221,
        nafName: "#5Renton",
        nafVerifiedAt: "2026-11-09T10:05:00Z",
        verified: true,
      });
    render(<NafNumberCard initial={EMPTY} />);

    fireEvent.change(screen.getByTestId("naf-number-input"), { target: { value: "7221" } });
    fireEvent.click(screen.getByTestId("naf-number-save"));
    await waitFor(() => expect(screen.getByTestId("naf-number-pending")).toBeTruthy());

    fireEvent.click(screen.getByTestId("naf-number-retry"));
    await waitFor(() => expect(screen.getByTestId("naf-number-verified")).toBeTruthy());
    expect(mockedApi).toHaveBeenLastCalledWith("/user/naf-number/verify", { method: "POST" });
  });

  it("numéro introuvable : message dédié, pas de badge", async () => {
    mockedApi.mockRejectedValueOnce(
      new ApiClientError("Numéro introuvable sur thenaf.net", 422, "naf_not_found"),
    );
    render(<NafNumberCard initial={EMPTY} />);

    fireEvent.change(screen.getByTestId("naf-number-input"), { target: { value: "99" } });
    fireEvent.click(screen.getByTestId("naf-number-save"));

    await waitFor(() =>
      expect(screen.getByTestId("naf-number-error").textContent).toBe(
        "Numéro introuvable sur thenaf.net",
      ),
    );
    expect(screen.queryByTestId("naf-number-verified")).toBeNull();
  });

  it("numéro déjà pris : message dédié", async () => {
    mockedApi.mockRejectedValueOnce(
      new ApiClientError("conflit", 409, "naf_number_taken"),
    );
    render(<NafNumberCard initial={EMPTY} />);
    fireEvent.change(screen.getByTestId("naf-number-input"), { target: { value: "7221" } });
    fireEvent.click(screen.getByTestId("naf-number-save"));
    await waitFor(() =>
      expect(screen.getByTestId("naf-number-error").textContent).toMatch(/autre compte/),
    );
  });

  it("format invalide : enregistrement désactivé, aucun appel", () => {
    render(<NafNumberCard initial={EMPTY} />);
    fireEvent.change(screen.getByTestId("naf-number-input"), { target: { value: "12a" } });
    expect((screen.getByTestId("naf-number-save") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("naf-number-save"));
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("vider le champ efface le numéro (null)", async () => {
    mockedApi.mockResolvedValueOnce({ ...EMPTY, verified: false });
    render(
      <NafNumberCard
        initial={{ nafNumber: 7221, nafName: "#5Renton", nafVerifiedAt: "2026-11-09T10:00:00Z" }}
      />,
    );
    expect(screen.getByTestId("naf-number-verified")).toBeTruthy();
    fireEvent.change(screen.getByTestId("naf-number-input"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("naf-number-save"));
    await waitFor(() => expect(screen.queryByTestId("naf-number-verified")).toBeNull());
    expect(mockedApi).toHaveBeenCalledWith("/user/naf-number", {
      method: "PUT",
      body: JSON.stringify({ nafNumber: null }),
    });
  });
});
