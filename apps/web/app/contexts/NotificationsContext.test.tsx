/**
 * Tests du contexte de notifications (compteur de non lus partagé).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup, fireEvent } from "@testing-library/react";

vi.mock("../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "../lib/api-client";
import { NotificationsProvider, useNotifications } from "./NotificationsContext";

const mockApi = apiRequest as unknown as ReturnType<typeof vi.fn>;

function Consumer() {
  const { unreadCount, loaded, refresh, markAllRead } = useNotifications();
  return (
    <div>
      <span data-testid="count">{unreadCount}</span>
      <span data-testid="loaded">{loaded ? "yes" : "no"}</span>
      <button onClick={() => void refresh()}>refresh</button>
      <button onClick={() => void markAllRead()}>read-all</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("NotificationsProvider", () => {
  it("sans token : aucun appel, compteur 0, loaded", async () => {
    render(
      <NotificationsProvider>
        <Consumer />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loaded").textContent).toBe("yes"));
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("avec token : charge le compteur au montage", async () => {
    window.localStorage.setItem("auth_token", "tok");
    mockApi.mockResolvedValue({ count: 4 });
    render(
      <NotificationsProvider>
        <Consumer />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("4"));
    expect(mockApi).toHaveBeenCalledWith("/notifications/unread-count");
  });

  it("un échec réseau garde la dernière valeur connue et passe loaded", async () => {
    window.localStorage.setItem("auth_token", "tok");
    mockApi.mockRejectedValue(new Error("down"));
    render(
      <NotificationsProvider>
        <Consumer />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loaded").textContent).toBe("yes"));
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("markAllRead poste /notifications/read-all et remet le compteur à zéro", async () => {
    window.localStorage.setItem("auth_token", "tok");
    mockApi.mockImplementation(async (path: string) =>
      path === "/notifications/read-all" ? { updated: 3 } : { count: 3 },
    );
    render(
      <NotificationsProvider>
        <Consumer />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("3"));
    await act(async () => {
      fireEvent.click(screen.getByText("read-all"));
    });
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
    expect(mockApi).toHaveBeenCalledWith("/notifications/read-all", { method: "POST" });
  });

  it("re-interroge au retour de focus de la fenêtre", async () => {
    window.localStorage.setItem("auth_token", "tok");
    mockApi.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 6 });
    render(
      <NotificationsProvider>
        <Consumer />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("6"));
  });

  it("interroge périodiquement tant que l'onglet est visible", async () => {
    window.localStorage.setItem("auth_token", "tok");
    mockApi.mockResolvedValue({ count: 2 });
    render(
      <NotificationsProvider pollIntervalMs={20}>
        <Consumer />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(mockApi.mock.calls.length).toBeGreaterThanOrEqual(3), {
      timeout: 2000,
    });
  });
});

describe("useNotifications hors provider", () => {
  it("retombe sur un no-op (compteur 0, actions inertes)", async () => {
    render(<Consumer />);
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("loaded").textContent).toBe("no");
    await act(async () => {
      fireEvent.click(screen.getByText("read-all"));
      fireEvent.click(screen.getByText("refresh"));
    });
    expect(mockApi).not.toHaveBeenCalled();
  });
});
