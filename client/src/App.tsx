import { useState } from "react";
import { Header } from "./components/Header";
import { SubmitForm } from "./components/SubmitForm";
import { MessageList } from "./components/MessageList";
import { AdminPanel } from "./components/AdminPanel";
import { BookmarksPage } from "./components/BookmarksPage";
import { useRouter } from "./hooks/useRouter";
import { useTheme } from "./hooks/useTheme";
import { useSession } from "./hooks/useSession";
import { useInteractions } from "./hooks/useInteractions";
import { useMessageFeed } from "./hooks/useMessageFeed";
import { t, type Lang } from "./i18n";

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem("lang");
    return stored === "zh" ? "zh" : "ja";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const { route, navigate } = useRouter();
  const { user, setUser } = useSession();
  const { theme, toggleTheme, inkAnim } = useTheme(user);
  const { likedIds, bookmarkedIds, setLikedIds, setBookmarkedIds } = useInteractions(user);
  const {
    messages, total, loading, loadingMore, error, replyTrees, loadingReplies,
    handleLoadMore, handleLoadReplies, handleSubmit, handleUpdate,
    handleToggleLike, handleToggleBookmark,
  } = useMessageFeed(lang, searchQuery, likedIds, setLikedIds, bookmarkedIds, setBookmarkedIds);

  const toggleLang = () => setLang((l) => {
    const next = l === "ja" ? "zh" : "ja";
    localStorage.setItem("lang", next);
    return next;
  });

  return (
    <div className="app">
      <Header theme={theme} lang={lang} onToggleTheme={(x, y) => toggleTheme(x, y)} onToggleLang={toggleLang}
        user={user} onUserChange={setUser} onAdminClick={() => navigate("/admin")}
        onBookmarksClick={() => navigate("/bookmarks")} onHomeClick={() => navigate("/")} />
      {route === "/admin" && <AdminPanel lang={lang} onClose={() => navigate("/")} />}
      {route === "/bookmarks" && <BookmarksPage lang={lang} currentUser={user} />}
      {route === "/" && (
        <>
          <input className="search-input" type="text" placeholder={t(lang, "search.placeholder")}
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <SubmitForm lang={lang}
            onImageUpload={async (f) => { const r = await (await import("./api")).uploadImage(f); return r.url; }}
            onSubmit={handleSubmit} loggedIn={!!user} />
          <MessageList lang={lang}
            messages={messages} total={total} loading={loading} loadingMore={loadingMore}
            error={error} replyTrees={replyTrees} loadingReplies={loadingReplies}
            currentUser={user} likedIds={likedIds} bookmarkedIds={bookmarkedIds}
            onUpdate={handleUpdate} onLoadReplies={handleLoadReplies}
            onLoadMore={handleLoadMore} onSubmitReply={handleSubmit}
            onToggleLike={handleToggleLike} onToggleBookmark={handleToggleBookmark}
          />
        </>
      )}
      {inkAnim && (
        <div className="ink-overlay" data-target={inkAnim.theme} style={{
          '--ink-x': `${inkAnim.x}px`, '--ink-y': `${inkAnim.y}px`,
        } as React.CSSProperties} />
      )}
    </div>
  );
}
