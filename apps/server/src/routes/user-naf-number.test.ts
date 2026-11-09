/**
 * `PUT /user/naf-number` et `POST /user/naf-number/verify` — numéro NAF
 * vérifié automatiquement auprès de thenaf.net.
 *
 * Chaîne Express réelle (authUser → sessionOnly → validate → handler), JWT
 * réels signés avec `JWT_SECRET`, Prisma mocké, et la VÉRIFICATION mockée :
 * aucun appel réseau dans les tests (cf. `naf-verification.test.ts` pour le
 * fetcher sur pages réelles).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../services/naf-verification", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/naf-verification")>();
  return { ...actual, verifyNafNumber: vi.fn() };
});

import router from "./user";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";
import { verifyNafNumber } from "../services/naf-verification";

const mockedVerify = vi.mocked(verifyNafNumber);
const mockedFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = prisma.user.update as unknown as ReturnType<typeof vi.fn>;

const TOKEN = jwt.sign({ sub: "user-1", roles: ["user"] }, JWT_SECRET);
const IMPERSONATION = jwt.sign(
  { sub: "user-1", roles: ["user"], act: "admin-1" },
  JWT_SECRET,
);

async function request(
  method: "PUT" | "POST",
  path: string,
  json?: unknown,
  token: string | null = TOKEN,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use("/user", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const payload = Buffer.from(json === undefined ? "" : JSON.stringify(json));
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": payload.length.toString(),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              body: buf ? (JSON.parse(buf) as Record<string, unknown>) : {},
            });
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      if (payload.length) req.write(payload);
      req.end();
    });
  });
}

/** `update` renvoie la ligne fusionnée avec ce qu'on écrit. */
function updateEchoes(base: Record<string, unknown> = {}) {
  mockedUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    nafNumber: null,
    nafName: null,
    nafVerifiedAt: null,
    ...base,
    ...data,
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PUT /user/naf-number", () => {
  it("numéro trouvé : enregistre numéro, date de vérification et nom NAF officiel", async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockedVerify.mockResolvedValue({
      status: "verified",
      nafNumber: 7221,
      nafName: "#5Renton",
      nation: "Spain",
    });
    updateEchoes();

    const res = await request("PUT", "/user/naf-number", { nafNumber: "7221" });

    expect(res.status).toBe(200);
    expect(mockedVerify).toHaveBeenCalledWith(7221, undefined);
    const data = mockedUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ nafNumber: 7221, nafName: "#5Renton" });
    expect(data.nafVerifiedAt).toBeInstanceOf(Date);
    expect(res.body).toMatchObject({
      nafNumber: 7221,
      nafName: "#5Renton",
      verified: true,
      nafCoachUrl: expect.stringContaining("coach=7221"),
    });
  });

  it("numéro introuvable : 422 naf_not_found, rien d'enregistré", async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockedVerify.mockResolvedValue({ status: "not_found" });

    const res = await request("PUT", "/user/naf-number", { nafNumber: 99 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("naf_not_found");
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("NAF injoignable : numéro enregistré EN ATTENTE (verified: false)", async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockedVerify.mockResolvedValue({ status: "unavailable", reason: "network" });
    updateEchoes({ nafName: "MonPseudo" });

    const res = await request("PUT", "/user/naf-number", { nafNumber: 7221 });

    expect(res.status).toBe(200);
    expect(mockedUpdate.mock.calls[0][0].data).toEqual({
      nafNumber: 7221,
      nafVerifiedAt: null,
    });
    expect(res.body).toMatchObject({ nafNumber: 7221, verified: false, nafName: "MonPseudo" });
  });

  it("NAF injoignable sur le MÊME numéro déjà vérifié : la vérification est gardée", async () => {
    const verifiedAt = new Date("2026-11-01T10:00:00Z");
    mockedFindUnique
      .mockResolvedValueOnce({ id: "user-1" }) // propriétaire du numéro
      .mockResolvedValueOnce({ nafNumber: 7221, nafName: "#5Renton", nafVerifiedAt: verifiedAt });
    mockedVerify.mockResolvedValue({ status: "unavailable", reason: "http" });
    updateEchoes();

    const res = await request("PUT", "/user/naf-number", { nafNumber: 7221 });

    expect(res.status).toBe(200);
    expect(mockedUpdate.mock.calls[0][0].data.nafVerifiedAt).toEqual(verifiedAt);
    expect(res.body.verified).toBe(true);
  });

  it("numéro déjà pris par un autre compte : 409 naf_number_taken, sans appel NAF", async () => {
    mockedFindUnique.mockResolvedValueOnce({ id: "other-user" });

    const res = await request("PUT", "/user/naf-number", { nafNumber: 7221 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("naf_number_taken");
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it("course sur la contrainte unique (P2002) : 409 naf_number_taken", async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockedVerify.mockResolvedValue({
      status: "verified",
      nafNumber: 7221,
      nafName: "#5Renton",
    });
    mockedUpdate.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    const res = await request("PUT", "/user/naf-number", { nafNumber: 7221 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("naf_number_taken");
  });

  it.each([null, ""])("%j efface le numéro et sa vérification, pas nafName", async (value) => {
    updateEchoes({ nafName: "MonPseudo" });

    const res = await request("PUT", "/user/naf-number", { nafNumber: value });

    expect(res.status).toBe(200);
    expect(mockedUpdate.mock.calls[0][0].data).toEqual({
      nafNumber: null,
      nafVerifiedAt: null,
    });
    expect(mockedVerify).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ nafNumber: null, nafName: "MonPseudo", verified: false });
  });

  it.each([["12345678"], ["12a"], [0], [-3], [1.5], ["0"]])(
    "format invalide (%j) : 400 sans appel NAF",
    async (value) => {
      const res = await request("PUT", "/user/naf-number", { nafNumber: value });
      expect(res.status).toBe(400);
      expect(mockedVerify).not.toHaveBeenCalled();
    },
  );

  it("sans session : 401", async () => {
    const res = await request("PUT", "/user/naf-number", { nafNumber: 7221 }, null);
    expect(res.status).toBe(401);
  });

  it("pendant une impersonation : 403 (sessionOnly)", async () => {
    const res = await request("PUT", "/user/naf-number", { nafNumber: 7221 }, IMPERSONATION);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("impersonation_not_allowed");
  });
});

describe("POST /user/naf-number/verify", () => {
  it("retente : trouvé ⇒ vérifié", async () => {
    mockedFindUnique.mockResolvedValue({ nafNumber: 7221, nafName: null, nafVerifiedAt: null });
    mockedVerify.mockResolvedValue({
      status: "verified",
      nafNumber: 7221,
      nafName: "#5Renton",
    });
    updateEchoes({ nafNumber: 7221 });

    const res = await request("POST", "/user/naf-number/verify");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nafNumber: 7221, nafName: "#5Renton", verified: true });
  });

  it("toujours injoignable : état inchangé, en attente", async () => {
    mockedFindUnique.mockResolvedValue({ nafNumber: 7221, nafName: null, nafVerifiedAt: null });
    mockedVerify.mockResolvedValue({ status: "unavailable", reason: "network" });

    const res = await request("POST", "/user/naf-number/verify");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nafNumber: 7221, verified: false });
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("numéro disparu de l'annuaire : 422 et vérification retirée", async () => {
    mockedFindUnique.mockResolvedValue({
      nafNumber: 7221,
      nafName: "#5Renton",
      nafVerifiedAt: new Date(),
    });
    mockedVerify.mockResolvedValue({ status: "not_found" });
    updateEchoes({ nafNumber: 7221 });

    const res = await request("POST", "/user/naf-number/verify");

    expect(res.status).toBe(422);
    expect(mockedUpdate.mock.calls[0][0].data).toEqual({ nafVerifiedAt: null });
  });

  it("aucun numéro enregistré : 400 naf_number_missing", async () => {
    mockedFindUnique.mockResolvedValue({ nafNumber: null, nafName: null, nafVerifiedAt: null });

    const res = await request("POST", "/user/naf-number/verify");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("naf_number_missing");
  });
});
