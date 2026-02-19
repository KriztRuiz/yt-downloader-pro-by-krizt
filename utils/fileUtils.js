const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Crea un directorio (y padres) si no existen.
 * @param {string} dir
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Borra un archivo si existe.
 * @param {string} filePath
 */
function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

/**
 * Comprueba si un archivo existe y no está vacío.
 * @param {string} filePath
 * @returns {boolean}
 */
function fileExistsNonEmpty(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

/**
 * Espera asincrónicamente el número de milisegundos indicado.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Descarga un recurso a disco con soporte para redirecciones y renombrado atómico.
 *
 * @param {string} url
 * @param {string} dest
 * @param {object} [options]
 * @param {number} [options.timeoutMs=120000]
 */
function downloadFile(url, dest, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(dest));
    const tmp = dest + '.tmp';
    safeUnlink(tmp);

    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'yt-downloader-pro',
          Accept: '*/*',
        },
      },
      (res) => {
        // Redirecciones 3xx
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.destroy();
          return downloadFile(res.headers.location, dest, { timeoutMs })
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode));
        }
        const file = fs.createWriteStream(tmp);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            try {
              safeUnlink(dest);
              fs.renameSync(tmp, dest);
              resolve();
            } catch (e) {
              safeUnlink(tmp);
              reject(e);
            }
          });
        });
        file.on('error', (err) => {
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
    req.on('error', (err) => {
      safeUnlink(tmp);
      reject(err);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      safeUnlink(tmp);
      reject(new Error('Timeout'));
    });
  });
}

/**
 * Descarga con varios intentos y retroceso exponencial.
 * @param {string} url
 * @param {string} dest
 * @param {number} [tries=3]
 */
async function downloadWithRetry(url, dest, tries = 3) {
  let lastErr = null;
  for (let i = 1; i <= tries; i++) {
    try {
      await downloadFile(url, dest);
      if (!fileExistsNonEmpty(dest))
        throw new Error('Archivo descargado vacío');
      return;
    } catch (e) {
      lastErr = e;
      await sleep(500 * i);
    }
  }
  throw lastErr || new Error('Falló la descarga tras reintentos');
}

module.exports = {
  ensureDir,
  safeUnlink,
  fileExistsNonEmpty,
  sleep,
  downloadFile,
  downloadWithRetry,
};
