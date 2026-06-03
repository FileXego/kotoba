import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchMessages, fetchReplies, submitMessage, updateMessage, toggleLike, toggleBookmark,
  type Message,
} from "../api";
import { type Lang, t } from "../i18n";

const PAGE_SIZE = 20;

export function useMessageFeed(
  lang: Lang,
  searchQuery: string,
  likedIds: Set<number>,
  setLikedIds: React.Dispatch<React.SetStateAction<Set<number>>>,
  bookmarkedIds: Set<number>,
  setBookmarkedIds: React.Dispatch<React.SetStateAction<Set<number>>>,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTrees, setReplyTrees] = useState<Record<number, Message[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const q = searchQuery.trim();

  const loadMessages = useCallback(async (offset = 0, q = "", append = false) => {
    if (append) setLoadingMore(true); else { setLoading(true); setError(null); }
    try {
      const result = await fetchMessages({ offset, limit: PAGE_SIZE, q: q || undefined });
      setMessages(prev => append ? [...prev, ...result.data] : result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "list.loadFail"));
    } finally { setLoading(false); setLoadingMore(false); }
  }, [lang]);

  const handleLoadMore = () => {
    if (loadingMore || messages.length >= total) return;
    loadMessages(messages.length, q, true);
  };

  const handleLoadReplies = async (rootId: number, force = false) => {
    if (!force && (replyTrees[rootId] || loadingReplies.has(rootId))) return;
    setLoadingReplies(prev => new Set(prev).add(rootId));
    try {
      const replies = await fetchReplies(rootId);
      setReplyTrees(prev => ({ ...prev, [rootId]: replies.data }));
    } catch {
      console.error("Failed to load replies for", rootId);
    } finally {
      setLoadingReplies(prev => { const n = new Set(prev); n.delete(rootId); return n; });
    }
  };

  const handleSubmit = async (content: string, parentId?: number) => {
    await submitMessage(content, parentId);
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
        await handleLoadReplies(rootId, true);
      }
    } else { await loadMessages(0, q); }
  };

  const handleUpdate = async (id: number, data: { content?: string; deleted?: number }) => {
    await updateMessage(id, data); await loadMessages(0, q);
    setReplyTrees(prev => {
      const next = { ...prev };
      for (const [rootId, replies] of Object.entries(next)) {
        if (replies.some(r => r.id === id) || Number(rootId) === id) {
          delete next[Number(rootId)];
          break;
        }
      }
      return next;
    });
  };

  const handleToggleLike = async (id: number) => {
    const wasLiked = likedIds.has(id);
    setLikedIds(p => { const n = new Set(p); if (wasLiked) n.delete(id); else n.add(id); return n; });
    try {
      const res = await toggleLike(id);
      setLikedIds(p => { const n = new Set(p); if (res.liked) n.add(id); else n.delete(id); return n; });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, likeCount: res.count } : m));
    } catch {
      setLikedIds(p => { const n = new Set(p); if (wasLiked) n.add(id); else n.delete(id); return n; });
    }
  };

  const handleToggleBookmark = async (id: number) => {
    const wasBookmarked = bookmarkedIds.has(id);
    setBookmarkedIds(p => { const n = new Set(p); if (wasBookmarked) n.delete(id); else n.add(id); return n; });
    try {
      const res = await toggleBookmark(id);
      setBookmarkedIds(p => { const n = new Set(p); if (res.bookmarked) n.add(id); else n.delete(id); return n; });
    } catch {
      setBookmarkedIds(p => { const n = new Set(p); if (wasBookmarked) n.add(id); else n.delete(id); return n; });
    }
  };

  const initialLoaded = useRef(false);

  // search debounce + initial load (combined to avoid double-fetch)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q && !initialLoaded.current) { loadMessages(0); initialLoaded.current = true; return; }
    searchTimer.current = setTimeout(() => { loadMessages(0, q); }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [q, loadMessages]);

  return {
    messages, total, loading, loadingMore, error, replyTrees, loadingReplies,
    loadMessages, handleLoadMore, handleLoadReplies, handleSubmit, handleUpdate,
    handleToggleLike, handleToggleBookmark,
  };
}
