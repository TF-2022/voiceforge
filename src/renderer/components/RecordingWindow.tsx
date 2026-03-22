import { useEffect, useRef } from "react";
import { Square, Check, X } from "lucide-react";

type Status = "idle" | "recording" | "transcribing" | "injecting" | "done" | "empty" | "error";

interface Props {
  status: Status;
  stream: MediaStream | null;
  onStop?: () => void;
  onDismiss?: () => void;
}

export default function RecordingWindow({ status, stream, onStop, onDismiss }: Props) {
  // Idle = render nothing. Window is transparent, user sees nothing.
  if (status === "idle") return null;

  const isActive = status === "recording";
  const isProcessing = status === "transcribing" || status === "injecting";
  const isDone = status === "done";
  const isEmpty = status === "empty";
  const isError = status === "error";

  return (
    <div style={{
      width: "100vw", height: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "transparent",
    }}>
      <div className="drag-region" style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 48,
        borderRadius: 24,
        background: "hsla(240, 10%, 5%, 0.95)",
        border: "1px solid hsla(240, 4%, 20%, 0.6)",
        padding: isActive ? "0 10px" : "0 14px",
        gap: 8,
        minWidth: isActive ? 220 : isDone ? 100 : isProcessing ? 110 : 80,
      }}>
        {isActive && (
          <>
            <button
              className="no-drag"
              onMouseDown={(e) => { e.preventDefault(); onDismiss?.(); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 24, height: 24, borderRadius: 12,
                background: "hsla(217, 91%, 60%, 0.1)",
                border: "none", color: "hsla(217, 91%, 60%, 0.6)",
                cursor: "pointer", padding: 0, flexShrink: 0,
              }}
            >
              <X size={12} strokeWidth={2.5} />
            </button>

            <LiveWaveform stream={stream} />

            <button
              className="no-drag"
              onMouseDown={(e) => { e.preventDefault(); onStop?.(); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 14,
                background: "hsla(0, 84%, 60%, 0.15)",
                border: "none", color: "hsl(0, 84%, 60%)",
                cursor: "pointer", padding: 0, flexShrink: 0,
              }}
            >
              <Square size={10} fill="currentColor" />
            </button>
          </>
        )}

        {isProcessing && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%", background: "white",
                animation: `dot 1.2s ease ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}

        {isDone && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Check size={14} style={{ color: "var(--green)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--green)" }}>Collé</span>
          </div>
        )}

        {isEmpty && <span style={{ fontSize: 10, color: "hsla(0,0%,100%,0.35)" }}>Vide</span>}
        {isError && <span style={{ fontSize: 10, color: "var(--red)" }}>Erreur</span>}
      </div>
    </div>
  );
}

function LiveWaveform({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const barCount = 16;
    const smoothBars = new Float32Array(barCount).fill(0);
    const dpr = window.devicePixelRatio || 1;
    let frameCount = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      frameCount++;
      analyser.getByteFrequencyData(dataArray);

      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const cy = h / 2;

      ctx.clearRect(0, 0, w * dpr, h * dpr);

      const barW = 3.5;
      const gap = 2.5;
      const totalW = barCount * (barW + gap) - gap;
      const startX = (w - totalW) / 2;

      for (let i = 0; i < barCount; i++) {
        const distFromCenter = Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2);
        const freqIdx = Math.floor(distFromCenter * bufferLength * 0.4 + bufferLength * 0.05);
        const raw = dataArray[freqIdx] / 255;
        const centerBoost = 1 - distFromCenter * 0.5;
        const boosted = raw * centerBoost;

        const lerpSpeed = frameCount < 10 ? 0.6 : 0.28;
        smoothBars[i] += (boosted - smoothBars[i]) * lerpSpeed;
        const val = smoothBars[i];

        const maxH = h * 0.9;
        const barH = Math.max(3, val * maxH);
        const x = startX + i * (barW + gap);
        const y = cy - barH / 2;

        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + val * 0.3})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 1.5);
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      audioCtx.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 120, height: 32, display: "block", flexShrink: 0 }}
    />
  );
}
