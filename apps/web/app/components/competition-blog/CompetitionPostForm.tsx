"use client";

/**
 * Rédaction (`postId` absent) ou modification d'un article : titre,
 * couverture facultative, corps riche ; « Enregistrer le brouillon » ou
 * « Publier ». Le serveur assainit et valide : l'écran ne fait que guider.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiClientError } from "../../lib/api-client";
import { COMPETITION_BLOG_FLAG } from "../../lib/featureFlagKeys";
import { useFeatureFlagOrOff } from "../../hooks/useFeatureFlag";
import { dynamicRoute } from "../../lib/typed-route";
import {
  BLOG_IMAGE_ACCEPT,
  BLOG_TITLE_MAX,
  blogPostPagePath,
  createBlogPost,
  getBlogPost,
  updateBlogPost,
  uploadBlogImage,
  type BlogCompetition,
} from "../../lib/competition-blog";
import BlogUnavailable from "./BlogUnavailable";
import RichTextEditor from "./RichTextEditor";

interface CompetitionPostFormProps {
  readonly competition: BlogCompetition;
  /** Absent : nouvel article. */
  readonly postId?: string;
}

/** Corps vide côté éditeur (`<p></p>`) : rien à envoyer. */
export function isEmptyEditorHtml(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export default function CompetitionPostForm({ competition, postId }: CompetitionPostFormProps) {
  const enabled = useFeatureFlagOrOff(COMPETITION_BLOG_FLAG);
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [loaded, setLoaded] = useState(!postId);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !postId) return;
    let alive = true;
    getBlogPost(competition, postId)
      .then(({ post }) => {
        if (!alive) return;
        if (!post.viewer.canEdit) {
          setForbidden(true);
          return;
        }
        setTitle(post.title);
        setContentHtml(post.contentHtml ?? "");
        setCoverImageUrl(post.coverImageUrl);
        setStatus(post.status);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiClientError && e.status === 404) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Chargement impossible");
      });
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clé = (kind, id)
  }, [enabled, competition.kind, competition.id, postId]);

  if (!enabled) return <BlogUnavailable />;
  if (forbidden) return <BlogUnavailable message="Vous ne pouvez pas modifier cet article." />;
  if (!loaded) return <p className="p-6 text-gray-500">{error ?? "Chargement…"}</p>;

  const canSubmit = title.trim().length > 0 && !isEmptyEditorHtml(contentHtml) && !busy;

  const save = async (publish: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const input = { title: title.trim(), contentHtml, coverImageUrl };
      const post = postId
        ? await updateBlogPost(competition, postId, input)
        : await createBlogPost(competition, { ...input, publish });
      router.push(dynamicRoute(blogPostPagePath(competition, post.id)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
      setBusy(false);
    }
  };

  const onCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      setCoverImageUrl(await uploadBlogImage(competition, file));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi de l'image");
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-heading font-bold text-nuffle-anthracite">
        {postId ? "Modifier l'article" : "✍️ Nouvel article"}
      </h1>
      <form
        className="space-y-4"
        data-testid="blog-post-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void save(!postId);
        }}
      >
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Titre</span>
          <input
            value={title}
            maxLength={BLOG_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
            placeholder="Compte rendu : les Orques renversent la vapeur"
          />
        </label>

        <div className="space-y-1">
          <span className="text-sm font-semibold">Image de couverture (facultative)</span>
          <div className="flex items-center gap-3">
            {coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="" className="h-16 w-28 rounded object-cover" />
            )}
            <button type="button" onClick={() => coverInputRef.current?.click()} className="rounded border px-3 py-1 text-sm">
              {coverImageUrl ? "Changer" : "Choisir une image"}
            </button>
            {coverImageUrl && (
              <button type="button" onClick={() => setCoverImageUrl(null)} className="text-sm text-red-600">
                Retirer
              </button>
            )}
            <input ref={coverInputRef} type="file" accept={BLOG_IMAGE_ACCEPT} className="hidden" onChange={onCover} data-testid="cover-image-input" />
          </div>
        </div>

        <RichTextEditor
          value={contentHtml}
          onChange={setContentHtml}
          onUploadImage={(file) => uploadBlogImage(competition, file)}
        />

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {postId ? (
            <button type="submit" disabled={!canSubmit} className="rounded bg-nuffle-gold px-4 py-2 font-semibold text-white disabled:opacity-50">
              Enregistrer{status === "published" ? " les modifications" : ""}
            </button>
          ) : (
            <>
              <button type="submit" disabled={!canSubmit} className="rounded bg-nuffle-gold px-4 py-2 font-semibold text-white disabled:opacity-50">
                Publier
              </button>
              <button type="button" disabled={!canSubmit} onClick={() => save(false)} className="rounded border px-4 py-2 disabled:opacity-50">
                Enregistrer le brouillon
              </button>
            </>
          )}
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600">
            Annuler
          </button>
        </div>
      </form>
    </main>
  );
}
