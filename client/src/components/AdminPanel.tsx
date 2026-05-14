import { useState, useEffect } from "react";
import { t, type Lang } from "../i18n";
import { adminFetchMessages, adminFetchUsers, adminRestoreMessage, adminToggleAdmin, type Message, type AdminUser } from "../api";

export function AdminPanel({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const [tab, setTab] = useState<"messages" | "users">("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMessages = async () => {
    setLoading(true);
    try { const res = await adminFetchMessages(); setMessages(res.data); }
    catch { setError(t(lang, "admin.loadFail")); } finally { setLoading(false); }
  };
  const loadUsers = async () => {
    setLoading(true);
    try { const res = await adminFetchUsers(); setUsers(res.data); }
    catch { setError(t(lang, "admin.loadFail")); } finally { setLoading(false); }
  };
  useEffect(() => { tab === "messages" ? loadMessages() : loadUsers(); }, [tab]);

  const restore = async (id: number) => {
    try { await adminRestoreMessage(id); loadMessages(); }
    catch { setError(t(lang, "admin.loadFail")); }
  };
  const toggleAdmin = async (id: number, makeAdmin: boolean) => {
    try { await adminToggleAdmin(id, makeAdmin); loadUsers(); }
    catch { setError(t(lang, "admin.loadFail")); }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>{t(lang, "admin.title")}</h2>
        <button className="auth-btn" onClick={onClose}>{t(lang, "admin.close")}</button>
      </div>
      <div className="auth-tabs">
        <button className={`auth-tab ${tab === "messages" ? "active" : ""}`} onClick={() => setTab("messages")}>{t(lang, "admin.messages")}</button>
        <button className={`auth-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>{t(lang, "admin.users")}</button>
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
                  <button className="auth-btn" onClick={() => restore(m.id)}>{t(lang, "admin.restore")}</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {!loading && tab === "users" && (
        <div className="admin-list">
          {users.map(u => (
            <div key={u.id} className="admin-item">
              <div><strong>{u.username}</strong> <span className="admin-meta">{u.email}</span></div>
              <div className="admin-actions">
                {u.isAdmin ? (
                  <button className="auth-btn" onClick={() => toggleAdmin(u.id, false)}>{t(lang, "admin.removeAdmin")}</button>
                ) : (
                  <button className="auth-btn" onClick={() => toggleAdmin(u.id, true)}>{t(lang, "admin.makeAdmin")}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}