import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

vi.mock("../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { apiRequest } from "../lib/api-client";
import { toast } from "sonner";
import { LanguageProvider } from "../contexts/LanguageContext";
import CompetitionLifecyclePanel, {
  lifecycleApiBase,
  nameMatches,
} from "./CompetitionLifecyclePanel";

const mockApi = apiRequest as unknown as ReturnType<typeof vi.fn>;
const mockToast = toast.success as unknown as ReturnType<typeof vi.fn>;

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof CompetitionLifecyclePanel>> = {},
) {
  const props = {
    kind: "league" as const,
    competitionId: "lg-1",
    name: "Open 5 Teams",
    archived: false,
    canManage: true,
    onArchived: vi.fn(),
    onDeleted: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <LanguageProvider>
      <CompetitionLifecyclePanel {...props} />
    </LanguageProvider>,
  );
  return { ...utils, props };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CompetitionLifecyclePanel", () => {
  it("n'est pas rendu pour un coach qui ne gère pas la compétition", () => {
    renderPanel({ canManage: false });
    expect(screen.queryByTestId("competition-lifecycle-panel")).toBeNull();
  });

  it("archive après confirmation, puis rappelle onArchived", async () => {
    mockApi.mockResolvedValue({ changed: true });
    const { props } = renderPanel();
    fireEvent.click(screen.getByTestId("lifecycle-archive-button"));
    await waitFor(() => expect(props.onArchived).toHaveBeenCalledTimes(1));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Open 5 Teams"),
    );
    expect(mockApi).toHaveBeenCalledWith("/leagues/lg-1/archive", { method: "POST" });
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining("Open 5 Teams"));
  });

  it("ne fait rien si la confirmation est refusée", () => {
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { props } = renderPanel();
    fireEvent.click(screen.getByTestId("lifecycle-archive-button"));
    expect(mockApi).not.toHaveBeenCalled();
    expect(props.onArchived).not.toHaveBeenCalled();
  });

  it("compétition déjà archivée : notice à la place du bouton", () => {
    renderPanel({ archived: true });
    expect(screen.queryByTestId("lifecycle-archive-button")).toBeNull();
    expect(screen.getByText(/archivée/i)).toBeTruthy();
    // La suppression reste possible.
    expect(screen.getByTestId("lifecycle-delete-button")).toBeTruthy();
  });

  it("supprime uniquement après saisie du nom exact (coupe → préfixe /cup)", async () => {
    mockApi.mockResolvedValue({ deleted: true });
    const { props } = renderPanel({ kind: "cup", competitionId: "cup-9", name: "Nuffle Cup" });
    const button = screen.getByTestId("lifecycle-delete-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("lifecycle-delete-confirm-input"), {
      target: { value: "nuffle" },
    });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(mockApi).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("lifecycle-delete-confirm-input"), {
      target: { value: "  nuffle cup " },
    });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledTimes(1));
    expect(mockApi).toHaveBeenCalledWith("/cup/cup-9", { method: "DELETE" });
  });

  it("affiche l'erreur serveur et ne rappelle pas le parent", async () => {
    mockApi.mockRejectedValue(new Error("Seul le commissaire peut gerer cette ligue"));
    const { props } = renderPanel();
    fireEvent.click(screen.getByTestId("lifecycle-archive-button"));
    await waitFor(() =>
      expect(screen.getByTestId("lifecycle-error").textContent).toContain("Seul le commissaire"),
    );
    expect(props.onArchived).not.toHaveBeenCalled();
  });

  it("helpers purs", () => {
    expect(lifecycleApiBase("league", "a")).toBe("/leagues/a");
    expect(lifecycleApiBase("cup", "b")).toBe("/cup/b");
    expect(nameMatches(" Open ", "open")).toBe(true);
    expect(nameMatches("Ope", "Open")).toBe(false);
  });
});
