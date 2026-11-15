/**
 * Blog des compétitions — chaîne Express réelle (vrais JWT), base EN MÉMOIRE
 * (`test-utils/fake-prisma-model`) : création → lecture → droits →
 * notifications, pour une ligue et une coupe.
 */

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ db: {} as Record<string, unknown> }));
vi.mock("../prisma", () => ({ prisma: h.db }));

import { JWT_SECRET } from "../config";
import router, { imageUploadQuota } from "./competition-blog";
import { createFakeModel, matchWhere, type FakeModel } from "../test-utils/fake-prisma-model";
import { requestApp } from "../test-utils/express-request";

const COMMISH = "commish";
const MEMBER = "member";
const MEMBER2 = "member2";
const FORMER = "former";
const WITHDRAWN = "withdrawn";
const STRANGER = "stranger";
const INVITEE = "invitee";
const CUP_MEMBER = "cupMember";

const tokenFor = (sub: string, roles: string[] = ["user"]) =>
  jwt.sign({ sub, roles }, JWT_SECRET);

type Row = Record<string, unknown>;

interface Participation {
  leagueId?: string;
  cupId?: string;
  seasonId?: string;
  seasonNumber?: number;
  status: string;
  ownerId: string;
  teamId: string;
}

let posts: FakeModel;
let comments: FakeModel;
let reactions: FakeModel;
let notifications: FakeModel;
let leagues: FakeModel;
let cups: FakeModel;
let participations: Participation[];
let uploadDir: string;

/** Filtre des participations : relations `team.ownerId`, `season.leagueId`. */
function matchParticipation(p: Participation, where: Row = {}): boolean {
  const { team, season, status, ...rest } = where as {
    team?: { ownerId?: string };
    season?: { leagueId?: string };
    status?: unknown;
  } & Row;
  if (team?.ownerId && p.ownerId !== team.ownerId) return false;
  if (season?.leagueId && p.leagueId !== season.leagueId) return false;
  if (status !== undefined && !matchWhere(p as unknown as Row, { status })) return false;
  return matchWhere(p as unknown as Row, rest);
}

function participationModel() {
  return {
    count: async (args: { where?: Row }) =>
      participations.filter((p) => matchParticipation(p, args.where)).length,
    findMany: async (args: { where?: Row }) =>
      participations
        .filter((p) => matchParticipation(p, args.where))
        .map((p) => ({
          status: p.status,
          team: { id: p.teamId, name: `Team ${p.teamId}`, ownerId: p.ownerId },
          season: { seasonNumber: p.seasonNumber ?? 1 },
        })),
  };
}

const userName = (id: string | null | undefined) =>
  id ? { id, coachName: `Coach ${id}` } : null;

function seed(opts: { leaguePublic?: boolean; leagueStatus?: string } = {}) {
  posts = createFakeModel({
    defaults: () => ({
      status: "draft",
      leagueId: null,
      cupId: null,
      seasonId: null,
      excerpt: null,
      coverImageUrl: null,
      publishedAt: null,
      notifiedAt: null,
      editedAt: null,
      pinnedAt: null,
      hiddenAt: null,
      hiddenById: null,
      hiddenReason: null,
      deletedAt: null,
    }),
    relations: {
      author: (r) => userName(r.authorId as string | null),
      season: (r) => (r.seasonId === "s2" ? { seasonNumber: 2 } : r.seasonId ? { seasonNumber: 1 } : null),
    },
  });
  comments = createFakeModel({
    defaults: () => ({ editedAt: null, hiddenAt: null, hiddenById: null, hiddenReason: null, deletedAt: null }),
    relations: { author: (r) => userName(r.authorId as string | null) },
  });
  reactions = createFakeModel({
    compoundKeys: { postId_userId_kind: ["postId", "userId", "kind"] },
  });
  notifications = createFakeModel({ defaults: () => ({ readAt: null, url: null, meta: null }) });
  leagues = createFakeModel();
  cups = createFakeModel();
  leagues.rows.push({
    id: "league1",
    name: "Ligue du Chaos",
    creatorId: COMMISH,
    isPublic: opts.leaguePublic ?? false,
    status: opts.leagueStatus ?? "in_progress",
  });
  leagues.rows.push({ id: "league2", name: "Autre", creatorId: STRANGER, isPublic: true, status: "open" });
  cups.rows.push({ id: "cup1", name: "Coupe", creatorId: COMMISH, isPublic: false, status: "en_cours" });
  participations = [
    { leagueId: "league1", seasonId: "s2", seasonNumber: 2, status: "active", ownerId: MEMBER, teamId: "t1" },
    { leagueId: "league1", seasonId: "s2", seasonNumber: 2, status: "active", ownerId: MEMBER2, teamId: "t2" },
    { leagueId: "league1", seasonId: "s2", seasonNumber: 2, status: "withdrawn", ownerId: WITHDRAWN, teamId: "t3" },
    { leagueId: "league1", seasonId: "s1", seasonNumber: 1, status: "active", ownerId: FORMER, teamId: "t4" },
    { cupId: "cup1", status: "active", ownerId: CUP_MEMBER, teamId: "t5" },
  ];
  const leagueParts = () => participations.filter((p) => p.leagueId);
  const cupParts = () => participations.filter((p) => p.cupId);
  Object.assign(h.db, {
    competitionPost: posts,
    competitionPostComment: comments,
    competitionPostReaction: reactions,
    notification: notifications,
    league: leagues,
    cup: cups,
    leagueSeason: {
      findFirst: async (args: { where: { leagueId: string } }) =>
        args.where.leagueId === "league1" ? { id: "s2", seasonNumber: 2 } : null,
    },
    leagueParticipant: {
      count: async (args: { where?: Row }) =>
        leagueParts().filter((p) => matchParticipation(p, args.where)).length,
      findMany: async (args: { where?: Row }) =>
        participationModel().findMany({ where: args.where }).then((rows) =>
          rows.filter((_r, i) => leagueParts()[i] !== undefined),
        ),
    },
    leagueInvitation: {
      count: async (args: { where: { inviteeUserId: string } }) =>
        args.where.inviteeUserId === INVITEE ? 1 : 0,
    },
    cupParticipant: {
      count: async (args: { where?: Row }) =>
        cupParts().filter((p) => matchParticipation(p, args.where) && matchWhere(p as unknown as Row, { cupId: (args.where as Row)?.cupId ?? p.cupId })).length,
      findMany: async (args: { where?: Row }) =>
        cupParts()
          .filter((p) => matchParticipation(p, args.where))
          .map((p) => ({ team: { id: p.teamId, name: "T", ownerId: p.ownerId } })),
    },
    cupInvitation: { count: async () => 0 },
    user: {
      findUnique: async (args: { where: { id: string } }) => userName(args.where.id),
    },
  });
  // Les participations de ligue ne doivent pas répondre aux filtres de coupe.
  (h.db.leagueParticipant as { findMany: unknown }).findMany = async (args: { where?: Row }) =>
    leagueParts()
      .filter((p) => matchParticipation(p, args.where))
      .map((p) => ({
        status: p.status,
        team: { id: p.teamId, name: "T", ownerId: p.ownerId },
        season: { seasonNumber: p.seasonNumber ?? 1 },
      }));
}

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/competitions/:kind/:competitionId/blog", router);
  return a;
}

const L = "/api/competitions/leagues/league1/blog";
const C = "/api/competitions/cups/cup1/blog";

async function publishAs(user: string, title = "Compte rendu", base = L) {
  const res = await requestApp(app(), "POST", `${base}/posts`, {
    token: tokenFor(user),
    json: { title, contentHtml: "<p>Victoire 2-1</p>", publish: true },
  });
  expect(res.status).toBe(201);
  return (res.body.data as { post: { id: string } }).post.id;
}

beforeEach(async () => {
  seed();
  imageUploadQuota.reset();
  uploadDir = await mkdtemp(path.join(os.tmpdir(), "cblog-route-"));
  process.env.COMPETITION_BLOG_UPLOAD_DIR = uploadDir;
});
afterEach(async () => {
  delete process.env.COMPETITION_BLOG_UPLOAD_DIR;
  await rm(uploadDir, { recursive: true, force: true });
});

describe("visibilité héritée de la compétition", () => {
  it("ligue privée : 404 pour un étranger, avec le message d'une ligue inexistante", async () => {
    const res = await requestApp(app(), "GET", `${L}/posts`, { token: tokenFor(STRANGER) });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Ligue introuvable");
  });

  it("ligue privée : 404 sur un article aussi, même pour un anonyme", async () => {
    const id = await publishAs(MEMBER);
    const res = await requestApp(app(), "GET", `${L}/posts/${id}`);
    expect(res.status).toBe(404);
  });

  it("ligue publique : un anonyme lit sans droit d'écriture", async () => {
    seed({ leaguePublic: true });
    await publishAs(MEMBER);
    const res = await requestApp(app(), "GET", `${L}/posts`);
    expect(res.status).toBe(200);
    const data = res.body.data as { posts: unknown[]; viewer: { canWrite: boolean } };
    expect(data.posts).toHaveLength(1);
    expect(data.viewer.canWrite).toBe(false);
  });

  it("coach invité d'une ligue privée : lit, mais n'écrit pas", async () => {
    await publishAs(MEMBER);
    const read = await requestApp(app(), "GET", `${L}/posts`, { token: tokenFor(INVITEE) });
    expect(read.status).toBe(200);
    const write = await requestApp(app(), "POST", `${L}/posts`, {
      token: tokenFor(INVITEE),
      json: { title: "x", contentHtml: "<p>x</p>" },
    });
    expect(write.status).toBe(403);
  });

  it("coupe privée : 404 pour un étranger, l'inscrit publie", async () => {
    const hidden = await requestApp(app(), "GET", `${C}/posts`, { token: tokenFor(STRANGER) });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error).toBe("Coupe introuvable");
    await publishAs(CUP_MEMBER, "Ronde 1", C);
    const list = await requestApp(app(), "GET", `${C}/posts`, { token: tokenFor(COMMISH) });
    expect((list.body.data as { posts: unknown[] }).posts).toHaveLength(1);
  });

  it("un article d'une autre compétition est introuvable par cette URL", async () => {
    const id = await publishAs(CUP_MEMBER, "Ronde 1", C);
    const res = await requestApp(app(), "GET", `${L}/posts/${id}`, { token: tokenFor(COMMISH) });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Article introuvable");
  });
});

describe("qui écrit", () => {
  it.each([
    ["ancien participant", FORMER],
    ["équipe retirée", WITHDRAWN],
  ])("%s : lecture seule (403 en écriture)", async (_label, user) => {
    seed({ leaguePublic: true });
    const read = await requestApp(app(), "GET", `${L}/posts`, { token: tokenFor(user) });
    expect(read.status).toBe(200);
    const write = await requestApp(app(), "POST", `${L}/posts`, {
      token: tokenFor(user),
      json: { title: "x", contentHtml: "<p>x</p>" },
    });
    expect(write.status).toBe(403);
  });

  it("commissaire sans équipe : publie", async () => {
    await publishAs(COMMISH);
  });

  it("le HTML est assaini et la saison courante posée", async () => {
    const res = await requestApp(app(), "POST", `${L}/posts`, {
      token: tokenFor(MEMBER),
      json: {
        title: "Bilan",
        contentHtml: '<p onclick="x()">ok</p><script>alert(1)</script><img src="https://evil/p.gif">',
        publish: true,
      },
    });
    expect(res.status).toBe(201);
    const post = (res.body.data as { post: { contentHtml: string; seasonNumber: number } }).post;
    expect(post.contentHtml).toBe("<p>ok</p>");
    expect(post.seasonNumber).toBe(2);
  });

  it("schéma : un titre vide est un 400", async () => {
    const res = await requestApp(app(), "POST", `${L}/posts`, {
      token: tokenFor(MEMBER),
      json: { title: "", contentHtml: "<p>x</p>" },
    });
    expect(res.status).toBe(400);
  });

  it("compétition archivée : écriture 409, modération toujours possible", async () => {
    const id = await publishAs(MEMBER);
    leagues.rows[0].status = "archived";
    const write = await requestApp(app(), "POST", `${L}/posts/${id}/comments`, {
      token: tokenFor(MEMBER2),
      json: { body: "Bravo" },
    });
    expect(write.status).toBe(409);
    const hide = await requestApp(app(), "POST", `${L}/posts/${id}/hide`, {
      token: tokenFor(COMMISH),
      json: { reason: "archive" },
    });
    expect(hide.status).toBe(200);
  });
});

describe("brouillons et publication", () => {
  it("un brouillon n'est visible que de son auteur", async () => {
    const res = await requestApp(app(), "POST", `${L}/posts`, {
      token: tokenFor(MEMBER),
      json: { title: "Brouillon", contentHtml: "<p>wip</p>" },
    });
    const id = (res.body.data as { post: { id: string } }).post.id;
    const commish = await requestApp(app(), "GET", `${L}/posts/${id}`, { token: tokenFor(COMMISH) });
    expect(commish.status).toBe(404);
    const mine = await requestApp(app(), "GET", `${L}/posts?drafts=mine`, { token: tokenFor(MEMBER) });
    expect((mine.body.data as { posts: Array<{ id: string }> }).posts.map((p) => p.id)).toEqual([id]);
    const list = await requestApp(app(), "GET", `${L}/posts`, { token: tokenFor(COMMISH) });
    expect((list.body.data as { posts: unknown[] }).posts).toHaveLength(0);
  });

  it("publication : notifie les membres sauf l'auteur, une seule fois", async () => {
    const id = await publishAs(MEMBER);
    const recipients = notifications.rows.map((n) => n.userId).sort();
    expect(recipients).toEqual([COMMISH, MEMBER2].sort());
    expect(notifications.rows[0]).toMatchObject({
      kind: "competition.blog.post_published",
      url: `/leagues/league1/blog/${id}`,
    });
    const firstPublishedAt = posts.rows[0].publishedAt;
    await requestApp(app(), "POST", `${L}/posts/${id}/unpublish`, { token: tokenFor(MEMBER) });
    await requestApp(app(), "POST", `${L}/posts/${id}/publish`, { token: tokenFor(MEMBER) });
    expect(notifications.rows).toHaveLength(2);
    expect(posts.rows[0].publishedAt).toBe(firstPublishedAt);
  });

  it("épinglé en tête, par le commissaire seulement", async () => {
    const old = await publishAs(MEMBER, "Ancien");
    await publishAs(MEMBER, "Récent");
    const denied = await requestApp(app(), "POST", `${L}/posts/${old}/pin`, { token: tokenFor(MEMBER) });
    expect(denied.status).toBe(403);
    await requestApp(app(), "POST", `${L}/posts/${old}/pin`, { token: tokenFor(COMMISH) });
    const list = await requestApp(app(), "GET", `${L}/posts`, { token: tokenFor(MEMBER2) });
    const data = list.body.data as { pinned: Array<{ title: string }>; posts: Array<{ title: string }> };
    expect(data.pinned.map((p) => p.title)).toEqual(["Ancien"]);
    expect(data.posts.map((p) => p.title)).toEqual(["Récent"]);
  });

  it("modification d'un article publié : marquée, réservée à l'auteur", async () => {
    const id = await publishAs(MEMBER);
    const other = await requestApp(app(), "PATCH", `${L}/posts/${id}`, {
      token: tokenFor(MEMBER2),
      json: { title: "Piraté" },
    });
    expect(other.status).toBe(403);
    const mine = await requestApp(app(), "PATCH", `${L}/posts/${id}`, {
      token: tokenFor(MEMBER),
      json: { title: "Corrigé" },
    });
    expect((mine.body.data as { post: { title: string; editedAt: string } }).post).toMatchObject({
      title: "Corrigé",
    });
    expect((mine.body.data as { post: { editedAt: string | null } }).post.editedAt).not.toBeNull();
  });
});

describe("réactions", () => {
  it("bascule idempotente, comptes et « les miennes »", async () => {
    const id = await publishAs(MEMBER);
    const put = () => requestApp(app(), "PUT", `${L}/posts/${id}/reactions/fire`, { token: tokenFor(MEMBER2) });
    await put();
    const twice = await put();
    const summary = (twice.body.data as { reactions: { counts: Record<string, number>; mine: string[] } }).reactions;
    expect(summary.counts.fire).toBe(1);
    expect(summary.mine).toEqual(["fire"]);
    const off = await requestApp(app(), "DELETE", `${L}/posts/${id}/reactions/fire`, { token: tokenFor(MEMBER2) });
    expect((off.body.data as { reactions: { counts: Record<string, number> } }).reactions.counts.fire).toBe(0);
  });

  it("type hors catalogue : 400 ; lecteur non membre : 403", async () => {
    seed({ leaguePublic: true });
    const id = await publishAs(MEMBER);
    const bad = await requestApp(app(), "PUT", `${L}/posts/${id}/reactions/poop`, { token: tokenFor(MEMBER2) });
    expect(bad.status).toBe(400);
    const reader = await requestApp(app(), "PUT", `${L}/posts/${id}/reactions/like`, { token: tokenFor(STRANGER) });
    expect(reader.status).toBe(403);
  });
});

describe("commentaires", () => {
  it("notifient l'auteur une fois tant que la notification n'est pas lue", async () => {
    const id = await publishAs(MEMBER);
    notifications.rows.length = 0;
    for (const user of [MEMBER2, COMMISH]) {
      const res = await requestApp(app(), "POST", `${L}/posts/${id}/comments`, {
        token: tokenFor(user),
        json: { body: `Bien joué (${user})` },
      });
      expect(res.status).toBe(201);
    }
    expect(notifications.rows).toHaveLength(1);
    expect(notifications.rows[0]).toMatchObject({ userId: MEMBER, kind: "competition.blog.comment" });
    const list = await requestApp(app(), "GET", `${L}/posts/${id}/comments`, { token: tokenFor(MEMBER) });
    expect((list.body.data as { comments: unknown[] }).comments).toHaveLength(2);
  });

  it("blocklist : masqué pour les autres, visible de l'auteur et du commissaire", async () => {
    const id = await publishAs(MEMBER);
    await requestApp(app(), "POST", `${L}/posts/${id}/comments`, {
      token: tokenFor(MEMBER2),
      json: { body: "espece de f-a-g-g-o-t" },
    });
    const count = async (user: string) =>
      ((await requestApp(app(), "GET", `${L}/posts/${id}/comments`, { token: tokenFor(user) })).body
        .data as { comments: Array<{ hidden: { reason: string } | null }> }).comments;
    expect(await count(MEMBER)).toHaveLength(0);
    const own = await count(MEMBER2);
    expect(own[0].hidden?.reason).toBe("blocklist:slur-2");
    expect(await count(COMMISH)).toHaveLength(1);
  });

  it("limite de débit : 429 au-delà du quota", async () => {
    const id = await publishAs(MEMBER);
    for (let i = 0; i < 30; i++) {
      comments.rows.push({ id: `c${i}`, postId: id, authorId: MEMBER2, body: "x", createdAt: new Date(), deletedAt: null, hiddenAt: null });
    }
    const res = await requestApp(app(), "POST", `${L}/posts/${id}/comments`, {
      token: tokenFor(MEMBER2),
      json: { body: "encore" },
    });
    expect(res.status).toBe(429);
  });

  it("commenter un brouillon : 404", async () => {
    const res = await requestApp(app(), "POST", `${L}/posts`, {
      token: tokenFor(MEMBER),
      json: { title: "wip", contentHtml: "<p>x</p>" },
    });
    const id = (res.body.data as { post: { id: string } }).post.id;
    const c = await requestApp(app(), "POST", `${L}/posts/${id}/comments`, {
      token: tokenFor(MEMBER),
      json: { body: "x" },
    });
    expect(c.status).toBe(404);
  });
});

describe("modération", () => {
  it("article masqué : invisible des autres, visible de l'auteur avec la raison", async () => {
    const id = await publishAs(MEMBER);
    const denied = await requestApp(app(), "POST", `${L}/posts/${id}/hide`, {
      token: tokenFor(MEMBER2),
      json: { reason: "x" },
    });
    expect(denied.status).toBe(403);
    await requestApp(app(), "POST", `${L}/posts/${id}/hide`, {
      token: tokenFor(COMMISH),
      json: { reason: "hors sujet" },
    });
    const other = await requestApp(app(), "GET", `${L}/posts/${id}`, { token: tokenFor(MEMBER2) });
    expect(other.status).toBe(404);
    const author = await requestApp(app(), "GET", `${L}/posts/${id}`, { token: tokenFor(MEMBER) });
    expect((author.body.data as { post: { hidden: { reason: string } } }).post.hidden.reason).toBe("hors sujet");
  });

  it("suppression par l'auteur : disparaît pour tout le monde", async () => {
    const id = await publishAs(MEMBER);
    const del = await requestApp(app(), "DELETE", `${L}/posts/${id}`, { token: tokenFor(MEMBER) });
    expect(del.status).toBe(200);
    const res = await requestApp(app(), "GET", `${L}/posts/${id}`, { token: tokenFor(COMMISH) });
    expect(res.status).toBe(404);
    expect(posts.rows[0].deletedAt).toBeInstanceOf(Date);
  });
});

describe("images", () => {
  const PNG = (() => {
    const b = Buffer.alloc(64);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    return b;
  })();

  it("un membre uploade une image servie sous le dossier de la compétition", async () => {
    const res = await requestApp(app(), "POST", `${L}/images`, { token: tokenFor(MEMBER), raw: PNG });
    expect(res.status).toBe(201);
    const url = (res.body.data as { image: { url: string } }).image.url;
    expect(url).toMatch(/^\/images\/competition-blog\/league-league1\/[a-f0-9]{16}\.png$/);
    // … et l'article peut l'utiliser en couverture.
    const post = await requestApp(app(), "POST", `${L}/posts`, {
      token: tokenFor(MEMBER),
      json: { title: "Photo", contentHtml: `<p>x</p><img src="${url}">`, coverImageUrl: url },
    });
    expect(post.status).toBe(201);
  });

  it("fichier déguisé : 415 ; non-membre : 403", async () => {
    const zip = await requestApp(app(), "POST", `${L}/images`, {
      token: tokenFor(MEMBER),
      raw: Buffer.from("PK\u0003\u0004 definitely not an image"),
    });
    expect(zip.status).toBe(415);
    seed({ leaguePublic: true });
    const stranger = await requestApp(app(), "POST", `${L}/images`, { token: tokenFor(STRANGER), raw: PNG });
    expect(stranger.status).toBe(403);
  });

  it("couverture externe refusée (400)", async () => {
    const res = await requestApp(app(), "POST", `${L}/posts`, {
      token: tokenFor(MEMBER),
      json: { title: "x", contentHtml: "<p>x</p>", coverImageUrl: "https://evil.test/a.png" },
    });
    expect(res.status).toBe(400);
  });
});
