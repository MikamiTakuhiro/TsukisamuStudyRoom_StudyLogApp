"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { Input, Label, Select } from "@/components/ui/Input";
import ReservationCalendar from "@/components/admin/ReservationCalendar";
import { adminApi, reservationsApi, type ReservationItem, type User } from "@/lib/api";
import {
  buildDaySlots,
  buildReservationWeeks,
  groupReservationsByDate,
  peakConcurrent,
  todayKey,
} from "@/lib/reservationCalendar";
import { useRequireAdmin } from "@/lib/useRequireAdmin";
import { formatDateJa, formatTimeJa } from "@/lib/utils";

export default function AdminReservationsPage() {
  const { ready } = useRequireAdmin();
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [totalSeats, setTotalSeats] = useState(0);
  const [students, setStudents] = useState<User[]>([]);
  const [adding, setAdding] = useState(false);
  /** 狭い画面では日付クリックで予約状況を下からのシートとして表示 */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addForm, setAddForm] = useState({ student_id: "", start_time: "18:00", end_time: "21:00" });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ reservation_date: "", start_time: "", end_time: "" });

  const reload = useCallback(async () => {
    const [list, seats, studentList] = await Promise.all([
      reservationsApi.all(),
      adminApi.seats(),
      adminApi.students(),
    ]);
    setStudents(studentList);
    setReservations(list);
    setTotalSeats(seats.length);
  }, []);

  const weeks = useMemo(() => buildReservationWeeks(reservations, totalSeats), [reservations, totalSeats]);
  const byDate = useMemo(() => groupReservationsByDate(reservations), [reservations]);
  const dayReservations = useMemo(() => byDate.get(selectedDate) ?? [], [byDate, selectedDate]);
  const daySlots = useMemo(
    () => buildDaySlots(selectedDate, dayReservations, totalSeats),
    [selectedDate, dayReservations, totalSeats],
  );
  const dayPeak = useMemo(
    () =>
      peakConcurrent(
        dayReservations.map((r) => ({ start: new Date(r.start_time).getTime(), end: new Date(r.end_time).getTime() })),
      ),
    [dayReservations],
  );

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
      <div className="app-shell w-full px-4 py-6 pb-12">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ReservationCalendar
          weeks={weeks}
          totalSeats={totalSeats}
          selectedDate={selectedDate}
          onSelect={(d) => {
            setSelectedDate(d);
            setEditingId(null);
            setSheetOpen(true);
          }}
        />

        {sheetOpen && (
          <button
            type="button"
            aria-label="閉じる"
            className="fixed inset-0 z-[55] bg-black/40 lg:hidden"
            onClick={() => setSheetOpen(false)}
          />
        )}
        <section
          className={`card lg:sticky lg:top-[calc(var(--app-header-height)+1rem)] ${
            sheetOpen
              ? "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[60] max-lg:max-h-[85dvh] max-lg:overflow-y-auto max-lg:rounded-b-none max-lg:border-b-0"
              : "max-lg:hidden"
          }`}
        >
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">{formatDateJa(selectedDate)}の予約状況</h2>
            <button type="button" className="btn-secondary btn-sm lg:hidden" onClick={() => setSheetOpen(false)}>
              閉じる
            </button>
            <button
              type="button"
              className="btn-accent btn-sm"
              disabled={selectedDate < todayKey()}
              onClick={() => setAdding((v) => !v)}
            >
              {adding ? "閉じる" : "＋ 予約を追加"}
            </button>
          </div>
          {adding && (
            <form
              className="mb-4 space-y-3 rounded-xl border-2 border-[var(--moon-yellow)] bg-[var(--surface)] p-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!addForm.student_id) return;
                setAddSubmitting(true);
                try {
                  await reservationsApi.create({
                    student_id: Number(addForm.student_id),
                    reservation_date: selectedDate,
                    start_time: addForm.start_time,
                    end_time: addForm.end_time,
                  });
                  setAdding(false);
                  await reload();
                } catch (err) {
                  alert(err instanceof Error ? err.message : "予約に失敗しました");
                } finally {
                  setAddSubmitting(false);
                }
              }}
            >
              <div>
                <Label>生徒（{formatDateJa(selectedDate)}）</Label>
                <Select
                  value={addForm.student_id}
                  onChange={(e) => setAddForm({ ...addForm, student_id: e.target.value })}
                  required
                >
                  <option value="">選択してください</option>
                  {students.map((st) => (
                    <option key={st.student_id} value={st.student_id}>
                      {st.name}（{st.user_id}）
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>来室</Label>
                  <Input
                    type="time"
                    value={addForm.start_time}
                    onChange={(e) => setAddForm({ ...addForm, start_time: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>退室</Label>
                  <Input
                    type="time"
                    value={addForm.end_time}
                    onChange={(e) => setAddForm({ ...addForm, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={addSubmitting || !addForm.student_id} className="btn-primary btn-sm w-full">
                {addSubmitting ? "追加中..." : "この内容で予約する"}
              </button>
            </form>
          )}
          <p className="mb-4 text-sm font-bold text-black">
            予約 {dayReservations.length}人 ・ 最大同時 {dayPeak}人 ・ 残り{" "}
            <span className={totalSeats - dayPeak <= 0 ? "text-red-700" : "text-green-700"}>
              {Math.max(0, totalSeats - dayPeak)}
            </span>
            席（全{totalSeats}席）
          </p>

          <div className="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {daySlots.map((slot) => (
              <div
                key={slot.label}
                className={`rounded-lg border-2 px-2 py-1.5 text-center ${
                  slot.isFull
                    ? "border-gray-700 bg-gray-600 text-white"
                    : slot.remaining <= Math.max(1, Math.ceil(totalSeats * 0.25))
                      ? "border-red-300 bg-red-50"
                      : "border-green-300 bg-green-50"
                }`}
              >
                <p className="text-[11px] font-bold">{slot.label}</p>
                <p className="text-xs font-bold">
                  {slot.isFull ? "満席" : `${slot.reserved}人 / 残り${slot.remaining}`}
                </p>
              </div>
            ))}
          </div>

          {dayReservations.length === 0 ? (
            <p className="font-medium text-black">この日の予約はありません。</p>
          ) : (
            <ul className="space-y-3">
              {dayReservations.map((r) => (
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
      </div>
    </AdminShell>
  );
}
