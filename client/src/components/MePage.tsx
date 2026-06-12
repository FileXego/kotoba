import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { updateMe, uploadAvatar, signOut, type User } from "../api";
import { t, type Lang } from "../i18n";
import { Avatar } from "./Avatar";
import type { ThemeName } from "../theme/theme";

const ALL_THEMES: { name: ThemeName; labelKey: "theme.light" | "theme.dark" | "theme.sumi" | "theme.sakura" }[] = [
  { name: "light", labelKey: "theme.light" },
  { name: "dark", labelKey: "theme.dark" },
  { name: "sumi", labelKey: "theme.sumi" },
  { name: "sakura", labelKey: "theme.sakura" },
];

interface Props {
  lang: Lang;
  user: User | null;
  theme: ThemeName;
  onUserChange: (user: User | null) => void;
  onThemeChange: (theme: ThemeName) => void;
}

export function MePage({ lang, user, theme, onUserChange, onThemeChange }: Props) {
  const [signature, setSignature] = useState(user?.signature ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"ok" | "error">("ok");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSignature(user?.signature ?? "");
  }, [user?.id, user?.signature]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!user) {
    return (
      <div className="me-page">
        <div className="auth-prompt">
          <p>{t(lang, "auth.needLogin")}</p>
        </div>
      </div>
    );
  }

  const showNotice = (message: string, kind: "ok" | "error" = "ok") => {
    setNotice(message);
    setNoticeKind(kind);
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 256 * 1024) {
      showNotice(t(lang, "me.avatarTooLarge"), "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const res = await uploadAvatar(file);
      if (res.user) onUserChange(res.user);
      showNotice(t(lang, "me.avatarSaved"));
    } catch { showNotice(t(lang, "me.avatarFail"), "error"); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSignatureSave = async () => {
    setSaving(true);
    try {
      const res = await updateMe({ signature });
      onUserChange(res.user);
      showNotice(t(lang, "me.signatureSaved"));
    } catch { showNotice(t(lang, "me.saveFail"), "error"); }
    finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      onUserChange(null);
    } catch { showNotice(t(lang, "list.loadFail"), "error"); }
    finally {
      setSigningOut(false);
    }
  };

  const signatureChanged = signature !== (user.signature ?? "");

  return (
    <div className="me-page">
      <h2 className="me-title">{t(lang, "me.title")}</h2>
      <div className="me-profile-card">
        <Avatar name={user.username} src={user.avatarUrl} />
        <div className="me-profile-copy">
          <h3>{user.username}</h3>
          <p>{user.email}</p>
          {user.signature && <span>{user.signature}</span>}
        </div>
      </div>
      {notice && <p className={`me-status ${noticeKind}`} aria-live="polite">{notice}</p>}

      <section className="me-section">
        <label className="me-label">{t(lang, "me.avatar")}</label>
        <div className="me-avatar-row">
          <Avatar name={user.username} src={user.avatarUrl} />
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            className="auth-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "···" : t(lang, "me.editProfile")}
          </button>
        </div>
      </section>

      <section className="me-section">
        <label className="me-label" htmlFor="me-signature">{t(lang, "me.signature")}</label>
        <textarea
          id="me-signature"
          className="me-input"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          maxLength={100}
          rows={2}
        />
        <button type="button" className="auth-btn" onClick={handleSignatureSave} disabled={saving || !signatureChanged}>
          {saving ? "···" : t(lang, "form.save")}
        </button>
      </section>

      <section className="me-section">
        <label className="me-label">{t(lang, "me.theme")}</label>
        <div className="me-theme-swatches">
          {ALL_THEMES.map(({ name, labelKey }) => (
            <button
              key={name}
              className={`me-theme-swatch ${theme === name ? "active" : ""}`}
              onClick={() => { onThemeChange(name); showNotice(t(lang, "me.themeApplied")); }}
              data-theme={name}
              aria-label={t(lang, labelKey)}
              title={t(lang, labelKey)}
            >
              {theme === name && <span className="me-theme-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="me-section">
        <button type="button" className="me-signout-btn" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? "···" : t(lang, "me.signOut")}
        </button>
      </section>
    </div>
  );
}
