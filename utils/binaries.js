const path = require('path');
const { app } = require('electron');
const fs = require('fs');

let fileUtils;

/**
 * Importa fileUtils de forma perezosa para evitar dependencias circulares.
 */
function getFileUtils() {
  if (!fileUtils) {
    fileUtils = require('./fileUtils');
  }
  return fileUtils;
}

// Nombres de los binarios según la plataforma
const IS_WIN = process.platform === 'win32';
const YTDLP_NAME = IS_WIN ? 'yt-dlp.exe' : 'yt-dlp';
const FFMPEG_NAME = IS_WIN ? 'ffmpeg.exe' : 'ffmpeg';

/**
 * Devuelve las rutas de la carpeta de binarios y las ubicaciones de yt‑dlp/ffmpeg.
 */
function getBinPaths() {
  const userData = app.getPath('userData');
  const binDir = path.join(userData, 'bin');
  return {
    binDir,
    ytdlpPath: path.join(binDir, YTDLP_NAME),
    ffmpegPath: path.join(binDir, FFMPEG_NAME),
  };
}

/**
 * Descarga yt‑dlp y ffmpeg si no están presentes. En Windows,
 * extrae y copia ffmpeg junto con sus DLLs al directorio de binarios.
 */
async function ensureBinaries() {
  const { binDir, ytdlpPath, ffmpegPath } = getBinPaths();
  const fu = getFileUtils();

  // Asegura que exista la carpeta de binarios
  fu.ensureDir(binDir);

  // URL de descarga para yt-dlp
  const YTDLP_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YTDLP_NAME}`;

  // URL de descarga de un paquete completo de ffmpeg según plataforma
  const FFMPEG_URL = IS_WIN
    ? 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
    : 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-linux64-gpl.tar.xz';

  // Descargar yt‑dlp si falta
  if (!fu.fileExistsNonEmpty(ytdlpPath)) {
    try {
      await fu.downloadWithRetry(YTDLP_URL, ytdlpPath, 3);
    } catch (e) {
      console.warn('No se pudo descargar yt-dlp:', e.message);
    }
  }

  // Descargar y extraer ffmpeg completo en Windows
  if (IS_WIN && !fu.fileExistsNonEmpty(ffmpegPath)) {
    const zipPath = path.join(binDir, 'ffmpeg.zip');
    try {
      await fu.downloadWithRetry(FFMPEG_URL, zipPath, 3);
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      // Extraer todo el contenido en binDir
      zip.extractAllTo(binDir, true);
      // Busca la carpeta extraída (ffmpeg-XXX)
      const extractedDir = fs
        .readdirSync(binDir)
        .find(
          (d) =>
            d.startsWith('ffmpeg') &&
            fs.statSync(path.join(binDir, d)).isDirectory()
        );
      if (extractedDir) {
        const ffmpegBinDir = path.join(binDir, extractedDir, 'bin');
        // Copia ffmpeg.exe y las DLLs al directorio bin
        fs.readdirSync(ffmpegBinDir).forEach((file) => {
          fs.copyFileSync(
            path.join(ffmpegBinDir, file),
            path.join(binDir, file)
          );
        });
      }
    } catch (e) {
      console.warn('No se pudo descargar o extraer ffmpeg:', e.message);
    } finally {
      // Elimina el archivo ZIP
      try {
        fs.unlinkSync(zipPath);
      } catch {}
    }
  }

  return { ytdlpPath, ffmpegPath };
}

module.exports = {
  getBinPaths,
  ensureBinaries,
};
