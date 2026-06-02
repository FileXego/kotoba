import { useState, useEffect } from "react";
import { fetchInteractions } from "../api";
import type { User } from "../api";

export function useInteractions(user: User | null) {
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());

  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  return { likedIds, bookmarkedIds, setLikedIds, setBookmarkedIds };
}
