/**
 * Tests pour le wrapper de logging serveur (tâche S24.8).
 *
 * Le wrapper délègue aux `console.*` par défaut tout en permettant
 * d'injecter une autre implémentation (préparation S25 → pino) sans
 * toucher chaque call site.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  serverLog,
  setServerLogImpl,
  resetServerLogImpl,
  type ServerLogImpl,
} from "./server-log";

describe("serverLog wrapper", () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => undefined),
      info: vi.spyOn(console, "info").mockImplementation(() => undefined),
      warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
      error: vi.spyOn(console, "error").mockImplementation(() => undefined),
      debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
    };
  });

  afterEach(() => {
    resetServerLogImpl();
    Object.values(consoleSpy).forEach((s) => s.mockRestore());
  });

  describe("default delegation to console", () => {
    it("serverLog.log délègue à console.log", () => {
      serverLog.log("hello", 42);
      expect(consoleSpy.log).toHaveBeenCalledWith("hello", 42);
    });

    it("serverLog.info délègue à console.info", () => {
      serverLog.info("message", { foo: "bar" });
      expect(consoleSpy.info).toHaveBeenCalledWith("message", { foo: "bar" });
    });

    it("serverLog.warn délègue à console.warn", () => {
      serverLog.warn("attention");
      expect(consoleSpy.warn).toHaveBeenCalledWith("attention");
    });

    it("serverLog.error délègue à console.error avec une Error", () => {
      const err = new Error("boom");
      serverLog.error("contexte", err);
      expect(consoleSpy.error).toHaveBeenCalledWith("contexte", err);
    });

    it("serverLog.debug délègue à console.debug", () => {
      serverLog.debug("trace");
      expect(consoleSpy.debug).toHaveBeenCalledWith("trace");
    });
  });

  describe("implementation swap (préparation pino S25)", () => {
    it("setServerLogImpl remplace toutes les méthodes par l'impl injectée", () => {
      const fake: ServerLogImpl = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      setServerLogImpl(fake);
      serverLog.log("a");
      serverLog.info("b");
      serverLog.warn("c");
      serverLog.error("d");
      serverLog.debug("e");

      expect(fake.log).toHaveBeenCalledWith("a");
      expect(fake.info).toHaveBeenCalledWith("b");
      expect(fake.warn).toHaveBeenCalledWith("c");
      expect(fake.error).toHaveBeenCalledWith("d");
      expect(fake.debug).toHaveBeenCalledWith("e");
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it("resetServerLogImpl restaure le delegation console par défaut", () => {
      setServerLogImpl({
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      });

      resetServerLogImpl();
      serverLog.error("après reset");
      expect(consoleSpy.error).toHaveBeenCalledWith("après reset");
    });

    it("ne mute pas l'objet impl injecté (immutabilité)", () => {
      const fake: ServerLogImpl = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      const snapshot = { ...fake };

      setServerLogImpl(fake);
      serverLog.log("x");

      expect(fake).toEqual(snapshot);
    });
  });

  describe("immutabilité de l'objet exporté", () => {
    it("serverLog ne peut pas être muté pour échapper au swap", () => {
      const customLog = vi.fn();
      // @ts-expect-error — on tente d'écraser une méthode pour vérifier la garde
      const writeAttempt = () => (serverLog.log = customLog);
      expect(writeAttempt).toThrow();
    });
  });
});
