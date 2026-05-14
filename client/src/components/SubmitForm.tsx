import { useState, useRef, type FormEvent } from "react";
import { t, type Lang } from "../i18n";

interface Props {
  lang: Lang;
  onSubmit: (content: string, parentId?: number) => Promise<void>;
  onImageUpload: (file: File) => Promise<string>;
  loggedIn: boolean;
  replyTo?: { id: number; name: string } | null;
  onCancelReply?: () => void;
}

export function SubmitForm({ lang, onSubmit, onImageUpload, loggedIn, replyTo, onCancelReply }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await onSubmit(content.trim(), replyTo?.id);
      setContent("");
      onCancelReply?.();
    } finally { setSending(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert(t(lang, "form.imageToolarge"));
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      setContent((prev) => prev + (prev ? "\n" : "") + `![](${url})`);
    } catch { alert(t(lang, "form.imageFail")); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  if (!loggedIn && !replyTo) {
    return <div className="submit-form auth-prompt"><p>{t(lang, "auth.needLogin")}</p></div>;
  }

  return (
    <form className="submit-form" onSubmit={handleSubmit}>
      {replyTo && (
        <div className="reply-notice">
          <span>{replyTo.name} {t(lang, "form.replyTo")}</span>
          <button type="button" className="reply-cancel" onClick={onCancelReply}>×</button>
        </div>
      )}
      <label htmlFor="content">{t(lang, "form.thought")}</label>
      <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)}
        maxLength={500} placeholder={t(lang, "form.placeholder")} required />
      <div className="form-actions">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
        <button type="button" className="upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? "···" : "🖼"}
        </button>
        <button type="submit" className="submit-btn" disabled={sending || uploading}>
          {sending ? "···" : replyTo ? t(lang, "form.reply") : t(lang, "form.submit")}
        </button>
      </div>
    </form>
  );
}