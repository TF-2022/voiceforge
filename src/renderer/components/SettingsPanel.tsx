import { useState, useEffect, useMemo } from "react";
import { X, RotateCcw, Download, Check, Loader2, Keyboard, Mic, Info, Search } from "lucide-react";
import { api, ModelProgress } from "../lib/ipc";

interface Settings {
  hotkey: string;
  model: string;
  language: string;
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

type Section = "general" | "model" | "about";

const NAV_ITEMS: { id: Section; label: string; icon: typeof Keyboard }[] = [
  { id: "general", label: "Général", icon: Keyboard },
  { id: "model", label: "Modèle", icon: Mic },
  { id: "about", label: "À propos", icon: Info },
];

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
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
          width: 170,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          padding: "16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
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
                  padding: "10px 12px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  background: active ? "hsla(217, 91%, 60%, 0.08)" : "transparent",
                  color: active ? "var(--blue)" : "var(--muted)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  width: "100%",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--secondary)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="overflow-y-auto" style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
          {section === "general" && (
            <GeneralSection settings={settings} update={update} />
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
        padding: "8px 16px",
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
          <span style={{ fontSize: 10, color: "var(--green)", opacity: 0.7 }}>✓ À jour</span>
        )}
        {updateStatus.status === "downloading" && (
          <span style={{ fontSize: 10, color: "var(--blue)" }}>↓ v{updateStatus.version}...</span>
        )}
        {updateStatus.status === "ready" && (
          <button
            className="select-btn"
            onClick={() => api?.installUpdate()}
            style={{ padding: "4px 10px", fontSize: 10, color: "var(--blue)", border: "1px solid var(--blue)", borderRadius: 6, background: "transparent", cursor: "pointer" }}
          >
            Installer v{updateStatus.version}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── General Section ─── */
function GeneralSection({ settings, update }: { settings: Settings; update: (key: string, value: any) => void }) {
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
    <>
      <div>
        <div className="section-title">Raccourci clavier</div>
        <HotkeyInput value={settings.hotkey} onChange={(v) => update("hotkey", v)} />
      </div>

      <div>
        <div className="section-title">Langue de transcription</div>
        {/* Top languages as chips */}
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

        {/* Expandable full language list */}
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
            <div style={{ maxHeight: 180, overflowY: "auto", padding: 4 }}>
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
          <button className="select-btn" onClick={() => update("windowPosition", null)}>
            <span style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
              <RotateCcw size={14} /> Réinitialiser la position
            </span>
          </button>
        </div>
      </div>
    </>
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
      <div className="section-title">Modèle Whisper</div>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="card-row">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Mise à jour</span>
          {updateStatus.status === "up-to-date" && (
            <span style={{ fontSize: 12, color: "var(--green)" }}>✓ À jour</span>
          )}
          {updateStatus.status === "downloading" && (
            <span style={{ fontSize: 12, color: "var(--blue)" }}>↓ v{updateStatus.version}...</span>
          )}
          {updateStatus.status === "ready" && (
            <button
              className="select-btn"
              onClick={() => api?.installUpdate()}
              style={{ padding: "4px 10px", fontSize: 11, color: "var(--blue)", border: "1px solid var(--blue)", borderRadius: 6, background: "transparent", cursor: "pointer", width: "auto" }}
            >
              Installer v{updateStatus.version}
            </button>
          )}
        </div>
        <div className="card-row">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Licence</span>
          <span style={{ fontSize: 12, color: "var(--fg)" }}>AGPL-3.0</span>
        </div>
        <div className="card-row">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Moteur</span>
          <span style={{ fontSize: 12, color: "var(--fg)" }}>Whisper AI</span>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--muted)", opacity: 0.6, textAlign: "center", lineHeight: 1.6 }}>
        Open-source voice dictation.
        <br />
        100% offline, privacy-first.
      </p>
    </div>
  );
}

/* ─── Hotkey Input ─── */
function HotkeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [listening, setListening] = useState(false);
  const display = value.replace("CommandOrControl", "Ctrl").replace("Shift", "Maj");

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      const key = e.key.toUpperCase();
      if (!["CONTROL", "SHIFT", "ALT", "META"].includes(key) && parts.length > 0) {
        parts.push(key);
        onChange(parts.join("+"));
        setListening(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [listening, onChange]);

  return (
    <button
      className={`select-btn ${listening ? "active" : ""}`}
      onClick={() => setListening(true)}
      style={{ fontFamily: "monospace", ...(listening ? { boxShadow: "0 0 0 2px hsla(217, 91%, 60%, 0.15)" } : {}) }}
    >
      <span style={{ color: listening ? "var(--blue)" : "var(--muted)" }}>
        {listening ? "Appuyez sur votre raccourci..." : display}
      </span>
    </button>
  );
}
