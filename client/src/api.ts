import type { ThemeName } from "./theme/theme";

const BASE = "/api";

async function requestJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`[HTTP_${res.status}] ${data.error || ""}`);
  if (data.success === false) throw new Error(`[API] ${data.error || "unknown"}`);
  return data as T;
}

export interface Message {
  id: number; name: string; content: string;
  createdAt: string; updatedAt?: string; deleted?: number;
  parentId?: number | null; rootId?: number | null; depth?: number; likeCount?: number;
  userId?: number | null; avatarUrl?: string | null; signature?: string | null;
}

export interface MessagesResponse { success: boolean; data: Message[]; total: number; offset: number; limit: number; }

export interface User { id: number; username: string; email: string; isAdmin?: number; avatarUrl?: string | null; signature?: string | null; theme?: ThemeName; }

// ── Messages ──

export async function fetchMessages(params?: { offset?: number; limit?: number; q?: string }) {
  const sp = new URLSearchParams();
  if (params?.offset) sp.set("offset", String(params.offset));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.q) sp.set("q", params.q);
  const qs = sp.toString();
  return requestJSON<MessagesResponse>(`${BASE}/messages${qs ? "?" + qs : ""}`);
}

export async function fetchReplies(rootId: number) {
  const res = await requestJSON<{ success: boolean; data: Message[] }>(`${BASE}/messages/${rootId}/replies`);
  return res;
}

export async function submitMessage(content: string, parentId?: number) {
  return requestJSON<{ success: boolean; id: number; error?: string }>(`${BASE}/message`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ...(parentId !== undefined ? { parentId } : {}) }),
  });
}

export async function updateMessage(id: number, body: { content?: string; deleted?: number }) {
  return requestJSON<{ success: boolean }>(`${BASE}/message/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

// ── Likes & Bookmarks ──

export async function toggleLike(id: number) {
  return requestJSON<{ success: boolean; liked: boolean; count: number }>(`${BASE}/messages/${id}/like`, { method: "POST" });
}

export async function toggleBookmark(id: number) {
  return requestJSON<{ success: boolean; bookmarked: boolean }>(`${BASE}/messages/${id}/bookmark`, { method: "POST" });
}

export async function fetchInteractions() {
  const res = await requestJSON<{ success: boolean; liked: number[]; bookmarked: number[] }>(`${BASE}/me/likes`);
  return { liked: res.liked ?? [], bookmarked: res.bookmarked ?? [] };
}

export async function fetchBookmarks(params?: { offset?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.offset) sp.set("offset", String(params.offset));
  if (params?.limit) sp.set("limit", String(params.limit));
  return requestJSON<MessagesResponse>(`${BASE}/bookmarks${sp.toString() ? "?" + sp.toString() : ""}`);
}

// ── Upload ──

export async function uploadImage(file: File) {
  const fd = new FormData(); fd.append("file", file);
  return requestJSON<{ success: boolean; url: string }>(`${BASE}/upload`, { method: "POST", body: fd });
}

export async function uploadAvatar(file: File) {
  const fd = new FormData(); fd.append("file", file);
  return requestJSON<{ success: boolean; user: User }>(`${BASE}/auth/avatar`, { method: "PATCH", body: fd });
}

// ── Auth ──

export async function signUp(username: string, email: string, password: string, captchaToken: string) {
  return requestJSON<{ success: boolean; user?: User; error?: string }>(`${BASE}/auth/sign-up`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, captchaToken }),
  });
}

export async function signIn(username: string, password: string) {
  return requestJSON<{ success: boolean; user?: User; error?: string }>(`${BASE}/auth/sign-in`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
  });
}

export async function signOut(): Promise<void> {
  await requestJSON(`${BASE}/auth/sign-out`, { method: "POST" });
}

export async function fetchMe() {
  return requestJSON<{ success: boolean; user: User | null }>(`${BASE}/auth/me`);
}

export async function updateMe(body: { signature?: string; theme?: ThemeName }) {
  return requestJSON<{ success: boolean; user: User }>(`${BASE}/auth/me`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

// ── Admin ──

export interface AdminUser { id: number; username: string; email: string; isAdmin?: number; }

export async function adminFetchMessages(offset = 0, limit = 50) {
  return requestJSON<MessagesResponse>(`${BASE}/admin/messages?offset=${offset}&limit=${limit}`);
}

export async function adminRestoreMessage(id: number): Promise<void> {
  await requestJSON(`${BASE}/admin/messages/${id}/restore`, { method: "PATCH" });
}

export async function adminFetchUsers() {
  return requestJSON<{ success: boolean; data: AdminUser[] }>(`${BASE}/admin/users`);
}

export async function adminToggleAdmin(id: number, admin: boolean): Promise<void> {
  await requestJSON(`${BASE}/admin/users/${id}/admin`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admin }),
  });
}
