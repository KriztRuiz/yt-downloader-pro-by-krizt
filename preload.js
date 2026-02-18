const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  pickOutputDir: () => ipcRenderer.invoke("pick-output-dir"),
  pickCookiesFile: () => ipcRenderer.invoke("pick-cookies-file"),

  startDownload: (payload) => ipcRenderer.invoke("start-download", payload),
  cancelDownload: (jobId) => ipcRenderer.invoke("cancel-download", jobId),

  onProgress: (cb) => ipcRenderer.on("dl-progress", (_, data) => cb(data)),
  onLog: (cb) => ipcRenderer.on("dl-log", (_, data) => cb(data)),
  onDone: (cb) => ipcRenderer.on("dl-done", (_, data) => cb(data)),
  onError: (cb) => ipcRenderer.on("dl-error", (_, data) => cb(data)),
  onCanceled: (cb) => ipcRenderer.on("dl-canceled", (_, data) => cb(data)),
});
