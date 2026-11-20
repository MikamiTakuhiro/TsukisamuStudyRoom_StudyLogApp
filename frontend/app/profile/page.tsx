"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StudentShell from "@/components/StudentShell";
import MenuNavIcon from "@/components/MenuNavIcon";
import { Field, Input, PageLoading, SkeletonList, SubmitButton } from "@/components/ui/Input";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { Ft } from "@/components/FuriganaText";
import { authApi, profileApi } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { useAuth } from "@/lib/useAuth";
import { displayValue } from "@/lib/utils";

type ProfileForm = { phone: string; email: string; birth_date: string; school_name: string };

export default function ProfilePage() {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const { user, loading } = useAuth();
  const [form, setForm] = useState<ProfileForm>({ phone: "", email: "", birth_date: "", school_name: "" });
  const [savedForm, setSavedForm] = useState<ProfileForm | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileUserId, setProfileUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const isReadOnly = user?.is_read_only ?? false;

  useEffect(() => {
    if (!user) return;
    profileApi
      .view()
      .then((p) => {
        setProfileName(p.name);
        setProfileUserId(p.user_id);
        const next = {
          phone: p.phone ?? "",
          email: p.email ?? "",
          birth_date: p.birth_date ?? "",
          school_name: p.school_name ?? "",
        };
        setForm(next);
        setSavedForm(next);
      })
      .catch((e) => {
        setSavedForm({ phone: "", email: "", birth_date: "", school_name: "" });
        toast(errorMessage(e, "プロフィールの読み込みに失敗しました"), "error");
      });
  }, [user, toast]);

  const dirty = savedForm !== null && JSON.stringify(form) !== JSON.stringify(savedForm);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await profileApi.update(form);
      setSavedForm(form);
      toast("プロフィールを保存しました");
    } catch (err) {
      toast(errorMessage(err, "保存に失敗しました"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const ok = await confirm({ title: "ログアウトしますか？", confirmLabel: "ログアウト" });
    if (!ok) return;
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clearSession();
    router.push("/login");
  }

  if (loading || !user) {
    return <PageLoading />;
  }

  return (
    <StudentShell title="プロフィール" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="card">
          <h2 className="section-title mb-3"><Ft>基本情報</Ft></h2>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-[var(--surface)] p-3">
            <dt className="text-sm font-bold text-[var(--navy)]"><Ft>氏名</Ft></dt>
            <dd className="font-bold text-black">{displayValue(profileName || user.name)}</dd>
            <dt className="text-sm font-bold text-[var(--navy)]"><Ft>ユーザーID</Ft></dt>
            <dd className="font-bold text-black">{displayValue(profileUserId || user.user_id)}</dd>
          </dl>

          {savedForm === null ? (
            <SkeletonList rows={3} />
          ) : !isReadOnly ? (
            <form className="space-y-3" onSubmit={handleSave}>
              <Field label="電話番号" required={false}>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="例: 090-1234-5678"
                />
              </Field>
              <Field label="メールアドレス" required={false}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="生年月日" required={false}>
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  autoComplete="bday"
                />
              </Field>
              <Field label="学校名" required={false}>
                <Input
                  value={form.school_name}
                  onChange={(e) => setForm({ ...form, school_name: e.target.value })}
                  placeholder="例: 月寒中学校"
                />
              </Field>
              <SubmitButton busy={saving} busyLabel="保存中..." disabled={!dirty}>
                保存する
              </SubmitButton>
              {!dirty && (
                <p className="text-center text-xs font-medium text-[var(--placeholder)]">
                  <Ft>変更すると保存できます</Ft>
                </p>
              )}
            </form>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-black">
              <dt className="font-bold"><Ft>電話番号</Ft></dt>
              <dd>{displayValue(form.phone)}</dd>
              <dt className="font-bold"><Ft>メール</Ft></dt>
              <dd className="break-all">{displayValue(form.email)}</dd>
              <dt className="font-bold"><Ft>生年月日</Ft></dt>
              <dd>{displayValue(form.birth_date)}</dd>
              <dt className="font-bold"><Ft>学校名</Ft></dt>
              <dd>{displayValue(form.school_name)}</dd>
            </dl>
          )}
        </section>

        <Link
          href="/attendance"
          className="card flex min-h-[3.5rem] items-center gap-3 text-black no-underline touch-manipulation"
        >
          <MenuNavIcon name="attendance" />
          <span className="flex-1">
            <span className="block font-bold"><Ft>来塾記録</Ft></span>
            <span className="text-sm font-medium text-[var(--placeholder)]"><Ft>来塾回数・滞在時間・履歴を見る</Ft></span>
          </span>
          <span className="text-xl font-bold text-[var(--navy)]" aria-hidden="true">›</span>
        </Link>

        <section className="card">
          <button type="button" onClick={handleLogout} className="btn-secondary w-full">
            <Ft>ログアウト</Ft>
          </button>
        </section>
      </div>
    </StudentShell>
  );
}
