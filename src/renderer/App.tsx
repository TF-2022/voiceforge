import { useState, useEffect, useCallback, useRef } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import RecordingWindow from "./components/RecordingWindow";
import SettingsPanel from "./components/SettingsPanel";
import OnboardingScreen from "./components/OnboardingScreen";
import { api } from "./lib/ipc";

type Status = "idle" | "recording" | "transcribing" | "injecting" | "done" | "empty" | "error";
type View = "recording" | "settings" | "onboarding";

const RECORDING_SIZE = { w: 260, h: 72 };
const SETTINGS_SIZE = { w: 880, h: 640 };
const ONBOARDING_SIZE = { w: 520, h: 560 };

const DEV_FORCE_ONBOARDING = false;

export default function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [view, setView] = useState<View>("recording");
  const [ready, setReady] = useState(false);
  const [inputDevice, setInputDevice] = useState<string>("default");
  const [silenceTimeout, setSilenceTimeout] = useState(0);
  const { stream, startRecording, stopRecording, cancelRecording } = useAudioRecorder({ deviceId: inputDevice, silenceTimeout });

  // Refs to avoid stale closures in IPC callbacks
  const viewRef = useRef(view);
  const statusRef = useRef(status);
  viewRef.current = view;
  statusRef.current = status;

  const openSettings = useCallback(() => {
    if (statusRef.current === "recording") {
      setStatus("transcribing");
      stopRecording();
    }
    setView("settings");
    api?.resizeWindow(SETTINGS_SIZE.w, SETTINGS_SIZE.h);
    api?.centerWindow();
  }, [stopRecording]);

  const closeSettings = useCallback(() => {
    setView("recording");
    api?.hideWindow();
  }, []);

  const handleStartRecording = useCallback(() => {
    if (viewRef.current === "settings") {
      setView("recording");
      api?.resizeWindow(RECORDING_SIZE.w, RECORDING_SIZE.h);
    }
    setStatus("recording");
    startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    setStatus("transcribing");
    stopRecording();
    api?.notifyStop();
  }, [stopRecording]);

  const handleDismiss = useCallback(() => {
    cancelRecording();
    setStatus("idle");
    api?.notifyStop();
    api?.hideWindow();
  }, [cancelRecording]);

  useEffect(() => {
    if (!api) return;

    const cleanups = [
      api.onStartRecording(handleStartRecording),
      api.onStopRecording(handleStopRecording),
      api.onStatusUpdate((s: string) => setStatus(s as Status)),
      api.onShowSettings(openSettings),
      api.onShowOnboarding(() => {
        setView("onboarding");
        api?.resizeWindow(ONBOARDING_SIZE.w, ONBOARDING_SIZE.h);
        api?.centerWindow();
      }),
    ];

    return () => cleanups.forEach((fn) => fn());
  }, [handleStartRecording, handleStopRecording, openSettings]);

  // Check if onboarding is needed on mount + load inputDevice
  useEffect(() => {
    api?.getSettings().then((s: any) => {
      if (s?.inputDevice) setInputDevice(s.inputDevice);
      if (s?.silenceTimeout != null) setSilenceTimeout(s.silenceTimeout);
    });
    api?.getAppStatus().then((s: any) => {
      if (!s.onboardingDone || !s.hasModel) {
        setView("onboarding");
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  // Auto-reset done/empty/error states
  useEffect(() => {
    if (status === "done" || status === "empty" || status === "error") {
      const delay = status === "done" ? 1000 : status === "error" ? 2000 : 1200;
      const timer = setTimeout(() => setStatus("idle"), delay);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (view === "onboarding" || DEV_FORCE_ONBOARDING) {
    return (
      <OnboardingScreen
        onComplete={() => {
          api?.completeOnboarding();
          setView("recording");
          api?.hideWindow();
        }}
        onMount={() => {
          api?.resizeWindow(ONBOARDING_SIZE.w, ONBOARDING_SIZE.h);
          api?.centerWindow();
        }}
      />
    );
  }

  if (view === "settings") {
    return <SettingsPanel onClose={closeSettings} onDeviceChange={setInputDevice} onSilenceTimeoutChange={setSilenceTimeout} />;
  }

  return (
    <RecordingWindow
      status={status}
      stream={stream}
      onOpenSettings={openSettings}
      onStop={handleStopRecording}
      onDismiss={handleDismiss}
    />
  );
}
