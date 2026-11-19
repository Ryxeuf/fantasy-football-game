/**
 * Requête HTTP réelle contre une app Express montée pour un test (supertest
 * n'est pas une dépendance du repo, cf. CLAUDE.md). Le serveur écoute sur un
 * port libre et se ferme à la réponse.
 */

import http from "node:http";
import type { Express } from "express";

export interface TestResponse {
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly headers: http.IncomingHttpHeaders;
}

export interface TestRequestOptions {
  readonly token?: string;
  readonly json?: unknown;
  /** Corps binaire brut (uploads) ; exclusif de `json`. */
  readonly raw?: Buffer;
}

export function requestApp(
  app: Express,
  method: string,
  routePath: string,
  options: TestRequestOptions = {},
): Promise<TestResponse> {
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const payload =
        options.raw ??
        Buffer.from(options.json !== undefined ? JSON.stringify(options.json) : "");
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: routePath,
          method,
          headers: {
            "Content-Type": options.raw
              ? "application/octet-stream"
              : "application/json",
            "Content-Length": payload.length.toString(),
            ...(options.token
              ? { Authorization: `Bearer ${options.token}` }
              : {}),
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            let body: Record<string, unknown> = {};
            try {
              body = buf ? (JSON.parse(buf) as Record<string, unknown>) : {};
            } catch {
              body = { raw: buf };
            }
            resolve({ status: res.statusCode ?? 0, body, headers: res.headers });
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
