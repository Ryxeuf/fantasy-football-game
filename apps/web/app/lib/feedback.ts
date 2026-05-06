import { apiRequest } from "./api-client";
import { API_BASE } from "../auth-client";

export type FeedbackType = "bug" | "remark" | "comment";
export type FeedbackStatus = "new" | "read" | "resolved";

export interface Feedback {
  id: string;
  type: FeedbackType;
  name: string | null;
  email: string | null;
  subject: string;
  message: string;
  userAgent: string | null;
  pageUrl: string | null;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitFeedbackInput {
  type: FeedbackType;
  name?: string;
  email?: string;
  subject: string;
  message: string;
  pageUrl?: string;
  captchaToken: string;
}

/**
 * Soumet un feedback public. Endpoint NON enveloppe `ApiResponse` : on
 * appelle directement `fetch` pour interpreter `{ ok, id }` / `{ error }`
 * sans passer par le parser d'enveloppe.
 */
export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    id?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.id) {
    throw new Error(body.error || "Erreur lors de l'envoi");
  }
  return { id: body.id };
}

export interface AdminListFeedbackParams {
  status?: FeedbackStatus;
  type?: FeedbackType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminListFeedbackResult {
  feedbacks: Feedback[];
  total: number;
  page: number;
  limit: number;
}

export async function adminListFeedback(
  params: AdminListFeedbackParams = {},
): Promise<AdminListFeedbackResult> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const path = `/admin/feedback${qs.toString() ? `?${qs.toString()}` : ""}`;
  return apiRequest<AdminListFeedbackResult>(path);
}

export async function adminGetFeedback(id: string): Promise<Feedback> {
  const data = await apiRequest<{ feedback: Feedback }>(`/admin/feedback/${id}`);
  return data.feedback;
}

export async function adminUpdateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<Feedback> {
  const data = await apiRequest<{ feedback: Feedback }>(
    `/admin/feedback/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  return data.feedback;
}
