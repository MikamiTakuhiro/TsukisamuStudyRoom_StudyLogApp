"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StudentShell from "@/components/StudentShell";
import StudyCalendar from "@/components/StudyCalendar";
import { notificationTypeLabel, studyPlanFocusUrl } from "@/components/NotificationRow";
import { Input, PageLoading, SubmitButton } from "@/components/ui/Input";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { Ft, FormatDateJa, FormatDateTimeJa, FuriganaSubject } from "@/components/FuriganaText";
import {
  academicApi,
  attendanceApi,
  notificationsApi,
  type CalendarReservation,
  type CalendarTargetPlan,
  type CalendarWeek,
  type NotificationItem,
  type StudyPlan,
} from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { vibrate } from "@/lib/auth";
import { getStudyOptions, getSubjects, storageSubject } from "@/lib/subjects";

const RECENT_UNITS_KEY = "recent-study-units";
const RECENT_UNITS_MAX = 6;

/** 科目ごとに最近入力した単元（端末内のみ） */
function loadRecentUnits(subject: string): string[] {
  try {
    const raw = localStorage.getItem(RECENT_UNITS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    return Array.isArray(all[subject]) ? all[subject] : [];
  } catch {
    return [];
  }
}

function saveRecentUnit(subject: string, unit: string) {
  try {
    const raw = localStorage.getItem(RECENT_UNITS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const list = [unit, ...(all[subject] ?? []).filter((u) => u !== unit)].slice(0, RECENT_UNITS_MAX);
    localStorage.setItem(RECENT_UNITS_KEY, JSON.stringify({ ...all, [subject]: list }));
  } catch {
    /* ignore */
  }
}

function isPlanOpen(plan: StudyPlan) {
  return !plan.progress.some((pr) => pr.completion_date != null);
}

function sameSubject(a: string, b: string) {
  return a === b || (a === "算数" && b === "数学") || (a === "数学" && b === "算数");
}

function isPlanNotification(n: NotificationItem) {
  return n.notification_type !== "broadcast" && (n.notification_type === "plan_gap" || n.trigger_gap_detected);
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const { user, loading } = useAuth();
  const [weeks, setWeeks] = useState<CalendarWeek[]>([]);
  const [weeksLoaded, setWeeksLoaded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{
    date: string;
    lines: string[];
    targetPlans: CalendarTargetPlan[];
    reservations: CalendarReservation[];
  } | null>(null);
  /** カレンダーのスクロール中は記録ボタンを半透明にする */
  const [calendarScrolling, setCalendarScrolling] = useState(false);
  // ページ内のどこかがスクロールしている間（カレンダー内・ページ全体とも）、記録ボタンを半透明にする。
  // scroll イベントはバブルしないため capture で拾う。
  useEffect(() => {
    let timer: number | null = null;
    const onScroll = () => {
      setCalendarScrolling(true);
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => setCalendarScrolling(false), 250);
    };
    // scroll は環境によって拾えないことがあるため、ホイール・タッチ操作も合わせて検知する
    const events = ["scroll", "wheel", "touchmove"] as const;
    for (const type of events) document.addEventListener(type, onScroll, { capture: true, passive: true });
    return () => {
      for (const type of events) document.removeEventListener(type, onScroll, true);
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [unitInput, setUnitInput] = useState("");
  const [activeSeat, setActiveSeat] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [detailNotification, setDetailNotification] = useState<NotificationItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<StudyPlan[]>([]);

  const isReadOnly = user?.is_read_only ?? false;
  const subjects = useMemo(() => (user ? getSubjects(user.grade) : []), [user]);

  async function reloadNotifications() {
    setNotifications(await notificationsApi.list());
  }

  useEffect(() => {
    if (!user) return;
    attendanceApi
      .calendar(26)
      .then(setWeeks)
      .catch((e) => toast(errorMessage(e, "カレンダーの読み込みに失敗しました"), "error"))
      .finally(() => setWeeksLoaded(true));
    attendanceApi.active().then((a) => setActiveSeat(a?.seat_name ?? null)).catch(console.error);
    reloadNotifications().catch((e) => {
      setNotifications([]);
      toast(errorMessage(e, "通知の読み込みに失敗しました"), "error");
    });
  }, [user, toast]);

  /** 単元候補: 進行中の学習計画 → 最近入力した単元 → 定番の単元 */
  const unitSuggestions = useMemo(() => {
    if (!selectedSubject || !user) return [];
    const fromPlans = plans
      .filter((p) => isPlanOpen(p) && sameSubject(p.subject, selectedSubject))
      .map((p) => p.unit);
    const recent = loadRecentUnits(selectedSubject);
    const defaults = (getStudyOptions(user.grade)[selectedSubject] ?? []).filter((u) => u !== "その他");
    return [...new Set([...fromPlans, ...recent, ...defaults])].slice(0, 10);
  }, [selectedSubject, plans, user]);

  function openStudyModal() {
    setShowStudyModal(true);
    academicApi.studyPlans().then(setPlans).catch(() => setPlans([]));
  }

  function closeStudyModal() {
    if (submitting) return;
    setShowStudyModal(false);
    setSelectedSubject(null);
    setUnitInput("");
  }

  async function postStudy(subject: string, unit: string) {
    if (submitting || !unit) return;
    setSubmitting(true);
    try {
      await attendanceApi.createStudyRecord(storageSubject(subject, user!.grade), unit);
      saveRecentUnit(subject, unit);
      vibrate([50, 30, 50]);
      setShowStudyModal(false);
      setSelectedSubject(null);
      setUnitInput("");
      toast("学習を記録しました");
      setWeeks(await attendanceApi.calendar(26));
    } catch (e) {
      toast(errorMessage(e, "記録に失敗しました"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteNotification(n: NotificationItem) {
    const ok = await confirm({
      title: "この通知を削除しますか？",
      confirmLabel: "削除する",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await notificationsApi.delete(n.notification_id);
      setDetailNotification(null);
      toast("通知を削除しました");
      await reloadNotifications();
    } catch (e) {
      toast(errorMessage(e, "削除に失敗しました"), "error");
    } finally {
      setDeleting(false);
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
    return <PageLoading />;
  }

  const notificationCount = notifications?.length ?? 0;
  const canDeleteDetail =
    detailNotification && (!isReadOnly || detailNotification.notification_type === "broadcast");

  return (
    <StudentShell title={`${user.name} さん`} user={user} fillViewport activeSeat={activeSeat}>
      <div className="dashboard-home app-shell flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-2 pb-[10px]">
        {!isReadOnly && (
          <Link
            href="/scan"
            className={`btn-accent w-full shrink-0 touch-manipulation py-3 text-base min-h-[3rem] ${activeSeat ? "btn-warn" : ""}`}
          >
            <span className="text-xl" aria-hidden="true">📷</span>
            {activeSeat ? <Ft>QRコードで退室する</Ft> : <Ft>QRコードで入室する</Ft>}
          </Link>
        )}

        <section className="card shrink-0 py-2">
          <button
            type="button"
            onClick={() => setNotificationsOpen((v) => !v)}
            disabled={notifications === null || notificationCount === 0}
            aria-expanded={notificationsOpen}
            aria-controls="dashboard-notifications"
            className="flex min-h-[2.75rem] w-full items-center gap-2 text-left touch-manipulation disabled:cursor-default"
          >
            <span className="section-title"><Ft>お知らせ・リマインド</Ft></span>
            {notifications === null ? (
              <span className="ml-auto text-sm font-medium text-[var(--placeholder)]"><Ft>読み込み中...</Ft></span>
            ) : notificationCount === 0 ? (
              <span className="ml-auto text-sm font-medium text-black"><Ft>新しいお知らせはありません</Ft></span>
            ) : (
              <>
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {notificationCount}<Ft>件</Ft>
                </span>
                <span className="ml-auto text-sm font-bold text-[var(--navy)]">
                  {notificationsOpen ? <Ft>閉じる ▲</Ft> : <Ft>見る ▼</Ft>}
                </span>
              </>
            )}
          </button>

          {notificationsOpen && notificationCount > 0 && (
            <ul id="dashboard-notifications" className="mt-1 max-h-[min(30vh,14rem)] space-y-2 overflow-y-auto pb-1">
              {notifications!.map((n) => (
                <li key={n.notification_id}>
                  <button
                    type="button"
                    onClick={() => setDetailNotification(n)}
                    className={`flex min-h-[2.75rem] w-full items-start gap-2 rounded-xl border-2 p-2.5 text-left touch-manipulation ${
                      n.notification_type === "broadcast"
                        ? "border-orange-400 bg-orange-50"
                        : n.trigger_gap_detected
                          ? "border-[var(--navy)] bg-[var(--moon-yellow)]"
                          : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    {n.notification_type === "broadcast" && (
                      <span className="shrink-0 rounded-md bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-white">
                        <Ft>お知らせ</Ft>
                      </span>
                    )}
                    <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-black">{n.content}</span>
                    <span className="shrink-0 self-center text-lg font-bold text-[var(--navy)]" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <StudyCalendar
          fillHeight
          weeks={weeks}
          loading={!weeksLoaded}
          onDayClick={(week, idx) => {
            const day = week.days[idx];
            setSelectedDay({
              date: day.date,
              lines: day.summary_lines,
              targetPlans: day.target_plans ?? [],
              reservations: day.reservations ?? [],
            });
          }}
        />
      </div>

      {!isReadOnly && (
        <button
          type="button"
          onClick={openStudyModal}
          className="fab touch-manipulation"
          style={{ opacity: calendarScrolling ? 0.2 : 1 }}
          aria-label="学習記録を追加"
        >
          +
        </button>
      )}

      {selectedDay && (
        <div
          className="modal-overlay items-end sm:items-center sm:justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedDay(null);
          }}
        >
          <div
            className="modal-panel max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
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
            {selectedDay.reservations.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-bold text-[var(--navy)]"><Ft>来塾予約</Ft></p>
                <ul className="mt-2 space-y-2">
                  {selectedDay.reservations.map((r) => (
                    <li key={r.reservation_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDay(null);
                          router.push(`/reservations?reservation=${r.reservation_id}`);
                        }}
                        className="w-full rounded-xl border-2 border-green-500/60 bg-green-50 p-3 text-left text-sm font-medium text-black touch-manipulation"
                      >
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500 align-middle" />
                        {r.start_time}〜{r.end_time}
                        <span className="mt-1 block text-xs font-bold text-[var(--navy)]"><Ft>来塾予約を確認する →</Ft></span>
                      </button>
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
            {selectedDay.lines.length === 0 && selectedDay.reservations.length === 0 && selectedDay.targetPlans.length === 0 && (
              <p className="mt-3 text-black"><Ft>この日の記録はありません</Ft></p>
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
            className="modal-panel max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="study-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="study-modal-title" className="mb-4 text-lg font-bold text-black"><Ft>今から勉強する内容</Ft></h3>
            {!selectedSubject ? (
              <>
                <p className="mb-3 text-sm font-bold text-[var(--navy)]"><Ft>① 科目を選んでください</Ft></p>
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
              </>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  postStudy(selectedSubject, unitInput.trim());
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--navy)]">
                    <Ft>科目</Ft>: <span className="text-base text-black"><FuriganaSubject subject={selectedSubject} grade={user.grade} /></span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedSubject(null)}
                    className="btn-tap-sm text-[var(--navy)]"
                  >
                    ← <Ft>選び直す</Ft>
                  </button>
                </div>
                <label htmlFor="study-unit" className="block text-sm font-bold text-[var(--navy)]">
                  <Ft>② 単元を入力または選択</Ft>
                </label>
                <Input
                  id="study-unit"
                  type="text"
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value)}
                  placeholder="例: 二次関数、長文読解"
                  autoFocus
                  maxLength={100}
                  enterKeyHint="done"
                />
                {unitSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2" aria-label="単元の候補">
                    {unitSuggestions.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnitInput(u)}
                        aria-pressed={unitInput === u}
                        className={`min-h-[2.5rem] rounded-full border-2 px-3 text-sm font-bold touch-manipulation ${
                          unitInput === u
                            ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                            : "border-[var(--border)] bg-[var(--surface)] text-black"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                )}
                <SubmitButton busy={submitting} disabled={!unitInput.trim()} busyLabel="記録中...">
                  記録する
                </SubmitButton>
              </form>
            )}
            <button type="button" onClick={closeStudyModal} disabled={submitting} className="btn-secondary mt-4 w-full">
              <Ft>キャンセル</Ft>
            </button>
          </div>
        </div>
      )}

      {detailNotification && (
        <div
          className="modal-overlay items-end sm:items-center sm:justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDetailNotification(null);
          }}
        >
          <div
            className="modal-panel max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-black">
              <Ft>{notificationTypeLabel(detailNotification.notification_type)}</Ft>
            </h3>
            <p className="mt-1 text-xs font-medium text-[var(--placeholder)]">
              <FormatDateTimeJa iso={detailNotification.sent_at} />
            </p>
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[var(--surface)] p-3 text-sm font-medium text-black">
              {detailNotification.content}
            </p>

            <div className="mt-6 space-y-3">
              {isPlanNotification(detailNotification) && (
                <button
                  type="button"
                  onClick={() => {
                    const url = studyPlanFocusUrl(detailNotification.content);
                    setDetailNotification(null);
                    router.push(url);
                  }}
                  className="btn-primary w-full"
                >
                  <Ft>学習計画を確認・更新する</Ft>
                </button>
              )}
              <div className="flex gap-3">
                {canDeleteDetail && (
                  <button
                    type="button"
                    onClick={() => deleteNotification(detailNotification)}
                    disabled={deleting}
                    className="btn-tap-sm flex-1 border-2 border-red-600 bg-red-50 text-red-700 disabled:opacity-50"
                  >
                    <Ft>削除</Ft>
                  </button>
                )}
                <button type="button" onClick={() => setDetailNotification(null)} className="btn-secondary flex-1">
                  <Ft>閉じる</Ft>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
