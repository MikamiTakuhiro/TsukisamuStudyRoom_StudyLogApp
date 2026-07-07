"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StudentShell from "@/components/StudentShell";
import StudyCalendar from "@/components/StudyCalendar";
import { attendanceApi, notificationsApi, STUDY_OPTIONS, type CalendarWeek, type NotificationItem } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { vibrate } from "@/lib/auth";
import { formatDateJa } from "@/lib/utils";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [weeks, setWeeks] = useState<CalendarWeek[]>([]);
  const [selectedDay, setSelectedDay] = useState<{ date: string; lines: string[] } | null>(null);
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [activeSeat, setActiveSeat] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isReadOnly = user?.is_read_only ?? false;

  useEffect(() => {
    if (!user) return;
    attendanceApi.calendar(26).then(setWeeks).catch(console.error);
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
      setWeeks(await attendanceApi.calendar(26));
    } catch (e) {
      alert(e instanceof Error ? e.message : "記録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <div className="flex min-h-full items-center justify-center font-bold text-black">読み込み中...</div>;
  }

  return (
    <StudentShell title={`${user.name} さん`} user={user}>
      <div className="app-shell relative w-full px-4 py-4 pb-28">
        {activeSeat && <div className="badge-active mb-4 inline-block">入室中: {activeSeat}</div>}

        {!isReadOnly && (
          <Link href="/scan" className="btn-accent mb-4 w-full text-lg touch-manipulation">
            <span className="text-2xl">📷</span>
            QRコードで入退室
          </Link>
        )}

        <section className="card mb-4">
          <h2 className="section-title mb-3">通知・リマインド</h2>
          {notifications.length === 0 ? (
            <p className="font-medium text-black">情報なし</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.notification_id}
                className={`mb-2 rounded-xl border-2 p-3 text-sm font-medium text-black ${
                  n.trigger_gap_detected
                    ? "border-[var(--navy)] bg-[var(--moon-yellow)]"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                {n.content}
              </div>
            ))
          )}
        </section>

        <StudyCalendar
          weeks={weeks}
          onDayClick={(week, idx) => {
            const day = week.days[idx];
            setSelectedDay({ date: day.date, lines: day.summary_lines });
          }}
        />
      </div>

      {!isReadOnly && (
        <button
          type="button"
          onClick={() => setShowStudyModal(true)}
          className="fab touch-manipulation"
          aria-label="学習記録を追加"
        >
          +
        </button>
      )}

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-3xl bg-white p-6 sm:rounded-3xl">
            <h3 className="text-lg font-bold text-black">{formatDateJa(selectedDay.date)}</h3>
            {selectedDay.lines.length === 0 ? (
              <p className="mt-3 text-black">情報なし</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {selectedDay.lines.map((line, i) => (
                  <li key={i} className="rounded-xl bg-[var(--surface)] p-3 text-sm font-medium text-black">
                    {line}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setSelectedDay(null)} className="btn-secondary mt-4 w-full">
              閉じる
            </button>
          </div>
        </div>
      )}

      {showStudyModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-3xl bg-white p-6 sm:rounded-3xl">
            <h3 className="mb-4 text-lg font-bold text-black">今から勉強する内容</h3>
            {!selectedSubject ? (
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(STUDY_OPTIONS).map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setSelectedSubject(subject)}
                    className="btn-secondary py-5 text-base font-bold touch-manipulation"
                  >
                    {subject}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <button type="button" onClick={() => setSelectedSubject(null)} className="font-bold text-[var(--navy)]">
                  ← 科目を選び直す
                </button>
                {STUDY_OPTIONS[selectedSubject].map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    disabled={submitting}
                    onClick={() => postStudy(selectedSubject, unit)}
                    className="btn-primary block w-full touch-manipulation disabled:opacity-50"
                  >
                    {unit}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setShowStudyModal(false);
                setSelectedSubject(null);
              }}
              className="btn-secondary mt-4 w-full"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
