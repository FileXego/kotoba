import { useState, useEffect } from "react";
import { fetchReplies, type Message, type User } from "../api";
import { t, type Lang } from "../i18n";
import { MessageCard } from "./MessageCard";

interface Props {
  lang: Lang;
  messageId: number;
  currentUser: User | null;
  likedIds: Set<number>;
  bookmarkedIds: Set<number>;
  onSubmitReply: (content: string, parentId?: number) => Promise<void>;
  onToggleLike: (id: number) => void;
  onToggleBookmark: (id: number) => void;
  onBack: () => void;
}

export function ThreadPage({
  lang, messageId, currentUser, likedIds, bookmarkedIds,
  onSubmitReply, onToggleLike, onToggleBookmark, onBack,
}: Props) {
  const [replies, setReplies] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchReplies(messageId).then((r) => {
      if (!cancelled) setReplies(r.data);
    }).catch(() => {
      if (!cancelled) setError(t(lang, "list.loadFail"));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [messageId, lang]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading) return <div className="loading">{t(lang, "list.loading")}</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!replies || replies.length === 0) return <div className="error-msg">{t(lang, "error.NOT_FOUND")}</div>;

  const rootMsg = replies.find((m) => m.id === messageId);
  if (!rootMsg) return <div className="error-msg">{t(lang, "error.NOT_FOUND")}</div>;

  return (
    <div className="thread-page">
      <button className="back-btn" onClick={onBack}>
        {t(lang, "form.cancel")}
      </button>
      <MessageCard
        lang={lang} message={rootMsg} replies={replies}
        loadingReplies={false} currentUser={currentUser}
        likedIds={likedIds} bookmarkedIds={bookmarkedIds}
        onUpdate={async () => {}} onLoadReplies={() => {}}
        onSubmitReply={onSubmitReply}
        onToggleLike={onToggleLike} onToggleBookmark={onToggleBookmark}
      />
    </div>
  );
}
