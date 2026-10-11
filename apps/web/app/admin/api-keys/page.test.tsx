import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/admin-api-keys", async (orig) => ({
  ...(await orig<typeof import("../../lib/admin-api-keys")>()),
  adminListApiKeys: vi.fn(),
  adminCreateApiKey: vi.fn(),
  adminRevokeApiKey: vi.fn(),
}));

import {
  adminCreateApiKey,
  adminListApiKeys,
  adminRevokeApiKey,
  type AdminApiKey,
} from "../../lib/admin-api-keys";
import AdminApiKeysPage from "./page";

const list = adminListApiKeys as unknown as ReturnType<typeof vi.fn>;
const create = adminCreateApiKey as unknown as ReturnType<typeof vi.fn>;
const revoke = adminRevokeApiKey as unknown as ReturnType<typeof vi.fn>;

function key(overrides: Partial<AdminApiKey> = {}): AdminApiKey {
  return {
    id: "k1",
    name: "Claude Code",
    keyPrefix: "nak_Ab12Cd34",
    scope: "read",
    status: "active",
    createdAt: "2026-10-11T12:00:00.000Z",
    expiresAt: "2027-01-09T12:00:00.000Z",
    lastUsedAt: null,
    lastUsedIp: null,
    revokedAt: null,
    revokedById: null,
    owner: { id: "admin-1", coachName: "Nuffle", email: "admin@example.test" },
    ...overrides,
  };
}

const SECRET = `nak_${"x".repeat(43)}`;

beforeEach(() => {
  vi.resetAllMocks();
  list.mockResolvedValue([]);
});

describe("AdminApiKeysPage", () => {
  it("liste les clés avec statut, portée, expiration et dernier usage", async () => {
    list.mockResolvedValue([
      key(),
      key({ id: "k2", name: "CI", scope: "write", expiresAt: null }),
      key({ id: "k3", status: "revoked", revokedAt: "2026-10-12T00:00:00.000Z" }),
    ]);
    render(<AdminApiKeysPage />);

    const first = await screen.findByTestId("api-key-row-k1");
    expect(first.textContent).toContain("nak_Ab12Cd34…");
    expect(first.textContent).toContain("Active");
    expect(first.textContent).toContain("Lecture seule");
    expect(first.textContent).toContain("Jamais utilisée");
    expect(first.textContent).toContain("Propriétaire : Nuffle");

    const second = screen.getByTestId("api-key-row-k2");
    expect(second.textContent).toContain("Lecture et écriture");
    expect(second.textContent).toContain("Sans expiration");

    // Une clé révoquée ne se révoque plus.
    expect(screen.getByTestId("api-key-row-k3").textContent).toContain("Révoquée");
    expect(screen.queryByTestId("api-key-revoke-k3")).toBeNull();
    expect(screen.getByTestId("api-key-revoke-k1")).toBeTruthy();
  });

  it("état vide", async () => {
    render(<AdminApiKeysPage />);
    expect(await screen.findByTestId("api-keys-empty")).toBeTruthy();
  });

  it("crée une clé en lecture seule / 90 jours par défaut et affiche le secret une fois", async () => {
    create.mockResolvedValueOnce({ key: key(), secret: SECRET });
    render(<AdminApiKeysPage />);
    await screen.findByTestId("api-keys-empty");

    fireEvent.click(screen.getByTestId("api-keys-toggle-create"));
    fireEvent.change(screen.getByLabelText("Nom *"), { target: { value: "  Claude Code  " } });
    fireEvent.submit(screen.getByTestId("api-key-form"));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ name: "Claude Code", scope: "read", expiresInDays: 90 }),
    );
    expect((await screen.findByTestId("api-key-secret")).textContent).toBe(SECRET);
    const env = screen.getByTestId("api-key-env").textContent ?? "";
    expect(env).toMatch(/^NUFFLE_API_URL=\S+\nNUFFLE_API_KEY=nak_x+$/);

    // « J'ai copié » : le secret disparaît de la page.
    fireEvent.click(screen.getByTestId("api-key-dismiss"));
    expect(screen.queryByTestId("api-key-secret")).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it("une clé en écriture sans expiration se demande explicitement et affiche un avertissement", async () => {
    create.mockResolvedValueOnce({ key: key({ scope: "write", expiresAt: null }), secret: SECRET });
    render(<AdminApiKeysPage />);
    await screen.findByTestId("api-keys-empty");

    fireEvent.click(screen.getByTestId("api-keys-toggle-create"));
    fireEvent.change(screen.getByLabelText("Nom *"), { target: { value: "CI" } });
    expect(screen.queryByTestId("api-key-write-warning")).toBeNull();
    fireEvent.click(screen.getByDisplayValue("write"));
    expect(screen.getByTestId("api-key-write-warning")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Expiration"), { target: { value: "" } });
    fireEvent.submit(screen.getByTestId("api-key-form"));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ name: "CI", scope: "write", expiresInDays: null }),
    );
  });

  it("copie le secret dans le presse-papiers", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    create.mockResolvedValueOnce({ key: key(), secret: SECRET });
    render(<AdminApiKeysPage />);
    await screen.findByTestId("api-keys-empty");
    fireEvent.click(screen.getByTestId("api-keys-toggle-create"));
    fireEvent.change(screen.getByLabelText("Nom *"), { target: { value: "CI" } });
    fireEvent.submit(screen.getByTestId("api-key-form"));

    fireEvent.click(await screen.findByTestId("api-key-copy-secret"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET));
    expect(await screen.findByText("✓ Copiée")).toBeTruthy();
  });

  it("révoque après confirmation et recharge la liste", async () => {
    list.mockResolvedValueOnce([key()]).mockResolvedValueOnce([key({ status: "revoked" })]);
    revoke.mockResolvedValueOnce({ key: key({ status: "revoked" }), alreadyRevoked: false });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminApiKeysPage />);

    fireEvent.click(await screen.findByTestId("api-key-revoke-k1"));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("k1"));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("api-key-revoke-k1")).toBeNull());
    confirmSpy.mockRestore();
  });

  it("ne révoque rien si la confirmation est refusée", async () => {
    list.mockResolvedValue([key()]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminApiKeysPage />);
    fireEvent.click(await screen.findByTestId("api-key-revoke-k1"));
    expect(revoke).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("explique comment brancher la clé sur Claude Code sans la coller dans une conversation", async () => {
    render(<AdminApiKeysPage />);
    const help = await screen.findByTestId("api-keys-help");
    expect(help.textContent).toContain("NUFFLE_API_KEY");
    expect(help.textContent).toContain("pnpm smoke:remote");
    expect(help.textContent).toContain("Ne collez jamais la clé dans une conversation");
  });
});
