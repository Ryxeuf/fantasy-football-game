/**
 * Token d'impersonation admin (« se connecter en tant que »).
 *
 * - `sub` = utilisateur cible, `act` = admin a l'origine, `imp: true`.
 * - `typ: "access"` : c'est un access token normal, accepte par `authUser`.
 * - Les roles sont ceux de la cible (l'admin n'herite pas de ses droits).
 * - TTL court borne par IMPERSONATION_TOKEN_TTL_SECONDS, aucun refresh.
 */

import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import {
  signImpersonationToken,
  IMPERSONATION_TOKEN_TTL_SECONDS,
} from "./auth-tokens";

describe("signImpersonationToken", () => {
  it("encode sub (cible), act (admin), imp=true et typ=access", () => {
    const token = signImpersonationToken({
      sub: "target-1",
      role: "user",
      roles: ["user"],
      act: "admin-9",
    });

    const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    expect(payload.sub).toBe("target-1");
    expect(payload.act).toBe("admin-9");
    expect(payload.imp).toBe(true);
    expect(payload.typ).toBe("access");
    expect(payload.roles).toEqual(["user"]);
    expect(payload.role).toBe("user");
  });

  it("porte les roles de la CIBLE, pas ceux de l'admin", () => {
    // Cible non-admin : le token ne doit pas conferer le role admin meme si
    // l'impersonation est declenchee par un admin.
    const token = signImpersonationToken({
      sub: "target-1",
      role: "user",
      roles: ["user"],
      act: "admin-9",
    });
    const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    expect(payload.roles).not.toContain("admin");
  });

  it("expire selon IMPERSONATION_TOKEN_TTL_SECONDS (1h, borne courte)", () => {
    expect(IMPERSONATION_TOKEN_TTL_SECONDS).toBe(60 * 60);
    const token = signImpersonationToken({
      sub: "target-1",
      role: "user",
      roles: ["user"],
      act: "admin-9",
    });
    const payload = jwt.verify(token, JWT_SECRET) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(IMPERSONATION_TOKEN_TTL_SECONDS);
  });
});
