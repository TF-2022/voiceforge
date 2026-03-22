process.noDeprecation = true;
import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Notification } from "electron";
import { appendFileSync } from "node:fs";

const LOG_PATH = require("path").join(app.getPath("userData"), "cursorvoice.log");
const MAX_LOG_SIZE = 500 * 1024; // 500KB max

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    // Rotate: if log > 500KB, keep last half
    const stats = fs.statSync(LOG_PATH).size;
    if (stats > MAX_LOG_SIZE) {
      const content = fs.readFileSync(LOG_PATH, "utf8");
      fs.writeFileSync(LOG_PATH, content.slice(content.length / 2));
    }
  } catch {}
  try { appendFileSync(LOG_PATH, line); } catch {}
  console.log(msg);
}

// Prevent GPU cache errors on Windows (single instance lock)
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on("second-instance", () => {
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    if (!recordingWindow.isVisible()) recordingWindow.show();
    recordingWindow.focus();
  }
});
app.commandLine.appendSwitch("disable-gpu-cache");
import path from "node:path";
import fs from "node:fs";
import { autoUpdater } from "electron-updater";
import { setupTray } from "./tray";
import { getConfig, config } from "./config";
import { convertToWav } from "./audio-converter";
import { transcribe, startWhisperServer, stopWhisperServer, restartWithModel } from "./transcriber";
import { injectText } from "./injector";
import { MODELS, getActiveModelPath, isAnyModelDownloaded, isModelDownloaded, downloadModel } from "./model-manager";
import { getWhisperPath, getWhisperServerPath, getFfmpegPath } from "./bin-resolver";

let recordingWindow: BrowserWindow | null = null;
let isRecording = false;
let isQuitting = false;

// Safe IPC send - won't crash if window is destroyed
function send(channel: string, ...args: any[]) {
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.webContents.send(channel, ...args);
  }
}

function createRecordingWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 260,
    height: 72,
    useContentSize: true, // Size = content area, not window frame
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");

  // Prevent DPI scaling from clipping content on Windows (e.g. 125% DPI)
  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(1);
  });

  // Dev mode: open DevTools + Ctrl+Shift+I toggle
  if (process.env.ELECTRON_RENDERER_URL) {
    win.webContents.on("before-input-event", (event, input) => {
      if (input.control && input.shift && input.key === "I") {
        win.webContents.toggleDevTools();
      }
    });
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Hide instead of destroy when user closes window
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // Save position when dragged
  win.on("moved", () => {
    const [x, y] = win.getPosition();
    config.set("windowPosition", { x, y });
  });

  return win;
}

function registerStopShortcuts() {
  try {
    globalShortcut.register("Escape", stopRecording);
  } catch {}
}

function unregisterStopShortcuts() {
  try {
    globalShortcut.unregister("Escape");
  } catch {}
}

function startRecording() {
  if (isRecording) return;
  if (!recordingWindow || recordingWindow.isDestroyed()) {
    recordingWindow = createRecordingWindow();
  }

  isRecording = true;
  recordingWindow.setContentSize(260, 72);
  const savedPos = getConfig("windowPosition");
  if (savedPos) {
    recordingWindow.setPosition(savedPos.x, savedPos.y);
  } else {
    const { width: screenW, height: screenH } = require("electron").screen.getPrimaryDisplay().workAreaSize;
    recordingWindow.setPosition(Math.round((screenW - 260) / 2), screenH - 100);
  }
  recordingWindow.showInactive();
  send("recording:start");
  registerStopShortcuts();
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  unregisterStopShortcuts();
  send("recording:stop");
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

app.whenReady().then(async () => {
  // Hide dock icon on macOS
  if (process.platform === "darwin") {
    app.dock?.hide();
  }

  // Create recording window
  recordingWindow = createRecordingWindow();


  // Setup system tray
  setupTray(app, toggleRecording, () => {
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      // Send settings IPC BEFORE showing to avoid pill flash
      send("show:settings");
      setTimeout(() => {
        if (recordingWindow && !recordingWindow.isDestroyed()) {
          recordingWindow.setFocusable(true);
          recordingWindow.setContentSize(820, 620);
          recordingWindow.center();
          recordingWindow.show();
          recordingWindow.focus();
        }
      }, 50);
    }
  });

  // Sync auto-start with OS login items
  app.setLoginItemSettings({
    openAtLogin: getConfig("launchAtStartup"),
    openAsHidden: true,
  });

  // Register global hotkey
  globalShortcut.unregisterAll();
  const hotkey = getConfig("hotkey");
  const success = globalShortcut.register(hotkey, toggleRecording);

  // IPC Handlers (register BEFORE server start so they're ready immediately)
  ipcMain.handle("audio:process", async (_event, buffer: ArrayBuffer) => {
    if (!buffer || buffer.byteLength === 0) {
      send("status:update", "empty");
      return { success: false, error: "Empty audio" };
    }
    if (buffer.byteLength > 50 * 1024 * 1024) {
      send("status:update", "error");
      return { success: false, error: "Audio too large" };
    }

    const pipelineStart = Date.now();

    function hideIfNotRecording(delay = 0) {
      const doHide = () => {
        if (!isRecording && recordingWindow && !recordingWindow.isDestroyed()) {
          recordingWindow.hide();
        }
      };
      if (delay > 0) setTimeout(doHide, delay);
      else doHide();
    }

    try {
      send("status:update", "transcribing");

      const tempDir = app.getPath("temp");
      const ts = Date.now();
      const webmPath = path.join(tempDir, `vf-${ts}.webm`);
      fs.writeFileSync(webmPath, Buffer.from(buffer));

      const wavPath = path.join(tempDir, `vf-${ts}.wav`);
      const t1 = Date.now();
      await convertToWav(webmPath, wavPath);
      console.log(`[pipeline] ffmpeg: ${Date.now() - t1}ms`);

      const modelPath = getActiveModelPath();
      if (!fs.existsSync(modelPath)) {
        throw new Error(`No model found at ${modelPath}. Download a model first.`);
      }
      const text = await transcribe({
        wavPath,
        modelPath,
        language: getConfig("language"),
      });

      try { fs.unlinkSync(webmPath); fs.unlinkSync(wavPath); } catch {}

      const totalMs = Date.now() - pipelineStart;

      if (!text?.trim()) {
        send("status:update", "empty");
        hideIfNotRecording(1200);
        return { success: true, text: "" };
      }

      // Hide + inject
      hideIfNotRecording();
      await new Promise((r) => setTimeout(r, 100));
      await injectText(text.trim());

      return { success: true, text: text.trim() };
    } catch (err: any) {
      log("[pipeline] Error: " + err.message + "\n" + err.stack);
      send("status:update", "error");
      hideIfNotRecording(2000);
      return { success: false, error: err.message };
    }
  });

  // User stopped recording from renderer (Space/Escape/button)
  ipcMain.handle("recording:user-stop", () => {
    isRecording = false;
    unregisterStopShortcuts();
  });

  ipcMain.handle("onboarding:complete", () => {
    config.set("onboardingDone", true);
  });

  ipcMain.handle("settings:get", () => config.store);
  const ALLOWED_SETTINGS = ["hotkey", "model", "language", "launchAtStartup", "pasteMethod", "windowPosition", "inputDevice", "onboardingDone"];
  ipcMain.handle("settings:set", (_event, key: string, value: any) => {
    if (!ALLOWED_SETTINGS.includes(key)) return;
    config.set(key as any, value);
    if (key === "hotkey") {
      globalShortcut.unregisterAll();
      globalShortcut.register(value, toggleRecording);
    }
    if (key === "launchAtStartup") {
      app.setLoginItemSettings({ openAtLogin: value as boolean, openAsHidden: true });
    }
  });

  ipcMain.handle("window:resize", (_event, width: number, height: number) => {
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      recordingWindow.setContentSize(width, height);
    }
  });

  ipcMain.handle("window:center", () => {
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      recordingWindow.center();
    }
  });

  ipcMain.handle("window:hide", () => {
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      recordingWindow.hide();
      recordingWindow.setFocusable(false);
    }
  });

  ipcMain.handle("app:status", () => ({
    hasModel: isAnyModelDownloaded(),
    hasWhisper: fs.existsSync(getWhisperPath()),
    hasFfmpeg: fs.existsSync(getFfmpegPath()),
    platform: process.platform,
    version: app.getVersion(),
    onboardingDone: getConfig("onboardingDone"),
  }));

  ipcMain.handle("model:list", () => {
    return Object.entries(MODELS).map(([id, info]: [string, any]) => ({
      id,
      ...info,
      downloaded: isModelDownloaded(id as any),
    }));
  });

  ipcMain.handle("model:download", async (_event, name: string) => {
    try {
      let lastUpdate = 0;
      await downloadModel(name as any, (downloaded: number, total: number) => {
        const now = Date.now();
        if (now - lastUpdate > 200 || downloaded >= total) {
          lastUpdate = now;
          send("model:progress", { name, downloaded, total });
        }
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("model:switch", async (_event, name: string) => {
    config.set("model", name as any);
    const modelPath = getActiveModelPath();
    if (fs.existsSync(modelPath)) {
      restartWithModel(modelPath).catch(() => {});
      return { success: true };
    }
    return { success: false, error: "Model not found" };
  });
  const hasWhisper = fs.existsSync(getWhisperPath());
  const hasFfmpeg = fs.existsSync(getFfmpegPath());
  const hasModel = isAnyModelDownloaded();

  if (!hasWhisper || !hasFfmpeg) {
    log("[startup] Missing binaries! Run 'npm run setup'");
  }

  const needsOnboarding = !getConfig("onboardingDone") || !hasModel;
  if (needsOnboarding && recordingWindow && !recordingWindow.isDestroyed()) {
    // Show window immediately — renderer will display onboarding
    recordingWindow.once("ready-to-show", () => {
      if (!recordingWindow || recordingWindow.isDestroyed()) return;
      recordingWindow.setFocusable(true);
      recordingWindow.setContentSize(420, 520);
      recordingWindow.center();
      recordingWindow.show();
      recordingWindow.focus();
    });
    // Fallback: if ready-to-show already fired, show after a short delay
    setTimeout(() => {
      if (recordingWindow && !recordingWindow.isDestroyed() && !recordingWindow.isVisible()) {
        recordingWindow.setFocusable(true);
        recordingWindow.setContentSize(420, 520);
        recordingWindow.center();
        recordingWindow.show();
        recordingWindow.focus();
      }
    }, 2000);
  }
  // Start whisper-server in background (model stays in RAM = faster transcription)
  if (hasModel && hasWhisper) {
    const modelPath = getActiveModelPath();
    console.log(`[startup] server binary: ${fs.existsSync(getWhisperServerPath())}, model: ${fs.existsSync(modelPath)}`);
    console.log(`[startup] server path: ${getWhisperServerPath()}`);
    if (fs.existsSync(modelPath)) {
      startWhisperServer(modelPath)
        .then(() => console.log("[startup] whisper-server started"))
        .catch((e: any) => console.log(`[startup] whisper-server error: ${e.message}`));
    }
  }

  let updateStatus = "up-to-date";
  let updateVersion = "";

  ipcMain.handle("update:status", () => ({ status: updateStatus, version: updateVersion }));
  ipcMain.handle("update:install", () => { autoUpdater.quitAndInstall(); });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on("update-available", (info) => {
    updateStatus = "downloading";
    updateVersion = info.version;
    send("update:status", { status: updateStatus, version: updateVersion });
    new Notification({
      title: "CursorVoice - Mise à jour disponible",
      body: `Version ${info.version} en cours de téléchargement...`,
    }).show();
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateStatus = "ready";
    updateVersion = info.version;
    send("update:status", { status: updateStatus, version: updateVersion });
    new Notification({
      title: "CursorVoice - Mise à jour prête",
      body: `Version ${info.version} sera installée au prochain redémarrage.`,
    }).show();
  });

  autoUpdater.on("error", (err) => {
    console.warn("[update] Auto-update error:", err.message);
  });
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
});

app.on("window-all-closed", () => {
  // Don't quit when all windows are closed — app stays in tray
});

app.on("before-quit", () => {
  isQuitting = true;
  stopWhisperServer();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
