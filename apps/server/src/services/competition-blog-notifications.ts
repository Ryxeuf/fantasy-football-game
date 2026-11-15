/**
 * Notifications internes du blog des compétitions — jamais bloquantes :
 * appelées APRÈS l'écriture, chaque échec est journalisé et avalé.
 *
 *  - publication : une seule fois par article (`notifiedAt` write-once,
 *    réclamé par `updateMany … where notifiedAt null` — seule la requête qui
 *    l'écrit notifie), aux membres moins l'auteur ;
 *  - commentaire : à l'auteur de l'article (sauf s'il commente lui-même),
 *    sans seconde notification NON LUE pour le même article.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  createInAppNotification,
  createInAppNotifications,
} from "./in-app-notifications";
import {
  blogPostPath,
  listBlogMemberIds,
  type BlogContext,
} from "./competition-blog-context";

const TITLE_MAX = 80;

function clip(text: string, max = TITLE_MAX): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export async function notifyPostPublished(
  ctx: BlogContext,
  post: { readonly id: string; readonly title: string; readonly authorId: string | null },
  authorName: string,
): Promise<number> {
  try {
    const claimed = (await prisma.competitionPost.updateMany({
      where: { id: post.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    })) as { count: number };
    if (claimed.count !== 1) return 0;
    const members = await listBlogMemberIds(ctx.competition);
    const recipients = members.filter((id) => id !== post.authorId);
    const { kind, id, name } = ctx.competition;
    return await createInAppNotifications(recipients, {
      kind: "competition.blog.post_published",
      title: clip(`📰 ${name} : nouvel article`),
      body: clip(`${authorName} a publié « ${post.title} »`, 400),
      url: blogPostPath(kind, id, post.id),
      meta: { competitionKind: kind, competitionId: id, postId: post.id },
    });
  } catch (e: unknown) {
    serverLog.error(`[competition-blog] notification de publication ${post.id}`, e);
    return 0;
  }
}

export async function notifyPostCommented(
  ctx: BlogContext,
  post: { readonly id: string; readonly title: string; readonly authorId: string | null },
  commenterId: string,
  commenterName: string,
): Promise<boolean> {
  if (!post.authorId || post.authorId === commenterId) return false;
  try {
    const { kind, id } = ctx.competition;
    const url = blogPostPath(kind, id, post.id);
    const unread = await prisma.notification.count({
      where: {
        userId: post.authorId,
        kind: "competition.blog.comment",
        url,
        readAt: null,
      },
    });
    if (unread > 0) return false;
    const created = await createInAppNotification({
      userId: post.authorId,
      kind: "competition.blog.comment",
      title: "💬 Nouveau commentaire",
      body: clip(`${commenterName} a commenté « ${post.title} »`, 400),
      url,
      meta: { competitionKind: kind, competitionId: id, postId: post.id },
    });
    return created !== null;
  } catch (e: unknown) {
    serverLog.error(`[competition-blog] notification de commentaire ${post.id}`, e);
    return false;
  }
}
