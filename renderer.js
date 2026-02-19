// DOM references
const urlInput = document.getElementById('url');
const status = document.getElementById('status');
const kindSelect = document.getElementById('kind');
const formatSelect = document.getElementById('format');
const downloadBtn = document.getElementById('download-btn');

const inputFile = document.getElementById('input-file');
const outputFile = document.getElementById('output-file');
const convertFormat = document.getElementById('convert-format');
const convertBtn = document.getElementById('convert-btn');
const convertStatus = document.getElementById('convert-status');

// Define available formats for each kind. This can be extended as
// additional formats are supported by yt‑dlp and ffmpeg.
const formatOptions = {
  video: [
    { value: '', label: 'Automático' },
    { value: 'mp4', label: 'MP4' },
    { value: 'mkv', label: 'MKV' },
    { value: 'webm', label: 'WEBM' },
  ],
  audio: [
    { value: '', label: 'Automático (mp3)' },
    { value: 'mp3', label: 'MP3' },
    { value: 'aac', label: 'AAC' },
    { value: 'm4a', label: 'M4A' },
    { value: 'opus', label: 'OPUS' },
  ],
};

// Populate the format dropdown based on the selected kind
function updateFormatOptions() {
  const kind = kindSelect.value;
  const opts = formatOptions[kind];
  formatSelect.innerHTML = '';
  opts.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    formatSelect.appendChild(option);
  });
}

// Handle download button click
async function handleDownload() {
  const url = urlInput.value.trim();
  if (!url) {
    status.innerText = 'Por favor ingresa una URL válida';
    return;
  }
  const kind = kindSelect.value;
  const format = formatSelect.value || null;
  status.innerText = 'Iniciando descarga...';
  try {
    await window.api.downloadMedia({ url, kind, format });
    status.innerText = 'Descarga completada';
  } catch (err) {
    status.innerText = err;
  }
}

// Handle conversion button click
async function handleConvert() {
  const file = inputFile.files && inputFile.files[0];
  if (!file) {
    convertStatus.innerText = 'Selecciona un archivo de entrada';
    return;
  }
  const output = outputFile.value.trim();
  if (!output) {
    convertStatus.innerText = 'Ingresa una ruta de salida';
    return;
  }
  // Determine ffmpeg arguments based on format. We keep this simple:
  // ffmpeg will infer codecs from the output extension. For more
  // advanced conversions specify codecs in extraArgs.
  const fmt = convertFormat.value;
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
      // Copy video/audio streams; remux container
      extraArgs = ['-codec', 'copy'];
      break;
    case 'png':
    case 'jpg':
      // Extract first frame as image
      extraArgs = ['-an', '-vframes', '1'];
      break;
    default:
      extraArgs = [];
  }
  convertStatus.innerText = 'Iniciando conversión...';
  try {
    await window.api.convertMedia({ inputPath: file.path, outputPath: output, extraArgs });
    convertStatus.innerText = 'Conversión completada';
  } catch (err) {
    convertStatus.innerText = err;
  }
}

// Progress listeners update the status elements. These are
// optional; if the main process does not emit progress then
// nothing will be displayed.
window.api.onDownloadProgress((progress) => {
  status.innerText = `${progress.percent.toFixed(2)}% • ${progress.speed} • ETA ${progress.eta}`;
});
window.api.onConvertProgress((progress) => {
  convertStatus.innerText = `${progress.percent.toFixed(2)}% • ${progress.speed} • ETA ${progress.eta}`;
});

// Initialise the UI
updateFormatOptions();
kindSelect.addEventListener('change', updateFormatOptions);
downloadBtn.addEventListener('click', handleDownload);
convertBtn.addEventListener('click', handleConvert);
