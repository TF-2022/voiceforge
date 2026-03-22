export interface AppStatus {
  hasModel: boolean;
  hasWhisper: boolean;
  hasFfmpeg: boolean;
  platform: string;
}

export interface PipelineResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface ModelProgress {
  name: string;
  downloaded: number;
  total: number;
}

export interface ElectronAPI {
  sendAudio: (buffer: ArrayBuffer) => Promise<PipelineResult>;
  notifyStop: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  getSettings: () => Promise<Record<string, unknown>>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  getAppStatus: () => Promise<AppStatus>;
  listModels: () => Promise<unknown[]>;
  downloadModel: (name: string) => Promise<{ success: boolean; error?: string }>;
  switchModel: (name: string) => Promise<{ success: boolean; error?: string }>;
  getUpdateStatus: () => Promise<{ status: string; version: string }>;
  getHistory: () => Promise<{ text: string; date: string }[]>;
  clearHistory: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateStatus: (cb: (data: { status: string; version: string }) => void) => () => void;
  resizeWindow: (width: number, height: number) => Promise<void>;
  centerWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  onStartRecording: (cb: () => void) => () => void;
  onStopRecording: (cb: () => void) => () => void;
  onStatusUpdate: (cb: (status: string) => void) => () => void;
  onShowSettings: (cb: () => void) => () => void;
  onShowOnboarding: (cb: () => void) => () => void;
  onModelProgress: (cb: (data: ModelProgress) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export const api: ElectronAPI | null =
  typeof window !== "undefined" && window.electronAPI ? window.electronAPI : null;
