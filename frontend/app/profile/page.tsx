"use client";

import { useEffect, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label } from "@/components/ui/Input";
import { profileApi } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { displayValue } from "@/lib/utils";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState({ phone: "", email: "", birth_date: "", school_name: "" });
  const [profileName, setProfileName] = useState("");
  const [profileUserId, setProfileUserId] = useState("");
  const [saved, setSaved] = useState("");
  const isReadOnly = user?.is_read_only ?? false;

  useEffect(() => {
    if (!user) return;
    profileApi.view().then((p) => {
      setProfileName(p.name);
      setProfileUserId(p.user_id);
      setForm({
        phone: p.phone ?? "",
        email: p.email ?? "",
        birth_date: p.birth_date ?? "",
        school_name: p.school_name ?? "",
      });
    }).catch(console.error);
  }, [user]);

  if (loading || !user) return <div className="p-8 font-bold text-black">読み込み中...</div>;

  return (
    <StudentShell title="プロフィール" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="card">
          <h2 className="section-title mb-3">基本情報</h2>
          <p className="mb-2 font-bold text-black">氏名: {displayValue(profileName || user.name)}</p>
          <p className="mb-4 font-bold text-black">ユーザーID: {displayValue(profileUserId || user.user_id)}</p>

          {!isReadOnly ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await profileApi.update(form);
                setSaved("保存しました");
              }}
            >
              <Label>電話番号（任意）</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
              <Label>メールアドレス（任意）</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Label>生年月日（任意）</Label>
              <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              <Label>学校名（任意）</Label>
              <Input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} />
              <button type="submit" className="btn-primary w-full">保存する</button>
              {saved && <p className="font-bold text-black">{saved}</p>}
            </form>
          ) : (
            <div className="space-y-2 text-black">
              <p>電話番号: {displayValue(form.phone)}</p>
              <p>メール: {displayValue(form.email)}</p>
              <p>生年月日: {displayValue(form.birth_date)}</p>
              <p>学校名: {displayValue(form.school_name)}</p>
            </div>
          )}
        </section>
      </div>
    </StudentShell>
  );
}
