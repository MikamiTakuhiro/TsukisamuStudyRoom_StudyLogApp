"use client";

import { useEffect, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label, EmptyState } from "@/components/ui/Input";
import { academicApi, type Aspiration } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { displayValue, formatDateJa } from "@/lib/utils";

const LABELS = ["第一志望校", "第二志望校", "第三志望校", "第四志望校", "第五志望校"];

export default function AspirationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Aspiration[]>([]);
  const [schools, setSchools] = useState(["", "", "", "", ""]);
  const isReadOnly = user?.is_read_only ?? false;

  async function reload() {
    setItems(await academicApi.aspirations());
  }

  useEffect(() => {
    if (user) reload().catch(console.error);
  }, [user]);

  if (loading || !user) return <div className="p-8 font-bold text-black">読み込み中...</div>;

  return (
    <StudentShell title="志望校" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3">志望校を登録</h2>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const list = schools.map((s) => s.trim()).filter(Boolean);
                if (!list.length) {
                  alert("第一志望校を入力してください");
                  return;
                }
                await academicApi.createAspirationsBulk(list);
                setSchools(["", "", "", "", ""]);
                reload();
              }}
            >
              {LABELS.map((label, i) => (
                <div key={label}>
                  <Label>{label}{i === 0 ? "（必須）" : "（任意）"}</Label>
                  <Input
                    value={schools[i]}
                    onChange={(e) => {
                      const next = [...schools];
                      next[i] = e.target.value;
                      setSchools(next);
                    }}
                    placeholder="例: ○○高校"
                    required={i === 0}
                  />
                </div>
              ))}
              <button type="submit" className="btn-primary w-full touch-manipulation">
                登録する
              </button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3">登録済みの志望校</h2>
          {items.length === 0 && <EmptyState />}
          {items.map((a) => (
            <div key={a.aspiration_id} className="mb-2 rounded-xl bg-[var(--surface)] p-3">
              <p className="font-bold text-black">
                第{displayValue(a.priority_rank)}志望: {displayValue(a.target_school)}
              </p>
              <p className="text-sm text-black">記録日: {formatDateJa(a.date_recorded)}</p>
            </div>
          ))}
        </section>
      </div>
    </StudentShell>
  );
}
