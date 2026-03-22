import { spawn, ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import { getWhisperServerPath, getWhisperPath } from "./bin-resolver";

let serverProcess: ChildProcess | null = null;
let serverReady = false;
let serverFailCount = 0;
let currentModelPath = "";
const SERVER_PORT = 58432;
const MAX_SERVER_FAILURES = 3;
const THREADS = Math.max(1, Math.min(8, (os.cpus().length || 4) - 1));

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 1 });

interface TranscribeOptions {
  wavPath: string;
  modelPath: string;
  language?: string;
  translate?: boolean;
  prompt?: string;
  timeout?: number;
}

export async function startWhisperServer(modelPath: string): Promise<void> {
  if (serverProcess && serverReady && currentModelPath === modelPath) return;

  stopWhisperServer();

  const serverPath = getWhisperServerPath();
  if (!fs.existsSync(serverPath)) return;

  currentModelPath = modelPath;
  serverFailCount = 0;

  return new Promise((resolve) => {
    serverProcess = spawn(serverPath, [
      "--model", modelPath,
      "--host", "127.0.0.1",
      "--port", String(SERVER_PORT),
      "--threads", String(THREADS),
      "--beam-size", "1",
      "--best-of", "1",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    serverProcess.stdout?.on("data", (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[whisper-server] ${msg.slice(0, 200)}`);
    });
    serverProcess.stderr?.on("data", (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[whisper-server] ${msg.slice(0, 200)}`);
    });
    serverProcess.on("error", () => { serverReady = false; resolve(); });
    serverProcess.on("exit", () => { serverReady = false; serverProcess = null; });

    // Poll HTTP until server responds (more reliable than parsing output)
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (!serverProcess) { clearInterval(poll); resolve(); return; }

      const req = http.get(`http://127.0.0.1:${SERVER_PORT}/`, (res) => {
        clearInterval(poll);
        serverReady = true;
        console.log(`[whisper-server] READY in ${attempts * 500}ms`);
        resolve();
        res.resume();
      });
      req.on("error", () => {});
      req.setTimeout(400, () => req.destroy());

      if (attempts >= 120) { // 60s max
        clearInterval(poll);
        console.log("[whisper-server] timeout");
        serverReady = false;
        serverProcess?.kill();
        serverProcess = null;
        resolve();
      }
    }, 500);
  });
}

export function stopWhisperServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    serverReady = false;
    currentModelPath = "";
  }
}

export async function restartWithModel(modelPath: string): Promise<void> {
  stopWhisperServer();
  if (fs.existsSync(modelPath) && fs.existsSync(getWhisperServerPath())) {
    await startWhisperServer(modelPath);
  }
}

function transcribeViaServer(options: TranscribeOptions): Promise<string> {
  const { wavPath, language = "fr", translate = false, prompt = "", timeout = 10000 } = options;

  return new Promise((resolve, reject) => {
    const boundary = "----CursorVoice" + Date.now();
    const fileContent = fs.readFileSync(wavPath);

    const parts: Buffer[] = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
      fileContent,
      Buffer.from("\r\n"),
    ];

    if (language !== "auto") {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`));
    }

    if (translate) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="translate"\r\n\r\ntrue\r\n`));
    }

    if (prompt) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${prompt}\r\n`));
    }

    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\ntext\r\n`));
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const req = http.request({
      hostname: "127.0.0.1",
      port: SERVER_PORT,
      path: "/inference",
      method: "POST",
      agent: httpAgent,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
      timeout,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data).text?.trim() || ""); }
          catch { resolve(data.trim()); }
        } else {
          reject(new Error(`Server HTTP ${res.statusCode}`));
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

function transcribeViaCLI(options: TranscribeOptions): Promise<string> {
  const { wavPath, modelPath, language = "fr", translate = false, prompt = "", timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const args = [
      "--model", modelPath,
      "--file", wavPath,
      "--threads", String(THREADS),
      "--beam-size", "1",
      "--best-of", "1",
      "--no-timestamps",
      "--no-prints",
    ];

    if (language !== "auto") args.push("--language", language);
    if (translate) args.push("--translate");
    if (prompt) args.push("--prompt", prompt);

    const proc = spawn(getWhisperPath(), args);
    let output = "";
    let error = "";

    proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { error += d.toString(); });

    const timer = setTimeout(() => { proc.kill(); reject(new Error("CLI timeout")); }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      proc.removeAllListeners("error");
      if (code === 0) {
        resolve(output.replace(/\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/g, "").trim());
      } else {
        reject(new Error(`CLI exit ${code}: ${error.slice(-200)}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`CLI: ${err.message}`));
    });
  });
}

export async function transcribe(options: TranscribeOptions): Promise<string> {
  const t0 = Date.now();

  if (serverReady && serverProcess && serverFailCount < MAX_SERVER_FAILURES) {
    try {
      const result = await transcribeViaServer(options);
      serverFailCount = 0;
      console.log(`[transcribe] server ${Date.now() - t0}ms "${result.slice(0, 50)}"`);
      return result;
    } catch (e: any) {
      console.log(`[transcribe] server failed: ${e.message}`);
      serverFailCount++;
    }
  } else {
    console.log(`[transcribe] CLI mode (server=${serverReady}, fails=${serverFailCount})`);
  }

  const result = await transcribeViaCLI(options);
  console.log(`[transcribe] cli ${Date.now() - t0}ms "${result.slice(0, 50)}"`);
  return result;
}
