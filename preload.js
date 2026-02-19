const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  downloadMedia: (options) => ipcRenderer.invoke('download-media', options),

  convertMedia: (options) => ipcRenderer.invoke('convert-media', options),

  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data));
  },

  onConvertProgress: (callback) => {
    ipcRenderer.on('convert-progress', (_event, data) => callback(data));
  },

  pickOutputDir: () => ipcRenderer.invoke('pick-output-dir'),
});
