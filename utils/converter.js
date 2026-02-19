const { getBinPaths } = require('./binaries');
const { runProcess } = require('./downloader');

// Convierte un archivo usando ffmpeg
async function convertMedia({ inputPath, outputPath, extraArgs }, onProgress) {
  const { ffmpegPath } = getBinPaths();
  const args = ['-y', '-i', inputPath, ...extraArgs, outputPath];
  await runProcess(ffmpegPath, args, onProgress);
}

module.exports = {
  convertMedia,
};
