import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("../contexts/NotificationsContext", () => ({
  useNotifications: vi.fn(),
}));

import { useNotifications } from "../contexts/NotificationsContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import NotificationsBell, { formatUnreadBadge } from "./NotificationsBell";

const mockUse = useNotifications as unknown as ReturnType<typeof vi.fn>;

function renderBell(props: { variant?: "desktop" | "mobile" } = {}) {
  return render(
    <LanguageProvider>
      <NotificationsBell {...props} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockUse.mockReturnValue({
    unreadCount: 0,
    loaded: true,
    refresh: vi.fn(),
    markAllRead: vi.fn(),
    setUnreadCount: vi.fn(),
  });
});

afterEach(() => cleanup());

describe("NotificationsBell", () => {
  it("ne rend rien sans token (visiteur déconnecté)", async () => {
    const { container } = renderBell();
    await waitFor(() => expect(container.querySelector("a")).toBeNull());
  });

  it("lien vers /me/notifications sans pastille quand tout est lu", async () => {
    window.localStorage.setItem("auth_token", "tok");
    renderBell();
    const link = await screen.findByTestId("notifications-bell");
    expect(link.getAttribute("href")).toBe("/me/notifications");
    expect(link.getAttribute("aria-label")).toBe("Notifications");
    expect(screen.queryByTestId("notifications-unread-badge")).toBeNull();
  });

  it("affiche le nombre de non lus et l'annonce aux lecteurs d'écran", async () => {
    window.localStorage.setItem("auth_token", "tok");
    mockUse.mockReturnValue({
      unreadCount: 3,
      loaded: true,
      refresh: vi.fn(),
      markAllRead: vi.fn(),
      setUnreadCount: vi.fn(),
    });
    renderBell();
    const badge = await screen.findByTestId("notifications-unread-badge");
    expect(badge.textContent).toBe("3");
    expect(screen.getByTestId("notifications-bell").getAttribute("aria-label")).toContain(
      "3 notification(s) non lue(s)",
    );
  });

  it("variante mobile : testid dédié et classe lg:hidden", async () => {
    window.localStorage.setItem("auth_token", "tok");
    renderBell({ variant: "mobile" });
    const link = await screen.findByTestId("notifications-bell-mobile");
    expect(link.className).toContain("lg:hidden");
  });

  it("formatUnreadBadge plafonne à 99+", () => {
    expect(formatUnreadBadge(1)).toBe("1");
    expect(formatUnreadBadge(99)).toBe("99");
    expect(formatUnreadBadge(150)).toBe("99+");
  });
});
