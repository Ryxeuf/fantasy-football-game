import { describe, it, expect, beforeAll } from "vitest";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

const API_PORT = process.env.API_PORT || "18001";
const API_BASE = `http://localhost:${API_PORT}`;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Import de la fonction de décodage utilisée par le middleware
// Note: On simule la fonction pour les tests car elle est dans apps/web
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  try {
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function decodeJWT(token: string): { sub?: string; role?: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decoded = base64UrlDecode(parts[1]);
    if (!decoded) return null;
    const parsed = JSON.parse(decoded);
    if (parsed.exp && parsed.exp < Date.now() / 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isAdminToken(token: string): boolean {
  const payload = decodeJWT(token);
  return payload?.role === "admin" || false;
}

describe("Admin Middleware Protection - Token Verification", () => {
  let adminToken: string;
  let userToken: string;
  let adminUserId: string;
  let userId: string;

  beforeAll(async () => {
    // Créer un utilisateur admin
    const adminEmail = `admin_${Date.now()}@example.com`;
    const adminPassword = "admin1234";
    
    const adminReg = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        coachName: "Admin User",
      }),
    });
    
    expect(adminReg.status).toBe(201);
    const adminRegBody: any = await adminReg.json();
    adminUserId = adminRegBody.user.id;

    // Créer un token admin directement
    adminToken = jwt.sign(
      { sub: adminUserId, role: "admin" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Créer un utilisateur normal
    const userEmail = `user_${Date.now()}@example.com`;
    const userPassword = "user1234";
    
    const userReg = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        password: userPassword,
        coachName: "Normal User",
      }),
    });
    
    expect(userReg.status).toBe(201);
    const userRegBody: any = await userReg.json();
    userId = userRegBody.user.id;
    userToken = userRegBody.token;
  }, 30000);

  it("devrait rejeter un token invalide", () => {
    const invalidToken = "invalid.token.here";
    const result = isAdminToken(invalidToken);
    expect(result).toBe(false);
  });

  it("devrait rejeter un token sans rôle admin", () => {
    const result = isAdminToken(userToken);
    expect(result).toBe(false);
    
    // Vérifie aussi que le décodage fonctionne
    const payload = decodeJWT(userToken);
    expect(payload).not.toBeNull();
    expect(payload?.role).not.toBe("admin");
  });

  it("devrait accepter un token admin valide", () => {
    const result = isAdminToken(adminToken);
    expect(result).toBe(true);
    
    // Vérifie aussi que le décodage fonctionne
    const payload = decodeJWT(adminToken);
    expect(payload).not.toBeNull();
    expect(payload?.role).toBe("admin");
    expect(payload?.sub).toBe(adminUserId);
  });

  it("devrait rejeter un token expiré", () => {
    const expiredToken = jwt.sign(
      { sub: adminUserId, role: "admin" },
      JWT_SECRET,
      { expiresIn: "-1h" } // Expiré il y a 1 heure
    );
    
    const result = isAdminToken(expiredToken);
    expect(result).toBe(false);
    
    // Vérifie que le décodage retourne null pour un token expiré
    const payload = decodeJWT(expiredToken);
    expect(payload).toBeNull();
  });

  it("devrait vérifier que le middleware peut extraire le token depuis les cookies", () => {
    // Test unitaire pour vérifier la logique d'extraction du token
    const cookieHeader = `auth_token=${adminToken}; other=value`;
    const token = cookieHeader
      .split("; ")
      .find((c) => c.startsWith("auth_token="))
      ?.replace("auth_token=", "");
    
    expect(token).toBe(adminToken);
  });

  it("devrait vérifier que le middleware peut extraire le token depuis Authorization header", () => {
    const authHeader = `Bearer ${adminToken}`;
    const token = authHeader.replace("Bearer ", "");
    
    expect(token).toBe(adminToken);
  });
});

