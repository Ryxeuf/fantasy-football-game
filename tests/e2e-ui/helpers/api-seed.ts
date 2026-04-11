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
