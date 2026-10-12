import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../lib/auditLog", () => ({ fetchAuditLog: vi.fn() }));

import { fetchAuditLog, type AuditLogEntry } from "../../lib/auditLog";
import AdminAuditLogPage from "./page";

const fetchMock = fetchAuditLog as unknown as ReturnType<typeof vi.fn>;

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "e1",
    userId: "admin-1",
    action: "user.role.update",
    entity: "User",
    entityId: "u1",
    oldValue: null,
    newValue: null,
    ipAddress: "203.0.113.7",
    userAgent: null,
    createdAt: "2026-10-11T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AdminAuditLogPage — clés API", () => {
  it("signale les actions passées par une clé API, et seulement elles", async () => {
    fetchMock.mockResolvedValue({
      entries: [
        entry({ id: "by-key", apiKeyId: "key-1" }),
        entry({ id: "by-session", apiKeyId: null }),
        // Serveur antérieur aux clés : le champ est absent.
        entry({ id: "legacy" }),
      ],
      total: 3,
      page: 1,
      limit: 50,
    });
    render(<AdminAuditLogPage />);

    const badge = await screen.findByTestId("audit-api-key-by-key");
    expect(badge.textContent).toContain("clé API");
    expect(badge.getAttribute("title")).toContain("key-1");
    expect(screen.queryByTestId("audit-api-key-by-session")).toBeNull();
    expect(screen.queryByTestId("audit-api-key-legacy")).toBeNull();
  });
});
