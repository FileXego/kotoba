import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "./components/Header";
import { SubmitForm } from "./components/SubmitForm";
import { MessageList } from "./components/MessageList";
import { AdminPanel } from "./components/AdminPanel";
import { t, type Lang } from "./i18n";
import {
  fetchMessages, submitMessage, updateMessage, fetchReplies,
  fetchMe, fetchInteractions, toggleLike, toggleBookmark,
  type Message, type User,
} from "./api";

const PAGE_SIZE = 20;

function getInitialTheme(): "light" | "dark" {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialLang(): Lang {
  const stored = localStorage.getItem("lang");
  if (stored === "ja" || stored === "zh") return stored;
  return "ja";
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [replyTrees, setReplyTrees] = useState<Record<number, Message[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [showAdmin, setShowAdmin] = useState(false);
  // ink animation
  const [inkAnim, setInkAnim] = useState<{ x: number; y: number; theme: "light" | "dark" } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = (x?: number, y?: number) => {
    const next = theme === "light" ? "dark" : "light";
    if (x !== undefined && y !== undefined) {
      setInkAnim({ x, y, theme: next });
    } else {
      setTheme(next);
    }
  };
  // apply theme after ink animation
  useEffect(() => {
    if (!inkAnim) return;
    const t = setTimeout(() => {
      setTheme(inkAnim.theme);
      // remove overlay after theme switch
      requestAnimationFrame(() => setInkAnim(null));
    }, 600);
    return () => clearTimeout(t);
  }, [inkAnim]);
  const toggleLang = () => setLang((l) => {
    const next = l === "ja" ? "zh" : "ja";
    localStorage.setItem("lang", next);
    return next;
  });

  const loadMessages = useCallback(async (offset = 0, q = "", append = false) => {
    if (append) setLoadingMore(true); else { setLoading(true); setError(null); }
    try {
      const result = await fetchMessages({ offset, limit: PAGE_SIZE, q: q || undefined });
      setMessages(prev => append ? [...prev, ...result.data] : result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "list.loadFail"));
    } finally { setLoading(false); setLoadingMore(false); }
  }, []);

  // load user + interactions
  useEffect(() => { fetchMe().then((r) => setUser(r.user)); }, []);
  useEffect(() => {
    if (!user) { setLikedIds(new Set()); setBookmarkedIds(new Set()); return; }
    fetchInteractions().then((r) => {
      setLikedIds(new Set(r.liked)); setBookmarkedIds(new Set(r.bookmarked));
    });
  }, [user]);

  // search debounce
  const q = searchQuery.trim();
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { loadMessages(0, q); }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [q, loadMessages]);

  useEffect(() => { if (!q) loadMessages(0); }, []); // eslint-disable-line

  const handleLoadMore = () => {
    if (loadingMore || messages.length >= total) return;
    loadMessages(messages.length, q, true);
  };

  const handleLoadReplies = async (rootId: number) => {
    if (replyTrees[rootId] || loadingReplies.has(rootId)) return;
    setLoadingReplies(prev => new Set(prev).add(rootId));
    try {
      const replies = await fetchReplies(rootId);
      setReplyTrees(prev => ({ ...prev, [rootId]: replies }));
    } finally {
      setLoadingReplies(prev => { const n = new Set(prev); n.delete(rootId); return n; });
    }
  };

  const handleSubmit = async (content: string, parentId?: number) => {
    const result = await submitMessage(content, parentId);
    if (!result.success) throw new Error(t(lang, ("error." + result.error) as any) || result.error || t(lang, "error.SUBMIT_FAIL"));
    if (parentId) {
      const rootId = (() => {
        for (const m of messages) { if (m.id === parentId) return m.rootId ?? m.id; }
        for (const [, replies] of Object.entries(replyTrees)) {
          const p = replies.find(r => r.id === parentId);
          if (p) return p.rootId ?? p.id;
        }
        return null;
      })();
      if (rootId) {
        setReplyTrees(prev => { const n = { ...prev }; delete n[rootId]; return n; });
        await handleLoadReplies(rootId);
      }
    } else { await loadMessages(0, q); }
  };

  const handleUpdate = async (id: number, data: { content?: string; deleted?: number }) => {
    await updateMessage(id, data); await loadMessages(0, q); setReplyTrees({});
  };

  const handleToggleLike = async (id: number) => {
    const wasLiked = likedIds.has(id);
    setLikedIds(p => { const n = new Set(p); wasLiked ? n.delete(id) : n.add(id); return n; });
    try {
      const res = await toggleLike(id);
      setLikedIds(p => { const n = new Set(p); res.liked ? n.add(id) : n.delete(id); return n; });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, likeCount: res.count } : m));
    } catch {
      setLikedIds(p => { const n = new Set(p); wasLiked ? n.add(id) : n.delete(id); return n; });
    }
  };

  const handleToggleBookmark = async (id: number) => {
    const wasBookmarked = bookmarkedIds.has(id);
    setBookmarkedIds(p => { const n = new Set(p); wasBookmarked ? n.delete(id) : n.add(id); return n; });
    try {
      const res = await toggleBookmark(id);
      setBookmarkedIds(p => { const n = new Set(p); res.bookmarked ? n.add(id) : n.delete(id); return n; });
    } catch {
      setBookmarkedIds(p => { const n = new Set(p); wasBookmarked ? n.add(id) : n.delete(id); return n; });
    }
  };

  return (
    <div className="app">
      <Header theme={theme} lang={lang} onToggleTheme={(x, y) => toggleTheme(x, y)} onToggleLang={toggleLang}
        user={user} onUserChange={setUser} onAdminClick={() => setShowAdmin(true)} />
      {showAdmin && <AdminPanel lang={lang} onClose={() => setShowAdmin(false)} />}
      <input className="search-input" type="text" placeholder={t(lang, "search.placeholder")}
        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      <SubmitForm lang={lang}
        onImageUpload={async (f) => { const r = await (await import("./api")).uploadImage(f); return r.url; }}
        onSubmit={handleSubmit} loggedIn={!!user} />
      <MessageList lang={lang}
        messages={messages} total={total} loading={loading} loadingMore={loadingMore}
        error={error} replyTrees={replyTrees} loadingReplies={loadingReplies}
        currentUser={user} likedIds={likedIds} bookmarkedIds={bookmarkedIds}
        onUpdate={handleUpdate} onLoadReplies={handleLoadReplies}
        onLoadMore={handleLoadMore} onSubmitReply={handleSubmit}
        onToggleLike={handleToggleLike} onToggleBookmark={handleToggleBookmark}
      />
      {inkAnim && (
        <div className="ink-overlay" data-target={inkAnim.theme} style={{
          '--ink-x': `${inkAnim.x}px`, '--ink-y': `${inkAnim.y}px`,
        } as React.CSSProperties} />
      )}
    </div>
  );
}