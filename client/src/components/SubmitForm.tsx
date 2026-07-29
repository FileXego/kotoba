import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { t, type Lang } from "../i18n";

interface Props {
  lang: Lang;
  onSubmit: (content: string, parentId?: number) => Promise<void>;
  onImageUpload: (file: File) => Promise<string>;
  loggedIn: boolean;
}

export function SubmitForm({ lang, onSubmit, onImageUpload, loggedIn }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setError("");
    setSending(true);
    try { await onSubmit(content.trim()); setContent(""); }
    catch { setError(t(lang, "error.SUBMIT_FAIL")); }
    finally { setSending(false); }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 2 * 1024 * 1024) {
      setError(t(lang, "form.imageToolarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      setContent((prev) => prev + (prev ? "\n" : "") + `[image:${url}]`);
    } catch { setError(t(lang, "form.imageFail")); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  if (!loggedIn) {
    return <div className="submit-form auth-prompt"><p>{t(lang, "auth.needLogin")}</p></div>;
  }

  return (
    <form className="submit-form" onSubmit={handleSubmit}>
      <div className="composer-heading">
        <span>{t(lang, "editorial.compose")}</span>
        <span className="composer-seal" aria-hidden="true">{t(lang, "editorial.seal")}</span>
      </div>
      <label htmlFor="content">{t(lang, "form.thought")}</label>
      <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)}
        maxLength={500} placeholder={t(lang, "form.placeholder")} required />
      <div className={`composer-char-count${content.length > 400 ? " near-limit" : ""}`}>
        {content.length}/500
      </div>
      {error && <p className="auth-error form-error">{error}</p>}
      <div className="form-actions">
        <input ref={fileInputRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} />
        <button type="button" className="upload-btn" aria-label={t(lang, "form.uploadImage")}
          title={t(lang, "form.uploadImage")} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? "···" : "🖼"}
        </button>
        <button type="submit" className="submit-btn" disabled={sending || uploading}>
          <span aria-hidden="true" className="submit-mark">{t(lang, "editorial.submitMark")}</span>
          <span>{sending ? "···" : t(lang, "form.submit")}</span>
        </button>
      </div>
    </form>
  );
}
