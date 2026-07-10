import { type Message, type User } from "../api";
import { t, type Lang } from "../i18n";
import { MessageCard } from "./MessageCard";

interface Props {
  lang: Lang; messages: Message[]; total: number;
  loading: boolean; loadingMore: boolean; error: string | null;
  replyTrees: Record<number, Message[]>; loadingReplies: Set<number>;
  replyErrors: Record<number, string>;
  currentUser: User | null; likedIds: Set<number>; bookmarkedIds: Set<number>;
  onUpdate: (id: number, data: { content?: string; deleted?: number }) => Promise<void>;
  onLoadReplies: (rootId: number) => void; onLoadMore: () => void;
  onSubmitReply: (content: string, parentId?: number) => Promise<void>;
  onToggleLike: (id: number) => void; onToggleBookmark: (id: number) => void;
  onOpenThread?: (id: number) => void;
}

export function MessageList({
  lang, messages, total, loading, loadingMore, error,
  replyTrees, loadingReplies, replyErrors, currentUser, likedIds, bookmarkedIds,
  onUpdate, onLoadReplies, onLoadMore, onSubmitReply,
  onToggleLike, onToggleBookmark, onOpenThread,
}: Props) {
  if (loading) return <div className="loading">{t(lang, "list.loading")}</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (messages.length === 0)
    return <div className="empty-state"><p>{t(lang, "list.empty")}</p><span>{t(lang, "list.emptySub")}</span></div>;

  return (
    <section className="editorial-section">
      <div className="list-header">
        <span className="section-kicker">{t(lang, "editorial.issue")} · 01</span>
        <span>{t(lang, "editorial.entries")}</span>
      </div>
      <div className="message-list">
        {messages.map((msg, index) => (
          <MessageCard key={msg.id} lang={lang} message={msg}
            replies={replyTrees[msg.id] ?? null} loadingReplies={loadingReplies.has(msg.id)}
            replyLoadError={replyErrors[msg.id]}
            currentUser={currentUser} likedIds={likedIds} bookmarkedIds={bookmarkedIds}
            onUpdate={onUpdate} onLoadReplies={onLoadReplies} onSubmitReply={onSubmitReply}
            onToggleLike={onToggleLike} onToggleBookmark={onToggleBookmark}
            onOpenThread={onOpenThread} entryIndex={index} />
        ))}
      </div>
      {messages.length < total && (
        <button className="load-more-btn" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? t(lang, "list.loading") : t(lang, "list.loadMore")}
        </button>
      )}
    </section>
  );
}
