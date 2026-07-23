"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AttendancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile#attendance-records");
  }, [router]);

  return <div className="p-8 font-bold text-black">読み込み中...</div>;
}
