"use client";

import { useEffect, useState } from "react";
import { adminApi, type StudentFullProfile, type User } from "@/lib/api";

export function useAdminProfiles() {
  const [students, setStudents] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<StudentFullProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await adminApi.students();
        if (cancelled) return;
        setStudents(list);
        const full = await Promise.all(list.map((s) => adminApi.studentFull(s.student_id)));
        if (cancelled) return;
        setProfiles(full);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { students, profiles, loading, error };
}
