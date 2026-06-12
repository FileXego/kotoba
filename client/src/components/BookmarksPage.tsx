import { useCallback, useState, useEffect } from "react";
import { fetchBookmarks, toggleBookmark, toggleLike, fetchInteractions, type Message, type User } from "../api";
import { t, type Lang } from "../i18n";
import { MessageCard } from "./MessageCard";

interface Props {
  lang: Lang;
  currentUser: User | null;
  onUpdate: (id: number, data: { content?: string; deleted?: number }) => Promise<void>;
  onSubmitReply: (content: string, parentId?: number) => Promise<void>;
  onOpenThread?: (id: number) => void;
}

export function BookmarksPage({ lang, currentUser, onUpdate, onSubmitReply, onOpenThread }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (currentUser) {
      fetchInteractions().then(r => {
        setLikedIds(new Set(r.liked));
        setBookmarkedIds(new Set(r.bookmarked));
      }).catch(() => {});
    }
  }, [currentUser]);

  const load = useCallback(async (offset = 0) => {
    if (offset === 0) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const result = await fetchBookmarks({ offset, limit: 20 });
      setMessages(prev => offset === 0 ? result.data : [...prev, ...result.data]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "list.loadFail"));
    } finally { setLoading(false); setLoadingMore(false); }
  }, [lang]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (currentUser) load();
  }, [currentUser, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!currentUser) return <div className="submit-form auth-prompt"><p>{t(lang, "auth.needLogin")}</p></div>;
  if (loading) return <div className="loading">{t(lang, "list.loading")}</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (messages.length === 0) return <div className="empty-state"><p>{t(lang, "bookmarks.empty")}</p></div>;

  return (
    <section>
      <div className="list-header">{t(lang, "bookmarks.title")}</div>
      <div className="message-list">
        {messages.map((msg) => (
            <MessageCard key={msg.id} lang={lang} message={msg}
              replies={null} loadingReplies={false}
              currentUser={currentUser} likedIds={likedIds} bookmarkedIds={bookmarkedIds}
              onUpdate={async (id, data) => { await onUpdate(id, data); await load(); }}
              onLoadReplies={() => {}}
              onSubmitReply={async (content, parentId) => { await onSubmitReply(content, parentId); }}
              onToggleLike={async (id) => {
                const wasLiked = likedIds.has(id);
                setLikedIds(p => { const n = new Set(p); if (wasLiked) n.delete(id); else n.add(id); return n; });
                try {
                  const res = await toggleLike(id);
                  setLikedIds(p => { const n = new Set(p); if (res.liked) n.add(id); else n.delete(id); return n; });
                  setMessages(prev => prev.map(m => m.id === id ? { ...m, likeCount: res.count } : m));
                } catch {
                  setLikedIds(p => { const n = new Set(p); if (wasLiked) n.add(id); else n.delete(id); return n; });
                }
              }}
              onToggleBookmark={async () => {
                const wasBookmarked = bookmarkedIds.has(msg.id);
                setBookmarkedIds(p => { const n = new Set(p); n.delete(msg.id); return n; });
                try {
                  await toggleBookmark(msg.id);
                } catch {
                  setBookmarkedIds(p => { const n = new Set(p); if (wasBookmarked) n.add(msg.id); return n; });
                }
                load();
              }}
              onOpenThread={onOpenThread} />
        ))}
      </div>
      {messages.length < total && (
        <button className="load-more-btn" onClick={() => load(messages.length)} disabled={loadingMore}>
          {loadingMore ? t(lang, "list.loading") : t(lang, "list.loadMore")}
        </button>
      )}
    </section>
  );
}
