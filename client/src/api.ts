const BASE = "/api";

export interface Message {
  id: number;
  name: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  deleted?: number;
  parentId?: number | null;
  rootId?: number | null;
  depth?: number;
  likeCount?: number;
}

export interface MessagesResponse {
  success: boolean;
  data: Message[];
  total: number;
  offset: number;
  limit: number;
}

// ── Messages ──

export async function fetchMessages(params?: {
  offset?: number; limit?: number; q?: string;
}): Promise<MessagesResponse> {
  const sp = new URLSearchParams();
  if (params?.offset) sp.set("offset", String(params.offset));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.q) sp.set("q", params.q);
  const qs = sp.toString();
  const res = await fetch(`${BASE}/messages${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function fetchReplies(rootId: number): Promise<Message[]> {
  const res = await fetch(`${BASE}/messages/${rootId}/replies`);
  if (!res.ok) throw new Error("Failed to fetch replies");
  const data = await res.json();
  return data.data ?? [];
}

export async function submitMessage(
  content: string, parentId?: number
): Promise<{ success: boolean; id: number; error?: string }> {
  const res = await fetch(`${BASE}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ...(parentId !== undefined ? { parentId } : {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit message");
  }
  return res.json();
}

export async function updateMessage(
  id: number, body: { content?: string; deleted?: number }
): Promise<void> {
  const res = await fetch(`${BASE}/message/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update message");
}

// ── Likes & Bookmarks ──

export async function toggleLike(id: number): Promise<{ success: boolean; liked: boolean; count: number }> {
  const res = await fetch(`${BASE}/messages/${id}/like`, { method: "POST" });
  return res.json();
}

export async function toggleBookmark(id: number): Promise<{ success: boolean; bookmarked: boolean }> {
  const res = await fetch(`${BASE}/messages/${id}/bookmark`, { method: "POST" });
  return res.json();
}

export async function fetchInteractions(): Promise<{ liked: number[]; bookmarked: number[] }> {
  const res = await fetch(`${BASE}/me/likes`);
  const data = await res.json();
  return { liked: data.liked ?? [], bookmarked: data.bookmarked ?? [] };
}

// ── Upload ──

export async function uploadImage(file: File): Promise<{ success: boolean; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Failed to upload image");
  return res.json();
}

// ── Auth ──

export interface User {
  id: number;
  username: string;
  email: string;
  isAdmin?: number;
}

export async function signUp(
  username: string, email: string, password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const res = await fetch(`${BASE}/auth/sign-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  return res.json();
}

export async function signIn(
  username: string, password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const res = await fetch(`${BASE}/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function signOut(): Promise<void> {
  await fetch(`${BASE}/auth/sign-out`, { method: "POST" });
}

export async function fetchMe(): Promise<{ success: boolean; user: User | null }> {
  const res = await fetch(`${BASE}/auth/me`);
  return res.json();
}

// ── Captcha ──

export async function verifyCaptcha(token: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/captcha/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.json();
}

// ── Admin ──

interface AdminMessagesResponse { success: boolean; data: Message[]; total: number; }

export async function adminFetchMessages(offset = 0, limit = 50): Promise<AdminMessagesResponse> {
  const res = await fetch(`${BASE}/admin/messages?offset=${offset}&limit=${limit}`);
  return res.json();
}

export async function adminRestoreMessage(id: number): Promise<void> {
  await fetch(`${BASE}/admin/messages/${id}/restore`, { method: "PATCH" });
}

export async function adminDeleteMessage(id: number): Promise<void> {
  await fetch(`${BASE}/admin/messages/${id}`, { method: "DELETE" });
}

export interface AdminUser { id: number; username: string; email: string; isAdmin?: number; }

export async function adminFetchUsers(): Promise<{ success: boolean; data: AdminUser[] }> {
  const res = await fetch(`${BASE}/admin/users`);
  return res.json();
}

export async function adminToggleAdmin(id: number, admin: boolean): Promise<void> {
  await fetch(`${BASE}/admin/users/${id}/admin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin }),
  });
}
