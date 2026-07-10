import { useState, type FormEvent } from "react";
import { type Message, type User } from "../api";
import { t, type Lang } from "../i18n";
import { Avatar } from "./Avatar";
import { motion } from "motion/react";
import { entryVariants } from "../design/motion";

interface ReplyInfo { message: Message; replies: Message[]; ownDepth: number; }

interface Props {
  lang: Lang; message: Message; replies: Message[] | null;
  loadingReplies: boolean; replyLoadError?: string; currentUser: User | null;
  likedIds: Set<number>; bookmarkedIds: Set<number>;
  onUpdate: (id: number, data: { content?: string; deleted?: number }) => Promise<void>;
  onLoadReplies: (rootId: number) => void;
  onSubmitReply: (content: string, parentId?: number) => Promise<void>;
  onToggleLike: (id: number) => void; onToggleBookmark: (id: number) => void;
  onOpenThread?: (id: number) => void;
  expandRepliesByDefault?: boolean;
  ownDepth?: number;
  entryIndex?: number;
}

function formatTime(lang: Lang, iso: string): string {
  const date = new Date(iso); const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (mins < 1) return t(lang, "time.justNow");
  if (mins < 60) return `${mins}${t(lang, "time.minutesAgo")}`;
  if (hours < 24) return `${hours}${t(lang, "time.hoursAgo")}`;
  if (days < 7) return `${days}${t(lang, "time.daysAgo")}`;
  return date.toLocaleDateString(lang === "ja" ? "ja-JP" : "zh-CN");
}

const TRUNCATE_AT = 120; const MAX_DEPTH = 2;

const IMG_RE = /\[image:(\/uploads\/[^\]]+\.(png|jpg|jpeg|webp))\]/gi;

function renderContent(content: string) {
  const parts: (string | { src: string; key: number })[] = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = IMG_RE.exec(content)) !== null) {
    if (m.index > last) parts.push(content.slice(last, m.index));
    parts.push({ src: m[1], key: m.index });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  if (parts.length === 1 && typeof parts[0] === "string") return content;
  return parts.map((p) =>
    typeof p === "string" ? p : <img key={p.key} src={p.src} alt="" className="msg-image" loading="lazy" />
  );
}

export function MessageCard({
  lang, message: { id, name, content, createdAt, depth = 0, likeCount = 0, avatarUrl, signature, userId },
  replies, loadingReplies, replyLoadError, currentUser, likedIds, bookmarkedIds,
  onUpdate, onLoadReplies, onSubmitReply, onToggleLike, onToggleBookmark, ownDepth,
  onOpenThread, expandRepliesByDefault,
  entryIndex = 0,
}: Props) {
  const d = ownDepth ?? depth;
  const liked = likedIds.has(id);
  const bookmarked = bookmarkedIds.has(id);
  const long = content.length > TRUNCATE_AT;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [editError, setEditError] = useState("");
  const [showReplies, setShowReplies] = useState(Boolean(expandRepliesByDefault));
  const [replying, setReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyError, setReplyError] = useState("");
  const [actionError, setActionError] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const isMine = currentUser?.id === userId || currentUser?.username === name;
  const canReply = d < MAX_DEPTH;
  const childReplies: ReplyInfo[] = replies
    ? replies.filter((m) => m.parentId === id).map(m => ({ message: m, replies, ownDepth: d + 1 }))
    : [];
  const replyCount = replies ? childReplies.length : null;

  const handleSave = async () => {
    if (!editText.trim()) return;
    try { await onUpdate(id, { content: editText.trim() }); setEditing(false); setEditError(""); }
    catch { setEditError(t(lang, "list.loadFail")); }
  };
  const handleDelete = async () => {
    setActionError("");
    try { await onUpdate(id, { deleted: 1 }); }
    catch { setActionError(t(lang, "list.loadFail")); }
  };
  const handleToggleReplies = () => { if (!replies && !showReplies) onLoadReplies(id); setShowReplies(!showReplies); };

  const handleReplySubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!replyContent.trim()) return;
    setSendingReply(true);
    setReplyError("");
    try { await onSubmitReply(replyContent.trim(), id); setReplyContent(""); setReplying(false); }
    catch { setReplyError(t(lang, "error.SUBMIT_FAIL")); }
    finally { setSendingReply(false); }
  };

  return (
    <div>
      <motion.article
        className="message-card"
        data-depth={d}
        custom={entryIndex}
        variants={entryVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="card-header">
          <span className="card-index" aria-hidden="true">{String(id).padStart(3, "0")}</span>
          <Avatar name={name} src={avatarUrl} />
          <span className="card-name">{name}</span>
          <time className="card-time">{formatTime(lang, createdAt)}</time>
        </div>
        {editing ? (
          <div>
            <textarea className="edit-textarea" value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={500} />
            {editError && <p className="auth-error">{editError}</p>}
          </div>
        ) : (
          <>
            <div className="card-content">
              {long && !expanded ? content.slice(0, TRUNCATE_AT) + "…" : renderContent(content)}
            </div>
            {currentUser && currentUser.id === userId && signature && (
              <div className="card-signature">—— {signature}</div>
            )}
          </>
        )}
        <div className="card-actions">
          {long && !editing && (
            <button type="button" className="expand-link" onClick={() => setExpanded(!expanded)}>
              {expanded ? t(lang, "form.collapse") : t(lang, "form.expand")}
            </button>
          )}
          {currentUser && (
            <button type="button" className={`action-btn ${liked ? "liked" : ""}`}
              aria-label={t(lang, "form.like")} title={t(lang, "form.like")} onClick={() => onToggleLike(id)}>
              {liked ? "♥" : "♡"}{likeCount > 0 && <span className="action-count">{likeCount}</span>}
            </button>
          )}
          {currentUser && (
            <button type="button" className={`action-btn ${bookmarked ? "bookmarked" : ""}`}
              aria-label={t(lang, "bookmarks.title")} title={t(lang, "bookmarks.title")} onClick={() => onToggleBookmark(id)}>
              {bookmarked ? "★" : "☆"}
            </button>
          )}
          {onOpenThread && d === 0 && !editing && (
            <button type="button" className="action-btn thread-link-btn" onClick={() => onOpenThread(id)}>
              {t(lang, "form.thread")}
            </button>
          )}
          {isMine && !editing && (<>
            <button type="button" className="action-btn owner-btn" onClick={() => { setEditText(content); setEditing(true); setEditError(""); setActionError(""); }}>
              {t(lang, "form.edit")}</button>
            <button type="button" className="action-btn owner-btn del-btn" onClick={handleDelete}>{t(lang, "form.delete")}</button>
          </>)}
          {editing && (<>
            <button type="button" className="action-btn owner-btn" onClick={handleSave}>{t(lang, "form.save")}</button>
            <button type="button" className="action-btn owner-btn" onClick={() => { setEditing(false); setEditError(""); }}>{t(lang, "form.cancel")}</button>
          </>)}
          {currentUser && canReply && !editing && (
            <button type="button" className="action-btn reply-btn" onClick={() => { setReplying(!replying); setActionError(""); }}>{t(lang, "form.reply")}</button>
          )}
          {replyCount !== null && replyCount > 0 && (
            <button type="button" className="action-btn toggle-replies-btn" onClick={handleToggleReplies}>
              {showReplies ? "▾" : "▸"} {replyCount}{t(lang, "form.replyCount")}
            </button>
          )}
          {loadingReplies && <span className="loading-replies">{t(lang, "list.loading")}</span>}
        </div>
        {replyLoadError && <p className="auth-error card-action-error">{replyLoadError}</p>}
        {actionError && <p className="auth-error card-action-error">{actionError}</p>}
        {replying && <button type="button" className="reply-sheet-backdrop" aria-label={t(lang, "form.cancel")} onClick={() => setReplying(false)} />}
        {replying && (<form className="inline-reply-form" onSubmit={handleReplySubmit} aria-label={t(lang, "form.reply")}>
          <textarea className="reply-textarea" placeholder={t(lang, "form.reply") + "..."}
            value={replyContent} onChange={(e) => setReplyContent(e.target.value)} maxLength={500} />
          <div className="reply-form-actions">
            <button type="submit" className="action-btn owner-btn" disabled={sendingReply}>
              {sendingReply ? "..." : t(lang, "form.send")}</button>
            <button type="button" className="action-btn owner-btn" onClick={() => setReplying(false)}>{t(lang, "form.cancel")}</button>
          </div>
          {replyError && <p className="auth-error">{replyError}</p>}
        </form>)}
      </motion.article>
      {showReplies && childReplies.length > 0 && (<div className="reply-tree">
        {childReplies.map(({ message, replies, ownDepth }) => (
          <MessageCard key={message.id} lang={lang} message={message} replies={replies}
            loadingReplies={false} currentUser={currentUser}
            replyLoadError={undefined}
            likedIds={likedIds} bookmarkedIds={bookmarkedIds}
            onUpdate={onUpdate} onLoadReplies={onLoadReplies} onSubmitReply={onSubmitReply}
            ownDepth={ownDepth} onToggleLike={onToggleLike} onToggleBookmark={onToggleBookmark}
            onOpenThread={onOpenThread} expandRepliesByDefault={expandRepliesByDefault}
            entryIndex={ownDepth} />
        ))}
      </div>)}
    </div>
  );
}
