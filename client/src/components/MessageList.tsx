import { type Message, type User } from "../api";
import { t, type Lang } from "../i18n";
import { MessageCard } from "./MessageCard";

interface Props {
  lang: Lang; messages: Message[]; total: number;
  loading: boolean; loadingMore: boolean; error: string | null;
  replyTrees: Record<number, Message[]>; loadingReplies: Set<number>;
  currentUser: User | null; likedIds: Set<number>; bookmarkedIds: Set<number>;
  onUpdate: (id: number, data: { content?: string; deleted?: number }) => Promise<void>;
  onLoadReplies: (rootId: number) => void; onLoadMore: () => void;
  onSubmitReply: (content: string, parentId?: number) => Promise<void>;
  onToggleLike: (id: number) => void; onToggleBookmark: (id: number) => void;
}

export function MessageList({
  lang, messages, total, loading, loadingMore, error,
  replyTrees, loadingReplies, currentUser, likedIds, bookmarkedIds,
  onUpdate, onLoadReplies, onLoadMore, onSubmitReply,
  onToggleLike, onToggleBookmark,
}: Props) {
  if (loading) return <div className="loading">{t(lang, "list.loading")}</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (messages.length === 0)
    return <div className="empty-state"><p>{t(lang, "list.empty")}</p><span>{t(lang, "list.emptySub")}</span></div>;

  return (
    <section>
      <div className="list-header">{t(lang, "list.header")}</div>
      <div className="message-list">
        {messages.map((msg) => (
          <MessageCard key={msg.id} lang={lang} message={msg}
            replies={replyTrees[msg.id] ?? null} loadingReplies={loadingReplies.has(msg.id)}
            currentUser={currentUser} likedIds={likedIds} bookmarkedIds={bookmarkedIds}
            onUpdate={onUpdate} onLoadReplies={onLoadReplies} onSubmitReply={onSubmitReply}
            onToggleLike={onToggleLike} onToggleBookmark={onToggleBookmark} />
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