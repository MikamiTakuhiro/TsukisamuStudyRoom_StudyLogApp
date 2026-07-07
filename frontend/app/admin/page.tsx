"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { Input, Select } from "@/components/ui/Input";
import { adminApi, attendanceApi, type NotificationItem, type User, type ActiveSeatStatus } from "@/lib/api";
import { GRADE_OPTIONS, gradeLabel } from "@/lib/grades";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { buildAccountInfoText, downloadTextFile } from "@/lib/utils";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [seats, setSeats] = useState<{ seat_id: number; seat_name: string; qr_code_data: string }[]>([]);
  const [live, setLive] = useState<ActiveSeatStatus[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [form, setForm] = useState({ last_name: "", first_name: "", grade: 7, gender: "未回答" });
  const [seatName, setSeatName] = useState("");
  const [editingSeatId, setEditingSeatId] = useState<number | null>(null);
  const [editingSeatName, setEditingSeatName] = useState("");
  const [created, setCreated] = useState<{ user_id: string; parent_user_id: string; initial_password: string; name: string } | null>(null);
  const [seedResult, setSeedResult] = useState<{ user_id: string; initial_password: string } | null>(null);

  useEffect(() => {
    if (!loading && user && user.role !== "admin") router.replace("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "admin") refresh();
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
      name: res.student.name,
      user_id: res.student.user_id,
      parent_user_id: res.parent_user_id,
      initial_password: res.initial_password,
    });
    setForm({ last_name: "", first_name: "", grade: 7, gender: "未回答" });
    refresh();
  }

  async function downloadAccount(student: User) {
    const data = await adminApi.exportAccount(student.student_id);
    const text = buildAccountInfoText({
      name: data.name,
      user_id: data.user_id,
      parent_user_id: data.parent_user_id ?? undefined,
      password: data.new_password,
    });
    downloadTextFile(`account-${data.user_id}.txt`, text);
  }

  async function createSeat(e: React.FormEvent) {
    e.preventDefault();
    await adminApi.createSeat(seatName);
    setSeatName("");
    refresh();
  }

  function qrImageUrl(qrData: string, size = 300) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrData)}`;
  }

  async function downloadQrImage(seatName: string, qrData: string) {
    const url = qrImageUrl(qrData, 400);
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `qr-${seatName.replace(/[^\w\u3040-\u30ff\u4e00-\u9faf-]/g, "_")}.png`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function saveSeatName(seatId: number) {
    if (!editingSeatName.trim()) return;
    await adminApi.updateSeat(seatId, { seat_name: editingSeatName.trim() });
    setEditingSeatId(null);
    setEditingSeatName("");
    refresh();
  }

  async function removeSeat(seatId: number, name: string) {
    if (!window.confirm(`座席「${name}」を削除しますか？`)) return;
    await adminApi.deleteSeat(seatId);
    refresh();
  }

  if (loading || !user) {
    return <div className="flex min-h-full items-center justify-center font-bold text-black">読み込み中...</div>;
  }
  if (user.role !== "admin") return null;

  return (
    <div className="min-h-full w-full max-w-full bg-[var(--surface)] pb-12">
      <AppHeader title="管理者画面" role="admin" />
      <div className="app-shell w-full space-y-6 px-4 py-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className="btn-secondary text-sm">
            ダッシュボードへ
          </Link>
          <button type="button" onClick={() => adminApi.seedDemo().then(setSeedResult)} className="btn-accent text-sm">
            デモ管理者作成
          </button>
          <button type="button" onClick={() => adminApi.runForgottenCheckout().then(refresh)} className="btn-primary text-sm">
            0:00退室処理
          </button>
          <button type="button" onClick={() => adminApi.runGapDetection().then(refresh)} className="btn-primary text-sm">
            乖離通知検出
          </button>
        </div>

        {seedResult && (
          <div className="card text-sm font-bold text-black">
            管理者ID: {seedResult.user_id} / PW: {seedResult.initial_password}
          </div>
        )}

        <section className="card">
          <h2 className="section-title mb-4">リアルタイム出席状況</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {live.map((s) => (
              <div
                key={s.seat_name}
                className={`rounded-xl border-2 p-3 ${s.student_name ? "border-[var(--navy)] bg-[var(--moon-yellow)]/40" : "border-[var(--border)]"}`}
              >
                <p className="font-bold text-black">{s.seat_name}</p>
                <p className="text-sm font-medium text-black">
                  {s.student_name ? `${s.student_name} (${s.user_id})` : "空席"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="section-title mb-4">生徒新規登録</h2>
          <form onSubmit={createStudent} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-black">姓</label>
              <Input
                placeholder="例: 山田"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-black">名</label>
              <Input
                placeholder="例: 太郎"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-black">学年</label>
              <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-black">性別</label>
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option>未回答</option>
                <option>男性</option>
                <option>女性</option>
                <option>その他</option>
              </Select>
            </div>
            <button type="submit" className="btn-primary sm:col-span-2">
              登録
            </button>
          </form>
          {created && (
            <div className="mt-4 rounded-xl bg-[var(--moon-yellow)]/50 p-4 text-sm font-bold text-black">
              生徒ID: {created.user_id} / 保護者ID: {created.parent_user_id} / PW: {created.initial_password}
              <button
                type="button"
                className="btn-secondary mt-2 w-full text-sm"
                onClick={() =>
                  downloadTextFile(
                    `account-${created.user_id}.txt`,
                    buildAccountInfoText({
                      name: created.name,
                      user_id: created.user_id,
                      parent_user_id: created.parent_user_id,
                      password: created.initial_password,
                    }),
                  )
                }
              >
                アカウント情報をダウンロード
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="section-title mb-4">生徒一覧 ({students.length})</h2>
          <ul className="divide-y-2 divide-[var(--border)]">
            {students.map((s) => (
              <li key={s.student_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/admin/students/${s.student_id}`} className="font-bold text-[var(--navy)] underline">
                    {s.name}
                  </Link>
                  <p className="text-sm font-medium text-black">
                    {s.user_id} / {gradeLabel(s.grade)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/students/${s.student_id}`} className="btn-secondary text-sm">
                    詳細・編集
                  </Link>
                  <button type="button" onClick={() => downloadAccount(s)} className="btn-accent text-sm">
                    ID/PWダウンロード
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title mb-4">座席・QR管理</h2>
          <form onSubmit={createSeat} className="mb-4 flex gap-2">
            <Input placeholder="座席名 (例: A-1)" value={seatName} onChange={(e) => setSeatName(e.target.value)} className="flex-1" required />
            <button type="submit" className="btn-primary">
              追加
            </button>
          </form>
          <div className="grid gap-4 sm:grid-cols-2">
            {seats.map((seat) => (
              <div key={seat.seat_id} className="rounded-xl border-2 border-[var(--border)] p-4">
                {editingSeatId === seat.seat_id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editingSeatName}
                      onChange={(e) => setEditingSeatName(e.target.value)}
                      className="flex-1"
                    />
                    <button type="button" onClick={() => saveSeatName(seat.seat_id)} className="btn-primary px-3 text-sm">
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSeatId(null);
                        setEditingSeatName("");
                      }}
                      className="btn-secondary px-3 text-sm"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-black">{seat.seat_name}</p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSeatId(seat.seat_id);
                          setEditingSeatName(seat.seat_name);
                        }}
                        className="btn-secondary px-2 py-1 text-xs"
                      >
                        名前変更
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSeat(seat.seat_id, seat.seat_name)}
                        className="rounded-full border-2 border-red-600 bg-red-50 px-2 py-1 text-xs font-bold text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={`QR ${seat.seat_name}`} src={qrImageUrl(seat.qr_code_data, 150)} width={150} height={150} />
                </div>
                <button
                  type="button"
                  onClick={() => downloadQrImage(seat.seat_name, seat.qr_code_data)}
                  className="btn-accent mt-3 w-full text-sm"
                >
                  QR画像をダウンロード
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="section-title mb-4">通知プレビュー</h2>
          {notifications.length === 0 && <p className="font-medium text-black">情報なし</p>}
          {notifications.map((n) => (
            <div key={n.notification_id} className="mb-2 rounded-xl bg-[var(--surface)] p-3 text-sm font-medium text-black">
              {n.content}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
