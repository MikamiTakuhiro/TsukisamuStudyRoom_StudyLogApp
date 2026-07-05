"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { adminApi, attendanceApi, type NotificationItem, type User, type ActiveSeatStatus } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [seats, setSeats] = useState<{ seat_id: number; seat_name: string; qr_code_data: string }[]>([]);
  const [live, setLive] = useState<ActiveSeatStatus[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [form, setForm] = useState({ name: "", grade: 1, gender: "未回答" });
  const [seatName, setSeatName] = useState("");
  const [created, setCreated] = useState<{ user_id: string; parent_user_id: string; initial_password: string } | null>(null);
  const [seedResult, setSeedResult] = useState<{ user_id: string; initial_password: string } | null>(null);

  useEffect(() => {
    if (!loading && user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    refresh();
  }, [user]);

  async function refresh() {
    const [s, st, lv, n] = await Promise.all([
      adminApi.students(),
      adminApi.seats(),
      attendanceApi.live(),
      adminApi.notifications(),
    ]);
    setStudents(s);
    setSeats(st);
    setLive(lv);
    setNotifications(n);
  }

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    const res = await adminApi.createStudent(form);
    setCreated({
      user_id: res.student.user_id,
      parent_user_id: res.parent_user_id,
      initial_password: res.initial_password,
    });
    setForm({ name: "", grade: 1, gender: "未回答" });
    refresh();
  }

  async function createSeat(e: React.FormEvent) {
    e.preventDefault();
    await adminApi.createSeat(seatName);
    setSeatName("");
    refresh();
  }

  async function seedDemo() {
    const res = await adminApi.seedDemo();
    setSeedResult({ user_id: res.user_id, initial_password: res.initial_password });
  }

  if (loading || !user) {
    return <div className="flex min-h-full items-center justify-center">読み込み中...</div>;
  }

  if (user.role !== "admin") return null;

  return (
    <div className="min-h-full bg-slate-100 pb-12">
      <AppHeader title="管理者画面" />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            ダッシュボードへ
          </Link>
          <button onClick={seedDemo} className="rounded-lg bg-amber-500 px-3 py-2 text-sm text-white">
            初回: デモ管理者作成
          </button>
          <button
            onClick={() => adminApi.runForgottenCheckout().then(refresh)}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white"
          >
            0:00退室処理を実行
          </button>
          <button
            onClick={() => adminApi.runGapDetection().then(refresh)}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm text-white"
          >
            乖離通知を検出
          </button>
        </div>

        {seedResult && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            管理者ID: <strong>{seedResult.user_id}</strong> / 初期PW: <strong>{seedResult.initial_password}</strong>
          </div>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">リアルタイム出席状況</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {live.map((s) => (
              <div
                key={s.seat_name}
                className={`rounded-xl border p-3 ${s.student_name ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}
              >
                <p className="font-semibold">{s.seat_name}</p>
                <p className="text-sm text-slate-600">
                  {s.student_name ? `${s.student_name} (${s.user_id})` : "空席"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">生徒新規登録</h2>
          <form onSubmit={createStudent} className="grid gap-3 sm:grid-cols-4">
            <input
              placeholder="氏名"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border px-3 py-2"
              required
            />
            <input
              type="number"
              min={1}
              max={12}
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}
              className="rounded-lg border px-3 py-2"
            />
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="rounded-lg border px-3 py-2"
            >
              <option>未回答</option>
              <option>男性</option>
              <option>女性</option>
              <option>その他</option>
            </select>
            <button type="submit" className="rounded-lg bg-sky-600 py-2 font-medium text-white">
              登録
            </button>
          </form>
          {created && (
            <div className="mt-4 rounded-lg bg-sky-50 p-4 text-sm">
              生徒ID: <strong>{created.user_id}</strong> / 保護者ID: <strong>{created.parent_user_id}</strong> /
              初期PW: <strong>{created.initial_password}</strong>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">生徒一覧 ({students.length})</h2>
          <ul className="divide-y">
            {students.map((s) => (
              <li key={s.student_id} className="flex justify-between py-2 text-sm">
                <span>{s.name}</span>
                <span className="text-slate-500">{s.user_id} / {s.grade}年</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">座席・QR管理</h2>
          <form onSubmit={createSeat} className="mb-4 flex gap-2">
            <input
              placeholder="座席名 (例: A-1)"
              value={seatName}
              onChange={(e) => setSeatName(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2"
              required
            />
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-white">追加</button>
          </form>
          <div className="grid gap-4 sm:grid-cols-2">
            {seats.map((seat) => (
              <div key={seat.seat_id} className="rounded-xl border p-4">
                <p className="font-bold">{seat.seat_name}</p>
                <p className="mt-1 break-all text-xs text-slate-500">{seat.qr_code_data}</p>
                <div className="mt-3 flex justify-center rounded-lg bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`QR ${seat.seat_name}`}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(seat.qr_code_data)}`}
                    width={150}
                    height={150}
                  />
                </div>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(seat.qr_code_data)}`}
                  download={`qr-${seat.seat_name}.png`}
                  className="mt-2 block text-center text-sm text-sky-600"
                >
                  QR画像をダウンロード
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">通知プレビュー</h2>
          {notifications.length === 0 && <p className="text-sm text-slate-500">通知なし</p>}
          {notifications.map((n, i) => (
            <div
              key={i}
              className={`mb-2 rounded-lg p-3 text-sm ${n.trigger_gap_detected ? "bg-amber-50" : "bg-slate-50"}`}
            >
              {n.content}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
