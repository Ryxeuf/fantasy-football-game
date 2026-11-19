/**
 * E2E API — Blog des compétitions (change OpenSpec `competition-blog`).
 *
 * Rejoue la chaîne complète contre une vraie base : ligue PRIVÉE à deux
 * coachs inscrits, publication, notifications, réaction, commentaire,
 * masquage par le commissaire, image servie en statique, archivage ; puis le
 * même parcours abrégé sur une coupe privée — dont la fiche est désormais
 * introuvable (404) pour un coach étranger, comme son blog.
 *
 * C'est le seul niveau qui vérifie que la FK polymorphe, la clé unique des
 * réactions, le parser `raw`, `express.static` et le gate du flag (monté sur
 * le chemin complet) s'accordent.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { get, post, put, rawGet, rawPatch, rawPost, resetDb, unwrap } from "../helpers/api";
import { createTeam, seedAndLogin } from "../helpers/factories";
import { API_BASE } from "../helpers/env";

interface Coach {
  token: string;
  userId: string;
}
interface PostDTO {
  id: string;
  title: string;
  status: string;
  seasonNumber: number | null;
  hidden: { reason: string | null } | null;
  contentHtml?: string;
  reactions: { counts: Record<string, number>; mine: string[] };
}
interface NotificationRow {
  kind: string;
  url: string | null;
}

let commish: Coach;
let alice: Coach;
let bob: Coach;
let stranger: Coach;
let leagueId: string;
let cupId: string;

const leagueBlog = () => `/api/competitions/leagues/${leagueId}/blog`;
const cupBlog = () => `/api/competitions/cups/${cupId}/blog`;

async function notifications(token: string): Promise<NotificationRow[]> {
  return unwrap(
    await get<{ data: { notifications: NotificationRow[] } }>("/notifications", token),
  ).notifications;
}

function png(): Buffer {
  const buf = Buffer.alloc(128);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return buf;
}

async function uploadImage(base: string, token: string, body: Buffer): Promise<Response> {
  return fetch(`${API_BASE}${base}/images`, {
    method: "POST",
    headers: { "Content-Type": "image/png", Authorization: `Bearer ${token}` },
    body: new Uint8Array(body),
  });
}

beforeAll(async () => {
  await resetDb();
  commish = await seedAndLogin("commish-blog@e2e.test", "pwd", "Commish");
  alice = await seedAndLogin("alice-blog@e2e.test", "pwd", "Alice");
  bob = await seedAndLogin("bob-blog@e2e.test", "pwd", "Bob");
  stranger = await seedAndLogin("stranger-blog@e2e.test", "pwd", "Stranger");
  const teamA = await createTeam(alice.userId, "Blog Alpha", "skaven");
  const teamB = await createTeam(bob.userId, "Blog Bravo", "lizardmen");
  // Une équipe engagée en ligue n'est pas disponible pour une coupe.
  const teamCup = await createTeam(alice.userId, "Blog Coupe", "skaven");

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", commish.token, {
      name: "Ligue des Plumes",
      maxParticipants: 4,
    }),
  );
  leagueId = league.id;
  const season = unwrap(
    await post<{ data: { id: string } }>(`/leagues/${leagueId}/seasons`, commish.token, {
      name: "S1",
    }),
  );
  await post(`/leagues/seasons/${season.id}/join`, alice.token, { teamId: teamA.teamId });
  await post(`/leagues/seasons/${season.id}/join`, bob.token, { teamId: teamB.teamId });
  // Une ligue privée ne se rejoint que sur invitation : on inscrit d'abord,
  // puis le commissaire la ferme.
  const closed = await rawPatch(`/leagues/${leagueId}`, commish.token, { isPublic: false });
  expect(closed.status).toBe(200);

  const { cup } = await post<{ cup: { id: string } }>("/cup", commish.token, {
    name: "Coupe des Plumes",
    ruleset: "season_3",
  });
  cupId = cup.id;
  await post(`/cup/${cupId}/register`, alice.token, { teamId: teamCup.teamId });
  const cupClosed = await rawPatch(`/cup/${cupId}`, commish.token, { isPublic: false });
  expect(cupClosed.status).toBe(200);
});

describe("E2E API — blog d'une ligue privée", () => {
  let postId: string;

  it("un membre publie ; ses pairs sont notifiés", async () => {
    const created = unwrap(
      await post<{ data: { post: PostDTO } }>(`${leagueBlog()}/posts`, alice.token, {
        title: "Compte rendu J1",
        contentHtml: '<p>Victoire 2-1</p><script>alert(1)</script>',
        publish: true,
      }),
    ).post;
    postId = created.id;
    expect(created.status).toBe("published");
    expect(created.seasonNumber).toBe(1);

    const detail = unwrap(
      await get<{ data: { post: PostDTO } }>(`${leagueBlog()}/posts/${postId}`, bob.token),
    ).post;
    expect(detail.contentHtml).toBe("<p>Victoire 2-1</p>");

    for (const coach of [commish, bob]) {
      const kinds = (await notifications(coach.token)).map((n) => n.kind);
      expect(kinds).toContain("competition.blog.post_published");
    }
    expect((await notifications(alice.token)).map((n) => n.kind)).not.toContain(
      "competition.blog.post_published",
    );
  });

  it("un coach étranger et un anonyme reçoivent un 404", async () => {
    expect((await rawGet(`${leagueBlog()}/posts`, stranger.token)).status).toBe(404);
    expect((await rawGet(`${leagueBlog()}/posts/${postId}`, null)).status).toBe(404);
  });

  it("réaction idempotente et commentaire qui notifie l'auteur", async () => {
    await put(`${leagueBlog()}/posts/${postId}/reactions/fire`, bob.token, {});
    const again = unwrap(
      await put<{ data: { reactions: PostDTO["reactions"] } }>(
        `${leagueBlog()}/posts/${postId}/reactions/fire`,
        bob.token,
        {},
      ),
    ).reactions;
    expect(again.counts.fire).toBe(1);
    expect(again.mine).toEqual(["fire"]);

    const comment = await rawPost(`${leagueBlog()}/posts/${postId}/comments`, bob.token, {
      body: "Bien joué !",
    });
    expect(comment.status).toBe(201);
    const kinds = (await notifications(alice.token)).map((n) => n.kind);
    expect(kinds).toContain("competition.blog.comment");
  });

  it("le stranger ne peut ni réagir ni commenter (404 avant 403)", async () => {
    const res = await rawPost(`${leagueBlog()}/posts/${postId}/comments`, stranger.token, {
      body: "Je m'invite",
    });
    expect(res.status).toBe(404);
  });

  it("une image uploadée est servie sous le dossier de la ligue", async () => {
    const res = await uploadImage(leagueBlog(), alice.token, png());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { image: { url: string } } };
    const url = body.data.image.url;
    expect(url).toContain(`/images/competition-blog/league-${leagueId}/`);
    const served = await fetch(`${API_BASE}${url.replace(/^https?:\/\/[^/]+/, "")}`);
    expect(served.status).toBe(200);
  });

  it("le commissaire masque : l'auteur voit la raison, les autres plus rien", async () => {
    const hidden = await rawPost(`${leagueBlog()}/posts/${postId}/hide`, commish.token, {
      reason: "hors sujet",
    });
    expect(hidden.status).toBe(200);
    expect((await rawGet(`${leagueBlog()}/posts/${postId}`, bob.token)).status).toBe(404);
    const own = unwrap(
      await get<{ data: { post: PostDTO } }>(`${leagueBlog()}/posts/${postId}`, alice.token),
    ).post;
    expect(own.hidden?.reason).toBe("hors sujet");
  });

  it("ligue archivée : lecture seule (409)", async () => {
    await post(`/leagues/${leagueId}/archive`, commish.token, {});
    const res = await rawPost(`${leagueBlog()}/posts`, alice.token, {
      title: "Trop tard",
      contentHtml: "<p>x</p>",
      publish: true,
    });
    expect(res.status).toBe(409);
    expect((await rawGet(`${leagueBlog()}/posts`, bob.token)).status).toBe(200);
  });
});

describe("E2E API — coupe privée", () => {
  it("la fiche et le blog sont introuvables pour un étranger", async () => {
    expect((await rawGet(`/cup/${cupId}`, stranger.token)).status).toBe(404);
    expect((await rawGet(`/cup/${cupId}/rounds`, stranger.token)).status).toBe(404);
    expect((await rawGet(`${cupBlog()}/posts`, stranger.token)).status).toBe(404);
  });

  it("l'inscrit publie, le commissaire lit", async () => {
    expect((await rawGet(`/cup/${cupId}`, alice.token)).status).toBe(200);
    const res = await rawPost(`${cupBlog()}/posts`, alice.token, {
      title: "Avant la ronde 1",
      contentHtml: "<p>Les rats sont prêts.</p>",
      publish: true,
    });
    expect(res.status).toBe(201);
    const list = unwrap(
      await get<{ data: { posts: PostDTO[] } }>(`${cupBlog()}/posts`, commish.token),
    );
    expect(list.posts.map((p) => p.title)).toEqual(["Avant la ronde 1"]);
  });

  it("un coach non inscrit ne publie pas : 404 (la coupe lui est invisible)", async () => {
    const res = await rawPost(`${cupBlog()}/posts`, bob.token, {
      title: "Intrus",
      contentHtml: "<p>x</p>",
    });
    expect(res.status).toBe(404);
  });
});
