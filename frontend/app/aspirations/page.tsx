"use client";

import { useEffect, useMemo, useState } from "react";
import StudentShell from "@/components/StudentShell";
import AspirationChart from "@/components/AspirationChart";
import { EmptyState, Field, Input, PageLoading, SkeletonList, SubmitButton } from "@/components/ui/Input";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { Ft, FormatDateJa } from "@/components/FuriganaText";
import { academicApi, type Aspiration } from "@/lib/api";
import { dedupeLatestPerDate, groupAspirationsByDate } from "@/lib/aspirations";
import { useAuth } from "@/lib/useAuth";
import { displayValue } from "@/lib/utils";

const LABELS = ["第一志望校", "第二志望校", "第三志望校", "第四志望校", "第五志望校"];
const EMPTY_SCHOOLS = ["", "", "", "", ""];

/** 最新の登録日の志望校を順位順に並べた 5 枠 */
function latestSchools(items: Aspiration[]): string[] {
  if (items.length === 0) return [...EMPTY_SCHOOLS];
  const latestDate = items.reduce((max, a) => (a.date_recorded > max ? a.date_recorded : max), items[0].date_recorded);
  const latest = items
    .filter((a) => a.date_recorded === latestDate)
    .sort((a, b) => a.priority_rank - b.priority_rank)
    .map((a) => a.target_school);
  return [...latest, ...EMPTY_SCHOOLS].slice(0, LABELS.length);
}

export default function AspirationsPage() {
  const { toast } = useFeedback();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Aspiration[] | null>(null);
  const [schools, setSchools] = useState([...EMPTY_SCHOOLS]);
  const [firstError, setFirstError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isReadOnly = user?.is_read_only ?? false;

  const displayItems = useMemo(() => dedupeLatestPerDate(items ?? []), [items]);
  const groupedItems = useMemo(() => groupAspirationsByDate(displayItems), [displayItems]);
  const currentSchools = useMemo(() => latestSchools(displayItems), [displayItems]);
  const hasCurrent = currentSchools.some(Boolean);
  const unchanged = schools.map((s) => s.trim()).join("\n") === currentSchools.join("\n");

  async function reload() {
    const list = await academicApi.aspirations();
    setItems(list);
    // 現在の志望校を入力欄に反映し、変えたい行だけ直せるようにする
    setSchools(latestSchools(dedupeLatestPerDate(list)));
  }

  useEffect(() => {
    if (!user) return;
    reload().catch((e) => {
      setItems([]);
      toast(errorMessage(e, "志望校の読み込みに失敗しました"), "error");
    });
  }, [user, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = schools.map((s) => s.trim());
    if (!trimmed[0]) {
      setFirstError("第一志望校を入力してください");
      document.getElementById("aspiration-0")?.focus();
      return;
    }
    setFirstError(null);
    setSubmitting(true);
    try {
      await academicApi.createAspirationsBulk(trimmed.filter(Boolean));
      toast(hasCurrent ? "志望校を更新しました" : "志望校を登録しました");
      await reload();
    } catch (err) {
      toast(errorMessage(err, "志望校の登録に失敗しました"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <PageLoading />;
  }

  return (
    <StudentShell title="志望校" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-1">
              {hasCurrent ? <Ft>志望校を更新</Ft> : <Ft>志望校を登録</Ft>}
            </h2>
            {hasCurrent && (
              <p className="mb-3 text-xs font-medium text-[var(--placeholder)]">
                <Ft>今の志望校が入っています。変えたいところだけ書き直して「更新する」を押してください。</Ft>
              </p>
            )}
            {items === null ? (
              <SkeletonList rows={3} />
            ) : (
              <form className="space-y-3" onSubmit={handleSubmit} noValidate>
                {LABELS.map((label, i) => (
                  <Field key={label} label={label} required={i === 0} error={i === 0 ? firstError : null}>
                    <Input
                      id={`aspiration-${i}`}
                      value={schools[i]}
                      onChange={(e) => {
                        const next = [...schools];
                        next[i] = e.target.value;
                        setSchools(next);
                        if (i === 0 && firstError) setFirstError(null);
                      }}
                      placeholder="例: ○○高校"
                      maxLength={100}
                      enterKeyHint={i === LABELS.length - 1 ? "done" : "next"}
                    />
                  </Field>
                ))}
                <SubmitButton busy={submitting} busyLabel="保存中..." disabled={hasCurrent && unchanged}>
                  {hasCurrent ? "更新する" : "登録する"}
                </SubmitButton>
                {hasCurrent && unchanged && (
                  <p className="text-center text-xs font-medium text-[var(--placeholder)]">
                    <Ft>変更がありません</Ft>
                  </p>
                )}
              </form>
            )}
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3"><Ft>志望校の推移</Ft></h2>
          {items === null ? (
            <div className="skeleton h-48 rounded-xl" role="status" aria-label="読み込み中" />
          ) : displayItems.length === 0 ? (
            <EmptyState />
          ) : (
            <AspirationChart items={displayItems} />
          )}
        </section>

        <section className="card">
          <h2 className="section-title mb-3"><Ft>登録済みの志望校</Ft></h2>
          {items === null ? (
            <SkeletonList rows={2} />
          ) : displayItems.length === 0 ? (
            <EmptyState />
          ) : (
            groupedItems.map((group) => (
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
            ))
          )}
        </section>
      </div>
    </StudentShell>
  );
}
