import { useState, useEffect } from "react";
import { t, type Lang } from "../i18n";
import { adminFetchMessages, adminFetchUsers, adminRestoreMessage, adminToggleAdmin, type Message, type AdminUser } from "../api";

const MESSAGE_PAGE_SIZE = 50;

export function AdminPanel({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const [tab, setTab] = useState<"messages" | "users">("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messagePage, setMessagePage] = useState(0);
  const [messageTotal, setMessageTotal] = useState(0);

  const loadMessages = async (page = messagePage) => {
    setLoading(true); setError("");
    try {
      const res = await adminFetchMessages(page * MESSAGE_PAGE_SIZE, MESSAGE_PAGE_SIZE);
      setMessages(res.data);
      setMessageTotal(res.total);
    }
    catch { setError(t(lang, "admin.loadFail")); } finally { setLoading(false); }
  };
  const loadUsers = async () => {
    setLoading(true); setError("");
    try { const res = await adminFetchUsers(); setUsers(res.data); }
    catch { setError(t(lang, "admin.loadFail")); } finally { setLoading(false); }
  };
  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    if (tab === "messages") loadMessages(messagePage);
    else loadUsers();
  }, [tab, messagePage]);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const restore = async (id: number) => {
    try { await adminRestoreMessage(id); loadMessages(messagePage); }
    catch { setError(t(lang, "admin.loadFail")); }
  };
  const messagePageCount = Math.max(1, Math.ceil(messageTotal / MESSAGE_PAGE_SIZE));
  const toggleAdmin = async (id: number, makeAdmin: boolean) => {
    try { await adminToggleAdmin(id, makeAdmin); loadUsers(); }
    catch { setError(t(lang, "admin.loadFail")); }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <span className="section-kicker">{t(lang, "editorial.issue")} · 05</span>
          <h2>{t(lang, "admin.title")}</h2>
        </div>
        <button type="button" className="auth-btn" onClick={onClose}>{t(lang, "admin.close")}</button>
      </div>
      <div className="auth-tabs">
        <button type="button" className={`auth-tab ${tab === "messages" ? "active" : ""}`} onClick={() => { setMessagePage(0); setTab("messages"); }}>{t(lang, "admin.messages")}</button>
        <button type="button" className={`auth-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>{t(lang, "admin.users")}</button>
      </div>
      {loading && <div className="loading">{t(lang, "list.loading")}</div>}
      {error && <div className="error-msg">{error}</div>}
      {!loading && tab === "messages" && (
        <div className="admin-list">
          {messages.map(m => (
            <div key={m.id} className={`admin-item ${m.deleted ? "deleted" : ""}`}>
              <div><strong>{m.name}</strong> <span className="admin-meta">{new Date(m.createdAt).toLocaleString(lang === "ja" ? "ja-JP" : "zh-CN")}</span></div>
              <div className="admin-content">{m.content.slice(0, 100)}</div>
              {m.deleted ? (
                <div className="admin-actions">
                  <button type="button" className="auth-btn" onClick={() => restore(m.id)}>{t(lang, "admin.restore")}</button>
                </div>
              ) : null}
            </div>
          ))}
          <nav className="admin-pagination" aria-label={t(lang, "admin.pagination")}>
            <button
              type="button"
              className="auth-btn"
              onClick={() => setMessagePage((page) => Math.max(0, page - 1))}
              disabled={messagePage === 0 || loading}
            >
              {t(lang, "admin.previous")}
            </button>
            <span aria-live="polite">{messagePage + 1} / {messagePageCount}</span>
            <button
              type="button"
              className="auth-btn"
              onClick={() => setMessagePage((page) => Math.min(messagePageCount - 1, page + 1))}
              disabled={messagePage + 1 >= messagePageCount || loading}
            >
              {t(lang, "admin.next")}
            </button>
          </nav>
        </div>
      )}
      {!loading && tab === "users" && (
        <div className="admin-list">
          {users.map(u => (
            <div key={u.id} className="admin-item">
              <div><strong>{u.username}</strong> <span className="admin-meta">{u.email}</span></div>
              <div className="admin-actions">
                {u.isAdmin ? (
                  <button type="button" className="auth-btn" onClick={() => toggleAdmin(u.id, false)}>{t(lang, "admin.removeAdmin")}</button>
                ) : (
                  <button type="button" className="auth-btn" onClick={() => toggleAdmin(u.id, true)}>{t(lang, "admin.makeAdmin")}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
