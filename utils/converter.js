const { spawn } = require('child_process');
const { getBinPaths } = require('./binaries');
const { runProcess } = require('./downloader');

/**
 * Verifica que ffmpeg pueda ejecutarse sin errores. Si falla, lanza un
 * error informativo para que el usuario sepa que debe instalarlo o revisar
 * su instalación.
 */
function checkFfmpegAvailability() {
  return new Promise((resolve, reject) => {
    const { ffmpegPath } = getBinPaths();
    const test = spawn(ffmpegPath, ['-version'], { windowsHide: true });
    test.on('error', () => {
      reject(
        new Error(
          'No se pudo ejecutar ffmpeg. Asegúrate de que está instalado y accesible.'
        )
      );
    });
    test.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('ffmpeg no responde correctamente.'));
      }
    });
  });
}

/**
 * Convierte un medio usando ffmpeg. Antes de la conversión, verifica que
 * ffmpeg esté disponible. La función acepta un array de argumentos
 * adicionales (extraArgs) que permiten especificar codecs y opciones de
 * contenedores.
 *
 * @param {object} options
 * @param {string} options.inputPath  Ruta absoluta del archivo de entrada.
 * @param {string} options.outputPath Ruta absoluta del archivo de salida.
 * @param {string[]} [options.extraArgs]  Argumentos extra para ffmpeg.
 * @param {(progress:object) => void} [onProgress] Callback de progreso.
 */
async function convertMedia(
  { inputPath, outputPath, extraArgs = [] },
  onProgress
) {
  // Verifica la disponibilidad de ffmpeg antes de ejecutar
  await checkFfmpegAvailability();

  const { ffmpegPath } = getBinPaths();
  const args = ['-y', '-i', inputPath, ...extraArgs, outputPath];

  // Ejecuta el proceso y analiza la salida con runProcess
  await runProcess(ffmpegPath, args, onProgress);
}

module.exports = {
  convertMedia,
};
