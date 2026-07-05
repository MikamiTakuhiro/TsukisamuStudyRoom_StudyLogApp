"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import AppHeader from "@/components/AppHeader";
import { attendanceApi } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { vibrate } from "@/lib/auth";

type ScanResult = {
  mode: "check_in" | "check_out";
  seat: { seat_name: string; qr_code_data: string };
  student_name: string;
};

export default function ScanPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const scannedRef = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (loading || !user || user.is_read_only) return;

    let animationId = 0;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const tick = async () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || scannedRef.current) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code?.data) {
                scannedRef.current = true;
                stopCamera();
                vibrate(200);
                try {
                  const result = await attendanceApi.scan(code.data);
                  setScanResult(result as ScanResult);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "QRの読み取りに失敗しました");
                  scannedRef.current = false;
                }
              }
            }
          }
          animationId = requestAnimationFrame(tick);
        };
        animationId = requestAnimationFrame(tick);
      } catch {
        setError("カメラへのアクセスが拒否されました。HTTPS環境またはブラウザの権限を確認してください。");
      }
    }

    startCamera();
    return () => {
      cancelAnimationFrame(animationId);
      stopCamera();
    };
  }, [loading, user, stopCamera]);

  async function confirmAction() {
    if (!scanResult) return;
    setProcessing(true);
    try {
      if (scanResult.mode === "check_in") {
        await attendanceApi.checkIn(scanResult.seat.qr_code_data);
      } else {
        await attendanceApi.checkOut();
      }
      vibrate([100, 50, 100]);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理に失敗しました");
      setProcessing(false);
    }
  }

  if (loading || !user) {
    return <div className="flex min-h-full items-center justify-center">読み込み中...</div>;
  }

  if (user.is_read_only) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="min-h-full bg-black">
      <AppHeader title="QRスキャン" />
      <div className="relative mx-auto max-w-lg">
        {!scanResult ? (
          <>
            <video ref={videoRef} className="aspect-[3/4] w-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/90">
              座席のQRコードを枠内に合わせてください
            </p>
          </>
        ) : (
          <div className="bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">確認</h2>
            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4">
              <p><span className="text-slate-500">座席:</span> <strong>{scanResult.seat.seat_name}</strong></p>
              <p><span className="text-slate-500">名前:</span> <strong>{scanResult.student_name}</strong></p>
              <p className="text-sm text-slate-600">
                {scanResult.mode === "check_in" ? "入室しますか？" : "退室しますか？"}
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={confirmAction}
                disabled={processing}
                className={`flex-1 rounded-xl py-3 font-bold text-white ${
                  scanResult.mode === "check_in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-600 hover:bg-orange-700"
                } disabled:opacity-60`}
              >
                {processing ? "処理中..." : scanResult.mode === "check_in" ? "入室する" : "退室する"}
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-600 px-4 py-3 text-sm text-white">{error}</div>
        )}
      </div>
    </div>
  );
}
