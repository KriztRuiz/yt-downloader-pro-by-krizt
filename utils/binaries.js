const path = require('path');
const { app } = require('electron');

let fileUtils;

/**
 * Carga el módulo fileUtils de forma perezosa.
 */
function getFileUtils() {
  if (!fileUtils) {
    fileUtils = require('./fileUtils');
  }
  return fileUtils;
}

// Resolución de nombres según plataforma
const IS_WIN = process.platform === 'win32';
const YTDLP_NAME = IS_WIN ? 'yt-dlp.exe' : 'yt-dlp';
const FFMPEG_NAME = IS_WIN ? 'ffmpeg.exe' : 'ffmpeg';

/**
 * Devuelve las rutas de binario y directorio de binarios.
 */
function getBinPaths() {
  const userData = app.getPath('userData');
  const binDir = path.join(userData, 'bin');
  const ytdlpPath = path.join(binDir, YTDLP_NAME);
  const ffmpegPath = path.join(binDir, FFMPEG_NAME);
  return { binDir, ytdlpPath, ffmpegPath };
}

/**
 * Asegura la presencia de yt-dlp y ffmpeg en la carpeta de binarios.
 * Si faltan, intenta descargarlos desde sus URLs oficiales.
 */
async function ensureBinaries() {
  const { binDir, ytdlpPath, ffmpegPath } = getBinPaths();
  const fu = getFileUtils();

  // Crea directorio de binarios
  fu.ensureDir(binDir);

  // URLs oficiales (actualizar si es necesario)
  const YTDLP_URL =
    'https://github.com/yt-dlp/yt-dlp/releases/latest/download/' +
    (IS_WIN ? 'yt-dlp.exe' : 'yt-dlp');
  const FFMPEG_URL =
    'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-' +
    (IS_WIN ? 'win64-gpl.zip' : 'linux64-gpl.tar.xz');

  // Descarga yt-dlp si falta
  if (!fu.fileExistsNonEmpty(ytdlpPath)) {
    try {
      await fu.downloadWithRetry(YTDLP_URL, ytdlpPath, 3);
    } catch (e) {
      console.warn('No se pudo descargar yt-dlp:', e.message);
    }
  }

  // Descarga y extrae ffmpeg en Windows si falta
  if (!fu.fileExistsNonEmpty(ffmpegPath) && IS_WIN) {
    const zipPath = path.join(binDir, 'ffmpeg.zip');
    try {
      await fu.downloadWithRetry(FFMPEG_URL, zipPath, 3);
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      const entry = zip
        .getEntries()
        .find((e) => e.entryName.toLowerCase().endsWith('bin/ffmpeg.exe'));
      if (entry) {
        const data = entry.getData();
        require('fs').writeFileSync(ffmpegPath, data);
      } else {
        console.warn('ffmpeg.exe no se encontró en el zip');
      }
    } catch (e) {
      console.warn('No se pudo descargar o extraer ffmpeg:', e.message);
    } finally {
      try {
        require('fs').unlinkSync(zipPath);
      } catch {}
    }
  }

  return { ytdlpPath, ffmpegPath };
}

module.exports = {
  getBinPaths,
  ensureBinaries,
};
