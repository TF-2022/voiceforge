import { useState, useRef, useCallback } from "react";
import { api } from "../lib/ipc";

interface RecorderOptions {
  deviceId?: string;
  silenceTimeout?: number; // seconds, 0 = disabled
}

export function useAudioRecorder(options: RecorderOptions = {}) {
  const { deviceId, silenceTimeout = 0 } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const silenceRef = useRef<{ ctx: AudioContext; timer: ReturnType<typeof setTimeout> | null; raf: number } | null>(null);

  const cleanupSilenceDetector = useCallback(() => {
    if (silenceRef.current) {
      if (silenceRef.current.timer) clearTimeout(silenceRef.current.timer);
      cancelAnimationFrame(silenceRef.current.raf);
      silenceRef.current.ctx.close().catch(() => {});
      silenceRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      };
      if (deviceId && deviceId !== "default") {
        audioConstraints.deviceId = { exact: deviceId };
      }

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      setStream(audioStream);

      const recorder = new MediaRecorder(audioStream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        cleanupSilenceDetector();
        audioStream.getTracks().forEach((t) => t.stop());
        setStream(null);

        if (cancelledRef.current) return;

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const buffer = await blob.arrayBuffer();
        api?.sendAudio(buffer);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Silence detection
      if (silenceTimeout > 0) {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(audioStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        let silenceStart: number | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const check = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
          const isSilent = avg < 5;

          if (isSilent) {
            if (!silenceStart) silenceStart = Date.now();
            const elapsed = (Date.now() - silenceStart) / 1000;
            if (elapsed >= silenceTimeout && mediaRecorderRef.current?.state === "recording") {
              // Auto-stop
              api?.notifyStop();
              mediaRecorderRef.current.stop();
              setIsRecording(false);
              return;
            }
          } else {
            silenceStart = null;
          }

          silenceRef.current!.raf = requestAnimationFrame(check);
        };

        silenceRef.current = { ctx, timer, raf: requestAnimationFrame(check) };
      }
    } catch (err) {
      console.error("Failed to start recording:", err);
      setIsRecording(false);
    }
  }, [deviceId, silenceTimeout, cleanupSilenceDetector]);

  const stopRecording = useCallback(() => {
    cleanupSilenceDetector();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [cleanupSilenceDetector]);

  const cancelRecording = useCallback(() => {
    cleanupSilenceDetector();
    cancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [cleanupSilenceDetector]);

  return { isRecording, stream, startRecording, stopRecording, cancelRecording };
}
