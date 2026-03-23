import { useState, useEffect, useMemo, useRef } from "react";
import { X, RotateCcw, Download, Check, Loader2, Keyboard, Mic, Info, Search, AudioLines, Globe, Sparkles, Clock, Copy, Trash2, ChevronDown, ShieldCheck, HelpCircle, MousePointerClick } from "lucide-react";
import { api, ModelProgress } from "../lib/ipc";
import { BubblePreview } from "./BubblePreview";

interface Settings {
  hotkey: string;
  model: string;
  language: string;
  inputDevice: string;
  pushToTalk: boolean;
  translateMode: boolean;
  initialPrompt: string;
  silenceTimeout: number;
  launchAtStartup: boolean;
}

interface ModelInfo {
  id: string;
  label: string;
  desc: string;
  size: string;
  speedLabel: string;
  recommended: boolean;
  downloaded: boolean;
}

const TOP_LANGUAGES = [
  { id: "auto", label: "Auto-detect" },
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "de", label: "Deutsch" },
  { id: "it", label: "Italiano" },
  { id: "pt", label: "Português" },
  { id: "nl", label: "Nederlands" },
  { id: "ja", label: "日本語" },
  { id: "zh", label: "中文" },
  { id: "ko", label: "한국어" },
  { id: "ru", label: "Русский" },
  { id: "ar", label: "العربية" },
];

const ALL_LANGUAGES = [
  { id: "af", label: "Afrikaans" },
  { id: "am", label: "Amharic" },
  { id: "hy", label: "Armenian" },
  { id: "as", label: "Assamese" },
  { id: "az", label: "Azerbaijani" },
  { id: "ba", label: "Bashkir" },
  { id: "eu", label: "Basque" },
  { id: "be", label: "Belarusian" },
  { id: "bn", label: "Bengali" },
  { id: "bs", label: "Bosnian" },
  { id: "br", label: "Breton" },
  { id: "bg", label: "Bulgarian" },
  { id: "yue", label: "Cantonese" },
  { id: "ca", label: "Catalan" },
  { id: "hr", label: "Croatian" },
  { id: "cs", label: "Czech" },
  { id: "da", label: "Danish" },
  { id: "et", label: "Estonian" },
  { id: "fo", label: "Faroese" },
  { id: "fi", label: "Finnish" },
  { id: "gl", label: "Galician" },
  { id: "ka", label: "Georgian" },
  { id: "el", label: "Greek" },
  { id: "gu", label: "Gujarati" },
  { id: "ht", label: "Haitian Creole" },
  { id: "ha", label: "Hausa" },
  { id: "haw", label: "Hawaiian" },
  { id: "he", label: "Hebrew" },
  { id: "hi", label: "Hindi" },
  { id: "hu", label: "Hungarian" },
  { id: "is", label: "Icelandic" },
  { id: "id", label: "Indonesian" },
  { id: "jw", label: "Javanese" },
  { id: "kn", label: "Kannada" },
  { id: "kk", label: "Kazakh" },
  { id: "km", label: "Khmer" },
  { id: "la", label: "Latin" },
  { id: "lv", label: "Latvian" },
  { id: "ln", label: "Lingala" },
  { id: "lt", label: "Lithuanian" },
  { id: "lo", label: "Lao" },
  { id: "lb", label: "Luxembourgish" },
  { id: "mk", label: "Macedonian" },
  { id: "mg", label: "Malagasy" },
  { id: "ms", label: "Malay" },
  { id: "ml", label: "Malayalam" },
  { id: "mt", label: "Maltese" },
  { id: "mi", label: "Maori" },
  { id: "mr", label: "Marathi" },
  { id: "mn", label: "Mongolian" },
  { id: "my", label: "Myanmar" },
  { id: "ne", label: "Nepali" },
  { id: "no", label: "Norwegian" },
  { id: "nn", label: "Nynorsk" },
  { id: "oc", label: "Occitan" },
  { id: "ps", label: "Pashto" },
  { id: "fa", label: "Persian" },
  { id: "pl", label: "Polish" },
  { id: "pa", label: "Punjabi" },
  { id: "ro", label: "Romanian" },
  { id: "sa", label: "Sanskrit" },
  { id: "sr", label: "Serbian" },
  { id: "sn", label: "Shona" },
  { id: "sd", label: "Sindhi" },
  { id: "si", label: "Sinhala" },
  { id: "sk", label: "Slovak" },
  { id: "sl", label: "Slovenian" },
  { id: "so", label: "Somali" },
  { id: "su", label: "Sundanese" },
  { id: "sw", label: "Swahili" },
  { id: "sv", label: "Swedish" },
  { id: "tl", label: "Tagalog" },
  { id: "tg", label: "Tajik" },
  { id: "ta", label: "Tamil" },
  { id: "tt", label: "Tatar" },
  { id: "te", label: "Telugu" },
  { id: "th", label: "Thai" },
  { id: "bo", label: "Tibetan" },
  { id: "tr", label: "Turkish" },
  { id: "tk", label: "Turkmen" },
  { id: "uk", label: "Ukrainian" },
  { id: "ur", label: "Urdu" },
  { id: "uz", label: "Uzbek" },
  { id: "vi", label: "Vietnamese" },
  { id: "cy", label: "Welsh" },
  { id: "yi", label: "Yiddish" },
  { id: "yo", label: "Yoruba" },
  { id: "sq", label: "Albanian" },
];

type Section = "howto" | "general" | "language" | "transcription" | "microphone" | "model" | "history" | "about";

const NAV_ITEMS: { id: Section; label: string; icon: typeof Keyboard }[] = [
  { id: "howto", label: "Comment utiliser", icon: HelpCircle },
  { id: "general", label: "Général", icon: Keyboard },
  { id: "language", label: "Langue", icon: Globe },
  { id: "transcription", label: "Transcription", icon: Sparkles },
  { id: "microphone", label: "Microphone", icon: AudioLines },
  { id: "model", label: "Modèle", icon: Mic },
  { id: "history", label: "Historique", icon: Clock },
  { id: "about", label: "À propos", icon: Info },
];

export default function SettingsPanel({ onClose, onDeviceChange, onSilenceTimeoutChange }: { onClose: () => void; onDeviceChange?: (id: string) => void; onSilenceTimeoutChange?: (v: number) => void }) {
  const [section, setSection] = useState<Section>("general");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState(0);
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<{ status: string; version: string }>({ status: "up-to-date", version: "" });

  useEffect(() => {
    api?.getSettings().then((s) => setSettings(s as Settings));
    api?.listModels().then((m) => setModels(m as ModelInfo[]));
    api?.getAppStatus().then((s) => setAppVersion((s as any).version || ""));
    api?.getUpdateStatus().then(setUpdateStatus);
    const cleanup = api?.onUpdateStatus(setUpdateStatus);
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    const cleanup = api?.onModelProgress((data: ModelProgress) => {
      if (data.total > 0) setDownloadPct(Math.round((data.downloaded / data.total) * 100));
    });
    return () => cleanup?.();
  }, []);

  const update = (key: string, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    api?.setSetting(key, value);
    if (key === "inputDevice") onDeviceChange?.(value);
    if (key === "silenceTimeout") onSilenceTimeoutChange?.(value);
  };

  const handleModelSelect = async (id: string) => {
    const model = models.find((m) => m.id === id);
    if (!model) return;

    if (model.downloaded) {
      await api?.switchModel(id);
      setSettings((s) => s ? { ...s, model: id } : s);
    } else {
      setDownloading(id);
      setDownloadPct(0);
      const result = await api?.downloadModel(id);
      if (result?.success) {
        await api?.switchModel(id);
        setSettings((s) => s ? { ...s, model: id } : s);
        setModels((prev) => prev.map((m) => m.id === id ? { ...m, downloaded: true } : m));
      }
      setDownloading(null);
    }
  };

  if (!settings) return null;

  return (
    <div className="screen">
      {/* Header */}
      <div className="header drag-region">
        <span className="header-title no-drag">Paramètres</span>
        <button className="icon-btn no-drag" onClick={onClose}><X size={14} /></button>
      </div>

      {/* Sidebar + Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <nav style={{
          width: 200,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  background: active ? "hsla(217, 91%, 60%, 0.08)" : "transparent",
                  color: active ? "var(--blue)" : "var(--muted)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  width: "100%",
                  textAlign: "left",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--secondary)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon size={15} style={{ opacity: active ? 1 : 0.7 }} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="overflow-y-auto" style={{ flex: 1, padding: "28px 36px", display: "flex", flexDirection: "column", gap: 28 }}>
          {section === "howto" && (
            <HowToSection />
          )}
          {section === "general" && (
            <GeneralSection settings={settings} update={update} />
          )}
          {section === "language" && (
            <LanguageSection settings={settings} update={update} />
          )}
          {section === "transcription" && (
            <TranscriptionSection settings={settings} update={update} />
          )}
          {section === "microphone" && (
            <MicrophoneSection settings={settings} update={update} />
          )}
          {section === "model" && (
            <ModelSection
              settings={settings}
              models={models}
              downloading={downloading}
              downloadPct={downloadPct}
              onModelSelect={handleModelSelect}
            />
          )}
          {section === "history" && (
            <HistorySection />
          )}
          {section === "about" && (
            <AboutSection
              appVersion={appVersion}
              updateStatus={updateStatus}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 20px",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, color: "var(--muted)", opacity: 0.5 }}>
          CursorVoice {appVersion ? `v${appVersion}` : ""}
        </span>
        {updateStatus.status === "up-to-date" && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--green)", opacity: 0.8 }}>
            <span className="status-pulse green" />
            À jour
          </span>
        )}
        {updateStatus.status === "downloading" && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--blue)" }}>
            <span className="status-pulse blue" />
            Téléchargement v{updateStatus.version}
          </span>
        )}
        {updateStatus.status === "ready" && (
          <button
            onClick={() => api?.installUpdate()}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", fontSize: 11, fontWeight: 500,
              color: "var(--blue)", border: "1px solid hsla(217, 91%, 60%, 0.3)",
              borderRadius: 6, background: "hsla(217, 91%, 60%, 0.06)", cursor: "pointer",
            }}
          >
            <span className="status-pulse blue" />
            Installer v{updateStatus.version}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── How To Section ─── */
function HowToSection() {
  const STEPS = [
    {
      num: "1",
      title: "Appuyez sur le raccourci",
      desc: "Depuis n'importe quelle application",
      color: "var(--blue)",
      visual: (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {["Ctrl", "↓"].map((k, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {i > 0 && <span style={{ fontSize: 12, color: "var(--muted)", opacity: 0.4 }}>+</span>}
              <kbd>{k}</kbd>
            </span>
          ))}
        </div>
      ),
    },
    {
      num: "2",
      title: "Parlez",
      desc: "La bulle apparait, dictez votre texte",
      color: "var(--red)",
      visual: <BubblePreview />,
    },
    {
      num: "3",
      title: "Le texte apparait",
      desc: "Colle automatiquement a votre curseur",
      color: "var(--green)",
      visual: (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 8,
          background: "hsla(142, 76%, 36%, 0.08)",
          border: "1px solid hsla(142, 76%, 36%, 0.15)",
        }}>
          <Check size={14} style={{ color: "var(--green)" }} />
          <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 500 }}>Colle</span>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="section-title">Comment ca marche</div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>
        3 etapes. Aucun compte. Aucune connexion internet.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {STEPS.map((step, i) => (
          <div key={i} style={{
            padding: "18px 20px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 20,
          }}>
            {/* Step number */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `color-mix(in srgb, ${step.color} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${step.color} 20%, transparent)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, color: step.color,
            }}>
              {step.num}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{step.desc}</div>
            </div>

            {/* Visual */}
            <div style={{ flexShrink: 0 }}>
              {step.visual}
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div style={{ marginTop: 24 }}>
        <div className="section-title">Astuces</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { icon: MousePointerClick, text: "Glissez la bulle pour la repositionner" },
            { icon: Keyboard, text: "Appuyez sur Echap pour annuler un enregistrement" },
            { icon: Sparkles, text: "Ajoutez un prompt initial pour ameliorer la precision" },
            { icon: Clock, text: "Retrouvez vos transcriptions dans l'onglet Historique" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}>
              <Icon size={14} style={{ color: "var(--muted)", flexShrink: 0, opacity: 0.6 }} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── General Section ─── */
function useAudioDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    async function load() {
      try {
        // Request permission first so labels are available
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "audioinput"));
      } catch {
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "audioinput"));
      }
    }
    load();
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => navigator.mediaDevices.removeEventListener("devicechange", load);
  }, []);

  return devices;
}

function GeneralSection({ settings, update }: { settings: Settings; update: (key: string, value: any) => void }) {
  return (
    <>
      <div>
        <div className="section-title">Raccourci clavier</div>
        <HotkeyInput value={settings.hotkey} onChange={(v) => update("hotkey", v)} />
      </div>

      <div>
        <div className="section-title">Mode d'enregistrement</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="card-row">
            <div>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Push-to-talk</span>
              <div style={{ fontSize: 11, color: "var(--muted)", opacity: 0.6, marginTop: 2 }}>
                Maintenir le raccourci pour enregistrer, relâcher pour transcrire
              </div>
            </div>
            <button
              className={`toggle ${settings.pushToTalk ? "on" : ""}`}
              onClick={() => update("pushToTalk", !settings.pushToTalk)}
            >
              <div className="toggle-knob" />
            </button>
          </div>
          <SilenceDropdown value={settings.silenceTimeout || 0} onChange={(v) => update("silenceTimeout", v)} />
        </div>
      </div>

      <div>
        <div className="section-title">Système</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="card-row">
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Lancer au démarrage</span>
            <button
              className={`toggle ${settings.launchAtStartup ? "on" : ""}`}
              onClick={() => update("launchAtStartup", !settings.launchAtStartup)}
            >
              <div className="toggle-knob" />
            </button>
          </div>
          <div style={{
            padding: "14px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Position de la bulle</span>
                <div style={{ fontSize: 11, color: "var(--muted)", opacity: 0.6, marginTop: 2 }}>
                  Glissez la bulle pour la déplacer. Elle se souviendra de sa position.
                </div>
              </div>
              <button
                onClick={() => update("windowPosition", null)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", fontSize: 11, fontWeight: 500,
                  color: "var(--muted)", border: "1px solid var(--border)",
                  borderRadius: 6, background: "transparent", cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <RotateCcw size={11} /> Recentrer
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <BubblePreview />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Language Section ─── */
function LanguageSection({ settings, update }: { settings: Settings; update: (key: string, value: any) => void }) {
  const [langSearch, setLangSearch] = useState("");
  const [showAllLangs, setShowAllLangs] = useState(false);

  const currentLang = [...TOP_LANGUAGES, ...ALL_LANGUAGES].find((l) => l.id === settings.language);
  const isTopLang = TOP_LANGUAGES.some((l) => l.id === settings.language);

  const filteredLangs = useMemo(() => {
    if (!langSearch.trim()) return ALL_LANGUAGES;
    const q = langSearch.toLowerCase();
    return ALL_LANGUAGES.filter((l) =>
      l.label.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    );
  }, [langSearch]);

  return (
    <div>
      <div className="section-title">Langue de transcription</div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Sélectionnez la langue que vous parlez pour la dictée.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {TOP_LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            className={`chip ${settings.language === lang.id ? "active" : ""}`}
            onClick={() => { update("language", lang.id); setShowAllLangs(false); }}
          >
            {lang.label}
          </button>
        ))}
        <button
          className={`chip ${!isTopLang && settings.language !== "auto" ? "active" : ""}`}
          onClick={() => setShowAllLangs(!showAllLangs)}
          style={{ gap: 4 }}
        >
          {!isTopLang && currentLang ? currentLang.label : "Autres..."}
        </button>
      </div>

      {showAllLangs && (
        <div style={{
          marginTop: 8,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderBottom: "1px solid var(--border)",
          }}>
            <Search size={13} style={{ color: "var(--muted)", flexShrink: 0 }} />
            <input
              type="text"
              value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              placeholder="Rechercher..."
              autoFocus
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--fg)",
                fontSize: 13,
              }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", padding: 4 }}>
            {filteredLangs.map((lang) => (
              <button
                key={lang.id}
                onClick={() => { update("language", lang.id); setShowAllLangs(false); setLangSearch(""); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: settings.language === lang.id ? "hsla(217, 91%, 60%, 0.08)" : "transparent",
                  color: settings.language === lang.id ? "var(--blue)" : "var(--fg)",
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "background 0.1s",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (settings.language !== lang.id) e.currentTarget.style.background = "var(--secondary)";
                }}
                onMouseLeave={(e) => {
                  if (settings.language !== lang.id) e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{lang.label}</span>
                <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{lang.id}</span>
              </button>
            ))}
            {filteredLangs.length === 0 && (
              <div style={{ padding: "12px 10px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                Aucune langue trouvée
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Transcription Section ─── */
function TranscriptionSection({ settings, update }: { settings: Settings; update: (key: string, value: any) => void }) {
  return (
    <>
      <div>
        <div className="section-title">Traduction automatique</div>
        <div className="card-row">
          <div>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Traduire en anglais</span>
            <div style={{ fontSize: 11, color: "var(--muted)", opacity: 0.6, marginTop: 2 }}>
              Parlez dans votre langue, le texte sera automatiquement traduit en anglais
            </div>
          </div>
          <button
            className={`toggle ${settings.translateMode ? "on" : ""}`}
            onClick={() => update("translateMode", !settings.translateMode)}
          >
            <div className="toggle-knob" />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", opacity: 0.5, marginTop: 8 }}>
          Seule la traduction vers l'anglais est disponible pour le moment.
        </p>
      </div>

      <div>
        <div className="section-title">Prompt initial</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
          Donnez du contexte à l'IA pour améliorer la précision : noms propres, jargon technique, style de ponctuation.
        </p>
        <textarea
          value={settings.initialPrompt || ""}
          onChange={(e) => update("initialPrompt", e.target.value)}
          placeholder="Ex: Vocabulaire technique, noms de projets, acronymes fréquents..."
          rows={3}
          style={{
            width: "100%",
            background: "var(--secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--fg)",
            fontSize: 13,
            padding: "10px 12px",
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
            boxSizing: "border-box",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />
      </div>
    </>
  );
}

/* ─── Microphone Section ─── */
function MicrophoneSection({ settings, update }: { settings: Settings; update: (key: string, value: any) => void }) {
  const audioDevices = useAudioDevices();

  return (
    <div>
      <div className="section-title">Périphérique d'entrée</div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Sélectionnez le microphone utilisé pour la dictée vocale.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          className={`select-btn ${settings.inputDevice === "default" ? "active" : ""}`}
          onClick={() => update("inputDevice", "default")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <AudioLines size={13} style={{ flexShrink: 0, color: settings.inputDevice === "default" ? "var(--blue)" : "var(--muted)" }} />
            <span style={{ fontSize: 13, color: settings.inputDevice === "default" ? "var(--blue)" : "var(--fg)" }}>
              Par défaut (système)
            </span>
          </div>
          {settings.inputDevice === "default" && <Check size={12} style={{ color: "var(--green)", flexShrink: 0 }} />}
        </button>

        {audioDevices.filter((d) => d.deviceId !== "default").map((device) => {
          const active = settings.inputDevice === device.deviceId;
          return (
            <button
              key={device.deviceId}
              className={`select-btn ${active ? "active" : ""}`}
              onClick={() => update("inputDevice", device.deviceId)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Mic size={13} style={{ flexShrink: 0, color: active ? "var(--blue)" : "var(--muted)" }} />
                <span style={{
                  fontSize: 13,
                  color: active ? "var(--blue)" : "var(--fg)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {device.label || `Micro ${device.deviceId.slice(0, 8)}`}
                </span>
              </div>
              {active && <Check size={12} style={{ color: "var(--green)", flexShrink: 0 }} />}
            </button>
          );
        })}

        {audioDevices.length === 0 && (
          <div style={{ padding: "16px 12px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            Aucun microphone détecté
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Model Section ─── */
function ModelSection({
  settings,
  models,
  downloading,
  downloadPct,
  onModelSelect,
}: {
  settings: Settings;
  models: ModelInfo[];
  downloading: string | null;
  downloadPct: number;
  onModelSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="section-title">Modèle de reconnaissance vocale</div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Le modèle est téléchargé une fois et fonctionne 100% hors-ligne.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {models.map((m) => {
          const active = settings.model === m.id;
          const isDownloading = downloading === m.id;

          return (
            <button
              key={m.id}
              className={`select-btn ${active ? "active" : ""}`}
              onClick={() => !isDownloading && onModelSelect(m.id)}
              style={{ opacity: isDownloading ? 0.7 : 1, cursor: isDownloading ? "wait" : "pointer" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--blue)" : "var(--fg)" }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.size}</span>
                  {m.downloaded && active && <Check size={12} style={{ color: "var(--green)" }} />}
                </div>
                {isDownloading && (
                  <div style={{ height: 3, borderRadius: 2, background: "var(--border)", marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${downloadPct}%`, background: "var(--blue)", borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.speedLabel}</span>
                {!m.downloaded && !isDownloading && <Download size={12} style={{ color: "var(--muted)" }} />}
                {isDownloading && <Loader2 size={12} style={{ color: "var(--blue)", animation: "spin 1s linear infinite" }} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── History Section ─── */
function HistorySection() {
  const [entries, setEntries] = useState<{ text: string; date: string }[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    api?.getHistory().then(setEntries);
  }, []);

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  const clearAll = () => {
    api?.clearHistory();
    setEntries([]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 0 }}>Dernières transcriptions</div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{entries.length} entrée{entries.length !== 1 ? "s" : ""}</span>
        </div>
        {entries.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", fontSize: 11,
              color: "var(--red)", border: "1px solid hsla(0, 84%, 60%, 0.2)",
              borderRadius: 6, background: "transparent", cursor: "pointer",
            }}
          >
            <Trash2 size={11} /> Effacer tout
          </button>
        )}
      </div>

      {/* Privacy badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", marginBottom: 16,
        borderRadius: "var(--radius)",
        background: "hsla(142, 76%, 36%, 0.06)",
        border: "1px solid hsla(142, 76%, 36%, 0.12)",
      }}>
        <ShieldCheck size={14} style={{ color: "var(--green)", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
          Stocké uniquement sur votre machine. Aucune donnée n'est envoyée.
        </span>
      </div>

      {entries.length === 0 && (
        <div style={{
          padding: "40px 20px",
          textAlign: "center",
          color: "var(--muted)",
          opacity: 0.5,
          fontSize: 13,
        }}>
          Aucune transcription pour le moment.
          <br />
          <span style={{ fontSize: 11 }}>Vos dictées apparaîtront ici.</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {entries.map((entry, i) => (
          <div
            key={i}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13,
                color: "var(--fg)",
                margin: 0,
                lineHeight: 1.5,
                wordBreak: "break-word",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {entry.text}
              </p>
              <span style={{ fontSize: 10, color: "var(--muted)", opacity: 0.6, marginTop: 4, display: "block" }}>
                {formatDate(entry.date)}
              </span>
            </div>
            <button
              onClick={() => copyText(entry.text, i)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                border: "1px solid var(--border)", background: "transparent",
                color: copied === i ? "var(--green)" : "var(--muted)",
                cursor: "pointer", transition: "all 0.15s",
              }}
              title="Copier"
            >
              {copied === i ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── About Section ─── */
function AboutSection({
  appVersion,
  updateStatus,
}: {
  appVersion: string;
  updateStatus: { status: string; version: string };
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsla(217, 91%, 60%, 0.1)",
          border: "1px solid hsla(217, 91%, 60%, 0.15)",
          margin: "0 auto 12px",
        }}>
          <Mic size={22} style={{ color: "var(--blue)" }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>CursorVoice</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          {appVersion ? `Version ${appVersion}` : ""}
        </div>
      </div>

      {/* Storytelling */}
      <div style={{
        padding: "16px 20px",
        borderRadius: "var(--radius)",
        background: "hsla(217, 91%, 60%, 0.04)",
        border: "1px solid hsla(217, 91%, 60%, 0.08)",
        lineHeight: 1.7,
      }}>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          On passait plus de temps à taper qu'à penser.
        </p>
        <p style={{ fontSize: 12, color: "var(--fg)", margin: "8px 0 0", fontWeight: 500 }}>
          CursorVoice est né d'une frustration simple : pourquoi nos idées doivent-elles attendre
          que nos doigts les rattrapent ?
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0" }}>
          Un raccourci. Vous parlez. Le texte apparaît là où clignote votre curseur.
          Pas de cloud, pas de compte, pas de latence. Juste votre voix et une IA
          qui tourne sur votre machine.
        </p>
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "12px 0 0", opacity: 0.6, fontStyle: "italic" }}>
          Open-source. Offline. Gratuit. Pour toujours.
        </p>
      </div>

      {/* Info rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="card-row">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Mise à jour</span>
          {updateStatus.status === "up-to-date" && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--green)" }}>
              <span className="status-pulse green" /> À jour
            </span>
          )}
          {updateStatus.status === "downloading" && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--blue)" }}>
              <span className="status-pulse blue" /> v{updateStatus.version}
            </span>
          )}
          {updateStatus.status === "ready" && (
            <button
              onClick={() => api?.installUpdate()}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", fontSize: 11, fontWeight: 500,
                color: "var(--blue)", border: "1px solid hsla(217, 91%, 60%, 0.3)",
                borderRadius: 6, background: "hsla(217, 91%, 60%, 0.06)", cursor: "pointer",
              }}
            >
              <span className="status-pulse blue" /> Installer v{updateStatus.version}
            </button>
          )}
        </div>
        <div className="card-row">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Licence</span>
          <span style={{ fontSize: 12, color: "var(--fg)" }}>AGPL-3.0</span>
        </div>
        <div className="card-row">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Moteur</span>
          <span style={{ fontSize: 12, color: "var(--fg)" }}>IA locale (offline)</span>
        </div>
        <div className="card-row">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Données envoyées</span>
          <span style={{ fontSize: 12, color: "var(--green)" }}>Aucune</span>
        </div>
      </div>
    </div>
  );
}


/* ─── Silence Dropdown ─── */
const SILENCE_OPTIONS = [
  { value: 0, label: "Désactivé" },
  { value: 3, label: "3 secondes" },
  { value: 5, label: "5 secondes" },
  { value: 8, label: "8 secondes" },
  { value: 10, label: "10 secondes" },
  { value: 15, label: "15 secondes" },
];

function SilenceDropdown({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SILENCE_OPTIONS.find((o) => o.value === value) || SILENCE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="card-row">
      <div>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Auto-stop après silence</span>
        <div style={{ fontSize: 11, color: "var(--muted)", opacity: 0.6, marginTop: 2 }}>
          Arrête automatiquement après un silence prolongé
        </div>
      </div>
      <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px",
            background: "var(--secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: value > 0 ? "var(--blue)" : "var(--muted)",
            fontSize: 12, fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {current.label}
          <ChevronDown size={11} style={{ opacity: 0.5, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
        </button>
        {open && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 140,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 4,
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            {SILENCE_OPTIONS.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "7px 10px",
                    borderRadius: 6, border: "none",
                    background: active ? "hsla(217, 91%, 60%, 0.08)" : "transparent",
                    color: active ? "var(--blue)" : "var(--fg)",
                    fontSize: 12, cursor: "pointer",
                    transition: "background 0.1s", textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--secondary)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  {opt.label}
                  {active && <Check size={11} style={{ color: "var(--green)" }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Hotkey Input ─── */
// Map browser KeyboardEvent.key (uppercased) → Electron accelerator name
const KEY_MAP: Record<string, string> = {
  // Arrows
  ARROWUP: "Up", ARROWDOWN: "Down", ARROWLEFT: "Left", ARROWRIGHT: "Right",
  // Whitespace / editing
  " ": "Space", ENTER: "Return", ESCAPE: "Escape", BACKSPACE: "Backspace",
  DELETE: "Delete", TAB: "Tab", INSERT: "Insert",
  // Navigation
  HOME: "Home", END: "End", PAGEUP: "PageUp", PAGEDOWN: "PageDown",
  // Locks
  CAPSLOCK: "Capslock", NUMLOCK: "Numlock", SCROLLLOCK: "Scrolllock",
  // Media
  AUDIOVOLUMEUP: "VolumeUp", AUDIOVOLUMEDOWN: "VolumeDown", AUDIOVOLUMEMUTE: "VolumeMute",
  MEDIATRACKNEXT: "MediaNextTrack", MEDIATRACKPREVIOUS: "MediaPreviousTrack",
  MEDIASTOP: "MediaStop", MEDIAPLAYPAUSE: "MediaPlayPause",
  PRINTSCREEN: "PrintScreen",
};

// Display-friendly labels for the UI
const DISPLAY_MAP: Record<string, string> = {
  CommandOrControl: "Ctrl", Shift: "Maj", Alt: "Alt",
  Up: "↑", Down: "↓", Left: "←", Right: "→",
  Space: "Espace", Return: "Entrée", Escape: "Échap", Backspace: "⌫",
  Delete: "Suppr", Tab: "Tab", Insert: "Inser",
  PageUp: "Page↑", PageDown: "Page↓",
  Capslock: "Verr.Maj", Numlock: "Verr.Num",
  VolumeUp: "Vol+", VolumeDown: "Vol-", VolumeMute: "Muet",
};

function resolveKey(e: KeyboardEvent): string {
  const raw = e.key.toUpperCase();
  if (e.location === 3 && raw >= "0" && raw <= "9") return "num" + raw;
  if (e.location === 3 && raw === "+") return "numadd";
  if (e.location === 3 && raw === "-") return "numsub";
  if (e.location === 3 && raw === "*") return "nummult";
  if (e.location === 3 && raw === "/") return "numdiv";
  if (e.location === 3 && raw === ".") return "numdec";
  return KEY_MAP[raw] || KEY_MAP[e.key] || raw;
}

function KeyDisplay({ parts }: { parts: string[] }) {
  const displayed = parts.map((p) => DISPLAY_MAP[p] || p);
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {displayed.map((key, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ fontSize: 11, color: "var(--muted)", opacity: 0.4 }}>+</span>}
          <kbd>{key}</kbd>
        </span>
      ))}
    </span>
  );
}

function HotkeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [listening, setListening] = useState(false);
  const [liveParts, setLiveParts] = useState<string[]>([]);

  useEffect(() => {
    if (!listening) return;

    const onDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const mods: string[] = [];
      if (e.ctrlKey || e.metaKey) mods.push("CommandOrControl");
      if (e.shiftKey) mods.push("Shift");
      if (e.altKey) mods.push("Alt");

      const raw = e.key.toUpperCase();
      const isModifier = ["CONTROL", "SHIFT", "ALT", "META"].includes(raw);

      if (isModifier) {
        setLiveParts(mods);
        return;
      }

      if (mods.length === 0) return;

      const key = resolveKey(e);
      const final = [...mods, key];
      onChange(final.join("+"));
      setListening(false);
      setLiveParts([]);
    };

    const onUp = (e: KeyboardEvent) => {
      e.preventDefault();
      const mods: string[] = [];
      if (e.ctrlKey || e.metaKey) mods.push("CommandOrControl");
      if (e.shiftKey) mods.push("Shift");
      if (e.altKey) mods.push("Alt");
      setLiveParts(mods);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [listening, onChange]);

  const savedParts = value.split("+");

  return (
    <button
      className={`select-btn ${listening ? "active" : ""}`}
      onClick={() => { setListening(true); setLiveParts([]); }}
      style={{ ...(listening ? { boxShadow: "0 0 0 2px hsla(217, 91%, 60%, 0.15)" } : {}) }}
    >
      {listening ? (
        liveParts.length > 0 ? (
          <KeyDisplay parts={liveParts} />
        ) : (
          <span style={{ color: "var(--blue)", fontSize: 13 }}>Appuyez sur votre raccourci...</span>
        )
      ) : (
        <KeyDisplay parts={savedParts} />
      )}
    </button>
  );
}
