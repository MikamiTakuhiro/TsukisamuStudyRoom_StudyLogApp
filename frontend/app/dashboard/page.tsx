"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StudentShell from "@/components/StudentShell";
import StudyCalendar from "@/components/StudyCalendar";
import NotificationRow, { notificationTypeLabel, studyPlanFocusUrl } from "@/components/NotificationRow";
import { attendanceApi, notificationsApi, STUDY_OPTIONS, type CalendarWeek, type NotificationItem } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { vibrate } from "@/lib/auth";
import { formatDateJa, formatDateTimeJa } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [weeks, setWeeks] = useState<CalendarWeek[]>([]);
  const [selectedDay, setSelectedDay] = useState<{ date: string; lines: string[] } | null>(null);
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [activeSeat, setActiveSeat] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [detailNotification, setDetailNotification] = useState<NotificationItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isReadOnly = user?.is_read_only ?? false;

  async function reloadNotifications() {
    setNotifications(await notificationsApi.list());
  }

  useEffect(() => {
    if (!user) return;
    attendanceApi.calendar(26).then(setWeeks).catch(console.error);
    attendanceApi.active().then((a) => setActiveSeat(a?.seat_name ?? null)).catch(console.error);
    reloadNotifications().catch(console.error);
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
    <StudentShell title={`${user.name} さん`} user={user} fillViewport>
      <div className="dashboard-home app-shell flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-2 pb-20">
        {activeSeat && <div className="badge-active shrink-0">入室中: {activeSeat}</div>}

        {!isReadOnly && (
          <Link
            href="/scan"
            className="btn-accent w-full shrink-0 touch-manipulation py-3 text-base min-h-[3rem]"
          >
            <span className="text-xl">📷</span>
            QRコードで入退室
          </Link>
        )}

        <section
          className={`card shrink-0 py-3 ${
            openMenuId
              ? "relative z-30 overflow-visible"
              : "max-h-[min(28vh,12rem)] overflow-y-auto"
          }`}
        >
          <h2 className="section-title mb-2">通知・リマインド</h2>
          {notifications.length === 0 ? (
            <p className="text-sm font-medium text-black">情報なし</p>
          ) : (
            notifications.map((n) => (
              <NotificationRow
                key={n.notification_id}
                notification={n}
                menuOpen={openMenuId === n.notification_id}
                isReadOnly={isReadOnly}
                onMenuToggle={() =>
                  setOpenMenuId((prev) => (prev === n.notification_id ? null : n.notification_id))
                }
                onMenuClose={() => setOpenMenuId(null)}
                onDetail={() => {
                  setOpenMenuId(null);
                  setDetailNotification(n);
                }}
                onUpdatePlan={
                  n.notification_type === "plan_gap" || n.trigger_gap_detected
                    ? () => {
                        setOpenMenuId(null);
                        router.push(studyPlanFocusUrl(n.content));
                      }
                    : undefined
                }
                onDelete={async () => {
                  setOpenMenuId(null);
                  if (!confirm("この通知を削除しますか？")) return;
                  try {
                    await notificationsApi.delete(n.notification_id);
                    await reloadNotifications();
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "削除に失敗しました");
                  }
                }}
              />
            ))
          )}
        </section>

        <StudyCalendar
          fillHeight
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
        <div className="modal-overlay items-end sm:items-center sm:justify-center">
          <div className="modal-panel w-full rounded-t-3xl bg-white p-6 sm:rounded-3xl">
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
        <div className="modal-overlay items-end sm:items-center sm:justify-center">
          <div className="modal-panel w-full rounded-t-3xl bg-white p-6 sm:rounded-3xl">
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

      {detailNotification && (
        <div className="modal-overlay items-end sm:items-center sm:justify-center">
          <div className="modal-panel w-full rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl">
            <h3 className="text-lg font-bold text-black">通知の詳細</h3>
            <dl className="mt-4 space-y-3 text-sm text-black">
              <div>
                <dt className="font-bold text-[var(--navy)]">種類</dt>
                <dd className="mt-1">{notificationTypeLabel(detailNotification.notification_type)}</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--navy)]">内容</dt>
                <dd className="mt-1 whitespace-pre-wrap">{detailNotification.content}</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--navy)]">送信日時</dt>
                <dd className="mt-1">{formatDateTimeJa(detailNotification.sent_at)}</dd>
              </div>
              {detailNotification.trigger_gap_detected && (
                <div>
                  <dt className="font-bold text-[var(--navy)]">関連</dt>
                  <dd className="mt-1">
                    <Link href={studyPlanFocusUrl(detailNotification.content)} className="font-bold text-[var(--navy)] underline">
                      学習計画を確認する
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            <button type="button" onClick={() => setDetailNotification(null)} className="btn-secondary mt-6 w-full">
              閉じる
            </button>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
