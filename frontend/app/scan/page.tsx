"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import StudentShell from "@/components/StudentShell";
import { Ft } from "@/components/FuriganaText";
import { PageLoading, SubmitButton } from "@/components/ui/Input";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { attendanceApi } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { vibrate } from "@/lib/auth";

type ScanResult = {
  mode: "check_in" | "check_out";
  seat: { seat_name: string; qr_code_data: string };
  student_name: string;
};

type ScanError =
  | { kind: "camera" }
  | { kind: "scan"; message: string }
  | { kind: "action"; message: string };

export default function ScanPage() {
  const router = useRouter();
  const { toast } = useFeedback();
  const { user, loading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [checking, setChecking] = useState(false);
  /** 値を変えるとカメラを起動し直す */
  const [cameraKey, setCameraKey] = useState(0);
  const scannedRef = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const restartScan = useCallback(() => {
    stopCamera();
    scannedRef.current = false;
    setError(null);
    setScanResult(null);
    setProcessing(false);
    setChecking(false);
    setCameraKey((k) => k + 1);
  }, [stopCamera]);

  useEffect(() => {
    if (!loading && user?.is_read_only) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user || user.is_read_only) return;

    let animationId = 0;
    let cancelled = false;
    scannedRef.current = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const tick = async () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (cancelled || !video || !canvas || scannedRef.current) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code?.data) {
                scannedRef.current = true;
                stopCamera();
                vibrate(200);
                setChecking(true);
                try {
                  const result = await attendanceApi.scan(code.data);
                  if (!cancelled) setScanResult(result as ScanResult);
                } catch (e) {
                  if (!cancelled) {
                    setError({ kind: "scan", message: errorMessage(e, "QRコードの読み取りに失敗しました") });
                  }
                } finally {
                  if (!cancelled) setChecking(false);
                }
                return;
              }
            }
          }
          animationId = requestAnimationFrame(tick);
        };
        animationId = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setError({ kind: "camera" });
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      stopCamera();
    };
  }, [loading, user, stopCamera, cameraKey]);

  async function confirmAction() {
    if (!scanResult || processing) return;
    setProcessing(true);
    try {
      if (scanResult.mode === "check_in") {
        await attendanceApi.checkIn(scanResult.seat.qr_code_data);
        toast(`${scanResult.seat.seat_name} に入室しました`);
      } else {
        await attendanceApi.checkOut();
        toast("退室しました。おつかれさまでした！");
      }
      vibrate([100, 50, 100]);
      router.push("/dashboard");
    } catch (e) {
      setError({ kind: "action", message: errorMessage(e, "処理に失敗しました") });
      setProcessing(false);
    }
  }

  if (loading || !user || user.is_read_only) {
    return <PageLoading />;
  }

  const isCheckIn = scanResult?.mode === "check_in";
  const showCamera = !scanResult && !error;

  return (
    <StudentShell title="QRスキャン" user={user} hideBottomNav={!!scanResult}>
      <div className="app-shell relative w-full">
        {showCamera && (
          <div className="scan-viewport">
            <video ref={videoRef} className="aspect-[3/4] max-h-[70dvh] w-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="scan-frame" aria-hidden="true">
              <span />
              {!checking && <div className="scan-line" />}
            </div>
            <p className="absolute left-0 right-0 top-4 px-4 text-center text-base font-bold text-white drop-shadow">
              {checking ? <Ft>確認中...</Ft> : <Ft>座席のQRコードを枠の中に合わせてください</Ft>}
            </p>
          </div>
        )}

        {error?.kind === "camera" && (
          <div className="space-y-4 p-6">
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4" role="alert">
              <h2 className="text-lg font-bold text-black"><Ft>カメラが使えません</Ft></h2>
              <p className="mt-2 text-sm font-medium text-black">
                <Ft>QRコードを読み取るには、カメラの使用を許可してください。</Ft>
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm font-medium text-black">
                <li><Ft>画面上部のアドレスバー（🔒やⓘのマーク）をタップ</Ft></li>
                <li><Ft>「カメラ」を「許可」に変更</Ft></li>
                <li><Ft>下の「もう一度試す」をタップ</Ft></li>
              </ol>
              <p className="mt-3 text-xs font-medium text-[var(--placeholder)]">
                <Ft>うまくいかないときは、塾の先生に声をかけてください。</Ft>
              </p>
            </div>
            <button type="button" onClick={restartScan} className="btn-primary w-full">
              <Ft>もう一度試す</Ft>
            </button>
            <button type="button" onClick={() => router.push("/dashboard")} className="btn-secondary w-full">
              <Ft>ホームに戻る</Ft>
            </button>
          </div>
        )}

        {error?.kind === "scan" && (
          <div className="space-y-4 p-6">
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4" role="alert">
              <h2 className="text-lg font-bold text-black"><Ft>読み取りできませんでした</Ft></h2>
              <p className="mt-2 text-sm font-medium text-black">{error.message}</p>
            </div>
            <button type="button" onClick={restartScan} className="btn-primary w-full">
              📷 <Ft>もう一度スキャン</Ft>
            </button>
            <button type="button" onClick={() => router.push("/dashboard")} className="btn-secondary w-full">
              <Ft>ホームに戻る</Ft>
            </button>
          </div>
        )}

        {scanResult && (
          <div className="bg-white p-6">
            <h2 className="text-xl font-bold text-black">
              {isCheckIn ? <Ft>入室しますか？</Ft> : <Ft>退室しますか？</Ft>}
            </h2>
            <div className="mt-4 space-y-2 rounded-2xl bg-[var(--surface)] p-4">
              <p className="text-black">
                <span className="font-bold"><Ft>座席</Ft>:</span>{" "}
                <span className="text-lg font-bold">{scanResult.seat.seat_name}</span>
              </p>
              <p className="text-black">
                <span className="font-bold"><Ft>名前</Ft>:</span> {scanResult.student_name}
              </p>
            </div>

            {error?.kind === "action" && (
              <p className="mt-4 rounded-xl border-2 border-red-400 bg-red-50 p-3 text-sm font-bold text-black" role="alert">
                {error.message}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-6">
              <SubmitButton
                type="button"
                busy={processing}
                busyLabel="処理中..."
                onClick={confirmAction}
                className={`w-full ${isCheckIn ? "btn-accent" : "btn-accent btn-warn"}`}
              >
                {isCheckIn ? "入室する" : "退室する"}
              </SubmitButton>
              <div className="flex gap-3 border-t border-[var(--border)] pt-4">
                <button type="button" onClick={restartScan} disabled={processing} className="btn-secondary flex-1">
                  <Ft>読み直す</Ft>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  <Ft>やめる</Ft>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
