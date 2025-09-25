import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fetch from "node-fetch";
import { spawn } from "child_process";

let serverProc: any;

const API_PORT = process.env.API_PORT || '18001';
const API_BASE = `http://localhost:${API_PORT}`;

describe("Auth API", () => {
  beforeAll(async () => {
    serverProc = spawn("pnpm", ["run", "dev:nowatch"], {
      cwd: "../../apps/server",
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        API_PORT,
        BGIO_PORT: process.env.BGIO_PORT || '18000',
        TEST_SQLITE: '1',
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || 'file:memdb1?mode=memory&cache=shared',
      },
    });
    await new Promise((r) => setTimeout(r, 3000));
  }, 30000);

  afterAll(async () => {
    if (serverProc) {
      serverProc.kill();
    }
  });

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


