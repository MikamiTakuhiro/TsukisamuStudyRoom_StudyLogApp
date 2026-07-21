"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { Input, Label } from "@/components/ui/Input";
import { reservationsApi, type ReservationItem } from "@/lib/api";
import { useRequireAdmin } from "@/lib/useRequireAdmin";
import { formatDateJa, formatTimeJa } from "@/lib/utils";

export default function AdminReservationsPage() {
  const { ready } = useRequireAdmin();
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ reservation_date: "", start_time: "", end_time: "" });

  const reload = useCallback(async () => {
    setReservations(await reservationsApi.all());
  }, []);

  useEffect(() => {
    if (ready) reload().catch(console.error);
  }, [ready, reload]);

  function startEdit(r: ReservationItem) {
    setEditingId(r.reservation_id);
    setEditForm({
      reservation_date: r.start_time.slice(0, 10),
      start_time: formatTimeJa(r.start_time),
      end_time: formatTimeJa(r.end_time),
    });
  }

  if (!ready) {
    return (
      <AdminShell title="予約管理">
        <div className="p-8 font-bold text-black">読み込み中...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="予約管理">
      <div className="app-shell w-full space-y-4 px-4 py-6 pb-12">
        <section className="card">
          <h2 className="section-title mb-4">全生徒の予約一覧</h2>
          {reservations.length === 0 ? (
            <p className="font-medium text-black">予約がありません。</p>
          ) : (
            <ul className="space-y-3">
              {reservations.map((r) => (
                <li key={r.reservation_id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  {editingId === r.reservation_id ? (
                    <form
                      className="space-y-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          await reservationsApi.update(r.reservation_id, editForm);
                          setEditingId(null);
                          reload();
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "更新に失敗しました");
                        }
                      }}
                    >
                      <p className="font-bold text-black">{r.student_name}</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <Label>日付</Label>
                          <Input
                            type="date"
                            value={editForm.reservation_date}
                            onChange={(e) => setEditForm({ ...editForm, reservation_date: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>来室</Label>
                          <Input
                            type="time"
                            value={editForm.start_time}
                            onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>退室</Label>
                          <Input
                            type="time"
                            value={editForm.end_time}
                            onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="btn-primary text-sm">
                          保存
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-sm">
                          キャンセル
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-black">{r.student_name ?? "—"}</p>
                        <p className="text-sm font-medium text-black">
                          {formatDateJa(r.start_time)} {formatTimeJa(r.start_time)}〜{formatTimeJa(r.end_time)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(r)} className="btn-secondary text-xs">
                          編集
                        </button>
                        <button
                          type="button"
                          className="rounded-full border-2 border-red-600 bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                          onClick={async () => {
                            if (!confirm("この予約を削除しますか？")) return;
                            await reservationsApi.delete(r.reservation_id);
                            reload();
                          }}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
