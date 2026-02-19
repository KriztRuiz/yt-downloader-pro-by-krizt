// Referencias a elementos DOM
const urlInput = document.getElementById('url');
const kindSelect = document.getElementById('kind');
const formatSelect = document.getElementById('format');
const outDirInput = document.getElementById('out-dir');
const browseOutDirBtn = document.getElementById('browse-out-dir');
const downloadBtn = document.getElementById('download-btn');
const status = document.getElementById('status');

// Opciones de formato por tipo
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

// Rellena el select de formato según tipo
function updateFormatOptions() {
  const opts = formatOptions[kindSelect.value];
  formatSelect.innerHTML = '';
  opts.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    formatSelect.appendChild(option);
  });
}

// Escoge la carpeta de salida
browseOutDirBtn.addEventListener('click', async () => {
  const dir = await window.api.pickOutputDir();
  if (dir) outDirInput.value = dir;
});

// Inicia descarga
downloadBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    status.textContent = 'Por favor ingresa una URL válida';
    return;
  }
  const kind = kindSelect.value;
  const format = formatSelect.value || null;
  const outDir = outDirInput.value || undefined;
  status.textContent = 'Iniciando descarga...';
  try {
    await window.api.downloadMedia({ url, kind, format, outDir });
    status.textContent = 'Descarga completada';
  } catch (err) {
    status.textContent = err;
  }
});

// Actualiza progreso
window.api.onDownloadProgress((progress) => {
  if (progress.percent != null) {
    status.textContent = `${progress.percent.toFixed(2)}% • ${progress.speed} • ETA ${progress.eta}`;
  }
});

// Inicializa el select de formato
updateFormatOptions();
kindSelect.addEventListener('change', updateFormatOptions);
