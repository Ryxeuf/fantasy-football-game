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
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
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

export async function createAdminBlogPost(input: BlogPostInput): Promise<BlogPostDetail> {
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

export async function deleteAdminBlogPost(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/blog/posts/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrap<{ ok: true }>(res);
}
