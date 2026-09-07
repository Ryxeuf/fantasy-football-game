/**
 * Page /me/notifications : liste, mise en avant des non lues, marquage lu à
 * la consultation, états vide / erreur, « charger plus ».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../../contexts/NotificationsContext", () => ({
  useNotifications: vi.fn(),
}));

import { apiRequest } from "../../lib/api-client";
import { useNotifications } from "../../contexts/NotificationsContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import NotificationsPage from "./page";

const mockApi = apiRequest as unknown as ReturnType<typeof vi.fn>;
const mockUse = useNotifications as unknown as ReturnType<typeof vi.fn>;
const markAllRead = vi.fn();

function item(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    kind: "league.invitation",
    title: `Titre ${id}`,
    body: `Corps ${id}`,
    url: `/leagues/invitations/${id}`,
    meta: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <LanguageProvider>
      <NotificationsPage />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  markAllRead.mockResolvedValue(2);
  mockUse.mockReturnValue({
    unreadCount: 2,
    loaded: true,
    refresh: vi.fn(),
    markAllRead,
    setUnreadCount: vi.fn(),
  });
});

afterEach(() => cleanup());

describe("NotificationsPage", () => {
  it("liste les notifications, met en avant les non lues et les marque lues", async () => {
    mockApi.mockResolvedValue({
      notifications: [
        item("n1"),
        item("n2", { readAt: "2026-09-01T00:00:00.000Z", url: null, kind: "friend.request" }),
      ],
      unreadCount: 1,
    });
    renderPage();

    await waitFor(() => expect(screen.getByTestId("notifications-list")).toBeTruthy());
    expect(mockApi).toHaveBeenCalledWith("/notifications?limit=50");
    expect(screen.getByText("Titre n1")).toBeTruthy();
    expect(screen.getByText("Corps n2")).toBeTruthy();

    // n1 était non lue : badge « Nouveau », carte marquée fresh ; n2 non.
    expect(screen.getByTestId("notification-item-n1").getAttribute("data-fresh")).toBe("true");
    expect(screen.getByTestId("notification-item-n2").getAttribute("data-fresh")).toBe("false");
    expect(screen.getAllByText("Nouveau").length).toBe(1);

    // Lien d'ouverture uniquement quand une URL interne existe.
    expect(screen.getByTestId("notification-link-n1").getAttribute("href")).toBe(
      "/leagues/invitations/n1",
    );
    expect(screen.queryByTestId("notification-link-n2")).toBeNull();

    // Consulter = lire : le contexte marque tout lu (pastille à zéro).
    await waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("notifications-marked-read")).toBeTruthy());
    expect(screen.queryByTestId("notifications-load-more")).toBeNull();
  });

  it("ne marque rien quand tout est déjà lu", async () => {
    mockApi.mockResolvedValue({
      notifications: [item("n1", { readAt: "2026-09-01T00:00:00.000Z" })],
      unreadCount: 0,
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("notifications-list")).toBeTruthy());
    expect(markAllRead).not.toHaveBeenCalled();
    expect(screen.queryByTestId("notifications-marked-read")).toBeNull();
  });

  it("état vide", async () => {
    mockApi.mockResolvedValue({ notifications: [], unreadCount: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("notifications-empty")).toBeTruthy());
    expect(markAllRead).not.toHaveBeenCalled();
  });

  it("état d'erreur", async () => {
    mockApi.mockRejectedValue(new Error("Session expirée"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("notifications-error").textContent).toContain("Session expirée"));
  });

  it("« Charger plus » quand une page complète est renvoyée", async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) =>
      item(`p${i}`, { readAt: "2026-09-01T00:00:00.000Z" }),
    );
    mockApi.mockImplementation(async (path: string) =>
      path.includes("offset=50")
        ? { notifications: [item("extra", { readAt: "2026-09-01T00:00:00.000Z" })], unreadCount: 0 }
        : { notifications: firstPage, unreadCount: 0 },
    );
    renderPage();
    const more = await screen.findByTestId("notifications-load-more");
    fireEvent.click(more);
    await waitFor(() => expect(screen.getByTestId("notification-item-extra")).toBeTruthy());
    expect(mockApi).toHaveBeenCalledWith("/notifications?limit=50&offset=50");
    // Moins d'une page en retour : plus de bouton.
    await waitFor(() => expect(screen.queryByTestId("notifications-load-more")).toBeNull());
  });
});
