import { useState, useEffect, useCallback } from "react";
import { fetchReplies, type Message, type User } from "../api";
import { t, type Lang } from "../i18n";
import type { RealtimeClientEvent } from "../hooks/useRealtimeEvents";
import { MessageCard } from "./MessageCard";

interface Props {
  lang: Lang;
  messageId: number;
  currentUser: User | null;
  likedIds: Set<number>;
  bookmarkedIds: Set<number>;
  onSubmitReply: (content: string, parentId?: number) => Promise<void>;
  onUpdate: (id: number, data: { content?: string; deleted?: number }) => Promise<void>;
  onToggleLike: (id: number) => void;
  onToggleBookmark: (id: number) => void;
  onBack: () => void;
  realtimeEvent: RealtimeClientEvent | null;
}

export function ThreadPage({
  lang, messageId, currentUser, likedIds, bookmarkedIds,
  onSubmitReply, onUpdate, onToggleLike, onToggleBookmark, onBack,
  realtimeEvent,
}: Props) {
  const [replies, setReplies] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchReplies(messageId);
      if (!isCancelled()) setReplies(r.data);
    } catch {
      if (!isCancelled()) setError(t(lang, "list.loadFail"));
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, [messageId, lang]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    loadThread(() => cancelled);
    return () => { cancelled = true; };
  }, [loadThread]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.type === "ready" || realtimeEvent.type === "interaction.changed" || realtimeEvent.type === "ping") return;
    if (realtimeEvent.type === "sync.tick") {
      void loadThread();
      return;
    }
    if (realtimeEvent.type === "message.liked") {
      setReplies(prev => prev?.map(m => m.id === realtimeEvent.messageId ? { ...m, likeCount: realtimeEvent.count } : m) ?? prev);
      return;
    }
    if (realtimeEvent.type === "message.restored") {
      if (realtimeEvent.messageId === messageId) void loadThread();
      return;
    }
    const rootId = realtimeEvent.rootId ?? realtimeEvent.messageId;
    if (rootId === messageId || realtimeEvent.messageId === messageId) void loadThread();
  }, [loadThread, messageId, realtimeEvent]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmitReply = async (content: string, parentId?: number) => {
    await onSubmitReply(content, parentId);
    await loadThread();
  };

  const handleUpdate = async (id: number, data: { content?: string; deleted?: number }) => {
    await onUpdate(id, data);
    if (id === messageId && data.deleted === 1) {
      onBack();
      return;
    }
    await loadThread();
  };

  if (loading) return <div className="loading">{t(lang, "list.loading")}</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!replies || replies.length === 0) return <div className="error-msg">{t(lang, "error.NOT_FOUND")}</div>;

  const rootMsg = replies.find((m) => m.id === messageId);
  if (!rootMsg) return <div className="error-msg">{t(lang, "error.NOT_FOUND")}</div>;

  return (
    <div className="thread-page">
      <div className="thread-topbar">
        <button type="button" className="thread-back" onClick={onBack}>
          {t(lang, "nav.back")}
        </button>
        <h2 className="thread-title">{t(lang, "thread.title")}</h2>
      </div>
      <MessageCard
        lang={lang} message={rootMsg} replies={replies}
        loadingReplies={false} currentUser={currentUser}
        likedIds={likedIds} bookmarkedIds={bookmarkedIds}
        onUpdate={handleUpdate} onLoadReplies={() => {}}
        onSubmitReply={handleSubmitReply}
        onToggleLike={onToggleLike} onToggleBookmark={onToggleBookmark}
        expandRepliesByDefault
      />
    </div>
  );
}
