import { useState, useEffect } from "react";
import { fetchInteractions } from "../api";
import type { User } from "../api";

export function useInteractions(user: User | null) {
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      setLikedIds(new Set());
      setBookmarkedIds(new Set());
      return;
    }
    fetchInteractions().then((r) => {
      setLikedIds(new Set(r.liked));
      setBookmarkedIds(new Set(r.bookmarked));
    }).catch(() => {});
  }, [user]);

  return { likedIds, bookmarkedIds, setLikedIds, setBookmarkedIds };
}
