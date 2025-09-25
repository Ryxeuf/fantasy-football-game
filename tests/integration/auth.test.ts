import { describe, it, expect } from "vitest";
import fetch from "node-fetch";

const API_PORT = process.env.API_PORT || '18001';
const API_BASE = `http://localhost:${API_PORT}`;

describe("Auth API", () => {
  // setup/teardown géré globalement dans setup.ts

  it("doit permettre l'inscription puis la connexion", async () => {
    const email = `test_${Date.now()}@example.com`;
    const password = "test1234";

    // Register
    const reg = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Tester" }),
    });
    expect(reg.status).toBe(201);
    const regBody: any = await reg.json();
    expect(regBody?.user?.email).toBe(email);
    expect(typeof regBody?.token).toBe("string");

    // Login
    const log = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(log.status).toBe(200);
    const logBody: any = await log.json();
    expect(logBody?.user?.email).toBe(email);
    expect(typeof logBody?.token).toBe("string");
  }, 20000);
});


