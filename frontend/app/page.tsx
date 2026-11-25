"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// トップ（/）はログイン画面へ移動する。
// 静的書き出しではサーバー側のリダイレクトが使えないため、ブラウザ側で移動する。
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
