"use client";

import StudentShell from "@/components/StudentShell";
import AttendanceRecordsSection from "@/components/AttendanceRecordsSection";
import { PageLoading } from "@/components/ui/Input";
import { Ft } from "@/components/FuriganaText";
import { useAuth } from "@/lib/useAuth";

export default function AttendancePage() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <PageLoading />;
  }

  return (
    <StudentShell title="来塾記録" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="card">
          <h2 className="section-title mb-3"><Ft>来塾記録</Ft></h2>
          <AttendanceRecordsSection />
        </section>
      </div>
    </StudentShell>
  );
}
