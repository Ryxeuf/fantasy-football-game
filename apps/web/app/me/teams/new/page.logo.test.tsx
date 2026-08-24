/**
 * Logo d'équipe dans le builder : le fichier choisi avant création est
 * envoyé sur `POST /team/:id/logo` une fois l'équipe créée, et un échec
 * d'upload ne fait pas échouer la création.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import NewTeamPage from "./page";
import { LanguageProvider } from "../../../contexts/LanguageContext";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem("auth_token", "token");
  // Le builder charge le roster via apiRequest puis crée l'équipe via
  // `POST /team/build`. Un poste `min: 11` suffit à rendre la compo valide
  // sans cliquer sur les steppers.
  apiRequest.mockImplementation((path: string) => {
    if (String(path).startsWith("/team/rosters/")) {
      return Promise.resolve({
        roster: {
          positions: [
            {
              slug: "lineman",
              displayName: "Lineman",
              cost: 50,
              min: 11,
              max: 16,
              ma: 6,
              st: 3,
              ag: 3,
              pa: 4,
              av: 9,
              skills: "",
            },
          ],
          specialRules: [],
        },
        ruleset: "season_3",
      });
    }
    return Promise.resolve({ team: { id: "team-42" } });
  });
  fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const payload = url.includes("builder-rosters")
      ? { rosters: [] }
      : url.includes("star-players")
        ? { starPlayers: [] }
        : { success: true, data: { logoUrl: "/images/team-logos/x.png" } };
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(payload),
    } as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

function renderPage() {
  return render(
    <LanguageProvider>
      <NewTeamPage />
    </LanguageProvider>,
  );
}

function pngFile(): File {
  return new File([new Uint8Array(32)], "logo.png", { type: "image/png" });
}

async function pickLogoAndSubmit() {
  await waitFor(() => expect(screen.getByTestId("team-logo-picker")).toBeTruthy());
  fireEvent.change(screen.getByTestId("team-logo-picker-input"), {
    target: { files: [pngFile()] },
  });
  await waitFor(() =>
    expect(screen.getByTestId("team-logo-picker-filename").textContent).toBe(
      "logo.png",
    ),
  );
  fireEvent.click(screen.getByTestId("create-team-submit"));
}

function logoCalls() {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).includes("/team/team-42/logo"),
  );
}

describe("Builder — logo d'équipe à la création", () => {
  it("propose le choix du logo dans le formulaire", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("team-logo-picker")).toBeTruthy(),
    );
    expect(screen.getByTestId("team-logo-picker-choose")).toBeTruthy();
  });

  it("n'appelle pas l'endpoint logo tant que l'équipe n'est pas créée", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("team-logo-picker")).toBeTruthy());
    fireEvent.change(screen.getByTestId("team-logo-picker-input"), {
      target: { files: [pngFile()] },
    });
    await waitFor(() =>
      expect(screen.getByTestId("team-logo-picker-filename")).toBeTruthy(),
    );
    expect(logoCalls()).toHaveLength(0);
  });

  it("envoie le logo sur POST /team/:id/logo après la création", async () => {
    renderPage();
    await pickLogoAndSubmit();

    await waitFor(() => expect(logoCalls()).toHaveLength(1));
    const [, init] = logoCalls()[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("image/png");
    expect(init.body).toBeInstanceOf(File);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/me/teams/team-42"));
  });

  it("n'appelle pas l'endpoint logo si aucun fichier n'est choisi", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("create-team-submit")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("create-team-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/me/teams/team-42"));
    expect(logoCalls()).toHaveLength(0);
  });

  it("garde l'équipe créée si l'upload du logo échoue", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/logo")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "boom" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.includes("builder-rosters") ? { rosters: [] } : { starPlayers: [] },
          ),
      } as Response);
    });

    renderPage();
    await pickLogoAndSubmit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/me/teams/team-42"));
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});
