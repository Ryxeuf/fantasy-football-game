/**
 * Constantes d'environnement partagées par toutes les specs E2E API.
 * Centralisé ici pour éviter la duplication et faciliter les overrides.
 */
export const API_PORT = process.env.API_PORT || "18002";
export const API_BASE =
  process.env.API_BASE || `http://localhost:${API_PORT}`;
export const SOCKET_URL = `${API_BASE}/game`;

/** Délai standard d'attente pour les events WebSocket (ms). */
export const DEFAULT_EVENT_TIMEOUT_MS = 5_000;
