import { X } from "lucide-react";

export function BubblePreview() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: 36,
      borderRadius: 18,
      background: "hsla(240, 10%, 5%, 0.95)",
      border: "1px solid hsla(240, 4%, 20%, 0.6)",
      padding: "0 10px",
      gap: 8,
      minWidth: 160,
    }}>
      {/* Dismiss button */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, borderRadius: 10,
        background: "hsla(217, 91%, 60%, 0.1)",
      }}>
        <X size={9} strokeWidth={2.5} style={{ color: "hsla(217, 91%, 60%, 0.6)" }} />
      </div>

      {/* Waveform bars */}
      <div style={{ display: "flex", alignItems: "center", gap: 2.5, height: 24 }}>
        {[0.3, 0.5, 0.8, 1, 0.9, 0.7, 1, 0.85, 0.6, 0.9, 0.75, 0.4, 0.55, 0.7, 0.5, 0.3].map((h, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: `${h * 100}%`,
              borderRadius: 1.5,
              background: `rgba(255, 255, 255, ${0.5 + h * 0.4})`,
              animation: `bubble-bar 1.8s ease-in-out ${i * 0.08}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Stop button */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 22, height: 22, borderRadius: 11,
        background: "hsla(0, 84%, 60%, 0.15)",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: 1.5, background: "hsl(0, 84%, 60%)" }} />
      </div>
    </div>
  );
}
