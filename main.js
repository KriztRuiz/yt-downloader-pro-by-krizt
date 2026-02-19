const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { ensureBinaries, getBinPaths } = require('./utils/binaries');
const { runProcess } = require('./utils/downloader');
const { convertMedia } = require('./utils/converter');

let mainWindow;

// Crea la ventana principal y configura el menú
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('download.html');

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Descargar',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadFile('download.html');
            }
          },
        },
        {
          label: 'Convertir',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadFile('convert.html');
            }
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Cómo obtener cookies',
          click: () => {
            const helpWin = new BrowserWindow({
              width: 700,
              height: 600,
              webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
              },
            });
            helpWin.setMenuBarVisibility(false);
            helpWin.loadFile('help.html');
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  try {
    await ensureBinaries();
  } catch (e) {
    console.warn('Binary initialisation failed:', e.message);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('download-media', async (_event, options) => {
  const { url, kind = 'video', format = null, outDir = process.cwd(), cookies = null } = options;
  const { ytdlpPath } = getBinPaths();
  const args = ['--newline', '-o', path.join(outDir, '%(title)s.%(ext)s')];

  if (cookies && cookies.filePath) {
    args.push('--cookies', cookies.filePath);
  }
  if (kind === 'video') {
    args.push('-f', 'bv*+ba/best');
    if (format) {
      args.push('--remux-video', format);
    }
  } else if (kind === 'audio') {
    args.push('-f', 'ba/best', '-x', '--audio-format', format || 'mp3');
  } else {
    throw new Error('Unsupported download kind: ' + kind);
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    runProcess(ytdlpPath, args, (progress) => {
      _event.sender.send('download-progress', progress);
    })
      .then(() => resolve('Descarga completada'))
      .catch((err) => reject(err.message));
  });
});

ipcMain.handle('convert-media', async (_event, options) => {
  const { inputPath, outputPath, extraArgs = [] } = options;
  return new Promise((resolve, reject) => {
    convertMedia({ inputPath, outputPath, extraArgs }, (progress) => {
      _event.sender.send('convert-progress', progress);
    })
      .then(() => resolve('Conversión completada'))
      .catch((err) => reject(err.message));
  });
});

// Maneja la selección de carpeta de salida
ipcMain.handle('pick-output-dir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});
