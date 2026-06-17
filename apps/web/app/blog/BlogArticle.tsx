/**
 * Rendu présentationnel d'un article de blog (couverture + en-tête + contenu).
 * Partagé entre la page publique `/blog/[slug]` et l'aperçu admin
 * `/blog/preview/[id]` pour garantir un rendu final identique.
 *
 * Composant pur sans hooks ni I/O : utilisable côté serveur (page publique)
 * comme côté client (aperçu). Le `contentHtml` est sanitizé côté serveur
 * avant écriture en base (cf. sanitize-blog-html.ts).
 */

export interface BlogArticleData {
  readonly title: string;
  readonly excerpt: string | null;
  readonly contentHtml: string;
  readonly coverImageUrl: string | null;
  readonly publishedAt: string | null;
  readonly authorName: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BlogArticle({ post }: { post: BlogArticleData }) {
  return (
    <>
      {post.coverImageUrl && (
        <div className="w-full mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full h-auto rounded-xl"
          />
        </div>
      )}

      <article className="w-full max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-nuffle-anthracite mb-4">
            {post.title}
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
            {post.authorName && <span>{post.authorName}</span>}
            {post.authorName && post.publishedAt && <span>·</span>}
            {post.publishedAt && (
              <time dateTime={post.publishedAt}>
                {formatDate(post.publishedAt)}
              </time>
            )}
          </div>
          {post.excerpt && (
            <p className="text-lg text-gray-700 leading-relaxed border-l-4 border-nuffle-gold pl-4">
              {post.excerpt}
            </p>
          )}
        </header>

        <div
          className="prose prose-lg max-w-none prose-headings:font-heading prose-headings:text-nuffle-anthracite prose-a:text-nuffle-bronze hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
    </>
  );
}
