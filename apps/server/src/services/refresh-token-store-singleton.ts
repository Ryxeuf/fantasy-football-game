/**
 * Singleton du store de refresh tokens, partage entre `auth.ts` et
 * les services qui doivent revoquer les sessions (admin password
 * reset, password reset self-service, etc.).
 *
 * Extrait pour eviter les cycles d'import : auth.ts importait deja
 * le store + les services qui revoque les sessions. Sortir le
 * singleton dans son propre fichier casse le cycle.
 */

import type { RefreshTokenStore } from "./refresh-token-store";
import { PrismaRefreshTokenStore } from "./prisma-refresh-token-store";

let refreshTokenStore: RefreshTokenStore = new PrismaRefreshTokenStore();

export function setRefreshTokenStore(store: RefreshTokenStore): void {
  refreshTokenStore = store;
}

export function getRefreshTokenStore(): RefreshTokenStore {
  return refreshTokenStore;
}
