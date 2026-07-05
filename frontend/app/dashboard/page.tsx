"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader, { AdminLink } from "@/components/AppHeader";
import { attendanceApi, notificationsApi, STUDY_OPTIONS, type NotificationItem, type TimelineDay } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { vibrate } from "@/lib/auth";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<TimelineDay | null>(null);
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [activeSeat, setActiveSeat] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isReadOnly = user?.is_read_only ?? false;

  useEffect(() => {
    if (!user) return;
    attendanceApi.timeline().then(setTimeline).catch(console.error);
    attendanceApi.active().then((a) => setActiveSeat(a?.seat_name ?? null)).catch(console.error);
    notificationsApi.list().then(setNotifications).catch(console.error);
  }, [user]);

  async function postStudy(subject: string, unit: string) {
    setSubmitting(true);
    try {
      await attendanceApi.createStudyRecord(subject, unit);
      vibrate([50, 30, 50]);
      setShowStudyModal(false);
      setSelectedSubject(null);
      const updated = await attendanceApi.timeline();
      setTimeline(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : "記録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <div className="flex min-h-full items-center justify-center text-slate-500">読み込み中...</div>;
  }

  return (
    <div className="relative min-h-full bg-slate-50 pb-24">
      <AppHeader title={`${user.name} さん`} />
      <div className="mx-auto max-w-lg px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <AdminLink role={user.role} />
          {activeSeat && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
              入室中: {activeSeat}
            </span>
          )}
        </div>

        {!isReadOnly && (
          <Link
            href="/scan"
            className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 py-4 text-lg font-bold text-white shadow-lg hover:bg-sky-700"
          >
            <span className="text-2xl">📷</span>
            QRコードで入退室
          </Link>
        )}

        {notifications.length > 0 && (
          <section className="mb-6 space-y-2">
            {notifications.slice(0, 3).map((n, i) => (
              <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {n.content}
              </div>
            ))}
          </section>
        )}

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">来塾履歴</h2>
        <div className="space-y-3">
          {timeline.length === 0 && (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500">まだ記録がありません</p>
          )}
          {timeline.map((day) => (
            <button
              key={day.date}
              onClick={() => setSelectedDay(day)}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-sky-300"
            >
              <p className="font-semibold text-slate-900">{formatDate(day.date)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {day.attendances.length} 回の入退室 / {day.study_records.length} 件の学習記録
              </p>
            </button>
          ))}
        </div>
      </div>

      {!isReadOnly && (
        <button
          onClick={() => setShowStudyModal(true)}
          className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 text-3xl text-white shadow-xl hover:bg-sky-600"
          aria-label="学習記録を追加"
        >
          +
        </button>
      )}

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 sm:max-w-lg sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{formatDate(selectedDay.date)}</h3>
              <button onClick={() => setSelectedDay(null)} className="text-slate-500">閉じる</button>
            </div>
            <section className="mb-4">
              <h4 className="mb-2 font-semibold text-slate-700">入退室</h4>
              {selectedDay.attendances.map((a) => (
                <div key={a.attendance_id} className="mb-2 rounded-lg bg-slate-50 p-3 text-sm">
                  <p>座席: {a.seat_name}</p>
                  <p>入室: {formatTime(a.check_in_time)}</p>
                  <p>
                    退室: {a.check_out_time ? formatTime(a.check_out_time) : "未退室"}
                    {a.is_forgotten_checkout && " (0:00自動退室)"}
                  </p>
                </div>
              ))}
            </section>
            <section>
              <h4 className="mb-2 font-semibold text-slate-700">学習記録</h4>
              {selectedDay.study_records.length === 0 && (
                <p className="text-sm text-slate-500">記録なし</p>
              )}
              {selectedDay.study_records.map((r) => (
                <div key={r.record_id} className="mb-2 rounded-lg bg-sky-50 p-3 text-sm">
                  <p className="font-medium">{r.subject} - {r.topic_unit}</p>
                  <p className="text-slate-500">{formatTime(r.recorded_at)}</p>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}

      {showStudyModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-2xl bg-white p-6 sm:max-w-lg sm:rounded-2xl">
            <h3 className="mb-4 text-lg font-bold">今から勉強する内容</h3>
            {!selectedSubject ? (
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(STUDY_OPTIONS).map((subject) => (
                  <button
                    key={subject}
                    onClick={() => setSelectedSubject(subject)}
                    className="rounded-xl border border-slate-200 py-4 font-medium hover:border-sky-400 hover:bg-sky-50"
                  >
                    {subject}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => setSelectedSubject(null)} className="text-sm text-sky-600">
                  ← 科目を選び直す
                </button>
                {STUDY_OPTIONS[selectedSubject].map((unit) => (
                  <button
                    key={unit}
                    disabled={submitting}
                    onClick={() => postStudy(selectedSubject, unit)}
                    className="block w-full rounded-xl border border-slate-200 py-3 hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50"
                  >
                    {unit}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => { setShowStudyModal(false); setSelectedSubject(null); }}
              className="mt-4 w-full rounded-xl border border-slate-300 py-2 text-slate-600"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
