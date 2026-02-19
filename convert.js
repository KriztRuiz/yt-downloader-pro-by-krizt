// Referencias a elementos DOM
const inputFile = document.getElementById('input-file');
const formatSelect = document.getElementById('convert-format');
const outputFileInput = document.getElementById('output-file');
const browseOutputDirBtn = document.getElementById('browse-output-dir');
const convertBtn = document.getElementById('convert-btn');
const status = document.getElementById('convert-status');

// Selección de carpeta y nombre de salida
browseOutputDirBtn.addEventListener('click', async () => {
  const dir = await window.api.pickOutputDir();
  if (!dir) return;
  const file = inputFile.files && inputFile.files[0];
  const format = formatSelect.value;
  let baseName = 'output';
  if (file && file.name) {
    const parts = file.name.split('.');
    if (parts.length > 1) parts.pop();
    baseName = parts.join('.') || 'output';
  }
  outputFileInput.value = `${dir}/${baseName}.${format}`;
});

// Convierte el archivo seleccionado
convertBtn.addEventListener('click', async () => {
  const file = inputFile.files && inputFile.files[0];
  if (!file) {
    status.textContent = 'Selecciona un archivo de entrada';
    return;
  }
  const inputPath = file.path;
  const outputPath = outputFileInput.value.trim();
  if (!outputPath) {
    status.textContent = 'Ingresa una ruta de salida válida';
    return;
  }
  const fmt = formatSelect.value;
  let extraArgs = [];

  switch (fmt) {
    case 'mp3':
      // Convierte audio y descarta vídeo
      extraArgs = ['-vn', '-codec:a', 'libmp3lame'];
      break;
    case 'wav':
      extraArgs = ['-vn', '-codec:a', 'pcm_s16le'];
      break;
    case 'mp4':
    case 'mkv':
      // Recodifica video a h264 y audio a AAC
      extraArgs = ['-c:v', 'libx264', '-c:a', 'aac'];
      break;
    case 'png':
    case 'jpg':
      // Toma sólo una imagen del vídeo
      extraArgs = ['-an', '-vframes', '1'];
      break;
    default:
      extraArgs = [];
  }

  status.textContent = 'Iniciando conversión...';
  try {
    await window.api.convertMedia({ inputPath, outputPath, extraArgs });
    status.textContent = 'Conversión completada';
  } catch (err) {
    status.textContent = err;
  }
});

// Actualiza el progreso de conversión
window.api.onConvertProgress((progress) => {
  if (progress.percent != null) {
    status.textContent = `${progress.percent.toFixed(
      2
    )}% • ${progress.speed} • ETA ${progress.eta}`;
  }
});
