import { API_BASE } from "../../auth-client";

export interface BlogPostListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coverImageUrl: string | null;
  author: { id: string; coachName: string } | null;
}

export interface BlogPostDetail extends BlogPostListItem {
  contentHtml: string;
  authorId: string | null;
}

export interface BlogPostInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  contentHtml: string;
  coverImageUrl?: string | null;
  status: "draft" | "published";
}

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || `Erreur ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function listAdminBlogPosts(filters: {
  status?: "draft" | "published";
  search?: string;
}): Promise<BlogPostListItem[]> {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.search) qs.set("search", filters.search);
  const res = await fetch(
    `${API_BASE}/api/admin/blog/posts${qs.toString() ? `?${qs}` : ""}`,
    { headers: authHeaders() },
  );
  const data = await unwrap<{ posts: BlogPostListItem[] }>(res);
  return data.posts;
}

export async function getAdminBlogPost(id: string): Promise<BlogPostDetail> {
  const res = await fetch(`${API_BASE}/api/admin/blog/posts/${id}`, {
    headers: authHeaders(),
  });
  const data = await unwrap<{ post: BlogPostDetail }>(res);
  return data.post;
}

export async function createAdminBlogPost(
  input: BlogPostInput,
): Promise<BlogPostDetail> {
  const res = await fetch(`${API_BASE}/api/admin/blog/posts`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await unwrap<{ post: BlogPostDetail }>(res);
  return data.post;
}

export async function updateAdminBlogPost(
  id: string,
  input: Partial<BlogPostInput>,
): Promise<BlogPostDetail> {
  const res = await fetch(`${API_BASE}/api/admin/blog/posts/${id}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await unwrap<{ post: BlogPostDetail }>(res);
  return data.post;
}

export interface UploadedImage {
  url: string;
  filename: string;
  mime: string;
  bytes: number;
}

/**
 * Upload une image vers `public/images/blog` via l'API admin. Le fichier est
 * envoyé en binaire brut (pas de multipart) ; `filename` sert de base de nom
 * (le serveur régénère un nom unique et sûr). Retourne l'URL publique à
 * insérer dans l'article.
 */
export async function uploadBlogImage(
  file: File,
  filenameHint?: string,
): Promise<UploadedImage> {
  const qs = filenameHint
    ? `?filename=${encodeURIComponent(filenameHint)}`
    : "";
  const res = await fetch(`${API_BASE}/api/admin/blog/upload${qs}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  return unwrap<UploadedImage>(res);
}

export async function deleteAdminBlogPost(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/blog/posts/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrap<{ ok: true }>(res);
}

// --- Médiathèque (images du blog) ---

export interface BlogImage {
  filename: string;
  url: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  /** ISO date (mtime du fichier). */
  uploadedAt: string;
  ext: string;
}

export interface BlogImageListResult {
  images: BlogImage[];
  total: number;
}

export interface ListBlogImagesParams {
  search?: string;
  page?: number;
  limit?: number;
  sort?: "date" | "name" | "size";
}

export interface ReferencingPost {
  id: string;
  slug: string;
  title: string;
}

/** Levée quand un DELETE est refusé (409) car l'image est encore utilisée. */
export class BlogImageInUseError extends Error {
  readonly referencedBy: ReferencingPost[];
  constructor(referencedBy: ReferencingPost[]) {
    super("Image utilisée par un ou plusieurs articles");
    this.name = "BlogImageInUseError";
    this.referencedBy = referencedBy;
  }
}

export async function listBlogImages(
  params: ListBlogImagesParams = {},
): Promise<BlogImageListResult> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.sort) qs.set("sort", params.sort);
  const res = await fetch(
    `${API_BASE}/api/admin/blog/images${qs.toString() ? `?${qs}` : ""}`,
    { headers: authHeaders() },
  );
  return unwrap<BlogImageListResult>(res);
}

export async function updateBlogImageAlt(
  filename: string,
  alt: string | null,
): Promise<BlogImage> {
  const res = await fetch(
    `${API_BASE}/api/admin/blog/images/${encodeURIComponent(filename)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ alt }),
    },
  );
  const data = await unwrap<{ image: BlogImage }>(res);
  return data.image;
}

/**
 * Supprime une image. Sans `force`, le serveur renvoie 409 si l'image est
 * référencée par un article → on lève `BlogImageInUseError` (avec la liste des
 * articles) pour que l'UI propose de forcer.
 */
export async function deleteBlogImage(
  filename: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const qs = opts.force ? "?force=true" : "";
  const res = await fetch(
    `${API_BASE}/api/admin/blog/images/${encodeURIComponent(filename)}${qs}`,
    { method: "DELETE", headers: authHeaders() },
  );
  if (res.status === 409) {
    const data = (await res.json().catch(() => ({}))) as {
      referencedBy?: ReferencingPost[];
    };
    throw new BlogImageInUseError(data.referencedBy ?? []);
  }
  await unwrap<{ ok: true }>(res);
}
