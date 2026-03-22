import Store from "electron-store";

export type WhisperModel = "tiny" | "base" | "small" | "medium" | "large-v3-turbo";

export interface AppConfig {
  hotkey: string;
  model: WhisperModel;
  language: string;
  inputDevice: string;
  launchAtStartup: boolean;
  pasteMethod: "clipboard" | "keystroke";
  windowPosition: { x: number; y: number } | null;
  onboardingDone: boolean;
}

const DEFAULTS: AppConfig = {
  hotkey: "CommandOrControl+Shift+H",
  model: "base",
  language: "fr",
  inputDevice: "default",
  launchAtStartup: true,
  pasteMethod: "clipboard",
  windowPosition: null,
  onboardingDone: false,
};

export const config = new Store<AppConfig>({ defaults: DEFAULTS });

// Migration: enable auto-start for users upgrading to v1.0.0
if (!config.get("_migrated_v100" as any)) {
  config.set("launchAtStartup", true);
  config.set("_migrated_v100" as any, true);
}

export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return config.get(key);
}
