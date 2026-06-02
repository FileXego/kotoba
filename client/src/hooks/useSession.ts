import { useState, useEffect } from "react";
import { fetchMe, type User } from "../api";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchMe().then((r) => setUser(r.user)).catch(() => {});
  }, []);

  return { user, setUser };
}
