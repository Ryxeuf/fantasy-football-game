/**
 * Tests pour le CPU profiler des slow sims (Lot 4.A.2).
 *
 * Le profiler est branche sur `node:inspector`. Pour rester unit-testable
 * sans demarrer une vraie session V8, on injecte un `InspectorAdapter`
 * mockable.
 *
 * Couvre :
 *   - FSM start -> recording -> stop avec un adapter mock.
 *   - `captureProfileIfSlow` n'ecrit le profile que si duration > seuil.
 *   - Defense-in-depth : un crash de l'adapter ne propage pas (best
 *     effort logging).
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildProfileFilename,
  captureProfileIfSlow,
  CpuProfilerSession,
  type InspectorAdapter,
} from "./sim-cpu-profiler";

function buildMockAdapter(): {
  adapter: InspectorAdapter;
  calls: { start: number; stop: number; lastProfile: object | null };
} {
  const calls = { start: 0, stop: 0, lastProfile: null as object | null };
  const fakeProfile = { nodes: [], samples: [], timeDeltas: [] };
  const adapter: InspectorAdapter = {
    async start() {
      calls.start += 1;
    },
    async stop() {
      calls.stop += 1;
      calls.lastProfile = fakeProfile;
      return fakeProfile;
    },
    dispose() {
      /* no-op */
    },
  };
  return { adapter, calls };
}

describe("CpuProfilerSession — Lot 4.A.2", () => {
  it("FSM : idle -> recording -> stopped", async () => {
    const { adapter, calls } = buildMockAdapter();
    const session = new CpuProfilerSession(adapter);

    expect(session.state).toBe("idle");
    await session.start();
    expect(session.state).toBe("recording");
    expect(calls.start).toBe(1);

    const profile = await session.stop();
    expect(session.state).toBe("stopped");
    expect(calls.stop).toBe(1);
    expect(profile).toBeDefined();
  });

  it("rejette stop avant start", async () => {
    const { adapter } = buildMockAdapter();
    const session = new CpuProfilerSession(adapter);
    await expect(session.stop()).rejects.toThrow(/not recording/i);
  });

  it("rejette double start (FSM strict)", async () => {
    const { adapter } = buildMockAdapter();
    const session = new CpuProfilerSession(adapter);
    await session.start();
    await expect(session.start()).rejects.toThrow(/already recording/i);
  });

  it("dispose appelle adapter.dispose", async () => {
    const adapter = buildMockAdapter().adapter;
    const disposeSpy = vi.fn();
    const session = new CpuProfilerSession({
      ...adapter,
      dispose: disposeSpy,
    });
    session.dispose();
    expect(disposeSpy).toHaveBeenCalledOnce();
  });
});

describe("buildProfileFilename — Lot 4.A.2", () => {
  it("inclut matchId + timestamp ISO + extension .cpuprofile", () => {
    const at = new Date("2026-05-09T12:34:56.789Z");
    const out = buildProfileFilename("m_abc123", at);
    expect(out).toContain("m_abc123");
    expect(out).toContain("2026-05-09T12-34-56");
    expect(out.endsWith(".cpuprofile")).toBe(true);
  });

  it("sanitize les caracteres interdits dans le matchId", () => {
    const at = new Date("2026-05-09T00:00:00Z");
    // Un matchId avec slash / colon est theoriquement impossible (cuid)
    // mais on se protège en runtime.
    const out = buildProfileFilename("a/b:c", at);
    expect(out).not.toMatch(/[/:]/);
  });
});

describe("captureProfileIfSlow — Lot 4.A.2", () => {
  it("ne sauvegarde pas si durationSec <= thresholdSec", async () => {
    const writes: Array<{ path: string; data: string }> = [];
    const out = await captureProfileIfSlow({
      profile: { nodes: [] },
      matchId: "m1",
      durationSec: 1.0,
      thresholdSec: 5.0,
      profileDir: "/tmp/sim-profiles",
      writeFile: async (path, data) => {
        writes.push({ path, data });
      },
    });
    expect(out.saved).toBe(false);
    expect(out.path).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it("sauvegarde le profile JSON quand le sim est slow", async () => {
    const writes: Array<{ path: string; data: string }> = [];
    const profile = { nodes: [{ id: 1 }], samples: [1] };
    const out = await captureProfileIfSlow({
      profile,
      matchId: "m_slow",
      durationSec: 7.5,
      thresholdSec: 5.0,
      profileDir: "/tmp/sim-profiles",
      writeFile: async (path, data) => {
        writes.push({ path, data });
      },
    });
    expect(out.saved).toBe(true);
    expect(out.path).toMatch(/m_slow/);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0].data)).toEqual(profile);
  });

  it("propage l'erreur du writeFile sans crasher (returns saved=false)", async () => {
    const out = await captureProfileIfSlow({
      profile: { nodes: [] },
      matchId: "m_slow",
      durationSec: 7.5,
      thresholdSec: 5.0,
      profileDir: "/tmp/sim-profiles",
      writeFile: async () => {
        throw new Error("disk full");
      },
    });
    expect(out.saved).toBe(false);
    expect(out.error).toMatch(/disk full/);
  });

  it("ne sauvegarde pas si profile est null/undefined", async () => {
    const writes: Array<{ path: string; data: string }> = [];
    const out = await captureProfileIfSlow({
      profile: null,
      matchId: "m",
      durationSec: 7.5,
      thresholdSec: 5.0,
      profileDir: "/tmp/sim-profiles",
      writeFile: async (path, data) => {
        writes.push({ path, data });
      },
    });
    expect(out.saved).toBe(false);
    expect(out.path).toBeNull();
    expect(writes).toHaveLength(0);
  });
});
