import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../config", () => ({ JWT_SECRET: "test-secret" }));
vi.mock("../services/api-keys", () => ({ authenticateApiKey: vi.fn() }));
vi.mock("../services/featureFlags", () => ({ isEnabled: vi.fn() }));

import { authenticateApiKey } from "../services/api-keys";
import { isEnabled } from "../services/featureFlags";
import { generateApiKey, type ApiKeyEvaluation } from "../services/api-key-rules";
import {
  createAuditContext,
  getAuditContext,
  runWithAuditContext,
} from "../utils/audit-context";
import { authUser, optionalAuthUser, type AuthenticatedRequest } from "./authUser";
import { requireFeatureFlag } from "./requireFeatureFlag";
import { sessionOnly } from "./sessionOnly";

const mockedAuthenticate = vi.mocked(authenticateApiKey);
const mockedIsEnabled = vi.mocked(isEnabled);

const SECRET = generateApiKey().secret;

const OK_WRITE: ApiKeyEvaluation = {
  ok: true,
  identity: {
    apiKeyId: "key-1",
    name: "CI",
    keyPrefix: SECRET.slice(0, 12),
    scope: "write",
    userId: "admin-1",
    roles: ["admin"],
  },
};
const OK_READ: ApiKeyEvaluation = {
  ok: true,
  identity: { ...OK_WRITE.identity, scope: "read" },
} as ApiKeyEvaluation;

function req(
  headers: Record<string, string>,
  method = "GET",
): AuthenticatedRequest {
  return { headers, method, ip: "203.0.113.7" } as unknown as AuthenticatedRequest;
}

function res() {
  const r: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
    status: vi.fn(),
    json: vi.fn(),
  };
  r.status.mockReturnValue(r);
  r.json.mockReturnValue(r);
  return r;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("authUser — clé API", () => {
  it("authentifie le propriétaire avec ses rôles et annonce la clé", async () => {
    mockedAuthenticate.mockResolvedValueOnce(OK_WRITE);
    const request = req({ authorization: `Bearer ${SECRET}` }, "POST");
    const response = res();
    const next = vi.fn();

    await runWithAuditContext(createAuditContext(), async () => {
      await authUser(request, response as never, next);
      expect(getAuditContext()?.actorUserId).toBe("admin-1");
      expect(getAuditContext()?.apiKeyId).toBe("key-1");
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.user).toEqual({
      id: "admin-1",
      role: "admin",
      roles: ["admin"],
      apiKey: { id: "key-1", name: "CI", keyPrefix: SECRET.slice(0, 12), scope: "write" },
    });
    expect(mockedAuthenticate).toHaveBeenCalledWith(SECRET, { ip: "203.0.113.7" });
  });

  it("accepte l'en-tête X-API-Key", async () => {
    mockedAuthenticate.mockResolvedValueOnce(OK_READ);
    const request = req({ "x-api-key": SECRET });
    const next = vi.fn();
    await authUser(request, res() as never, next);
    expect(next).toHaveBeenCalled();
    expect(request.user?.apiKey?.scope).toBe("read");
  });

  it("refuse une clé inutilisable en 401, sans dire pourquoi", async () => {
    mockedAuthenticate.mockResolvedValueOnce({ ok: false, reason: "revoked" });
    const response = res();
    const next = vi.fn();
    await authUser(req({ authorization: `Bearer ${SECRET}` }), response as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: "Clé API invalide",
      code: "api_key_invalid",
    });
  });

  it("refuse une écriture avec une clé en lecture seule (403)", async () => {
    mockedAuthenticate.mockResolvedValueOnce(OK_READ);
    const request = req({ authorization: `Bearer ${SECRET}` }, "DELETE");
    const response = res();
    const next = vi.fn();
    await authUser(request, response as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json.mock.calls[0][0].code).toBe("api_key_read_only");
    expect(request.user).toBeUndefined();
  });

  it("rend 500 si la vérification plante", async () => {
    mockedAuthenticate.mockRejectedValueOnce(new Error("db down"));
    const response = res();
    await authUser(req({ authorization: `Bearer ${SECRET}` }), response as never, vi.fn());
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("ne résout la clé qu'une fois par requête, même à travers plusieurs authUser", async () => {
    mockedAuthenticate.mockResolvedValueOnce(OK_WRITE);
    const request = req({ authorization: `Bearer ${SECRET}` });
    const next = vi.fn();
    await authUser(request, res() as never, next);
    await authUser(request, res() as never, next);
    expect(mockedAuthenticate).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("laisse un JWT au chemin JWT, synchrone", () => {
    const token = jwt.sign({ sub: "coach-1", roles: ["user"] }, "test-secret");
    const request = req({ authorization: `Bearer ${token}` });
    const next = vi.fn();
    const result = authUser(request, res() as never, next);
    expect(result).not.toBeInstanceOf(Promise);
    expect(next).toHaveBeenCalled();
    expect(request.user).toEqual({ id: "coach-1", role: "user", roles: ["user"] });
    expect(mockedAuthenticate).not.toHaveBeenCalled();
  });
});

describe("optionalAuthUser — clé API", () => {
  it("sert la vue publique pour une clé refusée", async () => {
    mockedAuthenticate.mockResolvedValueOnce({ ok: false, reason: "expired" });
    const request = req({ authorization: `Bearer ${SECRET}` });
    const response = res();
    const next = vi.fn();
    await optionalAuthUser(request, response as never, next);
    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it("authentifie une clé valide", async () => {
    mockedAuthenticate.mockResolvedValueOnce(OK_READ);
    const request = req({ authorization: `Bearer ${SECRET}` });
    const next = vi.fn();
    await optionalAuthUser(request, res() as never, next);
    expect(request.user?.id).toBe("admin-1");
  });

  it("refuse quand même une écriture avec une clé en lecture seule", async () => {
    mockedAuthenticate.mockResolvedValueOnce(OK_READ);
    const response = res();
    const next = vi.fn();
    await optionalAuthUser(req({ authorization: `Bearer ${SECRET}` }, "POST"), response as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });
});

describe("requireFeatureFlag — clé API", () => {
  it("évalue le flag pour le propriétaire de la clé", async () => {
    mockedAuthenticate.mockResolvedValueOnce(OK_READ);
    mockedIsEnabled.mockResolvedValueOnce(true);
    const next = vi.fn();
    await requireFeatureFlag("crowns")(req({ authorization: `Bearer ${SECRET}` }), res() as never, next);
    expect(mockedIsEnabled).toHaveBeenCalledWith("crowns", "admin-1", { roles: ["admin"] });
    expect(next).toHaveBeenCalled();
  });

  it("évalue sans contexte pour une clé refusée", async () => {
    mockedAuthenticate.mockResolvedValueOnce({ ok: false, reason: "unknown" });
    mockedIsEnabled.mockResolvedValueOnce(false);
    const response = res();
    await requireFeatureFlag("crowns")(req({ authorization: `Bearer ${SECRET}` }), response as never, vi.fn());
    expect(mockedIsEnabled).toHaveBeenCalledWith("crowns", undefined, { roles: [] });
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it("partage la résolution avec authUser", async () => {
    mockedAuthenticate.mockResolvedValueOnce(OK_READ);
    mockedIsEnabled.mockResolvedValueOnce(true);
    const request = req({ authorization: `Bearer ${SECRET}` });
    await requireFeatureFlag("crowns")(request, res() as never, vi.fn());
    await authUser(request, res() as never, vi.fn());
    expect(mockedAuthenticate).toHaveBeenCalledTimes(1);
  });
});

describe("sessionOnly", () => {
  it("refuse une requête authentifiée par clé", () => {
    const request = req({});
    request.user = {
      id: "admin-1",
      roles: ["admin"],
      apiKey: { id: "key-1", name: "CI", keyPrefix: "nak_x", scope: "write" },
    };
    const response = res();
    const next = vi.fn();
    sessionOnly(request, response as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json.mock.calls[0][0].code).toBe("interactive_session_required");
  });

  it("refuse une session d'impersonation (elle survivrait à son TTL d'1 h)", () => {
    const request = req({});
    request.user = { id: "admin-2", roles: ["admin"], impersonatorId: "admin-1" };
    const response = res();
    const next = vi.fn();
    sessionOnly(request, response as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json.mock.calls[0][0].code).toBe("impersonation_not_allowed");
  });

  it("laisse passer une session JWT", () => {
    const request = req({});
    request.user = { id: "admin-1", roles: ["admin"] };
    const next = vi.fn();
    sessionOnly(request, res() as never, next);
    expect(next).toHaveBeenCalled();
  });
});
