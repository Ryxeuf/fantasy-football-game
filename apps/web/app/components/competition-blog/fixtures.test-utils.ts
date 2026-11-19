/** Fixtures partagées des tests du blog de compétition (pas un fichier de test). */
import type { BlogPost, BlogViewer, ReactionSummary } from "../../lib/competition-blog";

export const EMPTY_REACTIONS: ReactionSummary = {
  counts: { like: 0, love: 0, laugh: 0, wow: 0, fire: 0, skull: 0 },
  mine: [],
};

export const MEMBER_VIEWER: BlogViewer = {
  isMember: true,
  canWrite: true,
  canReact: true,
  canComment: true,
  canModerate: false,
};

export const READER_VIEWER: BlogViewer = {
  isMember: false,
  canWrite: false,
  canReact: false,
  canComment: false,
  canModerate: false,
};

export function makePost(over: Partial<BlogPost> = {}): BlogPost {
  return {
    id: "p1",
    title: "Compte rendu",
    excerpt: "Victoire des Orques",
    contentHtml: "<p>Victoire des Orques</p>",
    coverImageUrl: null,
    status: "published",
    publishedAt: "2027-03-12T10:00:00.000Z",
    editedAt: null,
    createdAt: "2027-03-12T09:00:00.000Z",
    pinned: false,
    hidden: null,
    author: { id: "u1", coachName: "Grombrindal" },
    seasonNumber: 2,
    reactions: EMPTY_REACTIONS,
    commentCount: 0,
    viewer: { canEdit: false, canDelete: false },
    ...over,
  };
}
