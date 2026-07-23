"use client";

import { useEffect, useMemo, useState } from "react";
import StudentShell from "@/components/StudentShell";
import AspirationChart from "@/components/AspirationChart";
import { Input, Label, EmptyState } from "@/components/ui/Input";
import { Ft, FormatDateJa } from "@/components/FuriganaText";
import { academicApi, type Aspiration } from "@/lib/api";
import { dedupeLatestPerDate, groupAspirationsByDate } from "@/lib/aspirations";
import { useAuth } from "@/lib/useAuth";
import { displayValue } from "@/lib/utils";

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

  const displayItems = useMemo(() => dedupeLatestPerDate(items), [items]);
  const groupedItems = useMemo(() => groupAspirationsByDate(displayItems), [displayItems]);

  if (loading || !user) {
    return (
      <div className="p-8 font-bold text-black">
        <Ft>読み込み中...</Ft>
      </div>
    );
  }

  return (
    <StudentShell title="志望校" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3"><Ft>志望校を登録</Ft></h2>
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
                  <Label>{`${label}${i === 0 ? "（必須）" : "（任意）"}`}</Label>
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
                <Ft>登録する</Ft>
              </button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3"><Ft>志望校の推移</Ft></h2>
          {displayItems.length === 0 ? (
            <EmptyState />
          ) : (
            <AspirationChart items={displayItems} />
          )}
        </section>

        <section className="card">
          <h2 className="section-title mb-3"><Ft>登録済みの志望校</Ft></h2>
          {displayItems.length === 0 && <EmptyState />}
          {groupedItems.map((group) => (
            <div key={group.date} className="mb-4 last:mb-0">
              <p className="mb-2 text-xs font-bold tracking-wide text-[var(--navy)]">
                <FormatDateJa iso={group.date} />
              </p>
              {group.entries.map((a) => (
                <div key={a.aspiration_id} className="mb-2 rounded-xl bg-[var(--surface)] p-3 last:mb-0">
                  <p className="font-bold text-black">
                    第{displayValue(a.priority_rank)}<Ft>志望</Ft>: {displayValue(a.target_school)}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
    </StudentShell>
  );
}
