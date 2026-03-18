import { useEffect, useRef } from "react";
import { Square, Check } from "lucide-react";

type Status = "idle" | "recording" | "transcribing" | "injecting" | "done" | "empty" | "error";

interface Props {
  status: Status;
  stream: MediaStream | null;
  onOpenSettings?: () => void;
  onStop?: () => void;
}

export default function RecordingWindow({ status, stream, onOpenSettings, onStop }: Props) {
  const isActive = status === "recording";
  const isProcessing = status === "transcribing" || status === "injecting";
  const isDone = status === "done";
  const isIdle = status === "idle";
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
        padding: isActive ? "0 12px 0 16px" : "0 14px",
        borderRadius: 24,
        background: "hsla(240, 10%, 5%, 0.92)",
        border: "1px solid hsla(240, 4%, 20%, 0.6)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        transition: "padding 0.3s ease, min-width 0.3s ease",
        minWidth: isActive ? 180 : isDone ? 100 : isProcessing ? 110 : 48,
        gap: 8,
      }}>

        {isIdle && (
          <div style={{
            width: 20, height: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "hsla(0,0%,100%,0.3)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
            </svg>
          </div>
        )}

        {isActive && (
          <>
            <LiveWaveform stream={stream} />
            <button
              className="no-drag"
              onClick={onStop}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 14,
                background: "hsla(0, 0%, 100%, 0.1)",
                border: "none", color: "hsla(0,0%,100%,0.6)",
                cursor: "pointer", padding: 0, flexShrink: 0,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "hsla(0, 0%, 100%, 0.2)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "hsla(0, 0%, 100%, 0.1)";
                e.currentTarget.style.color = "hsla(0,0%,100%,0.6)";
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
    // Start bars at mid-height so animation feels like it's already alive
    const smoothBars = new Float32Array(barCount);
    for (let i = 0; i < barCount; i++) {
      smoothBars[i] = 0.15 + Math.sin(i * 0.8) * 0.1;
    }
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
        const freqIdx = Math.floor((i / barCount) * bufferLength * 0.5 + bufferLength * 0.05);
        const raw = dataArray[freqIdx] / 255;

        // Faster lerp for first 10 frames so bars snap to real audio quickly
        const lerpSpeed = frameCount < 10 ? 0.6 : 0.28;
        smoothBars[i] += (raw - smoothBars[i]) * lerpSpeed;
        const val = smoothBars[i];

        const maxH = h * 0.9;
        const minH = 4;
        const barH = Math.max(minH, val * maxH);

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
      style={{ width: 120, height: 32, display: "block" }}
    />
  );
}
