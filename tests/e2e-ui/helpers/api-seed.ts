/**
 * Helpers pour semer rapidement l'état initial d'un test via l'API serveur.
 *
 * Les specs Playwright préfèrent provisionner les utilisateurs et équipes
 * par appels REST (plus rapide et déterministe) plutôt que via l'UI.
 * L'UI n'est alors utilisée que pour le parcours critique à tester.
 */
const API_BASE =
  process.env.API_BASE_URL ?? "http://localhost:18002";

export async function resetDb(): Promise<void> {
  await fetch(`${API_BASE}/__test/reset`, { method: "POST" });
  // Re-seed les rosters (Skaven / Lizardmen + position Lineman) après
  // chaque reset: certaines routes du serveur (/match/:id/state en
  // phase prematch-setup → addJourneymen) interrogent le modèle Roster.
  await fetch(`${API_BASE}/__test/seed-rosters`, { method: "POST" });
}

export async function seedUser(
  email: string,
  password: string,
  name: string,
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${API_BASE}/__test/seed-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    throw new Error(
      `seed-user ${email} failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as { id: string; email: string };
}

/**
 * Variante de `seedUser` qui cree aussi un `EloSnapshot` afin que le
 * coach passe le filtre `eloSnapshots: { some: {} }` du leaderboard
 * (cf. apps/server/src/routes/leaderboard.ts). Sans snapshot, un user
 * fraichement seede n'apparait pas dans /leaderboard.
 */
export async function seedUserRanked(
  email: string,
  password: string,
  name: string,
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${API_BASE}/__test/seed-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, rankedMatches: 1 }),
  });
  if (!res.ok) {
    throw new Error(
      `seed-user ${email} failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as { id: string; email: string };
}

export async function seedTeam(
  ownerId: string,
  name: string,
  roster: "skaven" | "lizardmen",
): Promise<{ id: string; name: string; roster: string }> {
  const res = await fetch(`${API_BASE}/__test/seed-team`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerId, name, roster }),
  });
  if (!res.ok) {
    throw new Error(
      `seed-team ${name} failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as { id: string; name: string; roster: string };
}

/**
 * Provisionne deux coachs + équipes et retourne les credentials.
 * Ne crée PAS de match — cela sera fait via l'UI dans les specs.
 */
export async function seedTwoCoaches(): Promise<{
  alice: {
    email: string;
    password: string;
    userId: string;
    teamId: string;
  };
  bob: {
    email: string;
    password: string;
    userId: string;
    teamId: string;
  };
}> {
  const alice = await seedUser("alice@playwright.test", "password-a", "Alice");
  const bob = await seedUser("bob@playwright.test", "password-b", "Bob");
  const teamA = await seedTeam(alice.id, "Rats of Playwright", "skaven");
  const teamB = await seedTeam(bob.id, "Lizards of Playwright", "lizardmen");
  return {
    alice: {
      email: "alice@playwright.test",
      password: "password-a",
      userId: alice.id,
      teamId: teamA.id,
    },
    bob: {
      email: "bob@playwright.test",
      password: "password-b",
      userId: bob.id,
      teamId: teamB.id,
    },
  };
}

/**
 * Coûts de staff d'un roster pour un format, tels que le builder les
 * consomme (`GET /api/rosters` → `staffConfigs`). Montants en **po**.
 *
 * Les specs qui vérifient le récapitulatif de coûts du builder doivent
 * partir de cette source plutôt que d'un total codé en dur : l'édition 2025
 * a fait passer le Fan Dévoué de 10 000 à 5 000 po (PR #964) sans que le
 * total attendu ici ne suive, et l'E2E est resté rouge sur `main`.
 */
export interface E2EStaffConfig {
  readonly rerollCost: number;
  readonly cheerleaderCost: number;
  readonly assistantCost: number;
  readonly apothecaryCost: number;
  readonly dedicatedFanCost: number;
}

export async function fetchStaffConfig(
  rosterSlug: string,
  format: "bb11" | "sevens" = "bb11",
  ruleset = "season_3",
): Promise<E2EStaffConfig> {
  const res = await fetch(`${API_BASE}/api/rosters?ruleset=${ruleset}`);
  if (!res.ok) {
    throw new Error(`GET /api/rosters failed: ${res.status}`);
  }
  const body = (await res.json()) as {
    rosters?: Array<{
      slug: string;
      staffConfigs?: Record<string, E2EStaffConfig>;
    }>;
  };
  const config = body.rosters?.find((r) => r.slug === rosterSlug)
    ?.staffConfigs?.[format];
  if (!config) {
    throw new Error(
      `staffConfigs.${format} introuvable pour le roster ${rosterSlug}`,
    );
  }
  return config;
}
