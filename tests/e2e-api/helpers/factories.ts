import { post, get, unwrap } from "./api";

/**
 * Factories haut niveau pour mettre en place un match multijoueur minimal.
 *
 * Ces helpers encapsulent la séquence:
 *   seed-user → login → create-from-roster → create/join match → team choose → accept
 *
 * Ils retournent des structures typées et stables, ré-utilisables dans toutes
 * les specs. Chaque helper est idempotent tant que /__test/reset est appelé
 * entre deux tests.
 */

export type RosterKey = "skaven" | "lizardmen";

export interface Coach {
  email: string;
  password: string;
  userId: string;
  token: string;
  teamId: string;
  teamName: string;
  roster: RosterKey;
}

export interface Match {
  id: string;
  aToken: string; // matchToken coach A
  bToken: string; // matchToken coach B
}

export interface StartedMatch extends Match {
  kickingUserId: string;
  receivingUserId: string;
}

export interface MatchPair {
  coachA: Coach;
  coachB: Coach;
  match: Match;
}

/** Crée (idempotent) un utilisateur de test puis se connecte. */
export async function seedAndLogin(
  email: string,
  password: string,
  name?: string,
  options: { role?: string; valid?: boolean } = {},
): Promise<{ token: string; userId: string }> {
  const seeded = await post<{ id: string; email: string }>(
    "/__test/seed-user",
    null,
    { email, password, name, ...options },
  );
  const login = await post<{ token: string; user: { id: string } }>(
    "/auth/login",
    null,
    { email, password },
  );
  return { token: login.token, userId: seeded.id };
}

/**
 * Crée une équipe de test minimale (11 linemen génériques) via l'endpoint
 * `/__test/seed-team`. On n'utilise pas `/team/create-from-roster` dans la
 * suite E2E API pour éviter les incompatibilités entre le schéma Prisma
 * Postgres (prod) et le schéma SQLite (tests) sur des modèles comme
 * `TeamStarPlayer` qui n'existent pas côté SQLite.
 */
export async function createTeam(
  ownerId: string,
  name: string,
  roster: RosterKey,
): Promise<{ teamId: string; teamName: string }> {
  const created = await post<{ id: string; name: string }>(
    "/__test/seed-team",
    null,
    { ownerId, name, roster },
  );
  return { teamId: created.id, teamName: created.name };
}

/**
 * Crée deux coachs + leurs équipes. Par défaut:
 *  - Alice (Skaven)
 *  - Bob (Lizardmen)
 * Les rosters sont distincts, ce qui est requis par acceptAndMaybeStartMatch.
 */
export async function createTwoCoaches(
  options: {
    aEmail?: string;
    bEmail?: string;
    aRoster?: RosterKey;
    bRoster?: RosterKey;
  } = {},
): Promise<{ coachA: Coach; coachB: Coach }> {
  const aEmail = options.aEmail ?? "alice@e2e.test";
  const bEmail = options.bEmail ?? "bob@e2e.test";
  const aRoster = options.aRoster ?? "skaven";
  const bRoster = options.bRoster ?? "lizardmen";

  const [a, b] = await Promise.all([
    seedAndLogin(aEmail, "password-a", "Alice"),
    seedAndLogin(bEmail, "password-b", "Bob"),
  ]);

  const [teamA, teamB] = await Promise.all([
    createTeam(a.userId, "Rats of E2E", aRoster),
    createTeam(b.userId, "Lizards of E2E", bRoster),
  ]);

  return {
    coachA: {
      email: aEmail,
      password: "password-a",
      userId: a.userId,
      token: a.token,
      teamId: teamA.teamId,
      teamName: teamA.teamName,
      roster: aRoster,
    },
    coachB: {
      email: bEmail,
      password: "password-b",
      userId: b.userId,
      token: b.token,
      teamId: teamB.teamId,
      teamName: teamB.teamName,
      roster: bRoster,
    },
  };
}

/** Crée un match entre deux coachs sans démarrer la séquence d'acceptation. */
export async function createMatch(
  coachA: Coach,
  coachB: Coach,
): Promise<Match> {
  // S25.5f — /match/create et /match/join migres vers ApiResponse<T>
  const created = unwrap(
    await post<{
      success: true;
      data: { match: { id: string }; matchToken: string };
    }>("/match/create", coachA.token, {}),
  );
  const joined = unwrap(
    await post<{
      success: true;
      data: { match: { id: string }; matchToken: string };
    }>("/match/join", coachB.token, { matchId: created.match.id }),
  );
  return {
    id: created.match.id,
    aToken: created.matchToken,
    bToken: joined.matchToken,
  };
}

/** Associe une équipe à chaque coach sur un match. */
export async function chooseTeams(
  match: Match,
  coachA: Coach,
  coachB: Coach,
): Promise<void> {
  await post("/team/choose", coachA.token, {
    matchId: match.id,
    teamId: coachA.teamId,
  });
  await post("/team/choose", coachB.token, {
    matchId: match.id,
    teamId: coachB.teamId,
  });
}

/**
 * Workflow complet: accept A (waiting) puis accept B → match démarre.
 * Retourne les infos kickingUserId / receivingUserId renvoyées par le serveur.
 */
export async function acceptAndStart(
  match: Match,
  coachA: Coach,
  coachB: Coach,
): Promise<StartedMatch> {
  // S25.5f — /match/accept migre vers ApiResponse<T>
  const accA = unwrap(
    await post<{ success: true; data: { status: string } }>(
      "/match/accept",
      coachA.token,
      { matchId: match.id },
    ),
  );
  if (
    accA.status !== "waiting_other_player" &&
    accA.status !== "waiting_other_accept"
  ) {
    throw new Error(
      `Premier accept inattendu: ${JSON.stringify(accA)}`,
    );
  }
  const accB = unwrap(
    await post<{
      success: true;
      data: {
        status: string;
        kickingUserId: string;
        receivingUserId: string;
      };
    }>("/match/accept", coachB.token, { matchId: match.id }),
  );
  // Le serveur retourne "prematch-setup" quand le 2e coach accepte et que la
  // séquence pré-match démarre automatiquement (voir services/match-start.ts).
  // On accepte aussi "started" pour rester tolérant si ce nom change.
  if (accB.status !== "prematch-setup" && accB.status !== "started") {
    throw new Error(
      `Deuxième accept inattendu: ${JSON.stringify(accB)}`,
    );
  }
  return {
    ...match,
    kickingUserId: accB.kickingUserId,
    receivingUserId: accB.receivingUserId,
  };
}

/**
 * Setup complet "sans friction" pour démarrer un match: crée 2 coachs + match
 * + choix d'équipe + accept mutuel. C'est le point d'entrée par défaut des specs
 * qui veulent tester ce qui vient APRÈS la phase d'acceptation.
 */
export async function bootMatch(
  options: Parameters<typeof createTwoCoaches>[0] = {},
): Promise<MatchPair & { started: StartedMatch }> {
  const { coachA, coachB } = await createTwoCoaches(options);
  const match = await createMatch(coachA, coachB);
  await chooseTeams(match, coachA, coachB);
  const started = await acceptAndStart(match, coachA, coachB);
  return { coachA, coachB, match, started };
}

/** Récupère le game state courant côté d'un coach. */
export async function getMatchState(
  token: string,
  matchId: string,
): Promise<{
  gameState: Record<string, unknown>;
  matchStatus: string;
  myTeamSide?: "A" | "B";
  isMyTurn?: boolean;
}> {
  return get(`/match/${matchId}/state`, token);
}
