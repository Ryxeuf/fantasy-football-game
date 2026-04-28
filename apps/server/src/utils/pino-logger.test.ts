/**
 * Tests pour l'adaptateur pino (tâche S25.1).
 *
 * Vérifie que `pinoServerLogImpl` peut être branché via `setServerLogImpl`
 * et que les niveaux pino reçoivent bien les payloads attendus, puis qu'un
 * call site `serverLog.error(...)` produit une ligne JSON structurée.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPinoServerLogImpl,
  formatLogArgs,
} from "./pino-logger";
import {
  serverLog,
  resetServerLogImpl,
  setServerLogImpl,
} from "./server-log";

describe("pino-logger adapter", () => {
  afterEach(() => {
    resetServerLogImpl();
  });

  describe("formatLogArgs", () => {
    it("retourne msg seul quand un unique string", () => {
      expect(formatLogArgs(["hello"])).toEqual({ msg: "hello", obj: {} });
    });

    it("merge un objet en première position dans obj, msg vide", () => {
      const arg = { foo: "bar" };
      expect(formatLogArgs([arg])).toEqual({ msg: "", obj: { foo: "bar" } });
    });

    it("extrait une Error dans obj.err et garde le contexte string en msg", () => {
      const err = new Error("boom");
      const out = formatLogArgs(["context", err]);
      expect(out.msg).toBe("context");
      expect(out.obj.err).toBe(err);
    });

    it("concatène plusieurs strings en un seul msg", () => {
      expect(formatLogArgs(["a", "b", "c"])).toEqual({
        msg: "a b c",
        obj: {},
      });
    });

    it("convertit les valeurs non-string non-Error en parts de msg", () => {
      const out = formatLogArgs(["count=", 42, true]);
      expect(out.msg).toBe("count= 42 true");
    });
  });

  describe("buildPinoServerLogImpl", () => {
    it("appelle pino avec le bon niveau et le bon msg", () => {
      const calls: Array<{ level: string; obj: unknown; msg: string }> = [];
      const fakePino = {
        info: (obj: unknown, msg: string) => calls.push({ level: "info", obj, msg }),
        warn: (obj: unknown, msg: string) => calls.push({ level: "warn", obj, msg }),
        error: (obj: unknown, msg: string) => calls.push({ level: "error", obj, msg }),
        debug: (obj: unknown, msg: string) => calls.push({ level: "debug", obj, msg }),
        trace: (obj: unknown, msg: string) => calls.push({ level: "trace", obj, msg }),
      };

      const impl = buildPinoServerLogImpl(fakePino as never);
      impl.log("hello");
      impl.info("info", { user: 1 });
      impl.warn("attention");
      impl.error("contexte", new Error("boom"));
      impl.debug("trace");

      expect(calls).toHaveLength(5);
      expect(calls[0]).toEqual({ level: "info", obj: {}, msg: "hello" });
      expect(calls[1].obj).toEqual({ user: 1 });
      expect(calls[1].msg).toBe("info");
      expect(calls[2]).toEqual({ level: "warn", obj: {}, msg: "attention" });
      expect(calls[3].level).toBe("error");
      expect((calls[3].obj as { err: Error }).err).toBeInstanceOf(Error);
      expect(calls[3].msg).toBe("contexte");
      expect(calls[4].level).toBe("debug");
    });

    it("est compatible avec setServerLogImpl pour basculer toute la stack", () => {
      const recorded: Array<{ level: string; msg: string }> = [];
      const fakePino = {
        info: (_obj: unknown, msg: string) => recorded.push({ level: "info", msg }),
        warn: (_obj: unknown, msg: string) => recorded.push({ level: "warn", msg }),
        error: (_obj: unknown, msg: string) => recorded.push({ level: "error", msg }),
        debug: (_obj: unknown, msg: string) => recorded.push({ level: "debug", msg }),
        trace: (_obj: unknown, msg: string) => recorded.push({ level: "trace", msg }),
      };

      setServerLogImpl(buildPinoServerLogImpl(fakePino as never));
      serverLog.info("user logged in");
      serverLog.error("query failed", new Error("timeout"));

      expect(recorded).toHaveLength(2);
      expect(recorded[0]).toEqual({ level: "info", msg: "user logged in" });
      expect(recorded[1]).toEqual({ level: "error", msg: "query failed" });
    });
  });

  describe("integration with real pino", () => {
    it("emet une ligne JSON valide avec niveau et msg", async () => {
      // Capture stdout pour verifier qu'on emet bien du NDJSON.
      const writes: string[] = [];
      const fakeStream = {
        write: (chunk: string) => {
          writes.push(chunk);
          return true;
        },
      };

      const { default: pinoFactory } = await import("pino");
      const realPino = pinoFactory(
        { level: "debug", base: undefined, timestamp: false },
        fakeStream as never,
      );
      const impl = buildPinoServerLogImpl(realPino);
      impl.error("[auth] login refused", new Error("bad password"));
      impl.info("[match] created", { matchId: "m-1" });

      expect(writes).toHaveLength(2);
      const errLine = JSON.parse(writes[0]);
      expect(errLine.level).toBe(50);
      expect(errLine.msg).toBe("[auth] login refused");
      expect(errLine.err).toBeDefined();
      expect(errLine.err.message).toBe("bad password");

      const infoLine = JSON.parse(writes[1]);
      expect(infoLine.level).toBe(30);
      expect(infoLine.msg).toBe("[match] created");
      expect(infoLine.matchId).toBe("m-1");
    });
  });
});
