const $ = (id) => document.getElementById(id);

const urlInput = $("url");
const statusEl = $("status");
const outPathEl = $("outPath");
const cookiesModeEl = $("cookiesMode");
const pickCookiesBtn = $("pickCookies");
const cookiesPathEl = $("cookiesPath");

const btnVideo = $("btnVideo");
const btnAudio = $("btnAudio");
const btnCancel = $("btnCancel");

const bar = $("bar");
const pct = $("pct");
const meta = $("meta");
const logBox = $("logBox");

let currentJobId = null;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setRunning(running) {
  btnVideo.disabled = running;
  btnAudio.disabled = running;
  btnCancel.disabled = !running;
}

function resetProgress() {
  bar.style.width = "0%";
  pct.textContent = "0%";
  meta.textContent = "—";
}

function appendLog(line) {
  logBox.textContent += line + "\n";
  logBox.scrollTop = logBox.scrollHeight;
}

function getCookiesConfig() {
  const v = cookiesModeEl.value;

  if (v === "none") return { mode: "none" };

  if (v.startsWith("browser:")) {
    return { mode: "browser", browser: v.split(":")[1] };
  }

  if (v === "file") {
    const p = cookiesPathEl.dataset.path || "";
    return { mode: "file", filePath: p };
  }

  return { mode: "none" };
}

function validateUrl(u) {
  const s = (u || "").trim();
  if (!s) return { ok: false, msg: "Pega una URL." };
  try {
    // Acepta youtu.be, youtube.com, music.youtube.com, etc.
    new URL(s);
    return { ok: true, url: s };
  } catch {
    return { ok: false, msg: "URL inválida." };
  }
}

// Persistencia simple
function savePrefs() {
  const prefs = {
    outDir: outPathEl.dataset.path || "",
    cookiesMode: cookiesModeEl.value,
    cookiesFile: cookiesPathEl.dataset.path || "",
  };
  localStorage.setItem("prefs", JSON.stringify(prefs));
}
function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem("prefs") || "{}");
    if (prefs.outDir) {
      outPathEl.textContent = prefs.outDir;
      outPathEl.dataset.path = prefs.outDir;
    }
    if (prefs.cookiesMode) cookiesModeEl.value = prefs.cookiesMode;
    if (prefs.cookiesFile) {
      cookiesPathEl.textContent = prefs.cookiesFile;
      cookiesPathEl.dataset.path = prefs.cookiesFile;
    }
  } catch {}
}

// --- UI events
$("pickOut").addEventListener("click", async () => {
  const dir = await window.api.pickOutputDir();
  if (!dir) return;
  outPathEl.textContent = dir;
  outPathEl.dataset.path = dir;
  savePrefs();
});

cookiesModeEl.addEventListener("change", () => {
  const needsFile = cookiesModeEl.value === "file";
  pickCookiesBtn.disabled = !needsFile;
  if (!needsFile) {
    cookiesPathEl.textContent = "—";
    cookiesPathEl.dataset.path = "";
  }
  savePrefs();
});

pickCookiesBtn.addEventListener("click", async () => {
  const fp = await window.api.pickCookiesFile();
  if (!fp) return;
  cookiesPathEl.textContent = fp;
  cookiesPathEl.dataset.path = fp;
  savePrefs();
});

btnCancel.addEventListener("click", async () => {
  if (!currentJobId) return;
  await window.api.cancelDownload(currentJobId);
});

async function start(kind) {
  const v = validateUrl(urlInput.value);
  if (!v.ok) {
    setStatus(v.msg);
    return;
  }

  const outDir = outPathEl.dataset.path || "";
  if (!outDir) {
    setStatus("Selecciona una carpeta de salida.");
    return;
  }

  const cookies = getCookiesConfig();
  if (cookies.mode === "file" && !cookies.filePath) {
    setStatus("Selecciona tu cookies.txt o cambia el modo de cookies.");
    return;
  }

  logBox.textContent = "";
  resetProgress();
  setRunning(true);
  setStatus("Iniciando descarga…");

  try {
    currentJobId = await window.api.startDownload({
      url: v.url,
      kind,
      outDir,
      cookies,
    });
    setStatus(`Descargando (${kind})…`);
  } catch (err) {
    setRunning(false);
    currentJobId = null;
    setStatus(err?.message || String(err));
  }
}

btnVideo.addEventListener("click", () => start("video"));
btnAudio.addEventListener("click", () => start("audio"));

// --- IPC events
window.api.onProgress((data) => {
  if (!currentJobId || data.jobId !== currentJobId) return;

  const percent = Math.max(0, Math.min(100, data.percent || 0));
  bar.style.width = `${percent}%`;
  pct.textContent = `${percent.toFixed(1)}%`;

  const parts = [];
  if (data.speed) parts.push(`Vel: ${data.speed}/s`);
  if (data.eta) parts.push(`ETA: ${data.eta}`);
  meta.textContent = parts.length ? parts.join(" • ") : "—";
});

window.api.onLog((data) => {
  if (!currentJobId || data.jobId !== currentJobId) return;
  appendLog(data.line);
});

window.api.onDone((data) => {
  if (!currentJobId || data.jobId !== currentJobId) return;
  setStatus("Listo. Descarga completada.");
  setRunning(false);
  currentJobId = null;
});

window.api.onError((data) => {
  if (!currentJobId || data.jobId !== currentJobId) return;
  setStatus(`Error: ${data.message}`);
  setRunning(false);
  currentJobId = null;
});

window.api.onCanceled((data) => {
  if (!currentJobId || data.jobId !== currentJobId) return;
  setStatus("Descarga cancelada.");
  setRunning(false);
  currentJobId = null;
});

loadPrefs();
// Ajustar pickCookiesBtn según modo al cargar
pickCookiesBtn.disabled = cookiesModeEl.value !== "file";
