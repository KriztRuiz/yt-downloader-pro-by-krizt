// Referencias a elementos DOM
const inputFile = document.getElementById('input-file');
const convertFormatSelect = document.getElementById('convert-format');
const outputFileInput = document.getElementById('output-file');
const browseOutputDirBtn = document.getElementById('browse-output-dir');
const convertBtn = document.getElementById('convert-btn');
const convertStatus = document.getElementById('convert-status');

// Selecciona directorio y construye nombre de salida
browseOutputDirBtn.addEventListener('click', async () => {
  const dir = await window.api.pickOutputDir();
  if (!dir) return;
  const file = inputFile.files && inputFile.files[0];
  const format = convertFormatSelect.value;
  let baseName = 'output';
  if (file && file.name) {
    const parts = file.name.split('.');
    if (parts.length > 1) parts.pop();
    baseName = parts.join('.') || 'output';
  }
  outputFileInput.value = dir + '/' + baseName + '.' + format;
});

// Convierte el archivo
convertBtn.addEventListener('click', async () => {
  const file = inputFile.files && inputFile.files[0];
  if (!file) {
    convertStatus.textContent = 'Selecciona un archivo de entrada';
    return;
  }
  const inputPath = file.path;
  const outputPath = outputFileInput.value.trim();
  if (!outputPath) {
    convertStatus.textContent = 'Ingresa una ruta de salida válida';
    return;
  }
  const fmt = convertFormatSelect.value;
  let extraArgs = [];
  switch (fmt) {
    case 'mp3':
      extraArgs = ['-vn', '-codec:a', 'libmp3lame'];
      break;
    case 'wav':
      extraArgs = ['-vn', '-codec:a', 'pcm_s16le'];
      break;
    case 'mp4':
    case 'mkv':
      extraArgs = ['-codec', 'copy'];
      break;
    case 'png':
    case 'jpg':
      extraArgs = ['-an', '-vframes', '1'];
      break;
    default:
      extraArgs = [];
  }
  convertStatus.textContent = 'Iniciando conversión...';
  try {
    await window.api.convertMedia({ inputPath, outputPath, extraArgs });
    convertStatus.textContent = 'Conversión completada';
  } catch (err) {
    convertStatus.textContent = err;
  }
});

// Actualiza progreso
window.api.onConvertProgress((progress) => {
  if (progress.percent != null) {
    convertStatus.textContent = `${progress.percent.toFixed(2)}% • ${progress.speed} • ETA ${progress.eta}`;
  }
});
