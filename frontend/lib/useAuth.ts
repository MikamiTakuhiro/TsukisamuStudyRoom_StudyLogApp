"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, type User } from "@/lib/api";
import { getCachedUser, hasToken } from "@/lib/auth";

export function useAuth(requireAuth = true) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!hasToken()) {
        setLoading(false);
        if (requireAuth) router.replace("/login");
        return;
      }
      try {
        const me = await authApi.me();
        setUser(me);
      } catch {
        if (requireAuth) router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    const cached = getCachedUser();
    if (cached) setUser(cached);
    load();
  }, [requireAuth, router]);

  return { user, loading, setUser };
}
