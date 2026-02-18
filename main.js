"use strict";

const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

let mainWin = null;

// Jobs en ejecución
const activeJobs = new Map();
let jobSeq = 1;

// Binarios en AppData (userData es lo correcto para apps Electron)
const BIN_DIR = path.join(app.getPath("userData"), "bin");
const YTDLP_PATH = path.join(BIN_DIR, "yt-dlp.exe");
const FFMPEG_PATH = path.join(BIN_DIR, "ffmpeg.exe");

let binariesReady = null;

// -----------------------
// Ventana principal + menú
// -----------------------
function createWindow() {
  mainWin = new BrowserWindow({
    width: 720,
    height: 560,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWin.loadFile("index.html");

  const template = [
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Cómo obtener cookies",
          click() {
            const helpWin = new BrowserWindow({
              width: 840,
              height: 720,
              autoHideMenuBar: true,
            });
            helpWin.loadFile("help.html");
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function send(channel, payload) {
  if (mainWin && !mainWin.isDestroyed() && mainWin.webContents) {
    mainWin.webContents.send(channel, payload);
  }
}

// -----------------------
// Utils: archivos
// -----------------------
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function fileExistsNonEmpty(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).size > 0;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// -----------------------
// Descarga robusta (redirect + tmp + retry)
// -----------------------
function downloadFile(url, dest, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(dest));

    const tmp = dest + ".tmp";
    safeUnlink(tmp);

    const client = url.startsWith("https") ? https : http;

    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (yt-downloader-pro)",
          Accept: "*/*",
        },
      },
      (res) => {
        // Redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume(); // consume response
          return downloadFile(res.headers.location, dest, { timeoutMs })
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const file = fs.createWriteStream(tmp);

        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            try {
              // reemplazo “atómico”
              safeUnlink(dest);
              fs.renameSync(tmp, dest);
              resolve();
            } catch (e) {
              safeUnlink(tmp);
              reject(e);
            }
          });
        });

        file.on("error", (err) => {
          try {
            file.close(() => {
              safeUnlink(tmp);
              reject(err);
            });
          } catch {
            safeUnlink(tmp);
            reject(err);
          }
        });
      }
    );

    req.on("error", (err) => {
      safeUnlink(tmp);
      reject(err);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Timeout"));
    });
  });
}

async function downloadWithRetry(url, dest, tries = 3) {
  let lastErr = null;
  for (let i = 1; i <= tries; i++) {
    try {
      await downloadFile(url, dest);
      if (!fileExistsNonEmpty(dest)) throw new Error("Archivo descargado vacío");
      return;
    } catch (e) {
      lastErr = e;
      // backoff simple
      await sleep(600 * i);
    }
  }
  throw lastErr || new Error("Fallo descargando");
}

// -----------------------
// Instalar binarios
// -----------------------
async function ensureBinaries() {
  ensureDir(BIN_DIR);

  // 1) yt-dlp
  if (!fileExistsNonEmpty(YTDLP_PATH)) {
    console.log("Descargando yt-dlp...");
    await downloadWithRetry(
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
      YTDLP_PATH,
      3
    );

    if (!fileExistsNonEmpty(YTDLP_PATH)) {
      throw new Error("yt-dlp no se descargó correctamente");
    }
    console.log("yt-dlp listo.");
  }

  // 2) ffmpeg (zip estable desde GitHub)
  if (!fileExistsNonEmpty(FFMPEG_PATH)) {
    console.log("Descargando ffmpeg...");

    const zipPath = path.join(BIN_DIR, "ffmpeg.zip");
    safeUnlink(zipPath);

    await downloadWithRetry(
      "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip",
      zipPath,
      3
    );

    console.log("Extrayendo ffmpeg...");

    // Requiere: npm i adm-zip
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(zipPath);

    const entry = zip
      .getEntries()
      .find((e) => e.entryName.toLowerCase().endsWith("bin/ffmpeg.exe"));

    if (!entry) {
      safeUnlink(zipPath);
      throw new Error("ffmpeg.exe no encontrado dentro del zip");
    }

    // Escribir directo al destino final (sin rutas intermedias)
    const data = entry.getData();
    fs.writeFileSync(FFMPEG_PATH, data);

    safeUnlink(zipPath);

    if (!fileExistsNonEmpty(FFMPEG_PATH)) {
      throw new Error("ffmpeg no se extrajo correctamente");
    }

    console.log("ffmpeg listo.");
  }
}

// -----------------------
// App lifecycle
// -----------------------
app.whenReady().then(async () => {
  // En cuanto arranca, empezamos la instalación de binarios
  binariesReady = (async () => {
    console.log("Verificando binarios...");
    await ensureBinaries();
    console.log("Binarios OK");
  })();

  // Si falla, lo registramos, pero NO reventamos el main process
  binariesReady.catch((err) => {
    console.error("Error instalando binarios:", err);
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// -----------------------
// Cookies args
// -----------------------
function buildCookiesArgs(cookies) {
  if (!cookies || cookies.mode === "none") return [];

  if (cookies.mode === "browser") return ["--cookies-from-browser", cookies.browser];

  if (cookies.mode === "file") return ["--cookies", cookies.filePath];

  return [];
}

// -----------------------
// Progreso
// -----------------------
function parseProgressLine(line) {
  const m = line.match(
    /\[download\]\s+(\d+(?:\.\d+)?)%.*?(?:at\s+([^\s]+)\/s)?(?:\s+ETA\s+([0-9:]+))?/i
  );
  if (!m) return null;
  return {
    percent: Number(m[1]),
    speed: m[2] || "",
    eta: m[3] || "",
  };
}

// -----------------------
// Ejecutar yt-dlp
// -----------------------
function runYtDlp({ jobId, args }) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_PATH, args, {
      windowsHide: true,
    });

    activeJobs.set(jobId, child);

    const onLine = (raw) => {
      const text = raw.toString();
      text.split(/\r?\n/).forEach((line) => {
        if (!line.trim()) return;

        const p = parseProgressLine(line);
        if (p) send("dl-progress", { jobId, ...p });

        send("dl-log", { jobId, line });
      });
    };

    child.stdout.on("data", onLine);
    child.stderr.on("data", onLine);

    child.on("error", (err) => {
      activeJobs.delete(jobId);
      reject(err);
    });

    child.on("close", (code) => {
      activeJobs.delete(jobId);
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp salió con código ${code}`));
    });
  });
}

// -----------------------
// IPC: selector de carpeta/cookies
// -----------------------
ipcMain.handle("pick-output-dir", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle("pick-cookies-file", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Cookies", extensions: ["txt"] }],
  });
  return res.canceled ? null : res.filePaths[0];
});

// -----------------------
// IPC: start download
// -----------------------
ipcMain.handle("start-download", async (_event, payload) => {
  // 1) Asegurar binarios
  if (!binariesReady) throw new Error("Binarios no inicializados.");

  try {
    await binariesReady;
  } catch (e) {
    throw new Error("No se pudieron instalar yt-dlp/ffmpeg. Revisa tu internet o antivirus y reintenta.");
  }

  // 2) Verificar que existen
  if (!fileExistsNonEmpty(YTDLP_PATH)) throw new Error("yt-dlp.exe no encontrado.");
  if (!fileExistsNonEmpty(FFMPEG_PATH)) throw new Error("ffmpeg.exe no encontrado.");

  const { url, kind, outDir, cookies } = payload;

  const jobId = String(jobSeq++);

  const baseArgs = [
    "--newline",
    "--progress",
    "--ffmpeg-location",
    FFMPEG_PATH,
    "-P",
    outDir,
    ...buildCookiesArgs(cookies),
  ];

  const args =
    kind === "video"
      ? [
          ...baseArgs,
          "-f",
          "bv*+ba/best",
          "--merge-output-format",
          "mp4",
          "-o",
          "%(title)s.%(ext)s",
          url,
        ]
      : [
          ...baseArgs,
          "-f",
          "ba/best",
          "-o",
          "%(title)s.%(ext)s",
          url,
        ];

  // 3) Ejecutar sin crashear main process
  runYtDlp({ jobId, args })
    .then(() => send("dl-done", { jobId }))
    .catch((err) => send("dl-error", { jobId, message: err.message }));

  return jobId;
});

// -----------------------
// IPC: cancel download
// -----------------------
ipcMain.handle("cancel-download", async (_event, jobId) => {
  const child = activeJobs.get(jobId);
  if (!child) return false;

  try {
    child.kill();
  } catch {}

  activeJobs.delete(jobId);
  send("dl-canceled", { jobId });

  return true;
});
