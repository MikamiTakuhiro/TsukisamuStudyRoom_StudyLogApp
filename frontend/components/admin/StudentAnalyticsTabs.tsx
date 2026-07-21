"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { User } from "@/lib/api";
import { saveAnalyticsScrollPosition } from "@/lib/analyticsScroll";

export default function StudentAnalyticsTabs({
  students,
  currentId,
}: {
  students: User[];
  currentId: number;
}) {
  const router = useRouter();
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const container = tabsRef.current;
    const tab = activeRef.current;
    if (!container || !tab) return;

    const targetLeft = tab.offsetLeft - container.clientWidth / 2 + tab.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [currentId]);

  function selectStudent(studentId: number) {
    if (studentId === currentId) return;
    saveAnalyticsScrollPosition();
    router.push(`/admin/analytics/students/${studentId}`, { scroll: false });
  }

  return (
    <div className="student-sheet-bar" role="presentation">
      <div className="student-sheet-bar-inner">
        <div ref={tabsRef} className="student-sheet-tabs" role="tablist" aria-label="生徒を選択">
          {students.map((student) => {
            const active = student.student_id === currentId;
            return (
              <button
                key={student.student_id}
                ref={active ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={active}
                title={student.name}
                onClick={() => selectStudent(student.student_id)}
                className={`student-sheet-tab${active ? " student-sheet-tab-active" : ""}`}
              >
                <span className="student-sheet-tab-label">{student.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
