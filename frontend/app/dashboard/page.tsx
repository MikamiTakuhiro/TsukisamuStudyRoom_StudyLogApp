"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StudentShell from "@/components/StudentShell";
import StudyCalendar from "@/components/StudyCalendar";
import NotificationRow, { notificationTypeLabel, studyPlanFocusUrl } from "@/components/NotificationRow";
import { Input } from "@/components/ui/Input";
import { Ft, FormatDateJa, FormatDateTimeJa, FuriganaSubject } from "@/components/FuriganaText";
import { attendanceApi, notificationsApi, type CalendarTargetPlan, type CalendarWeek, type NotificationItem } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { vibrate } from "@/lib/auth";
import { getSubjects, storageSubject } from "@/lib/subjects";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [weeks, setWeeks] = useState<CalendarWeek[]>([]);
  const [selectedDay, setSelectedDay] = useState<{
    date: string;
    lines: string[];
    targetPlans: CalendarTargetPlan[];
  } | null>(null);
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [unitInput, setUnitInput] = useState("");
  const [activeSeat, setActiveSeat] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [detailNotification, setDetailNotification] = useState<NotificationItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isReadOnly = user?.is_read_only ?? false;
  const subjects = useMemo(() => (user ? getSubjects(user.grade) : []), [user]);

  async function reloadNotifications() {
    setNotifications(await notificationsApi.list());
  }

  useEffect(() => {
    if (!user) return;
    attendanceApi.calendar(26).then(setWeeks).catch(console.error);
    attendanceApi.active().then((a) => setActiveSeat(a?.seat_name ?? null)).catch(console.error);
    reloadNotifications().catch(console.error);
  }, [user]);

  function closeStudyModal() {
    setShowStudyModal(false);
    setSelectedSubject(null);
    setUnitInput("");
  }

  async function postStudy(subject: string, unit: string) {
    setSubmitting(true);
    try {
      await attendanceApi.createStudyRecord(storageSubject(subject, user!.grade), unit);
      vibrate([50, 30, 50]);
      setShowStudyModal(false);
      setSelectedSubject(null);
      setUnitInput("");
      setWeeks(await attendanceApi.calendar(26));
    } catch (e) {
      alert(e instanceof Error ? e.message : "記録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  function studyPlanEditUrl(plan: CalendarTargetPlan) {
    const params = new URLSearchParams({
      subject: plan.subject,
      unit: plan.unit,
      openProgress: "1",
    });
    return `/study-plans?${params.toString()}`;
  }

  if (loading || !user) {
    return <div className="flex min-h-full items-center justify-center font-bold text-black"><Ft>読み込み中...</Ft></div>;
  }

  return (
    <StudentShell title={`${user.name} さん`} user={user} fillViewport>
      <div className="dashboard-home app-shell flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-2 pb-20">
        {activeSeat && <div className="badge-active shrink-0"><Ft>入室中</Ft>: {activeSeat}</div>}

        {!isReadOnly && (
          <Link
            href="/scan"
            className="btn-accent w-full shrink-0 touch-manipulation py-3 text-base min-h-[3rem]"
          >
            <span className="text-xl">📷</span>
            <Ft>QRコードで入退室</Ft>
          </Link>
        )}

        <section
          className={`card shrink-0 py-3 ${
            openMenuId
              ? "relative z-30 overflow-visible"
              : "max-h-[min(28vh,12rem)] overflow-y-auto"
          }`}
        >
          <h2 className="section-title mb-2"><Ft>通知・リマインド</Ft></h2>
          {notifications.length === 0 ? (
            <p className="text-sm font-medium text-black"><Ft>情報なし</Ft></p>
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
                  n.notification_type !== "broadcast" &&
                  (n.notification_type === "plan_gap" || n.trigger_gap_detected)
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
            setSelectedDay({
              date: day.date,
              lines: day.summary_lines,
              targetPlans: day.target_plans ?? [],
            });
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
            <h3 className="text-lg font-bold text-black"><FormatDateJa iso={selectedDay.date} /></h3>
            {selectedDay.lines.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-bold text-[var(--navy)]"><Ft>学習記録</Ft></p>
                <ul className="mt-2 space-y-2">
                  {selectedDay.lines.map((line, i) => (
                    <li key={i} className="rounded-xl bg-[var(--surface)] p-3 text-sm font-medium text-black">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedDay.targetPlans.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-bold text-[var(--navy)]"><Ft>完了目標</Ft></p>
                <ul className="mt-2 space-y-2">
                  {selectedDay.targetPlans.map((plan) => (
                    <li key={plan.plan_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDay(null);
                          router.push(studyPlanEditUrl(plan));
                        }}
                        className="w-full rounded-xl border-2 border-red-400/60 bg-red-50 p-3 text-left text-sm font-medium text-black touch-manipulation"
                      >
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
                        <FuriganaSubject subject={plan.subject} grade={user.grade} /> — {plan.unit}
                        <span className="mt-1 block text-xs font-bold text-[var(--navy)]"><Ft>学習計画を編集する →</Ft></span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedDay.lines.length === 0 && selectedDay.targetPlans.length === 0 && (
              <p className="mt-3 text-black"><Ft>情報なし</Ft></p>
            )}
            <button type="button" onClick={() => setSelectedDay(null)} className="btn-secondary mt-4 w-full">
              <Ft>閉じる</Ft>
            </button>
          </div>
        </div>
      )}

      {showStudyModal && (
        <div
          className="modal-overlay items-end sm:items-center sm:justify-center"
          onClick={closeStudyModal}
        >
          <div
            className="modal-panel w-full rounded-t-3xl bg-white p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-bold text-black"><Ft>今から勉強する内容</Ft></h3>
            {!selectedSubject ? (
              <div className="grid grid-cols-2 gap-3">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setSelectedSubject(subject)}
                    className="btn-secondary py-5 text-base font-bold touch-manipulation"
                  >
                    <FuriganaSubject subject={subject} grade={user.grade} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <button type="button" onClick={() => setSelectedSubject(null)} className="font-bold text-[var(--navy)]">
                  ← <Ft>科目を選び直す</Ft>
                </button>
                <p className="text-sm font-bold text-[var(--navy)]">
                  <Ft>科目</Ft>: <FuriganaSubject subject={selectedSubject} grade={user.grade} />
                </p>
                <Input
                  type="text"
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value)}
                  placeholder="単元を入力（例: 二次関数、長文読解）"
                  autoFocus
                  maxLength={100}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && unitInput.trim()) {
                      postStudy(selectedSubject, unitInput.trim());
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={submitting || !unitInput.trim()}
                  onClick={() => postStudy(selectedSubject, unitInput.trim())}
                  className="btn-primary w-full touch-manipulation disabled:opacity-50"
                >
                  {submitting ? <Ft>記録中...</Ft> : <Ft>記録する</Ft>}
                </button>
              </div>
            )}
            <button type="button" onClick={closeStudyModal} className="btn-secondary mt-4 w-full">
              <Ft>キャンセル</Ft>
            </button>
          </div>
        </div>
      )}

      {detailNotification && (
        <div className="modal-overlay items-end sm:items-center sm:justify-center">
          <div className="modal-panel w-full rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl">
            <h3 className="text-lg font-bold text-black"><Ft>通知の詳細</Ft></h3>
            <dl className="mt-4 space-y-3 text-sm text-black">
              <div>
                <dt className="font-bold text-[var(--navy)]"><Ft>種類</Ft></dt>
                <dd className="mt-1"><Ft>{notificationTypeLabel(detailNotification.notification_type)}</Ft></dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--navy)]"><Ft>内容</Ft></dt>
                <dd className="mt-1 whitespace-pre-wrap">{detailNotification.content}</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--navy)]"><Ft>送信日時</Ft></dt>
                <dd className="mt-1"><FormatDateTimeJa iso={detailNotification.sent_at} /></dd>
              </div>
              {detailNotification.trigger_gap_detected && (
                <div>
                  <dt className="font-bold text-[var(--navy)]"><Ft>関連</Ft></dt>
                  <dd className="mt-1">
                    <Link href={studyPlanFocusUrl(detailNotification.content)} className="font-bold text-[var(--navy)] underline">
                      <Ft>学習計画を確認する</Ft>
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            <button type="button" onClick={() => setDetailNotification(null)} className="btn-secondary mt-6 w-full">
              <Ft>閉じる</Ft>
            </button>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
