import { useState, useEffect } from "react";
import { Mic, Keyboard, Clipboard, Check, AlertCircle, ShieldCheck, Zap } from "lucide-react";
import { api, ModelProgress } from "../lib/ipc";
import { BubblePreview } from "./BubblePreview";

interface Props {
  onComplete: () => void;
  onMount?: () => void;
}

type Step = "welcome" | "model" | "downloading" | "ready";

interface ModelInfo {
  id: string;
  label: string;
  desc: string;
  size: string;
  speedLabel: string;
  recommended: boolean;
  downloaded: boolean;
}

export default function OnboardingScreen({ onComplete, onMount }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => { onMount?.(); }, []);

  useEffect(() => {
    api?.listModels().then((m) => {
      const list = m as ModelInfo[];
      setModels(list);
      const rec = list.find((x) => x.recommended);
      setSelectedModel(rec?.id || list[0]?.id || "");
    });
  }, []);

  return (
    <div className="screen">
      {step === "welcome" && <WelcomeStep onNext={() => setStep("model")} />}
      {step === "model" && models.length > 0 && (
        <ModelStep models={models} selected={selectedModel} onSelect={setSelectedModel} onNext={() => setStep("downloading")} />
      )}
      {step === "downloading" && <DownloadStep model={selectedModel} onComplete={() => setStep("ready")} onBack={() => setStep("model")} />}
      {step === "ready" && <ReadyStep onComplete={onComplete} />}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      {/* Header drag region */}
      <div className="drag-region" style={{ height: 32, flexShrink: 0 }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 40px 32px", overflow: "hidden" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>
            Parlez. Le texte apparaît.
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            CursorVoice transforme votre voix en texte et le colle directement là où clignote votre curseur.
          </p>
        </div>

        {/* Bubble preview */}
        <div style={{
          display: "flex", justifyContent: "center", marginBottom: 28,
          padding: "20px 0",
          background: "hsla(240, 10%, 8%, 0.5)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}>
          <BubblePreview />
        </div>

        {/* Features grid — 2x2 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 24,
        }}>
          {[
            { icon: Keyboard, title: "Raccourci global", desc: "Depuis n'importe quelle app" },
            { icon: ShieldCheck, title: "100% hors-ligne", desc: "Aucune donnée envoyée" },
            { icon: Zap, title: "Rapide", desc: "Transcription en quelques secondes" },
            { icon: Clipboard, title: "Collage auto", desc: "Directement à votre curseur" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "hsla(217, 91%, 60%, 0.08)",
              }}>
                <Icon size={14} style={{ color: "var(--blue)" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button className="btn-primary" onClick={onNext}>Commencer</button>
      </div>
    </>
  );
}

function ModelStep({ models, selected, onSelect, onNext }: { models: ModelInfo[]; selected: string; onSelect: (id: string) => void; onNext: () => void }) {
  return (
    <>
      <div className="drag-region" style={{ height: 32, flexShrink: 0 }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 40px 32px" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Choisir le modèle</h2>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Téléchargé une seule fois, fonctionne 100% hors-ligne.</p>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, overflow: "auto" }}>
          {models.map((m) => {
            const active = selected === m.id;
            return (
              <button key={m.id} className={`select-btn ${active ? "active" : ""}`} onClick={() => onSelect(m.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: active ? "var(--blue)" : "var(--fg)" }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.size}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.speedLabel}</span>
                  {m.recommended && <span className="badge">Recommandé</span>}
                </div>
              </button>
            );
          })}
        </div>

        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onNext}>Télécharger et installer</button>
      </div>
    </>
  );
}

function DownloadStep({ model, onComplete, onBack }: { model: string; onComplete: () => void; onBack: () => void }) {
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState("Préparation...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function startDownload() {
      cleanup = api?.onModelProgress((data: ModelProgress) => {
        if (data.total > 0) {
          setPct(Math.round((data.downloaded / data.total) * 100));
          setStatus("Téléchargement du modèle...");
        }
      });

      const result = await api?.downloadModel(model);

      if (result?.success) {
        setPct(100);
        setStatus("Installation terminée");
        await api?.switchModel(model);
        setTimeout(onComplete, 600);
      } else {
        setError(result?.error || "Échec du téléchargement");
      }
    }

    startDownload();
    return () => cleanup?.();
  }, [model, onComplete]);

  const d = Math.min(100, pct);

  if (error) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "hsla(0, 84%, 60%, 0.1)", border: "1px solid hsla(0, 84%, 60%, 0.15)", marginBottom: 20 }}>
          <AlertCircle size={26} style={{ color: "var(--red)" }} />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Erreur de téléchargement</h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>{error}</p>
        <button className="btn-primary" style={{ maxWidth: 200 }} onClick={onBack}>Réessayer</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
      <div className="progress-ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${d * 2.64} ${264 - d * 2.64}`} style={{ transition: "stroke-dasharray 0.3s" }} />
        </svg>
        <div className="progress-ring-value">{d}%</div>
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{status}</h2>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>Cette opération est unique</p>
    </div>
  );
}

function ReadyStep({ onComplete }: { onComplete: () => void }) {
  return (
    <>
      <div className="drag-region" style={{ height: 32, flexShrink: 0 }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 40px 32px", textAlign: "center" }}>
        <div className="onboard-check">
          <Check size={26} style={{ color: "var(--green)" }} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Tout est prêt !</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, maxWidth: 340, marginBottom: 24 }}>
          CursorVoice fonctionne en arrière-plan dans votre barre système.
        </p>

        {/* Demo: show the bubble */}
        <div style={{
          display: "flex", justifyContent: "center", marginBottom: 20,
          padding: "16px 0",
          background: "hsla(240, 10%, 8%, 0.5)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          width: "100%",
        }}>
          <BubblePreview />
        </div>

        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 28 }}>
          Appuyez sur <kbd>Ctrl+Shift+H</kbd> pour commencer à dicter.
        </p>

        <button className="btn-primary" style={{ maxWidth: 240 }} onClick={onComplete}>C'est parti</button>
      </div>
    </>
  );
}
