import { API_BASE } from "./env";

/**
 * Wrapper REST typé pour l'API Express du serveur.
 *
 * - `post`/`get` lancent une erreur explicite sur status >= 400
 * - `rawPost`/`rawGet` retournent la Response brute pour tester les cas d'erreur
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function authHeader(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function post<TResponse = unknown>(
  path: string,
  token: string | null,
  body: unknown,
): Promise<TResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `POST ${path} -> ${res.status}: ${
        (json as { error?: string } | null)?.error ?? res.statusText
      }`,
      json,
    );
  }
  return json as TResponse;
}

export async function get<TResponse = unknown>(
  path: string,
  token: string | null,
): Promise<TResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...authHeader(token) },
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `GET ${path} -> ${res.status}: ${
        (json as { error?: string } | null)?.error ?? res.statusText
      }`,
      json,
    );
  }
  return json as TResponse;
}

export async function rawPost(
  path: string,
  token: string | null,
  body: unknown,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(body ?? {}),
  });
}

export async function rawGet(
  path: string,
  token: string | null,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: { ...authHeader(token) },
  });
}

export async function put<TResponse = unknown>(
  path: string,
  token: string | null,
  body: unknown,
): Promise<TResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `PUT ${path} -> ${res.status}: ${
        (json as { error?: string } | null)?.error ?? res.statusText
      }`,
      json,
    );
  }
  return json as TResponse;
}

export async function rawPut(
  path: string,
  token: string | null,
  body: unknown,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(body ?? {}),
  });
}

export async function rawDelete(
  path: string,
  token: string | null,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { ...authHeader(token) },
  });
}

/** Reset total de la DB in-memory (tests seulement). */
export async function resetDb(): Promise<void> {
  await fetch(`${API_BASE}/__test/reset`, { method: "POST" });
}
